#!/usr/bin/perl -w
# -*- Mode: perl; tab-width: 4; indent-tabs-mode: nil; -*-
#
# Preprocessor
# Version 1.1
#
# Copyright (c) 2002, 2003, 2004 by Ian Hickson
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA

# Thanks to bryner and bsmedberg for suggestions.
# Thanks to jon rekai for a patch to not require File::Spec 0.8.

use strict;

# takes as arguments the files to process
# defaults to stdin
# output to stdout

my $stack = new stack;
my $marker = '#';

# command line arguments
my @includes;
while ($_ = $ARGV[0], defined($_) && /^-./) {
    shift;
    last if /^--$/os;
    if (/^-D(.*)$/os) { 
        for ($1) {
            if (/^([\w\.]+)=(.*)$/os) {
                $stack->define($1, $2);
            } elsif (/^([\w\.]+)$/os) {
                $stack->define($1, 1);
            } else {
                die "$0: invalid argument to -D: $_\n";
            }
        }
    } elsif (/^-F(.*)$/os) { 
        for ($1) {
            if (/^(\w+)$/os) {
                $stack->filter($1, 1);
            } else {
                die "$0: invalid argument to -F: $_\n";
            }
        }
    } elsif (/^-I(.*)$/os) { 
        push(@includes, $1);
    } elsif (/^-E$/os) { 
        foreach (keys %ENV) {
            # define all variables that have valid names
            $stack->define($_, $ENV{$_}) unless m/\W/;
        }
    } elsif (/^-d$/os) { 
        $stack->{'dependencies'} = 1;
    } elsif (/^--line-endings=crlf$/os) { 
        $stack->{'lineEndings'} = "\x0D\x0A";
    } elsif (/^--line-endings=cr$/os) { 
        $stack->{'lineEndings'} = "\x0D";
    } elsif (/^--line-endings=lf$/os) { 
        $stack->{'lineEndings'} = "\x0A";
    } elsif (/^--line-endings=(.+)$/os) { 
        die "$0: unrecognised line ending: $1\n";
    } elsif (/^--marker=(.)$/os) {
        $marker = $1;
    } else {
        die "$0: invalid argument: $_\n";
    }
}
unshift(@ARGV, '-') unless @ARGV;
unshift(@ARGV, @includes);

# do the work
foreach (@ARGV) { include($stack, $_); }
exit(0);

########################################################################

package main;
use File::Spec;
use File::Spec::Unix; # on all platforms, because the #include syntax is unix-based

# Note: Ideally we would use File::Spec 0.8. When this becomes
# possible, add "0.8" to the first "use" line above, then replace
# occurrences of "::_0_8::" with "->" below. And remove the code for
# File::Spec 0.8 much lower down the file.

sub include {
    my($stack, $filename) = @_;
    my $directory = $stack->{'variables'}->{'DIRECTORY'};
    if ($filename ne '-') {
        $filename = File::Spec::_0_8::rel2abs($filename, $directory);
        # splitpath expects forward-slash paths on windows, so we have to
        # change the slashes if using Activestate Perl.
        $filename =~ s?\\?/?g if "$^O" eq "MSWin32";
        my($volume, $path) = File::Spec::_0_8::splitpath($filename);
        $directory = File::Spec::_0_8::catpath($volume, $path, '');
    }
    local $stack->{'variables'}->{'DIRECTORY'} = $directory;
    local $stack->{'variables'}->{'FILE'} = $filename;
    local $stack->{'variables'}->{'LINE'} = 0;
    local *FILE;
    open(FILE, $filename) or die "Couldn't open $filename: $!\n";
    my $lineout = 0;
    while (<FILE>) {
        # on cygwin, line endings are screwed up, so normalise them.
        s/[\x0D\x0A]+$/\n/os if ($^O eq 'msys' || $^O eq 'cygwin' || "$^O" eq "MSWin32");
        $stack->newline;
        if (/^\Q$marker\E([a-z]+)\n?$/os) { # argumentless processing instruction
            process($stack, $1);
        } elsif (/^\Q$marker\E([a-z]+)\s(.*?)\n?$/os) { # processing instruction with arguments
            process($stack, $1, $2);
        } elsif (/^\Q$marker\E/os) { # comment
            # ignore it
        } elsif ($stack->enabled) {
            next if $stack->{'dependencies'};

            # set the current line number in JavaScript if necessary
            my $linein = $stack->{'variables'}->{'LINE'};
            if (++$lineout != $linein) {
                if ($filename =~ /\.js(|\.in)$/o) {
                    $stack->print("//\@line $linein \"$filename\"\n")
                }
                $lineout = $linein;
            }

            # print it, including any newlines
            $stack->print(filtered($stack, $_));
        }
    }
    close(FILE);
}

