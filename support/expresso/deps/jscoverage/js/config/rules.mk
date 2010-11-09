# vim:set ts=8 sw=8 sts=8 noet:
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
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Chase Phillips <chase@mozilla.org>
#  Benjamin Smedberg <benjamin@smedbergs.us>
#  Jeff Walden <jwalden+code@mit.edu>
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
NO_DIST_INSTALL = 1

ifndef topsrcdir
topsrcdir		= $(DEPTH)
endif

ifndef MOZILLA_DIR
MOZILLA_DIR = $(topsrcdir)
endif

ifndef INCLUDED_CONFIG_MK
include $(topsrcdir)/config/config.mk
endif

ifndef INCLUDED_VERSION_MK
include $(topsrcdir)/config/version.mk
endif

REPORT_BUILD = @echo $(notdir $<)

ifeq ($(OS_ARCH),OS2)
EXEC			=
else
EXEC			= exec
endif

# ELOG prints out failed command when building silently (gmake -s).
ifneq (,$(findstring -s,$(MAKEFLAGS)))
  ELOG := $(EXEC) sh $(BUILD_TOOLS)/print-failed-commands.sh
else
  ELOG :=
endif

ifeq (,$(filter-out WINNT WINCE,$(OS_ARCH)))
ifndef GNU_CC
_LIBNAME_RELATIVE_PATHS=1
endif
endif

ifeq (,$(filter-out WINNT WINCE,$(OS_ARCH)))
PWD := $(shell pwd)
_VPATH_SRCS = $(if $(filter /%,$<),$<,$(PWD)/$<)
else
_VPATH_SRCS = $<
endif

# Add $(DIST)/lib to VPATH so that -lfoo dependencies are followed
VPATH += $(DIST)/lib
ifdef LIBXUL_SDK
VPATH += $(LIBXUL_SDK)/lib
endif

# EXPAND_LIBNAME - $(call EXPAND_LIBNAME,foo)
# expands to foo.lib on platforms with import libs and -lfoo otherwise

# EXPAND_LIBNAME_PATH - $(call EXPAND_LIBNAME_PATH,foo,dir)
# expands to dir/foo.lib on platforms with import libs and
# -Ldir -lfoo otherwise

# EXPAND_MOZLIBNAME - $(call EXPAND_MOZLIBNAME,foo)
# expands to $(DIST)/lib/foo.lib on platforms with import libs and
# -lfoo otherwise

ifdef _LIBNAME_RELATIVE_PATHS
EXPAND_LIBNAME = $(foreach lib,$(1),$(LIB_PREFIX)$(lib).$(LIB_SUFFIX))
EXPAND_LIBNAME_PATH = $(foreach lib,$(1),$(2)/$(LIB_PREFIX)$(lib).$(LIB_SUFFIX))
EXPAND_MOZLIBNAME = $(foreach lib,$(1),$(DIST)/lib/$(LIB_PREFIX)$(lib).$(LIB_SUFFIX))
else
EXPAND_LIBNAME = $(addprefix -l,$(1))
EXPAND_LIBNAME_PATH = -L$(2) $(addprefix -l,$(1))
EXPAND_MOZLIBNAME = $(addprefix -l,$(1))
endif

ifdef EXTRA_DSO_LIBS
EXTRA_DSO_LIBS	:= $(call EXPAND_MOZLIBNAME,$(EXTRA_DSO_LIBS))
endif

#
# Library rules
#
# If BUILD_STATIC_LIBS or FORCE_STATIC_LIB is set, build a static library.
# Otherwise, build a shared library.
#

ifndef LIBRARY
ifdef LIBRARY_NAME
ifneq (,$(filter OS2 WINNT WINCE,$(OS_ARCH)))
ifdef SHORT_LIBNAME
LIBRARY_NAME		:= $(SHORT_LIBNAME)
endif
endif
LIBRARY			:= $(LIB_PREFIX)$(LIBRARY_NAME).$(LIB_SUFFIX)
endif
endif

ifndef HOST_LIBRARY
ifdef HOST_LIBRARY_NAME
HOST_LIBRARY		:= $(LIB_PREFIX)$(HOST_LIBRARY_NAME).$(LIB_SUFFIX)
endif
endif

ifdef LIBRARY
ifneq (_1,$(FORCE_SHARED_LIB)_$(BUILD_STATIC_LIBS))
ifdef MKSHLIB

ifdef LIB_IS_C_ONLY
MKSHLIB			= $(MKCSHLIB)
endif

ifdef MAKE_FRAMEWORK
SHARED_LIBRARY		:= $(LIBRARY_NAME)
else
SHARED_LIBRARY		:= $(DLL_PREFIX)$(LIBRARY_NAME)$(DLL_SUFFIX)
endif

ifeq ($(OS_ARCH),OS2)
DEF_FILE		:= $(SHARED_LIBRARY:.dll=.def)
endif

ifneq (,$(filter OS2 WINNT WINCE,$(OS_ARCH)))
IMPORT_LIBRARY		:= $(LIB_PREFIX)$(LIBRARY_NAME).$(IMPORT_LIB_SUFFIX)
endif

ifdef MOZ_ENABLE_LIBXUL
EMBED_MANIFEST_AT=2
endif

endif # MKSHLIB
endif # FORCE_SHARED_LIB && !BUILD_STATIC_LIBS
endif # LIBRARY

ifeq (,$(BUILD_STATIC_LIBS)$(FORCE_STATIC_LIB))
LIBRARY			:= $(NULL)
endif

ifeq (_1,$(FORCE_SHARED_LIB)_$(BUILD_STATIC_LIBS))
SHARED_LIBRARY		:= $(NULL)
DEF_FILE		:= $(NULL)
IMPORT_LIBRARY		:= $(NULL)
endif

ifdef FORCE_STATIC_LIB
ifndef FORCE_SHARED_LIB
SHARED_LIBRARY		:= $(NULL)
DEF_FILE		:= $(NULL)
IMPORT_LIBRARY		:= $(NULL)
endif
endif

ifdef FORCE_SHARED_LIB
ifndef FORCE_STATIC_LIB
LIBRARY			:= $(NULL)
endif
endif

ifdef JAVA_LIBRARY_NAME
JAVA_LIBRARY := $(JAVA_LIBRARY_NAME).jar
endif

ifeq (,$(filter-out WINNT WINCE,$(OS_ARCH)))
ifndef GNU_CC

#
# All C++ files share a PDB file per directory. For parallel builds, this PDB
# file is shared and locked by MSPDBSRV.EXE, starting with MSVC8 SP1. If
# you're using MSVC 7.1 or MSVC8 without SP1, don't do parallel builds.
#
# The final PDB for libraries and programs is created by the linker and uses
# a different name from the single PDB file created by the compiler. See
# bug 462740.
#
COMPILE_PDBFILE = generated.pdb
LINK_PDBFILE = $(basename $(@F)).pdb
ifdef MOZ_DEBUG
CODFILE=$(basename $(@F)).cod
endif

ifdef MOZ_MAPINFO
ifdef LIBRARY_NAME
MAPFILE=$(LIBRARY_NAME).map
else
MAPFILE=$(basename $(@F)).map
endif # LIBRARY_NAME
endif # MOZ_MAPINFO

ifdef DEFFILE
OS_LDFLAGS += -DEF:$(DEFFILE)
EXTRA_DEPS += $(DEFFILE)
endif

ifdef MAPFILE
OS_LDFLAGS += -MAP:$(MAPFILE)
#CFLAGS += -Fm$(MAPFILE)
#CXXFLAGS += -Fm$(MAPFILE)
endif

#ifdef CODFILE
#CFLAGS += -Fa$(CODFILE) -FAsc
#CFLAGS += -Fa$(CODFILE) -FAsc
#endif

endif # !GNU_CC

ifdef ENABLE_CXX_EXCEPTIONS
ifdef GNU_CC
CXXFLAGS		+= -fexceptions
else
ifeq (,$(filter-out 1200 1300 1310,$(_MSC_VER)))
CXXFLAGS		+= -GX
else
CXXFLAGS		+= -EHsc
endif # _MSC_VER
endif # GNU_CC
endif # ENABLE_CXX_EXCEPTIONS
endif # WINNT

ifeq (,$(filter-out WINNT WINCE,$(HOST_OS_ARCH)))
HOST_PDBFILE=$(basename $(@F)).pdb
endif

ifndef TARGETS
TARGETS			= $(LIBRARY) $(SHARED_LIBRARY) $(PROGRAM) $(SIMPLE_PROGRAMS) $(HOST_LIBRARY) $(HOST_PROGRAM) $(HOST_SIMPLE_PROGRAMS) $(JAVA_LIBRARY)
endif

ifndef OBJS
_OBJS			= \
	$(JRI_STUB_CFILES) \
	$(addsuffix .$(OBJ_SUFFIX), $(JMC_GEN)) \
	$(CSRCS:.c=.$(OBJ_SUFFIX)) \
	$(patsubst %.cc,%.$(OBJ_SUFFIX),$(CPPSRCS:.cpp=.$(OBJ_SUFFIX))) \
	$(CMSRCS:.m=.$(OBJ_SUFFIX)) \
	$(CMMSRCS:.mm=.$(OBJ_SUFFIX)) \
	$(ASFILES:.$(ASM_SUFFIX)=.$(OBJ_SUFFIX))
OBJS	= $(strip $(_OBJS))
endif

ifndef HOST_OBJS
_HOST_OBJS		= \
        $(addprefix host_,$(HOST_CSRCS:.c=.$(OBJ_SUFFIX))) \
	$(addprefix host_,$(patsubst %.cc,%.$(OBJ_SUFFIX),$(HOST_CPPSRCS:.cpp=.$(OBJ_SUFFIX)))) \
	$(addprefix host_,$(HOST_CMSRCS:.m=.$(OBJ_SUFFIX))) \
	$(addprefix host_,$(HOST_CMMSRCS:.mm=.$(OBJ_SUFFIX)))
HOST_OBJS = $(strip $(_HOST_OBJS))
endif

