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
 * JS object implementation.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsbit.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jshash.h" /* Added by JSIFY */
#include "jsdhash.h"
#include "jsprf.h"
#include "jsapi.h"
#include "jsarray.h"
#include "jsatom.h"
#include "jsbool.h"
#include "jsbuiltins.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jsdbgapi.h"   /* whether or not JS_HAS_OBJ_WATCHPOINT */
#include "jsstaticcheck.h"

#if JS_HAS_GENERATORS
#include "jsiter.h"
#endif

#if JS_HAS_XML_SUPPORT
#include "jsxml.h"
#endif

#if JS_HAS_XDR
#include "jsxdrapi.h"
#endif

#ifdef INCLUDE_MOZILLA_DTRACE
#include "jsdtracef.h"
#endif

#include "jsautooplen.h"

#ifdef JS_THREADSAFE
#define NATIVE_DROP_PROPERTY js_DropProperty

extern void
js_DropProperty(JSContext *cx, JSObject *obj, JSProperty *prop);
#else
#define NATIVE_DROP_PROPERTY NULL
#endif

JS_FRIEND_DATA(JSObjectOps) js_ObjectOps = {
    js_NewObjectMap,        js_DestroyObjectMap,
    js_LookupProperty,      js_DefineProperty,
    js_GetProperty,         js_SetProperty,
    js_GetAttributes,       js_SetAttributes,
    js_DeleteProperty,      js_DefaultValue,
    js_Enumerate,           js_CheckAccess,
    NULL,                   NATIVE_DROP_PROPERTY,
    js_Call,                js_Construct,
    NULL,                   js_HasInstance,
    js_SetProtoOrParent,    js_SetProtoOrParent,
    js_TraceObject,         js_Clear,
    js_GetRequiredSlot,     js_SetRequiredSlot
};

JSClass js_ObjectClass = {
    js_Object_str,
    JSCLASS_HAS_CACHED_PROTO(JSProto_Object),
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,   JS_FinalizeStub,
    JSCLASS_NO_OPTIONAL_MEMBERS
};

#if JS_HAS_OBJ_PROTO_PROP

static JSBool
obj_getSlot(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

static JSBool
obj_setSlot(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

static JSBool
obj_getCount(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

static JSPropertySpec object_props[] = {
    /* These two must come first; see object_props[slot].name usage below. */
    {js_proto_str, JSSLOT_PROTO, JSPROP_PERMANENT|JSPROP_SHARED,
                                                  obj_getSlot,  obj_setSlot},
    {js_parent_str,JSSLOT_PARENT,JSPROP_READONLY|JSPROP_PERMANENT|JSPROP_SHARED,
                                                  obj_getSlot,  obj_setSlot},
    {js_count_str, 0,            JSPROP_READONLY|JSPROP_PERMANENT|JSPROP_SHARED,
                                                  obj_getCount, NULL},
    {0,0,0,0,0}
};

/* NB: JSSLOT_PROTO and JSSLOT_PARENT are already indexes into object_props. */
#define JSSLOT_COUNT 2

static JSBool
ReportStrictSlot(JSContext *cx, uint32 slot)
{
    if (slot == JSSLOT_PROTO)
        return JS_TRUE;
    return JS_ReportErrorFlagsAndNumber(cx,
                                        JSREPORT_WARNING | JSREPORT_STRICT,
                                        js_GetErrorMessage, NULL,
                                        JSMSG_DEPRECATED_USAGE,
                                        object_props[slot].name);
}

static JSBool
obj_getSlot(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    uint32 slot;
    jsid propid;
    JSAccessMode mode;
    uintN attrs;
    JSObject *pobj;
    JSClass *clasp;
    JSExtendedClass *xclasp;

    slot = (uint32) JSVAL_TO_INT(id);
    if (id == INT_TO_JSVAL(JSSLOT_PROTO)) {
        propid = ATOM_TO_JSID(cx->runtime->atomState.protoAtom);
        mode = JSACC_PROTO;
    } else {
        propid = ATOM_TO_JSID(cx->runtime->atomState.parentAtom);
        mode = JSACC_PARENT;
    }

    /* Let OBJ_CHECK_ACCESS get the slot's value, based on the access mode. */
    if (!OBJ_CHECK_ACCESS(cx, obj, propid, mode, vp, &attrs))
        return JS_FALSE;

    pobj = JSVAL_TO_OBJECT(*vp);
    if (pobj) {
        clasp = OBJ_GET_CLASS(cx, pobj);
        if (clasp == &js_CallClass || clasp == &js_BlockClass) {
            /* Censor activations and lexical scopes per ECMA-262. */
            *vp = JSVAL_NULL;
        } else if (clasp->flags & JSCLASS_IS_EXTENDED) {
            xclasp = (JSExtendedClass *) clasp;
            if (xclasp->outerObject) {
                pobj = xclasp->outerObject(cx, pobj);
                if (!pobj)
                    return JS_FALSE;
                *vp = OBJECT_TO_JSVAL(pobj);
            }
        }
    }
    return JS_TRUE;
}

static JSBool
obj_setSlot(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSObject *pobj;
    uint32 slot;
    jsid propid;
    uintN attrs;

    if (!JSVAL_IS_OBJECT(*vp))
        return JS_TRUE;
    pobj = JSVAL_TO_OBJECT(*vp);

    if (pobj) {
        /*
         * Innerize pobj here to avoid sticking unwanted properties on the
         * outer object. This ensures that any with statements only grant
         * access to the inner object.
         */
        OBJ_TO_INNER_OBJECT(cx, pobj);
        if (!pobj)
            return JS_FALSE;
    }
    slot = (uint32) JSVAL_TO_INT(id);
    if (JS_HAS_STRICT_OPTION(cx) && !ReportStrictSlot(cx, slot))
        return JS_FALSE;

    /* __parent__ is readonly and permanent, only __proto__ may be set. */
    propid = ATOM_TO_JSID(cx->runtime->atomState.protoAtom);
    if (!OBJ_CHECK_ACCESS(cx, obj, propid,
                          (JSAccessMode)(JSACC_PROTO|JSACC_WRITE), vp,
                          &attrs)) {
        return JS_FALSE;
    }

    return js_SetProtoOrParent(cx, obj, slot, pobj);
}

static JSBool
obj_getCount(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    jsval iter_state;
    jsid num_properties;
    JSBool ok;

    if (JS_HAS_STRICT_OPTION(cx) && !ReportStrictSlot(cx, JSSLOT_COUNT))
        return JS_FALSE;

    /* Get the number of properties to enumerate. */
    iter_state = JSVAL_NULL;
    ok = OBJ_ENUMERATE(cx, obj, JSENUMERATE_INIT, &iter_state, &num_properties);
    if (!ok)
        goto out;

    if (!JSVAL_IS_INT(num_properties)) {
        JS_ASSERT(0);
        *vp = JSVAL_ZERO;
        goto out;
    }
    *vp = num_properties;

out:
    if (iter_state != JSVAL_NULL)
        ok = OBJ_ENUMERATE(cx, obj, JSENUMERATE_DESTROY, &iter_state, 0);
    return ok;
}

#else  /* !JS_HAS_OBJ_PROTO_PROP */

#define object_props NULL

#endif /* !JS_HAS_OBJ_PROTO_PROP */

JSBool
js_SetProtoOrParent(JSContext *cx, JSObject *obj, uint32 slot, JSObject *pobj)
{
    JSSetSlotRequest ssr;
    JSRuntime *rt;

    /* Optimize the null case to avoid the unnecessary overhead of js_GC. */
    if (!pobj) {
        JS_LOCK_OBJ(cx, obj);
        if (slot == JSSLOT_PROTO && !js_GetMutableScope(cx, obj)) {
            JS_UNLOCK_OBJ(cx, obj);
            return JS_FALSE;
        }
        LOCKED_OBJ_SET_SLOT(obj, slot, JSVAL_NULL);
        JS_UNLOCK_OBJ(cx, obj);
        return JS_TRUE;
    }

    ssr.obj = obj;
    ssr.pobj = pobj;
    ssr.slot = (uint16) slot;
    ssr.errnum = (uint16) JSMSG_NOT_AN_ERROR;

    rt = cx->runtime;
    JS_LOCK_GC(rt);
    ssr.next = rt->setSlotRequests;
    rt->setSlotRequests = &ssr;
    for (;;) {
        js_GC(cx, GC_SET_SLOT_REQUEST);
        JS_UNLOCK_GC(rt);
        if (!rt->setSlotRequests)
            break;
        JS_LOCK_GC(rt);
    }

    if (ssr.errnum != JSMSG_NOT_AN_ERROR) {
        if (ssr.errnum == JSMSG_OUT_OF_MEMORY) {
            JS_ReportOutOfMemory(cx);
        } else {
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, ssr.errnum,
#if JS_HAS_OBJ_PROTO_PROP
                                 object_props[slot].name
#else
                                 (slot == JSSLOT_PROTO) ? js_proto_str
                                                        : js_parent_str
#endif
                                 );
        }
        return JS_FALSE;
    }

    // Maintain the "any Array prototype has indexed properties hazard" flag.
    if (slot == JSSLOT_PROTO &&
        OBJ_IS_ARRAY(cx, pobj) &&
        pobj->fslots[JSSLOT_ARRAY_LENGTH] != 0) {
        rt->anyArrayProtoHasElement = JS_TRUE;
    }
    return JS_TRUE;
}

static JSHashNumber
js_hash_object(const void *key)
{
    return (JSHashNumber)JS_PTR_TO_UINT32(key) >> JSVAL_TAGBITS;
}

static JSHashEntry *
MarkSharpObjects(JSContext *cx, JSObject *obj, JSIdArray **idap)
{
    JSSharpObjectMap *map;
    JSHashTable *table;
    JSHashNumber hash;
    JSHashEntry **hep, *he;
    jsatomid sharpid;
    JSIdArray *ida;
    JSBool ok;
    jsint i, length;
    jsid id;
#if JS_HAS_GETTER_SETTER
    JSObject *obj2;
    JSProperty *prop;
    uintN attrs;
#endif
    jsval val;

    JS_CHECK_RECURSION(cx, return NULL);

    map = &cx->sharpObjectMap;
    table = map->table;
    hash = js_hash_object(obj);
    hep = JS_HashTableRawLookup(table, hash, obj);
    he = *hep;
    if (!he) {
        sharpid = 0;
        he = JS_HashTableRawAdd(table, hep, hash, obj,
                                JS_UINT32_TO_PTR(sharpid));
        if (!he) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }

        /*
         * Increment map->depth to protect js_EnterSharpObject from reentering
         * itself badly.  Without this fix, if we reenter the basis case where
         * map->depth == 0, when unwinding the inner call we will destroy the
         * newly-created hash table and crash.
         */
        ++map->depth;
        ida = JS_Enumerate(cx, obj);
        --map->depth;
        if (!ida)
            return NULL;

        ok = JS_TRUE;
        for (i = 0, length = ida->length; i < length; i++) {
            id = ida->vector[i];
#if JS_HAS_GETTER_SETTER
            ok = OBJ_LOOKUP_PROPERTY(cx, obj, id, &obj2, &prop);
            if (!ok)
                break;
            if (!prop)
                continue;
            ok = OBJ_GET_ATTRIBUTES(cx, obj2, id, prop, &attrs);
            if (ok) {
                if (OBJ_IS_NATIVE(obj2) &&
                    (attrs & (JSPROP_GETTER | JSPROP_SETTER))) {
                    val = JSVAL_NULL;
                    if (attrs & JSPROP_GETTER)
                        val = (jsval) ((JSScopeProperty*)prop)->getter;
                    if (attrs & JSPROP_SETTER) {
                        if (val != JSVAL_NULL) {
                            /* Mark the getter, then set val to setter. */
                            ok = (MarkSharpObjects(cx, JSVAL_TO_OBJECT(val),
                                                   NULL)
                                  != NULL);
                        }
                        val = (jsval) ((JSScopeProperty*)prop)->setter;
                    }
                } else {
                    ok = OBJ_GET_PROPERTY(cx, obj, id, &val);
                }
            }
            OBJ_DROP_PROPERTY(cx, obj2, prop);
#else
            ok = OBJ_GET_PROPERTY(cx, obj, id, &val);
#endif
            if (!ok)
                break;
            if (!JSVAL_IS_PRIMITIVE(val) &&
                !MarkSharpObjects(cx, JSVAL_TO_OBJECT(val), NULL)) {
                ok = JS_FALSE;
                break;
            }
        }
        if (!ok || !idap)
            JS_DestroyIdArray(cx, ida);
        if (!ok)
            return NULL;
    } else {
        sharpid = JS_PTR_TO_UINT32(he->value);
        if (sharpid == 0) {
            sharpid = ++map->sharpgen << SHARP_ID_SHIFT;
            he->value = JS_UINT32_TO_PTR(sharpid);
        }
        ida = NULL;
    }
    if (idap)
        *idap = ida;
    return he;
}

JSHashEntry *
js_EnterSharpObject(JSContext *cx, JSObject *obj, JSIdArray **idap,
                    jschar **sp)
{
    JSSharpObjectMap *map;
    JSHashTable *table;
    JSIdArray *ida;
    JSHashNumber hash;
    JSHashEntry *he, **hep;
    jsatomid sharpid;
    char buf[20];
    size_t len;

    if (!JS_CHECK_OPERATION_LIMIT(cx, JSOW_ENTER_SHARP))
        return NULL;

    /* Set to null in case we return an early error. */
    *sp = NULL;
    map = &cx->sharpObjectMap;
    table = map->table;
    if (!table) {
        table = JS_NewHashTable(8, js_hash_object, JS_CompareValues,
                                JS_CompareValues, NULL, NULL);
        if (!table) {
            JS_ReportOutOfMemory(cx);
            return NULL;
        }
        map->table = table;
        JS_KEEP_ATOMS(cx->runtime);
    }

    /* From this point the control must flow either through out: or bad:. */
    ida = NULL;
    if (map->depth == 0) {
        he = MarkSharpObjects(cx, obj, &ida);
        if (!he)
            goto bad;
        JS_ASSERT((JS_PTR_TO_UINT32(he->value) & SHARP_BIT) == 0);
        if (!idap) {
            JS_DestroyIdArray(cx, ida);
            ida = NULL;
        }
    } else {
        hash = js_hash_object(obj);
        hep = JS_HashTableRawLookup(table, hash, obj);
        he = *hep;

        /*
         * It's possible that the value of a property has changed from the
         * first time the object's properties are traversed (when the property
         * ids are entered into the hash table) to the second (when they are
         * converted to strings), i.e., the OBJ_GET_PROPERTY() call is not
         * idempotent.
         */
        if (!he) {
            he = JS_HashTableRawAdd(table, hep, hash, obj, NULL);
            if (!he) {
                JS_ReportOutOfMemory(cx);
                goto bad;
            }
            sharpid = 0;
            goto out;
        }
    }

    sharpid = JS_PTR_TO_UINT32(he->value);
    if (sharpid != 0) {
        len = JS_snprintf(buf, sizeof buf, "#%u%c",
                          sharpid >> SHARP_ID_SHIFT,
                          (sharpid & SHARP_BIT) ? '#' : '=');
        *sp = js_InflateString(cx, buf, &len);
        if (!*sp) {
            if (ida)
                JS_DestroyIdArray(cx, ida);
            goto bad;
        }
    }

out:
    JS_ASSERT(he);
    if ((sharpid & SHARP_BIT) == 0) {
        if (idap && !ida) {
            ida = JS_Enumerate(cx, obj);
            if (!ida) {
                if (*sp) {
                    JS_free(cx, *sp);
                    *sp = NULL;
                }
                goto bad;
            }
        }
        map->depth++;
    }

    if (idap)
        *idap = ida;
    return he;

bad:
    /* Clean up the sharpObjectMap table on outermost error. */
    if (map->depth == 0) {
        JS_UNKEEP_ATOMS(cx->runtime);
        map->sharpgen = 0;
        JS_HashTableDestroy(map->table);
        map->table = NULL;
    }
    return NULL;
}

void
js_LeaveSharpObject(JSContext *cx, JSIdArray **idap)
{
    JSSharpObjectMap *map;
    JSIdArray *ida;

    map = &cx->sharpObjectMap;
    JS_ASSERT(map->depth > 0);
    if (--map->depth == 0) {
        JS_UNKEEP_ATOMS(cx->runtime);
        map->sharpgen = 0;
        JS_HashTableDestroy(map->table);
        map->table = NULL;
    }
    if (idap) {
        ida = *idap;
        if (ida) {
            JS_DestroyIdArray(cx, ida);
            *idap = NULL;
        }
    }
}

static intN
gc_sharp_table_entry_marker(JSHashEntry *he, intN i, void *arg)
{
    JS_CALL_OBJECT_TRACER((JSTracer *)arg, (JSObject *)he->key,
                          "sharp table entry");
    return JS_DHASH_NEXT;
}

void
js_TraceSharpMap(JSTracer *trc, JSSharpObjectMap *map)
{
    JS_ASSERT(map->depth > 0);
    JS_ASSERT(map->table);

    /*
     * During recursive calls to MarkSharpObjects a non-native object or
     * object with a custom getProperty method can potentially return an
     * unrooted value or even cut from the object graph an argument of one of
     * MarkSharpObjects recursive invocations. So we must protect map->table
     * entries against GC.
     *
     * We can not simply use JSTempValueRooter to mark the obj argument of
     * MarkSharpObjects during recursion as we have to protect *all* entries
     * in JSSharpObjectMap including those that contains otherwise unreachable
     * objects just allocated through custom getProperty. Otherwise newer
     * allocations can re-use the address of an object stored in the hashtable
     * confusing js_EnterSharpObject. So to address the problem we simply
     * mark all objects from map->table.
     *
     * An alternative "proper" solution is to use JSTempValueRooter in
     * MarkSharpObjects with code to remove during finalization entries
     * with otherwise unreachable objects. But this is way too complex
     * to justify spending efforts.
     */
    JS_HashTableEnumerateEntries(map->table, gc_sharp_table_entry_marker, trc);
}

#if JS_HAS_TOSOURCE
static JSBool
obj_toSource(JSContext *cx, uintN argc, jsval *vp)
{
    JSBool ok, outermost;
    JSObject *obj;
    JSHashEntry *he;
    JSIdArray *ida;
    jschar *chars, *ochars, *vsharp;
    const jschar *idstrchars, *vchars;
    size_t nchars, idstrlength, gsoplength, vlength, vsharplength, curlen;
    const char *comma;
    jsint i, j, length, valcnt;
    jsid id;
#if JS_HAS_GETTER_SETTER
    JSObject *obj2;
    JSProperty *prop;
    uintN attrs;
#endif
    jsval *val;
    jsval localroot[4] = {JSVAL_NULL, JSVAL_NULL, JSVAL_NULL, JSVAL_NULL};
    JSTempValueRooter tvr;
    JSString *gsopold[2];
    JSString *gsop[2];
    JSString *idstr, *valstr, *str;

    JS_CHECK_RECURSION(cx, return JS_FALSE);

    MUST_FLOW_THROUGH("out");
    JS_PUSH_TEMP_ROOT(cx, 4, localroot, &tvr);

    /* If outermost, we need parentheses to be an expression, not a block. */
    outermost = (cx->sharpObjectMap.depth == 0);
    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !(he = js_EnterSharpObject(cx, obj, &ida, &chars))) {
        ok = JS_FALSE;
        goto out;
    }
    if (IS_SHARP(he)) {
        /*
         * We didn't enter -- obj is already "sharp", meaning we've visited it
         * already in our depth first search, and therefore chars contains a
         * string of the form "#n#".
         */
        JS_ASSERT(!ida);
#if JS_HAS_SHARP_VARS
        nchars = js_strlen(chars);
#else
        chars[0] = '{';
        chars[1] = '}';
        chars[2] = 0;
        nchars = 2;
#endif
        goto make_string;
    }
    JS_ASSERT(ida);
    ok = JS_TRUE;

    if (!chars) {
        /* If outermost, allocate 4 + 1 for "({})" and the terminator. */
        chars = (jschar *) malloc(((outermost ? 4 : 2) + 1) * sizeof(jschar));
        nchars = 0;
        if (!chars)
            goto error;
        if (outermost)
            chars[nchars++] = '(';
    } else {
        /* js_EnterSharpObject returned a string of the form "#n=" in chars. */
        MAKE_SHARP(he);
        nchars = js_strlen(chars);
        chars = (jschar *)
            realloc((ochars = chars), (nchars + 2 + 1) * sizeof(jschar));
        if (!chars) {
            free(ochars);
            goto error;
        }
        if (outermost) {
            /*
             * No need for parentheses around the whole shebang, because #n=
             * unambiguously begins an object initializer, and never a block
             * statement.
             */
            outermost = JS_FALSE;
        }
    }

    chars[nchars++] = '{';

    comma = NULL;

    /*
     * We have four local roots for cooked and raw value GC safety.  Hoist the
     * "localroot + 2" out of the loop using the val local, which refers to
     * the raw (unconverted, "uncooked") values.
     */
    val = localroot + 2;

    for (i = 0, length = ida->length; i < length; i++) {
        JSBool idIsLexicalIdentifier, needOldStyleGetterSetter;

        /* Get strings for id and value and GC-root them via vp. */
        id = ida->vector[i];

#if JS_HAS_GETTER_SETTER
        ok = OBJ_LOOKUP_PROPERTY(cx, obj, id, &obj2, &prop);
        if (!ok)
            goto error;
#endif

        /*
         * Convert id to a jsval and then to a string.  Decide early whether we
         * prefer get/set or old getter/setter syntax.
         */
        idstr = js_ValueToString(cx, ID_TO_VALUE(id));
        if (!idstr) {
            ok = JS_FALSE;
            OBJ_DROP_PROPERTY(cx, obj2, prop);
            goto error;
        }
        *vp = STRING_TO_JSVAL(idstr);                   /* local root */
        idIsLexicalIdentifier = js_IsIdentifier(idstr);
        needOldStyleGetterSetter =
            !idIsLexicalIdentifier ||
            js_CheckKeyword(JSSTRING_CHARS(idstr),
                            JSSTRING_LENGTH(idstr)) != TOK_EOF;

#if JS_HAS_GETTER_SETTER

        valcnt = 0;
        if (prop) {
            ok = OBJ_GET_ATTRIBUTES(cx, obj2, id, prop, &attrs);
            if (!ok) {
                OBJ_DROP_PROPERTY(cx, obj2, prop);
                goto error;
            }
            if (OBJ_IS_NATIVE(obj2) &&
                (attrs & (JSPROP_GETTER | JSPROP_SETTER))) {
                if (attrs & JSPROP_GETTER) {
                    val[valcnt] = (jsval) ((JSScopeProperty *)prop)->getter;
                    gsopold[valcnt] =
                        ATOM_TO_STRING(cx->runtime->atomState.getterAtom);
                    gsop[valcnt] =
                        ATOM_TO_STRING(cx->runtime->atomState.getAtom);

                    valcnt++;
                }
                if (attrs & JSPROP_SETTER) {
                    val[valcnt] = (jsval) ((JSScopeProperty *)prop)->setter;
                    gsopold[valcnt] =
                        ATOM_TO_STRING(cx->runtime->atomState.setterAtom);
                    gsop[valcnt] =
                        ATOM_TO_STRING(cx->runtime->atomState.setAtom);

                    valcnt++;
                }
            } else {
                valcnt = 1;
                gsop[0] = NULL;
                gsopold[0] = NULL;
                ok = OBJ_GET_PROPERTY(cx, obj, id, &val[0]);
            }
            OBJ_DROP_PROPERTY(cx, obj2, prop);
        }

#else  /* !JS_HAS_GETTER_SETTER */

        /*
         * We simplify the source code at the price of minor dead code bloat in
         * the ECMA version (for testing only, see jsversion.h).  The null
         * default values in gsop[j] suffice to disable non-ECMA getter and
         * setter code.
         */
        valcnt = 1;
        gsop[0] = NULL;
        gsopold[0] = NULL;
        ok = OBJ_GET_PROPERTY(cx, obj, id, &val[0]);

#endif /* !JS_HAS_GETTER_SETTER */

        if (!ok)
            goto error;

        /*
         * If id is a string that's not an identifier, then it needs to be
         * quoted.  Also, negative integer ids must be quoted.
         */
        if (JSID_IS_ATOM(id)
            ? !idIsLexicalIdentifier
            : (!JSID_IS_INT(id) || JSID_TO_INT(id) < 0)) {
            idstr = js_QuoteString(cx, idstr, (jschar)'\'');
            if (!idstr) {
                ok = JS_FALSE;
                goto error;
            }
            *vp = STRING_TO_JSVAL(idstr);               /* local root */
        }
        JSSTRING_CHARS_AND_LENGTH(idstr, idstrchars, idstrlength);

        for (j = 0; j < valcnt; j++) {
            /* Convert val[j] to its canonical source form. */
            valstr = js_ValueToSource(cx, val[j]);
            if (!valstr) {
                ok = JS_FALSE;
                goto error;
            }
            localroot[j] = STRING_TO_JSVAL(valstr);     /* local root */
            JSSTRING_CHARS_AND_LENGTH(valstr, vchars, vlength);

            if (vchars[0] == '#')
                needOldStyleGetterSetter = JS_TRUE;

            if (needOldStyleGetterSetter)
                gsop[j] = gsopold[j];

            /* If val[j] is a non-sharp object, consider sharpening it. */
            vsharp = NULL;
            vsharplength = 0;
#if JS_HAS_SHARP_VARS
            if (!JSVAL_IS_PRIMITIVE(val[j]) && vchars[0] != '#') {
                he = js_EnterSharpObject(cx, JSVAL_TO_OBJECT(val[j]), NULL,
                                         &vsharp);
                if (!he) {
                    ok = JS_FALSE;
                    goto error;
                }
                if (IS_SHARP(he)) {
                    vchars = vsharp;
                    vlength = js_strlen(vchars);
                    needOldStyleGetterSetter = JS_TRUE;
                    gsop[j] = gsopold[j];
                } else {
                    if (vsharp) {
                        vsharplength = js_strlen(vsharp);
                        MAKE_SHARP(he);
                        needOldStyleGetterSetter = JS_TRUE;
                        gsop[j] = gsopold[j];
                    }
                    js_LeaveSharpObject(cx, NULL);
                }
            }
#endif

#ifndef OLD_GETTER_SETTER
            /*
             * Remove '(function ' from the beginning of valstr and ')' from the
             * end so that we can put "get" in front of the function definition.
             */
            if (gsop[j] && VALUE_IS_FUNCTION(cx, val[j]) &&
                !needOldStyleGetterSetter) {
                JSFunction *fun = JS_ValueToFunction(cx, val[j]);
                const jschar *start = vchars;
                const jschar *end = vchars + vlength;

                uint8 parenChomp = 0;
                if (vchars[0] == '(') {
                    vchars++;
                    parenChomp = 1;
                }

                /*
                 * Try to jump "getter" or "setter" keywords, if we suspect
                 * they might appear here.  This code can be confused by people
                 * defining Function.prototype.toString, so let's be cautious.
                 */
                if (JSFUN_GETTER_TEST(fun->flags) ||
                    JSFUN_SETTER_TEST(fun->flags)) { /* skip "getter/setter" */
                    const jschar *tmp = js_strchr_limit(vchars, ' ', end);
                    if (tmp)
                        vchars = tmp + 1;
                }

                /* Try to jump "function" keyword. */
                if (vchars)
                    vchars = js_strchr_limit(vchars, ' ', end);

                if (vchars) {
                    if (*vchars == ' ')
                        vchars++;
                    vlength = end - vchars - parenChomp;
                } else {
                    gsop[j] = NULL;
                    vchars = start;
                }
            }
#else
            needOldStyleGetterSetter = JS_TRUE;
            gsop[j] = gsopold[j];
#endif

#define SAFE_ADD(n)                                                          \
    JS_BEGIN_MACRO                                                           \
        size_t n_ = (n);                                                     \
        curlen += n_;                                                        \
        if (curlen < n_)                                                     \
            goto overflow;                                                   \
    JS_END_MACRO

            curlen = nchars;
            if (comma)
                SAFE_ADD(2);
            SAFE_ADD(idstrlength + 1);
            if (gsop[j])
                SAFE_ADD(JSSTRING_LENGTH(gsop[j]) + 1);
            SAFE_ADD(vsharplength);
            SAFE_ADD(vlength);
            /* Account for the trailing null. */
            SAFE_ADD((outermost ? 2 : 1) + 1);
#undef SAFE_ADD

            if (curlen > (size_t)-1 / sizeof(jschar))
                goto overflow;

            /* Allocate 1 + 1 at end for closing brace and terminating 0. */
            chars = (jschar *)
                realloc((ochars = chars), curlen * sizeof(jschar));
            if (!chars) {
                /* Save code space on error: let JS_free ignore null vsharp. */
                JS_free(cx, vsharp);
                free(ochars);
                goto error;
            }

            if (comma) {
                chars[nchars++] = comma[0];
                chars[nchars++] = comma[1];
            }
            comma = ", ";

            if (needOldStyleGetterSetter) {
                js_strncpy(&chars[nchars], idstrchars, idstrlength);
                nchars += idstrlength;
                if (gsop[j]) {
                    chars[nchars++] = ' ';
                    gsoplength = JSSTRING_LENGTH(gsop[j]);
                    js_strncpy(&chars[nchars], JSSTRING_CHARS(gsop[j]),
                               gsoplength);
                    nchars += gsoplength;
                }
                chars[nchars++] = ':';
            } else {  /* New style "decompilation" */
                if (gsop[j]) {
                    gsoplength = JSSTRING_LENGTH(gsop[j]);
                    js_strncpy(&chars[nchars], JSSTRING_CHARS(gsop[j]),
                               gsoplength);
                    nchars += gsoplength;
                    chars[nchars++] = ' ';
                }
                js_strncpy(&chars[nchars], idstrchars, idstrlength);
                nchars += idstrlength;
                /* Extraneous space after id here will be extracted later */
                chars[nchars++] = gsop[j] ? ' ' : ':';
            }

            if (vsharplength) {
                js_strncpy(&chars[nchars], vsharp, vsharplength);
                nchars += vsharplength;
            }
            js_strncpy(&chars[nchars], vchars, vlength);
            nchars += vlength;

            if (vsharp)
                JS_free(cx, vsharp);
        }
    }

    chars[nchars++] = '}';
    if (outermost)
        chars[nchars++] = ')';
    chars[nchars] = 0;

  error:
    js_LeaveSharpObject(cx, &ida);

    if (!ok) {
        if (chars)
            free(chars);
        goto out;
    }

    if (!chars) {
        JS_ReportOutOfMemory(cx);
        ok = JS_FALSE;
        goto out;
    }
  make_string:
    str = js_NewString(cx, chars, nchars);
    if (!str) {
        free(chars);
        ok = JS_FALSE;
        goto out;
    }
    *vp = STRING_TO_JSVAL(str);
    ok = JS_TRUE;
  out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;

  overflow:
    JS_free(cx, vsharp);
    free(chars);
    chars = NULL;
    goto error;
}
#endif /* JS_HAS_TOSOURCE */

