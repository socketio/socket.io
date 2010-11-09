/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=78:
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
 * JS debugging API.
 */
#include "jsstddef.h"
#include <string.h>
#include "jstypes.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jsclist.h"
#include "jsapi.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsdbgapi.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"

#include "jsautooplen.h"

typedef struct JSTrap {
    JSCList         links;
    JSScript        *script;
    jsbytecode      *pc;
    JSOp            op;
    JSTrapHandler   handler;
    void            *closure;
} JSTrap;

#define DBG_LOCK(rt)            JS_ACQUIRE_LOCK((rt)->debuggerLock)
#define DBG_UNLOCK(rt)          JS_RELEASE_LOCK((rt)->debuggerLock)
#define DBG_LOCK_EVAL(rt,expr)  (DBG_LOCK(rt), (expr), DBG_UNLOCK(rt))

/*
 * NB: FindTrap must be called with rt->debuggerLock acquired.
 */
static JSTrap *
FindTrap(JSRuntime *rt, JSScript *script, jsbytecode *pc)
{
    JSTrap *trap;

    for (trap = (JSTrap *)rt->trapList.next;
         &trap->links != &rt->trapList;
         trap = (JSTrap *)trap->links.next) {
        if (trap->script == script && trap->pc == pc)
            return trap;
    }
    return NULL;
}

jsbytecode *
js_UntrapScriptCode(JSContext *cx, JSScript *script)
{
    jsbytecode *code;
    JSRuntime *rt;
    JSTrap *trap;

    code = script->code;
    rt = cx->runtime;
    DBG_LOCK(rt);
    for (trap = (JSTrap *)rt->trapList.next;
         &trap->links !=
                &rt->trapList;
         trap = (JSTrap *)trap->links.next) {
        if (trap->script == script &&
            (size_t)(trap->pc - script->code) < script->length) {
            if (code == script->code) {
                jssrcnote *sn, *notes;
                size_t nbytes;

                nbytes = script->length * sizeof(jsbytecode);
                notes = SCRIPT_NOTES(script);
                for (sn = notes; !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn))
                    continue;
                nbytes += (sn - notes + 1) * sizeof *sn;

                code = (jsbytecode *) JS_malloc(cx, nbytes);
                if (!code)
                    break;
                memcpy(code, script->code, nbytes);
                JS_CLEAR_GSN_CACHE(cx);
            }
            code[trap->pc - script->code] = trap->op;
        }
    }
    DBG_UNLOCK(rt);
    return code;
}

JS_PUBLIC_API(JSBool)
JS_SetTrap(JSContext *cx, JSScript *script, jsbytecode *pc,
           JSTrapHandler handler, void *closure)
{
    JSTrap *junk, *trap, *twin;
    JSRuntime *rt;
    uint32 sample;

    JS_ASSERT((JSOp) *pc != JSOP_TRAP);
    junk = NULL;
    rt = cx->runtime;
    DBG_LOCK(rt);
    trap = FindTrap(rt, script, pc);
    if (trap) {
        JS_ASSERT(trap->script == script && trap->pc == pc);
        JS_ASSERT(*pc == JSOP_TRAP);
    } else {
        sample = rt->debuggerMutations;
        DBG_UNLOCK(rt);
        trap = (JSTrap *) JS_malloc(cx, sizeof *trap);
        if (!trap)
            return JS_FALSE;
        trap->closure = NULL;
        if(!js_AddRoot(cx, &trap->closure, "trap->closure")) {
            JS_free(cx, trap);
            return JS_FALSE;
        }
        DBG_LOCK(rt);
        twin = (rt->debuggerMutations != sample)
               ? FindTrap(rt, script, pc)
               : NULL;
        if (twin) {
            junk = trap;
            trap = twin;
        } else {
            JS_APPEND_LINK(&trap->links, &rt->trapList);
            ++rt->debuggerMutations;
            trap->script = script;
            trap->pc = pc;
            trap->op = (JSOp)*pc;
            *pc = JSOP_TRAP;
        }
    }
    trap->handler = handler;
    trap->closure = closure;
    DBG_UNLOCK(rt);
    if (junk) {
        js_RemoveRoot(rt, &junk->closure);
        JS_free(cx, junk);
    }
    return JS_TRUE;
}

JS_PUBLIC_API(JSOp)
JS_GetTrapOpcode(JSContext *cx, JSScript *script, jsbytecode *pc)
{
    JSRuntime *rt;
    JSTrap *trap;
    JSOp op;

    rt = cx->runtime;
    DBG_LOCK(rt);
    trap = FindTrap(rt, script, pc);
    op = trap ? trap->op : (JSOp) *pc;
    DBG_UNLOCK(rt);
    return op;
}

static void
DestroyTrapAndUnlock(JSContext *cx, JSTrap *trap)
{
    ++cx->runtime->debuggerMutations;
    JS_REMOVE_LINK(&trap->links);
    *trap->pc = (jsbytecode)trap->op;
    DBG_UNLOCK(cx->runtime);

    js_RemoveRoot(cx->runtime, &trap->closure);
    JS_free(cx, trap);
}

JS_PUBLIC_API(void)
JS_ClearTrap(JSContext *cx, JSScript *script, jsbytecode *pc,
             JSTrapHandler *handlerp, void **closurep)
{
    JSTrap *trap;

    DBG_LOCK(cx->runtime);
    trap = FindTrap(cx->runtime, script, pc);
    if (handlerp)
        *handlerp = trap ? trap->handler : NULL;
    if (closurep)
        *closurep = trap ? trap->closure : NULL;
    if (trap)
        DestroyTrapAndUnlock(cx, trap);
    else
        DBG_UNLOCK(cx->runtime);
}

JS_PUBLIC_API(void)
JS_ClearScriptTraps(JSContext *cx, JSScript *script)
{
    JSRuntime *rt;
    JSTrap *trap, *next;
    uint32 sample;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (trap = (JSTrap *)rt->trapList.next;
         &trap->links != &rt->trapList;
         trap = next) {
        next = (JSTrap *)trap->links.next;
        if (trap->script == script) {
            sample = rt->debuggerMutations;
            DestroyTrapAndUnlock(cx, trap);
            DBG_LOCK(rt);
            if (rt->debuggerMutations != sample + 1)
                next = (JSTrap *)rt->trapList.next;
        }
    }
    DBG_UNLOCK(rt);
}

JS_PUBLIC_API(void)
JS_ClearAllTraps(JSContext *cx)
{
    JSRuntime *rt;
    JSTrap *trap, *next;
    uint32 sample;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (trap = (JSTrap *)rt->trapList.next;
         &trap->links != &rt->trapList;
         trap = next) {
        next = (JSTrap *)trap->links.next;
        sample = rt->debuggerMutations;
        DestroyTrapAndUnlock(cx, trap);
        DBG_LOCK(rt);
        if (rt->debuggerMutations != sample + 1)
            next = (JSTrap *)rt->trapList.next;
    }
    DBG_UNLOCK(rt);
}

