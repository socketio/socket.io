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

package Moz::Milestone;
use strict;

use vars qw($officialMilestone
            $milestone);

local $Moz::Milestone::milestone;
local $Moz::Milestone::officialMilestone;

#
# Usage:  getOfficialMilestone($milestoneFile)
# Returns full milestone (x.x.x.x[ab12pre+])
#
sub getOfficialMilestone($) {
  my $mfile = $_[0];
  open(FILE,"$mfile") ||
    die ("Can't open $mfile for reading!");

  my $num = <FILE>;
  while($num =~ /^\s*#/ || $num !~ /^\d/) {
      $num = <FILE>;
  }

  close(FILE);
  if ($num !~ /^\d/) { return; }
  chomp($num);
  # Remove extra ^M caused by using dos-mode line-endings
  chop $num if (substr($num, -1, 1) eq "\r");
  $Moz::Milestone::officialMilestone = $num;
  $Moz::Milestone::milestone = &getMilestoneNum;
  return $num;
}

#
# Usage: getMilestoneNum($num)
# Returns: milestone without a + if it exists.
#
sub getMilestoneNum {
  if (defined($Moz::Milestone::milestone)) {
    return $Moz::Milestone::milestone;
  }

  if (defined($Moz::Milestone::officialMilestone)) {
    $Moz::Milestone::milestone = $Moz::Milestone::officialMilestone;
  } else {
    $Moz::Milestone::milestone = $_[0];
  }

  if ($Moz::Milestone::milestone =~ /\+$/) {    # for x.x.x+, strip off the +
    $Moz::Milestone::milestone =~ s/\+$//;
  }

  return $Moz::Milestone::milestone;
}

#
# Usage: getMilestoneQualifier($num)
# Returns: + if it exists.
#
sub getMilestoneQualifier {
  my $milestoneQualifier;
  if (defined($Moz::Milestone::officialMilestone)) {
    $milestoneQualifier = $Moz::Milestone::officialMilestone;
  } else {
    $milestoneQualifier = $_[0];
  }

  if ($milestoneQualifier =~ /\+$/) {
    return "+";
  }
}

sub getMilestoneMajor {
  my $milestoneMajor;
  if (defined($Moz::Milestone::milestone)) {
    $milestoneMajor = $Moz::Milestone::milestone;
  } else {
    $milestoneMajor = $_[0];
  }
  my @parts = split(/\./,$milestoneMajor);
  return $parts[0];
}

sub getMilestoneMinor {
  my $milestoneMinor;
  if (defined($Moz::Milestone::milestone)) {
    $milestoneMinor = $Moz::Milestone::milestone;
  } else {
    $milestoneMinor = $_[0];
  }
  my @parts = split(/\./,$milestoneMinor);

  if ($#parts < 1 ) { return 0; }
  return $parts[1];
}

sub getMilestoneMini {
  my $milestoneMini;
  if (defined($Moz::Milestone::milestone)) {
    $milestoneMini = $Moz::Milestone::milestone;
  } else {
    $milestoneMini = $_[0];
  }
  my @parts = split(/\./,$milestoneMini);

  if ($#parts < 2 ) { return 0; }
  return $parts[2];
}

sub getMilestoneMicro {
  my $milestoneMicro;
  if (defined($Moz::Milestone::milestone)) {
    $milestoneMicro = $Moz::Milestone::milestone;
  } else {
    $milestoneMicro = $_[0];
  }
  my @parts = split(/\./,$milestoneMicro);

  if ($#parts < 3 ) { return 0; }
  return $parts[3];
}

sub getMilestoneAB {
  my $milestoneAB;
  if (defined($Moz::Milestone::milestone)) {
    $milestoneAB = $Moz::Milestone::milestone;
  } else {
    $milestoneAB = $_[0];
  }
  
  if ($milestoneAB =~ /a/) { return "alpha"; }
  if ($milestoneAB =~ /b/) { return "beta"; }
  return "final";
}

#
# build_file($template_file,$output_file)
#
sub build_file($$) {
  my @FILE;
  my @MILESTONE_PARTS;
  my $MINI_VERSION = 0;
  my $MICRO_VERSION = 0;
  my $OFFICIAL = 0;
  my $QUALIFIER = "";

  if (!defined($Moz::Milestone::milestone)) { die("$0: no milestone file set!\n"); }
  @MILESTONE_PARTS = split(/\./, &getMilestoneNum);
  if ($#MILESTONE_PARTS >= 2) {
    $MINI_VERSION = 1;
  } else {
    $MILESTONE_PARTS[2] = 0;
  }
  if ($#MILESTONE_PARTS >= 3) {
    $MICRO_VERSION = 1;
  } else {
    $MILESTONE_PARTS[3] = 0;
  }
  if (! &getMilestoneQualifier) {
    $OFFICIAL = 1;
  } else {
    $QUALIFIER = "+";
  }

  if (-e $_[0]) {
    open(FILE, "$_[0]") || die("$0: Can't open $_[0] for reading!\n");
    @FILE = <FILE>;
    close(FILE);

    open(FILE, ">$_[1]") || die("$0: Can't open $_[1] for writing!\n");

    #
    # There will be more of these based on what we need for files.
    #
    foreach(@FILE) {
      s/__MOZ_MAJOR_VERSION__/$MILESTONE_PARTS[0]/g;
      s/__MOZ_MINOR_VERSION__/$MILESTONE_PARTS[1]/g;
      s/__MOZ_MINI_VERSION__/$MILESTONE_PARTS[2]/g;
      s/__MOZ_MICRO_VERSION__/$MILESTONE_PARTS[3]/g;
      if ($MINI_VERSION) {
        s/__MOZ_OPTIONAL_MINI_VERSION__/.$MILESTONE_PARTS[2]/g;
      }
      if ($MICRO_VERSION) {
        s/__MOZ_OPTIONAL_MICRO_VERSION__/.$MILESTONE_PARTS[3]/g;
      }

      print FILE $_;
    }
    close(FILE);
  } else {
    die("$0: $_[0] doesn't exist for autoversioning!\n");
  }

}

1;
