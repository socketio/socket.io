#!/bin/sh
#    no-arguments.sh - test jscoverage with no arguments
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

export PATH=.:..:$PATH

trap 'rm -fr OUT ERR' 1 2 3 15

$VALGRIND jscoverage > OUT 2> ERR && exit 1
test ! -s OUT
diff --strip-trailing-cr no-arguments.expected.err ERR

rm -fr OUT ERR