LIBOBJS			:= $(addprefix \", $(OBJS))
LIBOBJS			:= $(addsuffix \", $(LIBOBJS))

ifndef MOZ_AUTO_DEPS
ifneq (,$(OBJS)$(XPIDLSRCS)$(SDK_XPIDLSRCS)$(SIMPLE_PROGRAMS))
MDDEPFILES		= $(addprefix $(MDDEPDIR)/,$(OBJS:.$(OBJ_SUFFIX)=.pp))
ifndef NO_GEN_XPT
MDDEPFILES		+= $(addprefix $(MDDEPDIR)/,$(XPIDLSRCS:.idl=.xpt)) \
			   $(addprefix $(MDDEPDIR)/,$(SDK_XPIDLSRCS:.idl=.xpt))
endif
endif
endif

ALL_TRASH = \
	$(GARBAGE) $(TARGETS) $(OBJS) $(PROGOBJS) LOGS TAGS a.out \
	$(filter-out $(ASFILES),$(OBJS:.$(OBJ_SUFFIX)=.s)) $(OBJS:.$(OBJ_SUFFIX)=.ii) \
	$(OBJS:.$(OBJ_SUFFIX)=.i) \
	$(HOST_PROGOBJS) $(HOST_OBJS) $(IMPORT_LIBRARY) $(DEF_FILE)\
	$(EXE_DEF_FILE) so_locations _gen _stubs $(wildcard *.res) $(wildcard *.RES) \
	$(wildcard *.pdb) $(CODFILE) $(MAPFILE) $(IMPORT_LIBRARY) \
	$(SHARED_LIBRARY:$(DLL_SUFFIX)=.exp) $(wildcard *.ilk) \
	$(PROGRAM:$(BIN_SUFFIX)=.exp) $(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.exp) \
	$(PROGRAM:$(BIN_SUFFIX)=.lib) $(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.lib) \
	$(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.$(OBJ_SUFFIX)) \
	$(wildcard gts_tmp_*) $(LIBRARY:%.a=.%.timestamp)
ALL_TRASH_DIRS = \
	$(GARBAGE_DIRS) /no-such-file

ifdef QTDIR
GARBAGE                 += $(MOCSRCS)
endif

ifdef SIMPLE_PROGRAMS
GARBAGE			+= $(SIMPLE_PROGRAMS:%=%.$(OBJ_SUFFIX))
endif

ifdef HOST_SIMPLE_PROGRAMS
GARBAGE			+= $(HOST_SIMPLE_PROGRAMS:%=%.$(OBJ_SUFFIX))
endif

#
# the Solaris WorkShop template repository cache.  it occasionally can get
# out of sync, so targets like clobber should kill it.
#
ifeq ($(OS_ARCH),SunOS)
ifeq ($(GNU_CXX),)
GARBAGE_DIRS += SunWS_cache
endif
endif

ifeq ($(OS_ARCH),OpenVMS)
GARBAGE			+= $(wildcard *.*_defines)
ifdef SHARED_LIBRARY
VMS_SYMVEC_FILE		= $(SHARED_LIBRARY:$(DLL_SUFFIX)=_symvec.opt)
ifdef MOZ_DEBUG
VMS_SYMVEC_FILE_MODULE	= $(topsrcdir)/build/unix/vms/$(notdir $(SHARED_LIBRARY:$(DLL_SUFFIX)=_dbg_symvec.opt))
else
VMS_SYMVEC_FILE_MODULE	= $(topsrcdir)/build/unix/vms/$(notdir $(SHARED_LIBRARY:$(DLL_SUFFIX)=_symvec.opt))
endif
VMS_SYMVEC_FILE_COMP	= $(topsrcdir)/build/unix/vms/component_symvec.opt
GARBAGE			+= $(VMS_SYMVEC_FILE)
ifdef IS_COMPONENT
DSO_LDOPTS := $(filter-out -auto_symvec,$(DSO_LDOPTS)) $(VMS_SYMVEC_FILE)
endif
endif
endif

XPIDL_GEN_DIR		= _xpidlgen

ifdef MOZ_UPDATE_XTERM
# Its good not to have a newline at the end of the titlebar string because it
# makes the make -s output easier to read.  Echo -n does not work on all
# platforms, but we can trick sed into doing it.
UPDATE_TITLE = sed -e "s!Y!$@ in $(shell $(BUILD_TOOLS)/print-depth-path.sh)/$(dir)!" $(MOZILLA_DIR)/config/xterm.str;
UPDATE_TITLE_export = sed -e "s!Y!export in $(shell $(BUILD_TOOLS)/print-depth-path.sh)/$*!" $(MOZILLA_DIR)/config/xterm.str;
UPDATE_TITLE_libs = sed -e "s!Y!libs in $(shell $(BUILD_TOOLS)/print-depth-path.sh)/$*!" $(MOZILLA_DIR)/config/xterm.str;
UPDATE_TITLE_tools = sed -e "s!Y!tools in $(shell $(BUILD_TOOLS)/print-depth-path.sh)/$*!" $(MOZILLA_DIR)/config/xterm.str;
endif

LOOP_OVER_DIRS = \
    @$(EXIT_ON_ERROR) \
    $(foreach dir,$(DIRS),$(UPDATE_TITLE) $(MAKE) -C $(dir) $@; ) true

# we only use this for the makefiles target and other stuff that doesn't matter
LOOP_OVER_PARALLEL_DIRS = \
    @$(EXIT_ON_ERROR) \
    $(foreach dir,$(PARALLEL_DIRS),$(UPDATE_TITLE) $(MAKE) -C $(dir) $@; ) true

LOOP_OVER_STATIC_DIRS = \
    @$(EXIT_ON_ERROR) \
    $(foreach dir,$(STATIC_DIRS),$(UPDATE_TITLE) $(MAKE) -C $(dir) $@; ) true

LOOP_OVER_TOOL_DIRS = \
    @$(EXIT_ON_ERROR) \
    $(foreach dir,$(TOOL_DIRS),$(UPDATE_TITLE) $(MAKE) -C $(dir) $@; ) true

ifdef PARALLEL_DIRS
# create a bunch of fake targets for order-only processing
PARALLEL_DIRS_export = $(addsuffix _export,$(PARALLEL_DIRS))
PARALLEL_DIRS_libs = $(addsuffix _libs,$(PARALLEL_DIRS))
PARALLEL_DIRS_tools = $(addsuffix _tools,$(PARALLEL_DIRS))

.PHONY: $(PARALLEL_DIRS_export) $(PARALLEL_DIRS_libs) $(PARALLEL_DIRS_tools)
endif

#
# Now we can differentiate between objects used to build a library, and
# objects used to build an executable in the same directory.
#
ifndef PROGOBJS
PROGOBJS		= $(OBJS)
endif

ifndef HOST_PROGOBJS
HOST_PROGOBJS		= $(HOST_OBJS)
endif

# MAKE_DIRS: List of directories to build while looping over directories.
# A Makefile that needs $(MDDEPDIR) created but doesn't set any of these
# variables we know to check can just set NEED_MDDEPDIR explicitly.
ifneq (,$(OBJS)$(XPIDLSRCS)$(SDK_XPIDLSRCS)$(SIMPLE_PROGRAMS)$(NEED_MDDEPDIR))
MAKE_DIRS		+= $(CURDIR)/$(MDDEPDIR)
GARBAGE_DIRS		+= $(MDDEPDIR)
endif

#
# Tags: emacs (etags), vi (ctags)
# TAG_PROGRAM := ctags -L -
#
TAG_PROGRAM		= xargs etags -a

#
# Turn on C++ linking if we have any .cpp or .mm files
# (moved this from config.mk so that config.mk can be included 
#  before the CPPSRCS are defined)
#
ifneq ($(CPPSRCS)$(CMMSRCS),)
CPP_PROG_LINK		= 1
endif

#
# Make sure to wrap static libs inside linker specific flags to turn on & off
# inclusion of all symbols inside the static libs
#
ifndef NO_LD_ARCHIVE_FLAGS
ifdef SHARED_LIBRARY_LIBS
EXTRA_DSO_LDOPTS := $(MKSHLIB_FORCE_ALL) $(SHARED_LIBRARY_LIBS) $(MKSHLIB_UNFORCE_ALL) $(EXTRA_DSO_LDOPTS)
endif
endif

#
# This will strip out symbols that the component should not be 
# exporting from the .dynsym section.
#
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += $(MOZ_COMPONENTS_VERSION_SCRIPT_LDFLAGS)
endif # IS_COMPONENT

#
# Enforce the requirement that MODULE_NAME must be set 
# for components in static builds
#
ifdef IS_COMPONENT
ifdef EXPORT_LIBRARY
ifndef FORCE_SHARED_LIB
ifndef MODULE_NAME
$(error MODULE_NAME is required for components which may be used in static builds)
endif
endif
endif
endif

#
# MacOS X specific stuff
#

ifeq ($(OS_ARCH),Darwin)
ifdef SHARED_LIBRARY
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS	+= -bundle
else
EXTRA_DSO_LDOPTS	+= -dynamiclib -install_name @executable_path/$(SHARED_LIBRARY) -compatibility_version 1 -current_version 1 -single_module
endif
endif
endif

#
# On NetBSD a.out systems, use -Bsymbolic.  This fixes what would otherwise be
# fatal symbol name clashes between components.
#
ifeq ($(OS_ARCH),NetBSD)
ifeq ($(DLL_SUFFIX),.so.1.0)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif
endif

ifeq ($(OS_ARCH),FreeBSD)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif

ifeq ($(OS_ARCH),NetBSD)
ifneq (,$(filter arc cobalt hpcmips mipsco newsmips pmax sgimips,$(OS_TEST)))
ifeq ($(MODULE),layout)
OS_CFLAGS += -Wa,-xgot
OS_CXXFLAGS += -Wa,-xgot
endif
endif
endif

ifeq ($(OS_ARCH),Linux)
ifneq (,$(filter mips mipsel,$(OS_TEST)))
ifeq ($(MODULE),layout)
OS_CFLAGS += -Wa,-xgot
OS_CXXFLAGS += -Wa,-xgot
endif
endif
endif

#
# HP-UXBeOS specific section: for COMPONENTS only, add -Bsymbolic flag
# which uses internal symbols first
#
ifeq ($(OS_ARCH),HP-UX)
ifdef IS_COMPONENT
ifeq ($(GNU_CC)$(GNU_CXX),)
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
ifneq ($(HAS_EXTRAEXPORTS),1)
MKSHLIB  += -Wl,+eNSGetModule -Wl,+eerrno
MKCSHLIB += +eNSGetModule +eerrno
ifneq ($(OS_TEST),ia64)
MKSHLIB  += -Wl,+e_shlInit
MKCSHLIB += +e_shlInit
endif # !ia64
endif # !HAS_EXTRAEXPORTS
endif # non-gnu compilers
endif # IS_COMPONENT
endif # HP-UX

ifeq ($(OS_ARCH),AIX)
ifdef IS_COMPONENT
ifneq ($(HAS_EXTRAEXPORTS),1)
MKSHLIB += -bE:$(MOZILLA_DIR)/build/unix/aix.exp -bnoexpall
MKCSHLIB += -bE:$(MOZILLA_DIR)/build/unix/aix.exp -bnoexpall
endif # HAS_EXTRAEXPORTS
endif # IS_COMPONENT
endif # AIX

#
# OSF1: add -B symbolic flag for components
#
ifeq ($(OS_ARCH),OSF1)
ifdef IS_COMPONENT
ifeq ($(GNU_CC)$(GNU_CXX),)
EXTRA_DSO_LDOPTS += -B symbolic
endif  
endif  
endif

#
# Linux: add -Bsymbolic flag for components
# 
ifeq ($(OS_ARCH),Linux)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif 

#
# MINGW32
#
ifeq ($(OS_ARCH),WINNT)
ifdef GNU_CC
ifndef IS_COMPONENT
DSO_LDOPTS += -Wl,--out-implib -Wl,$(IMPORT_LIBRARY)
endif
endif
endif

ifeq ($(USE_TVFS),1)
IFLAGS1 = -rb
IFLAGS2 = -rb
else
IFLAGS1 = -m 644
IFLAGS2 = -m 755
endif

ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
OUTOPTION = -Fo# eol
else
OUTOPTION = -o # eol
endif # WINNT && !GNU_CC
ifneq (,$(filter WINCE,$(OS_ARCH)))
OUTOPTION = -Fo# eol
endif

ifeq ($(OS_TARGET), WINCE)
OUTOPTION = -Fo# eol
HOST_OUTOPTION = -Fo# eol
else

ifeq (,$(CROSS_COMPILE))
HOST_OUTOPTION = $(OUTOPTION)
else
HOST_OUTOPTION = -o # eol
endif

endif
################################################################################

# SUBMAKEFILES: List of Makefiles for next level down.
#   This is used to update or create the Makefiles before invoking them.
SUBMAKEFILES += $(addsuffix /Makefile, $(DIRS) $(TOOL_DIRS) $(PARALLEL_DIRS))

# The root makefile doesn't want to do a plain export/libs, because
# of the tiers and because of libxul. Suppress the default rules in favor
# of something else. Makefiles which use this var *must* provide a sensible
# default rule before including rules.mk
ifndef SUPPRESS_DEFAULT_RULES
ifdef TIERS

DIRS += $(foreach tier,$(TIERS),$(tier_$(tier)_dirs))
STATIC_DIRS += $(foreach tier,$(TIERS),$(tier_$(tier)_staticdirs))

default all alldep::
	$(EXIT_ON_ERROR) \
	$(foreach tier,$(TIERS),$(MAKE) tier_$(tier); ) true

else

default all::
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$(STATIC_DIRS),$(MAKE) -C $(dir); ) true
	$(MAKE) export
	$(MAKE) libs
	$(MAKE) tools

# Do depend as well
alldep:: 
	$(MAKE) export
	$(MAKE) depend
	$(MAKE) libs
	$(MAKE) tools

endif # TIERS
endif # SUPPRESS_DEFAULT_RULES

ifeq ($(filter s,$(MAKEFLAGS)),)
ECHO := echo
QUIET :=
else
ECHO := true
QUIET := -q
endif

MAKE_TIER_SUBMAKEFILES = +$(if $(tier_$*_dirs),$(MAKE) $(addsuffix /Makefile,$(tier_$*_dirs)))

export_tier_%: 
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$(tier_$*_dirs),$(MAKE) -C $(dir) export; ) true

