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

#ifndef jsxdrapi_h___
#define jsxdrapi_h___

/*
 * JS external data representation interface API.
 *
 * The XDR system is comprised of three major parts:
 *
 * - the state serialization/deserialization APIs, which allow consumers
 *   of the API to serialize JS runtime state (script bytecodes, atom maps,
 *   object graphs, etc.) for later restoration.  These portions
 *   are implemented in various appropriate files, such as jsscript.c
 *   for the script portions and jsobj.c for object state.
 * - the callback APIs through which the runtime requests an opaque
 *   representation of a native object, and through which the runtime
 *   constructs a live native object from an opaque representation. These
 *   portions are the responsibility of the native object implementor.
 * - utility functions for en/decoding of primitive types, such as
 *   JSStrings.  This portion is implemented in jsxdrapi.c.
 *
 * Spiritually guided by Sun's XDR, where appropriate.
 */

#include "jspubtd.h"
#include "jsprvtd.h"

JS_BEGIN_EXTERN_C

/* We use little-endian byteorder for all encoded data */

#if defined IS_LITTLE_ENDIAN
#define JSXDR_SWAB32(x) x
#define JSXDR_SWAB16(x) x
#elif defined IS_BIG_ENDIAN
#define JSXDR_SWAB32(x) (((uint32)(x) >> 24) |                                \
                         (((uint32)(x) >> 8) & 0xff00) |                      \
                         (((uint32)(x) << 8) & 0xff0000) |                    \
                         ((uint32)(x) << 24))
#define JSXDR_SWAB16(x) (((uint16)(x) >> 8) | ((uint16)(x) << 8))
#else
#error "unknown byte order"
#endif

#define JSXDR_ALIGN     4

typedef enum JSXDRMode {
    JSXDR_ENCODE,
    JSXDR_DECODE,
    JSXDR_FREE
} JSXDRMode;

typedef enum JSXDRWhence {
    JSXDR_SEEK_SET,
    JSXDR_SEEK_CUR,
    JSXDR_SEEK_END
} JSXDRWhence;

typedef struct JSXDROps {
    JSBool      (*get32)(JSXDRState *, uint32 *);
    JSBool      (*set32)(JSXDRState *, uint32 *);
    JSBool      (*getbytes)(JSXDRState *, char *, uint32);
    JSBool      (*setbytes)(JSXDRState *, char *, uint32);
    void *      (*raw)(JSXDRState *, uint32);
    JSBool      (*seek)(JSXDRState *, int32, JSXDRWhence);
    uint32      (*tell)(JSXDRState *);
    void        (*finalize)(JSXDRState *);
} JSXDROps;

struct JSXDRState {
    JSXDRMode   mode;
    JSXDROps    *ops;
    JSContext   *cx;
    JSClass     **registry;
    uintN       numclasses;
    uintN       maxclasses;
    void        *reghash;
    void        *userdata;
    JSScript    *script;
};

extern JS_PUBLIC_API(void)
JS_XDRInitBase(JSXDRState *xdr, JSXDRMode mode, JSContext *cx);

extern JS_PUBLIC_API(JSXDRState *)
JS_XDRNewMem(JSContext *cx, JSXDRMode mode);

extern JS_PUBLIC_API(void *)
JS_XDRMemGetData(JSXDRState *xdr, uint32 *lp);

extern JS_PUBLIC_API(void)
JS_XDRMemSetData(JSXDRState *xdr, void *data, uint32 len);

extern JS_PUBLIC_API(uint32)
JS_XDRMemDataLeft(JSXDRState *xdr);

extern JS_PUBLIC_API(void)
JS_XDRMemResetData(JSXDRState *xdr);

extern JS_PUBLIC_API(void)
JS_XDRDestroy(JSXDRState *xdr);

extern JS_PUBLIC_API(JSBool)
JS_XDRUint8(JSXDRState *xdr, uint8 *b);

extern JS_PUBLIC_API(JSBool)
JS_XDRUint16(JSXDRState *xdr, uint16 *s);

extern JS_PUBLIC_API(JSBool)
JS_XDRUint32(JSXDRState *xdr, uint32 *lp);

extern JS_PUBLIC_API(JSBool)
JS_XDRBytes(JSXDRState *xdr, char *bytes, uint32 len);

extern JS_PUBLIC_API(JSBool)
JS_XDRCString(JSXDRState *xdr, char **sp);

extern JS_PUBLIC_API(JSBool)
JS_XDRCStringOrNull(JSXDRState *xdr, char **sp);

extern JS_PUBLIC_API(JSBool)
JS_XDRString(JSXDRState *xdr, JSString **strp);

extern JS_PUBLIC_API(JSBool)
JS_XDRStringOrNull(JSXDRState *xdr, JSString **strp);

extern JS_PUBLIC_API(JSBool)
JS_XDRDouble(JSXDRState *xdr, jsdouble **dp);

extern JS_PUBLIC_API(JSBool)
JS_XDRValue(JSXDRState *xdr, jsval *vp);

extern JS_PUBLIC_API(JSBool)
JS_XDRScript(JSXDRState *xdr, JSScript **scriptp);

extern JS_PUBLIC_API(JSBool)
JS_XDRRegisterClass(JSXDRState *xdr, JSClass *clasp, uint32 *lp);

extern JS_PUBLIC_API(uint32)
JS_XDRFindClassIdByName(JSXDRState *xdr, const char *name);

extern JS_PUBLIC_API(JSClass *)
JS_XDRFindClassById(JSXDRState *xdr, uint32 id);

/*
 * Magic numbers.
 */
#define JSXDR_MAGIC_SCRIPT_1        0xdead0001
#define JSXDR_MAGIC_SCRIPT_2        0xdead0002
#define JSXDR_MAGIC_SCRIPT_3        0xdead0003
#define JSXDR_MAGIC_SCRIPT_4        0xdead0004
#define JSXDR_MAGIC_SCRIPT_5        0xdead0005
#define JSXDR_MAGIC_SCRIPT_6        0xdead0006
#define JSXDR_MAGIC_SCRIPT_7        0xdead0007
#define JSXDR_MAGIC_SCRIPT_8        0xdead0008
#define JSXDR_MAGIC_SCRIPT_9        0xdead0009
#define JSXDR_MAGIC_SCRIPT_CURRENT  JSXDR_MAGIC_SCRIPT_9

/*
 * Bytecode version number. Increment the subtrahend whenever JS bytecode
 * changes incompatibly.
 *
 * This version number should be XDR'ed once near the front of any file or
 * larger storage unit containing XDR'ed bytecode and other data, and checked
 * before deserialization of bytecode.  If the saved version does not match
 * the current version, abort deserialization and invalidate the file.
 */
#define JSXDR_BYTECODE_VERSION      (0xb973c0de - 37)

/*
 * Library-private functions.
 */
extern JSBool
js_XDRAtom(JSXDRState *xdr, JSAtom **atomp);

extern JSBool
js_XDRStringAtom(JSXDRState *xdr, JSAtom **atomp);

JS_END_EXTERN_C

#endif /* ! jsxdrapi_h___ */
