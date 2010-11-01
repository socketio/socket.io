#!/bin/sh
#    server-shutdown.sh - test jscoverage-server --shutdown
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

cleanup() {
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

perl server.pl > OUT 2> ERR &
origin_server_pid=$!

sleep $delay

$VALGRIND jscoverage-server --port 8000 --shutdown
cat ERR | cut -d'"' -f2 | diff --strip-trailing-cr server-shutdown.expected.err -
