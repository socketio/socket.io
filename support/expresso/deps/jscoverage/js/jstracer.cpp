/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=4 sw=4 et tw=99:
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla SpiderMonkey JavaScript 1.9 code, released
 * May 28, 2008.
 *
 * The Initial Developer of the Original Code is
 *   Brendan Eich <brendan@mozilla.org>
 *
 * Contributor(s):
 *   Andreas Gal <gal@mozilla.com>
 *   Mike Shaver <shaver@mozilla.org>
 *   David Anderson <danderson@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "jsstddef.h"           // always first
#include "jsbit.h"              // low-level (NSPR-based) headers next
#include "jsprf.h"
#include <math.h>               // standard headers next
#ifdef _MSC_VER
#include <malloc.h>
#define alloca _alloca
#endif
#ifdef SOLARIS
#include <alloca.h>
#endif

#include "nanojit/nanojit.h"
#include "jsarray.h"            // higher-level library and API headers
#include "jsbool.h"
#include "jscntxt.h"
#include "jsdbgapi.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jsinterp.h"
#include "jsiter.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsregexp.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsdate.h"
#include "jsstaticcheck.h"
#include "jstracer.h"

#include "jsautooplen.h"        // generated headers last

/* Never use JSVAL_IS_BOOLEAN because it restricts the value (true, false) and 
   the type. What you want to use is JSVAL_TAG(x) == JSVAL_BOOLEAN and then 
   handle the undefined case properly (bug 457363). */
#undef JSVAL_IS_BOOLEAN
#define JSVAL_IS_BOOLEAN(x) JS_STATIC_ASSERT(0) 

/* Use a fake tag to represent boxed values, borrowing from the integer tag
   range since we only use JSVAL_INT to indicate integers. */
#define JSVAL_BOXED 3

/* Map to translate a type tag into a printable representation. */
static const char typeChar[] = "OIDVS?B?";

/* Number of iterations of a loop where we start tracing.  That is, we don't
   start tracing until the beginning of the HOTLOOP-th iteration. */
#define HOTLOOP 2

/* Number of times we wait to exit on a side exit before we try to extend the tree. */
#define HOTEXIT 1

/* Max call depths for inlining. */
#define MAX_CALLDEPTH 10

/* Max number of type mismatchs before we trash the tree. */
#define MAX_MISMATCH 20

/* Max blacklist level of inner tree immediate recompiling  */
#define MAX_INNER_RECORD_BLACKLIST  -16

/* Max native stack size. */
#define MAX_NATIVE_STACK_SLOTS 1024

/* Max call stack size. */
#define MAX_CALL_STACK_ENTRIES 64

/* Max number of branches per tree. */
#define MAX_BRANCHES 16

/* Macros for demote slot lists */
#define ALLOCA_UNDEMOTE_SLOTLIST(num)     (unsigned*)alloca(((num) + 1) * sizeof(unsigned))
#define ADD_UNDEMOTE_SLOT(list, slot)     list[++list[0]] = slot
#define NUM_UNDEMOTE_SLOTS(list)          list[0]
#define CLEAR_UNDEMOTE_SLOTLIST(list)     list[0] = 0

#ifdef JS_JIT_SPEW
#define ABORT_TRACE(msg)   do { debug_only_v(fprintf(stdout, "abort: %d: %s\n", __LINE__, msg);)  return false; } while (0)
#else
#define ABORT_TRACE(msg)   return false
#endif

#ifdef JS_JIT_SPEW
struct __jitstats {
#define JITSTAT(x) uint64 x;
#include "jitstats.tbl"
#undef JITSTAT
} jitstats = { 0LL, };

JS_STATIC_ASSERT(sizeof(jitstats) % sizeof(uint64) == 0);

enum jitstat_ids {
#define JITSTAT(x) STAT ## x ## ID,
#include "jitstats.tbl"
#undef JITSTAT
    STAT_IDS_TOTAL
};

static JSPropertySpec jitstats_props[] = {
#define JITSTAT(x) { #x, STAT ## x ## ID, JSPROP_ENUMERATE | JSPROP_READONLY | JSPROP_PERMANENT },
#include "jitstats.tbl"
#undef JITSTAT
    { 0 }
};

static JSBool
jitstats_getProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    int index = -1;

    if (JSVAL_IS_STRING(id)) {
        JSString* str = JSVAL_TO_STRING(id);
        if (strcmp(JS_GetStringBytes(str), "HOTLOOP") == 0) {
            *vp = INT_TO_JSVAL(HOTLOOP);
            return JS_TRUE;
        }
    }

    if (JSVAL_IS_INT(id))
        index = JSVAL_TO_INT(id);

    uint64 result = 0;
    switch (index) {
#define JITSTAT(x) case STAT ## x ## ID: result = jitstats.x; break;
#include "jitstats.tbl"
#undef JITSTAT
      default:
        *vp = JSVAL_VOID;
        return JS_TRUE;
    }

    if (result < JSVAL_INT_MAX) {
        *vp = INT_TO_JSVAL(result);
        return JS_TRUE;
    }
    char retstr[64];
    JS_snprintf(retstr, sizeof retstr, "%llu", result);
    *vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, retstr));
    return JS_TRUE;
}

JSClass jitstats_class = {
    "jitstats",
    JSCLASS_HAS_PRIVATE,
    JS_PropertyStub,       JS_PropertyStub,
    jitstats_getProperty,  JS_PropertyStub,
    JS_EnumerateStub,      JS_ResolveStub,
    JS_ConvertStub,        JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS
};

void
js_InitJITStatsClass(JSContext *cx, JSObject *glob)
{
    JS_InitClass(cx, glob, NULL, &jitstats_class, NULL, 0, jitstats_props, NULL, NULL, NULL);
}

#define AUDIT(x) (jitstats.x++)
#else
#define AUDIT(x) ((void)0)
#endif /* JS_JIT_SPEW */

#define INS_CONST(c)    addName(lir->insImm(c), #c)
#define INS_CONSTPTR(p) addName(lir->insImmPtr((void*) (p)), #p)

using namespace avmplus;
using namespace nanojit;

static GC gc = GC();
static avmplus::AvmCore s_core = avmplus::AvmCore();
static avmplus::AvmCore* core = &s_core;

#ifdef JS_JIT_SPEW
void
js_DumpPeerStability(Fragmento* frago, const void* ip);
#endif

/* We really need a better way to configure the JIT. Shaver, where is my fancy JIT object? */
static bool nesting_enabled = true;
#if defined(NANOJIT_IA32)
static bool did_we_check_sse2 = false;
#endif

#ifdef JS_JIT_SPEW
static bool verbose_debug = getenv("TRACEMONKEY") && strstr(getenv("TRACEMONKEY"), "verbose");
#define debug_only_v(x) if (verbose_debug) { x; }
#else
#define debug_only_v(x)
#endif

/* The entire VM shares one oracle. Collisions and concurrent updates are tolerated and worst
   case cause performance regressions. */
static Oracle oracle;

/* Blacklists the root peer fragment at a fragment's PC.  This is so blacklisting stays at the 
   top of the peer list and not scattered around. */
void
js_BlacklistPC(Fragmento* frago, Fragment* frag);

Tracker::Tracker()
{
    pagelist = 0;
}

Tracker::~Tracker()
{
    clear();
}

jsuword
Tracker::getPageBase(const void* v) const
{
    return jsuword(v) & ~jsuword(NJ_PAGE_SIZE-1);
}

struct Tracker::Page*
Tracker::findPage(const void* v) const
{
    jsuword base = getPageBase(v);
    struct Tracker::Page* p = pagelist;
    while (p) {
        if (p->base == base) {
            return p;
        }
        p = p->next;
    }
    return 0;
}

struct Tracker::Page*
Tracker::addPage(const void* v) {
    jsuword base = getPageBase(v);
    struct Tracker::Page* p = (struct Tracker::Page*)
        GC::Alloc(sizeof(*p) - sizeof(p->map) + (NJ_PAGE_SIZE >> 2) * sizeof(LIns*));
    p->base = base;
    p->next = pagelist;
    pagelist = p;
    return p;
}

void
Tracker::clear()
{
    while (pagelist) {
        Page* p = pagelist;
        pagelist = pagelist->next;
        GC::Free(p);
    }
}

bool
Tracker::has(const void *v) const
{
    return get(v) != NULL;
}

#if defined NANOJIT_64BIT
#define PAGEMASK	0x7ff
#else
#define PAGEMASK	0xfff
#endif

LIns*
Tracker::get(const void* v) const
{
    struct Tracker::Page* p = findPage(v);
    if (!p)
        return NULL;
    return p->map[(jsuword(v) & PAGEMASK) >> 2];
}

void
Tracker::set(const void* v, LIns* i)
{
    struct Tracker::Page* p = findPage(v);
    if (!p)
        p = addPage(v);
    p->map[(jsuword(v) & PAGEMASK) >> 2] = i;
}

static inline bool isNumber(jsval v)
{
    return JSVAL_IS_INT(v) || JSVAL_IS_DOUBLE(v);
}

static inline jsdouble asNumber(jsval v)
{
    JS_ASSERT(isNumber(v));
    if (JSVAL_IS_DOUBLE(v))
        return *JSVAL_TO_DOUBLE(v);
    return (jsdouble)JSVAL_TO_INT(v);
}

static inline bool isInt32(jsval v)
{
    if (!isNumber(v))
        return false;
    jsdouble d = asNumber(v);
    jsint i;
    return JSDOUBLE_IS_INT(d, i);
}

/* Return JSVAL_DOUBLE for all numbers (int and double) and the tag otherwise. */
static inline uint8 getPromotedType(jsval v) 
{
    return JSVAL_IS_INT(v) ? JSVAL_DOUBLE : uint8(JSVAL_TAG(v));
}

/* Return JSVAL_INT for all whole numbers that fit into signed 32-bit and the tag otherwise. */
static inline uint8 getCoercedType(jsval v)
{
    return isInt32(v) ? JSVAL_INT : (uint8) JSVAL_TAG(v);
}

/* Tell the oracle that a certain global variable should not be demoted. */
void
Oracle::markGlobalSlotUndemotable(JSScript* script, unsigned slot)
{
    _dontDemote.set(&gc, (slot % ORACLE_SIZE));
}

/* Consult with the oracle whether we shouldn't demote a certain global variable. */
bool
Oracle::isGlobalSlotUndemotable(JSScript* script, unsigned slot) const
{
    return _dontDemote.get(slot % ORACLE_SIZE);
}

/* Tell the oracle that a certain slot at a certain bytecode location should not be demoted. */
void
Oracle::markStackSlotUndemotable(JSScript* script, jsbytecode* ip, unsigned slot)
{
    uint32 hash = uint32(intptr_t(ip)) + (slot << 5);
    hash %= ORACLE_SIZE;
    _dontDemote.set(&gc, hash);
}

/* Consult with the oracle whether we shouldn't demote a certain slot. */
bool
Oracle::isStackSlotUndemotable(JSScript* script, jsbytecode* ip, unsigned slot) const
{
    uint32 hash = uint32(intptr_t(ip)) + (slot << 5);
    hash %= ORACLE_SIZE;
    return _dontDemote.get(hash);
}

/* Clear the oracle. */
void
Oracle::clear()
{
    _dontDemote.reset();
}

#if defined(NJ_SOFTFLOAT)
JS_DEFINE_CALLINFO_1(static, DOUBLE,    i2f, INT32,                 1, 1)
JS_DEFINE_CALLINFO_1(static, DOUBLE,    u2f, UINT32,                1, 1)
#endif

static bool isi2f(LInsp i)
{
    if (i->isop(LIR_i2f))
        return true;

#if defined(NJ_SOFTFLOAT)
    if (i->isop(LIR_qjoin) &&
        i->oprnd1()->isop(LIR_call) &&
        i->oprnd2()->isop(LIR_callh))
    {
        if (i->oprnd1()->callInfo() == &i2f_ci)
            return true;
    }
#endif

    return false;
}

static bool isu2f(LInsp i)
{
    if (i->isop(LIR_u2f))
        return true;

#if defined(NJ_SOFTFLOAT)
    if (i->isop(LIR_qjoin) &&
        i->oprnd1()->isop(LIR_call) &&
        i->oprnd2()->isop(LIR_callh))
    {
        if (i->oprnd1()->callInfo() == &u2f_ci)
            return true;
    }
#endif

    return false;
}

static LInsp iu2fArg(LInsp i)
{
#if defined(NJ_SOFTFLOAT)
    if (i->isop(LIR_qjoin))
        return i->oprnd1()->arg(0);
#endif

    return i->oprnd1();
}


static LIns* demote(LirWriter *out, LInsp i)
{
    if (i->isCall())
        return callArgN(i, 0);
    if (isi2f(i) || isu2f(i))
        return iu2fArg(i);
    if (i->isconst())
        return i;
    AvmAssert(i->isconstq());
    double cf = i->constvalf();
    int32_t ci = cf > 0x7fffffff ? uint32_t(cf) : int32_t(cf);
    return out->insImm(ci);
}

static bool isPromoteInt(LIns* i)
{
    jsdouble d;
    return isi2f(i) || i->isconst() ||
        (i->isconstq() && (d = i->constvalf()) == jsdouble(jsint(d)) && !JSDOUBLE_IS_NEGZERO(d));
}

static bool isPromoteUint(LIns* i)
{
    jsdouble d;
    return isu2f(i) || i->isconst() ||
        (i->isconstq() && (d = i->constvalf()) == (jsdouble)(jsuint)d && !JSDOUBLE_IS_NEGZERO(d));
}

static bool isPromote(LIns* i)
{
    return isPromoteInt(i) || isPromoteUint(i);
}

static bool isconst(LIns* i, int32_t c)
{
    return i->isconst() && i->constval() == c;
}

static bool overflowSafe(LIns* i)
{
    LIns* c;
    return (i->isop(LIR_and) && ((c = i->oprnd2())->isconst()) &&
            ((c->constval() & 0xc0000000) == 0)) ||
           (i->isop(LIR_rsh) && ((c = i->oprnd2())->isconst()) &&
            ((c->constval() > 0)));
}

#if defined(NJ_SOFTFLOAT)
/* soft float */

JS_DEFINE_CALLINFO_1(static, DOUBLE,    fneg, DOUBLE,               1, 1)
JS_DEFINE_CALLINFO_2(static, INT32,     fcmpeq, DOUBLE, DOUBLE,     1, 1)
JS_DEFINE_CALLINFO_2(static, INT32,     fcmplt, DOUBLE, DOUBLE,     1, 1)
JS_DEFINE_CALLINFO_2(static, INT32,     fcmple, DOUBLE, DOUBLE,     1, 1)
JS_DEFINE_CALLINFO_2(static, INT32,     fcmpgt, DOUBLE, DOUBLE,     1, 1)
JS_DEFINE_CALLINFO_2(static, INT32,     fcmpge, DOUBLE, DOUBLE,     1, 1)
JS_DEFINE_CALLINFO_2(static, DOUBLE,    fmul, DOUBLE, DOUBLE,       1, 1)
JS_DEFINE_CALLINFO_2(static, DOUBLE,    fadd, DOUBLE, DOUBLE,       1, 1)
JS_DEFINE_CALLINFO_2(static, DOUBLE,    fdiv, DOUBLE, DOUBLE,       1, 1)
JS_DEFINE_CALLINFO_2(static, DOUBLE,    fsub, DOUBLE, DOUBLE,       1, 1)

jsdouble FASTCALL
fneg(jsdouble x)
{
    return -x;
}

jsdouble FASTCALL
i2f(int32 i)
{
    return i;
}

jsdouble FASTCALL
u2f(jsuint u)
{
    return u;
}

int32 FASTCALL
fcmpeq(jsdouble x, jsdouble y)
{
    return x==y;
}

int32 FASTCALL
fcmplt(jsdouble x, jsdouble y)
{
    return x < y;
}

int32 FASTCALL
fcmple(jsdouble x, jsdouble y)
{
    return x <= y;
}

int32 FASTCALL
fcmpgt(jsdouble x, jsdouble y)
{
    return x > y;
}

int32 FASTCALL
fcmpge(jsdouble x, jsdouble y)
{
    return x >= y;
}

jsdouble FASTCALL
fmul(jsdouble x, jsdouble y)
{
    return x * y;
}

jsdouble FASTCALL
fadd(jsdouble x, jsdouble y)
{
    return x + y;
}

jsdouble FASTCALL
fdiv(jsdouble x, jsdouble y)
{
    return x / y;
}

jsdouble FASTCALL
fsub(jsdouble x, jsdouble y)
{
    return x - y;
}

class SoftFloatFilter: public LirWriter
{
public:
    SoftFloatFilter(LirWriter* out):
        LirWriter(out)
    {
    }

    LInsp quadCall(const CallInfo *ci, LInsp args[]) {
        LInsp qlo, qhi;

        qlo = out->insCall(ci, args);
        qhi = out->ins1(LIR_callh, qlo);
        return out->qjoin(qlo, qhi);
    }

    LInsp ins1(LOpcode v, LInsp s0)
    {
        if (v == LIR_fneg)
            return quadCall(&fneg_ci, &s0);

        if (v == LIR_i2f)
            return quadCall(&i2f_ci, &s0);

        if (v == LIR_u2f)
            return quadCall(&u2f_ci, &s0);

        return out->ins1(v, s0);
    }

    LInsp ins2(LOpcode v, LInsp s0, LInsp s1)
    {
        LInsp args[2];
        LInsp bv;

        // change the numeric value and order of these LIR opcodes and die
        if (LIR_fadd <= v && v <= LIR_fdiv) {
            static const CallInfo *fmap[] = { &fadd_ci, &fsub_ci, &fmul_ci, &fdiv_ci };

            args[0] = s1;
            args[1] = s0;

            return quadCall(fmap[v - LIR_fadd], args);
        }

        if (LIR_feq <= v && v <= LIR_fge) {
            static const CallInfo *fmap[] = { &fcmpeq_ci, &fcmplt_ci, &fcmpgt_ci, &fcmple_ci, &fcmpge_ci };

            args[0] = s1;
            args[1] = s0;

            bv = out->insCall(fmap[v - LIR_feq], args);
            return out->ins2(LIR_eq, bv, out->insImm(1));
        }

        return out->ins2(v, s0, s1);
    }

    LInsp insCall(const CallInfo *ci, LInsp args[])
    {
        // if the return type is ARGSIZE_F, we have
        // to do a quadCall ( qjoin(call,callh) )
        if ((ci->_argtypes & 3) == ARGSIZE_F)
            return quadCall(ci, args);

        return out->insCall(ci, args);
    }
};

#endif // NJ_SOFTFLOAT

class FuncFilter: public LirWriter
{
public:
    FuncFilter(LirWriter* out):
        LirWriter(out)
    {
    }

    LInsp ins2(LOpcode v, LInsp s0, LInsp s1)
    {
        if (s0 == s1 && v == LIR_feq) {
            if (isPromote(s0)) {
                // double(int) and double(uint) cannot be nan
                return insImm(1);
            }
            if (s0->isop(LIR_fmul) || s0->isop(LIR_fsub) || s0->isop(LIR_fadd)) {
                LInsp lhs = s0->oprnd1();
                LInsp rhs = s0->oprnd2();
                if (isPromote(lhs) && isPromote(rhs)) {
                    // add/sub/mul promoted ints can't be nan
                    return insImm(1);
                }
            }
        } else if (LIR_feq <= v && v <= LIR_fge) {
            if (isPromoteInt(s0) && isPromoteInt(s1)) {
                // demote fcmp to cmp
                v = LOpcode(v + (LIR_eq - LIR_feq));
                return out->ins2(v, demote(out, s0), demote(out, s1));
            } else if (isPromoteUint(s0) && isPromoteUint(s1)) {
                // uint compare
                v = LOpcode(v + (LIR_eq - LIR_feq));
                if (v != LIR_eq)
                    v = LOpcode(v + (LIR_ult - LIR_lt)); // cmp -> ucmp
                return out->ins2(v, demote(out, s0), demote(out, s1));
            }
        } else if (v == LIR_or &&
                   s0->isop(LIR_lsh) && isconst(s0->oprnd2(), 16) &&
                   s1->isop(LIR_and) && isconst(s1->oprnd2(), 0xffff)) {
            LIns* msw = s0->oprnd1();
            LIns* lsw = s1->oprnd1();
            LIns* x;
            LIns* y;
            if (lsw->isop(LIR_add) &&
                lsw->oprnd1()->isop(LIR_and) &&
                lsw->oprnd2()->isop(LIR_and) &&
                isconst(lsw->oprnd1()->oprnd2(), 0xffff) &&
                isconst(lsw->oprnd2()->oprnd2(), 0xffff) &&
                msw->isop(LIR_add) &&
                msw->oprnd1()->isop(LIR_add) &&
                msw->oprnd2()->isop(LIR_rsh) &&
                msw->oprnd1()->oprnd1()->isop(LIR_rsh) &&
                msw->oprnd1()->oprnd2()->isop(LIR_rsh) &&
                isconst(msw->oprnd2()->oprnd2(), 16) &&
                isconst(msw->oprnd1()->oprnd1()->oprnd2(), 16) &&
                isconst(msw->oprnd1()->oprnd2()->oprnd2(), 16) &&
                (x = lsw->oprnd1()->oprnd1()) == msw->oprnd1()->oprnd1()->oprnd1() &&
                (y = lsw->oprnd2()->oprnd1()) == msw->oprnd1()->oprnd2()->oprnd1() &&
                lsw == msw->oprnd2()->oprnd1()) {
                return out->ins2(LIR_add, x, y);
            }
        }
#ifdef NANOJIT_ARM
        else if (v == LIR_lsh ||
                 v == LIR_rsh ||
                 v == LIR_ush)
        {
            // needed on ARM -- arm doesn't mask shifts to 31 like x86 does
            if (s1->isconst())
                s1->setimm16(s1->constval() & 31);
            else
                s1 = out->ins2(LIR_and, s1, out->insImm(31));
            return out->ins2(v, s0, s1);
        }
#endif

        return out->ins2(v, s0, s1);
    }

    LInsp insCall(const CallInfo *ci, LInsp args[])
    {
        LInsp s0 = args[0];
        if (ci == &js_DoubleToUint32_ci) {
            if (s0->isconstq())
                return out->insImm(js_DoubleToECMAUint32(s0->constvalf()));
            if (isi2f(s0) || isu2f(s0))
                return iu2fArg(s0);
        } else if (ci == &js_DoubleToInt32_ci) {
            if (s0->isconstq())
                return out->insImm(js_DoubleToECMAInt32(s0->constvalf()));
            if (s0->isop(LIR_fadd) || s0->isop(LIR_fsub)) {
                LInsp lhs = s0->oprnd1();
                LInsp rhs = s0->oprnd2();
                if (isPromote(lhs) && isPromote(rhs)) {
                    LOpcode op = LOpcode(s0->opcode() & ~LIR64);
                    return out->ins2(op, demote(out, lhs), demote(out, rhs));
                }
            }
            if (isi2f(s0) || isu2f(s0))
                return iu2fArg(s0);
            // XXX ARM -- check for qjoin(call(UnboxDouble),call(UnboxDouble))
            if (s0->isCall() && s0->callInfo() == &js_UnboxDouble_ci) {
                LIns* args2[] = { callArgN(s0, 0) };
                return out->insCall(&js_UnboxInt32_ci, args2);
            }
            if (s0->isCall() && s0->callInfo() == &js_StringToNumber_ci) {
                // callArgN's ordering is that as seen by the builtin, not as stored in args here.
                // True story!
                LIns* args2[] = { callArgN(s0, 1), callArgN(s0, 0) };
                return out->insCall(&js_StringToInt32_ci, args2);
            }
        } else if (ci == &js_BoxDouble_ci) {
            JS_ASSERT(s0->isQuad());
            if (s0->isop(LIR_i2f)) {
                LIns* args2[] = { s0->oprnd1(), args[1] };
                return out->insCall(&js_BoxInt32_ci, args2);
            }
            if (s0->isCall() && s0->callInfo() == &js_UnboxDouble_ci)
                return callArgN(s0, 0);
        }
        return out->insCall(ci, args);
    }
};

/* In debug mode vpname contains a textual description of the type of the
   slot during the forall iteration over al slots. */
#ifdef JS_JIT_SPEW
#define DEF_VPNAME          const char* vpname; unsigned vpnum
#define SET_VPNAME(name)    do { vpname = name; vpnum = 0; } while(0)
#define INC_VPNUM()         do { ++vpnum; } while(0)
#else
#define DEF_VPNAME          do {} while (0)
#define vpname ""
#define vpnum 0
#define SET_VPNAME(name)    ((void)0)
#define INC_VPNUM()         ((void)0)
#endif

/* Iterate over all interned global variables. */
#define FORALL_GLOBAL_SLOTS(cx, ngslots, gslots, code)                        \
    JS_BEGIN_MACRO                                                            \
        DEF_VPNAME;                                                           \
        JSObject* globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);  \
        unsigned n;                                                           \
        jsval* vp;                                                            \
        SET_VPNAME("global");                                                 \
        for (n = 0; n < ngslots; ++n) {                                       \
            vp = &STOBJ_GET_SLOT(globalObj, gslots[n]);                       \
            { code; }                                                         \
            INC_VPNUM();                                                      \
        }                                                                     \
    JS_END_MACRO

/* Iterate over all slots in the frame, consisting of args, vars, and stack
   (except for the top-level frame which does not have args or vars. */
#define FORALL_FRAME_SLOTS(fp, depth, code)                                   \
    JS_BEGIN_MACRO                                                            \
        jsval* vp;                                                            \
        jsval* vpstop;                                                        \
        if (fp->callee) {                                                     \
            if (depth == 0) {                                                 \
                SET_VPNAME("callee");                                         \
                vp = &fp->argv[-2];                                           \
                { code; }                                                     \
                SET_VPNAME("this");                                           \
                vp = &fp->argv[-1];                                           \
                { code; }                                                     \
                SET_VPNAME("argv");                                           \
                vp = &fp->argv[0]; vpstop = &fp->argv[fp->fun->nargs];        \
                while (vp < vpstop) { code; ++vp; INC_VPNUM(); }              \
            }                                                                 \
            SET_VPNAME("vars");                                               \
            vp = fp->slots; vpstop = &fp->slots[fp->script->nfixed];          \
            while (vp < vpstop) { code; ++vp; INC_VPNUM(); }                  \
        }                                                                     \
        SET_VPNAME("stack");                                                  \
        vp = StackBase(fp); vpstop = fp->regs->sp;                            \
        while (vp < vpstop) { code; ++vp; INC_VPNUM(); }                      \
        if (fsp < fspstop - 1) {                                              \
            JSStackFrame* fp2 = fsp[1];                                       \
            int missing = fp2->fun->nargs - fp2->argc;                        \
            if (missing > 0) {                                                \
                SET_VPNAME("missing");                                        \
                vp = fp->regs->sp;                                            \
                vpstop = vp + missing;                                        \
                while (vp < vpstop) { code; ++vp; INC_VPNUM(); }              \
            }                                                                 \
        }                                                                     \
    JS_END_MACRO

/* Iterate over all slots in each pending frame. */
#define FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth, code)                   \
    JS_BEGIN_MACRO                                                            \
        DEF_VPNAME;                                                           \
        unsigned n;                                                           \
        JSStackFrame* currentFrame = cx->fp;                                  \
        JSStackFrame* entryFrame;                                             \
        JSStackFrame* fp = currentFrame;                                      \
        for (n = 0; n < callDepth; ++n) { fp = fp->down; }                    \
        entryFrame = fp;                                                      \
        unsigned frames = callDepth+1;                                        \
        JSStackFrame** fstack =                                               \
            (JSStackFrame**) alloca(frames * sizeof (JSStackFrame*));         \
        JSStackFrame** fspstop = &fstack[frames];                             \
        JSStackFrame** fsp = fspstop-1;                                       \
        fp = currentFrame;                                                    \
        for (;; fp = fp->down) { *fsp-- = fp; if (fp == entryFrame) break; }  \
        unsigned depth;                                                       \
        for (depth = 0, fsp = fstack; fsp < fspstop; ++fsp, ++depth) {        \
            fp = *fsp;                                                        \
            FORALL_FRAME_SLOTS(fp, depth, code);                              \
        }                                                                     \
    JS_END_MACRO

#define FORALL_SLOTS(cx, ngslots, gslots, callDepth, code)                    \
    JS_BEGIN_MACRO                                                            \
        FORALL_GLOBAL_SLOTS(cx, ngslots, gslots, code);                       \
        FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth, code);                  \
    JS_END_MACRO

/* Calculate the total number of native frame slots we need from this frame
   all the way back to the entry frame, including the current stack usage. */
unsigned
js_NativeStackSlots(JSContext *cx, unsigned callDepth)
{
    JSStackFrame* fp = cx->fp;
    unsigned slots = 0;
#if defined _DEBUG
    unsigned int origCallDepth = callDepth;
#endif
    for (;;) {
        unsigned operands = fp->regs->sp - StackBase(fp);
        slots += operands;
        if (fp->callee)
            slots += fp->script->nfixed;
        if (callDepth-- == 0) {
            if (fp->callee)
                slots += 2/*callee,this*/ + fp->fun->nargs;
#if defined _DEBUG
            unsigned int m = 0;
            FORALL_SLOTS_IN_PENDING_FRAMES(cx, origCallDepth, m++);
            JS_ASSERT(m == slots);
#endif
            return slots;
        }
        JSStackFrame* fp2 = fp;
        fp = fp->down;
        int missing = fp2->fun->nargs - fp2->argc;
        if (missing > 0)
            slots += missing;
    }
    JS_NOT_REACHED("js_NativeStackSlots");
}

/* Capture the type map for the selected slots of the global object. */
void
TypeMap::captureGlobalTypes(JSContext* cx, SlotList& slots)
{
    unsigned ngslots = slots.length();
    uint16* gslots = slots.data();
    setLength(ngslots);
    uint8* map = data();
    uint8* m = map;
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
        uint8 type = getCoercedType(*vp);
        if ((type == JSVAL_INT) && oracle.isGlobalSlotUndemotable(cx->fp->script, gslots[n]))
            type = JSVAL_DOUBLE;
        JS_ASSERT(type != JSVAL_BOXED);
        *m++ = type;
    );
}

/* Capture the type map for the currently pending stack frames. */
void
TypeMap::captureStackTypes(JSContext* cx, unsigned callDepth)
{
    setLength(js_NativeStackSlots(cx, callDepth));
    uint8* map = data();
    uint8* m = map;
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth,
        uint8 type = getCoercedType(*vp);
        if ((type == JSVAL_INT) &&
            oracle.isStackSlotUndemotable(cx->fp->script, cx->fp->regs->pc, unsigned(m - map))) {
            type = JSVAL_DOUBLE;
        }
        debug_only_v(printf("capture %s%d: %d\n", vpname, vpnum, type);)
        *m++ = type;
    );
}

/* Compare this type map to another one and see whether they match. */
bool
TypeMap::matches(TypeMap& other) const
{
    if (length() != other.length())
        return false;
    return !memcmp(data(), other.data(), length());
}

/* Use the provided storage area to create a new type map that contains the partial type map
   with the rest of it filled up from the complete type map. */
static void
mergeTypeMaps(uint8** partial, unsigned* plength, uint8* complete, unsigned clength, uint8* mem)
{
    unsigned l = *plength;
    JS_ASSERT(l < clength);
    memcpy(mem, *partial, l * sizeof(uint8));
    memcpy(mem + l, complete + l, (clength - l) * sizeof(uint8));
    *partial = mem;
    *plength = clength;
}

static void
js_TrashTree(JSContext* cx, Fragment* f);

TraceRecorder::TraceRecorder(JSContext* cx, VMSideExit* _anchor, Fragment* _fragment,
        TreeInfo* ti, unsigned ngslots, uint8* globalTypeMap, uint8* stackTypeMap,
        VMSideExit* innermostNestedGuard, Fragment* outerToBlacklist)
{
    JS_ASSERT(!_fragment->vmprivate && ti);

    this->cx = cx;
    this->traceMonitor = &JS_TRACE_MONITOR(cx);
    this->globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);
    this->anchor = _anchor;
    this->fragment = _fragment;
    this->lirbuf = _fragment->lirbuf;
    this->treeInfo = ti;
    this->callDepth = _anchor ? _anchor->calldepth : 0;
    this->atoms = cx->fp->script->atomMap.vector;
    this->deepAborted = false;
    this->applyingArguments = false;
    this->trashTree = false;
    this->whichTreeToTrash = _fragment->root;
    this->global_dslots = this->globalObj->dslots;
    this->terminate = false;
    this->outerToBlacklist = outerToBlacklist;
    this->wasRootFragment = _fragment == _fragment->root;

    debug_only_v(printf("recording starting from %s:%u@%u\n",
                        cx->fp->script->filename,
                        js_FramePCToLineNumber(cx, cx->fp),
                        FramePCOffset(cx->fp));)
    debug_only_v(printf("globalObj=%p, shape=%d\n", this->globalObj, OBJ_SHAPE(this->globalObj));)

    lir = lir_buf_writer = new (&gc) LirBufWriter(lirbuf);
#ifdef DEBUG
    if (verbose_debug)
        lir = verbose_filter = new (&gc) VerboseWriter(&gc, lir, lirbuf->names);
#endif
#ifdef NJ_SOFTFLOAT
    lir = float_filter = new (&gc) SoftFloatFilter(lir);
#endif
    lir = cse_filter = new (&gc) CseFilter(lir, &gc);
    lir = expr_filter = new (&gc) ExprFilter(lir);
    lir = func_filter = new (&gc) FuncFilter(lir);
    lir->ins0(LIR_start);

    if (!nanojit::AvmCore::config.tree_opt || fragment->root == fragment) 
        lirbuf->state = addName(lir->insParam(0, 0), "state");

    lirbuf->sp = addName(lir->insLoad(LIR_ldp, lirbuf->state, (int)offsetof(InterpState, sp)), "sp");
    lirbuf->rp = addName(lir->insLoad(LIR_ldp, lirbuf->state, offsetof(InterpState, rp)), "rp");
    cx_ins = addName(lir->insLoad(LIR_ldp, lirbuf->state, offsetof(InterpState, cx)), "cx");
    gp_ins = addName(lir->insLoad(LIR_ldp, lirbuf->state, offsetof(InterpState, gp)), "gp");
    eos_ins = addName(lir->insLoad(LIR_ldp, lirbuf->state, offsetof(InterpState, eos)), "eos");
    eor_ins = addName(lir->insLoad(LIR_ldp, lirbuf->state, offsetof(InterpState, eor)), "eor");

    /* read into registers all values on the stack and all globals we know so far */
    import(treeInfo, lirbuf->sp, ngslots, callDepth, globalTypeMap, stackTypeMap);

    /* If we are attached to a tree call guard, make sure the guard the inner tree exited from
       is what we expect it to be. */
    if (_anchor && _anchor->exitType == NESTED_EXIT) {
        LIns* nested_ins = addName(lir->insLoad(LIR_ldp, lirbuf->state, 
                                                offsetof(InterpState, lastTreeExitGuard)), 
                                                "lastTreeExitGuard");
        guard(true, lir->ins2(LIR_eq, nested_ins, INS_CONSTPTR(innermostNestedGuard)), NESTED_EXIT);
    }
}

