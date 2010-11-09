/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=80:
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
 * Copyright (C) 2007  Sun Microsystems, Inc. All Rights Reserved.
 *
 * Contributor(s):
 *      Brendan Eich <brendan@mozilla.org>
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

#include "jsapi.h"
#include "jsutil.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsdbgapi.h"
#include "jsfun.h"
#include "jsinterp.h"
#include "jsobj.h"
#include "jsscript.h"
#include "jsstr.h"

#include "jsdtracef.h"
#include <sys/types.h>

#define TYPEOF(cx,v)    (JSVAL_IS_NULL(v) ? JSTYPE_NULL : JS_TypeOfValue(cx,v))

static char dempty[] = "<null>";

char *
jsdtrace_funcclass_name(JSFunction *fun)
{
    return (!FUN_INTERPRETED(fun) &&
            !(fun->flags & JSFUN_TRACEABLE) &&
            FUN_CLASP(fun))
           ? (char *)FUN_CLASP(fun)->name
           : dempty;
}

char *
jsdtrace_filename(JSStackFrame *fp)
{
    while (fp && fp->script == NULL)
        fp = fp->down;
    return (fp && fp->script && fp->script->filename)
           ? (char *)fp->script->filename
           : dempty;
}

int
jsdtrace_linenumber(JSContext *cx, JSStackFrame *fp)
{
    while (fp && fp->script == NULL)
        fp = fp->down;
    return (fp && fp->regs)
           ? (int) js_PCToLineNumber(cx, fp->script, fp->regs->pc)
           : -1;
}

/*
 * This function is used to convert function arguments and return value (jsval)
 * into the following based on each value's type tag:
 *
 *      jsval      returned
 *      -------------------
 *      STRING  -> char *
 *      INT     -> int
 *      DOUBLE  -> double *
 *      BOOLEAN -> int
 *      OBJECT  -> void *
 *
 * All are presented as void * for DTrace consumers to use, after shifting or
 * masking out the JavaScript type bits. This allows D scripts to use ints and
 * booleans directly and copyinstr() for string arguments, when types are known
 * beforehand.
 *
 * This is used by the function-args and function-rval probes, which also
 * provide raw (unmasked) jsvals should type info be useful from D scripts.
 */
void *
jsdtrace_jsvaltovoid(JSContext *cx, jsval argval)
{
    JSType type = TYPEOF(cx, argval);

    switch (type) {
      case JSTYPE_NULL:
      case JSTYPE_VOID:
        return (void *)JS_TYPE_STR(type);

      case JSTYPE_BOOLEAN:
        return (void *)JSVAL_TO_BOOLEAN(argval);

      case JSTYPE_STRING:
        return (void *)js_GetStringBytes(cx, JSVAL_TO_STRING(argval));

      case JSTYPE_NUMBER:
        if (JSVAL_IS_INT(argval))
            return (void *)JSVAL_TO_INT(argval);
        return JSVAL_TO_DOUBLE(argval);

      default:
        return JSVAL_TO_GCTHING(argval);
    }
    /* NOTREACHED */
}

char *
jsdtrace_function_name(JSContext *cx, JSStackFrame *fp, JSFunction *fun)
{
    JSAtom *atom;
    JSFrameRegs *regs;
    JSScript *script;
    jsbytecode *pc;
    char *name;

    atom = fun->atom;
    if (!atom) {
        if (fp->fun != fun || !fp->down)
            return dempty;

        regs = fp->down->regs;
        if (!regs)
            return dempty;

        /*
         * An anonymous function called from an active script or interpreted
         * function: try to fetch the variable or property name by which the
         * anonymous function was invoked.
         */
        pc = regs->pc;
        script = fp->down->script;
        switch ((JSOp) *pc) {
          case JSOP_CALL:
          case JSOP_EVAL:
            JS_ASSERT(fp->argv == regs->sp - (int)GET_ARGC(pc));

            /*
             * FIXME bug 422864: update this code to use the pc stack from the
             * decompiler.
             */
            break;
          default: ;
        }

        switch ((JSOp) *pc) {
          case JSOP_CALLNAME:
          case JSOP_CALLPROP:
          case JSOP_NAME:
          case JSOP_SETNAME:
          case JSOP_GETPROP:
          case JSOP_SETPROP:
            GET_ATOM_FROM_BYTECODE(script, pc, 0, atom);
            break;

          case JSOP_CALLELEM:
          case JSOP_GETELEM:
          case JSOP_SETELEM:
          case JSOP_CALLGVAR:
          case JSOP_GETGVAR:
          case JSOP_SETGVAR:
          case JSOP_CALLARG:
          case JSOP_CALLLOCAL:
            /* FIXME: try to recover a name from these ops. */
            /* FALL THROUGH */

          default:
            return dempty;
        }
    }

    name = (char *)js_GetStringBytes(cx, ATOM_TO_STRING(atom));
    return name ? name : dempty;
}

