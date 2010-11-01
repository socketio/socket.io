#!/bin/sh
#    server-directory-redirect.sh - test jscoverage-server directory redirect
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
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

$VALGRIND jscoverage-server --document-root=recursive > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

echo 'HTTP/1.1 301 Moved Permanently' > EXPECTED
# curl -f doesn't seem to work with 3xx
! curl -D ACTUAL http://127.0.0.1:8080/1 2> /dev/null > /dev/null
cat ACTUAL | tr -d '\r' | head -1 | diff EXPECTED -
