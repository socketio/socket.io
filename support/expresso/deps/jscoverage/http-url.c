/*
    http-url.c - URL parsing routines
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

#include <ctype.h>
#include <string.h>

#include "util.h"

int URL_parse_host_and_port(const char * s, char ** host, uint16_t * port) {
  char * colon = strchr(s, ':');
  if (colon == NULL) {
    *host = xstrdup(s);
    *port = 80;
  }
  else {
    if (*(colon + 1) == '\0') {
      *port = 80;
    }
    else {
      char * end;
      unsigned long p = strtoul(colon + 1, &end, 10);
      if (*end == '\0') {
        if (p > UINT16_MAX) {
          return -1;
        }
        else {
          *port = p;
        }
      }
      else {
        return -1;
      }
    }
    *host = xstrndup(s, colon - s);
  }
  return 0;
}

int URL_parse_abs_path_and_query(const char * s, char ** abs_path, char ** query) {
  if (*s == '\0') {
    *abs_path = xstrdup("/");
    *query = NULL;
  }
  else if (*s == '?') {
    *abs_path = xstrdup("/");
    *query = xstrdup(s + 1);
  }
  else if (*s == '/') {
    char * question = strchr(s, '?');
    if (question == NULL) {
      *abs_path = xstrdup(s);
      *query = NULL;
    }
    else {
      *abs_path = xstrndup(s, question - s);
      *query = xstrdup(question + 1);
    }
  }
  else {
    return -1;
  }
  return 0;
}

int URL_parse(const char * url, char ** host, uint16_t * port, char ** abs_path, char ** query) {
  /* check for invalid characters */
  for (const char * p = url; *p != '\0'; p++) {
    switch (*p) {
    case ';':
    case '/':
    case '?':
    case ':':
    case '@':
    case '&':
    case '=':
    case '+':
    case '$':
    case ',':
    case '-':
    case '_':
    case '.':
    case '!':
    case '~':
    case '*':
    case '\'':
    case '(':
    case ')':
    case '%':
      break;
    default:
      if (! isalnum(*p)) {
        return -1;
      }
      break;
    }
  }

  int result;
  if (strncasecmp(url, "http://", 7) == 0) {
    /* absoluteURI */

    /* advance past the http:// */
    const char * authority_start = url + 7;

    /* look for a slash or question mark */
    const char * p;
    for (p = authority_start; *p != '/' && *p != '?' && *p != '\0'; p++) {
      ;
    }

    char * host_and_port = xstrndup(authority_start, p - authority_start);
    result = URL_parse_host_and_port(host_and_port, host, port);
    free(host_and_port);
    if (result != 0) {
      return result;
    }

    result = URL_parse_abs_path_and_query(p, abs_path, query);
    if (result != 0) {
      free(*host);
      *host = NULL;
      return result;
    }
  }
  else {
    /* abs_path */
    *host = NULL;
    *port = 80;
    result = URL_parse_abs_path_and_query(url, abs_path, query);
    if (result != 0) {
      return result;
    }
  }
  result = 0;
  return result;
}
