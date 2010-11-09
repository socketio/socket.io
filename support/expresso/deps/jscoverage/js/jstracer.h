/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=99 ft=cpp:
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

#ifndef jstracer_h___
#define jstracer_h___

#ifdef JS_TRACER

#include "jscntxt.h"
#include "jsstddef.h"
#include "jstypes.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsinterp.h"
#include "jsbuiltins.h"

#if defined(DEBUG) && !defined(JS_JIT_SPEW)
#define JS_JIT_SPEW
#endif

template <typename T>
class Queue : public avmplus::GCObject {
    T* _data;
    unsigned _len;
    unsigned _max;

    void ensure(unsigned size) {
        while (_max < size)
            _max <<= 1;
        _data = (T*)realloc(_data, _max * sizeof(T));
    }
public:
    Queue(unsigned max = 16) {
        this->_max = max;
        this->_len = 0;
        this->_data = (T*)malloc(max * sizeof(T));
    }

    ~Queue() {
        free(_data);
    }

    bool contains(T a) {
        for (unsigned n = 0; n < _len; ++n)
            if (_data[n] == a)
                return true;
        return false;
    }

    void add(T a) {
        ensure(_len + 1);
        JS_ASSERT(_len <= _max);
        _data[_len++] = a;
    }

    void add(T* chunk, unsigned size) {
        ensure(_len + size);
        JS_ASSERT(_len <= _max);
        memcpy(&_data[_len], chunk, size * sizeof(T));
        _len += size;
    }

    void addUnique(T a) {
        if (!contains(a))
            add(a);
    }

    void setLength(unsigned len) {
        ensure(len + 1);
        _len = len;
    }

    void clear() {
        _len = 0;
    }

    unsigned length() const {
        return _len;
    }

    T* data() const {
        return _data;
    }
};

/*
 * Tracker is used to keep track of values being manipulated by the interpreter
 * during trace recording.
 */
class Tracker {
    struct Page {
        struct Page*    next;
        jsuword         base;
        nanojit::LIns*  map[1];
    };
    struct Page* pagelist;

    jsuword         getPageBase(const void* v) const;
    struct Page*    findPage(const void* v) const;
    struct Page*    addPage(const void* v);
public:
    Tracker();
    ~Tracker();

    bool            has(const void* v) const;
    nanojit::LIns*  get(const void* v) const;
    void            set(const void* v, nanojit::LIns* ins);
    void            clear();
};

/*
 * The oracle keeps track of slots that should not be demoted to int because we know them
 * to overflow or they result in type-unstable traces. We are using a simple hash table.
 * Collisions lead to loss of optimization (demotable slots are not demoted) but have no
 * correctness implications.
 */
#define ORACLE_SIZE 4096

class Oracle {
    avmplus::BitSet _dontDemote;
public:
    void markGlobalSlotUndemotable(JSScript* script, unsigned slot);
    bool isGlobalSlotUndemotable(JSScript* script, unsigned slot) const;
    void markStackSlotUndemotable(JSScript* script, jsbytecode* ip, unsigned slot);
    bool isStackSlotUndemotable(JSScript* script, jsbytecode* ip, unsigned slot) const;
    void clear();
};

typedef Queue<uint16> SlotList;

class TypeMap : public Queue<uint8> {
public:
    void captureGlobalTypes(JSContext* cx, SlotList& slots);
    void captureStackTypes(JSContext* cx, unsigned callDepth);
    bool matches(TypeMap& other) const;
};

enum ExitType {
    BRANCH_EXIT, 
    LOOP_EXIT, 
    NESTED_EXIT,
    MISMATCH_EXIT,
    OOM_EXIT,
    OVERFLOW_EXIT,
    UNSTABLE_LOOP_EXIT,
    TIMEOUT_EXIT
};

struct VMSideExit : public nanojit::SideExit
{
    intptr_t ip_adj;
    intptr_t sp_adj;
    intptr_t rp_adj;
    int32_t calldepth;
    uint32 numGlobalSlots;
    uint32 numStackSlots;
    uint32 numStackSlotsBelowCurrentFrame;
    ExitType exitType;
};

static inline uint8* getTypeMap(nanojit::SideExit* exit) 
{ 
    return (uint8*)(((VMSideExit*)exit) + 1); 
}