TreeInfo::~TreeInfo()
{
    UnstableExit* temp;

    while (unstableExits) {
        temp = unstableExits->next;
        delete unstableExits;
        unstableExits = temp;
    }
}

TraceRecorder::~TraceRecorder()
{
    JS_ASSERT(nextRecorderToAbort == NULL);
    JS_ASSERT(treeInfo && (fragment || wasDeepAborted()));
#ifdef DEBUG
    TraceRecorder* tr = JS_TRACE_MONITOR(cx).abortStack;
    while (tr != NULL)
    {
        JS_ASSERT(this != tr);
        tr = tr->nextRecorderToAbort;
    }
#endif
    if (fragment) {
        if (wasRootFragment && !fragment->root->code()) {
            JS_ASSERT(!fragment->root->vmprivate);
            delete treeInfo;
        }
        if (trashTree)
            js_TrashTree(cx, whichTreeToTrash);
    } else if (wasRootFragment) {
        delete treeInfo;
    }
#ifdef DEBUG
    delete verbose_filter;
#endif
    delete cse_filter;
    delete expr_filter;
    delete func_filter;
#ifdef NJ_SOFTFLOAT
    delete float_filter;
#endif
    delete lir_buf_writer;
}

void TraceRecorder::removeFragmentoReferences()
{
    fragment = NULL;
}

/* Add debug information to a LIR instruction as we emit it. */
inline LIns*
TraceRecorder::addName(LIns* ins, const char* name)
{
#ifdef DEBUG
    lirbuf->names->addName(ins, name);
#endif
    return ins;
}

/* Determine the current call depth (starting with the entry frame.) */
unsigned
TraceRecorder::getCallDepth() const
{
    return callDepth;
}

/* Determine the offset in the native global frame for a jsval we track */
ptrdiff_t
TraceRecorder::nativeGlobalOffset(jsval* p) const
{
    JS_ASSERT(isGlobal(p));
    if (size_t(p - globalObj->fslots) < JS_INITIAL_NSLOTS)
        return size_t(p - globalObj->fslots) * sizeof(double);
    return ((p - globalObj->dslots) + JS_INITIAL_NSLOTS) * sizeof(double);
}

/* Determine whether a value is a global stack slot */
bool
TraceRecorder::isGlobal(jsval* p) const
{
    return ((size_t(p - globalObj->fslots) < JS_INITIAL_NSLOTS) ||
            (size_t(p - globalObj->dslots) < (STOBJ_NSLOTS(globalObj) - JS_INITIAL_NSLOTS)));
}

/* Determine the offset in the native stack for a jsval we track */
ptrdiff_t
TraceRecorder::nativeStackOffset(jsval* p) const
{
#ifdef DEBUG
    size_t slow_offset = 0;
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth,
        if (vp == p) goto done;
        slow_offset += sizeof(double)
    );

    /*
     * If it's not in a pending frame, it must be on the stack of the current frame above
     * sp but below fp->slots + script->nslots.
     */
    JS_ASSERT(size_t(p - cx->fp->slots) < cx->fp->script->nslots);
    slow_offset += size_t(p - cx->fp->regs->sp) * sizeof(double);

done:
#define RETURN(offset) { JS_ASSERT((offset) == slow_offset); return offset; }
#else
#define RETURN(offset) { return offset; }
#endif
    size_t offset = 0;
    JSStackFrame* currentFrame = cx->fp;
    JSStackFrame* entryFrame;
    JSStackFrame* fp = currentFrame;
    for (unsigned n = 0; n < callDepth; ++n) { fp = fp->down; }
    entryFrame = fp;
    unsigned frames = callDepth+1;
    JSStackFrame** fstack = (JSStackFrame **)alloca(frames * sizeof (JSStackFrame *));
    JSStackFrame** fspstop = &fstack[frames];
    JSStackFrame** fsp = fspstop-1;
    fp = currentFrame;
    for (;; fp = fp->down) { *fsp-- = fp; if (fp == entryFrame) break; }
    for (fsp = fstack; fsp < fspstop; ++fsp) {
        fp = *fsp;
        if (fp->callee) {
            if (fsp == fstack) {
                if (size_t(p - &fp->argv[-2]) < size_t(2/*callee,this*/ + fp->fun->nargs))
                    RETURN(offset + size_t(p - &fp->argv[-2]) * sizeof(double));
                offset += (2/*callee,this*/ + fp->fun->nargs) * sizeof(double);
            }
            if (size_t(p - &fp->slots[0]) < fp->script->nfixed)
                RETURN(offset + size_t(p - &fp->slots[0]) * sizeof(double));
            offset += fp->script->nfixed * sizeof(double);
        }
        jsval* spbase = StackBase(fp);
        if (size_t(p - spbase) < size_t(fp->regs->sp - spbase))
            RETURN(offset + size_t(p - spbase) * sizeof(double));
        offset += size_t(fp->regs->sp - spbase) * sizeof(double);
        if (fsp < fspstop - 1) {
            JSStackFrame* fp2 = fsp[1];
            int missing = fp2->fun->nargs - fp2->argc;
            if (missing > 0) {
                if (size_t(p - fp->regs->sp) < size_t(missing))
                    RETURN(offset + size_t(p - fp->regs->sp) * sizeof(double));
                offset += size_t(missing) * sizeof(double);
            }
        }
    }

    /*
     * If it's not in a pending frame, it must be on the stack of the current frame above
     * sp but below fp->slots + script->nslots.
     */
    JS_ASSERT(size_t(p - currentFrame->slots) < currentFrame->script->nslots);
    offset += size_t(p - currentFrame->regs->sp) * sizeof(double);
    RETURN(offset);
#undef RETURN
}

/* Track the maximum number of native frame slots we need during
   execution. */
void
TraceRecorder::trackNativeStackUse(unsigned slots)
{
    if (slots > treeInfo->maxNativeStackSlots)
        treeInfo->maxNativeStackSlots = slots;
}

/* Unbox a jsval into a slot. Slots are wide enough to hold double values directly (instead of 
   storing a pointer to them). We now assert instead of type checking, the caller must ensure the 
   types are compatible. */
static void
ValueToNative(JSContext* cx, jsval v, uint8 type, double* slot)
{
    unsigned tag = JSVAL_TAG(v);
    switch (type) {
      case JSVAL_INT:
        jsint i;
        if (JSVAL_IS_INT(v))
            *(jsint*)slot = JSVAL_TO_INT(v);
        else if ((tag == JSVAL_DOUBLE) && JSDOUBLE_IS_INT(*JSVAL_TO_DOUBLE(v), i))
            *(jsint*)slot = i;
        else
            JS_ASSERT(JSVAL_IS_INT(v));
        debug_only_v(printf("int<%d> ", *(jsint*)slot);)
        return;
      case JSVAL_DOUBLE:
        jsdouble d;
        if (JSVAL_IS_INT(v))
            d = JSVAL_TO_INT(v);
        else
            d = *JSVAL_TO_DOUBLE(v);
        JS_ASSERT(JSVAL_IS_INT(v) || JSVAL_IS_DOUBLE(v));
        *(jsdouble*)slot = d;
        debug_only_v(printf("double<%g> ", d);)
        return;
      case JSVAL_BOOLEAN:
        JS_ASSERT(tag == JSVAL_BOOLEAN);
        *(JSBool*)slot = JSVAL_TO_BOOLEAN(v);
        debug_only_v(printf("boolean<%d> ", *(JSBool*)slot);)
        return;
      case JSVAL_STRING:
        JS_ASSERT(tag == JSVAL_STRING);
        *(JSString**)slot = JSVAL_TO_STRING(v);
        debug_only_v(printf("string<%p> ", *(JSString**)slot);)
        return;
      default:
        /* Note: we should never see JSVAL_BOXED in an entry type map. */
        JS_ASSERT(type == JSVAL_OBJECT);
        JS_ASSERT(tag == JSVAL_OBJECT);
        *(JSObject**)slot = JSVAL_TO_OBJECT(v);
        debug_only_v(printf("object<%p:%s> ", JSVAL_TO_OBJECT(v),
                            JSVAL_IS_NULL(v)
                            ? "null"
                            : STOBJ_GET_CLASS(JSVAL_TO_OBJECT(v))->name);)
        return;
    }
}

/* We maintain an emergency recovery pool of doubles so we can recover safely if a trace runs
   out of memory (doubles or objects). */
static jsval
AllocateDoubleFromRecoveryPool(JSContext* cx)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    JS_ASSERT(tm->recoveryDoublePoolPtr > tm->recoveryDoublePool);
    return *--tm->recoveryDoublePoolPtr;
}

static bool
js_ReplenishRecoveryPool(JSContext* cx, JSTraceMonitor* tm)
{
    /* We should not be called with a full pool. */
    JS_ASSERT((size_t) (tm->recoveryDoublePoolPtr - tm->recoveryDoublePool) <
              MAX_NATIVE_STACK_SLOTS);

    /*
     * When the GC runs in js_NewDoubleInRootedValue, it resets
     * tm->recoveryDoublePoolPtr back to tm->recoveryDoublePool. 
     */
    JSRuntime* rt = cx->runtime;
    uintN gcNumber = rt->gcNumber;
    jsval* ptr = tm->recoveryDoublePoolPtr; 
    while (ptr < tm->recoveryDoublePool + MAX_NATIVE_STACK_SLOTS) {
        if (!js_NewDoubleInRootedValue(cx, 0.0, ptr)) 
            goto oom;
        if (rt->gcNumber != gcNumber) {
            JS_ASSERT(tm->recoveryDoublePoolPtr == tm->recoveryDoublePool);
            ptr = tm->recoveryDoublePool;
            if (uintN(rt->gcNumber - gcNumber) > uintN(1))
                goto oom;
            continue;
        }
        ++ptr;
    }
    tm->recoveryDoublePoolPtr = ptr;
    return true;

oom:
    /*
     * Already massive GC pressure, no need to hold doubles back.
     * We won't run any native code anyway.
     */
    tm->recoveryDoublePoolPtr = tm->recoveryDoublePool;
    return false;
}

/* Box a value from the native stack back into the jsval format. Integers
   that are too large to fit into a jsval are automatically boxed into
   heap-allocated doubles. */
static bool
NativeToValue(JSContext* cx, jsval& v, uint8 type, double* slot)
{
    jsint i;
    jsdouble d;
    switch (type) {
      case JSVAL_BOOLEAN:
        v = BOOLEAN_TO_JSVAL(*(JSBool*)slot);
        debug_only_v(printf("boolean<%d> ", *(JSBool*)slot);)
        break;
      case JSVAL_INT:
        i = *(jsint*)slot;
        debug_only_v(printf("int<%d> ", i);)
      store_int:
        if (INT_FITS_IN_JSVAL(i)) {
            v = INT_TO_JSVAL(i);
            break;
        }
        d = (jsdouble)i;
        goto store_double;
      case JSVAL_DOUBLE:
        d = *slot;
        debug_only_v(printf("double<%g> ", d);)
        if (JSDOUBLE_IS_INT(d, i))
            goto store_int;
      store_double: {
        /* Its not safe to trigger the GC here, so use an emergency heap if we are out of
           double boxes. */
        if (cx->doubleFreeList) {
#ifdef DEBUG
            bool ok =
#endif
                js_NewDoubleInRootedValue(cx, d, &v);
            JS_ASSERT(ok);
            return true;
        }
        v = AllocateDoubleFromRecoveryPool(cx);
        JS_ASSERT(JSVAL_IS_DOUBLE(v) && *JSVAL_TO_DOUBLE(v) == 0.0);
        *JSVAL_TO_DOUBLE(v) = d;
        return true;
      }
      case JSVAL_STRING:
        v = STRING_TO_JSVAL(*(JSString**)slot);
        JS_ASSERT(JSVAL_TAG(v) == JSVAL_STRING); /* if this fails the pointer was not aligned */
        debug_only_v(printf("string<%p> ", *(JSString**)slot);)
        break;
      case JSVAL_BOXED:
        v = *(jsval*)slot;
        debug_only_v(printf("box<%lx> ", v));
        break;
      default:
        JS_ASSERT(type == JSVAL_OBJECT);
        v = OBJECT_TO_JSVAL(*(JSObject**)slot);
        JS_ASSERT(JSVAL_TAG(v) == JSVAL_OBJECT); /* if this fails the pointer was not aligned */
        debug_only_v(printf("object<%p:%s> ", JSVAL_TO_OBJECT(v),
                            JSVAL_IS_NULL(v)
                            ? "null"
                            : STOBJ_GET_CLASS(JSVAL_TO_OBJECT(v))->name);)
        break;
    }
    return true;
}

/* Attempt to unbox the given list of interned globals onto the native global frame. */
static void
BuildNativeGlobalFrame(JSContext* cx, unsigned ngslots, uint16* gslots, uint8* mp, double* np)
{
    debug_only_v(printf("global: ");)
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
        ValueToNative(cx, *vp, *mp, np + gslots[n]);
        ++mp;
    );
    debug_only_v(printf("\n");)
}

/* Attempt to unbox the given JS frame onto a native frame. */
static void
BuildNativeStackFrame(JSContext* cx, unsigned callDepth, uint8* mp, double* np)
{
    debug_only_v(printf("stack: ");)
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth,
        debug_only_v(printf("%s%u=", vpname, vpnum);)
        ValueToNative(cx, *vp, *mp, np);
        ++mp; ++np;
    );
    debug_only_v(printf("\n");)
}

/* Box the given native frame into a JS frame. This only fails due to a hard error
   (out of memory for example). */
static int
FlushNativeGlobalFrame(JSContext* cx, unsigned ngslots, uint16* gslots, uint8* mp, double* np)
{
    uint8* mp_base = mp;
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
        if (!NativeToValue(cx, *vp, *mp, np + gslots[n]))
            return -1;
        ++mp;
    );
    debug_only_v(printf("\n");)
    return mp - mp_base;
}

/**
 * Box the given native stack frame into the virtual machine stack. This fails
 * only due to a hard error (out of memory for example).
 *
 * @param callDepth the distance between the entry frame into our trace and
 *                  cx->fp when we make this call.  If this is not called as a
 *                  result of a nested exit, callDepth is 0.
 * @param mp pointer to an array of type tags (JSVAL_INT, etc.) that indicate
 *           what the types of the things on the stack are.
 * @param np pointer to the native stack.  We want to copy values from here to
 *           the JS stack as needed.
 * @param stopFrame if non-null, this frame and everything above it should not
 *                  be restored.
 * @return the number of things we popped off of np.
 */
static int
FlushNativeStackFrame(JSContext* cx, unsigned callDepth, uint8* mp, double* np,
                      JSStackFrame* stopFrame)
{
    jsval* stopAt = stopFrame ? &stopFrame->argv[-2] : NULL;
    uint8* mp_base = mp;
    /* Root all string and object references first (we don't need to call the GC for this). */
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth,
        if (vp == stopAt) goto skip;
        debug_only_v(printf("%s%u=", vpname, vpnum);)
        if (!NativeToValue(cx, *vp, *mp, np))
            return -1;
        ++mp; ++np
    );
skip:
    // Restore thisp from the now-restored argv[-1] in each pending frame.
    // Keep in mind that we didn't restore frames at stopFrame and above!
    // Scope to keep |fp| from leaking into the macros we're using.
    {
        unsigned n = callDepth+1; // +1 to make sure we restore the entry frame
        JSStackFrame* fp = cx->fp;
        if (stopFrame) {
            for (; fp != stopFrame; fp = fp->down) {
                JS_ASSERT(n != 0);
                --n;
            }
            // Skip over stopFrame itself.
            JS_ASSERT(n != 0);
            --n;
            fp = fp->down;
        }
        for (; n != 0; fp = fp->down) {
            --n;
            if (fp->callee) { // might not have it if the entry frame is global
                JS_ASSERT(JSVAL_IS_OBJECT(fp->argv[-1]));
                fp->thisp = JSVAL_TO_OBJECT(fp->argv[-1]);
            }
        }
    }
    debug_only_v(printf("\n");)
    return mp - mp_base;
}

/* Emit load instructions onto the trace that read the initial stack state. */
void
TraceRecorder::import(LIns* base, ptrdiff_t offset, jsval* p, uint8& t,
                      const char *prefix, uintN index, JSStackFrame *fp)
{
    LIns* ins;
    if (t == JSVAL_INT) { /* demoted */
        JS_ASSERT(isInt32(*p));
        /* Ok, we have a valid demotion attempt pending, so insert an integer
           read and promote it to double since all arithmetic operations expect
           to see doubles on entry. The first op to use this slot will emit a
           f2i cast which will cancel out the i2f we insert here. */
        ins = lir->insLoadi(base, offset);
        ins = lir->ins1(LIR_i2f, ins);
    } else {
        JS_ASSERT(t == JSVAL_BOXED || isNumber(*p) == (t == JSVAL_DOUBLE));
        if (t == JSVAL_DOUBLE) {
            ins = lir->insLoad(LIR_ldq, base, offset);
        } else if (t == JSVAL_BOOLEAN) {
            ins = lir->insLoad(LIR_ld, base, offset);
        } else {
            ins = lir->insLoad(LIR_ldp, base, offset);
        }
    }
    tracker.set(p, ins);
#ifdef DEBUG
    char name[64];
    JS_ASSERT(strlen(prefix) < 10);
    void* mark = NULL;
    jsuword* localNames = NULL;
    const char* funName = NULL;
    if (*prefix == 'a' || *prefix == 'v') {
        mark = JS_ARENA_MARK(&cx->tempPool);
        if (JS_GET_LOCAL_NAME_COUNT(fp->fun) != 0)
            localNames = js_GetLocalNameArray(cx, fp->fun, &cx->tempPool);
        funName = fp->fun->atom ? js_AtomToPrintableString(cx, fp->fun->atom) : "<anonymous>";
    }
    if (!strcmp(prefix, "argv")) {
        if (index < fp->fun->nargs) {
            JSAtom *atom = JS_LOCAL_NAME_TO_ATOM(localNames[index]);
            JS_snprintf(name, sizeof name, "$%s.%s", funName, js_AtomToPrintableString(cx, atom));
        } else {
            JS_snprintf(name, sizeof name, "$%s.<arg%d>", funName, index);
        }
    } else if (!strcmp(prefix, "vars")) {
        JSAtom *atom = JS_LOCAL_NAME_TO_ATOM(localNames[fp->fun->nargs + index]);
        JS_snprintf(name, sizeof name, "$%s.%s", funName, js_AtomToPrintableString(cx, atom));
    } else {
        JS_snprintf(name, sizeof name, "$%s%d", prefix, index);
    }

    if (mark)
        JS_ARENA_RELEASE(&cx->tempPool, mark);
    addName(ins, name);

    static const char* typestr[] = {
        "object", "int", "double", "3", "string", "5", "boolean", "any"
    };
    debug_only_v(printf("import vp=%p name=%s type=%s flags=%d\n",
                        p, name, typestr[t & 7], t >> 3);)
#endif
}

void
TraceRecorder::import(TreeInfo* treeInfo, LIns* sp, unsigned ngslots, unsigned callDepth,
                      uint8* globalTypeMap, uint8* stackTypeMap)
{
    /* If we get a partial list that doesn't have all the types (i.e. recording from a side
       exit that was recorded but we added more global slots later), merge the missing types
       from the entry type map. This is safe because at the loop edge we verify that we
       have compatible types for all globals (entry type and loop edge type match). While
       a different trace of the tree might have had a guard with a different type map for
       these slots we just filled in here (the guard we continue from didn't know about them),
       since we didn't take that particular guard the only way we could have ended up here
       is if that other trace had at its end a compatible type distribution with the entry
       map. Since thats exactly what we used to fill in the types our current side exit
       didn't provide, this is always safe to do. */
    unsigned length;
    if (ngslots < (length = traceMonitor->globalTypeMap->length()))
        mergeTypeMaps(&globalTypeMap, &ngslots,
                      traceMonitor->globalTypeMap->data(), length,
                      (uint8*)alloca(sizeof(uint8) * length));
    JS_ASSERT(ngslots == traceMonitor->globalTypeMap->length());

    /* the first time we compile a tree this will be empty as we add entries lazily */
    uint16* gslots = traceMonitor->globalSlots->data();
    uint8* m = globalTypeMap;
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
        import(gp_ins, nativeGlobalOffset(vp), vp, *m, vpname, vpnum, NULL);
        m++;
    );
    ptrdiff_t offset = -treeInfo->nativeStackBase;
    m = stackTypeMap;
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, callDepth,
        import(sp, offset, vp, *m, vpname, vpnum, fp);
        m++; offset += sizeof(double);
    );
}

/* Lazily import a global slot if we don't already have it in the tracker. */
bool
TraceRecorder::lazilyImportGlobalSlot(unsigned slot)
{
    if (slot != uint16(slot)) /* we use a table of 16-bit ints, bail out if that's not enough */
        return false;
    jsval* vp = &STOBJ_GET_SLOT(globalObj, slot);
    if (tracker.has(vp))
        return true; /* we already have it */
    unsigned index = traceMonitor->globalSlots->length();
    /* If this the first global we are adding, remember the shape of the global object. */
    if (index == 0)
        traceMonitor->globalShape = OBJ_SHAPE(JS_GetGlobalForObject(cx, cx->fp->scopeChain));
    /* Add the slot to the list of interned global slots. */
    traceMonitor->globalSlots->add(slot);
    uint8 type = getCoercedType(*vp);
    if ((type == JSVAL_INT) && oracle.isGlobalSlotUndemotable(cx->fp->script, slot))
        type = JSVAL_DOUBLE;
    traceMonitor->globalTypeMap->add(type);
    import(gp_ins, slot*sizeof(double), vp, type, "global", index, NULL);
    return true;
}

/* Write back a value onto the stack or global frames. */
LIns*
TraceRecorder::writeBack(LIns* i, LIns* base, ptrdiff_t offset)
{
    /* Sink all type casts targeting the stack into the side exit by simply storing the original
       (uncasted) value. Each guard generates the side exit map based on the types of the
       last stores to every stack location, so its safe to not perform them on-trace. */
    if (isPromoteInt(i))
        i = ::demote(lir, i);
    return lir->insStorei(i, base, offset);
}

/* Update the tracker, then issue a write back store. */
void
TraceRecorder::set(jsval* p, LIns* i, bool initializing)
{
    JS_ASSERT(initializing || tracker.has(p));
    tracker.set(p, i);
    /* If we are writing to this location for the first time, calculate the offset into the
       native frame manually, otherwise just look up the last load or store associated with
       the same source address (p) and use the same offset/base. */
    LIns* x = nativeFrameTracker.get(p);
    if (!x) {
        if (isGlobal(p))
            x = writeBack(i, gp_ins, nativeGlobalOffset(p));
        else
            x = writeBack(i, lirbuf->sp, -treeInfo->nativeStackBase + nativeStackOffset(p));
        nativeFrameTracker.set(p, x);
    } else {
#define ASSERT_VALID_CACHE_HIT(base, offset)                                  \
    JS_ASSERT(base == lirbuf->sp || base == gp_ins);                          \
    JS_ASSERT(offset == ((base == lirbuf->sp)                                 \
        ? -treeInfo->nativeStackBase + nativeStackOffset(p)                   \
        : nativeGlobalOffset(p)));                                            \

        if (x->isop(LIR_st) || x->isop(LIR_stq)) {
            ASSERT_VALID_CACHE_HIT(x->oprnd2(), x->oprnd3()->constval());
            writeBack(i, x->oprnd2(), x->oprnd3()->constval());
        } else {
            JS_ASSERT(x->isop(LIR_sti) || x->isop(LIR_stqi));
            ASSERT_VALID_CACHE_HIT(x->oprnd2(), x->immdisp());
            writeBack(i, x->oprnd2(), x->immdisp());
        }
    }
#undef ASSERT_VALID_CACHE_HIT
}

LIns*
TraceRecorder::get(jsval* p) const
{
    return tracker.get(p);
}

/* Determine whether the current branch instruction terminates the loop. */
static bool
js_IsLoopExit(jsbytecode* pc, jsbytecode* header)
{
    switch (*pc) {
      case JSOP_LT:
      case JSOP_GT:
      case JSOP_LE:
      case JSOP_GE:
      case JSOP_NE:
      case JSOP_EQ:
        /* These ops try to dispatch a JSOP_IFEQ or JSOP_IFNE that follows. */
        JS_ASSERT(js_CodeSpec[*pc].length == 1);
        pc++;
        break;

      default:
        for (;;) {
            if (*pc == JSOP_AND || *pc == JSOP_OR)
                pc += GET_JUMP_OFFSET(pc);
            else if (*pc == JSOP_ANDX || *pc == JSOP_ORX)
                pc += GET_JUMPX_OFFSET(pc);
            else
                break;
        }
    }

    switch (*pc) {
      case JSOP_IFEQ:
      case JSOP_IFNE:
        /*
         * Forward jumps are usually intra-branch, but for-in loops jump to the
         * trailing enditer to clean up, so check for that case here.
         */
        if (pc[GET_JUMP_OFFSET(pc)] == JSOP_ENDITER)
            return true;
        return pc + GET_JUMP_OFFSET(pc) == header;

      case JSOP_IFEQX:
      case JSOP_IFNEX:
        if (pc[GET_JUMPX_OFFSET(pc)] == JSOP_ENDITER)
            return true;
        return pc + GET_JUMPX_OFFSET(pc) == header;

      default:;
    }
    return false;
}

/* Determine whether the current branch is a loop edge (taken or not taken). */
static bool
js_IsLoopEdge(jsbytecode* pc, jsbytecode* header)
{
    switch (*pc) {
      case JSOP_IFEQ:
      case JSOP_IFNE:
        return ((pc + GET_JUMP_OFFSET(pc)) == header);
      case JSOP_IFEQX:
      case JSOP_IFNEX:
        return ((pc + GET_JUMPX_OFFSET(pc)) == header);
      default:
        JS_ASSERT((*pc == JSOP_AND) || (*pc == JSOP_ANDX) || 
                  (*pc == JSOP_OR) || (*pc == JSOP_ORX));
    }
    return false;
}

/* Promote slots if necessary to match the called tree' type map and report error if thats
   impossible. */
bool
TraceRecorder::adjustCallerTypes(Fragment* f, unsigned* demote_slots, bool& trash)
{
    JSTraceMonitor* tm = traceMonitor;
    uint8* m = tm->globalTypeMap->data();
    uint16* gslots = traceMonitor->globalSlots->data();
    unsigned ngslots = traceMonitor->globalSlots->length();
    uint8* map = ((TreeInfo*)f->vmprivate)->stackTypeMap.data();
    bool ok = true;
    trash = false;
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots, 
        LIns* i = get(vp);
        bool isPromote = isPromoteInt(i);
        if (isPromote && *m == JSVAL_DOUBLE) 
            lir->insStorei(get(vp), gp_ins, nativeGlobalOffset(vp));
        else if (!isPromote && *m == JSVAL_INT) {
            oracle.markGlobalSlotUndemotable(cx->fp->script, nativeGlobalOffset(vp)/sizeof(double));
            trash = true;
            ok = false;
        }
        ++m;
    );
    m = map;
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
        LIns* i = get(vp);
        bool isPromote = isPromoteInt(i);
        if (isPromote && *m == JSVAL_DOUBLE) {
            lir->insStorei(get(vp), lirbuf->sp, 
                           -treeInfo->nativeStackBase + nativeStackOffset(vp));
            /* Aggressively undo speculation so the inner tree will compile if this fails. */
            ADD_UNDEMOTE_SLOT(demote_slots, unsigned(m - map));
        } else if (!isPromote && *m == JSVAL_INT) {
            debug_only_v(printf("adjusting will fail, %s%d, slot %d\n", vpname, vpnum, m - map);)
            ok = false;
            ADD_UNDEMOTE_SLOT(demote_slots, unsigned(m - map));
        } else if (JSVAL_IS_INT(*vp) && *m == JSVAL_DOUBLE) {
            /* Aggressively undo speculation so the inner tree will compile if this fails. */
            ADD_UNDEMOTE_SLOT(demote_slots, unsigned(m - map));
        }
        ++m;
    );
    /* If this isn't okay, tell the oracle. */
    if (!ok) {
        for (unsigned i = 1; i <= NUM_UNDEMOTE_SLOTS(demote_slots); i++)
            oracle.markStackSlotUndemotable(cx->fp->script, cx->fp->regs->pc, demote_slots[i]);
    }
    JS_ASSERT(f == f->root);
    return ok;
}

uint8 
TraceRecorder::determineSlotType(jsval* vp) const
{
    uint8 m;
    LIns* i = get(vp);
    m = isNumber(*vp)
        ? (isPromoteInt(i) ? JSVAL_INT : JSVAL_DOUBLE)
        : JSVAL_TAG(*vp);
    JS_ASSERT((m != JSVAL_INT) || isInt32(*vp));
    return m;
}

#define IMACRO_PC_ADJ_BITS   8
#define SCRIPT_PC_ADJ_BITS   (32 - IMACRO_PC_ADJ_BITS)

// The stored imacro_pc_adj byte offset is biased by 1.
#define IMACRO_PC_ADJ_LIMIT  (JS_BIT(IMACRO_PC_ADJ_BITS) - 1)
#define SCRIPT_PC_ADJ_LIMIT  JS_BIT(SCRIPT_PC_ADJ_BITS)

#define IMACRO_PC_ADJ(ip)    ((uintptr_t)(ip) >> SCRIPT_PC_ADJ_BITS)
#define SCRIPT_PC_ADJ(ip)    ((ip) & JS_BITMASK(SCRIPT_PC_ADJ_BITS))

#define FI_SCRIPT_PC(fi,fp)  ((fp)->script->code + SCRIPT_PC_ADJ((fi).ip_adj))

#define FI_IMACRO_PC(fi,fp)  (IMACRO_PC_ADJ((fi).ip_adj)                      \
                              ? imacro_code[*FI_SCRIPT_PC(fi, fp)] +          \
                                IMACRO_PC_ADJ((fi).ip_adj)                    \
                              : NULL)

#define IMACRO_PC_OK(fp,pc)  JS_ASSERT(uintN((pc)-imacro_code[*(fp)->imacpc]) \
                                       < JS_BIT(IMACRO_PC_ADJ_BITS))
#define ENCODE_IP_ADJ(fp,pc) ((fp)->imacpc                                    \
                              ? (IMACRO_PC_OK(fp, pc),                        \
                                 (((pc) - imacro_code[*(fp)->imacpc])         \
                                  << SCRIPT_PC_ADJ_BITS) +                    \
                                 (fp)->imacpc - (fp)->script->code)           \
                              : (pc) - (fp)->script->code)

#define DECODE_IP_ADJ(ip,fp) (IMACRO_PC_ADJ(ip)                               \
                              ? (fp)->imacpc = (fp)->script->code +           \
                                               SCRIPT_PC_ADJ(ip),             \
                                (fp)->regs->pc = imacro_code[*(fp)->imacpc] + \
                                                 IMACRO_PC_ADJ(ip)            \
                              : (fp)->regs->pc = (fp)->script->code + (ip))

static jsbytecode* imacro_code[JSOP_LIMIT];

LIns*
TraceRecorder::snapshot(ExitType exitType)
{
    JSStackFrame* fp = cx->fp;
    JSFrameRegs* regs = fp->regs;
    jsbytecode* pc = regs->pc;
    if (exitType == BRANCH_EXIT && js_IsLoopExit(pc, (jsbytecode*)fragment->root->ip))
        exitType = LOOP_EXIT;

    /* Check for a return-value opcode that needs to restart at the next instruction. */
    const JSCodeSpec& cs = js_CodeSpec[*pc];

    /* WARNING: don't return before restoring the original pc if (resumeAfter). */
    bool resumeAfter = (pendingTraceableNative &&
                        JSTN_ERRTYPE(pendingTraceableNative) == FAIL_JSVAL);
    if (resumeAfter) {
        JS_ASSERT(*pc == JSOP_CALL || *pc == JSOP_APPLY || *pc == JSOP_NEXTITER);
        pc += cs.length;
        regs->pc = pc;
        MUST_FLOW_THROUGH("restore_pc");
    }

    /* Generate the entry map for the (possibly advanced) pc and stash it in the trace. */
    unsigned stackSlots = js_NativeStackSlots(cx, callDepth);

    /* It's sufficient to track the native stack use here since all stores above the
       stack watermark defined by guards are killed. */
    trackNativeStackUse(stackSlots + 1);

    /* Capture the type map into a temporary location. */
    unsigned ngslots = traceMonitor->globalSlots->length();
    unsigned typemap_size = (stackSlots + ngslots) * sizeof(uint8);
    uint8* typemap = (uint8*)alloca(typemap_size);
    uint8* m = typemap;

    /* Determine the type of a store by looking at the current type of the actual value the
       interpreter is using. For numbers we have to check what kind of store we used last
       (integer or double) to figure out what the side exit show reflect in its typemap. */
    FORALL_SLOTS(cx, ngslots, traceMonitor->globalSlots->data(), callDepth,
        *m++ = determineSlotType(vp);
    );
    JS_ASSERT(unsigned(m - typemap) == ngslots + stackSlots);

    /* If we are capturing the stack state on a specific instruction, the value on or near
       the top of the stack is a boxed value. Either pc[-cs.length] is JSOP_NEXTITER and we
       want one below top of stack, or else it's JSOP_CALL and we want top of stack. */
    if (resumeAfter) {
        m[(pc[-cs.length] == JSOP_NEXTITER) ? -2 : -1] = JSVAL_BOXED;

        /* Now restore the the original pc (after which early returns are ok). */
        MUST_FLOW_LABEL(restore_pc);
        regs->pc = pc - cs.length;
    } else {
        /* If we take a snapshot on a goto, advance to the target address. This avoids inner
           trees returning on a break goto, which the outer recorder then would confuse with
           a break in the outer tree. */
        if (*pc == JSOP_GOTO) 
            pc += GET_JUMP_OFFSET(pc);
        else if (*pc == JSOP_GOTOX)
            pc += GET_JUMPX_OFFSET(pc);
    }
    intptr_t ip_adj = ENCODE_IP_ADJ(fp, pc);

    /* Check if we already have a matching side exit. If so use that side exit structure,
       otherwise we have to create our own. */
    VMSideExit** exits = treeInfo->sideExits.data();
    unsigned nexits = treeInfo->sideExits.length();
    if (exitType == LOOP_EXIT) {
        for (unsigned n = 0; n < nexits; ++n) {
            VMSideExit* e = exits[n];
            if (e->ip_adj == ip_adj && 
                !memcmp(getTypeMap(exits[n]), typemap, typemap_size)) {
                LIns* data = lir_buf_writer->skip(sizeof(GuardRecord));
                GuardRecord* rec = (GuardRecord*)data->payload();
                /* setup guard record structure with shared side exit */
                memset(rec, 0, sizeof(GuardRecord));
                VMSideExit* exit = exits[n];
                rec->exit = exit;
                exit->addGuard(rec);
                AUDIT(mergedLoopExits);
                return data;
            }
        }
    }

    /* We couldn't find a matching side exit, so create our own side exit structure. */
    LIns* data = lir_buf_writer->skip(sizeof(GuardRecord) +
                                      sizeof(VMSideExit) + 
                                      (stackSlots + ngslots) * sizeof(uint8));
    GuardRecord* rec = (GuardRecord*)data->payload();
    VMSideExit* exit = (VMSideExit*)(rec + 1);
    /* setup guard record structure */
    memset(rec, 0, sizeof(GuardRecord));
    rec->exit = exit;
    /* setup side exit structure */
    memset(exit, 0, sizeof(VMSideExit));
    exit->from = fragment;
    exit->calldepth = callDepth;
    exit->numGlobalSlots = ngslots;
    exit->numStackSlots = stackSlots;
    exit->numStackSlotsBelowCurrentFrame = cx->fp->callee
        ? nativeStackOffset(&cx->fp->argv[-2])/sizeof(double)
        : 0;
    exit->exitType = exitType;
    exit->addGuard(rec);
    exit->ip_adj = ip_adj;
    exit->sp_adj = (stackSlots * sizeof(double)) - treeInfo->nativeStackBase;
    exit->rp_adj = exit->calldepth * sizeof(FrameInfo);
    memcpy(getTypeMap(exit), typemap, typemap_size);

    /* BIG FAT WARNING: If compilation fails, we currently don't reset the lirbuf so its safe
       to keep references to the side exits here. If we ever start rewinding those lirbufs,
       we have to make sure we purge the side exits that then no longer will be in valid
       memory. */
    if (exitType == LOOP_EXIT)
        treeInfo->sideExits.add(exit);
    return data;
}

