/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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

#ifndef jsfun_h___
#define jsfun_h___
/*
 * JS function definitions.
 */
#include "jsprvtd.h"
#include "jspubtd.h"
#include "jsobj.h"

JS_BEGIN_EXTERN_C

typedef struct JSLocalNameMap JSLocalNameMap;

/*
 * Depending on the number of arguments and variables in the function their
 * names and attributes are stored either as a single atom or as an array of
 * tagged atoms (when there are few locals) or as a hash-based map (when there
 * are many locals). In the first 2 cases the lowest bit of the atom is used
 * as a tag to distinguish const from var. See jsfun.c for details.
 */
typedef union JSLocalNames {
    jsuword         taggedAtom;
    jsuword         *array;
    JSLocalNameMap  *map;
} JSLocalNames;

struct JSFunction {
    JSObject        object;       /* GC'ed object header */
    uint16          nargs;        /* maximum number of specified arguments,
                                     reflected as f.length/f.arity */
    uint16          flags;        /* flags, see JSFUN_* below and in jsapi.h */
    union {
        struct {
            uint16      extra;    /* number of arg slots for local GC roots */
            uint16      spare;    /* reserved for future use */
            JSNative    native;   /* native method pointer or null */
            union {
                JSClass             *clasp;    /* class of objects constructed
                                                  by this function */
                JSTraceableNative   *trcinfo;  /* tracer metadata; can be first
                                                  element of array */
            } u;
        } n;
        struct {
            uint16      nvars;    /* number of local variables */
            uint16      nupvars;  /* number of upvars (computable from script
                                     but here for faster access) */
            JSScript    *script;  /* interpreted bytecode descriptor or null */
            JSLocalNames names;   /* argument and variable names */
        } i;
    } u;
    JSAtom          *atom;        /* name for diagnostics and decompiling */
};

#define JSFUN_TRACEABLE      0x2000 /* can trace across calls to this native
                                       function; use FUN_TRCINFO if set,
                                       FUN_CLASP if unset */
#define JSFUN_EXPR_CLOSURE   0x4000 /* expression closure: function(x)x*x */
#define JSFUN_INTERPRETED    0x8000 /* use u.i if set, u.n if unset */

#define JSFUN_SCRIPT_OR_FAST_NATIVE (JSFUN_INTERPRETED | JSFUN_FAST_NATIVE)

#define FUN_OBJECT(fun)      (&(fun)->object)
#define FUN_INTERPRETED(fun) ((fun)->flags & JSFUN_INTERPRETED)
#define FUN_SLOW_NATIVE(fun) (!((fun)->flags & JSFUN_SCRIPT_OR_FAST_NATIVE))
#define FUN_SCRIPT(fun)      (FUN_INTERPRETED(fun) ? (fun)->u.i.script : NULL)
#define FUN_NATIVE(fun)      (FUN_SLOW_NATIVE(fun) ? (fun)->u.n.native : NULL)
#define FUN_FAST_NATIVE(fun) (((fun)->flags & JSFUN_FAST_NATIVE)              \
                              ? (JSFastNative) (fun)->u.n.native              \
                              : NULL)
#define FUN_MINARGS(fun)     (((fun)->flags & JSFUN_FAST_NATIVE)              \
                              ? 0                                             \
                              : (fun)->nargs)
#define FUN_CLASP(fun)       (JS_ASSERT(!FUN_INTERPRETED(fun)),               \
                              JS_ASSERT(!((fun)->flags & JSFUN_TRACEABLE)),   \
                              fun->u.n.u.clasp)
#define FUN_TRCINFO(fun)     (JS_ASSERT(!FUN_INTERPRETED(fun)),               \
                              JS_ASSERT((fun)->flags & JSFUN_TRACEABLE),      \
                              fun->u.n.u.trcinfo)

/*
 * Traceable native.  This expands to a JSFunctionSpec initializer (like JS_FN
 * in jsapi.h).  fastcall is a JSFastNative; trcinfo is a JSTraceableNative *.
 */
#ifdef JS_TRACER
/* MSVC demands the intermediate (void *) cast here. */
# define JS_TN(name,fastcall,nargs,flags,trcinfo)                             \
    {name, (JSNative)(void *)(trcinfo), nargs,                                \
     (flags) | JSFUN_FAST_NATIVE | JSFUN_STUB_GSOPS | JSFUN_TRACEABLE, 0}
#else
# define JS_TN(name,fastcall,nargs,flags,trcinfo)                             \
    JS_FN(name, fastcall, nargs, flags)
#endif

extern JSClass js_ArgumentsClass;
extern JS_FRIEND_DATA(JSClass) js_CallClass;

/* JS_FRIEND_DATA so that VALUE_IS_FUNCTION is callable from the shell. */
extern JS_FRIEND_DATA(JSClass) js_FunctionClass;

#define HAS_FUNCTION_CLASS(obj) (STOBJ_GET_CLASS(obj) == &js_FunctionClass)

/*
 * NB: jsapi.h and jsobj.h must be included before any call to this macro.
 */
#define VALUE_IS_FUNCTION(cx, v)                                              \
    (!JSVAL_IS_PRIMITIVE(v) && HAS_FUNCTION_CLASS(JSVAL_TO_OBJECT(v)))

/*
 * Macro to access the private slot of the function object after the slot is
 * initialized.
 */
#define GET_FUNCTION_PRIVATE(cx, funobj)                                      \
    (JS_ASSERT(HAS_FUNCTION_CLASS(funobj)),                                   \
     (JSFunction *) OBJ_GET_PRIVATE(cx, funobj))