libs_tier_%:
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$(tier_$*_dirs),$(MAKE) -C $(dir) libs; ) true

tools_tier_%:
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$(tier_$*_dirs),$(MAKE) -C $(dir) tools; ) true

$(foreach tier,$(TIERS),tier_$(tier))::
	@$(ECHO) "$@: $($@_staticdirs) $($@_dirs)"
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$($@_staticdirs),$(MAKE) -C $(dir); ) true
	$(MAKE) export_$@
	$(MAKE) libs_$@

# Do everything from scratch
everything::
	$(MAKE) clean
	$(MAKE) alldep

# Add dummy depend target for tinderboxes
depend::

ifdef ALL_PLATFORMS
all_platforms:: $(NFSPWD)
	@d=`$(NFSPWD)`;							\
	if test ! -d LOGS; then rm -rf LOGS; mkdir LOGS; else true; fi;	\
	for h in $(PLATFORM_HOSTS); do					\
		echo "On $$h: $(MAKE) $(ALL_PLATFORMS) >& LOGS/$$h.log";\
		rsh $$h -n "(chdir $$d;					\
			     $(MAKE) $(ALL_PLATFORMS) >& LOGS/$$h.log;	\
			     echo DONE) &" 2>&1 > LOGS/$$h.pid &	\
		sleep 1;						\
	done

$(NFSPWD):
	cd $(@D); $(MAKE) $(@F)
endif

# Target to only regenerate makefiles
makefiles: $(SUBMAKEFILES)
ifneq (,$(DIRS)$(TOOL_DIRS)$(PARALLEL_DIRS))
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)
endif

ifdef PARALLEL_DIRS
export:: $(PARALLEL_DIRS_export)

$(PARALLEL_DIRS_export): %_export: %/Makefile
	+@$(UPDATE_TITLE_export) $(MAKE) -C $* export
endif

export:: $(SUBMAKEFILES) $(MAKE_DIRS) $(if $(EXPORTS)$(XPIDLSRCS)$(SDK_HEADERS)$(SDK_XPIDLSRCS),$(PUBLIC)) $(if $(SDK_HEADERS)$(SDK_XPIDLSRCS),$(SDK_PUBLIC)) $(if $(XPIDLSRCS),$(IDL_DIR)) $(if $(SDK_XPIDLSRCS),$(SDK_IDL_DIR))
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)

ifdef PARALLEL_DIRS
tools:: $(PARALLEL_DIRS_tools)

$(PARALLEL_DIRS_tools): %_tools: %/Makefile
	+@$(UPDATE_TITLE_tools) $(MAKE) -C $* tools
endif

tools:: $(SUBMAKEFILES) $(MAKE_DIRS)
	+$(LOOP_OVER_DIRS)
ifdef TOOL_DIRS
	@$(EXIT_ON_ERROR) \
	$(foreach dir,$(TOOL_DIRS),$(UPDATE_TITLE) $(MAKE) -C $(dir) libs; ) true
endif

