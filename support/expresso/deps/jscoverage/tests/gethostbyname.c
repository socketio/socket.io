/*
    gethostbyname.c - test host lookup
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

#include "http-server.h"

int main(int argc, char ** argv) {
#ifdef __MINGW32__
  WSADATA data;
  if (WSAStartup(MAKEWORD(1, 1), &data) != 0) {
    return 1;
  }
#endif

  if (argc < 2) {
    exit(EXIT_FAILURE);
  }

  struct in_addr a;
  if (xgethostbyname(argv[1], &a) != 0) {
    exit(EXIT_FAILURE);
  }
  char * result = inet_ntoa(a);
  printf("%s\n", result);

  return 0;
}