/*
 * These functions call the DTrace macros for the JavaScript USDT probes.
 * Originally this code was inlined in the JavaScript code; however since
 * a number of operations are called, these have been placed into functions
 * to reduce any negative compiler optimization effect that the addition of
 * a number of usually unused lines of code would cause.
 */
void
jsdtrace_function_entry(JSContext *cx, JSStackFrame *fp, JSFunction *fun)
{
    JAVASCRIPT_FUNCTION_ENTRY(
        jsdtrace_filename(fp),
        jsdtrace_funcclass_name(fun),
        jsdtrace_function_name(cx, fp, fun)
    );
}

void
jsdtrace_function_info(JSContext *cx, JSStackFrame *fp, JSStackFrame *dfp,
                       JSFunction *fun)
{
    JAVASCRIPT_FUNCTION_INFO(
        jsdtrace_filename(fp),
        jsdtrace_funcclass_name(fun),
        jsdtrace_function_name(cx, fp, fun),
        fp->script->lineno,
        jsdtrace_filename(dfp),
        jsdtrace_linenumber(cx, dfp)
    );
}

void
jsdtrace_function_args(JSContext *cx, JSStackFrame *fp, JSFunction *fun)
{
    JAVASCRIPT_FUNCTION_ARGS(
        jsdtrace_filename(fp),
        jsdtrace_funcclass_name(fun),
        jsdtrace_function_name(cx, fp, fun),
        fp->argc, (void *)fp->argv,
        (fp->argc > 0) ? jsdtrace_jsvaltovoid(cx, fp->argv[0]) : 0,
        (fp->argc > 1) ? jsdtrace_jsvaltovoid(cx, fp->argv[1]) : 0,
        (fp->argc > 2) ? jsdtrace_jsvaltovoid(cx, fp->argv[2]) : 0,
        (fp->argc > 3) ? jsdtrace_jsvaltovoid(cx, fp->argv[3]) : 0,
        (fp->argc > 4) ? jsdtrace_jsvaltovoid(cx, fp->argv[4]) : 0
    );
}

void
jsdtrace_function_rval(JSContext *cx, JSStackFrame *fp, JSFunction *fun)
{
    JAVASCRIPT_FUNCTION_RVAL(
        jsdtrace_filename(fp),
        jsdtrace_funcclass_name(fun),
        jsdtrace_function_name(cx, fp, fun),
        jsdtrace_linenumber(cx, fp), (void *)fp->rval,
        jsdtrace_jsvaltovoid(cx, fp->rval)
    );
}

void
jsdtrace_function_return(JSContext *cx, JSStackFrame *fp, JSFunction *fun)
{
    JAVASCRIPT_FUNCTION_RETURN(
        jsdtrace_filename(fp),
        jsdtrace_funcclass_name(fun),
        jsdtrace_function_name(cx, fp, fun)
    );
}

void
jsdtrace_object_create_start(JSStackFrame *fp, JSClass *clasp)
{
    JAVASCRIPT_OBJECT_CREATE_START(jsdtrace_filename(fp), (char *)clasp->name);
}

void
jsdtrace_object_create_done(JSStackFrame *fp, JSClass *clasp)
{
    JAVASCRIPT_OBJECT_CREATE_DONE(jsdtrace_filename(fp), (char *)clasp->name);
}

void
jsdtrace_object_create(JSContext *cx, JSClass *clasp, JSObject *obj)
{
    JAVASCRIPT_OBJECT_CREATE(
        jsdtrace_filename(cx->fp),
        (char *)clasp->name,
        (uintptr_t)obj,
        jsdtrace_linenumber(cx, cx->fp)
    );
}

void
jsdtrace_object_finalize(JSObject *obj)
{
    JSClass *clasp;

    clasp = LOCKED_OBJ_GET_CLASS(obj);

    /* the first arg is NULL - reserved for future use (filename?) */
    JAVASCRIPT_OBJECT_FINALIZE(NULL, (char *)clasp->name, (uintptr_t)obj);
}

void
jsdtrace_execute_start(JSScript *script)
{
    JAVASCRIPT_EXECUTE_START(
        script->filename ? (char *)script->filename : dempty,
        script->lineno
    );
}

void
jsdtrace_execute_done(JSScript *script)
{
    JAVASCRIPT_EXECUTE_DONE(
        script->filename ? (char *)script->filename : dempty,
        script->lineno
    );
}
