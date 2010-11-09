#     Makefile.am - build tests
#     Copyright (C) 2007, 2008 siliconforks.com
# 
#     This program is free software; you can redistribute it and/or modify
#     it under the terms of the GNU General Public License as published by
#     the Free Software Foundation; either version 2 of the License, or
#     (at your option) any later version.
# 
#     This program is distributed in the hope that it will be useful,
#     but WITHOUT ANY WARRANTY; without even the implied warranty of
#     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#     GNU General Public License for more details.
# 
#     You should have received a copy of the GNU General Public License along
#     with this program; if not, write to the Free Software Foundation, Inc.,
#     51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

noinst_PROGRAMS = asprintf \
                  encodings \
                  gethostbyname \
                  http-client-bad-body \
                  http-client-bad-url \
                  http-client-close-after-request \
                  http-server-bad-body \
                  http-server-bad-headers \
                  http-server-charset \
                  http-server-chunked \
                  http-server-close-immediately \
                  json \
                  mkdirs \
                  recursive-dir-list \
                  streams

AM_CFLAGS = @XP_DEF@ -I../js -I../js/obj
AM_CXXFLAGS = @XP_DEF@ -I../js -I../js/obj

asprintf_SOURCES = asprintf.c ../util.c

encodings_SOURCES = encodings.c ../encoding.c ../util.c
encodings_LDADD = @LIBICONV@

gethostbyname_SOURCES = gethostbyname.c ../http-host.c ../util.c
gethostbyname_LDADD = @EXTRA_SOCKET_LIBS@

http_client_bad_body_SOURCES = http-client-bad-body.c ../http-url.c ../util.c
http_client_bad_body_LDADD = @EXTRA_SOCKET_LIBS@

http_client_bad_url_SOURCES = http-client-bad-url.c ../util.c
http_client_bad_url_LDADD = @EXTRA_SOCKET_LIBS@

http_client_close_after_request_LDADD = @EXTRA_SOCKET_LIBS@

http_server_bad_body_LDADD = @EXTRA_SOCKET_LIBS@

http_server_bad_headers_LDADD = @EXTRA_SOCKET_LIBS@

http_server_charset_SOURCES = http-server-charset.c ../stream.c ../util.c
http_server_charset_LDADD = @EXTRA_SOCKET_LIBS@

http_server_chunked_SOURCES = http-server-chunked.c ../stream.c ../util.c
http_server_chunked_LDADD = @EXTRA_SOCKET_LIBS@

http_server_close_immediately_LDADD = @EXTRA_SOCKET_LIBS@

json_SOURCES = json.c ../encoding.c ../highlight.c ../instrument-js.cpp ../resource-manager.c ../stream.c ../util.c
json_LDADD = ../js/obj/libjs.a -lm @LIBICONV@ @EXTRA_TIMER_LIBS@

mkdirs_SOURCES = mkdirs.c ../util.c

recursive_dir_list_SOURCES = recursive-dir-list.c ../util.c

streams_SOURCES = streams.c ../stream.c ../util.c

TESTS = encodings.sh \
        fatal.sh \
        help.sh \
        invalid-option.sh \
        javascript.sh \
        javascript-ignore.sh \
        javascript-utf-8.sh \
        no-arguments.sh \
        recursive.sh \
        recursive-crlf.sh \
        recursive-exclude.sh \
        recursive-fatal.sh \
        recursive-no-instrument.sh \
        same-directory.sh \
        version.sh \
        asprintf.sh \
        mkdirs.sh \
        recursive-dir-list.sh \
        streams.sh \
        charset.sh \
        chunked.sh \
        gethostbyname.sh \
        json.sh \
        proxy.sh \
        proxy-bad-request-body.sh \
        proxy-bad-response-body.sh \
        proxy-bad-response-body-javascript.sh \
        proxy-bad-response-headers.sh \
        proxy-no-server.sh \
        proxy-url.sh \
        server.sh \
        server-bad-requests.sh \
        server-close-after-request.sh \
        server-content-types.sh \
        server-directory-listing.sh \
        server-directory-redirect.sh \
        server-encoded-url.sh \
        server-error.sh \
        server-help.sh \
        server-ip-address.sh \
        server-shutdown.sh \
        server-shutdown-bad-method.sh \
        server-special-file.sh \
        server-unreadable-directory.sh \
        server-unreadable-file.sh \
        server-verbose.sh \
        server-version.sh \
        store.sh \
        store-bad-json.sh \
        store-bad-request-body.sh \
        store-bad-response-headers.sh \
        store-escaped-characters.sh \
        store-server-bad-body.sh \
        store-server-closes-immediately.sh \
        store-source-not-found.sh \
        store-unreadable-json.sh \
        store-unwritable-json.sh