static JSBool
obj_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    jschar *chars;
    size_t nchars;
    const char *clazz, *prefix;
    JSString *str;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj)
        return JS_FALSE;
    obj = js_GetWrappedObject(cx, obj);
    clazz = OBJ_GET_CLASS(cx, obj)->name;
    nchars = 9 + strlen(clazz);         /* 9 for "[object ]" */
    chars = (jschar *) JS_malloc(cx, (nchars + 1) * sizeof(jschar));
    if (!chars)
        return JS_FALSE;

    prefix = "[object ";
    nchars = 0;
    while ((chars[nchars] = (jschar)*prefix) != 0)
        nchars++, prefix++;
    while ((chars[nchars] = (jschar)*clazz) != 0)
        nchars++, clazz++;
    chars[nchars++] = ']';
    chars[nchars] = 0;

    str = js_NewString(cx, chars, nchars);
    if (!str) {
        JS_free(cx, chars);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
obj_toLocaleString(JSContext *cx, uintN argc, jsval *vp)
{
    jsval thisv;
    JSString *str;

    thisv = JS_THIS(cx, vp);
    if (JSVAL_IS_NULL(thisv))
        return JS_FALSE;

    str = js_ValueToString(cx, thisv);
    if (!str)
        return JS_FALSE;

    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
obj_valueOf(JSContext *cx, uintN argc, jsval *vp)
{
    *vp = JS_THIS(cx, vp);
    return !JSVAL_IS_NULL(*vp);
}

/*
 * Check whether principals subsumes scopeobj's principals, and return true
 * if so (or if scopeobj has no principals, for backward compatibility with
 * the JS API, which does not require principals), and false otherwise.
 */
JSBool
js_CheckPrincipalsAccess(JSContext *cx, JSObject *scopeobj,
                         JSPrincipals *principals, JSAtom *caller)
{
    JSSecurityCallbacks *callbacks;
    JSPrincipals *scopePrincipals;
    const char *callerstr;

    callbacks = JS_GetSecurityCallbacks(cx);
    if (callbacks && callbacks->findObjectPrincipals) {
        scopePrincipals = callbacks->findObjectPrincipals(cx, scopeobj);
        if (!principals || !scopePrincipals ||
            !principals->subsume(principals, scopePrincipals)) {
            callerstr = js_AtomToPrintableString(cx, caller);
            if (!callerstr)
                return JS_FALSE;
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_BAD_INDIRECT_CALL, callerstr);
            return JS_FALSE;
        }
    }
    return JS_TRUE;
}

JSObject *
js_CheckScopeChainValidity(JSContext *cx, JSObject *scopeobj, const char *caller)
{
    JSClass *clasp;
    JSExtendedClass *xclasp;
    JSObject *inner;

    if (!scopeobj)
        goto bad;

    OBJ_TO_INNER_OBJECT(cx, scopeobj);
    if (!scopeobj)
        return NULL;

    inner = scopeobj;

    /* XXX This is an awful gross hack. */
    while (scopeobj) {
        clasp = OBJ_GET_CLASS(cx, scopeobj);
        if (clasp->flags & JSCLASS_IS_EXTENDED) {
            xclasp = (JSExtendedClass*)clasp;
            if (xclasp->innerObject &&
                xclasp->innerObject(cx, scopeobj) != scopeobj) {
                goto bad;
            }
        }

        scopeobj = OBJ_GET_PARENT(cx, scopeobj);
    }

    return inner;

bad:
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_BAD_INDIRECT_CALL, caller);
    return NULL;
}

const char *
js_ComputeFilename(JSContext *cx, JSStackFrame *caller,
                   JSPrincipals *principals, uintN *linenop)
{
    uint32 flags;
#ifdef DEBUG
    JSSecurityCallbacks *callbacks = JS_GetSecurityCallbacks(cx);
#endif

    JS_ASSERT(principals || !(callbacks  && callbacks->findObjectPrincipals));
    flags = JS_GetScriptFilenameFlags(caller->script);
    if ((flags & JSFILENAME_PROTECTED) &&
        principals &&
        strcmp(principals->codebase, "[System Principal]")) {
        *linenop = 0;
        return principals->codebase;
    }

    if (caller->regs && *caller->regs->pc == JSOP_EVAL) {
        JS_ASSERT(caller->regs->pc[JSOP_EVAL_LENGTH] == JSOP_LINENO);
        *linenop = GET_UINT16(caller->regs->pc + JSOP_EVAL_LENGTH);
    } else {
        *linenop = js_FramePCToLineNumber(cx, caller);
    }
    return caller->script->filename;
}

static JSBool
obj_eval(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSStackFrame *fp, *caller;
    JSBool indirectCall;
    JSObject *scopeobj;
    JSString *str;
    const char *file;
    uintN line;
    JSPrincipals *principals;
    uint32 tcflags;
    JSScript *script;
    JSBool ok;
#if JS_HAS_EVAL_THIS_SCOPE
    JSObject *callerScopeChain = NULL, *callerVarObj = NULL;
    JSObject *setCallerScopeChain = NULL;
    JSBool setCallerVarObj = JS_FALSE;
#endif

    fp = cx->fp;
    caller = JS_GetScriptedCaller(cx, fp);
    indirectCall = (caller && caller->regs && *caller->regs->pc != JSOP_EVAL);

    /*
     * Ban all indirect uses of eval (global.foo = eval; global.foo(...)) and
     * calls that attempt to use a non-global object as the "with" object in
     * the former indirect case.
     */
    scopeobj = OBJ_GET_PARENT(cx, obj);
    if (scopeobj) {
        scopeobj = js_GetWrappedObject(cx, obj);
        scopeobj = OBJ_GET_PARENT(cx, scopeobj);
    }
    if (indirectCall || scopeobj) {
        uintN flags = scopeobj
                      ? JSREPORT_ERROR
                      : JSREPORT_STRICT | JSREPORT_WARNING;
        if (!JS_ReportErrorFlagsAndNumber(cx, flags, js_GetErrorMessage, NULL,
                                          JSMSG_BAD_INDIRECT_CALL,
                                          js_eval_str)) {
            return JS_FALSE;
        }
    }

    if (!JSVAL_IS_STRING(argv[0])) {
        *rval = argv[0];
        return JS_TRUE;
    }

    /*
     * If the caller is a lightweight function and doesn't have a variables
     * object, then we need to provide one for the compiler to stick any
     * declared (var) variables into.
     */
    if (caller && !caller->varobj && !js_GetCallObject(cx, caller, NULL))
        return JS_FALSE;

    /* eval no longer takes an optional trailing argument. */
    if (argc >= 2 &&
        !JS_ReportErrorFlagsAndNumber(cx, JSREPORT_WARNING | JSREPORT_STRICT,
                                      js_GetErrorMessage, NULL,
                                      JSMSG_EVAL_ARITY)) {
        return JS_FALSE;
    }

    /* From here on, control must exit through label out with ok set. */
    MUST_FLOW_THROUGH("out");
    if (!scopeobj) {
#if JS_HAS_EVAL_THIS_SCOPE
        /* If obj.eval(str), emulate 'with (obj) eval(str)' in the caller. */
        if (indirectCall) {
            callerScopeChain = js_GetScopeChain(cx, caller);
            if (!callerScopeChain) {
                ok = JS_FALSE;
                goto out;
            }
            OBJ_TO_INNER_OBJECT(cx, obj);
            if (!obj) {
                ok = JS_FALSE;
                goto out;
            }
            if (obj != callerScopeChain) {
                ok = js_CheckPrincipalsAccess(cx, obj,
                                              caller->script->principals,
                                              cx->runtime->atomState.evalAtom);
                if (!ok)
                    goto out;

                scopeobj = js_NewWithObject(cx, obj, callerScopeChain, -1);
                if (!scopeobj) {
                    ok = JS_FALSE;
                    goto out;
                }

                /* Set fp->scopeChain too, for the compiler. */
                caller->scopeChain = fp->scopeChain = scopeobj;

                /* Remember scopeobj so we can null its private when done. */
                setCallerScopeChain = scopeobj;
            }

            callerVarObj = caller->varobj;
            if (obj != callerVarObj) {
                /* Set fp->varobj too, for the compiler. */
                caller->varobj = fp->varobj = obj;
                setCallerVarObj = JS_TRUE;
            }
        }
#endif

        /*
         * Compile using caller's current scope object.
         *
         * NB: This means that native callers (who reach this point through
         * the C API) must use the two parameter form.
         */
        if (caller) {
            scopeobj = js_GetScopeChain(cx, caller);
            if (!scopeobj) {
                ok = JS_FALSE;
                goto out;
            }
        }
    }

    /* Ensure we compile this eval with the right object in the scope chain. */
    scopeobj = js_CheckScopeChainValidity(cx, scopeobj, js_eval_str);
    if (!scopeobj) {
        ok = JS_FALSE;
        goto out;
    }

    str = JSVAL_TO_STRING(argv[0]);
    if (caller) {
        principals = JS_EvalFramePrincipals(cx, fp, caller);
        file = js_ComputeFilename(cx, caller, principals, &line);
    } else {
        file = NULL;
        line = 0;
        principals = NULL;
    }

    tcflags = TCF_COMPILE_N_GO;
    if (caller)
        tcflags |= TCF_PUT_STATIC_DEPTH(caller->script->staticDepth + 1);
    script = js_CompileScript(cx, scopeobj, caller, principals, tcflags,
                              JSSTRING_CHARS(str), JSSTRING_LENGTH(str),
                              NULL, file, line);
    if (!script) {
        ok = JS_FALSE;
        goto out;
    }

    if (argc < 2) {
        /* Execute using caller's new scope object (might be a Call object). */
        if (caller)
            scopeobj = caller->scopeChain;
    }

    /*
     * Belt-and-braces: check that the lesser of eval's principals and the
     * caller's principals has access to scopeobj.
     */
    ok = js_CheckPrincipalsAccess(cx, scopeobj, principals,
                                  cx->runtime->atomState.evalAtom);
    if (ok)
        ok = js_Execute(cx, scopeobj, script, caller, JSFRAME_EVAL, rval);

    script->u.nextToGC = JS_SCRIPTS_TO_GC(cx);
    JS_SCRIPTS_TO_GC(cx) = script;
#ifdef CHECK_SCRIPT_OWNER
    script->owner = NULL;
#endif

out:
#if JS_HAS_EVAL_THIS_SCOPE
    /* Restore OBJ_GET_PARENT(scopeobj) not callerScopeChain in case of Call. */
    if (setCallerScopeChain) {
        caller->scopeChain = callerScopeChain;
        JS_ASSERT(OBJ_GET_CLASS(cx, setCallerScopeChain) == &js_WithClass);
        JS_SetPrivate(cx, setCallerScopeChain, NULL);
    }
    if (setCallerVarObj)
        caller->varobj = callerVarObj;
#endif
    return ok;
}

#if JS_HAS_OBJ_WATCHPOINT

static JSBool
obj_watch_handler(JSContext *cx, JSObject *obj, jsval id, jsval old, jsval *nvp,
                  void *closure)
{
    JSObject *callable;
    JSSecurityCallbacks *callbacks;
    JSStackFrame *caller;
    JSPrincipals *subject, *watcher;
    JSResolvingKey key;
    JSResolvingEntry *entry;
    uint32 generation;
    jsval argv[3];
    JSBool ok;

    callable = (JSObject *) closure;

    callbacks = JS_GetSecurityCallbacks(cx);
    if (callbacks && callbacks->findObjectPrincipals) {
        /* Skip over any obj_watch_* frames between us and the real subject. */
        caller = JS_GetScriptedCaller(cx, cx->fp);
        if (caller) {
            /*
             * Only call the watch handler if the watcher is allowed to watch
             * the currently executing script.
             */
            watcher = callbacks->findObjectPrincipals(cx, callable);
            subject = JS_StackFramePrincipals(cx, caller);

            if (watcher && subject && !watcher->subsume(watcher, subject)) {
                /* Silently don't call the watch handler. */
                return JS_TRUE;
            }
        }
    }

    /* Avoid recursion on (obj, id) already being watched on cx. */
    key.obj = obj;
    key.id = id;
    if (!js_StartResolving(cx, &key, JSRESFLAG_WATCH, &entry))
        return JS_FALSE;
    if (!entry)
        return JS_TRUE;
    generation = cx->resolvingTable->generation;

    argv[0] = id;
    argv[1] = old;
    argv[2] = *nvp;
    ok = js_InternalCall(cx, obj, OBJECT_TO_JSVAL(callable), 3, argv, nvp);
    js_StopResolving(cx, &key, JSRESFLAG_WATCH, entry, generation);
    return ok;
}

static JSBool
obj_watch(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *callable;
    jsval userid, value;
    jsid propid;
    JSObject *obj;
    uintN attrs;

    if (argc <= 1) {
        js_ReportMissingArg(cx, vp, 1);
        return JS_FALSE;
    }

    callable = js_ValueToCallableObject(cx, &vp[3], 0);
    if (!callable)
        return JS_FALSE;

    /* Compute the unique int/atom symbol id needed by js_LookupProperty. */
    userid = vp[2];
    if (!JS_ValueToId(cx, userid, &propid))
        return JS_FALSE;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !OBJ_CHECK_ACCESS(cx, obj, propid, JSACC_WATCH, &value, &attrs))
        return JS_FALSE;
    if (attrs & JSPROP_READONLY)
        return JS_TRUE;
    *vp = JSVAL_VOID;

    if (OBJ_IS_DENSE_ARRAY(cx, obj) && !js_MakeArraySlow(cx, obj))
        return JS_FALSE;
    return JS_SetWatchPoint(cx, obj, userid, obj_watch_handler, callable);
}

static JSBool
obj_unwatch(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj)
        return JS_FALSE;
    *vp = JSVAL_VOID;
    return JS_ClearWatchPoint(cx, obj, argc != 0 ? vp[2] : JSVAL_VOID,
                              NULL, NULL);
}

#endif /* JS_HAS_OBJ_WATCHPOINT */

/*
 * Prototype and property query methods, to complement the 'in' and
 * 'instanceof' operators.
 */

/* Proposed ECMA 15.2.4.5. */
static JSBool
obj_hasOwnProperty(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    return obj &&
           js_HasOwnPropertyHelper(cx, obj->map->ops->lookupProperty, argc, vp);
}

JSBool
js_HasOwnPropertyHelper(JSContext *cx, JSLookupPropOp lookup, uintN argc,
                        jsval *vp)
{
    jsid id;
    JSObject *obj;

    if (!JS_ValueToId(cx, argc != 0 ? vp[2] : JSVAL_VOID, &id))
        return JS_FALSE;
    obj = JS_THIS_OBJECT(cx, vp);
    return obj && js_HasOwnProperty(cx, lookup, obj, id, vp);
}

JSBool
js_HasOwnProperty(JSContext *cx, JSLookupPropOp lookup, JSObject *obj, jsid id,
                  jsval *vp)
{
    JSObject *obj2;
    JSProperty *prop;
    JSScopeProperty *sprop;

    if (!lookup(cx, obj, id, &obj2, &prop))
        return JS_FALSE;
    if (!prop) {
        *vp = JSVAL_FALSE;
    } else if (obj2 == obj) {
        *vp = JSVAL_TRUE;
    } else {
        JSClass *clasp;
        JSExtendedClass *xclasp;
        JSObject *outer;

        clasp = OBJ_GET_CLASS(cx, obj2);
        if (!(clasp->flags & JSCLASS_IS_EXTENDED) ||
            !(xclasp = (JSExtendedClass *) clasp)->outerObject) {
            outer = NULL;
        } else {
            outer = xclasp->outerObject(cx, obj2);
            if (!outer)
                return JS_FALSE;
        }
        if (outer == obj) {
            *vp = JSVAL_TRUE;
        } else if (OBJ_IS_NATIVE(obj2) && OBJ_GET_CLASS(cx, obj) == clasp) {
            /*
             * The combination of JSPROP_SHARED and JSPROP_PERMANENT in a
             * delegated property makes that property appear to be direct in
             * all delegating instances of the same native class.  This hack
             * avoids bloating every function instance with its own 'length'
             * (AKA 'arity') property.  But it must not extend across class
             * boundaries, to avoid making hasOwnProperty lie (bug 320854).
             *
             * It's not really a hack, of course: a permanent property can't
             * be deleted, and JSPROP_SHARED means "don't allocate a slot in
             * any instance, prototype or delegating".  Without a slot, and
             * without the ability to remove and recreate (with differences)
             * the property, there is no way to tell whether it is directly
             * owned, or indirectly delegated.
             */
            sprop = (JSScopeProperty *)prop;
            *vp = BOOLEAN_TO_JSVAL(SPROP_IS_SHARED_PERMANENT(sprop));
        } else {
            *vp = JSVAL_FALSE;
        }
    }
    if (prop)
        OBJ_DROP_PROPERTY(cx, obj2, prop);
    return JS_TRUE;
}

