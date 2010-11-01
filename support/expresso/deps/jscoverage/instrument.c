/*
    instrument.c - file and directory instrumentation routines
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

#include "instrument.h"

#include <assert.h>
#include <errno.h>
#include <string.h>

#include <dirent.h>
#include <sys/stat.h>
#include <sys/types.h>

#include "encoding.h"
#include "global.h"
#include "instrument-js.h"
#include "resource-manager.h"
#include "util.h"

static int g_verbose = 0;

static int string_ends_with(const char * s, const char * suffix) {
  size_t length = strlen(s);
  size_t suffix_length = strlen(suffix);
  if (length < suffix_length) {
    return 0;
  }
  return strcasecmp(s + (length - suffix_length), suffix) == 0;
}

static enum FileType get_file_type(const char * file) {
  if (string_ends_with(file, ".js")) {
    return FILE_TYPE_JS;
  }
  else if (string_ends_with(file, ".html") || string_ends_with(file, ".htm")) {
    return FILE_TYPE_HTML;
  }
  else {
    return FILE_TYPE_OTHER;
  }
}

static void check_same_file(const char * file1, const char * file2) {
  if (is_same_file(file1, file2)) {
    fatal("source and destination are the same");
  }
}

static void check_contains_file(const char * file1, const char * file2) {
  if (contains_file(file1, file2)) {
    fatal("%s contains %s", file1, file2);
  }
}

static void instrument_file(const char * source_file, const char * destination_file, const char * id, int instrumenting) {
  if (g_verbose) {
    printf("Instrumenting file %s\n", id);
  }

  /* check if they are the same */
  char * canonical_source_file = make_canonical_path(source_file);
  char * canonical_destination_file = make_canonical_path(destination_file);
  check_same_file(canonical_source_file, canonical_destination_file);
  free(canonical_source_file);
  free(canonical_destination_file);

  if (instrumenting) {
    enum FileType file_type = get_file_type(source_file);
    switch (file_type) {
    case FILE_TYPE_OTHER:
    case FILE_TYPE_HTML:
      copy_file(source_file, destination_file);
      break;
    case FILE_TYPE_JS:
      {
        FILE * input = xfopen(source_file, "rb");
        FILE * output = xfopen(destination_file, "wb");

        Stream * input_stream = Stream_new(0);
        Stream * output_stream = Stream_new(0);

        Stream_write_file_contents(input_stream, input);

        size_t num_characters = input_stream->length;
        uint16_t * characters = NULL;
        int result = jscoverage_bytes_to_characters(jscoverage_encoding, input_stream->data, input_stream->length, &characters, &num_characters);
        if (result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED) {
          fatal("encoding %s not supported", jscoverage_encoding);
        }
        else if (result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE) {
          fatal("error decoding %s in file %s", jscoverage_encoding, id);
        }
        jscoverage_instrument_js(id, characters, num_characters, output_stream);
        free(characters);

        if (fwrite(output_stream->data, 1, output_stream->length, output) != output_stream->length) {
          fatal("cannot write to file: %s", destination_file);
        }

        Stream_delete(input_stream);
        Stream_delete(output_stream);

        fclose(input);
        fclose(output);
      }
      break;
    }
  }
  else {
    copy_file(source_file, destination_file);
  }
}

void jscoverage_instrument(const char * source,
                           const char * destination,
                           int verbose,
                           char ** exclude,
                           int num_exclude,
                           char ** no_instrument,
                           int num_no_instrument)
{
  assert(source != NULL);
  assert(destination != NULL);

  g_verbose = verbose;

  /* check if they are the same */
  check_same_file(source, destination);

  /* check if source directory is an ancestor of destination directory */
  check_contains_file(source, destination);

  /* check that the source exists and is a directory */
  struct stat buf;
  xstat(source, &buf);
  if (! S_ISDIR(buf.st_mode)) {
    fatal("not a directory: %s", source);
  }

  /* if the destination directory exists, check that it is a jscoverage directory */
  if (stat(destination, &buf) == 0) {
    /* it exists */
    if (! S_ISDIR(buf.st_mode)) {
      fatal("not a directory: %s", destination);
    }
    if (! directory_is_empty(destination)) {
      char * expected_file = NULL;
      if (jscoverage_mozilla) {
        char * modules_directory = make_path(destination, "modules");
        expected_file = make_path(modules_directory, "jscoverage.jsm");
        free(modules_directory);
      }
      else {
        expected_file = make_path(destination, "jscoverage.html");
      }
      if (stat(expected_file, &buf) == -1) {
        fatal("refusing to overwrite directory: %s", destination);
      }
      free(expected_file);
    }
  }
  else if (errno == ENOENT) {
    xmkdir(destination);
  }
  else {
    fatal("cannot stat directory: %s", destination);
  }

  /* finally: copy the directory */
  struct DirListEntry * list = make_recursive_dir_list(source);
  for (struct DirListEntry * p = list; p != NULL; p = p->next) {
    char * s = make_path(source, p->name);
    char * d = make_path(destination, p->name);

    /* check if it's on the exclude list */
    for (int i = 0; i < num_exclude; i++) {
      char * x = make_path(source, exclude[i]);
      if (is_same_file(x, s) || contains_file(x, s)) {
        free(x);
        goto cleanup;
      }
      free(x);
    }

    char * dd = make_dirname(d);
    mkdirs(dd);
    free(dd);

    int instrument_this = 1;

    /* check if it's on the no-instrument list */
    for (int i = 0; i < num_no_instrument; i++) {
      char * ni = make_path(source, no_instrument[i]);
      if (is_same_file(ni, s) || contains_file(ni, s)) {
        instrument_this = 0;
      }
      free(ni);
    }

    instrument_file(s, d, p->name, instrument_this);

  cleanup:
    free(s);
    free(d);
  }

  free_dir_list(list);
}
