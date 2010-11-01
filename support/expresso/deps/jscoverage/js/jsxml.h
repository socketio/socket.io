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

#ifndef jsxml_h___
#define jsxml_h___

#include "jsstddef.h"
#include "jspubtd.h"

JS_BEGIN_EXTERN_C

extern const char js_AnyName_str[];
extern const char js_AttributeName_str[];
extern const char js_isXMLName_str[];
extern const char js_XMLList_str[];

extern const char js_amp_entity_str[];
extern const char js_gt_entity_str[];
extern const char js_lt_entity_str[];
extern const char js_quot_entity_str[];

typedef JSBool
(* JSIdentityOp)(const void *a, const void *b);

struct JSXMLArray {
    uint32              length;
    uint32              capacity;
    void                **vector;
    JSXMLArrayCursor    *cursors;
};

#define JSXML_PRESET_CAPACITY   JS_BIT(31)
#define JSXML_CAPACITY_MASK     JS_BITMASK(31)
#define JSXML_CAPACITY(array)   ((array)->capacity & JSXML_CAPACITY_MASK)

struct JSXMLArrayCursor {
    JSXMLArray          *array;
    uint32              index;
    JSXMLArrayCursor    *next;
    JSXMLArrayCursor    **prevp;
    void                *root;
};

/*
 * NB: don't reorder this enum without changing all array initializers that
 * depend on it in jsxml.c.
 */
typedef enum JSXMLClass {
    JSXML_CLASS_LIST,
    JSXML_CLASS_ELEMENT,
    JSXML_CLASS_ATTRIBUTE,
    JSXML_CLASS_PROCESSING_INSTRUCTION,
    JSXML_CLASS_TEXT,
    JSXML_CLASS_COMMENT,
    JSXML_CLASS_LIMIT
} JSXMLClass;

#define JSXML_CLASS_HAS_KIDS(class_)    ((class_) < JSXML_CLASS_ATTRIBUTE)
#define JSXML_CLASS_HAS_VALUE(class_)   ((class_) >= JSXML_CLASS_ATTRIBUTE)
#define JSXML_CLASS_HAS_NAME(class_)                                          \
    ((uintN)((class_) - JSXML_CLASS_ELEMENT) <=                               \
     (uintN)(JSXML_CLASS_PROCESSING_INSTRUCTION - JSXML_CLASS_ELEMENT))

#ifdef DEBUG_notme
#include "jsclist.h"
#endif

typedef struct JSXMLListVar {
    JSXMLArray          kids;           /* NB: must come first */
    JSXML               *target;
    JSObject            *targetprop;
} JSXMLListVar;

typedef struct JSXMLElemVar {
    JSXMLArray          kids;           /* NB: must come first */
    JSXMLArray          namespaces;
    JSXMLArray          attrs;
} JSXMLElemVar;

struct JSXML {
#ifdef DEBUG_notme
    JSCList             links;
    uint32              serial;
#endif
    JSObject            *object;
    void                *domnode;       /* DOM node if mapped info item */
    JSXML               *parent;
    JSObject            *name;
    uint16              xml_class;      /* discriminates u, below */
    uint16              xml_flags;      /* flags, see below */
    union {
        JSXMLListVar    list;
        JSXMLElemVar    elem;
        JSString        *value;
    } u;

    /* Don't add anything after u -- see js_NewXML for why. */
};

/* union member shorthands */
#define xml_kids        u.list.kids
#define xml_target      u.list.target
#define xml_targetprop  u.list.targetprop
#define xml_namespaces  u.elem.namespaces
#define xml_attrs       u.elem.attrs
#define xml_value       u.value

/* xml_flags values */
#define XMLF_WHITESPACE_TEXT    0x1

/* xml_class-testing macros */
#define JSXML_HAS_KIDS(xml)     JSXML_CLASS_HAS_KIDS((xml)->xml_class)
#define JSXML_HAS_VALUE(xml)    JSXML_CLASS_HAS_VALUE((xml)->xml_class)
#define JSXML_HAS_NAME(xml)     JSXML_CLASS_HAS_NAME((xml)->xml_class)
#define JSXML_LENGTH(xml)       (JSXML_CLASS_HAS_KIDS((xml)->xml_class)       \
                                 ? (xml)->xml_kids.length                     \
                                 : 0)

extern JSXML *
js_NewXML(JSContext *cx, JSXMLClass xml_class);

extern void
js_TraceXML(JSTracer *trc, JSXML *xml);

extern void
js_FinalizeXML(JSContext *cx, JSXML *xml);

