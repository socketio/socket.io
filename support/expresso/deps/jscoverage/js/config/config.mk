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
#   Benjamin Smedberg <benjamin@smedbergs.us>
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
# config.mk
#
# Determines the platform and builds the macros needed to load the
# appropriate platform-specific .mk file, then defines all (most?)
# of the generic macros.
#

# Define an include-at-most-once flag
INCLUDED_CONFIG_MK = 1

EXIT_ON_ERROR = set -e; # Shell loops continue past errors without this.

ifndef topsrcdir
topsrcdir	= $(DEPTH)
endif

ifndef INCLUDED_AUTOCONF_MK
include $(DEPTH)/config/autoconf.mk
endif
ifndef INCLUDED_INSURE_MK
ifdef MOZ_INSURIFYING
include $(topsrcdir)/config/insure.mk
endif
endif

COMMA = ,

# Sanity check some variables
CHECK_VARS := \
 XPI_NAME \
 LIBRARY_NAME \
 MODULE \
 DEPTH \
 SHORT_LIBNAME \
 XPI_PKGNAME \
 INSTALL_EXTENSION_ID \
 $(NULL)

# checks for internal spaces or trailing spaces in the variable
# named by $x
check-variable = $(if $(filter-out 0 1,$(words $($(x))z)),$(error Spaces are not allowed in $(x)))

$(foreach x,$(CHECK_VARS),$(check-variable))

# FINAL_TARGET specifies the location into which we copy end-user-shipped
# build products (typelibs, components, chrome).
#
# It will usually be the well-loved $(DIST)/bin, today, but can also be an
# XPI-contents staging directory for ambitious and right-thinking extensions.
FINAL_TARGET = $(if $(XPI_NAME),$(DIST)/xpi-stage/$(XPI_NAME),$(DIST)/bin)

# MAKE_JARS_TARGET is a staging area for make-jars.pl.  When packaging in
# the jar format, make-jars leaves behind a directory structure that's not
# needed in $(FINAL_TARGET).  For both, flat, and symlink, the directory
# structure contains the chrome, so leave it in $(FINAL_TARGET).
ifeq (jar,$(MOZ_CHROME_FILE_FORMAT))
MAKE_JARS_TARGET = $(if $(XPI_NAME),$(FINAL_TARGET).stage,$(DIST)/chrome-stage)
else
MAKE_JARS_TARGET = $(FINAL_TARGET)
endif

#
# The VERSION_NUMBER is suffixed onto the end of the DLLs we ship.
# Since the longest of these is 5 characters without the suffix,
# be sure to not set VERSION_NUMBER to anything longer than 3 
# characters for Win16's sake.
#
VERSION_NUMBER		= 50

ifeq ($(HOST_OS_ARCH),WINNT)
win_srcdir	:= $(subst $(topsrcdir),$(WIN_TOP_SRC),$(srcdir))
BUILD_TOOLS	= $(WIN_TOP_SRC)/build/unix
else
win_srcdir	:= $(srcdir)
BUILD_TOOLS	= $(topsrcdir)/build/unix
endif

CONFIG_TOOLS	= $(MOZ_BUILD_ROOT)/config
AUTOCONF_TOOLS	= $(topsrcdir)/build/autoconf

ifeq ($(OS_ARCH),QNX)
ifeq ($(OS_TARGET),NTO)
LD		:= qcc -Vgcc_ntox86 -nostdlib
else
LD		:= $(CC)
endif
endif
ifeq ($(OS_ARCH),BeOS)
BEOS_ADDON_WORKAROUND	= 1
endif

#
# Strip off the excessively long version numbers on these platforms,
# but save the version to allow multiple versions of the same base
# platform to be built in the same tree.
#
ifneq (,$(filter FreeBSD HP-UX IRIX Linux NetBSD OpenBSD OSF1 SunOS,$(OS_ARCH)))
OS_RELEASE	:= $(basename $(OS_RELEASE))

# Allow the user to ignore the OS_VERSION, which is usually irrelevant.
ifdef WANT_MOZILLA_CONFIG_OS_VERSION
OS_VERS		:= $(suffix $(OS_RELEASE))
OS_VERSION	:= $(shell echo $(OS_VERS) | sed 's/-.*//')
endif

endif

OS_CONFIG	:= $(OS_ARCH)$(OS_RELEASE)

FINAL_LINK_LIBS = $(DEPTH)/config/final-link-libs
FINAL_LINK_COMPS = $(DEPTH)/config/final-link-comps
FINAL_LINK_COMP_NAMES = $(DEPTH)/config/final-link-comp-names

