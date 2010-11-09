/*
    jscoverage-server.c - JSCoverage server main routine
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

#include <assert.h>
#include <ctype.h>
#include <signal.h>
#include <stdint.h>
#include <string.h>

#include <dirent.h>
#ifdef HAVE_PTHREAD_H
#include <pthread.h>
#endif

#include "encoding.h"
#include "global.h"
#include "http-server.h"
#include "instrument-js.h"
#include "resource-manager.h"
#include "stream.h"
#include "util.h"

static const char * specified_encoding = NULL;
const char * jscoverage_encoding = "ISO-8859-1";
bool jscoverage_highlight = true;

typedef struct SourceCache {
  char * url;
  uint16_t * characters;
  size_t num_characters;
  struct SourceCache * next;
} SourceCache;

static SourceCache * source_cache = NULL;

static const struct {
  const char * extension;
  const char * mime_type;
} mime_types[] = {
  {".gif", "image/gif"},
  {".jpg", "image/jpeg"},
  {".jpeg", "image/jpeg"},
  {".png", "image/png"},
  {".css", "text/css"},
  {".html", "text/html"},
  {".htm", "text/html"},
  {".js", "text/javascript"},
  {".txt", "text/plain"},
  {".xml", "application/xml"},
};

static bool verbose = false;
static const char * report_directory = "jscoverage-report";
static const char * document_root = ".";
static bool proxy = false;
static const char ** no_instrument;
static size_t num_no_instrument = 0;

#ifdef __MINGW32__
CRITICAL_SECTION javascript_mutex;
CRITICAL_SECTION source_cache_mutex;
#define LOCK EnterCriticalSection
#define UNLOCK LeaveCriticalSection
#else
pthread_mutex_t javascript_mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t source_cache_mutex = PTHREAD_MUTEX_INITIALIZER;
#define LOCK pthread_mutex_lock
#define UNLOCK pthread_mutex_unlock
#endif

static const SourceCache * find_cached_source(const char * url) {
  SourceCache * result = NULL;
  LOCK(&source_cache_mutex);
  for (SourceCache * p = source_cache; p != NULL; p = p->next) {
    if (strcmp(url, p->url) == 0) {
      result = p;
      break;
    }
  }
  UNLOCK(&source_cache_mutex);
  return result;
}

static void add_cached_source(const char * url, uint16_t * characters, size_t num_characters) {
  SourceCache * new_source_cache = xmalloc(sizeof(SourceCache));
  new_source_cache->url = xstrdup(url);
  new_source_cache->characters = characters;
  new_source_cache->num_characters = num_characters;
  LOCK(&source_cache_mutex);
  new_source_cache->next = source_cache;
  source_cache = new_source_cache;
  UNLOCK(&source_cache_mutex);
}

static int get(const char * url, uint16_t ** characters, size_t * num_characters) __attribute__((warn_unused_result));

static int get(const char * url, uint16_t ** characters, size_t * num_characters) {
  char * host = NULL;
  uint16_t port;
  char * abs_path = NULL;
  char * query = NULL;
  HTTPConnection * connection = NULL;
  HTTPExchange * exchange = NULL;
  Stream * stream = NULL;

  int result = URL_parse(url, &host, &port, &abs_path, &query);
  if (result != 0) {
    goto done;
  }

  connection = HTTPConnection_new_client(host, port);
  if (connection == NULL) {
    result = -1;
    goto done;
  }

  exchange = HTTPExchange_new(connection);
  HTTPExchange_set_request_uri(exchange, url);
  result = HTTPExchange_write_request_headers(exchange);
  if (result != 0) {
    goto done;
  }

  result = HTTPExchange_read_response_headers(exchange);
  if (result != 0) {
    goto done;
  }

  stream = Stream_new(0);
  result = HTTPExchange_read_entire_response_entity_body(exchange, stream);
  if (result != 0) {
    goto done;
  }
  char * encoding = HTTPMessage_get_charset(HTTPExchange_get_response_message(exchange));
  if (encoding == NULL) {
    encoding = xstrdup(jscoverage_encoding);
  }
  result = jscoverage_bytes_to_characters(encoding, stream->data, stream->length, characters, num_characters);
  free(encoding);
  if (result != 0) {
    goto done;
  }

  result = 0;

done:
  if (stream != NULL) {
    Stream_delete(stream);
  }
  if (exchange != NULL) {
    HTTPExchange_delete(exchange);
  }
  if (connection != NULL) {
    if (HTTPConnection_delete(connection) != 0) {
      HTTPServer_log_err("Warning: error closing connection after retrieving URL: %s\n", url);
    }
  }
  free(host);
  free(abs_path);
  free(query);
  return result;
}

static void send_response(HTTPExchange * exchange, uint16_t status_code, const char * html) {
  HTTPExchange_set_status_code(exchange, status_code);
  if (HTTPExchange_write_response(exchange, html, strlen(html)) != 0) {
    HTTPServer_log_err("Warning: error writing to client\n");
  }
}

/*
RFC 2396, Appendix A: we are checking for `pchar'
*/
static bool is_escaped(char c) {
  /* `pchar' */
  if (strchr(":@&=+$,", c) != NULL) {
    return false;
  }

  if (isalnum((unsigned char) c)) {
    return false;
  }

  /* `mark' */
  if (strchr("-_.!~*'()", c) != NULL) {
    return false;
  }

  return true;
}

