/*
    http-connection.c - TCP connection between HTTP client and server
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

#include "util.h"

#define CONNECTION_BUFFER_CAPACITY 8192

#ifdef _WIN32
#define ERRNO (WSAGetLastError())
#else
#include <errno.h>
#define ERRNO errno
#endif

struct HTTPConnection {
  SOCKET s;
  uint8_t input_buffer[CONNECTION_BUFFER_CAPACITY];
  size_t input_buffer_offset;
  size_t input_buffer_length;
  uint8_t output_buffer[CONNECTION_BUFFER_CAPACITY];
  size_t output_buffer_offset;
  size_t output_buffer_length;
};

static HTTPConnection * HTTPConnection_new(SOCKET s) {
  HTTPConnection * connection = xmalloc(sizeof(HTTPConnection));
  connection->s = s;
  connection->input_buffer_offset = 0;
  connection->input_buffer_length = 0;
  connection->output_buffer_offset = 0;
  connection->output_buffer_length = 0;
  return connection;
}

HTTPConnection * HTTPConnection_new_client(const char * host, uint16_t port) {
  struct in_addr ip_address;
  if (! inet_aton(host, &ip_address)) {
    /* it's a host name */
    if (xgethostbyname(host, &ip_address) != 0) {
      return NULL;
    }
  }

  SOCKET s = socket(PF_INET, SOCK_STREAM, 0);
  if (s == INVALID_SOCKET) {
    return NULL;
  }

  struct sockaddr_in a;
  a.sin_family = AF_INET;
  a.sin_port = htons(port);
  a.sin_addr = ip_address;

  if (connect(s, (struct sockaddr *) &a, sizeof(a)) < 0) {
    closesocket(s);
    return NULL;
  }

  return HTTPConnection_new(s);
}

HTTPConnection * HTTPConnection_new_server(SOCKET s) {
  return HTTPConnection_new(s);
}

int HTTPConnection_delete(HTTPConnection * connection) {
  int result = 0;
  if (closesocket(connection->s) == -1) {
    result = ERRNO;
    assert(result != 0);
  }
  free(connection);
  return result;
}

int HTTPConnection_get_peer(HTTPConnection * connection, struct sockaddr_in * peer) {
  int result = 0;
  socklen_t length = sizeof(struct sockaddr_in);
  if (getpeername(connection->s, (struct sockaddr *) peer, &length) == -1) {
    result = ERRNO;
    assert(result != 0);
  }
  return result;
}

int HTTPConnection_read_octet(HTTPConnection * connection, int * octet) {
  if (connection->input_buffer_offset >= connection->input_buffer_length) {
    ssize_t bytes_received = recv(connection->s, connection->input_buffer, CONNECTION_BUFFER_CAPACITY, 0);
    if (bytes_received == -1) {
      int result = ERRNO;
      assert(result != 0);
      return result;
    }
    else if (bytes_received == 0) {
      /* orderly shutdown */
      *octet = -1;
      return 0;
    }
    else {
      connection->input_buffer_offset = 0;
      connection->input_buffer_length = bytes_received;
    }
  }
  *octet = connection->input_buffer[connection->input_buffer_offset];
  connection->input_buffer_offset++;
  return 0;
}

int HTTPConnection_peek_octet(HTTPConnection * connection, int * octet) {
  int result = HTTPConnection_read_octet(connection, octet);

  /* check for error */
  if (result != 0) {
    return result;
  }

  /* check for end */
  if (*octet == -1) {
    return 0;
  }

  /* reset input buffer */
  connection->input_buffer_offset--;
  return 0;
}

int HTTPConnection_write(HTTPConnection * connection, const void * p, size_t size) {
  while (size > 0) {
    if (connection->output_buffer_length == CONNECTION_BUFFER_CAPACITY) {
      /* buffer full */
      ssize_t bytes_sent = send(connection->s, connection->output_buffer, CONNECTION_BUFFER_CAPACITY, 0);
      if (bytes_sent == -1) {
        int result = ERRNO;
        assert(result != 0);
        return result;
      }
      connection->output_buffer_length = 0;
    }

    size_t buffer_remaining = CONNECTION_BUFFER_CAPACITY - connection->output_buffer_length;
    size_t bytes_to_copy;
    if (size <= buffer_remaining) {
      bytes_to_copy = size;
    }
    else {
      bytes_to_copy = buffer_remaining;
    }

    memcpy(connection->output_buffer + connection->output_buffer_length, p, bytes_to_copy);
    connection->output_buffer_length += bytes_to_copy;
    p += bytes_to_copy;
    size -= bytes_to_copy;
  }

  return 0;
}

int HTTPConnection_flush(HTTPConnection * connection) {
  if (connection->output_buffer_length > 0) {
    ssize_t bytes_sent = send(connection->s, connection->output_buffer, connection->output_buffer_length, 0);
    if (bytes_sent == -1) {
      int result = ERRNO;
      assert(result != 0);
      return result;
    }
    connection->output_buffer_length = 0;
  }
  return 0;
}