JS_PUBLIC_API(JSTrapStatus)
JS_HandleTrap(JSContext *cx, JSScript *script, jsbytecode *pc, jsval *rval)
{
    JSTrap *trap;
    jsint op;
    JSTrapStatus status;

    DBG_LOCK(cx->runtime);
    trap = FindTrap(cx->runtime, script, pc);
    JS_ASSERT(!trap || trap->handler);
    if (!trap) {
        op = (JSOp) *pc;
        DBG_UNLOCK(cx->runtime);

        /* Defend against "pc for wrong script" API usage error. */
        JS_ASSERT(op != JSOP_TRAP);

#ifdef JS_THREADSAFE
        /* If the API was abused, we must fail for want of the real op. */
        if (op == JSOP_TRAP)
            return JSTRAP_ERROR;

        /* Assume a race with a debugger thread and try to carry on. */
        *rval = INT_TO_JSVAL(op);
        return JSTRAP_CONTINUE;
#else
        /* Always fail if single-threaded (must be an API usage error). */
        return JSTRAP_ERROR;
#endif
    }
    DBG_UNLOCK(cx->runtime);

    /*
     * It's important that we not use 'trap->' after calling the callback --
     * the callback might remove the trap!
     */
    op = (jsint)trap->op;
    status = trap->handler(cx, script, pc, rval, trap->closure);
    if (status == JSTRAP_CONTINUE) {
        /* By convention, return the true op to the interpreter in rval. */
        *rval = INT_TO_JSVAL(op);
    }
    return status;
}

JS_PUBLIC_API(JSBool)
JS_SetInterrupt(JSRuntime *rt, JSTrapHandler handler, void *closure)
{
    rt->globalDebugHooks.interruptHandler = handler;
    rt->globalDebugHooks.interruptHandlerData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_ClearInterrupt(JSRuntime *rt, JSTrapHandler *handlerp, void **closurep)
{
    if (handlerp)
        *handlerp = (JSTrapHandler)rt->globalDebugHooks.interruptHandler;
    if (closurep)
        *closurep = rt->globalDebugHooks.interruptHandlerData;
    rt->globalDebugHooks.interruptHandler = 0;
    rt->globalDebugHooks.interruptHandlerData = 0;
    return JS_TRUE;
}

/************************************************************************/

typedef struct JSWatchPoint {
    JSCList             links;
    JSObject            *object;        /* weak link, see js_FinalizeObject */
    JSScopeProperty     *sprop;
    JSPropertyOp        setter;
    JSWatchPointHandler handler;
    void                *closure;
    uintN               flags;
} JSWatchPoint;

#define JSWP_LIVE       0x1             /* live because set and not cleared */
#define JSWP_HELD       0x2             /* held while running handler/setter */

/*
 * NB: DropWatchPointAndUnlock releases cx->runtime->debuggerLock in all cases.
 */
static JSBool
DropWatchPointAndUnlock(JSContext *cx, JSWatchPoint *wp, uintN flag)
{
    JSBool ok, found;
    JSScopeProperty *sprop;
    JSScope *scope;
    JSPropertyOp setter;

    ok = JS_TRUE;
    wp->flags &= ~flag;
    if (wp->flags != 0) {
        DBG_UNLOCK(cx->runtime);
        return ok;
    }

    /*
     * Remove wp from the list, then if there are no other watchpoints for
     * wp->sprop in any scope, restore wp->sprop->setter from wp.
     */
    ++cx->runtime->debuggerMutations;
    JS_REMOVE_LINK(&wp->links);
    sprop = wp->sprop;

    /*
     * Passing null for the scope parameter tells js_GetWatchedSetter to find
     * any watch point for sprop, and not to lock or unlock rt->debuggerLock.
     * If js_ChangeNativePropertyAttrs fails, propagate failure after removing
     * wp->closure's root and freeing wp.
     */
    setter = js_GetWatchedSetter(cx->runtime, NULL, sprop);
    DBG_UNLOCK(cx->runtime);
    if (!setter) {
        JS_LOCK_OBJ(cx, wp->object);
        scope = OBJ_SCOPE(wp->object);
        found = (scope->object == wp->object &&
                 SCOPE_GET_PROPERTY(scope, sprop->id));
        JS_UNLOCK_SCOPE(cx, scope);

        /*
         * If the property wasn't found on wp->object or didn't exist, then
         * someone else has dealt with this sprop, and we don't need to change
         * the property attributes.
         */
        if (found) {
            sprop = js_ChangeScopePropertyAttrs(cx, scope, sprop,
                                                0, sprop->attrs,
                                                sprop->getter,
                                                wp->setter);
            if (!sprop)
                ok = JS_FALSE;
        }
    }

    JS_free(cx, wp);
    return ok;
}

/*
 * NB: js_TraceWatchPoints does not acquire cx->runtime->debuggerLock, since
 * the debugger should never be racing with the GC (i.e., the debugger must
 * respect the request model).
 */
void
js_TraceWatchPoints(JSTracer *trc, JSObject *obj)
{
    JSRuntime *rt;
    JSWatchPoint *wp;

    rt = trc->context->runtime;

    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = (JSWatchPoint *)wp->links.next) {
        if (wp->object == obj) {
            TRACE_SCOPE_PROPERTY(trc, wp->sprop);
            if ((wp->sprop->attrs & JSPROP_SETTER) && wp->setter) {
                JS_CALL_OBJECT_TRACER(trc, (JSObject *)wp->setter,
                                      "wp->setter");
            }
            JS_SET_TRACING_NAME(trc, "wp->closure");
            js_CallValueTracerIfGCThing(trc, (jsval) wp->closure);
        }
    }
}

void
js_SweepWatchPoints(JSContext *cx)
{
    JSRuntime *rt;
    JSWatchPoint *wp, *next;
    uint32 sample;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = next) {
        next = (JSWatchPoint *)wp->links.next;
        if (js_IsAboutToBeFinalized(cx, wp->object)) {
            sample = rt->debuggerMutations;

            /* Ignore failures. */
            DropWatchPointAndUnlock(cx, wp, JSWP_LIVE);
            DBG_LOCK(rt);
            if (rt->debuggerMutations != sample + 1)
                next = (JSWatchPoint *)rt->watchPointList.next;
        }
    }
    DBG_UNLOCK(rt);
}



/*
 * NB: FindWatchPoint must be called with rt->debuggerLock acquired.
 */
static JSWatchPoint *
FindWatchPoint(JSRuntime *rt, JSScope *scope, jsid id)
{
    JSWatchPoint *wp;

    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = (JSWatchPoint *)wp->links.next) {
        if (wp->object == scope->object && wp->sprop->id == id)
            return wp;
    }
    return NULL;
}

JSScopeProperty *
js_FindWatchPoint(JSRuntime *rt, JSScope *scope, jsid id)
{
    JSWatchPoint *wp;
    JSScopeProperty *sprop;

    DBG_LOCK(rt);
    wp = FindWatchPoint(rt, scope, id);
    sprop = wp ? wp->sprop : NULL;
    DBG_UNLOCK(rt);
    return sprop;
}

/*
 * Secret handshake with DropWatchPointAndUnlock: if (!scope), we know our
 * caller has acquired rt->debuggerLock, so we don't have to.
 */
JSPropertyOp
js_GetWatchedSetter(JSRuntime *rt, JSScope *scope,
                    const JSScopeProperty *sprop)
{
    JSPropertyOp setter;
    JSWatchPoint *wp;

    setter = NULL;
    if (scope)
        DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = (JSWatchPoint *)wp->links.next) {
        if ((!scope || wp->object == scope->object) && wp->sprop == sprop) {
            setter = wp->setter;
            break;
        }
    }
    if (scope)
        DBG_UNLOCK(rt);
    return setter;
}