static char * encode_uri_component(const char * s) {
  size_t length = 0;
  for (const char * p = s; *p != '\0'; p++) {
    if (is_escaped(*p)) {
      length = addst(length, 3);
    }
    else {
      length = addst(length, 1);
    }
  }

  length = addst(length, 1);
  char * result = xmalloc(length);
  size_t i = 0;
  for (const char * p = s; *p != '\0'; p++) {
    if (is_escaped(*p)) {
      result[i] = '%';
      i++;
      snprintf(result + i, 3, "%02X", *p);
      i += 2;
    }
    else {
      result[i] = *p;
      i++;
    }
  }
  result[i] = '\0';

  return result;
}

static unsigned int hex_value(char c) {
  if ('0' <= c && c <= '9') {
    return c - '0';
  }
  else if ('A' <= c && c <= 'F') {
    return c - 'A' + 10;
  }
  else if ('a' <= c && c <= 'f') {
    return c - 'a' + 10;
  }
  else {
    return 0;
  }
}

static char * decode_uri_component(const char * s) {
  size_t length = strlen(s);
  char * result = xmalloc(length + 1);
  char * p = result;
  while (*s != '\0') {
    if (*s == '%') {
      if (s[1] == '\0' || s[2] == '\0') {
        *p = '\0';
        return result;
      }
      *p = hex_value(s[1]) * 16 + hex_value(s[2]);
      s += 2;
    }
    else {
      *p = *s;
    }
    p++;
    s++;
  }
  *p = '\0';
  return result;
}

static const char * get_entity(char c) {
  switch(c) {
  case '<':
    return "&lt;";
  case '>':
    return "&gt;";
  case '&':
    return "&amp;";
  case '\'':
    return "&apos;";
  case '"':
    return "&quot;";
  default:
    return NULL;
  }
}

static char * encode_html(const char * s) {
  size_t length = 0;
  for (const char * p = s; *p != '\0'; p++) {
    const char * entity = get_entity(*p);
    if (entity == NULL) {
      length = addst(length, 1);
    }
    else {
      length = addst(length, strlen(entity));
    }
  }

  length = addst(length, 1);
  char * result = xmalloc(length);
  size_t i = 0;
  for (const char * p = s; *p != '\0'; p++) {
    const char * entity = get_entity(*p);
    if (entity == NULL) {
      result[i] = *p;
      i++;
    }
    else {
      strcpy(result + i, entity);
      i += strlen(entity);
    }
  }
  result[i] = '\0';

  return result;
}

static const char * get_content_type(const char * path) {
  char * last_dot = strrchr(path, '.');
  if (last_dot == NULL) {
    return "application/octet-stream";
  }
  for (size_t i = 0; i < sizeof(mime_types) / sizeof(mime_types[0]); i++) {
    if (strcmp(last_dot, mime_types[i].extension) == 0) {
      return mime_types[i].mime_type;
    }
  }
  return "application/octet-stream";
}

/**
Checks whether a URI is on the no-instrument list.
@param  uri  the HTTP "Request-URI"; must not be NULL, and must not be a zero-length string
@return  true if the URI is on the no-instrument list, false otherwise
*/
static bool is_no_instrument(const char * uri) {
  assert(*uri != '\0');

  for (size_t i = 0; i < num_no_instrument; i++) {
    if (str_starts_with(uri, no_instrument[i])) {
      return true;
    }

    /*
    For a local URL, accept "/foo/bar" and "foo/bar" on the no-instrument list.
    */
    if (! proxy && str_starts_with(uri + 1, no_instrument[i])) {
      return true;
    }
  }

  return false;
}

static bool is_javascript(HTTPExchange * exchange) {
  const char * header = HTTPExchange_find_response_header(exchange, HTTP_CONTENT_TYPE);
  if (header == NULL) {
    /* guess based on extension */
    return str_ends_with(HTTPExchange_get_request_uri(exchange), ".js");
  }
  else {
    char * semicolon = strchr(header, ';');
    char * content_type;
    if (semicolon == NULL) {
      content_type = xstrdup(header);
    }
    else {
      content_type = xstrndup(header, semicolon - header);
    }
    /* RFC 4329 */
    bool result = strcmp(content_type, "text/javascript") == 0 ||
                  strcmp(content_type, "text/ecmascript") == 0 ||
                  strcmp(content_type, "text/javascript1.0") == 0 ||
                  strcmp(content_type, "text/javascript1.1") == 0 ||
                  strcmp(content_type, "text/javascript1.2") == 0 ||
                  strcmp(content_type, "text/javascript1.3") == 0 ||
                  strcmp(content_type, "text/javascript1.4") == 0 ||
                  strcmp(content_type, "text/javascript1.5") == 0 ||
                  strcmp(content_type, "text/jscript") == 0 ||
                  strcmp(content_type, "text/livescript") == 0 ||
                  strcmp(content_type, "text/x-javascript") == 0 ||
                  strcmp(content_type, "text/x-ecmascript") == 0 ||
                  strcmp(content_type, "application/x-javascript") == 0 ||
                  strcmp(content_type, "application/x-ecmascript") == 0 ||
                  strcmp(content_type, "application/javascript") == 0 ||
                  strcmp(content_type, "application/ecmascript") == 0;
    free(content_type);
    return result;
  }
}

