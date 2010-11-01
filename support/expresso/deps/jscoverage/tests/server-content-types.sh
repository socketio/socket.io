#!/bin/sh
#    server-content-types.sh - test jscoverage-server Content-Type headers
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

shutdown() {
  wget -q -O- --post-data= "http://127.0.0.1:${server_port}/jscoverage-shutdown" > /dev/null
  wait $server_pid
}

cleanup() {
  shutdown
  rm -f x x.y
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

$VALGRIND jscoverage-server > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

echo text/html > EXPECTED
! curl -f -w '%{content_type}\n' -o /dev/null http://127.0.0.1:8080/recursive/index.html 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

echo text/plain > EXPECTED
! curl -f -w '%{content_type}\n' -o /dev/null http://127.0.0.1:8080/recursive/unix.txt 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

echo text/plain > EXPECTED
! curl -f -w '%{content_type}\n' -o /dev/null http://127.0.0.1:8080/recursive/windows.txt 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

touch x
echo application/octet-stream > EXPECTED
! curl -f -w '%{content_type}\n' -o /dev/null http://127.0.0.1:8080/x 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

touch x.y
echo application/octet-stream > EXPECTED
! curl -f -w '%{content_type}\n' -o /dev/null http://127.0.0.1:8080/x.y 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL
