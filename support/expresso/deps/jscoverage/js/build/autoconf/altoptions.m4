dnl ***** BEGIN LICENSE BLOCK *****
dnl Version: MPL 1.1/GPL 2.0/LGPL 2.1
dnl
dnl The contents of this file are subject to the Mozilla Public License Version
dnl 1.1 (the "License"); you may not use this file except in compliance with
dnl the License. You may obtain a copy of the License at
dnl http://www.mozilla.org/MPL/
dnl
dnl Software distributed under the License is distributed on an "AS IS" basis,
dnl WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
dnl for the specific language governing rights and limitations under the
dnl License.
dnl
dnl The Original Code is mozilla.org code.
dnl
dnl The Initial Developer of the Original Code is
dnl Netscape Communications Corporation.
dnl Portions created by the Initial Developer are Copyright (C) 1999
dnl the Initial Developer. All Rights Reserved.
dnl
dnl Contributor(s):
dnl
dnl Alternatively, the contents of this file may be used under the terms of
dnl either of the GNU General Public License Version 2 or later (the "GPL"),
dnl or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
dnl in which case the provisions of the GPL or the LGPL are applicable instead
dnl of those above. If you wish to allow use of your version of this file only
dnl under the terms of either the GPL or the LGPL, and not to allow others to
dnl use your version of this file under the terms of the MPL, indicate your
dnl decision by deleting the provisions above and replace them with the notice
dnl and other provisions required by the GPL or the LGPL. If you do not delete
dnl the provisions above, a recipient may use your version of this file under
dnl the terms of any one of the MPL, the GPL or the LGPL.
dnl
dnl ***** END LICENSE BLOCK *****

dnl altoptions.m4 - An alternative way of specifying command-line options.
dnl    These macros are needed to support a menu-based configurator.
dnl    This file also includes the macro, AM_READ_MYCONFIG, for reading
dnl    the 'myconfig.m4' file.

dnl Send comments, improvements, bugs to Steve Lamm (slamm@netscape.com).


dnl MOZ_ARG_ENABLE_BOOL(           NAME, HELP, IF-YES [, IF-NO [, ELSE]])
dnl MOZ_ARG_DISABLE_BOOL(          NAME, HELP, IF-NO [, IF-YES [, ELSE]])
dnl MOZ_ARG_ENABLE_STRING(         NAME, HELP, IF-SET [, ELSE])
dnl MOZ_ARG_ENABLE_BOOL_OR_STRING( NAME, HELP, IF-YES, IF-NO, IF-SET[, ELSE]]])
dnl MOZ_ARG_WITH_BOOL(             NAME, HELP, IF-YES [, IF-NO [, ELSE])
dnl MOZ_ARG_WITHOUT_BOOL(          NAME, HELP, IF-NO [, IF-YES [, ELSE])
dnl MOZ_ARG_WITH_STRING(           NAME, HELP, IF-SET [, ELSE])
dnl MOZ_ARG_HEADER(Comment)
dnl MOZ_CHECK_PTHREADS(            NAME, IF-YES [, ELSE ])
dnl MOZ_READ_MYCONFIG() - Read in 'myconfig.sh' file


dnl MOZ_TWO_STRING_TEST(NAME, VAL, STR1, IF-STR1, STR2, IF-STR2 [, ELSE])
AC_DEFUN([MOZ_TWO_STRING_TEST],
[if test "[$2]" = "[$3]"; then
    ifelse([$4], , :, [$4])
  elif test "[$2]" = "[$5]"; then
    ifelse([$6], , :, [$6])
  else
    ifelse([$7], ,
      [AC_MSG_ERROR([Option, [$1], does not take an argument ([$2]).])],
      [$7])
  fi])

dnl MOZ_ARG_ENABLE_BOOL(NAME, HELP, IF-YES [, IF-NO [, ELSE]])
AC_DEFUN([MOZ_ARG_ENABLE_BOOL],
[AC_ARG_ENABLE([$1], [$2], 
 [MOZ_TWO_STRING_TEST([$1], [$enableval], yes, [$3], no, [$4])],
 [$5])])

dnl MOZ_ARG_DISABLE_BOOL(NAME, HELP, IF-NO [, IF-YES [, ELSE]])
AC_DEFUN([MOZ_ARG_DISABLE_BOOL],
[AC_ARG_ENABLE([$1], [$2],
 [MOZ_TWO_STRING_TEST([$1], [$enableval], no, [$3], yes, [$4])],
 [$5])])

dnl MOZ_ARG_ENABLE_STRING(NAME, HELP, IF-SET [, ELSE])
AC_DEFUN([MOZ_ARG_ENABLE_STRING],
[AC_ARG_ENABLE([$1], [$2], [$3], [$4])])

dnl MOZ_ARG_ENABLE_BOOL_OR_STRING(NAME, HELP, IF-YES, IF-NO, IF-SET[, ELSE]]])
AC_DEFUN([MOZ_ARG_ENABLE_BOOL_OR_STRING],
[ifelse([$5], , 
 [errprint([Option, $1, needs an "IF-SET" argument.
])
  m4exit(1)],
 [AC_ARG_ENABLE([$1], [$2],
  [MOZ_TWO_STRING_TEST([$1], [$enableval], yes, [$3], no, [$4], [$5])],
  [$6])])])

