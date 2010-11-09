/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=4 sw=4 et tw=78:
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
 * The Original Code is SpiderMonkey E4X code, released August, 2004.
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

#include "jsstddef.h"
#include "jsversion.h"

#if JS_HAS_XML_SUPPORT

#include <math.h>
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsbit.h"
#include "jsprf.h"
#include "jsutil.h"
#include "jsapi.h"
#include "jsarray.h"
#include "jsatom.h"
#include "jsbool.h"
#include "jscntxt.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsscan.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jsxml.h"
#include "jsstaticcheck.h"

#ifdef DEBUG
#include <string.h>     /* for #ifdef DEBUG memset calls */
#endif

/*
 * NOTES
 * - in the js shell, you must use the -x command line option, or call
 *   options('xml') before compiling anything that uses XML literals
 *
 * TODO
 * - XXXbe patrol
 * - Fuse objects and their JSXML* private data into single GC-things
 * - fix function::foo vs. x.(foo == 42) collision using proper namespacing
 * - fix the !TCF_HAS_DEFXMLNS optimization in js_FoldConstants
 * - JSCLASS_DOCUMENT_OBSERVER support -- live two-way binding to Gecko's DOM!
 * - JS_TypeOfValue sure could use a cleaner interface to "types"
 */

#ifdef XML_METERING
static struct {
    jsrefcount  qname;
    jsrefcount  xmlnamespace;
    jsrefcount  xml;
    jsrefcount  xmlobj;
} xml_stats;

#define METER(x)        JS_ATOMIC_INCREMENT(&(x))
#define UNMETER(x)      JS_ATOMIC_DECREMENT(&(x))
#else
#define METER(x)        /* nothing */
#define UNMETER(x)      /* nothing */
#endif

/*
 * Random utilities and global functions.
 */
const char js_isXMLName_str[]     = "isXMLName";
const char js_XMLList_str[]       = "XMLList";
const char js_localName_str[]     = "localName";
const char js_xml_parent_str[]    = "parent";
const char js_prefix_str[]        = "prefix";
const char js_toXMLString_str[]   = "toXMLString";
const char js_uri_str[]           = "uri";

const char js_amp_entity_str[]    = "&amp;";
const char js_gt_entity_str[]     = "&gt;";
const char js_lt_entity_str[]     = "&lt;";
const char js_quot_entity_str[]   = "&quot;";

#define IS_EMPTY(str) (JSSTRING_LENGTH(str) == 0)
#define IS_STAR(str)  (JSSTRING_LENGTH(str) == 1 && *JSSTRING_CHARS(str) == '*')
/* Slot indexes shared between Namespace and QName objects. */
const uint32 JSSLOT_PREFIX      = JSSLOT_PRIVATE;
const uint32 JSSLOT_URI         = JSSLOT_PRIVATE + 1;

/* Namespace-specific slot. */
const uint32 JSSLOT_DECLARED    = JSSLOT_PRIVATE + 2;

/* QName-specific slot. */
const uint32 JSSLOT_LOCAL_NAME  = JSSLOT_PRIVATE + 2;

const uint32 NAMESPACE_RESERVED_SLOTS = 3;
const uint32 QNAME_RESERVED_SLOTS = 3;

static JSBool
IsQNameClass(JSClass *clasp)
{
    return clasp == &js_QNameClass.base ||
           clasp == &js_AttributeNameClass ||
           clasp == &js_AnyNameClass;
}

static JSString *
GetSlotString(const JSObject *obj, uint32 slot)
{
    jsval v;

    JS_ASSERT(slot == JSSLOT_PREFIX ||
              slot == JSSLOT_URI ||
              slot == JSSLOT_LOCAL_NAME);
    JS_ASSERT(STOBJ_GET_CLASS(obj) == &js_NamespaceClass.base ||
              IsQNameClass(STOBJ_GET_CLASS(obj)));
    JS_ASSERT_IF(STOBJ_GET_CLASS(obj) == &js_NamespaceClass.base,
                 slot != JSSLOT_LOCAL_NAME);

    v = obj->fslots[slot];
    if (JSVAL_IS_VOID(v))
        return NULL;
    JS_ASSERT(JSVAL_IS_STRING(v));
    return JSVAL_TO_STRING(v);
}

static JS_INLINE JSString *
GetPrefix(const JSObject *obj)
{
    return GetSlotString(obj, JSSLOT_PREFIX);
}

static JSString *
GetURI(const JSObject *obj)
{
    return GetSlotString(obj, JSSLOT_URI);
}

static JSString *
GetLocalName(const JSObject *obj)
{
    return GetSlotString(obj, JSSLOT_LOCAL_NAME);
}

static JSBool
IsDeclared(const JSObject *obj)
{
    jsval v;

    JS_ASSERT(STOBJ_GET_CLASS(obj) == &js_NamespaceClass.base);
    v = obj->fslots[JSSLOT_DECLARED];
    JS_ASSERT(JSVAL_IS_VOID(v) || v == JSVAL_TRUE);
    return v == JSVAL_TRUE;
}

static JSBool
xml_isXMLName(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
              jsval *rval)
{
    *rval = BOOLEAN_TO_JSVAL(js_IsXMLName(cx, argv[0]));
    return JS_TRUE;
}

/*
 * Namespace class and library functions.
 */
enum namespace_tinyid {
    NAMESPACE_PREFIX = -1,
    NAMESPACE_URI = -2
};

static JSBool
namespace_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    if (!JSVAL_IS_INT(id))
        return JS_TRUE;

    if (STOBJ_GET_CLASS(obj) != &js_NamespaceClass.base)
        return JS_TRUE;

    switch (JSVAL_TO_INT(id)) {
      case NAMESPACE_PREFIX:
        *vp = obj->fslots[JSSLOT_PREFIX];
        break;
      case NAMESPACE_URI:
        *vp = obj->fslots[JSSLOT_URI];
        break;
    }
    return JS_TRUE;
}

static void
namespace_finalize(JSContext *cx, JSObject *obj)
{
    if (cx->runtime->functionNamespaceObject == obj)
        cx->runtime->functionNamespaceObject = NULL;
}

static JSBool
namespace_equality(JSContext *cx, JSObject *obj, jsval v, JSBool *bp)
{
    JSObject *obj2;

    JS_ASSERT(JSVAL_IS_OBJECT(v));
    obj2 = JSVAL_TO_OBJECT(v);
    *bp = (!obj2 || OBJ_GET_CLASS(cx, obj2) != &js_NamespaceClass.base)
          ? JS_FALSE
          : js_EqualStrings(GetURI(obj), GetURI(obj2));
    return JS_TRUE;
}

JS_FRIEND_DATA(JSExtendedClass) js_NamespaceClass = {
  { "Namespace",
    JSCLASS_CONSTRUCT_PROTOTYPE | JSCLASS_IS_EXTENDED |
    JSCLASS_HAS_RESERVED_SLOTS(NAMESPACE_RESERVED_SLOTS) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_Namespace),
    JS_PropertyStub,   JS_PropertyStub,   namespace_getProperty, NULL,
    JS_EnumerateStub,  JS_ResolveStub,    JS_ConvertStub,    namespace_finalize,
    NULL,              NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL },
    namespace_equality,NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL
};

#define NAMESPACE_ATTRS                                                       \
    (JSPROP_ENUMERATE | JSPROP_READONLY | JSPROP_PERMANENT | JSPROP_SHARED)

static JSPropertySpec namespace_props[] = {
    {js_prefix_str,    NAMESPACE_PREFIX,  NAMESPACE_ATTRS,   0, 0},
    {js_uri_str,       NAMESPACE_URI,     NAMESPACE_ATTRS,   0, 0},
    {0,0,0,0,0}
};

static JSBool
namespace_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_NamespaceClass.base, vp))
        return JS_FALSE;
    *vp = obj->fslots[JSSLOT_URI];
    return JS_TRUE;
}

static JSFunctionSpec namespace_methods[] = {
    JS_FN(js_toString_str,  namespace_toString,        0,0),
    JS_FS_END
};

static JSObject *
NewXMLNamespace(JSContext *cx, JSString *prefix, JSString *uri, JSBool declared)
{
    JSObject *obj;

    obj = js_NewObject(cx, &js_NamespaceClass.base, NULL, NULL, 0);
    if (!obj)
        return JS_FALSE;
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_PREFIX]));
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_URI]));
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_DECLARED]));
    if (prefix)
        obj->fslots[JSSLOT_PREFIX] = STRING_TO_JSVAL(prefix);
    if (uri)
        obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(uri);
    if (declared)
        obj->fslots[JSSLOT_DECLARED] = JSVAL_TRUE;
    METER(xml_stats.xmlnamespace);
    return obj;
}

/*
 * QName class and library functions.
 */
enum qname_tinyid {
    QNAME_URI = -1,
    QNAME_LOCALNAME = -2
};

static JSBool
qname_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    if (!JSVAL_IS_INT(id))
        return JS_TRUE;

    if (STOBJ_GET_CLASS(obj) != &js_QNameClass.base)
        return JS_TRUE;

    switch (JSVAL_TO_INT(id)) {
      case QNAME_URI:
        *vp = obj->fslots[JSSLOT_URI];
        if (*vp == JSVAL_VOID)
            *vp = JSVAL_NULL;
        break;
      case QNAME_LOCALNAME:
        *vp = obj->fslots[JSSLOT_LOCAL_NAME];
        break;
    }
    return JS_TRUE;
}

static void
anyname_finalize(JSContext* cx, JSObject* obj)
{
    /* Make sure the next call to js_GetAnyName doesn't try to use obj. */
    if (cx->runtime->anynameObject == obj)
        cx->runtime->anynameObject = NULL;
}

static JSBool
qname_identity(JSObject *qna, JSObject *qnb)
{
    JSString *uri1 = GetURI(qna);
    JSString *uri2 = GetURI(qnb);

    if (!uri1 ^ !uri2)
        return JS_FALSE;
    if (uri1 && !js_EqualStrings(uri1, uri2))
        return JS_FALSE;
    return js_EqualStrings(GetLocalName(qna), GetLocalName(qnb));
}

static JSBool
qname_equality(JSContext *cx, JSObject *qn, jsval v, JSBool *bp)
{
    JSObject *obj2;

    JS_ASSERT(JSVAL_IS_OBJECT(v));
    obj2 = JSVAL_TO_OBJECT(v);
    *bp = (!obj2 || OBJ_GET_CLASS(cx, obj2) != &js_QNameClass.base)
          ? JS_FALSE
          : qname_identity(qn, obj2);
    return JS_TRUE;
}

JS_FRIEND_DATA(JSExtendedClass) js_QNameClass = {
  { "QName",
    JSCLASS_CONSTRUCT_PROTOTYPE | JSCLASS_IS_EXTENDED |
    JSCLASS_HAS_RESERVED_SLOTS(QNAME_RESERVED_SLOTS) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_QName),
    JS_PropertyStub,   JS_PropertyStub,   qname_getProperty, NULL,
    JS_EnumerateStub,  JS_ResolveStub,    JS_ConvertStub,    JS_FinalizeStub,
    NULL,              NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL },
    qname_equality,    NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL
};

/*
 * Classes for the ECMA-357-internal types AttributeName and AnyName, which
 * are like QName, except that they have no property getters.  They share the
 * qname_toString method, and therefore are exposed as constructable objects
 * in this implementation.
 */
JS_FRIEND_DATA(JSClass) js_AttributeNameClass = {
    js_AttributeName_str,
    JSCLASS_CONSTRUCT_PROTOTYPE |
    JSCLASS_HAS_RESERVED_SLOTS(QNAME_RESERVED_SLOTS) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_AttributeName),
    JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,
    JS_EnumerateStub,  JS_ResolveStub,    JS_ConvertStub,    JS_FinalizeStub,
    NULL,              NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL
};

JS_FRIEND_DATA(JSClass) js_AnyNameClass = {
    js_AnyName_str,
    JSCLASS_CONSTRUCT_PROTOTYPE |
    JSCLASS_HAS_RESERVED_SLOTS(QNAME_RESERVED_SLOTS) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_AnyName),
    JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,
    JS_EnumerateStub,  JS_ResolveStub,    JS_ConvertStub,    anyname_finalize,
    NULL,              NULL,              NULL,              NULL,
    NULL,              NULL,              NULL,              NULL
};

#define QNAME_ATTRS                                                           \
    (JSPROP_ENUMERATE | JSPROP_READONLY | JSPROP_PERMANENT | JSPROP_SHARED)

static JSPropertySpec qname_props[] = {
    {js_uri_str,       QNAME_URI,         QNAME_ATTRS,       0, 0},
    {js_localName_str, QNAME_LOCALNAME,   QNAME_ATTRS,       0, 0},
    {0,0,0,0,0}
};

static JSBool
qname_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    JSClass *clasp;
    JSString *uri, *str, *qualstr;
    size_t length;
    jschar *chars;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj)
        return JS_FALSE;
    clasp = OBJ_GET_CLASS(cx, obj);
    if (clasp != &js_AttributeNameClass &&
        clasp != &js_AnyNameClass &&
        !JS_InstanceOf(cx, obj, &js_QNameClass.base, vp + 2)) {
            return JS_FALSE;
    }

    uri = GetURI(obj);
    if (!uri) {
        /* No uri means wildcard qualifier. */
        str = ATOM_TO_STRING(cx->runtime->atomState.starQualifierAtom);
    } else if (IS_EMPTY(uri)) {
        /* Empty string for uri means localName is in no namespace. */
        str = cx->runtime->emptyString;
    } else {
        qualstr = ATOM_TO_STRING(cx->runtime->atomState.qualifierAtom);
        str = js_ConcatStrings(cx, uri, qualstr);
        if (!str)
            return JS_FALSE;
    }
    str = js_ConcatStrings(cx, str, GetLocalName(obj));
    if (!str)
        return JS_FALSE;

    if (str && clasp == &js_AttributeNameClass) {
        length = JSSTRING_LENGTH(str);
        chars = (jschar *) JS_malloc(cx, (length + 2) * sizeof(jschar));
        if (!chars)
            return JS_FALSE;
        *chars = '@';
        js_strncpy(chars + 1, JSSTRING_CHARS(str), length);
        chars[++length] = 0;
        str = js_NewString(cx, chars, length);
        if (!str) {
            JS_free(cx, chars);
            return JS_FALSE;
        }
    }

    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSFunctionSpec qname_methods[] = {
    JS_FN(js_toString_str,  qname_toString,    0,0),
    JS_FS_END
};


static void
InitXMLQName(JSObject *obj, JSString *uri, JSString *prefix,
             JSString *localName)
{
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_PREFIX]));
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_URI]));
    JS_ASSERT(JSVAL_IS_VOID(obj->fslots[JSSLOT_LOCAL_NAME]));
    if (uri)
        obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(uri);
    if (prefix)
        obj->fslots[JSSLOT_PREFIX] = STRING_TO_JSVAL(prefix);
    if (localName)
        obj->fslots[JSSLOT_LOCAL_NAME] = STRING_TO_JSVAL(localName);
}

static JSObject *
NewXMLQName(JSContext *cx, JSString *uri, JSString *prefix, JSString *localName,
            JSClass *clasp = &js_QNameClass.base)
{
    JSObject *obj;

    JS_ASSERT(IsQNameClass(clasp));
    obj = js_NewObject(cx, clasp, NULL, NULL, 0);
    if (!obj)
        return NULL;
    InitXMLQName(obj, uri, prefix, localName);
    METER(xml_stats.qname);
    return obj;
}

JSObject *
js_ConstructXMLQNameObject(JSContext *cx, jsval nsval, jsval lnval)
{
    jsval argv[2];

    /*
     * ECMA-357 11.1.2,
     * The _QualifiedIdentifier : PropertySelector :: PropertySelector_
     * production, step 2.
     */
    if (!JSVAL_IS_PRIMITIVE(nsval) &&
        OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(nsval)) == &js_AnyNameClass) {
        nsval = JSVAL_NULL;
    }

    argv[0] = nsval;
    argv[1] = lnval;
    return js_ConstructObject(cx, &js_QNameClass.base, NULL, NULL, 2, argv);
}

static JSBool
IsXMLName(const jschar *cp, size_t n)
{
    JSBool rv;
    jschar c;

    rv = JS_FALSE;
    if (n != 0 && JS_ISXMLNSSTART(*cp)) {
        while (--n != 0) {
            c = *++cp;
            if (!JS_ISXMLNS(c))
                return rv;
        }
        rv = JS_TRUE;
    }
    return rv;
}

JSBool
js_IsXMLName(JSContext *cx, jsval v)
{
    JSString *name;
    JSErrorReporter older;

    /*
     * Inline specialization of the QName constructor called with v passed as
     * the only argument, to compute the localName for the constructed qname,
     * without actually allocating the object or computing its uri and prefix.
     * See ECMA-357 13.1.2.1 step 1 and 13.3.2.
     */
    if (!JSVAL_IS_PRIMITIVE(v) &&
        IsQNameClass(OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(v)))) {
        name = GetLocalName(JSVAL_TO_OBJECT(v));
    } else {
        older = JS_SetErrorReporter(cx, NULL);
        name = js_ValueToString(cx, v);
        JS_SetErrorReporter(cx, older);
        if (!name) {
            JS_ClearPendingException(cx);
            return JS_FALSE;
        }
    }

    return IsXMLName(JSSTRING_CHARS(name), JSSTRING_LENGTH(name));
}

/*
 * When argc is -1, it indicates argv is empty but the code should behave as
 * if argc is 1 and argv[0] is JSVAL_VOID.
 */
static JSBool
NamespaceHelper(JSContext *cx, JSObject *obj, intN argc, jsval *argv,
                jsval *rval)
{
    jsval urival, prefixval;
    JSObject *uriobj;
    JSBool isNamespace, isQName;
    JSClass *clasp;
    JSString *empty, *uri, *prefix;

    isNamespace = isQName = JS_FALSE;
#ifdef __GNUC__         /* suppress bogus gcc warnings */
    uriobj = NULL;
#endif
    if (argc <= 0) {
        urival = JSVAL_VOID;
    } else {
        urival = argv[argc > 1];
        if (!JSVAL_IS_PRIMITIVE(urival)) {
            uriobj = JSVAL_TO_OBJECT(urival);
            clasp = OBJ_GET_CLASS(cx, uriobj);
            isNamespace = (clasp == &js_NamespaceClass.base);
            isQName = (clasp == &js_QNameClass.base);
        }
    }

    if (!obj) {
        /* Namespace called as function. */
        if (argc == 1 && isNamespace) {
            /* Namespace called with one Namespace argument is identity. */
            *rval = urival;
            return JS_TRUE;
        }

        obj = js_NewObject(cx, &js_NamespaceClass.base, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;
        *rval = OBJECT_TO_JSVAL(obj);
    }
    METER(xml_stats.xmlnamespace);

    empty = cx->runtime->emptyString;
    obj->fslots[JSSLOT_PREFIX] = STRING_TO_JSVAL(empty);
    obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(empty);

    if (argc == 1 || argc == -1) {
        if (isNamespace) {
            obj->fslots[JSSLOT_URI] = uriobj->fslots[JSSLOT_URI];
            obj->fslots[JSSLOT_PREFIX] = uriobj->fslots[JSSLOT_PREFIX];
        } else if (isQName && (uri = GetURI(uriobj))) {
            obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(uri);
            obj->fslots[JSSLOT_PREFIX] = uriobj->fslots[JSSLOT_PREFIX];
        } else {
            uri = js_ValueToString(cx, urival);
            if (!uri)
                return JS_FALSE;
            obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(uri);
            if (!IS_EMPTY(uri))
                obj->fslots[JSSLOT_PREFIX] = JSVAL_VOID;
        }
    } else if (argc == 2) {
        if (!isQName || !(uri = GetURI(uriobj))) {
            uri = js_ValueToString(cx, urival);
            if (!uri)
                return JS_FALSE;
        }
        obj->fslots[JSSLOT_URI] = STRING_TO_JSVAL(uri);

        prefixval = argv[0];
        if (IS_EMPTY(uri)) {
            if (!JSVAL_IS_VOID(prefixval)) {
                prefix = js_ValueToString(cx, prefixval);
                if (!prefix)
                    return JS_FALSE;
                if (!IS_EMPTY(prefix)) {
                    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                         JSMSG_BAD_XML_NAMESPACE,
                                         js_ValueToPrintableString(cx,
                                             STRING_TO_JSVAL(prefix)));
                    return JS_FALSE;
                }
            }
        } else if (JSVAL_IS_VOID(prefixval) || !js_IsXMLName(cx, prefixval)) {
            obj->fslots[JSSLOT_PREFIX] = JSVAL_VOID;
        } else {
            prefix = js_ValueToString(cx, prefixval);
            if (!prefix)
                return JS_FALSE;
            obj->fslots[JSSLOT_PREFIX] = STRING_TO_JSVAL(prefix);
        }
    }

    return JS_TRUE;
}

static JSBool
Namespace(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    return NamespaceHelper(cx,
                           (cx->fp->flags & JSFRAME_CONSTRUCTING) ? obj : NULL,
                           argc, argv, rval);
}

/*
 * When argc is -1, it indicates argv is empty but the code should behave as
 * if argc is 1 and argv[0] is JSVAL_VOID.
 */
static JSBool
QNameHelper(JSContext *cx, JSObject *obj, JSClass *clasp, intN argc,
            jsval *argv, jsval *rval)
{
    jsval nameval, nsval;
    JSBool isQName, isNamespace;
    JSObject *qn;
    JSString *uri, *prefix, *name;
    JSObject *obj2;

    JS_ASSERT(clasp == &js_QNameClass.base ||
              clasp == &js_AttributeNameClass);
    if (argc <= 0) {
        nameval = JSVAL_VOID;
        isQName = JS_FALSE;
    } else {
        nameval = argv[argc > 1];
        isQName =
            !JSVAL_IS_PRIMITIVE(nameval) &&
            OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(nameval)) == &js_QNameClass.base;
    }

    if (!obj) {
        /* QName called as function. */
        if (argc == 1 && isQName) {
            /* QName called with one QName argument is identity. */
            *rval = nameval;
            return JS_TRUE;
        }

        /*
         * Create and return a new QName or AttributeName object exactly as if
         * constructed.
         */
        obj = js_NewObject(cx, clasp, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;
        *rval = OBJECT_TO_JSVAL(obj);
    }
    METER(xml_stats.qname);

    if (isQName) {
        /* If namespace is not specified and name is a QName, clone it. */
        qn = JSVAL_TO_OBJECT(nameval);
        if (argc == 1) {
            uri = GetURI(qn);
            prefix = GetPrefix(qn);
            name = GetLocalName(qn);
            goto out;
        }

        /* Namespace and qname were passed -- use the qname's localName. */
        nameval = qn->fslots[JSSLOT_LOCAL_NAME];
    }

    if (argc == 0) {
        name = cx->runtime->emptyString;
    } else if (argc < 0) {
        name = ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_VOID]);
    } else {
        name = js_ValueToString(cx, nameval);
        if (!name)
            return JS_FALSE;
        argv[argc > 1] = STRING_TO_JSVAL(name);
    }

    if (argc > 1 && !JSVAL_IS_VOID(argv[0])) {
        nsval = argv[0];
    } else if (IS_STAR(name)) {
        nsval = JSVAL_NULL;
    } else {
        if (!js_GetDefaultXMLNamespace(cx, &nsval))
            return JS_FALSE;
        JS_ASSERT(!JSVAL_IS_PRIMITIVE(nsval));
        JS_ASSERT(OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(nsval)) ==
                  &js_NamespaceClass.base);
    }

    if (JSVAL_IS_NULL(nsval)) {
        /* NULL prefix represents *undefined* in ECMA-357 13.3.2 5(a). */
        uri = prefix = NULL;
    } else {
        /*
         * Inline specialization of the Namespace constructor called with
         * nsval passed as the only argument, to compute the uri and prefix
         * for the constructed namespace, without actually allocating the
         * object or computing other members.  See ECMA-357 13.3.2 6(a) and
         * 13.2.2.
         */
        isNamespace = isQName = JS_FALSE;
        if (!JSVAL_IS_PRIMITIVE(nsval)) {
            obj2 = JSVAL_TO_OBJECT(nsval);
            clasp = OBJ_GET_CLASS(cx, obj2);
            isNamespace = (clasp == &js_NamespaceClass.base);
            isQName = (clasp == &js_QNameClass.base);
        }
#ifdef __GNUC__         /* suppress bogus gcc warnings */
        else obj2 = NULL;
#endif

        if (isNamespace) {
            uri = GetURI(obj2);
            prefix = GetPrefix(obj2);
        } else if (isQName && (uri = GetURI(obj2))) {
            JS_ASSERT(argc > 1);
            prefix = GetPrefix(obj2);
        } else {
            JS_ASSERT(argc > 1);
            uri = js_ValueToString(cx, nsval);
            if (!uri)
                return JS_FALSE;
            argv[0] = STRING_TO_JSVAL(uri);     /* local root */

            /* NULL here represents *undefined* in ECMA-357 13.2.2 3(c)iii. */
            prefix = IS_EMPTY(uri) ? cx->runtime->emptyString : NULL;
        }
    }

out:
    InitXMLQName(obj, uri, prefix, name);
    return JS_TRUE;
}

static JSBool
QName(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    return QNameHelper(cx, (cx->fp->flags & JSFRAME_CONSTRUCTING) ? obj : NULL,
                       &js_QNameClass.base, argc, argv, rval);
}

static JSBool
AttributeName(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
              jsval *rval)
{
    return QNameHelper(cx, (cx->fp->flags & JSFRAME_CONSTRUCTING) ? obj : NULL,
                       &js_AttributeNameClass, argc, argv, rval);
}

/*
 * XMLArray library functions.
 */
static JSBool
namespace_identity(const void *a, const void *b)
{
    const JSObject *nsa = (const JSObject *) a;
    const JSObject *nsb = (const JSObject *) b;
    JSString *prefixa = GetPrefix(nsa);
    JSString *prefixb = GetPrefix(nsb);

    if (prefixa && prefixb) {
        if (!js_EqualStrings(prefixa, prefixb))
            return JS_FALSE;
    } else {
        if (prefixa || prefixb)
            return JS_FALSE;
    }
    return js_EqualStrings(GetURI(nsa), GetURI(nsb));
}

static JSBool
attr_identity(const void *a, const void *b)
{
    const JSXML *xmla = (const JSXML *) a;
    const JSXML *xmlb = (const JSXML *) b;

    return qname_identity(xmla->name, xmlb->name);
}

static void
XMLArrayCursorInit(JSXMLArrayCursor *cursor, JSXMLArray *array)
{
    JSXMLArrayCursor *next;

    cursor->array = array;
    cursor->index = 0;
    next = cursor->next = array->cursors;
    if (next)
        next->prevp = &cursor->next;
    cursor->prevp = &array->cursors;
    array->cursors = cursor;
    cursor->root = NULL;
}

static void
XMLArrayCursorFinish(JSXMLArrayCursor *cursor)
{
    JSXMLArrayCursor *next;

    if (!cursor->array)
        return;
    next = cursor->next;
    if (next)
        next->prevp = cursor->prevp;
    *cursor->prevp = next;
    cursor->array = NULL;
}

static void *
XMLArrayCursorNext(JSXMLArrayCursor *cursor)
{
    JSXMLArray *array;

    array = cursor->array;
    if (!array || cursor->index >= array->length)
        return NULL;
    return cursor->root = array->vector[cursor->index++];
}

static void *
XMLArrayCursorItem(JSXMLArrayCursor *cursor)
{
    JSXMLArray *array;

    array = cursor->array;
    if (!array || cursor->index >= array->length)
        return NULL;
    return cursor->root = array->vector[cursor->index];
}

static void
XMLArrayCursorTrace(JSTracer *trc, JSXMLArrayCursor *cursor)
{
    void *root;
#ifdef DEBUG
    size_t index = 0;
#endif

    for (; cursor; cursor = cursor->next) {
        root = cursor->root;
        JS_SET_TRACING_INDEX(trc, "cursor_root", index++);
        js_CallValueTracerIfGCThing(trc, (jsval)root);
    }
}

/* NB: called with null cx from the GC, via xml_trace => XMLArrayTrim. */
static JSBool
XMLArraySetCapacity(JSContext *cx, JSXMLArray *array, uint32 capacity)
{
    void **vector;

    if (capacity == 0) {
        /* We could let realloc(p, 0) free this, but purify gets confused. */
        if (array->vector)
            free(array->vector);
        vector = NULL;
    } else {
        if (
#if JS_BITS_PER_WORD == 32
            (size_t)capacity > ~(size_t)0 / sizeof(void *) ||
#endif
            !(vector = (void **)
                       realloc(array->vector, capacity * sizeof(void *)))) {
            if (cx)
                JS_ReportOutOfMemory(cx);
            return JS_FALSE;
        }
    }
    array->capacity = JSXML_PRESET_CAPACITY | capacity;
    array->vector = vector;
    return JS_TRUE;
}

static void
XMLArrayTrim(JSXMLArray *array)
{
    if (array->capacity & JSXML_PRESET_CAPACITY)
        return;
    if (array->length < array->capacity)
        XMLArraySetCapacity(NULL, array, array->length);
}

static JSBool
XMLArrayInit(JSContext *cx, JSXMLArray *array, uint32 capacity)
{
    array->length = array->capacity = 0;
    array->vector = NULL;
    array->cursors = NULL;
    return capacity == 0 || XMLArraySetCapacity(cx, array, capacity);
}

static void
XMLArrayFinish(JSContext *cx, JSXMLArray *array)
{
    JSXMLArrayCursor *cursor;

    JS_free(cx, array->vector);

    while ((cursor = array->cursors) != NULL)
        XMLArrayCursorFinish(cursor);

#ifdef DEBUG
    memset(array, 0xd5, sizeof *array);
#endif
}

#define XML_NOT_FOUND   ((uint32) -1)

static uint32
XMLArrayFindMember(const JSXMLArray *array, void *elt, JSIdentityOp identity)
{
    void **vector;
    uint32 i, n;

    /* The identity op must not reallocate array->vector. */
    vector = array->vector;
    if (identity) {
        for (i = 0, n = array->length; i < n; i++) {
            if (identity(vector[i], elt))
                return i;
        }
    } else {
        for (i = 0, n = array->length; i < n; i++) {
            if (vector[i] == elt)
                return i;
        }
    }
    return XML_NOT_FOUND;
}

/*
 * Grow array vector capacity by powers of two to LINEAR_THRESHOLD, and after
 * that, grow by LINEAR_INCREMENT.  Both must be powers of two, and threshold
 * should be greater than increment.
 */
#define LINEAR_THRESHOLD        256
#define LINEAR_INCREMENT        32

static JSBool
XMLArrayAddMember(JSContext *cx, JSXMLArray *array, uint32 index, void *elt)
{
    uint32 capacity, i;
    int log2;
    void **vector;

    if (index >= array->length) {
        if (index >= JSXML_CAPACITY(array)) {
            /* Arrange to clear JSXML_PRESET_CAPACITY from array->capacity. */
            capacity = index + 1;
            if (index >= LINEAR_THRESHOLD) {
                capacity = JS_ROUNDUP(capacity, LINEAR_INCREMENT);
            } else {
                JS_CEILING_LOG2(log2, capacity);
                capacity = JS_BIT(log2);
            }
            if (
#if JS_BITS_PER_WORD == 32
                (size_t)capacity > ~(size_t)0 / sizeof(void *) ||
#endif
                !(vector = (void **)
                           realloc(array->vector, capacity * sizeof(void *)))) {
                JS_ReportOutOfMemory(cx);
                return JS_FALSE;
            }
            array->capacity = capacity;
            array->vector = vector;
            for (i = array->length; i < index; i++)
                vector[i] = NULL;
        }
        array->length = index + 1;
    }

    array->vector[index] = elt;
    return JS_TRUE;
}

static JSBool
XMLArrayInsert(JSContext *cx, JSXMLArray *array, uint32 i, uint32 n)
{
    uint32 j;
    JSXMLArrayCursor *cursor;

    j = array->length;
    JS_ASSERT(i <= j);
    if (!XMLArraySetCapacity(cx, array, j + n))
        return JS_FALSE;

    array->length = j + n;
    JS_ASSERT(n != (uint32)-1);
    while (j != i) {
        --j;
        array->vector[j + n] = array->vector[j];
    }

    for (cursor = array->cursors; cursor; cursor = cursor->next) {
        if (cursor->index > i)
            cursor->index += n;
    }
    return JS_TRUE;
}

static void *
XMLArrayDelete(JSContext *cx, JSXMLArray *array, uint32 index, JSBool compress)
{
    uint32 length;
    void **vector, *elt;
    JSXMLArrayCursor *cursor;

    length = array->length;
    if (index >= length)
        return NULL;

    vector = array->vector;
    elt = vector[index];
    if (compress) {
        while (++index < length)
            vector[index-1] = vector[index];
        array->length = length - 1;
        array->capacity = JSXML_CAPACITY(array);
    } else {
        vector[index] = NULL;
    }

    for (cursor = array->cursors; cursor; cursor = cursor->next) {
        if (cursor->index > index)
            --cursor->index;
    }
    return elt;
}

