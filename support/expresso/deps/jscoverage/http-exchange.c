/*
    http-exchange.c - HTTP request/response exchange
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

#include <config.h>

#include "http-server.h"

#include <assert.h>
#include <ctype.h>
#include <string.h>

#include "util.h"

struct HTTPExchange {
  HTTPConnection * connection;

  HTTPMessage * request_message;

  char * method;
  char * request_uri;
  char * request_http_version;

  char * host;
  uint16_t port;
  char * abs_path;
  char * query;

  HTTPMessage * response_message;

  uint16_t status_code;
  char * response_http_version;
};

static const struct {
  const int status_code;
  const char * const reason_phrase;
} reason_phrases[] = {
  {100, "Continue"},
  {101, "Switching Protocols"},
  {200, "OK"},
  {201, "Created"},
  {202, "Accepted"},
  {203, "Non-Authoritative Information"},
  {204, "No Content"},
  {205, "Reset Content"},
  {206, "Partial Content"},
  {301, "Moved Permanently"},
  {302, "Found"},
  {303, "See Other"},
  {304, "Not Modified"},
  {305, "Use Proxy"},
  {307, "Temporary Redirect"},
  {400, "Bad Request"},
  {401, "Unauthorized"},
  {402, "Payment Required"},
  {403, "Forbidden"},
  {404, "Not Found"},
  {405, "Method Not Allowed"},
  {406, "Not Acceptable"},
  {407, "Proxy Authentication Required"},
  {408, "Request Time-out"},
  {409, "Conflict"},
  {410, "Gone"},
  {411, "Length Required"},
  {412, "Precondition Failed"},
  {413, "Request Entity Too Large"},
  {414, "Request-URI Too Large"},
  {415, "Unsupported Media Type"},
  {416, "Requested range not satisfiable"},
  {417, "Expectation Failed"},
  {500, "Internal Server Error"},
  {501, "Not Implemented"},
  {502, "Bad Gateway"},
  {503, "Service Unavailable"},
  {504, "Gateway Time-out"},
  {505, "HTTP Version not supported"},
};

HTTPExchange * HTTPExchange_new(HTTPConnection * connection) {
  HTTPExchange * exchange = xmalloc(sizeof(HTTPExchange));

  exchange->connection = connection;

  exchange->request_message = HTTPMessage_new(connection);
  exchange->method = NULL;
  exchange->request_uri = NULL;
  exchange->request_http_version = NULL;
  exchange->host = NULL;
  exchange->port = 0;
  exchange->abs_path = NULL;
  exchange->query = NULL;

  exchange->response_message = HTTPMessage_new(connection);
  exchange->response_http_version = NULL;
  exchange->status_code = 0;

  return exchange;
}

void HTTPExchange_delete(HTTPExchange * exchange) {
  HTTPMessage_delete(exchange->response_message);
  free(exchange->response_http_version);

  HTTPMessage_delete(exchange->request_message);
  free(exchange->method);
  free(exchange->request_uri);
  free(exchange->request_http_version);
  free(exchange->host);
  free(exchange->abs_path);
  free(exchange->query);

  free(exchange);
}

int HTTPExchange_get_peer(const HTTPExchange * exchange, struct sockaddr_in * peer) {
  return HTTPConnection_get_peer(exchange->connection, peer);
}

HTTPMessage * HTTPExchange_get_request_message(const HTTPExchange * exchange) {
  return exchange->request_message;
}

const char * HTTPExchange_get_request_line(const HTTPExchange * exchange) {
  return HTTPMessage_get_start_line(exchange->request_message);
}

const char * HTTPExchange_get_method(const HTTPExchange * exchange) {
  return exchange->method;
}

const char * HTTPExchange_get_request_uri(const HTTPExchange * exchange) {
  return exchange->request_uri;
}

const char * HTTPExchange_get_request_http_version(const HTTPExchange * exchange) {
  return exchange->request_http_version;
}

const char * HTTPExchange_get_host(const HTTPExchange * exchange) {
  return exchange->host;
}

uint16_t HTTPExchange_get_port(const HTTPExchange * exchange) {
  return exchange->port;
}

const char * HTTPExchange_get_abs_path(const HTTPExchange * exchange) {
  return exchange->abs_path;
}

void HTTPExchange_set_method(HTTPExchange * exchange, const char * method) {
  free(exchange->method);
  exchange->method = xstrdup(method);
}

void HTTPExchange_set_request_uri(HTTPExchange * exchange, const char * request_uri) {
  free(exchange->request_uri);
  exchange->request_uri = xstrdup(request_uri);
}

const HTTPHeader * HTTPExchange_get_request_headers(const HTTPExchange * exchange) {
  return HTTPMessage_get_headers(exchange->request_message);
}

const char * HTTPExchange_find_request_header(const HTTPExchange * exchange, const char * name) {
  return HTTPMessage_find_header(exchange->request_message, name);
}

void HTTPExchange_add_request_header(HTTPExchange * exchange, const char * name, const char * value) {
  HTTPMessage_add_header(exchange->request_message, name, value);
}

void HTTPExchange_set_request_header(HTTPExchange * exchange, const char * name, const char * value) {
  HTTPMessage_set_header(exchange->request_message, name, value);
}

void HTTPExchange_set_request_content_length(HTTPExchange * exchange, size_t value) {
  HTTPMessage_set_content_length(exchange->request_message, value);
}

int HTTPExchange_read_request_headers(HTTPExchange * exchange) {
  int result = 0;

  result = HTTPMessage_read_start_line_and_headers(exchange->request_message);
  if (result != 0) {
    return result;
  }

  /* parse the Request-Line */
  const char * request_line = HTTPMessage_get_start_line(exchange->request_message);
  const char * p = request_line;

  /* parse the Method */
  while (*p != ' ') {
    if (*p == '\0') {
      return -1;
    }
    p++;
  }
  if (p == request_line) {
    return -1;
  }
  exchange->method = xstrndup(request_line, p - request_line);

  /* skip over space */
  p++;

  /* parse the Request-URI */
  const char * start = p;
  while (*p != ' ') {
    if (*p == '\0') {
      return -1;
    }
    p++;
  }
  if (p == start) {
    return -1;
  }
  exchange->request_uri = xstrndup(start, p - start);

  /* skip over space */
  p++;

  /* parse the HTTP-Version */
  start = p;
  while (*p != '\r' && *p != '\n') {
    if (*p == '\0') {
      return -1;
    }
    p++;
  }
  if (p == start) {
    return -1;
  }
  exchange->request_http_version = xstrndup(start, p - start);

  /* uri elements */
  /* RFC 2616 5.1.2: the Request-URI can be an `absoluteURI' or an `abs_path' */
  result = URL_parse(exchange->request_uri, &(exchange->host), &(exchange->port),
                                            &(exchange->abs_path), &(exchange->query));
  if (result != 0) {
    return result;
  }

  if (exchange->host == NULL) {
    /* abs_path */
    const char * h = HTTPMessage_find_header(exchange->request_message, HTTP_HOST);
    if (h == NULL) {
      /* this must be an HTTP/1.0 client */
    }
    else {
      result = URL_parse_host_and_port(h, &(exchange->host), &(exchange->port));
      if (result != 0) {
        return result;
      }
    }
  }

  return 0;
}

