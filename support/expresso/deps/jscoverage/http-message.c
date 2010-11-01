/*
    http-message.c - HTTP message object
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
#include <string.h>

#include "stream.h"
#include "util.h"

enum ChunkedBodyState {
  CHUNKED_BODY_CHUNK_SIZE, CHUNKED_BODY_CHUNK_DATA, CHUNKED_BODY_TRAILER, CHUNKED_BODY_DONE
};

struct HTTPMessage {
  char * start_line;
  HTTPHeader * headers;

  /* used for sending and receiving */
  struct HTTPConnection * connection;

  /* used only for receiving */
  bool has_content_length;
  bool is_chunked;
  size_t bytes_remaining;
  enum ChunkedBodyState chunked_body_state;
  Stream * chunk_buffer;

  /* used only for sending */
  bool is_started;
};

static bool is_lws(uint8_t c) {
  return c == '\r' || c == '\n' || c == ' ' || c == '\t';
}

static bool is_separator(uint8_t c) {
  /* RFC 2616 2.2 */
  return strchr("()<>@,;:\\\"/[]?={} \t", c) != NULL;
}

static bool is_token_char(uint8_t c) {
  /* RFC 2616 2.2 */
  return 32 <= c && c <= 126 && ! is_separator(c);
}

static bool is_text(uint8_t c) {
  return ! (c <= 31 || c == 127);
}

static void skip_lws(const uint8_t ** p) {
  while (**p != '\0' && is_lws(**p)) {
    (*p)++;
  }
}

static uint8_t * parse_token(const uint8_t ** p) {
  const uint8_t * start = *p;
  while (**p != '\0' && is_token_char(**p)) {
    (*p)++;
  }

  if (*p == start) {
    return NULL;
  }

  return (uint8_t *) xstrndup((char *) start, *p - start);
}

static uint8_t * parse_quoted_string(const uint8_t ** p) {
  const uint8_t * start = *p;

  if (**p != '"') {
    return NULL;
  }
  (*p)++;

  while (**p != '\0' && **p != '"') {
    if (**p == '\\') {
      (*p)++;
      if (**p < 1 || **p > 127) {
        return NULL;
      }
      (*p)++;
    }
    else if (is_text(**p)) {
      (*p)++;
    }
    else {
      return NULL;
    }
  }

  if (**p != '"') {
    return NULL;
  }
  (*p)++;

  return (uint8_t *) xstrndup((char *) start, *p - start);
}

HTTPMessage * HTTPMessage_new(HTTPConnection * connection) {
  HTTPMessage * message = xmalloc(sizeof(HTTPMessage));
  message->start_line = NULL;
  message->headers = NULL;
  message->connection = connection;

  message->has_content_length = false;
  message->is_chunked = false;
  message->bytes_remaining = 0;
  message->chunked_body_state = CHUNKED_BODY_CHUNK_SIZE;
  message->chunk_buffer = NULL;

  message->is_started = false;
  return message;
}

void HTTPMessage_delete(HTTPMessage * message) {
  free(message->start_line);

  HTTPHeader * h = message->headers;
  while (h != NULL) {
    HTTPHeader * doomed = h;
    h = h->next;
    free(doomed->name);
    free(doomed->value);
    free(doomed);
  }

  if (message->chunk_buffer != NULL) {
    Stream_delete(message->chunk_buffer);
  }

  free(message);
}

HTTPConnection * HTTPMessage_get_connection(const HTTPMessage * message) {
  return message->connection;
}

void HTTPMessage_add_header(HTTPMessage * message, const char * name, const char * value) {
  HTTPHeader * last = NULL;
  for (HTTPHeader * h = message->headers; h != NULL; h = h->next) {
    if (strcmp(h->name, name) == 0) {
      char * new_value;
      xasprintf(&new_value, "%s, %s", h->value, value);
      free(h->value);
      h->value = new_value;
      return;
    }
    last = h;
  }

  HTTPHeader * header = xmalloc(sizeof(HTTPHeader));
  header->name = xstrdup(name);
  header->value = xstrdup(value);
  header->next = NULL;
  if (last == NULL) {
    message->headers = header;
  }
  else {
    last->next = header;
  }
}

void HTTPMessage_set_header(HTTPMessage * message, const char * name, const char * value) {
  for (HTTPHeader * h = message->headers; h != NULL; h = h->next) {
    if (strcmp(name, h->name) == 0) {
      free(h->value);
      h->value = xstrdup(value);
      return;
    }
  }
  HTTPMessage_add_header(message, name, value);
}