#ifdef JS_TRACER
static int32 FASTCALL
Object_p_hasOwnProperty(JSContext* cx, JSObject* obj, JSString *str)
{
    jsid id;
    jsval v;

    if (!js_ValueToStringId(cx, STRING_TO_JSVAL(str), &id))
        return JSVAL_TO_BOOLEAN(JSVAL_VOID);
    if (!js_HasOwnProperty(cx, obj->map->ops->lookupProperty, obj, id, &v))
        return JSVAL_TO_BOOLEAN(JSVAL_VOID);
    JS_ASSERT(JSVAL_IS_BOOLEAN(v));
    return JSVAL_TO_BOOLEAN(v);
}
#endif

/* Proposed ECMA 15.2.4.6. */
static JSBool
obj_isPrototypeOf(JSContext *cx, uintN argc, jsval *vp)
{
    JSBool b;

    if (!js_IsDelegate(cx, JS_THIS_OBJECT(cx, vp),
                       argc != 0 ? vp[2] : JSVAL_VOID, &b)) {
        return JS_FALSE;
    }
    *vp = BOOLEAN_TO_JSVAL(b);
    return JS_TRUE;
}

/* Proposed ECMA 15.2.4.7. */
static JSBool
obj_propertyIsEnumerable(JSContext *cx, uintN argc, jsval *vp)
{
    jsid id;
    JSObject *obj;

    if (!JS_ValueToId(cx, argc != 0 ? vp[2] : JSVAL_VOID, &id))
        return JS_FALSE;

    obj = JS_THIS_OBJECT(cx, vp);
    return obj && js_PropertyIsEnumerable(cx, obj, id, vp);
}

#ifdef JS_TRACER
static int32 FASTCALL
Object_p_propertyIsEnumerable(JSContext* cx, JSObject* obj, JSString *str)
{
    jsid id = ATOM_TO_JSID(STRING_TO_JSVAL(str));
    jsval v;
    if (!js_PropertyIsEnumerable(cx, obj, id, &v))
        return JSVAL_TO_BOOLEAN(JSVAL_VOID);
    JS_ASSERT(JSVAL_IS_BOOLEAN(v));
    return JSVAL_TO_BOOLEAN(v);
}
#endif

JSBool
js_PropertyIsEnumerable(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    JSObject *pobj;
    uintN attrs;
    JSProperty *prop;
    JSBool ok;

    if (!OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop))
        return JS_FALSE;

    if (!prop) {
        *vp = JSVAL_FALSE;
        return JS_TRUE;
    }

    /*
     * XXX ECMA spec error compatible: return false unless hasOwnProperty.
     * The ECMA spec really should be fixed so propertyIsEnumerable and the
     * for..in loop agree on whether prototype properties are enumerable,
     * obviously by fixing this method (not by breaking the for..in loop!).
     *
     * We check here for shared permanent prototype properties, which should
     * be treated as if they are local to obj.  They are an implementation
     * technique used to satisfy ECMA requirements; users should not be able
     * to distinguish a shared permanent proto-property from a local one.
     */
    if (pobj != obj &&
        !(OBJ_IS_NATIVE(pobj) &&
          SPROP_IS_SHARED_PERMANENT((JSScopeProperty *)prop))) {
        OBJ_DROP_PROPERTY(cx, pobj, prop);
        *vp = JSVAL_FALSE;
        return JS_TRUE;
    }

    ok = OBJ_GET_ATTRIBUTES(cx, pobj, id, prop, &attrs);
    OBJ_DROP_PROPERTY(cx, pobj, prop);
    if (ok)
        *vp = BOOLEAN_TO_JSVAL((attrs & JSPROP_ENUMERATE) != 0);
    return ok;
}

#if JS_HAS_GETTER_SETTER
static JSBool
obj_defineGetter(JSContext *cx, uintN argc, jsval *vp)
{
    jsval fval, junk;
    jsid id;
    JSObject *obj;
    uintN attrs;

    if (argc <= 1 || JS_TypeOfValue(cx, vp[3]) != JSTYPE_FUNCTION) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BAD_GETTER_OR_SETTER,
                             js_getter_str);
        return JS_FALSE;
    }
    fval = vp[3];

    if (!JS_ValueToId(cx, vp[2], &id))
        return JS_FALSE;
    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !js_CheckRedeclaration(cx, obj, id, JSPROP_GETTER, NULL, NULL))
        return JS_FALSE;
    /*
     * Getters and setters are just like watchpoints from an access
     * control point of view.
     */
    if (!OBJ_CHECK_ACCESS(cx, obj, id, JSACC_WATCH, &junk, &attrs))
        return JS_FALSE;
    *vp = JSVAL_VOID;
    return OBJ_DEFINE_PROPERTY(cx, obj, id, JSVAL_VOID,
                               (JSPropertyOp) JSVAL_TO_OBJECT(fval),
                               JS_PropertyStub,
                               JSPROP_ENUMERATE | JSPROP_GETTER | JSPROP_SHARED,
                               NULL);
}

static JSBool
obj_defineSetter(JSContext *cx, uintN argc, jsval *vp)
{
    jsval fval, junk;
    jsid id;
    JSObject *obj;
    uintN attrs;

    if (argc <= 1 || JS_TypeOfValue(cx, vp[3]) != JSTYPE_FUNCTION) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_BAD_GETTER_OR_SETTER,
                             js_setter_str);
        return JS_FALSE;
    }
    fval = vp[3];

    if (!JS_ValueToId(cx, vp[2], &id))
        return JS_FALSE;
    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !js_CheckRedeclaration(cx, obj, id, JSPROP_SETTER, NULL, NULL))
        return JS_FALSE;
    /*
     * Getters and setters are just like watchpoints from an access
     * control point of view.
     */
    if (!OBJ_CHECK_ACCESS(cx, obj, id, JSACC_WATCH, &junk, &attrs))
        return JS_FALSE;
    *vp = JSVAL_VOID;
    return OBJ_DEFINE_PROPERTY(cx, obj, id, JSVAL_VOID,
                               JS_PropertyStub,
                               (JSPropertyOp) JSVAL_TO_OBJECT(fval),
                               JSPROP_ENUMERATE | JSPROP_SETTER | JSPROP_SHARED,
                               NULL);
}

static JSBool
obj_lookupGetter(JSContext *cx, uintN argc, jsval *vp)
{
    jsid id;
    JSObject *obj, *pobj;
    JSProperty *prop;
    JSScopeProperty *sprop;

    if (!JS_ValueToId(cx, argc != 0 ? vp[2] : JSVAL_VOID, &id))
        return JS_FALSE;
    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop))
        return JS_FALSE;
    *vp = JSVAL_VOID;
    if (prop) {
        if (OBJ_IS_NATIVE(pobj)) {
            sprop = (JSScopeProperty *) prop;
            if (sprop->attrs & JSPROP_GETTER)
                *vp = OBJECT_TO_JSVAL(sprop->getter);
        }
        OBJ_DROP_PROPERTY(cx, pobj, prop);
    }
    return JS_TRUE;
}

static JSBool
obj_lookupSetter(JSContext *cx, uintN argc, jsval *vp)
{
    jsid id;
    JSObject *obj, *pobj;
    JSProperty *prop;
    JSScopeProperty *sprop;

    if (!JS_ValueToId(cx, argc != 0 ? vp[2] : JSVAL_VOID, &id))
        return JS_FALSE;
    obj = JS_THIS_OBJECT(cx, vp);
    if (!obj || !OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop))
        return JS_FALSE;
    *vp = JSVAL_VOID;
    if (prop) {
        if (OBJ_IS_NATIVE(pobj)) {
            sprop = (JSScopeProperty *) prop;
            if (sprop->attrs & JSPROP_SETTER)
                *vp = OBJECT_TO_JSVAL(sprop->setter);
        }
        OBJ_DROP_PROPERTY(cx, pobj, prop);
    }
    return JS_TRUE;
}
#endif /* JS_HAS_GETTER_SETTER */

JSBool
obj_getPrototypeOf(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;
    uintN attrs;

    if (argc == 0) {
        js_ReportMissingArg(cx, vp, 0);
        return JS_FALSE;
    }

    obj = js_ValueToNonNullObject(cx, vp[2]);
    if (!obj)
        return JS_FALSE;
    vp[2] = OBJECT_TO_JSVAL(obj);

    return OBJ_CHECK_ACCESS(cx, obj,
                            ATOM_TO_JSID(cx->runtime->atomState.protoAtom),
                            JSACC_PROTO, vp, &attrs);
}

#if JS_HAS_OBJ_WATCHPOINT
const char js_watch_str[] = "watch";
const char js_unwatch_str[] = "unwatch";
#endif
const char js_hasOwnProperty_str[] = "hasOwnProperty";
const char js_isPrototypeOf_str[] = "isPrototypeOf";
const char js_propertyIsEnumerable_str[] = "propertyIsEnumerable";
#if JS_HAS_GETTER_SETTER
const char js_defineGetter_str[] = "__defineGetter__";
const char js_defineSetter_str[] = "__defineSetter__";
const char js_lookupGetter_str[] = "__lookupGetter__";
const char js_lookupSetter_str[] = "__lookupSetter__";
#endif

JS_DEFINE_TRCINFO_1(obj_hasOwnProperty,
    (3, (static, BOOL_FAIL, Object_p_hasOwnProperty, CONTEXT, THIS, STRING,       0, 0)))
JS_DEFINE_TRCINFO_1(obj_propertyIsEnumerable,
    (3, (static, BOOL_FAIL, Object_p_propertyIsEnumerable, CONTEXT, THIS, STRING, 0, 0)))

static JSFunctionSpec object_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN(js_toSource_str,             obj_toSource,                0,0),
#endif
    JS_FN(js_toString_str,             obj_toString,                0,0),
    JS_FN(js_toLocaleString_str,       obj_toLocaleString,          0,0),
    JS_FN(js_valueOf_str,              obj_valueOf,                 0,0),
#if JS_HAS_OBJ_WATCHPOINT
    JS_FN(js_watch_str,                obj_watch,                   2,0),
    JS_FN(js_unwatch_str,              obj_unwatch,                 1,0),
#endif
    JS_TN(js_hasOwnProperty_str,       obj_hasOwnProperty,          1,0,
          obj_hasOwnProperty_trcinfo),
    JS_FN(js_isPrototypeOf_str,        obj_isPrototypeOf,           1,0),
    JS_TN(js_propertyIsEnumerable_str, obj_propertyIsEnumerable,    1,0,
          obj_propertyIsEnumerable_trcinfo),
#if JS_HAS_GETTER_SETTER
    JS_FN(js_defineGetter_str,         obj_defineGetter,            2,0),
    JS_FN(js_defineSetter_str,         obj_defineSetter,            2,0),
    JS_FN(js_lookupGetter_str,         obj_lookupGetter,            1,0),
    JS_FN(js_lookupSetter_str,         obj_lookupSetter,            1,0),
#endif
    JS_FS_END
};

static JSFunctionSpec object_static_methods[] = {
    JS_FN("getPrototypeOf",            obj_getPrototypeOf,          1,0),
    JS_FS_END
};

JSBool
js_Object(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    if (argc == 0) {
        /* Trigger logic below to construct a blank object. */
        obj = NULL;
    } else {
        /* If argv[0] is null or undefined, obj comes back null. */
        if (!js_ValueToObject(cx, argv[0], &obj))
            return JS_FALSE;
    }
    if (!obj) {
        JS_ASSERT(!argc || JSVAL_IS_NULL(argv[0]) || JSVAL_IS_VOID(argv[0]));
        if (cx->fp->flags & JSFRAME_CONSTRUCTING)
            return JS_TRUE;
        obj = js_NewObject(cx, &js_ObjectClass, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;
    }
    *rval = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

/*
 * ObjectOps and Class for with-statement stack objects.
 */
static JSBool
with_LookupProperty(JSContext *cx, JSObject *obj, jsid id, JSObject **objp,
                    JSProperty **propp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_LookupProperty(cx, obj, id, objp, propp);
    return OBJ_LOOKUP_PROPERTY(cx, proto, id, objp, propp);
}

static JSBool
with_GetProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_GetProperty(cx, obj, id, vp);
    return OBJ_GET_PROPERTY(cx, proto, id, vp);
}

static JSBool
with_SetProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_SetProperty(cx, obj, id, vp);
    return OBJ_SET_PROPERTY(cx, proto, id, vp);
}

static JSBool
with_GetAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                   uintN *attrsp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_GetAttributes(cx, obj, id, prop, attrsp);
    return OBJ_GET_ATTRIBUTES(cx, proto, id, prop, attrsp);
}

static JSBool
with_SetAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                   uintN *attrsp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_SetAttributes(cx, obj, id, prop, attrsp);
    return OBJ_SET_ATTRIBUTES(cx, proto, id, prop, attrsp);
}

static JSBool
with_DeleteProperty(JSContext *cx, JSObject *obj, jsid id, jsval *rval)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_DeleteProperty(cx, obj, id, rval);
    return OBJ_DELETE_PROPERTY(cx, proto, id, rval);
}

static JSBool
with_DefaultValue(JSContext *cx, JSObject *obj, JSType hint, jsval *vp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_DefaultValue(cx, obj, hint, vp);
    return OBJ_DEFAULT_VALUE(cx, proto, hint, vp);
}

static JSBool
with_Enumerate(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
               jsval *statep, jsid *idp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_Enumerate(cx, obj, enum_op, statep, idp);
    return OBJ_ENUMERATE(cx, proto, enum_op, statep, idp);
}

static JSBool
with_CheckAccess(JSContext *cx, JSObject *obj, jsid id, JSAccessMode mode,
                 jsval *vp, uintN *attrsp)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return js_CheckAccess(cx, obj, id, mode, vp, attrsp);
    return OBJ_CHECK_ACCESS(cx, proto, id, mode, vp, attrsp);
}

static JSObject *
with_ThisObject(JSContext *cx, JSObject *obj)
{
    JSObject *proto = OBJ_GET_PROTO(cx, obj);
    if (!proto)
        return obj;
    return OBJ_THIS_OBJECT(cx, proto);
}

JS_FRIEND_DATA(JSObjectOps) js_WithObjectOps = {
    js_NewObjectMap,        js_DestroyObjectMap,
    with_LookupProperty,    js_DefineProperty,
    with_GetProperty,       with_SetProperty,
    with_GetAttributes,     with_SetAttributes,
    with_DeleteProperty,    with_DefaultValue,
    with_Enumerate,         with_CheckAccess,
    with_ThisObject,        NATIVE_DROP_PROPERTY,
    NULL,                   NULL,
    NULL,                   NULL,
    js_SetProtoOrParent,    js_SetProtoOrParent,
    js_TraceObject,         js_Clear,
    NULL,                   NULL
};

static JSObjectOps *
with_getObjectOps(JSContext *cx, JSClass *clasp)
{
    return &js_WithObjectOps;
}

JSClass js_WithClass = {
    "With",
    JSCLASS_HAS_PRIVATE | JSCLASS_HAS_RESERVED_SLOTS(1) | JSCLASS_IS_ANONYMOUS,
    JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,  JS_PropertyStub,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,   JS_FinalizeStub,
    with_getObjectOps,
    0,0,0,0,0,0,0
};

JSObject *
js_NewWithObject(JSContext *cx, JSObject *proto, JSObject *parent, jsint depth)
{
    JSObject *obj;

    obj = js_NewObject(cx, &js_WithClass, proto, parent, 0);
    if (!obj)
        return NULL;
    STOBJ_SET_SLOT(obj, JSSLOT_PRIVATE, PRIVATE_TO_JSVAL(cx->fp));
    OBJ_SET_BLOCK_DEPTH(cx, obj, depth);
    return obj;
}

JSObject *
js_NewBlockObject(JSContext *cx)
{
    JSObject *obj;
    JSBool ok;

    /*
     * Null obj's proto slot so that Object.prototype.* does not pollute block
     * scopes.  Make sure obj has its own scope too, since clearing proto does
     * not affect OBJ_SCOPE(obj).
     */
    obj = js_NewObject(cx, &js_BlockClass, NULL, NULL, 0);
    if (!obj)
        return NULL;
    JS_LOCK_OBJ(cx, obj);
    ok = js_GetMutableScope(cx, obj) != NULL;
    JS_UNLOCK_OBJ(cx, obj);
    if (!ok)
        return NULL;
    OBJ_CLEAR_PROTO(cx, obj);
    return obj;
}

JSObject *
js_CloneBlockObject(JSContext *cx, JSObject *proto, JSObject *parent,
                    JSStackFrame *fp)
{
    JSObject *clone;

    JS_ASSERT(STOBJ_GET_CLASS(proto) == &js_BlockClass);
    JS_ASSERT(!OBJ_IS_CLONED_BLOCK(proto));
    clone = js_NewObject(cx, &js_BlockClass, proto, parent, 0);
    if (!clone)
        return NULL;
    STOBJ_SET_SLOT(clone, JSSLOT_PRIVATE, PRIVATE_TO_JSVAL(fp));
    STOBJ_SET_SLOT(clone, JSSLOT_BLOCK_DEPTH,
                   OBJ_GET_SLOT(cx, proto, JSSLOT_BLOCK_DEPTH));
    JS_ASSERT(OBJ_IS_CLONED_BLOCK(clone));
    return clone;
}

JSBool
js_PutBlockObject(JSContext *cx, JSBool normalUnwind)
{
    JSStackFrame *fp;
    JSObject *obj;
    uintN depth, count;

    /* Blocks have one fixed slot available for the first local.*/
    JS_STATIC_ASSERT(JS_INITIAL_NSLOTS == JSSLOT_BLOCK_DEPTH + 2);

    fp = cx->fp;
    obj = fp->scopeChain;
    JS_ASSERT(OBJ_GET_CLASS(cx, obj) == &js_BlockClass);
    JS_ASSERT(OBJ_GET_PRIVATE(cx, obj) == cx->fp);
    JS_ASSERT(OBJ_IS_CLONED_BLOCK(obj));

    /*
     * Block objects should never be exposed to scripts. Thus the clone should
     * not own the property map and rather always share it with the prototype
     * object. This allows to skip updating OBJ_SCOPE(obj)->map.freeslot after
     * we copy the stack slots into reserved slots.
     */
    JS_ASSERT(OBJ_SCOPE(obj)->object != obj);

    /* Block objects should not have reserved slots before they are put. */
    JS_ASSERT(STOBJ_NSLOTS(obj) == JS_INITIAL_NSLOTS);

    /* The block and its locals must be on the current stack for GC safety. */
    depth = OBJ_BLOCK_DEPTH(cx, obj);
    count = OBJ_BLOCK_COUNT(cx, obj);
    JS_ASSERT(depth <= (size_t) (fp->regs->sp - StackBase(fp)));
    JS_ASSERT(count <= (size_t) (fp->regs->sp - StackBase(fp) - depth));

    /* See comments in CheckDestructuring from jsparse.c. */
    JS_ASSERT(count >= 1);

    depth += fp->script->nfixed;
    obj->fslots[JSSLOT_BLOCK_DEPTH + 1] = fp->slots[depth];
    if (normalUnwind && count > 1) {
        --count;
        JS_LOCK_OBJ(cx, obj);
        if (!js_ReallocSlots(cx, obj, JS_INITIAL_NSLOTS + count, JS_TRUE))
            normalUnwind = JS_FALSE;
        else
            memcpy(obj->dslots, fp->slots + depth + 1, count * sizeof(jsval));
        JS_UNLOCK_OBJ(cx, obj);
    }

    /* We must clear the private slot even with errors. */
    JS_SetPrivate(cx, obj, NULL);
    fp->scopeChain = OBJ_GET_PARENT(cx, obj);
    return normalUnwind;
}

static JSBool
block_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    uintN index;
    JSStackFrame *fp;

    JS_ASSERT(JS_InstanceOf(cx, obj, &js_BlockClass, NULL));
    JS_ASSERT(OBJ_IS_CLONED_BLOCK(obj));
    if (!JSVAL_IS_INT(id))
        return JS_TRUE;

    index = (uint16) JSVAL_TO_INT(id);
    fp = (JSStackFrame *) JS_GetPrivate(cx, obj);
    if (fp) {
        index += fp->script->nfixed + OBJ_BLOCK_DEPTH(cx, obj);
        JS_ASSERT(index < fp->script->nslots);
        *vp = fp->slots[index];
        return JS_TRUE;
    }

    /* Reserve slots start with the first slot after the private. */
    index += JSSLOT_BLOCK_DEPTH - JSSLOT_PRIVATE;
    return JS_GetReservedSlot(cx, obj, index, vp);
}

static JSBool
block_setProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    uintN index;
    JSStackFrame *fp;

    JS_ASSERT(JS_InstanceOf(cx, obj, &js_BlockClass, NULL));
    if (!JSVAL_IS_INT(id))
        return JS_TRUE;

    index = (uint16) JSVAL_TO_INT(id);
    fp = (JSStackFrame *) JS_GetPrivate(cx, obj);
    if (fp) {
        index += fp->script->nfixed + OBJ_BLOCK_DEPTH(cx, obj);
        JS_ASSERT(index < fp->script->nslots);
        fp->slots[index] = *vp;
        return JS_TRUE;
    }

    /* Reserve slots start with the first slot after the private. */
    index += JSSLOT_BLOCK_DEPTH - JSSLOT_PRIVATE;
    return JS_SetReservedSlot(cx, obj, index, *vp);
}

#if JS_HAS_XDR

#define NO_PARENT_INDEX ((uint32)-1)

uint32
FindObjectIndex(JSObjectArray *array, JSObject *obj)
{
    size_t i;

    if (array) {
        i = array->length;
        do {

            if (array->vector[--i] == obj)
                return i;
        } while (i != 0);
    }

    return NO_PARENT_INDEX;
}