MOZ_UNICHARUTIL_LIBS = $(LIBXUL_DIST)/lib/$(LIB_PREFIX)unicharutil_s.$(LIB_SUFFIX)
MOZ_WIDGET_SUPPORT_LIBS    = $(DIST)/lib/$(LIB_PREFIX)widgetsupport_s.$(LIB_SUFFIX)

ifdef MOZ_MEMORY
ifneq ($(OS_ARCH),WINNT)
JEMALLOC_LIBS = $(MKSHLIB_FORCE_ALL) $(call EXPAND_LIBNAME,jemalloc) $(MKSHLIB_UNFORCE_ALL)
endif
endif

# determine debug-related options
_DEBUG_CFLAGS :=
_DEBUG_LDFLAGS :=

ifndef MOZ_DEBUG
  # global debugging is disabled 
  # check if it was explicitly enabled for this module
  ifneq (, $(findstring $(MODULE), $(MOZ_DEBUG_MODULES)))
    MOZ_DEBUG:=1
  endif
else
  # global debugging is enabled
  # check if it was explicitly disabled for this module
  ifneq (, $(findstring ^$(MODULE), $(MOZ_DEBUG_MODULES)))
    MOZ_DEBUG:=
  endif
endif

ifdef MOZ_DEBUG
  _DEBUG_CFLAGS += $(MOZ_DEBUG_ENABLE_DEFS)
  XULPPFLAGS += $(MOZ_DEBUG_ENABLE_DEFS)
else
  _DEBUG_CFLAGS += $(MOZ_DEBUG_DISABLE_DEFS)
  XULPPFLAGS += $(MOZ_DEBUG_DISABLE_DEFS)
endif

# determine if -g should be passed to the compiler, based on
# the current module, and the value of MOZ_DBGRINFO_MODULES

ifdef MOZ_DEBUG
  MOZ_DBGRINFO_MODULES += ALL_MODULES
  pattern := ALL_MODULES ^ALL_MODULES
else
  MOZ_DBGRINFO_MODULES += ^ALL_MODULES
  pattern := ALL_MODULES ^ALL_MODULES
endif

ifdef MODULE
  # our current Makefile specifies a module name - add it to our pattern
  pattern += $(MODULE) ^$(MODULE)
endif

# start by finding the first relevant module name 
# (remember that the order of the module names in MOZ_DBGRINFO_MODULES 
# is reversed from the order the user specified to configure - 
# this allows the user to put general names at the beginning
# of the list, and to override them with explicit module names later 
# in the list)

first_match:=$(firstword $(filter $(pattern), $(MOZ_DBGRINFO_MODULES)))

ifeq ($(first_match), $(MODULE))
  # the user specified explicitly that 
  # this module should be compiled with -g
  _DEBUG_CFLAGS += $(MOZ_DEBUG_FLAGS)
  _DEBUG_LDFLAGS += $(MOZ_DEBUG_LDFLAGS)
else
  ifeq ($(first_match), ^$(MODULE))
    # the user specified explicitly that this module 
    # should not be compiled with -g (nothing to do)
  else
    ifeq ($(first_match), ALL_MODULES)
      # the user didn't mention this module explicitly, 
      # but wanted all modules to be compiled with -g
      _DEBUG_CFLAGS += $(MOZ_DEBUG_FLAGS)
      _DEBUG_LDFLAGS += $(MOZ_DEBUG_LDFLAGS)      
    else
      ifeq ($(first_match), ^ALL_MODULES)
        # the user didn't mention this module explicitly, 
        # but wanted all modules to be compiled without -g (nothing to do)
      endif
    endif
  endif
endif


# append debug flags 
# (these might have been above when processing MOZ_DBGRINFO_MODULES)
OS_CFLAGS += $(_DEBUG_CFLAGS)
OS_CXXFLAGS += $(_DEBUG_CFLAGS)
OS_LDFLAGS += $(_DEBUG_LDFLAGS)

# MOZ_PROFILE equivs for win32
ifeq ($(OS_ARCH)_$(GNU_CC),WINNT_)
ifdef MOZ_DEBUG
ifneq (,$(MOZ_BROWSE_INFO)$(MOZ_BSCFILE))
OS_CFLAGS += -FR
OS_CXXFLAGS += -FR
endif
else # ! MOZ_DEBUG