JSBool
js_watch_set(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSRuntime *rt;
    JSWatchPoint *wp;
    JSScopeProperty *sprop;
    jsval propid, userid;
    JSScope *scope;
    JSBool ok;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = (JSWatchPoint *)wp->links.next) {
        sprop = wp->sprop;
        if (wp->object == obj && SPROP_USERID(sprop) == id &&
            !(wp->flags & JSWP_HELD)) {
            wp->flags |= JSWP_HELD;
            DBG_UNLOCK(rt);

            JS_LOCK_OBJ(cx, obj);
            propid = ID_TO_VALUE(sprop->id);
            userid = (sprop->flags & SPROP_HAS_SHORTID)
                     ? INT_TO_JSVAL(sprop->shortid)
                     : propid;
            scope = OBJ_SCOPE(obj);
            JS_UNLOCK_OBJ(cx, obj);

            /* NB: wp is held, so we can safely dereference it still. */
            ok = wp->handler(cx, obj, propid,
                             SPROP_HAS_VALID_SLOT(sprop, scope)
                             ? OBJ_GET_SLOT(cx, obj, sprop->slot)
                             : JSVAL_VOID,
                             vp, wp->closure);
            if (ok) {
                /*
                 * Create a pseudo-frame for the setter invocation so that any
                 * stack-walking security code under the setter will correctly
                 * identify the guilty party.  So that the watcher appears to
                 * be active to obj_eval and other such code, point frame.pc
                 * at the JSOP_STOP at the end of the script.
                 *
                 * The pseudo-frame is not created for fast natives as they
                 * are treated as interpreter frame extensions and always
                 * trusted.
                 */
                JSObject *closure;
                JSClass *clasp;
                JSFunction *fun;
                JSScript *script;
                JSBool injectFrame;
                uintN nslots;
                jsval smallv[5];
                jsval *argv;
                JSStackFrame frame;
                JSFrameRegs regs;

                closure = (JSObject *) wp->closure;
                clasp = OBJ_GET_CLASS(cx, closure);
                if (clasp == &js_FunctionClass) {
                    fun = GET_FUNCTION_PRIVATE(cx, closure);
                    script = FUN_SCRIPT(fun);
                } else if (clasp == &js_ScriptClass) {
                    fun = NULL;
                    script = (JSScript *) JS_GetPrivate(cx, closure);
                } else {
                    fun = NULL;
                    script = NULL;
                }

                nslots = 2;
                injectFrame = JS_TRUE;
                if (fun) {
                    nslots += FUN_MINARGS(fun);
                    if (!FUN_INTERPRETED(fun)) {
                        nslots += fun->u.n.extra;
                        injectFrame = !(fun->flags & JSFUN_FAST_NATIVE);
                    }
                }

                if (injectFrame) {
                    if (nslots <= JS_ARRAY_LENGTH(smallv)) {
                        argv = smallv;
                    } else {
                        argv = (jsval *) JS_malloc(cx, nslots * sizeof(jsval));
                        if (!argv) {
                            DBG_LOCK(rt);
                            DropWatchPointAndUnlock(cx, wp, JSWP_HELD);
                            return JS_FALSE;
                        }
                    }

                    argv[0] = OBJECT_TO_JSVAL(closure);
                    argv[1] = JSVAL_NULL;
                    memset(argv + 2, 0, (nslots - 2) * sizeof(jsval));

                    memset(&frame, 0, sizeof(frame));
                    frame.script = script;
                    frame.regs = NULL;
                    if (script) {
                        JS_ASSERT(script->length >= JSOP_STOP_LENGTH);
                        regs.pc = script->code + script->length
                                  - JSOP_STOP_LENGTH;
                        regs.sp = NULL;
                        frame.regs = &regs;
                    }
                    frame.callee = closure;
                    frame.fun = fun;
                    frame.argv = argv + 2;
                    frame.down = cx->fp;
                    frame.scopeChain = OBJ_GET_PARENT(cx, closure);

                    cx->fp = &frame;
                }
#ifdef __GNUC__
                else
                    argv = NULL;    /* suppress bogus gcc warnings */
#endif
                ok = !wp->setter ||
                     ((sprop->attrs & JSPROP_SETTER)
                      ? js_InternalCall(cx, obj, OBJECT_TO_JSVAL(wp->setter),
                                        1, vp, vp)
                      : wp->setter(cx, OBJ_THIS_OBJECT(cx, obj), userid, vp));
                if (injectFrame) {
                    /* Evil code can cause us to have an arguments object. */
                    if (frame.callobj)
                        ok &= js_PutCallObject(cx, &frame);
                    if (frame.argsobj)
                        ok &= js_PutArgsObject(cx, &frame);

                    cx->fp = frame.down;
                    if (argv != smallv)
                        JS_free(cx, argv);
                }
            }
            DBG_LOCK(rt);
            return DropWatchPointAndUnlock(cx, wp, JSWP_HELD) && ok;
        }
    }
    DBG_UNLOCK(rt);
    return JS_TRUE;
}

JSBool
js_watch_set_wrapper(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                     jsval *rval)
{
    JSObject *funobj;
    JSFunction *wrapper;
    jsval userid;

    funobj = JSVAL_TO_OBJECT(argv[-2]);
    JS_ASSERT(OBJ_GET_CLASS(cx, funobj) == &js_FunctionClass);
    wrapper = GET_FUNCTION_PRIVATE(cx, funobj);
    userid = ATOM_KEY(wrapper->atom);
    *rval = argv[0];
    return js_watch_set(cx, obj, userid, rval);
}

JSPropertyOp
js_WrapWatchedSetter(JSContext *cx, jsid id, uintN attrs, JSPropertyOp setter)
{
    JSAtom *atom;
    JSFunction *wrapper;

    if (!(attrs & JSPROP_SETTER))
        return &js_watch_set;   /* & to silence schoolmarmish MSVC */

    if (JSID_IS_ATOM(id)) {
        atom = JSID_TO_ATOM(id);
    } else if (JSID_IS_INT(id)) {
        if (!js_ValueToStringId(cx, INT_JSID_TO_JSVAL(id), &id))
            return NULL;
        atom = JSID_TO_ATOM(id);
    } else {
        atom = NULL;
    }
    wrapper = js_NewFunction(cx, NULL, js_watch_set_wrapper, 1, 0,
                             OBJ_GET_PARENT(cx, (JSObject *)setter),
                             atom);
    if (!wrapper)
        return NULL;
    return (JSPropertyOp) FUN_OBJECT(wrapper);
}

