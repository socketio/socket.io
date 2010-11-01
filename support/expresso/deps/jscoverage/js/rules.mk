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
# Portions created by the Initial Developer are Copyright (C) 1998-1999
# the Initial Developer. All Rights Reserved.
# 
# Contributor(s):
#   Michael Ang <mang@subcarrier.org>
# 
# Alternatively, the contents of this file may be used under the terms of
# either of the GNU General Public License Version 2 or later (the "GPL"),
# or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
# JSRef GNUmake makefile rules
#

ifdef USE_MSVC
LIB_OBJS  = $(addprefix $(OBJDIR)/, $(LIB_CPPFILES:.cpp=.obj))
PROG_OBJS = $(addprefix $(OBJDIR)/, $(PROG_CPPFILES:.cpp=.obj))
else
LIB_OBJS  = $(addprefix $(OBJDIR)/, $(LIB_CPPFILES:.cpp=.o))
LIB_OBJS  += $(addprefix $(OBJDIR)/, $(LIB_ASFILES:.s=.o))
PROG_OBJS = $(addprefix $(OBJDIR)/, $(PROG_CPPFILES:.cpp=.o))
endif

CPPFILES = $(LIB_CPPFILES) $(PROG_CPPFILES)
OBJS   = $(LIB_OBJS) $(PROG_OBJS)

ifdef USE_MSVC
# TARGETS = $(LIBRARY)   # $(PROGRAM) not supported for MSVC yet
TARGETS += $(SHARED_LIBRARY) $(PROGRAM)  # it is now
else
TARGETS += $(LIBRARY) $(SHARED_LIBRARY) $(PROGRAM) 
endif

all:
	+$(LOOP_OVER_PREDIRS) 
ifneq "$(strip $(TARGETS))" ""
	$(MAKE) -f Makefile.ref $(TARGETS)
endif
	+$(LOOP_OVER_DIRS)

$(OBJDIR)/%: %.cpp
	@$(MAKE_OBJDIR)
	$(CXX) -o $@ $(CFLAGS) $(OPTIMIZER) $< $(LDFLAGS)

# This rule must come before the rule with no dep on header
$(OBJDIR)/%.o: %.cpp %.h
	@$(MAKE_OBJDIR)
	$(CXX) -o $@ -c $(CFLAGS) $(OPTIMIZER) $<

$(OBJDIR)/jsinterp.o: jsinterp.cpp jsinterp.h
	@$(MAKE_OBJDIR)
	$(CXX) -o $@ -c $(CFLAGS) $(INTERP_OPTIMIZER) jsinterp.cpp

$(OBJDIR)/jsbuiltins.o: jsbuiltins.cpp jsinterp.h
	@$(MAKE_OBJDIR)
	$(CXX) -o $@ -c $(CFLAGS) $(BUILTINS_OPTIMIZER) jsbuiltins.cpp

$(OBJDIR)/%.o: %.cpp
	@$(MAKE_OBJDIR)
	$(CXX) -o $@ -c $(CFLAGS) $(OPTIMIZER) $<

$(OBJDIR)/%.o: %.s
	@$(MAKE_OBJDIR)
	$(AS) -o $@ $(ASFLAGS) $<

# This rule must come before rule with no dep on header
$(OBJDIR)/%.obj: %.cpp %.h
	@$(MAKE_OBJDIR)
	$(CXX) -Fo$(OBJDIR)/ -c $(CFLAGS) $(JSDLL_CFLAGS) $(OPTIMIZER) $<

$(OBJDIR)/jsinterp.obj: jsinterp.cpp jsinterp.h
	@$(MAKE_OBJDIR)
	$(CXX) -Fo$(OBJDIR)/ -c $(CFLAGS) $(JSDLL_CFLAGS) $(INTERP_OPTIMIZER) jsinterp.cpp

$(OBJDIR)/jsbuiltins.obj: jsbuiltins.cpp jsinterp.h
	@$(MAKE_OBJDIR)
	$(CXX) -Fo$(OBJDIR)/ -c $(CFLAGS) $(JSDLL_CFLAGS) $(BUILTINS_OPTIMIZER) jsbuiltins.cpp

