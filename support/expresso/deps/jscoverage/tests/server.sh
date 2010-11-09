#!/bin/sh
#    server.sh - test jscoverage-server
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
  rm -fr EXPECTED ACTUAL DIR OUT
  # kill $server_pid
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

if jscoverage-server --version | grep -q 'iconv\|MultiByteToWideChar'
then
  character_encoding_support=yes
else
  character_encoding_support=no
fi

rm -fr EXPECTED ACTUAL DIR OUT
mkdir DIR
$VALGRIND jscoverage-server --no-highlight --document-root=recursive --report-dir=DIR &
server_pid=$!
server_port=8080

sleep $delay

wget -q -O- http://127.0.0.1:8080/index.html | diff recursive/index.html -
wget -q -O- http://127.0.0.1:8080/style.css | diff recursive/style.css -
wget -q -O- http://127.0.0.1:8080/unix.txt | diff recursive/unix.txt -
wget -q -O- http://127.0.0.1:8080/windows.txt | diff recursive/windows.txt -
wget -q -O- http://127.0.0.1:8080/image.png | diff recursive/image.png -
wget -q -O- http://127.0.0.1:8080/x | diff recursive/x -
wget -q -O- http://127.0.0.1:8080/1/1.html | diff recursive/1/1.html -
wget -q -O- http://127.0.0.1:8080/1/1.css | diff recursive/1/1.css -
wget -q -O- http://127.0.0.1:8080/1/2/2.html | diff recursive/1/2/2.html -
wget -q -O- http://127.0.0.1:8080/1/2/2.css | diff recursive/1/2/2.css -

# test query string
wget -q -O- http://127.0.0.1:8080/index.html?foo | diff recursive/index.html -

# test javascript
wget -q -O- http://127.0.0.1:8080/script.js > OUT
cat ../report.js recursive.expected/script.js | sed 's/@PREFIX@/\//g' | diff --strip-trailing-cr - OUT
wget -q -O- http://127.0.0.1:8080/1/1.js > OUT
cat ../report.js recursive.expected/1/1.js | sed 's/@PREFIX@/\//g' | diff --strip-trailing-cr - OUT
wget -q -O- http://127.0.0.1:8080/1/2/2.js > OUT
cat ../report.js recursive.expected/1/2/2.js | sed 's/@PREFIX@/\//g' | diff --strip-trailing-cr - OUT

# test jscoverage
wget -q -O- http://127.0.0.1:8080/jscoverage.html | diff ../jscoverage.html -
wget -q -O- http://127.0.0.1:8080/jscoverage.css | diff ../jscoverage.css -
wget -q -O- http://127.0.0.1:8080/jscoverage-throbber.gif | diff ../jscoverage-throbber.gif -
wget -q -O- http://127.0.0.1:8080/jscoverage.js > OUT
echo -e 'jscoverage_isServer = true;\r' | cat ../jscoverage.js - | diff - OUT

# load/store
wget --post-data='{}' -q -O- http://127.0.0.1:8080/jscoverage-store > /dev/null
echo -n '{}' | diff - DIR/jscoverage.json
diff ../jscoverage.html DIR/jscoverage.html
diff ../jscoverage.css DIR/jscoverage.css
diff ../jscoverage-throbber.gif DIR/jscoverage-throbber.gif
echo -e 'jscoverage_isReport = true;\r' | cat ../jscoverage.js - | diff - DIR/jscoverage.js

# 404 not found
echo 404 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/missing 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
echo 404 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/jscoverage-missing 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# 403 forbidden
echo 403 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/../Makefile.am 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

## send it a proxy request
#echo 400 > EXPECTED
#! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://siliconforks.com/ 2> /dev/null > ACTUAL
#diff EXPECTED ACTUAL

# kill $server_pid
shutdown

rm -fr DIR
mkdir DIR
case `uname` in
  MINGW*)
    $VALGRIND jscoverage-server --no-highlight --port=8081 --document-root=recursive --report-dir=DIR --no-instrument=1/ &
    ;;
  *)
    $VALGRIND jscoverage-server --no-highlight --port=8081 --document-root=recursive --report-dir=DIR --no-instrument=/1/ &
    ;;
esac
server_pid=$!
server_port=8081

sleep $delay

wget -q -O- http://127.0.0.1:8081/script.js > OUT
cat ../report.js recursive.expected/script.js | sed 's/@PREFIX@/\//g' | diff --strip-trailing-cr - OUT
wget -q -O- http://127.0.0.1:8081/1/1.js | diff --strip-trailing-cr recursive/1/1.js -
wget -q -O- http://127.0.0.1:8081/1/2/2.js | diff --strip-trailing-cr recursive/1/2/2.js -

# kill $server_pid
shutdown

$VALGRIND jscoverage-server --no-highlight --port 8082 --document-root recursive --report-dir DIR --no-instrument 1/ &
server_pid=$!
server_port=8082

sleep $delay

wget -q -O- http://127.0.0.1:8082/script.js > OUT
cat ../report.js recursive.expected/script.js | sed 's/@PREFIX@/\//g' | diff --strip-trailing-cr - OUT
wget -q -O- http://127.0.0.1:8082/1/1.js | diff --strip-trailing-cr recursive/1/1.js -
wget -q -O- http://127.0.0.1:8082/1/2/2.js | diff --strip-trailing-cr recursive/1/2/2.js -

# kill $server_pid
shutdown

$VALGRIND jscoverage-server --port 8080 --encoding iso-8859-1 --document-root javascript &
server_pid=$!
server_port=8080

sleep $delay

case "$character_encoding_support" in
  yes)
    wget -q -O- http://127.0.0.1:8080/javascript-iso-8859-1.js > OUT
    cat ../report.js javascript.expected/javascript-iso-8859-1.js | sed 's/javascript-iso-8859-1.js/\/javascript-iso-8859-1.js/g' | diff --strip-trailing-cr - OUT
    ;;
  *)
    echo 500 > EXPECTED
    ! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/javascript-iso-8859-1.js 2> /dev/null > ACTUAL
    diff EXPECTED ACTUAL
    ;;
esac

# kill $server_pid
shutdown

$VALGRIND jscoverage-server --no-highlight --port=8080 --encoding=utf-8 --document-root=javascript-utf-8 &
server_pid=$!
server_port=8080

sleep $delay

case "$character_encoding_support" in
  yes)
    wget -q -O- http://127.0.0.1:8080/javascript-utf-8.js > OUT
    cat ../report.js javascript-utf-8.expected/javascript-utf-8.js | sed 's/javascript-utf-8.js/\/javascript-utf-8.js/g' | diff --strip-trailing-cr - OUT
    ;;
  *)
    echo 500 > EXPECTED
    ! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/javascript-utf-8.js 2> /dev/null > ACTUAL
    diff EXPECTED ACTUAL
    ;;
esac

# kill $server_pid
shutdown

$VALGRIND jscoverage-server --port 8080 --encoding BOGUS --document-root javascript &
server_pid=$!
server_port=8080

sleep $delay

echo 500 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/javascript-iso-8859-1.js 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# kill $server_pid
shutdown

$VALGRIND jscoverage-server --port 8080 --encoding utf-8 --document-root javascript &
server_pid=$!
server_port=8080

sleep $delay

echo 500 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/javascript-iso-8859-1.js 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
