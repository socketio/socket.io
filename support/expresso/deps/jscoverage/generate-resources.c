/*
    generate-resources.c - code generator for embedded resources
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

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <sys/stat.h>

int main(int argc, char ** argv) {
  for (int i = 1; i < argc; i++) {
    printf("const unsigned char RESOURCE%d_[] = {\n", i);
    FILE * f = fopen(argv[i], "rb");
    if (f == NULL) {
      fprintf(stderr, "cannot open file %s\n", argv[i]);
      exit(EXIT_FAILURE);
    }
    int c;
    int j = 0;
    while ((c = fgetc(f)) != EOF) {
      if (j % 16 == 0) {
        printf("\n  ");
      }
      printf("0x%02x,", c);
      j++;
    }
    fclose(f);
    printf("\n};\n");
  }

  printf("const struct Resource RESOURCES[] = {\n");
  for (int i = 1; i < argc; i++) {
    printf("  {\n");
    printf("    \"%s\",\n", argv[i]);
    printf("    RESOURCE%d_,\n", i);
    printf("    sizeof(RESOURCE%d_)\n", i);
    printf("  },\n");
  }
  printf("};\n");
  exit(EXIT_SUCCESS);
}