struct InterpState
{
    void* sp; /* native stack pointer, stack[0] is spbase[0] */
    void* rp; /* call stack pointer */
    void* gp; /* global frame pointer */
    JSContext *cx; /* current VM context handle */
    void* eos; /* first unusable word after the native stack */
    void* eor; /* first unusable word after the call stack */
    VMSideExit* lastTreeExitGuard; /* guard we exited on during a tree call */
    VMSideExit* lastTreeCallGuard; /* guard we want to grow from if the tree
                                      call exit guard mismatched */
    void* rpAtLastTreeCall; /* value of rp at innermost tree call guard */
}; 

struct UnstableExit
{
    nanojit::Fragment* fragment;
    VMSideExit* exit;
    UnstableExit* next;
};

class TreeInfo MMGC_SUBCLASS_DECL {
    nanojit::Fragment*      fragment;
public:
    JSScript*               script;
    unsigned                maxNativeStackSlots;
    ptrdiff_t               nativeStackBase;
    unsigned                maxCallDepth;
    TypeMap                 stackTypeMap;
    Queue<nanojit::Fragment*> dependentTrees;
    unsigned                branchCount;
    Queue<VMSideExit*>      sideExits;
    UnstableExit*           unstableExits;

    TreeInfo(nanojit::Fragment* _fragment) : unstableExits(NULL) {
        fragment = _fragment;
    }
    ~TreeInfo();
};

struct FrameInfo {
    JSObject*       callee;     // callee function object
    intptr_t        ip_adj;     // callee script-based pc index and imacro pc
    uint8*          typemap;    // typemap for the stack frame
    union {
        struct {
            uint16  spdist;     // distance from fp->slots to fp->regs->sp at JSOP_CALL
            uint16  argc;       // actual argument count, may be < fun->nargs
        } s;
        uint32      word;       // for spdist/argc LIR store in record_JSOP_CALL
    };
};

class TraceRecorder : public avmplus::GCObject {
    JSContext*              cx;
    JSTraceMonitor*         traceMonitor;
    JSObject*               globalObj;
    Tracker                 tracker;
    Tracker                 nativeFrameTracker;
    char*                   entryTypeMap;
    unsigned                callDepth;
    JSAtom**                atoms;
    VMSideExit*             anchor;
    nanojit::Fragment*      fragment;
    TreeInfo*               treeInfo;
    nanojit::LirBuffer*     lirbuf;
    nanojit::LirWriter*     lir;
    nanojit::LirBufWriter*  lir_buf_writer;
    nanojit::LirWriter*     verbose_filter;
    nanojit::LirWriter*     cse_filter;
    nanojit::LirWriter*     expr_filter;
    nanojit::LirWriter*     func_filter;
#ifdef NJ_SOFTFLOAT
    nanojit::LirWriter*     float_filter;
#endif
    nanojit::LIns*          cx_ins;
    nanojit::LIns*          gp_ins;
    nanojit::LIns*          eos_ins;
    nanojit::LIns*          eor_ins;
    nanojit::LIns*          rval_ins;
    nanojit::LIns*          inner_sp_ins;
    bool                    deepAborted;
    bool                    applyingArguments;
    bool                    trashTree;
    nanojit::Fragment*      whichTreeToTrash;
    Queue<jsbytecode*>      cfgMerges;
    jsval*                  global_dslots;
    JSTraceableNative*      pendingTraceableNative;
    bool                    terminate;
    intptr_t                terminate_ip_adj;
    nanojit::Fragment*      outerToBlacklist;
    nanojit::Fragment*      promotedPeer;
    TraceRecorder*          nextRecorderToAbort;
    bool                    wasRootFragment;

    bool isGlobal(jsval* p) const;
    ptrdiff_t nativeGlobalOffset(jsval* p) const;
    ptrdiff_t nativeStackOffset(jsval* p) const;
    void import(nanojit::LIns* base, ptrdiff_t offset, jsval* p, uint8& t,
                const char *prefix, uintN index, JSStackFrame *fp);
    void import(TreeInfo* treeInfo, nanojit::LIns* sp, unsigned ngslots, unsigned callDepth,
                uint8* globalTypeMap, uint8* stackTypeMap);
    void trackNativeStackUse(unsigned slots);

