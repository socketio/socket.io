/*
    resource-manager.c - handles embedded files
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

#include <config.h>

#include "resource-manager.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include "util.h"

#include "resources.c"

const struct Resource * get_resource(const char * name) {
  int num_resources = sizeof(RESOURCES) / sizeof(struct Resource);
  for (int i = 0; i < num_resources; i++) {
    if (strcmp(RESOURCES[i].name, name) == 0) {
      return &RESOURCES[i];
    }
  }
  return NULL;
}

void copy_resource_to_stream(const char * resource, FILE * stream) {
  const struct Resource * r = get_resource(resource);
  assert(r != NULL);
  if (fwrite(r->data, 1, r->length, stream) != r->length) {
    fatal("cannot write to stream");
  }
}

void copy_resource(const char * resource, const char * destination_directory) {
  char * file = make_path(destination_directory, resource);
  char * directory = make_dirname(file);
  mkdirs(directory);
  free(directory);
  FILE * f = xfopen(file, "wb");
  copy_resource_to_stream(resource, f);
  fclose(f);
  free(file);
}
