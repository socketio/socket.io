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

#ifndef jsregexp_h___
#define jsregexp_h___
/*
 * JS regular expression interface.
 */
#include <stddef.h>
#include "jspubtd.h"
#include "jsstr.h"

#ifdef JS_THREADSAFE
#include "jsdhash.h"
#endif

JS_BEGIN_EXTERN_C

struct JSRegExpStatics {
    JSString    *input;         /* input string to match (perl $_, GC root) */
    JSBool      multiline;      /* whether input contains newlines (perl $*) */
    uint16      parenCount;     /* number of valid elements in parens[] */
    uint16      moreLength;     /* number of allocated elements in moreParens */
    JSSubString parens[9];      /* last set of parens matched (perl $1, $2) */
    JSSubString *moreParens;    /* null or realloc'd vector for $10, etc. */
    JSSubString lastMatch;      /* last string matched (perl $&) */
    JSSubString lastParen;      /* last paren matched (perl $+) */
    JSSubString leftContext;    /* input to left of last match (perl $`) */
    JSSubString rightContext;   /* input to right of last match (perl $') */
};

/*
 * This struct holds a bitmap representation of a class from a regexp.
 * There's a list of these referenced by the classList field in the JSRegExp
 * struct below. The initial state has startIndex set to the offset in the
 * original regexp source of the beginning of the class contents. The first
 * use of the class converts the source representation into a bitmap.
 *
 */
typedef struct RECharSet {
    JSPackedBool    converted;
    JSPackedBool    sense;
    uint16          length;
    union {
        uint8       *bits;
        struct {
            size_t  startIndex;
            size_t  length;
        } src;
    } u;
} RECharSet;

/*
 * This macro is safe because moreParens is guaranteed to be allocated and big
 * enough to hold parenCount, or else be null when parenCount is 0.
 */
#define REGEXP_PAREN_SUBSTRING(res, num)                                      \
    (((jsuint)(num) < (jsuint)(res)->parenCount)                              \
     ? ((jsuint)(num) < 9)                                                    \
       ? &(res)->parens[num]                                                  \
       : &(res)->moreParens[(num) - 9]                                        \
     : &js_EmptySubString)

typedef struct RENode RENode;

struct JSRegExp {
    jsrefcount   nrefs;         /* reference count */
    uint16       flags;         /* flags, see jsapi.h's JSREG_* defines */
    size_t       parenCount;    /* number of parenthesized submatches */
    size_t       classCount;    /* count [...] bitmaps */
    RECharSet    *classList;    /* list of [...] bitmaps */
    JSString     *source;       /* locked source string, sans // */
    jsbytecode   program[1];    /* regular expression bytecode */
};

extern JSRegExp *
js_NewRegExp(JSContext *cx, JSTokenStream *ts,
             JSString *str, uintN flags, JSBool flat);

extern JSRegExp *
js_NewRegExpOpt(JSContext *cx, JSString *str, JSString *opt, JSBool flat);

#define HOLD_REGEXP(cx, re) JS_ATOMIC_INCREMENT(&(re)->nrefs)
#define DROP_REGEXP(cx, re) js_DestroyRegExp(cx, re)

extern void
js_DestroyRegExp(JSContext *cx, JSRegExp *re);

/*
 * Execute re on input str at *indexp, returning null in *rval on mismatch.
 * On match, return true if test is true, otherwise return an array object.
 * Update *indexp and cx->regExpStatics always on match.
 */
extern JSBool
js_ExecuteRegExp(JSContext *cx, JSRegExp *re, JSString *str, size_t *indexp,
                 JSBool test, jsval *rval);

/*
 * These two add and remove GC roots, respectively, so their calls must be
 * well-ordered.
 */
extern JSBool
js_InitRegExpStatics(JSContext *cx, JSRegExpStatics *res);

extern void
js_FreeRegExpStatics(JSContext *cx, JSRegExpStatics *res);

#define VALUE_IS_REGEXP(cx, v)                                                \
    (JSVAL_IS_OBJECT(v) && JSVAL_TO_OBJECT(v) &&                              \
     OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(v)) == &js_RegExpClass)

extern JSClass js_RegExpClass;

enum regexp_tinyid {
    REGEXP_SOURCE       = -1,
    REGEXP_GLOBAL       = -2,
    REGEXP_IGNORE_CASE  = -3,
    REGEXP_LAST_INDEX   = -4,
    REGEXP_MULTILINE    = -5,
    REGEXP_STICKY       = -6
};

extern JSObject *
js_InitRegExpClass(JSContext *cx, JSObject *obj);

/*
 * Export js_regexp_toString to the decompiler.
 */
extern JSBool
js_regexp_toString(JSContext *cx, JSObject *obj, jsval *vp);

/*
 * Create, serialize/deserialize, or clone a RegExp object.
 */
extern JSObject *
js_NewRegExpObject(JSContext *cx, JSTokenStream *ts,
                   jschar *chars, size_t length, uintN flags);

extern JSBool
js_XDRRegExp(JSXDRState *xdr, JSObject **objp);

extern JSObject *
js_CloneRegExpObject(JSContext *cx, JSObject *obj, JSObject *parent);

/*
 * Get and set the per-object (clone or clone-parent) lastIndex slot.
 */
extern JSBool
js_GetLastIndex(JSContext *cx, JSObject *obj, jsdouble *lastIndex);

extern JSBool
js_SetLastIndex(JSContext *cx, JSObject *obj, jsdouble lastIndex);

JS_END_EXTERN_C

#endif /* jsregexp_h___ */