static bool should_instrument_request(HTTPExchange * exchange) {
  if (! is_javascript(exchange)) {
    return false;
  }

  if (is_no_instrument(HTTPExchange_get_request_uri(exchange))) {
    return false;
  }

  return true;
}

static int merge(Coverage * coverage, FILE * f) __attribute__((warn_unused_result));

static int merge(Coverage * coverage, FILE * f) {
  Stream * stream = Stream_new(0);
  Stream_write_file_contents(stream, f);

  LOCK(&javascript_mutex);
  int result = jscoverage_parse_json(coverage, stream->data, stream->length);
  UNLOCK(&javascript_mutex);

  Stream_delete(stream);
  return result;
}

static void write_js_quoted_string(FILE * f, char * data, size_t length) {
  putc('"', f);
  for (size_t i = 0; i < length; i++) {
    char c = data[i];
    switch (c) {
    case '\b':
      fputs("\\b", f);
      break;
    case '\f':
      fputs("\\f", f);
      break;
    case '\n':
      fputs("\\n", f);
      break;
    case '\r':
      fputs("\\r", f);
      break;
    case '\t':
      fputs("\\t", f);
      break;
    /* IE doesn't support this */
    /*
    case '\v':
      fputs("\\v", f);
      break;
    */
    case '"':
      fputs("\\\"", f);
      break;
    case '\\':
      fputs("\\\\", f);
      break;
    default:
      putc(c, f);
      break;
    }
  }
  putc('"', f);
}

static void write_source(const char * id, const uint16_t * characters, size_t num_characters, FILE * f) {
  Stream * output = Stream_new(num_characters);
  jscoverage_write_source(id, characters, num_characters, output);
  fwrite(output->data, 1, output->length, f);
  Stream_delete(output);
}

static void write_json_for_file(const FileCoverage * file_coverage, int i, void * p) {
  FILE * f = p;

  if (i > 0) {
    putc(',', f);
  }

  write_js_quoted_string(f, file_coverage->id, strlen(file_coverage->id));

  fputs(":{\"coverage\":[", f);
  for (uint32_t i = 0; i < file_coverage->num_coverage_lines; i++) {
    if (i > 0) {
      putc(',', f);
    }
    int timesExecuted = file_coverage->coverage_lines[i];
    if (timesExecuted < 0) {
      fputs("null", f);
    }
    else {
      fprintf(f, "%d", timesExecuted);
    }
  }
  fputs("],\"source\":", f);
  if (file_coverage->source_lines == NULL) {
    if (proxy) {
      const SourceCache * cached = find_cached_source(file_coverage->id);
      if (cached == NULL) {
        uint16_t * characters;
        size_t num_characters;
        if (get(file_coverage->id, &characters, &num_characters) == 0) {
          write_source(file_coverage->id, characters, num_characters, f);
          add_cached_source(file_coverage->id, characters, num_characters);
        }
        else {
          fputs("[]", f);
          HTTPServer_log_err("Warning: cannot retrieve URL: %s\n", file_coverage->id);
        }
      }
      else {
        write_source(file_coverage->id, cached->characters, cached->num_characters, f);
      }
    }
    else {
      /* check that the path begins with / */
      if (file_coverage->id[0] == '/') {
        char * source_path = make_path(document_root, file_coverage->id + 1);
        FILE * source_file = fopen(source_path, "rb");
        free(source_path);
        if (source_file == NULL) {
          fputs("[]", f);
          HTTPServer_log_err("Warning: cannot open file: %s\n", file_coverage->id);
        }
        else {
          Stream * stream = Stream_new(0);
          Stream_write_file_contents(stream, source_file);
          fclose(source_file);
          uint16_t * characters;
          size_t num_characters;
          int result = jscoverage_bytes_to_characters(jscoverage_encoding, stream->data, stream->length, &characters, &num_characters);
          Stream_delete(stream);
          if (result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED) {
            fputs("[]", f);
            HTTPServer_log_err("Warning: encoding %s not supported\n", jscoverage_encoding);
          }
          else if (result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE) {
            fputs("[]", f);
            HTTPServer_log_err("Warning: error decoding %s in file %s\n", jscoverage_encoding, file_coverage->id);
          }
          else {
            write_source(file_coverage->id, characters, num_characters, f);
            free(characters);
          }
        }
      }
      else {
        /* path does not begin with / */
        fputs("[]", f);
        HTTPServer_log_err("Warning: invalid source path: %s\n", file_coverage->id);
      }
    }
  }
  else {
    fputc('[', f);
    for (uint32_t i = 0; i < file_coverage->num_source_lines; i++) {
      if (i > 0) {
        fputc(',', f);
      }
      char * source_line = file_coverage->source_lines[i];
      write_js_quoted_string(f, source_line, strlen(source_line));
    }
    fputc(']', f);
  }
  fputc('}', f);
}