JS_PUBLIC_API(JSBool)
JS_SetWatchPoint(JSContext *cx, JSObject *obj, jsval idval,
                 JSWatchPointHandler handler, void *closure)
{
    jsid propid;
    JSObject *pobj;
    JSProperty *prop;
    JSScopeProperty *sprop;
    JSRuntime *rt;
    JSBool ok;
    JSWatchPoint *wp;
    JSPropertyOp watcher;

    if (!OBJ_IS_NATIVE(obj)) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_CANT_WATCH,
                             OBJ_GET_CLASS(cx, obj)->name);
        return JS_FALSE;
    }

    if (JSVAL_IS_INT(idval))
        propid = INT_JSVAL_TO_JSID(idval);
    else if (!js_ValueToStringId(cx, idval, &propid))
        return JS_FALSE;

    if (!js_LookupProperty(cx, obj, propid, &pobj, &prop))
        return JS_FALSE;
    sprop = (JSScopeProperty *) prop;
    rt = cx->runtime;
    if (!sprop) {
        /* Check for a deleted symbol watchpoint, which holds its property. */
        sprop = js_FindWatchPoint(rt, OBJ_SCOPE(obj), propid);
        if (!sprop) {
            /* Make a new property in obj so we can watch for the first set. */
            if (!js_DefineProperty(cx, obj, propid, JSVAL_VOID,
                                   NULL, NULL, JSPROP_ENUMERATE,
                                   &prop)) {
                return JS_FALSE;
            }
            sprop = (JSScopeProperty *) prop;
        }
    } else if (pobj != obj) {
        /* Clone the prototype property so we can watch the right object. */
        jsval value;
        JSPropertyOp getter, setter;
        uintN attrs, flags;
        intN shortid;

        if (OBJ_IS_NATIVE(pobj)) {
            value = SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(pobj))
                    ? LOCKED_OBJ_GET_SLOT(pobj, sprop->slot)
                    : JSVAL_VOID;
            getter = sprop->getter;
            setter = sprop->setter;
            attrs = sprop->attrs;
            flags = sprop->flags;
            shortid = sprop->shortid;
        } else {
            if (!OBJ_GET_PROPERTY(cx, pobj, propid, &value) ||
                !OBJ_GET_ATTRIBUTES(cx, pobj, propid, prop, &attrs)) {
                OBJ_DROP_PROPERTY(cx, pobj, prop);
                return JS_FALSE;
            }
            getter = setter = NULL;
            flags = 0;
            shortid = 0;
        }
        OBJ_DROP_PROPERTY(cx, pobj, prop);

        /* Recall that obj is native, whether or not pobj is native. */
        if (!js_DefineNativeProperty(cx, obj, propid, value, getter, setter,
                                     attrs, flags, shortid, &prop)) {
            return JS_FALSE;
        }
        sprop = (JSScopeProperty *) prop;
    }

    /*
     * At this point, prop/sprop exists in obj, obj is locked, and we must
     * OBJ_DROP_PROPERTY(cx, obj, prop) before returning.
     */
    ok = JS_TRUE;
    DBG_LOCK(rt);
    wp = FindWatchPoint(rt, OBJ_SCOPE(obj), propid);
    if (!wp) {
        DBG_UNLOCK(rt);
        watcher = js_WrapWatchedSetter(cx, propid, sprop->attrs, sprop->setter);
        if (!watcher) {
            ok = JS_FALSE;
            goto out;
        }

        wp = (JSWatchPoint *) JS_malloc(cx, sizeof *wp);
        if (!wp) {
            ok = JS_FALSE;
            goto out;
        }
        wp->handler = NULL;
        wp->closure = NULL;
        wp->object = obj;
        JS_ASSERT(sprop->setter != js_watch_set || pobj != obj);
        wp->setter = sprop->setter;
        wp->flags = JSWP_LIVE;

        /* XXXbe nest in obj lock here */
        sprop = js_ChangeNativePropertyAttrs(cx, obj, sprop, 0, sprop->attrs,
                                             sprop->getter, watcher);
        if (!sprop) {
            /* Self-link so DropWatchPointAndUnlock can JS_REMOVE_LINK it. */
            JS_INIT_CLIST(&wp->links);
            DBG_LOCK(rt);
            DropWatchPointAndUnlock(cx, wp, JSWP_LIVE);
            ok = JS_FALSE;
            goto out;
        }
        wp->sprop = sprop;

        /*
         * Now that wp is fully initialized, append it to rt's wp list.
         * Because obj is locked we know that no other thread could have added
         * a watchpoint for (obj, propid).
         */
        DBG_LOCK(rt);
        JS_ASSERT(!FindWatchPoint(rt, OBJ_SCOPE(obj), propid));
        JS_APPEND_LINK(&wp->links, &rt->watchPointList);
        ++rt->debuggerMutations;
    }
    wp->handler = handler;
    wp->closure = closure;
    DBG_UNLOCK(rt);

out:
    OBJ_DROP_PROPERTY(cx, obj, prop);
    return ok;
}

JS_PUBLIC_API(JSBool)
JS_ClearWatchPoint(JSContext *cx, JSObject *obj, jsval id,
                   JSWatchPointHandler *handlerp, void **closurep)
{
    JSRuntime *rt;
    JSWatchPoint *wp;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = (JSWatchPoint *)wp->links.next) {
        if (wp->object == obj && SPROP_USERID(wp->sprop) == id) {
            if (handlerp)
                *handlerp = wp->handler;
            if (closurep)
                *closurep = wp->closure;
            return DropWatchPointAndUnlock(cx, wp, JSWP_LIVE);
        }
    }
    DBG_UNLOCK(rt);
    if (handlerp)
        *handlerp = NULL;
    if (closurep)
        *closurep = NULL;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_ClearWatchPointsForObject(JSContext *cx, JSObject *obj)
{
    JSRuntime *rt;
    JSWatchPoint *wp, *next;
    uint32 sample;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = next) {
        next = (JSWatchPoint *)wp->links.next;
        if (wp->object == obj) {
            sample = rt->debuggerMutations;
            if (!DropWatchPointAndUnlock(cx, wp, JSWP_LIVE))
                return JS_FALSE;
            DBG_LOCK(rt);
            if (rt->debuggerMutations != sample + 1)
                next = (JSWatchPoint *)rt->watchPointList.next;
        }
    }
    DBG_UNLOCK(rt);
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_ClearAllWatchPoints(JSContext *cx)
{
    JSRuntime *rt;
    JSWatchPoint *wp, *next;
    uint32 sample;

    rt = cx->runtime;
    DBG_LOCK(rt);
    for (wp = (JSWatchPoint *)rt->watchPointList.next;
         &wp->links != &rt->watchPointList;
         wp = next) {
        next = (JSWatchPoint *)wp->links.next;
        sample = rt->debuggerMutations;
        if (!DropWatchPointAndUnlock(cx, wp, JSWP_LIVE))
            return JS_FALSE;
        DBG_LOCK(rt);
        if (rt->debuggerMutations != sample + 1)
            next = (JSWatchPoint *)rt->watchPointList.next;
    }
    DBG_UNLOCK(rt);
    return JS_TRUE;
}

/************************************************************************/

JS_PUBLIC_API(uintN)
JS_PCToLineNumber(JSContext *cx, JSScript *script, jsbytecode *pc)
{
    return js_PCToLineNumber(cx, script, pc);
}

JS_PUBLIC_API(jsbytecode *)
JS_LineNumberToPC(JSContext *cx, JSScript *script, uintN lineno)
{
    return js_LineNumberToPC(script, lineno);
}

JS_PUBLIC_API(JSScript *)
JS_GetFunctionScript(JSContext *cx, JSFunction *fun)
{
    return FUN_SCRIPT(fun);
}

JS_PUBLIC_API(JSNative)
JS_GetFunctionNative(JSContext *cx, JSFunction *fun)
{
    return FUN_NATIVE(fun);
}

JS_PUBLIC_API(JSFastNative)
JS_GetFunctionFastNative(JSContext *cx, JSFunction *fun)
{
    return FUN_FAST_NATIVE(fun);
}

JS_PUBLIC_API(JSPrincipals *)
JS_GetScriptPrincipals(JSContext *cx, JSScript *script)
{
    return script->principals;
}

/************************************************************************/

/*
 *  Stack Frame Iterator
 */
JS_PUBLIC_API(JSStackFrame *)
JS_FrameIterator(JSContext *cx, JSStackFrame **iteratorp)
{
    *iteratorp = (*iteratorp == NULL) ? cx->fp : (*iteratorp)->down;
    return *iteratorp;
}