#
# Rule to create list of libraries for final link
#
export::
ifdef LIBRARY_NAME
ifdef EXPORT_LIBRARY
ifdef IS_COMPONENT
ifdef BUILD_STATIC_LIBS
	@$(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/build-list.pl $(FINAL_LINK_COMPS) $(LIBRARY_NAME)
ifdef MODULE_NAME
	@$(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/build-list.pl $(FINAL_LINK_COMP_NAMES) $(MODULE_NAME)
endif
endif
else
	$(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/build-list.pl $(FINAL_LINK_LIBS) $(LIBRARY_NAME)
endif # IS_COMPONENT
endif # EXPORT_LIBRARY
endif # LIBRARY_NAME

# Create dependencies on static (and shared EXTRA_DSO_LIBS) libraries
LIBS_DEPS = $(filter %.$(LIB_SUFFIX), $(LIBS))
HOST_LIBS_DEPS = $(filter %.$(LIB_SUFFIX), $(HOST_LIBS))
DSO_LDOPTS_DEPS = $(EXTRA_DSO_LIBS) $(filter %.$(LIB_SUFFIX), $(EXTRA_DSO_LDOPTS))

##############################################
ifdef PARALLEL_DIRS
libs:: $(PARALLEL_DIRS_libs)

$(PARALLEL_DIRS_libs): %_libs: %/Makefile
	+@$(UPDATE_TITLE_libs) $(MAKE) -C $* libs
endif

libs:: $(SUBMAKEFILES) $(MAKE_DIRS) $(HOST_LIBRARY) $(LIBRARY) $(SHARED_LIBRARY) $(IMPORT_LIBRARY) $(HOST_PROGRAM) $(PROGRAM) $(HOST_SIMPLE_PROGRAMS) $(SIMPLE_PROGRAMS) $(JAVA_LIBRARY)
ifndef NO_DIST_INSTALL
ifdef LIBRARY
ifdef EXPORT_LIBRARY # Stage libs that will be linked into a static build
ifdef IS_COMPONENT
	$(INSTALL) $(IFLAGS1) $(LIBRARY) $(DEPTH)/staticlib/components
else
	$(INSTALL) $(IFLAGS1) $(LIBRARY) $(DEPTH)/staticlib
endif
endif # EXPORT_LIBRARY
ifdef DIST_INSTALL
ifdef IS_COMPONENT
	$(error Shipping static component libs makes no sense.)
else
	$(INSTALL) $(IFLAGS1) $(LIBRARY) $(DIST)/lib
endif
endif # DIST_INSTALL
endif # LIBRARY
ifdef SHARED_LIBRARY
ifdef IS_COMPONENT
	$(INSTALL) $(IFLAGS2) $(SHARED_LIBRARY) $(FINAL_TARGET)/components
	$(ELF_DYNSTR_GC) $(FINAL_TARGET)/components/$(SHARED_LIBRARY)
ifdef BEOS_ADDON_WORKAROUND
	( cd $(FINAL_TARGET)/components && $(CC) -nostart -o $(SHARED_LIBRARY).stub $(SHARED_LIBRARY) )
endif
else # ! IS_COMPONENT
ifneq (,$(filter OS2 WINNT WINCE,$(OS_ARCH)))
	$(INSTALL) $(IFLAGS2) $(IMPORT_LIBRARY) $(DIST)/lib
else
	$(INSTALL) $(IFLAGS2) $(SHARED_LIBRARY) $(DIST)/lib
endif
	$(INSTALL) $(IFLAGS2) $(SHARED_LIBRARY) $(FINAL_TARGET)
ifdef BEOS_ADDON_WORKAROUND
	( cd $(FINAL_TARGET) && $(CC) -nostart -o $(SHARED_LIBRARY).stub $(SHARED_LIBRARY) )
endif
endif # IS_COMPONENT
endif # SHARED_LIBRARY
ifdef PROGRAM
	$(INSTALL) $(IFLAGS2) $(PROGRAM) $(FINAL_TARGET)
endif
ifdef SIMPLE_PROGRAMS
	$(INSTALL) $(IFLAGS2) $(SIMPLE_PROGRAMS) $(FINAL_TARGET)
endif
ifdef HOST_PROGRAM
	$(INSTALL) $(IFLAGS2) $(HOST_PROGRAM) $(DIST)/host/bin
endif
ifdef HOST_SIMPLE_PROGRAMS
	$(INSTALL) $(IFLAGS2) $(HOST_SIMPLE_PROGRAMS) $(DIST)/host/bin
endif
ifdef HOST_LIBRARY
	$(INSTALL) $(IFLAGS1) $(HOST_LIBRARY) $(DIST)/host/lib
endif
ifdef JAVA_LIBRARY
ifdef IS_COMPONENT
	$(INSTALL) $(IFLAGS1) $(JAVA_LIBRARY) $(FINAL_TARGET)/components
else
	$(INSTALL) $(IFLAGS1) $(JAVA_LIBRARY) $(FINAL_TARGET)
endif
endif # JAVA_LIBRARY
endif # !NO_DIST_INSTALL
	+$(LOOP_OVER_DIRS)

##############################################

ifndef NO_PROFILE_GUIDED_OPTIMIZE
ifneq (,$(MOZ_PROFILE_GENERATE)$(MOZ_PROFILE_USE))
ifeq ($(OS_ARCH)_$(GNU_CC)$(INTERNAL_TOOLS), WINNT_)
# Force re-linking when building with PGO, since
# the MSVC linker does all the work.  We force re-link
# in both stages so you can do depend builds with PGO.
ifdef SHARED_LIBRARY
$(SHARED_LIBRARY): FORCE
BINARY_BASENAME = $(SHARED_LIBRARY:$(DLL_SUFFIX)=)
endif
ifdef PROGRAM
$(PROGRAM): FORCE
BINARY_BASENAME = $(PROGRAM:$(BIN_SUFFIX)=)
endif

ifdef MOZ_PROFILE_USE
# In the second pass, we need to merge the pgc files into the pgd file.
# The compiler would do this for us automatically if they were in the right
# place, but they're in dist/bin.
ifdef BINARY_BASENAME
export::
	$(PYTHON) $(topsrcdir)/build/win32/pgomerge.py \
	  $(BINARY_BASENAME) $(DIST)/bin
endif
endif # MOZ_PROFILE_USE
endif # WINNT_
endif # MOZ_PROFILE_GENERATE || MOZ_PROFILE_USE
endif # NO_PROFILE_GUIDED_OPTIMIZE

##############################################

checkout:
	$(MAKE) -C $(topsrcdir) -f client.mk checkout

run_viewer: $(FINAL_TARGET)/viewer
	cd $(FINAL_TARGET); \
	MOZILLA_FIVE_HOME=`pwd` \
	LD_LIBRARY_PATH=".:$(LIBS_PATH):$$LD_LIBRARY_PATH" \
	viewer

clean clobber realclean clobber_all:: $(SUBMAKEFILES)
	-rm -f $(ALL_TRASH)
	-rm -rf $(ALL_TRASH_DIRS)
	+-$(LOOP_OVER_PARALLEL_DIRS)
	+-$(LOOP_OVER_DIRS)
	+-$(LOOP_OVER_STATIC_DIRS)
	+-$(LOOP_OVER_TOOL_DIRS)

distclean:: $(SUBMAKEFILES)
	+-$(LOOP_OVER_PARALLEL_DIRS)
	+-$(LOOP_OVER_DIRS)
	+-$(LOOP_OVER_STATIC_DIRS)
	+-$(LOOP_OVER_TOOL_DIRS)
	-rm -rf $(ALL_TRASH_DIRS) 
	-rm -f $(ALL_TRASH)  \
	Makefile .HSancillary \
	$(wildcard *.$(OBJ_SUFFIX)) $(wildcard *.ho) $(wildcard host_*.o*) \
	$(wildcard *.$(LIB_SUFFIX)) $(wildcard *$(DLL_SUFFIX)) \
	$(wildcard *.$(IMPORT_LIB_SUFFIX))
ifeq ($(OS_ARCH),OS2)
	-rm -f $(PROGRAM:.exe=.map)
endif

alltags:
	rm -f TAGS
	find $(topsrcdir) -name dist -prune -o \( -name '*.[hc]' -o -name '*.cp' -o -name '*.cpp' -o -name '*.idl' \) -print | $(TAG_PROGRAM)

#
# PROGRAM = Foo
# creates OBJS, links with LIBS to create Foo
#
$(PROGRAM): $(PROGOBJS) $(LIBS_DEPS) $(EXTRA_DEPS) $(EXE_DEF_FILE) $(RESFILE) Makefile Makefile.in
ifeq (WINCE,$(OS_ARCH))
	$(LD) -NOLOGO -OUT:$@ $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(PROGOBJS) $(RESFILE) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
else
ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
	$(LD) -NOLOGO -OUT:$@ -PDB:$(LINK_PDBFILE) $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(PROGOBJS) $(RESFILE) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		if test -f "$(srcdir)/$@.manifest"; then \
			mt.exe -NOLOGO -MANIFEST "$(win_srcdir)/$@.manifest" $@.manifest -OUTPUTRESOURCE:$@\;1; \
		else \
			mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		fi; \
		rm -f $@.manifest; \
	fi
endif	# MSVC with manifest tool
else
ifeq ($(CPP_PROG_LINK),1)
	$(CCC) -o $@ $(CXXFLAGS) $(WRAP_MALLOC_CFLAGS) $(PROGOBJS) $(RESFILE) $(WIN32_EXE_LDFLAGS) $(SOLARIS_JEMALLOC_LDFLAGS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(BIN_FLAGS) $(WRAP_MALLOC_LIB) $(PROFILER_LIBS) $(EXE_DEF_FILE)
else # ! CPP_PROG_LINK
	$(CC) -o $@ $(CFLAGS) $(PROGOBJS) $(RESFILE) $(WIN32_EXE_LDFLAGS) $(SOLARIS_JEMALLOC_LDFLAGS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(BIN_FLAGS) $(EXE_DEF_FILE)
endif # CPP_PROG_LINK
endif # WINNT && !GNU_CC
endif # WINCE

ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_PROGRAM_COMMAND
	$(MOZ_POST_PROGRAM_COMMAND) $@
endif
ifeq ($(OS_ARCH),BeOS)
ifdef BEOS_PROGRAM_RESOURCE
	xres -o $@ $(BEOS_PROGRAM_RESOURCE)
	mimeset $@
endif
endif # BeOS

$(HOST_PROGRAM): $(HOST_PROGOBJS) $(HOST_LIBS_DEPS) $(HOST_EXTRA_DEPS) Makefile Makefile.in
ifeq (WINCE,$(OS_ARCH))
	$(HOST_LD) -NOLOGO -OUT:$@ $(HOST_OBJS) $(WIN32_EXE_LDFLAGS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
ifeq (_WINNT,$(GNU_CC)_$(HOST_OS_ARCH))
	$(HOST_LD) -NOLOGO -OUT:$@ -PDB:$(HOST_PDBFILE) $(HOST_OBJS) $(WIN32_EXE_LDFLAGS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		rm -f $@.manifest; \
	fi
endif	# MSVC with manifest tool
else
ifeq ($(CPP_PROG_LINK),1)
	$(HOST_CXX) -o $@ $(HOST_CXXFLAGS) $(HOST_LDFLAGS) $(HOST_PROGOBJS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
	$(HOST_CC) -o $@ $(HOST_CFLAGS) $(HOST_LDFLAGS) $(HOST_PROGOBJS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
endif # CPP_PROG_LINK
endif
endif

#
# This is an attempt to support generation of multiple binaries
# in one directory, it assumes everything to compile Foo is in
# Foo.o (from either Foo.c or Foo.cpp).
#
# SIMPLE_PROGRAMS = Foo Bar
# creates Foo.o Bar.o, links with LIBS to create Foo, Bar.
#
$(SIMPLE_PROGRAMS): %$(BIN_SUFFIX): %.$(OBJ_SUFFIX) $(LIBS_DEPS) $(EXTRA_DEPS) Makefile Makefile.in
ifeq (WINCE,$(OS_ARCH))
	$(LD) -nologo  -entry:main -out:$@ $< $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
else
ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
	$(LD) -nologo -out:$@ -pdb:$(LINK_PDBFILE) $< $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		rm -f $@.manifest; \
	fi
endif	# MSVC with manifest tool
else
ifeq ($(CPP_PROG_LINK),1)
	$(CCC) $(WRAP_MALLOC_CFLAGS) $(CXXFLAGS) -o $@ $< $(WIN32_EXE_LDFLAGS) $(SOLARIS_JEMALLOC_LDFLAGS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(WRAP_MALLOC_LIB) $(PROFILER_LIBS) $(BIN_FLAGS)
else
	$(CC) $(WRAP_MALLOC_CFLAGS) $(CFLAGS) $(OUTOPTION)$@ $< $(WIN32_EXE_LDFLAGS) $(SOLARIS_JEMALLOC_LDFLAGS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(WRAP_MALLOC_LIB) $(PROFILER_LIBS) $(BIN_FLAGS)
endif # CPP_PROG_LINK
endif # WINNT && !GNU_CC
endif # WINCE

ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_PROGRAM_COMMAND
	$(MOZ_POST_PROGRAM_COMMAND) $@
endif

$(HOST_SIMPLE_PROGRAMS): host_%$(HOST_BIN_SUFFIX): host_%.$(OBJ_SUFFIX) $(HOST_LIBS_DEPS) $(HOST_EXTRA_DEPS) Makefile Makefile.in
ifeq (WINCE,$(OS_ARCH))
	$(HOST_LD) -NOLOGO -OUT:$@ $(WIN32_EXE_LDFLAGS) $< $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
ifeq (WINNT_,$(HOST_OS_ARCH)_$(GNU_CC))
	$(HOST_LD) -NOLOGO -OUT:$@ -PDB:$(HOST_PDBFILE) $< $(WIN32_EXE_LDFLAGS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
ifneq (,$(HOST_CPPSRCS)$(USE_HOST_CXX))
	$(HOST_CXX) $(HOST_OUTOPTION)$@ $(HOST_CXXFLAGS) $(INCLUDES) $< $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
	$(HOST_CC) $(HOST_OUTOPTION)$@ $(HOST_CFLAGS) $(INCLUDES) $< $(HOST_LIBS) $(HOST_EXTRA_LIBS)
endif
endif
endif

#
# Purify target.  Solaris/sparc only to start.
# Purify does not recognize "egcs" or "c++" so we go with 
# "gcc" and "g++" for now.
#
pure:	$(PROGRAM)
ifeq ($(CPP_PROG_LINK),1)
	$(PURIFY) $(CCC) -o $^.pure $(CXXFLAGS) $(PROGOBJS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS)
else
	$(PURIFY) $(CC) -o $^.pure $(CFLAGS) $(PROGOBJS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS)
endif
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS2) $^.pure $(FINAL_TARGET)
endif

quantify: $(PROGRAM)
ifeq ($(CPP_PROG_LINK),1)
	$(QUANTIFY) $(CCC) -o $^.quantify $(CXXFLAGS) $(PROGOBJS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS)
else
	$(QUANTIFY) $(CC) -o $^.quantify $(CFLAGS) $(PROGOBJS) $(LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS)
endif
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS2) $^.quantify $(FINAL_TARGET)
endif

#
# This allows us to create static versions of the shared libraries
# that are built using other static libraries.  Confused...?
#
ifdef SHARED_LIBRARY_LIBS
ifeq (,$(GNU_LD)$(filter-out OS2 WINNT WINCE, $(OS_ARCH)))
ifneq (,$(BUILD_STATIC_LIBS)$(FORCE_STATIC_LIB))
LOBJS	+= $(SHARED_LIBRARY_LIBS)
endif
else
ifneq (,$(filter OSF1 BSD_OS FreeBSD NetBSD OpenBSD SunOS Darwin,$(OS_ARCH)))
CLEANUP1	:= | egrep -v '(________64ELEL_|__.SYMDEF)'
CLEANUP2	:= rm -f ________64ELEL_ __.SYMDEF
else
CLEANUP2	:= true
endif
SUB_LOBJS	= $(shell for lib in $(SHARED_LIBRARY_LIBS); do $(AR_LIST) $${lib} $(CLEANUP1); done;)
endif
endif
ifdef MOZILLA_PROBE_LIBS
PROBE_LOBJS	= $(shell for lib in $(MOZILLA_PROBE_LIBS); do $(AR_LIST) $${lib} $(CLEANUP1); done;)
endif
ifdef DTRACE_PROBE_OBJ
EXTRA_DEPS += $(DTRACE_PROBE_OBJ)
endif

$(LIBRARY): $(OBJS) $(LOBJS) $(SHARED_LIBRARY_LIBS) $(EXTRA_DEPS) Makefile Makefile.in
	rm -f $@
ifneq (,$(GNU_LD)$(filter-out OS2 WINNT WINCE, $(OS_ARCH)))
ifdef SHARED_LIBRARY_LIBS
	@rm -f $(SUB_LOBJS)
	@for lib in $(SHARED_LIBRARY_LIBS); do $(AR_EXTRACT) $${lib}; $(CLEANUP2); done
endif
endif
	$(AR) $(AR_FLAGS) $(OBJS) $(LOBJS) $(SUB_LOBJS)
	$(RANLIB) $@
	@rm -f foodummyfilefoo $(SUB_LOBJS)

ifeq (,$(filter-out WINNT WINCE, $(OS_ARCH)))
$(IMPORT_LIBRARY): $(SHARED_LIBRARY)
endif

ifeq ($(OS_ARCH),OS2)
$(DEF_FILE): $(OBJS) $(SHARED_LIBRARY_LIBS)
	rm -f $@
	echo LIBRARY $(LIBRARY_NAME) INITINSTANCE TERMINSTANCE > $@
	echo PROTMODE >> $@
	echo CODE    LOADONCALL MOVEABLE DISCARDABLE >> $@
	echo DATA    PRELOAD MOVEABLE MULTIPLE NONSHARED >> $@
	echo EXPORTS >> $@
ifeq ($(IS_COMPONENT),1)
ifeq ($(HAS_EXTRAEXPORTS),1)
ifndef MOZ_OS2_USE_DECLSPEC
	$(FILTER) $(OBJS) $(SHARED_LIBRARY_LIBS) >> $@
endif	
else
	echo    _NSGetModule >> $@
endif
else
ifndef MOZ_OS2_USE_DECLSPEC
	$(FILTER) $(OBJS) $(SHARED_LIBRARY_LIBS) >> $@
endif	
endif
	$(ADD_TO_DEF_FILE)

ifdef MOZ_OS2_USE_DECLSPEC
$(IMPORT_LIBRARY): $(SHARED_LIBRARY)
else
$(IMPORT_LIBRARY): $(DEF_FILE)
endif
	rm -f $@
	$(IMPLIB) $@ $^
	$(RANLIB) $@
endif # OS/2

$(HOST_LIBRARY): $(HOST_OBJS) Makefile
	rm -f $@
	$(HOST_AR) $(HOST_AR_FLAGS) $(HOST_OBJS)
	$(HOST_RANLIB) $@

ifdef NO_LD_ARCHIVE_FLAGS
SUB_SHLOBJS = $(SUB_LOBJS)
endif

ifdef HAVE_DTRACE
ifndef XP_MACOSX
ifdef DTRACE_PROBE_OBJ
ifndef DTRACE_LIB_DEPENDENT
$(DTRACE_PROBE_OBJ): $(OBJS)
	dtrace -G -C -32 -s $(MOZILLA_DTRACE_SRC) -o $(DTRACE_PROBE_OBJ) $(OBJS)
endif
endif
endif
endif

# On Darwin (Mac OS X), dwarf2 debugging uses debug info left in .o files,
# so instead of deleting .o files after repacking them into a dylib, we make
# symlinks back to the originals. The symlinks are a no-op for stabs debugging,
# so no need to conditionalize on OS version or debugging format.

$(SHARED_LIBRARY): $(OBJS) $(LOBJS) $(DEF_FILE) $(RESFILE) $(SHARED_LIBRARY_LIBS) $(EXTRA_DEPS) $(DSO_LDOPTS_DEPS) Makefile Makefile.in
ifndef INCREMENTAL_LINKER
	rm -f $@
endif
ifeq ($(OS_ARCH),OpenVMS)
	@if test ! -f $(VMS_SYMVEC_FILE); then \
	  if test -f $(VMS_SYMVEC_FILE_MODULE); then \
	    echo Creating specific component options file $(VMS_SYMVEC_FILE); \
	    cp $(VMS_SYMVEC_FILE_MODULE) $(VMS_SYMVEC_FILE); \
	  fi; \
	fi
ifdef IS_COMPONENT
	@if test ! -f $(VMS_SYMVEC_FILE); then \
	  echo Creating generic component options file $(VMS_SYMVEC_FILE); \
	  cp $(VMS_SYMVEC_FILE_COMP) $(VMS_SYMVEC_FILE); \
	fi
endif
endif # OpenVMS
ifdef NO_LD_ARCHIVE_FLAGS
ifdef SHARED_LIBRARY_LIBS
	@rm -f $(SUB_SHLOBJS)
	@for lib in $(SHARED_LIBRARY_LIBS); do $(AR_EXTRACT) $${lib}; $(CLEANUP2); done
ifeq ($(OS_ARCH),Darwin)
	@echo Making symlinks to the original object files in the archive libraries $(SHARED_LIBRARY_LIBS)
	@for lib in $(SHARED_LIBRARY_LIBS); do \
		libdir=`echo $$lib|sed -e 's,/[^/]*\.a,,'`; \
		ofiles=`$(AR_LIST) $${lib}`; \
		for ofile in $$ofiles; do \
			if [ -f $$libdir/$$ofile ]; then \
				rm -f $$ofile; \
				ln -s $$libdir/$$ofile $$ofile; \
			fi; \
		done; \
	done
endif
endif # SHARED_LIBRARY_LIBS
endif # NO_LD_ARCHIVE_FLAGS
ifdef DTRACE_LIB_DEPENDENT
	@rm -f $(PROBE_LOBJS)
	@for lib in $(MOZILLA_PROBE_LIBS); do $(AR_EXTRACT) $${lib}; $(CLEANUP2); done
ifndef XP_MACOSX
	dtrace -G -C -32 -s $(MOZILLA_DTRACE_SRC) -o  $(DTRACE_PROBE_OBJ) $(PROBE_LOBJS)
endif
	@for lib in $(MOZILLA_PROBE_LIBS); do \
		ofiles=`$(AR_LIST) $${lib}`; \
		$(AR_DELETE) $${lib} $$ofiles; \
	done
	$(MKSHLIB) $(SHLIB_LDSTARTFILE) $(OBJS) $(LOBJS) $(SUB_SHLOBJS) $(DTRACE_PROBE_OBJ) $(PROBE_LOBJS) $(RESFILE) $(LDFLAGS) $(EXTRA_DSO_LDOPTS) $(OS_LIBS) $(EXTRA_LIBS) $(DEF_FILE) $(SHLIB_LDENDFILE)
	@rm -f $(PROBE_LOBJS)
	@rm -f $(DTRACE_PROBE_OBJ)
	@for lib in $(MOZILLA_PROBE_LIBS); do \
		if [ -L $${lib} ]; then rm -f `readlink $${lib}`; fi; \
	done
	@rm -f $(MOZILLA_PROBE_LIBS)

else # ! DTRACE_LIB_DEPENDENT
	$(MKSHLIB) $(SHLIB_LDSTARTFILE) $(OBJS) $(DTRACE_PROBE_OBJ) $(LOBJS) $(SUB_SHLOBJS) $(RESFILE) $(LDFLAGS) $(EXTRA_DSO_LDOPTS) $(OS_LIBS) $(EXTRA_LIBS) $(DEF_FILE) $(SHLIB_LDENDFILE)
endif # DTRACE_LIB_DEPENDENT

ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
ifdef MSMANIFEST_TOOL
ifdef EMBED_MANIFEST_AT
	@if test -f $@.manifest; then \
		mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;$(EMBED_MANIFEST_AT); \
		rm -f $@.manifest; \
	fi
endif   # EMBED_MANIFEST_AT
endif	# MSVC with manifest tool
endif	# WINNT && !GCC
ifeq ($(OS_ARCH),Darwin)
else # non-Darwin
	@rm -f $(SUB_SHLOBJS)
endif # Darwin
	@rm -f foodummyfilefoo $(DELETE_AFTER_LINK)
	chmod +x $@
ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_DSO_LIB_COMMAND
	$(MOZ_POST_DSO_LIB_COMMAND) $@
endif

ifdef MOZ_AUTO_DEPS
ifdef COMPILER_DEPEND
ifeq (__SunOS,$(GNU_CC)_$(GNU_CXX)_$(OS_ARCH))
_MDDEPFILE = $(MDDEPDIR)/$(@F).pp

define MAKE_DEPS_AUTO_CC
if test -d $(@D); then \
	echo "Building deps for $< using Sun Studio cc"; \
	$(CC) $(COMPILE_CFLAGS) -xM  $< >$(_MDDEPFILE) ; \
fi
endef
define MAKE_DEPS_AUTO_CXX
if test -d $(@D); then \
	echo "Building deps for $< using Sun Studio CC"; \
	$(CXX) $(COMPILE_CXXFLAGS) -xM $< >$(_MDDEPFILE) ; \
fi
endef
endif # Sun Studio on Solaris
else # COMPILER_DEPEND
#
# Generate dependencies on the fly
#
_MDDEPFILE = $(MDDEPDIR)/$(@F).pp

define MAKE_DEPS_AUTO
if test -d $(@D); then \
	echo "Building deps for $<"; \
	$(MKDEPEND) -o'.$(OBJ_SUFFIX)' -f- $(DEFINES) $(ACDEFINES) $(INCLUDES) $< 2>/dev/null | sed -e "s|^[^ ]*/||" > $(_MDDEPFILE) ; \
fi
endef

MAKE_DEPS_AUTO_CC = $(MAKE_DEPS_AUTO)
MAKE_DEPS_AUTO_CXX = $(MAKE_DEPS_AUTO)

endif # COMPILER_DEPEND

endif # MOZ_AUTO_DEPS

ifdef MOZ_MEMORY
ifeq ($(OS_ARCH),SunOS)
SOLARIS_JEMALLOC_LDFLAGS = $(call EXPAND_LIBNAME_PATH,jemalloc,$(DIST)/lib)
endif
endif

# Rules for building native targets must come first because of the host_ prefix
host_%.$(OBJ_SUFFIX): %.c Makefile Makefile.in
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CC) $(HOST_OUTOPTION)$@ -c $(HOST_CFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.cpp Makefile Makefile.in
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.cc Makefile Makefile.in
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.m Makefile Makefile.in
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CC) $(HOST_OUTOPTION)$@ -c $(HOST_CFLAGS) $(HOST_CMFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.mm Makefile Makefile.in
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(HOST_CMMFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

%: %.c Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) $(CFLAGS) $(LDFLAGS) $(OUTOPTION)$@ $(_VPATH_SRCS)

%.$(OBJ_SUFFIX): %.c Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) $(OUTOPTION)$@ -c $(COMPILE_CFLAGS) $(_VPATH_SRCS)

moc_%.cpp: %.h Makefile Makefile.in
	$(MOC) $< $(OUTOPTION)$@ 

ifdef ASFILES
# The AS_DASH_C_FLAG is needed cause not all assemblers (Solaris) accept
# a '-c' flag.
%.$(OBJ_SUFFIX): %.$(ASM_SUFFIX) Makefile Makefile.in
	$(AS) -o $@ $(ASFLAGS) $(AS_DASH_C_FLAG) $(_VPATH_SRCS)
endif

%.$(OBJ_SUFFIX): %.S Makefile Makefile.in
	$(AS) -o $@ $(ASFLAGS) -c $<

%: %.cpp Makefile Makefile.in
	@$(MAKE_DEPS_AUTO_CXX)
	$(CCC) $(OUTOPTION)$@ $(CXXFLAGS) $(_VPATH_SRCS) $(LDFLAGS)

#
# Please keep the next two rules in sync.
#
%.$(OBJ_SUFFIX): %.cc Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
	$(ELOG) $(CCC) $(OUTOPTION)$@ -c $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.$(OBJ_SUFFIX): %.cpp Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
ifdef STRICT_CPLUSPLUS_SUFFIX
	echo "#line 1 \"$*.cpp\"" | cat - $*.cpp > t_$*.cc
	$(ELOG) $(CCC) -o $@ -c $(COMPILE_CXXFLAGS) t_$*.cc
	rm -f t_$*.cc
else
	$(ELOG) $(CCC) $(OUTOPTION)$@ -c $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)
endif #STRICT_CPLUSPLUS_SUFFIX

$(OBJ_PREFIX)%.$(OBJ_SUFFIX): %.mm Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
	$(ELOG) $(CCC) -o $@ -c $(COMPILE_CXXFLAGS) $(COMPILE_CMMFLAGS) $(_VPATH_SRCS)

$(OBJ_PREFIX)%.$(OBJ_SUFFIX): %.m Makefile Makefile.in
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) -o $@ -c $(COMPILE_CFLAGS) $(COMPILE_CMFLAGS) $(_VPATH_SRCS)

%.s: %.cpp
	$(CCC) -S $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.s: %.cc
	$(CCC) -S $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.s: %.c
	$(CC) -S $(COMPILE_CFLAGS) $(_VPATH_SRCS)

%.i: %.cpp
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.cc
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.c
	$(CC) -C -E $(COMPILE_CFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.mm
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(COMPILE_CMMFLAGS) $(_VPATH_SRCS) > $*.i

%.res: %.rc
	@echo Creating Resource file: $@
ifeq ($(OS_ARCH),OS2)
	$(RC) $(RCFLAGS:-D%=-d %) -i $(subst /,\,$(srcdir)) -r $< $@
else
ifdef GNU_CC
	$(RC) $(RCFLAGS) $(filter-out -U%,$(DEFINES)) $(INCLUDES:-I%=--include-dir %) $(OUTOPTION)$@ $(_VPATH_SRCS)
else
	$(RC) $(RCFLAGS) -r $(DEFINES) $(INCLUDES) $(OUTOPTION)$@ $(_VPATH_SRCS)
endif
endif

# need 3 separate lines for OS/2
%: %.pl
	rm -f $@
	cp $< $@
	chmod +x $@

%: %.sh
	rm -f $@; cp $< $@; chmod +x $@

# Cancel these implicit rules
#
%: %,v

%: RCS/%,v

%: s.%

%: SCCS/s.%

###############################################################################
# Java rules
###############################################################################
ifneq (,$(filter OS2 WINNT WINCE,$(OS_ARCH)))
SEP := ;
else
SEP := :
endif

EMPTY :=
SPACE := $(EMPTY) $(EMPTY)

# Cygwin and MSYS have their own special path form, but javac expects the source
# and class paths to be in the DOS form (i.e. e:/builds/...).  This function
# does the appropriate conversion on Windows, but is a noop on other systems.
ifeq (,$(filter-out WINNT WINCE, $(HOST_OS_ARCH)))
ifdef CYGWIN_WRAPPER
normalizepath = $(foreach p,$(1),$(shell cygpath -m $(p)))
else
# assume MSYS
#  We use 'pwd -W' to get DOS form of the path.  However, since the given path
#  could be a file or a non-existent path, we cannot call 'pwd -W' directly
#  on the path.  Instead, we extract the root path (i.e. "c:/"), call 'pwd -W'
#  on it, then merge with the rest of the path.
root-path = $(shell echo $(1) | sed -e "s|\(/[^/]*\)/\?\(.*\)|\1|")
non-root-path = $(shell echo $(1) | sed -e "s|\(/[^/]*\)/\?\(.*\)|\2|")
normalizepath = $(foreach p,$(1),$(if $(filter /%,$(1)),$(shell cd $(call root-path,$(1)) && pwd -W)$(call non-root-path,$(1)),$(1)))
endif
else
normalizepath = $(1)
endif

_srcdir = $(call normalizepath,$(srcdir))
ifdef JAVA_SOURCEPATH
SP = $(subst $(SPACE),$(SEP),$(call normalizepath,$(strip $(JAVA_SOURCEPATH))))
_JAVA_SOURCEPATH = ".$(SEP)$(_srcdir)$(SEP)$(SP)"
else
_JAVA_SOURCEPATH = ".$(SEP)$(_srcdir)"
endif

ifdef JAVA_CLASSPATH
CP = $(subst $(SPACE),$(SEP),$(call normalizepath,$(strip $(JAVA_CLASSPATH))))
_JAVA_CLASSPATH = ".$(SEP)$(CP)"
else
_JAVA_CLASSPATH = .
endif

_JAVA_DIR = _java
$(_JAVA_DIR)::
	$(NSINSTALL) -D $@

$(_JAVA_DIR)/%.class: %.java Makefile Makefile.in $(_JAVA_DIR)
	$(CYGWIN_WRAPPER) $(JAVAC) $(JAVAC_FLAGS) -classpath $(_JAVA_CLASSPATH) \
			-sourcepath $(_JAVA_SOURCEPATH) -d $(_JAVA_DIR) $(_VPATH_SRCS)

$(JAVA_LIBRARY): $(addprefix $(_JAVA_DIR)/,$(JAVA_SRCS:.java=.class)) Makefile Makefile.in
	$(JAR) cf $@ -C $(_JAVA_DIR) .

GARBAGE_DIRS += $(_JAVA_DIR)

###############################################################################
# Update Makefiles
###############################################################################

# In GNU make 3.80, makefiles must use the /cygdrive syntax, even if we're
# processing them with AS perl. See bug 232003
ifdef AS_PERL
CYGWIN_TOPSRCDIR = -nowrap -p $(topsrcdir) -wrap
endif

# Note: Passing depth to make-makefile is optional.
#       It saves the script some work, though.
Makefile: Makefile.in
	@$(PERL) $(AUTOCONF_TOOLS)/make-makefile -t $(topsrcdir) -d $(DEPTH) $(CYGWIN_TOPSRCDIR)

ifdef SUBMAKEFILES
# VPATH does not work on some machines in this case, so add $(srcdir)
$(SUBMAKEFILES): % : $(srcdir)/%.in
	$(PERL) $(AUTOCONF_TOOLS)/make-makefile -t $(topsrcdir) -d $(DEPTH) $(CYGWIN_TOPSRCDIR) $@
endif

ifdef AUTOUPDATE_CONFIGURE
$(topsrcdir)/configure: $(topsrcdir)/configure.in
	(cd $(topsrcdir) && $(AUTOCONF)) && (cd $(DEPTH) && ./config.status --recheck)
endif

###############################################################################
# Bunch of things that extend the 'export' rule (in order):
###############################################################################

################################################################################
# Copy each element of EXPORTS to $(PUBLIC)

ifneq ($(EXPORTS)$(XPIDLSRCS)$(SDK_HEADERS)$(SDK_XPIDLSRCS),)
$(SDK_PUBLIC) $(PUBLIC)::
	$(NSINSTALL) -D $@
endif

ifdef MOZ_JAVAXPCOM
ifneq ($(XPIDLSRCS)$(SDK_XPIDLSRCS),)
$(JAVA_DIST_DIR)::
	$(NSINSTALL) -D $@
endif
endif

ifneq ($(XPI_NAME),)
$(FINAL_TARGET):
	$(NSINSTALL) -D $@

export:: $(FINAL_TARGET)
endif

ifndef NO_DIST_INSTALL
ifneq ($(EXPORTS),)
export:: $(EXPORTS) $(PUBLIC)
	$(INSTALL) $(IFLAGS1) $^
endif 

ifneq ($(SDK_HEADERS),)
export:: $(SDK_HEADERS) $(SDK_PUBLIC)
	$(INSTALL) $(IFLAGS1) $^

export:: $(SDK_HEADERS) $(PUBLIC)
	$(INSTALL) $(IFLAGS1) $^
endif 
endif # NO_DIST_INSTALL

################################################################################
# Copy each element of PREF_JS_EXPORTS

ifdef GRE_MODULE
PREF_DIR = greprefs
else
ifneq (,$(XPI_NAME)$(LIBXUL_SDK))
PREF_DIR = defaults/preferences
else
PREF_DIR = defaults/pref
endif
endif

ifneq ($(PREF_JS_EXPORTS),)
# on win32, pref files need CRLF line endings... see bug 206029
ifeq (WINNT,$(OS_ARCH))
PREF_PPFLAGS = --line-endings=crlf
endif

ifndef NO_DIST_INSTALL
$(FINAL_TARGET)/$(PREF_DIR):
	$(NSINSTALL) -D $@

libs:: $(FINAL_TARGET)/$(PREF_DIR) $(PREF_JS_EXPORTS)
	$(EXIT_ON_ERROR)  \
	for i in $(PREF_JS_EXPORTS); do \
	  dest=$(FINAL_TARGET)/$(PREF_DIR)/`basename $$i`; \
	  $(RM) -f $$dest; \
	  $(PYTHON) $(topsrcdir)/config/Preprocessor.py $(PREF_PPFLAGS) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) $$i > $$dest; \
	done
endif
endif

################################################################################
# Copy each element of AUTOCFG_JS_EXPORTS to $(FINAL_TARGET)/defaults/autoconfig

ifneq ($(AUTOCFG_JS_EXPORTS),)
$(FINAL_TARGET)/defaults/autoconfig::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
export:: $(AUTOCFG_JS_EXPORTS) $(FINAL_TARGET)/defaults/autoconfig
	$(INSTALL) $(IFLAGS1) $^
endif

endif 
################################################################################
# Export the elements of $(XPIDLSRCS) & $(SDK_XPIDLSRCS), 
# generating .h and .xpt files and moving them to the appropriate places.

ifneq ($(XPIDLSRCS)$(SDK_XPIDLSRCS),)

export:: $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(XPIDLSRCS))

ifndef XPIDL_MODULE
XPIDL_MODULE		= $(MODULE)
endif

ifeq ($(XPIDL_MODULE),) # we need $(XPIDL_MODULE) to make $(XPIDL_MODULE).xpt
export:: FORCE
	@echo
	@echo "*** Error processing XPIDLSRCS:"
	@echo "Please define MODULE or XPIDL_MODULE when defining XPIDLSRCS,"
	@echo "so we have a module name to use when creating MODULE.xpt."
	@echo; sleep 2; false
endif

$(SDK_IDL_DIR) $(IDL_DIR)::
	$(NSINSTALL) -D $@

# generate .h files from into $(XPIDL_GEN_DIR), then export to $(PUBLIC);
# warn against overriding existing .h file. 
$(XPIDL_GEN_DIR)/.done:
	@if test ! -d $(XPIDL_GEN_DIR); then echo Creating $(XPIDL_GEN_DIR)/.done; rm -rf $(XPIDL_GEN_DIR); mkdir $(XPIDL_GEN_DIR); fi
	@touch $@

# don't depend on $(XPIDL_GEN_DIR), because the modification date changes
# with any addition to the directory, regenerating all .h files -> everything.

$(XPIDL_GEN_DIR)/%.h: %.idl $(XPIDL_COMPILE) $(XPIDL_GEN_DIR)/.done
	$(REPORT_BUILD)
	$(ELOG) $(XPIDL_COMPILE) -m header -w $(XPIDL_FLAGS) -o $(XPIDL_GEN_DIR)/$* $(_VPATH_SRCS)
	@if test -n "$(findstring $*.h, $(EXPORTS) $(SDK_HEADERS))"; \
	  then echo "*** WARNING: file $*.h generated from $*.idl overrides $(srcdir)/$*.h"; else true; fi

ifndef NO_GEN_XPT
# generate intermediate .xpt files into $(XPIDL_GEN_DIR), then link
# into $(XPIDL_MODULE).xpt and export it to $(FINAL_TARGET)/components.
$(XPIDL_GEN_DIR)/%.xpt: %.idl $(XPIDL_COMPILE) $(XPIDL_GEN_DIR)/.done
	$(REPORT_BUILD)
	$(ELOG) $(XPIDL_COMPILE) -m typelib -w $(XPIDL_FLAGS) -e $@ -d $(MDDEPDIR)/$*.pp $(_VPATH_SRCS)

# no need to link together if XPIDLSRCS contains only XPIDL_MODULE
ifneq ($(XPIDL_MODULE).idl,$(strip $(XPIDLSRCS)))
$(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt: $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.xpt,$(XPIDLSRCS) $(SDK_XPIDLSRCS)) Makefile.in Makefile $(XPIDL_LINK)
	$(XPIDL_LINK) $(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.xpt,$(XPIDLSRCS) $(SDK_XPIDLSRCS)) 
endif # XPIDL_MODULE.xpt != XPIDLSRCS

libs:: $(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS1) $(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt $(FINAL_TARGET)/components
endif

endif # NO_GEN_XPT

GARBAGE_DIRS		+= $(XPIDL_GEN_DIR)

endif # XPIDLSRCS || SDK_XPIDLSRCS

ifneq ($(XPIDLSRCS),)
# export .idl files to $(IDL_DIR)
ifndef NO_DIST_INSTALL
export:: $(XPIDLSRCS) $(IDL_DIR)
	$(INSTALL) $(IFLAGS1) $^

export:: $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(XPIDLSRCS)) $(PUBLIC)
	$(INSTALL) $(IFLAGS1) $^ 
endif # NO_DIST_INSTALL

endif # XPIDLSRCS



#
# General rules for exporting idl files.
#
# WORK-AROUND ONLY, for mozilla/tools/module-deps/bootstrap.pl build.
# Bug to fix idl dependency problems w/o this extra build pass is
#   http://bugzilla.mozilla.org/show_bug.cgi?id=145777
#
$(IDL_DIR)::
	$(NSINSTALL) -D $@

export-idl:: $(SUBMAKEFILES) $(MAKE_DIRS)

ifneq ($(XPIDLSRCS)$(SDK_XPIDLSRCS),)
ifndef NO_DIST_INSTALL
export-idl:: $(XPIDLSRCS) $(SDK_XPIDLSRCS) $(IDL_DIR)
	$(INSTALL) $(IFLAGS1) $^
endif
endif
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)




ifneq ($(SDK_XPIDLSRCS),)
# export .idl files to $(IDL_DIR) & $(SDK_IDL_DIR)
ifndef NO_DIST_INSTALL
export:: $(SDK_XPIDLSRCS) $(IDL_DIR)
	$(INSTALL) $(IFLAGS1) $^

export:: $(SDK_XPIDLSRCS) $(SDK_IDL_DIR)
	$(INSTALL) $(IFLAGS1) $^

export:: $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(SDK_XPIDLSRCS)) $(PUBLIC)
	$(INSTALL) $(IFLAGS1) $^

export:: $(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(SDK_XPIDLSRCS)) $(SDK_PUBLIC)
	$(INSTALL) $(IFLAGS1) $^
endif

endif # SDK_XPIDLSRCS



ifdef MOZ_JAVAXPCOM
ifneq ($(XPIDLSRCS)$(SDK_XPIDLSRCS),)

JAVA_XPIDLSRCS = $(XPIDLSRCS) $(SDK_XPIDLSRCS)

# A single IDL file can contain multiple interfaces, which result in multiple
# Java interface files.  So use hidden dependency files.
JAVADEPFILES = $(addprefix $(JAVA_GEN_DIR)/.,$(JAVA_XPIDLSRCS:.idl=.java.pp))

$(JAVA_GEN_DIR):
	$(NSINSTALL) -D $@
GARBAGE_DIRS += $(JAVA_GEN_DIR)

# generate .java files into _javagen/[package name dirs]
_JAVA_GEN_DIR = $(JAVA_GEN_DIR)/$(JAVA_IFACES_PKG_NAME)
$(_JAVA_GEN_DIR):
	$(NSINSTALL) -D $@

$(JAVA_GEN_DIR)/.%.java.pp: %.idl $(XPIDL_COMPILE) $(_JAVA_GEN_DIR)
	$(REPORT_BUILD)
	$(ELOG) $(XPIDL_COMPILE) -m java -w -I$(srcdir) -I$(IDL_DIR) -o $(_JAVA_GEN_DIR)/$* $(_VPATH_SRCS)
	@touch $@

# "Install" generated Java interfaces.  We segregate them based on the XPI_NAME.
# If XPI_NAME is not set, install into the "default" directory.
ifneq ($(XPI_NAME),)
JAVA_INSTALL_DIR = $(JAVA_DIST_DIR)/$(XPI_NAME)
else
JAVA_INSTALL_DIR = $(JAVA_DIST_DIR)/default
endif

$(JAVA_INSTALL_DIR):
	$(NSINSTALL) -D $@

export:: $(JAVA_DIST_DIR) $(JAVADEPFILES) $(JAVA_INSTALL_DIR)
	(cd $(JAVA_GEN_DIR) && tar $(TAR_CREATE_FLAGS) - .) | (cd $(JAVA_INSTALL_DIR) && tar -xf -)

endif # XPIDLSRCS || SDK_XPIDLSRCS
endif # MOZ_JAVAXPCOM

################################################################################
# Copy each element of EXTRA_COMPONENTS to $(FINAL_TARGET)/components
ifdef EXTRA_COMPONENTS
libs:: $(EXTRA_COMPONENTS)
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS1) $^ $(FINAL_TARGET)/components
endif

endif

ifdef EXTRA_PP_COMPONENTS
libs:: $(EXTRA_PP_COMPONENTS)
ifndef NO_DIST_INSTALL
	$(EXIT_ON_ERROR) \
	$(NSINSTALL) -D $(FINAL_TARGET)/components; \
	for i in $^; do \
	  dest=$(FINAL_TARGET)/components/`basename $$i`; \
	  $(RM) -f $$dest; \
	  $(PYTHON) $(topsrcdir)/config/Preprocessor.py $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) $$i > $$dest; \
	done
endif

endif

################################################################################
# Copy each element of EXTRA_JS_MODULES to $(FINAL_TARGET)/modules
ifdef EXTRA_JS_MODULES
libs:: $(EXTRA_JS_MODULES)
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS1) $^ $(FINAL_TARGET)/modules
endif

endif

ifdef EXTRA_PP_JS_MODULES
libs:: $(EXTRA_PP_JS_MODULES)
ifndef NO_DIST_INSTALL
	$(EXIT_ON_ERROR) \
	$(NSINSTALL) -D $(FINAL_TARGET)/modules; \
	for i in $^; do \
	  dest=$(FINAL_TARGET)/modules/`basename $$i`; \
	  $(RM) -f $$dest; \
	  $(PYTHON) $(topsrcdir)/config/Preprocessor.py $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) $$i > $$dest; \
	done
