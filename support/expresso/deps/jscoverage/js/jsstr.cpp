/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=99:
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/*
 * JS string type implementation.
 *
 * In order to avoid unnecessary js_LockGCThing/js_UnlockGCThing calls, these
 * native methods store strings (possibly newborn) converted from their 'this'
 * parameter and arguments on the stack: 'this' conversions at argv[-1], arg
 * conversions at their index (argv[0], argv[1]).  This is a legitimate method
 * of rooting things that might lose their newborn root due to subsequent GC
 * allocations in the same native method.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jshash.h" /* Added by JSIFY */
#include "jsprf.h"
#include "jsapi.h"
#include "jsarray.h"
#include "jsatom.h"
#include "jsbool.h"
#include "jsbuiltins.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsregexp.h"
#include "jsscope.h"
#include "jsstr.h"
#include "jsbit.h"

#define JSSTRDEP_RECURSION_LIMIT        100

size_t
js_MinimizeDependentStrings(JSString *str, int level, JSString **basep)
{
    JSString *base;
    size_t start, length;

    JS_ASSERT(JSSTRING_IS_DEPENDENT(str));
    base = JSSTRDEP_BASE(str);
    start = JSSTRDEP_START(str);
    if (JSSTRING_IS_DEPENDENT(base)) {
        if (level < JSSTRDEP_RECURSION_LIMIT) {
            start += js_MinimizeDependentStrings(base, level + 1, &base);
        } else {
            do {
                start += JSSTRDEP_START(base);
                base = JSSTRDEP_BASE(base);
            } while (JSSTRING_IS_DEPENDENT(base));
        }
        if (start == 0) {
            JS_ASSERT(JSSTRDEP_IS_PREFIX(str));
            JSPREFIX_SET_BASE(str, base);
        } else if (start <= JSSTRDEP_START_MASK) {
            length = JSSTRDEP_LENGTH(str);
            JSSTRDEP_INIT(str, base, start, length);
        }
    }
    *basep = base;
    return start;
}

jschar *
js_GetDependentStringChars(JSString *str)
{
    size_t start;
    JSString *base;

    start = js_MinimizeDependentStrings(str, 0, &base);
    JS_ASSERT(start < JSFLATSTR_LENGTH(base));
    return JSFLATSTR_CHARS(base) + start;
}

const jschar *
js_GetStringChars(JSContext *cx, JSString *str)
{
    if (!js_MakeStringImmutable(cx, str))
        return NULL;
    return JSFLATSTR_CHARS(str);
}

JSString * JS_FASTCALL
js_ConcatStrings(JSContext *cx, JSString *left, JSString *right)
{
    size_t rn, ln, lrdist, n;
    jschar *rs, *ls, *s;
    JSString *ldep;             /* non-null if left should become dependent */
    JSString *str;

    JSSTRING_CHARS_AND_LENGTH(right, rs, rn);
    if (rn == 0)
        return left;

    JSSTRING_CHARS_AND_LENGTH(left, ls, ln);
    if (ln == 0)
        return right;

    if (!JSSTRING_IS_MUTABLE(left)) {
        /* We must copy if left does not own a buffer to realloc. */
        s = (jschar *) JS_malloc(cx, (ln + rn + 1) * sizeof(jschar));
        if (!s)
            return NULL;
        js_strncpy(s, ls, ln);
        ldep = NULL;
    } else {
        /* We can realloc left's space and make it depend on our result. */
        JS_ASSERT(JSSTRING_IS_FLAT(left));
        s = (jschar *) JS_realloc(cx, ls, (ln + rn + 1) * sizeof(jschar));
        if (!s)
            return NULL;

        /* Take care: right could depend on left! */
        lrdist = (size_t)(rs - ls);
        if (lrdist < ln)
            rs = s + lrdist;
        left->u.chars = ls = s;
        ldep = left;
    }

    js_strncpy(s + ln, rs, rn);
    n = ln + rn;
    s[n] = 0;
    str = js_NewString(cx, s, n);
    if (!str) {
        /* Out of memory: clean up any space we (re-)allocated. */
        if (!ldep) {
            JS_free(cx, s);
        } else {
            s = (jschar *) JS_realloc(cx, ls, (ln + 1) * sizeof(jschar));
            if (s)
                left->u.chars = s;
        }
    } else {
        JSFLATSTR_SET_MUTABLE(str);

        /* Morph left into a dependent prefix if we realloc'd its buffer. */
        if (ldep) {
            JSPREFIX_INIT(ldep, str, ln);
#ifdef DEBUG
          {
            JSRuntime *rt = cx->runtime;
            JS_RUNTIME_METER(rt, liveDependentStrings);
            JS_RUNTIME_METER(rt, totalDependentStrings);
            JS_LOCK_RUNTIME_VOID(rt,
                (rt->strdepLengthSum += (double)ln,
                 rt->strdepLengthSquaredSum += (double)ln * (double)ln));
          }
#endif
        }
    }

    return str;
}

const jschar *
js_UndependString(JSContext *cx, JSString *str)
{
    size_t n, size;
    jschar *s;

    if (JSSTRING_IS_DEPENDENT(str)) {
        n = JSSTRDEP_LENGTH(str);
        size = (n + 1) * sizeof(jschar);
        s = (jschar *) JS_malloc(cx, size);
        if (!s)
            return NULL;

        js_strncpy(s, JSSTRDEP_CHARS(str), n);
        s[n] = 0;
        JSFLATSTR_INIT(str, s, n);

#ifdef DEBUG
        {
            JSRuntime *rt = cx->runtime;
            JS_RUNTIME_UNMETER(rt, liveDependentStrings);
            JS_RUNTIME_UNMETER(rt, totalDependentStrings);
            JS_LOCK_RUNTIME_VOID(rt,
                (rt->strdepLengthSum -= (double)n,
                 rt->strdepLengthSquaredSum -= (double)n * (double)n));
        }
#endif
    }

    return JSFLATSTR_CHARS(str);
}

JSBool
js_MakeStringImmutable(JSContext *cx, JSString *str)
{
    if (JSSTRING_IS_DEPENDENT(str) && !js_UndependString(cx, str)) {
        JS_RUNTIME_METER(cx->runtime, badUndependStrings);
        return JS_FALSE;
    }
    JSFLATSTR_CLEAR_MUTABLE(str);
    return JS_TRUE;
}

static JSString *
ArgToRootedString(JSContext *cx, uintN argc, jsval *vp, uintN arg)
{
    JSObject *obj;
    JSString *str;

    if (arg >= argc)
        return ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_VOID]);
    vp += 2 + arg;

    if (JSVAL_IS_OBJECT(*vp)) {
        obj = JSVAL_TO_OBJECT(*vp);
        if (!obj)
            return ATOM_TO_STRING(cx->runtime->atomState.nullAtom);
        if (!OBJ_DEFAULT_VALUE(cx, obj, JSTYPE_STRING, vp))
            return NULL;
    }
    if (JSVAL_IS_STRING(*vp))
        return JSVAL_TO_STRING(*vp);
    if (JSVAL_IS_INT(*vp)) {
        str = js_NumberToString(cx, JSVAL_TO_INT(*vp));
    } else if (JSVAL_IS_DOUBLE(*vp)) {
        str = js_NumberToString(cx, *JSVAL_TO_DOUBLE(*vp));
    } else if (JSVAL_IS_BOOLEAN(*vp)) {
        return ATOM_TO_STRING(cx->runtime->atomState.booleanAtoms[
                                  JSVAL_TO_BOOLEAN(*vp)? 1 : 0]);
    } else {
        JS_ASSERT(JSVAL_IS_VOID(*vp));
        return ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_VOID]);
    }
    if (str)
        *vp = STRING_TO_JSVAL(str);
    return str;
}

/*
 * Forward declarations for URI encode/decode and helper routines
 */
static JSBool
str_decodeURI(JSContext *cx, uintN argc, jsval *vp);

static JSBool
str_decodeURI_Component(JSContext *cx, uintN argc, jsval *vp);

static JSBool
str_encodeURI(JSContext *cx, uintN argc, jsval *vp);

static JSBool
str_encodeURI_Component(JSContext *cx, uintN argc, jsval *vp);

static uint32
Utf8ToOneUcs4Char(const uint8 *utf8Buffer, int utf8Length);

/*
 * Contributions from the String class to the set of methods defined for the
 * global object.  escape and unescape used to be defined in the Mocha library,
 * but as ECMA decided to spec them, they've been moved to the core engine
 * and made ECMA-compliant.  (Incomplete escapes are interpreted as literal
 * characters by unescape.)
 */

/*
 * Stuff to emulate the old libmocha escape, which took a second argument
 * giving the type of escape to perform.  Retained for compatibility, and
 * copied here to avoid reliance on net.h, mkparse.c/NET_EscapeBytes.
 */

#define URL_XALPHAS     ((uint8) 1)
#define URL_XPALPHAS    ((uint8) 2)
#define URL_PATH        ((uint8) 4)

static const uint8 urlCharType[256] =
/*      Bit 0           xalpha          -- the alphas
 *      Bit 1           xpalpha         -- as xalpha but
 *                             converts spaces to plus and plus to %20
 *      Bit 2 ...       path            -- as xalphas but doesn't escape '/'
 */
    /*   0 1 2 3 4 5 6 7 8 9 A B C D E F */
    {    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,       /* 0x */
         0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,       /* 1x */
         0,0,0,0,0,0,0,0,0,0,7,4,0,7,7,4,       /* 2x   !"#$%&'()*+,-./  */
         7,7,7,7,7,7,7,7,7,7,0,0,0,0,0,0,       /* 3x  0123456789:;<=>?  */
         7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,       /* 4x  @ABCDEFGHIJKLMNO  */
         7,7,7,7,7,7,7,7,7,7,7,0,0,0,0,7,       /* 5X  PQRSTUVWXYZ[\]^_  */
         0,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,       /* 6x  `abcdefghijklmno  */
         7,7,7,7,7,7,7,7,7,7,7,0,0,0,0,0,       /* 7X  pqrstuvwxyz{\}~  DEL */
         0, };

/* This matches the ECMA escape set when mask is 7 (default.) */

#define IS_OK(C, mask) (urlCharType[((uint8) (C))] & (mask))

/* See ECMA-262 Edition 3 B.2.1 */
JSBool
js_str_escape(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;
    size_t i, ni, length, newlength;
    const jschar *chars;
    jschar *newchars;
    jschar ch;
    jsint mask;
    jsdouble d;
    const char digits[] = {'0', '1', '2', '3', '4', '5', '6', '7',
                           '8', '9', 'A', 'B', 'C', 'D', 'E', 'F' };

    mask = URL_XALPHAS | URL_XPALPHAS | URL_PATH;
    if (argc > 1) {
        d = js_ValueToNumber(cx, &argv[1]);
        if (JSVAL_IS_NULL(argv[1]))
            return JS_FALSE;
        if (!JSDOUBLE_IS_FINITE(d) ||
            (mask = (jsint)d) != d ||
            mask & ~(URL_XALPHAS | URL_XPALPHAS | URL_PATH))
        {
            char numBuf[12];
            JS_snprintf(numBuf, sizeof numBuf, "%lx", (unsigned long) mask);
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_BAD_STRING_MASK, numBuf);
            return JS_FALSE;
        }
    }

    str = ArgToRootedString(cx, argc, argv - 2, 0);
    if (!str)
        return JS_FALSE;

    JSSTRING_CHARS_AND_LENGTH(str, chars, length);
    newlength = length;

    /* Take a first pass and see how big the result string will need to be. */
    for (i = 0; i < length; i++) {
        if ((ch = chars[i]) < 128 && IS_OK(ch, mask))
            continue;
        if (ch < 256) {
            if (mask == URL_XPALPHAS && ch == ' ')
                continue;   /* The character will be encoded as '+' */
            newlength += 2; /* The character will be encoded as %XX */
        } else {
            newlength += 5; /* The character will be encoded as %uXXXX */
        }

        /*
         * This overflow test works because newlength is incremented by at
         * most 5 on each iteration.
         */
        if (newlength < length) {
            js_ReportAllocationOverflow(cx);
            return JS_FALSE;
        }
    }

    if (newlength >= ~(size_t)0 / sizeof(jschar)) {
        js_ReportAllocationOverflow(cx);
        return JS_FALSE;
    }

    newchars = (jschar *) JS_malloc(cx, (newlength + 1) * sizeof(jschar));
    if (!newchars)
        return JS_FALSE;
    for (i = 0, ni = 0; i < length; i++) {
        if ((ch = chars[i]) < 128 && IS_OK(ch, mask)) {
            newchars[ni++] = ch;
        } else if (ch < 256) {
            if (mask == URL_XPALPHAS && ch == ' ') {
                newchars[ni++] = '+'; /* convert spaces to pluses */
            } else {
                newchars[ni++] = '%';
                newchars[ni++] = digits[ch >> 4];
                newchars[ni++] = digits[ch & 0xF];
            }
        } else {
            newchars[ni++] = '%';
            newchars[ni++] = 'u';
            newchars[ni++] = digits[ch >> 12];
            newchars[ni++] = digits[(ch & 0xF00) >> 8];
            newchars[ni++] = digits[(ch & 0xF0) >> 4];
            newchars[ni++] = digits[ch & 0xF];
        }
    }
    JS_ASSERT(ni == newlength);
    newchars[newlength] = 0;

    str = js_NewString(cx, newchars, newlength);
    if (!str) {
        JS_free(cx, newchars);
        return JS_FALSE;
    }
    *rval = STRING_TO_JSVAL(str);
    return JS_TRUE;
}
#undef IS_OK

static JSBool
str_escape(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    return obj && js_str_escape(cx, obj, argc, vp + 2, vp);
}

