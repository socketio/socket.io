/*
    recursive-dir-list.c - test `make_recursive_dir_list' function
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

struct Expected {
  int count;
  const char * name;
};

void cleanup(void) {
  system("rm -fr DIR");
}

void touch(const char * file) {
  FILE * f = fopen(file, "w");
  if (f == NULL) {
    fatal("cannot open file: %s", file);
  }
  fclose(f);
}

void verify(struct Expected * expected, struct DirListEntry * actual, int length) {
  struct DirListEntry * p = actual;
  while (p != NULL) {
    char * name = p->name;
    for (int i = 0; i < length; i++) {
      if (strcmp(expected[i].name, name) == 0) {
        expected[i].count++;
        break;
      }
    }
    p = p->next;
  }

  /* now verify the totals */
  for (int i = 0; i < length; i++) {
    assert(expected[i].count == 1);
  }
}

int main(void) {
  atexit(cleanup);

  system("rm -fr DIR");

  /* simple case */
  xmkdir("DIR");
  xmkdir("DIR/a");
  xmkdir("DIR/a/b");
  xmkdir("DIR/c");
  xmkdir("DIR/d");
  touch("DIR/0");
  touch("DIR/a/1");
  touch("DIR/a/b/2");
  touch("DIR/c/3");
  touch("DIR/c/4");
  /* DIR/d is empty */

  struct Expected expected[] = {
    {0, "c/4"},
    {0, "c/3"},
    {0, "a/b/2"},
    {0, "a/1"},
    {0, "0"},
  };

  struct DirListEntry * list = make_recursive_dir_list("DIR");
  verify(expected, list, sizeof(expected) / sizeof(expected[0]));
  free_dir_list(list);

  exit(EXIT_SUCCESS);
}