char * HTTPMessage_get_charset(const HTTPMessage * message) {
  const char * content_type = HTTPMessage_find_header(message, HTTP_CONTENT_TYPE);
  if (content_type == NULL) {
    return NULL;
  }

  const uint8_t * p = (const uint8_t *) content_type;

  /* e.g., text/html */
  uint8_t * token;
  skip_lws(&p);
  if (! is_token_char(*p)) {
    return NULL;
  }
  token = parse_token(&p);
  free(token);
  skip_lws(&p);
  if (*p != '/') {
    return NULL;
  }
  p++;
  skip_lws(&p);
  if (! is_token_char(*p)) {
    return NULL;
  }
  token = parse_token(&p);
  free(token);

  skip_lws(&p);

  while (*p != '\0') {
    bool is_charset = false;
    if (*p != ';') {
      return NULL;
    }
    p++;

    skip_lws(&p);

    if (! is_token_char(*p)) {
      return NULL;
    }
    uint8_t * attribute = parse_token(&p);
    if (strcasecmp((char *) attribute, "charset") == 0) {
      is_charset = true;
    }
    free(attribute);
    skip_lws(&p);
    if (*p != '=') {
      return NULL;
    }
    p++;

    skip_lws(&p);

    if (*p == '"') {
      uint8_t * value = parse_quoted_string(&p);
      if (value == NULL) {
        return NULL;
      }
      if (is_charset) {
        return (char *) value;
      }
      free(value);
    }
    else if (is_token_char(*p)) {
      uint8_t * value = parse_token(&p);
      if (is_charset) {
        return (char *) value;
      }
      free(value);
    }
    else {
      return NULL;
    }

    skip_lws(&p);
  }

  return NULL;
}

void HTTPMessage_set_content_length(HTTPMessage * message, size_t value) {
  char * s;
  xasprintf(&s, "%u", value);
  HTTPMessage_set_header(message, HTTP_CONTENT_LENGTH, s);
  free(s);
}

const char * HTTPMessage_find_header(const HTTPMessage * message, const char * name) {
  for (HTTPHeader * h = message->headers; h != NULL; h = h->next) {
    if (strcasecmp(h->name, name) == 0) {
      return h->value;
    }
  }
  return NULL;
}

const HTTPHeader * HTTPMessage_get_headers(const HTTPMessage * message) {
  return message->headers;
}

const char * HTTPMessage_get_start_line(const HTTPMessage * message) {
  return message->start_line;
}

void HTTPMessage_set_start_line(HTTPMessage * message, const char * start_line) {
  free(message->start_line);
  message->start_line = xstrdup(start_line);
}

static int read_line(Stream * stream, HTTPConnection * connection) __attribute__((warn_unused_result));

static int read_line(Stream * stream, HTTPConnection * connection) {
  for (;;) {
    int octet;
    int result = HTTPConnection_read_octet(connection, &octet);
    if (result != 0) {
      return result;
    }

    /* check for end of input */
    if (octet == -1) {
      return 0;
    }

    char c = (char) octet;
    Stream_write_char(stream, c);
    if (c == '\n') {
      return 0;
    }
  }
}

static int read_header(Stream * stream, HTTPConnection * connection) __attribute__((warn_unused_result));

static int read_header(Stream * stream, HTTPConnection * connection) {
  int c;

  do {
    int result = read_line(stream, connection);
    if (result != 0) {
      return result;
    }

    /* check for blank line ending the headers */
    if (stream->length == 0 ||
        (stream->length == 1 && stream->data[0] == '\n') ||
        (stream->length == 2 && stream->data[0] == '\r' && stream->data[1] == '\n')) {
      break;
    }

    result = HTTPConnection_peek_octet(connection, &c);
    if (result != 0) {
      return result;
    }
  }
  while (c == ' ' || c == '\t');

  return 0;
}

static bool stream_contains_nul(const Stream * stream) {
  for (size_t i = 0; i < stream->length; i++) {
    if (stream->data[i] == '\0') {
      return true;
    }
  }
  return false;
}

int HTTPMessage_read_start_line_and_headers(HTTPMessage * message) {
  Stream * stream = Stream_new(0);

  /* read the start line */
  int result = read_line(stream, message->connection);
  if (result != 0) {
    Stream_delete(stream);
    return -1;
  }

  /* check for NUL byte */
  if (stream_contains_nul(stream)) {
    Stream_delete(stream);
    return -1;
  }

  message->start_line = xstrndup((char *) stream->data, stream->length);

  /* read the headers - RFC 2616 4.2 */
  message->headers = NULL;
  for (;;) {
    Stream_reset(stream);
    result = read_header(stream, message->connection);
    if (result != 0) {
      Stream_delete(stream);
      return -1;
    }

    /* check for CRLF (or similar) to terminate headers */
    if (stream->length == 0 ||
        (stream->length == 1 && stream->data[0] == '\n') ||
        (stream->length == 2 && stream->data[0] == '\r' && stream->data[1] == '\n')) {
      break;
    }

    /* check for NUL byte */
    if (stream_contains_nul(stream)) {
      Stream_delete(stream);
      return -1;
    }

    /* NUL-terminate the header */
    Stream_write_char(stream, '\0');

    const uint8_t * p = stream->data;

    char * name = (char *) parse_token(&p);
    if (name == NULL) {
      Stream_delete(stream);
      return -1;
    }

    skip_lws(&p);

    /* expect colon */
    if (*p != ':') {
      free(name);
      Stream_delete(stream);
      return -1;
    }

    /* skip over colon */
    p++;

    skip_lws(&p);

    if (*p == '\0') {
      free(name);
      Stream_delete(stream);
      return -1;
    }

    /* skip backward over LWS, starting from the last char in the buffer */
    uint8_t * end = stream->data + stream->length - 2;
    while (end > p && is_lws(*end)) {
      end--;
    }

    char * value = xstrndup((char *) p, end - p + 1);

    HTTPMessage_add_header(message, name, value);
    free(name);
    free(value);
  }

  Stream_delete(stream);

  /*
  RFC 2616 4.3:
  - a request has a body iff the request headers include Content-Length or Transfer-Encoding
  - a response has a body iff the request is not HEAD and the response is not 1xx, 204, 304
  */

  const char * content_length = HTTPMessage_find_header(message, HTTP_CONTENT_LENGTH);
  if (content_length != NULL) {
    size_t value = 0;
    for (const char * p = content_length; *p != '\0'; p++) {
      /* check for overflow */
      if (SIZE_MAX / 10 < value) {
        return -1;
      }
      value *= 10;

      uint8_t digit = *p;

      /* check that it contains only decimal digits */
      if (digit < '0' || digit > '9') {
        return -1;
      }

      size_t digit_value = digit - '0';

      /* check for overflow */
      if (SIZE_MAX - digit_value < value) {
        return -1;
      }
      value += digit_value;
    }

    message->bytes_remaining = value;
    message->has_content_length = true;
  }

  const char * transfer_encoding = HTTPMessage_find_header(message, HTTP_TRANSFER_ENCODING);
  if (transfer_encoding != NULL) {
    uint8_t * token = NULL;

    const uint8_t * p = (const uint8_t *) transfer_encoding;
    result = 0;
    for (;;) {
      skip_lws(&p);

      if (! is_token_char(*p)) {
        result = -1;
        break;
      }

      free(token);
      token = parse_token(&p);

      skip_lws(&p);

      while (*p == ';') {
        p++;

        skip_lws(&p);

        if (! is_token_char(*p)) {
          result = -1;
          break;
        }
        uint8_t * attribute = parse_token(&p);
        free(attribute);

        skip_lws(&p);

        if (*p != '=') {
          result = -1;
          break;
        }
        p++;

        skip_lws(&p);

        if (*p == '"') {
          uint8_t * value = parse_quoted_string(&p);
          if (value == NULL) {
            result = -1;
            break;
          }
          free(value);
        }
        else if (is_token_char(*p)) {
          uint8_t * value = parse_token(&p);
          free(value);
        }
        else {
          result = -1;
          break;
        }

        skip_lws(&p);
      }

      if (result == -1) {
        break;
      }

      if (*p != ',') {
        break;
      }

      p++;
    }

    if (result == 0 && *p == '\0' && token != NULL && strcasecmp((char *) token, "chunked") == 0) {
      message->is_chunked = true;
      message->chunk_buffer = Stream_new(0);
    }

    free(token);
  }

  return result;
}

