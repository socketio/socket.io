#!/bin/sh
#    server-unreadable-directory.sh - test jscoverage-server with unreadable directory
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

# skip on windows
uname=`uname`
case "$uname" in
  CYGWIN* | MINGW*)
    exit 77
    ;;
esac

shutdown() {
  wget -q -O- --post-data= "http://127.0.0.1:${server_port}/jscoverage-shutdown" > /dev/null
  wait $server_pid
}

cleanup() {
  rmdir DIR
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

rm -fr DIR
mkdir DIR
chmod 000 DIR
$VALGRIND jscoverage-server > OUT 2> ERR &
server_pid=$!
server_port=8080

sleep $delay

echo 404 > EXPECTED
! curl -f -w '%{http_code}\n' http://127.0.0.1:8080/DIR/ 2> /dev/null > ACTUAL
diff EXPECTED ACTUAL
