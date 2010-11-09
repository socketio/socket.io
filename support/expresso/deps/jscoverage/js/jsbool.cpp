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

/*
 * JS boolean implementation.
 */
#include "jsstddef.h"
#include "jstypes.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jsapi.h"
#include "jsatom.h"
#include "jsbool.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsstr.h"

/* Check pseudo-booleans values. */
JS_STATIC_ASSERT(JSVAL_VOID == JSVAL_TRUE + JSVAL_ALIGN);
JS_STATIC_ASSERT(JSVAL_HOLE == JSVAL_VOID + JSVAL_ALIGN);
JS_STATIC_ASSERT(JSVAL_ARETURN == JSVAL_HOLE + JSVAL_ALIGN);

JSClass js_BooleanClass = {
    "Boolean",
    JSCLASS_HAS_PRIVATE | JSCLASS_HAS_CACHED_PROTO(JSProto_Boolean),
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,   JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS
};

#if JS_HAS_TOSOURCE
#include "jsprf.h"

static JSBool
bool_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    jsval v;
    char buf[32];
    JSString *str;

    if (!js_GetPrimitiveThis(cx, vp, &js_BooleanClass, &v))
        return JS_FALSE;
    JS_ASSERT(JSVAL_IS_BOOLEAN(v));
    JS_snprintf(buf, sizeof buf, "(new %s(%s))",
                js_BooleanClass.name,
                JS_BOOLEAN_STR(JSVAL_TO_BOOLEAN(v)));
    str = JS_NewStringCopyZ(cx, buf);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}
#endif

static JSBool
bool_toString(JSContext *cx, uintN argc, jsval *vp)
{
    jsval v;
    JSAtom *atom;
    JSString *str;

    if (!js_GetPrimitiveThis(cx, vp, &js_BooleanClass, &v))
        return JS_FALSE;
    JS_ASSERT(JSVAL_IS_BOOLEAN(v));
    atom = cx->runtime->atomState.booleanAtoms[JSVAL_TO_BOOLEAN(v) ? 1 : 0];
    str = ATOM_TO_STRING(atom);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
bool_valueOf(JSContext *cx, uintN argc, jsval *vp)
{
    return js_GetPrimitiveThis(cx, vp, &js_BooleanClass, vp);
}

static JSFunctionSpec boolean_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN(js_toSource_str,  bool_toSource,  0, JSFUN_THISP_BOOLEAN),
#endif
    JS_FN(js_toString_str,  bool_toString,  0, JSFUN_THISP_BOOLEAN),
    JS_FN(js_valueOf_str,   bool_valueOf,   0, JSFUN_THISP_BOOLEAN),
    JS_FN(js_toJSON_str,    bool_valueOf,   0, JSFUN_THISP_BOOLEAN),
    JS_FS_END
};

static JSBool
Boolean(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    jsval bval;

    bval = (argc != 0)
           ? BOOLEAN_TO_JSVAL(js_ValueToBoolean(argv[0]))
           : JSVAL_FALSE;
    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        *rval = bval;
        return JS_TRUE;
    }
    STOBJ_SET_SLOT(obj, JSSLOT_PRIVATE, bval);
    return JS_TRUE;
}

JSObject *
js_InitBooleanClass(JSContext *cx, JSObject *obj)
{
    JSObject *proto;

    proto = JS_InitClass(cx, obj, NULL, &js_BooleanClass, Boolean, 1,
                        NULL, boolean_methods, NULL, NULL);
    if (!proto)
        return NULL;
    STOBJ_SET_SLOT(proto, JSSLOT_PRIVATE, JSVAL_FALSE);
    return proto;
}

JSString *
js_BooleanToString(JSContext *cx, JSBool b)
{
    return ATOM_TO_STRING(cx->runtime->atomState.booleanAtoms[b ? 1 : 0]);
}

JSBool
js_ValueToBoolean(jsval v)
{
    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v))
        return JS_FALSE;
    if (JSVAL_IS_OBJECT(v))
        return JS_TRUE;
    if (JSVAL_IS_STRING(v))
        return JSSTRING_LENGTH(JSVAL_TO_STRING(v)) != 0;
    if (JSVAL_IS_INT(v))
        return JSVAL_TO_INT(v) != 0;
    if (JSVAL_IS_DOUBLE(v)) {
        jsdouble d;

        d = *JSVAL_TO_DOUBLE(v);
        return !JSDOUBLE_IS_NaN(d) && d != 0;
    }
    JS_ASSERT(JSVAL_IS_BOOLEAN(v));
    return JSVAL_TO_BOOLEAN(v);
}