static void
XMLArrayTruncate(JSContext *cx, JSXMLArray *array, uint32 length)
{
    void **vector;

    JS_ASSERT(!array->cursors);
    if (length >= array->length)
        return;

    if (length == 0) {
        if (array->vector)
            free(array->vector);
        vector = NULL;
    } else {
        vector = (void **) realloc(array->vector, length * sizeof(void *));
        if (!vector)
            return;
    }

    if (array->length > length)
        array->length = length;
    array->capacity = length;
    array->vector = vector;
}

#define XMLARRAY_FIND_MEMBER(a,e,f) XMLArrayFindMember(a, (void *)(e), f)
#define XMLARRAY_HAS_MEMBER(a,e,f)  (XMLArrayFindMember(a, (void *)(e), f) != \
                                     XML_NOT_FOUND)
#define XMLARRAY_MEMBER(a,i,t)      (((i) < (a)->length)                      \
                                     ? (t *) (a)->vector[i]                   \
                                     : NULL)
#define XMLARRAY_SET_MEMBER(a,i,e)  JS_BEGIN_MACRO                            \
                                        if ((a)->length <= (i))               \
                                            (a)->length = (i) + 1;            \
                                        ((a)->vector[i] = (void *)(e));       \
                                    JS_END_MACRO
#define XMLARRAY_ADD_MEMBER(x,a,i,e)XMLArrayAddMember(x, a, i, (void *)(e))
#define XMLARRAY_INSERT(x,a,i,n)    XMLArrayInsert(x, a, i, n)
#define XMLARRAY_APPEND(x,a,e)      XMLARRAY_ADD_MEMBER(x, a, (a)->length, (e))
#define XMLARRAY_DELETE(x,a,i,c,t)  ((t *) XMLArrayDelete(x, a, i, c))
#define XMLARRAY_TRUNCATE(x,a,n)    XMLArrayTruncate(x, a, n)

/*
 * Define XML setting property strings and constants early, so everyone can
 * use the same names and their magic numbers (tinyids, flags).
 */
static const char js_ignoreComments_str[]   = "ignoreComments";
static const char js_ignoreProcessingInstructions_str[]
                                            = "ignoreProcessingInstructions";
static const char js_ignoreWhitespace_str[] = "ignoreWhitespace";
static const char js_prettyPrinting_str[]   = "prettyPrinting";
static const char js_prettyIndent_str[]     = "prettyIndent";

/*
 * NB: These XML static property tinyids must
 * (a) not collide with the generic negative tinyids at the top of jsfun.c;
 * (b) index their corresponding xml_static_props array elements.
 * Don't change 'em!
 */
enum xml_static_tinyid {
    XML_IGNORE_COMMENTS,
    XML_IGNORE_PROCESSING_INSTRUCTIONS,
    XML_IGNORE_WHITESPACE,
    XML_PRETTY_PRINTING,
    XML_PRETTY_INDENT
};

static JSBool
xml_setting_getter(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    return JS_TRUE;
}

static JSBool
xml_setting_setter(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    uint8 flag;

    JS_ASSERT(JSVAL_IS_INT(id));

    flag = JS_BIT(JSVAL_TO_INT(id));
    if (js_ValueToBoolean(*vp))
        cx->xmlSettingFlags |= flag;
    else
        cx->xmlSettingFlags &= ~flag;
    return JS_TRUE;
}

static JSPropertySpec xml_static_props[] = {
    {js_ignoreComments_str,     XML_IGNORE_COMMENTS,   JSPROP_PERMANENT,
                                xml_setting_getter, xml_setting_setter},
    {js_ignoreProcessingInstructions_str,
                   XML_IGNORE_PROCESSING_INSTRUCTIONS, JSPROP_PERMANENT,
                                xml_setting_getter, xml_setting_setter},
    {js_ignoreWhitespace_str,   XML_IGNORE_WHITESPACE, JSPROP_PERMANENT,
                                xml_setting_getter, xml_setting_setter},
    {js_prettyPrinting_str,     XML_PRETTY_PRINTING,   JSPROP_PERMANENT,
                                xml_setting_getter, xml_setting_setter},
    {js_prettyIndent_str,       XML_PRETTY_INDENT,     JSPROP_PERMANENT,
                                xml_setting_getter, NULL},
    {0,0,0,0,0}
};

/* Derive cx->xmlSettingFlags bits from xml_static_props tinyids. */
#define XSF_IGNORE_COMMENTS     JS_BIT(XML_IGNORE_COMMENTS)
#define XSF_IGNORE_PROCESSING_INSTRUCTIONS                                    \
                                JS_BIT(XML_IGNORE_PROCESSING_INSTRUCTIONS)
#define XSF_IGNORE_WHITESPACE   JS_BIT(XML_IGNORE_WHITESPACE)
#define XSF_PRETTY_PRINTING     JS_BIT(XML_PRETTY_PRINTING)
#define XSF_CACHE_VALID         JS_BIT(XML_PRETTY_INDENT)

/*
 * Extra, unrelated but necessarily disjoint flag used by ParseNodeToXML.
 * This flag means a couple of things:
 *
 * - The top JSXML created for a parse tree must have an object owning it.
 *
 * - That the default namespace normally inherited from the temporary
 *   <parent xmlns='...'> tag that wraps a runtime-concatenated XML source
 *   string must, in the case of a precompiled XML object tree, inherit via
 *   ad-hoc code in ParseNodeToXML.
 *
 * Because of the second purpose, we name this flag XSF_PRECOMPILED_ROOT.
 */
#define XSF_PRECOMPILED_ROOT    (XSF_CACHE_VALID << 1)

/* Macros for special-casing xml:, xmlns= and xmlns:foo= in ParseNodeToQName. */
#define IS_XML(str)                                                           \
    (JSSTRING_LENGTH(str) == 3 && IS_XML_CHARS(JSSTRING_CHARS(str)))

#define IS_XMLNS(str)                                                         \
    (JSSTRING_LENGTH(str) == 5 && IS_XMLNS_CHARS(JSSTRING_CHARS(str)))

#define IS_XML_CHARS(chars)                                                   \
    (JS_TOLOWER((chars)[0]) == 'x' &&                                         \
     JS_TOLOWER((chars)[1]) == 'm' &&                                         \
     JS_TOLOWER((chars)[2]) == 'l')

#define HAS_NS_AFTER_XML(chars)                                               \
    (JS_TOLOWER((chars)[3]) == 'n' &&                                         \
     JS_TOLOWER((chars)[4]) == 's')

#define IS_XMLNS_CHARS(chars)                                                 \
    (IS_XML_CHARS(chars) && HAS_NS_AFTER_XML(chars))

#define STARTS_WITH_XML(chars,length)                                         \
    (length >= 3 && IS_XML_CHARS(chars))

static const char xml_namespace_str[] = "http://www.w3.org/XML/1998/namespace";
static const char xmlns_namespace_str[] = "http://www.w3.org/2000/xmlns/";

static JSObject *
ParseNodeToQName(JSContext *cx, JSParseContext *pc, JSParseNode *pn,
                 JSXMLArray *inScopeNSes, JSBool isAttributeName)
{
    JSString *str, *uri, *prefix, *localName;
    size_t length, offset;
    const jschar *start, *limit, *colon;
    uint32 n;
    JSObject *ns;
    JSString *nsprefix;

    JS_ASSERT(pn->pn_arity == PN_NULLARY);
    str = ATOM_TO_STRING(pn->pn_atom);
    JSSTRING_CHARS_AND_LENGTH(str, start, length);
    JS_ASSERT(length != 0 && *start != '@');
    JS_ASSERT(length != 1 || *start != '*');

    uri = cx->runtime->emptyString;
    limit = start + length;
    colon = js_strchr_limit(start, ':', limit);
    if (colon) {
        offset = PTRDIFF(colon, start, jschar);
        prefix = js_NewDependentString(cx, str, 0, offset);
        if (!prefix)
            return NULL;

        if (STARTS_WITH_XML(start, offset)) {
            if (offset == 3) {
                uri = JS_InternString(cx, xml_namespace_str);
                if (!uri)
                    return NULL;
            } else if (offset == 5 && HAS_NS_AFTER_XML(start)) {
                uri = JS_InternString(cx, xmlns_namespace_str);
                if (!uri)
                    return NULL;
            } else {
                uri = NULL;
            }
        } else {
            uri = NULL;
            n = inScopeNSes->length;
            while (n != 0) {
                --n;
                ns = XMLARRAY_MEMBER(inScopeNSes, n, JSObject);
                nsprefix = GetPrefix(ns);
                if (nsprefix && js_EqualStrings(nsprefix, prefix)) {
                    uri = GetURI(ns);
                    break;
                }
            }
        }

        if (!uri) {
            js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn,
                                        JSREPORT_ERROR,
                                        JSMSG_BAD_XML_NAMESPACE,
                                        js_ValueToPrintableString(cx,
                                            STRING_TO_JSVAL(prefix)));
            return NULL;
        }

        localName = js_NewStringCopyN(cx, colon + 1, length - (offset + 1));
        if (!localName)
            return NULL;
    } else {
        if (isAttributeName) {
            /*
             * An unprefixed attribute is not in any namespace, so set prefix
             * as well as uri to the empty string.
             */
            prefix = uri;
        } else {
            /*
             * Loop from back to front looking for the closest declared default
             * namespace.
             */
            n = inScopeNSes->length;
            while (n != 0) {
                --n;
                ns = XMLARRAY_MEMBER(inScopeNSes, n, JSObject);
                nsprefix = GetPrefix(ns);
                if (!nsprefix || IS_EMPTY(nsprefix)) {
                    uri = GetURI(ns);
                    break;
                }
            }
            prefix = IS_EMPTY(uri) ? cx->runtime->emptyString : NULL;
        }
        localName = str;
    }

    return NewXMLQName(cx, uri, prefix, localName);
}

static JSString *
ChompXMLWhitespace(JSContext *cx, JSString *str)
{
    size_t length, newlength, offset;
    const jschar *cp, *start, *end;
    jschar c;

    JSSTRING_CHARS_AND_LENGTH(str, start, length);
    for (cp = start, end = cp + length; cp < end; cp++) {
        c = *cp;
        if (!JS_ISXMLSPACE(c))
            break;
    }
    while (end > cp) {
        c = end[-1];
        if (!JS_ISXMLSPACE(c))
            break;
        --end;
    }
    newlength = PTRDIFF(end, cp, jschar);
    if (newlength == length)
        return str;
    offset = PTRDIFF(cp, start, jschar);
    return js_NewDependentString(cx, str, offset, newlength);
}

static JSXML *
ParseNodeToXML(JSContext *cx, JSParseContext *pc, JSParseNode *pn,
               JSXMLArray *inScopeNSes, uintN flags)
{
    JSXML *xml, *kid, *attr, *attrj;
    JSString *str;
    uint32 length, n, i, j;
    JSParseNode *pn2, *pn3, *head, **pnp;
    JSObject *ns;
    JSObject *qn, *attrjqn;
    JSXMLClass xml_class;
    int stackDummy;

    if (!JS_CHECK_STACK_SIZE(cx, stackDummy)) {
        js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn, JSREPORT_ERROR,
                                    JSMSG_OVER_RECURSED);
        return NULL;
    }

#define PN2X_SKIP_CHILD ((JSXML *) 1)

    /*
     * Cases return early to avoid common code that gets an outermost xml's
     * object, which protects GC-things owned by xml and its descendants from
     * garbage collection.
     */
    xml = NULL;
    if (!js_EnterLocalRootScope(cx))
        return NULL;
    switch (pn->pn_type) {
      case TOK_XMLELEM:
        length = inScopeNSes->length;
        pn2 = pn->pn_head;
        xml = ParseNodeToXML(cx, pc, pn2, inScopeNSes, flags);
        if (!xml)
            goto fail;

        flags &= ~XSF_PRECOMPILED_ROOT;
        n = pn->pn_count;
        JS_ASSERT(n >= 2);
        n -= 2;
        if (!XMLArraySetCapacity(cx, &xml->xml_kids, n))
            goto fail;

        i = 0;
        while ((pn2 = pn2->pn_next) != NULL) {
            if (!pn2->pn_next) {
                /* Don't append the end tag! */
                JS_ASSERT(pn2->pn_type == TOK_XMLETAGO);
                break;
            }

            if ((flags & XSF_IGNORE_WHITESPACE) &&
                n > 1 && pn2->pn_type == TOK_XMLSPACE) {
                --n;
                continue;
            }

            kid = ParseNodeToXML(cx, pc, pn2, inScopeNSes, flags);
            if (kid == PN2X_SKIP_CHILD) {
                --n;
                continue;
            }

            if (!kid)
                goto fail;

            /* Store kid in xml right away, to protect it from GC. */
            XMLARRAY_SET_MEMBER(&xml->xml_kids, i, kid);
            kid->parent = xml;
            ++i;

            /* XXX where is this documented in an XML spec, or in E4X? */
            if ((flags & XSF_IGNORE_WHITESPACE) &&
                n > 1 && kid->xml_class == JSXML_CLASS_TEXT) {
                str = ChompXMLWhitespace(cx, kid->xml_value);
                if (!str)
                    goto fail;
                kid->xml_value = str;
            }
        }

        JS_ASSERT(i == n);
        if (n < pn->pn_count - 2)
            XMLArrayTrim(&xml->xml_kids);
        XMLARRAY_TRUNCATE(cx, inScopeNSes, length);
        break;

      case TOK_XMLLIST:
        xml = js_NewXML(cx, JSXML_CLASS_LIST);
        if (!xml)
            goto fail;

        n = pn->pn_count;
        if (!XMLArraySetCapacity(cx, &xml->xml_kids, n))
            goto fail;

        i = 0;
        for (pn2 = pn->pn_head; pn2; pn2 = pn2->pn_next) {
            /*
             * Always ignore insignificant whitespace in lists -- we shouldn't
             * condition this on an XML.ignoreWhitespace setting when the list
             * constructor is XMLList (note XML/XMLList unification hazard).
             */
            if (pn2->pn_type == TOK_XMLSPACE) {
                --n;
                continue;
            }

            kid = ParseNodeToXML(cx, pc, pn2, inScopeNSes, flags);
            if (kid == PN2X_SKIP_CHILD) {
                --n;
                continue;
            }

            if (!kid)
                goto fail;

            XMLARRAY_SET_MEMBER(&xml->xml_kids, i, kid);
            ++i;
        }

        if (n < pn->pn_count)
            XMLArrayTrim(&xml->xml_kids);
        break;

      case TOK_XMLSTAGO:
      case TOK_XMLPTAGC:
        length = inScopeNSes->length;
        pn2 = pn->pn_head;
        JS_ASSERT(pn2->pn_type == TOK_XMLNAME);
        if (pn2->pn_arity == PN_LIST)
            goto syntax;

        xml = js_NewXML(cx, JSXML_CLASS_ELEMENT);
        if (!xml)
            goto fail;

        /* First pass: check syntax and process namespace declarations. */
        JS_ASSERT(pn->pn_count >= 1);
        n = pn->pn_count - 1;
        pnp = &pn2->pn_next;
        head = *pnp;
        while ((pn2 = *pnp) != NULL) {
            size_t length;
            const jschar *chars;

            if (pn2->pn_type != TOK_XMLNAME || pn2->pn_arity != PN_NULLARY)
                goto syntax;

            /* Enforce "Well-formedness constraint: Unique Att Spec". */
            for (pn3 = head; pn3 != pn2; pn3 = pn3->pn_next->pn_next) {
                if (pn3->pn_atom == pn2->pn_atom) {
                    js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn2,
                                                JSREPORT_ERROR,
                                                JSMSG_DUPLICATE_XML_ATTR,
                                                js_ValueToPrintableString(cx,
                                                    ATOM_KEY(pn2->pn_atom)));
                    goto fail;
                }
            }

            str = ATOM_TO_STRING(pn2->pn_atom);
            pn2 = pn2->pn_next;
            JS_ASSERT(pn2);
            if (pn2->pn_type != TOK_XMLATTR)
                goto syntax;

            JSSTRING_CHARS_AND_LENGTH(str, chars, length);
            if (length >= 5 &&
                IS_XMLNS_CHARS(chars) &&
                (length == 5 || chars[5] == ':')) {
                JSString *uri, *prefix;

                uri = ATOM_TO_STRING(pn2->pn_atom);
                if (length == 5) {
                    /* 10.3.2.1. Step 6(h)(i)(1)(a). */
                    prefix = cx->runtime->emptyString;
                } else {
                    prefix = js_NewStringCopyN(cx, chars + 6, length - 6);
                    if (!prefix)
                        goto fail;
                }

                /*
                 * Once the new ns is appended to xml->xml_namespaces, it is
                 * protected from GC by the object that owns xml -- which is
                 * either xml->object if outermost, or the object owning xml's
                 * oldest ancestor if !outermost.
                 */
                ns = NewXMLNamespace(cx, prefix, uri, JS_TRUE);
                if (!ns)
                    goto fail;

                /*
                 * Don't add a namespace that's already in scope.  If someone
                 * extracts a child property from its parent via [[Get]], then
                 * we enforce the invariant, noted many times in ECMA-357, that
                 * the child's namespaces form a possibly-improper superset of
                 * its ancestors' namespaces.
                 */
                if (!XMLARRAY_HAS_MEMBER(inScopeNSes, ns, namespace_identity)) {
                    if (!XMLARRAY_APPEND(cx, inScopeNSes, ns) ||
                        !XMLARRAY_APPEND(cx, &xml->xml_namespaces, ns)) {
                        goto fail;
                    }
                }

                JS_ASSERT(n >= 2);
                n -= 2;
                *pnp = pn2->pn_next;
                /* XXXbe recycle pn2 */
                continue;
            }

            pnp = &pn2->pn_next;
        }

        /*
         * If called from js_ParseNodeToXMLObject, emulate the effect of the
         * <parent xmlns='%s'>...</parent> wrapping done by "ToXML Applied to
         * the String Type" (ECMA-357 10.3.1).
         */
        if (flags & XSF_PRECOMPILED_ROOT) {
            JS_ASSERT(length >= 1);
            ns = XMLARRAY_MEMBER(inScopeNSes, 0, JSObject);
            JS_ASSERT(!XMLARRAY_HAS_MEMBER(&xml->xml_namespaces, ns,
                                           namespace_identity));
            ns = NewXMLNamespace(cx, GetPrefix(ns), GetURI(ns), JS_FALSE);
            if (!ns)
                goto fail;
            if (!XMLARRAY_APPEND(cx, &xml->xml_namespaces, ns))
                goto fail;
        }
        XMLArrayTrim(&xml->xml_namespaces);

        /* Second pass: process tag name and attributes, using namespaces. */
        pn2 = pn->pn_head;
        qn = ParseNodeToQName(cx, pc, pn2, inScopeNSes, JS_FALSE);
        if (!qn)
            goto fail;
        xml->name = qn;

        JS_ASSERT((n & 1) == 0);
        n >>= 1;
        if (!XMLArraySetCapacity(cx, &xml->xml_attrs, n))
            goto fail;

        for (i = 0; (pn2 = pn2->pn_next) != NULL; i++) {
            qn = ParseNodeToQName(cx, pc, pn2, inScopeNSes, JS_TRUE);
            if (!qn) {
                xml->xml_attrs.length = i;
                goto fail;
            }

            /*
             * Enforce "Well-formedness constraint: Unique Att Spec", part 2:
             * this time checking local name and namespace URI.
             */
            for (j = 0; j < i; j++) {
                attrj = XMLARRAY_MEMBER(&xml->xml_attrs, j, JSXML);
                attrjqn = attrj->name;
                if (js_EqualStrings(GetURI(attrjqn), GetURI(qn)) &&
                    js_EqualStrings(GetLocalName(attrjqn), GetLocalName(qn))) {
                    js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn2,
                                                JSREPORT_ERROR,
                                                JSMSG_DUPLICATE_XML_ATTR,
                                                js_ValueToPrintableString(cx,
                                                    ATOM_KEY(pn2->pn_atom)));
                    goto fail;
                }
            }

            pn2 = pn2->pn_next;
            JS_ASSERT(pn2);
            JS_ASSERT(pn2->pn_type == TOK_XMLATTR);

            attr = js_NewXML(cx, JSXML_CLASS_ATTRIBUTE);
            if (!attr)
                goto fail;

            XMLARRAY_SET_MEMBER(&xml->xml_attrs, i, attr);
            attr->parent = xml;
            attr->name = qn;
            attr->xml_value = ATOM_TO_STRING(pn2->pn_atom);
        }

        /* Point tag closes its own namespace scope. */
        if (pn->pn_type == TOK_XMLPTAGC)
            XMLARRAY_TRUNCATE(cx, inScopeNSes, length);
        break;

      case TOK_XMLSPACE:
      case TOK_XMLTEXT:
      case TOK_XMLCDATA:
      case TOK_XMLCOMMENT:
      case TOK_XMLPI:
        str = ATOM_TO_STRING(pn->pn_atom);
        qn = NULL;
        if (pn->pn_type == TOK_XMLCOMMENT) {
            if (flags & XSF_IGNORE_COMMENTS)
                goto skip_child;
            xml_class = JSXML_CLASS_COMMENT;
        } else if (pn->pn_type == TOK_XMLPI) {
            if (IS_XML(str)) {
                js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn,
                                            JSREPORT_ERROR,
                                            JSMSG_RESERVED_ID,
                                            js_ValueToPrintableString(cx,
                                                STRING_TO_JSVAL(str)));
                goto fail;
            }

            if (flags & XSF_IGNORE_PROCESSING_INSTRUCTIONS)
                goto skip_child;

            qn = ParseNodeToQName(cx, pc, pn, inScopeNSes, JS_FALSE);
            if (!qn)
                goto fail;

            str = pn->pn_atom2
                  ? ATOM_TO_STRING(pn->pn_atom2)
                  : cx->runtime->emptyString;
            xml_class = JSXML_CLASS_PROCESSING_INSTRUCTION;
        } else {
            /* CDATA section content, or element text. */
            xml_class = JSXML_CLASS_TEXT;
        }

        xml = js_NewXML(cx, xml_class);
        if (!xml)
            goto fail;
        xml->name = qn;
        if (pn->pn_type == TOK_XMLSPACE)
            xml->xml_flags |= XMLF_WHITESPACE_TEXT;
        xml->xml_value = str;
        break;

      default:
        goto syntax;
    }

    js_LeaveLocalRootScopeWithResult(cx, (jsval) xml);
    if ((flags & XSF_PRECOMPILED_ROOT) && !js_GetXMLObject(cx, xml))
        return NULL;
    return xml;

skip_child:
    js_LeaveLocalRootScope(cx);
    return PN2X_SKIP_CHILD;

#undef PN2X_SKIP_CHILD

syntax:
    js_ReportCompileErrorNumber(cx, &pc->tokenStream, pn, JSREPORT_ERROR,
                                JSMSG_BAD_XML_MARKUP);
fail:
    js_LeaveLocalRootScope(cx);
    return NULL;
}

/*
 * XML helper, object-ops, and library functions.  We start with the helpers,
 * in ECMA-357 order, but merging XML (9.1) and XMLList (9.2) helpers.
 */
static JSBool
GetXMLSetting(JSContext *cx, const char *name, jsval *vp)
{
    jsval v;

    if (!js_FindClassObject(cx, NULL, INT_TO_JSID(JSProto_XML), &v))
        return JS_FALSE;
    if (!VALUE_IS_FUNCTION(cx, v)) {
        *vp = JSVAL_VOID;
        return JS_TRUE;
    }
    return JS_GetProperty(cx, JSVAL_TO_OBJECT(v), name, vp);
}

static JSBool
FillSettingsCache(JSContext *cx)
{
    int i;
    const char *name;
    jsval v;

    /* Note: XML_PRETTY_INDENT is not a boolean setting. */
    for (i = XML_IGNORE_COMMENTS; i < XML_PRETTY_INDENT; i++) {
        name = xml_static_props[i].name;
        if (!GetXMLSetting(cx, name, &v))
            return JS_FALSE;
        if (js_ValueToBoolean(v))
            cx->xmlSettingFlags |= JS_BIT(i);
        else
            cx->xmlSettingFlags &= ~JS_BIT(i);
    }

    cx->xmlSettingFlags |= XSF_CACHE_VALID;
    return JS_TRUE;
}

static JSBool
GetBooleanXMLSetting(JSContext *cx, const char *name, JSBool *bp)
{
    int i;

    if (!(cx->xmlSettingFlags & XSF_CACHE_VALID) && !FillSettingsCache(cx))
        return JS_FALSE;

    for (i = 0; xml_static_props[i].name; i++) {
        if (!strcmp(xml_static_props[i].name, name)) {
            *bp = (cx->xmlSettingFlags & JS_BIT(i)) != 0;
            return JS_TRUE;
        }
    }
    *bp = JS_FALSE;
    return JS_TRUE;
}

static JSBool
GetUint32XMLSetting(JSContext *cx, const char *name, uint32 *uip)
{
    jsval v;

    return GetXMLSetting(cx, name, &v) && JS_ValueToECMAUint32(cx, v, uip);
}

static JSBool
GetXMLSettingFlags(JSContext *cx, uintN *flagsp)
{
    JSBool flag;

    /* Just get the first flag to validate the setting flags cache. */
    if (!GetBooleanXMLSetting(cx, js_ignoreComments_str, &flag))
        return JS_FALSE;
    *flagsp = cx->xmlSettingFlags;
    return JS_TRUE;
}

static JSXML *
ParseXMLSource(JSContext *cx, JSString *src)
{
    jsval nsval;
    JSString *uri;
    size_t urilen, srclen, length, offset, dstlen;
    jschar *chars;
    const jschar *srcp, *endp;
    JSXML *xml;
    JSParseContext pc;
    const char *filename;
    uintN lineno;
    JSStackFrame *fp;
    JSOp op;
    JSParseNode *pn;
    JSXMLArray nsarray;
    uintN flags;

    static const char prefix[] = "<parent xmlns=\"";
    static const char middle[] = "\">";
    static const char suffix[] = "</parent>";

#define constrlen(constr)   (sizeof(constr) - 1)

    if (!js_GetDefaultXMLNamespace(cx, &nsval))
        return NULL;
    uri = GetURI(JSVAL_TO_OBJECT(nsval));
    uri = js_EscapeAttributeValue(cx, uri, JS_FALSE);

    urilen = JSSTRING_LENGTH(uri);
    srclen = JSSTRING_LENGTH(src);
    length = constrlen(prefix) + urilen + constrlen(middle) + srclen +
             constrlen(suffix);

    chars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
    if (!chars)
        return NULL;

    dstlen = length;
    js_InflateStringToBuffer(cx, prefix, constrlen(prefix), chars, &dstlen);
    offset = dstlen;
    js_strncpy(chars + offset, JSSTRING_CHARS(uri), urilen);
    offset += urilen;
    dstlen = length - offset + 1;
    js_InflateStringToBuffer(cx, middle, constrlen(middle), chars + offset,
                             &dstlen);
    offset += dstlen;
    srcp = JSSTRING_CHARS(src);
    js_strncpy(chars + offset, srcp, srclen);
    offset += srclen;
    dstlen = length - offset + 1;
    js_InflateStringToBuffer(cx, suffix, constrlen(suffix), chars + offset,
                             &dstlen);
    chars [offset + dstlen] = 0;

    xml = NULL;
    for (fp = cx->fp; fp && !fp->regs; fp = fp->down)
        JS_ASSERT(!fp->script);
    filename = NULL;
    lineno = 1;
    if (fp) {
        op = (JSOp) *fp->regs->pc;
        if (op == JSOP_TOXML || op == JSOP_TOXMLLIST) {
            filename = fp->script->filename;
            lineno = js_FramePCToLineNumber(cx, fp);
            for (endp = srcp + srclen; srcp < endp; srcp++) {
                if (*srcp == '\n')
                    --lineno;
            }
        }
    }

    if (!js_InitParseContext(cx, &pc, NULL, NULL, chars, length, NULL,
                             filename, lineno))
        goto out;
    pn = js_ParseXMLText(cx, cx->fp->scopeChain, &pc, JS_FALSE);
    if (pn && XMLArrayInit(cx, &nsarray, 1)) {
        if (GetXMLSettingFlags(cx, &flags))
            xml = ParseNodeToXML(cx, &pc, pn, &nsarray, flags);

        XMLArrayFinish(cx, &nsarray);
    }
    js_FinishParseContext(cx, &pc);

out:
    JS_free(cx, chars);
    return xml;

#undef constrlen
}

/*
 * Errata in 10.3.1, 10.4.1, and 13.4.4.24 (at least).
 *
 * 10.3.1 Step 6(a) fails to NOTE that implementations that do not enforce
 * the constraint:
 *
 *     for all x belonging to XML:
 *         x.[[InScopeNamespaces]] >= x.[[Parent]].[[InScopeNamespaces]]
 *
 * must union x.[[InScopeNamespaces]] into x[0].[[InScopeNamespaces]] here
 * (in new sub-step 6(a), renumbering the others to (b) and (c)).
 *
 * Same goes for 10.4.1 Step 7(a).
 *
 * In order for XML.prototype.namespaceDeclarations() to work correctly, the
 * default namespace thereby unioned into x[0].[[InScopeNamespaces]] must be
 * flagged as not declared, so that 13.4.4.24 Step 8(a) can exclude all such
 * undeclared namespaces associated with x not belonging to ancestorNS.
 */
static JSXML *
OrphanXMLChild(JSContext *cx, JSXML *xml, uint32 i)
{
    JSObject *ns;

    ns = XMLARRAY_MEMBER(&xml->xml_namespaces, 0, JSObject);
    xml = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
    if (!ns || !xml)
        return xml;
    if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        if (!XMLARRAY_APPEND(cx, &xml->xml_namespaces, ns))
            return NULL;
        ns->fslots[JSSLOT_DECLARED] = JSVAL_VOID;
    }
    xml->parent = NULL;
    return xml;
}

static JSObject *
ToXML(JSContext *cx, jsval v)
{
    JSObject *obj;
    JSXML *xml;
    JSClass *clasp;
    JSString *str;
    uint32 length;

    if (JSVAL_IS_PRIMITIVE(v)) {
        if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v))
            goto bad;
    } else {
        obj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, obj)) {
            xml = (JSXML *) JS_GetPrivate(cx, obj);
            if (xml->xml_class == JSXML_CLASS_LIST) {
                if (xml->xml_kids.length != 1)
                    goto bad;
                xml = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
                if (xml) {
                    JS_ASSERT(xml->xml_class != JSXML_CLASS_LIST);
                    return js_GetXMLObject(cx, xml);
                }
            }
            return obj;
        }

        clasp = OBJ_GET_CLASS(cx, obj);
        if (clasp->flags & JSCLASS_DOCUMENT_OBSERVER) {
            JS_ASSERT(0);
        }

        if (clasp != &js_StringClass &&
            clasp != &js_NumberClass &&
            clasp != &js_BooleanClass) {
            goto bad;
        }
    }

    str = js_ValueToString(cx, v);
    if (!str)
        return NULL;
    if (IS_EMPTY(str)) {
        length = 0;
#ifdef __GNUC__         /* suppress bogus gcc warnings */
        xml = NULL;
#endif
    } else {
        xml = ParseXMLSource(cx, str);
        if (!xml)
            return NULL;
        length = JSXML_LENGTH(xml);
    }

    if (length == 0) {
        obj = js_NewXMLObject(cx, JSXML_CLASS_TEXT);
        if (!obj)
            return NULL;
    } else if (length == 1) {
        xml = OrphanXMLChild(cx, xml, 0);
        if (!xml)
            return NULL;
        obj = js_GetXMLObject(cx, xml);
        if (!obj)
            return NULL;
    } else {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_SYNTAX_ERROR);
        return NULL;
    }
    return obj;

bad:
    js_ReportValueError(cx, JSMSG_BAD_XML_CONVERSION,
                        JSDVG_IGNORE_STACK, v, NULL);
    return NULL;
}

static JSBool
Append(JSContext *cx, JSXML *list, JSXML *kid);

static JSObject *
ToXMLList(JSContext *cx, jsval v)
{
    JSObject *obj, *listobj;
    JSXML *xml, *list, *kid;
    JSClass *clasp;
    JSString *str;
    uint32 i, length;

    if (JSVAL_IS_PRIMITIVE(v)) {
        if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v))
            goto bad;
    } else {
        obj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, obj)) {
            xml = (JSXML *) JS_GetPrivate(cx, obj);
            if (xml->xml_class != JSXML_CLASS_LIST) {
                listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
                if (!listobj)
                    return NULL;
                list = (JSXML *) JS_GetPrivate(cx, listobj);
                if (!Append(cx, list, xml))
                    return NULL;
                return listobj;
            }
            return obj;
        }

        clasp = OBJ_GET_CLASS(cx, obj);
        if (clasp->flags & JSCLASS_DOCUMENT_OBSERVER) {
            JS_ASSERT(0);
        }

        if (clasp != &js_StringClass &&
            clasp != &js_NumberClass &&
            clasp != &js_BooleanClass) {
            goto bad;
        }
    }

    str = js_ValueToString(cx, v);
    if (!str)
        return NULL;
    if (IS_EMPTY(str)) {
        xml = NULL;
        length = 0;
    } else {
        if (!js_EnterLocalRootScope(cx))
            return NULL;
        xml = ParseXMLSource(cx, str);
        if (!xml) {
            js_LeaveLocalRootScope(cx);
            return NULL;
        }
        length = JSXML_LENGTH(xml);
    }

    listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
    if (listobj) {
        list = (JSXML *) JS_GetPrivate(cx, listobj);
        for (i = 0; i < length; i++) {
            kid = OrphanXMLChild(cx, xml, i);
            if (!kid || !Append(cx, list, kid)) {
                listobj = NULL;
                break;
            }
        }
    }

    if (xml)
        js_LeaveLocalRootScopeWithResult(cx, (jsval) listobj);
    return listobj;

