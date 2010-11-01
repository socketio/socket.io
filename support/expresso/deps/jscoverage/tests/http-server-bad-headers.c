/*
    http-server-bad-headers.c - HTTP server that outputs bad headers
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

    /* read request */
    int state = 0;
    while (state != 2) {
      uint8_t buffer[8192];
      ssize_t bytes_read = recv(client_socket, buffer, 8192, 0);
      assert(bytes_read > 0);
      for (int i = 0; i < bytes_read && state != 2; i++) {
        uint8_t byte = buffer[i];
        switch (state) {
        case 0:
          if (byte == '\n') {
            state = 1;
          }
          else {
            state = 0;
          }
          break;
        case 1:
          if (byte == '\n') {
            state = 2;
          }
          else if (byte == '\r') {
            state = 1;
          }
          else {
            state = 0;
          }
        }
      }
    }

    /* send response */
    char * message = "HTTP/1.1 200 OK\r\nHere is some bogosity!\r\nConnection: close\r\nContent-type: text/html\r\n\r\nHello\n";
    size_t message_length = strlen(message);
    ssize_t bytes_sent = send(client_socket, message, message_length, 0);
    assert(bytes_sent == (ssize_t) message_length);

    closesocket(client_socket);
  }
  return 0;
}
