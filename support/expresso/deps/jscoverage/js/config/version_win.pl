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
# The Initial Developer of the Original Code is Brian Bober <netdemonz@yahoo.com>
# Portions created by the Initial Developer are Copyright (C) 2001
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

#use diagnostics;
require strict;
my $dir = $0;
$dir =~ s/[^\/]*$//;
push(@INC, "$dir");
require "Moz/Milestone.pm";
use Getopt::Long;
use Getopt::Std;
use POSIX;

# Calculate the number of days since Jan. 1, 2000 from a buildid string
sub daysFromBuildID
{
    my ($buildid,) = @_;

    my ($y, $m, $d, $h) = ($buildid =~ /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    $d || die("Unrecognized buildid string.");

    my $secondstodays = 60 * 60 * 24;
    return (POSIX::mktime(00, 00, 00, $d, $m, $y - 1900) -
            POSIX::mktime(00, 00, 00, 01, 01, 100)) / $secondstodays;
}

#Creates version resource file

#Paramaters are passed on the command line:

#Example: -MODNAME nsToolkitCompsModule -DEBUG=1

# DEBUG - Mozilla's global debug variable - tells if its debug version
# OFFICIAL - tells Mozilla is building a milestone or nightly
# MSTONE - tells which milestone is being built;
# OBJDIR - Holds the object directory;
# MODNAME - tells what the name of the module is like nsBMPModule
# DEPTH - Holds the path to the root obj dir
# TOPSRCDIR - Holds the path to the root mozilla dir
# SRCDIR - Holds module.ver and source
# BINARY - Holds the name of the binary file
# DISPNAME - Holds the display name of the built application
# BITS - 16 or 32 bit
# RCINCLUDE - Holds the name of the RC File to include or ""
# QUIET - Turns off output

#Description and Comment come from module.ver
#Bug 23560
#http://msdn.microsoft.com/library/default.asp?url=/library/en-us/winui/rc_7x2d.asp

#Get next .ver file entry
sub getNextEntry
{
	while (<VERFILE>) 
	{ 
		my $mline = $_;
		($mline) = split(/#/,$mline);
		my ($entry, $value)=split(/=/,$mline,2);
		if (defined($entry))
		{
			if (defined($value))
			{
				$entry =~ s/^\s*(.*?)\s*$/$1/;
				$value =~ s/^\s*(.*?)\s*$/$1/;
				return ($entry,$value);
			}
		}
	}
	return undef;
}

my ($quiet,$objdir,$debug,$official,$milestone,$buildid,$module,$binary,$depth,$rcinclude,$bits,$srcdir,$fileversion,$productversion);

GetOptions( "QUIET" => \$quiet,
		"DEBUG=s" => \$debug,
		"OFFICIAL=s" => \$official,
		"MSTONE=s" => \$milestone,
		"MODNAME=s" => \$module,
		"BINARY=s" => \$binary,
		"DISPNAME=s" => \$displayname,
		"SRCDIR=s" => \$srcdir,
		"TOPSRCDIR=s" => \$topsrcdir,
		"DEPTH=s" => \$depth,
		"RCINCLUDE=s" => \$rcinclude,
		"OBJDIR=s" => \$objdir,
		"BITS=s" => \$bits);
if (!defined($debug)) {$debug="";}
if (!defined($official)) {$official="";}
if (!defined($milestone)) {$milestone="";}
if (!defined($module)) {$module="";}
if (!defined($binary)) {$binary="";}
if (!defined($displayname)) {$displayname="Mozilla";}
if (!defined($depth)) {$depth=".";}
if (!defined($rcinclude)) {$rcinclude="";}
if (!defined($objdir)) {$objdir=".";}
if (!defined($srcdir)) {$srcdir=".";}
if (!defined($topsrcdir)) {$topsrcdir=".";}
if (!defined($bits)) {$bits="";}
my $mfversion = "Personal";
my $mpversion = "Personal";
my @fileflags = ("0");
my $comment="";
my $description="";
if (!defined($module))
{
	$module = $binary;
	($module) = split(/\./,$module);
}

my $fileos = "VOS__WINDOWS32";
if ($bits eq "16") { $fileos="VOS__WINDOWS16"; }

my $bufferstr="    ";

my $MILESTONE_FILE = "$topsrcdir/config/milestone.txt";
my $BUILDID_FILE = "$depth/config/buildid";

#Read module.ver file
#Version file overrides for WIN32:
#WIN32_MODULE_COMMENT
#WIN32_MODULE_DESCRIPTION
#WIN32_MODULE_FILEVERSION
#WIN32_MODULE_COMPANYNAME
#WIN32_MODULE_FILEVERSION_STRING
#WIN32_MODULE_NAME
#WIN32_MODULE_COPYRIGHT
#WIN32_MODULE_TRADEMARKS
#WIN32_MODULE_ORIGINAL_FILENAME
#WIN32_MODULE_PRODUCTNAME
#WIN32_MODULE_PRODUCTVERSION
#WIN32_MODULE_PRODUCTVERSION_STRING

#Override values obtained from the .ver file
my $override_comment;
my $override_description;
my $override_fileversion;
my $override_company;
my $override_mfversion;
my $override_module;
my $override_copyright;
my $override_trademarks;
my $override_filename;
my $override_productname;
my $override_productversion;
my $override_mpversion;
if (open(VERFILE, "<$srcdir/module.ver")) 
{

	my ($a,$b) = getNextEntry();
	while (defined($a))
	{
		if ($a eq "WIN32_MODULE_COMMENT") { $override_comment = $b; }
		if ($a eq "WIN32_MODULE_DESCRIPTION") { $override_description = $b; }
		if ($a eq "WIN32_MODULE_FILEVERSION") { $override_fileversion = $b; }
		if ($a eq "WIN32_MODULE_COMPANYNAME") { $override_company = $b; }
		if ($a eq "WIN32_MODULE_FILEVERSION_STRING") { $override_mfversion = $b; }
		if ($a eq "WIN32_MODULE_NAME") { $override_module = $b; }
		if ($a eq "WIN32_MODULE_COPYRIGHT") { $override_copyright = $b; }
		if ($a eq "WIN32_MODULE_TRADEMARKS") { $override_trademarks = $b; }
		if ($a eq "WIN32_MODULE_ORIGINAL_FILENAME") { $override_filename = $b; }
		if ($a eq "WIN32_MODULE_PRODUCTNAME") { $override_productname = $b; }
		if ($a eq "WIN32_MODULE_PRODUCTVERSION") { $override_productversion = $b; }
		if ($a eq "WIN32_MODULE_PRODUCTVERSION_STRING") { $override_mpversion = $b; }
		($a,$b) = getNextEntry();
	}
	close(VERFILE)
}
else
{
	if (!$quiet || $quiet ne "1") { print "$bufferstr" . "WARNING: No module.ver file included ($module, $binary). Default values used\n"; }
}
#Get rid of trailing and leading whitespace
$debug =~ s/^\s*(.*)\s*$/$1/;
$comment =~ s/^\s*(.*)\s*$/$1/;
$official =~ s/^\s*(.*)\s*$/$1/;
$milestone =~ s/^\s*(.*)\s*$/$1/;
$description =~ s/^\s*(.*)\s*$/$1/;
$module =~ s/^\s*(.*)\s*$/$1/;
$depth =~ s/^\s*(.*)\s*$/$1/;
$binary =~ s/^\s*(.*)\s*$/$1/;
$displayname =~ s/^\s*(.*)\s*$/$1/;

open(BUILDID, "<", $BUILDID_FILE) || die("Couldn't open buildid file: $BUILDID_FILE");
$buildid = <BUILDID>;
$buildid =~ s/\s*$//;
close BUILDID;

my $daycount = daysFromBuildID($buildid);

if ($milestone eq "") {
    $milestone = Moz::Milestone::getOfficialMilestone($MILESTONE_FILE);
}

$mfversion = $mpversion = $milestone;

if ($debug eq "1")
{
	push @fileflags, "VS_FF_DEBUG";
	$mpversion .= " Debug";
	$mfversion .= " Debug";
}

if ($official ne "1") {
    push @fileflags, "VS_FF_PRIVATEBUILD";
}

if ($milestone =~ /[a-z]/) {
    push @fileflags, "VS_FF_PRERELEASE";
}

my @mstone = split(/\./,$milestone);
$mstone[1] =~s/\D.*$//;
if (!$mstone[2]) {
    $mstone[2] = "0";
}
else {
    $mstone[2] =~s/\D.*$//;
}
$fileversion = $productversion="$mstone[0],$mstone[1],$mstone[2],$daycount";

my $copyright = "License: MPL 1.1/GPL 2.0/LGPL 2.1";
my $company = "Mozilla Foundation";
my $trademarks = "Mozilla";
my $productname = $displayname;


if (defined($override_comment)){$override_comment =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $comment=$override_comment;}
if (defined($override_description)){$override_description =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $description=$override_description;}
if (defined($override_fileversion)){$fileversion=$override_fileversion;}
if (defined($override_mfversion)){$mfversion=$override_mfversion;}
if (defined($override_company)){$company=$override_company;}
if (defined($override_module)){$override_module =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $module=$override_module;}
if (defined($override_copyright)){$override_copyright =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $copyright=$override_copyright;}
if (defined($override_trademarks)){$override_trademarks =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $trademarks=$override_trademarks;}
if (defined($override_filename)){$binary=$override_filename;}
if (defined($override_productname)){$override_productname =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g; $productname=$override_productname;}
if (defined($override_productversion)){$productversion=$override_productversion;}
if (defined($override_mpversion)){$mpversion=$override_mpversion;}


#Override section

open(RCFILE, ">$objdir/module.rc") || die("Can't edit module.rc - It must be locked.\n");
print RCFILE qq{
// ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1/GPL 2.0/LGPL 2.1
//
// The contents of this file are subject to the Mozilla Public License Version
// 1.1 (the "License"); you may not use this file except in compliance with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
//
// Software distributed under the License is distributed on an "AS IS" basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
// for the specific language governing rights and limitations under the
// License.
//
// The Original Code is the Win32 Version System.
//
// The Initial Developer of the Original Code is Brian Bober <netdemonz\@yahoo.com>
// Portions created by the Initial Developer are Copyright (C) 2001
// the Initial Developer. All Rights Reserved.
//
// Contributor(s):
//
// Alternatively, the contents of this file may be used under the terms of
// either the GNU General Public License Version 2 or later (the "GPL"), or
// the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
// in which case the provisions of the GPL or the LGPL are applicable instead
// of those above. If you wish to allow use of your version of this file only
// under the terms of either the GPL or the LGPL, and not to allow others to
// use your version of this file under the terms of the MPL, indicate your
// decision by deleting the provisions above and replace them with the notice
// and other provisions required by the GPL or the LGPL. If you do not delete
// the provisions above, a recipient may use your version of this file under
// the terms of any one of the MPL, the GPL or the LGPL.
//
// ***** END LICENSE BLOCK *****

#include<winver.h>

// Note: if you contain versioning information in an included 
// RC script, it will be discarded
// Use module.ver to explicitly set these values

// Do not edit this file. Changes won't affect the build.

};

my $versionlevel=0;
my $insideversion=0;
if (open(RCINCLUDE, "<$rcinclude")) 
{
	print RCFILE "// From included resource $rcinclude\n";
#	my $mstring="";
	while (<RCINCLUDE>) 
	{
		$_ =~ s/\@MOZ_APP_DISPLAYNAME\@/$displayname/g;
		print RCFILE $_;
#		my $instr=$_;
#		chomp($instr);
#		$mstring .= "$instr\;";
	}
	close(RCINCLUDE);
#	$mstring =~ s/\/\*.*\*\///g;
#	my @mlines = split(/\;/,$mstring);
#	for(@mlines)
#	{
#		my ($nocomment)=split(/\/\//,$_);
#		if (defined($nocomment) && $nocomment ne "")
#		{
#			my ($firststring,$secondstring) = split(/\s+/,$nocomment);
#			if (!defined($firststring)) {$firststring="";}
#			if (!defined($secondstring)) {$secondstring="";}
#			if ($secondstring eq "VERSIONINFO") 
#			{
#if (!$quiet || $quiet ne "1") { 
#				print "$bufferstr" . "WARNING: Included RC file ($rcinclude, $module, $binary)\n";
#				print "$bufferstr" . "WARNING: contains versioning information that will be discarded\n";
#				print "$bufferstr" . "WARNING: Remove it and use relevant overrides (in module.ver)\n";
#}
#				$versionlevel = 0;
#				$insideversion = 1; 
#			}
#			if ($firststring eq "BEGIN") { $versionlevel++; }
#			if ($secondstring eq "END") 
#			{ 
#				$versionlevel--; 
#				if ($insideversion==1 && $versionlevel==0) {$versionlevel=0;}
#			}
#			my $includecheck = $firststring . $secondstring;
#			$includecheck =~ s/<|>/"/g;
#			$includecheck = lc($includecheck);
#			if ($includecheck ne "#include\"winver.h\"")
#			{
#				if ($insideversion == 0 && $versionlevel == 0)
#				{
#					print RCFILE "$nocomment\n";	
#				}
#			}
#		}
#	}
	
}

my $fileflags = join(' | ', @fileflags);

print RCFILE qq{


/////////////////////////////////////////////////////////////////////////////
//
// Version
//

1 VERSIONINFO
 FILEVERSION    $fileversion
 PRODUCTVERSION $productversion
 FILEFLAGSMASK 0x3fL
 FILEFLAGS $fileflags
 FILEOS $fileos
 FILETYPE VFT_DLL
 FILESUBTYPE 0x0L
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "000004b0"
        BEGIN
            VALUE "Comments", "$comment"
            VALUE "LegalCopyright", "$copyright"
            VALUE "CompanyName", "$company"
            VALUE "FileDescription", "$description"
            VALUE "FileVersion", "$mfversion"
            VALUE "ProductVersion", "$mpversion"
            VALUE "InternalName", "$module"
            VALUE "LegalTrademarks", "$trademarks"
            VALUE "OriginalFilename", "$binary"
            VALUE "ProductName", "$productname"
            VALUE "BuildID", "$buildid"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x0, 1200
    END
END

};
close(RCFILE);