JS_PUBLIC_API(JSScript *)
JS_GetFrameScript(JSContext *cx, JSStackFrame *fp)
{
    return fp->script;
}

JS_PUBLIC_API(jsbytecode *)
JS_GetFramePC(JSContext *cx, JSStackFrame *fp)
{
    return fp->regs ? fp->regs->pc : NULL;
}

JS_PUBLIC_API(JSStackFrame *)
JS_GetScriptedCaller(JSContext *cx, JSStackFrame *fp)
{
    if (!fp)
        fp = cx->fp;
    while (fp) {
        if (fp->script)
            return fp;
        fp = fp->down;
    }
    return NULL;
}

JS_PUBLIC_API(JSPrincipals *)
JS_StackFramePrincipals(JSContext *cx, JSStackFrame *fp)
{
    JSSecurityCallbacks *callbacks;

    if (fp->fun) {
        callbacks = JS_GetSecurityCallbacks(cx);
        if (callbacks && callbacks->findObjectPrincipals) {
            if (FUN_OBJECT(fp->fun) != fp->callee)
                return callbacks->findObjectPrincipals(cx, fp->callee);
            /* FALL THROUGH */
        }
    }
    if (fp->script)
        return fp->script->principals;
    return NULL;
}

JS_PUBLIC_API(JSPrincipals *)
JS_EvalFramePrincipals(JSContext *cx, JSStackFrame *fp, JSStackFrame *caller)
{
    JSPrincipals *principals, *callerPrincipals;
    JSSecurityCallbacks *callbacks;

    callbacks = JS_GetSecurityCallbacks(cx);
    if (callbacks && callbacks->findObjectPrincipals) {
        principals = callbacks->findObjectPrincipals(cx, fp->callee);
    } else {
        principals = NULL;
    }
    if (!caller)
        return principals;
    callerPrincipals = JS_StackFramePrincipals(cx, caller);
    return (callerPrincipals && principals &&
            callerPrincipals->subsume(callerPrincipals, principals))
           ? principals
           : callerPrincipals;
}

JS_PUBLIC_API(void *)
JS_GetFrameAnnotation(JSContext *cx, JSStackFrame *fp)
{
    if (fp->annotation && fp->script) {
        JSPrincipals *principals = JS_StackFramePrincipals(cx, fp);

        if (principals && principals->globalPrivilegesEnabled(cx, principals)) {
            /*
             * Give out an annotation only if privileges have not been revoked
             * or disabled globally.
             */
            return fp->annotation;
        }
    }

    return NULL;
}

JS_PUBLIC_API(void)
JS_SetFrameAnnotation(JSContext *cx, JSStackFrame *fp, void *annotation)
{
    fp->annotation = annotation;
}

JS_PUBLIC_API(void *)
JS_GetFramePrincipalArray(JSContext *cx, JSStackFrame *fp)
{
    JSPrincipals *principals;

    principals = JS_StackFramePrincipals(cx, fp);
    if (!principals)
        return NULL;
    return principals->getPrincipalArray(cx, principals);
}

JS_PUBLIC_API(JSBool)
JS_IsNativeFrame(JSContext *cx, JSStackFrame *fp)
{
    return !fp->script;
}

/* this is deprecated, use JS_GetFrameScopeChain instead */
JS_PUBLIC_API(JSObject *)
JS_GetFrameObject(JSContext *cx, JSStackFrame *fp)
{
    return fp->scopeChain;
}

JS_PUBLIC_API(JSObject *)
JS_GetFrameScopeChain(JSContext *cx, JSStackFrame *fp)
{
    /* Force creation of argument and call objects if not yet created */
    (void) JS_GetFrameCallObject(cx, fp);
    return js_GetScopeChain(cx, fp);
}

JS_PUBLIC_API(JSObject *)
JS_GetFrameCallObject(JSContext *cx, JSStackFrame *fp)
{
    if (! fp->fun)
        return NULL;

    /* Force creation of argument object if not yet created */
    (void) js_GetArgsObject(cx, fp);

    /*
     * XXX ill-defined: null return here means error was reported, unlike a
     *     null returned above or in the #else
     */
    return js_GetCallObject(cx, fp, NULL);
}

JS_PUBLIC_API(JSObject *)
JS_GetFrameThis(JSContext *cx, JSStackFrame *fp)
{
    JSStackFrame *afp;

    if (fp->flags & JSFRAME_COMPUTED_THIS)
        return fp->thisp;

    /* js_ComputeThis gets confused if fp != cx->fp, so set it aside. */
    if (cx->fp != fp) {
        afp = cx->fp;
        if (afp) {
            afp->dormantNext = cx->dormantFrameChain;
            cx->dormantFrameChain = afp;
            cx->fp = fp;
        }
    } else {
        afp = NULL;
    }

    if (!fp->thisp && fp->argv)
        fp->thisp = js_ComputeThis(cx, JS_TRUE, fp->argv);

    if (afp) {
        cx->fp = afp;
        cx->dormantFrameChain = afp->dormantNext;
        afp->dormantNext = NULL;
    }

    return fp->thisp;
}

JS_PUBLIC_API(JSFunction *)
JS_GetFrameFunction(JSContext *cx, JSStackFrame *fp)
{
    return fp->fun;
}

JS_PUBLIC_API(JSObject *)
JS_GetFrameFunctionObject(JSContext *cx, JSStackFrame *fp)
{
    if (!fp->fun)
        return NULL;

    JS_ASSERT(OBJ_GET_CLASS(cx, fp->callee) == &js_FunctionClass);
    JS_ASSERT(OBJ_GET_PRIVATE(cx, fp->callee) == fp->fun);
    return fp->callee;
}

JS_PUBLIC_API(JSBool)
JS_IsConstructorFrame(JSContext *cx, JSStackFrame *fp)
{
    return (fp->flags & JSFRAME_CONSTRUCTING) != 0;
}

JS_PUBLIC_API(JSObject *)
JS_GetFrameCalleeObject(JSContext *cx, JSStackFrame *fp)
{
    return fp->callee;
}

JS_PUBLIC_API(JSBool)
JS_IsDebuggerFrame(JSContext *cx, JSStackFrame *fp)
{
    return (fp->flags & JSFRAME_DEBUGGER) != 0;
}

JS_PUBLIC_API(jsval)
JS_GetFrameReturnValue(JSContext *cx, JSStackFrame *fp)
{
    return fp->rval;
}

JS_PUBLIC_API(void)
JS_SetFrameReturnValue(JSContext *cx, JSStackFrame *fp, jsval rval)
{
    fp->rval = rval;
}

/************************************************************************/

JS_PUBLIC_API(const char *)
JS_GetScriptFilename(JSContext *cx, JSScript *script)
{
    return script->filename;
}

JS_PUBLIC_API(uintN)
JS_GetScriptBaseLineNumber(JSContext *cx, JSScript *script)
{
    return script->lineno;
}

JS_PUBLIC_API(uintN)
JS_GetScriptLineExtent(JSContext *cx, JSScript *script)
{
    return js_GetScriptLineExtent(script);
}

JS_PUBLIC_API(JSVersion)
JS_GetScriptVersion(JSContext *cx, JSScript *script)
{
    return (JSVersion) (script->version & JSVERSION_MASK);
}

/***************************************************************************/

JS_PUBLIC_API(void)
JS_SetNewScriptHook(JSRuntime *rt, JSNewScriptHook hook, void *callerdata)
{
    rt->globalDebugHooks.newScriptHook = hook;
    rt->globalDebugHooks.newScriptHookData = callerdata;
}

