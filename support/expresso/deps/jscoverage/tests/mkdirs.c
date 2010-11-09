/*
    mkdirs.c - test `mkdirs' function
    Copyright (C) 2007, 2008 siliconforks.com

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

void cleanup(void) {
  system("rm -fr DIR");
}

int main(void) {
  atexit(cleanup);

  system("rm -fr DIR");

  mkdirs("DIR/a/b");

  struct stat buf;
  xstat("DIR/a/b", &buf);
  assert(S_ISDIR(buf.st_mode));

  exit(EXIT_SUCCESS);
}
