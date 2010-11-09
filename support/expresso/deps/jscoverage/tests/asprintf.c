/*
    asprintf.c - test `asprintf' function
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

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include "util.h"

int main(void) {
  int result;
  char * s;

  result = asprintf(&s, "%s %d %c", "abc", 123, 'x');
  assert(result == 9);
  assert(strcmp("abc 123 x", s) == 0);
  free(s);

  char * long_string = "abcdefghijklmnopqrstuvwxyz";
  result = asprintf(&s, "%s %s %s %s", long_string, long_string, long_string, long_string);
  assert(result == 107);
  assert(strcmp("abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz", s) == 0);
  free(s);

  exit(EXIT_SUCCESS);
}
