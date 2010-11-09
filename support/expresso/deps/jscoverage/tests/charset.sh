#!/bin/sh
#    charset.sh - test jscoverage-server with different charset values
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

if jscoverage-server --version | grep -q 'iconv\|MultiByteToWideChar'
then
  character_encoding_support=yes
else
  character_encoding_support=no
fi

$VALGRIND jscoverage-server --proxy --no-highlight > OUT 2> ERR &
proxy_server_pid=$!
proxy_server_port=8080

./http-server-charset &
origin_server_pid=$!

sleep $delay

case "$character_encoding_support" in
  yes)
    cat ../report.js > EXPECTED
    cat javascript-utf-8.expected/javascript-utf-8.js | sed 's/javascript-utf-8.js/http:\/\/127.0.0.1:8000\/utf-8.js/g' >> EXPECTED
    curl -s -x 127.0.0.1:8080 http://127.0.0.1:8000/utf-8.js > ACTUAL
    diff EXPECTED ACTUAL
    ;;
  *)
    echo 500 > EXPECTED
    ! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/utf-8.js 2> /dev/null > ACTUAL
    diff EXPECTED ACTUAL
    ;;
esac

shutdown

$VALGRIND jscoverage-server --proxy > OUT 2> ERR &
proxy_server_pid=$!
proxy_server_port=8080

sleep $delay

case "$character_encoding_support" in
  yes)
    cat ../report.js > EXPECTED
    cat javascript.expected/javascript-iso-8859-1.js | sed 's/javascript-iso-8859-1.js/http:\/\/127.0.0.1:8000\/iso-8859-1.js/g' >> EXPECTED
    curl -s -x 127.0.0.1:8080 http://127.0.0.1:8000/iso-8859-1.js > ACTUAL
    diff EXPECTED ACTUAL
    ;;
  *)
    echo 500 > EXPECTED
    ! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/iso-8859-1.js 2> /dev/null > ACTUAL
    diff EXPECTED ACTUAL
    ;;
esac

# bogus charset
echo 500 > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/bogus.js 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL

# malformed encoding
case "$character_encoding_support" in
  yes)
    status=502
    ;;
  *)
    status=500
    ;;
esac
echo $status > EXPECTED
! curl -f -w '%{http_code}\n' -x 127.0.0.1:8080 http://127.0.0.1:8000/malformed.js 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
