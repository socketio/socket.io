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

#ifndef jspubtd_h___
#define jspubtd_h___
/*
 * JS public API typedefs.
 */
#include "jstypes.h"
#include "jscompat.h"

JS_BEGIN_EXTERN_C

/* Scalar typedefs. */
typedef uint16    jschar;
typedef int32     jsint;
typedef uint32    jsuint;
typedef float64   jsdouble;
typedef jsword    jsval;
typedef jsword    jsid;
typedef int32     jsrefcount;   /* PRInt32 if JS_THREADSAFE, see jslock.h */

/*
 * Run-time version enumeration.  See jsversion.h for compile-time counterparts
 * to these values that may be selected by the JS_VERSION macro, and tested by
 * #if expressions.
 */
typedef enum JSVersion {
    JSVERSION_1_0     = 100,
    JSVERSION_1_1     = 110,
    JSVERSION_1_2     = 120,
    JSVERSION_1_3     = 130,
    JSVERSION_1_4     = 140,
    JSVERSION_ECMA_3  = 148,
    JSVERSION_1_5     = 150,
    JSVERSION_1_6     = 160,
    JSVERSION_1_7     = 170,
    JSVERSION_1_8     = 180,
    JSVERSION_DEFAULT = 0,
    JSVERSION_UNKNOWN = -1,
    JSVERSION_LATEST  = JSVERSION_1_8
} JSVersion;

#define JSVERSION_IS_ECMA(version) \
    ((version) == JSVERSION_DEFAULT || (version) >= JSVERSION_1_3)

/* Result of typeof operator enumeration. */
typedef enum JSType {
    JSTYPE_VOID,                /* undefined */
    JSTYPE_OBJECT,              /* object */
    JSTYPE_FUNCTION,            /* function */
    JSTYPE_STRING,              /* string */
    JSTYPE_NUMBER,              /* number */
    JSTYPE_BOOLEAN,             /* boolean */
    JSTYPE_NULL,                /* null */
    JSTYPE_XML,                 /* xml object */
    JSTYPE_LIMIT
} JSType;

/* Dense index into cached prototypes and class atoms for standard objects. */
typedef enum JSProtoKey {
#define JS_PROTO(name,code,init) JSProto_##name = code,
#include "jsproto.tbl"
#undef JS_PROTO
    JSProto_LIMIT
} JSProtoKey;

/* JSObjectOps.checkAccess mode enumeration. */
typedef enum JSAccessMode {
    JSACC_PROTO  = 0,           /* XXXbe redundant w.r.t. id */
    JSACC_PARENT = 1,           /* XXXbe redundant w.r.t. id */

                                /* 
                                 * enum value #2 formerly called JSACC_IMPORT, 
                                 * gap preserved for liveconnect ABI compatibility.
                                 */

    JSACC_WATCH  = 3,           /* a watchpoint on object foo for id 'bar' */
    JSACC_READ   = 4,           /* a "get" of foo.bar */
    JSACC_WRITE  = 8,           /* a "set" of foo.bar = baz */
    JSACC_LIMIT
} JSAccessMode;

#define JSACC_TYPEMASK          (JSACC_WRITE - 1)

/*
 * This enum type is used to control the behavior of a JSObject property
 * iterator function that has type JSNewEnumerate.
 */
typedef enum JSIterateOp {
    JSENUMERATE_INIT,       /* Create new iterator state */
    JSENUMERATE_NEXT,       /* Iterate once */
    JSENUMERATE_DESTROY     /* Destroy iterator state */
} JSIterateOp;