int HTTPExchange_write_request_headers(HTTPExchange * exchange) {
  if (HTTPMessage_has_sent_headers(exchange->request_message)) {
    return 0;
  }

  /* set the Request-Line */
  if (HTTPMessage_get_start_line(exchange->request_message) == NULL) {
    if (exchange->method == NULL) {
      exchange->method = xstrdup("GET");
    }
    assert(exchange->request_uri != NULL);
    char * request_line;
    xasprintf(&request_line, "%s %s HTTP/1.1\r\n", exchange->method, exchange->request_uri);
    HTTPMessage_set_start_line(exchange->request_message, request_line);
    free(request_line);
  }

  /* set the Host, if necessary */
  if (! str_starts_with(exchange->request_uri, "http://")) {
    const char * host = HTTPMessage_find_header(exchange->request_message, HTTP_HOST);
    if (host == NULL) {
      struct sockaddr_in peer;
      int result = HTTPConnection_get_peer(exchange->connection, &peer);
      if (result != 0) {
        return result;
      }
      const char * a = inet_ntoa(peer.sin_addr);
      char * value;
      xasprintf(&value, "%s:%u", a, ntohs(peer.sin_port));
      HTTPMessage_add_header(exchange->request_message, HTTP_HOST, value);
      free(value);
    }
  }

  return HTTPMessage_write_start_line_and_headers(exchange->request_message);
}

bool HTTPExchange_request_has_body(const HTTPExchange * exchange) {
  /*
  RFC 2616 4.3: a request has a body iff the request has a Content-Length or Transfer-Encoding header
  */
  return HTTPMessage_find_header(exchange->request_message, HTTP_CONTENT_LENGTH) != NULL || 
         HTTPMessage_find_header(exchange->request_message, HTTP_TRANSFER_ENCODING) != NULL;
}

int HTTPExchange_read_entire_request_entity_body(HTTPExchange * exchange, Stream * stream) {
  return HTTPMessage_read_entire_entity_body(exchange->request_message, stream);
}

int HTTPExchange_flush_request(HTTPExchange * exchange) {
  return HTTPMessage_flush(exchange->request_message);
}

/* response methods */

HTTPMessage * HTTPExchange_get_response_message(const HTTPExchange * exchange) {
  return exchange->response_message;
}

const char * HTTPExchange_get_response_http_version(const HTTPExchange * exchange) {
  return exchange->response_http_version;
}

uint16_t HTTPExchange_get_status_code(const HTTPExchange * exchange) {
  return exchange->status_code;
}