dnl MOZ_ARG_WITH_BOOL(NAME, HELP, IF-YES [, IF-NO [, ELSE])
AC_DEFUN([MOZ_ARG_WITH_BOOL],
[AC_ARG_WITH([$1], [$2],
 [MOZ_TWO_STRING_TEST([$1], [$withval], yes, [$3], no, [$4])],
 [$5])])

dnl MOZ_ARG_WITHOUT_BOOL(NAME, HELP, IF-NO [, IF-YES [, ELSE])
AC_DEFUN([MOZ_ARG_WITHOUT_BOOL],
[AC_ARG_WITH([$1], [$2],
 [MOZ_TWO_STRING_TEST([$1], [$withval], no, [$3], yes, [$4])],
 [$5])])

dnl MOZ_ARG_WITH_STRING(NAME, HELP, IF-SET [, ELSE])
AC_DEFUN([MOZ_ARG_WITH_STRING],
[AC_ARG_WITH([$1], [$2], [$3], [$4])])

dnl MOZ_ARG_HEADER(Comment)
dnl This is used by webconfig to group options
define(MOZ_ARG_HEADER, [# $1])

dnl
dnl Apparently, some systems cannot properly check for the pthread
dnl library unless <pthread.h> is included so we need to test
dnl using it
dnl
dnl MOZ_CHECK_PTHREADS(lib, success, failure)
AC_DEFUN([MOZ_CHECK_PTHREADS],
[
AC_MSG_CHECKING([for pthread_create in -l$1])
echo "
    #include <pthread.h>
    #include <stdlib.h>
    void *foo(void *v) { int a = 1;  } 
    int main() { 
        pthread_t t;
        if (!pthread_create(&t, 0, &foo, 0)) {
            pthread_join(t, 0);
        }
        exit(0);
    }" > dummy.c ;
    echo "${CC-cc} -o dummy${ac_exeext} dummy.c $CFLAGS $CPPFLAGS -l[$1] $LDFLAGS $LIBS" 1>&5;
    ${CC-cc} -o dummy${ac_exeext} dummy.c $CFLAGS $CPPFLAGS -l[$1] $LDFLAGS $LIBS 2>&5;
    _res=$? ;
    rm -f dummy.c dummy${ac_exeext} ;
    if test "$_res" = "0"; then
        AC_MSG_RESULT([yes])
        [$2]
    else
        AC_MSG_RESULT([no])
        [$3]
    fi
])

dnl MOZ_READ_MYCONFIG() - Read in 'myconfig.sh' file
AC_DEFUN([MOZ_READ_MOZCONFIG],
[AC_REQUIRE([AC_INIT_BINSH])dnl
# Read in '.mozconfig' script to set the initial options.
# See the mozconfig2configure script for more details.
_AUTOCONF_TOOLS_DIR=`dirname [$]0`/[$1]/build/autoconf
. $_AUTOCONF_TOOLS_DIR/mozconfig2configure])