static JSBool
block_xdrObject(JSXDRState *xdr, JSObject **objp)
{
    JSContext *cx;
    uint32 parentId;
    JSObject *obj, *parent;
    uint16 depth, count, i;
    uint32 tmp;
    JSTempValueRooter tvr;
    JSScopeProperty *sprop;
    jsid propid;
    JSAtom *atom;
    int16 shortid;
    JSBool ok;

    cx = xdr->cx;
#ifdef __GNUC__
    obj = NULL;         /* quell GCC overwarning */
#endif

    if (xdr->mode == JSXDR_ENCODE) {
        obj = *objp;
        parent = OBJ_GET_PARENT(cx, obj);
        parentId = (xdr->script->objectsOffset == 0)
                   ? NO_PARENT_INDEX
                   : FindObjectIndex(JS_SCRIPT_OBJECTS(xdr->script), parent);
        depth = (uint16)OBJ_BLOCK_DEPTH(cx, obj);
        count = (uint16)OBJ_BLOCK_COUNT(cx, obj);
        tmp = (uint32)(depth << 16) | count;
    }
#ifdef __GNUC__ /* suppress bogus gcc warnings */
    else count = 0;
#endif

    /* First, XDR the parent atomid. */
    if (!JS_XDRUint32(xdr, &parentId))
        return JS_FALSE;

    if (xdr->mode == JSXDR_DECODE) {
        obj = js_NewBlockObject(cx);
        if (!obj)
            return JS_FALSE;
        *objp = obj;

        /*
         * If there's a parent id, then get the parent out of our script's
         * object array. We know that we XDR block object in outer-to-inner
         * order, which means that getting the parent now will work.
         */
        if (parentId == NO_PARENT_INDEX)
            parent = NULL;
        else
            JS_GET_SCRIPT_OBJECT(xdr->script, parentId, parent);
        STOBJ_SET_PARENT(obj, parent);
    }

    JS_PUSH_SINGLE_TEMP_ROOT(cx, OBJECT_TO_JSVAL(obj), &tvr);

    if (!JS_XDRUint32(xdr, &tmp)) {
        JS_POP_TEMP_ROOT(cx, &tvr);
        return JS_FALSE;
    }

    if (xdr->mode == JSXDR_DECODE) {
        depth = (uint16)(tmp >> 16);
        count = (uint16)tmp;
        STOBJ_SET_SLOT(obj, JSSLOT_BLOCK_DEPTH, INT_TO_JSVAL(depth));
    }

    /*
     * XDR the block object's properties. We know that there are 'count'
     * properties to XDR, stored as id/shortid pairs. We do not XDR any
     * non-native properties, only those that the compiler created.
     */
    sprop = NULL;
    ok = JS_TRUE;
    for (i = 0; i < count; i++) {
        if (xdr->mode == JSXDR_ENCODE) {
            /* Find a property to XDR. */
            do {
                /* If sprop is NULL, this is the first property. */
                sprop = sprop ? sprop->parent : OBJ_SCOPE(obj)->lastProp;
            } while (!(sprop->flags & SPROP_HAS_SHORTID));

            JS_ASSERT(sprop->getter == js_BlockClass.getProperty);
            propid = sprop->id;
            JS_ASSERT(JSID_IS_ATOM(propid));
            atom = JSID_TO_ATOM(propid);
            shortid = sprop->shortid;
            JS_ASSERT(shortid >= 0);
        }

        /* XDR the real id, then the shortid. */
        if (!js_XDRStringAtom(xdr, &atom) ||
            !JS_XDRUint16(xdr, (uint16 *)&shortid)) {
            ok = JS_FALSE;
            break;
        }

        if (xdr->mode == JSXDR_DECODE) {
            if (!js_DefineNativeProperty(cx, obj, ATOM_TO_JSID(atom),
                                         JSVAL_VOID, NULL, NULL,
                                         JSPROP_ENUMERATE | JSPROP_PERMANENT,
                                         SPROP_HAS_SHORTID, shortid, NULL)) {
                ok = JS_FALSE;
                break;
            }
        }
    }

    JS_POP_TEMP_ROOT(cx, &tvr);
    return ok;
}

#else
# define block_xdrObject NULL
#endif

static uint32
block_reserveSlots(JSContext *cx, JSObject *obj)
{
    return OBJ_IS_CLONED_BLOCK(obj) ? OBJ_BLOCK_COUNT(cx, obj) : 0;
}

JSClass js_BlockClass = {
    "Block",
    JSCLASS_HAS_PRIVATE | JSCLASS_HAS_RESERVED_SLOTS(1) |
    JSCLASS_IS_ANONYMOUS | JSCLASS_HAS_CACHED_PROTO(JSProto_Block),
    JS_PropertyStub,  JS_PropertyStub,  block_getProperty, block_setProperty,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,    JS_FinalizeStub,
    NULL, NULL, NULL, NULL, block_xdrObject, NULL, NULL, block_reserveSlots
};

JSObject*
js_InitBlockClass(JSContext *cx, JSObject* obj)
{
    JSObject *proto;

    proto = JS_InitClass(cx, obj, NULL, &js_BlockClass, NULL, 0, NULL,
                         NULL, NULL, NULL);
    if (!proto)
        return NULL;

    OBJ_CLEAR_PROTO(cx, proto);
    return proto;
}

JSObject *
js_InitEval(JSContext *cx, JSObject *obj)
{
    /* ECMA (15.1.2.1) says 'eval' is a property of the global object. */
    if (!js_DefineFunction(cx, obj, cx->runtime->atomState.evalAtom,
                           obj_eval, 1, 0)) {
        return NULL;
    }

    return obj;
}

JSObject *
js_InitObjectClass(JSContext *cx, JSObject *obj)
{
    return JS_InitClass(cx, obj, NULL, &js_ObjectClass, js_Object, 1,
                        object_props, object_methods, NULL,
                        object_static_methods);
}

void
js_InitObjectMap(JSObjectMap *map, jsrefcount nrefs, JSObjectOps *ops,
                 JSClass *clasp)
{
    map->nrefs = nrefs;
    map->ops = ops;
    map->freeslot = JSSLOT_FREE(clasp);
}

JSObjectMap *
js_NewObjectMap(JSContext *cx, jsrefcount nrefs, JSObjectOps *ops,
                JSClass *clasp, JSObject *obj)
{
    return (JSObjectMap *) js_NewScope(cx, nrefs, ops, clasp, obj);
}

void
js_DestroyObjectMap(JSContext *cx, JSObjectMap *map)
{
    js_DestroyScope(cx, (JSScope *)map);
}

JSObjectMap *
js_HoldObjectMap(JSContext *cx, JSObjectMap *map)
{
    JS_ASSERT(map->nrefs >= 0);
    JS_ATOMIC_INCREMENT(&map->nrefs);
    return map;
}

JSObjectMap *
js_DropObjectMap(JSContext *cx, JSObjectMap *map, JSObject *obj)
{
    JS_ASSERT(map->nrefs > 0);
    JS_ATOMIC_DECREMENT(&map->nrefs);
    if (map->nrefs == 0) {
        map->ops->destroyObjectMap(cx, map);
        return NULL;
    }
    if (MAP_IS_NATIVE(map) && ((JSScope *)map)->object == obj)
        ((JSScope *)map)->object = NULL;
    return map;
}

static void
FreeSlots(JSContext *cx, JSObject *obj)
{
    if (obj->dslots) {
        JS_ASSERT((uint32)obj->dslots[-1] > JS_INITIAL_NSLOTS);
        JS_free(cx, obj->dslots - 1);
        obj->dslots = NULL;
    }
}

#define SLOTS_TO_DYNAMIC_WORDS(nslots)                                        \
  (JS_ASSERT((nslots) > JS_INITIAL_NSLOTS), (nslots) + 1 - JS_INITIAL_NSLOTS)

#define DYNAMIC_WORDS_TO_SLOTS(words)                                         \
  (JS_ASSERT((words) > 1), (words) - 1 + JS_INITIAL_NSLOTS)

JSBool
js_ReallocSlots(JSContext *cx, JSObject *obj, uint32 nslots,
                JSBool exactAllocation)
{
    jsval *old, *slots;
    uint32 oslots, nwords, owords, log, i;

    /*
     * Minimal number of dynamic slots to allocate.
     */
#define MIN_DYNAMIC_WORDS 4

    /*
     * The limit to switch to linear allocation strategy from the power of 2
     * growth no to waste too much memory.
     */
#define LINEAR_GROWTH_STEP JS_BIT(16)

    old = obj->dslots;
    if (nslots <= JS_INITIAL_NSLOTS) {
        if (old &&
            (exactAllocation ||
             SLOTS_TO_DYNAMIC_WORDS((uint32)old[-1]) != MIN_DYNAMIC_WORDS ||
             nslots <= (JS_INITIAL_NSLOTS +
                        JSSLOT_FREE(STOBJ_GET_CLASS(obj))) / 2)) {
            /*
             * We do not want to free dynamic slots when allocation is a hint,
             * we reached minimal allocation and almost all fixed slots are
             * used. It avoids allocating dynamic slots again when properties
             * are added to the object.
             *
             * If there were no private or reserved slots, the condition to
             * free the slots would be
             *
             *   nslots <= JS_INITIAL_NSLOTS / 2
             *
             * but to account for never removed slots before JSSLOT_FREE(class)
             * we need to subtract it from the slot counts which gives
             *
             *   nslots - JSSLOT_FREE <= (JS_INITIAL_NSLOTS - JSSLOT_FREE) / 2
             *
             * or
             *
             *   nslots <= (JS_INITIAL_NSLOTS + JSSLOT_FREE) / 2
             */
            FreeSlots(cx, obj);
        }
        return JS_TRUE;
    }

    oslots = (old) ? (uint32)*--old : JS_INITIAL_NSLOTS;
    nwords = SLOTS_TO_DYNAMIC_WORDS(nslots);

    if (nslots > oslots) {
        if (!exactAllocation) {
            /*
             * Round up nslots so the number of bytes in dslots array is power
             * of 2 to ensure exponential grouth.
             */
            if (nwords <= MIN_DYNAMIC_WORDS) {
                nwords = MIN_DYNAMIC_WORDS;
            } else if (nwords < LINEAR_GROWTH_STEP) {
                JS_CEILING_LOG2(log, nwords);
                nwords = JS_BIT(log);
            } else {
                nwords = JS_ROUNDUP(nwords, LINEAR_GROWTH_STEP);
            }
        }
        slots = (jsval *)JS_realloc(cx, old, nwords * sizeof(jsval));
        if (!slots)
            return JS_FALSE;
    } else {
        JS_ASSERT(nslots < oslots);
        if (!exactAllocation) {
            owords = DYNAMIC_WORDS_TO_SLOTS(oslots);
            if (owords <= MIN_DYNAMIC_WORDS)
                return JS_TRUE;
            if (owords < LINEAR_GROWTH_STEP * 2) {
                /*
                 * Shrink only if 1/4 of slots are left and we need to grow
                 * the array at least twice to reach the current capacity. It
                 * prevents frequent capacity growth/shrinking when slots are
                 * often removed and added.
                 */
                if (nwords > owords / 4)
                    return JS_TRUE;
                JS_CEILING_LOG2(log, nwords);
                nwords = JS_BIT(log);
                if (nwords < MIN_DYNAMIC_WORDS)
                    nwords = MIN_DYNAMIC_WORDS;
            } else {
                /*
                 * Shrink only if we free at least 2 linear allocation
                 * segments, to prevent growth/shrinking resonance.
                 */
                if (nwords > owords - LINEAR_GROWTH_STEP * 2)
                    return JS_TRUE;
                nwords = JS_ROUNDUP(nwords, LINEAR_GROWTH_STEP);
            }
        }

        /* We avoid JS_realloc not to report a failed shrink attempt. */
        slots = (jsval *)realloc(old, nwords * sizeof(jsval));
        if (!slots)
            slots = old;
    }

    nslots = DYNAMIC_WORDS_TO_SLOTS(nwords);
    *slots++ = (jsval)nslots;
    obj->dslots = slots;

    /* If we're extending an allocation, initialize free slots. */
    for (i = oslots; i < nslots; i++)
        slots[i - JS_INITIAL_NSLOTS] = JSVAL_VOID;

    return JS_TRUE;

#undef LINEAR_GROWTH_STEP
#undef MIN_DYNAMIC_WORDS
}

extern JSBool
js_GetClassId(JSContext *cx, JSClass *clasp, jsid *idp)
{
    JSProtoKey key;
    JSAtom *atom;

    key = JSCLASS_CACHED_PROTO_KEY(clasp);
    if (key != JSProto_Null) {
        *idp = INT_TO_JSID(key);
    } else if (clasp->flags & JSCLASS_IS_ANONYMOUS) {
        *idp = INT_TO_JSID(JSProto_Object);
    } else {
        atom = js_Atomize(cx, clasp->name, strlen(clasp->name), 0);
        if (!atom)
            return JS_FALSE;
        *idp = ATOM_TO_JSID(atom);
    }
    return JS_TRUE;
}

JSObject *
js_NewObject(JSContext *cx, JSClass *clasp, JSObject *proto, JSObject *parent,
             uintN objectSize)
{
    jsid id;

    /* Bootstrap the ur-object, and make it the default prototype object. */
    if (!proto) {
        if (!js_GetClassId(cx, clasp, &id))
            return NULL;
        if (!js_GetClassPrototype(cx, parent, id, &proto))
            return NULL;
        if (!proto &&
            !js_GetClassPrototype(cx, parent, INT_TO_JSID(JSProto_Object),
                                  &proto)) {
            return NULL;
        }
    }

    return js_NewObjectWithGivenProto(cx, clasp, proto, parent, objectSize);
}

JSObject *
js_NewObjectWithGivenProto(JSContext *cx, JSClass *clasp, JSObject *proto,
                           JSObject *parent, uintN objectSize)
{
    JSObject *obj;
    JSObjectOps *ops;
    JSObjectMap *map;
    JSClass *protoclasp;
    uint32 nslots, i;
    JSTempValueRooter tvr;

#ifdef INCLUDE_MOZILLA_DTRACE
    if (JAVASCRIPT_OBJECT_CREATE_START_ENABLED())
        jsdtrace_object_create_start(cx->fp, clasp);
#endif

    /* Currently only functions can have non-standard allocation size. */
    if (clasp == &js_FunctionClass) {
        if (objectSize == 0)
            objectSize = sizeof(JSFunction);
        else
            JS_ASSERT(objectSize == sizeof(JSObject));
    } else {
        JS_ASSERT(objectSize == 0);
        objectSize = sizeof(JSObject);
    }

    /*
     * Allocate an object from the GC heap and initialize all its fields before
     * doing any operation that can potentially trigger GC.
     */
    obj = (JSObject *) js_NewGCThing(cx, GCX_OBJECT, objectSize);
    if (!obj)
        goto earlybad;

    obj->map = NULL;
    obj->dslots = NULL;

    /*
     * Set the class slot with the initial value of the system and delegate
     * flags set to false.
     */
    JS_ASSERT(((jsuword) clasp & 3) == 0);
    obj->classword = jsuword(clasp);
    JS_ASSERT(!STOBJ_IS_DELEGATE(obj));
    JS_ASSERT(!STOBJ_IS_SYSTEM(obj));

    /* Set the proto and parent properties. */
    STOBJ_SET_PROTO(obj, proto);
    STOBJ_SET_PARENT(obj, parent);

    /* Initialize the remaining fixed slots. */
    for (i = JSSLOT_PRIVATE; i != JS_INITIAL_NSLOTS; ++i)
        obj->fslots[i] = JSVAL_VOID;

#ifdef DEBUG
    memset((uint8 *) obj + sizeof(JSObject), JS_FREE_PATTERN,
           objectSize - sizeof(JSObject));
#endif

    /*
     * Root obj to prevent it from being collected out from under this call to
     * js_NewObject. There's a possibilty of GC under the objectHook call-out
     * further below.
     */
    JS_PUSH_TEMP_ROOT_OBJECT(cx, obj, &tvr);

    /* Always call the class's getObjectOps hook if it has one. */
    ops = clasp->getObjectOps
          ? clasp->getObjectOps(cx, clasp)
          : &js_ObjectOps;

    /*
     * Default parent to the parent of the prototype, which was set from
     * the parent of the prototype's constructor.
     */
    if (proto && !parent)
        STOBJ_SET_PARENT(obj, OBJ_GET_PARENT(cx, proto));

    /*
     * Share proto's map only if it has the same JSObjectOps, and only if
     * proto's class has the same private and reserved slots as obj's map
     * and class have.  We assume that if prototype and object are of the
     * same class, they always have the same number of computed reserved
     * slots (returned via clasp->reserveSlots); otherwise, prototype and
     * object classes must have the same (null or not) reserveSlots hook.
     */
    if (proto &&
        (map = proto->map)->ops == ops &&
        ((protoclasp = OBJ_GET_CLASS(cx, proto)) == clasp ||
         (!((protoclasp->flags ^ clasp->flags) &
            (JSCLASS_HAS_PRIVATE |
             (JSCLASS_RESERVED_SLOTS_MASK << JSCLASS_RESERVED_SLOTS_SHIFT))) &&
          protoclasp->reserveSlots == clasp->reserveSlots)))
    {
        /* Share the given prototype's map. */
        obj->map = js_HoldObjectMap(cx, map);
    } else {
        map = ops->newObjectMap(cx, 1, ops, clasp, obj);
        if (!map)
            goto bad;
        obj->map = map;

        /* Let ops->newObjectMap set freeslot so as to reserve slots. */
        nslots = map->freeslot;
        JS_ASSERT(nslots >= JSSLOT_PRIVATE);
        if (nslots > JS_INITIAL_NSLOTS &&
            !js_ReallocSlots(cx, obj, nslots, JS_TRUE)) {
            js_DropObjectMap(cx, map, obj);
            obj->map = NULL;
            goto bad;
        }
    }

    if (cx->debugHooks->objectHook) {
        JS_KEEP_ATOMS(cx->runtime);
        cx->debugHooks->objectHook(cx, obj, JS_TRUE,
                                   cx->debugHooks->objectHookData);
        JS_UNKEEP_ATOMS(cx->runtime);
    }

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    cx->weakRoots.newborn[GCX_OBJECT] = obj;
#ifdef INCLUDE_MOZILLA_DTRACE
    if (JAVASCRIPT_OBJECT_CREATE_ENABLED())
        jsdtrace_object_create(cx, clasp, obj);
    if (JAVASCRIPT_OBJECT_CREATE_DONE_ENABLED())
        jsdtrace_object_create_done(cx->fp, clasp);
#endif
    return obj;

bad:
    obj = NULL;
    goto out;

earlybad:
#ifdef INCLUDE_MOZILLA_DTRACE
    if (JAVASCRIPT_OBJECT_CREATE_ENABLED())
        jsdtrace_object_create(cx, clasp, NULL);
    if (JAVASCRIPT_OBJECT_CREATE_DONE_ENABLED())
        jsdtrace_object_create_done(cx->fp, clasp);
#endif
    return NULL;
}

JS_BEGIN_EXTERN_C

static JSObject *
js_InitNullClass(JSContext *cx, JSObject *obj)
{
    JS_ASSERT(0);
    return NULL;
}

#define JS_PROTO(name,code,init) extern JSObject *init(JSContext *, JSObject *);
#include "jsproto.tbl"
#undef JS_PROTO

static JSObjectOp lazy_prototype_init[JSProto_LIMIT] = {
#define JS_PROTO(name,code,init) init,
#include "jsproto.tbl"
#undef JS_PROTO
};

JS_END_EXTERN_C

JSBool
js_GetClassObject(JSContext *cx, JSObject *obj, JSProtoKey key,
                  JSObject **objp)
{
    JSBool ok;
    JSObject *tmp, *cobj;
    JSResolvingKey rkey;
    JSResolvingEntry *rentry;
    uint32 generation;
    JSObjectOp init;
    jsval v;

    while ((tmp = OBJ_GET_PARENT(cx, obj)) != NULL)
        obj = tmp;
    if (!(OBJ_GET_CLASS(cx, obj)->flags & JSCLASS_IS_GLOBAL)) {
        *objp = NULL;
        return JS_TRUE;
    }

    ok = JS_GetReservedSlot(cx, obj, key, &v);
    if (!ok)
        return JS_FALSE;
    if (!JSVAL_IS_PRIMITIVE(v)) {
        *objp = JSVAL_TO_OBJECT(v);
        return JS_TRUE;
    }

    rkey.obj = obj;
    rkey.id = ATOM_TO_JSID(cx->runtime->atomState.classAtoms[key]);
    if (!js_StartResolving(cx, &rkey, JSRESFLAG_LOOKUP, &rentry))
        return JS_FALSE;
    if (!rentry) {
        /* Already caching key in obj -- suppress recursion. */
        *objp = NULL;
        return JS_TRUE;
    }
    generation = cx->resolvingTable->generation;

    cobj = NULL;
    init = lazy_prototype_init[key];
    if (init) {
        if (!init(cx, obj)) {
            ok = JS_FALSE;
        } else {
            ok = JS_GetReservedSlot(cx, obj, key, &v);
            if (ok && !JSVAL_IS_PRIMITIVE(v))
                cobj = JSVAL_TO_OBJECT(v);
        }
    }

    js_StopResolving(cx, &rkey, JSRESFLAG_LOOKUP, rentry, generation);
    *objp = cobj;
    return ok;
}

JSBool
js_SetClassObject(JSContext *cx, JSObject *obj, JSProtoKey key, JSObject *cobj)
{
    JS_ASSERT(!OBJ_GET_PARENT(cx, obj));
    if (!(OBJ_GET_CLASS(cx, obj)->flags & JSCLASS_IS_GLOBAL))
        return JS_TRUE;

    return JS_SetReservedSlot(cx, obj, key, OBJECT_TO_JSVAL(cobj));
}

JSBool
js_FindClassObject(JSContext *cx, JSObject *start, jsid id, jsval *vp)
{
    JSObject *obj, *cobj, *pobj;
    JSProtoKey key;
    JSProperty *prop;
    jsval v;
    JSScopeProperty *sprop;

    if (start || (cx->fp && (start = cx->fp->scopeChain) != NULL)) {
        /* Find the topmost object in the scope chain. */
        do {
            obj = start;
            start = OBJ_GET_PARENT(cx, obj);
        } while (start);
    } else {
        obj = cx->globalObject;
        if (!obj) {
            *vp = JSVAL_VOID;
            return JS_TRUE;
        }
    }

    OBJ_TO_INNER_OBJECT(cx, obj);
    if (!obj)
        return JS_FALSE;

    if (JSID_IS_INT(id)) {
        key = (JSProtoKey) JSID_TO_INT(id);
        JS_ASSERT(key != JSProto_Null);
        if (!js_GetClassObject(cx, obj, key, &cobj))
            return JS_FALSE;
        if (cobj) {
            *vp = OBJECT_TO_JSVAL(cobj);
            return JS_TRUE;
        }
        id = ATOM_TO_JSID(cx->runtime->atomState.classAtoms[key]);
    }

    JS_ASSERT(OBJ_IS_NATIVE(obj));
    if (js_LookupPropertyWithFlags(cx, obj, id, JSRESOLVE_CLASSNAME,
                                   &pobj, &prop) < 0) {
        return JS_FALSE;
    }
    v = JSVAL_VOID;
    if (prop)  {
        if (OBJ_IS_NATIVE(pobj)) {
            sprop = (JSScopeProperty *) prop;
            if (SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(pobj))) {
                v = LOCKED_OBJ_GET_SLOT(pobj, sprop->slot);
                if (JSVAL_IS_PRIMITIVE(v))
                    v = JSVAL_VOID;
            }
        }
        OBJ_DROP_PROPERTY(cx, pobj, prop);
    }
    *vp = v;
    return JS_TRUE;
}