JS_PUBLIC_API(void)
JS_SetDestroyScriptHook(JSRuntime *rt, JSDestroyScriptHook hook,
                        void *callerdata)
{
    rt->globalDebugHooks.destroyScriptHook = hook;
    rt->globalDebugHooks.destroyScriptHookData = callerdata;
}

/***************************************************************************/

JS_PUBLIC_API(JSBool)
JS_EvaluateUCInStackFrame(JSContext *cx, JSStackFrame *fp,
                          const jschar *chars, uintN length,
                          const char *filename, uintN lineno,
                          jsval *rval)
{
    JSObject *scobj;
    JSScript *script;
    JSBool ok;

    scobj = JS_GetFrameScopeChain(cx, fp);
    if (!scobj)
        return JS_FALSE;

    script = js_CompileScript(cx, scobj, fp, JS_StackFramePrincipals(cx, fp),
                              TCF_COMPILE_N_GO |
                              TCF_PUT_STATIC_DEPTH(fp->script->staticDepth + 1),
                              chars, length, NULL,
                              filename, lineno);
    if (!script)
        return JS_FALSE;

    ok = js_Execute(cx, scobj, script, fp, JSFRAME_DEBUGGER | JSFRAME_EVAL,
                    rval);
    js_DestroyScript(cx, script);
    return ok;
}

JS_PUBLIC_API(JSBool)
JS_EvaluateInStackFrame(JSContext *cx, JSStackFrame *fp,
                        const char *bytes, uintN length,
                        const char *filename, uintN lineno,
                        jsval *rval)
{
    jschar *chars;
    JSBool ok;
    size_t len = length;

    chars = js_InflateString(cx, bytes, &len);
    if (!chars)
        return JS_FALSE;
    length = (uintN) len;
    ok = JS_EvaluateUCInStackFrame(cx, fp, chars, length, filename, lineno,
                                   rval);
    JS_free(cx, chars);

    return ok;
}

/************************************************************************/

/* XXXbe this all needs to be reworked to avoid requiring JSScope types. */

JS_PUBLIC_API(JSScopeProperty *)
JS_PropertyIterator(JSObject *obj, JSScopeProperty **iteratorp)
{
    JSScopeProperty *sprop;
    JSScope *scope;

    sprop = *iteratorp;
    scope = OBJ_SCOPE(obj);

    /* XXXbe minor(?) incompatibility: iterate in reverse definition order */
    if (!sprop) {
        sprop = SCOPE_LAST_PROP(scope);
    } else {
        while ((sprop = sprop->parent) != NULL) {
            if (!SCOPE_HAD_MIDDLE_DELETE(scope))
                break;
            if (SCOPE_HAS_PROPERTY(scope, sprop))
                break;
        }
    }
    *iteratorp = sprop;
    return sprop;
}

JS_PUBLIC_API(JSBool)
JS_GetPropertyDesc(JSContext *cx, JSObject *obj, JSScopeProperty *sprop,
                   JSPropertyDesc *pd)
{
    JSScope *scope;
    JSScopeProperty *aprop;
    jsval lastException;
    JSBool wasThrowing;

    pd->id = ID_TO_VALUE(sprop->id);

    wasThrowing = cx->throwing;
    if (wasThrowing) {
        lastException = cx->exception;
        if (JSVAL_IS_GCTHING(lastException) &&
            !js_AddRoot(cx, &lastException, "lastException")) {
                return JS_FALSE;
        }
        cx->throwing = JS_FALSE;
    }

    if (!js_GetProperty(cx, obj, sprop->id, &pd->value)) {
        if (!cx->throwing) {
            pd->flags = JSPD_ERROR;
            pd->value = JSVAL_VOID;
        } else {
            pd->flags = JSPD_EXCEPTION;
            pd->value = cx->exception;
        }
    } else {
        pd->flags = 0;
    }

    cx->throwing = wasThrowing;
    if (wasThrowing) {
        cx->exception = lastException;
        if (JSVAL_IS_GCTHING(lastException))
            js_RemoveRoot(cx->runtime, &lastException);
    }

    pd->flags |= ((sprop->attrs & JSPROP_ENUMERATE) ? JSPD_ENUMERATE : 0)
              | ((sprop->attrs & JSPROP_READONLY)  ? JSPD_READONLY  : 0)
              | ((sprop->attrs & JSPROP_PERMANENT) ? JSPD_PERMANENT : 0);
    pd->spare = 0;
    if (sprop->getter == js_GetCallArg) {
        pd->slot = sprop->shortid;
        pd->flags |= JSPD_ARGUMENT;
    } else if (sprop->getter == js_GetCallVar) {
        pd->slot = sprop->shortid;
        pd->flags |= JSPD_VARIABLE;
    } else {
        pd->slot = 0;
    }
    pd->alias = JSVAL_VOID;
    scope = OBJ_SCOPE(obj);
    if (SPROP_HAS_VALID_SLOT(sprop, scope)) {
        for (aprop = SCOPE_LAST_PROP(scope); aprop; aprop = aprop->parent) {
            if (aprop != sprop && aprop->slot == sprop->slot) {
                pd->alias = ID_TO_VALUE(aprop->id);
                break;
            }
        }
    }
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_GetPropertyDescArray(JSContext *cx, JSObject *obj, JSPropertyDescArray *pda)
{
    JSClass *clasp;
    JSScope *scope;
    uint32 i, n;
    JSPropertyDesc *pd;
    JSScopeProperty *sprop;

    clasp = OBJ_GET_CLASS(cx, obj);
    if (!OBJ_IS_NATIVE(obj) || (clasp->flags & JSCLASS_NEW_ENUMERATE)) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_CANT_DESCRIBE_PROPS, clasp->name);
        return JS_FALSE;
    }
    if (!clasp->enumerate(cx, obj))
        return JS_FALSE;

    /* have no props, or object's scope has not mutated from that of proto */
    scope = OBJ_SCOPE(obj);
    if (scope->object != obj || scope->entryCount == 0) {
        pda->length = 0;
        pda->array = NULL;
        return JS_TRUE;
    }

    n = STOBJ_NSLOTS(obj);
    if (n > scope->entryCount)
        n = scope->entryCount;
    pd = (JSPropertyDesc *) JS_malloc(cx, (size_t)n * sizeof(JSPropertyDesc));
    if (!pd)
        return JS_FALSE;
    i = 0;
    for (sprop = SCOPE_LAST_PROP(scope); sprop; sprop = sprop->parent) {
        if (SCOPE_HAD_MIDDLE_DELETE(scope) && !SCOPE_HAS_PROPERTY(scope, sprop))
            continue;
        if (!js_AddRoot(cx, &pd[i].id, NULL))
            goto bad;
        if (!js_AddRoot(cx, &pd[i].value, NULL))
            goto bad;
        if (!JS_GetPropertyDesc(cx, obj, sprop, &pd[i]))
            goto bad;
        if ((pd[i].flags & JSPD_ALIAS) && !js_AddRoot(cx, &pd[i].alias, NULL))
            goto bad;
        if (++i == n)
            break;
    }
    pda->length = i;
    pda->array = pd;
    return JS_TRUE;

bad:
    pda->length = i + 1;
    pda->array = pd;
    JS_PutPropertyDescArray(cx, pda);
    return JS_FALSE;
}