static int write_json(Coverage * coverage, const char * path) __attribute__((warn_unused_result));

static int write_json(Coverage * coverage, const char * path) {
  /* write the JSON */
  FILE * f = fopen(path, "wb");
  if (f == NULL) {
    return -1;
  }
  putc('{', f);
  Coverage_foreach_file(coverage, write_json_for_file, f);
  putc('}', f);
  if (fclose(f) == EOF) {
    return -1;
  }
  return 0;
}

static void handle_jscoverage_request(HTTPExchange * exchange) {
  /* set the `Server' response-header (RFC 2616 14.38, 3.8) */
  HTTPExchange_set_response_header(exchange, HTTP_SERVER, "jscoverage-server/" VERSION);

  const char * abs_path = HTTPExchange_get_abs_path(exchange);
  assert(*abs_path != '\0');
  if (str_starts_with(abs_path, "/jscoverage-store")) {
    if (strcmp(HTTPExchange_get_method(exchange), "POST") != 0) {
      HTTPExchange_set_response_header(exchange, HTTP_ALLOW, "POST");
      send_response(exchange, 405, "Method not allowed\n");
      return;
    }

    Stream * json = Stream_new(0);

    /* read the POST body */
    if (HTTPExchange_read_entire_request_entity_body(exchange, json) != 0) {
      Stream_delete(json);
      send_response(exchange, 400, "Could not read request body\n");
      return;
    }

    Coverage * coverage = Coverage_new();
    LOCK(&javascript_mutex);
    int result = jscoverage_parse_json(coverage, json->data, json->length);
    UNLOCK(&javascript_mutex);
    Stream_delete(json);

    if (result != 0) {
      Coverage_delete(coverage);
      send_response(exchange, 400, "Could not parse coverage data\n");
      return;
    }

    mkdir_if_necessary(report_directory);
    char * current_report_directory;
    if (str_starts_with(abs_path, "/jscoverage-store/") && abs_path[18] != '\0') {
      char * dir = decode_uri_component(abs_path + 18);
      current_report_directory = make_path(report_directory, dir);
      free(dir);
    }
    else {
      current_report_directory = xstrdup(report_directory);
    }
    mkdir_if_necessary(current_report_directory);
    char * path = make_path(current_report_directory, "jscoverage.json");

    /* check if the JSON file exists */
    struct stat buf;
    if (stat(path, &buf) == 0) {
      /* it exists: merge */
      FILE * f = fopen(path, "rb");
      if (f == NULL) {
        result = 1;
      }
      else {
        result = merge(coverage, f);
        if (fclose(f) == EOF) {
          result = 1;
        }
      }
      if (result != 0) {
        free(current_report_directory);
        free(path);
        Coverage_delete(coverage);
        send_response(exchange, 500, "Could not merge with existing coverage data\n");
        return;
      }
    }

    result = write_json(coverage, path);
    free(path);
    Coverage_delete(coverage);
    if (result != 0) {
      free(current_report_directory);
      send_response(exchange, 500, "Could not write coverage data\n");
      return;
    }

    /* copy other files */
    jscoverage_copy_resources(current_report_directory);
    path = make_path(current_report_directory, "jscoverage.js");
    free(current_report_directory);
    FILE * f = fopen(path, "ab");
    free(path);
    if (f == NULL) {
      send_response(exchange, 500, "Could not write to file: jscoverage.js\n");
      return;
    }
    fputs("jscoverage_isReport = true;\r\n", f);
    if (fclose(f) == EOF) {
      send_response(exchange, 500, "Could not write to file: jscoverage.js\n");
      return;
    }

    send_response(exchange, 200, "Coverage data stored\n");
  }
  else if (str_starts_with(abs_path, "/jscoverage-shutdown")) {
    if (strcmp(HTTPExchange_get_method(exchange), "POST") != 0) {
      HTTPExchange_set_response_header(exchange, HTTP_ALLOW, "POST");
      send_response(exchange, 405, "Method not allowed\n");
      return;
    }

    /* allow only from localhost */
    struct sockaddr_in client;
    if (HTTPExchange_get_peer(exchange, &client) != 0) {
      send_response(exchange, 500, "Cannot get client address\n");
      return;
    }
    if (client.sin_addr.s_addr != htonl(INADDR_LOOPBACK)) {
      send_response(exchange, 403, "This operation can be performed only by localhost\n");
      return;
    }

    send_response(exchange, 200, "The server will now shut down\n");
    HTTPServer_shutdown();
  }
  else {
    const char * path = abs_path + 1;
    const struct Resource * resource = get_resource(path);
    if (resource == NULL) {
      send_response(exchange, 404, "Not found\n");
      return;
    }
    HTTPExchange_set_response_header(exchange, HTTP_CONTENT_TYPE, get_content_type(path));
    if (HTTPExchange_write_response(exchange, resource->data, resource->length) != 0) {
      HTTPServer_log_err("Warning: error writing to client\n");
      return;
    }
    if (strcmp(abs_path, "/jscoverage.js") == 0) {
      const char * s = "jscoverage_isServer = true;\r\n";
      if (HTTPExchange_write_response(exchange, s, strlen(s)) != 0) {
        HTTPServer_log_err("Warning: error writing to client\n");
      }
    }
  }
}