endif

endif

################################################################################
# SDK

ifneq (,$(SDK_LIBRARY))
$(SDK_LIB_DIR)::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
libs:: $(SDK_LIBRARY) $(SDK_LIB_DIR)
	$(INSTALL) $(IFLAGS2) $^
endif

endif # SDK_LIBRARY

ifneq (,$(SDK_BINARY))
$(SDK_BIN_DIR)::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
libs:: $(SDK_BINARY) $(SDK_BIN_DIR)
	$(INSTALL) $(IFLAGS2) $^
endif

endif # SDK_BINARY

################################################################################
# CHROME PACKAGING

JAR_MANIFEST := $(srcdir)/jar.mn

chrome::
	$(MAKE) realchrome
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)

$(FINAL_TARGET)/chrome:
	$(NSINSTALL) -D $@

# libs realchrome:: $(CHROME_DEPS) $(FINAL_TARGET)/chrome
# ifndef NO_DIST_INSTALL
# 	@$(EXIT_ON_ERROR) \
# 	if test -f $(JAR_MANIFEST); then \
# 	  $(PYTHON) $(MOZILLA_DIR)/config/JarMaker.py \
# 	    $(QUIET) -j $(FINAL_TARGET)/chrome \
# 	    $(MAKE_JARS_FLAGS) $(XULPPFLAGS) $(DEFINES) $(ACDEFINES) \
# 	    $(JAR_MANIFEST); \
# 	fi
# endif