bad:
    js_ReportValueError(cx, JSMSG_BAD_XMLLIST_CONVERSION,
                        JSDVG_IGNORE_STACK, v, NULL);
    return NULL;
}

/*
 * ECMA-357 10.2.1 Steps 5-7 pulled out as common subroutines of XMLToXMLString
 * and their library-public js_* counterparts.  The guts of MakeXMLCDataString,
 * MakeXMLCommentString, and MakeXMLPIString are further factored into a common
 * MakeXMLSpecialString subroutine.
 *
 * These functions take ownership of sb->base, if sb is non-null, in all cases
 * of success or failure.
 */
static JSString *
MakeXMLSpecialString(JSContext *cx, JSStringBuffer *sb,
                     JSString *str, JSString *str2,
                     const jschar *prefix, size_t prefixlength,
                     const jschar *suffix, size_t suffixlength)
{
    JSStringBuffer localSB;
    size_t length, length2, newlength;
    jschar *bp, *base;

    if (!sb) {
        sb = &localSB;
        js_InitStringBuffer(sb);
    }

    length = JSSTRING_LENGTH(str);
    length2 = str2 ? JSSTRING_LENGTH(str2) : 0;
    newlength = STRING_BUFFER_OFFSET(sb) +
                prefixlength + length + ((length2 != 0) ? 1 + length2 : 0) +
                suffixlength;
    bp = base = (jschar *)
                JS_realloc(cx, sb->base, (newlength + 1) * sizeof(jschar));
    if (!bp) {
        js_FinishStringBuffer(sb);
        return NULL;
    }

    bp += STRING_BUFFER_OFFSET(sb);
    js_strncpy(bp, prefix, prefixlength);
    bp += prefixlength;
    js_strncpy(bp, JSSTRING_CHARS(str), length);
    bp += length;
    if (length2 != 0) {
        *bp++ = (jschar) ' ';
        js_strncpy(bp, JSSTRING_CHARS(str2), length2);
        bp += length2;
    }
    js_strncpy(bp, suffix, suffixlength);
    bp[suffixlength] = 0;

    str = js_NewString(cx, base, newlength);
    if (!str)
        free(base);
    return str;
}

static JSString *
MakeXMLCDATAString(JSContext *cx, JSStringBuffer *sb, JSString *str)
{
    static const jschar cdata_prefix_ucNstr[] = {'<', '!', '[',
                                                 'C', 'D', 'A', 'T', 'A',
                                                 '['};
    static const jschar cdata_suffix_ucNstr[] = {']', ']', '>'};

    return MakeXMLSpecialString(cx, sb, str, NULL,
                                cdata_prefix_ucNstr, 9,
                                cdata_suffix_ucNstr, 3);
}

static JSString *
MakeXMLCommentString(JSContext *cx, JSStringBuffer *sb, JSString *str)
{
    static const jschar comment_prefix_ucNstr[] = {'<', '!', '-', '-'};
    static const jschar comment_suffix_ucNstr[] = {'-', '-', '>'};

    return MakeXMLSpecialString(cx, sb, str, NULL,
                                comment_prefix_ucNstr, 4,
                                comment_suffix_ucNstr, 3);
}

static JSString *
MakeXMLPIString(JSContext *cx, JSStringBuffer *sb, JSString *name,
                JSString *value)
{
    static const jschar pi_prefix_ucNstr[] = {'<', '?'};
    static const jschar pi_suffix_ucNstr[] = {'?', '>'};

    return MakeXMLSpecialString(cx, sb, name, value,
                                pi_prefix_ucNstr, 2,
                                pi_suffix_ucNstr, 2);
}

/*
 * ECMA-357 10.2.1 17(d-g) pulled out into a common subroutine that appends
 * equals, a double quote, an attribute value, and a closing double quote.
 */
static void
AppendAttributeValue(JSContext *cx, JSStringBuffer *sb, JSString *valstr)
{
    js_AppendChar(sb, '=');
    valstr = js_EscapeAttributeValue(cx, valstr, JS_TRUE);
    if (!valstr) {
        if (STRING_BUFFER_OK(sb)) {
            free(sb->base);
            sb->base = STRING_BUFFER_ERROR_BASE;
        }
        return;
    }
    js_AppendJSString(sb, valstr);
}

/*
 * ECMA-357 10.2.1.1 EscapeElementValue helper method.
 *
 * This function takes ownership of sb->base, if sb is non-null, in all cases
 * of success or failure.
 */
static JSString *
EscapeElementValue(JSContext *cx, JSStringBuffer *sb, JSString *str)
{
    size_t length, newlength;
    const jschar *cp, *start, *end;
    jschar c;

    JSSTRING_CHARS_AND_LENGTH(str, start, length);
    newlength = length;
    for (cp = start, end = cp + length; cp < end; cp++) {
        c = *cp;
        if (c == '<' || c == '>')
            newlength += 3;
        else if (c == '&')
            newlength += 4;

        if (newlength < length) {
            js_ReportAllocationOverflow(cx);
            return NULL;
        }
    }
    if ((sb && STRING_BUFFER_OFFSET(sb) != 0) || newlength > length) {
        JSStringBuffer localSB;
        if (!sb) {
            sb = &localSB;
            js_InitStringBuffer(sb);
        }
        if (!sb->grow(sb, newlength)) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }
        for (cp = start; cp < end; cp++) {
            c = *cp;
            if (c == '<')
                js_AppendCString(sb, js_lt_entity_str);
            else if (c == '>')
                js_AppendCString(sb, js_gt_entity_str);
            else if (c == '&')
                js_AppendCString(sb, js_amp_entity_str);
            else
                js_AppendChar(sb, c);
        }
        JS_ASSERT(STRING_BUFFER_OK(sb));
        str = js_NewString(cx, sb->base, STRING_BUFFER_OFFSET(sb));
        if (!str)
            js_FinishStringBuffer(sb);
    }
    return str;
}

/*
 * ECMA-357 10.2.1.2 EscapeAttributeValue helper method.
 * This function takes ownership of sb->base, if sb is non-null, in all cases.
 */
static JSString *
EscapeAttributeValue(JSContext *cx, JSStringBuffer *sb, JSString *str,
                     JSBool quote)
{
    size_t length, newlength;
    const jschar *cp, *start, *end;
    jschar c;

    JSSTRING_CHARS_AND_LENGTH(str, start, length);
    newlength = length + (quote ? 2 : 0);
    for (cp = start, end = cp + length; cp < end; cp++) {
        c = *cp;
        if (c == '"')
            newlength += 5;
        else if (c == '<')
            newlength += 3;
        else if (c == '&' || c == '\n' || c == '\r' || c == '\t')
            newlength += 4;

        if (newlength < length) {
            js_ReportAllocationOverflow(cx);
            return NULL;
        }
    }
    if ((sb && STRING_BUFFER_OFFSET(sb) != 0) || newlength > length) {
        JSStringBuffer localSB;
        if (!sb) {
            sb = &localSB;
            js_InitStringBuffer(sb);
        }
        if (!sb->grow(sb, newlength)) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }
        if (quote)
            js_AppendChar(sb, '"');
        for (cp = start; cp < end; cp++) {
            c = *cp;
            if (c == '"')
                js_AppendCString(sb, js_quot_entity_str);
            else if (c == '<')
                js_AppendCString(sb, js_lt_entity_str);
            else if (c == '&')
                js_AppendCString(sb, js_amp_entity_str);
            else if (c == '\n')
                js_AppendCString(sb, "&#xA;");
            else if (c == '\r')
                js_AppendCString(sb, "&#xD;");
            else if (c == '\t')
                js_AppendCString(sb, "&#x9;");
            else
                js_AppendChar(sb, c);
        }
        if (quote)
            js_AppendChar(sb, '"');
        JS_ASSERT(STRING_BUFFER_OK(sb));
        str = js_NewString(cx, sb->base, STRING_BUFFER_OFFSET(sb));
        if (!str)
            js_FinishStringBuffer(sb);
    }
    return str;
}

/* 13.3.5.4 [[GetNamespace]]([InScopeNamespaces]) */
static JSObject *
GetNamespace(JSContext *cx, JSObject *qn, const JSXMLArray *inScopeNSes)
{
    JSString *uri, *prefix, *nsprefix;
    JSObject *match, *ns;
    uint32 i, n;
    jsval argv[2];

    uri = GetURI(qn);
    prefix = GetPrefix(qn);
    JS_ASSERT(uri);
    if (!uri) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BAD_XML_NAMESPACE,
                             prefix
                             ? js_ValueToPrintableString(cx,
                                   STRING_TO_JSVAL(prefix))
                             : js_undefined_str);
        return NULL;
    }

    /* Look for a matching namespace in inScopeNSes, if provided. */
    match = NULL;
    if (inScopeNSes) {
        for (i = 0, n = inScopeNSes->length; i < n; i++) {
            ns = XMLARRAY_MEMBER(inScopeNSes, i, JSObject);
            if (!ns)
                continue;

            /*
             * Erratum, very tricky, and not specified in ECMA-357 13.3.5.4:
             * If we preserve prefixes, we must match null prefix against
             * an empty prefix of ns, in order to avoid generating redundant
             * prefixed and default namespaces for cases such as:
             *
             *   x = <t xmlns="http://foo.com"/>
             *   print(x.toXMLString());
             *
             * Per 10.3.2.1, the namespace attribute in t has an empty string
             * prefix (*not* a null prefix), per 10.3.2.1 Step 6(h)(i)(1):
             *
             *   1. If the [local name] property of a is "xmlns"
             *      a. Map ns.prefix to the empty string
             *
             * But t's name has a null prefix in this implementation, meaning
             * *undefined*, per 10.3.2.1 Step 6(c)'s NOTE (which refers to
             * the http://www.w3.org/TR/xml-infoset/ spec, item 2.2.3, without
             * saying how "no value" maps to an ECMA-357 value -- but it must
             * map to the *undefined* prefix value).
             *
             * Since "" != undefined (or null, in the current implementation)
             * the ECMA-357 spec will fail to match in [[GetNamespace]] called
             * on t with argument {} U {(prefix="", uri="http://foo.com")}.
             * This spec bug leads to ToXMLString results that duplicate the
             * declared namespace.
             */
            if (js_EqualStrings(GetURI(ns), uri)) {
                nsprefix = GetPrefix(ns);
                if (nsprefix == prefix ||
                    ((nsprefix && prefix)
                     ? js_EqualStrings(nsprefix, prefix)
                     : IS_EMPTY(nsprefix ? nsprefix : prefix))) {
                    match = ns;
                    break;
                }
            }
        }
    }

    /* If we didn't match, make a new namespace from qn. */
    if (!match) {
        argv[0] = prefix ? STRING_TO_JSVAL(prefix) : JSVAL_VOID;
        argv[1] = STRING_TO_JSVAL(uri);
        ns = js_ConstructObject(cx, &js_NamespaceClass.base, NULL, NULL,
                                2, argv);
        if (!ns)
            return NULL;
        match = ns;
    }
    return match;
}

static JSString *
GeneratePrefix(JSContext *cx, JSString *uri, JSXMLArray *decls)
{
    const jschar *cp, *start, *end;
    size_t length, newlength, offset;
    uint32 i, n, m, serial;
    jschar *bp, *dp;
    JSBool done;
    JSObject *ns;
    JSString *nsprefix, *prefix;

    JS_ASSERT(!IS_EMPTY(uri));

    /*
     * If there are no *declared* namespaces, skip all collision detection and
     * return a short prefix quickly; an example of such a situation:
     *
     *   var x = <f/>;
     *   var n = new Namespace("http://example.com/");
     *   x.@n::att = "val";
     *   x.toXMLString();
     *
     * This is necessary for various log10 uses below to be valid.
     */
    if (decls->length == 0)
        return JS_NewStringCopyZ(cx, "a");

    /*
     * Try peeling off the last filename suffix or pathname component till
     * we have a valid XML name.  This heuristic will prefer "xul" given
     * ".../there.is.only.xul", "xbl" given ".../xbl", and "xbl2" given any
     * likely URI of the form ".../xbl2/2005".
     */
    JSSTRING_CHARS_AND_END(uri, start, end);
    cp = end;
    while (--cp > start) {
        if (*cp == '.' || *cp == '/' || *cp == ':') {
            ++cp;
            length = PTRDIFF(end, cp, jschar);
            if (IsXMLName(cp, length) && !STARTS_WITH_XML(cp, length))
                break;
            end = --cp;
        }
    }
    length = PTRDIFF(end, cp, jschar);

    /*
     * If the namespace consisted only of non-XML names or names that begin
     * case-insensitively with "xml", arbitrarily create a prefix consisting
     * of 'a's of size length (allowing dp-calculating code to work with or
     * without this branch executing) plus the space for storing a hyphen and
     * the serial number (avoiding reallocation if a collision happens).
     */
    bp = (jschar *) cp;
    newlength = length;
    if (STARTS_WITH_XML(cp, length) || !IsXMLName(cp, length)) {
        newlength = length + 2 + (size_t) log10((double) decls->length);
        bp = (jschar *)
             JS_malloc(cx, (newlength + 1) * sizeof(jschar));
        if (!bp)
            return NULL;

        bp[newlength] = 0;
        for (i = 0; i < newlength; i++)
             bp[i] = 'a';
    }

    /*
     * Now search through decls looking for a collision.  If we collide with
     * an existing prefix, start tacking on a hyphen and a serial number.
     */
    serial = 0;
    do {
        done = JS_TRUE;
        for (i = 0, n = decls->length; i < n; i++) {
            ns = XMLARRAY_MEMBER(decls, i, JSObject);
            if (ns && (nsprefix = GetPrefix(ns)) &&
                JSSTRING_LENGTH(nsprefix) == newlength &&
                !memcmp(JSSTRING_CHARS(nsprefix), bp,
                        newlength * sizeof(jschar))) {
                if (bp == cp) {
                    newlength = length + 2 + (size_t) log10((double) n);
                    bp = (jschar *)
                         JS_malloc(cx, (newlength + 1) * sizeof(jschar));
                    if (!bp)
                        return NULL;
                    js_strncpy(bp, cp, length);
                }

                ++serial;
                JS_ASSERT(serial <= n);
                dp = bp + length + 2 + (size_t) log10((double) serial);
                *dp = 0;
                for (m = serial; m != 0; m /= 10)
                    *--dp = (jschar)('0' + m % 10);
                *--dp = '-';
                JS_ASSERT(dp == bp + length);

                done = JS_FALSE;
                break;
            }
        }
    } while (!done);

    if (bp == cp) {
        offset = PTRDIFF(cp, start, jschar);
        prefix = js_NewDependentString(cx, uri, offset, length);
    } else {
        prefix = js_NewString(cx, bp, newlength);
        if (!prefix)
            JS_free(cx, bp);
    }
    return prefix;
}

static JSBool
namespace_match(const void *a, const void *b)
{
    const JSObject *nsa = (const JSObject *) a;
    const JSObject *nsb = (const JSObject *) b;
    JSString *prefixa, *prefixb = GetPrefix(nsb);

    if (prefixb) {
        prefixa = GetPrefix(nsa);
        return prefixa && js_EqualStrings(prefixa, prefixb);
    }
    return js_EqualStrings(GetURI(nsa), GetURI(nsb));
}

/* ECMA-357 10.2.1 and 10.2.2 */
#define TO_SOURCE_FLAG 0x80000000

static JSString *
XMLToXMLString(JSContext *cx, JSXML *xml, const JSXMLArray *ancestorNSes,
               uint32 indentLevel)
{
    JSBool pretty, indentKids;
    JSStringBuffer sb;
    JSString *str, *prefix, *kidstr, *nsuri;
    JSXMLArrayCursor cursor;
    uint32 i, n, nextIndentLevel;
    JSXMLArray empty, decls, ancdecls;
    JSObject *ns, *ns2;
    JSXML *attr, *kid;

    if (!GetBooleanXMLSetting(cx, js_prettyPrinting_str, &pretty))
        return NULL;

    js_InitStringBuffer(&sb);
    if (pretty) {
        js_RepeatChar(&sb, ' ', indentLevel & ~TO_SOURCE_FLAG);

        if (!STRING_BUFFER_OK(&sb)) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }
    }
    str = NULL;

    switch (xml->xml_class) {
      case JSXML_CLASS_TEXT:
        /* Step 4. */
        if (pretty) {
            str = ChompXMLWhitespace(cx, xml->xml_value);
            if (!str)
                return NULL;
        } else {
            str = xml->xml_value;
        }
        return EscapeElementValue(cx, &sb, str);

      case JSXML_CLASS_ATTRIBUTE:
        /* Step 5. */
        return EscapeAttributeValue(cx, &sb, xml->xml_value,
                                    (indentLevel & TO_SOURCE_FLAG) != 0);

      case JSXML_CLASS_COMMENT:
        /* Step 6. */
        return MakeXMLCommentString(cx, &sb, xml->xml_value);

      case JSXML_CLASS_PROCESSING_INSTRUCTION:
        /* Step 7. */
        return MakeXMLPIString(cx, &sb, GetLocalName(xml->name),
                               xml->xml_value);

      case JSXML_CLASS_LIST:
        /* ECMA-357 10.2.2. */
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        i = 0;
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (pretty && i != 0)
                js_AppendChar(&sb, '\n');

            kidstr = XMLToXMLString(cx, kid, ancestorNSes, indentLevel);
            if (!kidstr)
                break;

            js_AppendJSString(&sb, kidstr);
            ++i;
        }
        XMLArrayCursorFinish(&cursor);
        if (kid)
            goto list_out;

        if (!sb.base)
            return cx->runtime->emptyString;

        if (!STRING_BUFFER_OK(&sb)) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }

        str = js_NewString(cx, sb.base, STRING_BUFFER_OFFSET(&sb));
      list_out:
        if (!str && STRING_BUFFER_OK(&sb))
            js_FinishStringBuffer(&sb);
        return str;

      default:;
    }

    /* After this point, control must flow through label out: to exit. */
    if (!js_EnterLocalRootScope(cx))
        return NULL;

    /* ECMA-357 10.2.1 step 8 onward: handle ToXMLString on an XML element. */
    if (!ancestorNSes) {
        XMLArrayInit(cx, &empty, 0);
        ancestorNSes = &empty;
    }
    XMLArrayInit(cx, &decls, 0);
    ancdecls.capacity = 0;

    /* Clone in-scope namespaces not in ancestorNSes into decls. */
    XMLArrayCursorInit(&cursor, &xml->xml_namespaces);
    while ((ns = (JSObject *) XMLArrayCursorNext(&cursor)) != NULL) {
        if (!IsDeclared(ns))
            continue;
        if (!XMLARRAY_HAS_MEMBER(ancestorNSes, ns, namespace_identity)) {
            /* NOTE: may want to exclude unused namespaces here. */
            ns2 = NewXMLNamespace(cx, GetPrefix(ns), GetURI(ns), JS_TRUE);
            if (!ns2 || !XMLARRAY_APPEND(cx, &decls, ns2))
                break;
        }
    }
    XMLArrayCursorFinish(&cursor);
    if (ns)
        goto out;

    /*
     * Union ancestorNSes and decls into ancdecls.  Note that ancdecls does
     * not own its member references.  In the spec, ancdecls has no name, but
     * is always written out as (AncestorNamespaces U namespaceDeclarations).
     */
    if (!XMLArrayInit(cx, &ancdecls, ancestorNSes->length + decls.length))
        goto out;
    for (i = 0, n = ancestorNSes->length; i < n; i++) {
        ns2 = XMLARRAY_MEMBER(ancestorNSes, i, JSObject);
        if (!ns2)
            continue;
        JS_ASSERT(!XMLARRAY_HAS_MEMBER(&decls, ns2, namespace_identity));
        if (!XMLARRAY_APPEND(cx, &ancdecls, ns2))
            goto out;
    }
    for (i = 0, n = decls.length; i < n; i++) {
        ns2 = XMLARRAY_MEMBER(&decls, i, JSObject);
        if (!ns2)
            continue;
        JS_ASSERT(!XMLARRAY_HAS_MEMBER(&ancdecls, ns2, namespace_identity));
        if (!XMLARRAY_APPEND(cx, &ancdecls, ns2))
            goto out;
    }

    /* Step 11, except we don't clone ns unless its prefix is undefined. */
    ns = GetNamespace(cx, xml->name, &ancdecls);
    if (!ns)
        goto out;

    /* Step 12 (NULL means *undefined* here), plus the deferred ns cloning. */
    prefix = GetPrefix(ns);
    if (!prefix) {
        /*
         * Create a namespace prefix that isn't used by any member of decls.
         * Assign the new prefix to a copy of ns.  Flag this namespace as if
         * it were declared, for assertion-testing's sake later below.
         *
         * Erratum: if prefix and xml->name are both null (*undefined* in
         * ECMA-357), we know that xml was named using the default namespace
         * (proof: see GetNamespace and the Namespace constructor called with
         * two arguments).  So we ought not generate a new prefix here, when
         * we can declare ns as the default namespace for xml.
         *
         * This helps descendants inherit the namespace instead of redundantly
         * redeclaring it with generated prefixes in each descendant.
         */
        nsuri = GetURI(ns);
        if (!GetPrefix(xml->name)) {
            prefix = cx->runtime->emptyString;
        } else {
            prefix = GeneratePrefix(cx, nsuri, &ancdecls);
            if (!prefix)
                goto out;
        }
        ns = NewXMLNamespace(cx, prefix, nsuri, JS_TRUE);
        if (!ns)
            goto out;

        /*
         * If the xml->name was unprefixed, we must remove any declared default
         * namespace from decls before appending ns.  How can you get a default
         * namespace in decls that doesn't match the one from name?  Apparently
         * by calling x.setNamespace(ns) where ns has no prefix.  The other way
         * to fix this is to update x's in-scope namespaces when setNamespace
         * is called, but that's not specified by ECMA-357.
         *
         * Likely Erratum here, depending on whether the lack of update to x's
         * in-scope namespace in XML.prototype.setNamespace (13.4.4.36) is an
         * erratum or not.  Note that changing setNamespace to update the list
         * of in-scope namespaces will change x.namespaceDeclarations().
         */
        if (IS_EMPTY(prefix)) {
            i = XMLArrayFindMember(&decls, ns, namespace_match);
            if (i != XML_NOT_FOUND)
                XMLArrayDelete(cx, &decls, i, JS_TRUE);
        }

        /*
         * In the spec, ancdecls has no name, but is always written out as
         * (AncestorNamespaces U namespaceDeclarations).  Since we compute
         * that union in ancdecls, any time we append a namespace strong
         * ref to decls, we must also append a weak ref to ancdecls.  Order
         * matters here: code at label out: releases strong refs in decls.
         */
        if (!XMLARRAY_APPEND(cx, &ancdecls, ns) ||
            !XMLARRAY_APPEND(cx, &decls, ns)) {
            goto out;
        }
    }

    /* Format the element or point-tag into sb. */
    js_AppendChar(&sb, '<');

    if (prefix && !IS_EMPTY(prefix)) {
        js_AppendJSString(&sb, prefix);
        js_AppendChar(&sb, ':');
    }
    js_AppendJSString(&sb, GetLocalName(xml->name));

    /*
     * Step 16 makes a union to avoid writing two loops in step 17, to share
     * common attribute value appending spec-code.  We prefer two loops for
     * faster code and less data overhead.
     */

    /* Step 17(b): append attributes. */
    XMLArrayCursorInit(&cursor, &xml->xml_attrs);
    while ((attr = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
        js_AppendChar(&sb, ' ');
        ns2 = GetNamespace(cx, attr->name, &ancdecls);
        if (!ns2)
            break;

        /* 17(b)(ii): NULL means *undefined* here. */
        prefix = GetPrefix(ns2);
        if (!prefix) {
            prefix = GeneratePrefix(cx, GetURI(ns2), &ancdecls);
            if (!prefix)
                break;

            /* Again, we avoid copying ns2 until we know it's prefix-less. */
            ns2 = NewXMLNamespace(cx, prefix, GetURI(ns2), JS_TRUE);
            if (!ns2)
                break;

            /*
             * In the spec, ancdecls has no name, but is always written out as
             * (AncestorNamespaces U namespaceDeclarations).  Since we compute
             * that union in ancdecls, any time we append a namespace strong
             * ref to decls, we must also append a weak ref to ancdecls.  Order
             * matters here: code at label out: releases strong refs in decls.
             */
            if (!XMLARRAY_APPEND(cx, &ancdecls, ns2) ||
                !XMLARRAY_APPEND(cx, &decls, ns2)) {
                break;
            }
        }

        /* 17(b)(iii). */
        if (!IS_EMPTY(prefix)) {
            js_AppendJSString(&sb, prefix);
            js_AppendChar(&sb, ':');
        }

        /* 17(b)(iv). */
        js_AppendJSString(&sb, GetLocalName(attr->name));

        /* 17(d-g). */
        AppendAttributeValue(cx, &sb, attr->xml_value);
    }
    XMLArrayCursorFinish(&cursor);
    if (attr)
        goto out;

    /* Step 17(c): append XML namespace declarations. */
    XMLArrayCursorInit(&cursor, &decls);
    while ((ns2 = (JSObject *) XMLArrayCursorNext(&cursor)) != NULL) {
        JS_ASSERT(IsDeclared(ns2));

        js_AppendCString(&sb, " xmlns");

        /* 17(c)(ii): NULL means *undefined* here. */
        prefix = GetPrefix(ns2);
        if (!prefix) {
            prefix = GeneratePrefix(cx, GetURI(ns2), &ancdecls);
            if (!prefix)
                break;
            ns2->fslots[JSSLOT_PREFIX] = STRING_TO_JSVAL(prefix);
        }

        /* 17(c)(iii). */
        if (!IS_EMPTY(prefix)) {
            js_AppendChar(&sb, ':');
            js_AppendJSString(&sb, prefix);
        }

        /* 17(d-g). */
        AppendAttributeValue(cx, &sb, GetURI(ns2));
    }
    XMLArrayCursorFinish(&cursor);
    if (ns2)
        goto out;

    /* Step 18: handle point tags. */
    n = xml->xml_kids.length;
    if (n == 0) {
        js_AppendCString(&sb, "/>");
    } else {
        /* Steps 19 through 25: handle element content, and open the end-tag. */
        js_AppendChar(&sb, '>');
        indentKids = n > 1 ||
                     (n == 1 &&
                      (kid = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML)) &&
                      kid->xml_class != JSXML_CLASS_TEXT);

        if (pretty && indentKids) {
            if (!GetUint32XMLSetting(cx, js_prettyIndent_str, &i))
                goto out;
            nextIndentLevel = indentLevel + i;
        } else {
            nextIndentLevel = indentLevel & TO_SOURCE_FLAG;
        }

        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (pretty && indentKids)
                js_AppendChar(&sb, '\n');

            kidstr = XMLToXMLString(cx, kid, &ancdecls, nextIndentLevel);
            if (!kidstr)
                break;

            js_AppendJSString(&sb, kidstr);
        }
        XMLArrayCursorFinish(&cursor);
        if (kid)
            goto out;

        if (pretty && indentKids) {
            js_AppendChar(&sb, '\n');
            js_RepeatChar(&sb, ' ', indentLevel & ~TO_SOURCE_FLAG);
        }
        js_AppendCString(&sb, "</");

        /* Step 26. */
        prefix = GetPrefix(ns);
        if (prefix && !IS_EMPTY(prefix)) {
            js_AppendJSString(&sb, prefix);
            js_AppendChar(&sb, ':');
        }

        /* Step 27. */
        js_AppendJSString(&sb, GetLocalName(xml->name));
        js_AppendChar(&sb, '>');
    }

    if (!STRING_BUFFER_OK(&sb)) {
        JS_ReportOutOfMemory(cx);
        goto out;
    }

    str = js_NewString(cx, sb.base, STRING_BUFFER_OFFSET(&sb));
out:
    js_LeaveLocalRootScopeWithResult(cx, STRING_TO_JSVAL(str));
    if (!str && STRING_BUFFER_OK(&sb))
        js_FinishStringBuffer(&sb);
    XMLArrayFinish(cx, &decls);
    if (ancdecls.capacity != 0)
        XMLArrayFinish(cx, &ancdecls);
    return str;
}

/* ECMA-357 10.2 */
static JSString *
ToXMLString(JSContext *cx, jsval v, uint32 toSourceFlag)
{
    JSObject *obj;
    JSString *str;
    JSXML *xml;

    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v)) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BAD_XML_CONVERSION,
                             JSVAL_IS_NULL(v) ? js_null_str : js_undefined_str);
        return NULL;
    }

    if (JSVAL_IS_BOOLEAN(v) || JSVAL_IS_NUMBER(v))
        return js_ValueToString(cx, v);

    if (JSVAL_IS_STRING(v))
        return EscapeElementValue(cx, NULL, JSVAL_TO_STRING(v));

    obj = JSVAL_TO_OBJECT(v);
    if (!OBJECT_IS_XML(cx, obj)) {
        if (!OBJ_DEFAULT_VALUE(cx, obj, JSTYPE_STRING, &v))
            return NULL;
        str = js_ValueToString(cx, v);
        if (!str)
            return NULL;
        return EscapeElementValue(cx, NULL, str);
    }

    /* Handle non-element cases in this switch, returning from each case. */
    xml = (JSXML *) JS_GetPrivate(cx, obj);
    return XMLToXMLString(cx, xml, NULL, toSourceFlag | 0);
}

static JSObject *
ToAttributeName(JSContext *cx, jsval v)
{
    JSString *name, *uri, *prefix;
    JSObject *obj;
    JSClass *clasp;
    JSObject *qn;

    if (JSVAL_IS_STRING(v)) {
        name = JSVAL_TO_STRING(v);
        uri = prefix = cx->runtime->emptyString;
    } else {
        if (JSVAL_IS_PRIMITIVE(v)) {
            js_ReportValueError(cx, JSMSG_BAD_XML_ATTR_NAME,
                                JSDVG_IGNORE_STACK, v, NULL);
            return NULL;
        }

        obj = JSVAL_TO_OBJECT(v);
        clasp = OBJ_GET_CLASS(cx, obj);
        if (clasp == &js_AttributeNameClass)
            return obj;

        if (clasp == &js_QNameClass.base) {
            qn = obj;
            uri = GetURI(qn);
            prefix = GetPrefix(qn);
            name = GetLocalName(qn);
        } else {
            if (clasp == &js_AnyNameClass) {
                name = ATOM_TO_STRING(cx->runtime->atomState.starAtom);
            } else {
                name = js_ValueToString(cx, v);
                if (!name)
                    return NULL;
            }
            uri = prefix = cx->runtime->emptyString;
        }
    }

    qn = NewXMLQName(cx, uri, prefix, name, &js_AttributeNameClass);
    if (!qn)
        return NULL;
    return qn;
}

static void
ReportBadXMLName(JSContext *cx, jsval id)
{
    js_ReportValueError(cx, JSMSG_BAD_XML_NAME, JSDVG_IGNORE_STACK, id, NULL);
}

static JSBool
IsFunctionQName(JSContext *cx, JSObject *qn, jsid *funidp)
{
    JSAtom *atom;
    JSString *uri;

    atom = cx->runtime->atomState.lazy.functionNamespaceURIAtom;
    uri = GetURI(qn);
    if (uri && atom &&
        (uri == ATOM_TO_STRING(atom) ||
         js_EqualStrings(uri, ATOM_TO_STRING(atom)))) {
        return JS_ValueToId(cx, STRING_TO_JSVAL(GetLocalName(qn)), funidp);
    }
    *funidp = 0;
    return JS_TRUE;
}

JSBool
js_IsFunctionQName(JSContext *cx, JSObject *obj, jsid *funidp)
{
    if (OBJ_GET_CLASS(cx, obj) == &js_QNameClass.base)
        return IsFunctionQName(cx, obj, funidp);
    *funidp = 0;
    return JS_TRUE;
}