# MOZ_DEBUG_SYMBOLS generates debug symbols in separate PDB files.
# Used for generating an optimized build with debugging symbols.
# Used in the Windows nightlies to generate symbols for crash reporting.
ifdef MOZ_DEBUG_SYMBOLS
OS_CXXFLAGS += -Zi -UDEBUG -DNDEBUG
OS_CFLAGS += -Zi -UDEBUG -DNDEBUG
OS_LDFLAGS += -DEBUG -OPT:REF -OPT:nowin98
endif

ifdef MOZ_QUANTIFY
# -FIXED:NO is needed for Quantify to work, but it increases the size
# of executables, so only use it if building for Quantify.
WIN32_EXE_LDFLAGS += -FIXED:NO

# We need -OPT:NOICF to prevent identical methods from being merged together.
# Otherwise, Quantify doesn't know which method was actually called when it's
# showing you the profile.
OS_LDFLAGS += -OPT:NOICF
endif

#
# Handle trace-malloc in optimized builds.
# No opt to give sane callstacks.
#
ifdef NS_TRACE_MALLOC
MOZ_OPTIMIZE_FLAGS=-Zi -Od -UDEBUG -DNDEBUG
OS_LDFLAGS = -DEBUG -PDB:NONE -OPT:REF -OPT:nowin98
endif # NS_TRACE_MALLOC

endif # MOZ_DEBUG
endif # WINNT && !GNU_CC

#
# Build using PIC by default
# Do not use PIC if not building a shared lib (see exceptions below)
#

ifndef BUILD_STATIC_LIBS
_ENABLE_PIC=1
endif
ifneq (,$(FORCE_SHARED_LIB)$(FORCE_USE_PIC))
_ENABLE_PIC=1
endif

# In Firefox, all components are linked into either libxul or the static
# meta-component, and should be compiled with PIC.
ifdef MOZ_META_COMPONENT
_ENABLE_PIC=1
endif

# If module is going to be merged into the nsStaticModule, 
# make sure that the entry points are translated and 
# the module is built static.

ifdef IS_COMPONENT
ifdef EXPORT_LIBRARY
ifneq (,$(BUILD_STATIC_LIBS))
ifdef MODULE_NAME
DEFINES += -DXPCOM_TRANSLATE_NSGM_ENTRY_POINT=1
FORCE_STATIC_LIB=1
endif
endif
endif
endif

# Determine if module being compiled is destined 
# to be merged into libxul

ifdef MOZ_ENABLE_LIBXUL
ifdef LIBXUL_LIBRARY
ifdef IS_COMPONENT
ifdef MODULE_NAME
DEFINES += -DXPCOM_TRANSLATE_NSGM_ENTRY_POINT=1
else
$(error Component makefile does not specify MODULE_NAME.)
endif
endif
FORCE_STATIC_LIB=1
_ENABLE_PIC=1
SHORT_LIBNAME=
endif
endif

# If we are building this component into an extension/xulapp, it cannot be
# statically linked. In the future we may want to add a xulapp meta-component
# build option.

ifdef XPI_NAME
_ENABLE_PIC=1
ifdef IS_COMPONENT
EXPORT_LIBRARY=
FORCE_STATIC_LIB=
FORCE_SHARED_LIB=1
endif
endif

#
# Disable PIC if necessary
#

ifndef _ENABLE_PIC
DSO_CFLAGS=
ifeq ($(OS_ARCH)_$(HAVE_GCC3_ABI),Darwin_1)
DSO_PIC_CFLAGS=-mdynamic-no-pic
else
DSO_PIC_CFLAGS=
endif
endif

# This comes from configure
ifdef MOZ_PROFILE_GUIDED_OPTIMIZE_DISABLE
NO_PROFILE_GUIDED_OPTIMIZE = 1
endif

# Enable profile-based feedback
ifndef NO_PROFILE_GUIDED_OPTIMIZE
ifdef MOZ_PROFILE_GENERATE
# No sense in profiling tools
ifndef INTERNAL_TOOLS
OS_CFLAGS += $(PROFILE_GEN_CFLAGS)
OS_CXXFLAGS += $(PROFILE_GEN_CFLAGS)
OS_LDFLAGS += $(PROFILE_GEN_LDFLAGS)
ifeq (WINNT,$(OS_ARCH))
AR_FLAGS += -LTCG
endif
endif # INTERNAL_TOOLS
endif # MOZ_PROFILE_GENERATE

