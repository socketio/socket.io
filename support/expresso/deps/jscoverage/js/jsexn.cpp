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
 * JS standard exception implementation.
 */

#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsbit.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jsprf.h"
#include "jsapi.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsdbgapi.h"
#include "jsexn.h"
#include "jsfun.h"
#include "jsinterp.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstaticcheck.h"

/* Forward declarations for js_ErrorClass's initializer. */
static JSBool
Exception(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);

static void
exn_finalize(JSContext *cx, JSObject *obj);

static void
exn_trace(JSTracer *trc, JSObject *obj);

static void
exn_finalize(JSContext *cx, JSObject *obj);

static JSBool
exn_enumerate(JSContext *cx, JSObject *obj);

static JSBool
exn_resolve(JSContext *cx, JSObject *obj, jsval id, uintN flags,
            JSObject **objp);

JSClass js_ErrorClass = {
    js_Error_str,
    JSCLASS_HAS_PRIVATE | JSCLASS_NEW_RESOLVE | JSCLASS_MARK_IS_TRACE |
    JSCLASS_HAS_CACHED_PROTO(JSProto_Error),
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,
    exn_enumerate,    (JSResolveOp)exn_resolve, JS_ConvertStub, exn_finalize,
    NULL,             NULL,             NULL,             Exception,
    NULL,             NULL,             JS_CLASS_TRACE(exn_trace), NULL
};

typedef struct JSStackTraceElem {
    JSString            *funName;
    size_t              argc;
    const char          *filename;
    uintN               ulineno;
} JSStackTraceElem;

typedef struct JSExnPrivate {
    /* A copy of the JSErrorReport originally generated. */
    JSErrorReport       *errorReport;
    JSString            *message;
    JSString            *filename;
    uintN               lineno;
    size_t              stackDepth;
    JSStackTraceElem    stackElems[1];
} JSExnPrivate;

static JSString *
StackTraceToString(JSContext *cx, JSExnPrivate *priv);

static JSErrorReport *
CopyErrorReport(JSContext *cx, JSErrorReport *report)
{
    /*
     * We use a single malloc block to make a deep copy of JSErrorReport with
     * the following layout:
     *   JSErrorReport
     *   array of copies of report->messageArgs
     *   jschar array with characters for all messageArgs
     *   jschar array with characters for ucmessage
     *   jschar array with characters for uclinebuf and uctokenptr
     *   char array with characters for linebuf and tokenptr
     *   char array with characters for filename
     * Such layout together with the properties enforced by the following
     * asserts does not need any extra alignment padding.
     */
    JS_STATIC_ASSERT(sizeof(JSErrorReport) % sizeof(const char *) == 0);
    JS_STATIC_ASSERT(sizeof(const char *) % sizeof(jschar) == 0);

    size_t filenameSize;
    size_t linebufSize;
    size_t uclinebufSize;
    size_t ucmessageSize;
    size_t i, argsArraySize, argsCopySize, argSize;
    size_t mallocSize;
    JSErrorReport *copy;
    uint8 *cursor;

#define JS_CHARS_SIZE(jschars) ((js_strlen(jschars) + 1) * sizeof(jschar))

    filenameSize = report->filename ? strlen(report->filename) + 1 : 0;
    linebufSize = report->linebuf ? strlen(report->linebuf) + 1 : 0;
    uclinebufSize = report->uclinebuf ? JS_CHARS_SIZE(report->uclinebuf) : 0;
    ucmessageSize = 0;
    argsArraySize = 0;
    argsCopySize = 0;
    if (report->ucmessage) {
        ucmessageSize = JS_CHARS_SIZE(report->ucmessage);
        if (report->messageArgs) {
            for (i = 0; report->messageArgs[i]; ++i)
                argsCopySize += JS_CHARS_SIZE(report->messageArgs[i]);

            /* Non-null messageArgs should have at least one non-null arg. */
            JS_ASSERT(i != 0);
            argsArraySize = (i + 1) * sizeof(const jschar *);
        }
    }

    /*
     * The mallocSize can not overflow since it represents the sum of the
     * sizes of already allocated objects.
     */
    mallocSize = sizeof(JSErrorReport) + argsArraySize + argsCopySize +
                 ucmessageSize + uclinebufSize + linebufSize + filenameSize;
    cursor = (uint8 *)JS_malloc(cx, mallocSize);
    if (!cursor)
        return NULL;

    copy = (JSErrorReport *)cursor;
    memset(cursor, 0, sizeof(JSErrorReport));
    cursor += sizeof(JSErrorReport);

    if (argsArraySize != 0) {
        copy->messageArgs = (const jschar **)cursor;
        cursor += argsArraySize;
        for (i = 0; report->messageArgs[i]; ++i) {
            copy->messageArgs[i] = (const jschar *)cursor;
            argSize = JS_CHARS_SIZE(report->messageArgs[i]);
            memcpy(cursor, report->messageArgs[i], argSize);
            cursor += argSize;
        }
        copy->messageArgs[i] = NULL;
        JS_ASSERT(cursor == (uint8 *)copy->messageArgs[0] + argsCopySize);
    }

    if (report->ucmessage) {
        copy->ucmessage = (const jschar *)cursor;
        memcpy(cursor, report->ucmessage, ucmessageSize);
        cursor += ucmessageSize;
    }

    if (report->uclinebuf) {
        copy->uclinebuf = (const jschar *)cursor;
        memcpy(cursor, report->uclinebuf, uclinebufSize);
        cursor += uclinebufSize;
        if (report->uctokenptr) {
            copy->uctokenptr = copy->uclinebuf + (report->uctokenptr -
                                                  report->uclinebuf);
        }
    }

    if (report->linebuf) {
        copy->linebuf = (const char *)cursor;
        memcpy(cursor, report->linebuf, linebufSize);
        cursor += linebufSize;
        if (report->tokenptr) {
            copy->tokenptr = copy->linebuf + (report->tokenptr -
                                              report->linebuf);
        }
    }

    if (report->filename) {
        copy->filename = (const char *)cursor;
        memcpy(cursor, report->filename, filenameSize);
    }
    JS_ASSERT(cursor + filenameSize == (uint8 *)copy + mallocSize);

    /* Copy non-pointer members. */
    copy->lineno = report->lineno;
    copy->errorNumber = report->errorNumber;

    /* Note that this is before it gets flagged with JSREPORT_EXCEPTION */
    copy->flags = report->flags;

#undef JS_CHARS_SIZE
    return copy;
}