/* Emit a guard for condition (cond), expecting to evaluate to boolean result (expected)
   and using the supplied side exit if the conditon doesn't hold. */
LIns*
TraceRecorder::guard(bool expected, LIns* cond, LIns* exit)
{
    return lir->insGuard(expected ? LIR_xf : LIR_xt, cond, exit);
}

/* Emit a guard for condition (cond), expecting to evaluate to boolean result (expected)
   and generate a side exit with type exitType to jump to if the condition does not hold. */
LIns*
TraceRecorder::guard(bool expected, LIns* cond, ExitType exitType)
{
    return guard(expected, cond, snapshot(exitType));
}

/* Try to match the type of a slot to type t. checkType is used to verify that the type of
 * values flowing into the loop edge is compatible with the type we expect in the loop header.
 *
 * @param v             Value.
 * @param t             Typemap entry for value.
 * @param stage_val     Outparam for set() address.
 * @param stage_ins     Outparam for set() instruction.
 * @param stage_count   Outparam for set() buffer count.
 * @return              True if types are compatible, false otherwise.
 */
bool
TraceRecorder::checkType(jsval& v, uint8 t, jsval*& stage_val, LIns*& stage_ins, 
                         unsigned& stage_count)
{
    if (t == JSVAL_INT) { /* initially all whole numbers cause the slot to be demoted */
        debug_only_v(printf("checkType(tag=1, t=%d, isnum=%d, i2f=%d) stage_count=%d\n", 
                            t,
                            isNumber(v),
                            isPromoteInt(get(&v)),
                            stage_count);)
        if (!isNumber(v))
            return false; /* not a number? type mismatch */
        LIns* i = get(&v);
        /* This is always a type mismatch, we can't close a double to an int. */
        if (!isPromoteInt(i))
            return false;
        /* Looks good, slot is an int32, the last instruction should be promotable. */
        JS_ASSERT(isInt32(v) && isPromoteInt(i));
        /* Overwrite the value in this slot with the argument promoted back to an integer. */
        stage_val = &v;
        stage_ins = f2i(i);
        stage_count++;
        return true;
    }
    if (t == JSVAL_DOUBLE) {
        debug_only_v(printf("checkType(tag=2, t=%d, isnum=%d, promote=%d) stage_count=%d\n",
                            t,
                            isNumber(v),
                            isPromoteInt(get(&v)),
                            stage_count);)
        if (!isNumber(v))
            return false; /* not a number? type mismatch */
        LIns* i = get(&v);
        /* We sink i2f conversions into the side exit, but at the loop edge we have to make
           sure we promote back to double if at loop entry we want a double. */
        if (isPromoteInt(i)) {
            stage_val = &v;
            stage_ins = lir->ins1(LIR_i2f, i);
            stage_count++;
        }
        return true;
    }
    /* for non-number types we expect a precise match of the type */
#ifdef DEBUG
    if (JSVAL_TAG(v) != t) {
        debug_only_v(printf("Type mismatch: val %c, map %c ", typeChar[JSVAL_TAG(v)],
                            typeChar[t]);)
    }
#endif
    debug_only_v(printf("checkType(tag=%d, t=%d) stage_count=%d\n",
                        (int) JSVAL_TAG(v), t, stage_count);)
    return JSVAL_TAG(v) == t;
}

/**
 * Make sure that the current values in the given stack frame and all stack frames
 * up and including entryFrame are type-compatible with the entry map.
 *
 * @param root_peer         First fragment in peer list.
 * @param stable_peer       Outparam for first type stable peer.
 * @param trash             Whether to trash the tree (demotion).
 * @param demotes           Array to store demotable stack slots.
 * @return                  True if type stable, false otherwise.
 */
bool
TraceRecorder::deduceTypeStability(Fragment* root_peer, Fragment** stable_peer, unsigned* demotes)
{
    uint8* m;
    uint8* typemap;
    unsigned ngslots = traceMonitor->globalSlots->length();
    uint16* gslots = traceMonitor->globalSlots->data();
    JS_ASSERT(traceMonitor->globalTypeMap->length() == ngslots);

    if (stable_peer)
        *stable_peer = NULL;

    CLEAR_UNDEMOTE_SLOTLIST(demotes);

    /*
     * Rather than calculate all of this stuff twice, it gets cached locally.  The "stage" buffers 
     * are for calls to set() that will change the exit types.
     */
    bool success;
    bool unstable_from_undemotes;
    unsigned stage_count;
    jsval** stage_vals = (jsval**)alloca(sizeof(jsval*) * (ngslots + treeInfo->stackTypeMap.length()));
    LIns** stage_ins = (LIns**)alloca(sizeof(LIns*) * (ngslots + treeInfo->stackTypeMap.length()));

    /* First run through and see if we can close ourselves - best case! */
    stage_count = 0;
    success = false;
    unstable_from_undemotes = false;

    debug_only_v(printf("Checking type stability against self=%p\n", fragment);)

    m = typemap = traceMonitor->globalTypeMap->data();
    FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
        debug_only_v(printf("%s%d ", vpname, vpnum);)
        if (!checkType(*vp, *m, stage_vals[stage_count], stage_ins[stage_count], stage_count)) {
            /* If the failure was an int->double, tell the oracle. */
            if (*m == JSVAL_INT && isNumber(*vp) && !isPromoteInt(get(vp)))
                oracle.markGlobalSlotUndemotable(cx->fp->script, gslots[n]);
            trashTree = true;
            goto checktype_fail_1;
        }
        ++m;
    );
    m = typemap = treeInfo->stackTypeMap.data();
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
        debug_only_v(printf("%s%d ", vpname, vpnum);)
        if (!checkType(*vp, *m, stage_vals[stage_count], stage_ins[stage_count], stage_count)) {
            if (*m == JSVAL_INT && isNumber(*vp) && !isPromoteInt(get(vp)))
                ADD_UNDEMOTE_SLOT(demotes, unsigned(m - typemap));
            else
                goto checktype_fail_1;
        }
        ++m;
    );

    /*
     * If there's an exit that's unstable because of undemotable slots, we want to search for 
     * peers just in case we can make a connection.
     */
    if (NUM_UNDEMOTE_SLOTS(demotes))
        unstable_from_undemotes = true;
    else
        success = true;

checktype_fail_1:
    /* If we got a success and we don't need to recompile, we should just close here. */
    if (success) {
        for (unsigned i = 0; i < stage_count; i++)
            set(stage_vals[i], stage_ins[i]);
        return true;
    /* If we need to trash, don't bother checking peers. */
    } else if (trashTree) {
        return false;
    } else {
        CLEAR_UNDEMOTE_SLOTLIST(demotes);
    }

    /* At this point the tree is about to be incomplete, so let's see if we can connect to any 
     * peer fragment that is type stable.
     */
    Fragment* f;
    TreeInfo* ti;
    for (f = root_peer; f != NULL; f = f->peer) {
        debug_only_v(printf("Checking type stability against peer=%p (code=%p)\n", f, f->code());)
        if (!f->code())
            continue;
        ti = (TreeInfo*)f->vmprivate;
        /* Don't allow varying stack depths */
        if (ti->stackTypeMap.length() != treeInfo->stackTypeMap.length())
            continue;
        stage_count = 0;
        success = false;
        m = ti->stackTypeMap.data();

        FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
            if (!checkType(*vp, *m, stage_vals[stage_count], stage_ins[stage_count], stage_count))
                goto checktype_fail_2;
            ++m;
        );

        success = true;

checktype_fail_2:
        if (success) {
            /*
             * There was a successful match.  We don't care about restoring the saved staging, but 
             * we do need to clear the original undemote list.
             */
            for (unsigned i = 0; i < stage_count; i++)
                set(stage_vals[i], stage_ins[i]);
            if (stable_peer)
                *stable_peer = f;
            return false;
        }
    }

    JS_ASSERT(NUM_UNDEMOTE_SLOTS(demotes) == 0);

    /*
     * If this is a loop trace and it would be stable with demotions, build an undemote list 
     * and return true.  Our caller should sniff this and trash the tree, recording a new one 
     * that will assumedly stabilize.
     */
    if (unstable_from_undemotes && fragment->kind == LoopTrace) {
        typemap = m = treeInfo->stackTypeMap.data();
        FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
            if (*m == JSVAL_INT) {
                JS_ASSERT(isNumber(*vp));
                if (!isPromoteInt(get(vp)))
                    ADD_UNDEMOTE_SLOT(demotes, unsigned(m - typemap));
            } else if (*m == JSVAL_DOUBLE) {
                JS_ASSERT(isNumber(*vp));
                ADD_UNDEMOTE_SLOT(demotes, unsigned(m - typemap));
            } else {
                JS_ASSERT(*m == JSVAL_TAG(*vp));
            }
            m++;
        );
        return true;
    }

    return false;
}

/* Check whether the current pc location is the loop header of the loop this recorder records. */
bool
TraceRecorder::isLoopHeader(JSContext* cx) const
{
    return cx->fp->regs->pc == fragment->root->ip;
}

/* Compile the current fragment. */
void
TraceRecorder::compile(Fragmento* fragmento)
{
    if (treeInfo->maxNativeStackSlots >= MAX_NATIVE_STACK_SLOTS) {
        debug_only_v(printf("Trace rejected: excessive stack use.\n"));
        js_BlacklistPC(fragmento, fragment);
        return;
    }
    ++treeInfo->branchCount;
    if (lirbuf->outOmem()) {
        fragmento->assm()->setError(nanojit::OutOMem);
        return;
    }
    ::compile(fragmento->assm(), fragment);
    if (anchor) 
        fragmento->assm()->patch(anchor);
    if (fragmento->assm()->error() != nanojit::None)
        return;
    JS_ASSERT(fragment->code());
    JS_ASSERT(!fragment->vmprivate);
    if (fragment == fragment->root)
        fragment->vmprivate = treeInfo;
    /* :TODO: windows support */
#if defined DEBUG && !defined WIN32
    const char* filename = cx->fp->script->filename;
    char* label = (char*)malloc((filename ? strlen(filename) : 7) + 16);
    sprintf(label, "%s:%u", filename ? filename : "<stdin>",
            js_FramePCToLineNumber(cx, cx->fp));
    fragmento->labels->add(fragment, sizeof(Fragment), 0, label);
    free(label);
#endif
    AUDIT(traceCompleted);
}

static bool
js_JoinPeersIfCompatible(Fragmento* frago, Fragment* stableFrag, TreeInfo* stableTree, 
                         VMSideExit* exit)
{
    JS_ASSERT(exit->numStackSlots == stableTree->stackTypeMap.length());
    /* Must have a matching type unstable exit. */
    if (memcmp(getTypeMap(exit) + exit->numGlobalSlots,
               stableTree->stackTypeMap.data(), 
               stableTree->stackTypeMap.length()) != 0) {
       return false; 
    }

    exit->target = stableFrag;
    frago->assm()->patch(exit);

    stableTree->dependentTrees.addUnique(exit->from->root);

    return true;
}

/* Complete and compile a trace and link it to the existing tree if appropriate. */
bool
TraceRecorder::closeLoop(Fragmento* fragmento, bool& demote, unsigned *demotes)
{
    bool stable;
    LIns* exitIns;
    Fragment* peer;
    VMSideExit* exit;
    Fragment* peer_root;

    demote = false;
    
    exitIns = snapshot(UNSTABLE_LOOP_EXIT);
    exit = (VMSideExit*)((GuardRecord*)exitIns->payload())->exit;

    if (callDepth != 0) {
        debug_only_v(printf("Stack depth mismatch, possible recursion\n");)
        js_BlacklistPC(fragmento, fragment);
        trashTree = true;
        return false;
    }

    JS_ASSERT(exit->numStackSlots == treeInfo->stackTypeMap.length());

    peer_root = fragmento->getLoop(fragment->root->ip);
    JS_ASSERT(peer_root != NULL);
    stable = deduceTypeStability(peer_root, &peer, demotes);

    #if DEBUG
    if (!stable || NUM_UNDEMOTE_SLOTS(demotes))
        AUDIT(unstableLoopVariable);
    #endif

    if (trashTree) {
        debug_only_v(printf("Trashing tree from type instability.\n");)
        return false;
    }

    if (stable && NUM_UNDEMOTE_SLOTS(demotes)) {
        JS_ASSERT(fragment->kind == LoopTrace);
        demote = true;
        return false;
    }

    if (!stable) {
        fragment->lastIns = lir->insGuard(LIR_x, lir->insImm(1), exitIns);

        /*
         * If we didn't find a type stable peer, we compile the loop anyway and
         * hope it becomes stable later.
         */
        if (!peer) {
            /*
             * If such a fragment does not exist, let's compile the loop ahead
             * of time anyway.  Later, if the loop becomes type stable, we will
             * connect these two fragments together.
             */
            debug_only_v(printf("Trace has unstable loop variable with no stable peer, "
                                "compiling anyway.\n");)
            UnstableExit* uexit = new UnstableExit;
            uexit->fragment = fragment;
            uexit->exit = exit;
            uexit->next = treeInfo->unstableExits;
            treeInfo->unstableExits = uexit;

            /*
             * If we walked out of a loop, this exit is wrong. We need to back
             * up to the if operation.
             */
            if (walkedOutOfLoop())
                exit->ip_adj = terminate_ip_adj;

            /* If we were trying to stabilize a promotable tree, trash it. */
            if (promotedPeer)
                js_TrashTree(cx, promotedPeer);
        } else {
            JS_ASSERT(peer->code());
            exit->target = peer;
            debug_only_v(printf("Joining type-unstable trace to target fragment %p.\n", peer);)
            stable = true;
            ((TreeInfo*)peer->vmprivate)->dependentTrees.addUnique(fragment->root);
        }

        compile(fragmento);
    } else {
        exit->target = fragment->root;
#if defined(JS_HAS_OPERATION_COUNT) && !JS_HAS_OPERATION_COUNT
        exit->exitType = TIMEOUT_EXIT;
        guard(false, 
              lir->ins_eq0(lir->insLoadi(cx_ins, 
                                         offsetof(JSContext, operationCount))), 
              exitIns);
#endif
        fragment->lastIns = lir->insGuard(LIR_loop, lir->insImm(1), exitIns);
        compile(fragmento);
    }

    if (fragmento->assm()->error() != nanojit::None)
        return false;

    joinEdgesToEntry(fragmento, peer_root);

    debug_only_v(printf("recording completed at %s:%u@%u via closeLoop\n",
                        cx->fp->script->filename,
                        js_FramePCToLineNumber(cx, cx->fp),
                        FramePCOffset(cx->fp));)
    return true;
}

void
TraceRecorder::joinEdgesToEntry(Fragmento* fragmento, Fragment* peer_root)
{
    if (fragment->kind == LoopTrace) {
        TreeInfo* ti;
        Fragment* peer;
        uint8* t1, *t2;
        UnstableExit* uexit, **unext;

        unsigned* demotes = (unsigned*)alloca(treeInfo->stackTypeMap.length() * sizeof(unsigned));
        for (peer = peer_root; peer != NULL; peer = peer->peer) {
            if (!peer->code())
                continue;
            ti = (TreeInfo*)peer->vmprivate;
            uexit = ti->unstableExits;
            unext = &ti->unstableExits;
            while (uexit != NULL) {
                bool remove = js_JoinPeersIfCompatible(fragmento, fragment, treeInfo, uexit->exit);
                JS_ASSERT(!remove || fragment != peer);
                debug_only_v(if (remove) { 
                             printf("Joining type-stable trace to target exit %p->%p.\n", 
                                    uexit->fragment, uexit->exit); });
                if (!remove) {
                    /* See if this exit contains mismatch demotions, which imply trashing a tree.
                       This is actually faster than trashing the original tree as soon as the 
                       instability is detected, since we could have compiled a fairly stable 
                       tree that ran faster with integers. */
                    unsigned count = 0;
                    t1 = treeInfo->stackTypeMap.data();
                    t2 = getTypeMap(uexit->exit) + uexit->exit->numGlobalSlots;
                    for (unsigned i = 0; i < uexit->exit->numStackSlots; i++) {
                        if (t2[i] == JSVAL_INT && t1[i] == JSVAL_DOUBLE) {
                            demotes[count++] = i;
                        } else if (t2[i] != t1[i]) {
                            count = 0;
                            break;
                        }
                    }
                    if (count) {
                        for (unsigned i = 0; i < count; i++)
                            oracle.markStackSlotUndemotable(cx->fp->script, 
                                                            cx->fp->regs->pc, demotes[i]);
                        js_TrashTree(cx, uexit->fragment->root);
                        break;
                    }
                }
                if (remove) {
                    *unext = uexit->next;
                    delete uexit;
                    uexit = *unext;
                } else {
                    unext = &uexit->next;
                    uexit = uexit->next;
                }
            } 
        } 
    }

    debug_only_v(js_DumpPeerStability(fragmento, peer_root->ip);)
}

/* Emit an always-exit guard and compile the tree (used for break statements. */
void
TraceRecorder::endLoop(Fragmento* fragmento)
{
    LIns* exitIns = snapshot(LOOP_EXIT);

    if (callDepth != 0) {
        debug_only_v(printf("Stack depth mismatch, possible recursion\n");)
        js_BlacklistPC(fragmento, fragment);
        trashTree = true;
        return;
    }

    fragment->lastIns = lir->insGuard(LIR_x, lir->insImm(1), exitIns);
    compile(fragmento);

    if (fragmento->assm()->error() != nanojit::None)
        return;

    joinEdgesToEntry(fragmento, fragmento->getLoop(fragment->root->ip));

    debug_only_v(printf("recording completed at %s:%u@%u via endLoop\n",
                        cx->fp->script->filename,
                        js_FramePCToLineNumber(cx, cx->fp),
                        FramePCOffset(cx->fp));)
}

/* Emit code to adjust the stack to match the inner tree's stack expectations. */
void
TraceRecorder::prepareTreeCall(Fragment* inner)
{
    TreeInfo* ti = (TreeInfo*)inner->vmprivate;
    inner_sp_ins = lirbuf->sp;
    /* The inner tree expects to be called from the current frame. If the outer tree (this
       trace) is currently inside a function inlining code (calldepth > 0), we have to advance
       the native stack pointer such that we match what the inner trace expects to see. We
       move it back when we come out of the inner tree call. */
    if (callDepth > 0) {
        /* Calculate the amount we have to lift the native stack pointer by to compensate for
           any outer frames that the inner tree doesn't expect but the outer tree has. */
        ptrdiff_t sp_adj = nativeStackOffset(&cx->fp->argv[-2]);
        /* Calculate the amount we have to lift the call stack by */
        ptrdiff_t rp_adj = callDepth * sizeof(FrameInfo);
        /* Guard that we have enough stack space for the tree we are trying to call on top
           of the new value for sp. */
        debug_only_v(printf("sp_adj=%d outer=%d inner=%d\n",
                          sp_adj, treeInfo->nativeStackBase, ti->nativeStackBase));
        LIns* sp_top = lir->ins2i(LIR_piadd, lirbuf->sp,
                - treeInfo->nativeStackBase /* rebase sp to beginning of outer tree's stack */
                + sp_adj /* adjust for stack in outer frame inner tree can't see */
                + ti->maxNativeStackSlots * sizeof(double)); /* plus the inner tree's stack */
        guard(true, lir->ins2(LIR_lt, sp_top, eos_ins), OOM_EXIT);
        /* Guard that we have enough call stack space. */
        LIns* rp_top = lir->ins2i(LIR_piadd, lirbuf->rp, rp_adj +
                ti->maxCallDepth * sizeof(FrameInfo));
        guard(true, lir->ins2(LIR_lt, rp_top, eor_ins), OOM_EXIT);
        /* We have enough space, so adjust sp and rp to their new level. */
        lir->insStorei(inner_sp_ins = lir->ins2i(LIR_piadd, lirbuf->sp,
                - treeInfo->nativeStackBase /* rebase sp to beginning of outer tree's stack */
                + sp_adj /* adjust for stack in outer frame inner tree can't see */
                + ti->nativeStackBase), /* plus the inner tree's stack base */
                lirbuf->state, offsetof(InterpState, sp));
        lir->insStorei(lir->ins2i(LIR_piadd, lirbuf->rp, rp_adj),
                lirbuf->state, offsetof(InterpState, rp));
    }
}

/* Record a call to an inner tree. */
void
TraceRecorder::emitTreeCall(Fragment* inner, VMSideExit* exit)
{
    TreeInfo* ti = (TreeInfo*)inner->vmprivate;
    /* Invoke the inner tree. */
    LIns* args[] = { INS_CONSTPTR(inner), lirbuf->state }; /* reverse order */
    LIns* ret = lir->insCall(&js_CallTree_ci, args);
    /* Read back all registers, in case the called tree changed any of them. */
    import(ti, inner_sp_ins, exit->numGlobalSlots, exit->calldepth,
           getTypeMap(exit), getTypeMap(exit) + exit->numGlobalSlots);
    /* Restore sp and rp to their original values (we still have them in a register). */
    if (callDepth > 0) {
        lir->insStorei(lirbuf->sp, lirbuf->state, offsetof(InterpState, sp));
        lir->insStorei(lirbuf->rp, lirbuf->state, offsetof(InterpState, rp));
    }
    /* Guard that we come out of the inner tree along the same side exit we came out when
       we called the inner tree at recording time. */
    guard(true, lir->ins2(LIR_eq, ret, INS_CONSTPTR(exit)), NESTED_EXIT);
    /* Register us as a dependent tree of the inner tree. */
    ((TreeInfo*)inner->vmprivate)->dependentTrees.addUnique(fragment->root);
}

/* Add a if/if-else control-flow merge point to the list of known merge points. */
void
TraceRecorder::trackCfgMerges(jsbytecode* pc)
{
    /* If we hit the beginning of an if/if-else, then keep track of the merge point after it. */
    JS_ASSERT((*pc == JSOP_IFEQ) || (*pc == JSOP_IFEQX));
    jssrcnote* sn = js_GetSrcNote(cx->fp->script, pc);
    if (sn != NULL) {
        if (SN_TYPE(sn) == SRC_IF) {
            cfgMerges.add((*pc == JSOP_IFEQ) 
                          ? pc + GET_JUMP_OFFSET(pc)
                          : pc + GET_JUMPX_OFFSET(pc));
        } else if (SN_TYPE(sn) == SRC_IF_ELSE) 
            cfgMerges.add(pc + js_GetSrcNoteOffset(sn, 0));
    }
}

/* Invert the direction of the guard if this is a loop edge that is not 
   taken (thin loop). */
void
TraceRecorder::flipIf(jsbytecode* pc, bool& cond)
{
    if (js_IsLoopEdge(pc, (jsbytecode*)fragment->root->ip)) {
        switch (*pc) {
          case JSOP_IFEQ:
          case JSOP_IFEQX:
            if (!cond)
                return;
            break;
          case JSOP_IFNE:
          case JSOP_IFNEX:
            if (cond)
                return;
            break;
          default:
            JS_NOT_REACHED("flipIf");
        }
        /* We are about to walk out of the loop, so terminate it with
           an inverse loop condition. */
        debug_only_v(printf("Walking out of the loop, terminating it anyway.\n");)
        cond = !cond;
        terminate = true;
        /* If when we get to closeLoop the tree is decided to be type unstable, we need to 
           reverse this logic because the loop won't be closed after all.  Store the real 
           value of the IP the interpreter expects, so we can use it in our final LIR_x.
         */
        if (*pc == JSOP_IFEQX || *pc == JSOP_IFNEX)
            pc += GET_JUMPX_OFFSET(pc);
        else
            pc += GET_JUMP_OFFSET(pc);
        terminate_ip_adj = ENCODE_IP_ADJ(cx->fp, pc);
    }
}

/* Emit code for a fused IFEQ/IFNE. */
void
TraceRecorder::fuseIf(jsbytecode* pc, bool cond, LIns* x)
{
    if (x->isconst()) // no need to guard if condition is constant
        return;
    if (*pc == JSOP_IFEQ) {
        flipIf(pc, cond);
        guard(cond, x, BRANCH_EXIT);
        trackCfgMerges(pc); 
    } else if (*pc == JSOP_IFNE) {
        flipIf(pc, cond);
        guard(cond, x, BRANCH_EXIT);
    }
}

bool
TraceRecorder::hasMethod(JSObject* obj, jsid id)
{
    if (!obj)
        return false;

    JSObject* pobj;
    JSProperty* prop;
    int protoIndex = OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop);
    if (protoIndex < 0 || !prop)
        return false;

    bool found = false;
    if (OBJ_IS_NATIVE(pobj)) {
        JSScope* scope = OBJ_SCOPE(pobj);
        JSScopeProperty* sprop = (JSScopeProperty*) prop;

        if (SPROP_HAS_STUB_GETTER(sprop) &&
            SPROP_HAS_VALID_SLOT(sprop, scope)) {
            jsval v = LOCKED_OBJ_GET_SLOT(pobj, sprop->slot);
            if (VALUE_IS_FUNCTION(cx, v)) {
                found = true;
                if (!SCOPE_IS_BRANDED(scope)) {
                    SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);
                    SCOPE_SET_BRANDED(scope);
                }
            }
        }
    }

    OBJ_DROP_PROPERTY(cx, pobj, prop);
    return found;
}

bool
TraceRecorder::hasToStringMethod(JSObject* obj)
{
    JS_ASSERT(cx->fp->regs->sp + 1 <= cx->fp->slots + cx->fp->script->nslots);

    return hasMethod(obj, ATOM_TO_JSID(cx->runtime->atomState.toStringAtom));
}

bool
TraceRecorder::hasValueOfMethod(JSObject* obj)
{
    JS_ASSERT(cx->fp->regs->sp + 2 <= cx->fp->slots + cx->fp->script->nslots);

    return hasMethod(obj, ATOM_TO_JSID(cx->runtime->atomState.valueOfAtom));
}

bool
TraceRecorder::hasIteratorMethod(JSObject* obj)
{
    JS_ASSERT(cx->fp->regs->sp + 2 <= cx->fp->slots + cx->fp->script->nslots);

    return hasMethod(obj, ATOM_TO_JSID(cx->runtime->atomState.iteratorAtom));
}

int
nanojit::StackFilter::getTop(LInsp guard)
{
    VMSideExit* e = (VMSideExit*)guard->record()->exit;
    if (sp == lirbuf->sp)
        return e->sp_adj;
    JS_ASSERT(sp == lirbuf->rp);
    return e->rp_adj;
}

#if defined NJ_VERBOSE
void
nanojit::LirNameMap::formatGuard(LIns *i, char *out)
{
    VMSideExit *x;

    x = (VMSideExit *)i->record()->exit;
    sprintf(out,
            "%s: %s %s -> %lu:%lu sp%+ld rp%+ld",
            formatRef(i),
            lirNames[i->opcode()],
            i->oprnd1()->isCond() ? formatRef(i->oprnd1()) : "",
            IMACRO_PC_ADJ(x->ip_adj),
            SCRIPT_PC_ADJ(x->ip_adj),
            (long int)x->sp_adj,
            (long int)x->rp_adj);
}
#endif

void
nanojit::Fragment::onDestroy()
{
    if (root == this) {
        delete mergeCounts;
        delete lirbuf;
    }
    delete (TreeInfo *)vmprivate;
}

void
js_DeleteRecorder(JSContext* cx)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);

    /* Aborting and completing a trace end up here. */
    JS_ASSERT(tm->onTrace);
    tm->onTrace = false;

    delete tm->recorder;
    tm->recorder = NULL;
}

/**
 * Checks whether the shape of the global object has changed.
 */
static inline bool
js_CheckGlobalObjectShape(JSContext* cx, JSTraceMonitor* tm, JSObject* globalObj)
{
    /* Check the global shape. */
    if (OBJ_SHAPE(globalObj) != tm->globalShape) {
        AUDIT(globalShapeMismatchAtEntry);
        debug_only_v(printf("Global shape mismatch (%u vs. %u), flushing cache.\n",
                            OBJ_SHAPE(globalObj), tm->globalShape);)
        return false;
    }
    return true;
}

static bool
js_StartRecorder(JSContext* cx, VMSideExit* anchor, Fragment* f, TreeInfo* ti,
                 unsigned ngslots, uint8* globalTypeMap, uint8* stackTypeMap, 
                 VMSideExit* expectedInnerExit, Fragment* outer)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);

    /*
     * Emulate on-trace semantics and avoid rooting headaches while recording,
     * by suppressing last-ditch GC attempts while recording a trace. This does
     * means that trace recording must not nest or the following assertion will
     * botch.
     */
    JS_ASSERT(!tm->onTrace);
    tm->onTrace = true;

    /* start recording if no exception during construction */
    tm->recorder = new (&gc) TraceRecorder(cx, anchor, f, ti,
                                           ngslots, globalTypeMap, stackTypeMap,
                                           expectedInnerExit, outer);
    if (cx->throwing) {
        js_AbortRecording(cx, "setting up recorder failed");
        return false;
    }
    /* clear any leftover error state */
    tm->fragmento->assm()->setError(None);
    return true;
}

static void
js_TrashTree(JSContext* cx, Fragment* f)
{
    JS_ASSERT((!f->code()) == (!f->vmprivate));
    JS_ASSERT(f == f->root);
    if (!f->code())
        return;
    AUDIT(treesTrashed);
    debug_only_v(printf("Trashing tree info.\n");)
    Fragmento* fragmento = JS_TRACE_MONITOR(cx).fragmento;
    TreeInfo* ti = (TreeInfo*)f->vmprivate;
    f->vmprivate = NULL;
    f->releaseCode(fragmento);
    Fragment** data = ti->dependentTrees.data();
    unsigned length = ti->dependentTrees.length();
    for (unsigned n = 0; n < length; ++n)
        js_TrashTree(cx, data[n]);
    delete ti;
    JS_ASSERT(!f->code() && !f->vmprivate);
}

static int
js_SynthesizeFrame(JSContext* cx, const FrameInfo& fi)
{
    JS_ASSERT(HAS_FUNCTION_CLASS(fi.callee));

    JSFunction* fun = GET_FUNCTION_PRIVATE(cx, fi.callee);
    JS_ASSERT(FUN_INTERPRETED(fun));

    /* Assert that we have a correct sp distance from cx->fp->slots in fi. */
    JS_ASSERT_IF(!FI_IMACRO_PC(fi, cx->fp),
                 js_ReconstructStackDepth(cx, cx->fp->script, FI_SCRIPT_PC(fi, cx->fp))
                 == uintN(fi.s.spdist - cx->fp->script->nfixed));

    uintN nframeslots = JS_HOWMANY(sizeof(JSInlineFrame), sizeof(jsval));
    JSScript* script = fun->u.i.script;
    size_t nbytes = (nframeslots + script->nslots) * sizeof(jsval);

    /* Code duplicated from inline_call: case in js_Interpret (FIXME). */
    JSArena* a = cx->stackPool.current;
    void* newmark = (void*) a->avail;
    uintN argc = fi.s.argc & 0x7fff;
    jsval* vp = cx->fp->slots + fi.s.spdist - (2 + argc);
    uintN missing = 0;
    jsval* newsp;

    if (fun->nargs > argc) {
        const JSFrameRegs& regs = *cx->fp->regs;

        newsp = vp + 2 + fun->nargs;
        JS_ASSERT(newsp > regs.sp);
        if ((jsuword) newsp <= a->limit) {
            if ((jsuword) newsp > a->avail)
                a->avail = (jsuword) newsp;
            jsval* argsp = newsp;
            do {
                *--argsp = JSVAL_VOID;
            } while (argsp != regs.sp);
            missing = 0;
        } else {
            missing = fun->nargs - argc;
            nbytes += (2 + fun->nargs) * sizeof(jsval);
        }
    }

    /* Allocate the inline frame with its vars and operands. */
    if (a->avail + nbytes <= a->limit) {
        newsp = (jsval *) a->avail;
        a->avail += nbytes;
        JS_ASSERT(missing == 0);
    } else {
        JS_ARENA_ALLOCATE_CAST(newsp, jsval *, &cx->stackPool, nbytes);
        if (!newsp) {
            js_ReportOutOfScriptQuota(cx);
            return 0;
        }

        /*
         * Move args if the missing ones overflow arena a, then push
         * undefined for the missing args.
         */
        if (missing) {
            memcpy(newsp, vp, (2 + argc) * sizeof(jsval));
            vp = newsp;
            newsp = vp + 2 + argc;
            do {
                *newsp++ = JSVAL_VOID;
            } while (--missing != 0);
        }
    }

    /* Claim space for the stack frame and initialize it. */
    JSInlineFrame* newifp = (JSInlineFrame *) newsp;
    newsp += nframeslots;

    newifp->frame.callobj = NULL;
    newifp->frame.argsobj = NULL;
    newifp->frame.varobj = NULL;
    newifp->frame.script = script;
    newifp->frame.callee = fi.callee;
    newifp->frame.fun = fun;

    bool constructing = fi.s.argc & 0x8000;
    newifp->frame.argc = argc;

    jsbytecode* imacro_pc = FI_IMACRO_PC(fi, cx->fp);
    jsbytecode* script_pc = FI_SCRIPT_PC(fi, cx->fp);
    newifp->callerRegs.pc = imacro_pc ? imacro_pc : script_pc;
    newifp->callerRegs.sp = cx->fp->slots + fi.s.spdist;
    cx->fp->imacpc = imacro_pc ? script_pc : NULL;

    newifp->frame.argv = newifp->callerRegs.sp - argc;
    JS_ASSERT(newifp->frame.argv);
#ifdef DEBUG
    // Initialize argv[-1] to a known-bogus value so we'll catch it if
    // someone forgets to initialize it later.
    newifp->frame.argv[-1] = JSVAL_HOLE;
#endif
    JS_ASSERT(newifp->frame.argv >= StackBase(cx->fp) + 2);

    newifp->frame.rval = JSVAL_VOID;
    newifp->frame.down = cx->fp;
    newifp->frame.annotation = NULL;
    newifp->frame.scopeChain = OBJ_GET_PARENT(cx, fi.callee);
    newifp->frame.sharpDepth = 0;
    newifp->frame.sharpArray = NULL;
    newifp->frame.flags = constructing ? JSFRAME_CONSTRUCTING : 0;
    newifp->frame.dormantNext = NULL;
    newifp->frame.xmlNamespace = NULL;
    newifp->frame.blockChain = NULL;
    newifp->mark = newmark;
    newifp->frame.thisp = NULL; // will be set by js_ExecuteTree -> FlushNativeStackFrame

    newifp->frame.regs = cx->fp->regs;
    newifp->frame.regs->pc = script->code;
    newifp->frame.regs->sp = newsp + script->nfixed;
    newifp->frame.imacpc = NULL;
    newifp->frame.slots = newsp;
    if (script->staticDepth < JS_DISPLAY_SIZE) {
        JSStackFrame **disp = &cx->display[script->staticDepth];
        newifp->frame.displaySave = *disp;
        *disp = &newifp->frame;
    }
#ifdef DEBUG
    newifp->frame.pcDisabledSave = 0;
#endif

    /*
     * Note that cx->fp->script is still the caller's script; set the callee
     * inline frame's idea of caller version from its version.
     */
    newifp->callerVersion = (JSVersion) cx->fp->script->version;

    cx->fp->regs = &newifp->callerRegs;
    cx->fp = &newifp->frame;

    if (fun->flags & JSFUN_HEAVYWEIGHT) {
        /*
         * Set hookData to null because the failure case for js_GetCallObject
         * involves it calling the debugger hook.
         */
        newifp->hookData = NULL;
        if (!js_GetCallObject(cx, &newifp->frame, newifp->frame.scopeChain))
            return -1;
    }

    /*
     * If there's a call hook, invoke it to compute the hookData used by
     * debuggers that cooperate with the interpreter.
     */
    JSInterpreterHook hook = cx->debugHooks->callHook;
    if (hook) {
        newifp->hookData = hook(cx, &newifp->frame, JS_TRUE, 0,
                                cx->debugHooks->callHookData);
    } else {
        newifp->hookData = NULL;
    }

    // FIXME? we must count stack slots from caller's operand stack up to (but not including)
    // callee's, including missing arguments. Could we shift everything down to the caller's
    // fp->slots (where vars start) and avoid some of the complexity?
    return (fi.s.spdist - cx->fp->down->script->nfixed) +
           ((fun->nargs > cx->fp->argc) ? fun->nargs - cx->fp->argc : 0) +
           script->nfixed;
}

