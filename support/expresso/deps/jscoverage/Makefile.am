#    Makefile.am - builds jscoverage
#    Copyright (C) 2007, 2008 siliconforks.com
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

ACLOCAL_AMFLAGS = -I m4

SUBDIRS = js

AM_CFLAGS = -Ijs -Ijs/obj @XP_DEF@
AM_CXXFLAGS = -Ijs -Ijs/obj @XP_DEF@

resources = jscoverage-help.txt jscoverage-server-help.txt \
            jscoverage.jsm jscoverage.manifest jscoverage.xul jscoverage-overlay.js \
            jscoverage.html \
            jscoverage.css jscoverage-ie.css jscoverage-highlight.css \
            jscoverage.js report.js \
            jscoverage-throbber.gif

bin_PROGRAMS = jscoverage jscoverage-server
jscoverage_SOURCES = encoding.c encoding.h \
                     highlight.c highlight.h \
                     instrument.c instrument.h \
                     instrument-js.cpp instrument-js.h \
                     jscoverage.c global.h \
                     resource-manager.c resource-manager.h \
                     stream.c stream.h \
                     util.c util.h \
                     $(resources)
jscoverage_LDADD = js/obj/libjs.a -lm @LIBICONV@ @EXTRA_TIMER_LIBS@
jscoverage_server_SOURCES = http-connection.c \
                            http-exchange.c \
                            http-host.c \
                            http-message.c \
                            http-server.c http-server.h \
                            http-url.c \
                            encoding.c encoding.h \
                            highlight.c highlight.h \
                            instrument-js.cpp instrument-js.h \
                            jscoverage-server.c global.h \
                            resource-manager.c resource-manager.h \
                            stream.c stream.h \
                            util.c util.h \
                            $(resources)
jscoverage_server_LDADD = js/obj/libjs.a -lm @EXTRA_SOCKET_LIBS@ @EXTRA_THREAD_LIBS@ @LIBICONV@ @EXTRA_TIMER_LIBS@

noinst_PROGRAMS = generate-resources
generate_resources_SOURCES = generate-resources.c

BUILT_SOURCES = resources.c

resources.c: generate-resources $(resources)
	$(srcdir)/generate-resources $(resources) > $@

dist_man_MANS = jscoverage.1 jscoverage-server.1

CLEANFILES = *.gcno *.exe resources.c *~

example: jscoverage
	$(srcdir)/jscoverage --exclude=.svn doc/example doc/instrumented

example-inverted: jscoverage
	$(srcdir)/jscoverage --exclude=.svn doc/example-inverted doc/instrumented-inverted

example-jsunit: jscoverage
	$(srcdir)/jscoverage --exclude=.svn --no-instrument=jsunit doc/example-jsunit doc/instrumented-jsunit

# override default install target so as not to recursively install subpackages
install: install-am