static jsval *
GetStackTraceValueBuffer(JSExnPrivate *priv)
{
    /*
     * We use extra memory after JSExnPrivateInfo.stackElems to store jsvals
     * that helps to produce more informative stack traces. The following
     * assert allows us to assume that no gap after stackElems is necessary to
     * align the buffer properly.
     */
    JS_STATIC_ASSERT(sizeof(JSStackTraceElem) % sizeof(jsval) == 0);

    return (jsval *)(priv->stackElems + priv->stackDepth);
}

static JSBool
InitExnPrivate(JSContext *cx, JSObject *exnObject, JSString *message,
               JSString *filename, uintN lineno, JSErrorReport *report)
{
    JSSecurityCallbacks *callbacks;
    JSCheckAccessOp checkAccess;
    JSErrorReporter older;
    JSExceptionState *state;
    jsval callerid, v;
    JSStackFrame *fp, *fpstop;
    size_t stackDepth, valueCount, size;
    JSBool overflow;
    JSExnPrivate *priv;
    JSStackTraceElem *elem;
    jsval *values;

    JS_ASSERT(OBJ_GET_CLASS(cx, exnObject) == &js_ErrorClass);

    /*
     * Prepare stack trace data.
     *
     * Set aside any error reporter for cx and save its exception state
     * so we can suppress any checkAccess failures.  Such failures should stop
     * the backtrace procedure, not result in a failure of this constructor.
     */
    callbacks = JS_GetSecurityCallbacks(cx);
    checkAccess = callbacks
                  ? callbacks->checkObjectAccess
                  : NULL;
    older = JS_SetErrorReporter(cx, NULL);
    state = JS_SaveExceptionState(cx);

    callerid = ATOM_KEY(cx->runtime->atomState.callerAtom);
    stackDepth = 0;
    valueCount = 0;
    for (fp = cx->fp; fp; fp = fp->down) {
        if (fp->fun && fp->argv) {
            v = JSVAL_NULL;
            if (checkAccess &&
                !checkAccess(cx, fp->callee, callerid, JSACC_READ, &v)) {
                break;
            }
            valueCount += fp->argc;
        }
        ++stackDepth;
    }
    JS_RestoreExceptionState(cx, state);
    JS_SetErrorReporter(cx, older);
    fpstop = fp;

    size = offsetof(JSExnPrivate, stackElems);
    overflow = (stackDepth > ((size_t)-1 - size) / sizeof(JSStackTraceElem));
    size += stackDepth * sizeof(JSStackTraceElem);
    overflow |= (valueCount > ((size_t)-1 - size) / sizeof(jsval));
    size += valueCount * sizeof(jsval);
    if (overflow) {
        js_ReportAllocationOverflow(cx);
        return JS_FALSE;
    }
    priv = (JSExnPrivate *)JS_malloc(cx, size);
    if (!priv)
        return JS_FALSE;

    /*
     * We initialize errorReport with a copy of report after setting the
     * private slot, to prevent GC accessing a junk value we clear the field
     * here.
     */
    priv->errorReport = NULL;
    priv->message = message;
    priv->filename = filename;
    priv->lineno = lineno;
    priv->stackDepth = stackDepth;

    values = GetStackTraceValueBuffer(priv);
    elem = priv->stackElems;
    for (fp = cx->fp; fp != fpstop; fp = fp->down) {
        if (!fp->fun) {
            elem->funName = NULL;
            elem->argc = 0;
        } else {
            elem->funName = fp->fun->atom
                            ? ATOM_TO_STRING(fp->fun->atom)
                            : cx->runtime->emptyString;
            elem->argc = fp->argc;
            memcpy(values, fp->argv, fp->argc * sizeof(jsval));
            values += fp->argc;
        }
        elem->ulineno = 0;
        elem->filename = NULL;
        if (fp->script) {
            elem->filename = fp->script->filename;
            if (fp->regs)
                elem->ulineno = js_FramePCToLineNumber(cx, fp);
        }
        ++elem;
    }
    JS_ASSERT(priv->stackElems + stackDepth == elem);
    JS_ASSERT(GetStackTraceValueBuffer(priv) + valueCount == values);

    STOBJ_SET_SLOT(exnObject, JSSLOT_PRIVATE, PRIVATE_TO_JSVAL(priv));

    if (report) {
        /*
         * Construct a new copy of the error report struct. We can't use the
         * error report struct that was passed in, because it's allocated on
         * the stack, and also because it may point to transient data in the
         * JSTokenStream.
         */
        priv->errorReport = CopyErrorReport(cx, report);
        if (!priv->errorReport) {
            /* The finalizer realeases priv since it is in the private slot. */
            return JS_FALSE;
        }
    }

    return JS_TRUE;
}