/* See ECMA-262 Edition 3 B.2.2 */
static JSBool
str_unescape(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;
    size_t i, ni, length;
    const jschar *chars;
    jschar *newchars;
    jschar ch;

    str = ArgToRootedString(cx, argc, vp, 0);
    if (!str)
        return JS_FALSE;

    JSSTRING_CHARS_AND_LENGTH(str, chars, length);

    /* Don't bother allocating less space for the new string. */
    newchars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
    if (!newchars)
        return JS_FALSE;
    ni = i = 0;
    while (i < length) {
        ch = chars[i++];
        if (ch == '%') {
            if (i + 1 < length &&
                JS7_ISHEX(chars[i]) && JS7_ISHEX(chars[i + 1]))
            {
                ch = JS7_UNHEX(chars[i]) * 16 + JS7_UNHEX(chars[i + 1]);
                i += 2;
            } else if (i + 4 < length && chars[i] == 'u' &&
                       JS7_ISHEX(chars[i + 1]) && JS7_ISHEX(chars[i + 2]) &&
                       JS7_ISHEX(chars[i + 3]) && JS7_ISHEX(chars[i + 4]))
            {
                ch = (((((JS7_UNHEX(chars[i + 1]) << 4)
                        + JS7_UNHEX(chars[i + 2])) << 4)
                      + JS7_UNHEX(chars[i + 3])) << 4)
                    + JS7_UNHEX(chars[i + 4]);
                i += 5;
            }
        }
        newchars[ni++] = ch;
    }
    newchars[ni] = 0;

    str = js_NewString(cx, newchars, ni);
    if (!str) {
        JS_free(cx, newchars);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#if JS_HAS_UNEVAL
static JSBool
str_uneval(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    str = js_ValueToSource(cx, argc != 0 ? vp[2] : JSVAL_VOID);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}
#endif

const char js_escape_str[] = "escape";
const char js_unescape_str[] = "unescape";
#if JS_HAS_UNEVAL
const char js_uneval_str[] = "uneval";
#endif
const char js_decodeURI_str[] = "decodeURI";
const char js_encodeURI_str[] = "encodeURI";
const char js_decodeURIComponent_str[] = "decodeURIComponent";
const char js_encodeURIComponent_str[] = "encodeURIComponent";

static JSFunctionSpec string_functions[] = {
    JS_FN(js_escape_str,             str_escape,                1,0),
    JS_FN(js_unescape_str,           str_unescape,              1,0),
#if JS_HAS_UNEVAL
    JS_FN(js_uneval_str,             str_uneval,                1,0),
#endif
    JS_FN(js_decodeURI_str,          str_decodeURI,             1,0),
    JS_FN(js_encodeURI_str,          str_encodeURI,             1,0),
    JS_FN(js_decodeURIComponent_str, str_decodeURI_Component,   1,0),
    JS_FN(js_encodeURIComponent_str, str_encodeURI_Component,   1,0),

    JS_FS_END
};

jschar      js_empty_ucstr[]  = {0};
JSSubString js_EmptySubString = {0, js_empty_ucstr};

enum string_tinyid {
    STRING_LENGTH = -1
};

static JSPropertySpec string_props[] = {
    {js_length_str,     STRING_LENGTH,
                        JSPROP_READONLY|JSPROP_PERMANENT|JSPROP_SHARED, 0,0},
    {0,0,0,0,0}
};

static JSBool
str_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    jsval v;
    JSString *str;
    jsint slot;

    if (!JSVAL_IS_INT(id))
        return JS_TRUE;

    slot = JSVAL_TO_INT(id);
    if (slot == STRING_LENGTH) {
        if (OBJ_GET_CLASS(cx, obj) == &js_StringClass) {
            /* Follow ECMA-262 by fetching intrinsic length of our string. */
            v = OBJ_GET_SLOT(cx, obj, JSSLOT_PRIVATE);
            JS_ASSERT(JSVAL_IS_STRING(v));
            str = JSVAL_TO_STRING(v);
        } else {
            /* Preserve compatibility: convert obj to a string primitive. */
            str = js_ValueToString(cx, OBJECT_TO_JSVAL(obj));
            if (!str)
                return JS_FALSE;
        }

        *vp = INT_TO_JSVAL((jsint) JSSTRING_LENGTH(str));
    }
    return JS_TRUE;
}

#define STRING_ELEMENT_ATTRS (JSPROP_ENUMERATE|JSPROP_READONLY|JSPROP_PERMANENT)

static JSBool
str_enumerate(JSContext *cx, JSObject *obj)
{
    jsval v;
    JSString *str, *str1;
    size_t i, length;

    v = OBJ_GET_SLOT(cx, obj, JSSLOT_PRIVATE);
    JS_ASSERT(JSVAL_IS_STRING(v));
    str = JSVAL_TO_STRING(v);

    length = JSSTRING_LENGTH(str);
    for (i = 0; i < length; i++) {
        str1 = js_NewDependentString(cx, str, i, 1);
        if (!str1)
            return JS_FALSE;
        if (!OBJ_DEFINE_PROPERTY(cx, obj, INT_TO_JSID(i),
                                 STRING_TO_JSVAL(str1), NULL, NULL,
                                 STRING_ELEMENT_ATTRS, NULL)) {
            return JS_FALSE;
        }
    }
    return JS_TRUE;
}

static JSBool
str_resolve(JSContext *cx, JSObject *obj, jsval id, uintN flags,
            JSObject **objp)
{
    jsval v;
    JSString *str, *str1;
    jsint slot;

    if (!JSVAL_IS_INT(id) || (flags & JSRESOLVE_ASSIGNING))
        return JS_TRUE;

    v = OBJ_GET_SLOT(cx, obj, JSSLOT_PRIVATE);
    JS_ASSERT(JSVAL_IS_STRING(v));
    str = JSVAL_TO_STRING(v);

    slot = JSVAL_TO_INT(id);
    if ((size_t)slot < JSSTRING_LENGTH(str)) {
        str1 = js_GetUnitString(cx, str, (size_t)slot);
        if (!str1)
            return JS_FALSE;
        if (!OBJ_DEFINE_PROPERTY(cx, obj, INT_TO_JSID(slot),
                                 STRING_TO_JSVAL(str1), NULL, NULL,
                                 STRING_ELEMENT_ATTRS, NULL)) {
            return JS_FALSE;
        }
        *objp = obj;
    }
    return JS_TRUE;
}

JSClass js_StringClass = {
    js_String_str,
    JSCLASS_HAS_PRIVATE | JSCLASS_NEW_RESOLVE |
    JSCLASS_HAS_CACHED_PROTO(JSProto_String),
    JS_PropertyStub,   JS_PropertyStub,   str_getProperty,   JS_PropertyStub,
    str_enumerate, (JSResolveOp)str_resolve, JS_ConvertStub, JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS
};

#define NORMALIZE_THIS(cx,vp,str)                                             \
    JS_BEGIN_MACRO                                                            \
        if (JSVAL_IS_STRING(vp[1])) {                                         \
            str = JSVAL_TO_STRING(vp[1]);                                     \
        } else {                                                              \
            str = NormalizeThis(cx, vp);                                      \
            if (!str)                                                         \
                return JS_FALSE;                                              \
        }                                                                     \
    JS_END_MACRO

static JSString *
NormalizeThis(JSContext *cx, jsval *vp)
{
    JSString *str;

    if (JSVAL_IS_NULL(vp[1]) && JSVAL_IS_NULL(JS_THIS(cx, vp)))
        return NULL;
    str = js_ValueToString(cx, vp[1]);
    if (!str)
        return NULL;
    vp[1] = STRING_TO_JSVAL(str);
    return str;
}

#if JS_HAS_TOSOURCE

/*
 * String.prototype.quote is generic (as are most string methods), unlike
 * toSource, toString, and valueOf.
 */
static JSBool
str_quote(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    NORMALIZE_THIS(cx, vp, str);
    str = js_QuoteString(cx, str, '"');
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
str_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    jsval v;
    JSString *str;
    size_t i, j, k, n;
    char buf[16];
    jschar *s, *t;

    if (!js_GetPrimitiveThis(cx, vp, &js_StringClass, &v))
        return JS_FALSE;
    JS_ASSERT(JSVAL_IS_STRING(v));
    str = js_QuoteString(cx, JSVAL_TO_STRING(v), '"');
    if (!str)
        return JS_FALSE;
    j = JS_snprintf(buf, sizeof buf, "(new %s(", js_StringClass.name);
    JSSTRING_CHARS_AND_LENGTH(str, s, k);
    n = j + k + 2;
    t = (jschar *) JS_malloc(cx, (n + 1) * sizeof(jschar));
    if (!t)
        return JS_FALSE;
    for (i = 0; i < j; i++)
        t[i] = buf[i];
    for (j = 0; j < k; i++, j++)
        t[i] = s[j];
    t[i++] = ')';
    t[i++] = ')';
    t[i] = 0;
    str = js_NewString(cx, t, n);
    if (!str) {
        JS_free(cx, t);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#endif /* JS_HAS_TOSOURCE */

static JSBool
str_toString(JSContext *cx, uintN argc, jsval *vp)
{
    return js_GetPrimitiveThis(cx, vp, &js_StringClass, vp);
}

/*
 * Java-like string native methods.
 */

static JSString *
SubstringTail(JSContext *cx, JSString *str, jsdouble length, jsdouble begin, jsdouble end)
{
    if (begin < 0)
        begin = 0;
    else if (begin > length)
        begin = length;

    if (end < 0)
        end = 0;
    else if (end > length)
        end = length;
    if (end < begin) {
        /* ECMA emulates old JDK1.0 java.lang.String.substring. */
        jsdouble tmp = begin;
        begin = end;
        end = tmp;
    }

    return js_NewDependentString(cx, str, (size_t)begin, (size_t)(end - begin));
}

static JSBool
str_substring(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;
    jsdouble d;
    jsdouble length, begin, end;

    NORMALIZE_THIS(cx, vp, str);
    if (argc != 0) {
        d = js_ValueToNumber(cx, &vp[2]);
        if (JSVAL_IS_NULL(vp[2]))
            return JS_FALSE;
        length = JSSTRING_LENGTH(str);
        begin = js_DoubleToInteger(d);
        if (argc == 1) {
            end = length;
        } else {
            d = js_ValueToNumber(cx, &vp[3]);
            if (JSVAL_IS_NULL(vp[3]))
                return JS_FALSE;
            end = js_DoubleToInteger(d);
        }

        str = SubstringTail(cx, str, length, begin, end);
        if (!str)
            return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#ifdef JS_TRACER
static JSString* FASTCALL
String_p_toString(JSContext* cx, JSObject* obj)
{
    if (!JS_InstanceOf(cx, obj, &js_StringClass, NULL))
        return NULL;
    jsval v = OBJ_GET_SLOT(cx, obj, JSSLOT_PRIVATE);
    JS_ASSERT(JSVAL_IS_STRING(v));
    return JSVAL_TO_STRING(v);
}

static JSString* FASTCALL
String_p_substring(JSContext* cx, JSString* str, int32 begin, int32 end)
{
    JS_ASSERT(JS_ON_TRACE(cx));

    size_t length = JSSTRING_LENGTH(str);
    return SubstringTail(cx, str, length, begin, end);
}

static JSString* FASTCALL
String_p_substring_1(JSContext* cx, JSString* str, int32 begin)
{
    JS_ASSERT(JS_ON_TRACE(cx));

    size_t length = JSSTRING_LENGTH(str);
    return SubstringTail(cx, str, length, begin, length);
}
#endif

JSString* JS_FASTCALL
js_toLowerCase(JSContext *cx, JSString *str)
{
    size_t i, n;
    jschar *s, *news;

    JSSTRING_CHARS_AND_LENGTH(str, s, n);
    news = (jschar *) JS_malloc(cx, (n + 1) * sizeof(jschar));
    if (!news)
        return NULL;
    for (i = 0; i < n; i++)
        news[i] = JS_TOLOWER(s[i]);
    news[n] = 0;
    str = js_NewString(cx, news, n);
    if (!str) {
        JS_free(cx, news);
        return NULL;
    }
    return str;
}

static JSBool
str_toLowerCase(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    NORMALIZE_THIS(cx, vp, str);
    str = js_toLowerCase(cx, str);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
str_toLocaleLowerCase(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    /*
     * Forcefully ignore the first (or any) argument and return toLowerCase(),
     * ECMA has reserved that argument, presumably for defining the locale.
     */
    if (cx->localeCallbacks && cx->localeCallbacks->localeToLowerCase) {
        NORMALIZE_THIS(cx, vp, str);
        return cx->localeCallbacks->localeToLowerCase(cx, str, vp);
    }
    return str_toLowerCase(cx, 0, vp);
}

JSString* JS_FASTCALL
js_toUpperCase(JSContext *cx, JSString *str)
{
    size_t i, n;
    jschar *s, *news;

    JSSTRING_CHARS_AND_LENGTH(str, s, n);
    news = (jschar *) JS_malloc(cx, (n + 1) * sizeof(jschar));
    if (!news)
        return NULL;
    for (i = 0; i < n; i++)
        news[i] = JS_TOUPPER(s[i]);
    news[n] = 0;
    str = js_NewString(cx, news, n);
    if (!str) {
        JS_free(cx, news);
        return NULL;
    }
    return str;
}

static JSBool
str_toUpperCase(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    NORMALIZE_THIS(cx, vp, str);
    str = js_toUpperCase(cx, str);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
str_toLocaleUpperCase(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    /*
     * Forcefully ignore the first (or any) argument and return toUpperCase(),
     * ECMA has reserved that argument, presumably for defining the locale.
     */
    if (cx->localeCallbacks && cx->localeCallbacks->localeToUpperCase) {
        NORMALIZE_THIS(cx, vp, str);
        return cx->localeCallbacks->localeToUpperCase(cx, str, vp);
    }
    return str_toUpperCase(cx, 0, vp);
}

static JSBool
str_localeCompare(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str, *thatStr;

    NORMALIZE_THIS(cx, vp, str);
    if (argc == 0) {
        *vp = JSVAL_ZERO;
    } else {
        thatStr = js_ValueToString(cx, vp[2]);
        if (!thatStr)
            return JS_FALSE;
        if (cx->localeCallbacks && cx->localeCallbacks->localeCompare) {
            vp[2] = STRING_TO_JSVAL(thatStr);
            return cx->localeCallbacks->localeCompare(cx, str, thatStr, vp);
        }
        *vp = INT_TO_JSVAL(js_CompareStrings(str, thatStr));
    }
    return JS_TRUE;
}

static JSBool
str_charAt(JSContext *cx, uintN argc, jsval *vp)
{
    jsval t;
    JSString *str;
    jsint i;
    jsdouble d;

    t = vp[1];
    if (JSVAL_IS_STRING(t) && argc != 0 && JSVAL_IS_INT(vp[2])) {
        str = JSVAL_TO_STRING(t);
        i = JSVAL_TO_INT(vp[2]);
        if ((size_t)i >= JSSTRING_LENGTH(str))
            goto out_of_range;
    } else {
        str = NormalizeThis(cx, vp);
        if (!str)
            return JS_FALSE;

        if (argc == 0) {
            d = 0.0;
        } else {
            d = js_ValueToNumber(cx, &vp[2]);
            if (JSVAL_IS_NULL(vp[2]))
                return JS_FALSE;
            d = js_DoubleToInteger(d);
        }

        if (d < 0 || JSSTRING_LENGTH(str) <= d)
            goto out_of_range;
        i = (jsint) d;
    }

    str = js_GetUnitString(cx, str, (size_t)i);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;

out_of_range:
    *vp = JS_GetEmptyStringValue(cx);
    return JS_TRUE;
}

static JSBool
str_charCodeAt(JSContext *cx, uintN argc, jsval *vp)
{
    jsval t;
    JSString *str;
    jsint i;
    jsdouble d;

    t = vp[1];
    if (JSVAL_IS_STRING(t) && argc != 0 && JSVAL_IS_INT(vp[2])) {
        str = JSVAL_TO_STRING(t);
        i = JSVAL_TO_INT(vp[2]);
        if ((size_t)i >= JSSTRING_LENGTH(str))
            goto out_of_range;
    } else {
        str = NormalizeThis(cx, vp);
        if (!str)
            return JS_FALSE;

        if (argc == 0) {
            d = 0.0;
        } else {
            d = js_ValueToNumber(cx, &vp[2]);
            if (JSVAL_IS_NULL(vp[2]))
                return JS_FALSE;
            d = js_DoubleToInteger(d);
        }

        if (d < 0 || JSSTRING_LENGTH(str) <= d)
            goto out_of_range;
        i = (jsint) d;
    }

    *vp = INT_TO_JSVAL(JSSTRING_CHARS(str)[i]);
    return JS_TRUE;

out_of_range:
    *vp = JS_GetNaNValue(cx);
    return JS_TRUE;
}

#ifdef JS_TRACER
int32 FASTCALL
js_String_p_charCodeAt(JSString* str, int32 i)
{
    if (i < 0 || (int32)JSSTRING_LENGTH(str) <= i)
        return -1;
    return JSSTRING_CHARS(str)[i];
}
#endif

jsint
js_BoyerMooreHorspool(const jschar *text, jsint textlen,
                      const jschar *pat, jsint patlen,
                      jsint start)
{
    jsint i, j, k, m;
    uint8 skip[BMH_CHARSET_SIZE];
    jschar c;

    JS_ASSERT(0 < patlen && patlen <= BMH_PATLEN_MAX);
    for (i = 0; i < BMH_CHARSET_SIZE; i++)
        skip[i] = (uint8)patlen;
    m = patlen - 1;
    for (i = 0; i < m; i++) {
        c = pat[i];
        if (c >= BMH_CHARSET_SIZE)
            return BMH_BAD_PATTERN;
        skip[c] = (uint8)(m - i);
    }
    for (k = start + m;
         k < textlen;
         k += ((c = text[k]) >= BMH_CHARSET_SIZE) ? patlen : skip[c]) {
        for (i = k, j = m; ; i--, j--) {
            if (j < 0)
                return i + 1;
            if (text[i] != pat[j])
                break;
        }
    }
    return -1;
}

static JSBool
str_indexOf(JSContext *cx, uintN argc, jsval *vp)
{
    jsval t;
    JSString *str, *str2;
    const jschar *text, *pat;
    jsint i, j, index, textlen, patlen;
    jsdouble d;

    t = vp[1];
    if (JSVAL_IS_STRING(t) && argc != 0 && JSVAL_IS_STRING(vp[2])) {
        str = JSVAL_TO_STRING(t);
        str2 = JSVAL_TO_STRING(vp[2]);
    } else {
        str = NormalizeThis(cx, vp);
        if (!str)
            return JS_FALSE;

        str2 = ArgToRootedString(cx, argc, vp, 0);
        if (!str2)
            return JS_FALSE;
    }

    text = JSSTRING_CHARS(str);
    textlen = (jsint) JSSTRING_LENGTH(str);
    pat = JSSTRING_CHARS(str2);
    patlen = (jsint) JSSTRING_LENGTH(str2);

    if (argc > 1) {
        d = js_ValueToNumber(cx, &vp[3]);
        if (JSVAL_IS_NULL(vp[3]))
            return JS_FALSE;
        d = js_DoubleToInteger(d);
        if (d < 0)
            i = 0;
        else if (d > textlen)
            i = textlen;
        else
            i = (jsint)d;
    } else {
        i = 0;
    }
    if (patlen == 0) {
        *vp = INT_TO_JSVAL(i);
        return JS_TRUE;
    }

    /* XXX tune the BMH threshold (512) */
    if (textlen - i >= 512 && (jsuint)(patlen - 2) <= BMH_PATLEN_MAX - 2) {
        index = js_BoyerMooreHorspool(text, textlen, pat, patlen, i);
        if (index != BMH_BAD_PATTERN)
            goto out;
    }

    index = -1;
    j = 0;
    while (i + j < textlen) {
        if (text[i + j] == pat[j]) {
            if (++j == patlen) {
                index = i;
                break;
            }
        } else {
            i++;
            j = 0;
        }
    }

out:
    *vp = INT_TO_JSVAL(index);
    return JS_TRUE;
}

static JSBool
str_lastIndexOf(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str, *str2;
    const jschar *text, *pat;
    jsint i, j, textlen, patlen;
    jsdouble d;

    NORMALIZE_THIS(cx, vp, str);
    text = JSSTRING_CHARS(str);
    textlen = (jsint) JSSTRING_LENGTH(str);

    str2 = ArgToRootedString(cx, argc, vp, 0);
    if (!str2)
        return JS_FALSE;
    pat = JSSTRING_CHARS(str2);
    patlen = (jsint) JSSTRING_LENGTH(str2);

    if (argc > 1) {
        d = js_ValueToNumber(cx, &vp[3]);
        if (JSVAL_IS_NULL(vp[3]))
            return JS_FALSE;
        if (JSDOUBLE_IS_NaN(d)) {
            i = textlen;
        } else {
            d = js_DoubleToInteger(d);
            if (d < 0)
                i = 0;
            else if (d > textlen)
                i = textlen;
            else
                i = (jsint)d;
        }
    } else {
        i = textlen;
    }

    if (patlen == 0) {
        *vp = INT_TO_JSVAL(i);
        return JS_TRUE;
    }

    j = 0;
    while (i >= 0) {
        /* Don't assume that text is NUL-terminated: it could be dependent. */
        if (i + j < textlen && text[i + j] == pat[j]) {
            if (++j == patlen)
                break;
        } else {
            i--;
            j = 0;
        }
    }
    *vp = INT_TO_JSVAL(i);
    return JS_TRUE;
}

static JSBool
js_TrimString(JSContext *cx, jsval *vp, JSBool trimLeft, JSBool trimRight)
{
    JSString *str;
    const jschar *chars;
    size_t length, begin, end;

    NORMALIZE_THIS(cx, vp, str);
    JSSTRING_CHARS_AND_LENGTH(str, chars, length);
    begin = 0;
    end = length;

    if (trimLeft) {
        while (begin < length && JS_ISSPACE(chars[begin]))
            ++begin;
    }

    if (trimRight) {
        while (end > begin && JS_ISSPACE(chars[end-1]))
            --end;
    }

    str = js_NewDependentString(cx, str, begin, end - begin);
    if (!str)
        return JS_FALSE;

    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
str_trim(JSContext *cx, uintN argc, jsval *vp)
{
    return js_TrimString(cx, vp, JS_TRUE, JS_TRUE);
}

static JSBool
str_trimLeft(JSContext *cx, uintN argc, jsval *vp)
{
    return js_TrimString(cx, vp, JS_TRUE, JS_FALSE);
}

static JSBool
str_trimRight(JSContext *cx, uintN argc, jsval *vp)
{
    return js_TrimString(cx, vp, JS_FALSE, JS_TRUE);
}

/*
 * Perl-inspired string functions.
 */
typedef struct GlobData {
    jsbytecode  *pc;            /* in: program counter resulting in us matching */
    uintN       flags;          /* inout: mode and flag bits, see below */
    uintN       optarg;         /* in: index of optional flags argument */
    JSString    *str;           /* out: 'this' parameter object as string */
    JSRegExp    *regexp;        /* out: regexp parameter object private data */
} GlobData;

/*
 * Mode and flag bit definitions for match_or_replace's GlobData.flags field.
 */
#define MODE_MATCH      0x00    /* in: return match array on success */
#define MODE_REPLACE    0x01    /* in: match and replace */
#define MODE_SEARCH     0x02    /* in: search only, return match index or -1 */
#define GET_MODE(f)     ((f) & 0x03)
#define FORCE_FLAT      0x04    /* in: force flat (non-regexp) string match */
#define KEEP_REGEXP     0x08    /* inout: keep GlobData.regexp alive for caller
                                          of match_or_replace; if set on input
                                          but clear on output, regexp ownership
                                          does not pass to caller */
#define GLOBAL_REGEXP   0x10    /* out: regexp had the 'g' flag */

static JSBool
match_or_replace(JSContext *cx,
                 JSBool (*glob)(JSContext *cx, jsint count, GlobData *data),
                 void (*destroy)(JSContext *cx, GlobData *data),
                 GlobData *data, uintN argc, jsval *vp)
{
    JSString *str, *src, *opt;
    JSObject *reobj;
    JSRegExp *re;
    size_t index, length;
    JSBool ok, test;
    jsint count;

    NORMALIZE_THIS(cx, vp, str);
    data->str = str;

    if (argc != 0 && VALUE_IS_REGEXP(cx, vp[2])) {
        reobj = JSVAL_TO_OBJECT(vp[2]);
        re = (JSRegExp *) JS_GetPrivate(cx, reobj);
    } else {
        src = ArgToRootedString(cx, argc, vp, 0);
        if (!src)
            return JS_FALSE;
        if (data->optarg < argc) {
            opt = js_ValueToString(cx, vp[2 + data->optarg]);
            if (!opt)
                return JS_FALSE;
        } else {
            opt = NULL;
        }
        re = js_NewRegExpOpt(cx, src, opt, (data->flags & FORCE_FLAT) != 0);
        if (!re)
            return JS_FALSE;
        reobj = NULL;
    }
    /* From here on, all control flow must reach the matching DROP. */
    data->regexp = re;
    HOLD_REGEXP(cx, re);

    if (re->flags & JSREG_GLOB)
        data->flags |= GLOBAL_REGEXP;
    index = 0;
    if (GET_MODE(data->flags) == MODE_SEARCH) {
        ok = js_ExecuteRegExp(cx, re, str, &index, JS_TRUE, vp);
        if (ok) {
            *vp = (*vp == JSVAL_TRUE)
                  ? INT_TO_JSVAL(cx->regExpStatics.leftContext.length)
                  : INT_TO_JSVAL(-1);
        }
    } else if (data->flags & GLOBAL_REGEXP) {
        if (reobj) {
            /* Set the lastIndex property's reserved slot to 0. */
            ok = js_SetLastIndex(cx, reobj, 0);
        } else {
            ok = JS_TRUE;
        }
        if (ok) {
            length = JSSTRING_LENGTH(str);
            for (count = 0; index <= length; count++) {
                ok = js_ExecuteRegExp(cx, re, str, &index, JS_TRUE, vp);
                if (!ok || *vp != JSVAL_TRUE)
                    break;
                ok = glob(cx, count, data);
                if (!ok)
                    break;
                if (cx->regExpStatics.lastMatch.length == 0) {
                    if (index == length)
                        break;
                    index++;
                }
            }
            if (!ok && destroy)
                destroy(cx, data);
        }
    } else {
        if (GET_MODE(data->flags) == MODE_REPLACE) {
            test = JS_TRUE;
        } else {
            /*
             * MODE_MATCH implies str_match is being called from a script or a
             * scripted function.  If the caller cares only about testing null
             * vs. non-null return value, optimize away the array object that
             * would normally be returned in *vp.
             *
             * Assume a full array result is required, then prove otherwise.
             */
            test = JS_FALSE;
            if (data->pc && (*data->pc == JSOP_CALL || *data->pc == JSOP_NEW)) {
                JS_ASSERT(js_CodeSpec[*data->pc].length == 3);
                switch (data->pc[3]) {
                  case JSOP_POP:
                  case JSOP_IFEQ:
                  case JSOP_IFNE:
                  case JSOP_IFEQX:
                  case JSOP_IFNEX:
                    test = JS_TRUE;
                    break;
                  default:;
                }
            }
        }
        ok = js_ExecuteRegExp(cx, re, str, &index, test, vp);
    }

    DROP_REGEXP(cx, re);
    if (reobj) {
        /* Tell our caller that it doesn't need to destroy data->regexp. */
        data->flags &= ~KEEP_REGEXP;
    } else if (!ok || !(data->flags & KEEP_REGEXP)) {
        /* Caller didn't want to keep data->regexp, so null and destroy it.  */
        data->regexp = NULL;
        js_DestroyRegExp(cx, re);
    }

    return ok;
}

typedef struct MatchData {
    GlobData    base;
    jsval       *arrayval;      /* NB: local root pointer */
} MatchData;

static JSBool
match_glob(JSContext *cx, jsint count, GlobData *data)
{
    MatchData *mdata;
    JSObject *arrayobj;
    JSSubString *matchsub;
    JSString *matchstr;
    jsval v;

    mdata = (MatchData *)data;
    arrayobj = JSVAL_TO_OBJECT(*mdata->arrayval);
    if (!arrayobj) {
        arrayobj = js_ConstructObject(cx, &js_ArrayClass, NULL, NULL, 0, NULL);
        if (!arrayobj)
            return JS_FALSE;
        *mdata->arrayval = OBJECT_TO_JSVAL(arrayobj);
    }
    matchsub = &cx->regExpStatics.lastMatch;
    matchstr = js_NewStringCopyN(cx, matchsub->chars, matchsub->length);
    if (!matchstr)
        return JS_FALSE;
    v = STRING_TO_JSVAL(matchstr);
    JS_ASSERT(count <= JSVAL_INT_MAX);

    JSAutoResolveFlags rf(cx, JSRESOLVE_QUALIFIED | JSRESOLVE_ASSIGNING);
    return OBJ_SET_PROPERTY(cx, arrayobj, INT_TO_JSID(count), &v);
}

JSBool
js_StringMatchHelper(JSContext *cx, uintN argc, jsval *vp, jsbytecode *pc)
{
    JSTempValueRooter tvr;
    MatchData mdata;
    JSBool ok;

    JS_PUSH_SINGLE_TEMP_ROOT(cx, JSVAL_NULL, &tvr);
    mdata.base.pc = pc;
    mdata.base.flags = MODE_MATCH;
    mdata.base.optarg = 1;
    mdata.arrayval = &tvr.u.value;
    ok = match_or_replace(cx, match_glob, NULL, &mdata.base, argc, vp);
    if (ok && !JSVAL_IS_NULL(*mdata.arrayval))
        *vp = *mdata.arrayval;
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}

static JSBool
str_match(JSContext *cx, uintN argc, jsval *vp)
{
    JSStackFrame *fp;

    for (fp = cx->fp; fp && !fp->regs; fp = fp->down)
        JS_ASSERT(!fp->script);
    return js_StringMatchHelper(cx, argc, vp, fp ? fp->regs->pc : NULL);
}

#ifdef JS_TRACER
static JSObject* FASTCALL
String_p_match(JSContext* cx, JSString* str, jsbytecode *pc, JSObject* regexp)
{
    jsval vp[3] = { JSVAL_NULL, STRING_TO_JSVAL(str), OBJECT_TO_JSVAL(regexp) };
    if (!js_StringMatchHelper(cx, 1, vp, pc))
        return (JSObject*) JSVAL_TO_BOOLEAN(JSVAL_VOID);
    JS_ASSERT(JSVAL_IS_NULL(vp[0]) ||
              (!JSVAL_IS_PRIMITIVE(vp[0]) && OBJ_IS_ARRAY(cx, JSVAL_TO_OBJECT(vp[0]))));
    return JSVAL_TO_OBJECT(vp[0]);
}

static JSObject* FASTCALL
String_p_match_obj(JSContext* cx, JSObject* str, jsbytecode *pc, JSObject* regexp)
{
    jsval vp[3] = { JSVAL_NULL, OBJECT_TO_JSVAL(str), OBJECT_TO_JSVAL(regexp) };
    if (!js_StringMatchHelper(cx, 1, vp, pc))
        return (JSObject*) JSVAL_TO_BOOLEAN(JSVAL_VOID);
    JS_ASSERT(JSVAL_IS_NULL(vp[0]) ||
              (!JSVAL_IS_PRIMITIVE(vp[0]) && OBJ_IS_ARRAY(cx, JSVAL_TO_OBJECT(vp[0]))));
    return JSVAL_TO_OBJECT(vp[0]);
}
#endif

static JSBool
str_search(JSContext *cx, uintN argc, jsval *vp)
{
    GlobData data;

    data.flags = MODE_SEARCH;
    data.optarg = 1;
    return match_or_replace(cx, NULL, NULL, &data, argc, vp);
}

typedef struct ReplaceData {
    GlobData    base;           /* base struct state */
    JSObject    *lambda;        /* replacement function object or null */
    JSString    *repstr;        /* replacement string */
    jschar      *dollar;        /* null or pointer to first $ in repstr */
    jschar      *dollarEnd;     /* limit pointer for js_strchr_limit */
    jschar      *chars;         /* result chars, null initially */
    size_t      length;         /* result length, 0 initially */
    jsint       index;          /* index in result of next replacement */
    jsint       leftIndex;      /* left context index in base.str->chars */
    JSSubString dollarStr;      /* for "$$" interpret_dollar result */
} ReplaceData;

static JSSubString *
interpret_dollar(JSContext *cx, jschar *dp, jschar *ep, ReplaceData *rdata,
                 size_t *skip)
{
    JSRegExpStatics *res;
    jschar dc, *cp;
    uintN num, tmp;

    JS_ASSERT(*dp == '$');

    /* If there is only a dollar, bail now */
    if (dp + 1 >= ep)
        return NULL;

    /* Interpret all Perl match-induced dollar variables. */
    res = &cx->regExpStatics;
    dc = dp[1];
    if (JS7_ISDEC(dc)) {
        /* ECMA-262 Edition 3: 1-9 or 01-99 */
        num = JS7_UNDEC(dc);
        if (num > res->parenCount)
            return NULL;

        cp = dp + 2;
        if (cp < ep && (dc = *cp, JS7_ISDEC(dc))) {
            tmp = 10 * num + JS7_UNDEC(dc);
            if (tmp <= res->parenCount) {
                cp++;
                num = tmp;
            }
        }
        if (num == 0)
            return NULL;

        /* Adjust num from 1 $n-origin to 0 array-index-origin. */
        num--;
        *skip = cp - dp;
        return REGEXP_PAREN_SUBSTRING(res, num);
    }

    *skip = 2;
    switch (dc) {
      case '$':
        rdata->dollarStr.chars = dp;
        rdata->dollarStr.length = 1;
        return &rdata->dollarStr;
      case '&':
        return &res->lastMatch;
      case '+':
        return &res->lastParen;
      case '`':
        return &res->leftContext;
      case '\'':
        return &res->rightContext;
    }
    return NULL;
}

static JSBool
find_replen(JSContext *cx, ReplaceData *rdata, size_t *sizep)
{
    JSString *repstr;
    size_t replen, skip;
    jschar *dp, *ep;
    JSSubString *sub;
    JSObject *lambda;

    lambda = rdata->lambda;
    if (lambda) {
        uintN argc, i, j, m, n, p;
        jsval *invokevp, *sp;
        void *mark;
        JSBool ok;

        /*
         * Save the regExpStatics from the current regexp, since they may be
         * clobbered by a RegExp usage in the lambda function.  Note that all
         * members of JSRegExpStatics are JSSubStrings, so not GC roots, save
         * input, which is rooted otherwise via vp[1] in str_replace.
         */
        JSRegExpStatics save = cx->regExpStatics;
        JSBool freeMoreParens = JS_FALSE;

        /*
         * In the lambda case, not only do we find the replacement string's
         * length, we compute repstr and return it via rdata for use within
         * do_replace.  The lambda is called with arguments ($&, $1, $2, ...,
         * index, input), i.e., all the properties of a regexp match array.
         * For $&, etc., we must create string jsvals from cx->regExpStatics.
         * We grab up stack space to keep the newborn strings GC-rooted.
         */
        p = rdata->base.regexp->parenCount;
        argc = 1 + p + 2;
        invokevp = js_AllocStack(cx, 2 + argc, &mark);
        if (!invokevp)
            return JS_FALSE;

        /* Push lambda and its 'this' parameter. */
        sp = invokevp;
        *sp++ = OBJECT_TO_JSVAL(lambda);
        *sp++ = OBJECT_TO_JSVAL(OBJ_GET_PARENT(cx, lambda));

#define PUSH_REGEXP_STATIC(sub)                                               \
    JS_BEGIN_MACRO                                                            \
        JSString *str = js_NewStringCopyN(cx,                                 \
                                          cx->regExpStatics.sub.chars,        \
                                          cx->regExpStatics.sub.length);      \
        if (!str) {                                                           \
            ok = JS_FALSE;                                                    \
            goto lambda_out;                                                  \
        }                                                                     \
        *sp++ = STRING_TO_JSVAL(str);                                         \
    JS_END_MACRO

        /* Push $&, $1, $2, ... */
        PUSH_REGEXP_STATIC(lastMatch);
        i = 0;
        m = cx->regExpStatics.parenCount;
        n = JS_MIN(m, 9);
        for (j = 0; i < n; i++, j++)
            PUSH_REGEXP_STATIC(parens[j]);
        for (j = 0; i < m; i++, j++)
            PUSH_REGEXP_STATIC(moreParens[j]);

        /*
         * We need to clear moreParens in the top-of-stack cx->regExpStatics
         * to it won't be possibly realloc'ed, leaving the bottom-of-stack
         * moreParens pointing to freed memory.
         */
        cx->regExpStatics.moreParens = NULL;
        freeMoreParens = JS_TRUE;

#undef PUSH_REGEXP_STATIC

        /* Make sure to push undefined for any unmatched parens. */
        for (; i < p; i++)
            *sp++ = JSVAL_VOID;

        /* Push match index and input string. */
        *sp++ = INT_TO_JSVAL((jsint)cx->regExpStatics.leftContext.length);
        *sp++ = STRING_TO_JSVAL(rdata->base.str);

        ok = js_Invoke(cx, argc, invokevp, 0);
        if (ok) {
            /*
             * NB: we count on the newborn string root to hold any string
             * created by this js_ValueToString that would otherwise be GC-
             * able, until we use rdata->repstr in do_replace.
             */
            repstr = js_ValueToString(cx, *invokevp);
            if (!repstr) {
                ok = JS_FALSE;
            } else {
                rdata->repstr = repstr;
                *sizep = JSSTRING_LENGTH(repstr);
            }
        }

      lambda_out:
        js_FreeStack(cx, mark);
        if (freeMoreParens)
            JS_free(cx, cx->regExpStatics.moreParens);
        cx->regExpStatics = save;
        return ok;
    }

    repstr = rdata->repstr;
    replen = JSSTRING_LENGTH(repstr);
    for (dp = rdata->dollar, ep = rdata->dollarEnd; dp;
         dp = js_strchr_limit(dp, '$', ep)) {
        sub = interpret_dollar(cx, dp, ep, rdata, &skip);
        if (sub) {
            replen += sub->length - skip;
            dp += skip;
        }
        else
            dp++;
    }
    *sizep = replen;
    return JS_TRUE;
}

static void
do_replace(JSContext *cx, ReplaceData *rdata, jschar *chars)
{
    JSString *repstr;
    jschar *bp, *cp, *dp, *ep;
    size_t len, skip;
    JSSubString *sub;

    repstr = rdata->repstr;
    bp = cp = JSSTRING_CHARS(repstr);
    for (dp = rdata->dollar, ep = rdata->dollarEnd; dp;
         dp = js_strchr_limit(dp, '$', ep)) {
        len = dp - cp;
        js_strncpy(chars, cp, len);
        chars += len;
        cp = dp;
        sub = interpret_dollar(cx, dp, ep, rdata, &skip);
        if (sub) {
            len = sub->length;
            js_strncpy(chars, sub->chars, len);
            chars += len;
            cp += skip;
            dp += skip;
        } else {
            dp++;
        }
    }
    js_strncpy(chars, cp, JSSTRING_LENGTH(repstr) - (cp - bp));
}

static void
replace_destroy(JSContext *cx, GlobData *data)
{
    ReplaceData *rdata;

    rdata = (ReplaceData *)data;
    JS_free(cx, rdata->chars);
    rdata->chars = NULL;
}

static JSBool
replace_glob(JSContext *cx, jsint count, GlobData *data)
{
    ReplaceData *rdata;
    JSString *str;
    size_t leftoff, leftlen, replen, growth;
    const jschar *left;
    jschar *chars;

    rdata = (ReplaceData *)data;
    str = data->str;
    leftoff = rdata->leftIndex;
    left = JSSTRING_CHARS(str) + leftoff;
    leftlen = cx->regExpStatics.lastMatch.chars - left;
    rdata->leftIndex = cx->regExpStatics.lastMatch.chars - JSSTRING_CHARS(str);
    rdata->leftIndex += cx->regExpStatics.lastMatch.length;
    if (!find_replen(cx, rdata, &replen))
        return JS_FALSE;
    growth = leftlen + replen;
    chars = (jschar *)
        (rdata->chars
         ? JS_realloc(cx, rdata->chars, (rdata->length + growth + 1)
                                        * sizeof(jschar))
         : JS_malloc(cx, (growth + 1) * sizeof(jschar)));
    if (!chars)
        return JS_FALSE;
    rdata->chars = chars;
    rdata->length += growth;
    chars += rdata->index;
    rdata->index += growth;
    js_strncpy(chars, left, leftlen);
    chars += leftlen;
    do_replace(cx, rdata, chars);
    return JS_TRUE;
}

static JSBool
str_replace(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *lambda;
    JSString *repstr;

    if (argc >= 2 && JS_TypeOfValue(cx, vp[3]) == JSTYPE_FUNCTION) {
        lambda = JSVAL_TO_OBJECT(vp[3]);
        repstr = NULL;
    } else {
        lambda = NULL;
        repstr = ArgToRootedString(cx, argc, vp, 1);
        if (!repstr)
            return JS_FALSE;
    }

    return js_StringReplaceHelper(cx, argc, lambda, repstr, vp);
}

#ifdef JS_TRACER
static JSString* FASTCALL
String_p_replace_str(JSContext* cx, JSString* str, JSObject* regexp, JSString* repstr)
{
    jsval vp[4] = {
        JSVAL_NULL, STRING_TO_JSVAL(str), OBJECT_TO_JSVAL(regexp), STRING_TO_JSVAL(repstr)
    };
    if (!js_StringReplaceHelper(cx, 2, NULL, repstr, vp))
        return NULL;
    JS_ASSERT(JSVAL_IS_STRING(vp[0]));
    return JSVAL_TO_STRING(vp[0]);
}

static JSString* FASTCALL
String_p_replace_str2(JSContext* cx, JSString* str, JSString* patstr, JSString* repstr)
{
    jsval vp[4] = {
        JSVAL_NULL, STRING_TO_JSVAL(str), STRING_TO_JSVAL(patstr), STRING_TO_JSVAL(repstr)
    };
    if (!js_StringReplaceHelper(cx, 2, NULL, repstr, vp))
        return NULL;
    JS_ASSERT(JSVAL_IS_STRING(vp[0]));
    return JSVAL_TO_STRING(vp[0]);
}

static JSString* FASTCALL
String_p_replace_str3(JSContext* cx, JSString* str, JSString* patstr, JSString* repstr,
                      JSString* flagstr)
{
    jsval vp[5] = {
        JSVAL_NULL, STRING_TO_JSVAL(str), STRING_TO_JSVAL(patstr), STRING_TO_JSVAL(repstr),
        STRING_TO_JSVAL(flagstr)
    };
    if (!js_StringReplaceHelper(cx, 3, NULL, repstr, vp))
        return NULL;
    JS_ASSERT(JSVAL_IS_STRING(vp[0]));
    return JSVAL_TO_STRING(vp[0]);
}
#endif

JSBool
js_StringReplaceHelper(JSContext *cx, uintN argc, JSObject *lambda,
                       JSString *repstr, jsval *vp)
{
    ReplaceData rdata;
    JSBool ok;
    size_t leftlen, rightlen, length;
    jschar *chars;
    JSString *str;

    /*
     * For ECMA Edition 3, the first argument is to be converted to a string
     * to match in a "flat" sense (without regular expression metachars having
     * special meanings) UNLESS the first arg is a RegExp object.
     */
    rdata.base.flags = MODE_REPLACE | KEEP_REGEXP | FORCE_FLAT;
    rdata.base.optarg = 2;

    rdata.lambda = lambda;
    rdata.repstr = repstr;
    if (repstr) {
        rdata.dollarEnd = JSSTRING_CHARS(repstr) + JSSTRING_LENGTH(repstr);
        rdata.dollar = js_strchr_limit(JSSTRING_CHARS(repstr), '$',
                                       rdata.dollarEnd);
    } else {
        rdata.dollar = rdata.dollarEnd = NULL;
    }
    rdata.chars = NULL;
    rdata.length = 0;
    rdata.index = 0;
    rdata.leftIndex = 0;

    ok = match_or_replace(cx, replace_glob, replace_destroy, &rdata.base,
                          argc, vp);
    if (!ok)
        return JS_FALSE;

    if (!rdata.chars) {
        if ((rdata.base.flags & GLOBAL_REGEXP) || *vp != JSVAL_TRUE) {
            /* Didn't match even once. */
            *vp = STRING_TO_JSVAL(rdata.base.str);
            goto out;
        }
        leftlen = cx->regExpStatics.leftContext.length;
        ok = find_replen(cx, &rdata, &length);
        if (!ok)
            goto out;
        length += leftlen;
        chars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
        if (!chars) {
            ok = JS_FALSE;
            goto out;
        }
        js_strncpy(chars, cx->regExpStatics.leftContext.chars, leftlen);
        do_replace(cx, &rdata, chars + leftlen);
        rdata.chars = chars;
        rdata.length = length;
    }

    rightlen = cx->regExpStatics.rightContext.length;
    length = rdata.length + rightlen;
    chars = (jschar *)
        JS_realloc(cx, rdata.chars, (length + 1) * sizeof(jschar));
    if (!chars) {
        JS_free(cx, rdata.chars);
        ok = JS_FALSE;
        goto out;
    }
    js_strncpy(chars + rdata.length, cx->regExpStatics.rightContext.chars,
               rightlen);
    chars[length] = 0;

    str = js_NewString(cx, chars, length);
    if (!str) {
        JS_free(cx, chars);
        ok = JS_FALSE;
        goto out;
    }
    *vp = STRING_TO_JSVAL(str);

out:
    /* If KEEP_REGEXP is still set, it's our job to destroy regexp now. */
    if (rdata.base.flags & KEEP_REGEXP)
        js_DestroyRegExp(cx, rdata.base.regexp);
    return ok;
}

/*
 * Subroutine used by str_split to find the next split point in str, starting
 * at offset *ip and looking either for the separator substring given by sep, or
 * for the next re match.  In the re case, return the matched separator in *sep,
 * and the possibly updated offset in *ip.
 *
 * Return -2 on error, -1 on end of string, >= 0 for a valid index of the next
 * separator occurrence if found, or str->length if no separator is found.
 */
static jsint
find_split(JSContext *cx, JSString *str, JSRegExp *re, jsint *ip,
           JSSubString *sep)
{
    jsint i, j, k;
    size_t length;
    jschar *chars;

    /*
     * Stop if past end of string.  If at end of string, we will compare the
     * null char stored there (by js_NewString*) to sep->chars[j] in the while
     * loop at the end of this function, so that
     *
     *  "ab,".split(',') => ["ab", ""]
     *
     * and the resulting array converts back to the string "ab," for symmetry.
     * However, we ape Perl and do this only if there is a sufficiently large
     * limit argument (see str_split).
     */
    i = *ip;
    length = JSSTRING_LENGTH(str);
    if ((size_t)i > length)
        return -1;

    chars = JSSTRING_CHARS(str);

    /*
     * Match a regular expression against the separator at or above index i.
     * Call js_ExecuteRegExp with true for the test argument.  On successful
     * match, get the separator from cx->regExpStatics.lastMatch.
     */
    if (re) {
        size_t index;
        jsval rval;

      again:
        /* JS1.2 deviated from Perl by never matching at end of string. */
        index = (size_t)i;
        if (!js_ExecuteRegExp(cx, re, str, &index, JS_TRUE, &rval))
            return -2;
        if (rval != JSVAL_TRUE) {
            /* Mismatch: ensure our caller advances i past end of string. */
            sep->length = 1;
            return length;
        }
        i = (jsint)index;
        *sep = cx->regExpStatics.lastMatch;
        if (sep->length == 0) {
            /*
             * Empty string match: never split on an empty match at the start
             * of a find_split cycle.  Same rule as for an empty global match
             * in match_or_replace.
             */
            if (i == *ip) {
                /*
                 * "Bump-along" to avoid sticking at an empty match, but don't
                 * bump past end of string -- our caller must do that by adding
                 * sep->length to our return value.
                 */
                if ((size_t)i == length)
                    return -1;
                i++;
                goto again;
            }
            if ((size_t)i == length) {
                /*
                 * If there was a trivial zero-length match at the end of the
                 * split, then we shouldn't output the matched string at the end
                 * of the split array. See ECMA-262 Ed. 3, 15.5.4.14, Step 15.
                 */
                sep->chars = NULL;
            }
        }
        JS_ASSERT((size_t)i >= sep->length);
        return i - sep->length;
    }

    /*
     * Special case: if sep is the empty string, split str into one character
     * substrings.  Let our caller worry about whether to split once at end of
     * string into an empty substring.
     */
    if (sep->length == 0)
        return ((size_t)i == length) ? -1 : i + 1;

    /*
     * Now that we know sep is non-empty, search starting at i in str for an
     * occurrence of all of sep's chars.  If we find them, return the index of
     * the first separator char.  Otherwise, return length.
     */
    j = 0;
    while ((size_t)(k = i + j) < length) {
        if (chars[k] == sep->chars[j]) {
            if ((size_t)++j == sep->length)
                return i;
        } else {
            i++;
            j = 0;
        }
    }
    return k;
}

static JSBool
str_split(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str, *sub;
    JSObject *arrayobj;
    jsval v;
    JSBool ok, limited;
    JSRegExp *re;
    JSSubString *sep, tmp;
    jsdouble d;
    jsint i, j;
    uint32 len, limit;

    NORMALIZE_THIS(cx, vp, str);

    arrayobj = js_ConstructObject(cx, &js_ArrayClass, NULL, NULL, 0, NULL);
    if (!arrayobj)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(arrayobj);

    if (argc == 0) {
        v = STRING_TO_JSVAL(str);
        ok = OBJ_SET_PROPERTY(cx, arrayobj, INT_TO_JSID(0), &v);
    } else {
        if (VALUE_IS_REGEXP(cx, vp[2])) {
            re = (JSRegExp *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(vp[2]));
            sep = &tmp;

            /* Set a magic value so we can detect a successful re match. */
            sep->chars = NULL;
            sep->length = 0;
        } else {
            JSString *str2 = js_ValueToString(cx, vp[2]);
            if (!str2)
                return JS_FALSE;
            vp[2] = STRING_TO_JSVAL(str2);

            /*
             * Point sep at a local copy of str2's header because find_split
             * will modify sep->length.
             */
            JSSTRING_CHARS_AND_LENGTH(str2, tmp.chars, tmp.length);
            sep = &tmp;
            re = NULL;
        }

        /* Use the second argument as the split limit, if given. */
        limited = (argc > 1) && !JSVAL_IS_VOID(vp[3]);
        limit = 0; /* Avoid warning. */
        if (limited) {
            d = js_ValueToNumber(cx, &vp[3]);
            if (JSVAL_IS_NULL(vp[3]))
                return JS_FALSE;

            /* Clamp limit between 0 and 1 + string length. */
            limit = js_DoubleToECMAUint32(d);
            if (limit > JSSTRING_LENGTH(str))
                limit = 1 + JSSTRING_LENGTH(str);
        }

        len = i = 0;
        while ((j = find_split(cx, str, re, &i, sep)) >= 0) {
            if (limited && len >= limit)
                break;
            sub = js_NewDependentString(cx, str, i, (size_t)(j - i));
            if (!sub)
                return JS_FALSE;
            v = STRING_TO_JSVAL(sub);
            if (!JS_SetElement(cx, arrayobj, len, &v))
                return JS_FALSE;
            len++;

            /*
             * Imitate perl's feature of including parenthesized substrings
             * that matched part of the delimiter in the new array, after the
             * split substring that was delimited.
             */
            if (re && sep->chars) {
                uintN num;
                JSSubString *parsub;

                for (num = 0; num < cx->regExpStatics.parenCount; num++) {
                    if (limited && len >= limit)
                        break;
                    parsub = REGEXP_PAREN_SUBSTRING(&cx->regExpStatics, num);
                    sub = js_NewStringCopyN(cx, parsub->chars, parsub->length);
                    if (!sub)
                        return JS_FALSE;
                    v = STRING_TO_JSVAL(sub);
                    if (!JS_SetElement(cx, arrayobj, len, &v))
                        return JS_FALSE;
                    len++;
                }
                sep->chars = NULL;
            }
            i = j + sep->length;
        }
        ok = (j != -2);
    }
    return ok;
}

#ifdef JS_TRACER
static JSObject* FASTCALL
String_p_split(JSContext* cx, JSString* str, JSString* sepstr)
{
    // FIXME: Avoid building and then parsing this array.
    jsval vp[4] = { JSVAL_NULL, STRING_TO_JSVAL(str), STRING_TO_JSVAL(sepstr), JSVAL_VOID };
    if (!str_split(cx, 2, vp))
        return NULL;
    JS_ASSERT(JSVAL_IS_OBJECT(vp[0]));
    return JSVAL_TO_OBJECT(vp[0]);
}
#endif

#if JS_HAS_PERL_SUBSTR
static JSBool
str_substr(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;
    jsdouble d;
    jsdouble length, begin, end;

    NORMALIZE_THIS(cx, vp, str);
    if (argc != 0) {
        d = js_ValueToNumber(cx, &vp[2]);
        if (JSVAL_IS_NULL(vp[2]))
            return JS_FALSE;
        length = JSSTRING_LENGTH(str);
        begin = js_DoubleToInteger(d);
        if (begin < 0) {
            begin += length;
            if (begin < 0)
                begin = 0;
        } else if (begin > length) {
            begin = length;
        }

        if (argc == 1) {
            end = length;
        } else {
            d = js_ValueToNumber(cx, &vp[3]);
            if (JSVAL_IS_NULL(vp[3]))
                return JS_FALSE;
            end = js_DoubleToInteger(d);
            if (end < 0)
                end = 0;
            end += begin;
            if (end > length)
                end = length;
        }

        str = js_NewDependentString(cx, str,
                                    (size_t)begin,
                                    (size_t)(end - begin));
        if (!str)
            return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}
#endif /* JS_HAS_PERL_SUBSTR */

/*
 * Python-esque sequence operations.
 */
static JSBool
str_concat(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str, *str2;
    jsval *argv;
    uintN i;

    NORMALIZE_THIS(cx, vp, str);

    for (i = 0, argv = vp + 2; i < argc; i++) {
        str2 = js_ValueToString(cx, argv[i]);
        if (!str2)
            return JS_FALSE;
        argv[i] = STRING_TO_JSVAL(str2);

        str = js_ConcatStrings(cx, str, str2);
        if (!str)
            return JS_FALSE;
    }

    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#ifdef JS_TRACER
static JSString* FASTCALL
String_p_concat_1int(JSContext* cx, JSString* str, int32 i)
{
    // FIXME: should be able to use stack buffer and avoid istr...
    JSString* istr = js_NumberToString(cx, i);
    if (!istr)
        return NULL;
    return js_ConcatStrings(cx, str, istr);
}

static JSString* FASTCALL
String_p_concat_2str(JSContext* cx, JSString* str, JSString* a, JSString* b)
{
    str = js_ConcatStrings(cx, str, a);
    if (str)
        return js_ConcatStrings(cx, str, b);
    return NULL;
}

static JSString* FASTCALL
String_p_concat_3str(JSContext* cx, JSString* str, JSString* a, JSString* b, JSString* c)
{
    str = js_ConcatStrings(cx, str, a);
    if (str) {
        str = js_ConcatStrings(cx, str, b);
        if (str)
            return js_ConcatStrings(cx, str, c);
    }
    return NULL;
}
#endif

static JSBool
str_slice(JSContext *cx, uintN argc, jsval *vp)
{
    jsval t, v;
    JSString *str;

    t = vp[1];
    v = vp[2];
    if (argc == 1 && JSVAL_IS_STRING(t) && JSVAL_IS_INT(v)) {
        size_t begin, end, length;

        str = JSVAL_TO_STRING(t);
        begin = JSVAL_TO_INT(v);
        end = JSSTRING_LENGTH(str);
        if (begin <= end) {
            length = end - begin;
            if (length == 0) {
                str = cx->runtime->emptyString;
            } else {
                str = (length == 1)
                      ? js_GetUnitString(cx, str, begin)
                      : js_NewDependentString(cx, str, begin, length);
                if (!str)
                    return JS_FALSE;
            }
            *vp = STRING_TO_JSVAL(str);
            return JS_TRUE;
        }
    }

    NORMALIZE_THIS(cx, vp, str);

    if (argc != 0) {
        double begin, end, length;

        begin = js_ValueToNumber(cx, &vp[2]);
        if (JSVAL_IS_NULL(vp[2]))
            return JS_FALSE;
        begin = js_DoubleToInteger(begin);
        length = JSSTRING_LENGTH(str);
        if (begin < 0) {
            begin += length;
            if (begin < 0)
                begin = 0;
        } else if (begin > length) {
            begin = length;
        }

        if (argc == 1) {
            end = length;
        } else {
            end = js_ValueToNumber(cx, &vp[3]);
            if (JSVAL_IS_NULL(vp[3]))
                return JS_FALSE;
            end = js_DoubleToInteger(end);
            if (end < 0) {
                end += length;
                if (end < 0)
                    end = 0;
            } else if (end > length) {
                end = length;
            }
            if (end < begin)
                end = begin;
        }

        str = js_NewDependentString(cx, str,
                                    (size_t)begin,
                                    (size_t)(end - begin));
        if (!str)
            return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#if JS_HAS_STR_HTML_HELPERS
/*
 * HTML composition aids.
 */
static JSBool
tagify(JSContext *cx, const char *begin, JSString *param, const char *end,
       jsval *vp)
{
    JSString *str;
    jschar *tagbuf;
    size_t beglen, endlen, parlen, taglen;
    size_t i, j;

    NORMALIZE_THIS(cx, vp, str);

    if (!end)
        end = begin;

    beglen = strlen(begin);
    taglen = 1 + beglen + 1;                            /* '<begin' + '>' */
    parlen = 0; /* Avoid warning. */
    if (param) {
        parlen = JSSTRING_LENGTH(param);
        taglen += 2 + parlen + 1;                       /* '="param"' */
    }
    endlen = strlen(end);
    taglen += JSSTRING_LENGTH(str) + 2 + endlen + 1;    /* 'str</end>' */

    if (taglen >= ~(size_t)0 / sizeof(jschar)) {
        js_ReportAllocationOverflow(cx);
        return JS_FALSE;
    }

    tagbuf = (jschar *) JS_malloc(cx, (taglen + 1) * sizeof(jschar));
    if (!tagbuf)
        return JS_FALSE;

    j = 0;
    tagbuf[j++] = '<';
    for (i = 0; i < beglen; i++)
        tagbuf[j++] = (jschar)begin[i];
    if (param) {
        tagbuf[j++] = '=';
        tagbuf[j++] = '"';
        js_strncpy(&tagbuf[j], JSSTRING_CHARS(param), parlen);
        j += parlen;
        tagbuf[j++] = '"';
    }
    tagbuf[j++] = '>';
    js_strncpy(&tagbuf[j], JSSTRING_CHARS(str), JSSTRING_LENGTH(str));
    j += JSSTRING_LENGTH(str);
    tagbuf[j++] = '<';
    tagbuf[j++] = '/';
    for (i = 0; i < endlen; i++)
        tagbuf[j++] = (jschar)end[i];
    tagbuf[j++] = '>';
    JS_ASSERT(j == taglen);
    tagbuf[j] = 0;

    str = js_NewString(cx, tagbuf, taglen);
    if (!str) {
        free((char *)tagbuf);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
tagify_value(JSContext *cx, uintN argc, jsval *vp,
             const char *begin, const char *end)
{
    JSString *param;

    param = ArgToRootedString(cx, argc, vp, 0);
    if (!param)
        return JS_FALSE;
    return tagify(cx, begin, param, end, vp);
}

static JSBool
str_bold(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "b", NULL, NULL, vp);
}

static JSBool
str_italics(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "i", NULL, NULL, vp);
}

static JSBool
str_fixed(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "tt", NULL, NULL, vp);
}

static JSBool
str_fontsize(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify_value(cx, argc, vp, "font size", "font");
}

static JSBool
str_fontcolor(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify_value(cx, argc, vp, "font color", "font");
}

static JSBool
str_link(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify_value(cx, argc, vp, "a href", "a");
}

static JSBool
str_anchor(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify_value(cx, argc, vp, "a name", "a");
}

static JSBool
str_strike(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "strike", NULL, NULL, vp);
}

static JSBool
str_small(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "small", NULL, NULL, vp);
}

static JSBool
str_big(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "big", NULL, NULL, vp);
}

static JSBool
str_blink(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "blink", NULL, NULL, vp);
}

static JSBool
str_sup(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "sup", NULL, NULL, vp);
}

static JSBool
str_sub(JSContext *cx, uintN argc, jsval *vp)
{
    return tagify(cx, "sub", NULL, NULL, vp);
}
#endif /* JS_HAS_STR_HTML_HELPERS */

#ifdef JS_TRACER
JSString* FASTCALL
js_String_getelem(JSContext* cx, JSString* str, int32 i)
{
    if ((size_t)i >= JSSTRING_LENGTH(str))
        return NULL;
    return js_GetUnitString(cx, str, (size_t)i);
}
#endif

JS_DEFINE_CALLINFO_2(extern, BOOL,   js_EqualStrings, STRING, STRING,                       1, 1)
JS_DEFINE_CALLINFO_2(extern, INT32,  js_CompareStrings, STRING, STRING,                     1, 1)

JS_DEFINE_TRCINFO_1(str_toString,
    (2, (extern, STRING_FAIL,      String_p_toString, CONTEXT, THIS,                        1, 1)))
JS_DEFINE_TRCINFO_2(str_substring,
    (4, (static, STRING_FAIL,      String_p_substring, CONTEXT, THIS_STRING, INT32, INT32,   1, 1)),
    (3, (static, STRING_FAIL,      String_p_substring_1, CONTEXT, THIS_STRING, INT32,        1, 1)))
JS_DEFINE_TRCINFO_1(str_charAt,
    (3, (extern, STRING_FAIL,      js_String_getelem, CONTEXT, THIS_STRING, INT32,           1, 1)))
JS_DEFINE_TRCINFO_1(str_charCodeAt,
    (2, (extern, INT32_FAIL,       js_String_p_charCodeAt, THIS_STRING, INT32,               1, 1)))
JS_DEFINE_TRCINFO_4(str_concat,
    (3, (static, STRING_FAIL,      String_p_concat_1int, CONTEXT, THIS_STRING, INT32,        1, 1)),
    (3, (extern, STRING_FAIL,      js_ConcatStrings, CONTEXT, THIS_STRING, STRING,           1, 1)),
    (4, (static, STRING_FAIL,      String_p_concat_2str, CONTEXT, THIS_STRING, STRING, STRING, 1, 1)),
    (5, (static, STRING_FAIL,      String_p_concat_3str, CONTEXT, THIS_STRING, STRING, STRING, STRING, 1, 1)))
JS_DEFINE_TRCINFO_2(str_match,
    (4, (static, OBJECT_FAIL_VOID, String_p_match, CONTEXT, THIS_STRING, PC, REGEXP,         1, 1)),
    (4, (static, OBJECT_FAIL_VOID, String_p_match_obj, CONTEXT, THIS, PC, REGEXP,            1, 1)))
JS_DEFINE_TRCINFO_3(str_replace,
    (4, (static, STRING_FAIL,      String_p_replace_str, CONTEXT, THIS_STRING, REGEXP, STRING, 1, 1)),
    (4, (static, STRING_FAIL,      String_p_replace_str2, CONTEXT, THIS_STRING, STRING, STRING, 1, 1)),
    (5, (static, STRING_FAIL,      String_p_replace_str3, CONTEXT, THIS_STRING, STRING, STRING, STRING, 1, 1)))
JS_DEFINE_TRCINFO_1(str_split,
    (3, (static, OBJECT_FAIL_NULL, String_p_split, CONTEXT, THIS_STRING, STRING,             0, 0)))
JS_DEFINE_TRCINFO_1(str_toLowerCase,
    (2, (extern, STRING_FAIL,      js_toLowerCase, CONTEXT, THIS_STRING,                     1, 1)))
JS_DEFINE_TRCINFO_1(str_toUpperCase,
    (2, (extern, STRING_FAIL,      js_toUpperCase, CONTEXT, THIS_STRING,                     1, 1)))

#define GENERIC           JSFUN_GENERIC_NATIVE
#define PRIMITIVE         JSFUN_THISP_PRIMITIVE
#define GENERIC_PRIMITIVE (GENERIC | PRIMITIVE)

static JSFunctionSpec string_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN("quote",             str_quote,             0,GENERIC_PRIMITIVE),
    JS_FN(js_toSource_str,     str_toSource,          0,JSFUN_THISP_STRING),
#endif

    /* Java-like methods. */
    JS_TN(js_toString_str,     str_toString,          0,JSFUN_THISP_STRING, str_toString_trcinfo),
    JS_FN(js_valueOf_str,      str_toString,          0,JSFUN_THISP_STRING),
    JS_FN(js_toJSON_str,       str_toString,          0,JSFUN_THISP_STRING),
    JS_TN("substring",         str_substring,         2,GENERIC_PRIMITIVE, str_substring_trcinfo),
    JS_TN("toLowerCase",       str_toLowerCase,       0,GENERIC_PRIMITIVE, str_toLowerCase_trcinfo),
    JS_TN("toUpperCase",       str_toUpperCase,       0,GENERIC_PRIMITIVE, str_toUpperCase_trcinfo),
    JS_TN("charAt",            str_charAt,            1,GENERIC_PRIMITIVE, str_charAt_trcinfo),
    JS_TN("charCodeAt",        str_charCodeAt,        1,GENERIC_PRIMITIVE, str_charCodeAt_trcinfo),
    JS_FN("indexOf",           str_indexOf,           1,GENERIC_PRIMITIVE),
    JS_FN("lastIndexOf",       str_lastIndexOf,       1,GENERIC_PRIMITIVE),
    JS_FN("trim",              str_trim,              0,GENERIC_PRIMITIVE),
    JS_FN("trimLeft",          str_trimLeft,          0,GENERIC_PRIMITIVE),
    JS_FN("trimRight",         str_trimRight,         0,GENERIC_PRIMITIVE),
    JS_FN("toLocaleLowerCase", str_toLocaleLowerCase, 0,GENERIC_PRIMITIVE),
    JS_FN("toLocaleUpperCase", str_toLocaleUpperCase, 0,GENERIC_PRIMITIVE),
    JS_FN("localeCompare",     str_localeCompare,     1,GENERIC_PRIMITIVE),

    /* Perl-ish methods (search is actually Python-esque). */
    JS_TN("match",             str_match,             1,GENERIC_PRIMITIVE, str_match_trcinfo),
    JS_FN("search",            str_search,            1,GENERIC_PRIMITIVE),
    JS_TN("replace",           str_replace,           2,GENERIC_PRIMITIVE, str_replace_trcinfo),
    JS_TN("split",             str_split,             2,GENERIC_PRIMITIVE, str_split_trcinfo),
#if JS_HAS_PERL_SUBSTR
    JS_FN("substr",            str_substr,            2,GENERIC_PRIMITIVE),
#endif

    /* Python-esque sequence methods. */
    JS_TN("concat",            str_concat,            1,GENERIC_PRIMITIVE, str_concat_trcinfo),
    JS_FN("slice",             str_slice,             2,GENERIC_PRIMITIVE),

    /* HTML string methods. */
#if JS_HAS_STR_HTML_HELPERS
    JS_FN("bold",              str_bold,              0,PRIMITIVE),
    JS_FN("italics",           str_italics,           0,PRIMITIVE),
    JS_FN("fixed",             str_fixed,             0,PRIMITIVE),
    JS_FN("fontsize",          str_fontsize,          1,PRIMITIVE),
    JS_FN("fontcolor",         str_fontcolor,         1,PRIMITIVE),
    JS_FN("link",              str_link,              1,PRIMITIVE),
    JS_FN("anchor",            str_anchor,            1,PRIMITIVE),
    JS_FN("strike",            str_strike,            0,PRIMITIVE),
    JS_FN("small",             str_small,             0,PRIMITIVE),
    JS_FN("big",               str_big,               0,PRIMITIVE),
    JS_FN("blink",             str_blink,             0,PRIMITIVE),
    JS_FN("sup",               str_sup,               0,PRIMITIVE),
    JS_FN("sub",               str_sub,               0,PRIMITIVE),
#endif

    JS_FS_END
};

static JSBool
String(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;

    if (argc > 0) {
        str = js_ValueToString(cx, argv[0]);
        if (!str)
            return JS_FALSE;
        argv[0] = STRING_TO_JSVAL(str);
    } else {
        str = cx->runtime->emptyString;
    }
    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        *rval = STRING_TO_JSVAL(str);
        return JS_TRUE;
    }
    STOBJ_SET_SLOT(obj, JSSLOT_PRIVATE, STRING_TO_JSVAL(str));
    return JS_TRUE;
}

static JSBool
str_fromCharCode(JSContext *cx, uintN argc, jsval *vp)
{
    jsval *argv;
    uintN i;
    uint16 code;
    jschar *chars;
    JSString *str;

    argv = vp + 2;
    JS_ASSERT(argc < ARRAY_INIT_LIMIT);
    if (argc == 1 &&
        (code = js_ValueToUint16(cx, &argv[0])) < UNIT_STRING_LIMIT) {
        str = js_GetUnitStringForChar(cx, code);
        if (!str)
            return JS_FALSE;
        *vp = STRING_TO_JSVAL(str);
        return JS_TRUE;
    }
    chars = (jschar *) JS_malloc(cx, (argc + 1) * sizeof(jschar));
    if (!chars)
        return JS_FALSE;
    for (i = 0; i < argc; i++) {
        code = js_ValueToUint16(cx, &argv[i]);
        if (JSVAL_IS_NULL(argv[i])) {
            JS_free(cx, chars);
            return JS_FALSE;
        }
        chars[i] = (jschar)code;
    }
    chars[i] = 0;
    str = js_NewString(cx, chars, argc);
    if (!str) {
        JS_free(cx, chars);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

#ifdef JS_TRACER
static JSString* FASTCALL
String_fromCharCode(JSContext* cx, int32 i)
{
    JS_ASSERT(JS_ON_TRACE(cx));
    jschar c = (jschar)i;
    if (c < UNIT_STRING_LIMIT)
        return js_GetUnitStringForChar(cx, c);
    return js_NewStringCopyN(cx, &c, 1);
}
#endif

JS_DEFINE_TRCINFO_1(str_fromCharCode,
    (2, (static, STRING_FAIL, String_fromCharCode, CONTEXT, INT32, 1, 1)))

static JSFunctionSpec string_static_methods[] = {
    JS_TN("fromCharCode", str_fromCharCode, 1, 0, str_fromCharCode_trcinfo),
    JS_FS_END
};

static JSHashNumber
js_hash_string_pointer(const void *key)
{
    return (JSHashNumber)JS_PTR_TO_UINT32(key) >> JSVAL_TAGBITS;
}

JSBool
js_InitRuntimeStringState(JSContext *cx)
{
    JSRuntime *rt;

    rt = cx->runtime;
    rt->emptyString = ATOM_TO_STRING(rt->atomState.emptyAtom);
    return JS_TRUE;
}

JSBool
js_InitDeflatedStringCache(JSRuntime *rt)
{
    JSHashTable *cache;

    /* Initialize string cache */
    JS_ASSERT(!rt->deflatedStringCache);
    cache = JS_NewHashTable(8, js_hash_string_pointer,
                            JS_CompareValues, JS_CompareValues,
                            NULL, NULL);
    if (!cache)
        return JS_FALSE;
    rt->deflatedStringCache = cache;

#ifdef JS_THREADSAFE
    JS_ASSERT(!rt->deflatedStringCacheLock);
    rt->deflatedStringCacheLock = JS_NEW_LOCK();
    if (!rt->deflatedStringCacheLock)
        return JS_FALSE;
#endif
    return JS_TRUE;
}

#define UNIT_STRING_SPACE(sp)    ((jschar *) ((sp) + UNIT_STRING_LIMIT))
#define UNIT_STRING_SPACE_RT(rt) UNIT_STRING_SPACE((rt)->unitStrings)

#define IN_UNIT_STRING_SPACE(sp,cp)                                           \
    ((size_t)((cp) - UNIT_STRING_SPACE(sp)) < 2 * UNIT_STRING_LIMIT)
#define IN_UNIT_STRING_SPACE_RT(rt,cp)                                        \
    IN_UNIT_STRING_SPACE((rt)->unitStrings, cp)

JSString *
js_GetUnitStringForChar(JSContext *cx, jschar c)
{
    jschar *cp, i;
    JSRuntime *rt;
    JSString **sp;

    JS_ASSERT(c < UNIT_STRING_LIMIT);
    rt = cx->runtime;
    if (!rt->unitStrings) {
        sp = (JSString **) calloc(UNIT_STRING_LIMIT * sizeof(JSString *) +
                                  UNIT_STRING_LIMIT * 2 * sizeof(jschar),
                                  1);
        if (!sp) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }
        cp = UNIT_STRING_SPACE(sp);
        for (i = 0; i < UNIT_STRING_LIMIT; i++) {
            *cp = i;
            cp += 2;
        }
        JS_LOCK_GC(rt);
        if (!rt->unitStrings) {
            rt->unitStrings = sp;
            JS_UNLOCK_GC(rt);
        } else {
            JS_UNLOCK_GC(rt);
            free(sp);
        }
    }
    if (!rt->unitStrings[c]) {
        JSString *str;

        cp = UNIT_STRING_SPACE_RT(rt);
        str = js_NewString(cx, cp + 2 * c, 1);
        if (!str)
            return NULL;
        JS_LOCK_GC(rt);
        if (!rt->unitStrings[c])
            rt->unitStrings[c] = str;
        JS_UNLOCK_GC(rt);
    }
    return rt->unitStrings[c];
}

JSString *
js_GetUnitString(JSContext *cx, JSString *str, size_t index)
{
    jschar c;

    JS_ASSERT(index < JSSTRING_LENGTH(str));
    c = JSSTRING_CHARS(str)[index];
    if (c >= UNIT_STRING_LIMIT)
        return js_NewDependentString(cx, str, index, 1);
    return js_GetUnitStringForChar(cx, c);
}

void
js_FinishUnitStrings(JSRuntime *rt)
{
    free(rt->unitStrings);
    rt->unitStrings = NULL;
}

void
js_FinishRuntimeStringState(JSContext *cx)
{
    cx->runtime->emptyString = NULL;
}

void
js_FinishDeflatedStringCache(JSRuntime *rt)
{
    if (rt->deflatedStringCache) {
        JS_HashTableDestroy(rt->deflatedStringCache);
        rt->deflatedStringCache = NULL;
    }
#ifdef JS_THREADSAFE
    if (rt->deflatedStringCacheLock) {
        JS_DESTROY_LOCK(rt->deflatedStringCacheLock);
        rt->deflatedStringCacheLock = NULL;
    }
#endif
}

JSObject *
js_InitStringClass(JSContext *cx, JSObject *obj)
{
    JSObject *proto;

    /* Define the escape, unescape functions in the global object. */
    if (!JS_DefineFunctions(cx, obj, string_functions))
        return NULL;

    proto = JS_InitClass(cx, obj, NULL, &js_StringClass, String, 1,
                         string_props, string_methods,
                         NULL, string_static_methods);
    if (!proto)
        return NULL;
    STOBJ_SET_SLOT(proto, JSSLOT_PRIVATE,
                   STRING_TO_JSVAL(cx->runtime->emptyString));
    return proto;
}

JSString *
js_NewString(JSContext *cx, jschar *chars, size_t length)
{
    JSString *str;

    if (length > JSSTRING_LENGTH_MASK) {
        js_ReportAllocationOverflow(cx);
        return NULL;
    }

    str = (JSString *) js_NewGCThing(cx, GCX_STRING, sizeof(JSString));
    if (!str)
        return NULL;
    JSFLATSTR_INIT(str, chars, length);
#ifdef DEBUG
  {
    JSRuntime *rt = cx->runtime;
    JS_RUNTIME_METER(rt, liveStrings);
    JS_RUNTIME_METER(rt, totalStrings);
    JS_LOCK_RUNTIME_VOID(rt,
        (rt->lengthSum += (double)length,
         rt->lengthSquaredSum += (double)length * (double)length));
  }
#endif
    return str;
}

JSString *
js_NewDependentString(JSContext *cx, JSString *base, size_t start,
                      size_t length)
{
    JSString *ds;

    if (length == 0)
        return cx->runtime->emptyString;

    if (start == 0 && length == JSSTRING_LENGTH(base))
        return base;

    if (start > JSSTRDEP_START_MASK ||
        (start != 0 && length > JSSTRDEP_LENGTH_MASK)) {
        return js_NewStringCopyN(cx, JSSTRING_CHARS(base) + start, length);
    }

    ds = (JSString *)js_NewGCThing(cx, GCX_STRING, sizeof(JSString));
    if (!ds)
        return NULL;
    if (start == 0)
        JSPREFIX_INIT(ds, base, length);
    else
        JSSTRDEP_INIT(ds, base, start, length);
#ifdef DEBUG
  {
    JSRuntime *rt = cx->runtime;
    JS_RUNTIME_METER(rt, liveDependentStrings);
    JS_RUNTIME_METER(rt, totalDependentStrings);
    JS_RUNTIME_METER(rt, liveStrings);
    JS_RUNTIME_METER(rt, totalStrings);
    JS_LOCK_RUNTIME_VOID(rt,
        (rt->strdepLengthSum += (double)length,
         rt->strdepLengthSquaredSum += (double)length * (double)length));
    JS_LOCK_RUNTIME_VOID(rt,
        (rt->lengthSum += (double)length,
         rt->lengthSquaredSum += (double)length * (double)length));
  }
#endif
    return ds;
}

#ifdef DEBUG
#include <math.h>

void printJSStringStats(JSRuntime *rt)
{
    double mean, sigma;

    mean = JS_MeanAndStdDev(rt->totalStrings, rt->lengthSum,
                            rt->lengthSquaredSum, &sigma);

    fprintf(stderr, "%lu total strings, mean length %g (sigma %g)\n",
            (unsigned long)rt->totalStrings, mean, sigma);

    mean = JS_MeanAndStdDev(rt->totalDependentStrings, rt->strdepLengthSum,
                            rt->strdepLengthSquaredSum, &sigma);

    fprintf(stderr, "%lu total dependent strings, mean length %g (sigma %g)\n",
            (unsigned long)rt->totalDependentStrings, mean, sigma);
}
#endif

JSString *
js_NewStringCopyN(JSContext *cx, const jschar *s, size_t n)
{
    jschar *news;
    JSString *str;

    news = (jschar *) JS_malloc(cx, (n + 1) * sizeof(jschar));
    if (!news)
        return NULL;
    js_strncpy(news, s, n);
    news[n] = 0;
    str = js_NewString(cx, news, n);
    if (!str)
        JS_free(cx, news);
    return str;
}

JSString *
js_NewStringCopyZ(JSContext *cx, const jschar *s)
{
    size_t n, m;
    jschar *news;
    JSString *str;

    n = js_strlen(s);
    m = (n + 1) * sizeof(jschar);
    news = (jschar *) JS_malloc(cx, m);
    if (!news)
        return NULL;
    memcpy(news, s, m);
    str = js_NewString(cx, news, n);
    if (!str)
        JS_free(cx, news);
    return str;
}

void
js_PurgeDeflatedStringCache(JSRuntime *rt, JSString *str)
{
    JSHashNumber hash;
    JSHashEntry *he, **hep;

    hash = js_hash_string_pointer(str);
    JS_ACQUIRE_LOCK(rt->deflatedStringCacheLock);
    hep = JS_HashTableRawLookup(rt->deflatedStringCache, hash, str);
    he = *hep;
    if (he) {
#ifdef DEBUG
        rt->deflatedStringCacheBytes -= JSSTRING_LENGTH(str);
#endif
        free(he->value);
        JS_HashTableRawRemove(rt->deflatedStringCache, hep, he);
    }
    JS_RELEASE_LOCK(rt->deflatedStringCacheLock);
}

static JSStringFinalizeOp str_finalizers[GCX_NTYPES - GCX_EXTERNAL_STRING] = {
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
};

intN
js_ChangeExternalStringFinalizer(JSStringFinalizeOp oldop,
                                 JSStringFinalizeOp newop)
{
    uintN i;

    for (i = 0; i != JS_ARRAY_LENGTH(str_finalizers); i++) {
        if (str_finalizers[i] == oldop) {
            str_finalizers[i] = newop;
            return (intN) i;
        }
    }
    return -1;
}

/*
 * cx is NULL when we are called from js_FinishAtomState to force the
 * finalization of the permanently interned strings.
 */
void
js_FinalizeStringRT(JSRuntime *rt, JSString *str, intN type, JSContext *cx)
{
    jschar *chars;
    JSBool valid;
    JSStringFinalizeOp finalizer;

    JS_RUNTIME_UNMETER(rt, liveStrings);
    if (JSSTRING_IS_DEPENDENT(str)) {
        /* A dependent string can not be external and must be valid. */
        JS_ASSERT(type < 0);
        JS_ASSERT(JSSTRDEP_BASE(str));
        JS_RUNTIME_UNMETER(rt, liveDependentStrings);
        valid = JS_TRUE;
    } else {
        /* A stillborn string has null chars, so is not valid. */
        chars = JSFLATSTR_CHARS(str);
        valid = (chars != NULL);
        if (valid) {
            if (IN_UNIT_STRING_SPACE_RT(rt, chars)) {
                JS_ASSERT(rt->unitStrings[*chars] == str);
                JS_ASSERT(type < 0);
                rt->unitStrings[*chars] = NULL;
            } else if (type < 0) {
                free(chars);
            } else {
                JS_ASSERT((uintN) type < JS_ARRAY_LENGTH(str_finalizers));
                finalizer = str_finalizers[type];
                if (finalizer) {
                    /*
                     * Assume that the finalizer for the permanently interned
                     * string knows how to deal with null context.
                     */
                    finalizer(cx, str);
                }
            }
        }
    }
    if (valid)
        js_PurgeDeflatedStringCache(rt, str);
}

JS_FRIEND_API(const char *)
js_ValueToPrintable(JSContext *cx, jsval v, JSValueToStringFun v2sfun)
{
    JSString *str;

    str = v2sfun(cx, v);
    if (!str)
        return NULL;
    str = js_QuoteString(cx, str, 0);
    if (!str)
        return NULL;
    return js_GetStringBytes(cx, str);
}

JS_FRIEND_API(JSString *)
js_ValueToString(JSContext *cx, jsval v)
{
    JSObject *obj;
    JSString *str;

    if (JSVAL_IS_OBJECT(v)) {
        obj = JSVAL_TO_OBJECT(v);
        if (!obj)
            return ATOM_TO_STRING(cx->runtime->atomState.nullAtom);
        if (!OBJ_DEFAULT_VALUE(cx, obj, JSTYPE_STRING, &v))
            return NULL;
    }
    if (JSVAL_IS_STRING(v)) {
        str = JSVAL_TO_STRING(v);
    } else if (JSVAL_IS_INT(v)) {
        str = js_NumberToString(cx, JSVAL_TO_INT(v));
    } else if (JSVAL_IS_DOUBLE(v)) {
        str = js_NumberToString(cx, *JSVAL_TO_DOUBLE(v));
    } else if (JSVAL_IS_BOOLEAN(v)) {
        str = js_BooleanToString(cx, JSVAL_TO_BOOLEAN(v));
    } else {
        str = ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_VOID]);
    }
    return str;
}

JS_FRIEND_API(JSString *)
js_ValueToSource(JSContext *cx, jsval v)
{
    JSTempValueRooter tvr;
    JSString *str;

    if (JSVAL_IS_VOID(v))
        return ATOM_TO_STRING(cx->runtime->atomState.void0Atom);
    if (JSVAL_IS_STRING(v))
        return js_QuoteString(cx, JSVAL_TO_STRING(v), '"');
    if (JSVAL_IS_PRIMITIVE(v)) {
        /* Special case to preserve negative zero, _contra_ toString. */
        if (JSVAL_IS_DOUBLE(v) && JSDOUBLE_IS_NEGZERO(*JSVAL_TO_DOUBLE(v))) {
            /* NB: _ucNstr rather than _ucstr to indicate non-terminated. */
            static const jschar js_negzero_ucNstr[] = {'-', '0'};

            return js_NewStringCopyN(cx, js_negzero_ucNstr, 2);
        }
        return js_ValueToString(cx, v);
    }

    JS_PUSH_SINGLE_TEMP_ROOT(cx, JSVAL_NULL, &tvr);
    if (!js_TryMethod(cx, JSVAL_TO_OBJECT(v),
                      cx->runtime->atomState.toSourceAtom,
                      0, NULL, &tvr.u.value)) {
        str = NULL;
    } else {
        str = js_ValueToString(cx, tvr.u.value);
    }
    JS_POP_TEMP_ROOT(cx, &tvr);
    return str;
}

/*
 * str is not necessarily a GC thing here.
 */
uint32
js_HashString(JSString *str)
{
    const jschar *s;
    size_t n;
    uint32 h;

    JSSTRING_CHARS_AND_LENGTH(str, s, n);
    for (h = 0; n; s++, n--)
        h = JS_ROTATE_LEFT32(h, 4) ^ *s;
    return h;
}

/*
 * str is not necessarily a GC thing here.
 */
JSBool JS_FASTCALL
js_EqualStrings(JSString *str1, JSString *str2)
{
    size_t n;
    const jschar *s1, *s2;

    JS_ASSERT(str1);
    JS_ASSERT(str2);

    /* Fast case: pointer equality could be a quick win. */
    if (str1 == str2)
        return JS_TRUE;

    n = JSSTRING_LENGTH(str1);
    if (n != JSSTRING_LENGTH(str2))
        return JS_FALSE;

    if (n == 0)
        return JS_TRUE;

    s1 = JSSTRING_CHARS(str1), s2 = JSSTRING_CHARS(str2);
    do {
        if (*s1 != *s2)
            return JS_FALSE;
        ++s1, ++s2;
    } while (--n != 0);

    return JS_TRUE;
}

int32 JS_FASTCALL
js_CompareStrings(JSString *str1, JSString *str2)
{
    size_t l1, l2, n, i;
    const jschar *s1, *s2;
    intN cmp;

    JS_ASSERT(str1);
    JS_ASSERT(str2);

    /* Fast case: pointer equality could be a quick win. */
    if (str1 == str2)
        return 0;

    JSSTRING_CHARS_AND_LENGTH(str1, s1, l1);
    JSSTRING_CHARS_AND_LENGTH(str2, s2, l2);
    n = JS_MIN(l1, l2);
    for (i = 0; i < n; i++) {
        cmp = s1[i] - s2[i];
        if (cmp != 0)
            return cmp;
    }
    return (intN)(l1 - l2);
}

size_t
js_strlen(const jschar *s)
{
    const jschar *t;

    for (t = s; *t != 0; t++)
        continue;
    return (size_t)(t - s);
}

jschar *
js_strchr(const jschar *s, jschar c)
{
    while (*s != 0) {
        if (*s == c)
            return (jschar *)s;
        s++;
    }
    return NULL;
}

jschar *
js_strchr_limit(const jschar *s, jschar c, const jschar *limit)
{
    while (s < limit) {
        if (*s == c)
            return (jschar *)s;
        s++;
    }
    return NULL;
}

const jschar *
js_SkipWhiteSpace(const jschar *s, const jschar *end)
{
    JS_ASSERT(s <= end);
    while (s != end && JS_ISSPACE(*s))
        s++;
    return s;
}

jschar *
js_InflateString(JSContext *cx, const char *bytes, size_t *lengthp)
{
    size_t nbytes, nchars, i;
    jschar *chars;
#ifdef DEBUG
    JSBool ok;
#endif

    nbytes = *lengthp;
    if (js_CStringsAreUTF8) {
        if (!js_InflateStringToBuffer(cx, bytes, nbytes, NULL, &nchars))
            goto bad;
        chars = (jschar *) JS_malloc(cx, (nchars + 1) * sizeof (jschar));
        if (!chars)
            goto bad;
#ifdef DEBUG
        ok =
#endif
            js_InflateStringToBuffer(cx, bytes, nbytes, chars, &nchars);
        JS_ASSERT(ok);
    } else {
        nchars = nbytes;
        chars = (jschar *) JS_malloc(cx, (nchars + 1) * sizeof(jschar));
        if (!chars)
            goto bad;
        for (i = 0; i < nchars; i++)
            chars[i] = (unsigned char) bytes[i];
    }
    *lengthp = nchars;
    chars[nchars] = 0;
    return chars;

  bad:
    /*
     * For compatibility with callers of JS_DecodeBytes we must zero lengthp
     * on errors.
     */
    *lengthp = 0;
    return NULL;
}

/*
 * May be called with null cx by js_GetStringBytes, see below.
 */
char *
js_DeflateString(JSContext *cx, const jschar *chars, size_t nchars)
{
    size_t nbytes, i;
    char *bytes;
#ifdef DEBUG
    JSBool ok;
#endif

    if (js_CStringsAreUTF8) {
        nbytes = js_GetDeflatedStringLength(cx, chars, nchars);
        if (nbytes == (size_t) -1)
            return NULL;
        bytes = (char *) (cx ? JS_malloc(cx, nbytes + 1) : malloc(nbytes + 1));
        if (!bytes)
            return NULL;
#ifdef DEBUG
        ok =
#endif
            js_DeflateStringToBuffer(cx, chars, nchars, bytes, &nbytes);
        JS_ASSERT(ok);
    } else {
        nbytes = nchars;
        bytes = (char *) (cx ? JS_malloc(cx, nbytes + 1) : malloc(nbytes + 1));
        if (!bytes)
            return NULL;
        for (i = 0; i < nbytes; i++)
            bytes[i] = (char) chars[i];
    }
    bytes[nbytes] = 0;
    return bytes;
}

/*
 * May be called with null cx through js_GetStringBytes, see below.
 */
size_t
js_GetDeflatedStringLength(JSContext *cx, const jschar *chars, size_t nchars)
{
    size_t nbytes;
    const jschar *end;
    uintN c, c2;
    char buffer[10];

    if (!js_CStringsAreUTF8)
        return nchars;

    nbytes = nchars;
    for (end = chars + nchars; chars != end; chars++) {
        c = *chars;
        if (c < 0x80)
            continue;
        if (0xD800 <= c && c <= 0xDFFF) {
            /* Surrogate pair. */
            chars++;
            if (c >= 0xDC00 || chars == end)
                goto bad_surrogate;
            c2 = *chars;
            if (c2 < 0xDC00 || c2 > 0xDFFF)
                goto bad_surrogate;
            c = ((c - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
        }
        c >>= 11;
        nbytes++;
        while (c) {
            c >>= 5;
            nbytes++;
        }
    }
    return nbytes;

  bad_surrogate:
    if (cx) {
        JS_snprintf(buffer, 10, "0x%x", c);
        JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR, js_GetErrorMessage,
                                     NULL, JSMSG_BAD_SURROGATE_CHAR, buffer);
    }
    return (size_t) -1;
}

JSBool
js_DeflateStringToBuffer(JSContext *cx, const jschar *src, size_t srclen,
                         char *dst, size_t *dstlenp)
{
    size_t dstlen, i, origDstlen, utf8Len;
    jschar c, c2;
    uint32 v;
    uint8 utf8buf[6];

    dstlen = *dstlenp;
    if (!js_CStringsAreUTF8) {
        if (srclen > dstlen) {
            for (i = 0; i < dstlen; i++)
                dst[i] = (char) src[i];
            if (cx) {
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_BUFFER_TOO_SMALL);
            }
            return JS_FALSE;
        }
        for (i = 0; i < srclen; i++)
            dst[i] = (char) src[i];
        *dstlenp = srclen;
        return JS_TRUE;
    }

    origDstlen = dstlen;
    while (srclen) {
        c = *src++;
        srclen--;
        if ((c >= 0xDC00) && (c <= 0xDFFF))
            goto badSurrogate;
        if (c < 0xD800 || c > 0xDBFF) {
            v = c;
        } else {
            if (srclen < 1)
                goto badSurrogate;
            c2 = *src;
            if ((c2 < 0xDC00) || (c2 > 0xDFFF))
                goto badSurrogate;
            src++;
            srclen--;
            v = ((c - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
        }
        if (v < 0x0080) {
            /* no encoding necessary - performance hack */
            if (dstlen == 0)
                goto bufferTooSmall;
            *dst++ = (char) v;
            utf8Len = 1;
        } else {
            utf8Len = js_OneUcs4ToUtf8Char(utf8buf, v);
            if (utf8Len > dstlen)
                goto bufferTooSmall;
            for (i = 0; i < utf8Len; i++)
                *dst++ = (char) utf8buf[i];
        }
        dstlen -= utf8Len;
    }
    *dstlenp = (origDstlen - dstlen);
    return JS_TRUE;

badSurrogate:
    *dstlenp = (origDstlen - dstlen);
    /* Delegate error reporting to the measurement function. */
    if (cx)
        js_GetDeflatedStringLength(cx, src - 1, srclen + 1);
    return JS_FALSE;

bufferTooSmall:
    *dstlenp = (origDstlen - dstlen);
    if (cx) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BUFFER_TOO_SMALL);
    }
    return JS_FALSE;
}

JSBool
js_InflateStringToBuffer(JSContext *cx, const char *src, size_t srclen,
                         jschar *dst, size_t *dstlenp)
{
    size_t dstlen, i, origDstlen, offset, j, n;
    uint32 v;

    if (!js_CStringsAreUTF8) {
        if (dst) {
            dstlen = *dstlenp;
            if (srclen > dstlen) {
                for (i = 0; i < dstlen; i++)
                    dst[i] = (unsigned char) src[i];
                if (cx) {
                    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                         JSMSG_BUFFER_TOO_SMALL);
                }
                return JS_FALSE;
            }
            for (i = 0; i < srclen; i++)
                dst[i] = (unsigned char) src[i];
        }
        *dstlenp = srclen;
        return JS_TRUE;
    }

    dstlen = dst ? *dstlenp : (size_t) -1;
    origDstlen = dstlen;
    offset = 0;

    while (srclen) {
        v = (uint8) *src;
        n = 1;
        if (v & 0x80) {
            while (v & (0x80 >> n))
                n++;
            if (n > srclen)
                goto bufferTooSmall;
            if (n == 1 || n > 6)
                goto badCharacter;
            for (j = 1; j < n; j++) {
                if ((src[j] & 0xC0) != 0x80)
                    goto badCharacter;
            }
            v = Utf8ToOneUcs4Char((uint8 *)src, n);
            if (v >= 0x10000) {
                v -= 0x10000;
                if (v > 0xFFFFF || dstlen < 2) {
                    *dstlenp = (origDstlen - dstlen);
                    if (cx) {
                        char buffer[10];
                        JS_snprintf(buffer, 10, "0x%x", v + 0x10000);
                        JS_ReportErrorFlagsAndNumber(cx,
                                                     JSREPORT_ERROR,
                                                     js_GetErrorMessage, NULL,
                                                     JSMSG_UTF8_CHAR_TOO_LARGE,
                                                     buffer);
                    }
                    return JS_FALSE;
                }
                if (dstlen < 2)
                    goto bufferTooSmall;
                if (dst) {
                    *dst++ = (jschar)((v >> 10) + 0xD800);
                    v = (jschar)((v & 0x3FF) + 0xDC00);
                }
                dstlen--;
            }
        }
        if (!dstlen)
            goto bufferTooSmall;
        if (dst)
            *dst++ = (jschar) v;
        dstlen--;
        offset += n;
        src += n;
        srclen -= n;
    }
    *dstlenp = (origDstlen - dstlen);
    return JS_TRUE;

badCharacter:
    *dstlenp = (origDstlen - dstlen);
    if (cx) {
        char buffer[10];
        JS_snprintf(buffer, 10, "%d", offset);
        JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                     js_GetErrorMessage, NULL,
                                     JSMSG_MALFORMED_UTF8_CHAR,
                                     buffer);
    }
    return JS_FALSE;

bufferTooSmall:
    *dstlenp = (origDstlen - dstlen);
    if (cx) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BUFFER_TOO_SMALL);
    }
    return JS_FALSE;
}

