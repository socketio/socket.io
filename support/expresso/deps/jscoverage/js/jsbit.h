/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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

#ifndef jsbit_h___
#define jsbit_h___

#include "jstypes.h"
#include "jsutil.h"

JS_BEGIN_EXTERN_C

/*
** A jsbitmap_t is a long integer that can be used for bitmaps
*/
typedef JSUword     jsbitmap_t;     /* NSPR name, a la Unix system types */
typedef jsbitmap_t  jsbitmap;       /* JS-style scalar typedef name */

#define JS_BITMAP_SIZE(bits)    (JS_HOWMANY(bits, JS_BITS_PER_WORD) *         \
                                 sizeof(jsbitmap))

#define JS_TEST_BIT(_map,_bit)  ((_map)[(_bit)>>JS_BITS_PER_WORD_LOG2] &      \
                                 ((jsbitmap)1<<((_bit)&(JS_BITS_PER_WORD-1))))
#define JS_SET_BIT(_map,_bit)   ((_map)[(_bit)>>JS_BITS_PER_WORD_LOG2] |=     \
                                 ((jsbitmap)1<<((_bit)&(JS_BITS_PER_WORD-1))))
#define JS_CLEAR_BIT(_map,_bit) ((_map)[(_bit)>>JS_BITS_PER_WORD_LOG2] &=     \
                                 ~((jsbitmap)1<<((_bit)&(JS_BITS_PER_WORD-1))))

/*
** Compute the log of the least power of 2 greater than or equal to n
*/
extern JS_PUBLIC_API(JSIntn) JS_CeilingLog2(JSUint32 i);

/*
** Compute the log of the greatest power of 2 less than or equal to n
*/
extern JS_PUBLIC_API(JSIntn) JS_FloorLog2(JSUint32 i);

/*
 * Replace bit-scanning code sequences with CPU-specific instructions to
 * speedup calculations of ceiling/floor log2.
 *
 * With GCC 3.4 or later we can use __builtin_clz for that, see bug 327129.
 *
 * SWS: Added MSVC intrinsic bitscan support.  See bugs 349364 and 356856.
 */
#if defined(_WIN32) && (_MSC_VER >= 1300) && defined(_M_IX86)

unsigned char _BitScanForward(unsigned long * Index, unsigned long Mask);
unsigned char _BitScanReverse(unsigned long * Index, unsigned long Mask);
# pragma intrinsic(_BitScanForward,_BitScanReverse)

__forceinline static int
__BitScanForward32(unsigned int val)
{
    unsigned long idx;

    _BitScanForward(&idx, (unsigned long)val);
    return (int)idx;
}
__forceinline static int
__BitScanReverse32(unsigned int val)
{
    unsigned long idx;

    _BitScanReverse(&idx, (unsigned long)val);
    return (int)(31-idx);
}
# define js_bitscan_ctz32(val)  __BitScanForward32(val)
# define js_bitscan_clz32(val)  __BitScanReverse32(val)
# define JS_HAS_BUILTIN_BITSCAN32

#elif (__GNUC__ >= 4) || (__GNUC__ == 3 && __GNUC_MINOR__ >= 4)

# define js_bitscan_ctz32(val)  __builtin_ctz(val)
# define js_bitscan_clz32(val)  __builtin_clz(val)
# define JS_HAS_BUILTIN_BITSCAN32
# if (JS_BYTES_PER_WORD == 8)
#  define js_bitscan_ctz64(val)  __builtin_ctzll(val)
#  define js_bitscan_clz64(val)  __builtin_clzll(val)
#  define JS_HAS_BUILTIN_BITSCAN64
# endif

#endif

/*
** Macro version of JS_CeilingLog2: Compute the log of the least power of
** 2 greater than or equal to _n. The result is returned in _log2.
*/
#ifdef JS_HAS_BUILTIN_BITSCAN32
/*
 * Use intrinsic function or count-leading-zeros to calculate ceil(log2(_n)).
 * The macro checks for "n <= 1" and not "n != 0" as js_bitscan_clz32(0) is
 * undefined.
 */
# define JS_CEILING_LOG2(_log2,_n)                                            \
    JS_BEGIN_MACRO                                                            \
        JS_STATIC_ASSERT(sizeof(unsigned int) == sizeof(JSUint32));           \
        unsigned int j_ = (unsigned int)(_n);                                 \
        (_log2) = (j_ <= 1 ? 0 : 32 - js_bitscan_clz32(j_ - 1));              \
    JS_END_MACRO