static JSExnPrivate *
GetExnPrivate(JSContext *cx, JSObject *obj)
{
    jsval privateValue;
    JSExnPrivate *priv;

    JS_ASSERT(OBJ_GET_CLASS(cx, obj) == &js_ErrorClass);
    privateValue = OBJ_GET_SLOT(cx, obj, JSSLOT_PRIVATE);
    if (JSVAL_IS_VOID(privateValue))
        return NULL;
    priv = (JSExnPrivate *)JSVAL_TO_PRIVATE(privateValue);
    JS_ASSERT(priv);
    return priv;
}

static void
exn_trace(JSTracer *trc, JSObject *obj)
{
    JSExnPrivate *priv;
    JSStackTraceElem *elem;
    size_t vcount, i;
    jsval *vp, v;

    priv = GetExnPrivate(trc->context, obj);
    if (priv) {
        if (priv->message)
            JS_CALL_STRING_TRACER(trc, priv->message, "exception message");
        if (priv->filename)
            JS_CALL_STRING_TRACER(trc, priv->filename, "exception filename");

        elem = priv->stackElems;
        for (vcount = i = 0; i != priv->stackDepth; ++i, ++elem) {
            if (elem->funName) {
                JS_CALL_STRING_TRACER(trc, elem->funName,
                                      "stack trace function name");
            }
            if (IS_GC_MARKING_TRACER(trc) && elem->filename)
                js_MarkScriptFilename(elem->filename);
            vcount += elem->argc;
        }
        vp = GetStackTraceValueBuffer(priv);
        for (i = 0; i != vcount; ++i, ++vp) {
            v = *vp;
            JS_CALL_VALUE_TRACER(trc, v, "stack trace argument");
        }
    }
}

static void
exn_finalize(JSContext *cx, JSObject *obj)
{
    JSExnPrivate *priv;

    priv = GetExnPrivate(cx, obj);
    if (priv) {
        if (priv->errorReport)
            JS_free(cx, priv->errorReport);
        JS_free(cx, priv);
    }
}

static JSBool
exn_enumerate(JSContext *cx, JSObject *obj)
{
    JSAtomState *atomState;
    uintN i;
    JSAtom *atom;
    JSObject *pobj;
    JSProperty *prop;

    JS_STATIC_ASSERT(sizeof(JSAtomState) <= (size_t)(uint16)-1);
    static const uint16 offsets[] = {
        (uint16)offsetof(JSAtomState, messageAtom),
        (uint16)offsetof(JSAtomState, fileNameAtom),
        (uint16)offsetof(JSAtomState, lineNumberAtom),
        (uint16)offsetof(JSAtomState, stackAtom),
    };

    atomState = &cx->runtime->atomState;
    for (i = 0; i != JS_ARRAY_LENGTH(offsets); ++i) {
        atom = *(JSAtom **)((uint8 *)atomState + offsets[i]);
        if (!js_LookupProperty(cx, obj, ATOM_TO_JSID(atom), &pobj, &prop))
            return JS_FALSE;
        if (prop)
            OBJ_DROP_PROPERTY(cx, pobj, prop);
    }
    return JS_TRUE;
}

static JSBool
exn_resolve(JSContext *cx, JSObject *obj, jsval id, uintN flags,
            JSObject **objp)
{
    JSExnPrivate *priv;
    JSString *str;
    JSAtom *atom;
    JSString *stack;
    const char *prop;
    jsval v;

    *objp = NULL;
    priv = GetExnPrivate(cx, obj);
    if (priv && JSVAL_IS_STRING(id)) {
        str = JSVAL_TO_STRING(id);

        atom = cx->runtime->atomState.messageAtom;
        if (str == ATOM_TO_STRING(atom)) {
            prop = js_message_str;
            v = STRING_TO_JSVAL(priv->message);
            goto define;
        }

        atom = cx->runtime->atomState.fileNameAtom;
        if (str == ATOM_TO_STRING(atom)) {
            prop = js_fileName_str;
            v = STRING_TO_JSVAL(priv->filename);
            goto define;
        }

        atom = cx->runtime->atomState.lineNumberAtom;
        if (str == ATOM_TO_STRING(atom)) {
            prop = js_lineNumber_str;
            v = INT_TO_JSVAL(priv->lineno);
            goto define;
        }

        atom = cx->runtime->atomState.stackAtom;
        if (str == ATOM_TO_STRING(atom)) {
            stack = StackTraceToString(cx, priv);
            if (!stack)
                return JS_FALSE;

            /* Allow to GC all things that were used to build stack trace. */
            priv->stackDepth = 0;
            prop = js_stack_str;
            v = STRING_TO_JSVAL(stack);
            goto define;
        }
    }
    return JS_TRUE;

  define:
    if (!JS_DefineProperty(cx, obj, prop, v, NULL, NULL, JSPROP_ENUMERATE))
        return JS_FALSE;
    *objp = obj;
    return JS_TRUE;
}

JSErrorReport *
js_ErrorFromException(JSContext *cx, jsval exn)
{
    JSObject *obj;
    JSExnPrivate *priv;

    if (JSVAL_IS_PRIMITIVE(exn))
        return NULL;
    obj = JSVAL_TO_OBJECT(exn);
    if (OBJ_GET_CLASS(cx, obj) != &js_ErrorClass)
        return NULL;
    priv = GetExnPrivate(cx, obj);
    if (!priv)
        return NULL;
    return priv->errorReport;
}

struct JSExnSpec {
    int protoIndex;
    const char *name;
    JSProtoKey key;
    JSNative native;
};

/*
 * All *Error constructors share the same JSClass, js_ErrorClass.  But each
 * constructor function for an *Error class must have a distinct native 'call'
 * function pointer, in order for instanceof to work properly across multiple
 * standard class sets.  See jsfun.c:fun_hasInstance.
 */