ifneq ($(DIST_FILES),)
libs:: $(DIST_FILES)
	@$(EXIT_ON_ERROR) \
	for f in $(DIST_FILES); do \
	  dest=$(FINAL_TARGET)/`basename $$f`; \
	  $(RM) -f $$dest; \
	  $(PYTHON) $(MOZILLA_DIR)/config/Preprocessor.py \
	    $(XULAPP_DEFINES) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) \
	    $(srcdir)/$$f > $$dest; \
	done
endif

ifneq ($(DIST_CHROME_FILES),)
libs:: $(DIST_CHROME_FILES)
	@$(EXIT_ON_ERROR) \
	for f in $(DIST_CHROME_FILES); do \
	  dest=$(FINAL_TARGET)/chrome/`basename $$f`; \
	  $(RM) -f $$dest; \
	  $(PYTHON) $(MOZILLA_DIR)/config/Preprocessor.py \
	    $(XULAPP_DEFINES) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) \
	    $(srcdir)/$$f > $$dest; \
	done
endif

ifneq ($(XPI_PKGNAME),)
libs realchrome::
ifdef STRIP_XPI
ifndef MOZ_DEBUG
	@echo "Stripping $(XPI_PKGNAME) package directory..."
	@echo $(FINAL_TARGET)
	@cd $(FINAL_TARGET) && find . ! -type d \
			! -name "*.js" \
			! -name "*.xpt" \
			! -name "*.gif" \
			! -name "*.jpg" \
			! -name "*.png" \
			! -name "*.xpm" \
			! -name "*.txt" \
			! -name "*.rdf" \
			! -name "*.sh" \
			! -name "*.properties" \
			! -name "*.dtd" \
			! -name "*.html" \
			! -name "*.xul" \
			! -name "*.css" \
			! -name "*.xml" \
			! -name "*.jar" \
			! -name "*.dat" \
			! -name "*.tbl" \
			! -name "*.src" \
			! -name "*.reg" \
			$(PLATFORM_EXCLUDE_LIST) \
			-exec $(STRIP) $(STRIP_FLAGS) {} >/dev/null 2>&1 \;