JSBool
js_SetStringBytes(JSContext *cx, JSString *str, char *bytes, size_t length)
{
    JSRuntime *rt;
    JSHashTable *cache;
    JSBool ok;
    JSHashNumber hash;
    JSHashEntry **hep;

    rt = cx->runtime;
    JS_ACQUIRE_LOCK(rt->deflatedStringCacheLock);

    cache = rt->deflatedStringCache;
    hash = js_hash_string_pointer(str);
    hep = JS_HashTableRawLookup(cache, hash, str);
    JS_ASSERT(*hep == NULL);
    ok = JS_HashTableRawAdd(cache, hep, hash, str, bytes) != NULL;
#ifdef DEBUG
    if (ok)
        rt->deflatedStringCacheBytes += length;
#endif

    JS_RELEASE_LOCK(rt->deflatedStringCacheLock);
    return ok;
}

const char *
js_GetStringBytes(JSContext *cx, JSString *str)
{
    JSRuntime *rt;
    JSHashTable *cache;
    char *bytes;
    JSHashNumber hash;
    JSHashEntry *he, **hep;

    if (cx) {
        rt = cx->runtime;
    } else {
        /* JS_GetStringBytes calls us with null cx. */
        rt = js_GetGCStringRuntime(str);
    }

#ifdef JS_THREADSAFE
    if (!rt->deflatedStringCacheLock) {
        /*
         * Called from last GC (see js_DestroyContext), after runtime string
         * state has been finalized.  We have no choice but to leak here.
         */
        return js_DeflateString(NULL, JSSTRING_CHARS(str),
                                      JSSTRING_LENGTH(str));
    }
#endif

    JS_ACQUIRE_LOCK(rt->deflatedStringCacheLock);

    cache = rt->deflatedStringCache;
    hash = js_hash_string_pointer(str);
    hep = JS_HashTableRawLookup(cache, hash, str);
    he = *hep;
    if (he) {
        bytes = (char *) he->value;

        /* Try to catch failure to JS_ShutDown between runtime epochs. */
        if (!js_CStringsAreUTF8) {
            JS_ASSERT_IF(*bytes != (char) JSSTRING_CHARS(str)[0],
                         *bytes == '\0' && JSSTRING_LENGTH(str) == 0);
        }
    } else {
        bytes = js_DeflateString(cx, JSSTRING_CHARS(str),
                                 JSSTRING_LENGTH(str));
        if (bytes) {
            if (JS_HashTableRawAdd(cache, hep, hash, str, bytes)) {
#ifdef DEBUG
                rt->deflatedStringCacheBytes += JSSTRING_LENGTH(str);
#endif
            } else {
                if (cx)
                    JS_free(cx, bytes);
                else
                    free(bytes);
                bytes = NULL;
            }
        }
    }

    JS_RELEASE_LOCK(rt->deflatedStringCacheLock);
    return bytes;
}