static JSObject *
ToXMLName(JSContext *cx, jsval v, jsid *funidp)
{
    JSString *name;
    JSObject *obj;
    JSClass *clasp;
    uint32 index;

    if (JSVAL_IS_STRING(v)) {
        name = JSVAL_TO_STRING(v);
    } else {
        if (JSVAL_IS_PRIMITIVE(v)) {
            ReportBadXMLName(cx, v);
            return NULL;
        }

        obj = JSVAL_TO_OBJECT(v);
        clasp = OBJ_GET_CLASS(cx, obj);
        if (clasp == &js_AttributeNameClass || clasp == &js_QNameClass.base)
            goto out;
        if (clasp == &js_AnyNameClass) {
            name = ATOM_TO_STRING(cx->runtime->atomState.starAtom);
            goto construct;
        }
        name = js_ValueToString(cx, v);
        if (!name)
            return NULL;
    }

    /*
     * ECMA-357 10.6.1 step 1 seems to be incorrect.  The spec says:
     *
     * 1. If ToString(ToNumber(P)) == ToString(P), throw a TypeError exception
     *
     * First, _P_ should be _s_, to refer to the given string.
     *
     * Second, why does ToXMLName applied to the string type throw TypeError
     * only for numeric literals without any leading or trailing whitespace?
     *
     * If the idea is to reject uint32 property names, then the check needs to
     * be stricter, to exclude hexadecimal and floating point literals.
     */
    if (js_IdIsIndex(STRING_TO_JSVAL(name), &index))
        goto bad;

    if (*JSSTRING_CHARS(name) == '@') {
        name = js_NewDependentString(cx, name, 1, JSSTRING_LENGTH(name) - 1);
        if (!name)
            return NULL;
        *funidp = 0;
        return ToAttributeName(cx, STRING_TO_JSVAL(name));
    }

construct:
    v = STRING_TO_JSVAL(name);
    obj = js_ConstructObject(cx, &js_QNameClass.base, NULL, NULL, 1, &v);
    if (!obj)
        return NULL;

out:
    if (!IsFunctionQName(cx, obj, funidp))
        return NULL;
    return obj;

bad:
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_BAD_XML_NAME,
                         js_ValueToPrintableString(cx, STRING_TO_JSVAL(name)));
    return NULL;
}

/* ECMA-357 9.1.1.13 XML [[AddInScopeNamespace]]. */
static JSBool
AddInScopeNamespace(JSContext *cx, JSXML *xml, JSObject *ns)
{
    JSString *prefix, *prefix2;
    JSObject *match, *ns2;
    uint32 i, n, m;

    if (xml->xml_class != JSXML_CLASS_ELEMENT)
        return JS_TRUE;

    /* NULL means *undefined* here -- see ECMA-357 9.1.1.13 step 2. */
    prefix = GetPrefix(ns);
    if (!prefix) {
        match = NULL;
        for (i = 0, n = xml->xml_namespaces.length; i < n; i++) {
            ns2 = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
            if (ns2 && js_EqualStrings(GetURI(ns2), GetURI(ns))) {
                match = ns2;
                break;
            }
        }
        if (!match && !XMLARRAY_ADD_MEMBER(cx, &xml->xml_namespaces, n, ns))
            return JS_FALSE;
    } else {
        if (IS_EMPTY(prefix) && IS_EMPTY(GetURI(xml->name)))
            return JS_TRUE;
        match = NULL;
#ifdef __GNUC__         /* suppress bogus gcc warnings */
        m = XML_NOT_FOUND;
#endif
        for (i = 0, n = xml->xml_namespaces.length; i < n; i++) {
            ns2 = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
            if (ns2 && (prefix2 = GetPrefix(ns2)) &&
                js_EqualStrings(prefix2, prefix)) {
                match = ns2;
                m = i;
                break;
            }
        }
        if (match && !js_EqualStrings(GetURI(match), GetURI(ns))) {
            ns2 = XMLARRAY_DELETE(cx, &xml->xml_namespaces, m, JS_TRUE,
                                  JSObject);
            JS_ASSERT(ns2 == match);
            match->fslots[JSSLOT_PREFIX] = JSVAL_VOID;
            if (!AddInScopeNamespace(cx, xml, match))
                return JS_FALSE;
        }
        if (!XMLARRAY_APPEND(cx, &xml->xml_namespaces, ns))
            return JS_FALSE;
    }

    /* OPTION: enforce that descendants have superset namespaces. */
    return JS_TRUE;
}

/* ECMA-357 9.2.1.6 XMLList [[Append]]. */
static JSBool
Append(JSContext *cx, JSXML *list, JSXML *xml)
{
    uint32 i, j, k, n;
    JSXML *kid;

    JS_ASSERT(list->xml_class == JSXML_CLASS_LIST);
    i = list->xml_kids.length;
    n = 1;
    if (xml->xml_class == JSXML_CLASS_LIST) {
        list->xml_target = xml->xml_target;
        list->xml_targetprop = xml->xml_targetprop;
        n = JSXML_LENGTH(xml);
        k = i + n;
        if (!XMLArraySetCapacity(cx, &list->xml_kids, k))
            return JS_FALSE;
        for (j = 0; j < n; j++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, j, JSXML);
            if (kid)
                XMLARRAY_SET_MEMBER(&list->xml_kids, i + j, kid);
        }
        return JS_TRUE;
    }

    list->xml_target = xml->parent;
    if (xml->xml_class == JSXML_CLASS_PROCESSING_INSTRUCTION)
        list->xml_targetprop = NULL;
    else
        list->xml_targetprop = xml->name;
    if (!XMLARRAY_ADD_MEMBER(cx, &list->xml_kids, i, xml))
        return JS_FALSE;
    return JS_TRUE;
}

/* ECMA-357 9.1.1.7 XML [[DeepCopy]] and 9.2.1.7 XMLList [[DeepCopy]]. */
static JSXML *
DeepCopyInLRS(JSContext *cx, JSXML *xml, uintN flags);

static JSXML *
DeepCopy(JSContext *cx, JSXML *xml, JSObject *obj, uintN flags)
{
    JSXML *copy;
    JSBool ok;

    /* Our caller may not be protecting newborns with a local root scope. */
    if (!js_EnterLocalRootScope(cx))
        return NULL;
    copy = DeepCopyInLRS(cx, xml, flags);
    if (copy) {
        if (obj) {
            /* Caller provided the object for this copy, hook 'em up. */
            ok = JS_SetPrivate(cx, obj, copy);
            if (ok)
                copy->object = obj;
        } else {
            ok = js_GetXMLObject(cx, copy) != NULL;
        }
        if (!ok)
            copy = NULL;
    }
    js_LeaveLocalRootScopeWithResult(cx, (jsval) copy);
    return copy;
}

/*
 * (i) We must be in a local root scope (InLRS).
 * (ii) parent must have a rooted object.
 * (iii) from's owning object must be locked if not thread-local.
 */
static JSBool
DeepCopySetInLRS(JSContext *cx, JSXMLArray *from, JSXMLArray *to, JSXML *parent,
                 uintN flags)
{
    uint32 j, n;
    JSXMLArrayCursor cursor;
    JSBool ok;
    JSXML *kid, *kid2;
    JSString *str;

    JS_ASSERT(cx->localRootStack);

    n = from->length;
    if (!XMLArraySetCapacity(cx, to, n))
        return JS_FALSE;

    XMLArrayCursorInit(&cursor, from);
    j = 0;
    ok = JS_TRUE;
    while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
        if ((flags & XSF_IGNORE_COMMENTS) &&
            kid->xml_class == JSXML_CLASS_COMMENT) {
            continue;
        }
        if ((flags & XSF_IGNORE_PROCESSING_INSTRUCTIONS) &&
            kid->xml_class == JSXML_CLASS_PROCESSING_INSTRUCTION) {
            continue;
        }
        if ((flags & XSF_IGNORE_WHITESPACE) &&
            (kid->xml_flags & XMLF_WHITESPACE_TEXT)) {
            continue;
        }
        kid2 = DeepCopyInLRS(cx, kid, flags);
        if (!kid2) {
            to->length = j;
            ok = JS_FALSE;
            break;
        }

        if ((flags & XSF_IGNORE_WHITESPACE) &&
            n > 1 && kid2->xml_class == JSXML_CLASS_TEXT) {
            str = ChompXMLWhitespace(cx, kid2->xml_value);
            if (!str) {
                to->length = j;
                ok = JS_FALSE;
                break;
            }
            kid2->xml_value = str;
        }

        XMLARRAY_SET_MEMBER(to, j, kid2);
        ++j;
        if (parent->xml_class != JSXML_CLASS_LIST)
            kid2->parent = parent;
    }
    XMLArrayCursorFinish(&cursor);
    if (!ok)
        return JS_FALSE;

    if (j < n)
        XMLArrayTrim(to);
    return JS_TRUE;
}

static JSXML *
DeepCopyInLRS(JSContext *cx, JSXML *xml, uintN flags)
{
    JSXML *copy;
    JSObject *qn;
    JSBool ok;
    uint32 i, n;
    JSObject *ns, *ns2;

    /* Our caller must be protecting newborn objects. */
    JS_ASSERT(cx->localRootStack);

    JS_CHECK_RECURSION(cx, return NULL);

    copy = js_NewXML(cx, (JSXMLClass) xml->xml_class);
    if (!copy)
        return NULL;
    qn = xml->name;
    if (qn) {
        qn = NewXMLQName(cx, GetURI(qn), GetPrefix(qn), GetLocalName(qn));
        if (!qn) {
            ok = JS_FALSE;
            goto out;
        }
    }
    copy->name = qn;
    copy->xml_flags = xml->xml_flags;

    if (JSXML_HAS_VALUE(xml)) {
        copy->xml_value = xml->xml_value;
        ok = JS_TRUE;
    } else {
        ok = DeepCopySetInLRS(cx, &xml->xml_kids, &copy->xml_kids, copy, flags);
        if (!ok)
            goto out;

        if (xml->xml_class == JSXML_CLASS_LIST) {
            copy->xml_target = xml->xml_target;
            copy->xml_targetprop = xml->xml_targetprop;
        } else {
            n = xml->xml_namespaces.length;
            ok = XMLArraySetCapacity(cx, &copy->xml_namespaces, n);
            if (!ok)
                goto out;
            for (i = 0; i < n; i++) {
                ns = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
                if (!ns)
                    continue;
                ns2 = NewXMLNamespace(cx, GetPrefix(ns), GetURI(ns),
                                      IsDeclared(ns));
                if (!ns2) {
                    copy->xml_namespaces.length = i;
                    ok = JS_FALSE;
                    goto out;
                }
                XMLARRAY_SET_MEMBER(&copy->xml_namespaces, i, ns2);
            }

            ok = DeepCopySetInLRS(cx, &xml->xml_attrs, &copy->xml_attrs, copy,
                                  0);
            if (!ok)
                goto out;
        }
    }

out:
    if (!ok)
        return NULL;
    return copy;
}

/* ECMA-357 9.1.1.4 XML [[DeleteByIndex]]. */
static void
DeleteByIndex(JSContext *cx, JSXML *xml, uint32 index)
{
    JSXML *kid;

    if (JSXML_HAS_KIDS(xml) && index < xml->xml_kids.length) {
        kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML);
        if (kid)
            kid->parent = NULL;
        XMLArrayDelete(cx, &xml->xml_kids, index, JS_TRUE);
    }
}

typedef JSBool (*JSXMLNameMatcher)(JSObject *nameqn, JSXML *xml);

static JSBool
MatchAttrName(JSObject *nameqn, JSXML *attr)
{
    JSObject *attrqn = attr->name;
    JSString *localName = GetLocalName(nameqn);
    JSString *uri;

    return (IS_STAR(localName) ||
            js_EqualStrings(GetLocalName(attrqn), localName)) &&
           (!(uri = GetURI(nameqn)) ||
            js_EqualStrings(GetURI(attrqn), uri));
}

static JSBool
MatchElemName(JSObject *nameqn, JSXML *elem)
{
    JSString *localName = GetLocalName(nameqn);
    JSString *uri;

    return (IS_STAR(localName) ||
            (elem->xml_class == JSXML_CLASS_ELEMENT &&
             js_EqualStrings(GetLocalName(elem->name), localName))) &&
           (!(uri = GetURI(nameqn)) ||
            (elem->xml_class == JSXML_CLASS_ELEMENT &&
             js_EqualStrings(GetURI(elem->name), uri)));
}

/* ECMA-357 9.1.1.8 XML [[Descendants]] and 9.2.1.8 XMLList [[Descendants]]. */
static JSBool
DescendantsHelper(JSContext *cx, JSXML *xml, JSObject *nameqn, JSXML *list)
{
    uint32 i, n;
    JSXML *attr, *kid;

    JS_CHECK_RECURSION(cx, return JS_FALSE);

    if (xml->xml_class == JSXML_CLASS_ELEMENT &&
        OBJ_GET_CLASS(cx, nameqn) == &js_AttributeNameClass) {
        for (i = 0, n = xml->xml_attrs.length; i < n; i++) {
            attr = XMLARRAY_MEMBER(&xml->xml_attrs, i, JSXML);
            if (attr && MatchAttrName(nameqn, attr)) {
                if (!Append(cx, list, attr))
                    return JS_FALSE;
            }
        }
    }

    for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
        kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
        if (!kid)
            continue;
        if (OBJ_GET_CLASS(cx, nameqn) != &js_AttributeNameClass &&
            MatchElemName(nameqn, kid)) {
            if (!Append(cx, list, kid))
                return JS_FALSE;
        }
        if (!DescendantsHelper(cx, kid, nameqn, list))
            return JS_FALSE;
    }
    return JS_TRUE;
}

static JSXML *
Descendants(JSContext *cx, JSXML *xml, jsval id)
{
    jsid funid;
    JSObject *nameqn;
    JSObject *listobj;
    JSXML *list, *kid;
    uint32 i, n;
    JSBool ok;

    nameqn = ToXMLName(cx, id, &funid);
    if (!nameqn)
        return NULL;

    listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
    if (!listobj)
        return NULL;
    list = (JSXML *) JS_GetPrivate(cx, listobj);
    if (funid)
        return list;

    /*
     * Protect nameqn's object and strings from GC by linking list to it
     * temporarily.  The cx->newborn[GCX_OBJECT] GC root protects listobj,
     * which protects list.  Any other object allocations occuring beneath
     * DescendantsHelper use local roots.
     */
    list->name = nameqn;
    if (!js_EnterLocalRootScope(cx))
        return NULL;
    if (xml->xml_class == JSXML_CLASS_LIST) {
        ok = JS_TRUE;
        for (i = 0, n = xml->xml_kids.length; i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
                ok = DescendantsHelper(cx, kid, nameqn, list);
                if (!ok)
                    break;
            }
        }
    } else {
        ok = DescendantsHelper(cx, xml, nameqn, list);
    }
    js_LeaveLocalRootScopeWithResult(cx, (jsval) list);
    if (!ok)
        return NULL;
    list->name = NULL;
    return list;
}

static JSBool
xml_equality(JSContext *cx, JSObject *obj, jsval v, JSBool *bp);

/* Recursive (JSXML *) parameterized version of Equals. */
static JSBool
XMLEquals(JSContext *cx, JSXML *xml, JSXML *vxml, JSBool *bp)
{
    JSObject *qn, *vqn;
    uint32 i, j, n;
    JSXMLArrayCursor cursor, vcursor;
    JSXML *kid, *vkid, *attr, *vattr;
    JSBool ok;
    JSObject *xobj, *vobj;

retry:
    if (xml->xml_class != vxml->xml_class) {
        if (xml->xml_class == JSXML_CLASS_LIST && xml->xml_kids.length == 1) {
            xml = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
            if (xml)
                goto retry;
        }
        if (vxml->xml_class == JSXML_CLASS_LIST && vxml->xml_kids.length == 1) {
            vxml = XMLARRAY_MEMBER(&vxml->xml_kids, 0, JSXML);
            if (vxml)
                goto retry;
        }
        *bp = JS_FALSE;
        return JS_TRUE;
    }

    qn = xml->name;
    vqn = vxml->name;
    if (qn) {
        *bp = vqn &&
              js_EqualStrings(GetLocalName(qn), GetLocalName(vqn)) &&
              js_EqualStrings(GetURI(qn), GetURI(vqn));
    } else {
        *bp = vqn == NULL;
    }
    if (!*bp)
        return JS_TRUE;

    if (JSXML_HAS_VALUE(xml)) {
        *bp = js_EqualStrings(xml->xml_value, vxml->xml_value);
    } else if (xml->xml_kids.length != vxml->xml_kids.length) {
        *bp = JS_FALSE;
    } else {
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        XMLArrayCursorInit(&vcursor, &vxml->xml_kids);
        for (;;) {
            kid = (JSXML *) XMLArrayCursorNext(&cursor);
            vkid = (JSXML *) XMLArrayCursorNext(&vcursor);
            if (!kid || !vkid) {
                *bp = !kid && !vkid;
                ok = JS_TRUE;
                break;
            }
            xobj = js_GetXMLObject(cx, kid);
            vobj = js_GetXMLObject(cx, vkid);
            ok = xobj && vobj &&
                 xml_equality(cx, xobj, OBJECT_TO_JSVAL(vobj), bp);
            if (!ok || !*bp)
                break;
        }
        XMLArrayCursorFinish(&vcursor);
        XMLArrayCursorFinish(&cursor);
        if (!ok)
            return JS_FALSE;

        if (*bp && xml->xml_class == JSXML_CLASS_ELEMENT) {
            n = xml->xml_attrs.length;
            if (n != vxml->xml_attrs.length)
                *bp = JS_FALSE;
            for (i = 0; *bp && i < n; i++) {
                attr = XMLARRAY_MEMBER(&xml->xml_attrs, i, JSXML);
                if (!attr)
                    continue;
                j = XMLARRAY_FIND_MEMBER(&vxml->xml_attrs, attr, attr_identity);
                if (j == XML_NOT_FOUND) {
                    *bp = JS_FALSE;
                    break;
                }
                vattr = XMLARRAY_MEMBER(&vxml->xml_attrs, j, JSXML);
                if (!vattr)
                    continue;
                *bp = js_EqualStrings(attr->xml_value, vattr->xml_value);
            }
        }
    }

    return JS_TRUE;
}

/* ECMA-357 9.1.1.9 XML [[Equals]] and 9.2.1.9 XMLList [[Equals]]. */
static JSBool
Equals(JSContext *cx, JSXML *xml, jsval v, JSBool *bp)
{
    JSObject *vobj;
    JSXML *vxml;

    if (JSVAL_IS_PRIMITIVE(v)) {
        *bp = JS_FALSE;
        if (xml->xml_class == JSXML_CLASS_LIST) {
            if (xml->xml_kids.length == 1) {
                vxml = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
                if (!vxml)
                    return JS_TRUE;
                vobj = js_GetXMLObject(cx, vxml);
                if (!vobj)
                    return JS_FALSE;
                return js_XMLObjectOps.equality(cx, vobj, v, bp);
            }
            if (JSVAL_IS_VOID(v) && xml->xml_kids.length == 0)
                *bp = JS_TRUE;
        }
    } else {
        vobj = JSVAL_TO_OBJECT(v);
        if (!OBJECT_IS_XML(cx, vobj)) {
            *bp = JS_FALSE;
        } else {
            vxml = (JSXML *) JS_GetPrivate(cx, vobj);
            if (!XMLEquals(cx, xml, vxml, bp))
                return JS_FALSE;
        }
    }
    return JS_TRUE;
}

static JSBool
CheckCycle(JSContext *cx, JSXML *xml, JSXML *kid)
{
    JS_ASSERT(kid->xml_class != JSXML_CLASS_LIST);

    do {
        if (xml == kid) {
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_CYCLIC_VALUE, js_XML_str);
            return JS_FALSE;
        }
    } while ((xml = xml->parent) != NULL);

    return JS_TRUE;
}

/* ECMA-357 9.1.1.11 XML [[Insert]]. */
static JSBool
Insert(JSContext *cx, JSXML *xml, uint32 i, jsval v)
{
    uint32 j, n;
    JSXML *vxml, *kid;
    JSObject *vobj;
    JSString *str;

    if (!JSXML_HAS_KIDS(xml))
        return JS_TRUE;

    n = 1;
    vxml = NULL;
    if (!JSVAL_IS_PRIMITIVE(v)) {
        vobj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, vobj)) {
            vxml = (JSXML *) JS_GetPrivate(cx, vobj);
            if (vxml->xml_class == JSXML_CLASS_LIST) {
                n = vxml->xml_kids.length;
                if (n == 0)
                    return JS_TRUE;
                for (j = 0; j < n; j++) {
                    kid = XMLARRAY_MEMBER(&vxml->xml_kids, j, JSXML);
                    if (!kid)
                        continue;
                    if (!CheckCycle(cx, xml, kid))
                        return JS_FALSE;
                }
            } else if (vxml->xml_class == JSXML_CLASS_ELEMENT) {
                /* OPTION: enforce that descendants have superset namespaces. */
                if (!CheckCycle(cx, xml, vxml))
                    return JS_FALSE;
            }
        }
    }
    if (!vxml) {
        str = js_ValueToString(cx, v);
        if (!str)
            return JS_FALSE;

        vxml = js_NewXML(cx, JSXML_CLASS_TEXT);
        if (!vxml)
            return JS_FALSE;
        vxml->xml_value = str;
    }

    if (i > xml->xml_kids.length)
        i = xml->xml_kids.length;

    if (!XMLArrayInsert(cx, &xml->xml_kids, i, n))
        return JS_FALSE;

    if (vxml->xml_class == JSXML_CLASS_LIST) {
        for (j = 0; j < n; j++) {
            kid = XMLARRAY_MEMBER(&vxml->xml_kids, j, JSXML);
            if (!kid)
                continue;
            kid->parent = xml;
            XMLARRAY_SET_MEMBER(&xml->xml_kids, i + j, kid);

            /* OPTION: enforce that descendants have superset namespaces. */
        }
    } else {
        vxml->parent = xml;
        XMLARRAY_SET_MEMBER(&xml->xml_kids, i, vxml);
    }
    return JS_TRUE;
}

static JSBool
IndexToIdVal(JSContext *cx, uint32 index, jsval *idvp)
{
    JSString *str;

    if (index <= JSVAL_INT_MAX) {
        *idvp = INT_TO_JSVAL(index);
    } else {
        str = js_NumberToString(cx, (jsdouble) index);
        if (!str)
            return JS_FALSE;
        *idvp = STRING_TO_JSVAL(str);
    }
    return JS_TRUE;
}

/* ECMA-357 9.1.1.12 XML [[Replace]]. */
static JSBool
Replace(JSContext *cx, JSXML *xml, uint32 i, jsval v)
{
    uint32 n;
    JSXML *vxml, *kid;
    JSObject *vobj;
    JSString *str;

    if (!JSXML_HAS_KIDS(xml))
        return JS_TRUE;

    /*
     * 9.1.1.12
     * [[Replace]] handles _i >= x.[[Length]]_ by incrementing _x.[[Length]_.
     * It should therefore constrain callers to pass in _i <= x.[[Length]]_.
     */
    n = xml->xml_kids.length;
    if (i > n)
        i = n;

    vxml = NULL;
    if (!JSVAL_IS_PRIMITIVE(v)) {
        vobj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, vobj))
            vxml = (JSXML *) JS_GetPrivate(cx, vobj);
    }

    switch (vxml ? vxml->xml_class : JSXML_CLASS_LIMIT) {
      case JSXML_CLASS_ELEMENT:
        /* OPTION: enforce that descendants have superset namespaces. */
        if (!CheckCycle(cx, xml, vxml))
            return JS_FALSE;
      case JSXML_CLASS_COMMENT:
      case JSXML_CLASS_PROCESSING_INSTRUCTION:
      case JSXML_CLASS_TEXT:
        goto do_replace;

      case JSXML_CLASS_LIST:
        if (i < n)
            DeleteByIndex(cx, xml, i);
        if (!Insert(cx, xml, i, v))
            return JS_FALSE;
        break;

      default:
        str = js_ValueToString(cx, v);
        if (!str)
            return JS_FALSE;

        vxml = js_NewXML(cx, JSXML_CLASS_TEXT);
        if (!vxml)
            return JS_FALSE;
        vxml->xml_value = str;

      do_replace:
        vxml->parent = xml;
        if (i < n) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid)
                kid->parent = NULL;
        }
        if (!XMLARRAY_ADD_MEMBER(cx, &xml->xml_kids, i, vxml))
            return JS_FALSE;
        break;
    }

    return JS_TRUE;
}

/* ECMA-357 9.1.1.3 XML [[Delete]], 9.2.1.3 XML [[Delete]] qname cases. */
static void
DeleteNamedProperty(JSContext *cx, JSXML *xml, JSObject *nameqn,
                    JSBool attributes)
{
    JSXMLArray *array;
    uint32 index, deleteCount;
    JSXML *kid;
    JSXMLNameMatcher matcher;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        array = &xml->xml_kids;
        for (index = 0; index < array->length; index++) {
            kid = XMLARRAY_MEMBER(array, index, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT)
                DeleteNamedProperty(cx, kid, nameqn, attributes);
        }
    } else if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        if (attributes) {
            array = &xml->xml_attrs;
            matcher = MatchAttrName;
        } else {
            array = &xml->xml_kids;
            matcher = MatchElemName;
        }
        deleteCount = 0;
        for (index = 0; index < array->length; index++) {
            kid = XMLARRAY_MEMBER(array, index, JSXML);
            if (kid && matcher(nameqn, kid)) {
                kid->parent = NULL;
                XMLArrayDelete(cx, array, index, JS_FALSE);
                ++deleteCount;
            } else if (deleteCount != 0) {
                XMLARRAY_SET_MEMBER(array,
                                    index - deleteCount,
                                    array->vector[index]);
            }
        }
        array->length -= deleteCount;
    }
}

/* ECMA-357 9.2.1.3 index case. */
static void
DeleteListElement(JSContext *cx, JSXML *xml, uint32 index)
{
    JSXML *kid, *parent;
    uint32 kidIndex;

    JS_ASSERT(xml->xml_class == JSXML_CLASS_LIST);

    if (index < xml->xml_kids.length) {
        kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML);
        if (kid) {
            parent = kid->parent;
            if (parent) {
                JS_ASSERT(parent != xml);
                JS_ASSERT(JSXML_HAS_KIDS(parent));

                if (kid->xml_class == JSXML_CLASS_ATTRIBUTE) {
                    DeleteNamedProperty(cx, parent, kid->name, JS_TRUE);
                } else {
                    kidIndex = XMLARRAY_FIND_MEMBER(&parent->xml_kids, kid,
                                                    NULL);
                    JS_ASSERT(kidIndex != XML_NOT_FOUND);
                    DeleteByIndex(cx, parent, kidIndex);
                }
            }
            XMLArrayDelete(cx, &xml->xml_kids, index, JS_TRUE);
        }
    }
}

static JSBool
SyncInScopeNamespaces(JSContext *cx, JSXML *xml)
{
    JSXMLArray *nsarray;
    uint32 i, n;
    JSObject *ns;

    nsarray = &xml->xml_namespaces;
    while ((xml = xml->parent) != NULL) {
        for (i = 0, n = xml->xml_namespaces.length; i < n; i++) {
            ns = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
            if (ns && !XMLARRAY_HAS_MEMBER(nsarray, ns, namespace_identity)) {
                if (!XMLARRAY_APPEND(cx, nsarray, ns))
                    return JS_FALSE;
            }
        }
    }
    return JS_TRUE;
}

static JSBool
GetNamedProperty(JSContext *cx, JSXML *xml, JSObject* nameqn, JSXML *list)
{
    JSXMLArray *array;
    JSXMLNameMatcher matcher;
    JSXMLArrayCursor cursor;
    JSXML *kid;
    JSBool attrs;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (kid->xml_class == JSXML_CLASS_ELEMENT &&
                !GetNamedProperty(cx, kid, nameqn, list)) {
                break;
            }
        }
        XMLArrayCursorFinish(&cursor);
        if (kid)
            return JS_FALSE;
    } else if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        attrs = (OBJ_GET_CLASS(cx, nameqn) == &js_AttributeNameClass);
        if (attrs) {
            array = &xml->xml_attrs;
            matcher = MatchAttrName;
        } else {
            array = &xml->xml_kids;
            matcher = MatchElemName;
        }

        XMLArrayCursorInit(&cursor, array);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (matcher(nameqn, kid)) {
                if (!attrs &&
                    kid->xml_class == JSXML_CLASS_ELEMENT &&
                    !SyncInScopeNamespaces(cx, kid)) {
                    break;
                }
                if (!Append(cx, list, kid))
                    break;
            }
        }
        XMLArrayCursorFinish(&cursor);
        if (kid)
            return JS_FALSE;
    }

    return JS_TRUE;
}

/* ECMA-357 9.1.1.1 XML [[Get]] and 9.2.1.1 XMLList [[Get]]. */
static JSBool
GetProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSXML *xml, *list, *kid;
    uint32 index;
    JSObject *kidobj, *listobj;
    JSObject *nameqn;
    jsid funid;
    jsval roots[2];
    JSTempValueRooter tvr;

    xml = (JSXML *) JS_GetInstancePrivate(cx, obj, &js_XMLClass, NULL);
    if (!xml)
        return JS_TRUE;

    if (js_IdIsIndex(id, &index)) {
        if (xml->xml_class != JSXML_CLASS_LIST) {
            *vp = (index == 0) ? OBJECT_TO_JSVAL(obj) : JSVAL_VOID;
        } else {
            /*
             * ECMA-357 9.2.1.1 starts here.
             *
             * Erratum: 9.2 is not completely clear that indexed properties
             * correspond to kids, but that's what it seems to say, and it's
             * what any sane user would want.
             */
            if (index < xml->xml_kids.length) {
                kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML);
                if (!kid) {
                    *vp = JSVAL_VOID;
                    return JS_TRUE;
                }
                kidobj = js_GetXMLObject(cx, kid);
                if (!kidobj)
                    return JS_FALSE;

                *vp = OBJECT_TO_JSVAL(kidobj);
            } else {
                *vp = JSVAL_VOID;
            }
        }
        return JS_TRUE;
    }

    /*
     * ECMA-357 9.2.1.1/9.1.1.1 qname case.
     */
    nameqn = ToXMLName(cx, id, &funid);
    if (!nameqn)
        return JS_FALSE;
    if (funid)
        return js_GetXMLFunction(cx, obj, funid, vp);

    roots[0] = OBJECT_TO_JSVAL(nameqn);
    JS_PUSH_TEMP_ROOT(cx, 1, roots, &tvr);

    listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
    if (listobj) {
        roots[1] = OBJECT_TO_JSVAL(listobj);
        tvr.count++;

        list = (JSXML *) JS_GetPrivate(cx, listobj);
        if (!GetNamedProperty(cx, xml, nameqn, list)) {
            listobj = NULL;
        } else {
            /*
             * Erratum: ECMA-357 9.1.1.1 misses that [[Append]] sets the
             * given list's [[TargetProperty]] to the property that is being
             * appended. This means that any use of the internal [[Get]]
             * property returns a list which, when used by e.g. [[Insert]]
             * duplicates the last element matched by id. See bug 336921.
             */
            list->xml_target = xml;
            list->xml_targetprop = nameqn;
            *vp = OBJECT_TO_JSVAL(listobj);
        }
    }

    JS_POP_TEMP_ROOT(cx, &tvr);
    return listobj != NULL;
}

static JSXML *
CopyOnWrite(JSContext *cx, JSXML *xml, JSObject *obj)
{
    JS_ASSERT(xml->object != obj);

    xml = DeepCopy(cx, xml, obj, 0);
    if (!xml)
        return NULL;

    JS_ASSERT(xml->object == obj);
    return xml;
}

#define CHECK_COPY_ON_WRITE(cx,xml,obj)                                       \
    (xml->object == obj ? xml : CopyOnWrite(cx, xml, obj))

static JSString *
KidToString(JSContext *cx, JSXML *xml, uint32 index)
{
    JSXML *kid;
    JSObject *kidobj;

    kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML);
    if (!kid)
        return cx->runtime->emptyString;
    kidobj = js_GetXMLObject(cx, kid);
    if (!kidobj)
        return NULL;
    return js_ValueToString(cx, OBJECT_TO_JSVAL(kidobj));
}

/* Forward declared -- its implementation uses other statics that call it. */
static JSBool
ResolveValue(JSContext *cx, JSXML *list, JSXML **result);