/* Struct typedefs. */
typedef struct JSClass           JSClass;
typedef struct JSExtendedClass   JSExtendedClass;
typedef struct JSConstDoubleSpec JSConstDoubleSpec;
typedef struct JSContext         JSContext;
typedef struct JSErrorReport     JSErrorReport;
typedef struct JSFunction        JSFunction;
typedef struct JSFunctionSpec    JSFunctionSpec;
typedef struct JSTracer          JSTracer;
typedef struct JSIdArray         JSIdArray;
typedef struct JSProperty        JSProperty;
typedef struct JSPropertySpec    JSPropertySpec;
typedef struct JSObject          JSObject;
typedef struct JSObjectMap       JSObjectMap;
typedef struct JSObjectOps       JSObjectOps;
typedef struct JSXMLObjectOps    JSXMLObjectOps;
typedef struct JSRuntime         JSRuntime;
typedef struct JSRuntime         JSTaskState;   /* XXX deprecated name */
typedef struct JSScript          JSScript;
typedef struct JSStackFrame      JSStackFrame;
typedef struct JSString          JSString;
typedef struct JSXDRState        JSXDRState;
typedef struct JSExceptionState  JSExceptionState;
typedef struct JSLocaleCallbacks JSLocaleCallbacks;
typedef struct JSSecurityCallbacks JSSecurityCallbacks;
typedef struct JSONParser        JSONParser;

/* JSClass (and JSObjectOps where appropriate) function pointer typedefs. */

/*
 * Add, delete, get or set a property named by id in obj.  Note the jsval id
 * type -- id may be a string (Unicode property identifier) or an int (element
 * index).  The *vp out parameter, on success, is the new property value after
 * an add, get, or set.  After a successful delete, *vp is JSVAL_FALSE iff
 * obj[id] can't be deleted (because it's permanent).
 */
typedef JSBool
(* JSPropertyOp)(JSContext *cx, JSObject *obj, jsval id, jsval *vp);

/*
 * This function type is used for callbacks that enumerate the properties of
 * a JSObject.  The behavior depends on the value of enum_op:
 *
 *  JSENUMERATE_INIT
 *    A new, opaque iterator state should be allocated and stored in *statep.
 *    (You can use PRIVATE_TO_JSVAL() to tag the pointer to be stored).
 *
 *    The number of properties that will be enumerated should be returned as
 *    an integer jsval in *idp, if idp is non-null, and provided the number of
 *    enumerable properties is known.  If idp is non-null and the number of
 *    enumerable properties can't be computed in advance, *idp should be set
 *    to JSVAL_ZERO.
 *
 *  JSENUMERATE_NEXT
 *    A previously allocated opaque iterator state is passed in via statep.
 *    Return the next jsid in the iteration using *idp.  The opaque iterator
 *    state pointed at by statep is destroyed and *statep is set to JSVAL_NULL
 *    if there are no properties left to enumerate.
 *
 *  JSENUMERATE_DESTROY
 *    Destroy the opaque iterator state previously allocated in *statep by a
 *    call to this function when enum_op was JSENUMERATE_INIT.
 *
 * The return value is used to indicate success, with a value of JS_FALSE
 * indicating failure.
 */
typedef JSBool
(* JSNewEnumerateOp)(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
                     jsval *statep, jsid *idp);

/*
 * The old-style JSClass.enumerate op should define all lazy properties not
 * yet reflected in obj.
 */
typedef JSBool
(* JSEnumerateOp)(JSContext *cx, JSObject *obj);

/*
 * Resolve a lazy property named by id in obj by defining it directly in obj.
 * Lazy properties are those reflected from some peer native property space
 * (e.g., the DOM attributes for a given node reflected as obj) on demand.
 *
 * JS looks for a property in an object, and if not found, tries to resolve
 * the given id.  If resolve succeeds, the engine looks again in case resolve
 * defined obj[id].  If no such property exists directly in obj, the process
 * is repeated with obj's prototype, etc.
 *
 * NB: JSNewResolveOp provides a cheaper way to resolve lazy properties.
 */
typedef JSBool
(* JSResolveOp)(JSContext *cx, JSObject *obj, jsval id);