static void instrument_js(const char * id, const uint16_t * characters, size_t num_characters, Stream * output_stream) {
  const struct Resource * resource = get_resource("report.js");
  Stream_write(output_stream, resource->data, resource->length);

  LOCK(&javascript_mutex);
  jscoverage_instrument_js(id, characters, num_characters, output_stream);
  UNLOCK(&javascript_mutex);
}

static bool is_hop_by_hop_header(const char * h) {
  /* hop-by-hop headers (RFC 2616 13.5.1) */
  return strcasecmp(h, HTTP_CONNECTION) == 0 ||
         strcasecmp(h, "Keep-Alive") == 0 ||
         strcasecmp(h, HTTP_PROXY_AUTHENTICATE) == 0 ||
         strcasecmp(h, HTTP_PROXY_AUTHORIZATION) == 0 ||
         strcasecmp(h, HTTP_TE) == 0 ||
         strcasecmp(h, HTTP_TRAILER) == 0 ||
         strcasecmp(h, HTTP_TRANSFER_ENCODING) == 0 ||
         strcasecmp(h, HTTP_UPGRADE) == 0;
}

static void add_via_header(HTTPMessage * message, const char * version) {
  char * value;
  xasprintf(&value, "%s jscoverage-server", version);
  HTTPMessage_add_header(message, HTTP_VIA, value);
  free(value);
}

static int copy_http_message_body(HTTPMessage * from, HTTPMessage * to) __attribute__((warn_unused_result));

static int copy_http_message_body(HTTPMessage * from, HTTPMessage * to) {
  uint8_t * buffer[8192];
  for (;;) {
    size_t bytes_read;
    int result = HTTPMessage_read_message_body(from, buffer, 8192, &bytes_read);
    if (result != 0) {
      return result;
    }
    if (bytes_read == 0) {
      return 0;
    }
    result = HTTPMessage_write(to, buffer, bytes_read);
    if (result != 0) {
      return result;
    }
  }
}