endif
endif
	@echo "Packaging $(XPI_PKGNAME).xpi..."
	cd $(FINAL_TARGET) && $(ZIP) -qr ../$(XPI_PKGNAME).xpi *
endif

ifdef INSTALL_EXTENSION_ID
ifndef XPI_NAME
$(error XPI_NAME must be set for INSTALL_EXTENSION_ID)
endif

libs::
	$(RM) -rf "$(DIST)/bin/extensions/$(INSTALL_EXTENSION_ID)"
	$(NSINSTALL) -D "$(DIST)/bin/extensions/$(INSTALL_EXTENSION_ID)"
	cd $(FINAL_TARGET) && tar $(TAR_CREATE_FLAGS) - . | (cd "../../bin/extensions/$(INSTALL_EXTENSION_ID)" && tar -xf -)

endif

ifneq (,$(filter flat symlink,$(MOZ_CHROME_FILE_FORMAT)))
_JAR_REGCHROME_DISABLE_JAR=1
else
_JAR_REGCHROME_DISABLE_JAR=0
endif

REGCHROME = $(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/add-chrome.pl \
	$(if $(filter gtk2,$(MOZ_WIDGET_TOOLKIT)),-x) \
	$(if $(CROSS_COMPILE),-o $(OS_ARCH)) $(FINAL_TARGET)/chrome/installed-chrome.txt \
	$(_JAR_REGCHROME_DISABLE_JAR)

REGCHROME_INSTALL = $(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/add-chrome.pl \
	$(if $(filter gtk2,$(MOZ_WIDGET_TOOLKIT)),-x) \
	$(if $(CROSS_COMPILE),-o $(OS_ARCH)) $(DESTDIR)$(mozappdir)/chrome/installed-chrome.txt \
	$(_JAR_REGCHROME_DISABLE_JAR)


################################################################################
# Testing frameworks support
################################################################################

ifdef ENABLE_TESTS

ifdef XPCSHELL_TESTS
ifndef MODULE
$(error Must define MODULE when defining XPCSHELL_TESTS.)
endif

# Test file installation
libs::
	@$(EXIT_ON_ERROR) \
	for testdir in $(XPCSHELL_TESTS); do \
	  $(INSTALL) \
	    $(srcdir)/$$testdir/*.js \
	    $(DEPTH)/_tests/xpcshell-simple/$(MODULE)/$$testdir; \
	done

# Path formats on Windows are hard.  We require a topsrcdir formatted so that
# it may be passed to nsILocalFile.initWithPath (in other words, an absolute
# path of the form X:\path\to\topsrcdir), which we store in NATIVE_TOPSRCDIR.
# We require a forward-slashed path to topsrcdir so that it may be combined
# with a relative forward-slashed path for loading scripts, both dynamically
# and statically for head/test/tail JS files.  Of course, on non-Windows none
# of this matters, and things will work correctly because everything's
# forward-slashed, everywhere, always.
ifdef CYGWIN_WRAPPER
NATIVE_TOPSRCDIR   := `cygpath -wa $(topsrcdir)`
FWDSLASH_TOPSRCDIR := `cygpath -ma $(topsrcdir)`
else
FWDSLASH_TOPSRCDIR := $(topsrcdir)
ifeq ($(HOST_OS_ARCH),WINNT)
NATIVE_TOPSRCDIR   := $(subst /,\\,$(WIN_TOP_SRC))
else 
NATIVE_TOPSRCDIR   := $(topsrcdir)
endif
endif # CYGWIN_WRAPPER

# Test execution
check::
	@$(EXIT_ON_ERROR) \
	for testdir in $(XPCSHELL_TESTS); do \
	  $(RUN_TEST_PROGRAM) \
	    $(topsrcdir)/tools/test-harness/xpcshell-simple/test_all.sh \
	      $(DIST)/bin/xpcshell \
	      $(FWDSLASH_TOPSRCDIR) \
	      $(NATIVE_TOPSRCDIR) \
	      $(DEPTH)/_tests/xpcshell-simple/$(MODULE)/$$testdir; \
	done

# Test execution
check-interactive::
	@$(EXIT_ON_ERROR) \
	$(RUN_TEST_PROGRAM) \
	  $(topsrcdir)/tools/test-harness/xpcshell-simple/test_one.sh \
	    $(DIST)/bin/xpcshell \
	    $(FWDSLASH_TOPSRCDIR) \
	    $(NATIVE_TOPSRCDIR) \
	    $(DEPTH)/_tests/xpcshell-simple/$(MODULE)/$$testdir \
	    $(SOLO_FILE) 1;

# Test execution
check-one::
	@$(EXIT_ON_ERROR) \
	$(RUN_TEST_PROGRAM) \
	  $(topsrcdir)/tools/test-harness/xpcshell-simple/test_one.sh \
	    $(DIST)/bin/xpcshell \
	    $(FWDSLASH_TOPSRCDIR) \
	    $(NATIVE_TOPSRCDIR) \
	    $(DEPTH)/_tests/xpcshell-simple/$(MODULE)/$$testdir \
	    $(SOLO_FILE) 0;

endif # XPCSHELL_TESTS

endif # ENABLE_TESTS


#############################################################################
# Dependency system
#############################################################################
ifdef COMPILER_DEPEND
depend::
	@echo "$(MAKE): No need to run depend target.\
			Using compiler-based depend." 1>&2
ifeq ($(GNU_CC)$(GNU_CXX),)
# Non-GNU compilers
	@echo "`echo '$(MAKE):'|sed 's/./ /g'`"\
	'(Compiler-based depend was turned on by "--enable-md".)' 1>&2
else
# GNU compilers
	@space="`echo '$(MAKE): '|sed 's/./ /g'`";\
	echo "$$space"'Since you are using a GNU compiler,\
		it is on by default.' 1>&2; \
	echo "$$space"'To turn it off, pass --disable-md to configure.' 1>&2
endif

else # ! COMPILER_DEPEND

ifndef MOZ_AUTO_DEPS

define MAKE_DEPS_NOAUTO
	$(MKDEPEND) -w1024 -o'.$(OBJ_SUFFIX)' -f- $(DEFINES) $(ACDEFINES) $(INCLUDES) $< 2>/dev/null | sed -e "s|^[^ ]*/||" > $@
endef

$(MDDEPDIR)/%.pp: %.c
	$(REPORT_BUILD)
	@$(MAKE_DEPS_NOAUTO)

$(MDDEPDIR)/%.pp: %.cpp
	$(REPORT_BUILD)
	@$(MAKE_DEPS_NOAUTO)

$(MDDEPDIR)/%.pp: %.s
	$(REPORT_BUILD)
	@$(MAKE_DEPS_NOAUTO)

ifneq (,$(OBJS)$(XPIDLSRCS)$(SDK_XPIDLSRCS)$(SIMPLE_PROGRAMS))
depend:: $(SUBMAKEFILES) $(MAKE_DIRS) $(MDDEPFILES)
else
depend:: $(SUBMAKEFILES)
endif
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)

dependclean:: $(SUBMAKEFILES)
	rm -f $(MDDEPFILES)
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)

