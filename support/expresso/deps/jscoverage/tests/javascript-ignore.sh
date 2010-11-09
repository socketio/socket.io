#!/bin/sh
#    javascript-ignore.sh - test ignoring lines of code
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

trap 'rm -fr DIR' 1 2 3 15

export PATH=.:..:$PATH

rm -fr DIR
$VALGRIND jscoverage --no-highlight javascript-ignore DIR
diff -u --strip-trailing-cr javascript-ignore.expected/ignore.js DIR/ignore.js
rm -fr DIR