bool
js_RecordTree(JSContext* cx, JSTraceMonitor* tm, Fragment* f, Fragment* outer, unsigned* demotes)
{
    JS_ASSERT(cx->fp->regs->pc == f->ip && f->root == f);
    
    /* Avoid recording loops in overlarge scripts. */
    if (cx->fp->script->length >= SCRIPT_PC_ADJ_LIMIT) {
        js_AbortRecording(cx, "script too large");
        return false;
    }

    /* Make sure the global type map didn't change on us. */
    JSObject* globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);
    if (!js_CheckGlobalObjectShape(cx, tm, globalObj)) {
        js_FlushJITCache(cx);
        return false;
    }
    TypeMap current;
    current.captureGlobalTypes(cx, *tm->globalSlots);
    if (!current.matches(*tm->globalTypeMap)) {
        js_FlushJITCache(cx);
        debug_only_v(printf("Global type map mismatch in RecordTree, flushing cache.\n");)
        return false;
    }

    AUDIT(recorderStarted);

    /* Try to find an unused peer fragment, or allocate a new one. */
    while (f->code() && f->peer)
        f = f->peer;
    if (f->code())
        f = JS_TRACE_MONITOR(cx).fragmento->getAnchor(f->root->ip);

    f->recordAttempts++;
    f->root = f;
    /* allocate space to store the LIR for this tree */
    if (!f->lirbuf) {
        f->lirbuf = new (&gc) LirBuffer(tm->fragmento, NULL);
#ifdef DEBUG
        f->lirbuf->names = new (&gc) LirNameMap(&gc, NULL, tm->fragmento->labels);
#endif
    }

    if (f->lirbuf->outOmem()) {
        js_FlushJITCache(cx);
        debug_only_v(printf("Out of memory recording new tree, flushing cache.\n");)
        return false;
    }

    JS_ASSERT(!f->code() && !f->vmprivate);

    /* setup the VM-private treeInfo structure for this fragment */
    TreeInfo* ti = new (&gc) TreeInfo(f);

    /* capture the coerced type of each active slot in the stack type map */
    ti->stackTypeMap.captureStackTypes(cx, 0/*callDepth*/);

    if (demotes) {
        /* If we get a list of demotions, an outer tree is telling us our types are not callable. */
        uint8* typeMap = ti->stackTypeMap.data();
        for (unsigned i = 1; i <= NUM_UNDEMOTE_SLOTS(demotes); i++) {
            JS_ASSERT(demotes[i] < ti->stackTypeMap.length());
            if (typeMap[demotes[i]] == JSVAL_INT)
                typeMap[demotes[i]] = JSVAL_DOUBLE;
        }
    }

    /* Check for duplicate entry type maps.  This is always wrong and hints at trace explosion 
       since we are trying to stabilize something without properly connecting peer edges. */
    #ifdef DEBUG
    TreeInfo* ti_other;
    for (Fragment* peer = tm->fragmento->getLoop(f->root->ip); peer != NULL; peer = peer->peer) {
        if (!peer->code() || peer == f)
            continue;
        ti_other = (TreeInfo*)peer->vmprivate;
        JS_ASSERT(ti_other);
        JS_ASSERT(!ti->stackTypeMap.matches(ti_other->stackTypeMap));
    }
    #endif

    /* determine the native frame layout at the entry point */
    unsigned entryNativeStackSlots = ti->stackTypeMap.length();
    JS_ASSERT(entryNativeStackSlots == js_NativeStackSlots(cx, 0/*callDepth*/));
    ti->nativeStackBase = (entryNativeStackSlots -
            (cx->fp->regs->sp - StackBase(cx->fp))) * sizeof(double);
    ti->maxNativeStackSlots = entryNativeStackSlots;
    ti->maxCallDepth = 0;
    ti->script = cx->fp->script;

    /* recording primary trace */
    if (!js_StartRecorder(cx, NULL, f, ti,
                          tm->globalSlots->length(), tm->globalTypeMap->data(), 
                          ti->stackTypeMap.data(), NULL, outer)) {
        return false;
    }

    return true;
}

static bool
js_AttemptToStabilizeTree(JSContext* cx, VMSideExit* exit, Fragment* outer)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    Fragment* from = exit->from->root;
    unsigned* demotes;

    JS_ASSERT(exit->from->root->code());
    
    demotes = ALLOCA_UNDEMOTE_SLOTLIST(exit->numStackSlots);
    CLEAR_UNDEMOTE_SLOTLIST(demotes);

    uint8* t2 = getTypeMap(exit) + exit->numGlobalSlots;
    for (unsigned i = 0; i < exit->numStackSlots; i++) {
        if (t2[i] == JSVAL_DOUBLE)
            ADD_UNDEMOTE_SLOT(demotes, i);
    }

    if (!NUM_UNDEMOTE_SLOTS(demotes))
        demotes = NULL;

    if (!js_RecordTree(cx, tm, from->first, outer, demotes))
        return false;

    tm->recorder->setPromotedPeer(demotes ? from : NULL);

    return true;
}

static bool
js_AttemptToExtendTree(JSContext* cx, VMSideExit* anchor, VMSideExit* exitedFrom, Fragment* outer)
{
    Fragment* f = anchor->from->root;
    JS_ASSERT(f->vmprivate);
    TreeInfo* ti = (TreeInfo*)f->vmprivate;

    /* Don't grow trees above a certain size to avoid code explosion due to tail duplication. */
    if (ti->branchCount >= MAX_BRANCHES)
        return false;
    
    Fragment* c;
    if (!(c = anchor->target)) {
        c = JS_TRACE_MONITOR(cx).fragmento->createBranch(anchor, cx->fp->regs->pc);
        c->spawnedFrom = anchor;
        c->parent = f;
        anchor->target = c;
        c->root = f;
    }

    debug_only_v(printf("trying to attach another branch to the tree (hits = %d)\n", c->hits());)

    if (++c->hits() >= HOTEXIT) {
        /* start tracing secondary trace from this point */
        c->lirbuf = f->lirbuf;
        unsigned ngslots;
        uint8* globalTypeMap;
        uint8* stackTypeMap;
        TypeMap fullMap;
        if (exitedFrom == NULL) {
            /* If we are coming straight from a simple side exit, just use that exit's type map
               as starting point. */
            ngslots = anchor->numGlobalSlots;
            globalTypeMap = getTypeMap(anchor);
            stackTypeMap = globalTypeMap + ngslots;
        } else {
            /* If we side-exited on a loop exit and continue on a nesting guard, the nesting
               guard (anchor) has the type information for everything below the current scope, 
               and the actual guard we exited from has the types for everything in the current
               scope (and whatever it inlined). We have to merge those maps here. */
            VMSideExit* e1 = anchor;
            VMSideExit* e2 = exitedFrom;
            fullMap.add(getTypeMap(e1) + e1->numGlobalSlots, e1->numStackSlotsBelowCurrentFrame);
            fullMap.add(getTypeMap(e2) + e2->numGlobalSlots, e2->numStackSlots);
            ngslots = e2->numGlobalSlots;
            globalTypeMap = getTypeMap(e2);
            stackTypeMap = fullMap.data();
        } 
        return js_StartRecorder(cx, anchor, c, (TreeInfo*)f->vmprivate,
                                ngslots, globalTypeMap, stackTypeMap, exitedFrom, outer);
    }
    return false;
}

static VMSideExit*
js_ExecuteTree(JSContext* cx, Fragment* f, uintN& inlineCallCount, 
               VMSideExit** innermostNestedGuardp);

static Fragment*
js_FindVMCompatiblePeer(JSContext* cx, Fragment* f);

static bool
js_CloseLoop(JSContext* cx)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    Fragmento* fragmento = tm->fragmento;
    TraceRecorder* r = tm->recorder;
    JS_ASSERT(fragmento && r);
    bool walkedOutOfLoop = r->walkedOutOfLoop();
    
    if (fragmento->assm()->error()) {
        js_AbortRecording(cx, "Error during recording");

        /* If we ran out of memory, flush the code cache and abort. */
        if (fragmento->assm()->error() == OutOMem)
            js_FlushJITCache(cx);
        return false;
    }

    bool demote;
    Fragment* f = r->getFragment();
    TreeInfo* ti = r->getTreeInfo();
    unsigned* demotes = ALLOCA_UNDEMOTE_SLOTLIST(ti->stackTypeMap.length());
    r->closeLoop(fragmento, demote, demotes);
    JS_ASSERT(!demote || NUM_UNDEMOTE_SLOTS(demotes));
    js_DeleteRecorder(cx);
    
    /*
     * If we just walked out of a thin loop, we can't immediately start the 
     * compiler again here since we didn't return to the loop header.
     */
    if (demote && !walkedOutOfLoop)
        return js_RecordTree(cx, tm, f, NULL, demotes);
    return false;
}

bool
js_RecordLoopEdge(JSContext* cx, TraceRecorder* r, uintN& inlineCallCount)
{
#ifdef JS_THREADSAFE
    if (OBJ_SCOPE(JS_GetGlobalForObject(cx, cx->fp->scopeChain))->title.ownercx != cx) {
        js_AbortRecording(cx, "Global object not owned by this context");
        return false; /* we stay away from shared global objects */
    }
#endif
    Fragmento* fragmento = JS_TRACE_MONITOR(cx).fragmento;
    /* If we hit our own loop header, close the loop and compile the trace. */
    if (r->isLoopHeader(cx))
        return js_CloseLoop(cx);
    /* does this branch go to an inner loop? */
    Fragment* f = fragmento->getLoop(cx->fp->regs->pc);
    Fragment* peer_root = f;
    if (nesting_enabled && f) {
        JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
        
        /* Make sure inner tree call will not run into an out-of-memory condition. */
        if (tm->recoveryDoublePoolPtr < (tm->recoveryDoublePool + MAX_NATIVE_STACK_SLOTS) &&
            !js_ReplenishRecoveryPool(cx, tm)) {
            js_AbortRecording(cx, "Couldn't call inner tree (out of memory)");
            return false; 
        }
        
        /* Make sure the shape of the global object still matches (this might flush 
           the JIT cache). */
        JSObject* globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);
        if (!js_CheckGlobalObjectShape(cx, tm, globalObj)) {
            js_AbortRecording(cx, "Couldn't call inner tree (prep failed)");
            return false;
        }
        
        debug_only_v(printf("Looking for type-compatible peer (%s:%d@%d)\n",
                            cx->fp->script->filename,
                            js_FramePCToLineNumber(cx, cx->fp),
                            FramePCOffset(cx->fp));)

        /* Find an acceptable peer, make sure our types fit. */
        Fragment* empty;
        bool trash = false;
        bool success = false;
        unsigned* demotes = NULL;

        f = r->findNestedCompatiblePeer(f, &empty);
        if (f && f->code()) {
            TreeInfo* ti = (TreeInfo*)f->vmprivate;
            /* alloca docs says it lasts out of scopes. */
            demotes = ALLOCA_UNDEMOTE_SLOTLIST(ti->stackTypeMap.length());
            CLEAR_UNDEMOTE_SLOTLIST(demotes);
            success = r->adjustCallerTypes(f, demotes, trash);
        }

        if (!success) {
            AUDIT(noCompatInnerTrees);
            debug_only_v(printf("No compatible inner tree (%p).\n", f);)

            if (trash) {
                js_AbortRecording(cx, "No compatible inner tree (global demotions");
                return false;
            }

            Fragment* old = fragmento->getLoop(tm->recorder->getFragment()->root->ip);
            if (old == NULL)
                old = tm->recorder->getFragment();
            js_AbortRecording(cx, "No compatible inner tree");
            if (!f && ++peer_root->hits() < MAX_INNER_RECORD_BLACKLIST)
                return false;
            if (old->recordAttempts < MAX_MISMATCH)
                old->resetHits();
            f = empty ? empty : tm->fragmento->getAnchor(cx->fp->regs->pc);
            return js_RecordTree(cx, tm, f, old, demotes);
        }

        r->prepareTreeCall(f);
        VMSideExit* innermostNestedGuard = NULL;
        VMSideExit* lr = js_ExecuteTree(cx, f, inlineCallCount, &innermostNestedGuard);
        if (!lr) {
            js_AbortRecording(cx, "Couldn't call inner tree");
            return false;
        }
        Fragment* old;
        switch (lr->exitType) {
          case LOOP_EXIT:
            /* If the inner tree exited on an unknown loop exit, grow the tree around it. */
            if (innermostNestedGuard) {
                js_AbortRecording(cx, "Inner tree took different side exit, abort recording");
                return js_AttemptToExtendTree(cx, innermostNestedGuard, lr, NULL);
            }
            /* emit a call to the inner tree and continue recording the outer tree trace */
            r->emitTreeCall(f, lr);
            return true;
        case UNSTABLE_LOOP_EXIT:
            /* abort recording so the inner loop can become type stable. */
            old = fragmento->getLoop(tm->recorder->getFragment()->root->ip);
            js_AbortRecording(cx, "Inner tree is trying to stabilize, abort outer recording");
            old->resetHits();
            return js_AttemptToStabilizeTree(cx, lr, old);
        case BRANCH_EXIT:
            /* abort recording the outer tree, extend the inner tree */
            old = fragmento->getLoop(tm->recorder->getFragment()->root->ip);
            js_AbortRecording(cx, "Inner tree is trying to grow, abort outer recording");
            old->resetHits();
            return js_AttemptToExtendTree(cx, lr, NULL, old);
        default:
            debug_only_v(printf("exit_type=%d\n", lr->exitType);)
            js_AbortRecording(cx, "Inner tree not suitable for calling");
            return false;
        }
    }

    /* not returning to our own loop header, not an inner loop we can call, abort trace */
    AUDIT(returnToDifferentLoopHeader);
    JS_ASSERT(!cx->fp->imacpc);
    debug_only_v(printf("loop edge to %d, header %d\n",
                 cx->fp->regs->pc - cx->fp->script->code,
                 (jsbytecode*)r->getFragment()->root->ip - cx->fp->script->code));
    js_AbortRecording(cx, "Loop edge does not return to header");
    return false;
}

static bool
js_IsEntryTypeCompatible(jsval* vp, uint8* m)
{
    unsigned tag = JSVAL_TAG(*vp);

    debug_only_v(printf("%c/%c ", "OIDISIBI"[tag], "OID?S?B?"[*m]);)

    switch (*m) {
      case JSVAL_INT:
        jsint i;
        if (JSVAL_IS_INT(*vp))
            return true;
        if ((tag == JSVAL_DOUBLE) && JSDOUBLE_IS_INT(*JSVAL_TO_DOUBLE(*vp), i))
            return true;
        debug_only_v(printf("int != tag%u(value=%lu) ", tag, *vp);)
        return false;
      case JSVAL_DOUBLE:
        if (JSVAL_IS_INT(*vp) || tag == JSVAL_DOUBLE)
            return true;
        debug_only_v(printf("double != tag%u ", tag);)
        return false;
      case JSVAL_BOOLEAN:
        if (tag == JSVAL_BOOLEAN)
            return true;
        debug_only_v(printf("bool != tag%u", tag);)
        return false;
      case JSVAL_STRING:
        if (tag == JSVAL_STRING)
            return true;
        debug_only_v(printf("string != tag%u", tag);)
        return false;
      default:
        JS_ASSERT(*m == JSVAL_OBJECT);
        if (tag == JSVAL_OBJECT)
            return true;
        debug_only_v(printf("object != tag%u", tag);)
        return false;
    }
}

Fragment* TraceRecorder::findNestedCompatiblePeer(Fragment* f, Fragment** empty)
{
    Fragment* demote;
    JSTraceMonitor* tm;
    unsigned max_demotes;

    if (empty)
        *empty = NULL;
    demote = NULL;

    tm = &JS_TRACE_MONITOR(cx);
    unsigned int ngslots = tm->globalSlots->length();
    uint16* gslots = tm->globalSlots->data();
    uint8* m = tm->globalTypeMap->data();

    if (ngslots) {
        FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
            debug_only_v(printf("%s%d=", vpname, vpnum);)
            if (!js_IsEntryTypeCompatible(vp, m))
                return NULL;
            m++;
        );
    }

    /* We keep a maximum tally - we want to select the peer most likely to work so we don't keep 
     * recording.
     */
    max_demotes = 0;

    TreeInfo* ti;
    for (; f != NULL; f = f->peer) {
        if (!f->code()) {
            if (empty)
                *empty = f;
            continue;
        }

        unsigned demotes = 0;
        ti = (TreeInfo*)f->vmprivate;
        m = ti->stackTypeMap.data();

        debug_only_v(printf("checking nested types %p: ", f);)

        FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
            debug_only_v(printf("%s%d=", vpname, vpnum);)
            if (!js_IsEntryTypeCompatible(vp, m))
                goto check_fail;
            if (*m == JSVAL_STRING && *vp == JSVAL_VOID)
                goto check_fail;
            if (*m == JSVAL_INT && !isPromoteInt(get(vp)))
                demotes++;
            m++;
        );
        JS_ASSERT(unsigned(m - ti->stackTypeMap.data()) == ti->stackTypeMap.length());

        debug_only_v(printf(" (demotes %d)\n", demotes);)

        if (demotes) {
            if (demotes > max_demotes) {
                demote = f;
                max_demotes = demotes;
            }
            continue;
        } else {
            return f;
        }

check_fail:
        debug_only_v(printf("\n"));
        continue;
    }

    if (demote)
        return demote;

   return NULL;
}

/**
 * Check if types are usable for trace execution.
 *
 * @param cx            Context.
 * @param ti            Tree info of peer we're testing.
 * @return              True if compatible (with or without demotions), false otherwise.
 */
static bool
js_CheckEntryTypes(JSContext* cx, TreeInfo* ti)
{
    JSTraceMonitor* tm;

    tm = &JS_TRACE_MONITOR(cx);
    unsigned int ngslots = tm->globalSlots->length();
    uint16* gslots = tm->globalSlots->data();
    uint8* m = tm->globalTypeMap->data();

    if (ngslots) {
        FORALL_GLOBAL_SLOTS(cx, ngslots, gslots,
            debug_only_v(printf("%s%d=", vpname, vpnum);)
            if (!js_IsEntryTypeCompatible(vp, m))
                goto check_fail;
            m++;
        );
    }

    m = ti->stackTypeMap.data();
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0,
        debug_only_v(printf("%s%d=", vpname, vpnum);)
        if (!js_IsEntryTypeCompatible(vp, m))
            goto check_fail;
        m++;
    );
    JS_ASSERT(unsigned(m - ti->stackTypeMap.data()) == ti->stackTypeMap.length());

    debug_only_v(printf("\n");)
    return true;

check_fail:
    debug_only_v(printf("\n");)
    return false;
}

/**
 * Find an acceptable entry tree given a PC.
 *
 * @param cx            Context.
 * @param f             First peer fragment.
 * @param nodemote      If true, will try to find a peer that does not require demotion.
 */
static Fragment*
js_FindVMCompatiblePeer(JSContext* cx, Fragment* f)
{
    for (; f != NULL; f = f->peer) {
        if (f->vmprivate == NULL) 
            continue;
        debug_only_v(printf("checking vm types %p (ip: %p): ", f, f->ip);)
        if (js_CheckEntryTypes(cx, (TreeInfo*)f->vmprivate))
            return f;
    }
    return NULL;
}

/**
 * Executes a tree.
 */
static VMSideExit*
js_ExecuteTree(JSContext* cx, Fragment* f, uintN& inlineCallCount, 
               VMSideExit** innermostNestedGuardp)
{
    JS_ASSERT(f->code() && f->vmprivate);

    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    JSObject* globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);
    TreeInfo* ti = (TreeInfo*)f->vmprivate;
    unsigned ngslots = tm->globalSlots->length();
    uint16* gslots = tm->globalSlots->data();
    unsigned globalFrameSize = STOBJ_NSLOTS(globalObj);
    double* global = (double*)alloca((globalFrameSize+1) * sizeof(double));
    double stack_buffer[MAX_NATIVE_STACK_SLOTS];
    double* stack = stack_buffer;

    /* Make sure the global object is sane. */
    JS_ASSERT(!ngslots || (OBJ_SHAPE(JS_GetGlobalForObject(cx, cx->fp->scopeChain)) == tm->globalShape)); 
    /* Make sure our caller replenished the double pool. */
    JS_ASSERT(tm->recoveryDoublePoolPtr >= tm->recoveryDoublePool + MAX_NATIVE_STACK_SLOTS);

#ifdef DEBUG
    memset(stack_buffer, 0xCD, sizeof(stack_buffer));
    memset(global, 0xCD, (globalFrameSize+1)*sizeof(double));
#endif    

    debug_only(*(uint64*)&global[globalFrameSize] = 0xdeadbeefdeadbeefLL;)
    debug_only_v(printf("entering trace at %s:%u@%u, native stack slots: %u code: %p\n",
                        cx->fp->script->filename,
                        js_FramePCToLineNumber(cx, cx->fp),
                        FramePCOffset(cx->fp),
                        ti->maxNativeStackSlots,
                        f->code());)
    
    if (ngslots)
        BuildNativeGlobalFrame(cx, ngslots, gslots, tm->globalTypeMap->data(), global);
    BuildNativeStackFrame(cx, 0/*callDepth*/, ti->stackTypeMap.data(), stack);

    double* entry_sp = &stack[ti->nativeStackBase/sizeof(double)];
    FrameInfo callstack_buffer[MAX_CALL_STACK_ENTRIES];
    FrameInfo* callstack = callstack_buffer;

    InterpState state;
    state.sp = (void*)entry_sp;
    state.eos = ((double*)state.sp) + MAX_NATIVE_STACK_SLOTS;
    state.rp = callstack;
    state.eor = callstack + MAX_CALL_STACK_ENTRIES;
    state.gp = global;
    state.cx = cx;
    state.lastTreeExitGuard = NULL;
    state.lastTreeCallGuard = NULL;
    state.rpAtLastTreeCall = NULL;
    union { NIns *code; GuardRecord* (FASTCALL *func)(InterpState*, Fragment*); } u;
    u.code = f->code();

#ifdef JS_JIT_SPEW
#if defined(NANOJIT_IA32) || (defined(NANOJIT_AMD64) && defined(__GNUC__))
    uint64 start = rdtsc();
#endif
#endif

    /*
     * We may be called from js_MonitorLoopEdge while not recording, or while
     * recording. Rather than over-generalize by using a counter instead of a
     * flag, we simply sample and update tm->onTrace if necessary.
     */
    bool onTrace = tm->onTrace;
    if (!onTrace)
        tm->onTrace = true;
    VMSideExit* lr;
    
    debug_only(fflush(NULL);)
    GuardRecord* rec;
#if defined(JS_NO_FASTCALL) && defined(NANOJIT_IA32)
    SIMULATE_FASTCALL(rec, &state, NULL, u.func);
#else
    rec = u.func(&state, NULL);
#endif
    lr = (VMSideExit*)rec->exit;

    AUDIT(traceTriggered);

    JS_ASSERT(lr->exitType != LOOP_EXIT || !lr->calldepth);

    tm->onTrace = onTrace;

    /* Except if we find that this is a nested bailout, the guard the call returned is the
       one we have to use to adjust pc and sp. */
    VMSideExit* innermost = lr;

    /* While executing a tree we do not update state.sp and state.rp even if they grow. Instead,
       guards tell us by how much sp and rp should be incremented in case of a side exit. When
       calling a nested tree, however, we actively adjust sp and rp. If we have such frames
       from outer trees on the stack, then rp will have been adjusted. Before we can process
       the stack of the frames of the tree we directly exited from, we have to first work our
       way through the outer frames and generate interpreter frames for them. Once the call
       stack (rp) is empty, we can process the final frames (which again are not directly
       visible and only the guard we exited on will tells us about). */
    FrameInfo* rp = (FrameInfo*)state.rp;
    if (lr->exitType == NESTED_EXIT) {
        VMSideExit* nested = state.lastTreeCallGuard;
        if (!nested) {
            /* If lastTreeCallGuard is not set in state, we only have a single level of
               nesting in this exit, so lr itself is the innermost and outermost nested
               guard, and hence we set nested to lr. The calldepth of the innermost guard
               is not added to state.rp, so we do it here manually. For a nesting depth
               greater than 1 the CallTree builtin already added the innermost guard's
               calldepth to state.rpAtLastTreeCall. */
            nested = lr;
            rp += lr->calldepth;
        } else {
            /* During unwinding state.rp gets overwritten at every step and we restore
               it here to its state at the innermost nested guard. The builtin already
               added the calldepth of that innermost guard to rpAtLastTreeCall. */
            rp = (FrameInfo*)state.rpAtLastTreeCall;
        }
        innermost = state.lastTreeExitGuard;
        if (innermostNestedGuardp)
            *innermostNestedGuardp = nested;
        JS_ASSERT(nested);
        JS_ASSERT(nested->exitType == NESTED_EXIT);
        JS_ASSERT(state.lastTreeExitGuard);
        JS_ASSERT(state.lastTreeExitGuard->exitType != NESTED_EXIT);
    }

    while (callstack < rp) {
        /* Synthesize a stack frame and write out the values in it using the type map pointer
           on the native call stack. */
        if (js_SynthesizeFrame(cx, *callstack) < 0)
            return NULL;
        int slots = FlushNativeStackFrame(cx, 1/*callDepth*/, callstack->typemap, stack, cx->fp);
#ifdef DEBUG
        JSStackFrame* fp = cx->fp;
        debug_only_v(printf("synthesized deep frame for %s:%u@%u, slots=%d\n",
                            fp->script->filename,
                            js_FramePCToLineNumber(cx, fp),
                            FramePCOffset(fp),
                            slots);)
#endif        
        if (slots < 0)
            return NULL;
        /* Keep track of the additional frames we put on the interpreter stack and the native
           stack slots we consumed. */
        ++inlineCallCount;
        ++callstack;
        stack += slots;
    }

    /* We already synthesized the frames around the innermost guard. Here we just deal
       with additional frames inside the tree we are bailing out from. */
    JS_ASSERT(rp == callstack);
    unsigned calldepth = innermost->calldepth;
    unsigned calldepth_slots = 0;
    for (unsigned n = 0; n < calldepth; ++n) {
        int nslots = js_SynthesizeFrame(cx, callstack[n]);
        if (nslots < 0)
            return NULL;
        calldepth_slots += nslots;
        ++inlineCallCount;
#ifdef DEBUG        
        JSStackFrame* fp = cx->fp;
        debug_only_v(printf("synthesized shallow frame for %s:%u@%u\n",
                            fp->script->filename, js_FramePCToLineNumber(cx, fp),
                            FramePCOffset(fp));)
#endif        
    }

    /* Adjust sp and pc relative to the tree we exited from (not the tree we entered into).
       These are our final values for sp and pc since js_SynthesizeFrame has already taken
       care of all frames in between. */
    JSStackFrame* fp = cx->fp;

    /* If we are not exiting from an inlined frame the state->sp is spbase, otherwise spbase
       is whatever slots frames around us consume. */
    DECODE_IP_ADJ(innermost->ip_adj, fp);
    fp->regs->sp = StackBase(fp) + (innermost->sp_adj / sizeof(double)) - calldepth_slots;
    JS_ASSERT_IF(!fp->imacpc,
                 fp->slots + fp->script->nfixed +
                 js_ReconstructStackDepth(cx, fp->script, fp->regs->pc) == fp->regs->sp);
                                              

#if defined(JS_JIT_SPEW) && (defined(NANOJIT_IA32) || (defined(NANOJIT_AMD64) && defined(__GNUC__)))
    uint64 cycles = rdtsc() - start;
#elif defined(JS_JIT_SPEW)
    uint64 cycles = 0;
#endif

    debug_only_v(printf("leaving trace at %s:%u@%u, op=%s, lr=%p, exitType=%d, sp=%d, "
                        "calldepth=%d, cycles=%llu\n",
                        fp->script->filename,
                        js_FramePCToLineNumber(cx, fp),
                        FramePCOffset(fp),
                        js_CodeName[fp->imacpc ? *fp->imacpc : *fp->regs->pc],
                        lr,
                        lr->exitType,
                        fp->regs->sp - StackBase(fp), 
                        calldepth,
                        cycles));

    /* If this trace is part of a tree, later branches might have added additional globals for
       with we don't have any type information available in the side exit. We merge in this
       information from the entry type-map. See also comment in the constructor of TraceRecorder
       why this is always safe to do. */
    unsigned exit_gslots = innermost->numGlobalSlots;
    JS_ASSERT(ngslots == tm->globalTypeMap->length());
    JS_ASSERT(ngslots >= exit_gslots);
    uint8* globalTypeMap = getTypeMap(innermost);
    if (exit_gslots < ngslots)
        mergeTypeMaps(&globalTypeMap, &exit_gslots, tm->globalTypeMap->data(), ngslots,
                      (uint8*)alloca(sizeof(uint8) * ngslots));
    JS_ASSERT(exit_gslots == tm->globalTypeMap->length());

    /* write back interned globals */
    int slots = FlushNativeGlobalFrame(cx, exit_gslots, gslots, globalTypeMap, global);
    if (slots < 0)
        return NULL;
    JS_ASSERT_IF(ngslots != 0, globalFrameSize == STOBJ_NSLOTS(globalObj));
    JS_ASSERT(*(uint64*)&global[globalFrameSize] == 0xdeadbeefdeadbeefLL);

    /* write back native stack frame */
    slots = FlushNativeStackFrame(cx, innermost->calldepth,
                                  getTypeMap(innermost) + innermost->numGlobalSlots,
                                  stack, NULL);
    if (slots < 0)
        return NULL;
    JS_ASSERT(unsigned(slots) == innermost->numStackSlots);

#ifdef DEBUG
    // Verify that our state restoration worked
    for (JSStackFrame* fp = cx->fp; fp; fp = fp->down) {
        JS_ASSERT(!fp->callee || JSVAL_IS_OBJECT(fp->argv[-1]));
        JS_ASSERT(!fp->callee || fp->thisp == JSVAL_TO_OBJECT(fp->argv[-1]));
    }
#endif

    AUDIT(sideExitIntoInterpreter);

    return innermost;
}

bool
js_MonitorLoopEdge(JSContext* cx, uintN& inlineCallCount)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);

    /* Is the recorder currently active? */
    if (tm->recorder) {
        if (js_RecordLoopEdge(cx, tm->recorder, inlineCallCount))
            return true;
        /* recording was aborted, treat like a regular loop edge hit */
    }
    JS_ASSERT(!tm->recorder);

    
    /* Check the recovery pool of doubles (this might trigger a GC). */
    if (tm->recoveryDoublePoolPtr < (tm->recoveryDoublePool + MAX_NATIVE_STACK_SLOTS) &&
        !js_ReplenishRecoveryPool(cx, tm)) {
        return false; /* Out of memory, don't try to record now. */
    }
    
    /* Make sure the shape of the global object still matches (this might flush the JIT cache). */
    JSObject* globalObj = JS_GetGlobalForObject(cx, cx->fp->scopeChain);
    if (!js_CheckGlobalObjectShape(cx, tm, globalObj))
        js_FlushJITCache(cx);
    
    jsbytecode* pc = cx->fp->regs->pc;
    Fragmento* fragmento = tm->fragmento;
    Fragment* f;
    f = fragmento->getLoop(pc);
    if (!f)
        f = fragmento->getAnchor(pc);

    /* If we have no code in the anchor and no peers, we definitively won't be able to 
       activate any trees so increment the hit counter and start compiling if appropriate. */
    if (!f->code() && !f->peer) {
monitor_loop:
        if (++f->hits() >= HOTLOOP) {
            /* We can give RecordTree the root peer. If that peer is already taken, it will
               walk the peer list and find us a free slot or allocate a new tree if needed. */
            return js_RecordTree(cx, tm, f->first, NULL, NULL);
        }
        /* Threshold not reached yet. */
        return false;
    }
    
    debug_only_v(printf("Looking for compat peer %d@%d, from %p (ip: %p, hits=%d)\n",
                        js_FramePCToLineNumber(cx, cx->fp), 
                        FramePCOffset(cx->fp),
                        f, f->ip, f->hits());)
    Fragment* match = js_FindVMCompatiblePeer(cx, f);
    /* If we didn't find a tree that actually matched, keep monitoring the loop. */
    if (!match) 
        goto monitor_loop;

    VMSideExit* lr = NULL;
    VMSideExit* innermostNestedGuard = NULL;

    lr = js_ExecuteTree(cx, match, inlineCallCount, &innermostNestedGuard);
    if (!lr)
        return false;

    /* If we exit on a branch, or on a tree call guard, try to grow the inner tree (in case
       of a branch exit), or the tree nested around the tree we exited from (in case of the
       tree call guard). */
    switch (lr->exitType) {
      case UNSTABLE_LOOP_EXIT:
        return js_AttemptToStabilizeTree(cx, lr, NULL);
      case BRANCH_EXIT:
        return js_AttemptToExtendTree(cx, lr, NULL, NULL);
      case LOOP_EXIT:
        if (innermostNestedGuard)
            return js_AttemptToExtendTree(cx, innermostNestedGuard, lr, NULL);
        return false;
      default:
        /* No, this was an unusual exit (i.e. out of memory/GC), so just resume interpretation. */
        return false;
    }
}

