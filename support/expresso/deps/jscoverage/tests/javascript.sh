#!/bin/sh
#    javascript.sh - test various JavaScript constructs
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
    $VALGRIND jscoverage --js-version 180 --encoding ISO-8859-1 javascript DIR
    ;;
  *)
    $VALGRIND jscoverage --js-version=180 --exclude=javascript-iso-8859-1.js javascript DIR
    ;;
esac
for i in javascript/*.js
do
  if [ $character_encoding_support = no -a $i = javascript/javascript-iso-8859-1.js ]
  then
    continue
  fi
  FILE=${i##javascript/}
  EXPECTED=javascript.expected/${FILE}
  ACTUAL=DIR/${FILE}
  diff -u -r --strip-trailing-cr $EXPECTED $ACTUAL
done

# rm -fr DIR
