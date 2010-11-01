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

#ifndef js_cpucfg___
#define js_cpucfg___

#define JS_HAVE_LONG_LONG

#if defined(XP_WIN) || defined(XP_OS2) || defined(WINCE)

#if defined(_WIN64)

#if defined(_M_X64) || defined(_M_AMD64) || defined(_AMD64_)
#define IS_LITTLE_ENDIAN 1
#undef  IS_BIG_ENDIAN

#define JS_BYTES_PER_BYTE   1L
#define JS_BYTES_PER_SHORT  2L
#define JS_BYTES_PER_INT    4L
#define JS_BYTES_PER_INT64  8L
#define JS_BYTES_PER_LONG   4L
#define JS_BYTES_PER_FLOAT  4L
#define JS_BYTES_PER_DOUBLE 8L
#define JS_BYTES_PER_WORD   8L
#define JS_BYTES_PER_DWORD  8L

#define JS_BITS_PER_BYTE    8L
#define JS_BITS_PER_SHORT   16L
#define JS_BITS_PER_INT     32L
#define JS_BITS_PER_INT64   64L
#define JS_BITS_PER_LONG    32L
#define JS_BITS_PER_FLOAT   32L
#define JS_BITS_PER_DOUBLE  64L
#define JS_BITS_PER_WORD    64L

#define JS_BITS_PER_BYTE_LOG2   3L
#define JS_BITS_PER_SHORT_LOG2  4L
#define JS_BITS_PER_INT_LOG2    5L
#define JS_BITS_PER_INT64_LOG2  6L
#define JS_BITS_PER_LONG_LOG2   5L
#define JS_BITS_PER_FLOAT_LOG2  5L
#define JS_BITS_PER_DOUBLE_LOG2 6L
#define JS_BITS_PER_WORD_LOG2   6L

#define JS_ALIGN_OF_SHORT   2L
#define JS_ALIGN_OF_INT     4L
#define JS_ALIGN_OF_LONG    4L
#define JS_ALIGN_OF_INT64   8L
#define JS_ALIGN_OF_FLOAT   4L
#define JS_ALIGN_OF_DOUBLE  8L
#define JS_ALIGN_OF_POINTER 8L
#define JS_ALIGN_OF_WORD    8L

#define JS_BYTES_PER_WORD_LOG2   3L
#define JS_BYTES_PER_DWORD_LOG2  3L
#define PR_WORDS_PER_DWORD_LOG2  0L
#else  /* !(defined(_M_X64) || defined(_M_AMD64) || defined(_AMD64_)) */
#error "CPU type is unknown"
#endif /* !(defined(_M_X64) || defined(_M_AMD64) || defined(_AMD64_)) */

#elif defined(_WIN32) || defined(XP_OS2) || defined(WINCE)

#ifdef __WATCOMC__
#define HAVE_VA_LIST_AS_ARRAY 1
#endif

#define IS_LITTLE_ENDIAN 1
#undef  IS_BIG_ENDIAN

#define JS_BYTES_PER_BYTE   1L
#define JS_BYTES_PER_SHORT  2L
#define JS_BYTES_PER_INT    4L
#define JS_BYTES_PER_INT64  8L
#define JS_BYTES_PER_LONG   4L
#define JS_BYTES_PER_FLOAT  4L
#define JS_BYTES_PER_DOUBLE 8L
#define JS_BYTES_PER_WORD   4L
#define JS_BYTES_PER_DWORD  8L

#define JS_BITS_PER_BYTE    8L
#define JS_BITS_PER_SHORT   16L
#define JS_BITS_PER_INT     32L
#define JS_BITS_PER_INT64   64L
#define JS_BITS_PER_LONG    32L
#define JS_BITS_PER_FLOAT   32L
#define JS_BITS_PER_DOUBLE  64L
#define JS_BITS_PER_WORD    32L