extern JSObject *
js_ParseNodeToXMLObject(JSContext *cx, JSParseContext *pc, JSParseNode *pn);

extern JSObject *
js_NewXMLObject(JSContext *cx, JSXMLClass xml_class);

extern JSObject *
js_GetXMLObject(JSContext *cx, JSXML *xml);

extern JS_FRIEND_DATA(JSXMLObjectOps)   js_XMLObjectOps;
extern JS_FRIEND_DATA(JSClass)          js_XMLClass;
extern JS_FRIEND_DATA(JSExtendedClass)  js_NamespaceClass;
extern JS_FRIEND_DATA(JSExtendedClass)  js_QNameClass;
extern JS_FRIEND_DATA(JSClass)          js_AttributeNameClass;
extern JS_FRIEND_DATA(JSClass)          js_AnyNameClass;
extern JSClass                          js_XMLFilterClass;

/*
 * Macros to test whether an object or a value is of type "xml" (per typeof).
 * NB: jsobj.h must be included before any call to OBJECT_IS_XML, and jsapi.h
 * and jsobj.h must be included before any call to VALUE_IS_XML.
 */
#define OBJECT_IS_XML(cx,obj)   ((obj)->map->ops == &js_XMLObjectOps.base)
#define VALUE_IS_XML(cx,v)      (!JSVAL_IS_PRIMITIVE(v) &&                    \
                                 OBJECT_IS_XML(cx, JSVAL_TO_OBJECT(v)))

extern JSObject *
js_InitNamespaceClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitQNameClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitAttributeNameClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitAnyNameClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitXMLClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_InitXMLClasses(JSContext *cx, JSObject *obj);

extern JSBool
js_GetFunctionNamespace(JSContext *cx, jsval *vp);

/*
 * If obj is QName corresponding to function::name, set *funidp to name's id,
 * otherwise set *funidp to 0.
 */
JSBool
js_IsFunctionQName(JSContext *cx, JSObject *obj, jsid *funidp);

extern JSBool
js_GetDefaultXMLNamespace(JSContext *cx, jsval *vp);

extern JSBool
js_SetDefaultXMLNamespace(JSContext *cx, jsval v);

/*
 * Return true if v is a XML QName object, or if it converts to a string that
 * contains a valid XML qualified name (one containing no :), false otherwise.
 * NB: This function is an infallible predicate, it hides exceptions.
 */
extern JSBool
js_IsXMLName(JSContext *cx, jsval v);

extern JSBool
js_ToAttributeName(JSContext *cx, jsval *vp);

extern JSString *
js_EscapeAttributeValue(JSContext *cx, JSString *str, JSBool quote);

extern JSString *
js_AddAttributePart(JSContext *cx, JSBool isName, JSString *str,
                    JSString *str2);

extern JSString *
js_EscapeElementValue(JSContext *cx, JSString *str);

extern JSString *
js_ValueToXMLString(JSContext *cx, jsval v);

extern JSObject *
js_ConstructXMLQNameObject(JSContext *cx, jsval nsval, jsval lnval);

extern JSBool
js_GetAnyName(JSContext *cx, jsval *vp);

/*
 * Note: nameval must be either QName, AttributeName, or AnyName.
 */
extern JSBool
js_FindXMLProperty(JSContext *cx, jsval nameval, JSObject **objp, jsid *idp);

extern JSBool
js_GetXMLFunction(JSContext *cx, JSObject *obj, jsid id, jsval *vp);

extern JSBool
js_GetXMLDescendants(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

extern JSBool
js_DeleteXMLListElements(JSContext *cx, JSObject *listobj);

extern JSObject *
js_InitXMLFilterClass(JSContext *cx, JSObject* obj);

extern JSBool
js_StepXMLListFilter(JSContext *cx, JSBool initialized);

extern JSObject *
js_ValueToXMLObject(JSContext *cx, jsval v);

extern JSObject *
js_ValueToXMLListObject(JSContext *cx, jsval v);

extern JSObject *
js_CloneXMLObject(JSContext *cx, JSObject *obj);

extern JSObject *
js_NewXMLSpecialObject(JSContext *cx, JSXMLClass xml_class, JSString *name,
                       JSString *value);

extern JSString *
js_MakeXMLCDATAString(JSContext *cx, JSString *str);

extern JSString *
js_MakeXMLCommentString(JSContext *cx, JSString *str);

extern JSString *
js_MakeXMLPIString(JSContext *cx, JSString *name, JSString *str);

JS_END_EXTERN_C

#endif /* jsxml_h___ */