bool
js_MonitorRecording(TraceRecorder* tr)
{
    JSContext* cx = tr->cx;

    if (tr->lirbuf->outOmem()) {
        js_AbortRecording(cx, "no more LIR memory");
        js_FlushJITCache(cx);
        return false;
    }

    if (tr->walkedOutOfLoop())
        return js_CloseLoop(cx);

    // Clear one-shot state used to communicate between record_JSOP_CALL and mid- and post-
    // opcode-case-guts record hooks (record_EnterFrame, record_FastNativeCallComplete).
    tr->applyingArguments = false;
    tr->pendingTraceableNative = NULL;

    // In the future, handle dslots realloc by computing an offset from dslots instead.
    if (tr->global_dslots != tr->globalObj->dslots) {
        js_AbortRecording(cx, "globalObj->dslots reallocated");
        return false;
    }

    // Process deepAbort() requests now.
    if (tr->wasDeepAborted()) {
        js_AbortRecording(cx, "deep abort requested");
        return false;
    }

    jsbytecode* pc = cx->fp->regs->pc;

    /* If we hit a break, end the loop and generate an always taken loop exit guard. For other
       downward gotos (like if/else) continue recording. */
    if (*pc == JSOP_GOTO || *pc == JSOP_GOTOX) {
        jssrcnote* sn = js_GetSrcNote(cx->fp->script, pc);
        if (sn && SN_TYPE(sn) == SRC_BREAK) {
            AUDIT(breakLoopExits);
            tr->endLoop(JS_TRACE_MONITOR(cx).fragmento);
            js_DeleteRecorder(cx);
            return false; /* done recording */
        }
    }

    /* An explicit return from callDepth 0 should end the loop, not abort it. */
    if (*pc == JSOP_RETURN && tr->callDepth == 0) {
        AUDIT(returnLoopExits);
        tr->endLoop(JS_TRACE_MONITOR(cx).fragmento);
        js_DeleteRecorder(cx);
        return false; /* done recording */
    }

    /* If it's not a break or a return from a loop, continue recording and follow the trace. */
    return true;
}

/* If used on a loop trace, blacklists the root peer instead of the given fragment. */
void
js_BlacklistPC(Fragmento* frago, Fragment* frag)
{
    if (frag->kind == LoopTrace)
        frag = frago->getLoop(frag->ip);
    frag->blacklist();
}

void
js_AbortRecording(JSContext* cx, const char* reason)
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    JS_ASSERT(tm->recorder != NULL);
    AUDIT(recorderAborted);

    /* Abort the trace and blacklist its starting point. */
    JSStackFrame* fp = cx->fp;
    if (fp) {
        debug_only_v(printf("Abort recording (line %d, pc %d): %s.\n",
                            js_FramePCToLineNumber(cx, fp),
                            FramePCOffset(fp),
                            reason);)
    }
    Fragment* f = tm->recorder->getFragment();
    if (!f) {
        js_DeleteRecorder(cx);
        return;
    }
    JS_ASSERT(!f->vmprivate);
    js_BlacklistPC(tm->fragmento, f);
    Fragment* outer = tm->recorder->getOuterToBlacklist();
    /* Give outer two chances to stabilize before we start blacklisting. */
    if (outer != NULL && outer->recordAttempts >= 2)
        js_BlacklistPC(tm->fragmento, outer);
    js_DeleteRecorder(cx);
    /* If this is the primary trace and we didn't succeed compiling, trash the TreeInfo object. */
    if (!f->code() && (f->root == f)) 
        js_TrashTree(cx, f);
}

#if defined NANOJIT_IA32
static bool
js_CheckForSSE2()
{
    int features = 0;
#if defined _MSC_VER
    __asm
    {
        pushad
        mov eax, 1
        cpuid
        mov features, edx
        popad
    }
#elif defined __GNUC__
    asm("xchg %%esi, %%ebx\n" /* we can't clobber ebx on gcc (PIC register) */
        "mov $0x01, %%eax\n"
        "cpuid\n"
        "mov %%edx, %0\n"
        "xchg %%esi, %%ebx\n" 
        : "=m" (features)
        : /* We have no inputs */
        : "%eax", "%esi", "%ecx", "%edx"
       );
#elif defined __SUNPRO_C || defined __SUNPRO_CC
    asm("push %%ebx\n"
        "mov $0x01, %%eax\n"
        "cpuid\n"
        "pop %%ebx\n"
        : "=d" (features)
        : /* We have no inputs */
        : "%eax", "%ecx"
       );
#endif
    return (features & (1<<26)) != 0;
}
#endif

static void InitIMacroCode();

extern void
js_InitJIT(JSTraceMonitor *tm)
{
#if defined NANOJIT_IA32
    if (!did_we_check_sse2) {
        avmplus::AvmCore::cmov_available =
        avmplus::AvmCore::sse2_available = js_CheckForSSE2();
        did_we_check_sse2 = true;
    }
#endif
    if (!tm->fragmento) {
        JS_ASSERT(!tm->globalSlots && !tm->globalTypeMap && !tm->recoveryDoublePool);
        Fragmento* fragmento = new (&gc) Fragmento(core, 24);
        verbose_only(fragmento->labels = new (&gc) LabelMap(core, NULL);)
        tm->fragmento = fragmento;
        tm->globalSlots = new (&gc) SlotList();
        tm->globalTypeMap = new (&gc) TypeMap();
        tm->recoveryDoublePoolPtr = tm->recoveryDoublePool = new jsval[MAX_NATIVE_STACK_SLOTS];
    }
    if (!tm->reFragmento) {
        Fragmento* fragmento = new (&gc) Fragmento(core, 20);
        verbose_only(fragmento->labels = new (&gc) LabelMap(core, NULL);)
        tm->reFragmento = fragmento;
    }
    InitIMacroCode();
#if !defined XP_WIN
    debug_only(memset(&jitstats, 0, sizeof(jitstats)));
#endif
}

extern void
js_FinishJIT(JSTraceMonitor *tm)
{
#ifdef JS_JIT_SPEW
    printf("recorder: started(%llu), aborted(%llu), completed(%llu), different header(%llu), "
           "trees trashed(%llu), slot promoted(%llu), unstable loop variable(%llu), "
           "breaks(%llu), returns(%llu), unstableInnerCalls(%llu)\n",
           jitstats.recorderStarted, jitstats.recorderAborted, jitstats.traceCompleted,
           jitstats.returnToDifferentLoopHeader, jitstats.treesTrashed, jitstats.slotPromoted,
           jitstats.unstableLoopVariable, jitstats.breakLoopExits, jitstats.returnLoopExits,
           jitstats.noCompatInnerTrees);
    printf("monitor: triggered(%llu), exits(%llu), type mismatch(%llu), "
           "global mismatch(%llu)\n", jitstats.traceTriggered, jitstats.sideExitIntoInterpreter,
           jitstats.typeMapMismatchAtEntry, jitstats.globalShapeMismatchAtEntry);
#endif
    if (tm->fragmento != NULL) {
        JS_ASSERT(tm->globalSlots && tm->globalTypeMap && tm->recoveryDoublePool);
        verbose_only(delete tm->fragmento->labels;)
        delete tm->fragmento;
        tm->fragmento = NULL;
        delete tm->globalSlots;
        tm->globalSlots = NULL;
        delete tm->globalTypeMap;
        tm->globalTypeMap = NULL;
        delete[] tm->recoveryDoublePool;
        tm->recoveryDoublePool = tm->recoveryDoublePoolPtr = NULL;
    }
    if (tm->reFragmento != NULL) {
        verbose_only(delete tm->reFragmento->labels;)
        delete tm->reFragmento;
    }
}

void
TraceRecorder::pushAbortStack()
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);

    JS_ASSERT(tm->abortStack != this);

    nextRecorderToAbort = tm->abortStack;
    tm->abortStack = this;
}

void
TraceRecorder::popAbortStack()
{
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);

    JS_ASSERT(tm->abortStack == this);

    tm->abortStack = nextRecorderToAbort;
    nextRecorderToAbort = NULL;
}

extern void
js_FlushJITOracle(JSContext* cx)
{
    if (!TRACING_ENABLED(cx))
        return;
    oracle.clear();
}

extern void
js_FlushJITCache(JSContext* cx)
{
    if (!TRACING_ENABLED(cx))
        return;
    debug_only_v(printf("Flushing cache.\n");)
    JSTraceMonitor* tm = &JS_TRACE_MONITOR(cx);
    if (tm->recorder)
        js_AbortRecording(cx, "flush cache");
    TraceRecorder* tr;
    while ((tr = tm->abortStack) != NULL) {
        tr->removeFragmentoReferences();
        tr->deepAbort();
        tr->popAbortStack();
    }
    Fragmento* fragmento = tm->fragmento;
    if (fragmento) {
        fragmento->clearFrags();
#ifdef DEBUG
        JS_ASSERT(fragmento->labels);
        delete fragmento->labels;
        fragmento->labels = new (&gc) LabelMap(core, NULL);
#endif
    }
    if (cx->fp) {
        tm->globalShape = OBJ_SHAPE(JS_GetGlobalForObject(cx, cx->fp->scopeChain));
        tm->globalSlots->clear();
        tm->globalTypeMap->clear();
    }
}

jsval&
TraceRecorder::argval(unsigned n) const
{
    JS_ASSERT(n < cx->fp->fun->nargs);
    return cx->fp->argv[n];
}

jsval&
TraceRecorder::varval(unsigned n) const
{
    JS_ASSERT(n < cx->fp->script->nslots);
    return cx->fp->slots[n];
}

jsval&
TraceRecorder::stackval(int n) const
{
    jsval* sp = cx->fp->regs->sp;
    return sp[n];
}

LIns*
TraceRecorder::scopeChain() const
{
    return lir->insLoad(LIR_ldp,
                        lir->insLoad(LIR_ldp, cx_ins, offsetof(JSContext, fp)),
                        offsetof(JSStackFrame, scopeChain));
}

static inline bool
FrameInRange(JSStackFrame* fp, JSStackFrame *target, unsigned callDepth)
{
    while (fp != target) {
        if (callDepth-- == 0)
            return false;
        if (!(fp = fp->down))
            return false;
    }
    return true;
}

bool
TraceRecorder::activeCallOrGlobalSlot(JSObject* obj, jsval*& vp)
{
    JS_ASSERT(obj != globalObj);

    JSAtom* atom = atoms[GET_INDEX(cx->fp->regs->pc)];
    JSObject* obj2;
    JSProperty* prop;
    if (js_FindProperty(cx, ATOM_TO_JSID(atom), &obj, &obj2, &prop) < 0 || !prop)
        ABORT_TRACE("failed to find name in non-global scope chain");

    if (obj == globalObj) {
        JSScopeProperty* sprop = (JSScopeProperty*) prop;
        if (obj2 != obj || !SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(obj))) {
            OBJ_DROP_PROPERTY(cx, obj2, prop);
            ABORT_TRACE("prototype or slotless globalObj property");
        }

        if (!lazilyImportGlobalSlot(sprop->slot))
             ABORT_TRACE("lazy import of global slot failed");
        vp = &STOBJ_GET_SLOT(obj, sprop->slot);
        OBJ_DROP_PROPERTY(cx, obj2, prop);
        return true;
    }

    if (obj == obj2 && OBJ_GET_CLASS(cx, obj) == &js_CallClass) {
        JSStackFrame* cfp = (JSStackFrame*) JS_GetPrivate(cx, obj);
        if (cfp && FrameInRange(cx->fp, cfp, callDepth)) {
            JSScopeProperty* sprop = (JSScopeProperty*) prop;
            uintN slot = sprop->shortid;

            vp = NULL;
            if (sprop->getter == js_GetCallArg) {
                JS_ASSERT(slot < cfp->fun->nargs);
                vp = &cfp->argv[slot];
            } else if (sprop->getter == js_GetCallVar) {
                JS_ASSERT(slot < cfp->script->nslots);
                vp = &cfp->slots[slot];
            }
            OBJ_DROP_PROPERTY(cx, obj2, prop);
            if (!vp)
                ABORT_TRACE("dynamic property of Call object");
            return true;
        }
    }

    OBJ_DROP_PROPERTY(cx, obj2, prop);
    ABORT_TRACE("fp->scopeChain is not global or active call object");
}

LIns*
TraceRecorder::arg(unsigned n)
{
    return get(&argval(n));
}

void
TraceRecorder::arg(unsigned n, LIns* i)
{
    set(&argval(n), i);
}

LIns*
TraceRecorder::var(unsigned n)
{
    return get(&varval(n));
}

void
TraceRecorder::var(unsigned n, LIns* i)
{
    set(&varval(n), i);
}

LIns*
TraceRecorder::stack(int n)
{
    return get(&stackval(n));
}

void
TraceRecorder::stack(int n, LIns* i)
{
    set(&stackval(n), i, n >= 0);
}

LIns*
TraceRecorder::alu(LOpcode v, jsdouble v0, jsdouble v1, LIns* s0, LIns* s1)
{
    if (v == LIR_fadd || v == LIR_fsub) {
        jsdouble r;
        if (v == LIR_fadd)
            r = v0 + v1;
        else
            r = v0 - v1;
        /*
         * Calculate the result of the addition for the current values. If the
         * value is not within the integer range, don't even try to demote 
         * here.
         */
        if (!JSDOUBLE_IS_NEGZERO(r) && (jsint(r) == r) && isPromoteInt(s0) && isPromoteInt(s1)) {
            LIns* d0 = ::demote(lir, s0);
            LIns* d1 = ::demote(lir, s1);
            /*
             * If the inputs are constant, generate an integer constant for 
             * this operation.
             */
            if (d0->isconst() && d1->isconst()) 
                return lir->ins1(LIR_i2f, lir->insImm(jsint(r)));
            /*
             * Speculatively generate code that will perform the addition over
             * the integer inputs as an integer addition/subtraction and exit
             * if that fails.
             */
            v = (LOpcode)((int)v & ~LIR64);
            LIns* result = lir->ins2(v, d0, d1);
            if (!overflowSafe(d0) || !overflowSafe(d1)) {
                lir->insGuard(LIR_xt, lir->ins1(LIR_ov, result),
                              snapshot(OVERFLOW_EXIT));
            }
            return lir->ins1(LIR_i2f, result);
        }
        /*
         * The result doesn't fit into the integer domain, so either generate
         * a floating point constant or a floating point operation.
         */
        if (s0->isconst() && s1->isconst()) {
            jsdpun u;
            u.d = r;
            return lir->insImmq(u.u64);
        }
        return lir->ins2(v, s0, s1);
    }
    return lir->ins2(v, s0, s1);
}

LIns*
TraceRecorder::f2i(LIns* f)
{
    return lir->insCall(&js_DoubleToInt32_ci, &f);
}

LIns*
TraceRecorder::makeNumberInt32(LIns* f)
{
    JS_ASSERT(f->isQuad());
    LIns* x;
    if (!isPromote(f)) {
        x = f2i(f);
        guard(true, lir->ins2(LIR_feq, f, lir->ins1(LIR_i2f, x)), MISMATCH_EXIT);
    } else {
        x = ::demote(lir, f);
    }
    return x;
}

LIns*
TraceRecorder::stringify(jsval& v)
{
    LIns* v_ins = get(&v);
    if (JSVAL_IS_STRING(v))
        return v_ins;

    LIns* args[] = { v_ins, cx_ins };
    const CallInfo* ci;
    if (JSVAL_IS_NUMBER(v)) {
        ci = &js_NumberToString_ci;
    } else if (JSVAL_TAG(v) == JSVAL_BOOLEAN) {
        ci = &js_BooleanOrUndefinedToString_ci;
    } else {
        /* We can't stringify objects here (use imacros instead), just return NULL. */
        return NULL;
    }
    v_ins = lir->insCall(ci, args);
    guard(false, lir->ins_eq0(v_ins), OOM_EXIT);
    return v_ins;
}

bool
TraceRecorder::call_imacro(jsbytecode* imacro)
{
    JSStackFrame* fp = cx->fp;
    JSFrameRegs* regs = fp->regs;

    if (!fp->imacpc) {
        fp->imacpc = regs->pc;
        fp->flags |= JSFRAME_IMACRO_START;
        regs->pc = imacro;
        atoms = COMMON_ATOMS_START(&cx->runtime->atomState);
    }
    return false;
}

bool
TraceRecorder::ifop()
{
    jsval& v = stackval(-1);
    LIns* v_ins = get(&v);
    bool cond;
    LIns* x;
    /* no need to guard if condition is constant */
    if (v_ins->isconst() || v_ins->isconstq())
        return true;
    if (JSVAL_TAG(v) == JSVAL_BOOLEAN) {
        /* test for boolean is true, negate later if we are testing for false */
        cond = JSVAL_TO_BOOLEAN(v) == 1;
        x = lir->ins2i(LIR_eq, v_ins, 1);
    } else if (JSVAL_IS_OBJECT(v)) {
        cond = !JSVAL_IS_NULL(v);
        x = v_ins;
    } else if (isNumber(v)) {
        jsdouble d = asNumber(v);
        cond = !JSDOUBLE_IS_NaN(d) && d;
        jsdpun u;
        u.d = 0;
        x = lir->ins2(LIR_and, 
                      lir->ins2(LIR_feq, v_ins, v_ins),
                      lir->ins_eq0(lir->ins2(LIR_feq, v_ins, lir->insImmq(u.u64))));
    } else if (JSVAL_IS_STRING(v)) {
        cond = JSSTRING_LENGTH(JSVAL_TO_STRING(v)) != 0;
        x = lir->ins2(LIR_piand,
                      lir->insLoad(LIR_ldp, 
                                   v_ins, 
                                   (int)offsetof(JSString, length)),
                      INS_CONSTPTR(JSSTRING_LENGTH_MASK));
    } else {
        JS_NOT_REACHED("ifop");
        return false;
    }
    flipIf(cx->fp->regs->pc, cond);
    bool expected = cond;
    if (!x->isCond()) {
        x = lir->ins_eq0(x);
        expected = !expected;
    }
    guard(expected, x, BRANCH_EXIT); 
    return true;
}

bool
TraceRecorder::switchop()
{
    jsval& v = stackval(-1);
    LIns* v_ins = get(&v);
    /* no need to guard if condition is constant */
    if (v_ins->isconst() || v_ins->isconstq())
        return true;
    if (isNumber(v)) {
        jsdouble d = asNumber(v);
        jsdpun u;
        u.d = d;
        guard(true,
              addName(lir->ins2(LIR_feq, v_ins, lir->insImmq(u.u64)),
                      "guard(switch on numeric)"),
              BRANCH_EXIT);
    } else if (JSVAL_IS_STRING(v)) {
        LIns* args[] = { v_ins, INS_CONSTPTR(JSVAL_TO_STRING(v)) };
        guard(true,
              addName(lir->ins_eq0(lir->ins_eq0(lir->insCall(&js_EqualStrings_ci, args))),
                      "guard(switch on string)"),
              BRANCH_EXIT);
    } else if (JSVAL_TAG(v) == JSVAL_BOOLEAN) {
        guard(true,
              addName(lir->ins2(LIR_eq, v_ins, lir->insImm(JSVAL_TO_BOOLEAN(v))),
                      "guard(switch on boolean)"),
              BRANCH_EXIT);
    } else {
        ABORT_TRACE("switch on object or null");
    }
    return true;
}

bool
TraceRecorder::inc(jsval& v, jsint incr, bool pre)
{
    LIns* v_ins = get(&v);
    if (!inc(v, v_ins, incr, pre))
        return false;
    set(&v, v_ins);
    return true;
}

/*
 * On exit, v_ins is the incremented unboxed value, and the appropriate
 * value (pre- or post-increment as described by pre) is stacked.
 */
bool
TraceRecorder::inc(jsval& v, LIns*& v_ins, jsint incr, bool pre)
{
    if (!isNumber(v))
        ABORT_TRACE("can only inc numbers");

    jsdpun u;
    u.d = jsdouble(incr);

    LIns* v_after = alu(LIR_fadd, asNumber(v), incr, v_ins, lir->insImmq(u.u64));

    const JSCodeSpec& cs = js_CodeSpec[*cx->fp->regs->pc];
    JS_ASSERT(cs.ndefs == 1);
    stack(-cs.nuses, pre ? v_after : v_ins);
    v_ins = v_after;
    return true;
}

bool
TraceRecorder::incProp(jsint incr, bool pre)
{
    jsval& l = stackval(-1);
    if (JSVAL_IS_PRIMITIVE(l))
        ABORT_TRACE("incProp on primitive");

    JSObject* obj = JSVAL_TO_OBJECT(l);
    LIns* obj_ins = get(&l);

    uint32 slot;
    LIns* v_ins;
    if (!prop(obj, obj_ins, slot, v_ins))
        return false;

    if (slot == SPROP_INVALID_SLOT)
        ABORT_TRACE("incProp on invalid slot");

    jsval& v = STOBJ_GET_SLOT(obj, slot);
    if (!inc(v, v_ins, incr, pre))
        return false;

    if (!box_jsval(v, v_ins))
        return false;

    LIns* dslots_ins = NULL;
    stobj_set_slot(obj_ins, slot, dslots_ins, v_ins);
    return true;
}

bool
TraceRecorder::incElem(jsint incr, bool pre)
{
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);
    jsval* vp;
    LIns* v_ins;
    LIns* addr_ins;
    if (!elem(l, r, vp, v_ins, addr_ins))
        return false;
    if (!addr_ins) // if we read a hole, abort
        return false;
    if (!inc(*vp, v_ins, incr, pre))
        return false;
    if (!box_jsval(*vp, v_ins))
        return false;
    lir->insStorei(v_ins, addr_ins, 0);
    return true;
}

static bool
evalCmp(LOpcode op, double result)
{
    bool cond;
    switch (op) {
      case LIR_feq:
        cond = (result == 0);
        break;
      case LIR_flt:
        cond = result < 0;
        break;
      case LIR_fgt:
        cond = result > 0;
        break;
      case LIR_fle:
        cond = result <= 0;
        break;
      case LIR_fge:
        cond = result >= 0;
        break;
      default:
        JS_NOT_REACHED("unexpected comparison op");
        return false;
    }
    return cond;
}

static bool
evalCmp(LOpcode op, double l, double r)
{
    return evalCmp(op, l - r);
}

static bool
evalCmp(LOpcode op, JSString* l, JSString* r)
{
    if (op == LIR_feq)
        return js_EqualStrings(l, r);
    return evalCmp(op, js_CompareStrings(l, r));
}

static struct {
    jsbytecode obj_any[13];
    jsbytecode any_obj[11];
    jsbytecode obj_obj[22];
} binary_imacros = {
    {
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(valueOf),
        JSOP_STRING, 0, COMMON_TYPE_ATOM_INDEX(JSTYPE_NUMBER),
        JSOP_CALL, 0, 1,
        JSOP_SWAP,
        JSOP_IMACOP,
        JSOP_STOP
    },

    {
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(valueOf),
        JSOP_STRING, 0, COMMON_TYPE_ATOM_INDEX(JSTYPE_NUMBER),
        JSOP_CALL, 0, 1,
        JSOP_IMACOP,
        JSOP_STOP
    },

    {
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(valueOf),
        JSOP_STRING, 0, COMMON_TYPE_ATOM_INDEX(JSTYPE_NUMBER),
        JSOP_CALL, 0, 1,
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(valueOf),
        JSOP_STRING, 0, COMMON_TYPE_ATOM_INDEX(JSTYPE_NUMBER),
        JSOP_CALL, 0, 1,
        JSOP_IMACOP,
        JSOP_STOP
    }
};

JS_STATIC_ASSERT(sizeof(binary_imacros) < IMACRO_PC_ADJ_LIMIT);

bool
TraceRecorder::cmp(LOpcode op, int flags)
{
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);
    LIns* x = NULL;
    bool negate = !!(flags & CMP_NEGATE);
    bool cond;
    LIns* l_ins = get(&l);
    LIns* r_ins = get(&r);
    bool fp = false;

    if (op != LIR_feq) {
        if (JSVAL_IS_OBJECT(l) && hasValueOfMethod(l)) {
            if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
                return call_imacro(binary_imacros.obj_obj);
            return call_imacro(binary_imacros.obj_any);
        }
        if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
            return call_imacro(binary_imacros.any_obj);
    }

    // CMP_STRICT is set only for JSOP_STRICTEQ and JSOP_STRICTNE, which correspond to the
    // === and !== operators. negate is true for !== and false for ===. The strict equality
    // operators produce false if the types of the operands differ, i.e. if only one of 
    // them is a number. 
    if ((flags & CMP_STRICT) && getPromotedType(l) != getPromotedType(r)) {
        x = INS_CONST(negate);
        cond = negate;
    } else if (JSVAL_IS_STRING(l) || JSVAL_IS_STRING(r)) {
        // Comparing equality of a string against null always produces false.
        if (op == LIR_feq &&
            ((JSVAL_IS_NULL(l) && l_ins->isconst()) ||
             (JSVAL_IS_NULL(r) && r_ins->isconst()))) {
            x = INS_CONST(negate);
            cond = negate;
        } else {
            if (!JSVAL_IS_STRING(l) || !JSVAL_IS_STRING(r))
                ABORT_TRACE("unsupported type for cmp vs string");

            LIns* args[] = { r_ins, l_ins };
            if (op == LIR_feq)
                l_ins = lir->ins_eq0(lir->insCall(&js_EqualStrings_ci, args));
            else
                l_ins = lir->insCall(&js_CompareStrings_ci, args);
            r_ins = lir->insImm(0);
            cond = evalCmp(op, JSVAL_TO_STRING(l), JSVAL_TO_STRING(r));
        }
    } else if (isNumber(l) || isNumber(r)) {
        jsval tmp[2] = {l, r};
        JSAutoTempValueRooter tvr(cx, 2, tmp);
        
        fp = true;

        // TODO: coerce non-numbers to numbers if it's not string-on-string above
        jsdouble lnum;
        jsdouble rnum;
        LIns* args[] = { l_ins, cx_ins };
        if (l == JSVAL_NULL && l_ins->isconst()) {
            jsdpun u;
            u.d = (op == LIR_feq) ? js_NaN : 0.0;
            l_ins = lir->insImmq(u.u64);
        } else if (JSVAL_IS_STRING(l)) {
            l_ins = lir->insCall(&js_StringToNumber_ci, args);
        } else if (JSVAL_TAG(l) == JSVAL_BOOLEAN) {
            /*
             * What I really want here is for undefined to be type-specialized
             * differently from real booleans.  Failing that, I want to be able
             * to cmov on quads.  Failing that, I want to have small forward
             * branches.  Failing that, I want to be able to ins_choose on quads
             * without cmov.  Failing that, eat flaming builtin!
             */
            l_ins = lir->insCall(&js_BooleanOrUndefinedToNumber_ci, args);
        } else if (!isNumber(l)) {
            ABORT_TRACE("unsupported LHS type for cmp vs number");
        }
        lnum = js_ValueToNumber(cx, &tmp[0]);

        args[0] = r_ins;
        args[1] = cx_ins;
        if (r == JSVAL_NULL && r_ins->isconst()) {
            jsdpun u;
            u.d = (op == LIR_feq) ? js_NaN : 0.0;
            r_ins = lir->insImmq(u.u64);
        } else if (JSVAL_IS_STRING(r)) {
            r_ins = lir->insCall(&js_StringToNumber_ci, args);
        } else if (JSVAL_TAG(r) == JSVAL_BOOLEAN) {
            // See above for the sob story.
            r_ins = lir->insCall(&js_BooleanOrUndefinedToNumber_ci, args);
        } else if (!isNumber(r)) {
            ABORT_TRACE("unsupported RHS type for cmp vs number");
        }
        rnum = js_ValueToNumber(cx, &tmp[1]);
        cond = evalCmp(op, lnum, rnum);
    } else if ((JSVAL_TAG(l) == JSVAL_BOOLEAN) && (JSVAL_TAG(r) == JSVAL_BOOLEAN)) {
        // The well-known values of JSVAL_TRUE and JSVAL_FALSE make this very easy.
        // In particular: JSVAL_TO_BOOLEAN(0) < JSVAL_TO_BOOLEAN(1) so all of these comparisons do
        // the right thing.
        cond = evalCmp(op, l, r);
        // For ==, !=, ===, and !=== the result is magically correct even if undefined (2) is
        // involved. For the relational operations we need some additional cmov magic to make
        // the result always false (since undefined becomes NaN per ECMA and that doesn't
        // compare to anything, even itself). The code for this is emitted a few lines down.
    } else if (JSVAL_IS_OBJECT(l) && JSVAL_IS_OBJECT(r)) {
        if (op != LIR_feq) {
            JS_NOT_REACHED("we should have converted to numbers already");
            return false;
        }
        cond = (l == r); 
    } else {
        ABORT_TRACE("unsupported operand types for cmp");
    }

    /* If we didn't generate a constant result yet, then emit the comparison now. */
    if (!x) {
        /* If the result is not a number or it's not a quad, we must use an integer compare. */
        if (!fp) {
            JS_ASSERT(op >= LIR_feq && op <= LIR_fge);
            op = LOpcode(op + (LIR_eq - LIR_feq));
        }
        x = lir->ins2(op, l_ins, r_ins);
        if (negate) {
            x = lir->ins_eq0(x);
            cond = !cond;
        }
        // For boolean comparison we need a bit post-processing to make the result false if
        // either side is undefined.
        if (op != LIR_eq && (JSVAL_TAG(l) == JSVAL_BOOLEAN) && (JSVAL_TAG(r) == JSVAL_BOOLEAN)) {
            x = lir->ins_choose(lir->ins2i(LIR_eq, 
                                           lir->ins2i(LIR_and, 
                                                      lir->ins2(LIR_or, l_ins, r_ins),
                                                      JSVAL_TO_BOOLEAN(JSVAL_VOID)),
                                           JSVAL_TO_BOOLEAN(JSVAL_VOID)),
                                lir->insImm(JSVAL_TO_BOOLEAN(JSVAL_FALSE)),
                                x);
            x = lir->ins_eq0(lir->ins_eq0(x));
            if ((l == JSVAL_VOID) || (r == JSVAL_VOID))
                cond = false;
        }
    }
    
    /* Don't guard if the same path is always taken. */
    if (!x->isconst()) {
        if (flags & CMP_CASE) {
            guard(cond, x, BRANCH_EXIT);
            return true;
        }

        /* The interpreter fuses comparisons and the following branch,
           so we have to do that here as well. */
        if (flags & CMP_TRY_BRANCH_AFTER_COND) {
            fuseIf(cx->fp->regs->pc + 1, cond, x);
        }
    } else if (flags & CMP_CASE) {
        return true;
    }

    /* We update the stack after the guard. This is safe since
       the guard bails out at the comparison and the interpreter
       will therefore re-execute the comparison. This way the
       value of the condition doesn't have to be calculated and
       saved on the stack in most cases. */
    set(&l, x);
    return true;
}

bool
TraceRecorder::unary(LOpcode op)
{
    jsval& v = stackval(-1);
    bool intop = !(op & LIR64);
    if (isNumber(v)) {
        LIns* a = get(&v);
        if (intop)
            a = f2i(a);
        a = lir->ins1(op, a);
        if (intop)
            a = lir->ins1(LIR_i2f, a);
        set(&v, a);
        return true;
    }
    return false;
}

bool
TraceRecorder::binary(LOpcode op)
{
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);

    if (JSVAL_IS_OBJECT(l) && hasValueOfMethod(l)) {
        if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
            return call_imacro(binary_imacros.obj_obj);
        return call_imacro(binary_imacros.obj_any);
    }
    if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
        return call_imacro(binary_imacros.any_obj);

    bool intop = !(op & LIR64);
    LIns* a = get(&l);
    LIns* b = get(&r);

    bool leftIsNumber = isNumber(l);
    jsdouble lnum = leftIsNumber ? asNumber(l) : 0;
    
    bool rightIsNumber = isNumber(r);
    jsdouble rnum = rightIsNumber ? asNumber(r) : 0;
    
    if ((op >= LIR_sub && op <= LIR_ush) ||  // sub, mul, (callh), or, xor, (not,) lsh, rsh, ush
        (op >= LIR_fsub && op <= LIR_fdiv)) { // fsub, fmul, fdiv
        LIns* args[2];
        if (JSVAL_IS_STRING(l)) {
            args[0] = a;
            args[1] = cx_ins;
            a = lir->insCall(&js_StringToNumber_ci, args);
            lnum = js_StringToNumber(cx, JSVAL_TO_STRING(l));
            leftIsNumber = true;
        }
        if (JSVAL_IS_STRING(r)) {
            args[0] = b;
            args[1] = cx_ins;
            b = lir->insCall(&js_StringToNumber_ci, args);
            rnum = js_StringToNumber(cx, JSVAL_TO_STRING(r));
            rightIsNumber = true;
        }
    }
    if (JSVAL_TAG(l) == JSVAL_BOOLEAN) {
        LIns* args[] = { a, cx_ins };
        a = lir->insCall(&js_BooleanOrUndefinedToNumber_ci, args);
        lnum = js_BooleanOrUndefinedToNumber(cx, JSVAL_TO_BOOLEAN(l));
        leftIsNumber = true;
    }
    if (JSVAL_TAG(r) == JSVAL_BOOLEAN) {
        LIns* args[] = { b, cx_ins };
        b = lir->insCall(&js_BooleanOrUndefinedToNumber_ci, args);
        rnum = js_BooleanOrUndefinedToNumber(cx, JSVAL_TO_BOOLEAN(r));
        rightIsNumber = true;
    }
    if (leftIsNumber && rightIsNumber) {
        if (intop) {
            LIns *args[] = { a };
            a = lir->insCall(op == LIR_ush ? &js_DoubleToUint32_ci : &js_DoubleToInt32_ci, args);
            b = f2i(b);
        }
        a = alu(op, lnum, rnum, a, b);
        if (intop)
            a = lir->ins1(op == LIR_ush ? LIR_u2f : LIR_i2f, a);
        set(&l, a);
        return true;
    }
    return false;
}

JS_STATIC_ASSERT(offsetof(JSObjectOps, newObjectMap) == 0);

bool
TraceRecorder::map_is_native(JSObjectMap* map, LIns* map_ins, LIns*& ops_ins, size_t op_offset)
{
    ops_ins = addName(lir->insLoad(LIR_ldp, map_ins, offsetof(JSObjectMap, ops)), "ops");
    LIns* n = lir->insLoad(LIR_ldp, ops_ins, op_offset);

#define OP(ops) (*(JSObjectOp*) ((char*)(ops) + op_offset))

    if (OP(map->ops) == OP(&js_ObjectOps)) {
        guard(true, addName(lir->ins2(LIR_eq, n, INS_CONSTPTR(OP(&js_ObjectOps))),
                            "guard(native-map)"),
              MISMATCH_EXIT);
        return true;
    }

#undef OP
    ABORT_TRACE("non-native map");
}

