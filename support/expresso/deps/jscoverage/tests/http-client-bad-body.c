/*
    http-client-bad-body.c - HTTP client that outputs a bad body
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
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef HAVE_ARPA_INET_H
#include <arpa/inet.h>
#endif
#ifdef HAVE_NETDB_H
#include <netdb.h>
#endif
#ifdef HAVE_NETINET_IN_H
#include <netinet/in.h>
#endif
#ifdef HAVE_SYS_SOCKET_H
#include <sys/socket.h>
#endif
#include <unistd.h>

#include "http-server.h"
#include "util.h"

int main(int argc, char ** argv) {
#ifdef __MINGW32__
  WSADATA data;
  if (WSAStartup(MAKEWORD(1, 1), &data) != 0) {
    return 1;
  }
#endif

  int result;

  if (argc < 3) {
    fprintf(stderr, "Usage: %s PORT URL\n", argv[0]);
    exit(EXIT_FAILURE);
  }

  uint16_t connect_port = atoi(argv[1]);
  char * url = argv[2];
  char * host;
  uint16_t port;
  char * abs_path;
  char * query;
  result = URL_parse(url, &host, &port, &abs_path, &query);
  assert(result == 0);

  struct sockaddr_in a;
  a.sin_family = AF_INET;
  a.sin_port = htons(connect_port);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

  SOCKET s = socket(PF_INET, SOCK_STREAM, 0);
  assert(s != INVALID_SOCKET);

  result = connect(s, (struct sockaddr *) &a, sizeof(a));
  assert(result == 0);

  /* send request */
  char * message;
  xasprintf(&message, "POST %s HTTP/1.1\r\nConnection: close\r\nTransfer-Encoding: chunked\r\n\r\nHello\n", url);
  size_t message_length = strlen(message);
  ssize_t bytes_sent = send(s, message, message_length, 0);
  assert(bytes_sent == (ssize_t) message_length);

  /* read response */
  for (;;) {
    uint8_t buffer[8192];
    ssize_t bytes_read = recv(s, buffer, 8192, 0);
    assert(bytes_read >= 0);
    if (bytes_read == 0) {
      break;
    }
  }

  closesocket(s);
  return 0;
}
