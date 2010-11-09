/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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
 * The Original Code is Mozilla SpiderMonkey JavaScript 1.9 code, released
 * May 28, 2008.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Corporation.
 *
 * Contributor(s):
 *   Jason Orendorff <jorendorff@mozilla.com>
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

#ifndef jsbuiltins_h___
#define jsbuiltins_h___

#ifdef JS_TRACER

#include "nanojit/nanojit.h"
#include "jstracer.h"

enum JSTNErrType { INFALLIBLE, FAIL_NULL, FAIL_NEG, FAIL_VOID, FAIL_JSVAL };
enum { JSTN_ERRTYPE_MASK = 7, JSTN_MORE = 8 };

#define JSTN_ERRTYPE(jstn)  ((jstn)->flags & JSTN_ERRTYPE_MASK)

/*
 * |prefix| and |argtypes| declare what arguments should be passed to the
 * native function.  |prefix| can contain the following characters:
 *
 * 'C': a JSContext* argument
 * 'T': |this| as a JSObject* argument (bails if |this| is not an object)
 * 'S': |this| as a JSString* argument (bails if |this| is not a string)
 * 'R': a JSRuntime* argument
 * 'P': the pc as a jsbytecode*
 * 'D': |this| as a number (jsdouble)
 * 'f': the function being called, as a JSObject*
 * 'p': the .prototype of the function, as a JSObject*
 *
 * The corresponding things will get passed as arguments to the builtin in
 * reverse order (so TC means JSContext* as the first arg, and the
 * JSObject* for |this| as the second arg).
 *
 * |argtypes| can contain the following characters:
 * 'd': a number (double) argument
 * 'i': an integer argument
 * 's': a JSString* argument
 * 'o': a JSObject* argument
 * 'r': a JSObject* argument that is of class js_RegExpClass
 * 'f': a JSObject* argument that is of class js_FunctionClass
 * 'v': a jsval argument (boxing whatever value is actually being passed in)
 */
struct JSTraceableNative {
    JSFastNative            native;
    const nanojit::CallInfo *builtin;
    const char              *prefix;
    const char              *argtypes;
    uintN                   flags;  /* JSTN_MORE | JSTNErrType */
};

/*
 * We use a magic boxed pointer value to represent error conditions that
 * trigger a side exit. The address is so low that it should never be actually
 * in use. If it is, a performance regression occurs, not an actual runtime
 * error.
 */
#define JSVAL_ERROR_COOKIE OBJECT_TO_JSVAL((void*)0x10)

/* Macros used by JS_DEFINE_CALLINFOn. */
#ifdef DEBUG
#define _JS_CI_NAME(op) ,#op
#else
#define _JS_CI_NAME(op)
#endif

#define  _JS_I32_ARGSIZE    nanojit::ARGSIZE_LO
#define  _JS_I32_RETSIZE    nanojit::ARGSIZE_LO
#define  _JS_F64_ARGSIZE    nanojit::ARGSIZE_F
#define  _JS_F64_RETSIZE    nanojit::ARGSIZE_F
#define  _JS_PTR_ARGSIZE    nanojit::ARGSIZE_LO
#if defined AVMPLUS_64BIT
# define _JS_PTR_RETSIZE    nanojit::ARGSIZE_Q
#else
# define _JS_PTR_RETSIZE    nanojit::ARGSIZE_LO
#endif