/*
 * Like JSResolveOp, but flags provide contextual information as follows:
 *
 *  JSRESOLVE_QUALIFIED   a qualified property id: obj.id or obj[id], not id
 *  JSRESOLVE_ASSIGNING   obj[id] is on the left-hand side of an assignment
 *  JSRESOLVE_DETECTING   'if (o.p)...' or similar detection opcode sequence
 *  JSRESOLVE_DECLARING   var, const, or function prolog declaration opcode
 *  JSRESOLVE_CLASSNAME   class name used when constructing
 *
 * The *objp out parameter, on success, should be null to indicate that id
 * was not resolved; and non-null, referring to obj or one of its prototypes,
 * if id was resolved.
 *
 * This hook instead of JSResolveOp is called via the JSClass.resolve member
 * if JSCLASS_NEW_RESOLVE is set in JSClass.flags.
 *
 * Setting JSCLASS_NEW_RESOLVE and JSCLASS_NEW_RESOLVE_GETS_START further
 * extends this hook by passing in the starting object on the prototype chain
 * via *objp.  Thus a resolve hook implementation may define the property id
 * being resolved in the object in which the id was first sought, rather than
 * in a prototype object whose class led to the resolve hook being called.
 *
 * When using JSCLASS_NEW_RESOLVE_GETS_START, the resolve hook must therefore
 * null *objp to signify "not resolved".  With only JSCLASS_NEW_RESOLVE and no
 * JSCLASS_NEW_RESOLVE_GETS_START, the hook can assume *objp is null on entry.
 * This is not good practice, but enough existing hook implementations count
 * on it that we can't break compatibility by passing the starting object in
 * *objp without a new JSClass flag.
 */
typedef JSBool
(* JSNewResolveOp)(JSContext *cx, JSObject *obj, jsval id, uintN flags,
                   JSObject **objp);

/*
 * Convert obj to the given type, returning true with the resulting value in
 * *vp on success, and returning false on error or exception.
 */
typedef JSBool
(* JSConvertOp)(JSContext *cx, JSObject *obj, JSType type, jsval *vp);

/*
 * Finalize obj, which the garbage collector has determined to be unreachable
 * from other live objects or from GC roots.  Obviously, finalizers must never
 * store a reference to obj.
 */
typedef void
(* JSFinalizeOp)(JSContext *cx, JSObject *obj);

/*
 * Used by JS_AddExternalStringFinalizer and JS_RemoveExternalStringFinalizer
 * to extend and reduce the set of string types finalized by the GC.
 */
typedef void
(* JSStringFinalizeOp)(JSContext *cx, JSString *str);

/*
 * The signature for JSClass.getObjectOps, used by JS_NewObject's internals
 * to discover the set of high-level object operations to use for new objects
 * of the given class.  All native objects have a JSClass, which is stored as
 * a private (int-tagged) pointer in obj slots. In contrast, all native and
 * host objects have a JSObjectMap at obj->map, which may be shared among a
 * number of objects, and which contains the JSObjectOps *ops pointer used to
 * dispatch object operations from API calls.
 *
 * Thus JSClass (which pre-dates JSObjectOps in the API) provides a low-level
 * interface to class-specific code and data, while JSObjectOps allows for a
 * higher level of operation, which does not use the object's class except to
 * find the class's JSObjectOps struct, by calling clasp->getObjectOps, and to
 * finalize the object.
 *
 * If this seems backwards, that's because it is!  API compatibility requires
 * a JSClass *clasp parameter to JS_NewObject, etc.  Most host objects do not
 * need to implement the larger JSObjectOps, and can share the common JSScope
 * code and data used by the native (js_ObjectOps, see jsobj.c) ops.
 *
 * Further extension to preserve API compatibility: if this function returns
 * a pointer to JSXMLObjectOps.base, not to JSObjectOps, then the engine calls
 * extended hooks needed for E4X.
 */
typedef JSObjectOps *
(* JSGetObjectOps)(JSContext *cx, JSClass *clasp);

/*
 * JSClass.checkAccess type: check whether obj[id] may be accessed per mode,
 * returning false on error/exception, true on success with obj[id]'s last-got
 * value in *vp, and its attributes in *attrsp.  As for JSPropertyOp above, id
 * is either a string or an int jsval.
 *
 * See JSCheckAccessIdOp, below, for the JSObjectOps counterpart, which takes
 * a jsid (a tagged int or aligned, unique identifier pointer) rather than a
 * jsval.  The native js_ObjectOps.checkAccess simply forwards to the object's
 * clasp->checkAccess, so that both JSClass and JSObjectOps implementors may
 * specialize access checks.
 */
