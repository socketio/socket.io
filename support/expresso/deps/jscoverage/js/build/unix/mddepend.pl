#!/usr/bin/env perl

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
# The Original Code is this file as it was released upon March 8, 1999.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
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

# mddepend.pl - Reads in dependencies generated my -MD flag. Prints list
#   of objects that need to be rebuilt. These can then be added to the
#   PHONY target. Using this script copes with the problem of header
#   files that have been removed from the build.
#    
# Usage:
#   mddepend.pl <output_file> <dependency_files...>
#
# Send comments, improvements, bugs to Steve Lamm (slamm@netscape.com).

use strict;

use constant DEBUG => 0;

my $outfile = shift @ARGV;
my $silent = $ENV{MAKEFLAGS} =~ /^\w*s|\s-s/;

my $line = '';
my %alldeps;
# Parse dependency files
while (<>) {
  s/\r?\n$//; # Handle both unix and DOS line endings
  $line .= $_;
  if ($line =~ /\\$/) {
    chop $line;
    next;
  }

  my ($obj,$rest) = split /\s*:\s+/, $line, 2;
  $line = '';
  next if !$obj || !$rest;

  my @deps = split /\s+/, $rest;
  push @{$alldeps{$obj}}, @deps;
  if (DEBUG >= 2) {
    foreach my $dep (@deps) { print "add $obj $dep\n"; }
  }
}

# Test dependencies
my %modtimes; # cache
my @objs;     # force rebuild on these
OBJ_LOOP: foreach my $obj (keys %alldeps) {
  my $mtime = (stat $obj)[9] or next;

  my %not_in_cache;
  my $deps = $alldeps{$obj};
  foreach my $dep_file (@{$deps}) {
    my $dep_mtime = $modtimes{$dep_file};
    if (not defined $dep_mtime) {
      print "Skipping $dep_file for $obj, will stat() later\n" if DEBUG >= 2;
      $not_in_cache{$dep_file} = 1;
      next;
    }

    print "Found $dep_file in cache\n" if DEBUG >= 2;

    if ($dep_mtime > $mtime) {
      print "$dep_file($dep_mtime) newer than $obj($mtime)\n" if DEBUG;
    }
    elsif ($dep_mtime == -1) {
      print "Couldn't stat $dep_file for $obj\n" if DEBUG;
    }
    else {
      print "$dep_file($dep_mtime) older than $obj($mtime)\n" if DEBUG >= 2;
      next;
    }

    push @objs, $obj; # dependency is missing or newer
    next OBJ_LOOP; # skip checking the rest of the dependencies
  }

  foreach my $dep_file (keys %not_in_cache) {
    print "STAT $dep_file for $obj\n" if DEBUG >= 2;
    my $dep_mtime = $modtimes{$dep_file} = (stat $dep_file)[9] || -1;

    if ($dep_mtime > $mtime) {
      print "$dep_file($dep_mtime) newer than $obj($mtime)\n" if DEBUG;
    }
    elsif ($dep_mtime == -1) {
      print "Couldn't stat $dep_file for $obj\n" if DEBUG;
    }
    else {
      print "$dep_file($dep_mtime) older than $obj($mtime)\n" if DEBUG >= 2;
      next;
    }

    push @objs, $obj; # dependency is missing or newer
    next OBJ_LOOP; # skip checking the rest of the dependencies
  }

  # If we get here it means nothing needs to be done for $obj
}

# Output objects to rebuild (if needed).
if (@objs) {
  my $old_output;
  my $new_output = "@objs: FORCE\n";

  # Read in the current dependencies file.
  open(OLD, "<$outfile")
    and $old_output = <OLD>;
  close(OLD);

  # Only write out the dependencies if they are different.
  if ($new_output ne $old_output) {
    open(OUT, ">$outfile") and print OUT "$new_output";
    print "Updating dependencies file, $outfile\n" unless $silent;
    if (DEBUG) {
      print "new: $new_output\n";
      print "was: $old_output\n" if $old_output ne '';
    }
  }
} elsif (-s $outfile) {
  # Remove the old dependencies because all objects are up to date.
  print "Removing old dependencies file, $outfile\n" unless $silent;

  if (DEBUG) {
    my $old_output;
    open(OLD, "<$outfile")
      and $old_output = <OLD>;
    close(OLD);
    print "was: $old_output\n";
  }

  unlink $outfile;
}