bool
TraceRecorder::test_property_cache(JSObject* obj, LIns* obj_ins, JSObject*& obj2, jsuword& pcval)
{
    jsbytecode* pc = cx->fp->regs->pc;
    JS_ASSERT(*pc != JSOP_INITPROP && *pc != JSOP_SETNAME && *pc != JSOP_SETPROP);

    // Mimic the interpreter's special case for dense arrays by skipping up one
    // hop along the proto chain when accessing a named (not indexed) property,
    // typically to find Array.prototype methods.
    JSObject* aobj = obj;
    if (OBJ_IS_DENSE_ARRAY(cx, obj)) {
        aobj = OBJ_GET_PROTO(cx, obj);
        obj_ins = stobj_get_fslot(obj_ins, JSSLOT_PROTO);
    }

    LIns* map_ins = lir->insLoad(LIR_ldp, obj_ins, (int)offsetof(JSObject, map));
    LIns* ops_ins;

    // Interpreter calls to PROPERTY_CACHE_TEST guard on native object ops
    // (newObjectMap == js_ObjectOps.newObjectMap) which is required to use
    // native objects (those whose maps are scopes), or even more narrow
    // conditions required because the cache miss case will call a particular
    // object-op (js_GetProperty, js_SetProperty).
    //
    // We parameterize using offsetof and guard on match against the hook at
    // the given offset in js_ObjectOps. TraceRecorder::record_JSOP_SETPROP
    // guards the js_SetProperty case.
    uint32 format = js_CodeSpec[*pc].format;
    uint32 mode = JOF_MODE(format);

    // No need to guard native-ness of global object.
    JS_ASSERT(OBJ_IS_NATIVE(globalObj));
    if (aobj != globalObj) {
        size_t op_offset = 0;
        if (mode == JOF_PROP || mode == JOF_VARPROP) {
            JS_ASSERT(!(format & JOF_SET));
            op_offset = offsetof(JSObjectOps, getProperty);
        } else {
            JS_ASSERT(mode == JOF_NAME);
        }

        if (!map_is_native(aobj->map, map_ins, ops_ins, op_offset))
            return false;
    }

    JSAtom* atom;
    JSPropCacheEntry* entry;
    PROPERTY_CACHE_TEST(cx, pc, aobj, obj2, entry, atom);
    if (atom) {
        // Miss: pre-fill the cache for the interpreter, as well as for our needs.
        // FIXME: 452357 - correctly propagate exceptions into the interpreter from
        // js_FindPropertyHelper, js_LookupPropertyWithFlags, and elsewhere.
        jsid id = ATOM_TO_JSID(atom);
        JSProperty* prop;
        if (JOF_OPMODE(*pc) == JOF_NAME) {
            JS_ASSERT(aobj == obj);
            if (js_FindPropertyHelper(cx, id, &obj, &obj2, &prop, &entry) < 0)
                ABORT_TRACE("failed to find name");
        } else {
            int protoIndex = js_LookupPropertyWithFlags(cx, aobj, id,
                                                        cx->resolveFlags,
                                                        &obj2, &prop);
            if (protoIndex < 0)
                ABORT_TRACE("failed to lookup property");

            if (prop) {
                js_FillPropertyCache(cx, aobj, OBJ_SHAPE(aobj), 0, protoIndex, obj2,
                                     (JSScopeProperty*) prop, &entry);
            }
        }

        if (!prop) {
            // Propagate obj from js_FindPropertyHelper to record_JSOP_BINDNAME
            // via our obj2 out-parameter. If we are recording JSOP_SETNAME and
            // the global it's assigning does not yet exist, create it.
            obj2 = obj;

            // Use PCVAL_NULL to return "no such property" to our caller.
            pcval = PCVAL_NULL;
            ABORT_TRACE("failed to find property");
        }

        OBJ_DROP_PROPERTY(cx, obj2, prop);
        if (!entry)
            ABORT_TRACE("failed to fill property cache");
    }

#ifdef JS_THREADSAFE
    // There's a potential race in any JS_THREADSAFE embedding that's nuts
    // enough to share mutable objects on the scope or proto chain, but we
    // don't care about such insane embeddings. Anyway, the (scope, proto)
    // entry->vcap coordinates must reach obj2 from aobj at this point.
    JS_ASSERT(cx->requestDepth);
#endif

    // Emit guard(s), common code for both hit and miss cases.
    // Check for first-level cache hit and guard on kshape if possible.
    // Otherwise guard on key object exact match.
    if (PCVCAP_TAG(entry->vcap) <= 1) {
        if (aobj != globalObj) {
            LIns* shape_ins = addName(lir->insLoad(LIR_ld, map_ins, offsetof(JSScope, shape)),
                                      "shape");
            guard(true, addName(lir->ins2i(LIR_eq, shape_ins, entry->kshape), "guard(kshape)"),
                  MISMATCH_EXIT);
        }
    } else {
#ifdef DEBUG
        JSOp op = JSOp(*pc);
        ptrdiff_t pcoff = (op == JSOP_GETARGPROP) ? ARGNO_LEN :
                          (op == JSOP_GETLOCALPROP) ? SLOTNO_LEN : 0;
        jsatomid index = js_GetIndexFromBytecode(cx, cx->fp->script, pc, pcoff);
        JS_ASSERT(entry->kpc == (jsbytecode*) atoms[index]);
        JS_ASSERT(entry->kshape == jsuword(aobj));
#endif
        if (aobj != globalObj) {
            guard(true, addName(lir->ins2i(LIR_eq, obj_ins, entry->kshape), "guard(kobj)"),
                  MISMATCH_EXIT);
        }
    }

    // For any hit that goes up the scope and/or proto chains, we will need to
    // guard on the shape of the object containing the property.
    if (PCVCAP_TAG(entry->vcap) >= 1) {
        jsuword vcap = entry->vcap;
        uint32 vshape = PCVCAP_SHAPE(vcap);
        JS_ASSERT(OBJ_SHAPE(obj2) == vshape);

        LIns* obj2_ins;
        if (PCVCAP_TAG(entry->vcap) == 1) {
            // Duplicate the special case in PROPERTY_CACHE_TEST.
            obj2_ins = stobj_get_fslot(obj_ins, JSSLOT_PROTO);
            guard(false, lir->ins_eq0(obj2_ins), MISMATCH_EXIT);
        } else {
            obj2_ins = INS_CONSTPTR(obj2);
        }
        map_ins = lir->insLoad(LIR_ldp, obj2_ins, (int)offsetof(JSObject, map));
        if (!map_is_native(obj2->map, map_ins, ops_ins))
            return false;

        LIns* shape_ins = addName(lir->insLoad(LIR_ld, map_ins, offsetof(JSScope, shape)),
                                  "shape");
        guard(true,
              addName(lir->ins2i(LIR_eq, shape_ins, vshape), "guard(vshape)"),
              MISMATCH_EXIT);
    }

    pcval = entry->vword;
    return true;
}

bool
TraceRecorder::test_property_cache_direct_slot(JSObject* obj, LIns* obj_ins, uint32& slot)
{
    JSObject* obj2;
    jsuword pcval;

    /*
     * Property cache ensures that we are dealing with an existing property,
     * and guards the shape for us.
     */
    if (!test_property_cache(obj, obj_ins, obj2, pcval))
        return false;

    /* No such property means invalid slot, which callers must check for first. */
    if (PCVAL_IS_NULL(pcval)) {
        slot = SPROP_INVALID_SLOT;
        return true;
    }

    /* Insist on obj being the directly addressed object. */
    if (obj2 != obj)
        ABORT_TRACE("test_property_cache_direct_slot hit prototype chain");

    /* Don't trace getter or setter calls, our caller wants a direct slot. */
    if (PCVAL_IS_SPROP(pcval)) {
        JSScopeProperty* sprop = PCVAL_TO_SPROP(pcval);

        uint32 setflags = (js_CodeSpec[*cx->fp->regs->pc].format & (JOF_SET | JOF_INCDEC));
        if (setflags && !SPROP_HAS_STUB_SETTER(sprop))
            ABORT_TRACE("non-stub setter");
        if (setflags != JOF_SET && !SPROP_HAS_STUB_GETTER(sprop))
            ABORT_TRACE("non-stub getter");
        if (!SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(obj)))
            ABORT_TRACE("no valid slot");
        slot = sprop->slot;
    } else {
        if (!PCVAL_IS_SLOT(pcval))
            ABORT_TRACE("PCE is not a slot");
        slot = PCVAL_TO_SLOT(pcval);
    }
    return true;
}

void
TraceRecorder::stobj_set_slot(LIns* obj_ins, unsigned slot, LIns*& dslots_ins, LIns* v_ins)
{
    if (slot < JS_INITIAL_NSLOTS) {
        addName(lir->insStorei(v_ins, obj_ins,
                               offsetof(JSObject, fslots) + slot * sizeof(jsval)),
                "set_slot(fslots)");
    } else {
        if (!dslots_ins)
            dslots_ins = lir->insLoad(LIR_ldp, obj_ins, offsetof(JSObject, dslots));
        addName(lir->insStorei(v_ins, dslots_ins,
                               (slot - JS_INITIAL_NSLOTS) * sizeof(jsval)),
                "set_slot(dslots");
    }
}

LIns*
TraceRecorder::stobj_get_fslot(LIns* obj_ins, unsigned slot)
{
    JS_ASSERT(slot < JS_INITIAL_NSLOTS);
    return lir->insLoad(LIR_ldp, obj_ins, offsetof(JSObject, fslots) + slot * sizeof(jsval));
}

LIns*
TraceRecorder::stobj_get_slot(LIns* obj_ins, unsigned slot, LIns*& dslots_ins)
{
    if (slot < JS_INITIAL_NSLOTS)
        return stobj_get_fslot(obj_ins, slot);

    if (!dslots_ins)
        dslots_ins = lir->insLoad(LIR_ldp, obj_ins, offsetof(JSObject, dslots));
    return lir->insLoad(LIR_ldp, dslots_ins, (slot - JS_INITIAL_NSLOTS) * sizeof(jsval));
}

bool
TraceRecorder::native_set(LIns* obj_ins, JSScopeProperty* sprop, LIns*& dslots_ins, LIns* v_ins)
{
    if (SPROP_HAS_STUB_SETTER(sprop) && sprop->slot != SPROP_INVALID_SLOT) {
        stobj_set_slot(obj_ins, sprop->slot, dslots_ins, v_ins);
        return true;
    }
    ABORT_TRACE("unallocated or non-stub sprop");
}

bool
TraceRecorder::native_get(LIns* obj_ins, LIns* pobj_ins, JSScopeProperty* sprop,
        LIns*& dslots_ins, LIns*& v_ins)
{
    if (!SPROP_HAS_STUB_GETTER(sprop))
        return false;

    if (sprop->slot != SPROP_INVALID_SLOT)
        v_ins = stobj_get_slot(pobj_ins, sprop->slot, dslots_ins);
    else
        v_ins = INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID));
    return true;
}

// So box_jsval can emit no LIR_or at all to tag an object jsval.
JS_STATIC_ASSERT(JSVAL_OBJECT == 0);

bool
TraceRecorder::box_jsval(jsval v, LIns*& v_ins)
{
    if (isNumber(v)) {
        LIns* args[] = { v_ins, cx_ins };
        v_ins = lir->insCall(&js_BoxDouble_ci, args);
        guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_ERROR_COOKIE)),
              OOM_EXIT);
        return true;
    }
    switch (JSVAL_TAG(v)) {
      case JSVAL_BOOLEAN:
        v_ins = lir->ins2i(LIR_pior, lir->ins2i(LIR_pilsh, v_ins, JSVAL_TAGBITS), JSVAL_BOOLEAN);
        return true;
      case JSVAL_OBJECT:
        return true;
      case JSVAL_STRING:
        v_ins = lir->ins2(LIR_pior, v_ins, INS_CONST(JSVAL_STRING));
        return true;
    }
    return false;
}

bool
TraceRecorder::unbox_jsval(jsval v, LIns*& v_ins)
{
    if (isNumber(v)) {
        // JSVAL_IS_NUMBER(v)
        guard(false,
              lir->ins_eq0(lir->ins2(LIR_pior,
                                     lir->ins2(LIR_piand, v_ins, INS_CONST(JSVAL_INT)),
                                     lir->ins2i(LIR_eq,
                                                lir->ins2(LIR_piand, v_ins,
                                                          INS_CONST(JSVAL_TAGMASK)),
                                                JSVAL_DOUBLE))),
              MISMATCH_EXIT);
        LIns* args[] = { v_ins };
        v_ins = lir->insCall(&js_UnboxDouble_ci, args);
        return true;
    }
    switch (JSVAL_TAG(v)) {
      case JSVAL_BOOLEAN:
        guard(true,
              lir->ins2i(LIR_eq,
                         lir->ins2(LIR_piand, v_ins, INS_CONST(JSVAL_TAGMASK)),
                         JSVAL_BOOLEAN),
              MISMATCH_EXIT);
         v_ins = lir->ins2i(LIR_ush, v_ins, JSVAL_TAGBITS);
         return true;
       case JSVAL_OBJECT:
        guard(true,
              lir->ins2i(LIR_eq,
                         lir->ins2(LIR_piand, v_ins, INS_CONST(JSVAL_TAGMASK)),
                         JSVAL_OBJECT),
              MISMATCH_EXIT);
        return true;
      case JSVAL_STRING:
        guard(true,
              lir->ins2i(LIR_eq,
                        lir->ins2(LIR_piand, v_ins, INS_CONST(JSVAL_TAGMASK)),
                        JSVAL_STRING),
              MISMATCH_EXIT);
        v_ins = lir->ins2(LIR_piand, v_ins, INS_CONST(~JSVAL_TAGMASK));
        return true;
    }
    return false;
}

bool
TraceRecorder::getThis(LIns*& this_ins)
{
    if (cx->fp->callee) { /* in a function */
        if (JSVAL_IS_NULL(cx->fp->argv[-1]))
            return false;
        this_ins = get(&cx->fp->argv[-1]);
        guard(false, lir->ins_eq0(this_ins), MISMATCH_EXIT);
    } else { /* in global code */
        this_ins = scopeChain();
    }
    return true;
}

bool
TraceRecorder::guardClass(JSObject* obj, LIns* obj_ins, JSClass* clasp, ExitType exitType)
{
    bool cond = STOBJ_GET_CLASS(obj) == clasp;

    LIns* class_ins = lir->insLoad(LIR_ldp, obj_ins, offsetof(JSObject, classword));
    class_ins = lir->ins2(LIR_piand, class_ins, lir->insImm(~3));

    char namebuf[32];
    JS_snprintf(namebuf, sizeof namebuf, "guard(class is %s)", clasp->name);
    guard(cond, addName(lir->ins2(LIR_eq, class_ins, INS_CONSTPTR(clasp)), namebuf), exitType);
    return cond;
}

bool
TraceRecorder::guardDenseArray(JSObject* obj, LIns* obj_ins, ExitType exitType)
{
    return guardClass(obj, obj_ins, &js_ArrayClass, exitType);
}

bool
TraceRecorder::guardDenseArrayIndex(JSObject* obj, jsint idx, LIns* obj_ins,
                                    LIns* dslots_ins, LIns* idx_ins, ExitType exitType)
{
    jsuint length = ARRAY_DENSE_LENGTH(obj);

    bool cond = (jsuint(idx) < jsuint(obj->fslots[JSSLOT_ARRAY_LENGTH]) && jsuint(idx) < length);
    if (cond) {
        /* Guard array length */
        LIns* exit = guard(true,
                           lir->ins2(LIR_ult, idx_ins, stobj_get_fslot(obj_ins, JSSLOT_ARRAY_LENGTH)),
                           exitType)->oprnd2();
        /* dslots must not be NULL */
        guard(false,
              lir->ins_eq0(dslots_ins),
              exit);
        /* Guard array capacity */
        guard(true,
              lir->ins2(LIR_ult,
                        idx_ins,
                        lir->insLoad(LIR_ldp, dslots_ins, 0 - (int)sizeof(jsval))),
              exit);
    } else {
        /* If not idx < length, stay on trace (and read value as undefined). */ 
        LIns* br1 = lir->insBranch(LIR_jf, 
                                   lir->ins2(LIR_ult, 
                                             idx_ins, 
                                             stobj_get_fslot(obj_ins, JSSLOT_ARRAY_LENGTH)),
                                   NULL);
        /* If dslots is NULL, stay on trace (and read value as undefined). */
        LIns* br2 = lir->insBranch(LIR_jt, lir->ins_eq0(dslots_ins), NULL);
        /* If not idx < capacity, stay on trace (and read value as undefined). */
        LIns* br3 = lir->insBranch(LIR_jf,
                                   lir->ins2(LIR_ult,
                                             idx_ins,
                                             lir->insLoad(LIR_ldp, dslots_ins, 0 - (int)sizeof(jsval))),
                                   NULL);
        lir->insGuard(LIR_x, lir->insImm(1), snapshot(exitType));
        LIns* label = lir->ins0(LIR_label);
        br1->target(label);
        br2->target(label);
        br3->target(label);
    }
    return cond;    
}

/*
 * Guard that a computed property access via an element op (JSOP_GETELEM, etc.)
 * does not find an alias to a global variable, or a property without a slot,
 * or a slot-ful property with a getter or setter (depending on op_offset in
 * JSObjectOps). Finally, beware resolve hooks mutating objects. Oh, and watch
 * out for bears too ;-).
 *
 * One win here is that we do not need to generate a guard that obj_ins does
 * not result in the global object on trace, because we guard on shape and rule
 * out obj's shape being the global object's shape at recording time. This is
 * safe because the global shape cannot change on trace.
 */
bool
TraceRecorder::guardElemOp(JSObject* obj, LIns* obj_ins, jsid id, size_t op_offset, jsval* vp)
{
    LIns* map_ins = lir->insLoad(LIR_ldp, obj_ins, (int)offsetof(JSObject, map));
    LIns* ops_ins;
    if (!map_is_native(obj->map, map_ins, ops_ins, op_offset))
        return false;

    uint32 shape = OBJ_SHAPE(obj);
    if (JSID_IS_ATOM(id) && shape == traceMonitor->globalShape)
        ABORT_TRACE("elem op probably aliases global");

    JSObject* pobj;
    JSProperty* prop;
    if (!js_LookupProperty(cx, obj, id, &pobj, &prop))
        return false;

    if (vp)
        *vp = JSVAL_VOID;
    if (prop) {
        bool traceable_slot = true;
        if (pobj == obj) {
            JSScopeProperty* sprop = (JSScopeProperty*) prop;
            traceable_slot = ((op_offset == offsetof(JSObjectOps, getProperty))
                              ? SPROP_HAS_STUB_GETTER(sprop)
                              : SPROP_HAS_STUB_SETTER(sprop)) &&
                             SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(obj));
            if (vp && traceable_slot)
                *vp = LOCKED_OBJ_GET_SLOT(obj, sprop->slot);
        }

        OBJ_DROP_PROPERTY(cx, pobj, prop);
        if (pobj != obj)
            ABORT_TRACE("elem op hit prototype property, can't shape-guard");
        if (!traceable_slot)
            ABORT_TRACE("elem op hit direct and slotless getter or setter");
    }

    // If we got this far, we're almost safe -- but we must check for a rogue resolve hook.
    if (OBJ_SHAPE(obj) != shape)
        ABORT_TRACE("resolve hook mutated elem op base object");

    LIns* shape_ins = addName(lir->insLoad(LIR_ld, map_ins, offsetof(JSScope, shape)), "shape");
    guard(true, addName(lir->ins2i(LIR_eq, shape_ins, shape), "guard(shape)"), MISMATCH_EXIT);
    return true;
}

void
TraceRecorder::clearFrameSlotsFromCache()
{
    /* Clear out all slots of this frame in the nativeFrameTracker. Different locations on the
       VM stack might map to different locations on the native stack depending on the
       number of arguments (i.e.) of the next call, so we have to make sure we map
       those in to the cache with the right offsets. */
    JSStackFrame* fp = cx->fp;
    jsval* vp;
    jsval* vpstop;
    if (fp->callee) {
        vp = &fp->argv[-2];
        vpstop = &fp->argv[fp->fun->nargs];
        while (vp < vpstop)
            nativeFrameTracker.set(vp++, (LIns*)0);
    }
    vp = &fp->slots[0];
    vpstop = &fp->slots[fp->script->nslots];
    while (vp < vpstop)
        nativeFrameTracker.set(vp++, (LIns*)0);
}

bool
TraceRecorder::record_EnterFrame()
{
    JSStackFrame* fp = cx->fp;

    if (++callDepth >= MAX_CALLDEPTH)
        ABORT_TRACE("exceeded maximum call depth");
    // FIXME: Allow and attempt to inline a single level of recursion until we compile 
    //        recursive calls as independent trees (459301).
    if (fp->script == fp->down->script && fp->down->down && fp->down->down->script == fp->script)
        ABORT_TRACE("recursive call");
    
    debug_only_v(printf("EnterFrame %s, callDepth=%d\n",
                        js_AtomToPrintableString(cx, cx->fp->fun->atom),
                        callDepth);)
    LIns* void_ins = INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID));

    jsval* vp = &fp->argv[fp->argc];
    jsval* vpstop = vp + ptrdiff_t(fp->fun->nargs) - ptrdiff_t(fp->argc);
    if (applyingArguments) {
        applyingArguments = false;
        while (vp < vpstop) {
            JS_ASSERT(vp >= fp->down->regs->sp);
            nativeFrameTracker.set(vp, (LIns*)0);
            LIns* arg_ins = get(&fp->down->argv[fp->argc + (vp - vpstop)]);
            set(vp++, arg_ins, true);
        }
    } else {
        while (vp < vpstop) {
            if (vp >= fp->down->regs->sp)
                nativeFrameTracker.set(vp, (LIns*)0);
            set(vp++, void_ins, true);
        }
    }

    vp = &fp->slots[0];
    vpstop = vp + fp->script->nfixed;
    while (vp < vpstop)
        set(vp++, void_ins, true);
    return true;
}

bool
TraceRecorder::record_LeaveFrame()
{
    debug_only_v(
        if (cx->fp->fun)
            printf("LeaveFrame (back to %s), callDepth=%d\n",
                   js_AtomToPrintableString(cx, cx->fp->fun->atom),
                   callDepth);
        );
    if (callDepth-- <= 0)
        ABORT_TRACE("returned out of a loop we started tracing");

    // LeaveFrame gets called after the interpreter popped the frame and
    // stored rval, so cx->fp not cx->fp->down, and -1 not 0.
    atoms = cx->fp->script->atomMap.vector;
    set(&stackval(-1), rval_ins, true);
    return true;
}

bool
TraceRecorder::record_JSOP_INTERRUPT()
{
    return false;
}

bool
TraceRecorder::record_JSOP_PUSH()
{
    stack(0, INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID)));
    return true;
}

bool
TraceRecorder::record_JSOP_POPV()
{
    jsval& rval = stackval(-1);
    LIns *rval_ins = get(&rval);
    if (!box_jsval(rval, rval_ins))
        return false;

    // Store it in cx->fp->rval. NB: Tricky dependencies. cx->fp is the right
    // frame because POPV appears only in global and eval code and we don't
    // trace JSOP_EVAL or leaving the frame where tracing started.
    LIns *fp_ins = lir->insLoad(LIR_ldp, cx_ins, offsetof(JSContext, fp));
    lir->insStorei(rval_ins, fp_ins, offsetof(JSStackFrame, rval));
    return true;
}

bool
TraceRecorder::record_JSOP_ENTERWITH()
{
    return false;
}

bool
TraceRecorder::record_JSOP_LEAVEWITH()
{
    return false;
}

bool
TraceRecorder::record_JSOP_RETURN()
{
    jsval& rval = stackval(-1);
    JSStackFrame *fp = cx->fp;
    if ((cx->fp->flags & JSFRAME_CONSTRUCTING) && JSVAL_IS_PRIMITIVE(rval)) {
        JS_ASSERT(OBJECT_TO_JSVAL(fp->thisp) == fp->argv[-1]);
        rval_ins = get(&fp->argv[-1]);
    } else {
        rval_ins = get(&rval);
    }
    debug_only_v(printf("returning from %s\n", js_AtomToPrintableString(cx, cx->fp->fun->atom));)
    clearFrameSlotsFromCache();
    return true;
}

bool
TraceRecorder::record_JSOP_GOTO()
{
    return true;
}

bool
TraceRecorder::record_JSOP_IFEQ()
{
    trackCfgMerges(cx->fp->regs->pc);
    return ifop();
}

bool
TraceRecorder::record_JSOP_IFNE()
{
    return ifop();
}

bool
TraceRecorder::record_JSOP_ARGUMENTS()
{
#if 1
    ABORT_TRACE("can't trace arguments yet");
#else
    LIns* args[] = { cx_ins };
    LIns* a_ins = lir->insCall(&js_Arguments_ci, args);
    guard(false, lir->ins_eq0(a_ins), OOM_EXIT);
    stack(0, a_ins);
    return true;
#endif
}

bool
TraceRecorder::record_JSOP_DUP()
{
    stack(0, get(&stackval(-1)));
    return true;
}

bool
TraceRecorder::record_JSOP_DUP2()
{
    stack(0, get(&stackval(-2)));
    stack(1, get(&stackval(-1)));
    return true;
}