/*
 * From java.lang.Character.java:
 *
 * The character properties are currently encoded into 32 bits in the
 * following manner:
 *
 * 10 bits      signed offset used for converting case
 *  1 bit       if 1, adding the signed offset converts the character to
 *              lowercase
 *  1 bit       if 1, subtracting the signed offset converts the character to
 *              uppercase
 *  1 bit       if 1, character has a titlecase equivalent (possibly itself)
 *  3 bits      0  may not be part of an identifier
 *              1  ignorable control; may continue a Unicode identifier or JS
 *                 identifier
 *              2  may continue a JS identifier but not a Unicode identifier
 *                 (unused)
 *              3  may continue a Unicode identifier or JS identifier
 *              4  is a JS whitespace character
 *              5  may start or continue a JS identifier;
 *                 may continue but not start a Unicode identifier (_)
 *              6  may start or continue a JS identifier but not a Unicode
 *                 identifier ($)
 *              7  may start or continue a Unicode identifier or JS identifier
 *              Thus:
 *                 5, 6, 7 may start a JS identifier
 *                 1, 2, 3, 5, 6, 7 may continue a JS identifier
 *                 7 may start a Unicode identifier
 *                 1, 3, 5, 7 may continue a Unicode identifier
 *                 1 is ignorable within an identifier
 *                 4 is JS whitespace
 *  2 bits      0  this character has no numeric property
 *              1  adding the digit offset to the character code and then
 *                 masking with 0x1F will produce the desired numeric value
 *              2  this character has a "strange" numeric value
 *              3  a JS supradecimal digit: adding the digit offset to the
 *                 character code, then masking with 0x1F, then adding 10
 *                 will produce the desired numeric value
 *  5 bits      digit offset
 *  1 bit       XML 1.0 name start character
 *  1 bit       XML 1.0 name character
 *  2 bits      reserved for future use
 *  5 bits      character type
 */

