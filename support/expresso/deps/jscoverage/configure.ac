#    configure.ac - configures jscoverage
#    Copyright (C) 2007, 2008 siliconforks.com
#
#    This program is free software; you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation; either version 2 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License along
#    with this program; if not, write to the Free Software Foundation, Inc.,
#    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

AC_PREREQ(2.61)
AC_INIT([jscoverage], [0.4])
AM_INIT_AUTOMAKE([-Wall foreign])
AC_CONFIG_SRCDIR([jscoverage.c])
AC_CONFIG_HEADERS([config.h])
AC_CANONICAL_HOST

# Checks for programs.
AC_PROG_CC
AC_PROG_CC_C99
AC_PROG_CXX

# Checks for libraries.
AM_ICONV

# Checks for header files.
AC_CHECK_HEADERS([pthread.h])
AC_CHECK_HEADERS([iconv.h])
AC_CHECK_HEADERS([windows.h])

# Checks for typedefs, structures, and compiler characteristics.
AC_C_BIGENDIAN

# Checks for library functions.
AC_CHECK_FUNCS([getaddrinfo gethostbyname_r inet_aton strndup vasprintf asprintf])
AC_MSG_CHECKING([for MultiByteToWideChar])
AC_LANG(C)
AC_LINK_IFELSE(
  [AC_LANG_PROGRAM([[#include <windows.h>]],[[MultiByteToWideChar(0,0,0,0,0,0);]])],
  [AC_DEFINE([HAVE_MULTIBYTETOWIDECHAR], [1], [Define to 1 if you have the `MultiByteToWideChar' function.])
   jscoverage_have_multibytetowidechar=yes
   AC_MSG_RESULT([yes])],
  [jscoverage_have_multibytetowidechar=no
   AC_MSG_RESULT([no])])

AC_SUBST([XP_DEF])
case "$host_os" in
  mingw*)
    XP_DEF='-DXP_WIN'
    ;;
  *)
    XP_DEF='-DXP_UNIX'
    ;;
esac

AC_SUBST([EXTRA_SOCKET_LIBS])
AC_SUBST([EXTRA_THREAD_LIBS])
AC_SUBST([EXTRA_TIMER_LIBS])
case "$host_os" in
  mingw*)
    EXTRA_SOCKET_LIBS='-lws2_32'
    EXTRA_THREAD_LIBS=''
    EXTRA_TIMER_LIBS='-lwinmm'
    ;;
  *)
    EXTRA_SOCKET_LIBS=''
    EXTRA_THREAD_LIBS='-lpthread'
    EXTRA_TIMER_LIBS=''
    ;;
esac

if test "$am_cv_func_iconv" != yes && test "$jscoverage_have_multibytetowidechar" != yes
then
  echo -ne '\033@<:@1;31m'
  AC_MSG_WARN([neither iconv nor Windows character encoding conversion functions found])
  AC_MSG_WARN([only ASCII will be supported])
  echo -ne '\033@<:@0m'
fi

AC_CONFIG_FILES([Makefile make-dist.sh make-bin-dist.sh tests/Makefile])
AC_OUTPUT