JSObject *
js_ConstructObject(JSContext *cx, JSClass *clasp, JSObject *proto,
                   JSObject *parent, uintN argc, jsval *argv)
{
    jsid id;
    jsval cval, rval;
    JSTempValueRooter argtvr, tvr;
    JSObject *obj, *ctor;

    JS_PUSH_TEMP_ROOT(cx, argc, argv, &argtvr);

    if (!js_GetClassId(cx, clasp, &id) ||
        !js_FindClassObject(cx, parent, id, &cval)) {
        JS_POP_TEMP_ROOT(cx, &argtvr);
        return NULL;
    }

    if (JSVAL_IS_PRIMITIVE(cval)) {
        js_ReportIsNotFunction(cx, &cval, JSV2F_CONSTRUCT | JSV2F_SEARCH_STACK);
        JS_POP_TEMP_ROOT(cx, &argtvr);
        return NULL;
    }

    /*
     * Protect cval in case a crazy getter for .prototype uproots it.  After
     * this point, all control flow must exit through label out with obj set.
     */
    JS_PUSH_SINGLE_TEMP_ROOT(cx, cval, &tvr);
    MUST_FLOW_THROUGH("out");

    /*
     * If proto or parent are NULL, set them to Constructor.prototype and/or
     * Constructor.__parent__, just like JSOP_NEW does.
     */
    ctor = JSVAL_TO_OBJECT(cval);
    if (!parent)
        parent = OBJ_GET_PARENT(cx, ctor);
    if (!proto) {
        if (!OBJ_GET_PROPERTY(cx, ctor,
                              ATOM_TO_JSID(cx->runtime->atomState
                                           .classPrototypeAtom),
                              &rval)) {
            obj = NULL;
            goto out;
        }
        if (JSVAL_IS_OBJECT(rval))
            proto = JSVAL_TO_OBJECT(rval);
    }

    obj = js_NewObject(cx, clasp, proto, parent, 0);
    if (!obj)
        goto out;

    if (!js_InternalConstruct(cx, obj, cval, argc, argv, &rval))
        goto bad;

    if (JSVAL_IS_PRIMITIVE(rval))
        goto out;
    obj = JSVAL_TO_OBJECT(rval);

    /*
     * If the instance's class differs from what was requested, throw a type
     * error.  If the given class has both the JSCLASS_HAS_PRIVATE and the
     * JSCLASS_CONSTRUCT_PROTOTYPE flags, and the instance does not have its
     * private data set at this point, then the constructor was replaced and
     * we should throw a type error.
     */
    if (OBJ_GET_CLASS(cx, obj) != clasp ||
        (!(~clasp->flags & (JSCLASS_HAS_PRIVATE |
                            JSCLASS_CONSTRUCT_PROTOTYPE)) &&
         !JS_GetPrivate(cx, obj))) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_WRONG_CONSTRUCTOR, clasp->name);
        goto bad;
    }

out:
    JS_POP_TEMP_ROOT(cx, &tvr);
    JS_POP_TEMP_ROOT(cx, &argtvr);
    return obj;

bad:
    cx->weakRoots.newborn[GCX_OBJECT] = NULL;
    obj = NULL;
    goto out;
}

void
js_FinalizeObject(JSContext *cx, JSObject *obj)
{
    JSObjectMap *map;

    /* Cope with stillborn objects that have no map. */
    map = obj->map;
    if (!map)
        return;

    if (cx->debugHooks->objectHook) {
        cx->debugHooks->objectHook(cx, obj, JS_FALSE,
                                   cx->debugHooks->objectHookData);
    }

    /* Finalize obj first, in case it needs map and slots. */
    STOBJ_GET_CLASS(obj)->finalize(cx, obj);

#ifdef INCLUDE_MOZILLA_DTRACE
    if (JAVASCRIPT_OBJECT_FINALIZE_ENABLED())
        jsdtrace_object_finalize(obj);
#endif

    /* Drop map and free slots. */
    js_DropObjectMap(cx, map, obj);
    FreeSlots(cx, obj);
}

/* XXXbe if one adds props, deletes earlier props, adds more, the last added
         won't recycle the deleted props' slots. */
JSBool
js_AllocSlot(JSContext *cx, JSObject *obj, uint32 *slotp)
{
    JSObjectMap *map;
    JSClass *clasp;

    map = obj->map;
    JS_ASSERT(!MAP_IS_NATIVE(map) || ((JSScope *)map)->object == obj);
    clasp = LOCKED_OBJ_GET_CLASS(obj);
    if (map->freeslot == JSSLOT_FREE(clasp) && clasp->reserveSlots) {
        /* Adjust map->freeslot to include computed reserved slots, if any. */
        map->freeslot += clasp->reserveSlots(cx, obj);
    }

    if (map->freeslot >= STOBJ_NSLOTS(obj) &&
        !js_ReallocSlots(cx, obj, map->freeslot + 1, JS_FALSE)) {
        return JS_FALSE;
    }

    /* js_ReallocSlots or js_FreeSlot should set the free slots to void. */
    JS_ASSERT(JSVAL_IS_VOID(STOBJ_GET_SLOT(obj, map->freeslot)));
    *slotp = map->freeslot++;
    return JS_TRUE;
}

void
js_FreeSlot(JSContext *cx, JSObject *obj, uint32 slot)
{
    JSObjectMap *map;

    map = obj->map;
    JS_ASSERT(!MAP_IS_NATIVE(map) || ((JSScope *)map)->object == obj);
    LOCKED_OBJ_SET_SLOT(obj, slot, JSVAL_VOID);
    if (map->freeslot == slot + 1) {
        map->freeslot = slot;

        /* When shrinking, js_ReallocSlots always returns true. */
        js_ReallocSlots(cx, obj, slot, JS_FALSE);
    }
}

jsid
js_CheckForStringIndex(jsid id, const jschar *cp, const jschar *end,
                       JSBool negative)
{
    jsuint index = JS7_UNDEC(*cp++);
    jsuint oldIndex = 0;
    jsuint c = 0;

    if (index != 0) {
        while (JS7_ISDEC(*cp)) {
            oldIndex = index;
            c = JS7_UNDEC(*cp);
            index = 10 * index + c;
            cp++;
        }
    }
    if (cp == end &&
        (oldIndex < (JSVAL_INT_MAX / 10) ||
         (oldIndex == (JSVAL_INT_MAX / 10) &&
          c <= (JSVAL_INT_MAX % 10)))) {
        if (negative)
            index = 0 - index;
        id = INT_TO_JSID((jsint)index);
    }
    return id;
}

static JSBool
PurgeProtoChain(JSContext *cx, JSObject *obj, jsid id)
{
    JSScope *scope;
    JSScopeProperty *sprop;

    while (obj) {
        if (!OBJ_IS_NATIVE(obj)) {
            obj = OBJ_GET_PROTO(cx, obj);
            continue;
        }
        JS_LOCK_OBJ(cx, obj);
        scope = OBJ_SCOPE(obj);
        sprop = SCOPE_GET_PROPERTY(scope, id);
        if (sprop) {
            PCMETER(JS_PROPERTY_CACHE(cx).pcpurges++);
            SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);
            JS_UNLOCK_SCOPE(cx, scope);
            return JS_TRUE;
        }
        obj = LOCKED_OBJ_GET_PROTO(scope->object);
        JS_UNLOCK_SCOPE(cx, scope);
    }
    return JS_FALSE;
}

static void
PurgeScopeChain(JSContext *cx, JSObject *obj, jsid id)
{
    if (!OBJ_IS_DELEGATE(cx, obj))
        return;

    PurgeProtoChain(cx, OBJ_GET_PROTO(cx, obj), id);
    while ((obj = OBJ_GET_PARENT(cx, obj)) != NULL) {
        if (PurgeProtoChain(cx, obj, id))
            return;
    }
}

JSScopeProperty *
js_AddNativeProperty(JSContext *cx, JSObject *obj, jsid id,
                     JSPropertyOp getter, JSPropertyOp setter, uint32 slot,
                     uintN attrs, uintN flags, intN shortid)
{
    JSScope *scope;
    JSScopeProperty *sprop;

    /*
     * Purge the property cache of now-shadowed id in obj's scope chain. Do
     * this optimistically (assuming no failure below) before locking obj, so
     * we can lock the shadowed scope.
     */
    PurgeScopeChain(cx, obj, id);

    JS_LOCK_OBJ(cx, obj);
    scope = js_GetMutableScope(cx, obj);
    if (!scope) {
        sprop = NULL;
    } else {
        /* Convert string indices to integers if appropriate. */
        CHECK_FOR_STRING_INDEX(id);
        sprop = js_AddScopeProperty(cx, scope, id, getter, setter, slot, attrs,
                                    flags, shortid);
    }
    JS_UNLOCK_OBJ(cx, obj);
    return sprop;
}

JSScopeProperty *
js_ChangeNativePropertyAttrs(JSContext *cx, JSObject *obj,
                             JSScopeProperty *sprop, uintN attrs, uintN mask,
                             JSPropertyOp getter, JSPropertyOp setter)
{
    JSScope *scope;

    JS_LOCK_OBJ(cx, obj);
    scope = js_GetMutableScope(cx, obj);
    if (!scope) {
        sprop = NULL;
    } else {
        sprop = js_ChangeScopePropertyAttrs(cx, scope, sprop, attrs, mask,
                                            getter, setter);
    }
    JS_UNLOCK_OBJ(cx, obj);
    return sprop;
}

JSBool
js_DefineProperty(JSContext *cx, JSObject *obj, jsid id, jsval value,
                  JSPropertyOp getter, JSPropertyOp setter, uintN attrs,
                  JSProperty **propp)
{
    return js_DefineNativeProperty(cx, obj, id, value, getter, setter, attrs,
                                   0, 0, propp);
}

/*
 * Backward compatibility requires allowing addProperty hooks to mutate the
 * nominal initial value of a slot-full property, while GC safety wants that
 * value to be stored before the call-out through the hook.  Optimize to do
 * both while saving cycles for classes that stub their addProperty hook.
 */
#define ADD_PROPERTY_HELPER(cx,clasp,obj,scope,sprop,vp,cleanup)              \
    JS_BEGIN_MACRO                                                            \
        if ((clasp)->addProperty != JS_PropertyStub) {                        \
            jsval nominal_ = *(vp);                                           \
            if (!(clasp)->addProperty(cx, obj, SPROP_USERID(sprop), vp)) {    \
                cleanup;                                                      \
            }                                                                 \
            if (*(vp) != nominal_) {                                          \
                if (SPROP_HAS_VALID_SLOT(sprop, scope))                       \
                    LOCKED_OBJ_WRITE_BARRIER(cx, obj, (sprop)->slot, *(vp));  \
            }                                                                 \
        }                                                                     \
    JS_END_MACRO

JSBool
js_DefineNativeProperty(JSContext *cx, JSObject *obj, jsid id, jsval value,
                        JSPropertyOp getter, JSPropertyOp setter, uintN attrs,
                        uintN flags, intN shortid, JSProperty **propp)
{
    JSClass *clasp;
    JSScope *scope;
    JSScopeProperty *sprop;

    /* Convert string indices to integers if appropriate. */
    CHECK_FOR_STRING_INDEX(id);

#if JS_HAS_GETTER_SETTER
    /*
     * If defining a getter or setter, we must check for its counterpart and
     * update the attributes and property ops.  A getter or setter is really
     * only half of a property.
     */
    sprop = NULL;
    if (attrs & (JSPROP_GETTER | JSPROP_SETTER)) {
        JSObject *pobj;
        JSProperty *prop;

        /*
         * If JS_THREADSAFE and id is found, js_LookupProperty returns with
         * sprop non-null and pobj locked.  If pobj == obj, the property is
         * already in obj and obj has its own (mutable) scope.  So if we are
         * defining a getter whose setter was already defined, or vice versa,
         * finish the job via js_ChangeScopePropertyAttributes, and refresh
         * the property cache line for (obj, id) to map sprop.
         */
        if (!js_LookupProperty(cx, obj, id, &pobj, &prop))
            return JS_FALSE;
        sprop = (JSScopeProperty *) prop;
        if (sprop &&
            pobj == obj &&
            (sprop->attrs & (JSPROP_GETTER | JSPROP_SETTER))) {
            sprop = js_ChangeScopePropertyAttrs(cx, OBJ_SCOPE(obj), sprop,
                                                attrs, sprop->attrs,
                                                (attrs & JSPROP_GETTER)
                                                ? getter
                                                : sprop->getter,
                                                (attrs & JSPROP_SETTER)
                                                ? setter
                                                : sprop->setter);

            /* NB: obj == pobj, so we can share unlock code at the bottom. */
            if (!sprop)
                goto bad;
        } else if (prop) {
            /* NB: call OBJ_DROP_PROPERTY, as pobj might not be native. */
            OBJ_DROP_PROPERTY(cx, pobj, prop);
            prop = NULL;
            sprop = NULL;
        }
    }
#endif /* JS_HAS_GETTER_SETTER */

    /*
     * Purge the property cache of now-shadowed id in obj's scope chain.
     * Do this early, before locking obj to avoid nesting locks.
     */
    PurgeScopeChain(cx, obj, id);

    /* Lock if object locking is required by this implementation. */
    JS_LOCK_OBJ(cx, obj);

    /* Use the object's class getter and setter by default. */
    clasp = LOCKED_OBJ_GET_CLASS(obj);
    if (!getter)
        getter = clasp->getProperty;
    if (!setter)
        setter = clasp->setProperty;

    /* Get obj's own scope if it has one, or create a new one for obj. */
    scope = js_GetMutableScope(cx, obj);
    if (!scope)
        goto bad;

    if (!sprop) {
        /* Add a new property, or replace an existing one of the same id. */
        if (clasp->flags & JSCLASS_SHARE_ALL_PROPERTIES)
            attrs |= JSPROP_SHARED;
        sprop = js_AddScopeProperty(cx, scope, id, getter, setter,
                                    SPROP_INVALID_SLOT, attrs, flags,
                                    shortid);
        if (!sprop)
            goto bad;
    }

    /* Store value before calling addProperty, in case the latter GC's. */
    if (SPROP_HAS_VALID_SLOT(sprop, scope))
        LOCKED_OBJ_WRITE_BARRIER(cx, obj, sprop->slot, value);

    /* XXXbe called with lock held */
    ADD_PROPERTY_HELPER(cx, clasp, obj, scope, sprop, &value,
                        js_RemoveScopeProperty(cx, scope, id);
                        goto bad);

    if (propp)
        *propp = (JSProperty *) sprop;
    else
        JS_UNLOCK_OBJ(cx, obj);
    return JS_TRUE;

bad:
    JS_UNLOCK_OBJ(cx, obj);
    return JS_FALSE;
}

/*
 * Given pc pointing after a property accessing bytecode, return true if the
 * access is "object-detecting" in the sense used by web scripts, e.g., when
 * checking whether document.all is defined.
 */
static JSBool
Detecting(JSContext *cx, jsbytecode *pc)
{
    JSScript *script;
    jsbytecode *endpc;
    JSOp op;
    JSAtom *atom;

    if (!cx->fp)
        return JS_FALSE;
    script = cx->fp->script;
    for (endpc = script->code + script->length;
         pc < endpc;
         pc += js_CodeSpec[op].length) {
        /* General case: a branch or equality op follows the access. */
        op = (JSOp) *pc;
        if (js_CodeSpec[op].format & JOF_DETECTING)
            return JS_TRUE;

        switch (op) {
          case JSOP_NULL:
            /*
             * Special case #1: handle (document.all == null).  Don't sweat
             * about JS1.2's revision of the equality operators here.
             */
            if (++pc < endpc)
                return *pc == JSOP_EQ || *pc == JSOP_NE;
            return JS_FALSE;

          case JSOP_NAME:
            /*
             * Special case #2: handle (document.all == undefined).  Don't
             * worry about someone redefining undefined, which was added by
             * Edition 3, so is read/write for backward compatibility.
             */
            GET_ATOM_FROM_BYTECODE(script, pc, 0, atom);
            if (atom == cx->runtime->atomState.typeAtoms[JSTYPE_VOID] &&
                (pc += js_CodeSpec[op].length) < endpc) {
                op = (JSOp) *pc;
                return op == JSOP_EQ || op == JSOP_NE ||
                       op == JSOP_STRICTEQ || op == JSOP_STRICTNE;
            }
            return JS_FALSE;

          default:
            /*
             * At this point, anything but an extended atom index prefix means
             * we're not detecting.
             */
            if (!(js_CodeSpec[op].format & JOF_INDEXBASE))
                return JS_FALSE;
            break;
        }
    }
    return JS_FALSE;
}

JS_FRIEND_API(JSBool)
js_LookupProperty(JSContext *cx, JSObject *obj, jsid id, JSObject **objp,
                  JSProperty **propp)
{
    return js_LookupPropertyWithFlags(cx, obj, id, cx->resolveFlags,
                                      objp, propp) >= 0;
}

#define SCOPE_DEPTH_ACCUM(bs,val)                                             \
    JS_SCOPE_DEPTH_METERING(JS_BASIC_STATS_ACCUM(bs, val))

int
js_LookupPropertyWithFlags(JSContext *cx, JSObject *obj, jsid id, uintN flags,
                           JSObject **objp, JSProperty **propp)
{
    JSObject *start, *obj2, *proto;
    int protoIndex;
    JSScope *scope;
    JSScopeProperty *sprop;
    JSClass *clasp;
    JSResolveOp resolve;
    JSResolvingKey key;
    JSResolvingEntry *entry;
    uint32 generation;
    JSNewResolveOp newresolve;
    jsbytecode *pc;
    const JSCodeSpec *cs;
    uint32 format;
    JSBool ok;

    /* Convert string indices to integers if appropriate. */
    CHECK_FOR_STRING_INDEX(id);
    JS_COUNT_OPERATION(cx, JSOW_LOOKUP_PROPERTY);

    /* Search scopes starting with obj and following the prototype link. */
    start = obj;
    for (protoIndex = 0; ; protoIndex++) {
        JS_LOCK_OBJ(cx, obj);
        scope = OBJ_SCOPE(obj);
        if (scope->object == obj) {
            sprop = SCOPE_GET_PROPERTY(scope, id);
        } else {
            /* Shared prototype scope: try resolve before lookup. */
            sprop = NULL;
        }

        /* Try obj's class resolve hook if id was not found in obj's scope. */
        if (!sprop) {
            clasp = LOCKED_OBJ_GET_CLASS(obj);
            resolve = clasp->resolve;
            if (resolve != JS_ResolveStub) {
                /* Avoid recursion on (obj, id) already being resolved on cx. */
                key.obj = obj;
                key.id = id;

                /*
                 * Once we have successfully added an entry for (obj, key) to
                 * cx->resolvingTable, control must go through cleanup: before
                 * returning.  But note that JS_DHASH_ADD may find an existing
                 * entry, in which case we bail to suppress runaway recursion.
                 */
                if (!js_StartResolving(cx, &key, JSRESFLAG_LOOKUP, &entry)) {
                    JS_UNLOCK_OBJ(cx, obj);
                    return -1;
                }
                if (!entry) {
                    /* Already resolving id in obj -- suppress recursion. */
                    JS_UNLOCK_OBJ(cx, obj);
                    goto out;
                }
                generation = cx->resolvingTable->generation;

                /* Null *propp here so we can test it at cleanup: safely. */
                *propp = NULL;

                if (clasp->flags & JSCLASS_NEW_RESOLVE) {
                    newresolve = (JSNewResolveOp)resolve;
                    if (flags == JSRESOLVE_INFER && cx->fp && cx->fp->regs) {
                        flags = 0;
                        pc = cx->fp->regs->pc;
                        cs = &js_CodeSpec[*pc];
                        format = cs->format;
                        if (JOF_MODE(format) != JOF_NAME)
                            flags |= JSRESOLVE_QUALIFIED;
                        if ((format & (JOF_SET | JOF_FOR)) ||
                            (cx->fp->flags & JSFRAME_ASSIGNING)) {
                            flags |= JSRESOLVE_ASSIGNING;
                        } else {
                            pc += cs->length;
                            if (Detecting(cx, pc))
                                flags |= JSRESOLVE_DETECTING;
                        }
                        if (format & JOF_DECLARING)
                            flags |= JSRESOLVE_DECLARING;
                    }
                    obj2 = (clasp->flags & JSCLASS_NEW_RESOLVE_GETS_START)
                           ? start
                           : NULL;
                    JS_UNLOCK_OBJ(cx, obj);

                    /* Protect id and all atoms from a GC nested in resolve. */
                    JS_KEEP_ATOMS(cx->runtime);
                    ok = newresolve(cx, obj, ID_TO_VALUE(id), flags, &obj2);
                    JS_UNKEEP_ATOMS(cx->runtime);
                    if (!ok)
                        goto cleanup;

                    JS_LOCK_OBJ(cx, obj);
                    if (obj2) {
                        /* Resolved: juggle locks and lookup id again. */
                        if (obj2 != obj) {
                            JS_UNLOCK_OBJ(cx, obj);
                            if (OBJ_IS_NATIVE(obj2))
                                JS_LOCK_OBJ(cx, obj2);
                        }
                        protoIndex = 0;
                        for (proto = start; proto && proto != obj2;
                             proto = OBJ_GET_PROTO(cx, proto)) {
                            protoIndex++;
                        }
                        scope = OBJ_SCOPE(obj2);
                        if (!MAP_IS_NATIVE(&scope->map)) {
                            /* Whoops, newresolve handed back a foreign obj2. */
                            JS_ASSERT(obj2 != obj);
                            ok = OBJ_LOOKUP_PROPERTY(cx, obj2, id, objp, propp);
                            if (!ok || *propp)
                                goto cleanup;
                            JS_LOCK_OBJ(cx, obj2);
                        } else {
                            /*
                             * Require that obj2 have its own scope now, as we
                             * do for old-style resolve.  If it doesn't, then
                             * id was not truly resolved, and we'll find it in
                             * the proto chain, or miss it if obj2's proto is
                             * not on obj's proto chain.  That last case is a
                             * "too bad!" case.
                             */
                            if (scope->object == obj2)
                                sprop = SCOPE_GET_PROPERTY(scope, id);
                        }
                        if (sprop) {
                            JS_ASSERT(obj2 == scope->object);
                            obj = obj2;
                        } else if (obj2 != obj) {
                            if (OBJ_IS_NATIVE(obj2))
                                JS_UNLOCK_OBJ(cx, obj2);
                            JS_LOCK_OBJ(cx, obj);
                        }
                    }
                } else {
                    /*
                     * Old resolve always requires id re-lookup if obj owns
                     * its scope after resolve returns.
                     */
                    JS_UNLOCK_OBJ(cx, obj);
                    ok = resolve(cx, obj, ID_TO_VALUE(id));
                    if (!ok)
                        goto cleanup;
                    JS_LOCK_OBJ(cx, obj);
                    scope = OBJ_SCOPE(obj);
                    JS_ASSERT(MAP_IS_NATIVE(&scope->map));
                    if (scope->object == obj)
                        sprop = SCOPE_GET_PROPERTY(scope, id);
                }

            cleanup:
                js_StopResolving(cx, &key, JSRESFLAG_LOOKUP, entry, generation);
                if (!ok)
                    return -1;
                if (*propp)
                    return protoIndex;
            }
        }

        if (sprop) {
            SCOPE_DEPTH_ACCUM(&cx->runtime->protoLookupDepthStats, protoIndex);
            JS_ASSERT(OBJ_SCOPE(obj) == scope);
            *objp = scope->object;      /* XXXbe hide in jsscope.[ch] */

            *propp = (JSProperty *) sprop;
            return protoIndex;
        }

        proto = LOCKED_OBJ_GET_PROTO(obj);
        JS_UNLOCK_OBJ(cx, obj);
        if (!proto)
            break;
        if (!OBJ_IS_NATIVE(proto)) {
            if (!OBJ_LOOKUP_PROPERTY(cx, proto, id, objp, propp))
                return -1;
            return protoIndex + 1;
        }
        obj = proto;
    }

out:
    *objp = NULL;
    *propp = NULL;
    return protoIndex;
}