static void handle_proxy_request(HTTPExchange * client_exchange) {
  HTTPConnection * server_connection = NULL;
  HTTPExchange * server_exchange = NULL;

  const char * abs_path = HTTPExchange_get_abs_path(client_exchange);
  if (str_starts_with(abs_path, "/jscoverage")) {
    handle_jscoverage_request(client_exchange);
    return;
  }

  const char * host = HTTPExchange_get_host(client_exchange);
  uint16_t port = HTTPExchange_get_port(client_exchange);

  /* create a new connection */
  server_connection = HTTPConnection_new_client(host, port);
  if (server_connection == NULL) {
    send_response(client_exchange, 504, "Could not connect to server\n");
    goto done;
  }

  /* create a new exchange */
  server_exchange = HTTPExchange_new(server_connection);
  HTTPExchange_set_method(server_exchange, HTTPExchange_get_method(client_exchange));
  HTTPExchange_set_request_uri(server_exchange, HTTPExchange_get_request_uri(client_exchange));
  for (const HTTPHeader * h = HTTPExchange_get_request_headers(client_exchange); h != NULL; h = h->next) {
    if (strcasecmp(h->name, HTTP_TRAILER) == 0 || strcasecmp(h->name, HTTP_TRANSFER_ENCODING) == 0) {
      /* do nothing: we want to keep this header */
    }
    else if (is_hop_by_hop_header(h->name) ||
             strcasecmp(h->name, HTTP_ACCEPT_ENCODING) == 0 ||
             strcasecmp(h->name, HTTP_RANGE) == 0) {
      continue;
    }
    HTTPExchange_add_request_header(server_exchange, h->name, h->value);
  }
  add_via_header(HTTPExchange_get_request_message(server_exchange), HTTPExchange_get_request_http_version(client_exchange));

  /* send the request */
  if (HTTPExchange_write_request_headers(server_exchange) != 0) {
    send_response(client_exchange, 502, "Could not write to server\n");
    goto done;
  }

  /* handle POST or PUT */
  if (HTTPExchange_request_has_body(client_exchange)) {
    HTTPMessage * client_request = HTTPExchange_get_request_message(client_exchange);
    HTTPMessage * server_request = HTTPExchange_get_request_message(server_exchange);
    if (copy_http_message_body(client_request, server_request) != 0) {
      send_response(client_exchange, 400, "Error copying request body from client to server\n");
      goto done;
    }
  }

  if (HTTPExchange_flush_request(server_exchange) != 0) {
    send_response(client_exchange, 502, "Could not write to server\n");
    goto done;
  }

  /* receive the response */
  if (HTTPExchange_read_response_headers(server_exchange) != 0) {
    send_response(client_exchange, 502, "Could not read headers from server\n");
    goto done;
  }

  HTTPExchange_set_status_code(client_exchange, HTTPExchange_get_status_code(server_exchange));

  if (HTTPExchange_response_has_body(server_exchange) && should_instrument_request(server_exchange)) {
    /* needs instrumentation */
    Stream * input_stream = Stream_new(0);
    if (HTTPExchange_read_entire_response_entity_body(server_exchange, input_stream) != 0) {
      Stream_delete(input_stream);
      send_response(client_exchange, 502, "Could not read body from server\n");
      goto done;
    }

    const char * request_uri = HTTPExchange_get_request_uri(client_exchange);
    char * encoding = HTTPMessage_get_charset(HTTPExchange_get_response_message(server_exchange));
    if (encoding == NULL) {
      encoding = xstrdup(jscoverage_encoding);
    }
    uint16_t * characters;
    size_t num_characters;
    int result = jscoverage_bytes_to_characters(encoding, input_stream->data, input_stream->length, &characters, &num_characters);
    free(encoding);
    Stream_delete(input_stream);
    if (result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED) {
      send_response(client_exchange, 500, "Encoding not supported\n");
      goto done;
    }
    else if (result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE) {
      send_response(client_exchange, 502, "Error decoding response\n");
      goto done;
    }

    Stream * output_stream = Stream_new(0);
    instrument_js(request_uri, characters, num_characters, output_stream);

    /* send the headers to the client */
    for (const HTTPHeader * h = HTTPExchange_get_response_headers(server_exchange); h != NULL; h = h->next) {
      if (is_hop_by_hop_header(h->name) || strcasecmp(h->name, HTTP_CONTENT_LENGTH) == 0) {
        continue;
      }
      else if (strcasecmp(h->name, HTTP_CONTENT_TYPE) == 0) {
        HTTPExchange_add_response_header(client_exchange, HTTP_CONTENT_TYPE, "text/javascript; charset=ISO-8859-1");
        continue;
      }
      HTTPExchange_add_response_header(client_exchange, h->name, h->value);
    }
    add_via_header(HTTPExchange_get_response_message(client_exchange), HTTPExchange_get_response_http_version(server_exchange));
    HTTPExchange_set_response_content_length(client_exchange, output_stream->length);

    /* send the instrumented code to the client */
    if (HTTPExchange_write_response(client_exchange, output_stream->data, output_stream->length) != 0) {
      HTTPServer_log_err("Warning: error writing to client\n");
    }

    /* characters go on the cache */
    /*
    free(characters);
    */
    Stream_delete(output_stream);
    add_cached_source(request_uri, characters, num_characters);
  }
  else {
    /* does not need instrumentation */

    /* send the headers to the client */
    for (const HTTPHeader * h = HTTPExchange_get_response_headers(server_exchange); h != NULL; h = h->next) {
      if (strcasecmp(h->name, HTTP_TRAILER) == 0 || strcasecmp(h->name, HTTP_TRANSFER_ENCODING) == 0) {
        /* do nothing: we want to keep this header */
      }
      else if (is_hop_by_hop_header(h->name)) {
        continue;
      }
      HTTPExchange_add_response_header(client_exchange, h->name, h->value);
    }
    add_via_header(HTTPExchange_get_response_message(client_exchange), HTTPExchange_get_response_http_version(server_exchange));

    if (HTTPExchange_write_response_headers(client_exchange) != 0) {
      HTTPServer_log_err("Warning: error writing to client\n");
      goto done;
    }

    if (HTTPExchange_response_has_body(server_exchange)) {
      /* read the body from the server and send it to the client */
      HTTPMessage * client_response = HTTPExchange_get_response_message(client_exchange);
      HTTPMessage * server_response = HTTPExchange_get_response_message(server_exchange);
      if (copy_http_message_body(server_response, client_response) != 0) {
        HTTPServer_log_err("Warning: error copying response body from server to client\n");
        goto done;
      }
    }
  }

done:
  if (server_exchange != NULL) {
    HTTPExchange_delete(server_exchange);
  }
  if (server_connection != NULL) {
    if (HTTPConnection_delete(server_connection) != 0) {
      HTTPServer_log_err("Warning: error closing connection to server\n");
    }
  }
}

