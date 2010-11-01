#!/bin/sh
#    chunked.sh - test jscoverage-server with Transfer-Encoding: chunked
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
}

cleanup() {
  shutdown
  kill -9 $origin_server_pid
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

$VALGRIND jscoverage-server --proxy > OUT 2> ERR &
proxy_server_pid=$!
proxy_server_port=8080

./http-server-chunked &
origin_server_pid=$!

sleep $delay

echo 'hello world' > EXPECTED
curl -s -x 127.0.0.1:8080 http://127.0.0.1:8000/lower > ACTUAL
diff EXPECTED ACTUAL

echo 'HELLO WORLD' > EXPECTED
curl -s -x 127.0.0.1:8080 http://127.0.0.1:8000/upper > ACTUAL
diff EXPECTED ACTUAL

# curl doesn't understand trailers ???
# echo 'hello world' > EXPECTED
# curl -s -x 127.0.0.1:8080 http://127.0.0.1:8000/trailer > ACTUAL
# diff EXPECTED ACTUAL

echo 200 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/overflow 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

echo 200 > EXPECTED
! curl -f -w '%{http_code}\n' -o /dev/null -x 127.0.0.1:8080 http://127.0.0.1:8000/javascript 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL

echo 200 > EXPECTED
! curl -f -w '%{http_code}\n' -o /dev/null -x 127.0.0.1:8080 http://127.0.0.1:8000/multiple 2> /dev/null > ACTUAL
diff --strip-trailing-cr EXPECTED ACTUAL
