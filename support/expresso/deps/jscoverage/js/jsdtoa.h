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

#ifndef jsdtoa_h___
#define jsdtoa_h___
/*
 * Public interface to portable double-precision floating point to string
 * and back conversion package.
 */

#include "jscompat.h"

JS_BEGIN_EXTERN_C

/*
 * JS_strtod() returns as a double-precision floating-point number
 * the  value represented by the character string pointed to by
 * s00.  The string is scanned up to  the  first  unrecognized
 * character.
 * If the value of se is not (char **)NULL,  a  pointer  to
 * the  character terminating the scan is returned in the location pointed
 * to by se.  If no number can be  formed, se is set to s00r, and
 * zero is returned.
 *
 * *err is set to zero on success; it's set to JS_DTOA_ERANGE on range
 * errors and JS_DTOA_ENOMEM on memory failure.
 */
#define JS_DTOA_ERANGE 1
#define JS_DTOA_ENOMEM 2
JS_FRIEND_API(double)
JS_strtod(const char *s00, char **se, int *err);

/*
 * Modes for converting floating-point numbers to strings.
 *
 * Some of the modes can round-trip; this means that if the number is converted to
 * a string using one of these mode and then converted back to a number, the result
 * will be identical to the original number (except that, due to ECMA, -0 will get converted
 * to +0).  These round-trip modes return the minimum number of significand digits that
 * permit the round trip.
 *
 * Some of the modes take an integer parameter <precision>.
 */
/* NB: Keep this in sync with number_constants[]. */
typedef enum JSDToStrMode {
    DTOSTR_STANDARD,              /* Either fixed or exponential format; round-trip */
    DTOSTR_STANDARD_EXPONENTIAL,  /* Always exponential format; round-trip */
    DTOSTR_FIXED,                 /* Round to <precision> digits after the decimal point; exponential if number is large */
    DTOSTR_EXPONENTIAL,           /* Always exponential format; <precision> significant digits */
    DTOSTR_PRECISION              /* Either fixed or exponential format; <precision> significant digits */
} JSDToStrMode;


/* Maximum number of characters (including trailing null) that a DTOSTR_STANDARD or DTOSTR_STANDARD_EXPONENTIAL
 * conversion can produce.  This maximum is reached for a number like -0.0000012345678901234567. */
#define DTOSTR_STANDARD_BUFFER_SIZE 26

/* Maximum number of characters (including trailing null) that one of the other conversions
 * can produce.  This maximum is reached for TO_FIXED, which can generate up to 21 digits before the decimal point. */
#define DTOSTR_VARIABLE_BUFFER_SIZE(precision) ((precision)+24 > DTOSTR_STANDARD_BUFFER_SIZE ? (precision)+24 : DTOSTR_STANDARD_BUFFER_SIZE)

/*
 * Convert dval according to the given mode and return a pointer to the resulting ASCII string.
 * The result is held somewhere in buffer, but not necessarily at the beginning.  The size of
 * buffer is given in bufferSize, and must be at least as large as given by the above macros.
 *
 * Return NULL if out of memory.
 */
JS_FRIEND_API(char *)
JS_dtostr(char *buffer, size_t bufferSize, JSDToStrMode mode, int precision, double dval);

/*
 * Convert d to a string in the given base.  The integral part of d will be printed exactly
 * in that base, regardless of how large it is, because there is no exponential notation for non-base-ten
 * numbers.  The fractional part will be rounded to as few digits as possible while still preserving
 * the round-trip property (analogous to that of printing decimal numbers).  In other words, if one were
 * to read the resulting string in via a hypothetical base-number-reading routine that rounds to the nearest
 * IEEE double (and to an even significand if there are two equally near doubles), then the result would
 * equal d (except for -0.0, which converts to "0", and NaN, which is not equal to itself).
 *
 * Return NULL if out of memory.  If the result is not NULL, it must be released via free().
 */
JS_FRIEND_API(char *)
JS_dtobasestr(int base, double d);

/*
 * Clean up any persistent RAM allocated during the execution of DtoA
 * routines, and remove any locks that might have been created.
 */
JS_FRIEND_API(JSBool) js_InitDtoa(void);
JS_FRIEND_API(void) js_FinishDtoa(void);

JS_END_EXTERN_C

#endif /* jsdtoa_h___ */
