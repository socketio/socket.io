#!/bin/sh
#    proxy.sh - test jscoverage-server --proxy
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

shutdown_perl() {
  wget -q -O- --post-data= http://127.0.0.1:8000/perl-shutdown > /dev/null
  wait $origin_server_pid
}

cleanup() {
  rm -fr EXPECTED ACTUAL DIR OUT
  shutdown
  shutdown_perl
}

trap 'cleanup' 0 1 2 3 15

export PATH=.:..:$PATH

if [ -z "$VALGRIND" ]
then
  delay=0.2
else
  delay=2
fi

cd recursive
perl ../server.pl > /dev/null 2> /dev/null &
origin_server_pid=$!
cd ..

rm -fr DIR
mkdir DIR
$VALGRIND jscoverage-server --no-highlight --proxy --report-dir=DIR > OUT 2> ERR &
proxy_server_pid=$!
proxy_server_port=8080

sleep $delay

wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/index.html | diff recursive/index.html -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/style.css | diff recursive/style.css -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/unix.txt | diff recursive/unix.txt -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/windows.txt | diff recursive/windows.txt -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/image.png | diff recursive/image.png -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/x | diff recursive/x -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/1.html | diff recursive/1/1.html -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/1.css | diff recursive/1/1.css -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/2/2.html | diff recursive/1/2/2.html -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/2/2.css | diff recursive/1/2/2.css -

# test localhost
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://localhost:8000/index.html | diff recursive/index.html -

# test actual hostname
h=`hostname`
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://${h}:8000/index.html | diff recursive/index.html -

# test query string
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/index.html?foo | diff recursive/index.html -

# test POST
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' --post-file=recursive/index.html http://127.0.0.1:8000/ | diff recursive/index.html -

# test javascript
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/script.js > OUT
cat ../report.js recursive.expected/script.js | sed 's/@PREFIX@/http:\/\/127.0.0.1:8000\//g' | diff --strip-trailing-cr - OUT
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/1.js > OUT
cat ../report.js recursive.expected/1/1.js | sed 's/@PREFIX@/http:\/\/127.0.0.1:8000\//g' | diff --strip-trailing-cr - OUT
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://127.0.0.1:8000/1/2/2.js > OUT
cat ../report.js recursive.expected/1/2/2.js | sed 's/@PREFIX@/http:\/\/127.0.0.1:8000\//g' | diff --strip-trailing-cr - OUT

## test jscoverage
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://siliconforks.com/jscoverage.html | diff ../jscoverage.html -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://siliconforks.com/jscoverage.css | diff ../jscoverage.css -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://siliconforks.com/jscoverage-throbber.gif | diff ../jscoverage-throbber.gif -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' http://siliconforks.com/jscoverage.js > OUT
echo -e 'jscoverage_isServer = true;\r' | cat ../jscoverage.js - | diff - OUT

# load/store
wget -q -O- -e 'http_proxy=http://127.0.0.1:8080/' --post-data='{}' http://siliconforks.com/jscoverage-store > /dev/null
echo -n '{}' | diff - DIR/jscoverage.json
diff ../jscoverage.html DIR/jscoverage.html
diff ../jscoverage.css DIR/jscoverage.css
diff ../jscoverage-throbber.gif DIR/jscoverage-throbber.gif
echo -e 'jscoverage_isReport = true;\r' | cat ../jscoverage.js - | diff - DIR/jscoverage.js

# send it an FTP request
echo 400 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 ftp://ftp.example.com 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# nonexistent domain
echo 504 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://nonexistent 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# 404 not found
echo 404 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/missing 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
echo 404 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://siliconforks.com/jscoverage-missing 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

## send it a server request
#echo 400 > EXPECTED
#! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/ 2> /dev/null > ACTUAL
#diff EXPECTED ACTUAL

# kill $proxy_server_pid
shutdown

$VALGRIND jscoverage-server --no-highlight --port=8081 --proxy --report-dir=DIR --no-instrument=http://127.0.0.1:8000/1/ &
proxy_server_pid=$!
proxy_server_port=8081

sleep $delay

wget -q -O- -e 'http_proxy=http://127.0.0.1:8081/' http://127.0.0.1:8000/script.js > OUT
cat ../report.js recursive.expected/script.js | sed 's/@PREFIX@/http:\/\/127.0.0.1:8000\//g' | diff --strip-trailing-cr - OUT
wget -q -O- -e 'http_proxy=http://127.0.0.1:8081/' http://127.0.0.1:8000/1/1.js | diff --strip-trailing-cr recursive/1/1.js -
wget -q -O- -e 'http_proxy=http://127.0.0.1:8081/' http://127.0.0.1:8000/1/2/2.js | diff --strip-trailing-cr recursive/1/2/2.js -
