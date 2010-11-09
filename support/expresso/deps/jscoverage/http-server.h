/*
    http-server.h - generic HTTP server
    Copyright (C) 2008 siliconforks.com

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

#ifndef HTTP_SERVER_H_
#define HTTP_SERVER_H_

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

#ifdef __MINGW32__
#include <winsock2.h>
typedef int socklen_t;
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
typedef int SOCKET;
#define INVALID_SOCKET (-1)
#define closesocket close
#endif

#include "stream.h"

#define HTTP_ACCEPT "Accept"
#define HTTP_ACCEPT_CHARSET "Accept-Charset"
#define HTTP_ACCEPT_ENCODING "Accept-Encoding"
#define HTTP_ACCEPT_LANGUAGE "Accept-Language"
#define HTTP_ACCEPT_RANGES "Accept-Ranges"
#define HTTP_AGE "Age"
#define HTTP_ALLOW "Allow"
#define HTTP_AUTHORIZATION "Authorization"
#define HTTP_CACHE_CONTROL "Cache-Control"
#define HTTP_CONNECTION "Connection"
#define HTTP_CONTENT_ENCODING "Content-Encoding"
#define HTTP_CONTENT_LANGUAGE "Content-Language"
#define HTTP_CONTENT_LENGTH "Content-Length"
#define HTTP_CONTENT_LOCATION "Content-Location"
#define HTTP_CONTENT_MD5 "Content-MD5"
#define HTTP_CONTENT_RANGE "Content-Range"
#define HTTP_CONTENT_TYPE "Content-Type"
#define HTTP_DATE "Date"
#define HTTP_ETAG "ETag"
#define HTTP_EXPECT "Expect"
#define HTTP_EXPIRES "Expires"
#define HTTP_FROM "From"
#define HTTP_HOST "Host"
#define HTTP_IF_MATCH "If-Match"
#define HTTP_IF_MODIFIED_SINCE "If-Modified-Since"
#define HTTP_IF_NONE_MATCH "If-None-Match"
#define HTTP_IF_RANGE "If-Range"
#define HTTP_IF_UNMODIFIED_SINCE "If-Unmodified-Since"
#define HTTP_LAST_MODIFIED "Last-Modified"
#define HTTP_LOCATION "Location"
#define HTTP_MAX_FORWARDS "Max-Forwards"
#define HTTP_PRAGMA "Pragma"
#define HTTP_PROXY_AUTHENTICATE "Proxy-Authenticate"
#define HTTP_PROXY_AUTHORIZATION "Proxy-Authorization"
#define HTTP_RANGE "Range"
#define HTTP_REFERER "Referer"
#define HTTP_RETRY_AFTER "Retry-After"
#define HTTP_SERVER "Server"
#define HTTP_TE "TE"
#define HTTP_TRAILER "Trailer"
#define HTTP_TRANSFER_ENCODING "Transfer-Encoding"
#define HTTP_UPGRADE "Upgrade"
#define HTTP_USER_AGENT "User-Agent"
#define HTTP_VARY "Vary"
#define HTTP_VIA "Via"
#define HTTP_WARNING "Warning"
#define HTTP_WWW_AUTHENTICATE "WWW-Authenticate"

typedef struct HTTPHeader {
  char * name;
  char * value;
  struct HTTPHeader * next;
} HTTPHeader;

typedef struct HTTPMessage HTTPMessage;

typedef struct HTTPExchange HTTPExchange;

typedef struct HTTPConnection HTTPConnection;

typedef void (*HTTPServerHandler)(HTTPExchange * exchange);

/* HTTPConnection */
HTTPConnection * HTTPConnection_new_server(SOCKET s);
HTTPConnection * HTTPConnection_new_client(const char * host, uint16_t port) __attribute__((warn_unused_result));
int HTTPConnection_delete(HTTPConnection * connection) __attribute__((warn_unused_result));
int HTTPConnection_get_peer(HTTPConnection * connection, struct sockaddr_in * peer) __attribute__((warn_unused_result));
int HTTPConnection_read_octet(HTTPConnection * connection, int * octet) __attribute__((warn_unused_result));
int HTTPConnection_peek_octet(HTTPConnection * connection, int * octet) __attribute__((warn_unused_result));
int HTTPConnection_write(HTTPConnection * connection, const void * p, size_t size) __attribute__((warn_unused_result));
int HTTPConnection_flush(HTTPConnection * connection) __attribute__((warn_unused_result));

/* HTTPMessage */
HTTPMessage * HTTPMessage_new(HTTPConnection * connection);
void HTTPMessage_delete(HTTPMessage * message);
HTTPConnection * HTTPMessage_get_connection(const HTTPMessage * message);
const char * HTTPMessage_get_start_line(const HTTPMessage * message);
void HTTPMessage_set_start_line(HTTPMessage * message, const char * start_line);
const HTTPHeader * HTTPMessage_get_headers(const HTTPMessage * message);
const char * HTTPMessage_find_header(const HTTPMessage * message, const char * name);
void HTTPMessage_add_header(HTTPMessage * message, const char * name, const char * value);
void HTTPMessage_set_header(HTTPMessage * message, const char * name, const char * value);
char * HTTPMessage_get_charset(const HTTPMessage * message);
void HTTPMessage_set_content_length(HTTPMessage * message, size_t value);
int HTTPMessage_read_start_line_and_headers(HTTPMessage * message) __attribute__((warn_unused_result));
int HTTPMessage_write_start_line_and_headers(HTTPMessage * message) __attribute__((warn_unused_result));
bool HTTPMessage_has_sent_headers(const HTTPMessage * message);
int HTTPMessage_write(HTTPMessage * message, const void * p, size_t size) __attribute__((warn_unused_result));
int HTTPMessage_flush(HTTPMessage * message) __attribute__((warn_unused_result));

