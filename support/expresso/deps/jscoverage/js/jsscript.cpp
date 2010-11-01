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
 * JS script operations.
 */
#include "jsstddef.h"
#include <string.h>
#include "jstypes.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jsprf.h"
#include "jsapi.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsdbgapi.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsscope.h"
#include "jsscript.h"
#if JS_HAS_XDR
#include "jsxdrapi.h"
#endif

#if JS_HAS_SCRIPT_OBJECT

static const char js_script_exec_str[]    = "Script.prototype.exec";
static const char js_script_compile_str[] = "Script.prototype.compile";

/*
 * This routine requires that obj has been locked previously.
 */
static jsint
GetScriptExecDepth(JSContext *cx, JSObject *obj)
{
    jsval v;

    JS_ASSERT(JS_IS_OBJ_LOCKED(cx, obj));
    v = LOCKED_OBJ_GET_SLOT(obj, JSSLOT_START(&js_ScriptClass));
    return JSVAL_TO_INT(v);
}

static void
AdjustScriptExecDepth(JSContext *cx, JSObject *obj, jsint delta)
{
    jsint execDepth;

    JS_LOCK_OBJ(cx, obj);
    execDepth = GetScriptExecDepth(cx, obj);
    LOCKED_OBJ_SET_SLOT(obj, JSSLOT_START(&js_ScriptClass),
                        INT_TO_JSVAL(execDepth + delta));
    JS_UNLOCK_OBJ(cx, obj);
}

#if JS_HAS_TOSOURCE
static JSBool
script_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    uint32 indent;
    JSScript *script;
    size_t i, j, k, n;
    char buf[16];
    jschar *s, *t;
    JSString *str;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, vp + 2))
        return JS_FALSE;

    indent = 0;
    if (argc != 0) {
        indent = js_ValueToECMAUint32(cx, &vp[2]);
        if (JSVAL_IS_NULL(vp[2]))
            return JS_FALSE;
    }

    script = (JSScript *) JS_GetPrivate(cx, obj);

    /* Let n count the source string length, j the "front porch" length. */
    j = JS_snprintf(buf, sizeof buf, "(new %s(", js_ScriptClass.name);
    n = j + 2;
    if (!script) {
        /* Let k count the constructor argument string length. */
        k = 0;
        s = NULL;               /* quell GCC overwarning */
    } else {
        str = JS_DecompileScript(cx, script, "Script.prototype.toSource",
                                 (uintN)indent);
        if (!str)
            return JS_FALSE;
        str = js_QuoteString(cx, str, '\'');
        if (!str)
            return JS_FALSE;
        JSSTRING_CHARS_AND_LENGTH(str, s, k);
        n += k;
    }

    /* Allocate the source string and copy into it. */
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

    /* Create and return a JS string for t. */
    str = JS_NewUCString(cx, t, n);
    if (!str) {
        JS_free(cx, t);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}
#endif /* JS_HAS_TOSOURCE */

static JSBool
script_toString(JSContext *cx, uintN argc, jsval *vp)
{
    uint32 indent;
    JSObject *obj;
    JSScript *script;
    JSString *str;

    indent = 0;
    if (argc != 0) {
        indent = js_ValueToECMAUint32(cx, &vp[2]);
        if (JSVAL_IS_NULL(vp[2]))
            return JS_FALSE;
    }

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, vp + 2))
        return JS_FALSE;
    script = (JSScript *) JS_GetPrivate(cx, obj);
    if (!script) {
        *vp = STRING_TO_JSVAL(cx->runtime->emptyString);
        return JS_TRUE;
    }

    str = JS_DecompileScript(cx, script, "Script.prototype.toString",
                             (uintN)indent);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
script_compile_sub(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                   jsval *rval)
{
    JSString *str;
    JSObject *scopeobj;
    jsval v;
    JSScript *script, *oldscript;
    JSStackFrame *caller;
    const char *file;
    uintN line;
    JSPrincipals *principals;
    uint32 tcflags;
    jsint execDepth;

    /* Make sure obj is a Script object. */
    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, argv))
        return JS_FALSE;

    /* If no args, leave private undefined and return early. */
    if (argc == 0)
        goto out;

    /* Otherwise, the first arg is the script source to compile. */
    str = js_ValueToString(cx, argv[0]);
    if (!str)
        return JS_FALSE;
    argv[0] = STRING_TO_JSVAL(str);

    scopeobj = NULL;
    if (argc >= 2) {
        if (!js_ValueToObject(cx, argv[1], &scopeobj))
            return JS_FALSE;
        argv[1] = OBJECT_TO_JSVAL(scopeobj);
    }

    /* Compile using the caller's scope chain, which js_Invoke passes to fp. */
    caller = JS_GetScriptedCaller(cx, cx->fp);
    JS_ASSERT(!caller || cx->fp->scopeChain == caller->scopeChain);

    if (caller) {
        if (!scopeobj) {
            scopeobj = js_GetScopeChain(cx, caller);
            if (!scopeobj)
                return JS_FALSE;
        }

        principals = JS_EvalFramePrincipals(cx, cx->fp, caller);
        file = js_ComputeFilename(cx, caller, principals, &line);
    } else {
        file = NULL;
        line = 0;
        principals = NULL;
    }

    /* Ensure we compile this script with the right (inner) principals. */
    scopeobj = js_CheckScopeChainValidity(cx, scopeobj, js_script_compile_str);
    if (!scopeobj)
        return JS_FALSE;

    /*
     * Compile the new script using the caller's scope chain, a la eval().
     * Unlike jsobj.c:obj_eval, however, we do not pass TCF_COMPILE_N_GO in
     * tcflags and use NULL for the callerFrame argument, because compilation
     * is here separated from execution, and the run-time scope chain may not
     * match the compile-time. TCF_COMPILE_N_GO is tested in jsemit.c and
     * jsparse.c to optimize based on identity of run- and compile-time scope.
     */
    tcflags = 0;
    script = js_CompileScript(cx, scopeobj, NULL, principals, tcflags,
                              JSSTRING_CHARS(str), JSSTRING_LENGTH(str),
                              NULL, file, line);
    if (!script)
        return JS_FALSE;

    JS_LOCK_OBJ(cx, obj);
    execDepth = GetScriptExecDepth(cx, obj);

    /*
     * execDepth must be 0 to allow compilation here, otherwise the JSScript
     * struct can be released while running.
     */
    if (execDepth > 0) {
        JS_UNLOCK_OBJ(cx, obj);
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_COMPILE_EXECED_SCRIPT);
        return JS_FALSE;
    }

    /* Swap script for obj's old script, if any. */
    v = LOCKED_OBJ_GET_SLOT(obj, JSSLOT_PRIVATE);
    oldscript = (JSScript*) (!JSVAL_IS_VOID(v) ? JSVAL_TO_PRIVATE(v) : NULL);
    LOCKED_OBJ_SET_SLOT(obj, JSSLOT_PRIVATE, PRIVATE_TO_JSVAL(script));
    JS_UNLOCK_OBJ(cx, obj);

    if (oldscript)
        js_DestroyScript(cx, oldscript);

    script->u.object = obj;
    js_CallNewScriptHook(cx, script, NULL);

out:
    /* Return the object. */
    *rval = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSBool
script_compile(JSContext *cx, uintN argc, jsval *vp)
{
    return script_compile_sub(cx, JS_THIS_OBJECT(cx, vp), argc, vp + 2, vp);
}