/*
 * Supported types for builtin functions. 
 *
 * Types with -- for the two string fields are not permitted as argument types
 * in JS_DEFINE_TRCINFO.
 *
 * If a traceable native can fail, the values that indicate failure are part of
 * the return type:
 *     JSVAL_FAIL: JSVAL_ERROR_COOKIE
 *     BOOL_FAIL: JSVAL_TO_BOOLEAN(JSVAL_VOID)
 *     INT32_FAIL: any negative value
 *     STRING_FAIL: NULL
 *     OBJECT_FAIL_NULL: NULL
 *     OBJECT_FAIL_VOID: JSVAL_TO_OBJECT(JSVAL_VOID)
 *         (NULL means the function successfully returned JS null.)
 *
 * Special builtins known to the tracer can have their own idiosyncratic
 * error codes.
 *
 * When a traceable native returns a value indicating failure, we fall off
 * trace.  If an exception is pending, it is thrown; otherwise, we assume the
 * builtin had no side effects and retry the current bytecode in the
 * interpreter.
 * 
 * So a builtin must not return a value indicating failure after causing side
 * effects (such as reporting an error), without setting an exception pending.
 * The operation would be retried, despite the first attempt's observable
 * effects.
 */
#define _JS_CTYPE(ctype, size, pch, ach, flags)     (ctype, size, pch, ach, flags)
#define _JS_CTYPE_CONTEXT          _JS_CTYPE(JSContext *,            _JS_PTR,"C", "", INFALLIBLE)
#define _JS_CTYPE_RUNTIME          _JS_CTYPE(JSRuntime *,            _JS_PTR,"R", "", INFALLIBLE)
#define _JS_CTYPE_THIS             _JS_CTYPE(JSObject *,             _JS_PTR,"T", "", INFALLIBLE)
#define _JS_CTYPE_THIS_DOUBLE      _JS_CTYPE(jsdouble,               _JS_F64,"D", "", INFALLIBLE)
#define _JS_CTYPE_THIS_STRING      _JS_CTYPE(JSString *,             _JS_PTR,"S", "", INFALLIBLE)
#define _JS_CTYPE_PC               _JS_CTYPE(jsbytecode *,           _JS_PTR,"P", "", INFALLIBLE)
#define _JS_CTYPE_JSVAL            _JS_CTYPE(jsval,                  _JS_PTR, "","v", INFALLIBLE)
#define _JS_CTYPE_JSVAL_FAIL       _JS_CTYPE(jsval,                  _JS_PTR, --, --, FAIL_JSVAL)
#define _JS_CTYPE_BOOL             _JS_CTYPE(JSBool,                 _JS_I32, "","i", INFALLIBLE)
#define _JS_CTYPE_BOOL_FAIL        _JS_CTYPE(int32,                  _JS_I32, --, --, FAIL_VOID)
#define _JS_CTYPE_INT32            _JS_CTYPE(int32,                  _JS_I32, "","i", INFALLIBLE)
#define _JS_CTYPE_INT32_FAIL       _JS_CTYPE(int32,                  _JS_I32, --, --, FAIL_NEG)
#define _JS_CTYPE_UINT32           _JS_CTYPE(uint32,                 _JS_I32, --, --, INFALLIBLE)
#define _JS_CTYPE_DOUBLE           _JS_CTYPE(jsdouble,               _JS_F64, "","d", INFALLIBLE)
#define _JS_CTYPE_STRING           _JS_CTYPE(JSString *,             _JS_PTR, "","s", INFALLIBLE)
#define _JS_CTYPE_STRING_FAIL      _JS_CTYPE(JSString *,             _JS_PTR, --, --, FAIL_NULL)
#define _JS_CTYPE_OBJECT           _JS_CTYPE(JSObject *,             _JS_PTR, "","o", INFALLIBLE)
#define _JS_CTYPE_OBJECT_FAIL_NULL _JS_CTYPE(JSObject *,             _JS_PTR, --, --, FAIL_NULL)
#define _JS_CTYPE_OBJECT_FAIL_VOID _JS_CTYPE(JSObject *,             _JS_PTR, --, --, FAIL_VOID)
#define _JS_CTYPE_REGEXP           _JS_CTYPE(JSObject *,             _JS_PTR, "","r", INFALLIBLE)
#define _JS_CTYPE_SCOPEPROP        _JS_CTYPE(JSScopeProperty *,      _JS_PTR, --, --, INFALLIBLE)
#define _JS_CTYPE_SIDEEXIT         _JS_CTYPE(SideExit *,             _JS_PTR, --, --, INFALLIBLE)
#define _JS_CTYPE_INTERPSTATE      _JS_CTYPE(InterpState *,          _JS_PTR, --, --, INFALLIBLE)
#define _JS_CTYPE_FRAGMENT         _JS_CTYPE(nanojit::Fragment *,    _JS_PTR, --, --, INFALLIBLE)