#else
# define JS_CEILING_LOG2(_log2,_n)                                            \
    JS_BEGIN_MACRO                                                            \
        JSUint32 j_ = (JSUint32)(_n);                                         \
        (_log2) = 0;                                                          \
        if ((j_) & ((j_)-1))                                                  \
            (_log2) += 1;                                                     \
        if ((j_) >> 16)                                                       \
            (_log2) += 16, (j_) >>= 16;                                       \
        if ((j_) >> 8)                                                        \
            (_log2) += 8, (j_) >>= 8;                                         \
        if ((j_) >> 4)                                                        \
            (_log2) += 4, (j_) >>= 4;                                         \
        if ((j_) >> 2)                                                        \
            (_log2) += 2, (j_) >>= 2;                                         \
        if ((j_) >> 1)                                                        \
            (_log2) += 1;                                                     \
    JS_END_MACRO
#endif

/*
** Macro version of JS_FloorLog2: Compute the log of the greatest power of
** 2 less than or equal to _n. The result is returned in _log2.
**
** This is equivalent to finding the highest set bit in the word.
*/
#ifdef JS_HAS_BUILTIN_BITSCAN32
/*
 * Use js_bitscan_clz32 or count-leading-zeros to calculate floor(log2(_n)).
 * Since js_bitscan_clz32(0) is undefined, the macro set the loweset bit to 1
 * to ensure 0 result when _n == 0.
 */
# define JS_FLOOR_LOG2(_log2,_n)                                              \
    JS_BEGIN_MACRO                                                            \
        JS_STATIC_ASSERT(sizeof(unsigned int) == sizeof(JSUint32));           \
        (_log2) = 31 - js_bitscan_clz32(((unsigned int)(_n)) | 1);            \
    JS_END_MACRO
#else
# define JS_FLOOR_LOG2(_log2,_n)                                              \
    JS_BEGIN_MACRO                                                            \
        JSUint32 j_ = (JSUint32)(_n);                                         \
        (_log2) = 0;                                                          \
        if ((j_) >> 16)                                                       \
            (_log2) += 16, (j_) >>= 16;                                       \
        if ((j_) >> 8)                                                        \
            (_log2) += 8, (j_) >>= 8;                                         \
        if ((j_) >> 4)                                                        \
            (_log2) += 4, (j_) >>= 4;                                         \
        if ((j_) >> 2)                                                        \
            (_log2) += 2, (j_) >>= 2;                                         \
        if ((j_) >> 1)                                                        \
            (_log2) += 1;                                                     \
    JS_END_MACRO
#endif

/*
 * Internal function.
 * Compute the log of the least power of 2 greater than or equal to n.
 * This is a version of JS_CeilingLog2 that operates on jsuword with
 * CPU-dependant size.
 */
#define JS_CEILING_LOG2W(n) ((n) <= 1 ? 0 : 1 + JS_FLOOR_LOG2W((n) - 1))

/*
 * Internal function.
 * Compute the log of the greatest power of 2 less than or equal to n.
 * This is a version of JS_FloorLog2 that operates on jsuword with
 * CPU-dependant size and requires that n != 0.
 */
#define JS_FLOOR_LOG2W(n) (JS_ASSERT((n) != 0), js_FloorLog2wImpl(n))

#if JS_BYTES_PER_WORD == 4

# ifdef JS_HAS_BUILTIN_BITSCAN32
JS_STATIC_ASSERT(sizeof(unsigned) == sizeof(JSUword));
#  define js_FloorLog2wImpl(n)                                                \
    ((JSUword)(JS_BITS_PER_WORD - 1 - js_bitscan_clz32(n)))
# else
#  define js_FloorLog2wImpl(n) ((JSUword)JS_FloorLog2(n))
#endif

#elif JS_BYTES_PER_WORD == 8

# ifdef JS_HAS_BUILTIN_BITSCAN64
JS_STATIC_ASSERT(sizeof(unsigned long long) == sizeof(JSUword));
#  define js_FloorLog2wImpl(n)                                                \
    ((JSUword)(JS_BITS_PER_WORD - 1 - js_bitscan_clz64(n)))
# else
extern JSUword js_FloorLog2wImpl(JSUword n);
# endif

#else

# error "NOT SUPPORTED"

#endif

/*
 * Macros for rotate left. There is no rotate operation in the C Language so
 * the construct (a << 4) | (a >> 28) is used instead. Most compilers convert
 * this to a rotate instruction but some versions of MSVC don't without a
 * little help.  To get MSVC to generate a rotate instruction, we have to use
 * the _rotl intrinsic and use a pragma to make _rotl inline.
 *
 * MSVC in VS2005 will do an inline rotate instruction on the above construct.
 */

#if defined(_MSC_VER) && (defined(_M_IX86) || defined(_M_AMD64) || \
    defined(_M_X64))
#include <stdlib.h>
#pragma intrinsic(_rotl)
#define JS_ROTATE_LEFT32(a, bits) _rotl(a, bits)
#else
#define JS_ROTATE_LEFT32(a, bits) (((a) << (bits)) | ((a) >> (32 - (bits))))
#endif

JS_END_EXTERN_C
#endif /* jsbit_h___ */