ifdef MOZ_PROFILE_USE
ifndef INTERNAL_TOOLS
OS_CFLAGS += $(PROFILE_USE_CFLAGS)
OS_CXXFLAGS += $(PROFILE_USE_CFLAGS)
OS_LDFLAGS += $(PROFILE_USE_LDFLAGS)
ifeq (WINNT,$(OS_ARCH))
AR_FLAGS += -LTCG
endif
endif # INTERNAL_TOOLS
endif # MOZ_PROFILE_USE
endif # NO_PROFILE_GUIDED_OPTIMIZE


# Does the makefile specifies the internal XPCOM API linkage?
ifneq (,$(MOZILLA_INTERNAL_API)$(LIBXUL_LIBRARY))
DEFINES += -DMOZILLA_INTERNAL_API
endif

# Force XPCOM/widget/gfx methods to be _declspec(dllexport) when we're
# building libxul libraries
ifdef MOZ_ENABLE_LIBXUL
ifdef LIBXUL_LIBRARY
DEFINES += \
		-D_IMPL_NS_COM \
		-DEXPORT_XPT_API \
		-DEXPORT_XPTC_API \
		-D_IMPL_NS_COM_OBSOLETE \
		-D_IMPL_NS_GFX \
		-D_IMPL_NS_WIDGET \
		-DIMPL_XREAPI \
		-DIMPL_NS_NET \
		-DIMPL_THEBES \
		$(NULL)

ifndef MOZ_NATIVE_ZLIB
DEFINES += -DZLIB_INTERNAL
endif
endif
endif

# Force _all_ exported methods to be |_declspec(dllexport)| when we're
# building them into the executable.

ifeq (,$(filter-out WINNT WINCE OS2, $(OS_ARCH)))
ifdef BUILD_STATIC_LIBS
DEFINES += \
        -D_IMPL_NS_GFX \
        -D_IMPL_NS_MSG_BASE \
        -D_IMPL_NS_WIDGET \
        $(NULL)
endif
endif

# Flags passed to make-jars.pl

MAKE_JARS_FLAGS = \
	-t $(topsrcdir) \
	-f $(MOZ_CHROME_FILE_FORMAT) \
	$(NULL)

ifdef USE_EXTENSION_MANIFEST
MAKE_JARS_FLAGS += -e
endif

ifdef BOTH_MANIFESTS
MAKE_JARS_FLAGS += --both-manifests
endif

TAR_CREATE_FLAGS = -cvhf

ifeq ($(OS_ARCH),BSD_OS)
TAR_CREATE_FLAGS = -cvLf
endif

ifeq ($(OS_ARCH),OS2)
TAR_CREATE_FLAGS = -cvf
endif

#
# Personal makefile customizations go in these optional make include files.
#
MY_CONFIG	:= $(DEPTH)/config/myconfig.mk
MY_RULES	:= $(DEPTH)/config/myrules.mk

#
# Default command macros; can be overridden in <arch>.mk.
#
CCC		= $(CXX)
NFSPWD		= $(CONFIG_TOOLS)/nfspwd
PURIFY		= purify $(PURIFYOPTIONS)
QUANTIFY	= quantify $(QUANTIFYOPTIONS)
ifdef CROSS_COMPILE
XPIDL_COMPILE 	= $(CYGWIN_WRAPPER) $(LIBXUL_DIST)/host/bin/host_xpidl$(HOST_BIN_SUFFIX)
XPIDL_LINK	= $(CYGWIN_WRAPPER) $(LIBXUL_DIST)/host/bin/host_xpt_link$(HOST_BIN_SUFFIX)
else
XPIDL_COMPILE 	= $(CYGWIN_WRAPPER) $(LIBXUL_DIST)/bin/xpidl$(BIN_SUFFIX)
XPIDL_LINK	= $(CYGWIN_WRAPPER) $(LIBXUL_DIST)/bin/xpt_link$(BIN_SUFFIX)
endif

# Java macros
JAVA_GEN_DIR  = _javagen
JAVA_DIST_DIR = $(DEPTH)/$(JAVA_GEN_DIR)
JAVA_IFACES_PKG_NAME = org/mozilla/interfaces

REQ_INCLUDES	= -I$(srcdir) -I. $(foreach d,$(REQUIRES),-I$(DIST)/include/$d) -I$(DIST)/include 
ifdef LIBXUL_SDK
REQ_INCLUDES_SDK = $(foreach d,$(REQUIRES),-I$(LIBXUL_SDK)/include/$d) -I$(LIBXUL_SDK)/include
endif

