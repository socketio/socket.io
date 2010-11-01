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
# Config stuff for HPUX
#

ifdef NS_USE_NATIVE
  CC  = cc +Z +DAportable +DS2.0 +u4
#  LD  = aCC +Z -b -Wl,+s -Wl,-B,symbolic
else
  CC = gcc -Wall -Wno-format -fPIC
  CCC = g++ -Wall -Wno-format -fPIC
endif

RANLIB = echo
MKSHLIB = $(LD) -b

SO_SUFFIX = sl

#.c.o:
#	$(CC) -c -MD $*.d $(CFLAGS) $<

CPU_ARCH = hppa
GFX_ARCH = x

OS_CFLAGS = -DXP_UNIX -DHPUX -DSYSV -D_HPUX -DNATIVE -D_POSIX_C_SOURCE=199506L -DHAVE_LOCALTIME_R
OS_LIBS = -ldld

XLDFLAGS = -lpthread

ifeq ($(OS_RELEASE),B.10)
PLATFORM_FLAGS		+= -DHPUX10 -Dhpux10
PORT_FLAGS		+= -DRW_NO_OVERLOAD_SCHAR -DHAVE_MODEL_H
ifeq ($(OS_VERSION),.10)
PLATFORM_FLAGS		+= -DHPUX10_10
endif
ifeq ($(OS_VERSION),.20)
PLATFORM_FLAGS		+= -DHPUX10_20
endif
ifeq ($(OS_VERSION),.30)
PLATFORM_FLAGS		+= -DHPUX10_30
endif
endif