bool
TraceRecorder::record_JSOP_SWAP()
{
    jsval& l = stackval(-2);
    jsval& r = stackval(-1);
    LIns* l_ins = get(&l);
    LIns* r_ins = get(&r);
    set(&r, l_ins);
    set(&l, r_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_SETCONST()
{
    return false;
}

bool
TraceRecorder::record_JSOP_BITOR()
{
    return binary(LIR_or);
}

bool
TraceRecorder::record_JSOP_BITXOR()
{
    return binary(LIR_xor);
}

bool
TraceRecorder::record_JSOP_BITAND()
{
    return binary(LIR_and);
}

bool
TraceRecorder::record_JSOP_EQ()
{
    return cmp(LIR_feq, CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_NE()
{
    return cmp(LIR_feq, CMP_NEGATE | CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_LT()
{
    return cmp(LIR_flt, CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_LE()
{
    return cmp(LIR_fle, CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_GT()
{
    return cmp(LIR_fgt, CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_GE()
{
    return cmp(LIR_fge, CMP_TRY_BRANCH_AFTER_COND);
}

bool
TraceRecorder::record_JSOP_LSH()
{
    return binary(LIR_lsh);
}

bool
TraceRecorder::record_JSOP_RSH()
{
    return binary(LIR_rsh);
}

bool
TraceRecorder::record_JSOP_URSH()
{
    return binary(LIR_ush);
}

static struct {
    jsbytecode obj_any[10];
    jsbytecode any_obj[8];
    jsbytecode obj_obj[16];
} add_imacros = {
    {
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(toString),
        JSOP_CALL, 0, 0,
        JSOP_SWAP,
        JSOP_ADD,
        JSOP_STOP
    },

    {
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(toString),
        JSOP_CALL, 0, 0,
        JSOP_ADD,
        JSOP_STOP
    },

    {
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(toString),
        JSOP_CALL, 0, 0,
        JSOP_SWAP,
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(toString),
        JSOP_CALL, 0, 0,
        JSOP_ADD,
        JSOP_STOP
    }
};

JS_STATIC_ASSERT(sizeof(add_imacros) < IMACRO_PC_ADJ_LIMIT);

bool
TraceRecorder::record_JSOP_ADD()
{
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);

    if (JSVAL_IS_OBJECT(l) && hasToStringMethod(l)) {
        if (JSVAL_IS_OBJECT(r) && hasToStringMethod(r))
            return call_imacro(add_imacros.obj_obj);
        return call_imacro(add_imacros.obj_any);
    }
    if (JSVAL_IS_OBJECT(r) && hasToStringMethod(r))
        return call_imacro(add_imacros.any_obj);

    if (JSVAL_IS_STRING(l) || JSVAL_IS_STRING(r)) {
        LIns* args[] = { stringify(r), stringify(l), cx_ins };
        if (!args[0] || !args[1])
            ABORT_TRACE("can't stringify objects");
        LIns* concat = lir->insCall(&js_ConcatStrings_ci, args);
        guard(false, lir->ins_eq0(concat), OOM_EXIT);
        set(&l, concat);
        return true;
    }

    return binary(LIR_fadd);
}

bool
TraceRecorder::record_JSOP_SUB()
{
    return binary(LIR_fsub);
}

bool
TraceRecorder::record_JSOP_MUL()
{
    return binary(LIR_fmul);
}

bool
TraceRecorder::record_JSOP_DIV()
{
    return binary(LIR_fdiv);
}

bool
TraceRecorder::record_JSOP_MOD()
{
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);

    if (JSVAL_IS_OBJECT(l) && hasValueOfMethod(l)) {
        if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
            return call_imacro(binary_imacros.obj_obj);
        return call_imacro(binary_imacros.obj_any);
    }
    if (JSVAL_IS_OBJECT(r) && hasValueOfMethod(r))
        return call_imacro(binary_imacros.any_obj);

    if (isNumber(l) && isNumber(r)) {
        LIns* l_ins = get(&l);
        LIns* r_ins = get(&r);
        LIns* x;
        /* We can't demote this in a filter since we need the actual values of l and r. */
        if (isPromote(l_ins) && isPromote(r_ins) && asNumber(l) >= 0 && asNumber(r) > 0) {
            LIns* args[] = { ::demote(lir, r_ins), ::demote(lir, l_ins) };
            x = lir->insCall(&js_imod_ci, args);
            guard(false, lir->ins2(LIR_eq, x, lir->insImm(-1)), BRANCH_EXIT);
            x = lir->ins1(LIR_i2f, x);
        } else {
            LIns* args[] = { r_ins, l_ins };
            x = lir->insCall(&js_dmod_ci, args);
        }
        set(&l, x);
        return true;
    }
    return false;
}

bool
TraceRecorder::record_JSOP_NOT()
{
    jsval& v = stackval(-1);
    if (JSVAL_TAG(v) == JSVAL_BOOLEAN) {
        set(&v, lir->ins_eq0(lir->ins2i(LIR_eq, get(&v), 1)));
        return true;
    } 
    if (isNumber(v)) {
        LIns* v_ins = get(&v);
        set(&v, lir->ins2(LIR_or, lir->ins2(LIR_feq, v_ins, lir->insImmq(0)),
                                  lir->ins_eq0(lir->ins2(LIR_feq, v_ins, v_ins))));
        return true;
    } 
    if (JSVAL_IS_OBJECT(v)) {
        set(&v, lir->ins_eq0(get(&v)));
        return true;
    }
    JS_ASSERT(JSVAL_IS_STRING(v));
    set(&v, lir->ins_eq0(lir->ins2(LIR_piand, 
                                   lir->insLoad(LIR_ldp, get(&v), (int)offsetof(JSString, length)),
                                   INS_CONSTPTR(JSSTRING_LENGTH_MASK))));
    return true;
}

bool
TraceRecorder::record_JSOP_BITNOT()
{
    return unary(LIR_not);
}

bool
TraceRecorder::record_JSOP_NEG()
{
    jsval& v = stackval(-1);
    if (isNumber(v)) {
        LIns* a = get(&v);

        /* If we're a promoted integer, we have to watch out for 0s since -0 is a double.
           Only follow this path if we're not an integer that's 0 and we're not a double 
           that's zero.
         */
        if (isPromoteInt(a) &&
            (!JSVAL_IS_INT(v) || JSVAL_TO_INT(v) != 0) &&
            (!JSVAL_IS_DOUBLE(v) || !JSDOUBLE_IS_NEGZERO(*JSVAL_TO_DOUBLE(v))))  {
            a = lir->ins1(LIR_neg, ::demote(lir, a));
            lir->insGuard(LIR_xt, lir->ins1(LIR_ov, a), snapshot(OVERFLOW_EXIT));
            lir->insGuard(LIR_xt, lir->ins2(LIR_eq, a, lir->insImm(0)), snapshot(OVERFLOW_EXIT));
            a = lir->ins1(LIR_i2f, a);
        } else {
            a = lir->ins1(LIR_fneg, a);
        }

        set(&v, a);
        return true;
    }
    return false;
}

JSBool
js_Array(JSContext* cx, JSObject* obj, uintN argc, jsval* argv, jsval* rval);

JSBool
js_Object(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);

JSBool
js_Date(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);

JSBool
js_fun_apply(JSContext* cx, uintN argc, jsval* vp);

bool
TraceRecorder::functionCall(bool constructing)
{
    JSStackFrame* fp = cx->fp;
    jsbytecode *pc = fp->regs->pc;
    uintN argc = GET_ARGC(pc);

    jsval& fval = stackval(0 - (2 + argc));
    JS_ASSERT(&fval >= StackBase(fp));

    if (!VALUE_IS_FUNCTION(cx, fval))
        ABORT_TRACE("callee is not a function");

    jsval& tval = stackval(0 - (argc + 1));
    LIns* this_ins = get(&tval);

    if (this_ins->isconstp() && !this_ins->constvalp() && !guardShapelessCallee(fval))
        return false;

    /*
     * Require that the callee be a function object, to avoid guarding on its
     * class here. We know if the callee and this were pushed by JSOP_CALLNAME
     * or JSOP_CALLPROP that callee is a *particular* function, since these hit
     * the property cache and guard on the object (this) in which the callee
     * was found. So it's sufficient to test here that the particular function
     * is interpreted, not guard on that condition.
     *
     * Bytecode sequences that push shapeless callees must guard on the callee
     * class being Function and the function being interpreted.
     */
    JSFunction* fun = GET_FUNCTION_PRIVATE(cx, JSVAL_TO_OBJECT(fval));

    if (FUN_INTERPRETED(fun)) {
        if (constructing) {
            LIns* args[] = { get(&fval), cx_ins };
            LIns* tv_ins = lir->insCall(&js_FastNewObject_ci, args);
            guard(false, lir->ins_eq0(tv_ins), OOM_EXIT);
            set(&tval, tv_ins);
        }
        return interpretedFunctionCall(fval, fun, argc, constructing);
    }

    LIns* arg1_ins = NULL;
    jsval arg1 = JSVAL_VOID;
    jsval thisval = tval;
    if (!constructing && FUN_FAST_NATIVE(fun) == js_fun_apply) {
        if (argc != 2)
            ABORT_TRACE("can't trace Function.prototype.apply with other than 2 args");

        if (!guardShapelessCallee(tval))
            return false;
        JSObject* tfunobj = JSVAL_TO_OBJECT(tval);
        JSFunction* tfun = GET_FUNCTION_PRIVATE(cx, tfunobj);

        jsval& oval = stackval(-2);
        if (JSVAL_IS_PRIMITIVE(oval))
            ABORT_TRACE("can't trace Function.prototype.apply with primitive 1st arg");

        jsval& aval = stackval(-1);
        if (JSVAL_IS_PRIMITIVE(aval))
            ABORT_TRACE("can't trace Function.prototype.apply with primitive 2nd arg");
        JSObject* aobj = JSVAL_TO_OBJECT(aval);

        LIns* aval_ins = get(&aval);
        if (!aval_ins->isCall())
            ABORT_TRACE("can't trace Function.prototype.apply on non-builtin-call 2nd arg");

        if (aval_ins->callInfo() == &js_Arguments_ci) {
            JS_ASSERT(OBJ_GET_CLASS(cx, aobj) == &js_ArgumentsClass);
            JS_ASSERT(OBJ_GET_PRIVATE(cx, aobj) == fp);
            if (!FUN_INTERPRETED(tfun))
                ABORT_TRACE("can't trace Function.prototype.apply(native_function, arguments)");

            // We can only fasttrack applys where the argument array we pass in has the
            // same length (fp->argc) as the number of arguments the function expects (tfun->nargs).
            argc = fp->argc;
            if (tfun->nargs != argc || fp->fun->nargs != argc)
                ABORT_TRACE("can't trace Function.prototype.apply(scripted_function, arguments)");

            jsval* sp = fp->regs->sp - 4;
            set(sp, get(&tval));
            *sp++ = tval;
            set(sp, get(&oval));
            *sp++ = oval;
            jsval* newsp = sp + argc;
            if (newsp > fp->slots + fp->script->nslots) {
                JSArena* a = cx->stackPool.current;
                if (jsuword(newsp) > a->limit)
                    ABORT_TRACE("can't grow stack for Function.prototype.apply");
                if (jsuword(newsp) > a->avail)
                    a->avail = jsuword(newsp);
            }

            jsval* argv = fp->argv;
            for (uintN i = 0; i < JS_MIN(argc, 2); i++) {
                set(&sp[i], get(&argv[i]));
                sp[i] = argv[i];
            }
            applyingArguments = true;
            return interpretedFunctionCall(tval, tfun, argc, false);
        }

        if (aval_ins->callInfo() != &js_Array_1str_ci)
            ABORT_TRACE("can't trace Function.prototype.apply on other than [str] 2nd arg");

        JS_ASSERT(OBJ_IS_ARRAY(cx, aobj));
        JS_ASSERT(aobj->fslots[JSSLOT_ARRAY_LENGTH] == 1);
        JS_ASSERT(JSVAL_IS_STRING(aobj->dslots[0]));

        if (FUN_INTERPRETED(tfun))
            ABORT_TRACE("can't trace Function.prototype.apply for scripted functions");

        if (!(tfun->flags & JSFUN_TRACEABLE))
            ABORT_TRACE("Function.prototype.apply on untraceable native");

        thisval = oval;
        this_ins = get(&oval);
        arg1_ins = callArgN(aval_ins, 2);
        arg1 = aobj->dslots[0];
        fun = tfun;
        argc = 1;
    }

    if (!constructing && !(fun->flags & JSFUN_TRACEABLE))
        ABORT_TRACE("untraceable native");

    static JSTraceableNative knownNatives[] = {
        { (JSFastNative)js_Array,  &js_FastNewArray_ci,   "pC", "",    FAIL_NULL | JSTN_MORE },
        { (JSFastNative)js_Array,  &js_Array_1int_ci,     "pC", "i",   FAIL_NULL | JSTN_MORE },
        { (JSFastNative)js_Array,  &js_Array_2obj_ci,     "pC", "oo",  FAIL_NULL | JSTN_MORE },
        { (JSFastNative)js_Array,  &js_Array_3num_ci,     "pC", "ddd", FAIL_NULL | JSTN_MORE },
        { (JSFastNative)js_Object, &js_FastNewObject_ci,  "fC", "",    FAIL_NULL | JSTN_MORE },
        { (JSFastNative)js_Date,   &js_FastNewDate_ci,    "pC", "",    FAIL_NULL },
    };

    LIns* args[5];
    JSTraceableNative* known = constructing ? knownNatives : FUN_TRCINFO(fun);
    do {
        if (constructing && (JSFastNative)fun->u.n.native != known->native)
            continue;

        uintN knownargc = strlen(known->argtypes);
        if (argc != knownargc)
            continue;

        intN prefixc = strlen(known->prefix);
        JS_ASSERT(prefixc <= 3);
        LIns** argp = &args[argc + prefixc - 1];
        char argtype;

#if defined _DEBUG
        memset(args, 0xCD, sizeof(args));
#endif

        uintN i;
        for (i = prefixc; i--; ) {
            argtype = known->prefix[i];
            if (argtype == 'C') {
                *argp = cx_ins;
            } else if (argtype == 'T') {   /* this, as an object */
                if (!JSVAL_IS_OBJECT(thisval))
                    goto next_specialization;
                *argp = this_ins;
            } else if (argtype == 'S') {   /* this, as a string */
                if (!JSVAL_IS_STRING(thisval))
                    goto next_specialization;
                *argp = this_ins;
            } else if (argtype == 'f') {
                *argp = INS_CONSTPTR(JSVAL_TO_OBJECT(fval));
            } else if (argtype == 'p') {
                JSObject* ctor = JSVAL_TO_OBJECT(fval);
                jsval pval;
                if (!OBJ_GET_PROPERTY(cx, ctor,
                                      ATOM_TO_JSID(cx->runtime->atomState
                                                   .classPrototypeAtom),
                                      &pval)) {
                    ABORT_TRACE("error getting prototype from constructor");
                }
                if (!JSVAL_IS_OBJECT(pval))
                    ABORT_TRACE("got primitive prototype from constructor");
                *argp = INS_CONSTPTR(JSVAL_TO_OBJECT(pval));
            } else if (argtype == 'R') {
                *argp = INS_CONSTPTR(cx->runtime);
            } else if (argtype == 'P') {
                *argp = INS_CONSTPTR(pc);
            } else if (argtype == 'D') {  /* this, as a number */
                if (!isNumber(thisval))
                    goto next_specialization;
                *argp = this_ins;
            } else {
                JS_NOT_REACHED("unknown prefix arg type");
            }
            argp--;
        }

        for (i = knownargc; i--; ) {
            jsval& arg = (!constructing && i == 0 && arg1_ins) ? arg1 : stackval(0 - (i + 1));
            *argp = (!constructing && i == 0 && arg1_ins) ? arg1_ins : get(&arg);

            argtype = known->argtypes[i];
            if (argtype == 'd' || argtype == 'i') {
                if (!isNumber(arg))
                    goto next_specialization;
                if (argtype == 'i')
                    *argp = f2i(*argp);
            } else if (argtype == 'o') {
                if (!JSVAL_IS_OBJECT(arg))
                    goto next_specialization;
            } else if (argtype == 's') {
                if (!JSVAL_IS_STRING(arg))
                    goto next_specialization;
            } else if (argtype == 'r') {
                if (!VALUE_IS_REGEXP(cx, arg))
                    goto next_specialization;
            } else if (argtype == 'f') {
                if (!VALUE_IS_FUNCTION(cx, arg))
                    goto next_specialization;
            } else if (argtype == 'v') {
                if (!box_jsval(arg, *argp))
                    return false;
            } else {
                goto next_specialization;
            }
            argp--;
        }

        /*
         * If we got this far, and we have a charCodeAt, check that charCodeAt
         * isn't going to return a NaN.
         */
        if (!constructing && known->builtin == &js_String_p_charCodeAt_ci) {
            JSString* str = JSVAL_TO_STRING(thisval);
            jsval& arg = arg1_ins ? arg1 : stackval(-1);

            JS_ASSERT(JSVAL_IS_STRING(thisval));
            JS_ASSERT(isNumber(arg));

            if (JSVAL_IS_INT(arg)) {
                if (size_t(JSVAL_TO_INT(arg)) >= JSSTRING_LENGTH(str))
                    ABORT_TRACE("invalid charCodeAt index");
            } else {
                double d = js_DoubleToInteger(*JSVAL_TO_DOUBLE(arg));
                if (d < 0 || JSSTRING_LENGTH(str) <= d)
                    ABORT_TRACE("invalid charCodeAt index");
            }
        }
        goto success;

next_specialization:;
    } while ((known++)->flags & JSTN_MORE);

    if (!constructing)
        ABORT_TRACE("unknown native");
    if (!(fun->flags & JSFUN_TRACEABLE) && FUN_CLASP(fun))
        ABORT_TRACE("can't trace native constructor");
    ABORT_TRACE("can't trace unknown constructor");

success:
#if defined _DEBUG
    JS_ASSERT(args[0] != (LIns *)0xcdcdcdcd);
#endif

    LIns* res_ins = lir->insCall(known->builtin, args);
    if (!constructing)
        rval_ins = res_ins;
    switch (JSTN_ERRTYPE(known)) {
      case FAIL_NULL:
        guard(false, lir->ins_eq0(res_ins), OOM_EXIT);
        break;
      case FAIL_NEG:
      {
        res_ins = lir->ins1(LIR_i2f, res_ins);
        jsdpun u;
        u.d = 0.0;
        guard(false, lir->ins2(LIR_flt, res_ins, lir->insImmq(u.u64)), OOM_EXIT);
        break;
      }
      case FAIL_VOID:
        guard(false, lir->ins2i(LIR_eq, res_ins, JSVAL_TO_BOOLEAN(JSVAL_VOID)), OOM_EXIT);
        break;
      default:;
    }
    set(&fval, res_ins);

    if (!constructing) {
        /*
         * The return value will be processed by FastNativeCallComplete since
         * we have to know the actual return value type for calls that return
         * jsval (like Array_p_pop).
         */
        pendingTraceableNative = known;
    }

    return true;
}

bool
TraceRecorder::record_JSOP_NEW()
{
    return functionCall(true);
}

bool
TraceRecorder::record_JSOP_DELNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DELPROP()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DELELEM()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TYPEOF()
{
    jsval& r = stackval(-1);
    LIns* type;
    if (JSVAL_IS_STRING(r)) {
        type = INS_CONSTPTR(ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_STRING]));
    } else if (isNumber(r)) {
        type = INS_CONSTPTR(ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_NUMBER]));
    } else {
        LIns* args[] = { get(&r), cx_ins };
        if (JSVAL_TAG(r) == JSVAL_BOOLEAN) {
            // We specialize identically for boolean and undefined. We must not have a hole here.
            // Pass the unboxed type here, since TypeOfBoolean knows how to handle it.
            JS_ASSERT(JSVAL_TO_BOOLEAN(r) <= 2);
            type = lir->insCall(&js_TypeOfBoolean_ci, args);
        } else {
            JS_ASSERT(JSVAL_IS_OBJECT(r));
            type = lir->insCall(&js_TypeOfObject_ci, args);
        }
    }
    set(&r, type);
    return true;
}

bool
TraceRecorder::record_JSOP_VOID()
{
    stack(-1, INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID)));
    return true;
}

bool
TraceRecorder::record_JSOP_INCNAME()
{
    return incName(1);
}

bool
TraceRecorder::record_JSOP_INCPROP()
{
    return incProp(1);
}

bool
TraceRecorder::record_JSOP_INCELEM()
{
    return incElem(1);
}

bool
TraceRecorder::record_JSOP_DECNAME()
{
    return incName(-1);
}

bool
TraceRecorder::record_JSOP_DECPROP()
{
    return incProp(-1);
}

bool
TraceRecorder::record_JSOP_DECELEM()
{
    return incElem(-1);
}

bool
TraceRecorder::incName(jsint incr, bool pre)
{
    jsval* vp;
    if (!name(vp))
        return false;
    LIns* v_ins = get(vp);
    if (!inc(*vp, v_ins, incr, pre))
        return false;
    set(vp, v_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_NAMEINC()
{
    return incName(1, false);
}

bool
TraceRecorder::record_JSOP_PROPINC()
{
    return incProp(1, false);
}

// XXX consolidate with record_JSOP_GETELEM code...
bool
TraceRecorder::record_JSOP_ELEMINC()
{
    return incElem(1, false);
}

bool
TraceRecorder::record_JSOP_NAMEDEC()
{
    return incName(-1, false);
}

bool
TraceRecorder::record_JSOP_PROPDEC()
{
    return incProp(-1, false);
}

bool
TraceRecorder::record_JSOP_ELEMDEC()
{
    return incElem(-1, false);
}

bool
TraceRecorder::record_JSOP_GETPROP()
{
    return getProp(stackval(-1));
}

bool
TraceRecorder::record_JSOP_SETPROP()
{
    jsval& l = stackval(-2);
    if (JSVAL_IS_PRIMITIVE(l))
        ABORT_TRACE("primitive this for SETPROP");

    JSObject* obj = JSVAL_TO_OBJECT(l);
    if (obj->map->ops->setProperty != js_SetProperty)
        ABORT_TRACE("non-native JSObjectOps::setProperty");
    return true;
}

bool
TraceRecorder::record_SetPropHit(JSPropCacheEntry* entry, JSScopeProperty* sprop)
{
    if (sprop->setter == js_watch_set)
        ABORT_TRACE("watchpoint detected");

    jsbytecode* pc = cx->fp->regs->pc;
    jsval& r = stackval(-1);
    jsval& l = stackval(-2);

    JS_ASSERT(!JSVAL_IS_PRIMITIVE(l));
    JSObject* obj = JSVAL_TO_OBJECT(l);
    LIns* obj_ins = get(&l);

    if (obj == globalObj) {
        JS_ASSERT(SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(obj)));
        uint32 slot = sprop->slot;
        if (!lazilyImportGlobalSlot(slot))
            ABORT_TRACE("lazy import of global slot failed");

        LIns* r_ins = get(&r);
        set(&STOBJ_GET_SLOT(obj, slot), r_ins);

        JS_ASSERT(*pc != JSOP_INITPROP);
        if (pc[JSOP_SETPROP_LENGTH] != JSOP_POP)
            set(&l, r_ins);
        return true;
    }

    // The global object's shape is guarded at trace entry, all others need a guard here.
    LIns* map_ins = lir->insLoad(LIR_ldp, obj_ins, (int)offsetof(JSObject, map));
    LIns* ops_ins;
    if (!map_is_native(obj->map, map_ins, ops_ins, offsetof(JSObjectOps, setProperty)))
        return false;

    LIns* shape_ins = addName(lir->insLoad(LIR_ld, map_ins, offsetof(JSScope, shape)), "shape");
    guard(true, addName(lir->ins2i(LIR_eq, shape_ins, entry->kshape), "guard(shape)"),
          MISMATCH_EXIT);

    if (entry->kshape != PCVCAP_SHAPE(entry->vcap)) {
        LIns* args[] = { INS_CONSTPTR(sprop), obj_ins, cx_ins };
        LIns* ok_ins = lir->insCall(&js_AddProperty_ci, args);
        guard(false, lir->ins_eq0(ok_ins), OOM_EXIT);
    }

    LIns* dslots_ins = NULL;
    LIns* v_ins = get(&r);
    LIns* boxed_ins = v_ins;
    if (!box_jsval(r, boxed_ins))
        return false;
    if (!native_set(obj_ins, sprop, dslots_ins, boxed_ins))
        return false;

    if (*pc != JSOP_INITPROP && pc[JSOP_SETPROP_LENGTH] != JSOP_POP)
        set(&l, v_ins);
    return true;
}

bool
TraceRecorder::record_SetPropMiss(JSPropCacheEntry* entry)
{
    if (entry->kpc != cx->fp->regs->pc || !PCVAL_IS_SPROP(entry->vword))
        ABORT_TRACE("can't trace uncacheable property set");

    JSScopeProperty* sprop = PCVAL_TO_SPROP(entry->vword);

#ifdef DEBUG
    jsval& l = stackval(-2);
    JSObject* obj = JSVAL_TO_OBJECT(l);
    JSScope* scope = OBJ_SCOPE(obj);
    JS_ASSERT(scope->object == obj);
    JS_ASSERT(scope->shape == PCVCAP_SHAPE(entry->vcap));
    JS_ASSERT(SCOPE_HAS_PROPERTY(scope, sprop));
#endif

    return record_SetPropHit(entry, sprop);
}

bool
TraceRecorder::record_JSOP_GETELEM()
{
    jsval& idx = stackval(-1);
    jsval& lval = stackval(-2);

    LIns* obj_ins = get(&lval);
    LIns* idx_ins = get(&idx);
    
    if (JSVAL_IS_STRING(lval) && JSVAL_IS_INT(idx)) {
        int i = JSVAL_TO_INT(idx);
        if ((size_t)i >= JSSTRING_LENGTH(JSVAL_TO_STRING(lval)))
            ABORT_TRACE("Invalid string index in JSOP_GETELEM");
        idx_ins = makeNumberInt32(idx_ins);
        LIns* args[] = { idx_ins, obj_ins, cx_ins };
        LIns* unitstr_ins = lir->insCall(&js_String_getelem_ci, args);
        guard(false, lir->ins_eq0(unitstr_ins), MISMATCH_EXIT);
        set(&lval, unitstr_ins);
        return true;
    }

    if (JSVAL_IS_PRIMITIVE(lval))
        ABORT_TRACE("JSOP_GETLEM on a primitive");

    JSObject* obj = JSVAL_TO_OBJECT(lval);
    jsval id;
    jsval v;
    LIns* v_ins;

    /* Property access using a string name. */
    if (JSVAL_IS_STRING(idx)) {
        if (!js_ValueToStringId(cx, idx, &id))
            return false;
        // Store the interned string to the stack to save the interpreter from redoing this work.
        idx = ID_TO_VALUE(id);
        jsuint index;
        if (js_IdIsIndex(idx, &index) && guardDenseArray(obj, obj_ins, BRANCH_EXIT)) {
            v = (index >= ARRAY_DENSE_LENGTH(obj)) ? JSVAL_HOLE : obj->dslots[index];
            if (v == JSVAL_HOLE)
                ABORT_TRACE("can't see through hole in dense array");
        } else {
            if (!guardElemOp(obj, obj_ins, id, offsetof(JSObjectOps, getProperty), &v))
                return false;
        }
        LIns* args[] = { idx_ins, obj_ins, cx_ins };
        v_ins = lir->insCall(&js_Any_getprop_ci, args);
        guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_ERROR_COOKIE)), MISMATCH_EXIT);
        if (!unbox_jsval(v, v_ins))
            ABORT_TRACE("JSOP_GETELEM");
        set(&lval, v_ins);
        return true;
    }

    /* At this point we expect a whole number or we bail. */
    if (!JSVAL_IS_INT(idx))
        ABORT_TRACE("non-string, non-int JSOP_GETELEM index");
    if (JSVAL_TO_INT(idx) < 0)
        ABORT_TRACE("negative JSOP_GETELEM index");

    /* Accessing an object using integer index but not a dense array. */
    if (!OBJ_IS_DENSE_ARRAY(cx, obj)) {
        idx_ins = makeNumberInt32(idx_ins);
        LIns* args[] = { idx_ins, obj_ins, cx_ins };
        if (!js_IndexToId(cx, JSVAL_TO_INT(idx), &id))
            return false;
        idx = ID_TO_VALUE(id);
        if (!guardElemOp(obj, obj_ins, id, offsetof(JSObjectOps, getProperty), &v))
            return false;
        LIns* v_ins = lir->insCall(&js_Any_getelem_ci, args);
        guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_ERROR_COOKIE)), MISMATCH_EXIT);
        if (!unbox_jsval(v, v_ins))
            ABORT_TRACE("JSOP_GETELEM");
        set(&lval, v_ins);
        return true;
    }

    jsval* vp;
    LIns* addr_ins;
    if (!elem(lval, idx, vp, v_ins, addr_ins))
        return false;
    set(&lval, v_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_SETELEM()
{
    jsval& v = stackval(-1);
    jsval& idx = stackval(-2);
    jsval& lval = stackval(-3);

    /* no guards for type checks, trace specialized this already */
    if (JSVAL_IS_PRIMITIVE(lval))
        ABORT_TRACE("left JSOP_SETELEM operand is not an object");

    JSObject* obj = JSVAL_TO_OBJECT(lval);
    LIns* obj_ins = get(&lval);
    LIns* idx_ins = get(&idx);
    LIns* v_ins = get(&v);
    jsid id;

    LIns* boxed_v_ins = v_ins;
    if (!box_jsval(v, boxed_v_ins))
        ABORT_TRACE("boxing JSOP_SETELEM value");

    if (JSVAL_IS_STRING(idx)) {
        if (!js_ValueToStringId(cx, idx, &id))
            return false;
        // Store the interned string to the stack to save the interpreter from redoing this work.
        idx = ID_TO_VALUE(id);
        if (!guardElemOp(obj, obj_ins, id, offsetof(JSObjectOps, setProperty), NULL))
            return false;
        LIns* args[] = { boxed_v_ins, idx_ins, obj_ins, cx_ins };
        LIns* ok_ins = lir->insCall(&js_Any_setprop_ci, args);
        guard(false, lir->ins_eq0(ok_ins), MISMATCH_EXIT);    
    } else if (JSVAL_IS_INT(idx)) {
        if (JSVAL_TO_INT(idx) < 0)
            ABORT_TRACE("negative JSOP_SETELEM index");
        idx_ins = makeNumberInt32(idx_ins);
        LIns* args[] = { boxed_v_ins, idx_ins, obj_ins, cx_ins };
        LIns* res_ins;
        if (guardDenseArray(obj, obj_ins, BRANCH_EXIT)) {
            res_ins = lir->insCall(&js_Array_dense_setelem_ci, args);
        } else {
            if (!js_IndexToId(cx, JSVAL_TO_INT(idx), &id))
                return false;
            idx = ID_TO_VALUE(id);
            if (!guardElemOp(obj, obj_ins, id, offsetof(JSObjectOps, setProperty), NULL))
                return false;
            res_ins = lir->insCall(&js_Any_setelem_ci, args);
        }
        guard(false, lir->ins_eq0(res_ins), MISMATCH_EXIT);
    } else {
        ABORT_TRACE("non-string, non-int JSOP_SETELEM index");
    }

    jsbytecode* pc = cx->fp->regs->pc;
    if (*pc == JSOP_SETELEM && pc[JSOP_SETELEM_LENGTH] != JSOP_POP)
        set(&lval, v_ins);

    return true;
}

bool
TraceRecorder::record_JSOP_CALLNAME()
{
    JSObject* obj = cx->fp->scopeChain;
    if (obj != globalObj) {
        jsval* vp;
        if (!activeCallOrGlobalSlot(obj, vp))
            return false;
        stack(0, get(vp));
        stack(1, INS_CONSTPTR(globalObj));
        return true;
    }

    LIns* obj_ins = scopeChain();
    JSObject* obj2;
    jsuword pcval;
    if (!test_property_cache(obj, obj_ins, obj2, pcval))
        return false;

    if (PCVAL_IS_NULL(pcval) || !PCVAL_IS_OBJECT(pcval))
        ABORT_TRACE("callee is not an object");
    JS_ASSERT(HAS_FUNCTION_CLASS(PCVAL_TO_OBJECT(pcval)));

    stack(0, INS_CONSTPTR(PCVAL_TO_OBJECT(pcval)));
    stack(1, obj_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_GETUPVAR()
{
    ABORT_TRACE("GETUPVAR");
}

bool
TraceRecorder::record_JSOP_CALLUPVAR()
{
    ABORT_TRACE("CALLUPVAR");
}

bool
TraceRecorder::guardShapelessCallee(jsval& callee)
{
    guard(true,
          addName(lir->ins2(LIR_eq, get(&callee), INS_CONSTPTR(JSVAL_TO_OBJECT(callee))),
                  "guard(shapeless callee)"),
          MISMATCH_EXIT);
    return true;
}

bool
TraceRecorder::interpretedFunctionCall(jsval& fval, JSFunction* fun, uintN argc, bool constructing)
{
    if (JS_GetGlobalForObject(cx, JSVAL_TO_OBJECT(fval)) != globalObj)
        ABORT_TRACE("JSOP_CALL or JSOP_NEW crosses global scopes");

    JSStackFrame* fp = cx->fp;

    // TODO: track the copying via the tracker...
    if (argc < fun->nargs &&
        jsuword(fp->regs->sp + (fun->nargs - argc)) > cx->stackPool.current->limit) {
        ABORT_TRACE("can't trace calls with too few args requiring argv move");
    }

    // Generate a type map for the outgoing frame and stash it in the LIR
    unsigned stackSlots = js_NativeStackSlots(cx, 0/*callDepth*/);
    LIns* data = lir_buf_writer->skip(stackSlots * sizeof(uint8));
    uint8* typemap = (uint8 *)data->payload();
    uint8* m = typemap;
    /* Determine the type of a store by looking at the current type of the actual value the
       interpreter is using. For numbers we have to check what kind of store we used last
       (integer or double) to figure out what the side exit show reflect in its typemap. */
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0/*callDepth*/,
        *m++ = determineSlotType(vp);
    );

    if (argc >= 0x8000)
        ABORT_TRACE("too many arguments");

    FrameInfo fi = {
        JSVAL_TO_OBJECT(fval),
        ENCODE_IP_ADJ(fp, fp->regs->pc),
        typemap,
        { { fp->regs->sp - fp->slots, argc | (constructing ? 0x8000 : 0) } }
    };

    unsigned callDepth = getCallDepth();
    if (callDepth >= treeInfo->maxCallDepth)
        treeInfo->maxCallDepth = callDepth + 1;

    lir->insStorei(INS_CONSTPTR(fi.callee), lirbuf->rp,
                   callDepth * sizeof(FrameInfo) + offsetof(FrameInfo, callee));
    lir->insStorei(INS_CONSTPTR(fi.ip_adj), lirbuf->rp,
                   callDepth * sizeof(FrameInfo) + offsetof(FrameInfo, ip_adj));
    lir->insStorei(INS_CONSTPTR(fi.typemap), lirbuf->rp,
                   callDepth * sizeof(FrameInfo) + offsetof(FrameInfo, typemap));
    lir->insStorei(INS_CONST(fi.word), lirbuf->rp,
                   callDepth * sizeof(FrameInfo) + offsetof(FrameInfo, word));

    atoms = fun->u.i.script->atomMap.vector;
    return true;
}

bool
TraceRecorder::record_JSOP_CALL()
{
    return functionCall(false);
}

bool
TraceRecorder::record_JSOP_APPLY()
{
    return functionCall(false);
}

bool
TraceRecorder::record_FastNativeCallComplete()
{
    JS_ASSERT(pendingTraceableNative);
    
    /* At this point the generated code has already called the native function
       and we can no longer fail back to the original pc location (JSOP_CALL)
       because that would cause the interpreter to re-execute the native 
       function, which might have side effects.

       Instead, snapshot(), which is invoked from unbox_jsval(), will see that
       we are currently parked on a traceable native's JSOP_CALL instruction,
       and it will advance the pc to restore by the length of the current
       opcode, and indicate in the type map that the element on top of the
       stack is a boxed value which doesn't need to be boxed if the type guard
       generated by unbox_jsval() fails. */
    JS_ASSERT(*cx->fp->regs->pc == JSOP_CALL || 
              *cx->fp->regs->pc == JSOP_APPLY);

    jsval& v = stackval(-1);
    LIns* v_ins = get(&v);
    
    bool ok = true;
    switch (JSTN_ERRTYPE(pendingTraceableNative)) {
      case FAIL_JSVAL:
        ok = unbox_jsval(v, v_ins);
        if (ok)
            set(&v, v_ins);
        break;
      case FAIL_NEG:
        /* Already added i2f in functionCall. */
        JS_ASSERT(JSVAL_IS_NUMBER(v));
        break;
      default:
        /* Convert the result to double if the builtin returns int32. */
        if (JSVAL_IS_NUMBER(v) &&
            (pendingTraceableNative->builtin->_argtypes & 3) == nanojit::ARGSIZE_LO) {
            set(&v, lir->ins1(LIR_i2f, v_ins));
        }
    }

    // We'll null pendingTraceableNative in js_MonitorRecording, on the next op cycle.
    // There must be a next op since the stack is non-empty.
    return ok;
}

bool
TraceRecorder::name(jsval*& vp)
{
    JSObject* obj = cx->fp->scopeChain;
    if (obj != globalObj)
        return activeCallOrGlobalSlot(obj, vp);

    /* Can't use prop here, because we don't want unboxing from global slots. */
    LIns* obj_ins = scopeChain();
    uint32 slot;
    if (!test_property_cache_direct_slot(obj, obj_ins, slot))
        return false;

    if (slot == SPROP_INVALID_SLOT)
        ABORT_TRACE("name op can't find named property");

    if (!lazilyImportGlobalSlot(slot))
        ABORT_TRACE("lazy import of global slot failed");

    vp = &STOBJ_GET_SLOT(obj, slot);
    return true;
}

bool
TraceRecorder::prop(JSObject* obj, LIns* obj_ins, uint32& slot, LIns*& v_ins)
{
    /*
     * Can't specialize to assert obj != global, must guard to avoid aliasing
     * stale homes of stacked global variables.
     */
    if (obj == globalObj)
        ABORT_TRACE("prop op aliases global");
    guard(false, lir->ins2(LIR_eq, obj_ins, INS_CONSTPTR(globalObj)), MISMATCH_EXIT);

    /*
     * Property cache ensures that we are dealing with an existing property,
     * and guards the shape for us.
     */
    JSObject* obj2;
    jsuword pcval;
    if (!test_property_cache(obj, obj_ins, obj2, pcval))
        return false;

    /* Check for non-existent property reference, which results in undefined. */
    const JSCodeSpec& cs = js_CodeSpec[*cx->fp->regs->pc];
    if (PCVAL_IS_NULL(pcval)) {
        v_ins = INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID));
        JS_ASSERT(cs.ndefs == 1);
        stack(-cs.nuses, v_ins);
        slot = SPROP_INVALID_SLOT;
        return true;
    }

    /* Insist if setting on obj being the directly addressed object. */
    uint32 setflags = (cs.format & (JOF_SET | JOF_INCDEC));
    LIns* dslots_ins = NULL;
    if (obj2 != obj) {
        if (setflags)
            ABORT_TRACE("JOF_SET opcode hit prototype chain");

        /*
         * We're getting a proto-property. Walk up the prototype chain emitting
         * proto slot loads, updating obj as we go, leaving obj set to obj2 with
         * obj_ins the last proto-load.
         */
        while (obj != obj2) {
            obj_ins = stobj_get_slot(obj_ins, JSSLOT_PROTO, dslots_ins);
            obj = STOBJ_GET_PROTO(obj);
        }
    }

    /* Don't trace getter or setter calls, our caller wants a direct slot. */
    if (PCVAL_IS_SPROP(pcval)) {
        JSScopeProperty* sprop = PCVAL_TO_SPROP(pcval);

        if (setflags && !SPROP_HAS_STUB_SETTER(sprop))
            ABORT_TRACE("non-stub setter");
        if (setflags != JOF_SET && !SPROP_HAS_STUB_GETTER(sprop)) {
            // FIXME 450335: generalize this away from regexp built-in getters.
            if (setflags == 0 &&
                sprop->getter == js_RegExpClass.getProperty &&
                sprop->shortid < 0) {
                if (sprop->shortid == REGEXP_LAST_INDEX)
                    ABORT_TRACE("can't trace regexp.lastIndex yet");
                LIns* args[] = { INS_CONSTPTR(sprop), obj_ins, cx_ins };
                v_ins = lir->insCall(&js_CallGetter_ci, args);
                guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_ERROR_COOKIE)), OOM_EXIT);
                if (!unbox_jsval((sprop->shortid == REGEXP_SOURCE) ? JSVAL_STRING : JSVAL_BOOLEAN,
                                 v_ins)) {
                    ABORT_TRACE("unboxing");
                }
                JS_ASSERT(cs.ndefs == 1);
                stack(-cs.nuses, v_ins);
                return true;
            }
            ABORT_TRACE("non-stub getter");
        }
        if (!SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(obj)))
            ABORT_TRACE("no valid slot");
        slot = sprop->slot;
    } else {
        if (!PCVAL_IS_SLOT(pcval))
            ABORT_TRACE("PCE is not a slot");
        slot = PCVAL_TO_SLOT(pcval);
    }

    v_ins = stobj_get_slot(obj_ins, slot, dslots_ins);
    if (!unbox_jsval(STOBJ_GET_SLOT(obj, slot), v_ins))
        ABORT_TRACE("unboxing");
    return true;
}

bool
TraceRecorder::elem(jsval& oval, jsval& idx, jsval*& vp, LIns*& v_ins, LIns*& addr_ins)
{
    /* no guards for type checks, trace specialized this already */
    if (JSVAL_IS_PRIMITIVE(oval) || !JSVAL_IS_INT(idx))
        return false;

    JSObject* obj = JSVAL_TO_OBJECT(oval);
    LIns* obj_ins = get(&oval);

    /* make sure the object is actually a dense array */
    if (!guardDenseArray(obj, obj_ins))
        return false;

    /* check that the index is within bounds */
    jsint i = JSVAL_TO_INT(idx);
    LIns* idx_ins = makeNumberInt32(get(&idx));

    LIns* dslots_ins = lir->insLoad(LIR_ldp, obj_ins, offsetof(JSObject, dslots));
    if (!guardDenseArrayIndex(obj, i, obj_ins, dslots_ins, idx_ins, BRANCH_EXIT)) {
        LIns* rt_ins = lir->insLoad(LIR_ldp, cx_ins, offsetof(JSContext, runtime));
        guard(true, 
              lir->ins_eq0(lir->insLoad(LIR_ldp, rt_ins,
                                        offsetof(JSRuntime, anyArrayProtoHasElement))),
              MISMATCH_EXIT);
        // Return undefined and indicate that we didn't actually read this (addr_ins).
        v_ins = lir->insImm(JSVAL_TO_BOOLEAN(JSVAL_VOID));
        addr_ins = NULL; 
        return true;
    }

    // We can't "see through" a hole to a possible Array.prototype property, so
    // we abort here and guard below (after unboxing).
    vp = &obj->dslots[i];
    if (*vp == JSVAL_HOLE)
        ABORT_TRACE("can't see through hole in dense array");

    addr_ins = lir->ins2(LIR_piadd, dslots_ins,
                         lir->ins2i(LIR_pilsh, idx_ins, (sizeof(jsval) == 4) ? 2 : 3));

    /* Load the value and guard on its type to unbox it. */
    v_ins = lir->insLoad(LIR_ldp, addr_ins, 0);
    if (!unbox_jsval(*vp, v_ins))
        return false;

    if (JSVAL_TAG(*vp) == JSVAL_BOOLEAN) {
        // Optimize to guard for a hole only after untagging, so we know that
        // we have a boolean, to avoid an extra guard for non-boolean values.
        guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_HOLE))),
              MISMATCH_EXIT);
    }
    return true;
}

bool
TraceRecorder::getProp(JSObject* obj, LIns* obj_ins)
{
    uint32 slot;
    LIns* v_ins;
    if (!prop(obj, obj_ins, slot, v_ins))
        return false;

    const JSCodeSpec& cs = js_CodeSpec[*cx->fp->regs->pc];
    JS_ASSERT(cs.ndefs == 1);
    stack(-cs.nuses, v_ins);
    return true;
}

bool
TraceRecorder::getProp(jsval& v)
{
    if (JSVAL_IS_PRIMITIVE(v))
        ABORT_TRACE("primitive lhs");

    return getProp(JSVAL_TO_OBJECT(v), get(&v));
}

bool
TraceRecorder::record_JSOP_NAME()
{
    jsval* vp;
    if (!name(vp))
        return false;
    stack(0, get(vp));
    return true;
}

