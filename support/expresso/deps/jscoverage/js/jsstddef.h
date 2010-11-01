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

/*
 * stddef inclusion here to first declare ptrdif as a signed long instead of a
 * signed int.
 */

#ifdef _WINDOWS
# ifndef XP_WIN
# define XP_WIN
# endif
#if defined(_WIN32) || defined(WIN32)
# ifndef XP_WIN32
# define XP_WIN32
# endif
#else
# ifndef XP_WIN16
# define XP_WIN16
# endif
#endif
#endif

#ifdef XP_WIN16
#ifndef _PTRDIFF_T_DEFINED
typedef long ptrdiff_t;

/*
 * The Win16 compiler treats pointer differences as 16-bit signed values.
 * This macro allows us to treat them as 17-bit signed values, stored in
 * a 32-bit type.
 */
#define PTRDIFF(p1, p2, type)                                 \
    ((((unsigned long)(p1)) - ((unsigned long)(p2))) / sizeof(type))

#define _PTRDIFF_T_DEFINED
#endif /*_PTRDIFF_T_DEFINED*/
#else /*WIN16*/

#define PTRDIFF(p1, p2, type)                                 \
        ((p1) - (p2))

#endif

#include <stddef.h>

#ifdef __cplusplus
# define __cplusplus_only(x)    x
#else
# define __cplusplus_only(x)    /* nothing */
#endif
