#!/bin/sh
#    javascript-utf-8.sh - test a JavaScript file with UTF-8 encoding
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

if jscoverage-server --version | grep -q 'iconv\|MultiByteToWideChar'
then
  character_encoding_support=yes
else
  character_encoding_support=no
fi

rm -fr DIR
case "$character_encoding_support" in
  yes)
    $VALGRIND jscoverage --no-highlight --encoding=UTF-8 javascript-utf-8 DIR
    diff -u --strip-trailing-cr javascript-utf-8.expected/javascript-utf-8.js DIR/javascript-utf-8.js
    ;;
  *)
    ! $VALGRIND jscoverage --no-highlight --encoding=UTF-8 javascript-utf-8 DIR > OUT 2> ERR
    echo "jscoverage: encoding UTF-8 not supported" | diff - ERR
    ;;
esac
rm -fr DIR