static JSBool
script_exec_sub(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                jsval *rval)
{
    JSObject *scopeobj, *parent;
    JSStackFrame *fp, *caller;
    JSPrincipals *principals;
    JSScript *script;
    JSBool ok;

    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, argv))
        return JS_FALSE;

    scopeobj = NULL;
    if (argc != 0) {
        if (!js_ValueToObject(cx, argv[0], &scopeobj))
            return JS_FALSE;
        argv[0] = OBJECT_TO_JSVAL(scopeobj);
    }

    /*
     * Emulate eval() by using caller's this, var object, sharp array, etc.,
     * all propagated by js_Execute via a non-null fourth (down) argument to
     * js_Execute.  If there is no scripted caller, js_Execute uses its second
     * (chain) argument to set the exec frame's varobj, thisp, and scopeChain.
     *
     * Unlike eval, which the compiler detects, Script.prototype.exec may be
     * called from a lightweight function, or even from native code (in which
     * case fp->varobj and fp->scopeChain are null).  If exec is called from
     * a lightweight function, we will need to get a Call object representing
     * its frame, to act as the var object and scope chain head.
     */
    fp = cx->fp;
    caller = JS_GetScriptedCaller(cx, fp);
    if (caller && !caller->varobj) {
        /* Called from a lightweight function. */
        JS_ASSERT(caller->fun && !JSFUN_HEAVYWEIGHT_TEST(caller->fun->flags));

        /* Scope chain links from Call object to callee's parent. */
        parent = OBJ_GET_PARENT(cx, caller->callee);
        if (!js_GetCallObject(cx, caller, parent))
            return JS_FALSE;
    }

    if (!scopeobj) {
        /* No scope object passed in: try to use the caller's scope chain. */
        if (caller) {
            /*
             * Load caller->scopeChain after the conditional js_GetCallObject
             * call above, which resets scopeChain as well as varobj.
             */
            scopeobj = js_GetScopeChain(cx, caller);
            if (!scopeobj)
                return JS_FALSE;
        } else {
            /*
             * Called from native code, so we don't know what scope object to
             * use.  We could use parent (see above), but Script.prototype.exec
             * might be a shared/sealed "superglobal" method.  A more general
             * approach would use cx->globalObject, which will be the same as
             * exec.__parent__ in the non-superglobal case.  In the superglobal
             * case it's the right object: the global, not the superglobal.
             */
            scopeobj = cx->globalObject;
        }
    }

    scopeobj = js_CheckScopeChainValidity(cx, scopeobj, js_script_exec_str);
    if (!scopeobj)
        return JS_FALSE;

    /* Keep track of nesting depth for the script. */
    AdjustScriptExecDepth(cx, obj, 1);

    /* Must get to out label after this */
    script = (JSScript *) JS_GetPrivate(cx, obj);
    if (!script) {
        ok = JS_FALSE;
        goto out;
    }

    /* Belt-and-braces: check that this script object has access to scopeobj. */
    principals = script->principals;
    ok = js_CheckPrincipalsAccess(cx, scopeobj, principals,
                                  CLASS_ATOM(cx, Script));
    if (!ok)
        goto out;

    ok = js_Execute(cx, scopeobj, script, caller, JSFRAME_EVAL, rval);

out:
    AdjustScriptExecDepth(cx, obj, -1);
    return ok;
}

static JSBool
script_exec(JSContext *cx, uintN argc, jsval *vp)
{
    return script_exec_sub(cx, JS_THIS_OBJECT(cx, vp), argc, vp + 2, vp);
}

#endif /* JS_HAS_SCRIPT_OBJECT */

#if JS_HAS_XDR

JSBool
js_XDRScript(JSXDRState *xdr, JSScript **scriptp, JSBool *hasMagic)
{
    JSContext *cx;
    JSScript *script, *oldscript;
    JSBool ok;
    jsbytecode *code;
    uint32 length, lineno, nslots, magic;
    uint32 natoms, nsrcnotes, ntrynotes, nobjects, nupvars, nregexps, i;
    uint32 prologLength, version;
    JSTempValueRooter tvr;
    JSPrincipals *principals;
    uint32 encodeable;
    JSBool filenameWasSaved;
    jssrcnote *notes, *sn;
    JSSecurityCallbacks *callbacks;

    cx = xdr->cx;
    script = *scriptp;
    nsrcnotes = ntrynotes = natoms = nobjects = nupvars = nregexps = 0;
    filenameWasSaved = JS_FALSE;
    notes = NULL;

    if (xdr->mode == JSXDR_ENCODE)
        magic = JSXDR_MAGIC_SCRIPT_CURRENT;
    if (!JS_XDRUint32(xdr, &magic))
        return JS_FALSE;
    if (magic != JSXDR_MAGIC_SCRIPT_CURRENT) {
        /* We do not provide binary compatibility with older scripts. */
        if (!hasMagic) {
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_BAD_SCRIPT_MAGIC);
            return JS_FALSE;
        }
        *hasMagic = JS_FALSE;
        return JS_TRUE;
    }
    if (hasMagic)
        *hasMagic = JS_TRUE;

    if (xdr->mode == JSXDR_ENCODE) {
        length = script->length;
        prologLength = PTRDIFF(script->main, script->code, jsbytecode);
        JS_ASSERT((int16)script->version != JSVERSION_UNKNOWN);
        version = (uint32)script->version | (script->nfixed << 16);
        lineno = (uint32)script->lineno;
        nslots = (uint32)script->nslots;
        nslots = (uint32)((script->staticDepth << 16) | script->nslots);
        natoms = (uint32)script->atomMap.length;

        /* Count the srcnotes, keeping notes pointing at the first one. */
        notes = SCRIPT_NOTES(script);
        for (sn = notes; !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn))
            continue;
        nsrcnotes = PTRDIFF(sn, notes, jssrcnote);
        nsrcnotes++;            /* room for the terminator */

        if (script->objectsOffset != 0)
            nobjects = JS_SCRIPT_OBJECTS(script)->length;
        if (script->upvarsOffset != 0)
            nupvars = JS_SCRIPT_UPVARS(script)->length;
        if (script->regexpsOffset != 0)
            nregexps = JS_SCRIPT_REGEXPS(script)->length;
        if (script->trynotesOffset != 0)
            ntrynotes = JS_SCRIPT_TRYNOTES(script)->length;
    }

    if (!JS_XDRUint32(xdr, &length))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &prologLength))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &version))
        return JS_FALSE;

    /*
     * To fuse allocations, we need srcnote, atom, objects, upvar, regexp,
     * and trynote counts early.
     */
    if (!JS_XDRUint32(xdr, &natoms))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &nsrcnotes))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &ntrynotes))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &nobjects))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &nupvars))
        return JS_FALSE;
    if (!JS_XDRUint32(xdr, &nregexps))
        return JS_FALSE;

    if (xdr->mode == JSXDR_DECODE) {
        script = js_NewScript(cx, length, nsrcnotes, natoms, nobjects, nupvars,
                              nregexps, ntrynotes);
        if (!script)
            return JS_FALSE;

        script->main += prologLength;
        script->version = (JSVersion) (version & 0xffff);
        script->nfixed = (uint16) (version >> 16);

        /* If we know nsrcnotes, we allocated space for notes in script. */
        notes = SCRIPT_NOTES(script);
        *scriptp = script;
        JS_PUSH_TEMP_ROOT_SCRIPT(cx, script, &tvr);
    }

    /*
     * Control hereafter must goto error on failure, in order for the
     * DECODE case to destroy script.
     */
    oldscript = xdr->script;
    code = script->code;
    if (xdr->mode == JSXDR_ENCODE) {
        code = js_UntrapScriptCode(cx, script);
        if (!code)
            goto error;
    }

    xdr->script = script;
    ok = JS_XDRBytes(xdr, (char *) code, length * sizeof(jsbytecode));

    if (code != script->code)
        JS_free(cx, code);

    if (!ok)
        goto error;

    if (!JS_XDRBytes(xdr, (char *)notes, nsrcnotes * sizeof(jssrcnote)) ||
        !JS_XDRCStringOrNull(xdr, (char **)&script->filename) ||
        !JS_XDRUint32(xdr, &lineno) ||
        !JS_XDRUint32(xdr, &nslots)) {
        goto error;
    }

    callbacks = JS_GetSecurityCallbacks(cx);
    if (xdr->mode == JSXDR_ENCODE) {
        principals = script->principals;
        encodeable = callbacks && callbacks->principalsTranscoder;
        if (!JS_XDRUint32(xdr, &encodeable))
            goto error;
        if (encodeable &&
            !callbacks->principalsTranscoder(xdr, &principals)) {
            goto error;
        }
    } else {
        if (!JS_XDRUint32(xdr, &encodeable))
            goto error;
        if (encodeable) {
            if (!(callbacks && callbacks->principalsTranscoder)) {
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_CANT_DECODE_PRINCIPALS);
                goto error;
            }
            if (!callbacks->principalsTranscoder(xdr, &principals))
                goto error;
            script->principals = principals;
        }
    }

    if (xdr->mode == JSXDR_DECODE) {
        const char *filename = script->filename;
        if (filename) {
            filename = js_SaveScriptFilename(cx, filename);
            if (!filename)
                goto error;
            JS_free(cx, (void *) script->filename);
            script->filename = filename;
            filenameWasSaved = JS_TRUE;
        }
        script->lineno = (uintN)lineno;
        script->nslots = (uint16)nslots;
        script->staticDepth = nslots >> 16;
    }

    for (i = 0; i != natoms; ++i) {
        if (!js_XDRAtom(xdr, &script->atomMap.vector[i]))
            goto error;
    }

    /*
     * Here looping from 0-to-length to xdr objects is essential. It ensures
     * that block objects from the script->objects array will be written and
     * restored in the outer-to-inner order. block_xdrObject relies on this to
     * restore the parent chain.
     */
    for (i = 0; i != nobjects; ++i) {
        if (!js_XDRObject(xdr, &JS_SCRIPT_OBJECTS(script)->vector[i]))
            goto error;
    }
    for (i = 0; i != nupvars; ++i) {
        if (!JS_XDRUint32(xdr, &JS_SCRIPT_UPVARS(script)->vector[i]))
            goto error;
    }
    for (i = 0; i != nregexps; ++i) {
        if (!js_XDRObject(xdr, &JS_SCRIPT_REGEXPS(script)->vector[i]))
            goto error;
    }

    if (ntrynotes != 0) {
        /*
         * We combine tn->kind and tn->stackDepth when serializing as XDR is not
         * efficient when serializing small integer types.
         */
        JSTryNote *tn, *tnfirst;
        uint32 kindAndDepth;
        JS_STATIC_ASSERT(sizeof(tn->kind) == sizeof(uint8));
        JS_STATIC_ASSERT(sizeof(tn->stackDepth) == sizeof(uint16));

        tnfirst = JS_SCRIPT_TRYNOTES(script)->vector;
        JS_ASSERT(JS_SCRIPT_TRYNOTES(script)->length == ntrynotes);
        tn = tnfirst + ntrynotes;
        do {
            --tn;
            if (xdr->mode == JSXDR_ENCODE) {
                kindAndDepth = ((uint32)tn->kind << 16)
                               | (uint32)tn->stackDepth;
            }
            if (!JS_XDRUint32(xdr, &kindAndDepth) ||
                !JS_XDRUint32(xdr, &tn->start) ||
                !JS_XDRUint32(xdr, &tn->length)) {
                goto error;
            }
            if (xdr->mode == JSXDR_DECODE) {
                tn->kind = (uint8)(kindAndDepth >> 16);
                tn->stackDepth = (uint16)kindAndDepth;
            }
        } while (tn != tnfirst);
    }

    xdr->script = oldscript;
    if (xdr->mode == JSXDR_DECODE)
        JS_POP_TEMP_ROOT(cx, &tvr);
    return JS_TRUE;

  error:
    if (xdr->mode == JSXDR_DECODE) {
        JS_POP_TEMP_ROOT(cx, &tvr);
        if (script->filename && !filenameWasSaved) {
            JS_free(cx, (void *) script->filename);
            script->filename = NULL;
        }
        js_DestroyScript(cx, script);
        *scriptp = NULL;
    }
    xdr->script = oldscript;
    return JS_FALSE;
}

