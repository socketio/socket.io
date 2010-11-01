# -*- Mode: makefile -*-
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

#
# Config stuff for SunOS5.4
#

ifdef NS_USE_NATIVE
CC = cc
CCC = CC
else
CC = gcc
CCC = g++
CFLAGS += -Wall -Wno-format
endif

RANLIB = echo

CPU_ARCH = sparc
GFX_ARCH = x

OS_CFLAGS = -DXP_UNIX -DSVR4 -DSYSV -D__svr4 -DSOLARIS -DHAVE_LOCALTIME_R
OS_LIBS = -lsocket -lnsl -ldl

ASFLAGS	        += -P -L -K PIC -D_ASM -D__STDC__=0

HAVE_PURIFY = 1

NOSUCHFILE = /solaris-rm-f-sucks

ifndef JS_NO_ULTRA
ULTRA_OPTIONS := -xarch=v8plus
ULTRA_OPTIONSD := -DULTRA_SPARC
else
ULTRA_OPTIONS := -xarch=v8
ULTRA_OPTIONSD :=
endif

ifeq ($(OS_CPUARCH),sun4u)
DEFINES 	+= $(ULTRA_OPTIONSD)
ifeq ($(findstring gcc,$(CC)),gcc)
DEFINES         += -Wa,$(ULTRA_OPTIONS),$(ULTRA_OPTIONSD)
else
ASFLAGS         += $(ULTRA_OPTIONS) $(ULTRA_OPTIONSD)
endif
endif

ifeq ($(OS_CPUARCH),sun4m)
ifeq ($(findstring gcc,$(CC)),gcc)
DEFINES         += -Wa,-xarch=v8
else
ASFLAGS         += -xarch=v8
endif
endif

MKSHLIB = $(LD) -G
