/*
    http-client-close-after-request.c - HTTP client that closes connection after sending request
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
#include <string.h>

#include "http-server.h"

int main(void) {
#ifdef __MINGW32__
  WSADATA data;
  if (WSAStartup(MAKEWORD(1, 1), &data) != 0) {
    return 1;
  }
#endif

  int result;

  struct sockaddr_in a;
  a.sin_family = AF_INET;
  a.sin_port = htons(8000);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

  SOCKET s = socket(PF_INET, SOCK_STREAM, 0);
  assert(s != INVALID_SOCKET);

  result = connect(s, (struct sockaddr *) &a, sizeof(a));
  assert(result == 0);

  /* send request */
  char * message = "GET http://127.0.0.1:8000/ HTTP/1.1\r\nConnection: close\r\nHost: 127.0.0.1:8000\r\n\r\n";
  size_t message_length = strlen(message);
  ssize_t bytes_sent = send(s, message, message_length, 0);
  assert(bytes_sent == (ssize_t) message_length);

  closesocket(s);
  return 0;
}