#if JS_HAS_SCRIPT_OBJECT && JS_HAS_XDR_FREEZE_THAW
/*
 * These cannot be exposed to web content, and chrome does not need them, so
 * we take them out of the Mozilla client altogether.  Fortunately, there is
 * no way to serialize a native function (see fun_xdrObject in jsfun.c).
 */

static JSBool
script_freeze(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    JSXDRState *xdr;
    JSScript *script;
    JSBool ok, hasMagic;
    uint32 len;
    void *buf;
    JSString *str;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, vp + 2))
        return JS_FALSE;
    script = (JSScript *) JS_GetPrivate(cx, obj);
    if (!script)
        return JS_TRUE;

    /* create new XDR */
    xdr = JS_XDRNewMem(cx, JSXDR_ENCODE);
    if (!xdr)
        return JS_FALSE;

    /* write  */
    ok = js_XDRScript(xdr, &script, &hasMagic);
    if (!ok)
        goto out;
    if (!hasMagic) {
        *vp = JSVAL_VOID;
        goto out;
    }

    buf = JS_XDRMemGetData(xdr, &len);
    if (!buf) {
        ok = JS_FALSE;
        goto out;
    }

    JS_ASSERT((jsword)buf % sizeof(jschar) == 0);
    len /= sizeof(jschar);
#if IS_BIG_ENDIAN
  {
    jschar *chars;
    uint32 i;

    /* Swap bytes in Unichars to keep frozen strings machine-independent. */
    chars = (jschar *)buf;
    for (i = 0; i < len; i++)
        chars[i] = JSXDR_SWAB16(chars[i]);
  }
#endif
    str = JS_NewUCStringCopyN(cx, (jschar *)buf, len);
    if (!str) {
        ok = JS_FALSE;
        goto out;
    }

    *vp = STRING_TO_JSVAL(str);

out:
    JS_XDRDestroy(xdr);
    return ok;
}

static JSBool
script_thaw(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    JSXDRState *xdr;
    JSString *str;
    void *buf;
    uint32 len;
    jsval v;
    JSScript *script, *oldscript;
    JSBool ok, hasMagic;
    jsint execDepth;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_ScriptClass, vp + 2))
        return JS_FALSE;

    if (argc == 0)
        return JS_TRUE;
    str = js_ValueToString(cx, vp[2]);
    if (!str)
        return JS_FALSE;
    vp[2] = STRING_TO_JSVAL(str);

    /* create new XDR */
    xdr = JS_XDRNewMem(cx, JSXDR_DECODE);
    if (!xdr)
        return JS_FALSE;

    JSSTRING_CHARS_AND_LENGTH(str, buf, len);
#if IS_BIG_ENDIAN
  {
    jschar *from, *to;
    uint32 i;

    /* Swap bytes in Unichars to keep frozen strings machine-independent. */
    from = (jschar *)buf;
    to = (jschar *) JS_malloc(cx, len * sizeof(jschar));
    if (!to) {
        JS_XDRDestroy(xdr);
        return JS_FALSE;
    }
    for (i = 0; i < len; i++)
        to[i] = JSXDR_SWAB16(from[i]);
    buf = (char *)to;
  }