sub process {
    my($stack, $instruction, @arguments) = @_;
    my $method = 'preprocessor'->can($instruction);
    if (not defined($method)) {
        fatal($stack, 'unknown instruction', $instruction);
    }
    eval { &$method($stack, @arguments) };
    if ($@) {
        fatal($stack, "error evaluating $instruction:", $@);
    }
}

sub filtered {
    my($stack, $text) = @_;
    foreach my $filter (sort keys %{$stack->{'filters'}}) {
        next unless $stack->{'filters'}->{$filter};
        my $method = 'filter'->can($filter);
        if (not defined($method)) {
            fatal($stack, 'unknown filter', $filter);
        }
        $text = eval { &$method($stack, $text) };
        if ($@) {
            fatal($stack, "error using $filter:", $@);
        }                
    }
    return $text;
}

sub fatal {
    my $stack = shift;
    my $filename = $stack->{'variables'}->{'FILE'};
    local $" = ' ';
    print STDERR "$0:$filename:$.: @_\n";
    exit(1);
}


########################################################################

package stack;

# condition evaluated just prior to this context was false
use constant COND_FALSE => 0;

# condition evaluated just prior to this context was true
use constant COND_TRUE => 1;

# some prior condition at this level already evaluated to true (or a
# parent condition evaluated to false or must be ignored), so we're
# ignoring all remaining conditions at current level (and nested
# conditions, too)
use constant COND_COMPLETED => 2;

sub new {
    return bless {
        'variables' => {
            # %ENV,
            'LINE' => 0, # the line number in the source file
            'DIRECTORY' => '', # current directory
            'FILE' => '', # source filename
            '1' => 1, # for convenience (the constant '1' is thus true)
        },
        'filters' => {
            # filters
        },
        'values' => [], # the value of the last condition evaluated at the nth level
        'lastConditionState' => [], # whether the condition in the nth-level context was true, false, or not applicable
        'conditionState' => COND_TRUE,
        'dependencies' => 0, # whether we are showing dependencies
        'lineEndings' => "\n", # default to platform conventions
    };
}

sub newline {
    my $self = shift;
    $self->{'variables'}->{'LINE'}++;
}

sub define {
    my $self = shift;
    my($variable, $value) = @_;
    die "not a valid variable name: '$variable'\n" if $variable =~ m/[^\w\.]/;
    $self->{'variables'}->{$variable} = $value;
}

sub defined {
    my $self = shift;
    my($variable) = @_;
    die "not a valid variable name: '$variable'\n" if $variable =~ m/[^\w\.]/;
    return defined($self->{'variables'}->{$variable});
}

sub undefine {
    my $self = shift;
    my($variable) = @_;
    die "not a valid variable name: '$variable'\n" if $variable =~ m/[^\w\.]/;
    delete($self->{'variables'}->{$variable});
}

sub get {
    my $self = shift;
    my($variable, $required) = @_;
    die "not a valid variable name: '$variable'\n" if $variable =~ m/[^\w\.]/;
    my $value = $self->{'variables'}->{$variable};
    if (defined($value)) {
        return $value;
    } else {
        die "variable '$variable' is not defined\n" if $required;
        return '';
    }
}

sub replace {
    my $self = shift;
    my ($value) = @_;

    ${$self->{'values'}}[-1] = $value;
    $self->{'conditionState'} = $self->{'conditionState'} != COND_FALSE
                              ? COND_COMPLETED
                              : $value ? COND_TRUE : COND_FALSE;
}

sub push {
    my $self = shift;
    my($value) = @_;

    push(@{$self->{'values'}}, $value);
    my $lastCondition = $self->{'conditionState'};
    push(@{$self->{'lastConditionState'}}, $lastCondition);
    $self->{'conditionState'} = $lastCondition != COND_TRUE
                              ? COND_COMPLETED
                              : $value ? COND_TRUE : COND_FALSE;
}

sub pop {
    my $self = shift;
    $self->{'conditionState'} = pop(@{$self->{'lastConditionState'}});
    return pop(@{$self->{'values'}});
}

sub enabled {
    my $self = shift;
    return $self->{'conditionState'} == COND_TRUE;
}

