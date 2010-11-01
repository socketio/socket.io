#!/bin/sh
#    server-error.sh - test jscoverage-server with invalid options
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

export PATH=.:..:$PATH

! jscoverage-server --report-dir > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --document-root > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --ip-address > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --no-instrument > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --port > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --foo > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server foo > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --port x > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --port 123456 > OUT 2> ERR
test ! -s OUT
test -s ERR

! jscoverage-server --encoding > OUT 2> ERR
test ! -s OUT
test -s ERR