#endif
    len *= sizeof(jschar);
    JS_XDRMemSetData(xdr, buf, len);

    /* XXXbe should magic mismatch be error, or false return value? */
    ok = js_XDRScript(xdr, &script, &hasMagic);
    if (!ok)
        goto out;
    if (!hasMagic) {
        *vp = JSVAL_FALSE;
        goto out;
    }

    JS_LOCK_OBJ(cx, obj);
    execDepth = GetScriptExecDepth(cx, obj);

    /*
     * execDepth must be 0 to allow compilation here, otherwise the JSScript
     * struct can be released while running.
     */
    if (execDepth > 0) {
        JS_UNLOCK_OBJ(cx, obj);
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_COMPILE_EXECED_SCRIPT);
        goto out;
    }

    /* Swap script for obj's old script, if any. */
    v = LOCKED_OBJ_GET_SLOT(obj, JSSLOT_PRIVATE);
    oldscript = !JSVAL_IS_VOID(v) ? JSVAL_TO_PRIVATE(v) : NULL;
    LOCKED_OBJ_SET_SLOT(obj, JSSLOT_PRIVATE, PRIVATE_TO_JSVAL(script));
    JS_UNLOCK_OBJ(cx, obj);

    if (oldscript)
        js_DestroyScript(cx, oldscript);

    script->u.object = obj;
    js_CallNewScriptHook(cx, script, NULL);

out:
    /*
     * We reset the buffer to be NULL so that it doesn't free the chars
     * memory owned by str (vp[2]).
     */
    JS_XDRMemSetData(xdr, NULL, 0);
    JS_XDRDestroy(xdr);
#if IS_BIG_ENDIAN
    JS_free(cx, buf);
#endif
    *vp = JSVAL_TRUE;
    return ok;
}

static const char js_thaw_str[] = "thaw";

#endif /* JS_HAS_SCRIPT_OBJECT && JS_HAS_XDR_FREEZE_THAW */
#endif /* JS_HAS_XDR */

#if JS_HAS_SCRIPT_OBJECT

static JSFunctionSpec script_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN(js_toSource_str,   script_toSource,   0,0),
#endif
    JS_FN(js_toString_str,   script_toString,   0,0),
    JS_FN("compile",         script_compile,    2,0),
    JS_FN("exec",            script_exec,       1,0),
#if JS_HAS_XDR_FREEZE_THAW
    JS_FN("freeze",          script_freeze,     0,0),
    JS_FN(js_thaw_str,       script_thaw,       1,0),
#endif /* JS_HAS_XDR_FREEZE_THAW */
    JS_FS_END
};

#endif /* JS_HAS_SCRIPT_OBJECT */

static void
script_finalize(JSContext *cx, JSObject *obj)
{
    JSScript *script;

    script = (JSScript *) JS_GetPrivate(cx, obj);
    if (script)
        js_DestroyScript(cx, script);
}

static JSBool
script_call(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
#if JS_HAS_SCRIPT_OBJECT
    return script_exec_sub(cx, JSVAL_TO_OBJECT(argv[-2]), argc, argv, rval);
#else
    return JS_FALSE;
#endif
}

static void
script_trace(JSTracer *trc, JSObject *obj)
{
    JSScript *script;

    script = (JSScript *) JS_GetPrivate(trc->context, obj);
    if (script)
        js_TraceScript(trc, script);
}

#if !JS_HAS_SCRIPT_OBJECT
#define JSProto_Script  JSProto_Object
#endif

JS_FRIEND_DATA(JSClass) js_ScriptClass = {
    js_Script_str,
    JSCLASS_HAS_PRIVATE | JSCLASS_HAS_RESERVED_SLOTS(1) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_Script),
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,   script_finalize,
    NULL,             NULL,             script_call,      NULL,/*XXXbe xdr*/
    NULL,             NULL,             JS_CLASS_TRACE(script_trace), NULL
};

#if JS_HAS_SCRIPT_OBJECT

static JSBool
Script(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    /* If not constructing, replace obj with a new Script object. */
    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        obj = js_NewObject(cx, &js_ScriptClass, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;

        /*
         * script_compile_sub does not use rval to root its temporaries so we
         * can use it to root obj.
         */
        *rval = OBJECT_TO_JSVAL(obj);
    }

    if (!JS_SetReservedSlot(cx, obj, 0, INT_TO_JSVAL(0)))
        return JS_FALSE;

    return script_compile_sub(cx, obj, argc, argv, rval);
}

#if JS_HAS_SCRIPT_OBJECT && JS_HAS_XDR_FREEZE_THAW