typedef JSBool
(* JSCheckAccessOp)(JSContext *cx, JSObject *obj, jsval id, JSAccessMode mode,
                    jsval *vp);

/*
 * Encode or decode an object, given an XDR state record representing external
 * data.  See jsxdrapi.h.
 */
typedef JSBool
(* JSXDRObjectOp)(JSXDRState *xdr, JSObject **objp);

/*
 * Check whether v is an instance of obj.  Return false on error or exception,
 * true on success with JS_TRUE in *bp if v is an instance of obj, JS_FALSE in
 * *bp otherwise.
 */
typedef JSBool
(* JSHasInstanceOp)(JSContext *cx, JSObject *obj, jsval v, JSBool *bp);

/*
 * Deprecated function type for JSClass.mark. All new code should define
 * JSTraceOp instead to ensure the traversal of traceable things stored in
 * the native structures.
 */
typedef uint32
(* JSMarkOp)(JSContext *cx, JSObject *obj, void *arg);

/*
 * Function type for trace operation of the class called to enumerate all
 * traceable things reachable from obj's private data structure. For each such
 * thing, a trace implementation must call
 *
 *    JS_CallTracer(trc, thing, kind);
 *
 * or one of its convenience macros as described in jsapi.h.
 *
 * JSTraceOp implementation can assume that no other threads mutates object
 * state. It must not change state of the object or corresponding native
 * structures. The only exception for this rule is the case when the embedding
 * needs a tight integration with GC. In that case the embedding can check if
 * the traversal is a part of the marking phase through calling
 * JS_IsGCMarkingTracer and apply a special code like emptying caches or
 * marking its native structures.
 *
 * To define the tracer for a JSClass, the implementation must add
 * JSCLASS_MARK_IS_TRACE to class flags and use JS_CLASS_TRACE(method)
 * macro below to convert JSTraceOp to JSMarkOp when initializing or
 * assigning JSClass.mark field.
 */
typedef void
(* JSTraceOp)(JSTracer *trc, JSObject *obj);

#if defined __GNUC__ && __GNUC__ >= 4 && !defined __cplusplus
# define JS_CLASS_TRACE(method)                                               \
    (__builtin_types_compatible_p(JSTraceOp, __typeof(&(method)))             \
     ? (JSMarkOp)(method)                                                     \
     : js_WrongTypeForClassTracer)

extern JSMarkOp js_WrongTypeForClassTracer;

#else
# define JS_CLASS_TRACE(method) ((JSMarkOp)(method))
#endif

/*
 * Tracer callback, called for each traceable thing directly refrenced by a
 * particular object or runtime structure. It is the callback responsibility
 * to ensure the traversal of the full object graph via calling eventually
 * JS_TraceChildren on the passed thing. In this case the callback must be
 * prepared to deal with cycles in the traversal graph.
 *
 * kind argument is one of JSTRACE_OBJECT, JSTRACE_DOUBLE, JSTRACE_STRING or
 * a tag denoting internal implementation-specific traversal kind. In the
 * latter case the only operations on thing that the callback can do is to call
 * JS_TraceChildren or DEBUG-only JS_PrintTraceThingInfo.
 */
typedef void
(* JSTraceCallback)(JSTracer *trc, void *thing, uint32 kind);

/*
 * DEBUG only callback that JSTraceOp implementation can provide to return
 * a string describing the reference traced with JS_CallTracer.
 */
#ifdef DEBUG
typedef void
(* JSTraceNamePrinter)(JSTracer *trc, char *buf, size_t bufsize);
#endif

/*
 * The optional JSClass.reserveSlots hook allows a class to make computed
 * per-instance object slots reservations, in addition to or instead of using
 * JSCLASS_HAS_RESERVED_SLOTS(n) in the JSClass.flags initializer to reserve
 * a constant-per-class number of slots.  Implementations of this hook should
 * return the number of slots to reserve, not including any reserved by using
 * JSCLASS_HAS_RESERVED_SLOTS(n) in JSClass.flags.
 *
 * NB: called with obj locked by the JSObjectOps-specific mutual exclusion
 * mechanism appropriate for obj, so don't nest other operations that might
 * also lock obj.
 */