/* ECMA-357 9.1.1.2 XML [[Put]] and 9.2.1.2 XMLList [[Put]]. */
static JSBool
PutProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSBool ok, primitiveAssign;
    enum { OBJ_ROOT, ID_ROOT, VAL_ROOT };
    jsval roots[3];
    JSTempValueRooter tvr;
    JSXML *xml, *vxml, *rxml, *kid, *attr, *parent, *copy, *kid2, *match;
    JSObject *vobj, *nameobj, *attrobj, *parentobj, *kidobj, *copyobj;
    JSObject *targetprop, *nameqn, *attrqn;
    uint32 index, i, j, k, n, q, matchIndex;
    jsval attrval, nsval;
    jsid funid;
    JSString *left, *right, *space, *uri;
    JSObject *ns;

    xml = (JSXML *) JS_GetInstancePrivate(cx, obj, &js_XMLClass, NULL);
    if (!xml)
        return JS_TRUE;

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    /* Precompute vxml for 9.2.1.2 2(c)(vii)(2-3) and 2(d) and 9.1.1.2 1. */
    vxml = NULL;
    if (!JSVAL_IS_PRIMITIVE(*vp)) {
        vobj = JSVAL_TO_OBJECT(*vp);
        if (OBJECT_IS_XML(cx, vobj))
            vxml = (JSXML *) JS_GetPrivate(cx, vobj);
    }

    ok = js_EnterLocalRootScope(cx);
    if (!ok)
        return JS_FALSE;
    MUST_FLOW_THROUGH("out");
    roots[OBJ_ROOT] = OBJECT_TO_JSVAL(obj);
    roots[ID_ROOT] = id;
    roots[VAL_ROOT] = *vp;
    JS_PUSH_TEMP_ROOT(cx, 3, roots, &tvr);

    if (js_IdIsIndex(id, &index)) {
        if (xml->xml_class != JSXML_CLASS_LIST) {
            /* See NOTE in spec: this variation is reserved for future use. */
            ReportBadXMLName(cx, id);
            goto bad;
        }

        /*
         * Step 1 of ECMA-357 9.2.1.2 index case sets i to the property index.
         */
        i = index;

        /* 2(a-b). */
        if (xml->xml_target) {
            ok = ResolveValue(cx, xml->xml_target, &rxml);
            if (!ok)
                goto out;
            if (!rxml)
                goto out;
            JS_ASSERT(rxml->object);
        } else {
            rxml = NULL;
        }

        /* 2(c). */
        if (index >= xml->xml_kids.length) {
            /* 2(c)(i). */
            if (rxml) {
                if (rxml->xml_class == JSXML_CLASS_LIST) {
                    if (rxml->xml_kids.length != 1)
                        goto out;
                    rxml = XMLARRAY_MEMBER(&rxml->xml_kids, 0, JSXML);
                    if (!rxml)
                        goto out;
                    ok = js_GetXMLObject(cx, rxml) != NULL;
                    if (!ok)
                        goto out;
                }

                /*
                 * Erratum: ECMA-357 9.2.1.2 step 2(c)(ii) sets
                 * _y.[[Parent]] = r_ where _r_ is the result of
                 * [[ResolveValue]] called on _x.[[TargetObject]] in
                 * 2(a)(i).  This can result in text parenting text:
                 *
                 *    var MYXML = new XML();
                 *    MYXML.appendChild(new XML("<TEAM>Giants</TEAM>"));
                 *
                 * (testcase from Werner Sharp <wsharp@macromedia.com>).
                 *
                 * To match insertChildAfter, insertChildBefore,
                 * prependChild, and setChildren, we should silently
                 * do nothing in this case.
                 */
                if (!JSXML_HAS_KIDS(rxml))
                    goto out;
            }

            /* 2(c)(ii) is distributed below as several js_NewXML calls. */
            targetprop = xml->xml_targetprop;
            if (!targetprop || IS_STAR(GetLocalName(targetprop))) {
                /* 2(c)(iv)(1-2), out of order w.r.t. 2(c)(iii). */
                kid = js_NewXML(cx, JSXML_CLASS_TEXT);
                if (!kid)
                    goto bad;
            } else {
                nameobj = targetprop;
                if (!nameobj)
                    goto bad;
                if (OBJ_GET_CLASS(cx, nameobj) == &js_AttributeNameClass) {
                    /*
                     * 2(c)(iii)(1-3).
                     * Note that rxml can't be null here, because target
                     * and targetprop are non-null.
                     */
                    ok = GetProperty(cx, rxml->object, id, &attrval);
                    if (!ok)
                        goto out;
                    if (JSVAL_IS_PRIMITIVE(attrval))    /* no such attribute */
                        goto out;
                    attrobj = JSVAL_TO_OBJECT(attrval);
                    attr = (JSXML *) JS_GetPrivate(cx, attrobj);
                    if (JSXML_LENGTH(attr) != 0)
                        goto out;

                    kid = js_NewXML(cx, JSXML_CLASS_ATTRIBUTE);
                } else {
                    /* 2(c)(v). */
                    kid = js_NewXML(cx, JSXML_CLASS_ELEMENT);
                }
                if (!kid)
                    goto bad;

                /* An important bit of 2(c)(ii). */
                kid->name = targetprop;
            }

            /* Final important bit of 2(c)(ii). */
            kid->parent = rxml;

            /* 2(c)(vi-vii). */
            i = xml->xml_kids.length;
            if (kid->xml_class != JSXML_CLASS_ATTRIBUTE) {
                /*
                 * 2(c)(vii)(1) tests whether _y.[[Parent]]_ is not null.
                 * y.[[Parent]] is here called kid->parent, which we know
                 * from 2(c)(ii) is _r_, here called rxml.  So let's just
                 * test that!  Erratum, the spec should be simpler here.
                 */
                if (rxml) {
                    JS_ASSERT(JSXML_HAS_KIDS(rxml));
                    n = rxml->xml_kids.length;
                    j = n - 1;
                    if (n != 0 && i != 0) {
                        for (n = j, j = 0; j < n; j++) {
                            if (rxml->xml_kids.vector[j] ==
                                xml->xml_kids.vector[i-1]) {
                                break;
                            }
                        }
                    }

                    kidobj = js_GetXMLObject(cx, kid);
                    if (!kidobj)
                        goto bad;
                    ok = Insert(cx, rxml, j + 1, OBJECT_TO_JSVAL(kidobj));
                    if (!ok)
                        goto out;
                }

                /*
                 * 2(c)(vii)(2-3).
                 * Erratum: [[PropertyName]] in 2(c)(vii)(3) must be a
                 * typo for [[TargetProperty]].
                 */
                if (vxml) {
                    kid->name = (vxml->xml_class == JSXML_CLASS_LIST)
                        ? vxml->xml_targetprop
                        : vxml->name;
                }
            }

            /* 2(c)(viii). */
            ok = Append(cx, xml, kid);
            if (!ok)
                goto out;
        }

        /* 2(d). */
        if (!vxml ||
            vxml->xml_class == JSXML_CLASS_TEXT ||
            vxml->xml_class == JSXML_CLASS_ATTRIBUTE) {
            ok = JS_ConvertValue(cx, *vp, JSTYPE_STRING, vp);
            if (!ok)
                goto out;
            roots[VAL_ROOT] = *vp;
        }

        /* 2(e). */
        kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
        if (!kid)
            goto out;
        parent = kid->parent;
        if (kid->xml_class == JSXML_CLASS_ATTRIBUTE) {
            nameobj = kid->name;
            if (OBJ_GET_CLASS(cx, nameobj) != &js_AttributeNameClass) {
                nameobj = NewXMLQName(cx, GetURI(nameobj), GetPrefix(nameobj),
                                      GetLocalName(nameobj),
                                      &js_AttributeNameClass);
                if (!nameobj)
                    goto bad;
            }
            id = OBJECT_TO_JSVAL(nameobj);

            if (parent) {
                /* 2(e)(i). */
                parentobj = js_GetXMLObject(cx, parent);
                if (!parentobj)
                    goto bad;
                ok = PutProperty(cx, parentobj, id, vp);
                if (!ok)
                    goto out;

                /* 2(e)(ii). */
                ok = GetProperty(cx, parentobj, id, vp);
                if (!ok)
                    goto out;
                attr = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(*vp));

                /* 2(e)(iii). */
                xml->xml_kids.vector[i] = attr->xml_kids.vector[0];
            }
        }

        /* 2(f). */
        else if (vxml && vxml->xml_class == JSXML_CLASS_LIST) {
            /*
             * 2(f)(i)
             *
             * Erratum: the spec says to create a shallow copy _c_ of _V_, but
             * if we do that we never change the parent of each child in the
             * list.  Since [[Put]] when called on an XML object deeply copies
             * the provided list _V_, we also do so here.  Perhaps the shallow
             * copy was a misguided optimization?
             */
            copy = DeepCopyInLRS(cx, vxml, 0);
            if (!copy)
                goto bad;
            copyobj = js_GetXMLObject(cx, copy);
            if (!copyobj)
                goto bad;

            JS_ASSERT(parent != xml);
            if (parent) {
                q = XMLARRAY_FIND_MEMBER(&parent->xml_kids, kid, NULL);
                JS_ASSERT(q != XML_NOT_FOUND);
                ok = Replace(cx, parent, q, OBJECT_TO_JSVAL(copyobj));
                if (!ok)
                    goto out;

#ifdef DEBUG
                /* Erratum: this loop in the spec is useless. */
                for (j = 0, n = copy->xml_kids.length; j < n; j++) {
                    kid2 = XMLARRAY_MEMBER(&parent->xml_kids, q + j, JSXML);
                    JS_ASSERT(XMLARRAY_MEMBER(&copy->xml_kids, j, JSXML)
                              == kid2);
                }
#endif
            }

            /*
             * 2(f)(iv-vi).
             * Erratum: notice the unhandled zero-length V basis case and
             * the off-by-one errors for the n != 0 cases in the spec.
             */
            n = copy->xml_kids.length;
            if (n == 0) {
                XMLArrayDelete(cx, &xml->xml_kids, i, JS_TRUE);
            } else {
                ok = XMLArrayInsert(cx, &xml->xml_kids, i + 1, n - 1);
                if (!ok)
                    goto out;

                for (j = 0; j < n; j++)
                    xml->xml_kids.vector[i + j] = copy->xml_kids.vector[j];
            }
        }

        /* 2(g). */
        else if (vxml || JSXML_HAS_VALUE(kid)) {
            if (parent) {
                q = XMLARRAY_FIND_MEMBER(&parent->xml_kids, kid, NULL);
                JS_ASSERT(q != XML_NOT_FOUND);
                ok = Replace(cx, parent, q, *vp);
                if (!ok)
                    goto out;

                vxml = XMLARRAY_MEMBER(&parent->xml_kids, q, JSXML);
                if (!vxml)
                    goto out;
                roots[VAL_ROOT] = *vp = OBJECT_TO_JSVAL(vxml->object);
            }

            /*
             * 2(g)(iii).
             * Erratum: _V_ may not be of type XML, but all index-named
             * properties _x[i]_ in an XMLList _x_ must be of type XML,
             * according to 9.2.1.1 Overview and other places in the spec.
             *
             * Thanks to 2(d), we know _V_ (*vp here) is either a string
             * or an XML/XMLList object.  If *vp is a string, call ToXML
             * on it to satisfy the constraint.
             */
            if (!vxml) {
                JS_ASSERT(JSVAL_IS_STRING(*vp));
                vobj = ToXML(cx, *vp);
                if (!vobj)
                    goto bad;
                roots[VAL_ROOT] = *vp = OBJECT_TO_JSVAL(vobj);
                vxml = (JSXML *) JS_GetPrivate(cx, vobj);
            }
            XMLARRAY_SET_MEMBER(&xml->xml_kids, i, vxml);
        }

        /* 2(h). */
        else {
            kidobj = js_GetXMLObject(cx, kid);
            if (!kidobj)
                goto bad;
            id = ATOM_KEY(cx->runtime->atomState.starAtom);
            ok = PutProperty(cx, kidobj, id, vp);
            if (!ok)
                goto out;
        }
    } else {
        /*
         * ECMA-357 9.2.1.2/9.1.1.2 qname case.
         */
        nameqn = ToXMLName(cx, id, &funid);
        if (!nameqn)
            goto bad;
        if (funid) {
            ok = js_SetProperty(cx, obj, funid, vp);
            goto out;
        }
        nameobj = nameqn;
        roots[ID_ROOT] = OBJECT_TO_JSVAL(nameobj);

        if (xml->xml_class == JSXML_CLASS_LIST) {
            /*
             * Step 3 of 9.2.1.2.
             * Erratum: if x.[[Length]] > 1 or [[ResolveValue]] returns null
             * or an r with r.[[Length]] != 1, throw TypeError.
             */
            n = JSXML_LENGTH(xml);
            if (n > 1)
                goto type_error;
            if (n == 0) {
                ok = ResolveValue(cx, xml, &rxml);
                if (!ok)
                    goto out;
                if (!rxml || JSXML_LENGTH(rxml) != 1)
                    goto type_error;
                ok = Append(cx, xml, rxml);
                if (!ok)
                    goto out;
            }
            JS_ASSERT(JSXML_LENGTH(xml) == 1);
            xml = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
            if (!xml)
                goto out;
            JS_ASSERT(xml->xml_class != JSXML_CLASS_LIST);
            obj = js_GetXMLObject(cx, xml);
            if (!obj)
                goto bad;
            roots[OBJ_ROOT] = OBJECT_TO_JSVAL(obj);

            /* FALL THROUGH to non-list case */
        }

        /*
         * ECMA-357 9.1.1.2.
         * Erratum: move steps 3 and 4 to before 1 and 2, to avoid wasted
         * effort in ToString or [[DeepCopy]].
         */

        if (JSXML_HAS_VALUE(xml))
            goto out;

        if (!vxml ||
            vxml->xml_class == JSXML_CLASS_TEXT ||
            vxml->xml_class == JSXML_CLASS_ATTRIBUTE) {
            ok = JS_ConvertValue(cx, *vp, JSTYPE_STRING, vp);
            if (!ok)
                goto out;
        } else {
            rxml = DeepCopyInLRS(cx, vxml, 0);
            if (!rxml || !js_GetXMLObject(cx, rxml))
                goto bad;
            vxml = rxml;
            *vp = OBJECT_TO_JSVAL(vxml->object);
        }
        roots[VAL_ROOT] = *vp;

        /*
         * 6.
         * Erratum: why is this done here, so early? use is way later....
         */
        ok = js_GetDefaultXMLNamespace(cx, &nsval);
        if (!ok)
            goto out;

        if (OBJ_GET_CLASS(cx, nameobj) == &js_AttributeNameClass) {
            /* 7(a). */
            if (!js_IsXMLName(cx, OBJECT_TO_JSVAL(nameobj)))
                goto out;

            /* 7(b-c). */
            if (vxml && vxml->xml_class == JSXML_CLASS_LIST) {
                n = vxml->xml_kids.length;
                if (n == 0) {
                    *vp = STRING_TO_JSVAL(cx->runtime->emptyString);
                } else {
                    left = KidToString(cx, vxml, 0);
                    if (!left)
                        goto bad;

                    space = ATOM_TO_STRING(cx->runtime->atomState.spaceAtom);
                    for (i = 1; i < n; i++) {
                        left = js_ConcatStrings(cx, left, space);
                        if (!left)
                            goto bad;
                        right = KidToString(cx, vxml, i);
                        if (!right)
                            goto bad;
                        left = js_ConcatStrings(cx, left, right);
                        if (!left)
                            goto bad;
                    }

                    roots[VAL_ROOT] = *vp = STRING_TO_JSVAL(left);
                }
            } else {
                ok = JS_ConvertValue(cx, *vp, JSTYPE_STRING, vp);
                if (!ok)
                    goto out;
                roots[VAL_ROOT] = *vp;
            }

            /* 7(d-e). */
            match = NULL;
            for (i = 0, n = xml->xml_attrs.length; i < n; i++) {
                attr = XMLARRAY_MEMBER(&xml->xml_attrs, i, JSXML);
                if (!attr)
                    continue;
                attrqn = attr->name;
                if (js_EqualStrings(GetLocalName(attrqn),
                                    GetLocalName(nameqn))) {
                    uri = GetURI(nameqn);
                    if (!uri || js_EqualStrings(GetURI(attrqn), uri)) {
                        if (!match) {
                            match = attr;
                        } else {
                            DeleteNamedProperty(cx, xml, attrqn, JS_TRUE);
                            --i;
                        }
                    }
                }
            }

            /* 7(f). */
            attr = match;
            if (!attr) {
                /* 7(f)(i-ii). */
                uri = GetURI(nameqn);
                if (!uri) {
                    left = right = cx->runtime->emptyString;
                } else {
                    left = uri;
                    right = GetPrefix(nameqn);
                }
                nameqn = NewXMLQName(cx, left, right, GetLocalName(nameqn));
                if (!nameqn)
                    goto bad;

                /* 7(f)(iii). */
                attr = js_NewXML(cx, JSXML_CLASS_ATTRIBUTE);
                if (!attr)
                    goto bad;
                attr->parent = xml;
                attr->name = nameqn;

                /* 7(f)(iv). */
                ok = XMLARRAY_ADD_MEMBER(cx, &xml->xml_attrs, n, attr);
                if (!ok)
                    goto out;

                /* 7(f)(v-vi). */
                ns = GetNamespace(cx, nameqn, NULL);
                if (!ns)
                    goto bad;
                ok = AddInScopeNamespace(cx, xml, ns);
                if (!ok)
                    goto out;
            }

            /* 7(g). */
            attr->xml_value = JSVAL_TO_STRING(*vp);
            goto out;
        }

        /* 8-9. */
        if (!js_IsXMLName(cx, OBJECT_TO_JSVAL(nameobj)) &&
            !IS_STAR(GetLocalName(nameqn))) {
            goto out;
        }

        /* 10-11. */
        id = JSVAL_VOID;
        primitiveAssign = !vxml && !IS_STAR(GetLocalName(nameqn));

        /* 12. */
        k = n = xml->xml_kids.length;
        matchIndex = XML_NOT_FOUND;
        kid2 = NULL;
        while (k != 0) {
            --k;
            kid = XMLARRAY_MEMBER(&xml->xml_kids, k, JSXML);
            if (kid && MatchElemName(nameqn, kid)) {
                if (matchIndex != XML_NOT_FOUND)
                    DeleteByIndex(cx, xml, matchIndex);
                matchIndex = k;
                kid2 = kid;
            }
        }

        /*
         * Erratum: ECMA-357 specified child insertion inconsistently:
         * insertChildBefore and insertChildAfter insert an arbitrary XML
         * instance, and therefore can create cycles, but appendChild as
         * specified by the "Overview" of 13.4.4.3 calls [[DeepCopy]] on
         * its argument.  But the "Semantics" in 13.4.4.3 do not include
         * any [[DeepCopy]] call.
         *
         * Fixing this (https://bugzilla.mozilla.org/show_bug.cgi?id=312692)
         * required adding cycle detection, and allowing duplicate kids to
         * be created (see comment 6 in the bug).  Allowing duplicate kid
         * references means the loop above will delete all but the lowest
         * indexed reference, and each [[DeleteByIndex]] nulls the kid's
         * parent.  Thus the need to restore parent here.  This is covered
         * by https://bugzilla.mozilla.org/show_bug.cgi?id=327564.
         */
        if (kid2) {
            JS_ASSERT(kid2->parent == xml || !kid2->parent);
            if (!kid2->parent)
                kid2->parent = xml;
        }

        /* 13. */
        if (matchIndex == XML_NOT_FOUND) {
            /* 13(a). */
            matchIndex = n;

            /* 13(b). */
            if (primitiveAssign) {
                uri = GetURI(nameqn);
                if (!uri) {
                    ns = JSVAL_TO_OBJECT(nsval);
                    left = GetURI(ns);
                    right = GetPrefix(ns);
                } else {
                    left = uri;
                    right = GetPrefix(nameqn);
                }
                nameqn = NewXMLQName(cx, left, right, GetLocalName(nameqn));
                if (!nameqn)
                    goto bad;

                /* 13(b)(iii). */
                vobj = js_NewXMLObject(cx, JSXML_CLASS_ELEMENT);
                if (!vobj)
                    goto bad;
                vxml = (JSXML *) JS_GetPrivate(cx, vobj);
                vxml->parent = xml;
                vxml->name = nameqn;

                /* 13(b)(iv-vi). */
                ns = GetNamespace(cx, nameqn, NULL);
                if (!ns)
                    goto bad;
                ok = Replace(cx, xml, matchIndex, OBJECT_TO_JSVAL(vobj));
                if (!ok)
                    goto out;
                ok = AddInScopeNamespace(cx, vxml, ns);
                if (!ok)
                    goto out;
            }
        }

        /* 14. */
        if (primitiveAssign) {
            JSXMLArrayCursor cursor;

            XMLArrayCursorInit(&cursor, &xml->xml_kids);
            cursor.index = matchIndex;
            kid = (JSXML *) XMLArrayCursorItem(&cursor);
            if (JSXML_HAS_KIDS(kid)) {
                XMLArrayFinish(cx, &kid->xml_kids);
                ok = XMLArrayInit(cx, &kid->xml_kids, 1);
            }

            /* 14(b-c). */
            /* XXXbe Erratum? redundant w.r.t. 7(b-c) else clause above */
            if (ok) {
                ok = JS_ConvertValue(cx, *vp, JSTYPE_STRING, vp);
                if (ok && !IS_EMPTY(JSVAL_TO_STRING(*vp))) {
                    roots[VAL_ROOT] = *vp;
                    if ((JSXML *) XMLArrayCursorItem(&cursor) == kid)
                        ok = Replace(cx, kid, 0, *vp);
                }
            }
            XMLArrayCursorFinish(&cursor);
        } else {
            /* 15(a). */
            ok = Replace(cx, xml, matchIndex, *vp);
        }
    }

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    js_LeaveLocalRootScope(cx);
    return ok;

type_error:
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_BAD_XMLLIST_PUT,
                         js_ValueToPrintableString(cx, id));
bad:
    ok = JS_FALSE;
    goto out;
}

/* ECMA-357 9.1.1.10 XML [[ResolveValue]], 9.2.1.10 XMLList [[ResolveValue]]. */
static JSBool
ResolveValue(JSContext *cx, JSXML *list, JSXML **result)
{
    JSXML *target, *base;
    JSObject *targetprop;
    jsval id, tv;

    /* Our caller must be protecting newborn objects. */
    JS_ASSERT(cx->localRootStack);

    if (list->xml_class != JSXML_CLASS_LIST || list->xml_kids.length != 0) {
        if (!js_GetXMLObject(cx, list))
            return JS_FALSE;
        *result = list;
        return JS_TRUE;
    }

    target = list->xml_target;
    targetprop = list->xml_targetprop;
    if (!target || !targetprop || IS_STAR(GetLocalName(targetprop))) {
        *result = NULL;
        return JS_TRUE;
    }

    if (OBJ_GET_CLASS(cx, targetprop) == &js_AttributeNameClass) {
        *result = NULL;
        return JS_TRUE;
    }

    if (!ResolveValue(cx, target, &base))
        return JS_FALSE;
    if (!base) {
        *result = NULL;
        return JS_TRUE;
    }
    if (!js_GetXMLObject(cx, base))
        return JS_FALSE;

    id = OBJECT_TO_JSVAL(targetprop);
    if (!GetProperty(cx, base->object, id, &tv))
        return JS_FALSE;
    target = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(tv));

    if (JSXML_LENGTH(target) == 0) {
        if (base->xml_class == JSXML_CLASS_LIST && JSXML_LENGTH(base) > 1) {
            *result = NULL;
            return JS_TRUE;
        }
        tv = STRING_TO_JSVAL(cx->runtime->emptyString);
        if (!PutProperty(cx, base->object, id, &tv))
            return JS_FALSE;
        if (!GetProperty(cx, base->object, id, &tv))
            return JS_FALSE;
        target = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(tv));
    }

    *result = target;
    return JS_TRUE;
}

static JSBool
HasNamedProperty(JSXML *xml, JSObject *nameqn)
{
    JSBool found;
    JSXMLArrayCursor cursor;
    JSXML *kid;
    JSXMLArray *array;
    JSXMLNameMatcher matcher;
    uint32 i, n;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        found = JS_FALSE;
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            found = HasNamedProperty(kid, nameqn);
            if (found)
                break;
        }
        XMLArrayCursorFinish(&cursor);
        return found;
    }

    if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        if (OBJ_GET_CLASS(cx, nameqn) == &js_AttributeNameClass) {
            array = &xml->xml_attrs;
            matcher = MatchAttrName;
        } else {
            array = &xml->xml_kids;
            matcher = MatchElemName;
        }
        for (i = 0, n = array->length; i < n; i++) {
            kid = XMLARRAY_MEMBER(array, i, JSXML);
            if (kid && matcher(nameqn, kid))
                return JS_TRUE;
        }
    }

    return JS_FALSE;
}

static JSBool
HasIndexedProperty(JSXML *xml, uint32 i)
{
    if (xml->xml_class == JSXML_CLASS_LIST)
        return i < JSXML_LENGTH(xml);

    if (xml->xml_class == JSXML_CLASS_ELEMENT)
        return i == 0;

    return JS_FALSE;
}

static JSBool
HasSimpleContent(JSXML *xml);

static JSBool
HasFunctionProperty(JSContext *cx, JSObject *obj, jsid funid, JSBool *found)
{
    JSObject *pobj;
    JSProperty *prop;
    JSXML *xml;
    JSTempValueRooter tvr;
    JSBool ok;

    JS_ASSERT(OBJ_GET_CLASS(cx, obj) == &js_XMLClass);

    if (!js_LookupProperty(cx, obj, funid, &pobj, &prop))
        return JS_FALSE;
    if (prop) {
        OBJ_DROP_PROPERTY(cx, pobj, prop);
    } else {
        xml = (JSXML *) JS_GetPrivate(cx, obj);
        if (HasSimpleContent(xml)) {
            /*
             * Search in String.prototype to set found whenever
             * js_GetXMLFunction returns existing function.
             */
            JS_PUSH_TEMP_ROOT_OBJECT(cx, NULL, &tvr);
            ok = js_GetClassPrototype(cx, NULL, INT_TO_JSID(JSProto_String),
                                      &tvr.u.object);
            JS_ASSERT(tvr.u.object);
            if (ok) {
                ok = js_LookupProperty(cx, tvr.u.object, funid, &pobj, &prop);
                if (ok && prop)
                    OBJ_DROP_PROPERTY(cx, pobj, prop);
            }
            JS_POP_TEMP_ROOT(cx, &tvr);
            if (!ok)
                return JS_FALSE;
        }
    }
    *found = (prop != NULL);
    return JS_TRUE;
}

/* ECMA-357 9.1.1.6 XML [[HasProperty]] and 9.2.1.5 XMLList [[HasProperty]]. */
static JSBool
HasProperty(JSContext *cx, JSObject *obj, jsval id, JSBool *found)
{
    JSXML *xml;
    uint32 i;
    JSObject *qn;
    jsid funid;

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (js_IdIsIndex(id, &i)) {
        *found = HasIndexedProperty(xml, i);
    } else {
        qn = ToXMLName(cx, id, &funid);
        if (!qn)
            return JS_FALSE;
        if (funid) {
            if (!HasFunctionProperty(cx, obj, funid, found))
                return JS_FALSE;
        } else {
            *found = HasNamedProperty(xml, qn);
        }
    }
    return JS_TRUE;
}

static void
xml_finalize(JSContext *cx, JSObject *obj)
{
    JSXML *xml;

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (!xml)
        return;
    if (xml->object == obj)
        xml->object = NULL;
}

static void
xml_trace_vector(JSTracer *trc, JSXML **vec, uint32 len)
{
    uint32 i;
    JSXML *xml;

    for (i = 0; i < len; i++) {
        xml = vec[i];
        if (xml) {
            JS_SET_TRACING_INDEX(trc, "xml_vector", i);
            JS_CallTracer(trc, xml, JSTRACE_XML);
        }
    }
}

/*
 * js_XMLObjectOps.newObjectMap == js_NewObjectMap, so XML objects appear to
 * be native.  Therefore, xml_lookupProperty must return a valid JSProperty
 * pointer parameter via *propp to signify "property found".  Since the only
 * call to xml_lookupProperty is via OBJ_LOOKUP_PROPERTY, and then only from
 * js_FindProperty (in jsobj.c, called from jsinterp.c) or from JSOP_IN case
 * in the interpreter, the only time we add a JSScopeProperty here is when an
 * unqualified name is being accessed or when "name in xml" is called.
 *
 * This scope property keeps the JSOP_NAME code in js_Interpret happy by
 * giving it an sprop with (getter, setter) == (GetProperty, PutProperty).
 *
 * NB: xml_deleteProperty must take care to remove any property added here.
 *
 * FIXME This clashes with the function namespace implementation which also
 * uses native properties. Effectively after xml_lookupProperty any property
 * stored previously using assignments to xml.function::name will be removed.
 * We partially workaround the problem in js_GetXMLFunction. There we take
 * advantage of the fact that typically function:: is used to access the
 * functions from XML.prototype. So when js_GetProperty returns a non-function
 * property, we assume that it represents the result of GetProperty setter
 * hiding the function and use an extra prototype chain lookup to recover it.
 * For a proper solution see bug 355257.
*/
static JSBool
xml_lookupProperty(JSContext *cx, JSObject *obj, jsid id, JSObject **objp,
                   JSProperty **propp)
{
    jsval v;
    JSBool found;
    JSXML *xml;
    uint32 i;
    JSObject *qn;
    jsid funid;
    JSScopeProperty *sprop;

    v = ID_TO_VALUE(id);
    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (js_IdIsIndex(v, &i)) {
        found = HasIndexedProperty(xml, i);
    } else {
        qn = ToXMLName(cx, v, &funid);
        if (!qn)
            return JS_FALSE;
        if (funid)
            return js_LookupProperty(cx, obj, funid, objp, propp);
        found = HasNamedProperty(xml, qn);
    }
    if (!found) {
        *objp = NULL;
        *propp = NULL;
    } else {
        sprop = js_AddNativeProperty(cx, obj, id, GetProperty, PutProperty,
                                     SPROP_INVALID_SLOT, JSPROP_ENUMERATE,
                                     0, 0);
        if (!sprop)
            return JS_FALSE;

        JS_LOCK_OBJ(cx, obj);
        *objp = obj;
        *propp = (JSProperty *) sprop;
    }
    return JS_TRUE;
}

static JSBool
xml_defineProperty(JSContext *cx, JSObject *obj, jsid id, jsval value,
                   JSPropertyOp getter, JSPropertyOp setter, uintN attrs,
                   JSProperty **propp)
{
    if (VALUE_IS_FUNCTION(cx, value) || getter || setter ||
        (attrs & JSPROP_ENUMERATE) == 0 ||
        (attrs & (JSPROP_READONLY | JSPROP_PERMANENT | JSPROP_SHARED))) {
        return js_DefineProperty(cx, obj, id, value, getter, setter, attrs,
                                 propp);
    }

    if (!PutProperty(cx, obj, ID_TO_VALUE(id), &value))
        return JS_FALSE;
    if (propp)
        *propp = NULL;
    return JS_TRUE;
}

static JSBool
xml_getProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    if (id == JS_DEFAULT_XML_NAMESPACE_ID) {
        *vp = JSVAL_VOID;
        return JS_TRUE;
    }

    return GetProperty(cx, obj, ID_TO_VALUE(id), vp);
}

static JSBool
xml_setProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    return PutProperty(cx, obj, ID_TO_VALUE(id), vp);
}

static JSBool
FoundProperty(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
              JSBool *foundp)
{
    if (!prop)
        return HasProperty(cx, obj, ID_TO_VALUE(id), foundp);

    *foundp = JS_TRUE;
    return JS_TRUE;
}

static JSBool
xml_getAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                  uintN *attrsp)
{
    JSBool found;

    if (!FoundProperty(cx, obj, id, prop, &found))
        return JS_FALSE;
    *attrsp = found ? JSPROP_ENUMERATE : 0;
    return JS_TRUE;
}

static JSBool
xml_setAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                  uintN *attrsp)
{
    JSBool found;

    if (!FoundProperty(cx, obj, id, prop, &found))
        return JS_FALSE;
    if (found) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_CANT_SET_XML_ATTRS);
    }
    return !found;
}

static JSBool
xml_deleteProperty(JSContext *cx, JSObject *obj, jsid id, jsval *rval)
{
    JSXML *xml;
    jsval idval;
    uint32 index;
    JSObject *nameqn;
    jsid funid;

    idval = ID_TO_VALUE(id);
    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (js_IdIsIndex(idval, &index)) {
        if (xml->xml_class != JSXML_CLASS_LIST) {
            /* See NOTE in spec: this variation is reserved for future use. */
            ReportBadXMLName(cx, id);
            return JS_FALSE;
        }

        /* ECMA-357 9.2.1.3. */
        DeleteListElement(cx, xml, index);
    } else {
        nameqn = ToXMLName(cx, idval, &funid);
        if (!nameqn)
            return JS_FALSE;
        if (funid)
            return js_DeleteProperty(cx, obj, funid, rval);

        DeleteNamedProperty(cx, xml, nameqn,
                            OBJ_GET_CLASS(cx, nameqn) ==
                            &js_AttributeNameClass);
    }

    /*
     * If this object has its own (mutable) scope,  then we may have added a
     * property to the scope in xml_lookupProperty for it to return to mean
     * "found" and to provide a handle for access operations to call the
     * property's getter or setter. But now it's time to remove any such
     * property, to purge the property cache and remove the scope entry.
     */
    if (OBJ_SCOPE(obj)->object == obj && !js_DeleteProperty(cx, obj, id, rval))
        return JS_FALSE;

    *rval = JSVAL_TRUE;
    return JS_TRUE;
}

static JSBool
xml_defaultValue(JSContext *cx, JSObject *obj, JSType hint, jsval *vp)
{
    JSXML *xml;

    if (hint == JSTYPE_OBJECT) {
        /* Called from for..in code in js_Interpret: return an XMLList. */
        xml = (JSXML *) JS_GetPrivate(cx, obj);
        if (xml->xml_class != JSXML_CLASS_LIST) {
            obj = ToXMLList(cx, OBJECT_TO_JSVAL(obj));
            if (!obj)
                return JS_FALSE;
        }
        *vp = OBJECT_TO_JSVAL(obj);
        return JS_TRUE;
    }

    return JS_CallFunctionName(cx, obj, js_toString_str, 0, NULL, vp);
}