#define _JS_EXPAND(tokens)  tokens

#define _JS_CTYPE_TYPE2(t,s,p,a,f)      t
#define _JS_CTYPE_TYPE(tyname)          _JS_EXPAND(_JS_CTYPE_TYPE2    _JS_CTYPE_##tyname)
#define _JS_CTYPE_RETSIZE2(t,s,p,a,f)   s##_RETSIZE
#define _JS_CTYPE_RETSIZE(tyname)       _JS_EXPAND(_JS_CTYPE_RETSIZE2 _JS_CTYPE_##tyname)
#define _JS_CTYPE_ARGSIZE2(t,s,p,a,f)   s##_ARGSIZE
#define _JS_CTYPE_ARGSIZE(tyname)       _JS_EXPAND(_JS_CTYPE_ARGSIZE2 _JS_CTYPE_##tyname)
#define _JS_CTYPE_PCH2(t,s,p,a,f)       p
#define _JS_CTYPE_PCH(tyname)           _JS_EXPAND(_JS_CTYPE_PCH2     _JS_CTYPE_##tyname)
#define _JS_CTYPE_ACH2(t,s,p,a,f)       a
#define _JS_CTYPE_ACH(tyname)           _JS_EXPAND(_JS_CTYPE_ACH2     _JS_CTYPE_##tyname)
#define _JS_CTYPE_FLAGS2(t,s,p,a,f)     f
#define _JS_CTYPE_FLAGS(tyname)         _JS_EXPAND(_JS_CTYPE_FLAGS2   _JS_CTYPE_##tyname)

#define _JS_static_TN(t)  static t
#define _JS_static_CI     static
#define _JS_extern_TN(t)  extern t
#define _JS_extern_CI
#define _JS_FRIEND_TN(t)  extern JS_FRIEND_API(t)
#define _JS_FRIEND_CI
#define _JS_TN_LINKAGE(linkage, t)  _JS_##linkage##_TN(t)
#define _JS_CI_LINKAGE(linkage)     _JS_##linkage##_CI

#define _JS_CALLINFO(name) name##_ci

#if defined(JS_NO_FASTCALL) && defined(NANOJIT_IA32)
#define _JS_DEFINE_CALLINFO(linkage, name, crtype, cargtypes, argtypes, cse, fold)                \
    _JS_TN_LINKAGE(linkage, crtype) name cargtypes;                                               \
    _JS_CI_LINKAGE(linkage) const nanojit::CallInfo _JS_CALLINFO(name) =                          \
        { (intptr_t) &name, argtypes, cse, fold, nanojit::ABI_CDECL _JS_CI_NAME(name) };
#else
#define _JS_DEFINE_CALLINFO(linkage, name, crtype, cargtypes, argtypes, cse, fold)                \
    _JS_TN_LINKAGE(linkage, crtype) FASTCALL name cargtypes;                                      \
    _JS_CI_LINKAGE(linkage) const nanojit::CallInfo _JS_CALLINFO(name) =                          \
        { (intptr_t) &name, argtypes, cse, fold, nanojit::ABI_FASTCALL _JS_CI_NAME(name) };
#endif

/*
 * Declare a C function named <op> and a CallInfo struct named <op>_callinfo so the
 * tracer can call it. |linkage| controls the visibility of both the function
 * and the CallInfo global. It can be extern, static, or FRIEND, which
 * specifies JS_FRIEND_API linkage for the function.
 */
