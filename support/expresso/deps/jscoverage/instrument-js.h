/*
    instrument-js.h - JavaScript instrumentation routines
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

#ifndef INSTRUMENT_JS_H_
#define INSTRUMENT_JS_H_

/* ISO C99 specifies that C++ code must define this to get UINT16_MAX etc. */
#define __STDC_LIMIT_MACROS
#include <stdint.h>

#include "stream.h"
#include "util.h"

#ifdef __cplusplus
extern "C" {
#endif

enum FileType {
  FILE_TYPE_JS,
  FILE_TYPE_HTML,
  FILE_TYPE_OTHER
};

extern bool jscoverage_mozilla;

void jscoverage_set_js_version(const char * version);

void jscoverage_init(void);

void jscoverage_cleanup(void);

void jscoverage_instrument_js(const char * id, const uint16_t * characters, size_t num_characters, Stream * output);

void jscoverage_copy_resources(const char * destination_directory);

typedef struct Coverage Coverage;

typedef struct FileCoverage {
  char * id;

  int * coverage_lines;
  char ** source_lines;

  /* SpiderMonkey uses uint32 for array lengths */
  uint32_t num_coverage_lines;
  uint32_t num_source_lines;
} FileCoverage;

Coverage * Coverage_new(void);

void Coverage_delete(Coverage * coverage);

typedef void (*CoverageForeachFunction) (const FileCoverage * file_coverage, int i, void * p);

void Coverage_foreach_file(Coverage * coverage, CoverageForeachFunction f, void * p);

int jscoverage_parse_json(Coverage * coverage, const uint8_t * data, size_t length) __attribute__((warn_unused_result));

void jscoverage_write_source(const char * id, const uint16_t * characters, size_t num_characters, Stream * output);

#ifdef __cplusplus
}
#endif

#endif /* INSTRUMENT_JS_H_ */