static JSBool
xml_enumerate(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
              jsval *statep, jsid *idp)
{
    JSXML *xml;
    uint32 length, index;
    JSXMLArrayCursor *cursor;

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    length = JSXML_LENGTH(xml);

    switch (enum_op) {
      case JSENUMERATE_INIT:
        if (length == 0) {
            cursor = NULL;
        } else {
            cursor = (JSXMLArrayCursor *) JS_malloc(cx, sizeof *cursor);
            if (!cursor)
                return JS_FALSE;
            XMLArrayCursorInit(cursor, &xml->xml_kids);
        }
        *statep = PRIVATE_TO_JSVAL(cursor);
        if (idp)
            *idp = INT_TO_JSID(length);
        break;

      case JSENUMERATE_NEXT:
        cursor = (JSXMLArrayCursor *) JSVAL_TO_PRIVATE(*statep);
        if (cursor && cursor->array && (index = cursor->index) < length) {
            *idp = INT_TO_JSID(index);
            cursor->index = index + 1;
            break;
        }
        /* FALL THROUGH */

      case JSENUMERATE_DESTROY:
        cursor = (JSXMLArrayCursor *) JSVAL_TO_PRIVATE(*statep);
        if (cursor) {
            XMLArrayCursorFinish(cursor);
            JS_free(cx, cursor);
        }
        *statep = JSVAL_NULL;
        break;
    }
    return JS_TRUE;
}

static JSBool
xml_hasInstance(JSContext *cx, JSObject *obj, jsval v, JSBool *bp)
{
    return JS_TRUE;
}

static void
xml_trace(JSTracer *trc, JSObject *obj)
{
    JSXML *xml;

    xml = (JSXML *) JS_GetPrivate(trc->context, obj);
    if (xml)
        JS_CALL_TRACER(trc, xml, JSTRACE_XML, "private");
}

static void
xml_clear(JSContext *cx, JSObject *obj)
{
}

static JSBool
HasSimpleContent(JSXML *xml)
{
    JSXML *kid;
    JSBool simple;
    uint32 i, n;

again:
    switch (xml->xml_class) {
      case JSXML_CLASS_COMMENT:
      case JSXML_CLASS_PROCESSING_INSTRUCTION:
        return JS_FALSE;
      case JSXML_CLASS_LIST:
        if (xml->xml_kids.length == 0)
            return JS_TRUE;
        if (xml->xml_kids.length == 1) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
            if (kid) {
                xml = kid;
                goto again;
            }
        }
        /* FALL THROUGH */
      default:
        simple = JS_TRUE;
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
                simple = JS_FALSE;
                break;
            }
        }
        return simple;
    }
}

/*
 * 11.2.2.1 Step 3(d) onward.
 */
static JSObject *
xml_getMethod(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    JSTempValueRooter tvr;

    JS_ASSERT(JS_InstanceOf(cx, obj, &js_XMLClass, NULL));

    /*
     * As our callers have a bad habit of passing a pointer to an unrooted
     * local value as vp, we use a proper root here.
     */
    JS_PUSH_SINGLE_TEMP_ROOT(cx, JSVAL_NULL, &tvr);
    if (!js_GetXMLFunction(cx, obj, id, &tvr.u.value))
        obj = NULL;
    *vp = tvr.u.value;
    JS_POP_TEMP_ROOT(cx, &tvr);
    return obj;
}

static JSBool
xml_setMethod(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    return js_SetProperty(cx, obj, id, vp);
}

static JSBool
xml_enumerateValues(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
                    jsval *statep, jsid *idp, jsval *vp)
{
    JSXML *xml, *kid;
    uint32 length, index;
    JSXMLArrayCursor *cursor;
    JSObject *kidobj;

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    length = JSXML_LENGTH(xml);
    JS_ASSERT(INT_FITS_IN_JSVAL(length));

    switch (enum_op) {
      case JSENUMERATE_INIT:
        if (length == 0) {
            cursor = NULL;
        } else {
            cursor = (JSXMLArrayCursor *) JS_malloc(cx, sizeof *cursor);
            if (!cursor)
                return JS_FALSE;
            XMLArrayCursorInit(cursor, &xml->xml_kids);
        }
        *statep = PRIVATE_TO_JSVAL(cursor);
        if (idp)
            *idp = INT_TO_JSID(length);
        if (vp)
            *vp = JSVAL_VOID;
        break;

      case JSENUMERATE_NEXT:
        cursor = (JSXMLArrayCursor *) JSVAL_TO_PRIVATE(*statep);
        if (cursor && cursor->array && (index = cursor->index) < length) {
            while (!(kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML))) {
                if (++index == length)
                    goto destroy;
            }
            kidobj = js_GetXMLObject(cx, kid);
            if (!kidobj)
                return JS_FALSE;
            JS_ASSERT(INT_FITS_IN_JSVAL(index));
            *idp = INT_TO_JSID(index);
            *vp = OBJECT_TO_JSVAL(kidobj);
            cursor->index = index + 1;
            break;
        }
        /* FALL THROUGH */

      case JSENUMERATE_DESTROY:
        cursor = (JSXMLArrayCursor *) JSVAL_TO_PRIVATE(*statep);
        if (cursor) {
      destroy:
            XMLArrayCursorFinish(cursor);
            JS_free(cx, cursor);
        }
        *statep = JSVAL_NULL;
        break;
    }
    return JS_TRUE;
}

static JSBool
xml_equality(JSContext *cx, JSObject *obj, jsval v, JSBool *bp)
{
    JSXML *xml, *vxml;
    JSObject *vobj;
    JSBool ok;
    JSString *str, *vstr;
    jsdouble d, d2;

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    vxml = NULL;
    if (!JSVAL_IS_PRIMITIVE(v)) {
        vobj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, vobj))
            vxml = (JSXML *) JS_GetPrivate(cx, vobj);
    }

    if (xml->xml_class == JSXML_CLASS_LIST) {
        ok = Equals(cx, xml, v, bp);
    } else if (vxml) {
        if (vxml->xml_class == JSXML_CLASS_LIST) {
            ok = Equals(cx, vxml, OBJECT_TO_JSVAL(obj), bp);
        } else {
            if (((xml->xml_class == JSXML_CLASS_TEXT ||
                  xml->xml_class == JSXML_CLASS_ATTRIBUTE) &&
                 HasSimpleContent(vxml)) ||
                ((vxml->xml_class == JSXML_CLASS_TEXT ||
                  vxml->xml_class == JSXML_CLASS_ATTRIBUTE) &&
                 HasSimpleContent(xml))) {
                ok = js_EnterLocalRootScope(cx);
                if (ok) {
                    str = js_ValueToString(cx, OBJECT_TO_JSVAL(obj));
                    vstr = js_ValueToString(cx, v);
                    ok = str && vstr;
                    if (ok)
                        *bp = js_EqualStrings(str, vstr);
                    js_LeaveLocalRootScope(cx);
                }
            } else {
                ok = XMLEquals(cx, xml, vxml, bp);
            }
        }
    } else {
        ok = js_EnterLocalRootScope(cx);
        if (ok) {
            if (HasSimpleContent(xml)) {
                str = js_ValueToString(cx, OBJECT_TO_JSVAL(obj));
                vstr = js_ValueToString(cx, v);
                ok = str && vstr;
                if (ok)
                    *bp = js_EqualStrings(str, vstr);
            } else if (JSVAL_IS_STRING(v) || JSVAL_IS_NUMBER(v)) {
                str = js_ValueToString(cx, OBJECT_TO_JSVAL(obj));
                if (!str) {
                    ok = JS_FALSE;
                } else if (JSVAL_IS_STRING(v)) {
                    *bp = js_EqualStrings(str, JSVAL_TO_STRING(v));
                } else {
                    ok = JS_ValueToNumber(cx, STRING_TO_JSVAL(str), &d);
                    if (ok) {
                        d2 = JSVAL_IS_INT(v) ? JSVAL_TO_INT(v)
                                             : *JSVAL_TO_DOUBLE(v);
                        *bp = JSDOUBLE_COMPARE(d, ==, d2, JS_FALSE);
                    }
                }
            } else {
                *bp = JS_FALSE;
            }
            js_LeaveLocalRootScope(cx);
        }
    }
    return ok;
}

static JSBool
xml_concatenate(JSContext *cx, JSObject *obj, jsval v, jsval *vp)
{
    JSBool ok;
    JSObject *listobj, *robj;
    JSXML *list, *lxml, *rxml;

    ok = js_EnterLocalRootScope(cx);
    if (!ok)
        return JS_FALSE;

    listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
    if (!listobj) {
        ok = JS_FALSE;
        goto out;
    }

    list = (JSXML *) JS_GetPrivate(cx, listobj);
    lxml = (JSXML *) JS_GetPrivate(cx, obj);
    ok = Append(cx, list, lxml);
    if (!ok)
        goto out;

    if (VALUE_IS_XML(cx, v)) {
        rxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
    } else {
        robj = ToXML(cx, v);
        if (!robj) {
            ok = JS_FALSE;
            goto out;
        }
        rxml = (JSXML *) JS_GetPrivate(cx, robj);
    }
    ok = Append(cx, list, rxml);
    if (!ok)
        goto out;

    *vp = OBJECT_TO_JSVAL(listobj);
out:
    js_LeaveLocalRootScopeWithResult(cx, *vp);
    return ok;
}

/* Use js_NewObjectMap so XML objects satisfy OBJ_IS_NATIVE tests. */
JS_FRIEND_DATA(JSXMLObjectOps) js_XMLObjectOps = {
  { js_NewObjectMap,            js_DestroyObjectMap,
    xml_lookupProperty,         xml_defineProperty,
    xml_getProperty,            xml_setProperty,
    xml_getAttributes,          xml_setAttributes,
    xml_deleteProperty,         xml_defaultValue,
    xml_enumerate,              js_CheckAccess,
    NULL,                       NULL,
    NULL,                       NULL,
    NULL,                       xml_hasInstance,
    js_SetProtoOrParent,        js_SetProtoOrParent,
    js_TraceObject,             xml_clear,
    NULL,                       NULL },
    xml_getMethod,              xml_setMethod,
    xml_enumerateValues,        xml_equality,
    xml_concatenate
};

static JSObjectOps *
xml_getObjectOps(JSContext *cx, JSClass *clasp)
{
    return &js_XMLObjectOps.base;
}

JS_FRIEND_DATA(JSClass) js_XMLClass = {
    js_XML_str,
    JSCLASS_HAS_PRIVATE | JSCLASS_MARK_IS_TRACE |
    JSCLASS_HAS_CACHED_PROTO(JSProto_XML),
    JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,   JS_PropertyStub,
    JS_EnumerateStub,  JS_ResolveStub,    JS_ConvertStub,    xml_finalize,
    xml_getObjectOps,  NULL,              NULL,              NULL,
    NULL,              NULL,              JS_CLASS_TRACE(xml_trace), NULL
};

static JSXML *
StartNonListXMLMethod(JSContext *cx, jsval *vp, JSObject **objp)
{
    JSXML *xml;
    JSFunction *fun;
    char numBuf[12];

    JS_ASSERT(VALUE_IS_FUNCTION(cx, *vp));

    *objp = JS_THIS_OBJECT(cx, vp);
    xml = (JSXML *) JS_GetInstancePrivate(cx, *objp, &js_XMLClass, vp + 2);
    if (!xml || xml->xml_class != JSXML_CLASS_LIST)
        return xml;

    if (xml->xml_kids.length == 1) {
        xml = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
        if (xml) {
            *objp = js_GetXMLObject(cx, xml);
            if (!*objp)
                return NULL;
            vp[1] = OBJECT_TO_JSVAL(*objp);
            return xml;
        }
    }

    fun = GET_FUNCTION_PRIVATE(cx, JSVAL_TO_OBJECT(*vp));
    JS_snprintf(numBuf, sizeof numBuf, "%u", xml->xml_kids.length);
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_NON_LIST_XML_METHOD,
                         JS_GetFunctionName(fun), numBuf);
    return NULL;
}

/* Beware: these two are not bracketed by JS_BEGIN/END_MACRO. */
#define XML_METHOD_PROLOG                                                     \
    JSObject *obj = JS_THIS_OBJECT(cx, vp);                                   \
    JSXML *xml = (JSXML *)JS_GetInstancePrivate(cx, obj, &js_XMLClass, vp+2); \
    if (!xml)                                                                 \
        return JS_FALSE

#define NON_LIST_XML_METHOD_PROLOG                                            \
    JSObject *obj;                                                            \
    JSXML *xml = StartNonListXMLMethod(cx, vp, &obj);                         \
    if (!xml)                                                                 \
        return JS_FALSE;                                                      \
    JS_ASSERT(xml->xml_class != JSXML_CLASS_LIST)

static JSBool
xml_addNamespace(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *ns;

    NON_LIST_XML_METHOD_PROLOG;
    if (xml->xml_class != JSXML_CLASS_ELEMENT)
        goto done;
    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    if (!NamespaceHelper(cx, NULL, argc == 0 ? -1 : 1, vp + 2, vp))
        return JS_FALSE;
    JS_ASSERT(!JSVAL_IS_PRIMITIVE(*vp));

    ns = JSVAL_TO_OBJECT(*vp);
    if (!AddInScopeNamespace(cx, xml, ns))
        return JS_FALSE;
    ns->fslots[JSSLOT_DECLARED] = JSVAL_TRUE;

  done:
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSBool
xml_appendChild(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name, v;
    JSObject *vobj;
    JSXML *vxml;

    NON_LIST_XML_METHOD_PROLOG;
    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    if (!js_GetAnyName(cx, &name))
        return JS_FALSE;

    if (!GetProperty(cx, obj, name, &v))
        return JS_FALSE;

    JS_ASSERT(!JSVAL_IS_PRIMITIVE(v));
    vobj = JSVAL_TO_OBJECT(v);
    JS_ASSERT(OBJECT_IS_XML(cx, vobj));
    vxml = (JSXML *) JS_GetPrivate(cx, vobj);
    JS_ASSERT(vxml->xml_class == JSXML_CLASS_LIST);

    if (!IndexToIdVal(cx, vxml->xml_kids.length, &name))
        return JS_FALSE;
    *vp = (argc != 0) ? vp[2] : JSVAL_VOID;
    if (!PutProperty(cx, JSVAL_TO_OBJECT(v), name, vp))
        return JS_FALSE;

    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_attribute(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *qn;

    if (argc == 0) {
        js_ReportMissingArg(cx, vp, 0);
        return JS_FALSE;
    }

    qn = ToAttributeName(cx, vp[2]);
    if (!qn)
        return JS_FALSE;
    vp[2] = OBJECT_TO_JSVAL(qn);        /* local root */

    return GetProperty(cx, JS_THIS_OBJECT(cx, vp), vp[2], vp);
}

/* XML and XMLList */
static JSBool
xml_attributes(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSObject *qn;
    JSTempValueRooter tvr;
    JSBool ok;

    name = ATOM_KEY(cx->runtime->atomState.starAtom);
    qn = ToAttributeName(cx, name);
    if (!qn)
        return JS_FALSE;
    name = OBJECT_TO_JSVAL(qn);
    JS_PUSH_SINGLE_TEMP_ROOT(cx, name, &tvr);
    ok = GetProperty(cx, JS_THIS_OBJECT(cx, vp), name, vp);
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}

static JSXML *
xml_list_helper(JSContext *cx, JSXML *xml, jsval *rval)
{
    JSObject *listobj;
    JSXML *list;

    listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
    if (!listobj)
        return NULL;

    *rval = OBJECT_TO_JSVAL(listobj);
    list = (JSXML *) JS_GetPrivate(cx, listobj);
    list->xml_target = xml;
    return list;
}

static JSBool
xml_child_helper(JSContext *cx, JSObject *obj, JSXML *xml, jsval name,
                 jsval *rval)
{
    uint32 index;
    JSXML *kid;
    JSObject *kidobj;

    /* ECMA-357 13.4.4.6 */
    JS_ASSERT(xml->xml_class != JSXML_CLASS_LIST);

    if (js_IdIsIndex(name, &index)) {
        if (index >= JSXML_LENGTH(xml)) {
            *rval = JSVAL_VOID;
        } else {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, index, JSXML);
            if (!kid) {
                *rval = JSVAL_VOID;
            } else {
                kidobj = js_GetXMLObject(cx, kid);
                if (!kidobj)
                    return JS_FALSE;
                *rval = OBJECT_TO_JSVAL(kidobj);
            }
        }
        return JS_TRUE;
    }

    return GetProperty(cx, obj, name, rval);
}

/* XML and XMLList */
static JSBool
xml_child(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name, v;
    JSXML *list, *kid, *vxml;
    JSXMLArrayCursor cursor;
    JSObject *kidobj;

    XML_METHOD_PROLOG;
    name = argc != 0 ? vp[2] : JSVAL_VOID;
    if (xml->xml_class == JSXML_CLASS_LIST) {
        /* ECMA-357 13.5.4.4 */
        list = xml_list_helper(cx, xml, vp);
        if (!list)
            return JS_FALSE;

        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            kidobj = js_GetXMLObject(cx, kid);
            if (!kidobj)
                break;
            if (!xml_child_helper(cx, kidobj, kid, name, &v))
                break;
            if (JSVAL_IS_VOID(v)) {
                /* The property didn't exist in this kid. */
                continue;
            }

            JS_ASSERT(!JSVAL_IS_PRIMITIVE(v));
            vxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
            if ((!JSXML_HAS_KIDS(vxml) || vxml->xml_kids.length != 0) &&
                !Append(cx, list, vxml)) {
                break;
            }
        }
        XMLArrayCursorFinish(&cursor);
        return !kid;
    }

    /* ECMA-357 Edition 2 13.3.4.6 (note 13.3, not 13.4 as in Edition 1). */
    if (!xml_child_helper(cx, obj, xml, name, vp))
        return JS_FALSE;
    if (JSVAL_IS_VOID(*vp) && !xml_list_helper(cx, xml, vp))
        return JS_FALSE;
    return JS_TRUE;
}

static JSBool
xml_childIndex(JSContext *cx, uintN argc, jsval *vp)
{
    JSXML *parent;
    uint32 i, n;

    NON_LIST_XML_METHOD_PROLOG;
    parent = xml->parent;
    if (!parent || xml->xml_class == JSXML_CLASS_ATTRIBUTE) {
        *vp = DOUBLE_TO_JSVAL(cx->runtime->jsNaN);
        return JS_TRUE;
    }
    for (i = 0, n = JSXML_LENGTH(parent); i < n; i++) {
        if (XMLARRAY_MEMBER(&parent->xml_kids, i, JSXML) == xml)
            break;
    }
    JS_ASSERT(i < n);
    return js_NewNumberInRootedValue(cx, i, vp);
}

/* XML and XMLList */
static JSBool
xml_children(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;

    name = ATOM_KEY(cx->runtime->atomState.starAtom);
    return GetProperty(cx, JS_THIS_OBJECT(cx, vp), name, vp);
}

/* XML and XMLList */
static JSBool
xml_comments_helper(JSContext *cx, JSObject *obj, JSXML *xml, jsval *vp)
{
    JSXML *list, *kid, *vxml;
    JSBool ok;
    uint32 i, n;
    JSObject *kidobj;
    jsval v;

    list = xml_list_helper(cx, xml, vp);
    if (!list)
        return JS_FALSE;

    ok = JS_TRUE;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        /* 13.5.4.6 Step 2. */
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
                ok = js_EnterLocalRootScope(cx);
                if (!ok)
                    break;
                kidobj = js_GetXMLObject(cx, kid);
                if (kidobj) {
                    ok = xml_comments_helper(cx, kidobj, kid, &v);
                } else {
                    ok = JS_FALSE;
                    v = JSVAL_NULL;
                }
                js_LeaveLocalRootScopeWithResult(cx, v);
                if (!ok)
                    break;
                vxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
                if (JSXML_LENGTH(vxml) != 0) {
                    ok = Append(cx, list, vxml);
                    if (!ok)
                        break;
                }
            }
        }
    } else {
        /* 13.4.4.9 Step 2. */
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_COMMENT) {
                ok = Append(cx, list, kid);
                if (!ok)
                    break;
            }
        }
    }

    return ok;
}

static JSBool
xml_comments(JSContext *cx, uintN argc, jsval *vp)
{
    XML_METHOD_PROLOG;
    return xml_comments_helper(cx, obj, xml, vp);
}

/* XML and XMLList */
static JSBool
xml_contains(JSContext *cx, uintN argc, jsval *vp)
{
    jsval value;
    JSBool eq;
    JSXMLArrayCursor cursor;
    JSXML *kid;
    JSObject *kidobj;

    XML_METHOD_PROLOG;
    value = argc != 0 ? vp[2] : JSVAL_VOID;
    if (xml->xml_class == JSXML_CLASS_LIST) {
        eq = JS_FALSE;
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            kidobj = js_GetXMLObject(cx, kid);
            if (!kidobj || !xml_equality(cx, kidobj, value, &eq))
                break;
            if (eq)
                break;
        }
        XMLArrayCursorFinish(&cursor);
        if (kid && !eq)
            return JS_FALSE;
    } else {
        if (!xml_equality(cx, obj, value, &eq))
            return JS_FALSE;
    }
    *vp = BOOLEAN_TO_JSVAL(eq);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_copy(JSContext *cx, uintN argc, jsval *vp)
{
    JSXML *copy;

    XML_METHOD_PROLOG;
    copy = DeepCopy(cx, xml, NULL, 0);
    if (!copy)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(copy->object);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_descendants(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSXML *list;

    XML_METHOD_PROLOG;
    name = (argc == 0) ? ATOM_KEY(cx->runtime->atomState.starAtom) : vp[2];
    list = Descendants(cx, xml, name);
    if (!list)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(list->object);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_elements_helper(JSContext *cx, JSObject *obj, JSXML *xml,
                    JSObject *nameqn, jsval *vp)
{
    JSXML *list, *kid, *vxml;
    jsval v;
    JSBool ok;
    JSXMLArrayCursor cursor;
    JSObject *kidobj;
    uint32 i, n;

    list = xml_list_helper(cx, xml, vp);
    if (!list)
        return JS_FALSE;

    list->xml_targetprop = nameqn;
    ok = JS_TRUE;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        /* 13.5.4.6 */
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (kid->xml_class == JSXML_CLASS_ELEMENT) {
                ok = js_EnterLocalRootScope(cx);
                if (!ok)
                    break;
                kidobj = js_GetXMLObject(cx, kid);
                if (kidobj) {
                    ok = xml_elements_helper(cx, kidobj, kid, nameqn, &v);
                } else {
                    ok = JS_FALSE;
                    v = JSVAL_NULL;
                }
                js_LeaveLocalRootScopeWithResult(cx, v);
                if (!ok)
                    break;
                vxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
                if (JSXML_LENGTH(vxml) != 0) {
                    ok = Append(cx, list, vxml);
                    if (!ok)
                        break;
                }
            }
        }
        XMLArrayCursorFinish(&cursor);
    } else {
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT &&
                MatchElemName(nameqn, kid)) {
                ok = Append(cx, list, kid);
                if (!ok)
                    break;
            }
        }
    }

    return ok;
}

static JSBool
xml_elements(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSObject *nameqn;
    jsid funid;

    XML_METHOD_PROLOG;

    name = (argc == 0) ? ATOM_KEY(cx->runtime->atomState.starAtom) : vp[2];
    nameqn = ToXMLName(cx, name, &funid);
    if (!nameqn)
        return JS_FALSE;
    vp[2] = OBJECT_TO_JSVAL(nameqn);

    if (funid)
        return xml_list_helper(cx, xml, vp) != NULL;

    return xml_elements_helper(cx, obj, xml, nameqn, vp);
}

/* XML and XMLList */
static JSBool
xml_hasOwnProperty(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    jsval name;
    JSBool found;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!JS_InstanceOf(cx, obj, &js_XMLClass, vp + 2))
        return JS_FALSE;

    name = argc != 0 ? vp[2] : JSVAL_VOID;
    if (!HasProperty(cx, obj, name, &found))
        return JS_FALSE;
    if (found) {
        *vp = JSVAL_TRUE;
        return JS_TRUE;
    }
    return js_HasOwnPropertyHelper(cx, js_LookupProperty, argc, vp);
}

/* XML and XMLList */
static JSBool
xml_hasComplexContent(JSContext *cx, uintN argc, jsval *vp)
{
    JSXML *kid;
    JSObject *kidobj;
    uint32 i, n;

    XML_METHOD_PROLOG;
again:
    switch (xml->xml_class) {
      case JSXML_CLASS_ATTRIBUTE:
      case JSXML_CLASS_COMMENT:
      case JSXML_CLASS_PROCESSING_INSTRUCTION:
      case JSXML_CLASS_TEXT:
        *vp = JSVAL_FALSE;
        break;
      case JSXML_CLASS_LIST:
        if (xml->xml_kids.length == 0) {
            *vp = JSVAL_TRUE;
        } else if (xml->xml_kids.length == 1) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
            if (kid) {
                kidobj = js_GetXMLObject(cx, kid);
                if (!kidobj)
                    return JS_FALSE;
                obj = kidobj;
                xml = (JSXML *) JS_GetPrivate(cx, obj);
                goto again;
            }
        }
        /* FALL THROUGH */
      default:
        *vp = JSVAL_FALSE;
        for (i = 0, n = xml->xml_kids.length; i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
                *vp = JSVAL_TRUE;
                break;
            }
        }
        break;
    }
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_hasSimpleContent(JSContext *cx, uintN argc, jsval *vp)
{
    XML_METHOD_PROLOG;
    *vp = BOOLEAN_TO_JSVAL(HasSimpleContent(xml));
    return JS_TRUE;
}

typedef struct JSTempRootedNSArray {
    JSTempValueRooter   tvr;
    JSXMLArray          array;
    jsval               value;  /* extra root for temporaries */
} JSTempRootedNSArray;

static void
TraceObjectVector(JSTracer *trc, JSObject **vec, uint32 len)
{
    uint32 i;
    JSObject *obj;

    for (i = 0; i < len; i++) {
        obj = vec[i];
        if (obj) {
            JS_SET_TRACING_INDEX(trc, "vector", i);
            JS_CallTracer(trc, obj, JSTRACE_OBJECT);
        }
    }
}

static void
trace_temp_ns_array(JSTracer *trc, JSTempValueRooter *tvr)
{
    JSTempRootedNSArray *tmp = (JSTempRootedNSArray *)tvr;

    TraceObjectVector(trc,
                      (JSObject **) tmp->array.vector,
                      tmp->array.length);
    XMLArrayCursorTrace(trc, tmp->array.cursors);
    JS_CALL_VALUE_TRACER(trc, tmp->value, "temp_ns_array_value");
}

static void
InitTempNSArray(JSContext *cx, JSTempRootedNSArray *tmp)
{
    XMLArrayInit(cx, &tmp->array, 0);
    tmp->value = JSVAL_NULL;
    JS_PUSH_TEMP_ROOT_TRACE(cx, trace_temp_ns_array, &tmp->tvr);
}

static void
FinishTempNSArray(JSContext *cx, JSTempRootedNSArray *tmp)
{
    JS_ASSERT(tmp->tvr.u.trace == trace_temp_ns_array);
    JS_POP_TEMP_ROOT(cx, &tmp->tvr);
    XMLArrayFinish(cx, &tmp->array);
}

/*
 * Populate a new JS array with elements of JSTempRootedNSArray.array and
 * place the result into rval.  rval must point to a rooted location.
 */
static JSBool
TempNSArrayToJSArray(JSContext *cx, JSTempRootedNSArray *tmp, jsval *rval)
{
    JSObject *arrayobj;
    uint32 i, n;
    JSObject *ns;

    arrayobj = js_NewArrayObject(cx, 0, NULL);
    if (!arrayobj)
        return JS_FALSE;
    *rval = OBJECT_TO_JSVAL(arrayobj);
    for (i = 0, n = tmp->array.length; i < n; i++) {
        ns = XMLARRAY_MEMBER(&tmp->array, i, JSObject);
        if (!ns)
            continue;
        tmp->value = OBJECT_TO_JSVAL(ns);
        if (!OBJ_SET_PROPERTY(cx, arrayobj, INT_TO_JSID(i), &tmp->value))
            return JS_FALSE;
    }
    return JS_TRUE;
}

static JSBool
FindInScopeNamespaces(JSContext *cx, JSXML *xml, JSXMLArray *nsarray)
{
    uint32 length, i, j, n;
    JSObject *ns, *ns2;
    JSString *prefix, *prefix2;

    length = nsarray->length;
    do {
        if (xml->xml_class != JSXML_CLASS_ELEMENT)
            continue;
        for (i = 0, n = xml->xml_namespaces.length; i < n; i++) {
            ns = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
            if (!ns)
                continue;

            prefix = GetPrefix(ns);
            for (j = 0; j < length; j++) {
                ns2 = XMLARRAY_MEMBER(nsarray, j, JSObject);
                if (ns2) {
                    prefix2 = GetPrefix(ns2);
                    if ((prefix2 && prefix)
                        ? js_EqualStrings(prefix2, prefix)
                        : js_EqualStrings(GetURI(ns2), GetURI(ns))) {
                        break;
                    }
                }
            }

            if (j == length) {
                if (!XMLARRAY_APPEND(cx, nsarray, ns))
                    return JS_FALSE;
                ++length;
            }
        }
    } while ((xml = xml->parent) != NULL);
    JS_ASSERT(length == nsarray->length);

    return JS_TRUE;
}

static JSBool
xml_inScopeNamespaces(JSContext *cx, uintN argc, jsval *vp)
{
    JSTempRootedNSArray namespaces;
    JSBool ok;

    NON_LIST_XML_METHOD_PROLOG;

    InitTempNSArray(cx, &namespaces);
    ok = FindInScopeNamespaces(cx, xml, &namespaces.array) &&
         TempNSArrayToJSArray(cx, &namespaces, vp);
    FinishTempNSArray(cx, &namespaces);
    return ok;
}

static JSBool
xml_insertChildAfter(JSContext *cx, uintN argc, jsval *vp)
{
    jsval arg;
    JSXML *kid;
    uint32 i;

    NON_LIST_XML_METHOD_PROLOG;
    *vp = OBJECT_TO_JSVAL(obj);
    if (!JSXML_HAS_KIDS(xml) || argc == 0)
        return JS_TRUE;

    arg = vp[2];
    if (JSVAL_IS_NULL(arg)) {
        kid = NULL;
        i = 0;
    } else {
        if (!VALUE_IS_XML(cx, arg))
            return JS_TRUE;
        kid = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(arg));
        i = XMLARRAY_FIND_MEMBER(&xml->xml_kids, kid, NULL);
        if (i == XML_NOT_FOUND)
            return JS_TRUE;
        ++i;
    }

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;
    return Insert(cx, xml, i, argc >= 2 ? vp[3] : JSVAL_VOID);
}

static JSBool
xml_insertChildBefore(JSContext *cx, uintN argc, jsval *vp)
{
    jsval arg;
    JSXML *kid;
    uint32 i;

    NON_LIST_XML_METHOD_PROLOG;
    *vp = OBJECT_TO_JSVAL(obj);
    if (!JSXML_HAS_KIDS(xml) || argc == 0)
        return JS_TRUE;

    arg = vp[2];
    if (JSVAL_IS_NULL(arg)) {
        kid = NULL;
        i = xml->xml_kids.length;
    } else {
        if (!VALUE_IS_XML(cx, arg))
            return JS_TRUE;
        kid = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(arg));
        i = XMLARRAY_FIND_MEMBER(&xml->xml_kids, kid, NULL);
        if (i == XML_NOT_FOUND)
            return JS_TRUE;
    }

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;
    return Insert(cx, xml, i, argc >= 2 ? vp[3] : JSVAL_VOID);
}

/* XML and XMLList */
static JSBool
xml_length(JSContext *cx, uintN argc, jsval *vp)
{
    XML_METHOD_PROLOG;
    if (xml->xml_class != JSXML_CLASS_LIST) {
        *vp = JSVAL_ONE;
    } else {
        if (!js_NewNumberInRootedValue(cx, xml->xml_kids.length, vp))
            return JS_FALSE;
    }
    return JS_TRUE;
}

static JSBool
xml_localName(JSContext *cx, uintN argc, jsval *vp)
{
    NON_LIST_XML_METHOD_PROLOG;
    *vp = xml->name ? xml->name->fslots[JSSLOT_LOCAL_NAME] : JSVAL_NULL;
    return JS_TRUE;
}

static JSBool
xml_name(JSContext *cx, uintN argc, jsval *vp)
{
    NON_LIST_XML_METHOD_PROLOG;
    *vp = OBJECT_TO_JSVAL(xml->name);
    return JS_TRUE;
}