/* The X table has 1024 entries for a total of 1024 bytes. */

const uint8 js_X[] = {
  0,   1,   2,   3,   4,   5,   6,   7,  /*  0x0000 */
  8,   9,  10,  11,  12,  13,  14,  15,  /*  0x0200 */
 16,  17,  18,  19,  20,  21,  22,  23,  /*  0x0400 */
 24,  25,  26,  27,  28,  28,  28,  28,  /*  0x0600 */
 28,  28,  28,  28,  29,  30,  31,  32,  /*  0x0800 */
 33,  34,  35,  36,  37,  38,  39,  40,  /*  0x0A00 */
 41,  42,  43,  44,  45,  46,  28,  28,  /*  0x0C00 */
 47,  48,  49,  50,  51,  52,  53,  28,  /*  0x0E00 */
 28,  28,  54,  55,  56,  57,  58,  59,  /*  0x1000 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1200 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1400 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1600 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1800 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1A00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x1C00 */
 60,  60,  61,  62,  63,  64,  65,  66,  /*  0x1E00 */
 67,  68,  69,  70,  71,  72,  73,  74,  /*  0x2000 */
 75,  75,  75,  76,  77,  78,  28,  28,  /*  0x2200 */
 79,  80,  81,  82,  83,  83,  84,  85,  /*  0x2400 */
 86,  85,  28,  28,  87,  88,  89,  28,  /*  0x2600 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x2800 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x2A00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x2C00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x2E00 */
 90,  91,  92,  93,  94,  56,  95,  28,  /*  0x3000 */
 96,  97,  98,  99,  83, 100,  83, 101,  /*  0x3200 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3400 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3600 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3800 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3A00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3C00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x3E00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4000 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4200 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4400 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4600 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4800 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4A00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0x4C00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x4E00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5A00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5C00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x5E00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6A00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6C00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x6E00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7A00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7C00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x7E00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8A00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8C00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x8E00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9A00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0x9C00 */
 56,  56,  56,  56,  56,  56, 102,  28,  /*  0x9E00 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xA000 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xA200 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xA400 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xA600 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xA800 */
 28,  28,  28,  28,  28,  28,  28,  28,  /*  0xAA00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xAC00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xAE00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xB000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xB200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xB400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xB600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xB800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xBA00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xBC00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xBE00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xC000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xC200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xC400 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xC600 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xC800 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xCA00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xCC00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xCE00 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xD000 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xD200 */
 56,  56,  56,  56,  56,  56,  56,  56,  /*  0xD400 */
 56,  56,  56,  56,  56,  56, 103,  28,  /*  0xD600 */
104, 104, 104, 104, 104, 104, 104, 104,  /*  0xD800 */
104, 104, 104, 104, 104, 104, 104, 104,  /*  0xDA00 */
104, 104, 104, 104, 104, 104, 104, 104,  /*  0xDC00 */
104, 104, 104, 104, 104, 104, 104, 104,  /*  0xDE00 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xE000 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xE200 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xE400 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xE600 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xE800 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xEA00 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xEC00 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xEE00 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xF000 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xF200 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xF400 */
105, 105, 105, 105, 105, 105, 105, 105,  /*  0xF600 */
105, 105, 105, 105,  56,  56,  56,  56,  /*  0xF800 */
106,  28,  28,  28, 107, 108, 109, 110,  /*  0xFA00 */
 56,  56,  56,  56, 111, 112, 113, 114,  /*  0xFC00 */
115, 116,  56, 117, 118, 119, 120, 121   /*  0xFE00 */
};