#define MAKE_EXCEPTION_CTOR(name)                                             \
static JSBool                                                                 \
name(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)      \
{                                                                             \
    return Exception(cx, obj, argc, argv, rval);                              \
}

MAKE_EXCEPTION_CTOR(Error)
MAKE_EXCEPTION_CTOR(InternalError)
MAKE_EXCEPTION_CTOR(EvalError)
MAKE_EXCEPTION_CTOR(RangeError)
MAKE_EXCEPTION_CTOR(ReferenceError)
MAKE_EXCEPTION_CTOR(SyntaxError)
MAKE_EXCEPTION_CTOR(TypeError)
MAKE_EXCEPTION_CTOR(URIError)

#undef MAKE_EXCEPTION_CTOR

static struct JSExnSpec exceptions[] = {
    {JSEXN_NONE, js_Error_str,          JSProto_Error,          Error},
    {JSEXN_ERR,  js_InternalError_str,  JSProto_InternalError,  InternalError},
    {JSEXN_ERR,  js_EvalError_str,      JSProto_EvalError,      EvalError},
    {JSEXN_ERR,  js_RangeError_str,     JSProto_RangeError,     RangeError},
    {JSEXN_ERR,  js_ReferenceError_str, JSProto_ReferenceError, ReferenceError},
    {JSEXN_ERR,  js_SyntaxError_str,    JSProto_SyntaxError,    SyntaxError},
    {JSEXN_ERR,  js_TypeError_str,      JSProto_TypeError,      TypeError},
    {JSEXN_ERR,  js_URIError_str,       JSProto_URIError,       URIError},
    {0,          NULL,                  JSProto_Null,           NULL}
};

static JSString *
ValueToShortSource(JSContext *cx, jsval v)
{
    JSString *str;

    /* Avoid toSource bloat and fallibility for object types. */
    if (JSVAL_IS_PRIMITIVE(v)) {
        str = js_ValueToSource(cx, v);
    } else if (VALUE_IS_FUNCTION(cx, v)) {
        /*
         * XXX Avoid function decompilation bloat for now.
         */
        str = JS_GetFunctionId(JS_ValueToFunction(cx, v));
        if (!str && !(str = js_ValueToSource(cx, v))) {
            /*
             * Continue to soldier on if the function couldn't be
             * converted into a string.
             */
            JS_ClearPendingException(cx);
            str = JS_NewStringCopyZ(cx, "[unknown function]");
        }
    } else {
        /*
         * XXX Avoid toString on objects, it takes too long and uses too much
         * memory, for too many classes (see Mozilla bug 166743).
         */
        char buf[100];
        JS_snprintf(buf, sizeof buf, "[object %s]",
                    OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(v))->name);
        str = JS_NewStringCopyZ(cx, buf);
    }
    return str;
}

static JSString *
StackTraceToString(JSContext *cx, JSExnPrivate *priv)
{
    jschar *stackbuf;
    size_t stacklen, stackmax;
    JSStackTraceElem *elem, *endElem;
    jsval *values;
    size_t i;
    JSString *str;
    const char *cp;
    char ulnbuf[11];

    /* After this point, failing control flow must goto bad. */
    stackbuf = NULL;
    stacklen = stackmax = 0;

/* Limit the stackbuf length to a reasonable value to avoid overflow checks. */
#define STACK_LENGTH_LIMIT JS_BIT(20)

#define APPEND_CHAR_TO_STACK(c)                                               \
    JS_BEGIN_MACRO                                                            \
        if (stacklen == stackmax) {                                           \
            void *ptr_;                                                       \
            if (stackmax >= STACK_LENGTH_LIMIT)                               \
                goto done;                                                    \
            stackmax = stackmax ? 2 * stackmax : 64;                          \
            ptr_ = JS_realloc(cx, stackbuf, (stackmax+1) * sizeof(jschar));   \
            if (!ptr_)                                                        \
                goto bad;                                                     \
            stackbuf = (jschar *) ptr_;                                       \
        }                                                                     \
        stackbuf[stacklen++] = (c);                                           \
    JS_END_MACRO

#define APPEND_STRING_TO_STACK(str)                                           \
    JS_BEGIN_MACRO                                                            \
        JSString *str_ = str;                                                 \
        jschar *chars_;                                                       \
        size_t length_;                                                       \
                                                                              \
        JSSTRING_CHARS_AND_LENGTH(str_, chars_, length_);                     \
        if (length_ > stackmax - stacklen) {                                  \
            void *ptr_;                                                       \
            if (stackmax >= STACK_LENGTH_LIMIT ||                             \
                length_ >= STACK_LENGTH_LIMIT - stacklen) {                   \
                goto done;                                                    \
            }                                                                 \
            stackmax = JS_BIT(JS_CeilingLog2(stacklen + length_));            \
            ptr_ = JS_realloc(cx, stackbuf, (stackmax+1) * sizeof(jschar));   \
            if (!ptr_)                                                        \
                goto bad;                                                     \
            stackbuf = (jschar *) ptr_;                                       \
        }                                                                     \
        js_strncpy(stackbuf + stacklen, chars_, length_);                     \
        stacklen += length_;                                                  \
    JS_END_MACRO

    values = GetStackTraceValueBuffer(priv);
    elem = priv->stackElems;
    for (endElem = elem + priv->stackDepth; elem != endElem; elem++) {
        if (elem->funName) {
            APPEND_STRING_TO_STACK(elem->funName);
            APPEND_CHAR_TO_STACK('(');
            for (i = 0; i != elem->argc; i++, values++) {
                if (i > 0)
                    APPEND_CHAR_TO_STACK(',');
                str = ValueToShortSource(cx, *values);
                if (!str)
                    goto bad;
                APPEND_STRING_TO_STACK(str);
            }
            APPEND_CHAR_TO_STACK(')');
        }
        APPEND_CHAR_TO_STACK('@');
        if (elem->filename) {
            for (cp = elem->filename; *cp; cp++)
                APPEND_CHAR_TO_STACK(*cp);
        }
        APPEND_CHAR_TO_STACK(':');
        JS_snprintf(ulnbuf, sizeof ulnbuf, "%u", elem->ulineno);
        for (cp = ulnbuf; *cp; cp++)
            APPEND_CHAR_TO_STACK(*cp);
        APPEND_CHAR_TO_STACK('\n');
    }
#undef APPEND_CHAR_TO_STACK
#undef APPEND_STRING_TO_STACK
#undef STACK_LENGTH_LIMIT

  done:
    if (stacklen == 0) {
        JS_ASSERT(!stackbuf);
        return cx->runtime->emptyString;
    }
    if (stacklen < stackmax) {
        /*
         * Realloc can fail when shrinking on some FreeBSD versions, so
         * don't use JS_realloc here; simply let the oversized allocation
         * be owned by the string in that rare case.
         */
        void *shrunk = JS_realloc(cx, stackbuf, (stacklen+1) * sizeof(jschar));
        if (shrunk)
            stackbuf = (jschar *) shrunk;
    }

    stackbuf[stacklen] = 0;
    str = js_NewString(cx, stackbuf, stacklen);
    if (str)
        return str;

  bad:
    if (stackbuf)
        JS_free(cx, stackbuf);
    return NULL;
}

