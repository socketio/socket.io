#!/bin/sh
#    store-server-closes-immediately.sh - test storing when server closes immediately
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

. common.sh

shutdown() {
  wget -q -O- --post-data= "http://127.0.0.1:${server_port}/jscoverage-shutdown" > /dev/null
  wait $server_pid
}

cleanup() {
  shutdown
  if [ "$origin_server_pid" != "" ]
  then
    kill -9 $origin_server_pid
  fi
}

trap 'cleanup' 0 1 2 3 15

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

rm -fr DIR
$VALGRIND jscoverage-server --proxy --report-dir=DIR > OUT 2> ERR &
server_pid=$!
server_port=8080
./http-server-close-immediately &
origin_server_pid=$!

sleep $delay

cat store.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
json_cmp store-source-urls.expected.json DIR/jscoverage.json
sort ERR -o ERR
diff --strip-trailing-cr store-source-urls.expected.err ERR
