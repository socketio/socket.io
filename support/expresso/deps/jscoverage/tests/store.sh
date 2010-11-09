#!/bin/sh
#    store.sh - test storing coverage reports with jscoverage-server
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
  # rm -fr DIR
  # kill $server_pid
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
$VALGRIND jscoverage-server --no-highlight --document-root=recursive --report-dir=DIR &
server_pid=$!
server_port=8080

sleep $delay

cat store.json | sed "s/@PREFIX@/\\//g" > TMP
wget --post-file=TMP -q -O- http://127.0.0.1:8080/jscoverage-store > /dev/null
cat store.expected.json | sed "s/@PREFIX@/\\//g" > TMP
json_cmp TMP DIR/jscoverage.json

cat store.json | sed "s/@PREFIX@/\\//g" > TMP
wget --post-file=TMP -q -O- http://127.0.0.1:8080/jscoverage-store > /dev/null
cat store.expected.json | sed "s/@PREFIX@/\\//g" | sed "s/,1/,2/g" > TMP
json_cmp TMP DIR/jscoverage.json

# try invalid method
echo 405 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/jscoverage-store 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# try with a path
cat store.json | sed "s/@PREFIX@/\\//g" > TMP
wget --post-file=TMP -q -O- http://127.0.0.1:8080/jscoverage-store/DIR > /dev/null
cat store.expected.json | sed "s/@PREFIX@/\\//g" > TMP
json_cmp TMP DIR/DIR/jscoverage.json

shutdown

cd recursive
perl ../server.pl > /dev/null 2> /dev/null &
origin_server_pid=$!
cd ..

rm -fr DIR
$VALGRIND jscoverage-server --no-highlight --proxy --report-dir=DIR > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

# test with proxy
cat store.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
cat store.expected.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
json_cmp TMP DIR/jscoverage.json

cat store.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
cat store.expected.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" | sed "s/,1/,2/g" > TMP
json_cmp TMP DIR/jscoverage.json

# test cached source
rm -fr DIR
cat store.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
cat store.expected.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:8000\\//g" > TMP
json_cmp TMP DIR/jscoverage.json

shutdown

rm -fr DIR
$VALGRIND jscoverage-server --no-highlight --proxy --report-dir=DIR > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

# store JSON with bad source URLs
cat store.json | sed "s/@PREFIX@//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
json_cmp store-bad-source-urls.expected.json DIR/jscoverage.json
sort ERR -o ERR
diff --strip-trailing-cr store-bad-source-urls.expected.err ERR

shutdown

rm -fr DIR
$VALGRIND jscoverage-server --no-highlight --proxy --report-dir=DIR > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

# store JSON with unreachable source URLs
cat store.json | sed "s/@PREFIX@/http:\\/\\/127.0.0.1:1\\//g" > TMP
wget --post-file=TMP -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/jscoverage-store > /dev/null
json_cmp store-unreachable-source-urls.expected.json DIR/jscoverage.json
sort ERR -o ERR
diff --strip-trailing-cr store-unreachable-source-urls.expected.err ERR
