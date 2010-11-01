#!/bin/sh
#    help.sh - test `--help' option
#    Copyright (C) 2007, 2008 siliconforks.com
#
#    This program is free software; you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation; either version 2 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License along
#    with this program; if not, write to the Free Software Foundation, Inc.,
#    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

set -e

trap 'rm -fr OUT ERR' 1 2 3 15

export PATH=.:..:$PATH

$VALGRIND jscoverage --help > OUT 2> ERR
test -s OUT
test ! -s ERR
diff --strip-trailing-cr ../jscoverage-help.txt OUT

$VALGRIND jscoverage -h > OUT 2> ERR
test -s OUT
test ! -s ERR
diff --strip-trailing-cr ../jscoverage-help.txt OUT

rm -fr OUT ERR