/* The Y table has 7808 entries for a total of 7808 bytes. */

const uint8 js_Y[] = {
  0,   0,   0,   0,   0,   0,   0,   0,  /*    0 */
  0,   1,   1,   1,   1,   1,   0,   0,  /*    0 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    0 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    0 */
  2,   3,   3,   3,   4,   3,   3,   3,  /*    0 */
  5,   6,   3,   7,   3,   8,   3,   3,  /*    0 */
  9,   9,   9,   9,   9,   9,   9,   9,  /*    0 */
  9,   9,   3,   3,   7,   7,   7,   3,  /*    0 */
  3,  10,  10,  10,  10,  10,  10,  10,  /*    1 */
 10,  10,  10,  10,  10,  10,  10,  10,  /*    1 */
 10,  10,  10,  10,  10,  10,  10,  10,  /*    1 */
 10,  10,  10,   5,   3,   6,  11,  12,  /*    1 */
 11,  13,  13,  13,  13,  13,  13,  13,  /*    1 */
 13,  13,  13,  13,  13,  13,  13,  13,  /*    1 */
 13,  13,  13,  13,  13,  13,  13,  13,  /*    1 */
 13,  13,  13,   5,   7,   6,   7,   0,  /*    1 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    2 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    2 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    2 */
  0,   0,   0,   0,   0,   0,   0,   0,  /*    2 */
  2,   3,   4,   4,   4,   4,  15,  15,  /*    2 */
 11,  15,  16,   5,   7,   8,  15,  11,  /*    2 */
 15,   7,  17,  17,  11,  16,  15,   3,  /*    2 */
 11,  18,  16,   6,  19,  19,  19,   3,  /*    2 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*    3 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*    3 */
 20,  20,  20,  20,  20,  20,  20,   7,  /*    3 */
 20,  20,  20,  20,  20,  20,  20,  16,  /*    3 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*    3 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*    3 */
 21,  21,  21,  21,  21,  21,  21,   7,  /*    3 */
 21,  21,  21,  21,  21,  21,  21,  22,  /*    3 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    4 */
 25,  26,  23,  24,  23,  24,  23,  24,  /*    4 */
 16,  23,  24,  23,  24,  23,  24,  23,  /*    4 */
 24,  23,  24,  23,  24,  23,  24,  23,  /*    5 */
 24,  16,  23,  24,  23,  24,  23,  24,  /*    5 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    5 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    5 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    5 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    5 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    5 */
 27,  23,  24,  23,  24,  23,  24,  28,  /*    5 */
 16,  29,  23,  24,  23,  24,  30,  23,  /*    6 */
 24,  31,  31,  23,  24,  16,  32,  32,  /*    6 */
 33,  23,  24,  31,  34,  16,  35,  36,  /*    6 */
 23,  24,  16,  16,  35,  37,  16,  38,  /*    6 */
 23,  24,  23,  24,  23,  24,  38,  23,  /*    6 */
 24,  39,  40,  16,  23,  24,  39,  23,  /*    6 */
 24,  41,  41,  23,  24,  23,  24,  42,  /*    6 */
 23,  24,  16,  40,  23,  24,  40,  40,  /*    6 */
 40,  40,  40,  40,  43,  44,  45,  43,  /*    7 */
 44,  45,  43,  44,  45,  23,  24,  23,  /*    7 */
 24,  23,  24,  23,  24,  23,  24,  23,  /*    7 */
 24,  23,  24,  23,  24,  16,  23,  24,  /*    7 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    7 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    7 */
 16,  43,  44,  45,  23,  24,  46,  46,  /*    7 */
 46,  46,  23,  24,  23,  24,  23,  24,  /*    7 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    8 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    8 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    8 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    9 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*    9 */
 16,  16,  16,  47,  48,  16,  49,  49,  /*    9 */
 50,  50,  16,  51,  16,  16,  16,  16,  /*    9 */
 49,  16,  16,  52,  16,  16,  16,  16,  /*    9 */
 53,  54,  16,  16,  16,  16,  16,  54,  /*    9 */
 16,  16,  55,  16,  16,  16,  16,  16,  /*    9 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*    9 */
 16,  16,  16,  56,  16,  16,  16,  16,  /*   10 */
 56,  16,  57,  57,  16,  16,  16,  16,  /*   10 */
 16,  16,  58,  16,  16,  16,  16,  16,  /*   10 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   10 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   10 */
 16,  46,  46,  46,  46,  46,  46,  46,  /*   10 */
 59,  59,  59,  59,  59,  59,  59,  59,  /*   10 */
 59,  11,  11,  59,  59,  59,  59,  59,  /*   10 */
 59,  59,  11,  11,  11,  11,  11,  11,  /*   11 */
 11,  11,  11,  11,  11,  11,  11,  11,  /*   11 */
 59,  59,  11,  11,  11,  11,  11,  11,  /*   11 */
 11,  11,  11,  11,  11,  11,  11,  46,  /*   11 */
 59,  59,  59,  59,  59,  11,  11,  11,  /*   11 */
 11,  11,  46,  46,  46,  46,  46,  46,  /*   11 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   11 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   11 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   12 */
 60,  60,  60,  60,  60,  60,  46,  46,  /*   13 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   13 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   13 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   13 */
 60,  60,  46,  46,  46,  46,  46,  46,  /*   13 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   13 */
 46,  46,  46,  46,   3,   3,  46,  46,  /*   13 */
 46,  46,  59,  46,  46,  46,   3,  46,  /*   13 */
 46,  46,  46,  46,  11,  11,  61,   3,  /*   14 */
 62,  62,  62,  46,  63,  46,  64,  64,  /*   14 */
 16,  20,  20,  20,  20,  20,  20,  20,  /*   14 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*   14 */
 20,  20,  46,  20,  20,  20,  20,  20,  /*   14 */
 20,  20,  20,  20,  65,  66,  66,  66,  /*   14 */
 16,  21,  21,  21,  21,  21,  21,  21,  /*   14 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*   14 */
 21,  21,  16,  21,  21,  21,  21,  21,  /*   15 */
 21,  21,  21,  21,  67,  68,  68,  46,  /*   15 */
 69,  70,  38,  38,  38,  71,  72,  46,  /*   15 */
 46,  46,  38,  46,  38,  46,  38,  46,  /*   15 */
 38,  46,  23,  24,  23,  24,  23,  24,  /*   15 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   15 */
 73,  74,  16,  40,  46,  46,  46,  46,  /*   15 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   15 */
 46,  75,  75,  75,  75,  75,  75,  75,  /*   16 */
 75,  75,  75,  75,  75,  46,  75,  75,  /*   16 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*   16 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*   16 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*   16 */
 20,  20,  20,  20,  20,  20,  20,  20,  /*   16 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*   16 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*   16 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*   17 */
 21,  21,  21,  21,  21,  21,  21,  21,  /*   17 */
 46,  74,  74,  74,  74,  74,  74,  74,  /*   17 */
 74,  74,  74,  74,  74,  46,  74,  74,  /*   17 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   17 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   17 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   17 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   17 */
 23,  24,  15,  60,  60,  60,  60,  46,  /*   18 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   18 */
 40,  23,  24,  23,  24,  46,  46,  23,  /*   19 */
 24,  46,  46,  23,  24,  46,  46,  46,  /*   19 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   19 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   19 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   19 */
 23,  24,  23,  24,  46,  46,  23,  24,  /*   19 */
 23,  24,  23,  24,  23,  24,  46,  46,  /*   19 */
 23,  24,  46,  46,  46,  46,  46,  46,  /*   19 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   20 */
 46,  76,  76,  76,  76,  76,  76,  76,  /*   20 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   20 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   21 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   21 */
 76,  76,  76,  76,  76,  76,  76,  46,  /*   21 */
 46,  59,   3,   3,   3,   3,   3,   3,  /*   21 */
 46,  77,  77,  77,  77,  77,  77,  77,  /*   21 */
 77,  77,  77,  77,  77,  77,  77,  77,  /*   21 */
 77,  77,  77,  77,  77,  77,  77,  77,  /*   21 */
 77,  77,  77,  77,  77,  77,  77,  77,  /*   21 */
 77,  77,  77,  77,  77,  77,  77,  16,  /*   22 */
 46,   3,  46,  46,  46,  46,  46,  46,  /*   22 */
 46,  60,  60,  60,  60,  60,  60,  60,  /*   22 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   22 */
 60,  60,  46,  60,  60,  60,  60,  60,  /*   22 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   22 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   22 */
 60,  60,  46,  60,  60,  60,   3,  60,  /*   22 */
  3,  60,  60,   3,  60,  46,  46,  46,  /*   23 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   23 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   23 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   23 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   23 */
 40,  40,  40,  46,  46,  46,  46,  46,  /*   23 */
 40,  40,  40,   3,   3,  46,  46,  46,  /*   23 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   23 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   24 */
 46,  46,  46,  46,   3,  46,  46,  46,  /*   24 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   24 */
 46,  46,  46,   3,  46,  46,  46,   3,  /*   24 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   24 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   24 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   24 */
 40,  40,  40,  46,  46,  46,  46,  46,  /*   24 */
 59,  40,  40,  40,  40,  40,  40,  40,  /*   25 */
 40,  40,  40,  60,  60,  60,  60,  60,  /*   25 */
 60,  60,  60,  46,  46,  46,  46,  46,  /*   25 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   25 */
 78,  78,  78,  78,  78,  78,  78,  78,  /*   25 */
 78,  78,   3,   3,   3,   3,  46,  46,  /*   25 */
 60,  40,  40,  40,  40,  40,  40,  40,  /*   25 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   25 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   26 */
 46,  46,  40,  40,  40,  40,  40,  46,  /*   26 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   27 */
 40,  40,  40,  40,  40,  40,  40,  46,  /*   27 */
 40,  40,  40,  40,   3,  40,  60,  60,  /*   27 */
 60,  60,  60,  60,  60,  79,  79,  60,  /*   27 */
 60,  60,  60,  60,  60,  59,  59,  60,  /*   27 */
 60,  15,  60,  60,  60,  60,  46,  46,  /*   27 */
  9,   9,   9,   9,   9,   9,   9,   9,  /*   27 */
  9,   9,  46,  46,  46,  46,  46,  46,  /*   27 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   28 */
 46,  60,  60,  80,  46,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   29 */
 40,  40,  46,  46,  60,  40,  80,  80,  /*   29 */
 80,  60,  60,  60,  60,  60,  60,  60,  /*   30 */
 60,  80,  80,  80,  80,  60,  46,  46,  /*   30 */
 15,  60,  60,  60,  60,  46,  46,  46,  /*   30 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   30 */
 40,  40,  60,  60,   3,   3,  81,  81,  /*   30 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   30 */
  3,  46,  46,  46,  46,  46,  46,  46,  /*   30 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   30 */
 46,  60,  80,  80,  46,  40,  40,  40,  /*   31 */
 40,  40,  40,  40,  40,  46,  46,  40,  /*   31 */
 40,  46,  46,  40,  40,  40,  40,  40,  /*   31 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   31 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   31 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   31 */
 40,  46,  40,  46,  46,  46,  40,  40,  /*   31 */
 40,  40,  46,  46,  60,  46,  80,  80,  /*   31 */
 80,  60,  60,  60,  60,  46,  46,  80,  /*   32 */
 80,  46,  46,  80,  80,  60,  46,  46,  /*   32 */
 46,  46,  46,  46,  46,  46,  46,  80,  /*   32 */
 46,  46,  46,  46,  40,  40,  46,  40,  /*   32 */
 40,  40,  60,  60,  46,  46,  81,  81,  /*   32 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   32 */
 40,  40,   4,   4,  82,  82,  82,  82,  /*   32 */
 19,  83,  15,  46,  46,  46,  46,  46,  /*   32 */
 46,  46,  60,  46,  46,  40,  40,  40,  /*   33 */
 40,  40,  40,  46,  46,  46,  46,  40,  /*   33 */
 40,  46,  46,  40,  40,  40,  40,  40,  /*   33 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   33 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   33 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   33 */
 40,  46,  40,  40,  46,  40,  40,  46,  /*   33 */
 40,  40,  46,  46,  60,  46,  80,  80,  /*   33 */
 80,  60,  60,  46,  46,  46,  46,  60,  /*   34 */
 60,  46,  46,  60,  60,  60,  46,  46,  /*   34 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   34 */
 46,  40,  40,  40,  40,  46,  40,  46,  /*   34 */
 46,  46,  46,  46,  46,  46,  81,  81,  /*   34 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   34 */
 60,  60,  40,  40,  40,  46,  46,  46,  /*   34 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   34 */
 46,  60,  60,  80,  46,  40,  40,  40,  /*   35 */
 40,  40,  40,  40,  46,  40,  46,  40,  /*   35 */
 40,  40,  46,  40,  40,  40,  40,  40,  /*   35 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   35 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   35 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   35 */
 40,  46,  40,  40,  46,  40,  40,  40,  /*   35 */
 40,  40,  46,  46,  60,  40,  80,  80,  /*   35 */
 80,  60,  60,  60,  60,  60,  46,  60,  /*   36 */
 60,  80,  46,  80,  80,  60,  46,  46,  /*   36 */
 15,  46,  46,  46,  46,  46,  46,  46,  /*   36 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   36 */
 40,  46,  46,  46,  46,  46,  81,  81,  /*   36 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   36 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   36 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   36 */
 46,  60,  80,  80,  46,  40,  40,  40,  /*   37 */
 40,  40,  40,  40,  40,  46,  46,  40,  /*   37 */
 40,  46,  46,  40,  40,  40,  40,  40,  /*   37 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   37 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   37 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   37 */
 40,  46,  40,  40,  46,  46,  40,  40,  /*   37 */
 40,  40,  46,  46,  60,  40,  80,  60,  /*   37 */
 80,  60,  60,  60,  46,  46,  46,  80,  /*   38 */
 80,  46,  46,  80,  80,  60,  46,  46,  /*   38 */
 46,  46,  46,  46,  46,  46,  60,  80,  /*   38 */
 46,  46,  46,  46,  40,  40,  46,  40,  /*   38 */
 40,  40,  46,  46,  46,  46,  81,  81,  /*   38 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   38 */
 15,  46,  46,  46,  46,  46,  46,  46,  /*   38 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   38 */
 46,  46,  60,  80,  46,  40,  40,  40,  /*   39 */
 40,  40,  40,  46,  46,  46,  40,  40,  /*   39 */
 40,  46,  40,  40,  40,  40,  46,  46,  /*   39 */
 46,  40,  40,  46,  40,  46,  40,  40,  /*   39 */
 46,  46,  46,  40,  40,  46,  46,  46,  /*   39 */
 40,  40,  40,  46,  46,  46,  40,  40,  /*   39 */
 40,  40,  40,  40,  40,  40,  46,  40,  /*   39 */
 40,  40,  46,  46,  46,  46,  80,  80,  /*   39 */
 60,  80,  80,  46,  46,  46,  80,  80,  /*   40 */
 80,  46,  80,  80,  80,  60,  46,  46,  /*   40 */
 46,  46,  46,  46,  46,  46,  46,  80,  /*   40 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   40 */
 46,  46,  46,  46,  46,  46,  46,  81,  /*   40 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   40 */
 84,  19,  19,  46,  46,  46,  46,  46,  /*   40 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   40 */
 46,  80,  80,  80,  46,  40,  40,  40,  /*   41 */
 40,  40,  40,  40,  40,  46,  40,  40,  /*   41 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   41 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   41 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   41 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   41 */
 40,  40,  40,  40,  46,  40,  40,  40,  /*   41 */
 40,  40,  46,  46,  46,  46,  60,  60,  /*   41 */
 60,  80,  80,  80,  80,  46,  60,  60,  /*   42 */
 60,  46,  60,  60,  60,  60,  46,  46,  /*   42 */
 46,  46,  46,  46,  46,  60,  60,  46,  /*   42 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   42 */
 40,  40,  46,  46,  46,  46,  81,  81,  /*   42 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   42 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   42 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   42 */
 46,  46,  80,  80,  46,  40,  40,  40,  /*   43 */
 40,  40,  40,  40,  40,  46,  40,  40,  /*   43 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   43 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   43 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   43 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   43 */
 40,  40,  40,  40,  46,  40,  40,  40,  /*   43 */
 40,  40,  46,  46,  46,  46,  80,  60,  /*   43 */
 80,  80,  80,  80,  80,  46,  60,  80,  /*   44 */
 80,  46,  80,  80,  60,  60,  46,  46,  /*   44 */
 46,  46,  46,  46,  46,  80,  80,  46,  /*   44 */
 46,  46,  46,  46,  46,  46,  40,  46,  /*   44 */
 40,  40,  46,  46,  46,  46,  81,  81,  /*   44 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   44 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   44 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   44 */
 46,  46,  80,  80,  46,  40,  40,  40,  /*   45 */
 40,  40,  40,  40,  40,  46,  40,  40,  /*   45 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   45 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   45 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   45 */
 40,  46,  40,  40,  40,  40,  40,  40,  /*   45 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   45 */
 40,  40,  46,  46,  46,  46,  80,  80,  /*   45 */
 80,  60,  60,  60,  46,  46,  80,  80,  /*   46 */
 80,  46,  80,  80,  80,  60,  46,  46,  /*   46 */
 46,  46,  46,  46,  46,  46,  46,  80,  /*   46 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   46 */
 40,  40,  46,  46,  46,  46,  81,  81,  /*   46 */
 81,  81,  81,  81,  81,  81,  81,  81,  /*   46 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   46 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   46 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   47 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   47 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   47 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   47 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   47 */
 40,  40,  40,  40,  40,  40,  40,   3,  /*   47 */
 40,  60,  40,  40,  60,  60,  60,  60,  /*   47 */
 60,  60,  60,  46,  46,  46,  46,   4,  /*   47 */
 40,  40,  40,  40,  40,  40,  59,  60,  /*   48 */
 60,  60,  60,  60,  60,  60,  60,  15,  /*   48 */
  9,   9,   9,   9,   9,   9,   9,   9,  /*   48 */
  9,   9,   3,   3,  46,  46,  46,  46,  /*   48 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   48 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   48 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   48 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   48 */
 46,  40,  40,  46,  40,  46,  46,  40,  /*   49 */
 40,  46,  40,  46,  46,  40,  46,  46,  /*   49 */
 46,  46,  46,  46,  40,  40,  40,  40,  /*   49 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   49 */
 46,  40,  40,  40,  46,  40,  46,  40,  /*   49 */
 46,  46,  40,  40,  46,  40,  40,   3,  /*   49 */
 40,  60,  40,  40,  60,  60,  60,  60,  /*   49 */
 60,  60,  46,  60,  60,  40,  46,  46,  /*   49 */
 40,  40,  40,  40,  40,  46,  59,  46,  /*   50 */
 60,  60,  60,  60,  60,  60,  46,  46,  /*   50 */
  9,   9,   9,   9,   9,   9,   9,   9,  /*   50 */
  9,   9,  46,  46,  40,  40,  46,  46,  /*   50 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   50 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   50 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   50 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   50 */
 15,  15,  15,  15,   3,   3,   3,   3,  /*   51 */
  3,   3,   3,   3,   3,   3,   3,   3,  /*   51 */
  3,   3,   3,  15,  15,  15,  15,  15,  /*   51 */
 60,  60,  15,  15,  15,  15,  15,  15,  /*   51 */
 78,  78,  78,  78,  78,  78,  78,  78,  /*   51 */
 78,  78,  85,  85,  85,  85,  85,  85,  /*   51 */
 85,  85,  85,  85,  15,  60,  15,  60,  /*   51 */
 15,  60,   5,   6,   5,   6,  80,  80,  /*   51 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   52 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   52 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   52 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   52 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   52 */
 40,  40,  46,  46,  46,  46,  46,  46,  /*   52 */
 46,  60,  60,  60,  60,  60,  60,  60,  /*   52 */
 60,  60,  60,  60,  60,  60,  60,  80,  /*   52 */
 60,  60,  60,  60,  60,   3,  60,  60,  /*   53 */
 60,  60,  60,  60,  46,  46,  46,  46,  /*   53 */
 60,  60,  60,  60,  60,  60,  46,  60,  /*   53 */
 46,  60,  60,  60,  60,  60,  60,  60,  /*   53 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   53 */
 60,  60,  60,  60,  60,  60,  46,  46,  /*   53 */
 46,  60,  60,  60,  60,  60,  60,  60,  /*   53 */
 46,  60,  46,  46,  46,  46,  46,  46,  /*   53 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   54 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   54 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   54 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   54 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   54 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   54 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   54 */
 76,  76,  76,  76,  76,  76,  76,  76,  /*   54 */
 76,  76,  76,  76,  76,  76,  46,  46,  /*   55 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   55 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   55 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   55 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   55 */
 16,  16,  16,  16,  16,  16,  16,  16,  /*   55 */
 16,  16,  16,  16,  16,  16,  16,  46,  /*   55 */
 46,  46,  46,   3,  46,  46,  46,  46,  /*   55 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   56 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  46,  46,  46,  46,  46,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   57 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  46,  46,  46,  46,  46,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   58 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   59 */
 40,  40,  46,  46,  46,  46,  46,  46,  /*   59 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   60 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  16,  16,  /*   61 */
 16,  16,  16,  16,  46,  46,  46,  46,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   61 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  23,  24,  23,  24,  23,  24,  /*   62 */
 23,  24,  46,  46,  46,  46,  46,  46,  /*   62 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   63 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   63 */
 86,  86,  86,  86,  86,  86,  46,  46,  /*   63 */
 87,  87,  87,  87,  87,  87,  46,  46,  /*   63 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   63 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   63 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   63 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   63 */
 86,  86,  86,  86,  86,  86,  46,  46,  /*   64 */
 87,  87,  87,  87,  87,  87,  46,  46,  /*   64 */
 16,  86,  16,  86,  16,  86,  16,  86,  /*   64 */
 46,  87,  46,  87,  46,  87,  46,  87,  /*   64 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   64 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   64 */
 88,  88,  89,  89,  89,  89,  90,  90,  /*   64 */
 91,  91,  92,  92,  93,  93,  46,  46,  /*   64 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   65 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   65 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   65 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   65 */
 86,  86,  86,  86,  86,  86,  86,  86,  /*   65 */
 87,  87,  87,  87,  87,  87,  87,  87,  /*   65 */
 86,  86,  16,  94,  16,  46,  16,  16,  /*   65 */
 87,  87,  95,  95,  96,  11,  38,  11,  /*   65 */
 11,  11,  16,  94,  16,  46,  16,  16,  /*   66 */
 97,  97,  97,  97,  96,  11,  11,  11,  /*   66 */
 86,  86,  16,  16,  46,  46,  16,  16,  /*   66 */
 87,  87,  98,  98,  46,  11,  11,  11,  /*   66 */
 86,  86,  16,  16,  16,  99,  16,  16,  /*   66 */
 87,  87, 100, 100, 101,  11,  11,  11,  /*   66 */
 46,  46,  16,  94,  16,  46,  16,  16,  /*   66 */
102, 102, 103, 103,  96,  11,  11,  46,  /*   66 */
  2,   2,   2,   2,   2,   2,   2,   2,  /*   67 */
  2,   2,   2,   2, 104, 104, 104, 104,  /*   67 */
  8,   8,   8,   8,   8,   8,   3,   3,  /*   67 */
  5,   6,   5,   5,   5,   6,   5,   5,  /*   67 */
  3,   3,   3,   3,   3,   3,   3,   3,  /*   67 */
105, 106, 104, 104, 104, 104, 104,  46,  /*   67 */
  3,   3,   3,   3,   3,   3,   3,   3,  /*   67 */
  3,   5,   6,   3,   3,   3,   3,  12,  /*   67 */
 12,   3,   3,   3,   7,   5,   6,  46,  /*   68 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   68 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   68 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   68 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   68 */
 46,  46, 104, 104, 104, 104, 104, 104,  /*   68 */
 17,  46,  46,  46,  17,  17,  17,  17,  /*   68 */
 17,  17,   7,   7,   7,   5,   6,  16,  /*   68 */
107, 107, 107, 107, 107, 107, 107, 107,  /*   69 */
107, 107,   7,   7,   7,   5,   6,  46,  /*   69 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   69 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   69 */
  4,   4,   4,   4,   4,   4,   4,   4,  /*   69 */
  4,   4,   4,   4,  46,  46,  46,  46,  /*   69 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   69 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   69 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   70 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   70 */
 60,  60,  60,  60,  60,  60,  60,  60,  /*   70 */
 60,  60,  60,  60,  60,  79,  79,  79,  /*   70 */
 79,  60,  46,  46,  46,  46,  46,  46,  /*   70 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   70 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   70 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   70 */
 15,  15,  38,  15,  15,  15,  15,  38,  /*   71 */
 15,  15,  16,  38,  38,  38,  16,  16,  /*   71 */
 38,  38,  38,  16,  15,  38,  15,  15,  /*   71 */
 38,  38,  38,  38,  38,  38,  15,  15,  /*   71 */
 15,  15,  15,  15,  38,  15,  38,  15,  /*   71 */
 38,  15,  38,  38,  38,  38,  16,  16,  /*   71 */
 38,  38,  15,  38,  16,  40,  40,  40,  /*   71 */
 40,  46,  46,  46,  46,  46,  46,  46,  /*   71 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   72 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   72 */
 46,  46,  46,  19,  19,  19,  19,  19,  /*   72 */
 19,  19,  19,  19,  19,  19,  19, 108,  /*   72 */
109, 109, 109, 109, 109, 109, 109, 109,  /*   72 */
109, 109, 109, 109, 110, 110, 110, 110,  /*   72 */
111, 111, 111, 111, 111, 111, 111, 111,  /*   72 */
111, 111, 111, 111, 112, 112, 112, 112,  /*   72 */
113, 113, 113,  46,  46,  46,  46,  46,  /*   73 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   73 */
  7,   7,   7,   7,   7,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   73 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   74 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   74 */
 15,  15,   7,  15,   7,  15,  15,  15,  /*   74 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   74 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   74 */
 15,  15,  15,  46,  46,  46,  46,  46,  /*   74 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   74 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   74 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   75 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,   7,   7,   7,   7,   7,   7,  /*   76 */
  7,   7,  46,  46,  46,  46,  46,  46,  /*   76 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   76 */
 15,  46,  15,  15,  15,  15,  15,  15,  /*   77 */
  7,   7,   7,   7,  15,  15,  15,  15,  /*   77 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   77 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   77 */
  7,   7,  15,  15,  15,  15,  15,  15,  /*   77 */
 15,   5,   6,  15,  15,  15,  15,  15,  /*   77 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   77 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   77 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   78 */
 15,  15,  15,  46,  46,  46,  46,  46,  /*   78 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   79 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   79 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   79 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   79 */
 15,  15,  15,  15,  15,  46,  46,  46,  /*   79 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   79 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   79 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   79 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   80 */
 15,  15,  15,  46,  46,  46,  46,  46,  /*   80 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   80 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   80 */
114, 114, 114, 114, 114, 114, 114, 114,  /*   80 */
114, 114, 114, 114, 114, 114, 114, 114,  /*   80 */
114, 114, 114, 114,  82,  82,  82,  82,  /*   80 */
 82,  82,  82,  82,  82,  82,  82,  82,  /*   80 */
 82,  82,  82,  82,  82,  82,  82,  82,  /*   81 */
115, 115, 115, 115, 115, 115, 115, 115,  /*   81 */
115, 115, 115, 115, 115, 115, 115, 115,  /*   81 */
115, 115, 115, 115,  15,  15,  15,  15,  /*   81 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   81 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   81 */
 15,  15,  15,  15,  15,  15, 116, 116,  /*   81 */
116, 116, 116, 116, 116, 116, 116, 116,  /*   81 */
116, 116, 116, 116, 116, 116, 116, 116,  /*   82 */
116, 116, 116, 116, 116, 116, 116, 116,  /*   82 */
117, 117, 117, 117, 117, 117, 117, 117,  /*   82 */
117, 117, 117, 117, 117, 117, 117, 117,  /*   82 */
117, 117, 117, 117, 117, 117, 117, 117,  /*   82 */
117, 117, 118,  46,  46,  46,  46,  46,  /*   82 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   82 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   82 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   83 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  46,  46,  /*   84 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   84 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   85 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   85 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   85 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  46,  46,  46,  46,  /*   86 */
 46,  46,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   86 */
 46,  15,  15,  15,  15,  46,  15,  15,  /*   87 */
 15,  15,  46,  46,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 46,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   87 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   88 */
 15,  15,  15,  15,  46,  15,  46,  15,  /*   88 */
 15,  15,  15,  46,  46,  46,  15,  46,  /*   88 */
 15,  15,  15,  15,  15,  15,  15,  46,  /*   88 */
 46,  15,  15,  15,  15,  15,  15,  15,  /*   88 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   88 */
 46,  46,  46,  46,  46,  46, 119, 119,  /*   88 */
119, 119, 119, 119, 119, 119, 119, 119,  /*   88 */
114, 114, 114, 114, 114, 114, 114, 114,  /*   89 */
114, 114,  83,  83,  83,  83,  83,  83,  /*   89 */
 83,  83,  83,  83,  15,  46,  46,  46,  /*   89 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   89 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   89 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   89 */
 46,  15,  15,  15,  15,  15,  15,  15,  /*   89 */
 15,  15,  15,  15,  15,  15,  15,  46,  /*   89 */
  2,   3,   3,   3,  15,  59,   3, 120,  /*   90 */
  5,   6,   5,   6,   5,   6,   5,   6,  /*   90 */
  5,   6,  15,  15,   5,   6,   5,   6,  /*   90 */
  5,   6,   5,   6,   8,   5,   6,   5,  /*   90 */
 15, 121, 121, 121, 121, 121, 121, 121,  /*   90 */
121, 121,  60,  60,  60,  60,  60,  60,  /*   90 */
  8,  59,  59,  59,  59,  59,  15,  15,  /*   90 */
 46,  46,  46,  46,  46,  46,  46,  15,  /*   90 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   91 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  46,  46,  46,  /*   92 */
 46,  60,  60,  59,  59,  59,  59,  46,  /*   92 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   92 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   93 */
 40,  40,  40,   3,  59,  59,  59,  46,  /*   93 */
 46,  46,  46,  46,  46,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  46,  46,  46,  /*   94 */
 46,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   94 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*   95 */
 40,  40,  40,  40,  40,  40,  40,  46,  /*   95 */
 15,  15,  85,  85,  85,  85,  15,  15,  /*   95 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   95 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   95 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   95 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   95 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   95 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  15,  46,  46,  46,  /*   96 */
 85,  85,  85,  85,  85,  85,  85,  85,  /*   96 */
 85,  85,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   96 */
 15,  15,  15,  15,  46,  46,  46,  46,  /*   97 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   97 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   97 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   97 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   97 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   97 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   97 */
 15,  15,  15,  15,  46,  46,  46,  15,  /*   97 */
114, 114, 114, 114, 114, 114, 114, 114,  /*   98 */
114, 114,  15,  15,  15,  15,  15,  15,  /*   98 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   98 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   98 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   98 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   98 */
 15,  46,  46,  46,  46,  46,  46,  46,  /*   98 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*   98 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  46,  46,  46,  46,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  46,  /*   99 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  46,  /*  100 */
 46,  46,  46,  15,  15,  15,  15,  15,  /*  100 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  46,  46,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  15,  /*  101 */
 15,  15,  15,  15,  15,  15,  15,  46,  /*  101 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  102 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  102 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  102 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  102 */
 40,  40,  40,  40,  40,  40,  46,  46,  /*  102 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  102 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  102 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  102 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  103 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  103 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  103 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  103 */
 40,  40,  40,  40,  46,  46,  46,  46,  /*  103 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  103 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  103 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  103 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
122, 122, 122, 122, 122, 122, 122, 122,  /*  104 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
123, 123, 123, 123, 123, 123, 123, 123,  /*  105 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  106 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  106 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  106 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  106 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  106 */
 40,  40,  40,  40,  40,  40,  46,  46,  /*  106 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  106 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  106 */
 16,  16,  16,  16,  16,  16,  16,  46,  /*  107 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  107 */
 46,  46,  46,  16,  16,  16,  16,  16,  /*  107 */
 46,  46,  46,  46,  46,  46,  60,  40,  /*  107 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  107 */
 40,   7,  40,  40,  40,  40,  40,  40,  /*  107 */
 40,  40,  40,  40,  40,  40,  40,  46,  /*  107 */
 40,  40,  40,  40,  40,  46,  40,  46,  /*  107 */
 40,  40,  46,  40,  40,  46,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  108 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  109 */
 40,  40,  46,  46,  46,  46,  46,  46,  /*  109 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  109 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  110 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  110 */
 46,  46,  46,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  110 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  111 */
 40,  40,  40,  40,  40,  40,   5,   6,  /*  111 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  112 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  112 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 46,  46,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  113 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  114 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  114 */
 40,  40,  40,  40,  46,  46,  46,  46,  /*  114 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  115 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  115 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  115 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  115 */
 60,  60,  60,  60,  46,  46,  46,  46,  /*  115 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  115 */
  3,   8,   8,  12,  12,   5,   6,   5,  /*  115 */
  6,   5,   6,   5,   6,   5,   6,   5,  /*  115 */
  6,   5,   6,   5,   6,  46,  46,  46,  /*  116 */
 46,   3,   3,   3,   3,  12,  12,  12,  /*  116 */
  3,   3,   3,  46,   3,   3,   3,   3,  /*  116 */
  8,   5,   6,   5,   6,   5,   6,   3,  /*  116 */
  3,   3,   7,   8,   7,   7,   7,  46,  /*  116 */
  3,   4,   3,   3,  46,  46,  46,  46,  /*  116 */
 40,  40,  40,  46,  40,  46,  40,  40,  /*  116 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  116 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  117 */
 40,  40,  40,  40,  40,  46,  46, 104,  /*  117 */
 46,   3,   3,   3,   4,   3,   3,   3,  /*  118 */
  5,   6,   3,   7,   3,   8,   3,   3,  /*  118 */
  9,   9,   9,   9,   9,   9,   9,   9,  /*  118 */
  9,   9,   3,   3,   7,   7,   7,   3,  /*  118 */
  3,  10,  10,  10,  10,  10,  10,  10,  /*  118 */
 10,  10,  10,  10,  10,  10,  10,  10,  /*  118 */
 10,  10,  10,  10,  10,  10,  10,  10,  /*  118 */
 10,  10,  10,   5,   3,   6,  11,  12,  /*  118 */
 11,  13,  13,  13,  13,  13,  13,  13,  /*  119 */
 13,  13,  13,  13,  13,  13,  13,  13,  /*  119 */
 13,  13,  13,  13,  13,  13,  13,  13,  /*  119 */
 13,  13,  13,   5,   7,   6,   7,  46,  /*  119 */
 46,   3,   5,   6,   3,   3,  40,  40,  /*  119 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  119 */
 59,  40,  40,  40,  40,  40,  40,  40,  /*  119 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  119 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  59,  59,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  40,  /*  120 */
 40,  40,  40,  40,  40,  40,  40,  46,  /*  120 */
 46,  46,  40,  40,  40,  40,  40,  40,  /*  121 */
 46,  46,  40,  40,  40,  40,  40,  40,  /*  121 */
 46,  46,  40,  40,  40,  40,  40,  40,  /*  121 */
 46,  46,  40,  40,  40,  46,  46,  46,  /*  121 */
  4,   4,   7,  11,  15,   4,   4,  46,  /*  121 */
  7,   7,   7,   7,   7,  15,  15,  46,  /*  121 */
 46,  46,  46,  46,  46,  46,  46,  46,  /*  121 */
 46,  46,  46,  46,  46,  15,  46,  46   /*  121 */
};