/*
This function reads the entire entity body from a message.  If the message uses
the "chunked" Transfer-Encoding, this function will decode it, so that the
result will be the original entity.
*/
int HTTPMessage_read_entire_entity_body(HTTPMessage * message, Stream * input_stream) __attribute__((warn_unused_result));

/*
This function makes no attempt to decode the Transfer-Encoding.
*/
int HTTPMessage_read_message_body(HTTPMessage * message, void * p, size_t capacity, size_t * bytes_read) __attribute__((warn_unused_result));

/* HTTPExchange */
HTTPExchange * HTTPExchange_new(HTTPConnection * connection);
void HTTPExchange_delete(HTTPExchange * exchange);
int HTTPExchange_get_peer(const HTTPExchange * exchange, struct sockaddr_in * peer) __attribute__((warn_unused_result));

HTTPMessage * HTTPExchange_get_request_message(const HTTPExchange * exchange);

const char * HTTPExchange_get_request_line(const HTTPExchange * exchange);
const char * HTTPExchange_get_method(const HTTPExchange * exchange);
const char * HTTPExchange_get_request_uri(const HTTPExchange * exchange);
const char * HTTPExchange_get_request_http_version(const HTTPExchange * exchange);
const char * HTTPExchange_get_host(const HTTPExchange * exchange);
uint16_t HTTPExchange_get_port(const HTTPExchange * exchange);
const char * HTTPExchange_get_abs_path(const HTTPExchange * exchange);
void HTTPExchange_set_method(HTTPExchange * exchange, const char * method);
void HTTPExchange_set_request_uri(HTTPExchange * exchange, const char * request_uri);

const HTTPHeader * HTTPExchange_get_request_headers(const HTTPExchange * exchange);
const char * HTTPExchange_find_request_header(const HTTPExchange * exchange, const char * name);
void HTTPExchange_add_request_header(HTTPExchange * exchange, const char * name, const char * value);
void HTTPExchange_set_request_header(HTTPExchange * exchange, const char * name, const char * value);
void HTTPExchange_set_request_content_length(HTTPExchange * exchange, size_t value);

int HTTPExchange_read_request_headers(HTTPExchange * exchange) __attribute__((warn_unused_result));
int HTTPExchange_write_request_headers(HTTPExchange * exchange) __attribute__((warn_unused_result));
bool HTTPExchange_request_has_body(const HTTPExchange * exchange);
int HTTPExchange_read_entire_request_entity_body(HTTPExchange * exchange, Stream * stream) __attribute__((warn_unused_result));
int HTTPExchange_flush_request(HTTPExchange * exchange) __attribute__((warn_unused_result));

HTTPMessage * HTTPExchange_get_response_message(const HTTPExchange * exchange);

uint16_t HTTPExchange_get_status_code(const HTTPExchange * exchange);
const char * HTTPExchange_get_response_http_version(const HTTPExchange * exchange);
void HTTPExchange_set_status_code(HTTPExchange * exchange, uint16_t status_code);

const HTTPHeader * HTTPExchange_get_response_headers(const HTTPExchange * exchange);
const char * HTTPExchange_find_response_header(const HTTPExchange * exchange, const char * name);
void HTTPExchange_add_response_header(HTTPExchange * exchange, const char * name, const char * value);
void HTTPExchange_set_response_header(HTTPExchange * exchange, const char * name, const char * value);
void HTTPExchange_set_response_content_length(HTTPExchange * exchange, size_t value);

int HTTPExchange_read_response_headers(HTTPExchange * exchange) __attribute__((warn_unused_result));
int HTTPExchange_write_response_headers(HTTPExchange * exchange) __attribute__((warn_unused_result));
bool HTTPExchange_response_has_body(const HTTPExchange * exchange);
int HTTPExchange_read_entire_response_entity_body(HTTPExchange * exchange, Stream * stream) __attribute__((warn_unused_result));
int HTTPExchange_write_response(HTTPExchange * exchange, const void * p, size_t size) __attribute__((warn_unused_result));
int HTTPExchange_flush_response(HTTPExchange * exchange) __attribute__((warn_unused_result));

void HTTPServer_run(const char * ip_address, uint16_t port, HTTPServerHandler handler);
void HTTPServer_shutdown(void);
void HTTPServer_log_out(const char * format, ...) __attribute__((__format__(printf, 1, 2)));
void HTTPServer_log_err(const char * format, ...) __attribute__((__format__(printf, 1, 2)));

int URL_parse(const char * url, char ** host, uint16_t * port, char ** abs_path, char ** query) __attribute__((warn_unused_result));
int URL_parse_host_and_port(const char * s, char ** host, uint16_t * port) __attribute__((warn_unused_result));
int URL_parse_abs_path_and_query(const char * s, char ** abs_path, char ** query) __attribute__((warn_unused_result));

int xgethostbyname(const char * host, struct in_addr * result) __attribute__((warn_unused_result));

#ifndef HAVE_INET_ATON
int inet_aton(const char * name, struct in_addr * a);
#endif

#endif /* HTTP_SERVER_H_ */
