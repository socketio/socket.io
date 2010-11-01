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

#ifndef jsprf_h___
#define jsprf_h___

/*
** API for PR printf like routines. Supports the following formats
**      %d - decimal
**      %u - unsigned decimal
**      %x - unsigned hex
**      %X - unsigned uppercase hex
**      %o - unsigned octal
**      %hd, %hu, %hx, %hX, %ho - 16-bit versions of above
**      %ld, %lu, %lx, %lX, %lo - 32-bit versions of above
**      %lld, %llu, %llx, %llX, %llo - 64 bit versions of above
**      %s - string
**      %hs - 16-bit version of above (only available if js_CStringsAreUTF8)
**      %c - character
**      %hc - 16-bit version of above (only available if js_CStringsAreUTF8)
**      %p - pointer (deals with machine dependent pointer size)
**      %f - float
**      %g - float
*/
#include "jstypes.h"
#include <stdio.h>
#include <stdarg.h>

JS_BEGIN_EXTERN_C

/*
** sprintf into a fixed size buffer. Guarantees that a NUL is at the end
** of the buffer. Returns the length of the written output, NOT including
** the NUL, or (JSUint32)-1 if an error occurs.
*/
extern JS_PUBLIC_API(JSUint32) JS_snprintf(char *out, JSUint32 outlen, const char *fmt, ...);

/*
** sprintf into a malloc'd buffer. Return a pointer to the malloc'd
** buffer on success, NULL on failure. Call "JS_smprintf_free" to release
** the memory returned.
*/
extern JS_PUBLIC_API(char*) JS_smprintf(const char *fmt, ...);

/*
** Free the memory allocated, for the caller, by JS_smprintf
*/
extern JS_PUBLIC_API(void) JS_smprintf_free(char *mem);

/*
** "append" sprintf into a malloc'd buffer. "last" is the last value of
** the malloc'd buffer. sprintf will append data to the end of last,
** growing it as necessary using realloc. If last is NULL, JS_sprintf_append
** will allocate the initial string. The return value is the new value of
** last for subsequent calls, or NULL if there is a malloc failure.
*/
extern JS_PUBLIC_API(char*) JS_sprintf_append(char *last, const char *fmt, ...);

/*
** sprintf into a function. The function "f" is called with a string to
** place into the output. "arg" is an opaque pointer used by the stuff
** function to hold any state needed to do the storage of the output
** data. The return value is a count of the number of characters fed to
** the stuff function, or (JSUint32)-1 if an error occurs.
*/
typedef JSIntn (*JSStuffFunc)(void *arg, const char *s, JSUint32 slen);

extern JS_PUBLIC_API(JSUint32) JS_sxprintf(JSStuffFunc f, void *arg, const char *fmt, ...);

/*
** va_list forms of the above.
*/
extern JS_PUBLIC_API(JSUint32) JS_vsnprintf(char *out, JSUint32 outlen, const char *fmt, va_list ap);
extern JS_PUBLIC_API(char*) JS_vsmprintf(const char *fmt, va_list ap);
extern JS_PUBLIC_API(char*) JS_vsprintf_append(char *last, const char *fmt, va_list ap);
extern JS_PUBLIC_API(JSUint32) JS_vsxprintf(JSStuffFunc f, void *arg, const char *fmt, va_list ap);

/*
***************************************************************************
** FUNCTION: JS_sscanf
** DESCRIPTION:
**     JS_sscanf() scans the input character string, performs data
**     conversions, and stores the converted values in the data objects
**     pointed to by its arguments according to the format control
**     string.
**
**     JS_sscanf() behaves the same way as the sscanf() function in the
**     Standard C Library (stdio.h), with the following exceptions:
**     - JS_sscanf() handles the NSPR integer and floating point types,
**       such as JSInt16, JSInt32, JSInt64, and JSFloat64, whereas
**       sscanf() handles the standard C types like short, int, long,
**       and double.
**     - JS_sscanf() has no multibyte character support, while sscanf()
**       does.
** INPUTS:
**     const char *buf
**         a character string holding the input to scan
**     const char *fmt
**         the format control string for the conversions
**     ...
**         variable number of arguments, each of them is a pointer to
**         a data object in which the converted value will be stored
** OUTPUTS: none
** RETURNS: JSInt32
**     The number of values converted and stored.
** RESTRICTIONS:
**    Multibyte characters in 'buf' or 'fmt' are not allowed.
***************************************************************************
*/

extern JS_PUBLIC_API(JSInt32) JS_sscanf(const char *buf, const char *fmt, ...);

JS_END_EXTERN_C

#endif /* jsprf_h___ */