bool
TraceRecorder::record_JSOP_DOUBLE()
{
    jsval v = jsval(atoms[GET_INDEX(cx->fp->regs->pc)]);
    jsdpun u;
    u.d = *JSVAL_TO_DOUBLE(v);
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_STRING()
{
    JSAtom* atom = atoms[GET_INDEX(cx->fp->regs->pc)];
    JS_ASSERT(ATOM_IS_STRING(atom));
    stack(0, INS_CONSTPTR(ATOM_TO_STRING(atom)));
    return true;
}

bool
TraceRecorder::record_JSOP_ZERO()
{
    jsdpun u;
    u.d = 0.0;
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_ONE()
{
    jsdpun u;
    u.d = 1.0;
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_NULL()
{
    stack(0, INS_CONSTPTR(NULL));
    return true;
}

bool
TraceRecorder::record_JSOP_THIS()
{
    LIns* this_ins;
    if (!getThis(this_ins))
        return false;
    stack(0, this_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_FALSE()
{
    stack(0, lir->insImm(0));
    return true;
}

bool
TraceRecorder::record_JSOP_TRUE()
{
    stack(0, lir->insImm(1));
    return true;
}

bool
TraceRecorder::record_JSOP_OR()
{
    return ifop();
}

bool
TraceRecorder::record_JSOP_AND()
{
    return ifop();
}

bool
TraceRecorder::record_JSOP_TABLESWITCH()
{
    return switchop();
}

bool
TraceRecorder::record_JSOP_LOOKUPSWITCH()
{
    return switchop();
}

bool
TraceRecorder::record_JSOP_STRICTEQ()
{
    return cmp(LIR_feq, CMP_STRICT);
}

bool
TraceRecorder::record_JSOP_STRICTNE()
{
    return cmp(LIR_feq, CMP_STRICT | CMP_NEGATE);
}

bool
TraceRecorder::record_JSOP_OBJECT()
{
    JSStackFrame* fp = cx->fp;
    JSScript* script = fp->script;
    unsigned index = atoms - script->atomMap.vector + GET_INDEX(fp->regs->pc);

    JSObject* obj;
    JS_GET_SCRIPT_OBJECT(script, index, obj);
    stack(0, INS_CONSTPTR(obj));
    return true;
}

bool
TraceRecorder::record_JSOP_POP()
{
    return true;
}

bool
TraceRecorder::record_JSOP_POS()
{
    jsval& r = stackval(-1);
    return isNumber(r);
}

bool
TraceRecorder::record_JSOP_TRAP()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GETARG()
{
    stack(0, arg(GET_ARGNO(cx->fp->regs->pc)));
    return true;
}

bool
TraceRecorder::record_JSOP_SETARG()
{
    arg(GET_ARGNO(cx->fp->regs->pc), stack(-1));
    return true;
}

bool
TraceRecorder::record_JSOP_GETLOCAL()
{
    stack(0, var(GET_SLOTNO(cx->fp->regs->pc)));
    return true;
}

bool
TraceRecorder::record_JSOP_SETLOCAL()
{
    var(GET_SLOTNO(cx->fp->regs->pc), stack(-1));
    return true;
}

bool
TraceRecorder::record_JSOP_UINT16()
{
    jsdpun u;
    u.d = (jsdouble)GET_UINT16(cx->fp->regs->pc);
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_NEWINIT()
{
    JSProtoKey key = JSProtoKey(GET_INT8(cx->fp->regs->pc));
    JSObject* obj;
    const CallInfo *ci;
    if (key == JSProto_Array) {
        if (!js_GetClassPrototype(cx, globalObj, INT_TO_JSID(key), &obj))
            return false;
        ci = &js_FastNewArray_ci;
    } else {
        jsval v_obj;
        if (!js_FindClassObject(cx, globalObj, INT_TO_JSID(key), &v_obj))
            return false;
        if (JSVAL_IS_PRIMITIVE(v_obj))
            ABORT_TRACE("primitive Object value");
        obj = JSVAL_TO_OBJECT(v_obj);
        ci = &js_FastNewObject_ci;
    }
    LIns* args[] = { INS_CONSTPTR(obj), cx_ins };
    LIns* v_ins = lir->insCall(ci, args);
    guard(false, lir->ins_eq0(v_ins), OOM_EXIT);
    stack(0, v_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_ENDINIT()
{
    jsval& v = stackval(-1);
    JS_ASSERT(!JSVAL_IS_PRIMITIVE(v));
    JSObject* obj = JSVAL_TO_OBJECT(v);
    if (OBJ_IS_DENSE_ARRAY(cx, obj)) {
        // Until we get JSOP_NEWARRAY working, we do our optimizing here...
        if (obj->fslots[JSSLOT_ARRAY_LENGTH] == 1 &&
            obj->dslots && JSVAL_IS_STRING(obj->dslots[0])) {
            LIns* v_ins = get(&v);
            JS_ASSERT(v_ins->isCall() && v_ins->callInfo() == &js_FastNewArray_ci);
            LIns* args[] = { stack(1), callArgN(v_ins, 1), cx_ins };
            v_ins = lir->insCall(&js_Array_1str_ci, args);
            set(&v, v_ins);
        }
    }
    return true;
}

bool
TraceRecorder::record_JSOP_INITPROP()
{
    // All the action is in record_SetPropHit.
    return true;
}

bool
TraceRecorder::record_JSOP_INITELEM()
{
    return record_JSOP_SETELEM();
}

bool
TraceRecorder::record_JSOP_DEFSHARP()
{
    return false;
}

bool
TraceRecorder::record_JSOP_USESHARP()
{
    return false;
}

bool
TraceRecorder::record_JSOP_INCARG()
{
    return inc(argval(GET_ARGNO(cx->fp->regs->pc)), 1);
}

bool
TraceRecorder::record_JSOP_INCLOCAL()
{
    return inc(varval(GET_SLOTNO(cx->fp->regs->pc)), 1);
}

bool
TraceRecorder::record_JSOP_DECARG()
{
    return inc(argval(GET_ARGNO(cx->fp->regs->pc)), -1);
}

bool
TraceRecorder::record_JSOP_DECLOCAL()
{
    return inc(varval(GET_SLOTNO(cx->fp->regs->pc)), -1);
}

bool
TraceRecorder::record_JSOP_ARGINC()
{
    return inc(argval(GET_ARGNO(cx->fp->regs->pc)), 1, false);
}

bool
TraceRecorder::record_JSOP_LOCALINC()
{
    return inc(varval(GET_SLOTNO(cx->fp->regs->pc)), 1, false);
}

bool
TraceRecorder::record_JSOP_ARGDEC()
{
    return inc(argval(GET_ARGNO(cx->fp->regs->pc)), -1, false);
}

bool
TraceRecorder::record_JSOP_LOCALDEC()
{
    return inc(varval(GET_SLOTNO(cx->fp->regs->pc)), -1, false);
}

bool
TraceRecorder::record_JSOP_IMACOP()
{
    JS_ASSERT(cx->fp->imacpc);
    return true;
}

static struct {
    jsbytecode for_in[10];
    jsbytecode for_each[10];
} iter_imacros = {
    {
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(iterator),
        JSOP_INT8, JSITER_ENUMERATE,
        JSOP_CALL, 0, 1,
        JSOP_PUSH,
        JSOP_STOP
    },

    {
        JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(iterator),
        JSOP_INT8, JSITER_ENUMERATE | JSITER_FOREACH,
        JSOP_CALL, 0, 1,
        JSOP_PUSH,
        JSOP_STOP
    }
};

JS_STATIC_ASSERT(sizeof(iter_imacros) < IMACRO_PC_ADJ_LIMIT);

bool
TraceRecorder::record_JSOP_ITER()
{
    jsval& v = stackval(-1);
    if (!JSVAL_IS_PRIMITIVE(v)) {
        jsuint flags = cx->fp->regs->pc[1];

        if (!hasIteratorMethod(v)) {
            LIns* args[] = { get(&v), INS_CONST(flags), cx_ins };
            LIns* v_ins = lir->insCall(&js_FastValueToIterator_ci, args);
            guard(false, lir->ins_eq0(v_ins), MISMATCH_EXIT);
            set(&v, v_ins);

            LIns* void_ins = INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID));
            stack(0, void_ins);
            return true;
        }

        if (flags == JSITER_ENUMERATE)
            return call_imacro(iter_imacros.for_in);
        if (flags == (JSITER_ENUMERATE | JSITER_FOREACH))
            return call_imacro(iter_imacros.for_each);
        ABORT_TRACE("unimplemented JSITER_* flags");
    }

    ABORT_TRACE("for-in on a primitive value");
}

static JSTraceableNative js_FastCallIteratorNext_tn = {
    NULL,                               // JSFastNative            native;
    &js_FastCallIteratorNext_ci,        // const nanojit::CallInfo *builtin;
    "C",                                // const char              *prefix;
    "o",                                // const char              *argtypes;
    FAIL_JSVAL                          // uintN                   flags;
};

static jsbytecode nextiter_imacro[] = {
    JSOP_POP,
    JSOP_DUP,
    JSOP_CALLPROP, 0, COMMON_ATOM_INDEX(next),
    JSOP_CALL, 0, 0,
    JSOP_TRUE,
    JSOP_STOP
};

JS_STATIC_ASSERT(sizeof(nextiter_imacro) < IMACRO_PC_ADJ_LIMIT);

bool
TraceRecorder::record_JSOP_NEXTITER()
{
    jsval& iterobj_val = stackval(-2);
    if (!JSVAL_IS_PRIMITIVE(iterobj_val)) {
        LIns* iterobj_ins = get(&iterobj_val);

        if (guardClass(JSVAL_TO_OBJECT(iterobj_val), iterobj_ins, &js_IteratorClass, BRANCH_EXIT)) {
            LIns* args[] = { iterobj_ins, cx_ins };
            LIns* v_ins = lir->insCall(&js_FastCallIteratorNext_ci, args);
            guard(false, lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_ERROR_COOKIE)), OOM_EXIT);

            LIns* flag_ins = lir->ins_eq0(lir->ins2(LIR_eq, v_ins, INS_CONST(JSVAL_HOLE)));
            stack(-1, v_ins);
            stack(0, flag_ins);

            pendingTraceableNative = &js_FastCallIteratorNext_tn;
            return true;
        }

        // Custom iterator, possibly a generator.
        return call_imacro(nextiter_imacro);
    }

    ABORT_TRACE("for-in on a primitive value");
}

bool
TraceRecorder::record_IteratorNextComplete()
{
    JS_ASSERT(*cx->fp->regs->pc == JSOP_NEXTITER);
    JS_ASSERT(pendingTraceableNative == &js_FastCallIteratorNext_tn);

    jsval& v = stackval(-2);
    LIns* v_ins = get(&v);
    if (unbox_jsval(v, v_ins)) {
        set(&v, v_ins);
        return true;
    }
    return false;
}

bool
TraceRecorder::record_JSOP_ENDITER()
{
    LIns* args[] = { stack(-2), cx_ins };
    LIns* ok_ins = lir->insCall(&js_CloseIterator_ci, args);
    guard(false, lir->ins_eq0(ok_ins), MISMATCH_EXIT);
    return true;
}

bool
TraceRecorder::record_JSOP_FORNAME()
{
    jsval* vp;
    if (name(vp)) {
        set(vp, stack(-1));
        return true;
    }
    return false;
}

bool
TraceRecorder::record_JSOP_FORPROP()
{
    return false;
}

bool
TraceRecorder::record_JSOP_FORELEM()
{
    return record_JSOP_DUP();
}

bool
TraceRecorder::record_JSOP_FORARG()
{
    return record_JSOP_SETARG();
}

bool
TraceRecorder::record_JSOP_FORLOCAL()
{
    return record_JSOP_SETLOCAL();
}

bool
TraceRecorder::record_JSOP_POPN()
{
    return true;
}

bool
TraceRecorder::record_JSOP_BINDNAME()
{
    JSObject* obj = cx->fp->scopeChain;
    if (obj != globalObj)
        ABORT_TRACE("JSOP_BINDNAME crosses global scopes");

    LIns* obj_ins = scopeChain();
    JSObject* obj2;
    jsuword pcval;
    if (!test_property_cache(obj, obj_ins, obj2, pcval))
        return false;
    if (obj2 != obj)
        ABORT_TRACE("JSOP_BINDNAME found a non-direct property on the global object");

    stack(0, obj_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_SETNAME()
{
    jsval& l = stackval(-2);
    JS_ASSERT(!JSVAL_IS_PRIMITIVE(l));

    /*
     * Trace cases that are global code or in lightweight functions scoped by
     * the global object only.
     */
    JSObject* obj = JSVAL_TO_OBJECT(l);
    if (obj != cx->fp->scopeChain || obj != globalObj)
        ABORT_TRACE("JSOP_SETNAME left operand is not the global object");

    // The rest of the work is in record_SetPropHit.
    return true;
}

bool
TraceRecorder::record_JSOP_THROW()
{
    return false;
}

bool
TraceRecorder::record_JSOP_IN()
{
    jsval& rval = stackval(-1);
    jsval& lval = stackval(-2);

    if (JSVAL_IS_PRIMITIVE(rval))
        ABORT_TRACE("JSOP_IN on non-object right operand");
    JSObject* obj = JSVAL_TO_OBJECT(rval);
    LIns* obj_ins = get(&rval);

    jsid id;
    LIns* x;
    if (JSVAL_IS_INT(lval)) {
        id = INT_JSVAL_TO_JSID(lval);
        LIns* args[] = { makeNumberInt32(get(&lval)), obj_ins, cx_ins };
        x = lir->insCall(&js_HasNamedPropertyInt32_ci, args);
    } else if (JSVAL_IS_STRING(lval)) {
        if (!js_ValueToStringId(cx, lval, &id))
            ABORT_TRACE("left operand of JSOP_IN didn't convert to a string-id");
        LIns* args[] = { get(&lval), obj_ins, cx_ins };
        x = lir->insCall(&js_HasNamedProperty_ci, args);
    } else {
        ABORT_TRACE("string or integer expected");
    }        

    guard(false, lir->ins2i(LIR_eq, x, JSVAL_TO_BOOLEAN(JSVAL_VOID)), OOM_EXIT);
    x = lir->ins2i(LIR_eq, x, 1);

    JSObject* obj2;
    JSProperty* prop;
    if (!OBJ_LOOKUP_PROPERTY(cx, obj, id, &obj2, &prop))
        ABORT_TRACE("OBJ_LOOKUP_PROPERTY failed in JSOP_IN");
    bool cond = prop != NULL;
    if (prop)
        OBJ_DROP_PROPERTY(cx, obj2, prop);
    
    /* The interpreter fuses comparisons and the following branch,
       so we have to do that here as well. */
    fuseIf(cx->fp->regs->pc + 1, cond, x);

    /* We update the stack after the guard. This is safe since
       the guard bails out at the comparison and the interpreter
       will therefore re-execute the comparison. This way the
       value of the condition doesn't have to be calculated and
       saved on the stack in most cases. */
    set(&lval, x);
    return true;
}

bool
TraceRecorder::record_JSOP_INSTANCEOF()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DEBUGGER()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GOSUB()
{
    return false;
}

bool
TraceRecorder::record_JSOP_RETSUB()
{
    return false;
}

bool
TraceRecorder::record_JSOP_EXCEPTION()
{
    return false;
}

bool
TraceRecorder::record_JSOP_LINENO()
{
    return true;
}

bool
TraceRecorder::record_JSOP_CONDSWITCH()
{
    return true;
}

bool
TraceRecorder::record_JSOP_CASE()
{
    return cmp(LIR_feq, CMP_CASE);
}

bool
TraceRecorder::record_JSOP_DEFAULT()
{
    return true;
}

bool
TraceRecorder::record_JSOP_EVAL()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ENUMELEM()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GETTER()
{
    return false;
}

bool
TraceRecorder::record_JSOP_SETTER()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DEFFUN()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DEFCONST()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DEFVAR()
{
    return false;
}

/*
 * XXX could hoist out to jsinterp.h and share with jsinterp.cpp, but
 * XXX jsopcode.cpp has different definitions of same-named macros.
 */
#define GET_FULL_INDEX(PCOFF)                                                 \
    (atoms - script->atomMap.vector + GET_INDEX(regs.pc + PCOFF))

#define LOAD_FUNCTION(PCOFF)                                                  \
    JS_GET_SCRIPT_FUNCTION(script, GET_FULL_INDEX(PCOFF), fun)

bool
TraceRecorder::record_JSOP_ANONFUNOBJ()
{
    JSFunction* fun;
    JSFrameRegs& regs = *cx->fp->regs;
    JSScript* script = cx->fp->script;
    LOAD_FUNCTION(0); // needs script, regs, fun

    JSObject* obj = FUN_OBJECT(fun);
    if (OBJ_GET_PARENT(cx, obj) != cx->fp->scopeChain)
        ABORT_TRACE("can't trace with activation object on scopeChain");

    stack(0, INS_CONSTPTR(obj));
    return true;
}

bool
TraceRecorder::record_JSOP_NAMEDFUNOBJ()
{
    return false;
}

bool
TraceRecorder::record_JSOP_SETLOCALPOP()
{
    var(GET_SLOTNO(cx->fp->regs->pc), stack(-1));
    return true;
}

bool
TraceRecorder::record_JSOP_SETCALL()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TRY()
{
    return true;
}

bool
TraceRecorder::record_JSOP_FINALLY()
{
    return true;
}

bool
TraceRecorder::record_JSOP_NOP()
{
    return true;
}

bool
TraceRecorder::record_JSOP_ARGSUB()
{
    JSStackFrame* fp = cx->fp;
    if (!(fp->fun->flags & JSFUN_HEAVYWEIGHT)) {
        uintN slot = GET_ARGNO(fp->regs->pc);
        if (slot < fp->fun->nargs && slot < fp->argc && !fp->argsobj) {
            stack(0, get(&cx->fp->argv[slot]));
            return true;
        }
    }
    ABORT_TRACE("can't trace JSOP_ARGSUB hard case");
}

bool
TraceRecorder::record_JSOP_ARGCNT()
{
    if (!(cx->fp->fun->flags & JSFUN_HEAVYWEIGHT)) {
        jsdpun u;
        u.d = cx->fp->argc;
        stack(0, lir->insImmq(u.u64));
        return true;
    }
    ABORT_TRACE("can't trace heavyweight JSOP_ARGCNT");
}

bool
TraceRecorder::record_DefLocalFunSetSlot(uint32 slot, JSObject* obj)
{
    var(slot, INS_CONSTPTR(obj));
    return true;
}

bool
TraceRecorder::record_JSOP_DEFLOCALFUN()
{
    return true;
}

bool
TraceRecorder::record_JSOP_GOTOX()
{
    return true;
}

bool
TraceRecorder::record_JSOP_IFEQX()
{
    trackCfgMerges(cx->fp->regs->pc);
    return record_JSOP_IFEQ();
}

bool
TraceRecorder::record_JSOP_IFNEX()
{
    return record_JSOP_IFNE();
}

bool
TraceRecorder::record_JSOP_ORX()
{
    return record_JSOP_OR();
}

bool
TraceRecorder::record_JSOP_ANDX()
{
    return record_JSOP_AND();
}

bool
TraceRecorder::record_JSOP_GOSUBX()
{
    return record_JSOP_GOSUB();
}

bool
TraceRecorder::record_JSOP_CASEX()
{
    return cmp(LIR_feq, CMP_CASE);
}

bool
TraceRecorder::record_JSOP_DEFAULTX()
{
    return true;
}

bool
TraceRecorder::record_JSOP_TABLESWITCHX()
{
    return switchop();
}

bool
TraceRecorder::record_JSOP_LOOKUPSWITCHX()
{
    return switchop();
}

bool
TraceRecorder::record_JSOP_BACKPATCH()
{
    return true;
}

bool
TraceRecorder::record_JSOP_BACKPATCH_POP()
{
    return true;
}

bool
TraceRecorder::record_JSOP_THROWING()
{
    return false;
}

bool
TraceRecorder::record_JSOP_SETRVAL()
{
    // If we implement this, we need to update JSOP_STOP.
    return false;
}

bool
TraceRecorder::record_JSOP_RETRVAL()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GETGVAR()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_NAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    stack(0, get(&STOBJ_GET_SLOT(globalObj, slot)));
    return true;
}

bool
TraceRecorder::record_JSOP_SETGVAR()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_NAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    set(&STOBJ_GET_SLOT(globalObj, slot), stack(-1));
    return true;
}

bool
TraceRecorder::record_JSOP_INCGVAR()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_INCNAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    return inc(STOBJ_GET_SLOT(globalObj, slot), 1);
}

bool
TraceRecorder::record_JSOP_DECGVAR()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_INCNAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    return inc(STOBJ_GET_SLOT(globalObj, slot), -1);
}

bool
TraceRecorder::record_JSOP_GVARINC()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_INCNAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    return inc(STOBJ_GET_SLOT(globalObj, slot), 1, false);
}

bool
TraceRecorder::record_JSOP_GVARDEC()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_INCNAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    return inc(STOBJ_GET_SLOT(globalObj, slot), -1, false);
}

bool
TraceRecorder::record_JSOP_REGEXP()
{
    return false;
}

// begin JS_HAS_XML_SUPPORT

bool
TraceRecorder::record_JSOP_DEFXMLNS()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ANYNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_QNAMEPART()
{
    return false;
}

bool
TraceRecorder::record_JSOP_QNAMECONST()
{
    return false;
}

bool
TraceRecorder::record_JSOP_QNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TOATTRNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TOATTRVAL()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ADDATTRNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ADDATTRVAL()
{
    return false;
}

bool
TraceRecorder::record_JSOP_BINDXMLNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_SETXMLNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_DESCENDANTS()
{
    return false;
}

bool
TraceRecorder::record_JSOP_FILTER()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ENDFILTER()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TOXML()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TOXMLLIST()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLTAGEXPR()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLELTEXPR()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLOBJECT()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLCDATA()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLCOMMENT()
{
    return false;
}

bool
TraceRecorder::record_JSOP_XMLPI()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GETFUNNS()
{
    return false;
}

bool
TraceRecorder::record_JSOP_STARTXML()
{
    return false;
}

bool
TraceRecorder::record_JSOP_STARTXMLEXPR()
{
    return false;
}

// end JS_HAS_XML_SUPPORT

bool
TraceRecorder::record_JSOP_CALLPROP()
{
    jsval& l = stackval(-1);
    JSObject* obj;
    LIns* obj_ins;
    LIns* this_ins;
    if (!JSVAL_IS_PRIMITIVE(l)) {
        obj = JSVAL_TO_OBJECT(l);
        obj_ins = get(&l);
        this_ins = obj_ins; // |this| for subsequent call
        if (JSVAL_IS_NULL(l))
            ABORT_TRACE("callprop on null");
        if (!this_ins->isconstp())
            guard(false, lir->ins_eq0(this_ins), MISMATCH_EXIT);
    } else {
        jsint i;
        debug_only(const char* protoname = NULL;)
        if (JSVAL_IS_STRING(l)) {
            i = JSProto_String;
            debug_only(protoname = "String.prototype";)
        } else if (JSVAL_IS_NUMBER(l)) {
            i = JSProto_Number;
            debug_only(protoname = "Number.prototype";)
        } else if (JSVAL_TAG(l) == JSVAL_BOOLEAN) {
            if (l == JSVAL_VOID)
                ABORT_TRACE("callprop on void");
            guard(false, lir->ins2i(LIR_eq, get(&l), JSVAL_TO_BOOLEAN(JSVAL_VOID)), MISMATCH_EXIT);
            i = JSProto_Boolean;
            debug_only(protoname = "Boolean.prototype";)
        } else {
            JS_ASSERT(JSVAL_IS_NULL(l) || JSVAL_IS_VOID(l));
            ABORT_TRACE("callprop on null or void");
        }

        if (!js_GetClassPrototype(cx, NULL, INT_TO_JSID(i), &obj))
            ABORT_TRACE("GetClassPrototype failed!");

        obj_ins = INS_CONSTPTR(obj);
        debug_only(obj_ins = addName(obj_ins, protoname);)
        this_ins = get(&l); // use primitive as |this|
    }

    JSObject* obj2;
    jsuword pcval;
    if (!test_property_cache(obj, obj_ins, obj2, pcval))
        return false;

    if (PCVAL_IS_NULL(pcval) || !PCVAL_IS_OBJECT(pcval))
        ABORT_TRACE("callee is not an object");
    JS_ASSERT(HAS_FUNCTION_CLASS(PCVAL_TO_OBJECT(pcval)));

    if (JSVAL_IS_PRIMITIVE(l)) {
        JSFunction* fun = GET_FUNCTION_PRIVATE(cx, PCVAL_TO_OBJECT(pcval));
        if (!PRIMITIVE_THIS_TEST(fun, l))
            ABORT_TRACE("callee does not accept primitive |this|");
    }

    stack(0, this_ins);
    stack(-1, INS_CONSTPTR(PCVAL_TO_OBJECT(pcval)));
    return true;
}

bool
TraceRecorder::record_JSOP_DELDESC()
{
    return false;
}

bool
TraceRecorder::record_JSOP_UINT24()
{
    jsdpun u;
    u.d = (jsdouble)GET_UINT24(cx->fp->regs->pc);
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_INDEXBASE()
{
    atoms += GET_INDEXBASE(cx->fp->regs->pc);
    return true;
}

bool
TraceRecorder::record_JSOP_RESETBASE()
{
    atoms = cx->fp->script->atomMap.vector;
    return true;
}

bool
TraceRecorder::record_JSOP_RESETBASE0()
{
    atoms = cx->fp->script->atomMap.vector;
    return true;
}

bool
TraceRecorder::record_JSOP_CALLELEM()
{
    return false;
}

bool
TraceRecorder::record_JSOP_STOP()
{
    JSStackFrame *fp = cx->fp;

    if (fp->imacpc) {
        // End of imacro, so return true to the interpreter immediately. The
        // interpreter's JSOP_STOP case will return from the imacro, back to
        // the pc after the calling op, still in the same JSStackFrame.
        atoms = fp->script->atomMap.vector;
        return true;
    }

    /*
     * We know falling off the end of a constructor returns the new object that
     * was passed in via fp->argv[-1], while falling off the end of a function
     * returns undefined.
     *
     * NB: we do not support script rval (eval, API users who want the result
     * of the last expression-statement, debugger API calls).
     */
    if (fp->flags & JSFRAME_CONSTRUCTING) {
        JS_ASSERT(OBJECT_TO_JSVAL(fp->thisp) == fp->argv[-1]);
        rval_ins = get(&fp->argv[-1]);
    } else {
        rval_ins = INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_VOID));
    }
    clearFrameSlotsFromCache();
    return true;
}

bool
TraceRecorder::record_JSOP_GETXPROP()
{
    jsval& l = stackval(-1);
    if (JSVAL_IS_PRIMITIVE(l))
        ABORT_TRACE("primitive-this for GETXPROP?");

    JSObject* obj = JSVAL_TO_OBJECT(l);
    if (obj != cx->fp->scopeChain || obj != globalObj)
        return false;

    jsval* vp;
    if (!name(vp))
        return false;
    stack(-1, get(vp));
    return true;
}

bool
TraceRecorder::record_JSOP_CALLXMLNAME()
{
    return false;
}

bool
TraceRecorder::record_JSOP_TYPEOFEXPR()
{
    return record_JSOP_TYPEOF();
}

bool
TraceRecorder::record_JSOP_ENTERBLOCK()
{
    return false;
}

bool
TraceRecorder::record_JSOP_LEAVEBLOCK()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GENERATOR()
{
    return false;
#if 0
    JSStackFrame* fp = cx->fp;
    if (fp->callobj || fp->argsobj || fp->varobj)
        ABORT_TRACE("can't trace hard-case generator");

    // Generate a type map for the outgoing frame and stash it in the LIR
    unsigned stackSlots = js_NativeStackSlots(cx, 0/*callDepth*/);
    LIns* data = lir_buf_writer->skip(stackSlots * sizeof(uint8));
    uint8* typemap = (uint8 *)data->payload();
    uint8* m = typemap;
    /* Determine the type of a store by looking at the current type of the actual value the
       interpreter is using. For numbers we have to check what kind of store we used last
       (integer or double) to figure out what the side exit show reflect in its typemap. */
    FORALL_SLOTS_IN_PENDING_FRAMES(cx, 0/*callDepth*/,
        *m++ = determineSlotType(vp);
    );
    FlushNativeStackFrame(cx, 0, typemap, state.???, NULL);

    LIns* args[] = { INS_CONST(fp->argc), INS_CONSTPTR(fp->callee), cx_ins };
    LIns* g_ins = lir->insCall(&js_FastNewGenerator_ci, args);
    guard(false, lir->ins_eq0(g_ins), OOM_EXIT);
    return true;
#endif
}

bool
TraceRecorder::record_JSOP_YIELD()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ARRAYPUSH()
{
    return false;
}

bool
TraceRecorder::record_JSOP_ENUMCONSTELEM()
{
    return false;
}

bool
TraceRecorder::record_JSOP_LEAVEBLOCKEXPR()
{
    return false;
}

bool
TraceRecorder::record_JSOP_GETTHISPROP()
{
    LIns* this_ins;

    /* its safe to just use cx->fp->thisp here because getThis() returns false if thisp
       is not available */
    return getThis(this_ins) && getProp(cx->fp->thisp, this_ins);
}

bool
TraceRecorder::record_JSOP_GETARGPROP()
{
    return getProp(argval(GET_ARGNO(cx->fp->regs->pc)));
}

bool
TraceRecorder::record_JSOP_GETLOCALPROP()
{
    return getProp(varval(GET_SLOTNO(cx->fp->regs->pc)));
}

bool
TraceRecorder::record_JSOP_INDEXBASE1()
{
    atoms += 1 << 16;
    return true;
}

bool
TraceRecorder::record_JSOP_INDEXBASE2()
{
    atoms += 2 << 16;
    return true;
}

bool
TraceRecorder::record_JSOP_INDEXBASE3()
{
    atoms += 3 << 16;
    return true;
}

bool
TraceRecorder::record_JSOP_CALLGVAR()
{
    jsval slotval = cx->fp->slots[GET_SLOTNO(cx->fp->regs->pc)];
    if (JSVAL_IS_NULL(slotval))
        return true; // We will see JSOP_CALLNAME from the interpreter's jump, so no-op here.

    uint32 slot = JSVAL_TO_INT(slotval);

    if (!lazilyImportGlobalSlot(slot))
         ABORT_TRACE("lazy import of global slot failed");

    jsval& v = STOBJ_GET_SLOT(cx->fp->scopeChain, slot);
    stack(0, get(&v));
    stack(1, INS_CONSTPTR(NULL));
    return true;
}

bool
TraceRecorder::record_JSOP_CALLLOCAL()
{
    uintN slot = GET_SLOTNO(cx->fp->regs->pc);
    stack(0, var(slot));
    stack(1, INS_CONSTPTR(NULL));
    return true;
}

bool
TraceRecorder::record_JSOP_CALLARG()
{
    uintN slot = GET_ARGNO(cx->fp->regs->pc);
    stack(0, arg(slot));
    stack(1, INS_CONSTPTR(NULL));
    return true;
}

bool
TraceRecorder::record_JSOP_NULLTHIS()
{
    stack(0, INS_CONSTPTR(NULL));
    return true;
}

bool
TraceRecorder::record_JSOP_INT8()
{
    jsdpun u;
    u.d = (jsdouble)GET_INT8(cx->fp->regs->pc);
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_INT32()
{
    jsdpun u;
    u.d = (jsdouble)GET_INT32(cx->fp->regs->pc);
    stack(0, lir->insImmq(u.u64));
    return true;
}

bool
TraceRecorder::record_JSOP_LENGTH()
{
    jsval& l = stackval(-1);
    if (JSVAL_IS_PRIMITIVE(l)) {
        if (!JSVAL_IS_STRING(l))
            ABORT_TRACE("non-string primitives unsupported");
        LIns* str_ins = get(&l);
        LIns* len_ins = lir->insLoad(LIR_ldp, str_ins, (int)offsetof(JSString, length));

        LIns* masked_len_ins = lir->ins2(LIR_piand,
                                         len_ins,
                                         INS_CONSTPTR(JSSTRING_LENGTH_MASK));

        LIns *choose_len_ins =
            lir->ins_choose(lir->ins_eq0(lir->ins2(LIR_piand,
                                                   len_ins,
                                                   INS_CONSTPTR(JSSTRFLAG_DEPENDENT))),
                            masked_len_ins,
                            lir->ins_choose(lir->ins_eq0(lir->ins2(LIR_piand,
                                                                   len_ins,
                                                                   INS_CONSTPTR(JSSTRFLAG_PREFIX))),
                                            lir->ins2(LIR_piand,
                                                      len_ins,
                                                      INS_CONSTPTR(JSSTRDEP_LENGTH_MASK)),
                                            masked_len_ins));

        set(&l, lir->ins1(LIR_i2f, choose_len_ins));
        return true;
    }

    JSObject* obj = JSVAL_TO_OBJECT(l);
    if (!OBJ_IS_DENSE_ARRAY(cx, obj))
        ABORT_TRACE("only dense arrays supported");
    if (!guardDenseArray(obj, get(&l)))
        ABORT_TRACE("OBJ_IS_DENSE_ARRAY but not?!?");
    LIns* v_ins = lir->ins1(LIR_i2f, stobj_get_fslot(get(&l), JSSLOT_ARRAY_LENGTH));
    set(&l, v_ins);
    return true;
}

bool
TraceRecorder::record_JSOP_NEWARRAY()
{
    return false;
}

bool
TraceRecorder::record_JSOP_HOLE()
{
    stack(0, INS_CONST(JSVAL_TO_BOOLEAN(JSVAL_HOLE)));
    return true;
}

#ifdef JS_JIT_SPEW
/* Prints information about entry typemaps and unstable exits for all peers at a PC */
void
js_DumpPeerStability(Fragmento* frago, const void* ip)
{
    Fragment* f;
    TreeInfo* ti;
    bool looped = false;
    unsigned length = 0;

    for (f = frago->getLoop(ip); f != NULL; f = f->peer) {
        if (!f->vmprivate)
            continue;
        printf("fragment %p:\nENTRY: ", f);
        ti = (TreeInfo*)f->vmprivate;
        if (looped)
            JS_ASSERT(ti->stackTypeMap.length() == length);
        for (unsigned i = 0; i < ti->stackTypeMap.length(); i++)
            printf("%d ", ti->stackTypeMap.data()[i]);
        printf("\n");
        UnstableExit* uexit = ti->unstableExits;
        while (uexit != NULL) {
            printf("EXIT:  ");
            uint8* m = getTypeMap(uexit->exit) + uexit->exit->numGlobalSlots;
            for (unsigned i = 0; i < uexit->exit->numStackSlots; i++)
                printf("%d ", m[i]);
            printf("\n");
            uexit = uexit->next;
        }
        length = ti->stackTypeMap.length();
        looped = true;
    }
}
#endif

/*
 * 17 potentially-converting binary operators:
 *  | ^ & == != < <= > >= << >> >>> + - * / %
 */
JS_STATIC_ASSERT((uintN)(JSOP_MOD - JSOP_BITOR) == 16);

/*
 * Use an old <ctype.h> trick: bias imacro_code[op] by -1 to allow zero high
 * FrameInfo.ip_adj byte to mean "not in an imacro".
 */
static void
InitIMacroCode()
{
    if (imacro_code[JSOP_NEXTITER]) {
        JS_ASSERT(imacro_code[JSOP_NEXTITER] == nextiter_imacro - 1);
        return;
    }

    for (uintN op = JSOP_BITOR; op <= JSOP_MOD; op++)
        imacro_code[op] = (jsbytecode*)&binary_imacros - 1;

    // NB: above loop mis-set JSOP_ADD's entry, so order here is crucial.
    imacro_code[JSOP_ADD] = (jsbytecode*)&add_imacros - 1;

    imacro_code[JSOP_ITER] = (jsbytecode*)&iter_imacros - 1;
    imacro_code[JSOP_NEXTITER] = nextiter_imacro - 1;
}

#define UNUSED(n) bool TraceRecorder::record_JSOP_UNUSED##n() { return false; }

UNUSED(131)
UNUSED(201)
UNUSED(202)
UNUSED(203)
UNUSED(204)
UNUSED(205)
UNUSED(206)
UNUSED(207)
UNUSED(208)
UNUSED(209)
UNUSED(219)
UNUSED(226)