static JSBool
script_static_thaw(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = js_NewObject(cx, &js_ScriptClass, NULL, NULL);
    if (!obj)
        return JS_FALSE;
    vp[1] = OBJECT_TO_JSVAL(obj);
    if (!script_thaw(cx, argc, vp))
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSFunctionSpec script_static_methods[] = {
    JS_FN(js_thaw_str,       script_static_thaw,     1,0),
    JS_FS_END
};

#else  /* !JS_HAS_SCRIPT_OBJECT || !JS_HAS_XDR_FREEZE_THAW */

#define script_static_methods   NULL

#endif /* !JS_HAS_SCRIPT_OBJECT || !JS_HAS_XDR_FREEZE_THAW */

JSObject *
js_InitScriptClass(JSContext *cx, JSObject *obj)
{
    return JS_InitClass(cx, obj, NULL, &js_ScriptClass, Script, 1,
                        NULL, script_methods, NULL, script_static_methods);
}

#endif /* JS_HAS_SCRIPT_OBJECT */

/*
 * Shared script filename management.
 */
static int
js_compare_strings(const void *k1, const void *k2)
{
    return strcmp((const char *) k1, (const char *) k2) == 0;
}

/* NB: This struct overlays JSHashEntry -- see jshash.h, do not reorganize. */
typedef struct ScriptFilenameEntry {
    JSHashEntry         *next;          /* hash chain linkage */
    JSHashNumber        keyHash;        /* key hash function result */
    const void          *key;           /* ptr to filename, below */
    uint32              flags;          /* user-defined filename prefix flags */
    JSPackedBool        mark;           /* GC mark flag */
    char                filename[3];    /* two or more bytes, NUL-terminated */
} ScriptFilenameEntry;

static void *
js_alloc_table_space(void *priv, size_t size)
{
    return malloc(size);
}

static void
js_free_table_space(void *priv, void *item)
{
    free(item);
}

static JSHashEntry *
js_alloc_sftbl_entry(void *priv, const void *key)
{
    size_t nbytes = offsetof(ScriptFilenameEntry, filename) +
                    strlen((const char *) key) + 1;

    return (JSHashEntry *) malloc(JS_MAX(nbytes, sizeof(JSHashEntry)));
}

static void
js_free_sftbl_entry(void *priv, JSHashEntry *he, uintN flag)
{
    if (flag != HT_FREE_ENTRY)
        return;
    free(he);
}

static JSHashAllocOps sftbl_alloc_ops = {
    js_alloc_table_space,   js_free_table_space,
    js_alloc_sftbl_entry,   js_free_sftbl_entry
};

JSBool
js_InitRuntimeScriptState(JSRuntime *rt)
{
#ifdef JS_THREADSAFE
    JS_ASSERT(!rt->scriptFilenameTableLock);
    rt->scriptFilenameTableLock = JS_NEW_LOCK();
    if (!rt->scriptFilenameTableLock)
        return JS_FALSE;
#endif
    JS_ASSERT(!rt->scriptFilenameTable);
    rt->scriptFilenameTable =
        JS_NewHashTable(16, JS_HashString, js_compare_strings, NULL,
                        &sftbl_alloc_ops, NULL);
    if (!rt->scriptFilenameTable) {
        js_FinishRuntimeScriptState(rt);    /* free lock if threadsafe */
        return JS_FALSE;
    }
    JS_INIT_CLIST(&rt->scriptFilenamePrefixes);
    return JS_TRUE;
}

typedef struct ScriptFilenamePrefix {
    JSCList     links;      /* circular list linkage for easy deletion */
    const char  *name;      /* pointer to pinned ScriptFilenameEntry string */
    size_t      length;     /* prefix string length, precomputed */
    uint32      flags;      /* user-defined flags to inherit from this prefix */
} ScriptFilenamePrefix;

void
js_FinishRuntimeScriptState(JSRuntime *rt)
{
    if (rt->scriptFilenameTable) {
        JS_HashTableDestroy(rt->scriptFilenameTable);
        rt->scriptFilenameTable = NULL;
    }
#ifdef JS_THREADSAFE
    if (rt->scriptFilenameTableLock) {
        JS_DESTROY_LOCK(rt->scriptFilenameTableLock);
        rt->scriptFilenameTableLock = NULL;
    }
#endif
}

void
js_FreeRuntimeScriptState(JSRuntime *rt)
{
    ScriptFilenamePrefix *sfp;

    if (!rt->scriptFilenameTable)
        return;

    while (!JS_CLIST_IS_EMPTY(&rt->scriptFilenamePrefixes)) {
        sfp = (ScriptFilenamePrefix *) rt->scriptFilenamePrefixes.next;
        JS_REMOVE_LINK(&sfp->links);
        free(sfp);
    }
    js_FinishRuntimeScriptState(rt);
}

#ifdef DEBUG_brendan
#define DEBUG_SFTBL
#endif
#ifdef DEBUG_SFTBL
size_t sftbl_savings = 0;
#endif

static ScriptFilenameEntry *
SaveScriptFilename(JSRuntime *rt, const char *filename, uint32 flags)
{
    JSHashTable *table;
    JSHashNumber hash;
    JSHashEntry **hep;
    ScriptFilenameEntry *sfe;
    size_t length;
    JSCList *head, *link;
    ScriptFilenamePrefix *sfp;

    table = rt->scriptFilenameTable;
    hash = JS_HashString(filename);
    hep = JS_HashTableRawLookup(table, hash, filename);
    sfe = (ScriptFilenameEntry *) *hep;
#ifdef DEBUG_SFTBL
    if (sfe)
        sftbl_savings += strlen(sfe->filename);
#endif

    if (!sfe) {
        sfe = (ScriptFilenameEntry *)
              JS_HashTableRawAdd(table, hep, hash, filename, NULL);
        if (!sfe)
            return NULL;
        sfe->key = strcpy(sfe->filename, filename);
        sfe->flags = 0;
        sfe->mark = JS_FALSE;
    }

    /* If saving a prefix, add it to the set in rt->scriptFilenamePrefixes. */
    if (flags != 0) {
        /* Search in case filename was saved already; we must be idempotent. */
        sfp = NULL;
        length = strlen(filename);
        for (head = link = &rt->scriptFilenamePrefixes;
             link->next != head;
             link = link->next) {
            /* Lag link behind sfp to insert in non-increasing length order. */
            sfp = (ScriptFilenamePrefix *) link->next;
            if (!strcmp(sfp->name, filename))
                break;
            if (sfp->length <= length) {
                sfp = NULL;
                break;
            }
            sfp = NULL;
        }

        if (!sfp) {
            /* No such prefix: add one now. */
            sfp = (ScriptFilenamePrefix *) malloc(sizeof(ScriptFilenamePrefix));
            if (!sfp)
                return NULL;
            JS_INSERT_AFTER(&sfp->links, link);
            sfp->name = sfe->filename;
            sfp->length = length;
            sfp->flags = 0;
        }

        /*
         * Accumulate flags in both sfe and sfp: sfe for later access from the
         * JS_GetScriptedCallerFilenameFlags debug-API, and sfp so that longer
         * filename entries can inherit by prefix.
         */
        sfe->flags |= flags;
        sfp->flags |= flags;
    }

    return sfe;
}

const char *
js_SaveScriptFilename(JSContext *cx, const char *filename)
{
    JSRuntime *rt;
    ScriptFilenameEntry *sfe;
    JSCList *head, *link;
    ScriptFilenamePrefix *sfp;

    rt = cx->runtime;
    JS_ACQUIRE_LOCK(rt->scriptFilenameTableLock);
    sfe = SaveScriptFilename(rt, filename, 0);
    if (!sfe) {
        JS_RELEASE_LOCK(rt->scriptFilenameTableLock);
        JS_ReportOutOfMemory(cx);
        return NULL;
    }

    /*
     * Try to inherit flags by prefix.  We assume there won't be more than a
     * few (dozen! ;-) prefixes, so linear search is tolerable.
     * XXXbe every time I've assumed that in the JS engine, I've been wrong!
     */
    for (head = &rt->scriptFilenamePrefixes, link = head->next;
         link != head;
         link = link->next) {
        sfp = (ScriptFilenamePrefix *) link;
        if (!strncmp(sfp->name, filename, sfp->length)) {
            sfe->flags |= sfp->flags;
            break;
        }
    }
    JS_RELEASE_LOCK(rt->scriptFilenameTableLock);
    return sfe->filename;
}

const char *
js_SaveScriptFilenameRT(JSRuntime *rt, const char *filename, uint32 flags)
{
    ScriptFilenameEntry *sfe;

    /* This may be called very early, via the jsdbgapi.h entry point. */
    if (!rt->scriptFilenameTable && !js_InitRuntimeScriptState(rt))
        return NULL;

    JS_ACQUIRE_LOCK(rt->scriptFilenameTableLock);
    sfe = SaveScriptFilename(rt, filename, flags);
    JS_RELEASE_LOCK(rt->scriptFilenameTableLock);
    if (!sfe)
        return NULL;

    return sfe->filename;
}

/*
 * Back up from a saved filename by its offset within its hash table entry.
 */
#define FILENAME_TO_SFE(fn) \
    ((ScriptFilenameEntry *) ((fn) - offsetof(ScriptFilenameEntry, filename)))

/*
 * The sfe->key member, redundant given sfe->filename but required by the old
 * jshash.c code, here gives us a useful sanity check.  This assertion will
 * very likely botch if someone tries to mark a string that wasn't allocated
 * as an sfe->filename.
 */
#define ASSERT_VALID_SFE(sfe)   JS_ASSERT((sfe)->key == (sfe)->filename)

uint32
js_GetScriptFilenameFlags(const char *filename)
{
    ScriptFilenameEntry *sfe;

    sfe = FILENAME_TO_SFE(filename);
    ASSERT_VALID_SFE(sfe);
    return sfe->flags;
}

void
js_MarkScriptFilename(const char *filename)
{
    ScriptFilenameEntry *sfe;

    sfe = FILENAME_TO_SFE(filename);
    ASSERT_VALID_SFE(sfe);
    sfe->mark = JS_TRUE;
}

static intN
js_script_filename_marker(JSHashEntry *he, intN i, void *arg)
{
    ScriptFilenameEntry *sfe = (ScriptFilenameEntry *) he;

    sfe->mark = JS_TRUE;
    return HT_ENUMERATE_NEXT;
}

void
js_MarkScriptFilenames(JSRuntime *rt, JSBool keepAtoms)
{
    JSCList *head, *link;
    ScriptFilenamePrefix *sfp;

    if (!rt->scriptFilenameTable)
        return;

    if (keepAtoms) {
        JS_HashTableEnumerateEntries(rt->scriptFilenameTable,
                                     js_script_filename_marker,
                                     rt);
    }
    for (head = &rt->scriptFilenamePrefixes, link = head->next;
         link != head;
         link = link->next) {
        sfp = (ScriptFilenamePrefix *) link;
        js_MarkScriptFilename(sfp->name);
    }
}

static intN
js_script_filename_sweeper(JSHashEntry *he, intN i, void *arg)
{
    ScriptFilenameEntry *sfe = (ScriptFilenameEntry *) he;

    if (!sfe->mark)
        return HT_ENUMERATE_REMOVE;
    sfe->mark = JS_FALSE;
    return HT_ENUMERATE_NEXT;
}

void
js_SweepScriptFilenames(JSRuntime *rt)
{
    if (!rt->scriptFilenameTable)
        return;

    JS_HashTableEnumerateEntries(rt->scriptFilenameTable,
                                 js_script_filename_sweeper,
                                 rt);
#ifdef DEBUG_notme
#ifdef DEBUG_SFTBL
    printf("script filename table savings so far: %u\n", sftbl_savings);
#endif
#endif
}

/*
 * JSScript data structures memory alignment:
 *
 * JSScript
 * JSObjectArray    script objects' descriptor if JSScript.objectsOffset != 0,
 *                    use JS_SCRIPT_OBJECTS(script) macro to access it.
 * JSObjectArray    script regexps' descriptor if JSScript.regexpsOffset != 0,
 *                    use JS_SCRIPT_REGEXPS(script) macro to access it.
 * JSTryNoteArray   script try notes' descriptor if JSScript.tryNotesOffset
 *                    != 0, use JS_SCRIPT_TRYNOTES(script) macro to access it.
 * JSAtom *a[]      array of JSScript.atomMap.length atoms pointed by
 *                    JSScript.atomMap.vector if any.
 * JSObject *o[]    array of JS_SCRIPT_OBJECTS(script)->length objects if any
 *                    pointed by JS_SCRIPT_OBJECTS(script)->vector.
 * JSObject *r[]    array of JS_SCRIPT_REGEXPS(script)->length regexps if any
 *                    pointed by JS_SCRIPT_REGEXPS(script)->vector.
 * JSTryNote t[]    array of JS_SCRIPT_TRYNOTES(script)->length try notes if any
 *                    pointed by JS_SCRIPT_TRYNOTES(script)->vector.
 * jsbytecode b[]   script bytecode pointed by JSScript.code.
 * jssrcnote  s[]   script source notes, use SCRIPT_NOTES(script) to access it
 *
 * The alignment avoids gaps between entries as alignment requirement for each
 * subsequent structure or array is the same or divides the alignment
 * requirement for the previous one.
 *
 * The followings asserts checks that assuming that the alignment requirement
 * for JSObjectArray and JSTryNoteArray are sizeof(void *) and for JSTryNote
 * it is sizeof(uint32) as the structure consists of 3 uint32 fields.
 */
JS_STATIC_ASSERT(sizeof(JSScript) % sizeof(void *) == 0);
JS_STATIC_ASSERT(sizeof(JSObjectArray) % sizeof(void *) == 0);
JS_STATIC_ASSERT(sizeof(JSTryNoteArray) == sizeof(JSObjectArray));
JS_STATIC_ASSERT(sizeof(JSAtom *) == sizeof(JSObject *));
JS_STATIC_ASSERT(sizeof(JSObject *) % sizeof(uint32) == 0);
JS_STATIC_ASSERT(sizeof(JSTryNote) == 3 * sizeof(uint32));
JS_STATIC_ASSERT(sizeof(uint32) % sizeof(jsbytecode) == 0);
JS_STATIC_ASSERT(sizeof(jsbytecode) % sizeof(jssrcnote) == 0);

/*
 * Check that uint8 offset for object, upvar, regexp, and try note arrays is
 * sufficient.
 */
JS_STATIC_ASSERT(sizeof(JSScript) + 2 * sizeof(JSObjectArray) +
                 sizeof(JSUpvarArray) < JS_BIT(8));

JSScript *
js_NewScript(JSContext *cx, uint32 length, uint32 nsrcnotes, uint32 natoms,
             uint32 nobjects, uint32 nupvars, uint32 nregexps,
             uint32 ntrynotes)
{
    size_t size, vectorSize;
    JSScript *script;
    uint8 *cursor;

    size = sizeof(JSScript) +
           sizeof(JSAtom *) * natoms +
           length * sizeof(jsbytecode) +
           nsrcnotes * sizeof(jssrcnote);
    if (nobjects != 0)
        size += sizeof(JSObjectArray) + nobjects * sizeof(JSObject *);
    if (nupvars != 0)
        size += sizeof(JSUpvarArray) + nupvars * sizeof(uint32);
    if (nregexps != 0)
        size += sizeof(JSObjectArray) + nregexps * sizeof(JSObject *);
    if (ntrynotes != 0)
        size += sizeof(JSTryNoteArray) + ntrynotes * sizeof(JSTryNote);

    script = (JSScript *) JS_malloc(cx, size);
    if (!script)
        return NULL;
    memset(script, 0, sizeof(JSScript));
    script->length = length;
    script->version = cx->version;

    cursor = (uint8 *)script + sizeof(JSScript);
    if (nobjects != 0) {
        script->objectsOffset = (uint8)(cursor - (uint8 *)script);
        cursor += sizeof(JSObjectArray);
    }
    if (nupvars != 0) {
        script->upvarsOffset = (uint8)(cursor - (uint8 *)script);
        cursor += sizeof(JSUpvarArray);
    }
    if (nregexps != 0) {
        script->regexpsOffset = (uint8)(cursor - (uint8 *)script);
        cursor += sizeof(JSObjectArray);
    }
    if (ntrynotes != 0) {
        script->trynotesOffset = (uint8)(cursor - (uint8 *)script);
        cursor += sizeof(JSTryNoteArray);
    }

    if (natoms != 0) {
        script->atomMap.length = natoms;
        script->atomMap.vector = (JSAtom **)cursor;
        vectorSize = natoms * sizeof(script->atomMap.vector[0]);

        /*
         * Clear object map's vector so the GC tracing can run when not yet
         * all atoms are copied to the array.
         */
        memset(cursor, 0, vectorSize);
        cursor += vectorSize;
    }

    if (nobjects != 0) {
        JS_SCRIPT_OBJECTS(script)->length = nobjects;
        JS_SCRIPT_OBJECTS(script)->vector = (JSObject **)cursor;
        vectorSize = nobjects * sizeof(JS_SCRIPT_OBJECTS(script)->vector[0]);
        memset(cursor, 0, vectorSize);
        cursor += vectorSize;
    }

    if (nupvars != 0) {
        JS_SCRIPT_UPVARS(script)->length = nupvars;
        JS_SCRIPT_UPVARS(script)->vector = (uint32 *)cursor;
        vectorSize = nupvars * sizeof(JS_SCRIPT_UPVARS(script)->vector[0]);
        memset(cursor, 0, vectorSize);
        cursor += vectorSize;
    }

    if (nregexps != 0) {
        JS_SCRIPT_REGEXPS(script)->length = nregexps;
        JS_SCRIPT_REGEXPS(script)->vector = (JSObject **)cursor;
        vectorSize = nregexps * sizeof(JS_SCRIPT_REGEXPS(script)->vector[0]);
        memset(cursor, 0, vectorSize);
        cursor += vectorSize;
    }

    if (ntrynotes != 0) {
        JS_SCRIPT_TRYNOTES(script)->length = ntrynotes;
        JS_SCRIPT_TRYNOTES(script)->vector = (JSTryNote *)cursor;
        vectorSize = ntrynotes * sizeof(JS_SCRIPT_TRYNOTES(script)->vector[0]);
#ifdef DEBUG
        memset(cursor, 0, vectorSize);
#endif
        cursor += vectorSize;
    }

    script->code = script->main = (jsbytecode *)cursor;
    JS_ASSERT(cursor +
              length * sizeof(jsbytecode) +
              nsrcnotes * sizeof(jssrcnote) ==
              (uint8 *)script + size);

#ifdef CHECK_SCRIPT_OWNER
    script->owner = cx->thread;
#endif
    return script;
}

JSScript *
js_NewScriptFromCG(JSContext *cx, JSCodeGenerator *cg)
{
    uint32 mainLength, prologLength, nsrcnotes, nfixed;
    JSScript *script;
    const char *filename;
    JSFunction *fun;

    /* The counts of indexed things must be checked during code generation. */
    JS_ASSERT(cg->atomList.count <= INDEX_LIMIT);
    JS_ASSERT(cg->objectList.length <= INDEX_LIMIT);
    JS_ASSERT(cg->regexpList.length <= INDEX_LIMIT);

    mainLength = CG_OFFSET(cg);
    prologLength = CG_PROLOG_OFFSET(cg);
    CG_COUNT_FINAL_SRCNOTES(cg, nsrcnotes);
    script = js_NewScript(cx, prologLength + mainLength, nsrcnotes,
                          cg->atomList.count, cg->objectList.length,
                          cg->upvarList.count, cg->regexpList.length,
                          cg->ntrynotes);
    if (!script)
        return NULL;

    /* Now that we have script, error control flow must go to label bad. */
    script->main += prologLength;
    memcpy(script->code, CG_PROLOG_BASE(cg), prologLength * sizeof(jsbytecode));
    memcpy(script->main, CG_BASE(cg), mainLength * sizeof(jsbytecode));
    nfixed = (cg->treeContext.flags & TCF_IN_FUNCTION)
             ? cg->treeContext.u.fun->u.i.nvars
             : cg->treeContext.ngvars + cg->regexpList.length;
    JS_ASSERT(nfixed < SLOTNO_LIMIT);
    script->nfixed = (uint16) nfixed;
    js_InitAtomMap(cx, &script->atomMap, &cg->atomList);

    filename = cg->treeContext.parseContext->tokenStream.filename;
    if (filename) {
        script->filename = js_SaveScriptFilename(cx, filename);
        if (!script->filename)
            goto bad;
    }
    script->lineno = cg->firstLine;
    if (script->nfixed + cg->maxStackDepth >= JS_BIT(16)) {
        js_ReportCompileErrorNumber(cx, CG_TS(cg), NULL, JSREPORT_ERROR,
                                    JSMSG_NEED_DIET, "script");
        goto bad;
    }
    script->nslots = script->nfixed + cg->maxStackDepth;
    script->staticDepth = cg->staticDepth;
    script->principals = cg->treeContext.parseContext->principals;
    if (script->principals)
        JSPRINCIPALS_HOLD(cx, script->principals);

    if (!js_FinishTakingSrcNotes(cx, cg, SCRIPT_NOTES(script)))
        goto bad;
    if (cg->ntrynotes != 0)
        js_FinishTakingTryNotes(cg, JS_SCRIPT_TRYNOTES(script));
    if (cg->objectList.length != 0)
        FinishParsedObjects(&cg->objectList, JS_SCRIPT_OBJECTS(script));
    if (cg->regexpList.length != 0)
        FinishParsedObjects(&cg->regexpList, JS_SCRIPT_REGEXPS(script));
    if (cg->treeContext.flags & TCF_NO_SCRIPT_RVAL)
        script->flags |= JSSF_NO_SCRIPT_RVAL;

    if (cg->upvarList.count != 0) {
        JS_ASSERT(cg->upvarList.count <= cg->upvarMap.length);
        memcpy(JS_SCRIPT_UPVARS(script)->vector, cg->upvarMap.vector,
               cg->upvarList.count * sizeof(uint32));
        ATOM_LIST_INIT(&cg->upvarList);
        JS_free(cx, cg->upvarMap.vector);
        cg->upvarMap.vector = NULL;
    }

    /*
     * We initialize fun->u.script to be the script constructed above
     * so that the debugger has a valid FUN_SCRIPT(fun).
     */
    fun = NULL;
    if (cg->treeContext.flags & TCF_IN_FUNCTION) {
        fun = cg->treeContext.u.fun;
        JS_ASSERT(FUN_INTERPRETED(fun) && !FUN_SCRIPT(fun));
        JS_ASSERT_IF(script->upvarsOffset != 0,
                     JS_SCRIPT_UPVARS(script)->length == fun->u.i.nupvars);

        js_FreezeLocalNames(cx, fun);
        fun->u.i.script = script;
#ifdef CHECK_SCRIPT_OWNER
        script->owner = NULL;
#endif
        if (cg->treeContext.flags & TCF_FUN_HEAVYWEIGHT)
            fun->flags |= JSFUN_HEAVYWEIGHT;
    }

    /* Tell the debugger about this compiled script. */
    js_CallNewScriptHook(cx, script, fun);
    return script;

bad:
    js_DestroyScript(cx, script);
    return NULL;
}

JS_FRIEND_API(void)
js_CallNewScriptHook(JSContext *cx, JSScript *script, JSFunction *fun)
{
    JSNewScriptHook hook;

    hook = cx->debugHooks->newScriptHook;
    if (hook) {
        JS_KEEP_ATOMS(cx->runtime);
        hook(cx, script->filename, script->lineno, script, fun,
             cx->debugHooks->newScriptHookData);
        JS_UNKEEP_ATOMS(cx->runtime);
    }
}

JS_FRIEND_API(void)
js_CallDestroyScriptHook(JSContext *cx, JSScript *script)
{
    JSDestroyScriptHook hook;

    hook = cx->debugHooks->destroyScriptHook;
    if (hook)
        hook(cx, script, cx->debugHooks->destroyScriptHookData);
}

void
js_DestroyScript(JSContext *cx, JSScript *script)
{
    js_CallDestroyScriptHook(cx, script);
    JS_ClearScriptTraps(cx, script);

    if (script->principals)
        JSPRINCIPALS_DROP(cx, script->principals);

    if (JS_GSN_CACHE(cx).code == script->code)
        JS_CLEAR_GSN_CACHE(cx);

    /*
     * The GC flushes all property caches, so no need to purge just the
     * entries for this script.
     *
     * JS_THREADSAFE note: js_FlushPropertyCacheForScript flushes only the
     * current thread's property cache, so a script not owned by a function
     * or object, which hands off lifetime management for that script to the
     * GC, must be used by only one thread over its lifetime.
     *
     * This should be an API-compatible change, since a script is never safe
     * against premature GC if shared among threads without a rooted object
     * wrapping it to protect the script's mapped atoms against GC. We use
     * script->owner to enforce this requirement via assertions.
     */
#ifdef CHECK_SCRIPT_OWNER
    JS_ASSERT_IF(cx->runtime->gcRunning, !script->owner);
#endif

    if (!cx->runtime->gcRunning) {
        if (!(cx->fp && (cx->fp->flags & JSFRAME_EVAL))) {
#ifdef CHECK_SCRIPT_OWNER
            JS_ASSERT(script->owner == cx->thread);
#endif
            js_FlushPropertyCacheForScript(cx, script);
        }
    }

    JS_free(cx, script);
}

void
js_TraceScript(JSTracer *trc, JSScript *script)
{
    JSAtomMap *map;
    uintN i, length;
    JSAtom **vector;
    jsval v;
    JSObjectArray *objarray;

    map = &script->atomMap;
    length = map->length;
    vector = map->vector;
    for (i = 0; i < length; i++) {
        v = ATOM_KEY(vector[i]);
        if (JSVAL_IS_TRACEABLE(v)) {
            JS_SET_TRACING_INDEX(trc, "atomMap", i);
            JS_CallTracer(trc, JSVAL_TO_TRACEABLE(v), JSVAL_TRACE_KIND(v));
        }
    }

    if (script->objectsOffset != 0) {
        objarray = JS_SCRIPT_OBJECTS(script);
        i = objarray->length;
        do {
            --i;
            if (objarray->vector[i]) {
                JS_SET_TRACING_INDEX(trc, "objects", i);
                JS_CallTracer(trc, objarray->vector[i], JSTRACE_OBJECT);
            }
        } while (i != 0);
    }

    if (script->regexpsOffset != 0) {
        objarray = JS_SCRIPT_REGEXPS(script);
        i = objarray->length;
        do {
            --i;
            if (objarray->vector[i]) {
                JS_SET_TRACING_INDEX(trc, "regexps", i);
                JS_CallTracer(trc, objarray->vector[i], JSTRACE_OBJECT);
            }
        } while (i != 0);
    }

    if (script->u.object) {
        JS_SET_TRACING_NAME(trc, "object");
        JS_CallTracer(trc, script->u.object, JSTRACE_OBJECT);
    }

    if (IS_GC_MARKING_TRACER(trc) && script->filename)
        js_MarkScriptFilename(script->filename);
}

typedef struct GSNCacheEntry {
    JSDHashEntryHdr     hdr;
    jsbytecode          *pc;
    jssrcnote           *sn;
} GSNCacheEntry;

#define GSN_CACHE_THRESHOLD     100

jssrcnote *
js_GetSrcNoteCached(JSContext *cx, JSScript *script, jsbytecode *pc)
{
    ptrdiff_t target, offset;
    GSNCacheEntry *entry;
    jssrcnote *sn, *result;
    uintN nsrcnotes;


    target = PTRDIFF(pc, script->code, jsbytecode);
    if ((uint32)target >= script->length)
        return NULL;

    if (JS_GSN_CACHE(cx).code == script->code) {
        JS_METER_GSN_CACHE(cx, hits);
        entry = (GSNCacheEntry *)
                JS_DHashTableOperate(&JS_GSN_CACHE(cx).table, pc,
                                     JS_DHASH_LOOKUP);
        return entry->sn;
    }

    JS_METER_GSN_CACHE(cx, misses);
    offset = 0;
    for (sn = SCRIPT_NOTES(script); ; sn = SN_NEXT(sn)) {
        if (SN_IS_TERMINATOR(sn)) {
            result = NULL;
            break;
        }
        offset += SN_DELTA(sn);
        if (offset == target && SN_IS_GETTABLE(sn)) {
            result = sn;
            break;
        }
    }

    if (JS_GSN_CACHE(cx).code != script->code &&
        script->length >= GSN_CACHE_THRESHOLD) {
        JS_CLEAR_GSN_CACHE(cx);
        nsrcnotes = 0;
        for (sn = SCRIPT_NOTES(script); !SN_IS_TERMINATOR(sn);
             sn = SN_NEXT(sn)) {
            if (SN_IS_GETTABLE(sn))
                ++nsrcnotes;
        }
        if (!JS_DHashTableInit(&JS_GSN_CACHE(cx).table, JS_DHashGetStubOps(),
                               NULL, sizeof(GSNCacheEntry),
                               JS_DHASH_DEFAULT_CAPACITY(nsrcnotes))) {
            JS_GSN_CACHE(cx).table.ops = NULL;
        } else {
            pc = script->code;
            for (sn = SCRIPT_NOTES(script); !SN_IS_TERMINATOR(sn);
                 sn = SN_NEXT(sn)) {
                pc += SN_DELTA(sn);
                if (SN_IS_GETTABLE(sn)) {
                    entry = (GSNCacheEntry *)
                            JS_DHashTableOperate(&JS_GSN_CACHE(cx).table, pc,
                                                 JS_DHASH_ADD);
                    entry->pc = pc;
                    entry->sn = sn;
                }
            }
            JS_GSN_CACHE(cx).code = script->code;
            JS_METER_GSN_CACHE(cx, fills);
        }
    }

    return result;
}

uintN
js_FramePCToLineNumber(JSContext *cx, JSStackFrame *fp)
{
    return js_PCToLineNumber(cx, fp->script, fp->imacpc ? fp->imacpc : fp->regs->pc);
}

uintN
js_PCToLineNumber(JSContext *cx, JSScript *script, jsbytecode *pc)
{
    JSFunction *fun;
    uintN lineno;
    ptrdiff_t offset, target;
    jssrcnote *sn;
    JSSrcNoteType type;

    /* Cope with JSStackFrame.pc value prior to entering js_Interpret. */
    if (!pc)
        return 0;

    /*
     * Special case: function definition needs no line number note because
     * the function's script contains its starting line number.
     */
    if (js_CodeSpec[*pc].format & JOF_INDEXBASE)
        pc += js_CodeSpec[*pc].length;
    if (*pc == JSOP_DEFFUN) {
        GET_FUNCTION_FROM_BYTECODE(script, pc, 0, fun);
        return fun->u.i.script->lineno;
    }

    /*
     * General case: walk through source notes accumulating their deltas,
     * keeping track of line-number notes, until we pass the note for pc's
     * offset within script->code.
     */
    lineno = script->lineno;
    offset = 0;
    target = PTRDIFF(pc, script->code, jsbytecode);
    for (sn = SCRIPT_NOTES(script); !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn)) {
        offset += SN_DELTA(sn);
        type = (JSSrcNoteType) SN_TYPE(sn);
        if (type == SRC_SETLINE) {
            if (offset <= target)
                lineno = (uintN) js_GetSrcNoteOffset(sn, 0);
        } else if (type == SRC_NEWLINE) {
            if (offset <= target)
                lineno++;
        }
        if (offset > target)
            break;
    }
    return lineno;
}