/* XXXbe Consolidate the ugly truth that we don't treat filename as UTF-8
         with these two functions. */
static JSString *
FilenameToString(JSContext *cx, const char *filename)
{
    return JS_NewStringCopyZ(cx, filename);
}

static const char *
StringToFilename(JSContext *cx, JSString *str)
{
    return js_GetStringBytes(cx, str);
}

static JSBool
Exception(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    uint32 lineno;
    JSString *message, *filename;
    JSStackFrame *fp;

    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        /*
         * ECMA ed. 3, 15.11.1 requires Error, etc., to construct even when
         * called as functions, without operator new.  But as we do not give
         * each constructor a distinct JSClass, whose .name member is used by
         * js_NewObject to find the class prototype, we must get the class
         * prototype ourselves.
         */
        if (!OBJ_GET_PROPERTY(cx, JSVAL_TO_OBJECT(argv[-2]),
                              ATOM_TO_JSID(cx->runtime->atomState
                                           .classPrototypeAtom),
                              rval))
            return JS_FALSE;
        obj = js_NewObject(cx, &js_ErrorClass, JSVAL_TO_OBJECT(*rval), NULL, 0);
        if (!obj)
            return JS_FALSE;
        *rval = OBJECT_TO_JSVAL(obj);
    }

    /*
     * If it's a new object of class Exception, then null out the private
     * data so that the finalizer doesn't attempt to free it.
     */
    if (OBJ_GET_CLASS(cx, obj) == &js_ErrorClass)
        STOBJ_SET_SLOT(obj, JSSLOT_PRIVATE, JSVAL_VOID);

    /* Set the 'message' property. */
    if (argc != 0) {
        message = js_ValueToString(cx, argv[0]);
        if (!message)
            return JS_FALSE;
        argv[0] = STRING_TO_JSVAL(message);
    } else {
        message = cx->runtime->emptyString;
    }

    /* Set the 'fileName' property. */
    if (argc > 1) {
        filename = js_ValueToString(cx, argv[1]);
        if (!filename)
            return JS_FALSE;
        argv[1] = STRING_TO_JSVAL(filename);
        fp = NULL;
    } else {
        fp = JS_GetScriptedCaller(cx, NULL);
        if (fp) {
            filename = FilenameToString(cx, fp->script->filename);
            if (!filename)
                return JS_FALSE;
        } else {
            filename = cx->runtime->emptyString;
        }
    }

    /* Set the 'lineNumber' property. */
    if (argc > 2) {
        lineno = js_ValueToECMAUint32(cx, &argv[2]);
        if (JSVAL_IS_NULL(argv[2]))
            return JS_FALSE;
    } else {
        if (!fp)
            fp = JS_GetScriptedCaller(cx, NULL);
        lineno = (fp && fp->regs) ? js_FramePCToLineNumber(cx, fp) : 0;
    }

    return (OBJ_GET_CLASS(cx, obj) != &js_ErrorClass) ||
            InitExnPrivate(cx, obj, message, filename, lineno, NULL);
}

/*
 * Convert to string.
 *
 * This method only uses JavaScript-modifiable properties name, message.  It
 * is left to the host to check for private data and report filename and line
 * number information along with this message.
 */
static JSBool
exn_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    jsval v;
    JSString *name, *message, *result;
    jschar *chars, *cp;
    size_t name_length, message_length, length;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj ||
        !OBJ_GET_PROPERTY(cx, obj,
                          ATOM_TO_JSID(cx->runtime->atomState.nameAtom),
                          &v)) {
        return JS_FALSE;
    }
    name = JSVAL_IS_STRING(v) ? JSVAL_TO_STRING(v) : cx->runtime->emptyString;
    *vp = STRING_TO_JSVAL(name);

    if (!JS_GetProperty(cx, obj, js_message_str, &v))
        return JS_FALSE;
    message = JSVAL_IS_STRING(v) ? JSVAL_TO_STRING(v)
                                 : cx->runtime->emptyString;

    if (JSSTRING_LENGTH(message) != 0) {
        name_length = JSSTRING_LENGTH(name);
        message_length = JSSTRING_LENGTH(message);
        length = (name_length ? name_length + 2 : 0) + message_length;
        cp = chars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
        if (!chars)
            return JS_FALSE;

        if (name_length) {
            js_strncpy(cp, JSSTRING_CHARS(name), name_length);
            cp += name_length;
            *cp++ = ':'; *cp++ = ' ';
        }
        js_strncpy(cp, JSSTRING_CHARS(message), message_length);
        cp += message_length;
        *cp = 0;

        result = js_NewString(cx, chars, length);
        if (!result) {
            JS_free(cx, chars);
            return JS_FALSE;
        }
    } else {
        result = name;
    }

    *vp = STRING_TO_JSVAL(result);
    return JS_TRUE;
}