/* The A table has 124 entries for a total of 496 bytes. */

const uint32 js_A[] = {
0x0001000F,  /*    0   Cc, ignorable */
0x0004000F,  /*    1   Cc, whitespace */
0x0004000C,  /*    2   Zs, whitespace */
0x00000018,  /*    3   Po */
0x0006001A,  /*    4   Sc, currency */
0x00000015,  /*    5   Ps */
0x00000016,  /*    6   Pe */
0x00000019,  /*    7   Sm */
0x00000014,  /*    8   Pd */
0x00036089,  /*    9   Nd, identifier part, decimal 16 */
0x0827FF81,  /*   10   Lu, hasLower (add 32), identifier start, supradecimal 31 */
0x0000001B,  /*   11   Sk */
0x00050017,  /*   12   Pc, underscore */
0x0817FF82,  /*   13   Ll, hasUpper (subtract 32), identifier start, supradecimal 31 */
0x0000000C,  /*   14   Zs */
0x0000001C,  /*   15   So */
0x00070182,  /*   16   Ll, identifier start */
0x0000600B,  /*   17   No, decimal 16 */
0x0000500B,  /*   18   No, decimal 8 */
0x0000800B,  /*   19   No, strange */
0x08270181,  /*   20   Lu, hasLower (add 32), identifier start */
0x08170182,  /*   21   Ll, hasUpper (subtract 32), identifier start */
0xE1D70182,  /*   22   Ll, hasUpper (subtract -121), identifier start */
0x00670181,  /*   23   Lu, hasLower (add 1), identifier start */
0x00570182,  /*   24   Ll, hasUpper (subtract 1), identifier start */
0xCE670181,  /*   25   Lu, hasLower (add -199), identifier start */
0x3A170182,  /*   26   Ll, hasUpper (subtract 232), identifier start */
0xE1E70181,  /*   27   Lu, hasLower (add -121), identifier start */
0x4B170182,  /*   28   Ll, hasUpper (subtract 300), identifier start */
0x34A70181,  /*   29   Lu, hasLower (add 210), identifier start */
0x33A70181,  /*   30   Lu, hasLower (add 206), identifier start */
0x33670181,  /*   31   Lu, hasLower (add 205), identifier start */
0x32A70181,  /*   32   Lu, hasLower (add 202), identifier start */
0x32E70181,  /*   33   Lu, hasLower (add 203), identifier start */
0x33E70181,  /*   34   Lu, hasLower (add 207), identifier start */
0x34E70181,  /*   35   Lu, hasLower (add 211), identifier start */
0x34670181,  /*   36   Lu, hasLower (add 209), identifier start */
0x35670181,  /*   37   Lu, hasLower (add 213), identifier start */
0x00070181,  /*   38   Lu, identifier start */
0x36A70181,  /*   39   Lu, hasLower (add 218), identifier start */
0x00070185,  /*   40   Lo, identifier start */
0x36670181,  /*   41   Lu, hasLower (add 217), identifier start */
0x36E70181,  /*   42   Lu, hasLower (add 219), identifier start */
0x00AF0181,  /*   43   Lu, hasLower (add 2), hasTitle, identifier start */
0x007F0183,  /*   44   Lt, hasUpper (subtract 1), hasLower (add 1), hasTitle, identifier start */
0x009F0182,  /*   45   Ll, hasUpper (subtract 2), hasTitle, identifier start */
0x00000000,  /*   46   unassigned */
0x34970182,  /*   47   Ll, hasUpper (subtract 210), identifier start */
0x33970182,  /*   48   Ll, hasUpper (subtract 206), identifier start */
0x33570182,  /*   49   Ll, hasUpper (subtract 205), identifier start */
0x32970182,  /*   50   Ll, hasUpper (subtract 202), identifier start */
0x32D70182,  /*   51   Ll, hasUpper (subtract 203), identifier start */
0x33D70182,  /*   52   Ll, hasUpper (subtract 207), identifier start */
0x34570182,  /*   53   Ll, hasUpper (subtract 209), identifier start */
0x34D70182,  /*   54   Ll, hasUpper (subtract 211), identifier start */
0x35570182,  /*   55   Ll, hasUpper (subtract 213), identifier start */
0x36970182,  /*   56   Ll, hasUpper (subtract 218), identifier start */
0x36570182,  /*   57   Ll, hasUpper (subtract 217), identifier start */
0x36D70182,  /*   58   Ll, hasUpper (subtract 219), identifier start */
0x00070084,  /*   59   Lm, identifier start */
0x00030086,  /*   60   Mn, identifier part */
0x09A70181,  /*   61   Lu, hasLower (add 38), identifier start */
0x09670181,  /*   62   Lu, hasLower (add 37), identifier start */
0x10270181,  /*   63   Lu, hasLower (add 64), identifier start */
0x0FE70181,  /*   64   Lu, hasLower (add 63), identifier start */
0x09970182,  /*   65   Ll, hasUpper (subtract 38), identifier start */
0x09570182,  /*   66   Ll, hasUpper (subtract 37), identifier start */
0x10170182,  /*   67   Ll, hasUpper (subtract 64), identifier start */
0x0FD70182,  /*   68   Ll, hasUpper (subtract 63), identifier start */
0x0F970182,  /*   69   Ll, hasUpper (subtract 62), identifier start */
0x0E570182,  /*   70   Ll, hasUpper (subtract 57), identifier start */
0x0BD70182,  /*   71   Ll, hasUpper (subtract 47), identifier start */
0x0D970182,  /*   72   Ll, hasUpper (subtract 54), identifier start */
0x15970182,  /*   73   Ll, hasUpper (subtract 86), identifier start */
0x14170182,  /*   74   Ll, hasUpper (subtract 80), identifier start */
0x14270181,  /*   75   Lu, hasLower (add 80), identifier start */
0x0C270181,  /*   76   Lu, hasLower (add 48), identifier start */
0x0C170182,  /*   77   Ll, hasUpper (subtract 48), identifier start */
0x00034089,  /*   78   Nd, identifier part, decimal 0 */
0x00000087,  /*   79   Me */
0x00030088,  /*   80   Mc, identifier part */
0x00037489,  /*   81   Nd, identifier part, decimal 26 */
0x00005A0B,  /*   82   No, decimal 13 */
0x00006E0B,  /*   83   No, decimal 23 */
0x0000740B,  /*   84   No, decimal 26 */
0x0000000B,  /*   85   No */
0xFE170182,  /*   86   Ll, hasUpper (subtract -8), identifier start */
0xFE270181,  /*   87   Lu, hasLower (add -8), identifier start */
0xED970182,  /*   88   Ll, hasUpper (subtract -74), identifier start */
0xEA970182,  /*   89   Ll, hasUpper (subtract -86), identifier start */
0xE7170182,  /*   90   Ll, hasUpper (subtract -100), identifier start */
0xE0170182,  /*   91   Ll, hasUpper (subtract -128), identifier start */
0xE4170182,  /*   92   Ll, hasUpper (subtract -112), identifier start */
0xE0970182,  /*   93   Ll, hasUpper (subtract -126), identifier start */
0xFDD70182,  /*   94   Ll, hasUpper (subtract -9), identifier start */
0xEDA70181,  /*   95   Lu, hasLower (add -74), identifier start */
0xFDE70181,  /*   96   Lu, hasLower (add -9), identifier start */
0xEAA70181,  /*   97   Lu, hasLower (add -86), identifier start */
0xE7270181,  /*   98   Lu, hasLower (add -100), identifier start */
0xFE570182,  /*   99   Ll, hasUpper (subtract -7), identifier start */
0xE4270181,  /*  100   Lu, hasLower (add -112), identifier start */
0xFE670181,  /*  101   Lu, hasLower (add -7), identifier start */
0xE0270181,  /*  102   Lu, hasLower (add -128), identifier start */
0xE0A70181,  /*  103   Lu, hasLower (add -126), identifier start */
0x00010010,  /*  104   Cf, ignorable */
0x0004000D,  /*  105   Zl, whitespace */
0x0004000E,  /*  106   Zp, whitespace */
0x0000400B,  /*  107   No, decimal 0 */
0x0000440B,  /*  108   No, decimal 2 */
0x0427438A,  /*  109   Nl, hasLower (add 16), identifier start, decimal 1 */
0x0427818A,  /*  110   Nl, hasLower (add 16), identifier start, strange */
0x0417638A,  /*  111   Nl, hasUpper (subtract 16), identifier start, decimal 17 */
0x0417818A,  /*  112   Nl, hasUpper (subtract 16), identifier start, strange */
0x0007818A,  /*  113   Nl, identifier start, strange */
0x0000420B,  /*  114   No, decimal 1 */
0x0000720B,  /*  115   No, decimal 25 */
0x06A0001C,  /*  116   So, hasLower (add 26) */
0x0690001C,  /*  117   So, hasUpper (subtract 26) */
0x00006C0B,  /*  118   No, decimal 22 */
0x0000560B,  /*  119   No, decimal 11 */
0x0007738A,  /*  120   Nl, identifier start, decimal 25 */
0x0007418A,  /*  121   Nl, identifier start, decimal 0 */
0x00000013,  /*  122   Cs */
0x00000012   /*  123   Co */
};