sub disabled {
    my $self = shift;
    return $self->{'conditionState'} != COND_TRUE;
}

sub filter {
    my $self = shift;
    my($filter, $value) = @_;
    die "not a valid filter name: '$filter'\n" if $filter =~ m/\W/;
    $self->{'filters'}->{$filter} = $value;
}

sub expand {
    my $self = shift;
    my($line) = @_;
    $line =~ s/__(\w+)__/$self->get($1)/gose;
    return $line;
}

sub print {
    my $self = shift;
    return if $self->{'dependencies'};
    foreach my $line (@_) {
        if (chomp $line) {
            CORE::print("$line$self->{'lineEndings'}");
        } else {
            CORE::print($line);
        }
    }
}

sub visit {
    my $self = shift;
    my($filename) = @_;
    my $directory = $stack->{'variables'}->{'DIRECTORY'};
    $filename = File::Spec::_0_8::abs2rel(File::Spec::_0_8::rel2abs($filename, $directory));
    CORE::print("$filename\n");
}

########################################################################

package preprocessor;

sub define {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    my $argument = shift;
    for ($argument) {
        /^(\w+)\s(.*)$/os && do {
            return $stack->define($1, $2);
        };
        /^(\w+)$/os && do {
            return $stack->define($1, 1);
        };
        die "invalid argument: '$_'\n";
    }
}

sub undef {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    $stack->undefine(@_);
}

sub ifdef {
    my $stack = shift;
    my $variable = shift;
    my $replace = defined(shift);
    die "argument expected\n" unless defined($variable);
    if ($replace) {
        $stack->replace($stack->defined($variable));
    } else {
        $stack->push($stack->defined($variable));
    }
}

sub ifndef {
    my $stack = shift;
    my $variable = shift;
    my $replace = defined(shift);
    die "argument expected\n" unless defined($variable);
    if ($replace) {
        $stack->replace(not $stack->defined($variable));
    } else {
        $stack->push(not $stack->defined($variable));
    }
}

sub if {
    my $stack = shift;
    die "argument expected\n" unless @_;
    my $argument = shift;
    my $replace = defined(shift);
    for ($argument) {
        /^(\w+)==(.*)$/os && do {
            # equality
            if ($replace) {
                return $stack->replace($stack->get($1) eq $2);
            } else {
                return $stack->push($stack->get($1) eq $2);
            }
        };
        /^(\w+)!=(.*)$/os && do {
            # inequality
            if ($replace) {
                return $stack->replace($stack->get($1) ne $2);
            } else {
                return $stack->push($stack->get($1) ne $2);
            }
        };
        /^(\w+)$/os && do {
            # true value
            if ($replace) {
                return $stack->replace($stack->get($1));
            } else {
                return $stack->push($stack->get($1));
            }
        };
        /^!(\w+)$/os && do {
            # false value
            if ($replace) {
                return $stack->replace(not $stack->get($1));
            } else {
                return $stack->push(not $stack->get($1));
            }
        };
        die "invalid argument: '$_'\n";
    }
}

sub else {
    my $stack = shift;
    die "argument unexpected\n" if @_;
    $stack->replace(1);
}

sub elif {
    my $stack = shift;
    die "argument expected\n" unless @_;
    &if($stack, @_, 1);
}

sub elifdef {
    my $stack = shift;
    die "argument expected\n" unless @_;
    &ifdef($stack, @_, 1);
}

sub elifndef {
    my $stack = shift;
    die "argument expected\n" unless @_;
    &ifndef($stack, @_, 1);
}

sub endif {
    my $stack = shift;
    die "argument unexpected\n" if @_;
    $stack->pop;
}

sub error {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    my $line = $stack->expand(@_);
    die "$line\n";
}

sub expand {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    my $line = $stack->expand(@_);
    $stack->print("$line\n");
}

sub literal {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    my $line = shift;
    $stack->print("$line\n");
}

sub include {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    my $filename = File::Spec::_0_8::catpath(File::Spec::_0_8::splitpath(@_));
    if ($stack->{'dependencies'}) {
        $stack->visit($filename);
    } else {
        main::include($stack, $filename);
    }
}

sub includesubst {
    my ($stack, $filename) = @_;
    return if $stack->disabled;
    die "argument expected\n" unless $filename;
    $filename =~ s/@(\w+)@/$stack->get($1, 1)/gose;
    $filename = File::Spec::_0_8::catpath(File::Spec::_0_8::splitpath($filename));
    if ($stack->{'dependencies'}) {
        $stack->visit($filename);
    } else {
        main::include($stack, $filename);
    }
}

