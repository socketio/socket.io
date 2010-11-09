#!/bin/sh
#    fatal.sh - test various fatal errors
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

trap 'rm -fr DIR DIR2 OUT ERR' 1 2 3 15

export PATH=.:..:$PATH

rm -fr DIR DIR2

$VALGRIND jscoverage javascript-xml DIR > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr javascript-xml.expected.err ERR

rm -fr DIR

$VALGRIND jscoverage javascript-invalid DIR > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr javascript-invalid.expected.err ERR

rm -fr DIR

$VALGRIND jscoverage javascript-setter DIR > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr javascript-setter.expected.err ERR

rm -fr DIR

$VALGRIND jscoverage 1 2 3 > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr too-many-arguments.expected.err ERR

rm -fr DIR

$VALGRIND jscoverage --no-instrument > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr no-instrument-requires-argument.expected.err ERR

$VALGRIND jscoverage --exclude > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr exclude-requires-argument.expected.err ERR

$VALGRIND jscoverage --encoding > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
diff --strip-trailing-cr encoding-requires-argument.expected.err ERR

# first arg does not exist
rm -f foo
$VALGRIND jscoverage foo bar > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
# diff --strip-trailing-cr source-does-not-exist.expected.err ERR

# first arg is file
touch foo
$VALGRIND jscoverage foo bar > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
# diff --strip-trailing-cr source-is-file.expected.err ERR
rm foo

# second arg is file
rm -fr bar
touch bar
$VALGRIND jscoverage javascript bar > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
# diff --strip-trailing-cr destination-is-file.expected.err ERR
rm bar

# second arg is directory, but not from previous run
rm -fr bar
mkdir bar
touch bar/foo
$VALGRIND jscoverage javascript bar > OUT 2> ERR && exit 1
test ! -s OUT
test -s ERR
# diff --strip-trailing-cr destination-is-existing-directory.expected.err ERR
rm -fr bar

# huge JavaScript file
mkdir -p DIR
perl -e 'for (1 .. 65536) {print "x = $_\n";}' > DIR/big.js
$VALGRIND jscoverage DIR DIR2 > OUT 2> ERR && exit 1
echo 'jscoverage: file big.js contains more than 65,535 lines' | diff --strip-trailing-cr - ERR

rm -fr DIR DIR2 OUT ERR