#define JS_DEFINE_CALLINFO_1(linkage, rt, op, at0, cse, fold)                                     \
    _JS_DEFINE_CALLINFO(linkage, op, _JS_CTYPE_TYPE(rt), (_JS_CTYPE_TYPE(at0)),                   \
                        (_JS_CTYPE_ARGSIZE(at0) << 2) | _JS_CTYPE_RETSIZE(rt), cse, fold)
#define JS_DEFINE_CALLINFO_2(linkage, rt, op, at0, at1, cse, fold)                                \
    _JS_DEFINE_CALLINFO(linkage, op, _JS_CTYPE_TYPE(rt),                                          \
                        (_JS_CTYPE_TYPE(at0), _JS_CTYPE_TYPE(at1)),                               \
                        (_JS_CTYPE_ARGSIZE(at0) << 4) | (_JS_CTYPE_ARGSIZE(at1) << 2) |           \
                        _JS_CTYPE_RETSIZE(rt),                                                    \
                        cse, fold)
#define JS_DEFINE_CALLINFO_3(linkage, rt, op, at0, at1, at2, cse, fold)                           \
    _JS_DEFINE_CALLINFO(linkage, op, _JS_CTYPE_TYPE(rt),                                          \
                        (_JS_CTYPE_TYPE(at0), _JS_CTYPE_TYPE(at1), _JS_CTYPE_TYPE(at2)),          \
                        (_JS_CTYPE_ARGSIZE(at0) << 6) | (_JS_CTYPE_ARGSIZE(at1) << 4) |           \
                        (_JS_CTYPE_ARGSIZE(at2) << 2) | _JS_CTYPE_RETSIZE(rt),                    \
                        cse, fold)
#define JS_DEFINE_CALLINFO_4(linkage, rt, op, at0, at1, at2, at3, cse, fold)                      \
    _JS_DEFINE_CALLINFO(linkage, op, _JS_CTYPE_TYPE(rt),                                          \
                        (_JS_CTYPE_TYPE(at0), _JS_CTYPE_TYPE(at1), _JS_CTYPE_TYPE(at2),           \
                         _JS_CTYPE_TYPE(at3)),                                                    \
                        (_JS_CTYPE_ARGSIZE(at0) << 8) | (_JS_CTYPE_ARGSIZE(at1) << 6) |           \
                        (_JS_CTYPE_ARGSIZE(at2) << 4) | (_JS_CTYPE_ARGSIZE(at3) << 2) |           \
                        _JS_CTYPE_RETSIZE(rt),                                                    \
                        cse, fold)
#define JS_DEFINE_CALLINFO_5(linkage, rt, op, at0, at1, at2, at3, at4, cse, fold)                 \
    _JS_DEFINE_CALLINFO(linkage, op, _JS_CTYPE_TYPE(rt),                                          \
                        (_JS_CTYPE_TYPE(at0), _JS_CTYPE_TYPE(at1), _JS_CTYPE_TYPE(at2),           \
                         _JS_CTYPE_TYPE(at3), _JS_CTYPE_TYPE(at4)),                               \
                        (_JS_CTYPE_ARGSIZE(at0) << 10) | (_JS_CTYPE_ARGSIZE(at1) << 8) |          \
                        (_JS_CTYPE_ARGSIZE(at2) << 6) | (_JS_CTYPE_ARGSIZE(at3) << 4) |           \
                        (_JS_CTYPE_ARGSIZE(at4) << 2) | _JS_CTYPE_RETSIZE(rt),                    \
                        cse, fold)

#define JS_DECLARE_CALLINFO(name)  extern const nanojit::CallInfo _JS_CALLINFO(name);

#define _JS_TN_INIT_HELPER_n(n, args)  _JS_TN_INIT_HELPER_##n args

