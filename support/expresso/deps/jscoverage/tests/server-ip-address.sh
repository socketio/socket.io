#!/bin/sh
#    server-ip-address.sh - test jscoverage-server --ip-address
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
  # shutdown
  :
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

$VALGRIND jscoverage-server --verbose --ip-address=0.0.0.0 > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

wget -q -O- http://127.0.0.1:${server_port}/ > /dev/null

shutdown

cat server-ip-address.expected.out | sed 's/@ADDRESS@/0.0.0.0/g' > EXPECTED
cat OUT | tr -d '\r' > ACTUAL
diff EXPECTED ACTUAL

$VALGRIND jscoverage-server --verbose --ip-address 127.0.0.1 > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

wget -q -O- http://127.0.0.1:${server_port}/ > /dev/null

shutdown

cat server-ip-address.expected.out | sed 's/@ADDRESS@/127.0.0.1/g' > EXPECTED
cat OUT | tr -d '\r' > ACTUAL
diff EXPECTED ACTUAL
