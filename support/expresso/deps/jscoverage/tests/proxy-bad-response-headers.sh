#!/bin/sh
#    proxy-bad-response-headers.sh - test jscoverage-server --proxy with bad response headers
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
  wget -q -O- --post-data= "http://127.0.0.1:${proxy_server_port}/jscoverage-shutdown" > /dev/null
  wait $proxy_server_pid
  kill -9 $origin_server_pid
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

./http-server-bad-headers &
origin_server_pid=$!

$VALGRIND jscoverage-server --proxy > OUT 2> ERR &
proxy_server_pid=$!
proxy_server_port=8080

sleep $delay

echo 502 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/index.html 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
