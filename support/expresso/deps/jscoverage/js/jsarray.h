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

#ifndef jsarray_h___
#define jsarray_h___
/*
 * JS Array interface.
 */
#include "jsprvtd.h"
#include "jspubtd.h"

JS_BEGIN_EXTERN_C

/* Generous sanity-bound on length (in elements) of array initialiser. */
#define ARRAY_INIT_LIMIT        JS_BIT(24)

extern JSBool
js_IdIsIndex(jsval id, jsuint *indexp);

extern JSClass js_ArrayClass, js_SlowArrayClass;

#define OBJ_IS_DENSE_ARRAY(cx,obj)  (OBJ_GET_CLASS(cx, obj) == &js_ArrayClass)

#define OBJ_IS_ARRAY(cx,obj)    (OBJ_IS_DENSE_ARRAY(cx, obj) ||               \
                                 OBJ_GET_CLASS(cx, obj) == &js_SlowArrayClass)

extern JSObject *
js_InitArrayClass(JSContext *cx, JSObject *obj);

extern JSObject *
js_NewArrayObject(JSContext *cx, jsuint length, jsval *vector,
                  JSBool holey = JS_FALSE);

/* Create an array object that starts out already made slow/sparse. */
extern JSObject *
js_NewSlowArrayObject(JSContext *cx);

extern JSBool
js_MakeArraySlow(JSContext *cx, JSObject *obj);

#define JSSLOT_ARRAY_LENGTH            JSSLOT_PRIVATE
#define JSSLOT_ARRAY_COUNT             (JSSLOT_ARRAY_LENGTH + 1)
#define JSSLOT_ARRAY_LOOKUP_HOLDER     (JSSLOT_ARRAY_COUNT + 1)

#define ARRAY_DENSE_LENGTH(obj)                                                \
    (JS_ASSERT(OBJ_IS_DENSE_ARRAY(cx, obj)),                                   \
     (obj)->dslots ? (uint32)(obj)->dslots[-1] : 0)

#define ARRAY_SET_DENSE_LENGTH(obj, max)                                       \
    (JS_ASSERT((obj)->dslots), (obj)->dslots[-1] = (jsval)(max))

#define ARRAY_GROWBY 8

extern JSBool
js_GetLengthProperty(JSContext *cx, JSObject *obj, jsuint *lengthp);

extern JSBool
js_SetLengthProperty(JSContext *cx, JSObject *obj, jsuint length);

extern JSBool
js_HasLengthProperty(JSContext *cx, JSObject *obj, jsuint *lengthp);

extern JSBool JS_FASTCALL
js_IndexToId(JSContext *cx, jsuint index, jsid *idp);

/*
 * Test whether an object is "array-like".  Currently this means whether obj
 * is an Array or an arguments object.  We would like an API, and probably a
 * way in the language, to bless other objects as array-like: having indexed
 * properties, and a 'length' property of uint32 value equal to one more than
 * the greatest index.
 */
extern JSBool
js_IsArrayLike(JSContext *cx, JSObject *obj, JSBool *answerp, jsuint *lengthp);

/*
 * JS-specific merge sort function.
 */
typedef JSBool (*JSComparator)(void *arg, const void *a, const void *b,
                               int *result);
/*
 * NB: vec is the array to be sorted, tmp is temporary space at least as big
 * as vec. Both should be GC-rooted if appropriate.
 *
 * The sorted result is in vec. vec may be in an inconsistent state if the
 * comparator function cmp returns an error inside a comparison, so remember
 * to check the return value of this function.
 */
extern JSBool
js_MergeSort(void *vec, size_t nel, size_t elsize, JSComparator cmp,
             void *arg, void *tmp);

#ifdef DEBUG_ARRAYS
extern JSBool
js_ArrayInfo(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);
#endif

/*
 * Fast dense-array-to-buffer conversions.
 *
 * If the array is a dense array, fill [offset..offset+count] values
 * into destination, assuming that types are consistent.  Return
 * JS_TRUE if successful, otherwise JS_FALSE -- note that the
 * destination buffer may be modified even if JS_FALSE is returned
 * (e.g. due to finding an inappropriate type later on in the array).
 * If JS_FALSE is returned, no error conditions or exceptions are set
 * on the context.
 *
 * For ArrayToJSUint8, ArrayToJSUint16, and ArrayToJSUint32, each element
 * in the array a) must be an integer; b) must be >= 0.  Integers
 * are clamped to fit in the destination size.  Only JSVAL_IS_INT values
 * are considered to be valid, so for JSUint32, the maximum value that
 * can be fast-converted is less than the full unsigned 32-bit range.
 *
 * For ArrayToJSInt8, ArrayToJSInt16, ArrayToJSInt32, each element in
 * the array must be an integer.  Integers are clamped to fit in the
 * destination size.  Only JSVAL_IS_INT values are considered to be
 * valid, so for JSInt32, the maximum value that can be
 * fast-converted is less than the full signed 32-bit range.
 * 
 * For ArrayToJSDouble, each element in the array must be an
 * integer -or- a double (JSVAL_IS_NUMBER).
 */

JS_FRIEND_API(JSBool)
js_ArrayToJSUint8Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                        JSUint8 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSUint16Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                         JSUint16 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSUint32Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                         JSUint32 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSInt8Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                       JSInt8 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSInt16Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                        JSInt16 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSInt32Buffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                        JSInt32 *dest);

JS_FRIEND_API(JSBool)
js_ArrayToJSDoubleBuffer(JSContext *cx, JSObject *obj, jsuint offset, jsuint count,
                         jsdouble *dest);

JS_END_EXTERN_C

#endif /* jsarray_h___ */