JS_PUBLIC_API(void)
JS_PutPropertyDescArray(JSContext *cx, JSPropertyDescArray *pda)
{
    JSPropertyDesc *pd;
    uint32 i;

    pd = pda->array;
    for (i = 0; i < pda->length; i++) {
        js_RemoveRoot(cx->runtime, &pd[i].id);
        js_RemoveRoot(cx->runtime, &pd[i].value);
        if (pd[i].flags & JSPD_ALIAS)
            js_RemoveRoot(cx->runtime, &pd[i].alias);
    }
    JS_free(cx, pd);
}

/************************************************************************/

JS_PUBLIC_API(JSBool)
JS_SetDebuggerHandler(JSRuntime *rt, JSTrapHandler handler, void *closure)
{
    rt->globalDebugHooks.debuggerHandler = handler;
    rt->globalDebugHooks.debuggerHandlerData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetSourceHandler(JSRuntime *rt, JSSourceHandler handler, void *closure)
{
    rt->globalDebugHooks.sourceHandler = handler;
    rt->globalDebugHooks.sourceHandlerData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetExecuteHook(JSRuntime *rt, JSInterpreterHook hook, void *closure)
{
    rt->globalDebugHooks.executeHook = hook;
    rt->globalDebugHooks.executeHookData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetCallHook(JSRuntime *rt, JSInterpreterHook hook, void *closure)
{
    rt->globalDebugHooks.callHook = hook;
    rt->globalDebugHooks.callHookData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetObjectHook(JSRuntime *rt, JSObjectHook hook, void *closure)
{
    rt->globalDebugHooks.objectHook = hook;
    rt->globalDebugHooks.objectHookData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetThrowHook(JSRuntime *rt, JSTrapHandler hook, void *closure)
{
    rt->globalDebugHooks.throwHook = hook;
    rt->globalDebugHooks.throwHookData = closure;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_SetDebugErrorHook(JSRuntime *rt, JSDebugErrorHook hook, void *closure)
{
    rt->globalDebugHooks.debugErrorHook = hook;
    rt->globalDebugHooks.debugErrorHookData = closure;
    return JS_TRUE;
}

/************************************************************************/

JS_PUBLIC_API(size_t)
JS_GetObjectTotalSize(JSContext *cx, JSObject *obj)
{
    size_t nbytes;
    JSScope *scope;

    nbytes = sizeof *obj;
    if (obj->dslots) {
        nbytes += ((uint32)obj->dslots[-1] - JS_INITIAL_NSLOTS + 1)
                  * sizeof obj->dslots[0];
    }
    if (OBJ_IS_NATIVE(obj)) {
        scope = OBJ_SCOPE(obj);
        if (scope->object == obj) {
            nbytes += sizeof *scope;
            nbytes += SCOPE_CAPACITY(scope) * sizeof(JSScopeProperty *);
        }
    }
    return nbytes;
}

static size_t
GetAtomTotalSize(JSContext *cx, JSAtom *atom)
{
    size_t nbytes;

    nbytes = sizeof(JSAtom *) + sizeof(JSDHashEntryStub);
    if (ATOM_IS_STRING(atom)) {
        nbytes += sizeof(JSString);
        nbytes += (JSFLATSTR_LENGTH(ATOM_TO_STRING(atom)) + 1) * sizeof(jschar);
    } else if (ATOM_IS_DOUBLE(atom)) {
        nbytes += sizeof(jsdouble);
    }
    return nbytes;
}

JS_PUBLIC_API(size_t)
JS_GetFunctionTotalSize(JSContext *cx, JSFunction *fun)
{
    size_t nbytes;

    nbytes = sizeof *fun;
    nbytes += JS_GetObjectTotalSize(cx, FUN_OBJECT(fun));
    if (FUN_INTERPRETED(fun))
        nbytes += JS_GetScriptTotalSize(cx, fun->u.i.script);
    if (fun->atom)
        nbytes += GetAtomTotalSize(cx, fun->atom);
    return nbytes;
}

#include "jsemit.h"

JS_PUBLIC_API(size_t)
JS_GetScriptTotalSize(JSContext *cx, JSScript *script)
{
    size_t nbytes, pbytes;
    jsatomid i;
    jssrcnote *sn, *notes;
    JSObjectArray *objarray;
    JSPrincipals *principals;

    nbytes = sizeof *script;
    if (script->u.object)
        nbytes += JS_GetObjectTotalSize(cx, script->u.object);

    nbytes += script->length * sizeof script->code[0];
    nbytes += script->atomMap.length * sizeof script->atomMap.vector[0];
    for (i = 0; i < script->atomMap.length; i++)
        nbytes += GetAtomTotalSize(cx, script->atomMap.vector[i]);

    if (script->filename)
        nbytes += strlen(script->filename) + 1;

    notes = SCRIPT_NOTES(script);
    for (sn = notes; !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn))
        continue;
    nbytes += (sn - notes + 1) * sizeof *sn;

    if (script->objectsOffset != 0) {
        objarray = JS_SCRIPT_OBJECTS(script);
        i = objarray->length;
        nbytes += sizeof *objarray + i * sizeof objarray->vector[0];
        do {
            nbytes += JS_GetObjectTotalSize(cx, objarray->vector[--i]);
        } while (i != 0);
    }

    if (script->regexpsOffset != 0) {
        objarray = JS_SCRIPT_REGEXPS(script);
        i = objarray->length;
        nbytes += sizeof *objarray + i * sizeof objarray->vector[0];
        do {
            nbytes += JS_GetObjectTotalSize(cx, objarray->vector[--i]);
        } while (i != 0);
    }

    if (script->trynotesOffset != 0) {
        nbytes += sizeof(JSTryNoteArray) +
            JS_SCRIPT_TRYNOTES(script)->length * sizeof(JSTryNote);
    }

    principals = script->principals;
    if (principals) {
        JS_ASSERT(principals->refcount);
        pbytes = sizeof *principals;
        if (principals->refcount > 1)
            pbytes = JS_HOWMANY(pbytes, principals->refcount);
        nbytes += pbytes;
    }

    return nbytes;
}

JS_PUBLIC_API(uint32)
JS_GetTopScriptFilenameFlags(JSContext *cx, JSStackFrame *fp)
{
    if (!fp)
        fp = cx->fp;
    while (fp) {
        if (fp->script)
            return JS_GetScriptFilenameFlags(fp->script);
        fp = fp->down;
    }
    return 0;
 }

JS_PUBLIC_API(uint32)
JS_GetScriptFilenameFlags(JSScript *script)
{
    JS_ASSERT(script);
    if (!script->filename)
        return JSFILENAME_NULL;
    return js_GetScriptFilenameFlags(script->filename);
}

JS_PUBLIC_API(JSBool)
JS_FlagScriptFilenamePrefix(JSRuntime *rt, const char *prefix, uint32 flags)
{
    if (!js_SaveScriptFilenameRT(rt, prefix, flags))
        return JS_FALSE;
    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_IsSystemObject(JSContext *cx, JSObject *obj)
{
    return STOBJ_IS_SYSTEM(obj);
}

JS_PUBLIC_API(JSObject *)
JS_NewSystemObject(JSContext *cx, JSClass *clasp, JSObject *proto,
                   JSObject *parent, JSBool system)
{
    JSObject *obj;

    obj = js_NewObject(cx, clasp, proto, parent, 0);
    if (obj && system)
        STOBJ_SET_SYSTEM(obj);
    return obj;
}

/************************************************************************/

JS_PUBLIC_API(JSDebugHooks *)
JS_GetGlobalDebugHooks(JSRuntime *rt)
{
    return &rt->globalDebugHooks;
}

JS_PUBLIC_API(JSDebugHooks *)
JS_SetContextDebugHooks(JSContext *cx, JSDebugHooks *hooks)
{
    JSDebugHooks *old;

    JS_ASSERT(hooks);
    old = cx->debugHooks;
    cx->debugHooks = hooks;
    return old;
}

#ifdef MOZ_SHARK

#include <CHUD/CHUD.h>

JS_PUBLIC_API(JSBool)
JS_StartChudRemote()
{
    if (chudIsRemoteAccessAcquired() &&
        (chudStartRemotePerfMonitor("Mozilla") == chudSuccess)) {
        return JS_TRUE;
    }

    return JS_FALSE;
}

JS_PUBLIC_API(JSBool)
JS_StopChudRemote()
{
    if (chudIsRemoteAccessAcquired() &&
        (chudStopRemotePerfMonitor() == chudSuccess)) {
        return JS_TRUE;
    }

    return JS_FALSE;
}

JS_PUBLIC_API(JSBool)
JS_ConnectShark()
{
    if (!chudIsInitialized() && (chudInitialize() != chudSuccess))
        return JS_FALSE;

    if (chudAcquireRemoteAccess() != chudSuccess)
        return JS_FALSE;

    return JS_TRUE;
}

JS_PUBLIC_API(JSBool)
JS_DisconnectShark()
{
    if (chudIsRemoteAccessAcquired() && (chudReleaseRemoteAccess() != chudSuccess))
        return JS_FALSE;

    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_StartShark(JSContext *cx, JSObject *obj,
              uintN argc, jsval *argv, jsval *rval)
{
    if (!JS_StartChudRemote()) {
        JS_ReportError(cx, "Error starting CHUD.");
    }

    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_StopShark(JSContext *cx, JSObject *obj,
             uintN argc, jsval *argv, jsval *rval)
{
    if (!JS_StopChudRemote()) {
        JS_ReportError(cx, "Error stopping CHUD.");
    }

    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_ConnectShark(JSContext *cx, JSObject *obj,
                uintN argc, jsval *argv, jsval *rval)
{
    if (!JS_ConnectShark()) {
        JS_ReportError(cx, "Error connecting to Shark.");
    }

    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_DisconnectShark(JSContext *cx, JSObject *obj,
                   uintN argc, jsval *argv, jsval *rval)
{
    if (!JS_DisconnectShark()) {
        JS_ReportError(cx, "Error disconnecting from Shark.");
    }

    return JS_TRUE;
}

#endif /* MOZ_SHARK */

#ifdef MOZ_CALLGRIND

#include <valgrind/callgrind.h>

JS_FRIEND_API(JSBool)
js_StartCallgrind(JSContext *cx, JSObject *obj,
                  uintN argc, jsval *argv, jsval *rval)
{
    CALLGRIND_START_INSTRUMENTATION;    
    CALLGRIND_ZERO_STATS;
    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_StopCallgrind(JSContext *cx, JSObject *obj,
                 uintN argc, jsval *argv, jsval *rval)
{
    CALLGRIND_STOP_INSTRUMENTATION;
    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_DumpCallgrind(JSContext *cx, JSObject *obj,
                 uintN argc, jsval *argv, jsval *rval)
{
    JSString *str;
    char *cstr;

    if (argc > 0 && JSVAL_IS_STRING(argv[0])) {
        str = JSVAL_TO_STRING(argv[0]);
        cstr = js_DeflateString(cx, JSSTRING_CHARS(str), JSSTRING_LENGTH(str));
        if (cstr) {
            CALLGRIND_DUMP_STATS_AT(cstr);
            JS_free(cx, cstr);
            return JS_TRUE;
        }
    }
    CALLGRIND_DUMP_STATS;

    return JS_TRUE;
}

#endif /* MOZ_CALLGRIND */

#ifdef MOZ_VTUNE
#include <VTuneApi.h>

static const char *vtuneErrorMessages[] = {
  "unknown, error #0",
  "invalid 'max samples' field",
  "invalid 'samples per buffer' field",
  "invalid 'sample interval' field",
  "invalid path",
  "sample file in use",
  "invalid 'number of events' field",
  "unknown, error #7",
  "internal error",
  "bad event name",
  "VTStopSampling called without calling VTStartSampling",
  "no events selected for event-based sampling",
  "events selected cannot be run together",
  "no sampling parameters",
  "sample database already exists",
  "sampling already started",
  "time-based sampling not supported",
  "invalid 'sampling parameters size' field",
  "invalid 'event size' field",
  "sampling file already bound",
  "invalid event path",
  "invalid license",
  "invalid 'global options' field",

};

JS_FRIEND_API(JSBool)
js_StartVtune(JSContext *cx, JSObject *obj,
              uintN argc, jsval *argv, jsval *rval)
{
    VTUNE_EVENT events[] = { 
	{ 1000000, 0, 0, 0, "CPU_CLK_UNHALTED.CORE" },
	{ 1000000, 0, 0, 0, "INST_RETIRED.ANY" },
    };

    U32 n_events = sizeof(events) / sizeof(VTUNE_EVENT);
    char *default_filename = "mozilla-vtune.tb5";
    JSString *str;
    U32 status;

    VTUNE_SAMPLING_PARAMS params = { 
        sizeof(VTUNE_SAMPLING_PARAMS),
        sizeof(VTUNE_EVENT),
        0, 0, /* Reserved fields */
        1,    /* Initialize in "paused" state */
        0,    /* Max samples, or 0 for "continuous" */
        4096, /* Samples per buffer */
        0.1,  /* Sampling interval in ms */
        1,    /* 1 for event-based sampling, 0 for time-based */

        n_events,
        events,
        default_filename,
    };

    if (argc > 0 && JSVAL_IS_STRING(argv[0])) {
        str = JSVAL_TO_STRING(argv[0]);
        params.tb5Filename = js_DeflateString(cx, 
                                              JSSTRING_CHARS(str), 
                                              JSSTRING_LENGTH(str));
    }
    
    status = VTStartSampling(&params);

    if (params.tb5Filename != default_filename)
        JS_free(cx, params.tb5Filename);
    
    if (status != 0) { 
        if (status == VTAPI_MULTIPLE_RUNS)
            VTStopSampling(0);
        if (status < sizeof(vtuneErrorMessages))
            JS_ReportError(cx, "Vtune setup error: %s", 
                           vtuneErrorMessages[status]);
        else
            JS_ReportError(cx, "Vtune setup error: %d", 
                           status);            
        return JS_FALSE;
    }
    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_StopVtune(JSContext *cx, JSObject *obj,
             uintN argc, jsval *argv, jsval *rval)
{
    U32 status = VTStopSampling(1);
    if (status) {
        if (status < sizeof(vtuneErrorMessages))
            JS_ReportError(cx, "Vtune shutdown error: %s", 
                           vtuneErrorMessages[status]);
        else
            JS_ReportError(cx, "Vtune shutdown error: %d", 
                           status);
        return JS_FALSE;
    }
    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_PauseVtune(JSContext *cx, JSObject *obj,
              uintN argc, jsval *argv, jsval *rval)
{
    VTPause();
    return JS_TRUE;
}

JS_FRIEND_API(JSBool)
js_ResumeVtune(JSContext *cx, JSObject *obj,
               uintN argc, jsval *argv, jsval *rval)
{
    VTResume();
    return JS_TRUE;
}

#endif /* MOZ_VTUNE */
