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
# Config stuff for IRIX
#

CPU_ARCH = mips
GFX_ARCH = x

RANLIB = /bin/true

#NS_USE_GCC = 1

ifndef NS_USE_NATIVE
CC = gcc
CCC = g++
AS = $(CC) -x assembler-with-cpp
ODD_CFLAGS = -Wall -Wno-format
ifdef BUILD_OPT
OPTIMIZER = -O6
endif
else
ifeq ($(OS_RELEASE),6.2)
CC	= cc -n32 -DIRIX6_2
endif
ifeq ($(OS_RELEASE),6.3)
CC	= cc -n32 -DIRIX6_3
endif
ifeq ($(OS_RELEASE),6.5)
CC	= cc -n32 -DIRIX6_5
endif
CCC = CC
# LD  = CC
ODD_CFLAGS = -fullwarn -xansi
ifdef BUILD_OPT
OPTIMIZER += -Olimit 4000
endif
endif

# For purify
HAVE_PURIFY = 1
PURE_OS_CFLAGS = $(ODD_CFLAGS) -DXP_UNIX -DSVR4 -DSW_THREADS -DIRIX -DHAVE_LOCALTIME_R

OS_CFLAGS = $(PURE_OS_CFLAGS) -MDupdate $(DEPENDENCIES)

BSDECHO	= echo
MKSHLIB = $(LD) -n32 -shared

# Use the editline library to provide line-editing support.
JS_EDITLINE = 1