int
js_FindPropertyHelper(JSContext *cx, jsid id, JSObject **objp,
                      JSObject **pobjp, JSProperty **propp,
                      JSPropCacheEntry **entryp)
{
    JSObject *obj, *pobj, *lastobj;
    uint32 shape;
    int scopeIndex, protoIndex;
    JSProperty *prop;
    JSScopeProperty *sprop;

    obj = cx->fp->scopeChain;
    shape = OBJ_SHAPE(obj);
    for (scopeIndex = 0; ; scopeIndex++) {
        if (obj->map->ops->lookupProperty == js_LookupProperty) {
            protoIndex =
                js_LookupPropertyWithFlags(cx, obj, id, cx->resolveFlags,
                                           &pobj, &prop);
        } else {
            if (!OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop))
                return -1;
            protoIndex = -1;
        }

        if (prop) {
            if (entryp) {
                if (protoIndex >= 0 && OBJ_IS_NATIVE(pobj)) {
                    sprop = (JSScopeProperty *) prop;
                    js_FillPropertyCache(cx, cx->fp->scopeChain, shape,
                                         scopeIndex, protoIndex, pobj, sprop,
                                         entryp);
                } else {
                    PCMETER(JS_PROPERTY_CACHE(cx).nofills++);
                    *entryp = NULL;
                }
            }
            SCOPE_DEPTH_ACCUM(&rt->scopeSearchDepthStats, scopeIndex);
            *objp = obj;
            *pobjp = pobj;
            *propp = prop;
            return scopeIndex;
        }

        lastobj = obj;
        obj = OBJ_GET_PARENT(cx, obj);
        if (!obj)
            break;
    }

    *objp = lastobj;
    *pobjp = NULL;
    *propp = NULL;
    return scopeIndex;
}

JS_FRIEND_API(JSBool)
js_FindProperty(JSContext *cx, jsid id, JSObject **objp, JSObject **pobjp,
                JSProperty **propp)
{
    return js_FindPropertyHelper(cx, id, objp, pobjp, propp, NULL) >= 0;
}

JSObject *
js_FindIdentifierBase(JSContext *cx, jsid id, JSPropCacheEntry *entry)
{
    JSObject *obj, *pobj;
    JSProperty *prop;

    /*
     * Look for id's property along the "with" statement chain and the
     * statically-linked scope chain.
     */
    if (js_FindPropertyHelper(cx, id, &obj, &pobj, &prop, &entry) < 0)
        return NULL;
    if (prop) {
        OBJ_DROP_PROPERTY(cx, pobj, prop);
        return obj;
    }

    /*
     * Use the top-level scope from the scope chain, which won't end in the
     * same scope as cx->globalObject for cross-context function calls.
     */
    JS_ASSERT(obj);

    /*
     * Property not found.  Give a strict warning if binding an undeclared
     * top-level variable.
     */
    if (JS_HAS_STRICT_OPTION(cx)) {
        JSString *str = JSVAL_TO_STRING(ID_TO_VALUE(id));
        const char *bytes = js_GetStringBytes(cx, str);

        if (!bytes ||
            !JS_ReportErrorFlagsAndNumber(cx,
                                          JSREPORT_WARNING | JSREPORT_STRICT,
                                          js_GetErrorMessage, NULL,
                                          JSMSG_UNDECLARED_VAR, bytes)) {
            return NULL;
        }
    }

    return obj;
}

JSBool
js_NativeGet(JSContext *cx, JSObject *obj, JSObject *pobj,
             JSScopeProperty *sprop, jsval *vp)
{
    JSScope *scope;
    uint32 slot;
    int32 sample;
    JSTempValueRooter tvr;
    JSBool ok;

    JS_ASSERT(OBJ_IS_NATIVE(pobj));
    JS_ASSERT(JS_IS_OBJ_LOCKED(cx, pobj));
    scope = OBJ_SCOPE(pobj);
    JS_ASSERT(scope->object == pobj);

    slot = sprop->slot;
    *vp = (slot != SPROP_INVALID_SLOT)
          ? LOCKED_OBJ_GET_SLOT(pobj, slot)
          : JSVAL_VOID;
    if (SPROP_HAS_STUB_GETTER(sprop))
        return JS_TRUE;

    sample = cx->runtime->propertyRemovals;
    JS_UNLOCK_SCOPE(cx, scope);
    JS_PUSH_TEMP_ROOT_SPROP(cx, sprop, &tvr);
    ok = SPROP_GET(cx, sprop, obj, pobj, vp);
    JS_POP_TEMP_ROOT(cx, &tvr);
    if (!ok)
        return JS_FALSE;

    JS_LOCK_SCOPE(cx, scope);
    JS_ASSERT(scope->object == pobj);
    if (SLOT_IN_SCOPE(slot, scope) &&
        (JS_LIKELY(cx->runtime->propertyRemovals == sample) ||
         SCOPE_GET_PROPERTY(scope, sprop->id) == sprop)) {
        LOCKED_OBJ_SET_SLOT(pobj, slot, *vp);
    }

    return JS_TRUE;
}

JSBool
js_NativeSet(JSContext *cx, JSObject *obj, JSScopeProperty *sprop, jsval *vp)
{
    JSScope *scope;
    uint32 slot;
    int32 sample;
    JSTempValueRooter tvr;
    bool ok;

    JS_ASSERT(OBJ_IS_NATIVE(obj));
    JS_ASSERT(JS_IS_OBJ_LOCKED(cx, obj));
    scope = OBJ_SCOPE(obj);
    JS_ASSERT(scope->object == obj);

    slot = sprop->slot;
    if (slot != SPROP_INVALID_SLOT) {
        OBJ_CHECK_SLOT(obj, slot);

        /* If sprop has a stub setter, keep scope locked and just store *vp. */
        if (SPROP_HAS_STUB_SETTER(sprop))
            goto set_slot;
    } else {
        /*
         * Allow API consumers to create shared properties with stub setters.
         * Such properties lack value storage, so setting them is like writing
         * to /dev/null.
         */
        if (SPROP_HAS_STUB_SETTER(sprop))
            return JS_TRUE;
    }

    sample = cx->runtime->propertyRemovals;
    JS_UNLOCK_SCOPE(cx, scope);
    JS_PUSH_TEMP_ROOT_SPROP(cx, sprop, &tvr);
    ok = SPROP_SET(cx, sprop, obj, obj, vp);
    JS_POP_TEMP_ROOT(cx, &tvr);
    if (!ok)
        return JS_FALSE;

    JS_LOCK_SCOPE(cx, scope);
    JS_ASSERT(scope->object == obj);
    if (SLOT_IN_SCOPE(slot, scope) &&
        (JS_LIKELY(cx->runtime->propertyRemovals == sample) ||
         SCOPE_GET_PROPERTY(scope, sprop->id) == sprop)) {
  set_slot:
        LOCKED_OBJ_WRITE_BARRIER(cx, obj, slot, *vp);
    }

    return JS_TRUE;
}

JSBool
js_GetPropertyHelper(JSContext *cx, JSObject *obj, jsid id, jsval *vp,
                     JSPropCacheEntry **entryp)
{
    uint32 shape;
    int protoIndex;
    JSObject *obj2;
    JSProperty *prop;
    JSScopeProperty *sprop;

    /* Convert string indices to integers if appropriate. */
    CHECK_FOR_STRING_INDEX(id);
    JS_COUNT_OPERATION(cx, JSOW_GET_PROPERTY);

    shape = OBJ_SHAPE(obj);
    protoIndex = js_LookupPropertyWithFlags(cx, obj, id, cx->resolveFlags,
                                            &obj2, &prop);
    if (protoIndex < 0)
        return JS_FALSE;
    if (!prop) {
        jsbytecode *pc;

        *vp = JSVAL_VOID;

        if (!OBJ_GET_CLASS(cx, obj)->getProperty(cx, obj, ID_TO_VALUE(id), vp))
            return JS_FALSE;

        if (entryp) {
            PCMETER(JS_PROPERTY_CACHE(cx).nofills++);
            *entryp = NULL;
        }

        /*
         * Give a strict warning if foo.bar is evaluated by a script for an
         * object foo with no property named 'bar'.
         */
        if (JSVAL_IS_VOID(*vp) && cx->fp && cx->fp->regs) {
            JSOp op;
            uintN flags;

            pc = cx->fp->regs->pc;
            op = (JSOp) *pc;
            if (op == JSOP_GETXPROP) {
                flags = JSREPORT_ERROR;
            } else {
                if (!JS_HAS_STRICT_OPTION(cx) ||
                    (op != JSOP_GETPROP && op != JSOP_GETELEM)) {
                    return JS_TRUE;
                }

                /*
                 * XXX do not warn about missing __iterator__ as the function
                 * may be called from JS_GetMethodById. See bug 355145.
                 */
                if (id == ATOM_TO_JSID(cx->runtime->atomState.iteratorAtom))
                    return JS_TRUE;

                /* Kludge to allow (typeof foo == "undefined") tests. */
                JS_ASSERT(cx->fp->script);
                pc += js_CodeSpec[op].length;
                if (Detecting(cx, pc))
                    return JS_TRUE;

                flags = JSREPORT_WARNING | JSREPORT_STRICT;
            }

            /* Ok, bad undefined property reference: whine about it. */
            if (!js_ReportValueErrorFlags(cx, flags, JSMSG_UNDEFINED_PROP,
                                          JSDVG_IGNORE_STACK, ID_TO_VALUE(id),
                                          NULL, NULL, NULL)) {
                return JS_FALSE;
            }
        }
        return JS_TRUE;
    }

    if (!OBJ_IS_NATIVE(obj2)) {
        OBJ_DROP_PROPERTY(cx, obj2, prop);
        return OBJ_GET_PROPERTY(cx, obj2, id, vp);
    }

    sprop = (JSScopeProperty *) prop;
    if (!js_NativeGet(cx, obj, obj2, sprop, vp))
        return JS_FALSE;

    if (entryp)
        js_FillPropertyCache(cx, obj, shape, 0, protoIndex, obj2, sprop, entryp);
    JS_UNLOCK_OBJ(cx, obj2);
    return JS_TRUE;
}

JSBool
js_GetProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    return js_GetPropertyHelper(cx, obj, id, vp, NULL);
}

JSBool
js_SetPropertyHelper(JSContext *cx, JSObject *obj, jsid id, jsval *vp,
                     JSPropCacheEntry **entryp)
{
    uint32 shape;
    int protoIndex;
    JSObject *pobj;
    JSProperty *prop;
    JSScopeProperty *sprop;
    JSScope *scope;
    uintN attrs, flags;
    intN shortid;
    JSClass *clasp;
    JSPropertyOp getter, setter;

    /* Convert string indices to integers if appropriate. */
    CHECK_FOR_STRING_INDEX(id);
    JS_COUNT_OPERATION(cx, JSOW_SET_PROPERTY);

    shape = OBJ_SHAPE(obj);
    protoIndex = js_LookupPropertyWithFlags(cx, obj, id, cx->resolveFlags,
                                            &pobj, &prop);
    if (protoIndex < 0)
        return JS_FALSE;

    if (prop && !OBJ_IS_NATIVE(pobj)) {
        OBJ_DROP_PROPERTY(cx, pobj, prop);
        prop = NULL;
    }
    sprop = (JSScopeProperty *) prop;

    /*
     * Now either sprop is null, meaning id was not found in obj or one of its
     * prototypes; or sprop is non-null, meaning id was found in pobj's scope.
     * If JS_THREADSAFE and sprop is non-null, then scope is locked, and sprop
     * is held: we must OBJ_DROP_PROPERTY or JS_UNLOCK_SCOPE before we return
     * (the two are equivalent for native objects, but we use JS_UNLOCK_SCOPE
     * because it is cheaper).
     */
    attrs = JSPROP_ENUMERATE;
    flags = 0;
    shortid = 0;
    clasp = OBJ_GET_CLASS(cx, obj);
    getter = clasp->getProperty;
    setter = clasp->setProperty;

    if (sprop) {
        /*
         * Set scope for use below.  It was locked by js_LookupProperty, and
         * we know pobj owns it (i.e., scope->object == pobj).  Therefore we
         * optimize JS_UNLOCK_OBJ(cx, pobj) into JS_UNLOCK_SCOPE(cx, scope).
         */
        scope = OBJ_SCOPE(pobj);

        attrs = sprop->attrs;
        if ((attrs & JSPROP_READONLY) ||
            (SCOPE_IS_SEALED(scope) && pobj == obj)) {
            JS_UNLOCK_SCOPE(cx, scope);

            /*
             * Here, we'll either return true or goto read_only_error, which
             * reports a strict warning or throws an error.  So we redefine
             * the |flags| local variable to be JSREPORT_* flags to pass to
             * JS_ReportErrorFlagsAndNumberUC at label read_only_error.  We
             * must likewise re-task flags further below for the other 'goto
             * read_only_error;' case.
             */
            flags = JSREPORT_ERROR;
            if (attrs & JSPROP_READONLY) {
                if (!JS_HAS_STRICT_OPTION(cx)) {
                    /* Just return true per ECMA if not in strict mode. */
                    PCMETER(!entryp || JS_PROPERTY_CACHE(cx).rofills++);
                    return JS_TRUE;
                }

                /* Strict mode: report a read-only strict warning. */
                flags = JSREPORT_STRICT | JSREPORT_WARNING;
            }
            goto read_only_error;
        }

        if (pobj != obj) {
            /*
             * We found id in a prototype object: prepare to share or shadow.
             *
             * NB: Thanks to the immutable, garbage-collected property tree
             * maintained by jsscope.c in cx->runtime, we needn't worry about
             * sprop going away behind our back after we've unlocked scope.
             */
            JS_UNLOCK_SCOPE(cx, scope);

            /*
             * Don't clone a shared prototype property. Don't fill it in the
             * property cache either, since the JSOP_SETPROP/JSOP_SETNAME code
             * in js_Interpret does not handle shared or prototype properties.
             * Shared prototype properties require more hit qualification than
             * the fast-path code for those ops, which is targeted on direct,
             * slot-based properties.
             */
            if (attrs & JSPROP_SHARED) {
                if (entryp) {
                    PCMETER(JS_PROPERTY_CACHE(cx).nofills++);
                    *entryp = NULL;
                }

                if (SPROP_HAS_STUB_SETTER(sprop) &&
                    !(sprop->attrs & JSPROP_GETTER)) {
                    return JS_TRUE;
                }

                return !!SPROP_SET(cx, sprop, obj, pobj, vp);
            }

            /* Restore attrs to the ECMA default for new properties. */
            attrs = JSPROP_ENUMERATE;

            /*
             * Preserve the shortid, getter, and setter when shadowing any
             * property that has a shortid.  An old API convention requires
             * that the property's getter and setter functions receive the
             * shortid, not id, when they are called on the shadow we are
             * about to create in obj's scope.
             */
            if (sprop->flags & SPROP_HAS_SHORTID) {
                flags = SPROP_HAS_SHORTID;
                shortid = sprop->shortid;
                getter = sprop->getter;
                setter = sprop->setter;
            }

            /*
             * Forget we found the proto-property now that we've copied any
             * needed member values.
             */
            sprop = NULL;
        }
#ifdef __GNUC__ /* suppress bogus gcc warnings */
    } else {
        scope = NULL;
#endif
    }

    if (!sprop) {
        if (SCOPE_IS_SEALED(OBJ_SCOPE(obj)) && OBJ_SCOPE(obj)->object == obj) {
            flags = JSREPORT_ERROR;
            goto read_only_error;
        }

        /*
         * Purge the property cache of now-shadowed id in obj's scope chain.
         * Do this early, before locking obj to avoid nesting locks.
         */
        PurgeScopeChain(cx, obj, id);

        /* Find or make a property descriptor with the right heritage. */
        JS_LOCK_OBJ(cx, obj);
        scope = js_GetMutableScope(cx, obj);
        if (!scope) {
            JS_UNLOCK_OBJ(cx, obj);
            return JS_FALSE;
        }
        if (clasp->flags & JSCLASS_SHARE_ALL_PROPERTIES)
            attrs |= JSPROP_SHARED;
        sprop = js_AddScopeProperty(cx, scope, id, getter, setter,
                                    SPROP_INVALID_SLOT, attrs, flags, shortid);
        if (!sprop) {
            JS_UNLOCK_SCOPE(cx, scope);
            return JS_FALSE;
        }

        /*
         * Initialize the new property value (passed to setter) to undefined.
         * Note that we store before calling addProperty, to match the order
         * in js_DefineNativeProperty.
         */
        if (SPROP_HAS_VALID_SLOT(sprop, scope))
            LOCKED_OBJ_SET_SLOT(obj, sprop->slot, JSVAL_VOID);

        /* XXXbe called with obj locked */
        ADD_PROPERTY_HELPER(cx, clasp, obj, scope, sprop, vp,
                            js_RemoveScopeProperty(cx, scope, id);
                            JS_UNLOCK_SCOPE(cx, scope);
                            return JS_FALSE);
    }

    if (!js_NativeSet(cx, obj, sprop, vp))
        return JS_FALSE;

    if (entryp) {
        if (!(attrs & JSPROP_SHARED))
            js_FillPropertyCache(cx, obj, shape, 0, 0, obj, sprop, entryp);
        else
            PCMETER(JS_PROPERTY_CACHE(cx).nofills++);
    }
    JS_UNLOCK_SCOPE(cx, scope);
    return JS_TRUE;

  read_only_error:
    return js_ReportValueErrorFlags(cx, flags, JSMSG_READ_ONLY,
                                    JSDVG_IGNORE_STACK, ID_TO_VALUE(id), NULL,
                                    NULL, NULL);
}

JSBool
js_SetProperty(JSContext *cx, JSObject *obj, jsid id, jsval *vp)
{
    return js_SetPropertyHelper(cx, obj, id, vp, NULL);
}

JSBool
js_GetAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                 uintN *attrsp)
{
    JSBool noprop, ok;
    JSScopeProperty *sprop;

    noprop = !prop;
    if (noprop) {
        if (!js_LookupProperty(cx, obj, id, &obj, &prop))
            return JS_FALSE;
        if (!prop) {
            *attrsp = 0;
            return JS_TRUE;
        }
        if (!OBJ_IS_NATIVE(obj)) {
            ok = OBJ_GET_ATTRIBUTES(cx, obj, id, prop, attrsp);
            OBJ_DROP_PROPERTY(cx, obj, prop);
            return ok;
        }
    }
    sprop = (JSScopeProperty *)prop;
    *attrsp = sprop->attrs;
    if (noprop)
        OBJ_DROP_PROPERTY(cx, obj, prop);
    return JS_TRUE;
}

JSBool
js_SetAttributes(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                 uintN *attrsp)
{
    JSBool noprop, ok;
    JSScopeProperty *sprop;

    noprop = !prop;
    if (noprop) {
        if (!js_LookupProperty(cx, obj, id, &obj, &prop))
            return JS_FALSE;
        if (!prop)
            return JS_TRUE;
        if (!OBJ_IS_NATIVE(obj)) {
            ok = OBJ_SET_ATTRIBUTES(cx, obj, id, prop, attrsp);
            OBJ_DROP_PROPERTY(cx, obj, prop);
            return ok;
        }
    }
    sprop = (JSScopeProperty *)prop;
    sprop = js_ChangeNativePropertyAttrs(cx, obj, sprop, *attrsp, 0,
                                         sprop->getter, sprop->setter);
    if (noprop)
        OBJ_DROP_PROPERTY(cx, obj, prop);
    return (sprop != NULL);
}

JSBool
js_DeleteProperty(JSContext *cx, JSObject *obj, jsid id, jsval *rval)
{
    JSObject *proto;
    JSProperty *prop;
    JSScopeProperty *sprop;
    JSScope *scope;
    JSBool ok;

    *rval = JSVAL_TRUE;

    /* Convert string indices to integers if appropriate. */
    CHECK_FOR_STRING_INDEX(id);
    JS_COUNT_OPERATION(cx, JSOW_DELETE_PROPERTY);

    if (!js_LookupProperty(cx, obj, id, &proto, &prop))
        return JS_FALSE;
    if (!prop || proto != obj) {
        /*
         * If the property was found in a native prototype, check whether it's
         * shared and permanent.  Such a property stands for direct properties
         * in all delegating objects, matching ECMA semantics without bloating
         * each delegating object.
         */
        if (prop) {
            if (OBJ_IS_NATIVE(proto)) {
                sprop = (JSScopeProperty *)prop;
                if (SPROP_IS_SHARED_PERMANENT(sprop))
                    *rval = JSVAL_FALSE;
            }
            OBJ_DROP_PROPERTY(cx, proto, prop);
            if (*rval == JSVAL_FALSE)
                return JS_TRUE;
        }

        /*
         * If no property, or the property comes unshared or impermanent from
         * a prototype, call the class's delProperty hook, passing rval as the
         * result parameter.
         */
        return OBJ_GET_CLASS(cx, obj)->delProperty(cx, obj, ID_TO_VALUE(id),
                                                   rval);
    }

    sprop = (JSScopeProperty *)prop;
    if (sprop->attrs & JSPROP_PERMANENT) {
        OBJ_DROP_PROPERTY(cx, obj, prop);
        *rval = JSVAL_FALSE;
        return JS_TRUE;
    }

    /* XXXbe called with obj locked */
    if (!LOCKED_OBJ_GET_CLASS(obj)->delProperty(cx, obj, SPROP_USERID(sprop),
                                                rval)) {
        OBJ_DROP_PROPERTY(cx, obj, prop);
        return JS_FALSE;
    }

    scope = OBJ_SCOPE(obj);
    if (SPROP_HAS_VALID_SLOT(sprop, scope))
        GC_POKE(cx, LOCKED_OBJ_GET_SLOT(obj, sprop->slot));

    ok = js_RemoveScopeProperty(cx, scope, id);
    OBJ_DROP_PROPERTY(cx, obj, prop);
    return ok;
}

JSBool
js_DefaultValue(JSContext *cx, JSObject *obj, JSType hint, jsval *vp)
{
    jsval v, save;
    JSString *str;

    v = save = OBJECT_TO_JSVAL(obj);
    switch (hint) {
      case JSTYPE_STRING:
        /*
         * Propagate the exception if js_TryMethod finds an appropriate
         * method, and calling that method returned failure.
         */
        if (!js_TryMethod(cx, obj, cx->runtime->atomState.toStringAtom, 0, NULL,
                          &v)) {
            return JS_FALSE;
        }

        if (!JSVAL_IS_PRIMITIVE(v)) {
            if (!OBJ_GET_CLASS(cx, obj)->convert(cx, obj, hint, &v))
                return JS_FALSE;
        }
        break;

      default:
        if (!OBJ_GET_CLASS(cx, obj)->convert(cx, obj, hint, &v))
            return JS_FALSE;
        if (!JSVAL_IS_PRIMITIVE(v)) {
            JSType type = JS_TypeOfValue(cx, v);
            if (type == hint ||
                (type == JSTYPE_FUNCTION && hint == JSTYPE_OBJECT)) {
                goto out;
            }
            if (!js_TryMethod(cx, obj, cx->runtime->atomState.toStringAtom, 0,
                              NULL, &v)) {
                return JS_FALSE;
            }
        }
        break;
    }
    if (!JSVAL_IS_PRIMITIVE(v)) {
        /* Avoid recursive death when decompiling in js_ReportValueError. */
        if (hint == JSTYPE_STRING) {
            str = JS_InternString(cx, OBJ_GET_CLASS(cx, obj)->name);
            if (!str)
                return JS_FALSE;
        } else {
            str = NULL;
        }
        *vp = OBJECT_TO_JSVAL(obj);
        js_ReportValueError2(cx, JSMSG_CANT_CONVERT_TO,
                             JSDVG_SEARCH_STACK, save, str,
                             (hint == JSTYPE_VOID)
                             ? "primitive type"
                             : JS_TYPE_STR(hint));
        return JS_FALSE;
    }
out:
    *vp = v;
    return JS_TRUE;
}

/*
 * Private type used to enumerate properties of a native JS object. It is
 * allocated as necessary from JSENUMERATE_INIT and is freed when running the
 * GC. The structure is not allocated when there are no enumerable properties
 * in the object. Instead for the empty enumerator the code uses JSVAL_ZERO as
 * the enumeration state.
 *
 * JSRuntime.nativeEnumCache caches the enumerators using scope's shape to
 * avoid repeated scanning of scopes for enumerable properties. The cache
 * entry is either JSNativeEnumerator* or, for the empty enumerator, the shape
 * value itself. The latter is stored as (shape << 1) | 1 to ensure that it is
 * always different from JSNativeEnumerator* values.
 */