/* The line number limit is the same as the jssrcnote offset limit. */
#define SN_LINE_LIMIT   (SN_3BYTE_OFFSET_FLAG << 16)

jsbytecode *
js_LineNumberToPC(JSScript *script, uintN target)
{
    ptrdiff_t offset, best;
    uintN lineno, bestdiff, diff;
    jssrcnote *sn;
    JSSrcNoteType type;

    offset = 0;
    best = -1;
    lineno = script->lineno;
    bestdiff = SN_LINE_LIMIT;
    for (sn = SCRIPT_NOTES(script); !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn)) {
        /*
         * Exact-match only if offset is not in the prolog; otherwise use
         * nearest greater-or-equal line number match.
         */
        if (lineno == target && script->code + offset >= script->main)
            goto out;
        if (lineno >= target) {
            diff = lineno - target;
            if (diff < bestdiff) {
                bestdiff = diff;
                best = offset;
            }
        }
        offset += SN_DELTA(sn);
        type = (JSSrcNoteType) SN_TYPE(sn);
        if (type == SRC_SETLINE) {
            lineno = (uintN) js_GetSrcNoteOffset(sn, 0);
        } else if (type == SRC_NEWLINE) {
            lineno++;
        }
    }
    if (best >= 0)
        offset = best;
out:
    return script->code + offset;
}

