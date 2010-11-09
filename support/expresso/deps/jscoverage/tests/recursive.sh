#!/bin/sh
#    recursive.sh - test recursive directory instrumentation
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

trap 'rm -fr EXPECTED DIR OUT' 1 2 3 15

export PATH=.:..:$PATH

rm -fr DIR
rm -fr EXPECTED
cp -r recursive.expected EXPECTED
find EXPECTED -name .svn | xargs rm -fr
cat recursive.expected/script.js | sed 's/@PREFIX@//g' > EXPECTED/script.js
cat recursive.expected/1/1.js | sed 's/@PREFIX@//g' > EXPECTED/1/1.js
cat recursive.expected/1/2/2.js | sed 's/@PREFIX@//g' > EXPECTED/1/2/2.js
cp ../jscoverage.css ../jscoverage-highlight.css ../jscoverage-ie.css \
   ../jscoverage-throbber.gif \
   ../jscoverage.html \
   ../jscoverage.js EXPECTED

$VALGRIND jscoverage --no-highlight --exclude=.svn --exclude=1/.svn --exclude=1/2/.svn recursive DIR
test -d DIR
diff --strip-trailing-cr -r EXPECTED DIR

$VALGRIND jscoverage --no-highlight --verbose --exclude .svn --exclude 1/.svn --exclude 1/2/.svn recursive DIR >OUT
test -d DIR
sort OUT -o OUT
diff --strip-trailing-cr verbose.expected.out OUT
diff --strip-trailing-cr -r EXPECTED DIR

# does it handle an argument with a slash at the end?
$VALGRIND jscoverage --no-highlight --exclude=.svn --exclude=1/.svn --exclude=1/2/.svn recursive/ DIR
diff --strip-trailing-cr -r EXPECTED DIR
$VALGRIND jscoverage --no-highlight --exclude=.svn --exclude=1/.svn --exclude=1/2/.svn recursive DIR/
diff --strip-trailing-cr -r EXPECTED DIR
$VALGRIND jscoverage --no-highlight --exclude=.svn --exclude=1/.svn --exclude=1/2/.svn recursive/ DIR/
diff --strip-trailing-cr -r EXPECTED DIR

rm -fr EXPECTED DIR OUT