INCLUDES	= $(LOCAL_INCLUDES) $(REQ_INCLUDES) $(REQ_INCLUDES_SDK) -I$(PUBLIC) $(OS_INCLUDES)

ifndef MOZILLA_INTERNAL_API
INCLUDES	+= -I$(LIBXUL_DIST)/sdk/include
endif

# The entire tree should be subject to static analysis using the XPCOM
# script. Additional scripts may be added by specific subdirectories.

DEHYDRA_SCRIPT = $(topsrcdir)/xpcom/analysis/static-checking.js

DEHYDRA_MODULES = \
  $(topsrcdir)/xpcom/analysis/final.js \
  $(NULL)

TREEHYDRA_MODULES = \
  $(topsrcdir)/xpcom/analysis/outparams.js \
  $(topsrcdir)/xpcom/analysis/stack.js \
  $(topsrcdir)/xpcom/analysis/flow.js \
  $(NULL)

DEHYDRA_ARGS = \
  --topsrcdir=$(topsrcdir) \
  --objdir=$(DEPTH) \
  --dehydra-modules=$(subst $(NULL) ,$(COMMA),$(strip $(DEHYDRA_MODULES))) \
  --treehydra-modules=$(subst $(NULL) ,$(COMMA),$(strip $(TREEHYDRA_MODULES))) \
  $(NULL)

DEHYDRA_FLAGS = -fplugin=$(DEHYDRA_PATH) -fplugin-arg='$(DEHYDRA_SCRIPT) $(DEHYDRA_ARGS)'

ifdef DEHYDRA_PATH
OS_CXXFLAGS += $(DEHYDRA_FLAGS)
endif

CFLAGS		= $(OS_CFLAGS)
CXXFLAGS	= $(OS_CXXFLAGS)
LDFLAGS		= $(OS_LDFLAGS) $(MOZ_FIX_LINK_PATHS)

# Allow each module to override the *default* optimization settings
# by setting MODULE_OPTIMIZE_FLAGS if the developer has not given
# arguments to --enable-optimize
ifdef MOZ_OPTIMIZE
ifeq (1,$(MOZ_OPTIMIZE))
ifdef MODULE_OPTIMIZE_FLAGS
CFLAGS		+= $(MODULE_OPTIMIZE_FLAGS)
CXXFLAGS	+= $(MODULE_OPTIMIZE_FLAGS)
else
CFLAGS		+= $(MOZ_OPTIMIZE_FLAGS)
CXXFLAGS	+= $(MOZ_OPTIMIZE_FLAGS)
endif # MODULE_OPTIMIZE_FLAGS
else
CFLAGS		+= $(MOZ_OPTIMIZE_FLAGS)
CXXFLAGS	+= $(MOZ_OPTIMIZE_FLAGS)
endif # MOZ_OPTIMIZE == 1
LDFLAGS		+= $(MOZ_OPTIMIZE_LDFLAGS)
endif # MOZ_OPTIMIZE

ifdef CROSS_COMPILE
HOST_CFLAGS	+= $(HOST_OPTIMIZE_FLAGS)
else
ifdef MOZ_OPTIMIZE
ifeq (1,$(MOZ_OPTIMIZE))
ifdef MODULE_OPTIMIZE_FLAGS
HOST_CFLAGS	+= $(MODULE_OPTIMIZE_FLAGS)
else
HOST_CFLAGS	+= $(MOZ_OPTIMIZE_FLAGS)
endif # MODULE_OPTIMIZE_FLAGS
else
HOST_CFLAGS	+= $(MOZ_OPTIMIZE_FLAGS)
endif # MOZ_OPTIMIZE == 1
endif # MOZ_OPTIMIZE
endif # CROSS_COMPILE


ifeq ($(OS_ARCH)_$(GNU_CC),WINNT_)
#// Currently, unless USE_STATIC_LIBS is defined, the multithreaded
#// DLL version of the RTL is used...
#//
#//------------------------------------------------------------------------
ifdef USE_STATIC_LIBS
RTL_FLAGS=-MT          # Statically linked multithreaded RTL
ifneq (,$(MOZ_DEBUG)$(NS_TRACE_MALLOC))
ifndef MOZ_NO_DEBUG_RTL
RTL_FLAGS=-MTd         # Statically linked multithreaded MSVC4.0 debug RTL
endif
endif # MOZ_DEBUG || NS_TRACE_MALLOC

else # !USE_STATIC_LIBS

