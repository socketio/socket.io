#!/bin/sh
#    recursive-crlf.sh - test recursive directory instrumentation, CRLF line endings
#    Copyright (C) 2008 siliconforks.com
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

trap 'rm -fr TMP EXPECTED DIR OUT' 0 1 2 3 15

export PATH=.:..:$PATH

rm -fr TMP EXPECTED DIR OUT

mkdir -p TMP/1/2
cd recursive
cp *.html *.js *.css *.png *.txt x ../TMP
cp 1/1.html 1/1.js 1/1.css ../TMP/1
cp 1/2/2.html 1/2/2.js 1/2/2.css ../TMP/1/2
cd ..
unix2dos TMP/script.js > /dev/null 2> /dev/null
unix2dos TMP/1/1.js > /dev/null 2> /dev/null
unix2dos TMP/1/2/2.js > /dev/null 2> /dev/null

mkdir -p EXPECTED/1/2
cd recursive.expected
cp *.html *.js *.css *.png *.txt x ../EXPECTED
cp 1/1.html 1/1.js 1/1.css ../EXPECTED/1
cp 1/2/2.html 1/2/2.js 1/2/2.css ../EXPECTED/1/2
cd ..
cat recursive.expected/script.js | sed 's/@PREFIX@//g' > EXPECTED/script.js
cat recursive.expected/1/1.js | sed 's/@PREFIX@//g' > EXPECTED/1/1.js
cat recursive.expected/1/2/2.js | sed 's/@PREFIX@//g' > EXPECTED/1/2/2.js
cp ../jscoverage.css ../jscoverage-highlight.css ../jscoverage-ie.css \
   ../jscoverage-throbber.gif \
   ../jscoverage.html \
   ../jscoverage.js EXPECTED

$VALGRIND jscoverage --no-highlight TMP DIR
test -d DIR
diff --strip-trailing-cr -r EXPECTED DIR

$VALGRIND jscoverage --no-highlight --verbose TMP DIR > OUT
test -d DIR
sort OUT -o OUT
diff --strip-trailing-cr verbose.expected.out OUT
diff --strip-trailing-cr -r EXPECTED DIR
