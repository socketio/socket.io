#!/bin/sh
#    server-bad-requests.sh - test jscoverage-server with bad requests
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
  rm -fr EXPECTED ACTUAL OUT ERR
}

bad_request() {
  /bin/echo -ne "$1" | $NETCAT 127.0.0.1 $server_port > OUT 2> ERR
  echo 'HTTP/1.1 400 Bad Request' > EXPECTED
  head -n 1 OUT > ACTUAL
  diff --strip-trailing-cr EXPECTED ACTUAL
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

if which netcat > /dev/null 2> /dev/null
then
  NETCAT=netcat
elif which nc > /dev/null 2> /dev/null
then
  NETCAT=nc
else
  NETCAT='perl netcat.pl';
fi

rm -fr EXPECTED ACTUAL OUT ERR
$VALGRIND jscoverage-server --port 8000 > /dev/null 2> /dev/null &
server_pid=$!
server_port=8000

sleep $delay

# send NUL in Request-Line
bad_request 'GET \0000 HTTP/1.1\r\n\r\n'

# send empty Request-Line
bad_request '\r\n\r\n'

# send bad Request-Line
bad_request ' \r\n\r\n'
bad_request 'GET\r\n\r\n'
bad_request 'GET \r\n\r\n'
bad_request 'GET  \r\n\r\n'
bad_request 'GET /\r\n\r\n'
bad_request 'GET / \r\n\r\n'

# bad Host header
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nHost: foo:bar\r\n\r\n'

# NUL in header
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nFoo: \0000\r\n\r\n'

# missing header
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\n: bar\r\n\r\n'

# missing header value
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nFoo:\r\n\r\n'

# bad Transfer-Encoding
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo;\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar = "\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar = "\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar = "\\\0200"\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar = "\0177"\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: foo; bar = ;\r\n\r\n'

# bad Content-Length
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nContent-Length: 4294967296\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nContent-Length: 4294967300\r\n\r\n'
bad_request 'GET / HTTP/1.1\r\nConnection: close\r\nContent-Length: foo\r\n\r\n'