RTL_FLAGS=-MD          # Dynamically linked, multithreaded RTL
ifneq (,$(MOZ_DEBUG)$(NS_TRACE_MALLOC))
ifndef MOZ_NO_DEBUG_RTL
RTL_FLAGS=-MDd         # Dynamically linked, multithreaded MSVC4.0 debug RTL
endif 
endif # MOZ_DEBUG || NS_TRACE_MALLOC
endif # USE_STATIC_LIBS
endif # WINNT && !GNU_CC

ifeq ($(OS_ARCH),Darwin)
# Darwin doesn't cross-compile, so just set both types of flags here.
HOST_CMFLAGS += -fobjc-exceptions
HOST_CMMFLAGS += -fobjc-exceptions
OS_COMPILE_CMFLAGS += -fobjc-exceptions
OS_COMPILE_CMMFLAGS += -fobjc-exceptions
endif

COMPILE_CFLAGS	= $(VISIBILITY_FLAGS) $(DEFINES) $(INCLUDES) $(XCFLAGS) $(PROFILER_CFLAGS) $(DSO_CFLAGS) $(DSO_PIC_CFLAGS) $(CFLAGS) $(RTL_FLAGS) $(OS_COMPILE_CFLAGS)
COMPILE_CXXFLAGS = $(VISIBILITY_FLAGS) $(DEFINES) $(INCLUDES) $(XCFLAGS) $(PROFILER_CFLAGS) $(DSO_CFLAGS) $(DSO_PIC_CFLAGS)  $(CXXFLAGS) $(RTL_FLAGS) $(OS_COMPILE_CXXFLAGS)
COMPILE_CMFLAGS = $(OS_COMPILE_CMFLAGS)
COMPILE_CMMFLAGS = $(OS_COMPILE_CMMFLAGS)

ifndef CROSS_COMPILE
HOST_CFLAGS += $(RTL_FLAGS)
endif

#
# Name of the binary code directories
#
# Override defaults

# We need to know where to find the libraries we
# put on the link line for binaries, and should
# we link statically or dynamic?  Assuming dynamic for now.

ifneq (WINNT_,$(OS_ARCH)_$(GNU_CC))
ifneq (,$(filter-out WINCE,$(OS_ARCH)))
LIBS_DIR	= -L$(DIST)/bin -L$(DIST)/lib
ifdef LIBXUL_SDK
LIBS_DIR	+= -L$(LIBXUL_SDK)/bin -L$(LIBXUL_SDK)/lib
endif
endif
endif

# Default location of include files
IDL_DIR		= $(DIST)/idl
ifdef MODULE
PUBLIC		= $(DIST)/include/$(MODULE)
else
PUBLIC		= $(DIST)/include
endif

XPIDL_FLAGS = -I$(srcdir) -I$(IDL_DIR)
ifdef LIBXUL_SDK
XPIDL_FLAGS += -I$(LIBXUL_SDK)/idl
endif

SDK_PUBLIC  = $(DIST)/sdk/include
SDK_IDL_DIR = $(DIST)/sdk/idl
SDK_LIB_DIR = $(DIST)/sdk/lib
SDK_BIN_DIR = $(DIST)/sdk/bin

DEPENDENCIES	= .md

MOZ_COMPONENT_LIBS=$(XPCOM_LIBS) $(MOZ_COMPONENT_NSPR_LIBS)

ifdef GC_LEAK_DETECTOR
XPCOM_LIBS += -lboehm
endif

ifeq (xpconnect, $(findstring xpconnect, $(BUILD_MODULES)))
DEFINES +=  -DXPCONNECT_STANDALONE
endif

ifeq ($(OS_ARCH),OS2)
ELF_DYNSTR_GC	= echo
else
ELF_DYNSTR_GC	= :
endif

ifndef CROSS_COMPILE
ifdef USE_ELF_DYNSTR_GC
ifdef MOZ_COMPONENTS_VERSION_SCRIPT_LDFLAGS
ELF_DYNSTR_GC 	= $(DEPTH)/config/elf-dynstr-gc
endif
endif
endif