static JSBool
xml_namespace(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *prefix, *nsprefix;
    JSTempRootedNSArray inScopeNSes;
    JSBool ok;
    jsuint i, length;
    JSObject *ns;

    NON_LIST_XML_METHOD_PROLOG;
    if (argc == 0 && !JSXML_HAS_NAME(xml)) {
        *vp = JSVAL_NULL;
        return JS_TRUE;
    }

    if (argc == 0) {
        prefix = NULL;
    } else {
        prefix = js_ValueToString(cx, vp[2]);
        if (!prefix)
            return JS_FALSE;
        vp[2] = STRING_TO_JSVAL(prefix);      /* local root */
    }

    InitTempNSArray(cx, &inScopeNSes);
    MUST_FLOW_THROUGH("out");
    ok = FindInScopeNamespaces(cx, xml, &inScopeNSes.array);
    if (!ok)
        goto out;

    if (!prefix) {
        ns = GetNamespace(cx, xml->name, &inScopeNSes.array);
        if (!ns) {
            ok = JS_FALSE;
            goto out;
        }
    } else {
        ns = NULL;
        for (i = 0, length = inScopeNSes.array.length; i < length; i++) {
            ns = XMLARRAY_MEMBER(&inScopeNSes.array, i, JSObject);
            if (ns) {
                nsprefix = GetPrefix(ns);
                if (nsprefix && js_EqualStrings(nsprefix, prefix))
                    break;
                ns = NULL;
            }
        }
    }

    *vp = (!ns) ? JSVAL_VOID : OBJECT_TO_JSVAL(ns);

  out:
    FinishTempNSArray(cx, &inScopeNSes);
    return JS_TRUE;
}

static JSBool
xml_namespaceDeclarations(JSContext *cx, uintN argc, jsval *vp)
{
    JSBool ok;
    JSTempRootedNSArray ancestors, declared;
    JSXML *yml;
    uint32 i, n;
    JSObject *ns;

    NON_LIST_XML_METHOD_PROLOG;
    if (JSXML_HAS_VALUE(xml))
        return JS_TRUE;

    /* From here, control flow must goto out to finish these arrays. */
    ok = JS_TRUE;
    InitTempNSArray(cx, &ancestors);
    InitTempNSArray(cx, &declared);
    yml = xml;

    while ((yml = yml->parent) != NULL) {
        JS_ASSERT(yml->xml_class == JSXML_CLASS_ELEMENT);
        for (i = 0, n = yml->xml_namespaces.length; i < n; i++) {
            ns = XMLARRAY_MEMBER(&yml->xml_namespaces, i, JSObject);
            if (ns &&
                !XMLARRAY_HAS_MEMBER(&ancestors.array, ns, namespace_match)) {
                ok = XMLARRAY_APPEND(cx, &ancestors.array, ns);
                if (!ok)
                    goto out;
            }
        }
    }

    for (i = 0, n = xml->xml_namespaces.length; i < n; i++) {
        ns = XMLARRAY_MEMBER(&xml->xml_namespaces, i, JSObject);
        if (!ns)
            continue;
        if (!IsDeclared(ns))
            continue;
        if (!XMLARRAY_HAS_MEMBER(&ancestors.array, ns, namespace_match)) {
            ok = XMLARRAY_APPEND(cx, &declared.array, ns);
            if (!ok)
                goto out;
        }
    }

    ok = TempNSArrayToJSArray(cx, &declared, vp);

out:
    /* Finishing must be in reverse order of initialization to follow LIFO. */
    FinishTempNSArray(cx, &declared);
    FinishTempNSArray(cx, &ancestors);
    return ok;
}

static const char js_attribute_str[] = "attribute";
static const char js_text_str[]      = "text";

/* Exported to jsgc.c #ifdef DEBUG. */
const char *js_xml_class_str[] = {
    "list",
    "element",
    js_attribute_str,
    "processing-instruction",
    js_text_str,
    "comment"
};

static JSBool
xml_nodeKind(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    NON_LIST_XML_METHOD_PROLOG;
    str = JS_InternString(cx, js_xml_class_str[xml->xml_class]);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static void
NormalizingDelete(JSContext *cx, JSXML *xml, uint32 index)
{
    if (xml->xml_class == JSXML_CLASS_LIST)
        DeleteListElement(cx, xml, index);
    else
        DeleteByIndex(cx, xml, index);
}

/* XML and XMLList */
static JSBool
xml_normalize_helper(JSContext *cx, JSObject *obj, JSXML *xml)
{
    JSXML *kid, *kid2;
    uint32 i, n;
    JSObject *kidobj;
    JSString *str;

    if (!JSXML_HAS_KIDS(xml))
        return JS_TRUE;

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    for (i = 0, n = xml->xml_kids.length; i < n; i++) {
        kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
        if (!kid)
            continue;
        if (kid->xml_class == JSXML_CLASS_ELEMENT) {
            kidobj = js_GetXMLObject(cx, kid);
            if (!kidobj || !xml_normalize_helper(cx, kidobj, kid))
                return JS_FALSE;
        } else if (kid->xml_class == JSXML_CLASS_TEXT) {
            while (i + 1 < n &&
                   (kid2 = XMLARRAY_MEMBER(&xml->xml_kids, i + 1, JSXML)) &&
                   kid2->xml_class == JSXML_CLASS_TEXT) {
                str = js_ConcatStrings(cx, kid->xml_value, kid2->xml_value);
                if (!str)
                    return JS_FALSE;
                NormalizingDelete(cx, xml, i + 1);
                n = xml->xml_kids.length;
                kid->xml_value = str;
            }
            if (IS_EMPTY(kid->xml_value)) {
                NormalizingDelete(cx, xml, i);
                n = xml->xml_kids.length;
                --i;
            }
        }
    }

    return JS_TRUE;
}

static JSBool
xml_normalize(JSContext *cx, uintN argc, jsval *vp)
{
    XML_METHOD_PROLOG;
    *vp = OBJECT_TO_JSVAL(obj);
    return xml_normalize_helper(cx, obj, xml);
}

/* XML and XMLList */
static JSBool
xml_parent(JSContext *cx, uintN argc, jsval *vp)
{
    JSXML *parent, *kid;
    uint32 i, n;
    JSObject *parentobj;

    XML_METHOD_PROLOG;
    parent = xml->parent;
    if (xml->xml_class == JSXML_CLASS_LIST) {
        *vp = JSVAL_VOID;
        n = xml->xml_kids.length;
        if (n == 0)
            return JS_TRUE;

        kid = XMLARRAY_MEMBER(&xml->xml_kids, 0, JSXML);
        if (!kid)
            return JS_TRUE;
        parent = kid->parent;
        for (i = 1; i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->parent != parent)
                return JS_TRUE;
        }
    }

    if (!parent) {
        *vp = JSVAL_NULL;
        return JS_TRUE;
    }

    parentobj = js_GetXMLObject(cx, parent);
    if (!parentobj)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(parentobj);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_processingInstructions_helper(JSContext *cx, JSObject *obj, JSXML *xml,
                                  JSObject *nameqn, jsval *vp)
{
    JSXML *list, *kid, *vxml;
    JSBool ok;
    JSXMLArrayCursor cursor;
    JSObject *kidobj;
    jsval v;
    uint32 i, n;
    JSString *localName;

    list = xml_list_helper(cx, xml, vp);
    if (!list)
        return JS_FALSE;

    list->xml_targetprop = nameqn;
    ok = JS_TRUE;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        /* 13.5.4.17 Step 4 (misnumbered 9 -- Erratum?). */
        XMLArrayCursorInit(&cursor, &xml->xml_kids);
        while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
            if (kid->xml_class == JSXML_CLASS_ELEMENT) {
                ok = js_EnterLocalRootScope(cx);
                if (!ok)
                    break;
                kidobj = js_GetXMLObject(cx, kid);
                if (kidobj) {
                    ok = xml_processingInstructions_helper(cx, kidobj, kid,
                                                           nameqn, &v);
                } else {
                    ok = JS_FALSE;
                    v = JSVAL_NULL;
                }
                js_LeaveLocalRootScopeWithResult(cx, v);
                if (!ok)
                    break;
                vxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
                if (JSXML_LENGTH(vxml) != 0) {
                    ok = Append(cx, list, vxml);
                    if (!ok)
                        break;
                }
            }
        }
        XMLArrayCursorFinish(&cursor);
    } else {
        /* 13.4.4.28 Step 4. */
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_PROCESSING_INSTRUCTION) {
                localName = GetLocalName(nameqn);
                if (IS_STAR(localName) ||
                    js_EqualStrings(localName, GetLocalName(kid->name))) {
                    ok = Append(cx, list, kid);
                    if (!ok)
                        break;
                }
            }
        }
    }

    return ok;
}

static JSBool
xml_processingInstructions(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSObject *nameqn;
    jsid funid;

    XML_METHOD_PROLOG;

    name = (argc == 0) ? ATOM_KEY(cx->runtime->atomState.starAtom) : vp[2];
    nameqn = ToXMLName(cx, name, &funid);
    if (!nameqn)
        return JS_FALSE;
    vp[2] = OBJECT_TO_JSVAL(nameqn);

    if (funid)
        return xml_list_helper(cx, xml, vp) != NULL;

    return xml_processingInstructions_helper(cx, obj, xml, nameqn, vp);
}

static JSBool
xml_prependChild(JSContext *cx, uintN argc, jsval *vp)
{
    NON_LIST_XML_METHOD_PROLOG;
    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(obj);
    return Insert(cx, xml, 0, argc != 0 ? vp[2] : JSVAL_VOID);
}

/* XML and XMLList */
static JSBool
xml_propertyIsEnumerable(JSContext *cx, uintN argc, jsval *vp)
{
    uint32 index;

    XML_METHOD_PROLOG;
    *vp = JSVAL_FALSE;
    if (argc != 0 && js_IdIsIndex(vp[2], &index)) {
        if (xml->xml_class == JSXML_CLASS_LIST) {
            /* 13.5.4.18. */
            *vp = BOOLEAN_TO_JSVAL(index < xml->xml_kids.length);
        } else {
            /* 13.4.4.30. */
            *vp = BOOLEAN_TO_JSVAL(index == 0);
        }
    }
    return JS_TRUE;
}

static JSBool
namespace_full_match(const void *a, const void *b)
{
    const JSObject *nsa = (const JSObject *) a;
    const JSObject *nsb = (const JSObject *) b;
    JSString *prefixa = GetPrefix(nsa);
    JSString *prefixb;

    if (prefixa) {
        prefixb = GetPrefix(nsb);
        if (prefixb && !js_EqualStrings(prefixa, prefixb))
            return JS_FALSE;
    }
    return js_EqualStrings(GetURI(nsa), GetURI(nsb));
}

static JSBool
xml_removeNamespace_helper(JSContext *cx, JSXML *xml, JSObject *ns)
{
    JSObject *thisns, *attrns;
    uint32 i, n;
    JSXML *attr, *kid;

    thisns = GetNamespace(cx, xml->name, &xml->xml_namespaces);
    JS_ASSERT(thisns);
    if (thisns == ns)
        return JS_TRUE;

    for (i = 0, n = xml->xml_attrs.length; i < n; i++) {
        attr = XMLARRAY_MEMBER(&xml->xml_attrs, i, JSXML);
        if (!attr)
            continue;
        attrns = GetNamespace(cx, attr->name, &xml->xml_namespaces);
        JS_ASSERT(attrns);
        if (attrns == ns)
            return JS_TRUE;
    }

    i = XMLARRAY_FIND_MEMBER(&xml->xml_namespaces, ns, namespace_full_match);
    if (i != XML_NOT_FOUND)
        XMLArrayDelete(cx, &xml->xml_namespaces, i, JS_TRUE);

    for (i = 0, n = xml->xml_kids.length; i < n; i++) {
        kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
        if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
            if (!xml_removeNamespace_helper(cx, kid, ns))
                return JS_FALSE;
        }
    }
    return JS_TRUE;
}

static JSBool
xml_removeNamespace(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *ns;

    NON_LIST_XML_METHOD_PROLOG;
    if (xml->xml_class != JSXML_CLASS_ELEMENT)
        goto done;
    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    if (!NamespaceHelper(cx, NULL, argc == 0 ? -1 : 1, vp + 2, vp))
        return JS_FALSE;
    JS_ASSERT(!JSVAL_IS_PRIMITIVE(*vp));
    ns = JSVAL_TO_OBJECT(*vp);

    /* NOTE: remove ns from each ancestor if not used by that ancestor. */
    if (!xml_removeNamespace_helper(cx, xml, ns))
        return JS_FALSE;
  done:
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSBool
xml_replace(JSContext *cx, uintN argc, jsval *vp)
{
    jsval value;
    JSXML *vxml, *kid;
    uint32 index, i;
    JSObject *nameqn;

    NON_LIST_XML_METHOD_PROLOG;
    if (xml->xml_class != JSXML_CLASS_ELEMENT)
        goto done;

    if (argc <= 1) {
        value = STRING_TO_JSVAL(ATOM_TO_STRING(cx->runtime->atomState.
                                               typeAtoms[JSTYPE_VOID]));
    } else {
        value = vp[3];
        vxml = VALUE_IS_XML(cx, value)
               ? (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(value))
               : NULL;
        if (!vxml) {
            if (!JS_ConvertValue(cx, value, JSTYPE_STRING, &vp[3]))
                return JS_FALSE;
            value = vp[3];
        } else {
            vxml = DeepCopy(cx, vxml, NULL, 0);
            if (!vxml)
                return JS_FALSE;
            value = vp[3] = OBJECT_TO_JSVAL(vxml->object);
        }
    }

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    if (argc == 0 || !js_IdIsIndex(vp[2], &index)) {
        /*
         * Call function QName per spec, not ToXMLName, to avoid attribute
         * names.
         */
        if (!QNameHelper(cx, NULL, &js_QNameClass.base, argc == 0 ? -1 : 1,
                         vp + 2, vp)) {
            return JS_FALSE;
        }
        JS_ASSERT(!JSVAL_IS_PRIMITIVE(*vp));
        nameqn = JSVAL_TO_OBJECT(*vp);

        i = xml->xml_kids.length;
        index = XML_NOT_FOUND;
        while (i != 0) {
            --i;
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && MatchElemName(nameqn, kid)) {
                if (i != XML_NOT_FOUND)
                    DeleteByIndex(cx, xml, i);
                index = i;
            }
        }

        if (index == XML_NOT_FOUND)
            goto done;
    }

    if (!Replace(cx, xml, index, value))
        return JS_FALSE;

  done:
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSBool
xml_setChildren(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    if (!StartNonListXMLMethod(cx, vp, &obj))
        return JS_FALSE;

    *vp = argc != 0 ? vp[2] : JSVAL_VOID;     /* local root */
    if (!PutProperty(cx, obj, ATOM_KEY(cx->runtime->atomState.starAtom), vp))
        return JS_FALSE;

    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

static JSBool
xml_setLocalName(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSObject *nameqn;
    JSString *namestr;

    NON_LIST_XML_METHOD_PROLOG;
    if (!JSXML_HAS_NAME(xml))
        return JS_TRUE;

    if (argc == 0) {
        namestr = ATOM_TO_STRING(cx->runtime->atomState.typeAtoms[JSTYPE_VOID]);
    } else {
        name = vp[2];
        if (!JSVAL_IS_PRIMITIVE(name) &&
            OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(name)) == &js_QNameClass.base) {
            nameqn = JSVAL_TO_OBJECT(name);
            namestr = GetLocalName(nameqn);
        } else {
            if (!JS_ConvertValue(cx, name, JSTYPE_STRING, &vp[2]))
                return JS_FALSE;
            name = vp[2];
            namestr = JSVAL_TO_STRING(name);
        }
    }

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;
    xml->name->fslots[JSSLOT_LOCAL_NAME] = namestr
                                           ? STRING_TO_JSVAL(namestr)
                                           : JSVAL_VOID;
    return JS_TRUE;
}

static JSBool
xml_setName(JSContext *cx, uintN argc, jsval *vp)
{
    jsval name;
    JSObject *nameqn;
    JSXML *nsowner;
    JSXMLArray *nsarray;
    uint32 i, n;
    JSObject *ns;

    NON_LIST_XML_METHOD_PROLOG;
    if (!JSXML_HAS_NAME(xml))
        return JS_TRUE;

    if (argc == 0) {
        name = STRING_TO_JSVAL(ATOM_TO_STRING(cx->runtime->atomState.
                                              typeAtoms[JSTYPE_VOID]));
    } else {
        name = vp[2];
        if (!JSVAL_IS_PRIMITIVE(name) &&
            OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(name)) == &js_QNameClass.base &&
            !GetURI(nameqn = JSVAL_TO_OBJECT(name))) {
            name = vp[2] = nameqn->fslots[JSSLOT_LOCAL_NAME];
        }
    }

    nameqn = js_ConstructObject(cx, &js_QNameClass.base, NULL, NULL, 1, &name);
    if (!nameqn)
        return JS_FALSE;

    /* ECMA-357 13.4.4.35 Step 4. */
    if (xml->xml_class == JSXML_CLASS_PROCESSING_INSTRUCTION)
        nameqn->fslots[JSSLOT_URI] = STRING_TO_JSVAL(cx->runtime->emptyString);

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;
    xml->name = nameqn;

    /*
     * Erratum: nothing in 13.4.4.35 talks about making the name match the
     * in-scope namespaces, either by finding an in-scope namespace with a
     * matching uri and setting the new name's prefix to that namespace's
     * prefix, or by extending the in-scope namespaces for xml (which are in
     * xml->parent if xml is an attribute or a PI).
     */
    if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        nsowner = xml;
    } else {
        if (!xml->parent || xml->parent->xml_class != JSXML_CLASS_ELEMENT)
            return JS_TRUE;
        nsowner = xml->parent;
    }

    if (GetPrefix(nameqn)) {
        /*
         * The name being set has a prefix, which originally came from some
         * namespace object (which may be the null namespace, where both the
         * prefix and uri are the empty string).  We must go through a full
         * GetNamespace in case that namespace is in-scope in nsowner.
         *
         * If we find such an in-scope namespace, we return true right away,
         * in this block.  Otherwise, we fall through to the final return of
         * AddInScopeNamespace(cx, nsowner, ns).
         */
        ns = GetNamespace(cx, nameqn, &nsowner->xml_namespaces);
        if (!ns)
            return JS_FALSE;

        /* XXXbe have to test membership to see whether GetNamespace added */
        if (XMLARRAY_HAS_MEMBER(&nsowner->xml_namespaces, ns, NULL))
            return JS_TRUE;
    } else {
        /*
         * At this point, we know prefix of nameqn is null, so its uri can't
         * be the empty string (the null namespace always uses the empty string
         * for both prefix and uri).
         *
         * This means we must inline GetNamespace and specialize it to match
         * uri only, never prefix.  If we find a namespace with nameqn's uri
         * already in nsowner->xml_namespaces, then all that we need do is set
         * prefix of nameqn to that namespace's prefix.
         *
         * If no such namespace exists, we can create one without going through
         * the constructor, because we know uri of nameqn is non-empty (so
         * prefix does not need to be converted from null to empty by QName).
         */
        JS_ASSERT(!IS_EMPTY(GetURI(nameqn)));

        nsarray = &nsowner->xml_namespaces;
        for (i = 0, n = nsarray->length; i < n; i++) {
            ns = XMLARRAY_MEMBER(nsarray, i, JSObject);
            if (ns && js_EqualStrings(GetURI(ns), GetURI(nameqn))) {
                nameqn->fslots[JSSLOT_PREFIX] = ns->fslots[JSSLOT_PREFIX];
                return JS_TRUE;
            }
        }

        ns = NewXMLNamespace(cx, NULL, GetURI(nameqn), JS_TRUE);
        if (!ns)
            return JS_FALSE;
    }

    if (!AddInScopeNamespace(cx, nsowner, ns))
        return JS_FALSE;
    vp[0] = JSVAL_VOID;
    return JS_TRUE;
}

static JSBool
xml_setNamespace(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *qn;
    JSObject *ns;
    jsval qnargv[2];
    JSXML *nsowner;

    NON_LIST_XML_METHOD_PROLOG;
    if (!JSXML_HAS_NAME(xml))
        return JS_TRUE;

    xml = CHECK_COPY_ON_WRITE(cx, xml, obj);
    if (!xml)
        return JS_FALSE;

    ns = js_ConstructObject(cx, &js_NamespaceClass.base, NULL, obj,
                            argc == 0 ? 0 : 1, vp + 2);
    if (!ns)
        return JS_FALSE;
    vp[0] = OBJECT_TO_JSVAL(ns);
    ns->fslots[JSSLOT_DECLARED] = JSVAL_TRUE;

    qnargv[0] = vp[2] = OBJECT_TO_JSVAL(ns);
    qnargv[1] = OBJECT_TO_JSVAL(xml->name);
    qn = js_ConstructObject(cx, &js_QNameClass.base, NULL, NULL, 2, qnargv);
    if (!qn)
        return JS_FALSE;

    xml->name = qn;

    /*
     * Erratum: the spec fails to update the governing in-scope namespaces.
     * See the erratum noted in xml_setName, above.
     */
    if (xml->xml_class == JSXML_CLASS_ELEMENT) {
        nsowner = xml;
    } else {
        if (!xml->parent || xml->parent->xml_class != JSXML_CLASS_ELEMENT)
            return JS_TRUE;
        nsowner = xml->parent;
    }
    if (!AddInScopeNamespace(cx, nsowner, ns))
        return JS_FALSE;
    vp[0] = JSVAL_VOID;
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_text_helper(JSContext *cx, JSObject *obj, JSXML *xml, jsval *vp)
{
    JSXML *list, *kid, *vxml;
    uint32 i, n;
    JSBool ok;
    JSObject *kidobj;
    jsval v;

    list = xml_list_helper(cx, xml, vp);
    if (!list)
        return JS_FALSE;

    if (xml->xml_class == JSXML_CLASS_LIST) {
        ok = JS_TRUE;
        for (i = 0, n = xml->xml_kids.length; i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_ELEMENT) {
                ok = js_EnterLocalRootScope(cx);
                if (!ok)
                    break;
                kidobj = js_GetXMLObject(cx, kid);
                if (kidobj) {
                    ok = xml_text_helper(cx, kidobj, kid, &v);
                } else {
                    ok = JS_FALSE;
                    v = JSVAL_NULL;
                }
                js_LeaveLocalRootScopeWithResult(cx, v);
                if (!ok)
                    return JS_FALSE;
                vxml = (JSXML *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(v));
                if (JSXML_LENGTH(vxml) != 0 && !Append(cx, list, vxml))
                    return JS_FALSE;
            }
        }
    } else {
        for (i = 0, n = JSXML_LENGTH(xml); i < n; i++) {
            kid = XMLARRAY_MEMBER(&xml->xml_kids, i, JSXML);
            if (kid && kid->xml_class == JSXML_CLASS_TEXT) {
                if (!Append(cx, list, kid))
                    return JS_FALSE;
            }
        }
    }
    return JS_TRUE;
}

static JSBool
xml_text(JSContext *cx, uintN argc, jsval *vp)
{
    XML_METHOD_PROLOG;
    return xml_text_helper(cx, obj, xml, vp);
}

/* XML and XMLList */
static JSString *
xml_toString_helper(JSContext *cx, JSXML *xml)
{
    JSString *str, *kidstr;
    JSXML *kid;
    JSXMLArrayCursor cursor;

    if (xml->xml_class == JSXML_CLASS_ATTRIBUTE ||
        xml->xml_class == JSXML_CLASS_TEXT) {
        return xml->xml_value;
    }

    if (!HasSimpleContent(xml))
        return ToXMLString(cx, OBJECT_TO_JSVAL(xml->object), 0);

    str = cx->runtime->emptyString;
    if (!js_EnterLocalRootScope(cx))
        return NULL;
    XMLArrayCursorInit(&cursor, &xml->xml_kids);
    while ((kid = (JSXML *) XMLArrayCursorNext(&cursor)) != NULL) {
        if (kid->xml_class != JSXML_CLASS_COMMENT &&
            kid->xml_class != JSXML_CLASS_PROCESSING_INSTRUCTION) {
            kidstr = xml_toString_helper(cx, kid);
            if (!kidstr) {
                str = NULL;
                break;
            }
            str = js_ConcatStrings(cx, str, kidstr);
            if (!str)
                break;
        }
    }
    XMLArrayCursorFinish(&cursor);
    js_LeaveLocalRootScopeWithResult(cx, STRING_TO_JSVAL(str));
    return str;
}

static JSBool
xml_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    jsval thisv;
    JSString *str;

    thisv = JS_THIS(cx, vp);
    if (JSVAL_IS_NULL(thisv))
        return JS_FALSE;
    str = ToXMLString(cx, thisv, TO_SOURCE_FLAG);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
xml_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSString *str;

    XML_METHOD_PROLOG;
    str = xml_toString_helper(cx, xml);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_toXMLString(JSContext *cx, uintN argc, jsval *vp)
{
    jsval thisv;
    JSString *str;

    thisv = JS_THIS(cx, vp);
    if (JSVAL_IS_NULL(thisv))
        return JS_FALSE;
    str = ToXMLString(cx, thisv, 0);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

/* XML and XMLList */
static JSBool
xml_valueOf(JSContext *cx, uintN argc, jsval *vp)
{
    *vp = JS_THIS(cx, vp);
    return !JSVAL_IS_NULL(*vp);
}

static JSFunctionSpec xml_methods[] = {
    JS_FN("addNamespace",          xml_addNamespace,          1,0),
    JS_FN("appendChild",           xml_appendChild,           1,0),
    JS_FN(js_attribute_str,        xml_attribute,             1,0),
    JS_FN("attributes",            xml_attributes,            0,0),
    JS_FN("child",                 xml_child,                 1,0),
    JS_FN("childIndex",            xml_childIndex,            0,0),
    JS_FN("children",              xml_children,              0,0),
    JS_FN("comments",              xml_comments,              0,0),
    JS_FN("contains",              xml_contains,              1,0),
    JS_FN("copy",                  xml_copy,                  0,0),
    JS_FN("descendants",           xml_descendants,           1,0),
    JS_FN("elements",              xml_elements,              1,0),
    JS_FN("hasOwnProperty",        xml_hasOwnProperty,        1,0),
    JS_FN("hasComplexContent",     xml_hasComplexContent,     1,0),
    JS_FN("hasSimpleContent",      xml_hasSimpleContent,      1,0),
    JS_FN("inScopeNamespaces",     xml_inScopeNamespaces,     0,0),
    JS_FN("insertChildAfter",      xml_insertChildAfter,      2,0),
    JS_FN("insertChildBefore",     xml_insertChildBefore,     2,0),
    JS_FN(js_length_str,           xml_length,                0,0),
    JS_FN(js_localName_str,        xml_localName,             0,0),
    JS_FN(js_name_str,             xml_name,                  0,0),
    JS_FN(js_namespace_str,        xml_namespace,             1,0),
    JS_FN("namespaceDeclarations", xml_namespaceDeclarations, 0,0),
    JS_FN("nodeKind",              xml_nodeKind,              0,0),
    JS_FN("normalize",             xml_normalize,             0,0),
    JS_FN(js_xml_parent_str,       xml_parent,                0,0),
    JS_FN("processingInstructions",xml_processingInstructions,1,0),
    JS_FN("prependChild",          xml_prependChild,          1,0),
    JS_FN("propertyIsEnumerable",  xml_propertyIsEnumerable,  1,0),
    JS_FN("removeNamespace",       xml_removeNamespace,       1,0),
    JS_FN("replace",               xml_replace,               2,0),
    JS_FN("setChildren",           xml_setChildren,           1,0),
    JS_FN("setLocalName",          xml_setLocalName,          1,0),
    JS_FN("setName",               xml_setName,               1,0),
    JS_FN("setNamespace",          xml_setNamespace,          1,0),
    JS_FN(js_text_str,             xml_text,                  0,0),
    JS_FN(js_toSource_str,         xml_toSource,              0,0),
    JS_FN(js_toString_str,         xml_toString,              0,0),
    JS_FN(js_toXMLString_str,      xml_toXMLString,           0,0),
    JS_FN(js_valueOf_str,          xml_valueOf,               0,0),
    JS_FS_END
};

static JSBool
CopyXMLSettings(JSContext *cx, JSObject *from, JSObject *to)
{
    int i;
    const char *name;
    jsval v;

    for (i = XML_IGNORE_COMMENTS; i < XML_PRETTY_INDENT; i++) {
        name = xml_static_props[i].name;
        if (!JS_GetProperty(cx, from, name, &v))
            return JS_FALSE;
        if (JSVAL_IS_BOOLEAN(v) && !JS_SetProperty(cx, to, name, &v))
            return JS_FALSE;
    }

    name = xml_static_props[i].name;
    if (!JS_GetProperty(cx, from, name, &v))
        return JS_FALSE;
    if (JSVAL_IS_NUMBER(v) && !JS_SetProperty(cx, to, name, &v))
        return JS_FALSE;
    return JS_TRUE;
}

static JSBool
SetDefaultXMLSettings(JSContext *cx, JSObject *obj)
{
    int i;
    jsval v;

    for (i = XML_IGNORE_COMMENTS; i < XML_PRETTY_INDENT; i++) {
        v = JSVAL_TRUE;
        if (!JS_SetProperty(cx, obj, xml_static_props[i].name, &v))
            return JS_FALSE;
    }
    v = INT_TO_JSVAL(2);
    return JS_SetProperty(cx, obj, xml_static_props[i].name, &v);
}

static JSBool
xml_settings(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *settings;
    JSObject *obj;

    settings = JS_NewObject(cx, NULL, NULL, NULL);
    if (!settings)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(settings);
    obj = JS_THIS_OBJECT(cx, vp);
    return obj && CopyXMLSettings(cx, obj, settings);
}

static JSBool
xml_setSettings(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj, *settings;
    jsval v;
    JSBool ok;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj)
        return JS_FALSE;
    v = (argc == 0) ? JSVAL_VOID : vp[2];
    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v)) {
        cx->xmlSettingFlags = 0;
        ok = SetDefaultXMLSettings(cx, obj);
    } else {
        if (JSVAL_IS_PRIMITIVE(v))
            return JS_TRUE;
        settings = JSVAL_TO_OBJECT(v);
        cx->xmlSettingFlags = 0;
        ok = CopyXMLSettings(cx, settings, obj);
    }
    if (ok)
        cx->xmlSettingFlags |= XSF_CACHE_VALID;
    return ok;
}

static JSBool
xml_defaultSettings(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *settings;

    settings = JS_NewObject(cx, NULL, NULL, NULL);
    if (!settings)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(settings);
    return SetDefaultXMLSettings(cx, settings);
}

static JSFunctionSpec xml_static_methods[] = {
    JS_FN("settings",         xml_settings,          0,0),
    JS_FN("setSettings",      xml_setSettings,       1,0),
    JS_FN("defaultSettings",  xml_defaultSettings,   0,0),
    JS_FS_END
};

static JSBool
XML(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    jsval v;
    JSXML *xml, *copy;
    JSObject *xobj, *vobj;
    JSClass *clasp;

    v = argv[0];
    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v))
        v = STRING_TO_JSVAL(cx->runtime->emptyString);

    xobj = ToXML(cx, v);
    if (!xobj)
        return JS_FALSE;
    *rval = OBJECT_TO_JSVAL(xobj);
    xml = (JSXML *) JS_GetPrivate(cx, xobj);

    if ((cx->fp->flags & JSFRAME_CONSTRUCTING) && !JSVAL_IS_PRIMITIVE(v)) {
        vobj = JSVAL_TO_OBJECT(v);
        clasp = OBJ_GET_CLASS(cx, vobj);
        if (clasp == &js_XMLClass ||
            (clasp->flags & JSCLASS_DOCUMENT_OBSERVER)) {
            /* No need to lock obj, it's newly constructed and thread local. */
            copy = DeepCopy(cx, xml, obj, 0);
            if (!copy)
                return JS_FALSE;
            JS_ASSERT(copy->object == obj);
            *rval = OBJECT_TO_JSVAL(obj);
            return JS_TRUE;
        }
    }
    return JS_TRUE;
}

static JSBool
XMLList(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    jsval v;
    JSObject *vobj, *listobj;
    JSXML *xml, *list;

    v = argv[0];
    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v))
        v = STRING_TO_JSVAL(cx->runtime->emptyString);

    if ((cx->fp->flags & JSFRAME_CONSTRUCTING) && !JSVAL_IS_PRIMITIVE(v)) {
        vobj = JSVAL_TO_OBJECT(v);
        if (OBJECT_IS_XML(cx, vobj)) {
            xml = (JSXML *) JS_GetPrivate(cx, vobj);
            if (xml->xml_class == JSXML_CLASS_LIST) {
                listobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
                if (!listobj)
                    return JS_FALSE;
                *rval = OBJECT_TO_JSVAL(listobj);

                list = (JSXML *) JS_GetPrivate(cx, listobj);
                if (!Append(cx, list, xml))
                    return JS_FALSE;
                return JS_TRUE;
            }
        }
    }

    /* Toggle on XML support since the script has explicitly requested it. */
    listobj = ToXMLList(cx, v);
    if (!listobj)
        return JS_FALSE;

    *rval = OBJECT_TO_JSVAL(listobj);
    return JS_TRUE;
}

#define JSXML_LIST_SIZE     (offsetof(JSXML, u) + sizeof(struct JSXMLListVar))
#define JSXML_ELEMENT_SIZE  (offsetof(JSXML, u) + sizeof(struct JSXMLElemVar))
#define JSXML_LEAF_SIZE     (offsetof(JSXML, u) + sizeof(JSString *))