sub filter {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    foreach (split(/\s/os, shift)) {
        $stack->filter($_, 1);
    }
}

sub unfilter {
    my $stack = shift;
    return if $stack->disabled;
    die "argument expected\n" unless @_;
    foreach (split(/\s/os, shift)) {
        $stack->filter($_, 0);
    }
}


########################################################################

package filter;

sub emptyLines {
    my($stack, $text) = @_;
    $text = "" if $text eq "\n";
    return $text;
}

sub spaces {
    my($stack, $text) = @_;
    $text =~ s/ +/ /gos; # middle spaces
    $text =~ s/^ //gos; # start spaces
    $text =~ s/ (\n?)$/$1/gos; # end spaces
    return $text;
}

sub slashslash {
    my($stack, $text) = @_;
    $text =~ s|//.*?(\n?)$|$1|gos;
    return $text;
}

sub substitution {
    my($stack, $text) = @_;
    $text =~ s/@(\w+)@/$stack->get($1, 1)/gose;
    return $text;
}

sub attemptSubstitution {
    my($stack, $text) = @_;
    $text =~ s/@(\w+)@/$stack->get($1, 0)/gose;
    return $text;
}

########################################################################

########################################################################
# This code is from File::Spec::Unix 0.8.
# It is not considered a part of the preprocessor.pl source file
# This code is licensed under the same license as File::Spec itself.

package File::Spec::_0_8;

use Cwd;

sub rel2abs {
    my ($path, $base) = @_;
    if ( ! File::Spec->file_name_is_absolute( $path ) ) {
        if ( !defined( $base ) || $base eq '' ) {
            $base = cwd() ;
        } elsif ( ! File::Spec->file_name_is_absolute( $base ) ) {
            $base = rel2abs( $base );
        } else {
            $base = File::Spec->canonpath( $base );
        }
        $path = File::Spec->catdir( $base, $path );
    }
    return File::Spec->canonpath( $path );
}

sub splitdir {
    return split m|/|, $_[1], -1;  # Preserve trailing fields
}

sub splitpath {
    my ($path, $nofile) = @_;

    my ($volume,$directory,$file) = ('','','');

    if ( $nofile ) {
        $directory = $path;
    }
    else {
        $path =~ m|^ ( (?: .* / (?: \.\.?\Z(?!\n) )? )? ) ([^/]*) |xs;
        $directory = $1;
        $file      = $2;
    }

    return ($volume,$directory,$file);
}

sub catpath {
    my ($volume,$directory,$file) = @_;

    if ( $directory ne ''                && 
         $file ne ''                     && 
         substr( $directory, -1 ) ne '/' && 
         substr( $file, 0, 1 ) ne '/' 
    ) {
        $directory .= "/$file" ;
    }
    else {
        $directory .= $file ;
    }

    return $directory ;
}

sub abs2rel {
    my($path,$base) = @_;

    # Clean up $path
    if ( ! File::Spec->file_name_is_absolute( $path ) ) {
        $path = rel2abs( $path ) ;
    }
    else {
        $path = File::Spec->canonpath( $path ) ;
    }

    # Figure out the effective $base and clean it up.
    if ( !defined( $base ) || $base eq '' ) {
        $base = cwd();
    }
    elsif ( ! File::Spec->file_name_is_absolute( $base ) ) {
        $base = rel2abs( $base ) ;
    }
    else {
        $base = File::Spec->canonpath( $base ) ;
    }

    # Now, remove all leading components that are the same
    my @pathchunks = File::Spec::_0_8::splitdir( $path);
    my @basechunks = File::Spec::_0_8::splitdir( $base);

    while (@pathchunks && @basechunks && $pathchunks[0] eq $basechunks[0]) {
        shift @pathchunks ;
        shift @basechunks ;
    }

    $path = CORE::join( '/', @pathchunks );
    $base = CORE::join( '/', @basechunks );

    # $base now contains the directories the resulting relative path 
    # must ascend out of before it can descend to $path_directory.  So, 
    # replace all names with $parentDir
    $base =~ s|[^/]+|..|g ;

    # Glue the two together, using a separator if necessary, and preventing an
    # empty result.
    if ( $path ne '' && $base ne '' ) {
        $path = "$base/$path" ;
    } else {
        $path = "$base$path" ;
    }

    return File::Spec->canonpath( $path ) ;
}

# End code from File::Spec::Unix 0.8.
########################################################################