ifeq ($(OS_ARCH),Darwin)
ifdef NEXT_ROOT
export NEXT_ROOT
PBBUILD = NEXT_ROOT= $(PBBUILD_BIN)
else # NEXT_ROOT
PBBUILD = $(PBBUILD_BIN)
endif # NEXT_ROOT
PBBUILD_SETTINGS = GCC_VERSION="$(GCC_VERSION)" SYMROOT=build ARCHS="$(OS_TEST)"
ifdef MACOS_SDK_DIR
PBBUILD_SETTINGS += SDKROOT="$(MACOS_SDK_DIR)"
endif # MACOS_SDK_DIR
ifdef MACOSX_DEPLOYMENT_TARGET
export MACOSX_DEPLOYMENT_TARGET
PBBUILD_SETTINGS += MACOSX_DEPLOYMENT_TARGET="$(MACOSX_DEPLOYMENT_TARGET)"
endif # MACOSX_DEPLOYMENT_TARGET
ifdef MOZ_OPTIMIZE
ifeq (2,$(MOZ_OPTIMIZE))
# Only override project defaults if the config specified explicit settings
PBBUILD_SETTINGS += GCC_MODEL_TUNING= OPTIMIZATION_CFLAGS="$(MOZ_OPTIMIZE_FLAGS)"
endif # MOZ_OPTIMIZE=2
endif # MOZ_OPTIMIZE
ifeq (1,$(HAS_XCODE_2_1))
# Xcode 2.1 puts its build products in a directory corresponding to the
# selected build style/configuration.
XCODE_PRODUCT_DIR = build/$(BUILDSTYLE)
else
XCODE_PRODUCT_DIR = build
endif # HAS_XCODE_2_1=1
endif # OS_ARCH=Darwin


ifdef MOZ_NATIVE_MAKEDEPEND
MKDEPEND_DIR	=
MKDEPEND	= $(CYGWIN_WRAPPER) $(MOZ_NATIVE_MAKEDEPEND)
else
MKDEPEND_DIR	= $(CONFIG_TOOLS)/mkdepend
MKDEPEND	= $(CYGWIN_WRAPPER) $(MKDEPEND_DIR)/mkdepend$(BIN_SUFFIX)
endif

# Set link flags according to whether we want a console.
ifdef MOZ_WINCONSOLE
ifeq ($(MOZ_WINCONSOLE),1)
ifeq ($(OS_ARCH),OS2)
BIN_FLAGS	+= -Zlinker -PM:VIO
endif
ifeq ($(OS_ARCH),WINNT)
ifdef GNU_CC
WIN32_EXE_LDFLAGS	+= -mconsole
else
WIN32_EXE_LDFLAGS	+= -SUBSYSTEM:CONSOLE
endif
endif
else # MOZ_WINCONSOLE
ifeq ($(OS_ARCH),OS2)
BIN_FLAGS	+= -Zlinker -PM:PM
endif
ifeq ($(OS_ARCH),WINNT)
ifdef GNU_CC
WIN32_EXE_LDFLAGS	+= -mwindows
else
WIN32_EXE_LDFLAGS	+= -SUBSYSTEM:WINDOWS
endif
endif
endif
endif

# Flags needed to link against the component library
ifdef MOZ_COMPONENTLIB
MOZ_COMPONENTLIB_EXTRA_DSO_LIBS = mozcomps xpcom_compat

# Tell the linker where NSS is, if we're building crypto
ifeq ($(OS_ARCH),Darwin)
ifeq (,$(findstring crypto,$(MOZ_META_COMPONENTS)))
MOZ_COMPONENTLIB_EXTRA_LIBS = $(foreach library, $(patsubst -l%, $(LIB_PREFIX)%$(DLL_SUFFIX), $(filter -l%, $(NSS_LIBS))), -dylib_file @executable_path/$(library):$(DIST)/bin/$(library))
endif
endif
endif

# If we're building a component on MSVC, we don't want to generate an
# import lib, because that import lib will collide with the name of a
# static version of the same library.
ifeq ($(GNU_LD)$(OS_ARCH),WINNT)
ifdef IS_COMPONENT
LDFLAGS += -IMPLIB:fake.lib
DELETE_AFTER_LINK = fake.lib fake.exp
endif
endif

#
# Include any personal overrides the user might think are needed.
#
-include $(topsrcdir)/$(MOZ_BUILD_APP)/app-config.mk
-include $(MY_CONFIG)

######################################################################
# Now test variables that might have been set or overridden by $(MY_CONFIG).

DEFINES		+= -DOSTYPE=\"$(OS_CONFIG)\"
DEFINES		+= -DOSARCH=$(OS_ARCH)

# For profiling
ifdef ENABLE_EAZEL_PROFILER
ifndef INTERNAL_TOOLS
ifneq ($(LIBRARY_NAME), xpt)
ifneq (, $(findstring $(shell $(topsrcdir)/build/unix/print-depth-path.sh | awk -F/ '{ print $$2; }'), $(MOZ_PROFILE_MODULES)))
PROFILER_CFLAGS	= $(EAZEL_PROFILER_CFLAGS) -DENABLE_EAZEL_PROFILER
PROFILER_LIBS	= $(EAZEL_PROFILER_LIBS)
endif
endif
endif
endif

