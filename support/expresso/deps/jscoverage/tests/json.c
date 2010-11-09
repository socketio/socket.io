/*
    json.c - test JSON manipulation
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

#include "instrument-js.h"
#include "stream.h"
#include "util.h"

bool jscoverage_highlight = true;

int main(void) {
  jscoverage_init();

  Stream * stream = Stream_new(0);

  FILE * f = xfopen("store.json", "r");
  Stream_write_file_contents(stream, f);
  fclose(f);

  Coverage * coverage = Coverage_new();
  int result = jscoverage_parse_json(coverage, stream->data, stream->length);
  assert(result == 0);

  Coverage_delete(coverage);
  Stream_delete(stream);
  jscoverage_cleanup();

  exit(EXIT_SUCCESS);
}