#define _JS_TN_INIT_HELPER_1(linkage, rt, op, at0, cse, fold)                                     \
    &_JS_CALLINFO(op),                                                                            \
    _JS_CTYPE_PCH(at0),                                                                           \
    _JS_CTYPE_ACH(at0),                                                                           \
    _JS_CTYPE_FLAGS(rt)

#define _JS_TN_INIT_HELPER_2(linkage, rt, op, at0, at1, cse, fold)                                \
    &_JS_CALLINFO(op),                                                                            \
    _JS_CTYPE_PCH(at1) _JS_CTYPE_PCH(at0),                                                        \
    _JS_CTYPE_ACH(at0) _JS_CTYPE_ACH(at1),                                                        \
    _JS_CTYPE_FLAGS(rt)

#define _JS_TN_INIT_HELPER_3(linkage, rt, op, at0, at1, at2, cse, fold)                           \
    &_JS_CALLINFO(op),                                                                            \
    _JS_CTYPE_PCH(at2) _JS_CTYPE_PCH(at1) _JS_CTYPE_PCH(at0),                                     \
    _JS_CTYPE_ACH(at0) _JS_CTYPE_ACH(at1) _JS_CTYPE_ACH(at2),                                     \
    _JS_CTYPE_FLAGS(rt)

#define _JS_TN_INIT_HELPER_4(linkage, rt, op, at0, at1, at2, at3, cse, fold)                      \
    &_JS_CALLINFO(op),                                                                            \
    _JS_CTYPE_PCH(at3) _JS_CTYPE_PCH(at2) _JS_CTYPE_PCH(at1) _JS_CTYPE_PCH(at0),                  \
    _JS_CTYPE_ACH(at0) _JS_CTYPE_ACH(at1) _JS_CTYPE_ACH(at2) _JS_CTYPE_ACH(at3),                  \
    _JS_CTYPE_FLAGS(rt)

#define _JS_TN_INIT_HELPER_5(linkage, rt, op, at0, at1, at2, at3, at4, cse, fold)                 \
    &_JS_CALLINFO(op),                                                                            \
    _JS_CTYPE_PCH(at4) _JS_CTYPE_PCH(at3) _JS_CTYPE_PCH(at2) _JS_CTYPE_PCH(at1)                   \
        _JS_CTYPE_PCH(at0),                                                                       \
    _JS_CTYPE_ACH(at0) _JS_CTYPE_ACH(at1) _JS_CTYPE_ACH(at2) _JS_CTYPE_ACH(at3)                   \
        _JS_CTYPE_ACH(at4),                                                                       \
    _JS_CTYPE_FLAGS(rt)

#define JS_DEFINE_TRCINFO_1(name, tn0)                                                            \
    _JS_DEFINE_CALLINFO_n tn0                                                                     \
    JSTraceableNative name##_trcinfo[] = {                                                        \
        { name, _JS_TN_INIT_HELPER_n tn0 }                                                        \
    };

#define JS_DEFINE_TRCINFO_2(name, tn0, tn1)                                                       \
    _JS_DEFINE_CALLINFO_n tn0                                                                     \
    _JS_DEFINE_CALLINFO_n tn1                                                                     \
    JSTraceableNative name##_trcinfo[] = {                                                        \
        { name, _JS_TN_INIT_HELPER_n tn0 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn1 }                                                        \
    };

#define JS_DEFINE_TRCINFO_3(name, tn0, tn1, tn2)                                                  \
    _JS_DEFINE_CALLINFO_n tn0                                                                     \
    _JS_DEFINE_CALLINFO_n tn1                                                                     \
    _JS_DEFINE_CALLINFO_n tn2                                                                     \
    JSTraceableNative name##_trcinfo[] = {                                                        \
        { name, _JS_TN_INIT_HELPER_n tn0 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn1 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn2 }                                                        \
    };