#if JS_HAS_TOSOURCE
/*
 * Return a string that may eval to something similar to the original object.
 */
static JSBool
exn_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    JSString *name, *message, *filename, *lineno_as_str, *result;
    jsval localroots[3] = {JSVAL_NULL, JSVAL_NULL, JSVAL_NULL};
    JSTempValueRooter tvr;
    JSBool ok;
    uint32 lineno;
    size_t lineno_length, name_length, message_length, filename_length, length;
    jschar *chars, *cp;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj ||
        !OBJ_GET_PROPERTY(cx, obj,
                          ATOM_TO_JSID(cx->runtime->atomState.nameAtom),
                          vp)) {
        return JS_FALSE;
    }
    name = js_ValueToString(cx, *vp);
    if (!name)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(name);

    MUST_FLOW_THROUGH("out");
    JS_PUSH_TEMP_ROOT(cx, 3, localroots, &tvr);

#ifdef __GNUC__
    message = filename = NULL;
#endif
    ok = JS_GetProperty(cx, obj, js_message_str, &localroots[0]) &&
         (message = js_ValueToSource(cx, localroots[0]));
    if (!ok)
        goto out;
    localroots[0] = STRING_TO_JSVAL(message);

    ok = JS_GetProperty(cx, obj, js_fileName_str, &localroots[1]) &&
         (filename = js_ValueToSource(cx, localroots[1]));
    if (!ok)
        goto out;
    localroots[1] = STRING_TO_JSVAL(filename);

    ok = JS_GetProperty(cx, obj, js_lineNumber_str, &localroots[2]);
    if (!ok)
        goto out;
    lineno = js_ValueToECMAUint32 (cx, &localroots[2]);
    ok = !JSVAL_IS_NULL(localroots[2]);
    if (!ok)
        goto out;

    if (lineno != 0) {
        lineno_as_str = js_ValueToString(cx, localroots[2]);
        if (!lineno_as_str) {
            ok = JS_FALSE;
            goto out;
        }
        lineno_length = JSSTRING_LENGTH(lineno_as_str);
    } else {
        lineno_as_str = NULL;
        lineno_length = 0;
    }

    /* Magic 8, for the characters in ``(new ())''. */
    name_length = JSSTRING_LENGTH(name);
    message_length = JSSTRING_LENGTH(message);
    length = 8 + name_length + message_length;

    filename_length = JSSTRING_LENGTH(filename);
    if (filename_length != 0) {
        /* append filename as ``, {filename}'' */
        length += 2 + filename_length;
        if (lineno_as_str) {
            /* append lineno as ``, {lineno_as_str}'' */
            length += 2 + lineno_length;
        }
    } else {
        if (lineno_as_str) {
            /*
             * no filename, but have line number,
             * need to append ``, "", {lineno_as_str}''
             */
            length += 6 + lineno_length;
        }
    }

    cp = chars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
    if (!chars) {
        ok = JS_FALSE;
        goto out;
    }

    *cp++ = '('; *cp++ = 'n'; *cp++ = 'e'; *cp++ = 'w'; *cp++ = ' ';
    js_strncpy(cp, JSSTRING_CHARS(name), name_length);
    cp += name_length;
    *cp++ = '(';
    if (message_length != 0) {
        js_strncpy(cp, JSSTRING_CHARS(message), message_length);
        cp += message_length;
    }

    if (filename_length != 0) {
        /* append filename as ``, {filename}'' */
        *cp++ = ','; *cp++ = ' ';
        js_strncpy(cp, JSSTRING_CHARS(filename), filename_length);
        cp += filename_length;
    } else {
        if (lineno_as_str) {
            /*
             * no filename, but have line number,
             * need to append ``, "", {lineno_as_str}''
             */
            *cp++ = ','; *cp++ = ' '; *cp++ = '"'; *cp++ = '"';
        }
    }
    if (lineno_as_str) {
        /* append lineno as ``, {lineno_as_str}'' */
        *cp++ = ','; *cp++ = ' ';
        js_strncpy(cp, JSSTRING_CHARS(lineno_as_str), lineno_length);
        cp += lineno_length;
    }

    *cp++ = ')'; *cp++ = ')'; *cp = 0;

    result = js_NewString(cx, chars, length);
    if (!result) {
        JS_free(cx, chars);
        ok = JS_FALSE;
        goto out;
    }
    *vp = STRING_TO_JSVAL(result);
    ok = JS_TRUE;

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}
#endif

static JSFunctionSpec exception_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN(js_toSource_str,   exn_toSource,           0,0),
#endif
    JS_FN(js_toString_str,   exn_toString,           0,0),
    JS_FS_END
};

