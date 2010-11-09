# -*- tab-width: 4; -*-
# Configure paths for NSPR
# Public domain - Chris Seawood <cls@seawood.org> 2001-04-05
# Based upon gtk.m4 (also PD) by Owen Taylor

dnl AM_PATH_NSPR([MINIMUM-VERSION, [ACTION-IF-FOUND [, ACTION-IF-NOT-FOUND]]])
dnl Test for NSPR, and define NSPR_CFLAGS and NSPR_LIBS
AC_DEFUN([AM_PATH_NSPR],
[dnl

AC_ARG_WITH(nspr-prefix,
	[  --with-nspr-prefix=PFX  Prefix where NSPR is installed],
	nspr_config_prefix="$withval",
	nspr_config_prefix="")

AC_ARG_WITH(nspr-exec-prefix,
	[  --with-nspr-exec-prefix=PFX
                          Exec prefix where NSPR is installed],
	nspr_config_exec_prefix="$withval",
	nspr_config_exec_prefix="")

	if test -n "$nspr_config_exec_prefix"; then
		nspr_config_args="$nspr_config_args --exec-prefix=$nspr_config_exec_prefix"
		if test -z "$NSPR_CONFIG"; then
			NSPR_CONFIG=$nspr_config_exec_prefix/bin/nspr-config
		fi
	fi
	if test -n "$nspr_config_prefix"; then
		nspr_config_args="$nspr_config_args --prefix=$nspr_config_prefix"
		if test -z "$NSPR_CONFIG"; then
			NSPR_CONFIG=$nspr_config_prefix/bin/nspr-config
		fi
	fi

	unset ac_cv_path_NSPR_CONFIG
	AC_PATH_PROG(NSPR_CONFIG, nspr-config, no)
	min_nspr_version=ifelse([$1], ,4.0.0,$1)
	AC_MSG_CHECKING(for NSPR - version >= $min_nspr_version)

	no_nspr=""
	if test "$NSPR_CONFIG" = "no"; then
		no_nspr="yes"
	else
		NSPR_CFLAGS=`$NSPR_CONFIG $nspr_config_args --cflags`
		NSPR_LIBS=`$NSPR_CONFIG $nspr_config_args --libs`

		nspr_config_major_version=`$NSPR_CONFIG $nspr_config_args --version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\1/'`
		nspr_config_minor_version=`$NSPR_CONFIG $nspr_config_args --version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\2/'`
		nspr_config_micro_version=`$NSPR_CONFIG $nspr_config_args --version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\3/'`
		min_nspr_major_version=`echo $min_nspr_version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\1/'`
		min_nspr_minor_version=`echo $min_nspr_version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\2/'`
		min_nspr_micro_version=`echo $min_nspr_version | \
			sed 's/\([[0-9]]*\).\([[0-9]]*\).\([[0-9]]*\)/\3/'`
		if test "$nspr_config_major_version" -ne "$min_nspr_major_version"; then
			no_nspr="yes"
		elif test "$nspr_config_major_version" -eq "$min_nspr_major_version" &&
		     test "$nspr_config_minor_version" -lt "$min_nspr_minor_version"; then
			no_nspr="yes"
		elif test "$nspr_config_major_version" -eq "$min_nspr_major_version" &&
		     test "$nspr_config_minor_version" -eq "$min_nspr_minor_version" &&
		     test "$nspr_config_micro_version" -lt "$min_nspr_micro_version"; then
			no_nspr="yes"
		fi
	fi

	if test -z "$no_nspr"; then
		AC_MSG_RESULT(yes)
		ifelse([$2], , :, [$2])     
	else
		AC_MSG_RESULT(no)
	fi


	AC_SUBST(NSPR_CFLAGS)
	AC_SUBST(NSPR_LIBS)

])