#define JS_BITS_PER_BYTE_LOG2   3L
#define JS_BITS_PER_SHORT_LOG2  4L
#define JS_BITS_PER_INT_LOG2    5L
#define JS_BITS_PER_INT64_LOG2  6L
#define JS_BITS_PER_LONG_LOG2   5L
#define JS_BITS_PER_FLOAT_LOG2  5L
#define JS_BITS_PER_DOUBLE_LOG2 6L
#define JS_BITS_PER_WORD_LOG2   5L

#define JS_ALIGN_OF_SHORT   2L
#define JS_ALIGN_OF_INT     4L
#define JS_ALIGN_OF_LONG    4L
#define JS_ALIGN_OF_INT64   8L
#define JS_ALIGN_OF_FLOAT   4L
#define JS_ALIGN_OF_DOUBLE  4L
#define JS_ALIGN_OF_POINTER 4L
#define JS_ALIGN_OF_WORD    4L

#define JS_BYTES_PER_WORD_LOG2   2L
#define JS_BYTES_PER_DWORD_LOG2  3L
#define PR_WORDS_PER_DWORD_LOG2  1L
#endif /* _WIN32 || XP_OS2 || WINCE*/

#if defined(_WINDOWS) && !defined(_WIN32) /* WIN16 */

#define IS_LITTLE_ENDIAN 1
#undef  IS_BIG_ENDIAN

#define JS_BYTES_PER_BYTE   1L
#define JS_BYTES_PER_SHORT  2L
#define JS_BYTES_PER_INT    2L
#define JS_BYTES_PER_INT64  8L
#define JS_BYTES_PER_LONG   4L
#define JS_BYTES_PER_FLOAT  4L
#define JS_BYTES_PER_DOUBLE 8L
#define JS_BYTES_PER_WORD   4L
#define JS_BYTES_PER_DWORD  8L

#define JS_BITS_PER_BYTE    8L
#define JS_BITS_PER_SHORT   16L
#define JS_BITS_PER_INT     16L
#define JS_BITS_PER_INT64   64L
#define JS_BITS_PER_LONG    32L
#define JS_BITS_PER_FLOAT   32L
#define JS_BITS_PER_DOUBLE  64L
#define JS_BITS_PER_WORD    32L

#define JS_BITS_PER_BYTE_LOG2   3L
#define JS_BITS_PER_SHORT_LOG2  4L
#define JS_BITS_PER_INT_LOG2    4L
#define JS_BITS_PER_INT64_LOG2  6L
#define JS_BITS_PER_LONG_LOG2   5L
#define JS_BITS_PER_FLOAT_LOG2  5L
#define JS_BITS_PER_DOUBLE_LOG2 6L
#define JS_BITS_PER_WORD_LOG2   5L

#define JS_ALIGN_OF_SHORT   2L
#define JS_ALIGN_OF_INT     2L
#define JS_ALIGN_OF_LONG    2L
#define JS_ALIGN_OF_INT64   2L
#define JS_ALIGN_OF_FLOAT   2L
#define JS_ALIGN_OF_DOUBLE  2L
#define JS_ALIGN_OF_POINTER 2L
#define JS_ALIGN_OF_WORD    2L

#define JS_BYTES_PER_WORD_LOG2   2L
#define JS_BYTES_PER_DWORD_LOG2  3L
#define PR_WORDS_PER_DWORD_LOG2  1L

#endif /* defined(_WINDOWS) && !defined(_WIN32) */

#elif defined(XP_UNIX) || defined(XP_BEOS)

#error "This file is supposed to be auto-generated on UNIX platforms, but the"
#error "static version for Mac and Windows platforms is being used."
#error "Something's probably wrong with paths/headers/dependencies/Makefiles."

#else

#error "Must define one of XP_BEOS, XP_OS2, XP_WIN, or XP_UNIX"

#endif

#ifndef JS_STACK_GROWTH_DIRECTION
#define JS_STACK_GROWTH_DIRECTION (-1)
#endif

#endif /* js_cpucfg___ */