JSObject *
js_InitExceptionClasses(JSContext *cx, JSObject *obj)
{
    JSObject *obj_proto, *protos[JSEXN_LIMIT];
    int i;

    /*
     * If lazy class initialization occurs for any Error subclass, then all
     * classes are initialized, starting with Error.  To avoid reentry and
     * redundant initialization, we must not pass a null proto parameter to
     * js_NewObject below, when called for the Error superclass.  We need to
     * ensure that Object.prototype is the proto of Error.prototype.
     *
     * See the equivalent code to ensure that parent_proto is non-null when
     * JS_InitClass calls js_NewObject, in jsapi.c.
     */
    if (!js_GetClassPrototype(cx, obj, INT_TO_JSID(JSProto_Object),
                              &obj_proto)) {
        return NULL;
    }

    if (!js_EnterLocalRootScope(cx))
        return NULL;

    /* Initialize the prototypes first. */
    for (i = 0; exceptions[i].name != 0; i++) {
        JSAtom *atom;
        JSFunction *fun;
        JSString *nameString;
        int protoIndex = exceptions[i].protoIndex;

        /* Make the prototype for the current constructor name. */
        protos[i] = js_NewObject(cx, &js_ErrorClass,
                                 (protoIndex != JSEXN_NONE)
                                 ? protos[protoIndex]
                                 : obj_proto,
                                 obj, 0);
        if (!protos[i])
            break;

        /* So exn_finalize knows whether to destroy private data. */
        STOBJ_SET_SLOT(protos[i], JSSLOT_PRIVATE, JSVAL_VOID);

        /* Make a constructor function for the current name. */
        atom = cx->runtime->atomState.classAtoms[exceptions[i].key];
        fun = js_DefineFunction(cx, obj, atom, exceptions[i].native, 3, 0);
        if (!fun)
            break;

        /* Make this constructor make objects of class Exception. */
        FUN_CLASP(fun) = &js_ErrorClass;

        /* Make the prototype and constructor links. */
        if (!js_SetClassPrototype(cx, FUN_OBJECT(fun), protos[i],
                                  JSPROP_READONLY | JSPROP_PERMANENT)) {
            break;
        }

        /* proto bootstrap bit from JS_InitClass omitted. */
        nameString = JS_NewStringCopyZ(cx, exceptions[i].name);
        if (!nameString)
            break;

        /* Add the name property to the prototype. */
        if (!JS_DefineProperty(cx, protos[i], js_name_str,
                               STRING_TO_JSVAL(nameString),
                               NULL, NULL,
                               JSPROP_ENUMERATE)) {
            break;
        }

        /* Finally, stash the constructor for later uses. */
        if (!js_SetClassObject(cx, obj, exceptions[i].key, FUN_OBJECT(fun)))
            break;
    }

    js_LeaveLocalRootScope(cx);
    if (exceptions[i].name)
        return NULL;

    /*
     * Add an empty message property.  (To Exception.prototype only,
     * because this property will be the same for all the exception
     * protos.)
     */
    if (!JS_DefineProperty(cx, protos[0], js_message_str,
                           STRING_TO_JSVAL(cx->runtime->emptyString),
                           NULL, NULL, JSPROP_ENUMERATE)) {
        return NULL;
    }
    if (!JS_DefineProperty(cx, protos[0], js_fileName_str,
                           STRING_TO_JSVAL(cx->runtime->emptyString),
                           NULL, NULL, JSPROP_ENUMERATE)) {
        return NULL;
    }
    if (!JS_DefineProperty(cx, protos[0], js_lineNumber_str,
                           INT_TO_JSVAL(0),
                           NULL, NULL, JSPROP_ENUMERATE)) {
        return NULL;
    }

    /*
     * Add methods only to Exception.prototype, because ostensibly all
     * exception types delegate to that.
     */
    if (!JS_DefineFunctions(cx, protos[0], exception_methods))
        return NULL;

    return protos[0];
}

const JSErrorFormatString*
js_GetLocalizedErrorMessage(JSContext* cx, void *userRef, const char *locale,
                            const uintN errorNumber)
{
    const JSErrorFormatString *errorString = NULL;

    if (cx->localeCallbacks && cx->localeCallbacks->localeGetErrorMessage) {
        errorString = cx->localeCallbacks
                        ->localeGetErrorMessage(userRef, locale, errorNumber);
    }
    if (!errorString)
        errorString = js_GetErrorMessage(userRef, locale, errorNumber);
    return errorString;
}