int HTTPMessage_write_start_line_and_headers(HTTPMessage * message) {
  int result = 0;

  if (message->is_started) {
    return result;
  }

  message->is_started = true;

  /* send the start line */
  assert(message->start_line != NULL);
  size_t length = strlen(message->start_line);
  assert(length >= 2 && message->start_line[length - 2] == '\r' && message->start_line[length - 1] == '\n');
  result = HTTPConnection_write(message->connection, message->start_line, length);
  if (result != 0) {
    return result;
  }

  /* send the headers */
  HTTPMessage_set_header(message, HTTP_CONNECTION, "close");
  for (HTTPHeader * h = message->headers; h != NULL; h = h->next) {
    result = HTTPConnection_write(message->connection, h->name, strlen(h->name));
    if (result != 0) {
      return result;
    }
    result = HTTPConnection_write(message->connection, ": ", 2);
    if (result != 0) {
      return result;
    }
    result = HTTPConnection_write(message->connection, h->value, strlen(h->value));
    if (result != 0) {
      return result;
    }
    result = HTTPConnection_write(message->connection, "\r\n", 2);
    if (result != 0) {
      return result;
    }
  }

  result = HTTPConnection_write(message->connection, "\r\n", 2);
  return result;
}

bool HTTPMessage_has_sent_headers(const HTTPMessage * message) {
  return message->is_started;
}

int HTTPMessage_write(HTTPMessage * message, const void * p, size_t size) {
  int result = 0;
  result = HTTPMessage_write_start_line_and_headers(message);
  if (result != 0) {
    return result;
  }
  result = HTTPConnection_write(message->connection, p, size);
  return result;
}

int HTTPMessage_flush(HTTPMessage * message) {
  int result = 0;
  result = HTTPMessage_write_start_line_and_headers(message);
  if (result != 0) {
    return result;
  }
  result = HTTPConnection_flush(message->connection);
  return result;
}

static int read_chunk_size_line(HTTPMessage * message) __attribute__((warn_unused_result));

static int read_chunk_size_line(HTTPMessage * message) {
  Stream_reset(message->chunk_buffer);
  int result = read_line(message->chunk_buffer, message->connection);
  if (result != 0) {
    return result;
  }
  if (message->chunk_buffer->length < 2) {
    return -1;
  }
  return 0;
}

static int read_chunk_size(Stream * stream, size_t * chunk_size) __attribute__((warn_unused_result));

static int read_chunk_size(Stream * stream, size_t * chunk_size) {
  size_t value = 0;
  for (size_t i = 0; i < stream->length; i++) {
    uint8_t digit = stream->data[i];

    /* check that it contains only hexadecimal digits */
    size_t digit_value;
    if ('0' <= digit && digit <= '9') {
      digit_value = digit - '0';
    }
    else if ('a' <= digit && digit <= 'f') {
      digit_value = digit - 'a' + 10;
    }
    else if ('A' <= digit && digit <= 'F') {
      digit_value = digit - 'A' + 10;
    }
    else if (is_lws(digit) || digit == ';') {
      break;
    }
    else {
      return -1;
    }

    /* check for overflow */
    if (SIZE_MAX / 16 < value) {
      return -1;
    }
    value *= 16;

    /* check for overflow */
    if (SIZE_MAX - digit_value < value) {
      return -1;
    }
    value += digit_value;
  }

  *chunk_size = value;
  return 0;
}