######################################################################

GARBAGE		+= $(DEPENDENCIES) $(MKDEPENDENCIES) $(MKDEPENDENCIES).bak core $(wildcard core.[0-9]*) $(wildcard *.err) $(wildcard *.pure) $(wildcard *_pure_*.o) Templates.DB

ifeq ($(OS_ARCH),Darwin)
ifndef NSDISTMODE
NSDISTMODE=absolute_symlink
endif
PWD := $(shell pwd)
endif

ifdef NSINSTALL_BIN
NSINSTALL	= $(CYGWIN_WRAPPER) $(NSINSTALL_BIN)
else
ifeq (WINNT,$(CROSS_COMPILE)$(OS_ARCH))
NSINSTALL	= $(CYGWIN_WRAPPER) $(MOZ_TOOLS_DIR)/bin/nsinstall
else
ifeq (OS2,$(CROSS_COMPILE)$(OS_ARCH))
NSINSTALL	= $(MOZ_TOOLS_DIR)/nsinstall
else
NSINSTALL	= $(CONFIG_TOOLS)/nsinstall
endif # OS2
endif # WINNT
endif # NSINSTALL_BIN


ifeq (,$(CROSS_COMPILE)$(filter-out WINNT OS2, $(OS_ARCH)))
INSTALL		= $(NSINSTALL)
else
ifeq ($(NSDISTMODE),copy)
# copy files, but preserve source mtime
INSTALL		= $(NSINSTALL) -t
else
ifeq ($(NSDISTMODE),absolute_symlink)
# install using absolute symbolic links
ifeq ($(OS_ARCH),Darwin)
INSTALL		= $(NSINSTALL) -L $(PWD)
else
INSTALL		= $(NSINSTALL) -L `$(NFSPWD)`
endif # Darwin
else
# install using relative symbolic links
INSTALL		= $(NSINSTALL) -R
endif # absolute_symlink
endif # copy
endif # WINNT/OS2

ifeq (,$(filter-out WINCE,$(OS_ARCH)))
NSINSTALL	= $(CYGWIN_WRAPPER) nsinstall
INSTALL     = $(CYGWIN_WRAPPER) nsinstall 
endif

# Use nsinstall in copy mode to install files on the system
SYSINSTALL	= $(NSINSTALL) -t

ifeq ($(OS_ARCH),WINNT)
ifneq (,$(CYGDRIVE_MOUNT))
export CYGDRIVE_MOUNT
endif
endif

#
# Localization build automation
#

# Because you might wish to "make locales AB_CD=ab-CD", we don't hardcode
# MOZ_UI_LOCALE directly, but use an intermediate variable that can be
# overridden by the command line. (Besides, AB_CD is prettier).
AB_CD = $(MOZ_UI_LOCALE)

ifndef L10NBASEDIR
L10NBASEDIR = $(error L10NBASEDIR not defined by configure)
endif

EXPAND_LOCALE_SRCDIR = $(if $(filter en-US,$(AB_CD)),$(topsrcdir)/$(1)/en-US,$(L10NBASEDIR)/$(AB_CD)/$(subst /locales,,$(1)))

ifdef relativesrcdir
LOCALE_SRCDIR = $(call EXPAND_LOCALE_SRCDIR,$(relativesrcdir))
endif

ifdef LOCALE_SRCDIR
# if LOCALE_MERGEDIR is set, use mergedir first, then the localization,
# and finally en-US
ifdef LOCALE_MERGEDIR
MAKE_JARS_FLAGS += -c $(LOCALE_MERGEDIR)/$(subst /locales,,$(relativesrcdir))
endif
MAKE_JARS_FLAGS += -c $(LOCALE_SRCDIR)
ifdef LOCALE_MERGEDIR
MAKE_JARS_FLAGS += -c $(topsrcdir)/$(relativesrcdir)/en-US
endif
endif

ifeq (,$(filter WINCE WINNT OS2,$(OS_ARCH)))
RUN_TEST_PROGRAM = $(DIST)/bin/run-mozilla.sh
endif

#
# Java macros
#

# Make sure any compiled classes work with at least JVM 1.4
JAVAC_FLAGS += -source 1.4

ifdef MOZ_DEBUG
JAVAC_FLAGS += -g
endif