typedef uint32
(* JSReserveSlotsOp)(JSContext *cx, JSObject *obj);

/* JSObjectOps function pointer typedefs. */

/*
 * Create a new subclass of JSObjectMap (see jsobj.h), with the nrefs and ops
 * members initialized from the same-named parameters, and with the nslots and
 * freeslot members initialized according to ops and clasp.  Return null on
 * error, non-null on success.
 *
 * JSObjectMaps are reference-counted by generic code in the engine.  Usually,
 * the nrefs parameter to JSObjectOps.newObjectMap will be 1, to count the ref
 * returned to the caller on success.  After a successful construction, some
 * number of js_HoldObjectMap and js_DropObjectMap calls ensue.  When nrefs
 * reaches 0 due to a js_DropObjectMap call, JSObjectOps.destroyObjectMap will
 * be called to dispose of the map.
 */
typedef JSObjectMap *
(* JSNewObjectMapOp)(JSContext *cx, jsrefcount nrefs, JSObjectOps *ops,
                     JSClass *clasp, JSObject *obj);

/*
 * Generic type for an infallible JSObjectMap operation, used currently by
 * JSObjectOps.destroyObjectMap.
 */
typedef void
(* JSObjectMapOp)(JSContext *cx, JSObjectMap *map);

/*
 * Look for id in obj and its prototype chain, returning false on error or
 * exception, true on success.  On success, return null in *propp if id was
 * not found.  If id was found, return the first object searching from obj
 * along its prototype chain in which id names a direct property in *objp, and
 * return a non-null, opaque property pointer in *propp.
 *
 * If JSLookupPropOp succeeds and returns with *propp non-null, that pointer
 * may be passed as the prop parameter to a JSAttributesOp, as a short-cut
 * that bypasses id re-lookup.  In any case, a non-null *propp result after a
 * successful lookup must be dropped via JSObjectOps.dropProperty.
 *
 * NB: successful return with non-null *propp means the implementation may
 * have locked *objp and added a reference count associated with *propp, so
 * callers should not risk deadlock by nesting or interleaving other lookups
 * or any obj-bearing ops before dropping *propp.
 */
typedef JSBool
(* JSLookupPropOp)(JSContext *cx, JSObject *obj, jsid id, JSObject **objp,
                   JSProperty **propp);

/*
 * Define obj[id], a direct property of obj named id, having the given initial
 * value, with the specified getter, setter, and attributes.  If the propp out
 * param is non-null, *propp on successful return contains an opaque property
 * pointer usable as a speedup hint with JSAttributesOp.  But note that propp
 * may be null, indicating that the caller is not interested in recovering an
 * opaque pointer to the newly-defined property.
 *
 * If propp is non-null and JSDefinePropOp succeeds, its caller must be sure
 * to drop *propp using JSObjectOps.dropProperty in short order, just as with
 * JSLookupPropOp.
 */
typedef JSBool
(* JSDefinePropOp)(JSContext *cx, JSObject *obj, jsid id, jsval value,
                   JSPropertyOp getter, JSPropertyOp setter, uintN attrs,
                   JSProperty **propp);

/*
 * Get, set, or delete obj[id], returning false on error or exception, true
 * on success.  If getting or setting, the new value is returned in *vp on
 * success.  If deleting without error, *vp will be JSVAL_FALSE if obj[id] is
 * permanent, and JSVAL_TRUE if id named a direct property of obj that was in
 * fact deleted, or if id names no direct property of obj (id could name a
 * prototype property, or no property in obj or its prototype chain).
 */
typedef JSBool
(* JSPropertyIdOp)(JSContext *cx, JSObject *obj, jsid id, jsval *vp);

/*
 * Get or set attributes of the property obj[id].  Return false on error or
 * exception, true with current attributes in *attrsp.  If prop is non-null,
 * it must come from the *propp out parameter of a prior JSDefinePropOp or
 * JSLookupPropOp call.
 */
typedef JSBool
(* JSAttributesOp)(JSContext *cx, JSObject *obj, jsid id, JSProperty *prop,
                   uintN *attrsp);

