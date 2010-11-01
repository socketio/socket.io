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
# The Original Code is the Win32 Version System.
#
# The Initial Developer of the Original Code is Netscape Communications Corporation
# Portions created by the Initial Developer are Copyright (C) 2002
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

ifndef INCLUDED_VERSION_MK
INCLUDED_VERSION_MK=1

# Windows gmake build:
# Build default .rc file if $(RESFILE) isn't defined.
# TODO:
# PBI      : Private build info.  Not used currently.
#            Guessing the best way would be to set an env var.
# BINARY   : Binary name.  Not used currently.
ifeq ($(MOZ_WIDGET_TOOLKIT),windows)
ifndef RESFILE
RCFILE=./module.rc
RESFILE=./module.res
_RC_STRING = -QUIET 1 -DEPTH $(DEPTH) -TOPSRCDIR $(topsrcdir) -BITS $(MOZ_BITS) -OBJDIR . -SRCDIR $(srcdir) -DISPNAME $(MOZ_APP_DISPLAYNAME)
ifneq ($(BUILD_OFFICIAL)_$(MOZILLA_OFFICIAL),_)
_RC_STRING += -OFFICIAL 1
endif
ifdef MOZ_DEBUG
_RC_STRING += -DEBUG 1
endif
ifdef MODULE
_RC_STRING += -MODNAME $(MODULE)
endif
ifdef PROGRAM
_RC_STRING += -BINARY $(PROGRAM)
else
ifdef _PROGRAM
_RC_STRING += -BINARY $(_PROGRAM)
else
ifdef SHARED_LIBRARY
_RC_STRING += -BINARY $(SHARED_LIBRARY)
endif
endif
endif
ifdef RCINCLUDE
_RC_STRING += -RCINCLUDE $(srcdir)/$(RCINCLUDE)
endif

GARBAGE += $(RESFILE) $(RCFILE)

#dummy target so $(RCFILE) doesn't become the default =P
all::

$(RCFILE): $(RCINCLUDE) $(topsrcdir)/config/version_win.pl
	$(PERL) $(topsrcdir)/config/version_win.pl $(_RC_STRING)

endif  # RESFILE
endif  # Windows

endif