$(OBJDIR)/%.obj: %.cpp
	@$(MAKE_OBJDIR)
	$(CXX) -Fo$(OBJDIR)/ -c $(CFLAGS) $(JSDLL_CFLAGS) $(OPTIMIZER) $<

$(OBJDIR)/js.obj: js.cpp
	@$(MAKE_OBJDIR)
	$(CXX) -Fo$(OBJDIR)/ -c $(CFLAGS) $(OPTIMIZER) $<

ifeq ($(OS_ARCH),OS2)
$(LIBRARY): $(LIB_OBJS)
	$(AR) $@ $? $(AR_OS2_SUFFIX)
	$(RANLIB) $@
else
ifdef USE_MSVC
$(SHARED_LIBRARY): $(LIB_OBJS)
	link.exe $(LIB_LINK_FLAGS) /base:0x61000000 $(OTHER_LIBS) \
	    /out:"$@" /pdb:none\
	    /implib:"$(OBJDIR)/$(@F:.dll=.lib)" $^
else
$(LIBRARY): $(LIB_OBJS)
	$(AR) rv $@ $?
	$(RANLIB) $@

$(SHARED_LIBRARY): $(LIB_OBJS)
	$(MKSHLIB) -o $@ $(LIB_OBJS) $(LDFLAGS) $(OTHER_LIBS)
endif
endif

# Java stuff
$(CLASSDIR)/$(OBJDIR)/$(JARPATH)/%.class: %.java
	mkdir -p $(@D)
	$(JAVAC) $(JAVAC_FLAGS) $<

define MAKE_OBJDIR
if test ! -d $(@D); then rm -rf $(@D); mkdir -p $(@D); fi
endef

ifdef DIRS
LOOP_OVER_DIRS		=					\
	@for d in $(DIRS); do					\
		if test -d $$d; then				\
			set -e;			\
			echo "cd $$d; $(MAKE) -f Makefile.ref $@"; 		\
			cd $$d; $(MAKE) -f Makefile.ref $@; cd ..;	\
			set +e;					\
		else						\
			echo "Skipping non-directory $$d...";	\
		fi;						\
	done
endif

ifdef PREDIRS
LOOP_OVER_PREDIRS	=					\
	@for d in $(PREDIRS); do				\
		if test -d $$d; then				\
			set -e;			\
			echo "cd $$d; $(MAKE) -f Makefile.ref $@"; 		\
			cd $$d; $(MAKE) -f Makefile.ref $@; cd ..;	\
			set +e;					\
		else						\
			echo "Skipping non-directory $$d...";	\
		fi;						\
	done
endif

export:
	+$(LOOP_OVER_PREDIRS)	
	mkdir -p $(DIST)/include $(DIST)/$(LIBDIR) $(DIST)/bin
ifneq "$(strip $(HFILES))" ""
	$(CP) $(HFILES) $(DIST)/include
endif
ifneq "$(strip $(LIBRARY))" ""
	$(CP) $(LIBRARY) $(DIST)/$(LIBDIR)
endif
ifneq "$(strip $(JARS))" ""
	$(CP) $(JARS) $(DIST)/$(LIBDIR)
endif
ifneq "$(strip $(SHARED_LIBRARY))" ""
	$(CP) $(SHARED_LIBRARY) $(DIST)/$(LIBDIR)
endif
ifneq "$(strip $(PROGRAM))" ""
	$(CP) $(PROGRAM) $(DIST)/bin
endif
	+$(LOOP_OVER_DIRS)

clean:
	+$(LOOP_OVER_PREDIRS)
	rm -rf $(OBJS) $(GARBAGE)

clobber:
	+$(LOOP_OVER_PREDIRS)
	rm -rf $(OBJS) $(TARGETS) $(DEPENDENCIES) $(GARBAGE)
	if test -d $(OBJDIR); then rmdir $(OBJDIR); fi

tar:
	tar cvf $(TARNAME) $(TARFILES)
	gzip $(TARNAME)