static size_t sizeof_JSXML[JSXML_CLASS_LIMIT] = {
    JSXML_LIST_SIZE,        /* JSXML_CLASS_LIST */
    JSXML_ELEMENT_SIZE,     /* JSXML_CLASS_ELEMENT */
    JSXML_LEAF_SIZE,        /* JSXML_CLASS_ATTRIBUTE */
    JSXML_LEAF_SIZE,        /* JSXML_CLASS_PROCESSING_INSTRUCTION */
    JSXML_LEAF_SIZE,        /* JSXML_CLASS_TEXT */
    JSXML_LEAF_SIZE         /* JSXML_CLASS_COMMENT */
};

#ifdef DEBUG_notme
JSCList xml_leaks = JS_INIT_STATIC_CLIST(&xml_leaks);
uint32  xml_serial;
#endif

JSXML *
js_NewXML(JSContext *cx, JSXMLClass xml_class)
{
    JSXML *xml;

    xml = (JSXML *) js_NewGCThing(cx, GCX_XML, sizeof_JSXML[xml_class]);
    if (!xml)
        return NULL;

    xml->object = NULL;
    xml->domnode = NULL;
    xml->parent = NULL;
    xml->name = NULL;
    xml->xml_class = xml_class;
    xml->xml_flags = 0;
    if (JSXML_CLASS_HAS_VALUE(xml_class)) {
        xml->xml_value = cx->runtime->emptyString;
    } else {
        XMLArrayInit(cx, &xml->xml_kids, 0);
        if (xml_class == JSXML_CLASS_LIST) {
            xml->xml_target = NULL;
            xml->xml_targetprop = NULL;
        } else {
            XMLArrayInit(cx, &xml->xml_namespaces, 0);
            XMLArrayInit(cx, &xml->xml_attrs, 0);
        }
    }

#ifdef DEBUG_notme
    JS_APPEND_LINK(&xml->links, &xml_leaks);
    xml->serial = xml_serial++;
#endif
    METER(xml_stats.xml);
    return xml;
}

void
js_TraceXML(JSTracer *trc, JSXML *xml)
{
    if (xml->object)
        JS_CALL_OBJECT_TRACER(trc, xml->object, "object");
    if (xml->name)
        JS_CALL_OBJECT_TRACER(trc, xml->name, "name");
    if (xml->parent)
        JS_CALL_TRACER(trc, xml->parent, JSTRACE_XML, "xml_parent");

    if (JSXML_HAS_VALUE(xml)) {
        if (xml->xml_value)
            JS_CALL_STRING_TRACER(trc, xml->xml_value, "value");
        return;
    }

    xml_trace_vector(trc,
                     (JSXML **) xml->xml_kids.vector,
                     xml->xml_kids.length);
    XMLArrayCursorTrace(trc, xml->xml_kids.cursors);
    if (IS_GC_MARKING_TRACER(trc))
        XMLArrayTrim(&xml->xml_kids);

    if (xml->xml_class == JSXML_CLASS_LIST) {
        if (xml->xml_target)
            JS_CALL_TRACER(trc, xml->xml_target, JSTRACE_XML, "target");
        if (xml->xml_targetprop)
            JS_CALL_OBJECT_TRACER(trc, xml->xml_targetprop, "targetprop");
    } else {
        TraceObjectVector(trc,
                          (JSObject **) xml->xml_namespaces.vector,
                          xml->xml_namespaces.length);
        XMLArrayCursorTrace(trc, xml->xml_namespaces.cursors);
        if (IS_GC_MARKING_TRACER(trc))
            XMLArrayTrim(&xml->xml_namespaces);

        xml_trace_vector(trc,
                         (JSXML **) xml->xml_attrs.vector,
                         xml->xml_attrs.length);
        XMLArrayCursorTrace(trc, xml->xml_attrs.cursors);
        if (IS_GC_MARKING_TRACER(trc))
            XMLArrayTrim(&xml->xml_attrs);
    }
}

void
js_FinalizeXML(JSContext *cx, JSXML *xml)
{
    if (JSXML_HAS_KIDS(xml)) {
        XMLArrayFinish(cx, &xml->xml_kids);
        if (xml->xml_class == JSXML_CLASS_ELEMENT) {
            XMLArrayFinish(cx, &xml->xml_namespaces);
            XMLArrayFinish(cx, &xml->xml_attrs);
        }
    }

#ifdef DEBUG_notme
    JS_REMOVE_LINK(&xml->links);
#endif
}

JSObject *
js_ParseNodeToXMLObject(JSContext *cx, JSParseContext *pc, JSParseNode *pn)
{
    jsval nsval;
    JSObject *ns;
    JSXMLArray nsarray;
    JSXML *xml;

    if (!js_GetDefaultXMLNamespace(cx, &nsval))
        return NULL;
    JS_ASSERT(!JSVAL_IS_PRIMITIVE(nsval));
    ns = JSVAL_TO_OBJECT(nsval);

    if (!XMLArrayInit(cx, &nsarray, 1))
        return NULL;

    XMLARRAY_APPEND(cx, &nsarray, ns);
    xml = ParseNodeToXML(cx, pc, pn, &nsarray, XSF_PRECOMPILED_ROOT);
    XMLArrayFinish(cx, &nsarray);
    if (!xml)
        return NULL;

    return xml->object;
}

JSObject *
js_NewXMLObject(JSContext *cx, JSXMLClass xml_class)
{
    JSXML *xml;
    JSObject *obj;
    JSTempValueRooter tvr;

    xml = js_NewXML(cx, xml_class);
    if (!xml)
        return NULL;
    JS_PUSH_TEMP_ROOT_XML(cx, xml, &tvr);
    obj = js_GetXMLObject(cx, xml);
    JS_POP_TEMP_ROOT(cx, &tvr);
    return obj;
}

static JSObject *
NewXMLObject(JSContext *cx, JSXML *xml)
{
    JSObject *obj;

    obj = js_NewObject(cx, &js_XMLClass, NULL, NULL, 0);
    if (!obj || !JS_SetPrivate(cx, obj, xml)) {
        cx->weakRoots.newborn[GCX_OBJECT] = NULL;
        return NULL;
    }
    METER(xml_stats.xmlobj);
    return obj;
}

JSObject *
js_GetXMLObject(JSContext *cx, JSXML *xml)
{
    JSObject *obj;

    obj = xml->object;
    if (obj) {
        JS_ASSERT(JS_GetPrivate(cx, obj) == xml);
        return obj;
    }

    /*
     * A JSXML cannot be shared among threads unless it has an object.
     * A JSXML cannot be given an object unless:
     * (a) it has no parent; or
     * (b) its parent has no object (therefore is thread-private); or
     * (c) its parent's object is locked.
     *
     * Once given an object, a JSXML is immutable.
     */
    JS_ASSERT(!xml->parent ||
              !xml->parent->object ||
              JS_IS_OBJ_LOCKED(cx, xml->parent->object));

    obj = NewXMLObject(cx, xml);
    if (!obj)
        return NULL;
    xml->object = obj;
    return obj;
}

JSObject *
js_InitNamespaceClass(JSContext *cx, JSObject *obj)
{
    return JS_InitClass(cx, obj, NULL, &js_NamespaceClass.base, Namespace, 2,
                        namespace_props, namespace_methods, NULL, NULL);
}

JSObject *
js_InitQNameClass(JSContext *cx, JSObject *obj)
{
    return JS_InitClass(cx, obj, NULL, &js_QNameClass.base, QName, 2,
                        qname_props, qname_methods, NULL, NULL);
}

JSObject *
js_InitAttributeNameClass(JSContext *cx, JSObject *obj)
{
    return JS_InitClass(cx, obj, NULL, &js_AttributeNameClass, AttributeName, 2,
                        qname_props, qname_methods, NULL, NULL);
}

JSObject *
js_InitAnyNameClass(JSContext *cx, JSObject *obj)
{
    jsval v;

    if (!js_GetAnyName(cx, &v))
        return NULL;
    return JSVAL_TO_OBJECT(v);
}

JSObject *
js_InitXMLClass(JSContext *cx, JSObject *obj)
{
    JSObject *proto, *pobj;
    JSFunction *fun;
    JSXML *xml;
    JSProperty *prop;
    JSScopeProperty *sprop;
    jsval cval, vp[3];

    /* Define the isXMLName function. */
    if (!JS_DefineFunction(cx, obj, js_isXMLName_str, xml_isXMLName, 1, 0))
        return NULL;

    /* Define the XML class constructor and prototype. */
    proto = JS_InitClass(cx, obj, NULL, &js_XMLClass, XML, 1,
                         NULL, xml_methods,
                         xml_static_props, xml_static_methods);
    if (!proto)
        return NULL;

    xml = js_NewXML(cx, JSXML_CLASS_TEXT);
    if (!xml || !JS_SetPrivate(cx, proto, xml))
        return NULL;
    xml->object = proto;
    METER(xml_stats.xmlobj);

    /*
     * Prepare to set default settings on the XML constructor we just made.
     * NB: We can't use JS_GetConstructor, because it calls OBJ_GET_PROPERTY,
     * which is xml_getProperty, which creates a new XMLList every time!  We
     * must instead call js_LookupProperty directly.
     */
    if (!js_LookupProperty(cx, proto,
                           ATOM_TO_JSID(cx->runtime->atomState.constructorAtom),
                           &pobj, &prop)) {
        return NULL;
    }
    JS_ASSERT(prop);
    sprop = (JSScopeProperty *) prop;
    JS_ASSERT(SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(pobj)));
    cval = OBJ_GET_SLOT(cx, pobj, sprop->slot);
    OBJ_DROP_PROPERTY(cx, pobj, prop);
    JS_ASSERT(VALUE_IS_FUNCTION(cx, cval));

    /* Set default settings. */
    vp[0] = JSVAL_NULL;
    vp[1] = cval;
    vp[2] = JSVAL_VOID;
    if (!xml_setSettings(cx, 1, vp))
        return NULL;

    /* Define the XMLList function and give it the same prototype as XML. */
    fun = JS_DefineFunction(cx, obj, js_XMLList_str, XMLList, 1, 0);
    if (!fun)
        return NULL;
    if (!js_SetClassPrototype(cx, FUN_OBJECT(fun), proto,
                              JSPROP_READONLY | JSPROP_PERMANENT)) {
        return NULL;
    }
    return proto;
}

JSObject *
js_InitXMLClasses(JSContext *cx, JSObject *obj)
{
    if (!js_InitNamespaceClass(cx, obj))
        return NULL;
    if (!js_InitQNameClass(cx, obj))
        return NULL;
    if (!js_InitAttributeNameClass(cx, obj))
        return NULL;
    if (!js_InitAnyNameClass(cx, obj))
        return NULL;
    if (!js_InitXMLFilterClass(cx, obj))
        return NULL;
    return js_InitXMLClass(cx, obj);
}

JSBool
js_GetFunctionNamespace(JSContext *cx, jsval *vp)
{
    JSRuntime *rt;
    JSObject *obj;
    JSAtom *atom;
    JSString *prefix, *uri;

    /* An invalid URI, for internal use only, guaranteed not to collide. */
    static const char anti_uri[] = "@mozilla.org/js/function";

    /* Optimize by avoiding JS_LOCK_GC(rt) for the common case. */
    rt = cx->runtime;
    obj = rt->functionNamespaceObject;
    if (!obj) {
        JS_LOCK_GC(rt);
        obj = rt->functionNamespaceObject;
        if (!obj) {
            JS_UNLOCK_GC(rt);

            /*
             * Note that any race to atomize anti_uri here is resolved by
             * the atom table code, such that at most one atom for anti_uri
             * is created.  We store in rt->atomState.lazy unconditionally,
             * since we are guaranteed to overwrite either null or the same
             * atom pointer.
             */
            atom = js_Atomize(cx, anti_uri, sizeof anti_uri - 1, ATOM_PINNED);
            if (!atom)
                return JS_FALSE;
            rt->atomState.lazy.functionNamespaceURIAtom = atom;

            prefix = ATOM_TO_STRING(rt->atomState.typeAtoms[JSTYPE_FUNCTION]);
            uri = ATOM_TO_STRING(atom);
            obj = NewXMLNamespace(cx, prefix, uri, JS_FALSE);
            if (!obj)
                return JS_FALSE;

            /*
             * Avoid entraining any in-scope Object.prototype.  The loss of
             * Namespace.prototype is not detectable, as there is no way to
             * refer to this instance in scripts.  When used to qualify method
             * names, its prefix and uri references are copied to the QName.
             */
            OBJ_CLEAR_PROTO(cx, obj);
            OBJ_CLEAR_PARENT(cx, obj);

            JS_LOCK_GC(rt);
            if (!rt->functionNamespaceObject)
                rt->functionNamespaceObject = obj;
            else
                obj = rt->functionNamespaceObject;
        }
        JS_UNLOCK_GC(rt);
    }
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

/*
 * Note the asymmetry between js_GetDefaultXMLNamespace and js_SetDefaultXML-
 * Namespace.  Get searches fp->scopeChain for JS_DEFAULT_XML_NAMESPACE_ID,
 * while Set sets JS_DEFAULT_XML_NAMESPACE_ID in fp->varobj (unless fp is a
 * lightweight function activation).  There's no requirement that fp->varobj
 * lie directly on fp->scopeChain, although it should be reachable using the
 * prototype chain from a scope object (cf. JSOPTION_VAROBJFIX in jsapi.h).
 *
 * If Get can't find JS_DEFAULT_XML_NAMESPACE_ID along the scope chain, it
 * creates a default namespace via 'new Namespace()'.  In contrast, Set uses
 * its v argument as the uri of a new Namespace, with "" as the prefix.  See
 * ECMA-357 12.1 and 12.1.1.  Note that if Set is called with a Namespace n,
 * the default XML namespace will be set to ("", n.uri).  So the uri string
 * is really the only usefully stored value of the default namespace.
 */
JSBool
js_GetDefaultXMLNamespace(JSContext *cx, jsval *vp)
{
    JSStackFrame *fp;
    JSObject *ns, *obj, *tmp;
    jsval v;

    fp = cx->fp;
    ns = fp->xmlNamespace;
    if (ns) {
        *vp = OBJECT_TO_JSVAL(ns);
        return JS_TRUE;
    }

    obj = NULL;
    for (tmp = fp->scopeChain; tmp; tmp = OBJ_GET_PARENT(cx, obj)) {
        obj = tmp;
        if (!OBJ_GET_PROPERTY(cx, obj, JS_DEFAULT_XML_NAMESPACE_ID, &v))
            return JS_FALSE;
        if (!JSVAL_IS_PRIMITIVE(v)) {
            fp->xmlNamespace = JSVAL_TO_OBJECT(v);
            *vp = v;
            return JS_TRUE;
        }
    }

    ns = js_ConstructObject(cx, &js_NamespaceClass.base, NULL, obj, 0, NULL);
    if (!ns)
        return JS_FALSE;
    v = OBJECT_TO_JSVAL(ns);
    if (obj &&
        !OBJ_DEFINE_PROPERTY(cx, obj, JS_DEFAULT_XML_NAMESPACE_ID, v,
                             JS_PropertyStub, JS_PropertyStub,
                             JSPROP_PERMANENT, NULL)) {
        return JS_FALSE;
    }
    fp->xmlNamespace = ns;
    *vp = v;
    return JS_TRUE;
}

JSBool
js_SetDefaultXMLNamespace(JSContext *cx, jsval v)
{
    jsval argv[2];
    JSObject *ns, *varobj;
    JSStackFrame *fp;

    argv[0] = STRING_TO_JSVAL(cx->runtime->emptyString);
    argv[1] = v;
    ns = js_ConstructObject(cx, &js_NamespaceClass.base, NULL, NULL, 2, argv);
    if (!ns)
        return JS_FALSE;
    v = OBJECT_TO_JSVAL(ns);

    fp = cx->fp;
    varobj = fp->varobj;
    if (varobj) {
        if (!OBJ_DEFINE_PROPERTY(cx, varobj, JS_DEFAULT_XML_NAMESPACE_ID, v,
                                 JS_PropertyStub, JS_PropertyStub,
                                 JSPROP_PERMANENT, NULL)) {
            return JS_FALSE;
        }
    } else {
        JS_ASSERT(fp->fun && !JSFUN_HEAVYWEIGHT_TEST(fp->fun->flags));
    }
    fp->xmlNamespace = JSVAL_TO_OBJECT(v);
    return JS_TRUE;
}

JSBool
js_ToAttributeName(JSContext *cx, jsval *vp)
{
    JSObject *qn;

    qn = ToAttributeName(cx, *vp);
    if (!qn)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(qn);
    return JS_TRUE;
}

JSString *
js_EscapeAttributeValue(JSContext *cx, JSString *str, JSBool quote)
{
    return EscapeAttributeValue(cx, NULL, str, quote);
}

JSString *
js_AddAttributePart(JSContext *cx, JSBool isName, JSString *str, JSString *str2)
{
    size_t len, len2, newlen;
    jschar *chars, *chars2;

    JSSTRING_CHARS_AND_LENGTH(str, chars, len);
    if (!JSSTRING_IS_MUTABLE(str)) {
        str = js_NewStringCopyN(cx, chars, len);
        if (!str)
            return NULL;
        chars = JSFLATSTR_CHARS(str);
    } else {
        /*
         * Reallocating str (because we know it has no other references)
         * requires purging any deflated string cached for it.
         */
        js_PurgeDeflatedStringCache(cx->runtime, str);
    }

    JSSTRING_CHARS_AND_LENGTH(str2, chars2, len2);
    newlen = (isName) ? len + 1 + len2 : len + 2 + len2 + 1;
    chars = (jschar *) JS_realloc(cx, chars, (newlen+1) * sizeof(jschar));
    if (!chars)
        return NULL;

    JSFLATSTR_INIT(str, chars, newlen);
    chars += len;
    if (isName) {
        *chars++ = ' ';
        js_strncpy(chars, chars2, len2);
        chars += len2;
    } else {
        *chars++ = '=';
        *chars++ = '"';
        js_strncpy(chars, chars2, len2);
        chars += len2;
        *chars++ = '"';
    }
    *chars = 0;
    return str;
}

JSString *
js_EscapeElementValue(JSContext *cx, JSString *str)
{
    return EscapeElementValue(cx, NULL, str);
}

JSString *
js_ValueToXMLString(JSContext *cx, jsval v)
{
    return ToXMLString(cx, v, 0);
}

static JSBool
anyname_toString(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                 jsval *rval)
{
    *rval = ATOM_KEY(cx->runtime->atomState.starAtom);
    return JS_TRUE;
}

JSBool
js_GetAnyName(JSContext *cx, jsval *vp)
{
    JSRuntime *rt;
    JSObject *obj;
    JSBool ok;

    /* Optimize by avoiding JS_LOCK_GC(rt) for the common case. */
    rt = cx->runtime;
    obj = rt->anynameObject;
    if (!obj) {
        JS_LOCK_GC(rt);
        obj = rt->anynameObject;
        if (!obj) {
            JS_UNLOCK_GC(rt);

            /*
             * Protect multiple newborns created below, in the do-while(0)
             * loop used to ensure that we leave this local root scope.
             */
            ok = js_EnterLocalRootScope(cx);
            if (!ok)
                return JS_FALSE;

            do {
                obj = js_NewObjectWithGivenProto(cx, &js_AnyNameClass, NULL,
                                                 NULL, 0);
                if (!obj) {
                    ok = JS_FALSE;
                    break;
                }
                InitXMLQName(obj, rt->emptyString, rt->emptyString,
                             ATOM_TO_STRING(rt->atomState.starAtom));
                METER(xml_stats.qname);

                /*
                 * Avoid entraining any Object.prototype found via cx's scope
                 * chain or global object.  This loses the default toString,
                 * but no big deal: we want to customize toString anyway for
                 * clearer diagnostics.
                 */
                if (!JS_DefineFunction(cx, obj, js_toString_str,
                                       anyname_toString, 0, 0)) {
                    ok = JS_FALSE;
                    break;
                }
                JS_ASSERT(!OBJ_GET_PROTO(cx, obj));
                JS_ASSERT(!OBJ_GET_PARENT(cx, obj));
            } while (0);

            js_LeaveLocalRootScopeWithResult(cx, OBJECT_TO_JSVAL(obj));
            if (!ok)
                return JS_FALSE;

            JS_LOCK_GC(rt);
            if (!rt->anynameObject)
                rt->anynameObject = obj;
            else
                obj = rt->anynameObject;
        }
        JS_UNLOCK_GC(rt);
    }
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

JSBool
js_FindXMLProperty(JSContext *cx, jsval nameval, JSObject **objp, jsid *idp)
{
    JSObject *nameobj;
    jsval v;
    JSObject *qn;
    jsid funid;
    JSObject *obj, *target, *proto, *pobj;
    JSXML *xml;
    JSBool found;
    JSProperty *prop;
    const char *printable;

    JS_ASSERT(!JSVAL_IS_PRIMITIVE(nameval));
    nameobj = JSVAL_TO_OBJECT(nameval);
    if (OBJ_GET_CLASS(cx, nameobj) == &js_AnyNameClass) {
        v = STRING_TO_JSVAL(ATOM_TO_STRING(cx->runtime->atomState.starAtom));
        nameobj = js_ConstructObject(cx, &js_QNameClass.base, NULL, NULL, 1,
                                     &v);
        if (!nameobj)
            return JS_FALSE;
    } else {
        JS_ASSERT(OBJ_GET_CLASS(cx, nameobj) == &js_AttributeNameClass ||
                  OBJ_GET_CLASS(cx, nameobj) == &js_QNameClass.base);
    }

    qn = nameobj;
    if (!IsFunctionQName(cx, qn, &funid))
        return JS_FALSE;

    obj = cx->fp->scopeChain;
    do {
        /* Skip any With object that can wrap XML. */
        target = obj;
        while (OBJ_GET_CLASS(cx, target) == &js_WithClass) {
             proto = OBJ_GET_PROTO(cx, target);
             if (!proto)
                 break;
             target = proto;
        }

        if (OBJECT_IS_XML(cx, target)) {
            if (funid == 0) {
                xml = (JSXML *) JS_GetPrivate(cx, target);
                found = HasNamedProperty(xml, qn);
            } else {
                if (!HasFunctionProperty(cx, target, funid, &found))
                    return JS_FALSE;
            }
            if (found) {
                *idp = OBJECT_TO_JSID(nameobj);
                *objp = target;
                return JS_TRUE;
            }
        } else if (funid != 0) {
            if (!OBJ_LOOKUP_PROPERTY(cx, target, funid, &pobj, &prop))
                return JS_FALSE;
            if (prop) {
                OBJ_DROP_PROPERTY(cx, pobj, prop);
                *idp = funid;
                *objp = target;
                return JS_TRUE;
            }
        }
    } while ((obj = OBJ_GET_PARENT(cx, obj)) != NULL);

    printable = js_ValueToPrintableString(cx, OBJECT_TO_JSVAL(nameobj));
    if (printable) {
        JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                     js_GetErrorMessage, NULL,
                                     JSMSG_UNDEFINED_XML_NAME, printable);
    }
    return JS_FALSE;
}

JSBool
js_GetXMLFunction(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    JSObject *target;
    JSXML *xml;
    JSTempValueRooter tvr;
    JSBool ok;

    JS_ASSERT(OBJECT_IS_XML(cx, obj));

    MUST_FLOW_THROUGH("out");
    JS_PUSH_TEMP_ROOT_OBJECT(cx, NULL, &tvr);

    /*
     * See comments before xml_lookupProperty about the need for the proto
     * chain lookup.
     */
    target = obj;
    for (;;) {
        ok = js_GetProperty(cx, target, id, vp);
        if (!ok)
            goto out;
        if (VALUE_IS_FUNCTION(cx, *vp)) {
            ok = JS_TRUE;
            goto out;
        }
        target = OBJ_GET_PROTO(cx, target);
        if (target == NULL)
            break;
        tvr.u.object = target;
    }

    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (HasSimpleContent(xml)) {
        /* Search in String.prototype to implement 11.2.2.1 Step 3(f). */
        ok = js_GetClassPrototype(cx, NULL, INT_TO_JSID(JSProto_String),
                                  &tvr.u.object);
        if (!ok)
            goto out;
        JS_ASSERT(tvr.u.object);
        ok = OBJ_GET_PROPERTY(cx, tvr.u.object, id, vp);
    }

  out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}

static JSXML *
GetPrivate(JSContext *cx, JSObject *obj, const char *method)
{
    JSXML *xml;

    xml = (JSXML *) JS_GetInstancePrivate(cx, obj, &js_XMLClass, NULL);
    if (!xml) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_INCOMPATIBLE_METHOD,
                             js_XML_str, method, OBJ_GET_CLASS(cx, obj)->name);
    }
    return xml;
}

JSBool
js_GetXMLDescendants(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSXML *xml, *list;

    xml = GetPrivate(cx, obj, "descendants internal method");
    if (!xml)
        return JS_FALSE;

    list = Descendants(cx, xml, id);
    if (!list)
        return JS_FALSE;
    *vp = OBJECT_TO_JSVAL(list->object);
    return JS_TRUE;
}

JSBool
js_DeleteXMLListElements(JSContext *cx, JSObject *listobj)
{
    JSXML *list;
    uint32 n;

    list = (JSXML *) JS_GetPrivate(cx, listobj);
    for (n = list->xml_kids.length; n != 0; --n)
        DeleteListElement(cx, list, 0);

    return JS_TRUE;
}

typedef struct JSXMLFilter {
    JSXML               *list;
    JSXML               *result;
    JSXML               *kid;
    JSXMLArrayCursor    cursor;

} JSXMLFilter;

static void
xmlfilter_trace(JSTracer *trc, JSObject *obj)
{
    JSXMLFilter *filter;

    filter = (JSXMLFilter *) JS_GetPrivate(trc->context, obj);
    if (!filter)
        return;

    JS_ASSERT(filter->list);
    JS_CALL_TRACER(trc, filter->list, JSTRACE_XML, "list");
    if (filter->result)
        JS_CALL_TRACER(trc, filter->result, JSTRACE_XML, "result");
    if (filter->kid)
        JS_CALL_TRACER(trc, filter->kid, JSTRACE_XML, "kid");

    /*
     * We do not need to trace the cursor as that would be done when
     * tracing the filter->list.
     */
}

static void
xmlfilter_finalize(JSContext *cx, JSObject *obj)
{
    JSXMLFilter *filter;

    filter = (JSXMLFilter *) JS_GetPrivate(cx, obj);
    if (!filter)
        return;

    XMLArrayCursorFinish(&filter->cursor);
    JS_free(cx, filter);
}

JSClass js_XMLFilterClass = {
    "XMLFilter",
    JSCLASS_HAS_PRIVATE |
    JSCLASS_IS_ANONYMOUS |
    JSCLASS_MARK_IS_TRACE |
    JSCLASS_HAS_CACHED_PROTO(JSProto_XMLFilter),
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,   JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,    xmlfilter_finalize,
    NULL,              NULL,            NULL,              NULL,
    NULL,              NULL,            JS_CLASS_TRACE(xmlfilter_trace), NULL
};

JSObject *
js_InitXMLFilterClass(JSContext *cx, JSObject *obj)
{
    JSObject *proto;

    proto = JS_InitClass(cx, obj, NULL, &js_XMLFilterClass, NULL, 0, NULL,
                         NULL, NULL, NULL);
    if (!proto)
        return NULL;

    OBJ_CLEAR_PROTO(cx, proto);
    return proto;
}

JSBool
js_StepXMLListFilter(JSContext *cx, JSBool initialized)
{
    jsval *sp;
    JSObject *obj, *filterobj, *resobj, *kidobj;
    JSXML *xml, *list;
    JSXMLFilter *filter;

    sp = cx->fp->regs->sp;
    if (!initialized) {
        /*
         * We haven't iterated yet, so initialize the filter based on the
         * value stored in sp[-2].
         */
        if (!VALUE_IS_XML(cx, sp[-2])) {
            js_ReportValueError(cx, JSMSG_NON_XML_FILTER, -2, sp[-2], NULL);
            return JS_FALSE;
        }
        obj = JSVAL_TO_OBJECT(sp[-2]);
        xml = (JSXML *) JS_GetPrivate(cx, obj);

        if (xml->xml_class == JSXML_CLASS_LIST) {
            list = xml;
        } else {
            obj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
            if (!obj)
                return JS_FALSE;

            /*
             * Root just-created obj. sp[-2] cannot be used yet for rooting
             * as it may be the only root holding xml.
             */
            sp[-1] = OBJECT_TO_JSVAL(obj);
            list = (JSXML *) JS_GetPrivate(cx, obj);
            if (!Append(cx, list, xml))
                return JS_FALSE;
        }

        filterobj = js_NewObject(cx, &js_XMLFilterClass, NULL, NULL, 0);
        if (!filterobj)
            return JS_FALSE;

        filter = (JSXMLFilter *) JS_malloc(cx, sizeof *filter);
        if (!filter)
            return JS_FALSE;

        /*
         * Init all filter fields before JS_SetPrivate exposes it to
         * xmlfilter_trace or xmlfilter_finalize.
         */
        filter->list = list;
        filter->result = NULL;
        filter->kid = NULL;
        XMLArrayCursorInit(&filter->cursor, &list->xml_kids);
        JS_SetPrivate(cx, filterobj, filter);

        /* Store filterobj to use in the later iterations. */
        sp[-2] = OBJECT_TO_JSVAL(filterobj);

        resobj = js_NewXMLObject(cx, JSXML_CLASS_LIST);
        if (!resobj)
            return JS_FALSE;

        /* This also roots resobj. */
        filter->result = (JSXML *) JS_GetPrivate(cx, resobj);
    } else {
        /* We have iterated at least once. */
        JS_ASSERT(!JSVAL_IS_PRIMITIVE(sp[-2]));
        JS_ASSERT(OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(sp[-2])) ==
                                &js_XMLFilterClass);
        filter = (JSXMLFilter *) JS_GetPrivate(cx, JSVAL_TO_OBJECT(sp[-2]));
        JS_ASSERT(filter->kid);

        /* Check if the filter expression wants to append the element. */
        if (js_ValueToBoolean(sp[-1]) &&
            !Append(cx, filter->result, filter->kid)) {
            return JS_FALSE;
        }
    }

    /* Do the iteration. */
    filter->kid = (JSXML *) XMLArrayCursorNext(&filter->cursor);
    if (!filter->kid) {
        /*
         * Do not defer finishing the cursor until the next GC cycle to avoid
         * accumulation of dead cursors associated with filter->list.
         */
        XMLArrayCursorFinish(&filter->cursor);
        JS_ASSERT(filter->result->object);
        sp[-2] = OBJECT_TO_JSVAL(filter->result->object);
        kidobj = NULL;
    } else {
        kidobj = js_GetXMLObject(cx, filter->kid);
        if (!kidobj)
            return JS_FALSE;
    }

    /* Null as kidobj at sp[-1] signals filter termination. */
    sp[-1] = OBJECT_TO_JSVAL(kidobj);
    return JS_TRUE;
}

JSObject *
js_ValueToXMLObject(JSContext *cx, jsval v)
{
    return ToXML(cx, v);
}

JSObject *
js_ValueToXMLListObject(JSContext *cx, jsval v)
{
    return ToXMLList(cx, v);
}

JSObject *
js_CloneXMLObject(JSContext *cx, JSObject *obj)
{
    uintN flags;
    JSXML *xml;

    if (!GetXMLSettingFlags(cx, &flags))
        return NULL;
    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (flags & (XSF_IGNORE_COMMENTS |
                 XSF_IGNORE_PROCESSING_INSTRUCTIONS |
                 XSF_IGNORE_WHITESPACE)) {
        xml = DeepCopy(cx, xml, NULL, flags);
        if (!xml)
            return NULL;
        return xml->object;
    }
    return NewXMLObject(cx, xml);
}

JSObject *
js_NewXMLSpecialObject(JSContext *cx, JSXMLClass xml_class, JSString *name,
                       JSString *value)
{
    uintN flags;
    JSObject *obj;
    JSXML *xml;
    JSObject *qn;

    if (!GetXMLSettingFlags(cx, &flags))
        return NULL;

    if ((xml_class == JSXML_CLASS_COMMENT &&
         (flags & XSF_IGNORE_COMMENTS)) ||
        (xml_class == JSXML_CLASS_PROCESSING_INSTRUCTION &&
         (flags & XSF_IGNORE_PROCESSING_INSTRUCTIONS))) {
        return js_NewXMLObject(cx, JSXML_CLASS_TEXT);
    }

    obj = js_NewXMLObject(cx, xml_class);
    if (!obj)
        return NULL;
    xml = (JSXML *) JS_GetPrivate(cx, obj);
    if (name) {
        qn = NewXMLQName(cx, cx->runtime->emptyString, NULL, name);
        if (!qn)
            return NULL;
        xml->name = qn;
    }
    xml->xml_value = value;
    return obj;
}

JSString *
js_MakeXMLCDATAString(JSContext *cx, JSString *str)
{
    return MakeXMLCDATAString(cx, NULL, str);
}

JSString *
js_MakeXMLCommentString(JSContext *cx, JSString *str)
{
    return MakeXMLCommentString(cx, NULL, str);
}

JSString *
js_MakeXMLPIString(JSContext *cx, JSString *name, JSString *str)
{
    return MakeXMLPIString(cx, NULL, name, str);
}

#endif /* JS_HAS_XML_SUPPORT */