    bool lazilyImportGlobalSlot(unsigned slot);

    nanojit::LIns* guard(bool expected, nanojit::LIns* cond, ExitType exitType);
    nanojit::LIns* guard(bool expected, nanojit::LIns* cond, nanojit::LIns* exit);
    nanojit::LIns* addName(nanojit::LIns* ins, const char* name);

    nanojit::LIns* get(jsval* p) const;
    nanojit::LIns* writeBack(nanojit::LIns* i, nanojit::LIns* base, ptrdiff_t offset);
    void set(jsval* p, nanojit::LIns* l, bool initializing = false);

    bool checkType(jsval& v, uint8 t, jsval*& stage_val, nanojit::LIns*& stage_ins,
                   unsigned& stage_count);
    bool deduceTypeStability(nanojit::Fragment* root_peer, nanojit::Fragment** stable_peer,
                             unsigned* demotes);

    jsval& argval(unsigned n) const;
    jsval& varval(unsigned n) const;
    jsval& stackval(int n) const;

    nanojit::LIns* scopeChain() const;
    bool activeCallOrGlobalSlot(JSObject* obj, jsval*& vp);

    nanojit::LIns* arg(unsigned n);
    void arg(unsigned n, nanojit::LIns* i);
    nanojit::LIns* var(unsigned n);
    void var(unsigned n, nanojit::LIns* i);
    nanojit::LIns* stack(int n);
    void stack(int n, nanojit::LIns* i);

    nanojit::LIns* alu(nanojit::LOpcode op, jsdouble v0, jsdouble v1, 
                       nanojit::LIns* s0, nanojit::LIns* s1);
    nanojit::LIns* f2i(nanojit::LIns* f);
    nanojit::LIns* makeNumberInt32(nanojit::LIns* f);
    nanojit::LIns* stringify(jsval& v);

    bool call_imacro(jsbytecode* imacro);

    bool ifop();
    bool switchop();
    bool inc(jsval& v, jsint incr, bool pre = true);
    bool inc(jsval& v, nanojit::LIns*& v_ins, jsint incr, bool pre = true);
    bool incProp(jsint incr, bool pre = true);
    bool incElem(jsint incr, bool pre = true);
    bool incName(jsint incr, bool pre = true);

    enum { CMP_NEGATE = 1, CMP_TRY_BRANCH_AFTER_COND = 2, CMP_CASE = 4, CMP_STRICT = 8 };
    bool cmp(nanojit::LOpcode op, int flags = 0);

    bool unary(nanojit::LOpcode op);
    bool binary(nanojit::LOpcode op);

    bool ibinary(nanojit::LOpcode op);
    bool iunary(nanojit::LOpcode op);
    bool bbinary(nanojit::LOpcode op);
    void demote(jsval& v, jsdouble result);

    bool map_is_native(JSObjectMap* map, nanojit::LIns* map_ins, nanojit::LIns*& ops_ins,
                       size_t op_offset = 0);
    bool test_property_cache(JSObject* obj, nanojit::LIns* obj_ins, JSObject*& obj2,
                             jsuword& pcval);
    bool test_property_cache_direct_slot(JSObject* obj, nanojit::LIns* obj_ins, uint32& slot);
    void stobj_set_slot(nanojit::LIns* obj_ins, unsigned slot,
                        nanojit::LIns*& dslots_ins, nanojit::LIns* v_ins);
    nanojit::LIns* stobj_get_fslot(nanojit::LIns* obj_ins, unsigned slot);
    nanojit::LIns* stobj_get_slot(nanojit::LIns* obj_ins, unsigned slot,
                                  nanojit::LIns*& dslots_ins);
    bool native_set(nanojit::LIns* obj_ins, JSScopeProperty* sprop,
                    nanojit::LIns*& dslots_ins, nanojit::LIns* v_ins);
    bool native_get(nanojit::LIns* obj_ins, nanojit::LIns* pobj_ins, JSScopeProperty* sprop,
                    nanojit::LIns*& dslots_ins, nanojit::LIns*& v_ins);

    bool name(jsval*& vp);
    bool prop(JSObject* obj, nanojit::LIns* obj_ins, uint32& slot, nanojit::LIns*& v_ins);
    bool elem(jsval& oval, jsval& idx, jsval*& vp, nanojit::LIns*& v_ins, nanojit::LIns*& addr_ins);