static int read_chunked_message_body(HTTPMessage * message, void * p, size_t capacity, size_t * bytes_read) {
  int result = 0;
  *bytes_read = 0;

  if (message->chunked_body_state == CHUNKED_BODY_DONE) {
    return 0;
  }

  uint8_t * s = p;
  int c;
  for (*bytes_read = 0; *bytes_read < capacity; (*bytes_read)++) {
    switch (message->chunked_body_state) {
    case CHUNKED_BODY_CHUNK_SIZE:
      if (message->chunk_buffer->length == 0) {
        /* read a `chunk-size' line */
        result = read_chunk_size_line(message);
        if (result != 0) {
          return result;
        }

        message->bytes_remaining = message->chunk_buffer->length;
      }

      if (message->bytes_remaining == 0) {
        return -1;
      }

      /* serve from the chunk buffer */
      s[*bytes_read] = message->chunk_buffer->data[message->chunk_buffer->length - message->bytes_remaining];
      message->bytes_remaining--;

      if (message->bytes_remaining == 0) {
        size_t chunk_size;
        result = read_chunk_size(message->chunk_buffer, &chunk_size);
        if (result != 0) {
          return result;
        }
        Stream_reset(message->chunk_buffer);
        if (chunk_size == 0) {
          message->chunked_body_state = CHUNKED_BODY_TRAILER;
        }
        else if (SIZE_MAX - 2 < chunk_size) {
          /* overflow */
          return -1;
        }
        else {
          message->chunked_body_state = CHUNKED_BODY_CHUNK_DATA;
          message->bytes_remaining = chunk_size + 2;
        }
      }

      break;
    case CHUNKED_BODY_CHUNK_DATA:
      /* serve from the chunk */
      result = HTTPConnection_read_octet(message->connection, &c);
      if (result != 0) {
        return result;
      }
      if (c == -1) {
        result = -1;
        message->chunked_body_state = CHUNKED_BODY_DONE;
        return result;
      }
      s[*bytes_read] = (uint8_t) c;
      message->bytes_remaining--;

      if (message->bytes_remaining == 0) {
        message->chunked_body_state = CHUNKED_BODY_CHUNK_SIZE;
      }

      break;
    case CHUNKED_BODY_TRAILER:
      if (message->chunk_buffer->length == 0) {
        /* read a header */
        result = read_header(message->chunk_buffer, message->connection);
        if (result != 0) {
          return result;
        }
        message->bytes_remaining = message->chunk_buffer->length;
      }

      if (message->bytes_remaining == 0) {
        message->chunked_body_state = CHUNKED_BODY_DONE;
        return result;
      }

      /* serve from the chunk buffer */
      s[*bytes_read] = message->chunk_buffer->data[message->chunk_buffer->length - message->bytes_remaining];
      message->bytes_remaining--;

      if (message->bytes_remaining == 0) {
        size_t length = message->chunk_buffer->length;
        uint8_t * chunk_buffer = message->chunk_buffer->data;
        if (length == 0 ||
            (length == 1 && chunk_buffer[0] == '\n') ||
            (length == 2 && chunk_buffer[0] == '\r' && chunk_buffer[1] == '\n')) {
          message->chunked_body_state = CHUNKED_BODY_DONE;
          return result;
        }
        Stream_reset(message->chunk_buffer);
      }

      break;
    default:
      break;
    }
  }

  return result;
}

static int read_chunked_entity_body(HTTPMessage * message, void * p, size_t capacity, size_t * bytes_read) {
  int result = 0;
  *bytes_read = 0;

  if (message->chunked_body_state == CHUNKED_BODY_DONE) {
    return result;
  }

  uint8_t * s = p;
  for (*bytes_read = 0; *bytes_read < capacity; (*bytes_read)++) {
    if (message->bytes_remaining == 0) {
      result = read_chunk_size_line(message);
      if (result != 0) {
        break;
      }
      size_t chunk_size;
      result = read_chunk_size(message->chunk_buffer, &chunk_size);
      if (result != 0) {
        break;
      }
      message->bytes_remaining = chunk_size;
      if (chunk_size == 0) {
        message->chunked_body_state = CHUNKED_BODY_DONE;
        break;
      }
    }

    int c;
    result = HTTPConnection_read_octet(message->connection, &c);
    if (result != 0) {
      break;
    }
    if (c == -1) {
      result = -1;
      message->chunked_body_state = CHUNKED_BODY_DONE;
      break;
    }
    s[*bytes_read] = (uint8_t) c;
    message->bytes_remaining--;
  }

  return result;
}

int HTTPMessage_read_message_body(HTTPMessage * message, void * p, size_t capacity, size_t * bytes_read) {
  if (message->is_chunked) {
    return read_chunked_message_body(message, p, capacity, bytes_read);
  }

  int result = 0;
  uint8_t * s = p;
  for (*bytes_read = 0; *bytes_read < capacity; (*bytes_read)++) {
    if (message->has_content_length && message->bytes_remaining == 0) {
      break;
    }

    int c;
    result = HTTPConnection_read_octet(message->connection, &c);
    if (result != 0) {
      break;
    }
    if (c == -1) {
      break;
    }
    s[*bytes_read] = (uint8_t) c;
    message->bytes_remaining--;
  }
  return result;
}

int HTTPMessage_read_entity_body(HTTPMessage * message, void * p, size_t capacity, size_t * bytes_read) {
  if (message->is_chunked) {
    return read_chunked_entity_body(message, p, capacity, bytes_read);
  }

  return HTTPMessage_read_message_body(message, p, capacity, bytes_read);
}

int HTTPMessage_read_entire_entity_body(HTTPMessage * message, Stream * input_stream) {
  int result = 0;
  uint8_t * buffer[8192];
  for (;;) {
    size_t bytes_read;
    result = HTTPMessage_read_entity_body(message, buffer, 8192, &bytes_read);
    if (result != 0) {
      break;
    }
    if (bytes_read == 0) {
      break;
    }
    Stream_write(input_stream, buffer, bytes_read);
  }
  return result;
}