const jschar js_uriReservedPlusPound_ucstr[] =
    {';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#', 0};
const jschar js_uriUnescaped_ucstr[] =
    {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
     'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
     'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
     'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
     'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
     '-', '_', '.', '!', '~', '*', '\'', '(', ')', 0};

#define URI_CHUNK 64U

/* Concatenate jschars onto the buffer */
static JSBool
AddCharsToURI(JSContext *cx, JSCharBuffer *buf,
              const jschar *chars, size_t length)
{
    size_t total;
    jschar *newchars;

    total = buf->length + length + 1;
    if (!buf->chars ||
        JS_HOWMANY(total, URI_CHUNK) > JS_HOWMANY(buf->length + 1, URI_CHUNK)) {
        total = JS_ROUNDUP(total, URI_CHUNK);
        newchars = (jschar *) JS_realloc(cx, buf->chars,
                                         total * sizeof(jschar));
        if (!newchars)
            return JS_FALSE;
        buf->chars = newchars;
    }
    js_strncpy(buf->chars + buf->length, chars, length);
    buf->length += length;
    buf->chars[buf->length] = 0;
    return JS_TRUE;
}

static JSBool
TransferBufferToString(JSContext *cx, JSCharBuffer *cb, jsval *rval)
{
    jschar *chars;
    size_t n;
    JSString *str;

    /*
     * Shrinking realloc can fail (e.g., with a BSD-style allocator), but we
     * don't worry about that case here.
     */
    n = cb->length;
    chars = (jschar *) JS_realloc(cx, cb->chars, (n + 1) * sizeof(jschar));
    if (!chars)
        chars = cb->chars;
    str = js_NewString(cx, chars, n);
    if (!str)
        return JS_FALSE;

    /* Successful allocation transfer ownership of cb->chars to the string. */
#ifdef DEBUG
    memset(cb, JS_FREE_PATTERN, sizeof *cb);
#endif

    *rval = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

/*
 * ECMA 3, 15.1.3 URI Handling Function Properties
 *
 * The following are implementations of the algorithms
 * given in the ECMA specification for the hidden functions
 * 'Encode' and 'Decode'.
 */
static JSBool
Encode(JSContext *cx, JSString *str, const jschar *unescapedSet,
       const jschar *unescapedSet2, jsval *rval)
{
    size_t length, j, k, L;
    JSCharBuffer cb;
    jschar *chars, c, c2;
    uint32 v;
    uint8 utf8buf[6];
    jschar hexBuf[4];
    static const char HexDigits[] = "0123456789ABCDEF"; /* NB: uppercase */

    JSSTRING_CHARS_AND_LENGTH(str, chars, length);
    if (length == 0) {
        *rval = STRING_TO_JSVAL(cx->runtime->emptyString);
        return JS_TRUE;
    }

    cb.length = 0;
    cb.chars = NULL;

    /* From this point the control must goto bad on failures. */
    hexBuf[0] = '%';
    hexBuf[3] = 0;
    for (k = 0; k < length; k++) {
        c = chars[k];
        if (js_strchr(unescapedSet, c) ||
            (unescapedSet2 && js_strchr(unescapedSet2, c))) {
            if (!AddCharsToURI(cx, &cb, &c, 1))
                goto bad;
        } else {
            if ((c >= 0xDC00) && (c <= 0xDFFF)) {
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_BAD_URI, NULL);
                goto bad;
            }
            if (c < 0xD800 || c > 0xDBFF) {
                v = c;
            } else {
                k++;
                if (k == length) {
                    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_BAD_URI, NULL);
                    goto bad;
                }
                c2 = chars[k];
                if ((c2 < 0xDC00) || (c2 > 0xDFFF)) {
                    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_BAD_URI, NULL);
                    goto bad;
                }
                v = ((c - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
            }
            L = js_OneUcs4ToUtf8Char(utf8buf, v);
            for (j = 0; j < L; j++) {
                hexBuf[1] = HexDigits[utf8buf[j] >> 4];
                hexBuf[2] = HexDigits[utf8buf[j] & 0xf];
                if (!AddCharsToURI(cx, &cb, hexBuf, 3))
                    goto bad;
            }
        }
    }

    if (!TransferBufferToString(cx, &cb, rval))
        goto bad;

    return JS_TRUE;

  bad:
    JS_free(cx, cb.chars);
    return JS_FALSE;
}

static JSBool
Decode(JSContext *cx, JSString *str, const jschar *reservedSet, jsval *rval)
{
    size_t length, start, k;
    JSCharBuffer cb;
    jschar *chars, c, H;
    uint32 v;
    jsuint B;
    uint8 octets[6];
    intN j, n;

    JSSTRING_CHARS_AND_LENGTH(str, chars, length);
    if (length == 0) {
        *rval = STRING_TO_JSVAL(cx->runtime->emptyString);
        return JS_TRUE;
    }

    cb.length = 0;
    cb.chars = NULL;

    /* From this point the control must goto bad on failures. */
    for (k = 0; k < length; k++) {
        c = chars[k];
        if (c == '%') {
            start = k;
            if ((k + 2) >= length)
                goto report_bad_uri;
            if (!JS7_ISHEX(chars[k+1]) || !JS7_ISHEX(chars[k+2]))
                goto report_bad_uri;
            B = JS7_UNHEX(chars[k+1]) * 16 + JS7_UNHEX(chars[k+2]);
            k += 2;
            if (!(B & 0x80)) {
                c = (jschar)B;
            } else {
                n = 1;
                while (B & (0x80 >> n))
                    n++;
                if (n == 1 || n > 6)
                    goto report_bad_uri;
                octets[0] = (uint8)B;
                if (k + 3 * (n - 1) >= length)
                    goto report_bad_uri;
                for (j = 1; j < n; j++) {
                    k++;
                    if (chars[k] != '%')
                        goto report_bad_uri;
                    if (!JS7_ISHEX(chars[k+1]) || !JS7_ISHEX(chars[k+2]))
                        goto report_bad_uri;
                    B = JS7_UNHEX(chars[k+1]) * 16 + JS7_UNHEX(chars[k+2]);
                    if ((B & 0xC0) != 0x80)
                        goto report_bad_uri;
                    k += 2;
                    octets[j] = (char)B;
                }
                v = Utf8ToOneUcs4Char(octets, n);
                if (v >= 0x10000) {
                    v -= 0x10000;
                    if (v > 0xFFFFF)
                        goto report_bad_uri;
                    c = (jschar)((v & 0x3FF) + 0xDC00);
                    H = (jschar)((v >> 10) + 0xD800);
                    if (!AddCharsToURI(cx, &cb, &H, 1))
                        goto bad;
                } else {
                    c = (jschar)v;
                }
            }
            if (js_strchr(reservedSet, c)) {
                if (!AddCharsToURI(cx, &cb, &chars[start], (k - start + 1)))
                    goto bad;
            } else {
                if (!AddCharsToURI(cx, &cb, &c, 1))
                    goto bad;
            }
        } else {
            if (!AddCharsToURI(cx, &cb, &c, 1))
                return JS_FALSE;
        }
    }

    if (!TransferBufferToString(cx, &cb, rval))
        goto bad;

    return JS_TRUE;

  report_bad_uri:
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_BAD_URI);
    /* FALL THROUGH */

  bad:
    JS_free(cx, cb.chars);
    return JS_FALSE;
}

static JSBool
str_decodeURI(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    str = ArgToRootedString(cx, argc, vp, 0);
    if (!str)
        return JS_FALSE;
    return Decode(cx, str, js_uriReservedPlusPound_ucstr, vp);
}

static JSBool
str_decodeURI_Component(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    str = ArgToRootedString(cx, argc, vp, 0);
    if (!str)
        return JS_FALSE;
    return Decode(cx, str, js_empty_ucstr, vp);
}

static JSBool
str_encodeURI(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    str = ArgToRootedString(cx, argc, vp, 0);
    if (!str)
        return JS_FALSE;
    return Encode(cx, str, js_uriReservedPlusPound_ucstr, js_uriUnescaped_ucstr,
                  vp);
}

static JSBool
str_encodeURI_Component(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    str = ArgToRootedString(cx, argc, vp, 0);
    if (!str)
        return JS_FALSE;
    return Encode(cx, str, js_uriUnescaped_ucstr, NULL, vp);
}

/*
 * Convert one UCS-4 char and write it into a UTF-8 buffer, which must be at
 * least 6 bytes long.  Return the number of UTF-8 bytes of data written.
 */
int
js_OneUcs4ToUtf8Char(uint8 *utf8Buffer, uint32 ucs4Char)
{
    int utf8Length = 1;

    JS_ASSERT(ucs4Char <= 0x7FFFFFFF);
    if (ucs4Char < 0x80) {
        *utf8Buffer = (uint8)ucs4Char;
    } else {
        int i;
        uint32 a = ucs4Char >> 11;
        utf8Length = 2;
        while (a) {
            a >>= 5;
            utf8Length++;
        }
        i = utf8Length;
        while (--i) {
            utf8Buffer[i] = (uint8)((ucs4Char & 0x3F) | 0x80);
            ucs4Char >>= 6;
        }
        *utf8Buffer = (uint8)(0x100 - (1 << (8-utf8Length)) + ucs4Char);
    }
    return utf8Length;
}

/*
 * Convert a utf8 character sequence into a UCS-4 character and return that
 * character.  It is assumed that the caller already checked that the sequence
 * is valid.
 */
static uint32
Utf8ToOneUcs4Char(const uint8 *utf8Buffer, int utf8Length)
{
    uint32 ucs4Char;
    uint32 minucs4Char;
    /* from Unicode 3.1, non-shortest form is illegal */
    static const uint32 minucs4Table[] = {
        0x00000080, 0x00000800, 0x0001000, 0x0020000, 0x0400000
    };

    JS_ASSERT(utf8Length >= 1 && utf8Length <= 6);
    if (utf8Length == 1) {
        ucs4Char = *utf8Buffer;
        JS_ASSERT(!(ucs4Char & 0x80));
    } else {
        JS_ASSERT((*utf8Buffer & (0x100 - (1 << (7-utf8Length)))) ==
                  (0x100 - (1 << (8-utf8Length))));
        ucs4Char = *utf8Buffer++ & ((1<<(7-utf8Length))-1);
        minucs4Char = minucs4Table[utf8Length-2];
        while (--utf8Length) {
            JS_ASSERT((*utf8Buffer & 0xC0) == 0x80);
            ucs4Char = ucs4Char<<6 | (*utf8Buffer++ & 0x3F);
        }
        if (ucs4Char < minucs4Char ||
            ucs4Char == 0xFFFE || ucs4Char == 0xFFFF) {
            ucs4Char = 0xFFFD;
        }
    }
    return ucs4Char;
}

#if defined DEBUG || defined JS_DUMP_PROPTREE_STATS

JS_FRIEND_API(size_t)
js_PutEscapedStringImpl(char *buffer, size_t bufferSize, FILE *fp,
                        JSString *str, uint32 quote)
{
    jschar *chars, *charsEnd;
    size_t n;
    const char *escape;
    char c;
    uintN u, hex, shift;
    enum {
        STOP, FIRST_QUOTE, LAST_QUOTE, CHARS, ESCAPE_START, ESCAPE_MORE
    } state;

    JS_ASSERT(quote == 0 || quote == '\'' || quote == '"');
    JS_ASSERT_IF(buffer, bufferSize != 0);
    JS_ASSERT_IF(!buffer, bufferSize == 0);
    JS_ASSERT_IF(fp, !buffer);

    JSSTRING_CHARS_AND_END(str, chars, charsEnd);
    n = 0;
    --bufferSize;
    state = FIRST_QUOTE;
    shift = 0;
    hex = 0;
    u = 0;
    c = 0;  /* to quell GCC warnings */

    for (;;) {
        switch (state) {
          case STOP:
            goto stop;
          case FIRST_QUOTE:
            state = CHARS;
            goto do_quote;
          case LAST_QUOTE:
            state = STOP;
          do_quote:
            if (quote == 0)
                continue;
            c = (char)quote;
            break;
          case CHARS:
            if (chars == charsEnd) {
                state = LAST_QUOTE;
                continue;
            }
            u = *chars++;
            if (u < ' ') {
                if (u != 0) {
                    escape = strchr(js_EscapeMap, (int)u);
                    if (escape) {
                        u = escape[1];
                        goto do_escape;
                    }
                }
                goto do_hex_escape;
            }
            if (u < 127) {
                if (u == quote || u == '\\')
                    goto do_escape;
                c = (char)u;
            } else if (u < 0x100) {
                goto do_hex_escape;
            } else {
                shift = 16;
                hex = u;
                u = 'u';
                goto do_escape;
            }
            break;
          do_hex_escape:
            shift = 8;
            hex = u;
            u = 'x';
          do_escape:
            c = '\\';
            state = ESCAPE_START;
            break;
          case ESCAPE_START:
            JS_ASSERT(' ' <= u && u < 127);
            c = (char)u;
            state = ESCAPE_MORE;
            break;
          case ESCAPE_MORE:
            if (shift == 0) {
                state = CHARS;
                continue;
            }
            shift -= 4;
            u = 0xF & (hex >> shift);
            c = (char)(u + (u < 10 ? '0' : 'A' - 10));
            break;
        }
        if (buffer) {
            if (n == bufferSize)
                break;
            buffer[n] = c;
        } else if (fp) {
            fputc(c, fp);
        }
        n++;
    }
  stop:
    if (buffer)
        buffer[n] = '\0';
    return n;
}

#endif