#define JS_DEFINE_TRCINFO_4(name, tn0, tn1, tn2, tn3)                                             \
    _JS_DEFINE_CALLINFO_n tn0                                                                     \
    _JS_DEFINE_CALLINFO_n tn1                                                                     \
    _JS_DEFINE_CALLINFO_n tn2                                                                     \
    _JS_DEFINE_CALLINFO_n tn3                                                                     \
    JSTraceableNative name##_trcinfo[] = {                                                        \
        { name, _JS_TN_INIT_HELPER_n tn0 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn1 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn2 | JSTN_MORE },                                           \
        { name, _JS_TN_INIT_HELPER_n tn3 }                                                        \
    };

#define _JS_DEFINE_CALLINFO_n(n, args)  JS_DEFINE_CALLINFO_##n args

jsdouble FASTCALL
js_StringToNumber(JSContext* cx, JSString* str);

jsdouble FASTCALL
js_BooleanOrUndefinedToNumber(JSContext* cx, int32 unboxed);

#else

#define JS_DEFINE_CALLINFO_1(linkage, rt, op, at0, cse, fold)
#define JS_DEFINE_CALLINFO_2(linkage, rt, op, at0, at1, cse, fold)
#define JS_DEFINE_CALLINFO_3(linkage, rt, op, at0, at1, at2, cse, fold)
#define JS_DEFINE_CALLINFO_4(linkage, rt, op, at0, at1, at2, at3, cse, fold)
#define JS_DEFINE_CALLINFO_5(linkage, rt, op, at0, at1, at2, at3, at4, cse, fold)
#define JS_DECLARE_CALLINFO(name)
#define JS_DEFINE_TRCINFO_1(name, tn0)
#define JS_DEFINE_TRCINFO_2(name, tn0, tn1)
#define JS_DEFINE_TRCINFO_3(name, tn0, tn1, tn2)
#define JS_DEFINE_TRCINFO_4(name, tn0, tn1, tn2, tn3)

#endif /* !JS_TRACER */

/* Defined in jsarray.cpp */
JS_DECLARE_CALLINFO(js_Array_dense_setelem)
JS_DECLARE_CALLINFO(js_FastNewArray)
JS_DECLARE_CALLINFO(js_Array_1int)
JS_DECLARE_CALLINFO(js_Array_1str)
JS_DECLARE_CALLINFO(js_Array_2obj)
JS_DECLARE_CALLINFO(js_Array_3num)

/* Defined in jsdate.cpp */
JS_DECLARE_CALLINFO(js_FastNewDate)

/* Defined in jsnum.cpp */
JS_DECLARE_CALLINFO(js_NumberToString)

/* Defined in jsstr.cpp */
JS_DECLARE_CALLINFO(js_ConcatStrings)
JS_DECLARE_CALLINFO(js_String_getelem)
JS_DECLARE_CALLINFO(js_String_p_charCodeAt)
JS_DECLARE_CALLINFO(js_EqualStrings)
JS_DECLARE_CALLINFO(js_CompareStrings)

/* Defined in jsbuiltins.cpp */
#define BUILTIN1(linkage, rt, op, at0,                     cse, fold)  JS_DECLARE_CALLINFO(op)
#define BUILTIN2(linkage, rt, op, at0, at1,                cse, fold)  JS_DECLARE_CALLINFO(op)
#define BUILTIN3(linkage, rt, op, at0, at1, at2,           cse, fold)  JS_DECLARE_CALLINFO(op)
#define BUILTIN4(linkage, rt, op, at0, at1, at2, at3,      cse, fold)  JS_DECLARE_CALLINFO(op)
#define BUILTIN5(linkage, rt, op, at0, at1, at2, at3, at4, cse, fold)  JS_DECLARE_CALLINFO(op)
#include "builtins.tbl"
#undef BUILTIN
#undef BUILTIN1
#undef BUILTIN2
#undef BUILTIN3
#undef BUILTIN4
#undef BUILTIN5

#endif /* jsbuiltins_h___ */