struct JSNativeEnumerator {
    /*
     * The index into the ids array. It runs from the length down to 1 when
     * the enumerator is running. It is 0 when the enumerator is finished and
     * can be reused on a cache hit. Its type is jsword, not uint32, for
     * compatibility with js_CompareAndSwap.
     */
    jsword                  cursor;

    uint32                  length;     /* length of ids array */
    uint32                  shape;      /* "shape" number -- see jsscope.h */
    JSNativeEnumerator      *next;      /* list linking */
    jsid                    ids[1];     /* enumeration id array */
};

/* The tagging of shape values requires one bit. */
JS_STATIC_ASSERT((jsuword) SHAPE_OVERFLOW_BIT <=
                 ((jsuword) 1 << (JS_BITS_PER_WORD - 1)));

static inline size_t
NativeEnumeratorSize(uint32 length)
{
    JS_ASSERT(length != 0);
    return offsetof(JSNativeEnumerator, ids) + (size_t) length * sizeof(jsid);
}

/*
 * This function is used to enumerate the properties of native JSObjects
 * and those host objects that do not define a JSNewEnumerateOp-style iterator
 * function.
 */
JSBool
js_Enumerate(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
             jsval *statep, jsid *idp)
{
    JSClass *clasp;
    JSEnumerateOp enumerate;
    JSNativeEnumerator *ne;
    uint32 length, shape;
    size_t allocated;
    JSScope *scope;
    jsuword *cachep, oldcache;
    JSScopeProperty *sprop;
    jsid *ids;
    jsword newcursor;

    clasp = OBJ_GET_CLASS(cx, obj);
    enumerate = clasp->enumerate;
    if (clasp->flags & JSCLASS_NEW_ENUMERATE) {
        JS_ASSERT(enumerate != JS_EnumerateStub);
        return ((JSNewEnumerateOp) enumerate)(cx, obj, enum_op, statep, idp);
    }

    switch (enum_op) {
      case JSENUMERATE_INIT:
        if (!enumerate(cx, obj))
            return JS_FALSE;

        /*
         * The set of all property ids is pre-computed when the iterator is
         * initialized to avoid problems caused by properties being deleted
         * during the iteration.
         *
         * Use a do-while(0) loop to avoid too many nested ifs. If ne is null
         * after the loop, it indicates an empty enumerator. If allocated is
         * not zero after the loop, we add the newly allocated ne to the cache
         * and runtime->nativeEnumerators list.
         */
        ne = NULL;
        length = 0;
        allocated = (size_t) 0;
        JS_LOCK_OBJ(cx, obj);
        scope = OBJ_SCOPE(obj);
        do {
            /*
             * If this object shares a scope with its prototype, don't
             * enumerate its properties. Otherwise they will be enumerated
             * a second time when the prototype object is enumerated.
             */
            if (scope->object != obj) {
#ifdef __GNUC__
                cachep = NULL;  /* suppress bogus gcc warnings */
#endif
                break;
            }

            ENUM_CACHE_METER(nativeEnumProbes);
            shape = scope->shape;
            JS_ASSERT(shape < SHAPE_OVERFLOW_BIT);
            cachep = &cx->runtime->
                     nativeEnumCache[NATIVE_ENUM_CACHE_HASH(shape)];
            oldcache = *cachep;
            if (oldcache & (jsuword) 1) {
                if ((uint32) (oldcache >> 1) == shape) {
                    /* scope has a shape with no enumerable properties. */
                    break;
                }
            } else if (oldcache != (jsuword) 0) {
                /*
                 * We can safely read ne->shape without taking the GC lock as
                 * ne is deleted only when running the GC and ne->shape is
                 * read-only after initialization.
                 */
                ne = (JSNativeEnumerator *) *cachep;
                JS_ASSERT(ne->length >= 1);
                if (ne->shape == shape) {
                    /*
                     * Check that ne is not running with another enumerator
                     * and, if so, reuse and mark it as running from now.
                     */
                    length = ne->length;
                    if (js_CompareAndSwap(&ne->cursor, 0, length))
                        break;
                    length = 0;
                }
                ne = NULL;
            }
            ENUM_CACHE_METER(nativeEnumMisses);

            /* Count all enumerable properties in object's scope. */
            JS_ASSERT(length == 0);
            for (sprop = SCOPE_LAST_PROP(scope); sprop; sprop = sprop->parent) {
                if ((sprop->attrs & JSPROP_ENUMERATE) &&
                    !(sprop->flags & SPROP_IS_ALIAS) &&
                    (!SCOPE_HAD_MIDDLE_DELETE(scope) ||
                     SCOPE_HAS_PROPERTY(scope, sprop))) {
                    length++;
                }
            }
            if (length == 0) {
                /* cache the scope without enumerable properties. */
                *cachep = ((jsuword) shape << 1) | (jsuword) 1;
                break;
            }

            allocated = NativeEnumeratorSize(length);
            ne = (JSNativeEnumerator *) JS_malloc(cx, allocated);
            if (!ne) {
                JS_UNLOCK_SCOPE(cx, scope);
                return JS_FALSE;
            }
            ne->cursor = length;
            ne->length = length;
            ne->shape = shape;
            ids = ne->ids;
            for (sprop = SCOPE_LAST_PROP(scope); sprop; sprop = sprop->parent) {
                if ((sprop->attrs & JSPROP_ENUMERATE) &&
                    !(sprop->flags & SPROP_IS_ALIAS) &&
                    (!SCOPE_HAD_MIDDLE_DELETE(scope) ||
                     SCOPE_HAS_PROPERTY(scope, sprop))) {
                    JS_ASSERT(ids < ne->ids + length);
                    *ids++ = sprop->id;
                }
            }
            JS_ASSERT(ids == ne->ids + length);
        } while (0);
        JS_UNLOCK_SCOPE(cx, scope);

        if (!ne) {
            JS_ASSERT(length == 0);
            JS_ASSERT(allocated == 0);
            *statep = JSVAL_ZERO;
        } else {
            JS_ASSERT(length != 0);
            JS_ASSERT(ne->cursor == (jsword) length);
            if (allocated != 0) {
                JS_LOCK_GC(cx->runtime);
                if (!js_AddAsGCBytes(cx, allocated)) {
                    /* js_AddAsGCBytes releases the GC lock on failures. */
                    JS_free(cx, ne);
                    return JS_FALSE;
                }
                ne->next = cx->runtime->nativeEnumerators;
                cx->runtime->nativeEnumerators = ne;
                JS_ASSERT(((jsuword) ne & (jsuword) 1) == (jsuword) 0);
                *cachep = (jsuword) ne;
                JS_UNLOCK_GC(cx->runtime);
            }
            *statep = PRIVATE_TO_JSVAL(ne);
        }
        if (idp)
            *idp = INT_TO_JSVAL(length);
        break;

      case JSENUMERATE_NEXT:
      case JSENUMERATE_DESTROY:
        if (*statep == JSVAL_ZERO) {
            *statep = JSVAL_NULL;
            break;
        }
        ne = (JSNativeEnumerator *) JSVAL_TO_PRIVATE(*statep);
        JS_ASSERT(ne->length >= 1);
        JS_ASSERT(ne->cursor >= 1);

        /*
         * We must not access ne->cursor when we set it to zero as it means
         * that ne is free and another thread can grab it from the cache. So
         * we set the state to JSVAL_ZERO in the NEXT case to avoid touching
         * ne->length again in the DESTROY case.
         */
        if (enum_op == JSENUMERATE_NEXT) {
            newcursor = ne->cursor - 1;
            *idp = ne->ids[newcursor];
            ne->cursor = newcursor;
            if (newcursor == 0)
                *statep = JSVAL_ZERO;
        } else {
            /* The enumerator has not iterated over all ids. */
            ne->cursor = 0;
        }
        break;
    }
    return JS_TRUE;
}

void
js_TraceNativeEnumerators(JSTracer *trc)
{
    JSRuntime *rt;
    JSNativeEnumerator **nep, *ne;
    jsid *cursor, *end;

    /*
     * Purge native enumerators cached by shape id, which we are about to
     * re-number completely when tracing is done for the GC.
     */
    rt = trc->context->runtime;
    if (IS_GC_MARKING_TRACER(trc)) {
        memset(&rt->nativeEnumCache, 0, sizeof rt->nativeEnumCache);
#ifdef JS_DUMP_ENUM_CACHE_STATS
        printf("nativeEnumCache hit rate %g%%\n",
               100.0 * (rt->nativeEnumProbes - rt->nativeEnumMisses) /
               rt->nativeEnumProbes);
#endif
    }

    nep = &rt->nativeEnumerators;
    while ((ne = *nep) != NULL) {
        JS_ASSERT(ne->length != 0);
        if (ne->cursor != 0) {
            /* Trace ids of the running enumerator. */
            cursor = ne->ids;
            end = cursor + ne->length;
            do {
                TRACE_ID(trc, *cursor);
            } while (++cursor != end);
        } else if (IS_GC_MARKING_TRACER(trc)) {
            js_RemoveAsGCBytes(rt, NativeEnumeratorSize(ne->length));
            *nep = ne->next;
            JS_free(trc->context, ne);
            continue;
        }
        nep = &ne->next;
    }
}

JSBool
js_CheckAccess(JSContext *cx, JSObject *obj, jsid id, JSAccessMode mode,
               jsval *vp, uintN *attrsp)
{
    JSBool writing;
    JSObject *pobj;
    JSProperty *prop;
    JSClass *clasp;
    JSScopeProperty *sprop;
    JSSecurityCallbacks *callbacks;
    JSCheckAccessOp check;

    writing = (mode & JSACC_WRITE) != 0;
    switch (mode & JSACC_TYPEMASK) {
      case JSACC_PROTO:
        pobj = obj;
        if (!writing)
            *vp = OBJECT_TO_JSVAL(OBJ_GET_PROTO(cx, obj));
        *attrsp = JSPROP_PERMANENT;
        break;

      case JSACC_PARENT:
        JS_ASSERT(!writing);
        pobj = obj;
        *vp = OBJECT_TO_JSVAL(OBJ_GET_PARENT(cx, obj));
        *attrsp = JSPROP_READONLY | JSPROP_PERMANENT;
        break;

      default:
        if (!OBJ_LOOKUP_PROPERTY(cx, obj, id, &pobj, &prop))
            return JS_FALSE;
        if (!prop) {
            if (!writing)
                *vp = JSVAL_VOID;
            *attrsp = 0;
            pobj = obj;
            break;
        }

        if (!OBJ_IS_NATIVE(pobj)) {
            OBJ_DROP_PROPERTY(cx, pobj, prop);

            /* Avoid diverging for non-natives that reuse js_CheckAccess. */
            if (pobj->map->ops->checkAccess == js_CheckAccess) {
                if (!writing) {
                    *vp = JSVAL_VOID;
                    *attrsp = 0;
                }
                break;
            }
            return OBJ_CHECK_ACCESS(cx, pobj, id, mode, vp, attrsp);
        }

        sprop = (JSScopeProperty *)prop;
        *attrsp = sprop->attrs;
        if (!writing) {
            *vp = (SPROP_HAS_VALID_SLOT(sprop, OBJ_SCOPE(pobj)))
                  ? LOCKED_OBJ_GET_SLOT(pobj, sprop->slot)
                  : JSVAL_VOID;
        }
        OBJ_DROP_PROPERTY(cx, pobj, prop);
    }

    /*
     * If obj's class has a stub (null) checkAccess hook, use the per-runtime
     * checkObjectAccess callback, if configured.
     *
     * We don't want to require all classes to supply a checkAccess hook; we
     * need that hook only for certain classes used when precompiling scripts
     * and functions ("brutal sharing").  But for general safety of built-in
     * magic properties such as __proto__ and __parent__, we route all access
     * checks, even for classes that stub out checkAccess, through the global
     * checkObjectAccess hook.  This covers precompilation-based sharing and
     * (possibly unintended) runtime sharing across trust boundaries.
     */
    clasp = OBJ_GET_CLASS(cx, pobj);
    check = clasp->checkAccess;
    if (!check) {
        callbacks = JS_GetSecurityCallbacks(cx);
        check = callbacks ? callbacks->checkObjectAccess : NULL;
    }
    return !check || check(cx, pobj, ID_TO_VALUE(id), mode, vp);
}

#ifdef JS_THREADSAFE
void
js_DropProperty(JSContext *cx, JSObject *obj, JSProperty *prop)
{
    JS_UNLOCK_OBJ(cx, obj);
}
#endif

#ifdef NARCISSUS
static JSBool
GetCurrentExecutionContext(JSContext *cx, JSObject *obj, jsval *rval)
{
    JSObject *tmp;
    jsval xcval;

    while ((tmp = OBJ_GET_PARENT(cx, obj)) != NULL)
        obj = tmp;
    if (!OBJ_GET_PROPERTY(cx, obj,
                          ATOM_TO_JSID(cx->runtime->atomState
                                       .ExecutionContextAtom),
                          &xcval)) {
        return JS_FALSE;
    }
    if (JSVAL_IS_PRIMITIVE(xcval)) {
        JS_ReportError(cx, "invalid ExecutionContext in global object");
        return JS_FALSE;
    }
    if (!OBJ_GET_PROPERTY(cx, JSVAL_TO_OBJECT(xcval),
                          ATOM_TO_JSID(cx->runtime->atomState.currentAtom),
                          rval)) {
        return JS_FALSE;
    }
    return JS_TRUE;
}
#endif

JSBool
js_Call(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSClass *clasp;

    clasp = OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(argv[-2]));
    if (!clasp->call) {
#ifdef NARCISSUS
        JSObject *callee, *args;
        jsval fval, nargv[3];
        JSBool ok;

        callee = JSVAL_TO_OBJECT(argv[-2]);
        if (!OBJ_GET_PROPERTY(cx, callee,
                              ATOM_TO_JSID(cx->runtime->atomState.__call__Atom),
                              &fval)) {
            return JS_FALSE;
        }
        if (VALUE_IS_FUNCTION(cx, fval)) {
            if (!GetCurrentExecutionContext(cx, obj, &nargv[2]))
                return JS_FALSE;
            args = js_GetArgsObject(cx, cx->fp);
            if (!args)
                return JS_FALSE;
            nargv[0] = OBJECT_TO_JSVAL(obj);
            nargv[1] = OBJECT_TO_JSVAL(args);
            return js_InternalCall(cx, callee, fval, 3, nargv, rval);
        }
        if (JSVAL_IS_OBJECT(fval) && JSVAL_TO_OBJECT(fval) != callee) {
            argv[-2] = fval;
            ok = js_Call(cx, obj, argc, argv, rval);
            argv[-2] = OBJECT_TO_JSVAL(callee);
            return ok;
        }
#endif
        js_ReportIsNotFunction(cx, &argv[-2], cx->fp->flags & JSFRAME_ITERATOR);
        return JS_FALSE;
    }
    return clasp->call(cx, obj, argc, argv, rval);
}

JSBool
js_Construct(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
             jsval *rval)
{
    JSClass *clasp;

    clasp = OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(argv[-2]));
    if (!clasp->construct) {
#ifdef NARCISSUS
        JSObject *callee, *args;
        jsval cval, nargv[2];
        JSBool ok;

        callee = JSVAL_TO_OBJECT(argv[-2]);
        if (!OBJ_GET_PROPERTY(cx, callee,
                              ATOM_TO_JSID(cx->runtime->atomState
                                           .__construct__Atom),
                              &cval)) {
            return JS_FALSE;
        }
        if (VALUE_IS_FUNCTION(cx, cval)) {
            if (!GetCurrentExecutionContext(cx, obj, &nargv[1]))
                return JS_FALSE;
            args = js_GetArgsObject(cx, cx->fp);
            if (!args)
                return JS_FALSE;
            nargv[0] = OBJECT_TO_JSVAL(args);
            return js_InternalCall(cx, callee, cval, 2, nargv, rval);
        }
        if (JSVAL_IS_OBJECT(cval) && JSVAL_TO_OBJECT(cval) != callee) {
            argv[-2] = cval;
            ok = js_Call(cx, obj, argc, argv, rval);
            argv[-2] = OBJECT_TO_JSVAL(callee);
            return ok;
        }
#endif
        js_ReportIsNotFunction(cx, &argv[-2], JSV2F_CONSTRUCT);
        return JS_FALSE;
    }
    return clasp->construct(cx, obj, argc, argv, rval);
}

JSBool
js_HasInstance(JSContext *cx, JSObject *obj, jsval v, JSBool *bp)
{
    JSClass *clasp;

    clasp = OBJ_GET_CLASS(cx, obj);
    if (clasp->hasInstance)
        return clasp->hasInstance(cx, obj, v, bp);
#ifdef NARCISSUS
    {
        jsval fval, rval;

        if (!OBJ_GET_PROPERTY(cx, obj,
                              ATOM_TO_JSID(cx->runtime->atomState
                                           .__hasInstance__Atom),
                              &fval)) {
            return JS_FALSE;
        }
        if (VALUE_IS_FUNCTION(cx, fval)) {
            if (!js_InternalCall(cx, obj, fval, 1, &v, &rval))
                return JS_FALSE;
            *bp = js_ValueToBoolean(rval);
            return JS_TRUE;
        }
    }
#endif
    js_ReportValueError(cx, JSMSG_BAD_INSTANCEOF_RHS,
                        JSDVG_SEARCH_STACK, OBJECT_TO_JSVAL(obj), NULL);
    return JS_FALSE;
}

JSBool
js_IsDelegate(JSContext *cx, JSObject *obj, jsval v, JSBool *bp)
{
    JSObject *obj2;

    *bp = JS_FALSE;
    if (JSVAL_IS_PRIMITIVE(v))
        return JS_TRUE;
    obj2 = JSVAL_TO_OBJECT(v);
    while ((obj2 = OBJ_GET_PROTO(cx, obj2)) != NULL) {
        if (obj2 == obj) {
            *bp = JS_TRUE;
            break;
        }
    }
    return JS_TRUE;
}

JSBool
js_GetClassPrototype(JSContext *cx, JSObject *scope, jsid id,
                     JSObject **protop)
{
    jsval v;
    JSObject *ctor;

    if (!js_FindClassObject(cx, scope, id, &v))
        return JS_FALSE;
    if (VALUE_IS_FUNCTION(cx, v)) {
        ctor = JSVAL_TO_OBJECT(v);
        if (!OBJ_GET_PROPERTY(cx, ctor,
                              ATOM_TO_JSID(cx->runtime->atomState
                                           .classPrototypeAtom),
                              &v)) {
            return JS_FALSE;
        }
        if (!JSVAL_IS_PRIMITIVE(v)) {
            /*
             * Set the newborn root in case v is otherwise unreferenced.
             * It's ok to overwrite newborn roots here, since the getter
             * called just above could have.  Unlike the common GC rooting
             * model, our callers do not have to protect protop thanks to
             * this newborn root, since they all immediately create a new
             * instance that delegates to this object, or just query the
             * prototype for its class.
             */
            cx->weakRoots.newborn[GCX_OBJECT] = JSVAL_TO_GCTHING(v);
        }
    }
    *protop = JSVAL_IS_OBJECT(v) ? JSVAL_TO_OBJECT(v) : NULL;
    return JS_TRUE;
}

/*
 * For shared precompilation of function objects, we support cloning on entry
 * to an execution context in which the function declaration or expression
 * should be processed as if it were not precompiled, where the precompiled
 * function's scope chain does not match the execution context's.  The cloned
 * function object carries its execution-context scope in its parent slot; it
 * links to the precompiled function (the "clone-parent") via its proto slot.
 *
 * Note that this prototype-based delegation leaves an unchecked access path
 * from the clone to the clone-parent's 'constructor' property.  If the clone
 * lives in a less privileged or shared scope than the clone-parent, this is
 * a security hole, a sharing hazard, or both.  Therefore we check all such
 * accesses with the following getter/setter pair, which we use when defining
 * 'constructor' in f.prototype for all function objects f.
 */
static JSBool
CheckCtorGetAccess(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSAtom *atom;
    uintN attrs;

    atom = cx->runtime->atomState.constructorAtom;
    JS_ASSERT(id == ATOM_TO_JSID(atom));
    return OBJ_CHECK_ACCESS(cx, obj, ATOM_TO_JSID(atom), JSACC_READ,
                            vp, &attrs);
}

static JSBool
CheckCtorSetAccess(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSAtom *atom;
    uintN attrs;

    atom = cx->runtime->atomState.constructorAtom;
    JS_ASSERT(id == ATOM_TO_JSID(atom));
    return OBJ_CHECK_ACCESS(cx, obj, ATOM_TO_JSID(atom), JSACC_WRITE,
                            vp, &attrs);
}

JSBool
js_SetClassPrototype(JSContext *cx, JSObject *ctor, JSObject *proto,
                     uintN attrs)
{
    /*
     * Use the given attributes for the prototype property of the constructor,
     * as user-defined constructors have a DontDelete prototype (which may be
     * reset), while native or "system" constructors have DontEnum | ReadOnly |
     * DontDelete.
     */
    if (!OBJ_DEFINE_PROPERTY(cx, ctor,
                             ATOM_TO_JSID(cx->runtime->atomState
                                          .classPrototypeAtom),
                             OBJECT_TO_JSVAL(proto),
                             JS_PropertyStub, JS_PropertyStub,
                             attrs, NULL)) {
        return JS_FALSE;
    }

    /*
     * ECMA says that Object.prototype.constructor, or f.prototype.constructor
     * for a user-defined function f, is DontEnum.
     */
    return OBJ_DEFINE_PROPERTY(cx, proto,
                               ATOM_TO_JSID(cx->runtime->atomState
                                            .constructorAtom),
                               OBJECT_TO_JSVAL(ctor),
                               CheckCtorGetAccess, CheckCtorSetAccess,
                               0, NULL);
}

JSBool
js_PrimitiveToObject(JSContext *cx, jsval *vp)
{
    JSClass *clasp;
    JSObject *obj;

    /* Table to map primitive value's tag into the corresponding class. */
    JS_STATIC_ASSERT(JSVAL_INT == 1);
    JS_STATIC_ASSERT(JSVAL_DOUBLE == 2);
    JS_STATIC_ASSERT(JSVAL_STRING == 4);
    JS_STATIC_ASSERT(JSVAL_BOOLEAN == 6);
    static JSClass *const PrimitiveClasses[] = {
        &js_NumberClass,    /* INT     */
        &js_NumberClass,    /* DOUBLE  */
        &js_NumberClass,    /* INT     */
        &js_StringClass,    /* STRING  */
        &js_NumberClass,    /* INT     */
        &js_BooleanClass,   /* BOOLEAN */
        &js_NumberClass     /* INT     */
    };

    JS_ASSERT(!JSVAL_IS_OBJECT(*vp));
    JS_ASSERT(!JSVAL_IS_VOID(*vp));
    clasp = PrimitiveClasses[JSVAL_TAG(*vp) - 1];
    obj = js_NewObject(cx, clasp, NULL, NULL, 0);
    if (!obj)
        return JS_FALSE;
    STOBJ_SET_SLOT(obj, JSSLOT_PRIVATE, *vp);
    *vp = OBJECT_TO_JSVAL(obj);
    return JS_TRUE;
}