/*
 * JSObjectOps.checkAccess type: check whether obj[id] may be accessed per
 * mode, returning false on error/exception, true on success with obj[id]'s
 * last-got value in *vp, and its attributes in *attrsp.
 */
typedef JSBool
(* JSCheckAccessIdOp)(JSContext *cx, JSObject *obj, jsid id, JSAccessMode mode,
                      jsval *vp, uintN *attrsp);

/*
 * A generic type for functions mapping an object to another object, or null
 * if an error or exception was thrown on cx.  Used by JSObjectOps.thisObject
 * at present.
 */
typedef JSObject *
(* JSObjectOp)(JSContext *cx, JSObject *obj);

/*
 * Hook that creates an iterator object for a given object. Returns the
 * iterator object or null if an error or exception was thrown on cx.
 */
typedef JSObject *
(* JSIteratorOp)(JSContext *cx, JSObject *obj, JSBool keysonly);

/*
 * A generic type for functions taking a context, object, and property, with
 * no return value.  Used by JSObjectOps.dropProperty currently (see above,
 * JSDefinePropOp and JSLookupPropOp, for the object-locking protocol in which
 * dropProperty participates).
 */
typedef void
(* JSPropertyRefOp)(JSContext *cx, JSObject *obj, JSProperty *prop);

/*
 * Function pointer type for JSObjectOps.setProto and JSObjectOps.setParent.
 * These hooks must check for cycles without deadlocking, and otherwise take
 * special steps. See jsobj.c and jsgc.c for details.
 */
typedef JSBool
(* JSSetObjectSlotOp)(JSContext *cx, JSObject *obj, uint32 slot,
                      JSObject *pobj);

/*
 * Get and set a required slot, one that should already have been allocated.
 * These operations are infallible, so required slots must be pre-allocated,
 * or implementations must suppress out-of-memory errors.  The native ops
 * (js_ObjectOps, see jsobj.c) access slots reserved by including a call to
 * the JSCLASS_HAS_RESERVED_SLOTS(n) macro in the JSClass.flags initializer.
 *
 * NB: the slot parameter is a zero-based index into obj slots, unlike the
 * index parameter to the JS_GetReservedSlot and JS_SetReservedSlot API entry
 * points, which is a zero-based index into the JSCLASS_RESERVED_SLOTS(clasp)
 * reserved slots that come after the initial well-known slots: proto, parent,
 * class, and optionally, the private data slot.
 */
typedef jsval
(* JSGetRequiredSlotOp)(JSContext *cx, JSObject *obj, uint32 slot);

typedef JSBool
(* JSSetRequiredSlotOp)(JSContext *cx, JSObject *obj, uint32 slot, jsval v);

typedef JSObject *
(* JSGetMethodOp)(JSContext *cx, JSObject *obj, jsid id, jsval *vp);

typedef JSBool
(* JSSetMethodOp)(JSContext *cx, JSObject *obj, jsid id, jsval *vp);

typedef JSBool
(* JSEnumerateValuesOp)(JSContext *cx, JSObject *obj, JSIterateOp enum_op,
                        jsval *statep, jsid *idp, jsval *vp);

typedef JSBool
(* JSEqualityOp)(JSContext *cx, JSObject *obj, jsval v, JSBool *bp);

typedef JSBool
(* JSConcatenateOp)(JSContext *cx, JSObject *obj, jsval v, jsval *vp);

/* Typedef for native functions called by the JS VM. */

typedef JSBool
(* JSNative)(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
             jsval *rval);

/* See jsapi.h, the JS_CALLEE, JS_THIS, etc. macros. */
typedef JSBool
(* JSFastNative)(JSContext *cx, uintN argc, jsval *vp);

/* Callbacks and their arguments. */

typedef enum JSContextOp {
    JSCONTEXT_NEW,
    JSCONTEXT_DESTROY
} JSContextOp;