extern JSObject *
js_InitFunctionClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitArgumentsClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitCallClass(JSContext *cx, JSObject *obj);

extern JSFunction *
js_NewFunction(JSContext *cx, JSObject *funobj, JSNative native, uintN nargs,
               uintN flags, JSObject *parent, JSAtom *atom);

extern void
js_TraceFunction(JSTracer *trc, JSFunction *fun);

extern void
js_FinalizeFunction(JSContext *cx, JSFunction *fun);

extern JSObject *
js_CloneFunctionObject(JSContext *cx, JSFunction *fun, JSObject *parent);

extern JSBool
js_LinkFunctionObject(JSContext *cx, JSFunction *fun, JSObject *object);

extern JSFunction *
js_DefineFunction(JSContext *cx, JSObject *obj, JSAtom *atom, JSNative native,
                  uintN nargs, uintN flags);

/*
 * Flags for js_ValueToFunction and js_ReportIsNotFunction.  We depend on the
 * fact that JSINVOKE_CONSTRUCT (aka JSFRAME_CONSTRUCTING) is 1, and test that
 * with #if/#error in jsfun.c.
 */
#define JSV2F_CONSTRUCT         JSINVOKE_CONSTRUCT
#define JSV2F_ITERATOR          JSINVOKE_ITERATOR
#define JSV2F_SEARCH_STACK      0x10000

extern JSFunction *
js_ValueToFunction(JSContext *cx, jsval *vp, uintN flags);

extern JSObject *
js_ValueToFunctionObject(JSContext *cx, jsval *vp, uintN flags);

extern JSObject *
js_ValueToCallableObject(JSContext *cx, jsval *vp, uintN flags);

extern void
js_ReportIsNotFunction(JSContext *cx, jsval *vp, uintN flags);

extern JSObject *
js_GetCallObject(JSContext *cx, JSStackFrame *fp, JSObject *parent);

extern JS_FRIEND_API(JSBool)
js_PutCallObject(JSContext *cx, JSStackFrame *fp);

extern JSBool
js_GetCallArg(JSContext *cx, JSObject *obj, jsid id, jsval *vp);

extern JSBool
js_GetCallVar(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

extern JSBool
js_GetArgsValue(JSContext *cx, JSStackFrame *fp, jsval *vp);

extern JSBool
js_GetArgsProperty(JSContext *cx, JSStackFrame *fp, jsid id, jsval *vp);

extern JSObject *
js_GetArgsObject(JSContext *cx, JSStackFrame *fp);

extern JS_FRIEND_API(JSBool)
js_PutArgsObject(JSContext *cx, JSStackFrame *fp);

extern JSBool
js_XDRFunction(JSXDRState *xdr, JSObject **objp);

typedef enum JSLocalKind {
    JSLOCAL_NONE,
    JSLOCAL_ARG,
    JSLOCAL_VAR,
    JSLOCAL_CONST,
    JSLOCAL_UPVAR
} JSLocalKind;

#define JS_UPVAR_LOCAL_NAME_START(fun)  ((fun)->nargs + (fun)->u.i.nvars)
#define JS_GET_LOCAL_NAME_COUNT(fun)    (JS_UPVAR_LOCAL_NAME_START(fun) +     \
                                         (fun)->u.i.nupvars)

extern JSBool
js_AddLocal(JSContext *cx, JSFunction *fun, JSAtom *atom, JSLocalKind kind);

/*
 * Look up an argument or variable name returning its kind when found or
 * JSLOCAL_NONE when no such name exists. When indexp is not null and the name
 * exists, *indexp will receive the index of the corresponding argument or
 * variable.
 */
extern JSLocalKind
js_LookupLocal(JSContext *cx, JSFunction *fun, JSAtom *atom, uintN *indexp);

/*
 * Functions to work with local names as an array of words.
 *
 * js_GetLocalNameArray returns the array, or null if we are out of memory.
 * This function must not be called when JS_GET_LOCAL_NAME_COUNT(fun) is zero.
 *
 * The supplied pool is used to allocate the returned array, so the caller is
 * obligated to mark and release to free it.
 *
 * The elements of the array with index less than fun->nargs correspond to the
 * names of function formal parameters. An index >= fun->nargs addresses a var
 * binding. Use JS_LOCAL_NAME_TO_ATOM to convert array's element to an atom
 * pointer. This pointer can be null when the element is for a formal parameter
 * corresponding to a destructuring pattern.
 *
 * If nameWord does not name a formal parameter, use JS_LOCAL_NAME_IS_CONST to
 * check if nameWord corresponds to the const declaration.
 */
extern jsuword *
js_GetLocalNameArray(JSContext *cx, JSFunction *fun, struct JSArenaPool *pool);

#define JS_LOCAL_NAME_TO_ATOM(nameWord)                                       \
    ((JSAtom *) ((nameWord) & ~(jsuword) 1))

#define JS_LOCAL_NAME_IS_CONST(nameWord)                                      \
    ((((nameWord) & (jsuword) 1)) != 0)

extern void
js_FreezeLocalNames(JSContext *cx, JSFunction *fun);

extern JSBool
js_fun_apply(JSContext *cx, uintN argc, jsval *vp);

extern JSBool
js_fun_call(JSContext *cx, uintN argc, jsval *vp);


JS_END_EXTERN_C

#endif /* jsfun_h___ */