JSBool
js_ValueToObject(JSContext *cx, jsval v, JSObject **objp)
{
    JSObject *obj;

    if (JSVAL_IS_NULL(v) || JSVAL_IS_VOID(v)) {
        obj = NULL;
    } else if (JSVAL_IS_OBJECT(v)) {
        obj = JSVAL_TO_OBJECT(v);
        if (!OBJ_DEFAULT_VALUE(cx, obj, JSTYPE_OBJECT, &v))
            return JS_FALSE;
        if (JSVAL_IS_OBJECT(v))
            obj = JSVAL_TO_OBJECT(v);
    } else {
        if (!js_PrimitiveToObject(cx, &v))
            return JS_FALSE;
        obj = JSVAL_TO_OBJECT(v);
    }
    *objp = obj;
    return JS_TRUE;
}

JSObject *
js_ValueToNonNullObject(JSContext *cx, jsval v)
{
    JSObject *obj;

    if (!js_ValueToObject(cx, v, &obj))
        return NULL;
    if (!obj)
        js_ReportIsNullOrUndefined(cx, JSDVG_SEARCH_STACK, v, NULL);
    return obj;
}

JSBool
js_TryValueOf(JSContext *cx, JSObject *obj, JSType type, jsval *rval)
{
    jsval argv[1];

    argv[0] = ATOM_KEY(cx->runtime->atomState.typeAtoms[type]);
    return js_TryMethod(cx, obj, cx->runtime->atomState.valueOfAtom, 1, argv,
                        rval);
}

JSBool
js_TryMethod(JSContext *cx, JSObject *obj, JSAtom *atom,
             uintN argc, jsval *argv, jsval *rval)
{
    JSErrorReporter older;
    jsid id;
    jsval fval;
    JSBool ok;

    JS_CHECK_RECURSION(cx, return JS_FALSE);

    /*
     * Report failure only if an appropriate method was found, and calling it
     * returned failure.  We propagate failure in this case to make exceptions
     * behave properly.
     */
    older = JS_SetErrorReporter(cx, NULL);
    id = ATOM_TO_JSID(atom);
    fval = JSVAL_VOID;
#if JS_HAS_XML_SUPPORT
    if (OBJECT_IS_XML(cx, obj)) {
        JSXMLObjectOps *ops;

        ops = (JSXMLObjectOps *) obj->map->ops;
        obj = ops->getMethod(cx, obj, id, &fval);
        ok = (obj != NULL);
    } else
#endif
    {
        ok = OBJ_GET_PROPERTY(cx, obj, id, &fval);
    }
    if (!ok)
        JS_ClearPendingException(cx);
    JS_SetErrorReporter(cx, older);

    return JSVAL_IS_PRIMITIVE(fval) ||
           js_InternalCall(cx, obj, fval, argc, argv, rval);
}

#if JS_HAS_XDR

JSBool
js_XDRObject(JSXDRState *xdr, JSObject **objp)
{
    JSContext *cx;
    JSAtom *atom;
    JSClass *clasp;
    uint32 classId, classDef;
    JSProtoKey protoKey;
    jsid classKey;
    JSObject *proto;

    cx = xdr->cx;
    atom = NULL;
    if (xdr->mode == JSXDR_ENCODE) {
        clasp = OBJ_GET_CLASS(cx, *objp);
        classId = JS_XDRFindClassIdByName(xdr, clasp->name);
        classDef = !classId;
        if (classDef) {
            if (!JS_XDRRegisterClass(xdr, clasp, &classId))
                return JS_FALSE;
            protoKey = JSCLASS_CACHED_PROTO_KEY(clasp);
            if (protoKey != JSProto_Null) {
                classDef |= (protoKey << 1);
            } else {
                atom = js_Atomize(cx, clasp->name, strlen(clasp->name), 0);
                if (!atom)
                    return JS_FALSE;
            }
        }
    } else {
        clasp = NULL;           /* quell GCC overwarning */
        classDef = 0;
    }

    /*
     * XDR a flag word, which could be 0 for a class use, in which case no
     * name follows, only the id in xdr's class registry; 1 for a class def,
     * in which case the flag word is followed by the class name transferred
     * from or to atom; or a value greater than 1, an odd number that when
     * divided by two yields the JSProtoKey for class.  In the last case, as
     * in the 0 classDef case, no name is transferred via atom.
     */
    if (!JS_XDRUint32(xdr, &classDef))
        return JS_FALSE;
    if (classDef == 1 && !js_XDRStringAtom(xdr, &atom))
        return JS_FALSE;

    if (!JS_XDRUint32(xdr, &classId))
        return JS_FALSE;

    if (xdr->mode == JSXDR_DECODE) {
        if (classDef) {
            /* NB: we know that JSProto_Null is 0 here, for backward compat. */
            protoKey = (JSProtoKey) (classDef >> 1);
            classKey = (protoKey != JSProto_Null)
                       ? INT_TO_JSID(protoKey)
                       : ATOM_TO_JSID(atom);
            if (!js_GetClassPrototype(cx, NULL, classKey, &proto))
                return JS_FALSE;
            clasp = OBJ_GET_CLASS(cx, proto);
            if (!JS_XDRRegisterClass(xdr, clasp, &classId))
                return JS_FALSE;
        } else {
            clasp = JS_XDRFindClassById(xdr, classId);
            if (!clasp) {
                char numBuf[12];
                JS_snprintf(numBuf, sizeof numBuf, "%ld", (long)classId);
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_CANT_FIND_CLASS, numBuf);
                return JS_FALSE;
            }
        }
    }

    if (!clasp->xdrObject) {
        JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                             JSMSG_CANT_XDR_CLASS, clasp->name);
        return JS_FALSE;
    }
    return clasp->xdrObject(xdr, objp);
}

#endif /* JS_HAS_XDR */

#ifdef JS_DUMP_SCOPE_METERS

#include <stdio.h>

JSBasicStats js_entry_count_bs = JS_INIT_STATIC_BASIC_STATS;

static void
MeterEntryCount(uintN count)
{
    JS_BASIC_STATS_ACCUM(&js_entry_count_bs, count);
}

void
js_DumpScopeMeters(JSRuntime *rt)
{
    static FILE *logfp;
    if (!logfp)
        logfp = fopen("/tmp/scope.stats", "a");

    {
        double mean, sigma;

        mean = JS_MeanAndStdDevBS(&js_entry_count_bs, &sigma);

        fprintf(logfp, "scopes %u entries %g mean %g sigma %g max %u",
                js_entry_count_bs.num, js_entry_count_bs.sum, mean, sigma,
                js_entry_count_bs.max);
    }

    JS_DumpHistogram(&js_entry_count_bs, logfp);
    JS_BASIC_STATS_INIT(&js_entry_count_bs);
    fflush(logfp);
}
#endif

#ifdef DEBUG
void
js_PrintObjectSlotName(JSTracer *trc, char *buf, size_t bufsize)
{
    JSObject *obj;
    uint32 slot;
    JSScope *scope;
    jsval nval;
    JSScopeProperty *sprop;
    JSClass *clasp;
    uint32 key;
    const char *slotname;

    JS_ASSERT(trc->debugPrinter == js_PrintObjectSlotName);
    obj = (JSObject *)trc->debugPrintArg;
    slot = (uint32)trc->debugPrintIndex;

    if (OBJ_IS_NATIVE(obj)) {
        scope = OBJ_SCOPE(obj);
        sprop = SCOPE_LAST_PROP(scope);
        while (sprop && sprop->slot != slot)
            sprop = sprop->parent;
    } else {
        sprop = NULL;
    }

    if (!sprop) {
        switch (slot) {
          case JSSLOT_PROTO:
            JS_snprintf(buf, bufsize, "__proto__");
            break;
          case JSSLOT_PARENT:
            JS_snprintf(buf, bufsize, "__parent__");
            break;
          default:
            slotname = NULL;
            clasp = LOCKED_OBJ_GET_CLASS(obj);
            if (clasp->flags & JSCLASS_IS_GLOBAL) {
                key = slot - JSSLOT_START(clasp);
#define JS_PROTO(name,code,init) \
    if ((code) == key) { slotname = js_##name##_str; goto found; }
#include "jsproto.tbl"
#undef JS_PROTO
            }
          found:
            if (slotname)
                JS_snprintf(buf, bufsize, "CLASS_OBJECT(%s)", slotname);
            else
                JS_snprintf(buf, bufsize, "**UNKNOWN SLOT %ld**", (long)slot);
            break;
        }
    } else {
        nval = ID_TO_VALUE(sprop->id);
        if (JSVAL_IS_INT(nval)) {
            JS_snprintf(buf, bufsize, "%ld", (long)JSVAL_TO_INT(nval));
        } else if (JSVAL_IS_STRING(nval)) {
            js_PutEscapedString(buf, bufsize, JSVAL_TO_STRING(nval), 0);
        } else {
            JS_snprintf(buf, bufsize, "**FINALIZED ATOM KEY**");
        }
    }
}
#endif

void
js_TraceObject(JSTracer *trc, JSObject *obj)
{
    JSContext *cx;
    JSScope *scope;
    JSBool traceScope;
    JSScopeProperty *sprop;
    JSClass *clasp;
    size_t nslots, i;
    jsval v;

    JS_ASSERT(OBJ_IS_NATIVE(obj));
    cx = trc->context;
    scope = OBJ_SCOPE(obj);

    traceScope = (scope->object == obj);
    if (!traceScope) {
        JSObject *pobj = obj;

        /*
         * Because obj does not own scope, we should be able to assert that an
         * object on obj's prototype chain does -- or scope's properties might
         * go untraced. It indeed turns out that you can disconnect an object
         * from the prototype object whose scope it shares, so we may have to
         * mark scope even though scope->object != obj.
         */
        while ((pobj = LOCKED_OBJ_GET_PROTO(pobj)) != NULL) {
            if (pobj == scope->object)
                break;
        }
        JS_ASSERT_IF(pobj, OBJ_SCOPE(pobj) == scope);
        traceScope = !pobj;
    }

    if (traceScope) {
#ifdef JS_DUMP_SCOPE_METERS
        MeterEntryCount(scope->entryCount);
#endif

        sprop = SCOPE_LAST_PROP(scope);
        if (sprop) {
            JS_ASSERT(SCOPE_HAS_PROPERTY(scope, sprop));

            /* Regenerate property cache shape ids if GC'ing. */
            if (IS_GC_MARKING_TRACER(trc)) {
                uint32 shape, oldshape;

                shape = ++cx->runtime->shapeGen;
                JS_ASSERT(shape != 0);

                if (!(sprop->flags & SPROP_MARK)) {
                    oldshape = sprop->shape;
                    sprop->shape = shape;
                    sprop->flags |= SPROP_FLAG_SHAPE_REGEN;
                    if (scope->shape != oldshape) {
                        shape = ++cx->runtime->shapeGen;
                        JS_ASSERT(shape != 0);
                    }
                }

                scope->shape = shape;
            }

            /* Trace scope's property tree ancestor line. */
            do {
                if (SCOPE_HAD_MIDDLE_DELETE(scope) &&
                    !SCOPE_HAS_PROPERTY(scope, sprop)) {
                    continue;
                }
                TRACE_SCOPE_PROPERTY(trc, sprop);
            } while ((sprop = sprop->parent) != NULL);
        }
    }

    if (!JS_CLIST_IS_EMPTY(&cx->runtime->watchPointList))
        js_TraceWatchPoints(trc, obj);

    /* No one runs while the GC is running, so we can use LOCKED_... here. */
    clasp = LOCKED_OBJ_GET_CLASS(obj);
    if (clasp->mark) {
        if (clasp->flags & JSCLASS_MARK_IS_TRACE)
            ((JSTraceOp) clasp->mark)(trc, obj);
        else if (IS_GC_MARKING_TRACER(trc))
            (void) clasp->mark(cx, obj, trc);
    }

    /*
     * An unmutated object that shares a prototype object's scope. We can't
     * tell how many slots are in use in obj by looking at its scope, so we
     * use STOBJ_NSLOTS(obj).
     *
     * NB: In case clasp->mark mutates something, leave this code here --
     * don't move it up and unify it with the |if (!traceScope)| section
     * above.
     */
    nslots = STOBJ_NSLOTS(obj);
    if (scope->object == obj && scope->map.freeslot < nslots)
        nslots = scope->map.freeslot;

    for (i = 0; i != nslots; ++i) {
        v = STOBJ_GET_SLOT(obj, i);
        if (JSVAL_IS_TRACEABLE(v)) {
            JS_SET_TRACING_DETAILS(trc, js_PrintObjectSlotName, obj, i);
            JS_CallTracer(trc, JSVAL_TO_TRACEABLE(v), JSVAL_TRACE_KIND(v));
        }
    }
}

void
js_Clear(JSContext *cx, JSObject *obj)
{
    JSScope *scope;
    uint32 i, n;

    /*
     * Clear our scope and the property cache of all obj's properties only if
     * obj owns the scope (i.e., not if obj is unmutated and therefore sharing
     * its prototype's scope).  NB: we do not clear any reserved slots lying
     * below JSSLOT_FREE(clasp).
     */
    JS_LOCK_OBJ(cx, obj);
    scope = OBJ_SCOPE(obj);
    if (scope->object == obj) {
        /* Now that we're done using scope->lastProp/table, clear scope. */
        js_ClearScope(cx, scope);

        /* Clear slot values and reset freeslot so we're consistent. */
        i = STOBJ_NSLOTS(obj);
        n = JSSLOT_FREE(LOCKED_OBJ_GET_CLASS(obj));
        while (--i >= n)
            STOBJ_SET_SLOT(obj, i, JSVAL_VOID);
        scope->map.freeslot = n;
    }
    JS_UNLOCK_OBJ(cx, obj);
}

jsval
js_GetRequiredSlot(JSContext *cx, JSObject *obj, uint32 slot)
{
    jsval v;

    JS_LOCK_OBJ(cx, obj);
    v = (slot < STOBJ_NSLOTS(obj)) ? STOBJ_GET_SLOT(obj, slot) : JSVAL_VOID;
    JS_UNLOCK_OBJ(cx, obj);
    return v;
}

JSBool
js_SetRequiredSlot(JSContext *cx, JSObject *obj, uint32 slot, jsval v)
{
    JSScope *scope;
    uint32 nslots;
    JSClass *clasp;

    JS_LOCK_OBJ(cx, obj);
    scope = OBJ_SCOPE(obj);
    if (slot >= JS_INITIAL_NSLOTS && !obj->dslots) {
        /*
         * At this point, obj may or may not own scope.  If some path calls
         * js_GetMutableScope but does not add a slot-owning property, then
         * scope->object == obj but obj->dslots will be null. If obj shares a
         * prototype's scope, then we cannot update scope->map here. Instead
         * we rely on STOBJ_NSLOTS(obj) to get the number of available slots
         * in obj after we allocate dynamic slots.
         *
         * See js_TraceObject, before the slot tracing, where we make a special
         * case for unmutated (scope->object != obj) objects.
         */
        clasp = LOCKED_OBJ_GET_CLASS(obj);
        nslots = JSSLOT_FREE(clasp);
        if (clasp->reserveSlots)
            nslots += clasp->reserveSlots(cx, obj);
        JS_ASSERT(slot < nslots);
        if (!js_ReallocSlots(cx, obj, nslots, JS_TRUE)) {
            JS_UNLOCK_SCOPE(cx, scope);
            return JS_FALSE;
        }
    }

    /* Whether or not we grew nslots, we may need to advance freeslot. */
    if (scope->object == obj && slot >= scope->map.freeslot)
        scope->map.freeslot = slot + 1;

    STOBJ_SET_SLOT(obj, slot, v);
    JS_UNLOCK_SCOPE(cx, scope);
    return JS_TRUE;
}

JSObject *
js_GetWrappedObject(JSContext *cx, JSObject *obj)
{
    JSClass *clasp;

    clasp = OBJ_GET_CLASS(cx, obj);
    if (clasp->flags & JSCLASS_IS_EXTENDED) {
        JSExtendedClass *xclasp;
        JSObject *obj2;

        xclasp = (JSExtendedClass *)clasp;
        if (xclasp->wrappedObject && (obj2 = xclasp->wrappedObject(cx, obj)))
            return obj2;
    }
    return obj;
}

#if DEBUG

/*
 * Routines to print out values during debugging.  These are FRIEND_API to help
 * the debugger find them and to support temporarily hacking js_Dump* calls
 * into other code.
 */

void
dumpChars(const jschar *s, size_t n)
{
    size_t i;

    if (n == (size_t) -1) {
        while (s[++n]) ;
    }

    fputc('"', stderr);
    for (i = 0; i < n; i++) {
        if (s[i] == '\n')
            fprintf(stderr, "\\n");
        else if (s[i] == '\t')
            fprintf(stderr, "\\t");
        else if (s[i] >= 32 && s[i] < 127)
            fputc(s[i], stderr);
        else if (s[i] <= 255)
            fprintf(stderr, "\\x%02x", (unsigned int) s[i]);
        else
            fprintf(stderr, "\\u%04x", (unsigned int) s[i]);
    }
    fputc('"', stderr);
}

JS_FRIEND_API(void)
js_DumpChars(const jschar *s, size_t n)
{
    fprintf(stderr, "jschar * (%p) = ", (void *) s);
    dumpChars(s, n);
    fputc('\n', stderr);
}

void
dumpString(JSString *str)
{
    dumpChars(JSSTRING_CHARS(str), JSSTRING_LENGTH(str));
}

JS_FRIEND_API(void)
js_DumpString(JSString *str)
{
    fprintf(stderr, "JSString* (%p) = jschar * (%p) = ",
            (void *) str, (void *) JSSTRING_CHARS(str));
    dumpString(str);
    fputc('\n', stderr);
}

JS_FRIEND_API(void)
js_DumpAtom(JSAtom *atom)
{
    fprintf(stderr, "JSAtom* (%p) = ", (void *) atom);
    js_DumpValue(ATOM_KEY(atom));
}

void
dumpValue(jsval val)
{
    if (JSVAL_IS_NULL(val)) {
        fprintf(stderr, "null");
    } else if (JSVAL_IS_VOID(val)) {
        fprintf(stderr, "undefined");
    } else if (JSVAL_IS_OBJECT(val)) {
        JSObject *obj = JSVAL_TO_OBJECT(val);
        JSClass *cls = STOBJ_GET_CLASS(obj);
        fprintf(stderr, "<%s%s at %p>",
                cls->name,
                cls == &js_ObjectClass ? "" : " object",
                obj);
    } else if (JSVAL_IS_INT(val)) {
        fprintf(stderr, "%d", JSVAL_TO_INT(val));
    } else if (JSVAL_IS_STRING(val)) {
        dumpString(JSVAL_TO_STRING(val));
    } else if (JSVAL_IS_DOUBLE(val)) {
        fprintf(stderr, "%g", *JSVAL_TO_DOUBLE(val));
    } else if (val == JSVAL_TRUE) {
        fprintf(stderr, "true");
    } else if (val == JSVAL_FALSE) {
        fprintf(stderr, "false");
    } else if (val == JSVAL_HOLE) {
        fprintf(stderr, "hole");
    } else {
        /* jsvals are pointer-sized, and %p is portable */
        fprintf(stderr, "unrecognized jsval %p", (void *) val);
    }
}

JS_FRIEND_API(void)
js_DumpValue(jsval val)
{
    fprintf(stderr, "jsval %d (%p) = ", (int) val, (void *) val);
    dumpValue(val);
    fputc('\n', stderr);
}

JS_FRIEND_API(void)
js_DumpId(jsid id)
{
    fprintf(stderr, "id %d (%p) = ", (int) id, (void *) id);
    dumpValue(ID_TO_VALUE(id));
    fputc('\n', stderr);
}

static void
dumpScopeProp(JSScopeProperty *sprop)
{
    jsid id = sprop->id;
    uint8 attrs = sprop->attrs;

    fprintf(stderr, "    ");
    if (attrs & JSPROP_ENUMERATE) fprintf(stderr, "enumerate ");
    if (attrs & JSPROP_READONLY) fprintf(stderr, "readonly ");
    if (attrs & JSPROP_PERMANENT) fprintf(stderr, "permanent ");
    if (attrs & JSPROP_GETTER) fprintf(stderr, "getter ");
    if (attrs & JSPROP_SETTER) fprintf(stderr, "setter ");
    if (attrs & JSPROP_SHARED) fprintf(stderr, "shared ");
    if (sprop->flags & SPROP_IS_ALIAS) fprintf(stderr, "alias ");
    if (JSID_IS_ATOM(id))
        dumpString(JSVAL_TO_STRING(ID_TO_VALUE(id)));
    else if (JSID_IS_INT(id))
        fprintf(stderr, "%d", (int) JSID_TO_INT(id));
    else
        fprintf(stderr, "unknown jsid %p", (void *) id);
    fprintf(stderr, ": slot %d", sprop->slot);
    fprintf(stderr, "\n");
}

JS_FRIEND_API(void)
js_DumpObject(JSObject *obj)
{
    uint32 i, slots;
    JSClass *clasp;
    jsuint reservedEnd;
    JSBool sharesScope = JS_FALSE;

    fprintf(stderr, "object %p\n", (void *) obj);
    clasp = STOBJ_GET_CLASS(obj);
    fprintf(stderr, "class %p %s\n", (void *)clasp, clasp->name);

    /* OBJ_IS_DENSE_ARRAY ignores the cx argument. */
    if (OBJ_IS_DENSE_ARRAY(BOGUS_CX, obj)) {
        slots = JS_MIN((jsuint) obj->fslots[JSSLOT_ARRAY_LENGTH],
                       ARRAY_DENSE_LENGTH(obj));
        fprintf(stderr, "elements\n");
        for (i = 0; i < slots; i++) {
            fprintf(stderr, " %3d: ", i);
            dumpValue(obj->dslots[i]);
            fprintf(stderr, "\n");
            fflush(stderr);
        }
        return;
    }

    if (OBJ_IS_NATIVE(obj)) {
        JSScope *scope = OBJ_SCOPE(obj);
        JSObject *proto = STOBJ_GET_PROTO(obj);

        if (SCOPE_IS_SEALED(scope))
            fprintf(stderr, "sealed\n");

        sharesScope = (scope->object != obj);
        if (sharesScope) {
            fprintf(stderr, "no own properties - see proto (%s at %p)\n",
                    STOBJ_GET_CLASS(proto)->name, proto);
        } else {
            fprintf(stderr, "properties:\n");
            for (JSScopeProperty *sprop = SCOPE_LAST_PROP(scope); sprop;
                 sprop = sprop->parent) {
                if (!SCOPE_HAD_MIDDLE_DELETE(scope) ||
                    SCOPE_HAS_PROPERTY(scope, sprop)) {
                    dumpScopeProp(sprop);
                }
            }
        }
    } else {
        if (!OBJ_IS_NATIVE(obj))
            fprintf(stderr, "not native\n");
    }

    fprintf(stderr, "slots:\n");
    reservedEnd = JSSLOT_PRIVATE;
    if (clasp->flags & JSCLASS_HAS_PRIVATE)
        reservedEnd++;
    reservedEnd += JSCLASS_RESERVED_SLOTS(clasp);
    slots = sharesScope ? reservedEnd : obj->map->freeslot;
    for (i = 0; i < slots; i++) {
        fprintf(stderr, " %3d ", i);
        if (i == JSSLOT_PRIVATE && (clasp->flags & JSCLASS_HAS_PRIVATE)) {
            fprintf(stderr, "(private) = %p\n",
                    JSVAL_TO_PRIVATE(STOBJ_GET_SLOT(obj, i)));
            continue;
        }
        if (i == JSSLOT_PROTO)
            fprintf(stderr, "(proto) ");
        else if (i == JSSLOT_PARENT)
            fprintf(stderr, "(parent) ");
        else if (i < reservedEnd)
            fprintf(stderr, "(reserved) ");
        fprintf(stderr, "= ");
        dumpValue(STOBJ_GET_SLOT(obj, i));
        fputc('\n', stderr);
    }
    fputc('\n', stderr);
}

#endif