/*
 * The possible values for contextOp when the runtime calls the callback are:
 *   JSCONTEXT_NEW      JS_NewContext successfully created a new JSContext
 *                      instance. The callback can initialize the instance as
 *                      required. If the callback returns false, the instance
 *                      will be destroyed and JS_NewContext returns null. In
 *                      this case the callback is not called again.
 *   JSCONTEXT_DESTROY  One of JS_DestroyContext* methods is called. The
 *                      callback may perform its own cleanup and must always
 *                      return true.
 *   Any other value    For future compatibility the callback must do nothing
 *                      and return true in this case.
 */
typedef JSBool
(* JSContextCallback)(JSContext *cx, uintN contextOp);

typedef enum JSGCStatus {
    JSGC_BEGIN,
    JSGC_END,
    JSGC_MARK_END,
    JSGC_FINALIZE_END
} JSGCStatus;

typedef JSBool
(* JSGCCallback)(JSContext *cx, JSGCStatus status);

/*
 * Generic trace operation that calls JS_CallTracer on each traceable thing
 * stored in data.
 */
typedef void
(* JSTraceDataOp)(JSTracer *trc, void *data);

typedef JSBool
(* JSOperationCallback)(JSContext *cx);

/*
 * Deprecated form of JSOperationCallback.
 */
typedef JSBool
(* JSBranchCallback)(JSContext *cx, JSScript *script);

typedef void
(* JSErrorReporter)(JSContext *cx, const char *message, JSErrorReport *report);

/*
 * Possible exception types. These types are part of a JSErrorFormatString
 * structure. They define which error to throw in case of a runtime error.
 * JSEXN_NONE marks an unthrowable error.
 */
typedef enum JSExnType {
    JSEXN_NONE = -1,
      JSEXN_ERR,
        JSEXN_INTERNALERR,
        JSEXN_EVALERR,
        JSEXN_RANGEERR,
        JSEXN_REFERENCEERR,
        JSEXN_SYNTAXERR,
        JSEXN_TYPEERR,
        JSEXN_URIERR,
        JSEXN_LIMIT
} JSExnType;

typedef struct JSErrorFormatString {
    /* The error format string (UTF-8 if js_CStringsAreUTF8). */
    const char *format;

    /* The number of arguments to expand in the formatted error message. */
    uint16 argCount;

    /* One of the JSExnType constants above. */
    int16 exnType;
} JSErrorFormatString;

typedef const JSErrorFormatString *
(* JSErrorCallback)(void *userRef, const char *locale,
                    const uintN errorNumber);

#ifdef va_start
#define JS_ARGUMENT_FORMATTER_DEFINED 1

typedef JSBool
(* JSArgumentFormatter)(JSContext *cx, const char *format, JSBool fromJS,
                        jsval **vpp, va_list *app);
#endif

typedef JSBool
(* JSLocaleToUpperCase)(JSContext *cx, JSString *src, jsval *rval);

typedef JSBool
(* JSLocaleToLowerCase)(JSContext *cx, JSString *src, jsval *rval);

typedef JSBool
(* JSLocaleCompare)(JSContext *cx, JSString *src1, JSString *src2,
                    jsval *rval);

typedef JSBool
(* JSLocaleToUnicode)(JSContext *cx, char *src, jsval *rval);

/*
 * Security protocol types.
 */
typedef struct JSPrincipals JSPrincipals;

/*
 * XDR-encode or -decode a principals instance, based on whether xdr->mode is
 * JSXDR_ENCODE, in which case *principalsp should be encoded; or JSXDR_DECODE,
 * in which case implementations must return a held (via JSPRINCIPALS_HOLD),
 * non-null *principalsp out parameter.  Return true on success, false on any
 * error, which the implementation must have reported.
 */
typedef JSBool
(* JSPrincipalsTranscoder)(JSXDRState *xdr, JSPrincipals **principalsp);

/*
 * Return a weak reference to the principals associated with obj, possibly via
 * the immutable parent chain leading from obj to a top-level container (e.g.,
 * a window object in the DOM level 0).  If there are no principals associated
 * with obj, return null.  Therefore null does not mean an error was reported;
 * in no event should an error be reported or an exception be thrown by this
 * callback's implementation.
 */
typedef JSPrincipals *
(* JSObjectPrincipalsFinder)(JSContext *cx, JSObject *obj);

JS_END_EXTERN_C

#endif /* jspubtd_h___ */