endif # MOZ_AUTO_DEPS

endif # COMPILER_DEPEND


#############################################################################
# MDDEPDIR is the subdirectory where all the dependency files are placed.
#   This uses a make rule (instead of a macro) to support parallel
#   builds (-jN). If this were done in the LOOP_OVER_DIRS macro, two
#   processes could simultaneously try to create the same directory.
#
#   We use $(CURDIR) in the rule's target to ensure that we don't find
#   a dependency directory in the source tree via VPATH (perhaps from
#   a previous build in the source tree) and thus neglect to create a
#   dependency directory in the object directory, where we really need
#   it.

$(CURDIR)/$(MDDEPDIR):
	@if test ! -d $@; then echo Creating $@; rm -rf $@; mkdir $@; else true; fi

ifneq (,$(filter-out all chrome default export realchrome tools clean clobber clobber_all distclean realclean,$(MAKECMDGOALS)))
ifneq (,$(OBJS)$(XPIDLSRCS)$(SDK_XPIDLSRCS)$(SIMPLE_PROGRAMS))
MDDEPEND_FILES		:= $(strip $(wildcard $(MDDEPDIR)/*.pp))

ifneq (,$(MDDEPEND_FILES))
ifdef PERL
# The script mddepend.pl checks the dependencies and writes to stdout
# one rule to force out-of-date objects. For example,
#   foo.o boo.o: FORCE
# The script has an advantage over including the *.pp files directly
# because it handles the case when header files are removed from the build.
# 'make' would complain that there is no way to build missing headers.
ifeq (,$(MAKE_RESTARTS))
$(MDDEPDIR)/.all.pp: FORCE
	@$(PERL) $(BUILD_TOOLS)/mddepend.pl $@ $(MDDEPEND_FILES)
endif
-include $(MDDEPDIR)/.all.pp
else
include $(MDDEPEND_FILES)
endif
endif

endif
endif
#############################################################################

-include $(topsrcdir)/$(MOZ_BUILD_APP)/app-rules.mk
-include $(MY_RULES)

#
# This speeds up gmake's processing if these files don't exist.
#
$(MY_CONFIG) $(MY_RULES):
	@touch $@

#
# Generate Emacs tags in a file named TAGS if ETAGS was set in $(MY_CONFIG)
# or in $(MY_RULES)
#
ifdef ETAGS
ifneq ($(CSRCS)$(CPPSRCS)$(HEADERS),)
all:: TAGS
TAGS:: $(CSRCS) $(CPPSRCS) $(HEADERS)
	$(ETAGS) $(CSRCS) $(CPPSRCS) $(HEADERS)
endif
endif

################################################################################
# Special gmake rules.
################################################################################


#
# Disallow parallel builds with MSVC < 8
#
ifneq (,$(filter 1200 1300 1310,$(_MSC_VER)))
.NOTPARALLEL:
endif

#
# Re-define the list of default suffixes, so gmake won't have to churn through
# hundreds of built-in suffix rules for stuff we don't need.
#
.SUFFIXES:

#
# Fake targets.  Always run these rules, even if a file/directory with that
# name already exists.
#
.PHONY: all all_platforms alltags boot checkout chrome realchrome clean clobber clobber_all export install libs makefiles realclean run_viewer run_apprunner tools $(DIRS) $(TOOL_DIRS) FORCE check check-interactive check-one

# Used as a dependency to force targets to rebuild
FORCE:

# Delete target if error occurs when building target
.DELETE_ON_ERROR:

# Properly set LIBPATTERNS for the platform
.LIBPATTERNS = $(if $(IMPORT_LIB_SUFFIX),$(LIB_PREFIX)%.$(IMPORT_LIB_SUFFIX)) $(LIB_PREFIX)%.$(LIB_SUFFIX) $(DLL_PREFIX)%$(DLL_SUFFIX) 

tags: TAGS

TAGS: $(SUBMAKEFILES) $(CSRCS) $(CPPSRCS) $(wildcard *.h)
	-etags $(CSRCS) $(CPPSRCS) $(wildcard *.h)
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)

echo-variable-%:
	@echo $($*)

echo-tiers:
	@echo $(TIERS)

echo-dirs:
	@echo $(DIRS)

echo-module:
	@echo $(MODULE)

echo-requires:
	@echo $(REQUIRES)

echo-requires-recursive::
ifdef _REPORT_ALL_DIRS
	@echo $(subst $(topsrcdir)/,,$(srcdir)): $(MODULE): $(REQUIRES)
else
	@$(if $(REQUIRES),echo $(subst $(topsrcdir)/,,$(srcdir)): $(MODULE): $(REQUIRES))
endif
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)

echo-depth-path:
	@$(topsrcdir)/build/unix/print-depth-path.sh

echo-module-name:
	@$(topsrcdir)/build/package/rpm/print-module-name.sh

echo-module-filelist:
	@$(topsrcdir)/build/package/rpm/print-module-filelist.sh

showtargs:
ifneq (,$(filter $(PROGRAM) $(HOST_PROGRAM) $(SIMPLE_PROGRAMS) $(HOST_LIBRARY) $(LIBRARY) $(SHARED_LIBRARY),$(TARGETS)))
	@echo --------------------------------------------------------------------------------
	@echo "PROGRAM             = $(PROGRAM)"
	@echo "SIMPLE_PROGRAMS     = $(SIMPLE_PROGRAMS)"
	@echo "LIBRARY             = $(LIBRARY)"
	@echo "SHARED_LIBRARY      = $(SHARED_LIBRARY)"
	@echo "SHARED_LIBRARY_LIBS = $(SHARED_LIBRARY_LIBS)"
	@echo "LIBS                = $(LIBS)"
	@echo "DEF_FILE            = $(DEF_FILE)"
	@echo "IMPORT_LIBRARY      = $(IMPORT_LIBRARY)"
	@echo "STATIC_LIBS         = $(STATIC_LIBS)"
	@echo "SHARED_LIBS         = $(SHARED_LIBS)"
	@echo "EXTRA_DSO_LIBS      = $(EXTRA_DSO_LIBS)"
	@echo "EXTRA_DSO_LDOPTS    = $(EXTRA_DSO_LDOPTS)"
	@echo "DEPENDENT_LIBS      = $(DEPENDENT_LIBS)"
	@echo --------------------------------------------------------------------------------
endif
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)

showbuild:
	@echo "MOZ_BUILD_ROOT     = $(MOZ_BUILD_ROOT)"
	@echo "MOZ_WIDGET_TOOLKIT = $(MOZ_WIDGET_TOOLKIT)"
	@echo "CC                 = $(CC)"
	@echo "CXX                = $(CXX)"
	@echo "CCC                = $(CCC)"
	@echo "CPP                = $(CPP)"
	@echo "LD                 = $(LD)"
	@echo "AR                 = $(AR)"
	@echo "IMPLIB             = $(IMPLIB)"
	@echo "FILTER             = $(FILTER)"
	@echo "MKSHLIB            = $(MKSHLIB)"
	@echo "MKCSHLIB           = $(MKCSHLIB)"
	@echo "RC                 = $(RC)"
	@echo "CFLAGS             = $(CFLAGS)"
	@echo "OS_CFLAGS          = $(OS_CFLAGS)"
	@echo "COMPILE_CFLAGS     = $(COMPILE_CFLAGS)"
	@echo "CXXFLAGS           = $(CXXFLAGS)"
	@echo "OS_CXXFLAGS        = $(OS_CXXFLAGS)"
	@echo "COMPILE_CXXFLAGS   = $(COMPILE_CXXFLAGS)"
	@echo "COMPILE_CMFLAGS    = $(COMPILE_CMFLAGS)"
	@echo "COMPILE_CMMFLAGS   = $(COMPILE_CMMFLAGS)"
	@echo "LDFLAGS            = $(LDFLAGS)"
	@echo "OS_LDFLAGS         = $(OS_LDFLAGS)"
	@echo "DSO_LDOPTS         = $(DSO_LDOPTS)"
	@echo "OS_INCLUDES        = $(OS_INCLUDES)"
	@echo "OS_LIBS            = $(OS_LIBS)"
	@echo "EXTRA_LIBS         = $(EXTRA_LIBS)"
	@echo "BIN_FLAGS          = $(BIN_FLAGS)"
	@echo "INCLUDES           = $(INCLUDES)"
	@echo "DEFINES            = $(DEFINES)"
	@echo "ACDEFINES          = $(ACDEFINES)"
	@echo "BIN_SUFFIX         = $(BIN_SUFFIX)"
	@echo "LIB_SUFFIX         = $(LIB_SUFFIX)"
	@echo "DLL_SUFFIX         = $(DLL_SUFFIX)"
	@echo "IMPORT_LIB_SUFFIX  = $(IMPORT_LIB_SUFFIX)"
	@echo "INSTALL            = $(INSTALL)"

showhost:
	@echo "HOST_CC            = $(HOST_CC)"
	@echo "HOST_CXX           = $(HOST_CXX)"
	@echo "HOST_CFLAGS        = $(HOST_CFLAGS)"
	@echo "HOST_LDFLAGS       = $(HOST_LDFLAGS)"
	@echo "HOST_LIBS          = $(HOST_LIBS)"
	@echo "HOST_EXTRA_LIBS    = $(HOST_EXTRA_LIBS)"
	@echo "HOST_EXTRA_DEPS    = $(HOST_EXTRA_DEPS)"
	@echo "HOST_PROGRAM       = $(HOST_PROGRAM)"
	@echo "HOST_OBJS          = $(HOST_OBJS)"
	@echo "HOST_PROGOBJS      = $(HOST_PROGOBJS)"
	@echo "HOST_LIBRARY       = $(HOST_LIBRARY)"

showbuildmods::
	@echo "Build Modules	= $(BUILD_MODULES)"
	@echo "Module dirs	= $(BUILD_MODULE_DIRS)"

zipmakes:
ifneq (,$(filter $(PROGRAM) $(SIMPLE_PROGRAMS) $(LIBRARY) $(SHARED_LIBRARY),$(TARGETS)))
	zip $(DEPTH)/makefiles $(subst $(topsrcdir),$(MOZ_SRC)/mozilla,$(srcdir)/Makefile.in)
endif
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)

documentation:
	@cd $(DEPTH)
	$(DOXYGEN) $(DEPTH)/config/doxygen.cfg

check:: $(SUBMAKEFILES) $(MAKE_DIRS)
	+$(LOOP_OVER_PARALLEL_DIRS)
	+$(LOOP_OVER_DIRS)
	+$(LOOP_OVER_TOOL_DIRS)