static void handle_local_request(HTTPExchange * exchange) {
  /* add the `Server' response-header (RFC 2616 14.38, 3.8) */
  HTTPExchange_add_response_header(exchange, HTTP_SERVER, "jscoverage-server/" VERSION);

  char * decoded_path = NULL;
  char * filesystem_path = NULL;

  const char * abs_path = HTTPExchange_get_abs_path(exchange);
  assert(*abs_path != '\0');

  decoded_path = decode_uri_component(abs_path);

  if (str_starts_with(decoded_path, "/jscoverage")) {
    handle_jscoverage_request(exchange);
    goto done;
  }

  if (strstr(decoded_path, "..") != NULL) {
    send_response(exchange, 403, "Forbidden\n");
    goto done;
  }

  filesystem_path = make_path(document_root, decoded_path + 1);
  size_t filesystem_path_length = strlen(filesystem_path);
  if (filesystem_path_length > 0 && filesystem_path[filesystem_path_length - 1] == '/') {
    /* stat on Windows doesn't work with trailing slash */
    filesystem_path[filesystem_path_length - 1] = '\0';
  }

  struct stat buf;
  if (stat(filesystem_path, &buf) == -1) {
    send_response(exchange, 404, "Not found\n");
    goto done;
  }

  if (S_ISDIR(buf.st_mode)) {
    if (abs_path[strlen(abs_path) - 1] != '/') {
      const char * request_uri = HTTPExchange_get_request_uri(exchange);
      char * uri = xmalloc(strlen(request_uri) + 2);
      strcpy(uri, request_uri);
      strcat(uri, "/");
      HTTPExchange_add_response_header(exchange, "Location", uri);
      free(uri);
      send_response(exchange, 301, "Moved permanently\n");
      goto done;
    }

    DIR * d = opendir(filesystem_path);
    if (d == NULL) {
      send_response(exchange, 404, "Not found\n");
      goto done;
    }

    struct dirent * entry;
    while ((entry = readdir(d)) != NULL) {
      char * href = encode_uri_component(entry->d_name);
      char * html_href = encode_html(href);
      char * link = encode_html(entry->d_name);
      char * directory_entry;
      xasprintf(&directory_entry, "<a href=\"%s\">%s</a><br>\n", html_href, link);
      if (HTTPExchange_write_response(exchange, directory_entry, strlen(directory_entry)) != 0) {
        HTTPServer_log_err("Warning: error writing to client\n");
      }
      free(directory_entry);
      free(href);
      free(html_href);
      free(link);
    }
    closedir(d);
  }
  else if (S_ISREG(buf.st_mode)) {
    FILE * f = fopen(filesystem_path, "rb");
    if (f == NULL) {
      send_response(exchange, 404, "Not found\n");
      goto done;
    }

    /*
    When do we send a charset with Content-Type?
    if Content-Type is "text" or "application"
      if instrumented JavaScript
        use Content-Type: application/javascript; charset=ISO-8859-1
      else if --encoding is given
        use that encoding
      else
        send no charset
    else
      send no charset
    */
    const char * content_type = get_content_type(filesystem_path);
    if (strcmp(content_type, "text/javascript") == 0 && ! is_no_instrument(abs_path)) {
      HTTPExchange_set_response_header(exchange, HTTP_CONTENT_TYPE, "text/javascript; charset=ISO-8859-1");

      Stream * input_stream = Stream_new(0);
      Stream_write_file_contents(input_stream, f);

      uint16_t * characters;
      size_t num_characters;
      int result = jscoverage_bytes_to_characters(jscoverage_encoding, input_stream->data, input_stream->length, &characters, &num_characters);
      Stream_delete(input_stream);

      if (result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED) {
        send_response(exchange, 500, "Encoding not supported\n");
        goto done;
      }
      else if (result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE) {
        send_response(exchange, 500, "Error decoding JavaScript file\n");
        goto done;
      }

      Stream * output_stream = Stream_new(0);
      instrument_js(abs_path, characters, num_characters, output_stream);
      free(characters);

      if (HTTPExchange_write_response(exchange, output_stream->data, output_stream->length) != 0) {
        HTTPServer_log_err("Warning: error writing to client\n");
      }
      Stream_delete(output_stream);
    }
    else {
      /* send the Content-Type with charset if necessary */
      if (specified_encoding != NULL && (str_starts_with(content_type, "text/") || str_starts_with(content_type, "application/"))) {
        char * content_type_with_charset = NULL;
        xasprintf(&content_type_with_charset, "%s; charset=%s", content_type, specified_encoding);
        HTTPExchange_set_response_header(exchange, HTTP_CONTENT_TYPE, content_type_with_charset);
        free(content_type_with_charset);
      }
      else {
        HTTPExchange_set_response_header(exchange, HTTP_CONTENT_TYPE, content_type);
      }

      char buffer[8192];
      size_t bytes_read;
      while ((bytes_read = fread(buffer, 1, 8192, f)) > 0) {
        if (HTTPExchange_write_response(exchange, buffer, bytes_read) != 0) {
          HTTPServer_log_err("Warning: error writing to client\n");
        }
      }
    }
    fclose(f);
  }
  else {
    send_response(exchange, 404, "Not found\n");
    goto done;
  }

done:
  free(filesystem_path);
  free(decoded_path);
}

static void handler(HTTPExchange * exchange) {
  if (verbose) {
    HTTPServer_log_out("%s", HTTPExchange_get_request_line(exchange));
  }

  if (proxy) {
    handle_proxy_request(exchange);
  }
  else {
    handle_local_request(exchange);
  }
}