void HTTPExchange_set_status_code(HTTPExchange * exchange, uint16_t status_code) {
  exchange->status_code = status_code;
}

const HTTPHeader * HTTPExchange_get_response_headers(const HTTPExchange * exchange) {
  return HTTPMessage_get_headers(exchange->response_message);
}

const char * HTTPExchange_find_response_header(const HTTPExchange * exchange, const char * name) {
  return HTTPMessage_find_header(exchange->response_message, name);
}

void HTTPExchange_add_response_header(HTTPExchange * exchange, const char * name, const char * value) {
  HTTPMessage_add_header(exchange->response_message, name, value);
}

void HTTPExchange_set_response_header(HTTPExchange * exchange, const char * name, const char * value) {
  HTTPMessage_set_header(exchange->response_message, name, value);
}

void HTTPExchange_set_response_content_length(HTTPExchange * exchange, size_t value) {
  HTTPMessage_set_content_length(exchange->response_message, value);
}

static void skip_digits(const char ** p) {
  while (**p != '\0' && isdigit(**p)) {
    (*p)++;
  }
}

int HTTPExchange_read_response_headers(HTTPExchange * exchange) {
  /* make sure the request went through before we try to read stuff */
  int result = HTTPExchange_flush_request(exchange);
  if (result != 0) {
    return result;
  }

  result = HTTPMessage_read_start_line_and_headers(exchange->response_message);
  if (result != 0) {
    return result;
  }

  /* parse the Status-Line (RFC 2616 6.1) */
  const char * status_line = HTTPMessage_get_start_line(exchange->response_message);
  const char * p = status_line;

  /* read the HTTP-Version */
  if (! str_starts_with(p, "HTTP/")) {
    return -1;
  }
  p += 5;
  const char * start = p;
  skip_digits(&p);
  if (start == p) {
    return -1;
  }
  if (*p != '.') {
    return -1;
  }
  p++;
  start = p;
  skip_digits(&p);
  if (start == p) {
    return -1;
  }
  if (*p != ' ') {
    return -1;
  }
  exchange->response_http_version = xstrndup(status_line, p - status_line);

  /* skip over the space */
  p++;

  /* read the Status-Code */
  start = p;
  skip_digits(&p);
  if (p - start != 3) {
    return -1;
  }
  if (*p != ' ') {
    return -1;
  }
  exchange->status_code = strtoul(start, NULL, 10);

  return 0;
}

int HTTPExchange_write_response_headers(HTTPExchange * exchange) {
  if (HTTPMessage_has_sent_headers(exchange->response_message)) {
    return 0;
  }

  /* set the Status-Line (RFC 2616 6.1) */
  if (exchange->status_code == 0) {
    exchange->status_code = 200;
  }
  const char * reason_phrase = NULL;
  size_t num_reason_phrases = sizeof(reason_phrases) / sizeof(reason_phrases[0]);
  for (size_t i = 0; i < num_reason_phrases; i++) {
    if (reason_phrases[i].status_code == exchange->status_code) {
      reason_phrase = reason_phrases[i].reason_phrase;
      break;
    }
  }
  assert(reason_phrase != NULL);
  char * status_line;
  xasprintf(&status_line, "HTTP/1.1 %u %s\r\n", exchange->status_code, reason_phrase);
  HTTPMessage_set_start_line(exchange->response_message, status_line);
  free(status_line);

  /* set the Content-Type, if necessary */
  const char * content_type = HTTPMessage_find_header(exchange->response_message, HTTP_CONTENT_TYPE);
  if (content_type == NULL) {
    HTTPMessage_set_header(exchange->response_message, HTTP_CONTENT_TYPE, "text/html");
  }

  return HTTPMessage_write_start_line_and_headers(exchange->response_message);
}

bool HTTPExchange_response_has_body(const HTTPExchange * exchange) {
  /*
  RFC 2616 4.3: a response has a body iff the request is not HEAD and the response is not 1xx, 204, 304
  */
  const char * request_method = HTTPExchange_get_method(exchange);
  assert(request_method != NULL);
  return strcmp(request_method, "HEAD") != 0 &&
         exchange->status_code != 304 &&
         exchange->status_code != 204 &&
         exchange->status_code / 100 != 1;
}

int HTTPExchange_read_entire_response_entity_body(HTTPExchange * exchange, Stream * stream) {
  return HTTPMessage_read_entire_entity_body(exchange->response_message, stream);
}

int HTTPExchange_write_response(HTTPExchange * exchange, const void * p, size_t size) {
  int result = HTTPExchange_write_response_headers(exchange);
  if (result != 0) {
    return result;
  }
  return HTTPMessage_write(exchange->response_message, p, size);
}

int HTTPExchange_flush_response(HTTPExchange * exchange) {
  int result = HTTPExchange_write_response_headers(exchange);
  if (result != 0) {
    return result;
  }
  return HTTPMessage_flush(exchange->response_message);
}
