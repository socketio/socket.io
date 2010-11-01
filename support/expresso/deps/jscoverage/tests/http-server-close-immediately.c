/*
    http-server-close-immediately.c - HTTP server that closes connection immediately
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

  SOCKET s = socket(PF_INET, SOCK_STREAM, 0);
  assert(s != INVALID_SOCKET);

  int optval = 1;
  setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (const char *) &optval, sizeof(optval));

  struct sockaddr_in a;
  a.sin_family = AF_INET;
  a.sin_port = htons(8000);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  int result = bind(s, (struct sockaddr *) &a, sizeof(a));
  assert(result == 0);

  result = listen(s, 5);
  assert(result == 0);

  for (;;) {
    struct sockaddr_in client_address;
    size_t size = sizeof(client_address);
    int client_socket = accept(s, (struct sockaddr *) &client_address, &size);
    assert(client_socket > 0);
    closesocket(client_socket);
  }
  return 0;
}
