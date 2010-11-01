/*
    http-host.c - thread-safe host lookup
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

#include "util.h"

int xgethostbyname(const char * host, struct in_addr * a) {
#if defined(__CYGWIN__) || defined(__MINGW32__)
  /* gethostbyname is thread-safe */
  struct hostent * p = gethostbyname(host);
  if (p == NULL || p->h_addrtype != AF_INET) {
    return -1;
  }
  *a = *((struct in_addr *) p->h_addr);
  return 0;
#elif HAVE_GETADDRINFO
  struct addrinfo hints;
  hints.ai_flags = 0;
  hints.ai_family = PF_INET;
  hints.ai_socktype = 0;
  hints.ai_protocol = 0;
  hints.ai_addrlen = 0;
  hints.ai_addr = NULL;
  hints.ai_canonname = NULL;
  hints.ai_next = NULL;
  struct addrinfo * p;
  int result = getaddrinfo(host, NULL, &hints, &p);
  if (result != 0 || p == NULL) {
    return -1;
  }
  if (p->ai_family != PF_INET) {
    freeaddrinfo(p);
    return -1;
  }
  struct sockaddr_in * address_and_port = (struct sockaddr_in *) p->ai_addr;
  *a = address_and_port->sin_addr;
  freeaddrinfo(p);
  return 0;
#elif HAVE_GETHOSTBYNAME_R
  struct hostent h;
  struct hostent * p;
  char * buffer;
  size_t buffer_size;
  int error;
  int result;

  buffer_size = 1024;
  buffer = xmalloc(buffer_size);
  while ((result = gethostbyname_r(host, &h, buffer, buffer_size, &p, &error)) == ERANGE) {
    buffer_size = mulst(buffer_size, 2);
    buffer = xrealloc(buffer, buffer_size);
  }
  if (result != 0 || p == NULL || p->h_addrtype != AF_INET) {
    free(buffer);
    return -1;
  }
  *a = *((struct in_addr *) p->h_addr);
  free(buffer);
  return 0;
#else
#error "No thread-safe host lookup available"
#endif
}

#ifndef HAVE_INET_ATON
int inet_aton(const char * name, struct in_addr * a) {
  unsigned long result = inet_addr(name);
  if (result == INADDR_NONE) {
    return 0;
  }
  else {
    a->s_addr = result;
    return 1;
  }
}
#endif