#if defined ( DEBUG_mccabe ) && defined ( PRINTNAMES )
/* For use below... get character strings for error name and exception name */
static struct exnname { char *name; char *exception; } errortoexnname[] = {
#define MSG_DEF(name, number, count, exception, format) \
    {#name, #exception},
#include "js.msg"
#undef MSG_DEF
};
#endif /* DEBUG */

JSBool
js_ErrorToException(JSContext *cx, const char *message, JSErrorReport *reportp)
{
    JSErrNum errorNumber;
    const JSErrorFormatString *errorString;
    JSExnType exn;
    jsval tv[4];
    JSTempValueRooter tvr;
    JSBool ok;
    JSObject *errProto, *errObject;
    JSString *messageStr, *filenameStr;

    /*
     * Tell our caller to report immediately if this report is just a warning.
     */
    JS_ASSERT(reportp);
    if (JSREPORT_IS_WARNING(reportp->flags))
        return JS_FALSE;

    /* Find the exception index associated with this error. */
    errorNumber = (JSErrNum) reportp->errorNumber;
    errorString = js_GetLocalizedErrorMessage(cx, NULL, NULL, errorNumber);
    exn = errorString ? (JSExnType) errorString->exnType : JSEXN_NONE;
    JS_ASSERT(exn < JSEXN_LIMIT);

#if defined( DEBUG_mccabe ) && defined ( PRINTNAMES )
    /* Print the error name and the associated exception name to stderr */
    fprintf(stderr, "%s\t%s\n",
            errortoexnname[errorNumber].name,
            errortoexnname[errorNumber].exception);
#endif

    /*
     * Return false (no exception raised) if no exception is associated
     * with the given error number.
     */
    if (exn == JSEXN_NONE)
        return JS_FALSE;

    /*
     * Prevent runaway recursion, via cx->generatingError.  If an out-of-memory
     * error occurs, no exception object will be created, but we don't assume
     * that OOM is the only kind of error that subroutines of this function
     * called below might raise.
     */
    if (cx->generatingError)
        return JS_FALSE;

    MUST_FLOW_THROUGH("out");
    cx->generatingError = JS_TRUE;

    /* Protect the newly-created strings below from nesting GCs. */
    memset(tv, 0, sizeof tv);
    JS_PUSH_TEMP_ROOT(cx, JS_ARRAY_LENGTH(tv), tv, &tvr);

    /*
     * Try to get an appropriate prototype by looking up the corresponding
     * exception constructor name in the scope chain of the current context's
     * top stack frame, or in the global object if no frame is active.
     */
    ok = js_GetClassPrototype(cx, NULL, INT_TO_JSID(exceptions[exn].key),
                              &errProto);
    if (!ok)
        goto out;
    tv[0] = OBJECT_TO_JSVAL(errProto);

    errObject = js_NewObject(cx, &js_ErrorClass, errProto, NULL, 0);
    if (!errObject) {
        ok = JS_FALSE;
        goto out;
    }
    tv[1] = OBJECT_TO_JSVAL(errObject);

    messageStr = JS_NewStringCopyZ(cx, message);
    if (!messageStr) {
        ok = JS_FALSE;
        goto out;
    }
    tv[2] = STRING_TO_JSVAL(messageStr);

    filenameStr = JS_NewStringCopyZ(cx, reportp->filename);
    if (!filenameStr) {
        ok = JS_FALSE;
        goto out;
    }
    tv[3] = STRING_TO_JSVAL(filenameStr);

    ok = InitExnPrivate(cx, errObject, messageStr, filenameStr,
                        reportp->lineno, reportp);
    if (!ok)
        goto out;

    JS_SetPendingException(cx, OBJECT_TO_JSVAL(errObject));

    /* Flag the error report passed in to indicate an exception was raised. */
    reportp->flags |= JSREPORT_EXCEPTION;

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    cx->generatingError = JS_FALSE;
    return ok;
}

JSBool
js_ReportUncaughtException(JSContext *cx)
{
    jsval exn;
    JSObject *exnObject;
    jsval roots[5];
    JSTempValueRooter tvr;
    JSErrorReport *reportp, report;
    JSString *str;
    const char *bytes;
    JSBool ok;

    if (!JS_IsExceptionPending(cx))
        return JS_TRUE;

    if (!JS_GetPendingException(cx, &exn))
        return JS_FALSE;

    memset(roots, 0, sizeof roots);
    JS_PUSH_TEMP_ROOT(cx, JS_ARRAY_LENGTH(roots), roots, &tvr);

    /*
     * Because js_ValueToString below could error and an exception object
     * could become unrooted, we must root exnObject.  Later, if exnObject is
     * non-null, we need to root other intermediates, so allocate an operand
     * stack segment to protect all of these values.
     */
    if (JSVAL_IS_PRIMITIVE(exn)) {
        exnObject = NULL;
    } else {
        exnObject = JSVAL_TO_OBJECT(exn);
        roots[0] = exn;
    }

    JS_ClearPendingException(cx);
    reportp = js_ErrorFromException(cx, exn);

    /* XXX L10N angels cry once again (see also jsemit.c, /L10N gaffes/) */
    str = js_ValueToString(cx, exn);
    if (!str) {
        bytes = "unknown (can't convert to string)";
    } else {
        roots[1] = STRING_TO_JSVAL(str);
        bytes = js_GetStringBytes(cx, str);
        if (!bytes) {
            ok = JS_FALSE;
            goto out;
        }
    }
    ok = JS_TRUE;

    if (!reportp &&
        exnObject &&
        OBJ_GET_CLASS(cx, exnObject) == &js_ErrorClass) {
        const char *filename;
        uint32 lineno;

        ok = JS_GetProperty(cx, exnObject, js_message_str, &roots[2]);
        if (!ok)
            goto out;
        if (JSVAL_IS_STRING(roots[2])) {
            bytes = js_GetStringBytes(cx, JSVAL_TO_STRING(roots[2]));
            if (!bytes) {
                ok = JS_FALSE;
                goto out;
            }
        }

        ok = JS_GetProperty(cx, exnObject, js_fileName_str, &roots[3]);
        if (!ok)
            goto out;
        str = js_ValueToString(cx, roots[3]);
        if (!str) {
            ok = JS_FALSE;
            goto out;
        }
        filename = StringToFilename(cx, str);
        if (!filename) {
            ok = JS_FALSE;
            goto out;
        }

        ok = JS_GetProperty(cx, exnObject, js_lineNumber_str, &roots[4]);
        if (!ok)
            goto out;
        lineno = js_ValueToECMAUint32 (cx, &roots[4]);
        ok = !JSVAL_IS_NULL(roots[4]);
        if (!ok)
            goto out;

        reportp = &report;
        memset(&report, 0, sizeof report);
        report.filename = filename;
        report.lineno = (uintN) lineno;
    }

    if (!reportp) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_UNCAUGHT_EXCEPTION, bytes);
    } else {
        /* Flag the error as an exception. */
        reportp->flags |= JSREPORT_EXCEPTION;

        /* Pass the exception object. */
        JS_SetPendingException(cx, exn);
        js_ReportErrorAgain(cx, bytes, reportp);
        JS_ClearPendingException(cx);
    }

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}