    bool getProp(JSObject* obj, nanojit::LIns* obj_ins);
    bool getProp(jsval& v);
    bool getThis(nanojit::LIns*& this_ins);

    bool box_jsval(jsval v, nanojit::LIns*& v_ins);
    bool unbox_jsval(jsval v, nanojit::LIns*& v_ins);
    bool guardClass(JSObject* obj, nanojit::LIns* obj_ins, JSClass* clasp,
                    ExitType exitType = MISMATCH_EXIT);
    bool guardDenseArray(JSObject* obj, nanojit::LIns* obj_ins,
                         ExitType exitType = MISMATCH_EXIT);
    bool guardDenseArrayIndex(JSObject* obj, jsint idx, nanojit::LIns* obj_ins,
                              nanojit::LIns* dslots_ins, nanojit::LIns* idx_ins,
                              ExitType exitType);
    bool guardElemOp(JSObject* obj, nanojit::LIns* obj_ins, jsid id, size_t op_offset, jsval* vp);
    void clearFrameSlotsFromCache();
    bool guardShapelessCallee(jsval& callee);
    bool interpretedFunctionCall(jsval& fval, JSFunction* fun, uintN argc, bool constructing);
    bool functionCall(bool constructing);

    void trackCfgMerges(jsbytecode* pc);
    void flipIf(jsbytecode* pc, bool& cond);
    void fuseIf(jsbytecode* pc, bool cond, nanojit::LIns* x);

    bool hasMethod(JSObject* obj, jsid id);
    bool hasToStringMethod(JSObject* obj);
    bool hasToStringMethod(jsval v) {
        JS_ASSERT(JSVAL_IS_OBJECT(v));
        return hasToStringMethod(JSVAL_TO_OBJECT(v));
    }
    bool hasValueOfMethod(JSObject* obj);
    bool hasValueOfMethod(jsval v) {
        JS_ASSERT(JSVAL_IS_OBJECT(v));
        return hasValueOfMethod(JSVAL_TO_OBJECT(v));
    }
    bool hasIteratorMethod(JSObject* obj);
    bool hasIteratorMethod(jsval v) {
        JS_ASSERT(JSVAL_IS_OBJECT(v));
        return hasIteratorMethod(JSVAL_TO_OBJECT(v));
    }

public:
    friend bool js_MonitorRecording(TraceRecorder* tr);

    TraceRecorder(JSContext* cx, VMSideExit*, nanojit::Fragment*, TreeInfo*,
                  unsigned ngslots, uint8* globalTypeMap, uint8* stackTypeMap,
                  VMSideExit* expectedInnerExit, nanojit::Fragment* outerToBlacklist);
    ~TraceRecorder();

    uint8 determineSlotType(jsval* vp) const;
    nanojit::LIns* snapshot(ExitType exitType);
    nanojit::Fragment* getFragment() const { return fragment; }
    bool isLoopHeader(JSContext* cx) const;
    void compile(nanojit::Fragmento* fragmento);
    bool closeLoop(nanojit::Fragmento* fragmento, bool& demote, unsigned *demotes);
    void endLoop(nanojit::Fragmento* fragmento);
    void joinEdgesToEntry(nanojit::Fragmento* fragmento, nanojit::Fragment* peer_root);
    void blacklist() { fragment->blacklist(); }
    bool adjustCallerTypes(nanojit::Fragment* f, unsigned* demote_slots, bool& trash);
    nanojit::Fragment* findNestedCompatiblePeer(nanojit::Fragment* f, nanojit::Fragment** empty);
    void prepareTreeCall(nanojit::Fragment* inner);
    void emitTreeCall(nanojit::Fragment* inner, VMSideExit* exit);
    unsigned getCallDepth() const;
    void pushAbortStack();
    void popAbortStack();
    void removeFragmentoReferences();

    bool record_EnterFrame();
    bool record_LeaveFrame();
    bool record_SetPropHit(JSPropCacheEntry* entry, JSScopeProperty* sprop);
    bool record_SetPropMiss(JSPropCacheEntry* entry);
    bool record_DefLocalFunSetSlot(uint32 slot, JSObject* obj);
    bool record_FastNativeCallComplete();
    bool record_IteratorNextComplete();