JS_FRIEND_API(uintN)
js_GetScriptLineExtent(JSScript *script)
{
    uintN lineno;
    jssrcnote *sn;
    JSSrcNoteType type;

    lineno = script->lineno;
    for (sn = SCRIPT_NOTES(script); !SN_IS_TERMINATOR(sn); sn = SN_NEXT(sn)) {
        type = (JSSrcNoteType) SN_TYPE(sn);
        if (type == SRC_SETLINE) {
            lineno = (uintN) js_GetSrcNoteOffset(sn, 0);
        } else if (type == SRC_NEWLINE) {
            lineno++;
        }
    }
    return 1 + lineno - script->lineno;
}

#if JS_HAS_GENERATORS

JSBool
js_IsInsideTryWithFinally(JSScript *script, jsbytecode *pc)
{
    JSTryNoteArray *tarray;
    JSTryNote *tn, *tnlimit;
    uint32 off;

    JS_ASSERT(script->code <= pc);
    JS_ASSERT(pc < script->code + script->length);

    if (!script->trynotesOffset != 0)
        return JS_FALSE;
    tarray = JS_SCRIPT_TRYNOTES(script);
    JS_ASSERT(tarray->length != 0);

    tn = tarray->vector;
    tnlimit = tn + tarray->length;
    off = (uint32)(pc - script->main);
    do {
        if (off - tn->start < tn->length) {
            if (tn->kind == JSTRY_FINALLY)
                return JS_TRUE;
            JS_ASSERT(tn->kind == JSTRY_CATCH);
        }
    } while (++tn != tnlimit);
    return JS_FALSE;
}

#endif