int main(int argc, char ** argv) {
  program = "jscoverage-server";

  const char * ip_address = "127.0.0.1";
  const char * port = "8080";
  int shutdown = 0;

  no_instrument = xnew(const char *, argc - 1);

  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
      copy_resource_to_stream("jscoverage-server-help.txt", stdout);
      exit(EXIT_SUCCESS);
    }
    else if (strcmp(argv[i], "-V") == 0 || strcmp(argv[i], "--version") == 0) {
      version();
    }
    else if (strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--verbose") == 0) {
      verbose = 1;
    }

    else if (strcmp(argv[i], "--report-dir") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--report-dir: option requires an argument");
      }
      report_directory = argv[i];
    }
    else if (strncmp(argv[i], "--report-dir=", 13) == 0) {
      report_directory = argv[i] + 13;
    }

    else if (strcmp(argv[i], "--document-root") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--document-root: option requires an argument");
      }
      document_root = argv[i];
    }
    else if (strncmp(argv[i], "--document-root=", 16) == 0) {
      document_root = argv[i] + 16;
    }

    else if (strcmp(argv[i], "--encoding") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--encoding: option requires an argument");
      }
      jscoverage_encoding = argv[i];
      specified_encoding = jscoverage_encoding;
    }
    else if (strncmp(argv[i], "--encoding=", 11) == 0) {
      jscoverage_encoding = argv[i] + 11;
      specified_encoding = jscoverage_encoding;
    }

    else if (strcmp(argv[i], "--ip-address") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--ip-address: option requires an argument");
      }
      ip_address = argv[i];
    }
    else if (strncmp(argv[i], "--ip-address=", 13) == 0) {
      ip_address = argv[i] + 13;
    }

    else if (strcmp(argv[i], "--js-version") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--js-version: option requires an argument");
      }
      jscoverage_set_js_version(argv[i]);
    }
    else if (strncmp(argv[i], "--js-version=", 13) == 0) {
      jscoverage_set_js_version(argv[i] + 13);
    }

    else if (strcmp(argv[i], "--no-highlight") == 0) {
      jscoverage_highlight = false;
    }

    else if (strcmp(argv[i], "--no-instrument") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--no-instrument: option requires an argument");
      }
      no_instrument[num_no_instrument] = argv[i];
      num_no_instrument++;
    }
    else if (strncmp(argv[i], "--no-instrument=", 16) == 0) {
      no_instrument[num_no_instrument] = argv[i] + 16;
      num_no_instrument++;
    }

    else if (strcmp(argv[i], "--port") == 0) {
      i++;
      if (i == argc) {
        fatal_command_line("--port: option requires an argument");
      }
      port = argv[i];
    }
    else if (strncmp(argv[i], "--port=", 7) == 0) {
      port = argv[i] + 7;
    }

    else if (strcmp(argv[i], "--proxy") == 0) {
      proxy = 1;
    }

    else if (strcmp(argv[i], "--shutdown") == 0) {
      shutdown = 1;
    }

    else if (strncmp(argv[i], "-", 1) == 0) {
      fatal_command_line("unrecognized option `%s'", argv[i]);
    }
    else {
      fatal_command_line("too many arguments");
    }
  }

  /* check the port */
  char * end;
  unsigned long numeric_port = strtoul(port, &end, 10);
  if (*end != '\0') {
    fatal_command_line("--port: option must be an integer");
  }
  if (numeric_port > UINT16_MAX) {
    fatal_command_line("--port: option must be 16 bits");
  }

  /* is this a shutdown? */
  if (shutdown) {
#ifdef __MINGW32__
    WSADATA data;
    if (WSAStartup(MAKEWORD(1, 1), &data) != 0) {
      fatal("could not start Winsock");
    }
#endif

    /* INADDR_LOOPBACK */
    HTTPConnection * connection = HTTPConnection_new_client("127.0.0.1", numeric_port);
    if (connection == NULL) {
      fatal("could not connect to server");
    }
    HTTPExchange * exchange = HTTPExchange_new(connection);
    HTTPExchange_set_method(exchange, "POST");
    HTTPExchange_set_request_uri(exchange, "/jscoverage-shutdown");
    if (HTTPExchange_write_request_headers(exchange) != 0) {
      fatal("could not write request headers to server");
    }
    if (HTTPExchange_read_response_headers(exchange) != 0) {
      fatal("could not read response headers from server");
    }
    Stream * stream = Stream_new(0);
    if (HTTPExchange_read_entire_response_entity_body(exchange, stream) != 0) {
      fatal("could not read response body from server");
    }
    fwrite(stream->data, 1, stream->length, stdout);
    Stream_delete(stream);
    HTTPExchange_delete(exchange);
    if (HTTPConnection_delete(connection) != 0) {
      fatal("could not close connection with server");
    }
    exit(EXIT_SUCCESS);
  }

  jscoverage_init();

#ifndef __MINGW32__
  /* handle broken pipe */
  signal(SIGPIPE, SIG_IGN);
#endif

#ifdef __MINGW32__
InitializeCriticalSection(&javascript_mutex);
InitializeCriticalSection(&source_cache_mutex);
#endif

  if (verbose) {
    printf("Starting HTTP server on %s:%lu\n", ip_address, numeric_port);
    fflush(stdout);
  }
  HTTPServer_run(ip_address, (uint16_t) numeric_port, handler);
  if (verbose) {
    printf("Stopping HTTP server\n");
    fflush(stdout);
  }

  jscoverage_cleanup();

  free(no_instrument);

  LOCK(&source_cache_mutex);
  while (source_cache != NULL) {
    SourceCache * p = source_cache;
    source_cache = source_cache->next;
    free(p->url);
    free(p->characters);
    free(p);
  }
  UNLOCK(&source_cache_mutex);

  return 0;
}