    nanojit::Fragment* getOuterToBlacklist() { return outerToBlacklist; }
    void deepAbort() { deepAborted = true; }
    bool wasDeepAborted() { return deepAborted; }
    bool walkedOutOfLoop() { return terminate; }
    void setPromotedPeer(nanojit::Fragment* peer) { promotedPeer = peer; }
    TreeInfo* getTreeInfo() { return treeInfo; }

#define OPDEF(op,val,name,token,length,nuses,ndefs,prec,format)               \
    bool record_##op();
# include "jsopcode.tbl"
#undef OPDEF
};

#define TRACING_ENABLED(cx)       JS_HAS_OPTION(cx, JSOPTION_JIT)
#define TRACE_RECORDER(cx)        (JS_TRACE_MONITOR(cx).recorder)
#define SET_TRACE_RECORDER(cx,tr) (JS_TRACE_MONITOR(cx).recorder = (tr))

#define JSOP_IS_BINARY(op) ((uintN)((op) - JSOP_BITOR) <= (uintN)(JSOP_MOD - JSOP_BITOR))

/*
 * See jsinterp.cpp for the ENABLE_TRACER definition. Also note how comparing x
 * to JSOP_* constants specializes trace-recording code at compile time either
 * to include imacro support, or exclude it altogether for this particular x.
 *
 * We save macro-generated code size also via bool TraceRecorder::record_JSOP_*
 * return type, instead of a three-state: OK, ABORTED, IMACRO_STARTED. But the
 * price of this is the JSFRAME_IMACRO_START frame flag. We need one more bit
 * to detect that TraceRecorder::call_imacro was invoked by the record_JSOP_*
 * method invoked by TRACE_ARGS_.
 */
#define RECORD_ARGS(x,args)                                                   \
    JS_BEGIN_MACRO                                                            \
        if (!js_MonitorRecording(TRACE_RECORDER(cx))) {                       \
            ENABLE_TRACER(0);                                                 \
        } else {                                                              \
            TRACE_ARGS_(x, args,                                              \
                if ((fp->flags & JSFRAME_IMACRO_START) &&                     \
                    (x == JSOP_ITER || x == JSOP_NEXTITER ||                  \
                    JSOP_IS_BINARY(x))) {                                     \
                    fp->flags &= ~JSFRAME_IMACRO_START;                       \
                    atoms = COMMON_ATOMS_START(&rt->atomState);               \
                    op = JSOp(*regs.pc);                                      \
                    DO_OP();                                                  \
                }                                                             \
            );                                                                \
         }                                                                    \
    JS_END_MACRO

#define TRACE_ARGS_(x,args,onfalse)                                           \
    JS_BEGIN_MACRO                                                            \
        TraceRecorder* tr_ = TRACE_RECORDER(cx);                              \
        if (tr_ && !tr_->record_##x args) {                                   \
            onfalse                                                           \
            js_AbortRecording(cx, #x);                                        \
            ENABLE_TRACER(0);                                                 \
        }                                                                     \
    JS_END_MACRO

#define TRACE_ARGS(x,args)      TRACE_ARGS_(x, args, )

#define RECORD(x)               RECORD_ARGS(x, ())
#define TRACE_0(x)              TRACE_ARGS(x, ())
#define TRACE_1(x,a)            TRACE_ARGS(x, (a))
#define TRACE_2(x,a,b)          TRACE_ARGS(x, (a, b))

extern bool
js_MonitorLoopEdge(JSContext* cx, uintN& inlineCallCount);

extern bool
js_MonitorRecording(TraceRecorder *tr);

extern void
js_AbortRecording(JSContext* cx, const char* reason);

extern void
js_InitJIT(JSTraceMonitor *tm);

extern void
js_FinishJIT(JSTraceMonitor *tm);

extern void
js_FlushJITCache(JSContext* cx);

extern void
js_FlushJITOracle(JSContext* cx);

#else  /* !JS_TRACER */

#define RECORD(x)               ((void)0)
#define TRACE_0(x)              ((void)0)
#define TRACE_1(x,a)            ((void)0)
#define TRACE_2(x,a,b)          ((void)0)

#endif /* !JS_TRACER */

#endif /* jstracer_h___ */
