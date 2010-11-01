#!/usr/bin/perl -w
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

use Getopt::Long;

use strict;
use vars qw(
            $OBJDIR
            $SRCDIR
            $TOPSRCDIR
            $SCRIPTDIR
            @TEMPLATE_FILE
            $MILESTONE_FILE
            $MILESTONE
            $MILESTONE_NUM
            @MILESTONE_PARTS
            $MINI_VERSION
            $MICRO_VERSION
            $opt_debug
            $opt_template
            $opt_help
            );

$SCRIPTDIR = $0;
$SCRIPTDIR =~ s/[^\/]*$//;
push(@INC,$SCRIPTDIR);

require "Moz/Milestone.pm";

&GetOptions('topsrcdir=s' => \$TOPSRCDIR, 'srcdir=s' => \$SRCDIR, 'objdir=s' => \$OBJDIR, 'debug', 'help', 'template');

if (defined($opt_help)) {
    &usage();
    exit;
}

if (defined($opt_template)) {
    @TEMPLATE_FILE = @ARGV;
    if ($opt_debug) {
        print("TEMPLATE_FILE = --@TEMPLATE_FILE--\n");
    }
}

if (!defined($SRCDIR)) { $SRCDIR = '.'; }
if (!defined($OBJDIR)) { $OBJDIR = '.'; }

$MILESTONE_FILE  = "$TOPSRCDIR/config/milestone.txt";
@MILESTONE_PARTS = (0, 0, 0, 0);

#
# Grab milestone (top line of $MILESTONE_FILE that starts with a digit)
#
my $milestone = Moz::Milestone::getOfficialMilestone($MILESTONE_FILE);

if (defined(@TEMPLATE_FILE)) {
  my $TFILE;

  foreach $TFILE (@TEMPLATE_FILE) {
    my $BUILT_FILE = "$OBJDIR/$TFILE";
    $TFILE = "$SRCDIR/$TFILE.tmpl";

    if (-e $TFILE) {

      Moz::Milestone::build_file($TFILE,$BUILT_FILE);

    } else {
      warn("$0:  No such file $TFILE!\n");
    }
  }
} else {
  print "$milestone\n";
}

sub usage() {
  print <<END
`milestone.pl [--topsrcdir TOPSRCDIR] [--objdir OBJDIR] [--srcdir SRCDIR] --template [file list]`  # will build file list from .tmpl files
END
    ;
}
