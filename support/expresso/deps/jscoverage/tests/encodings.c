/*
    encodings.c - test handling different character encodings
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

#include <assert.h>
#include <string.h>

#include "encoding.h"
#include "stream.h"

int main(void) {
  jschar * characters;
  size_t num_characters; 
  int result;

  /* e, e grave, e acute, e circumflex */
  uint8_t utf8[] = {
    'e',
    0xc3,
    0xa8,
    0xc3,
    0xa9,
    0xc3,
    0xaa,
  };

  result = jscoverage_bytes_to_characters("UTF-8", utf8, 7, &characters, &num_characters);

#if HAVE_ICONV || HAVE_MULTIBYTETOWIDECHAR
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  /*
  BOM is 0xfeff
  = 1111 1110 1111 1111
  UTF: 1110---- 10------ 10------
     = 11101111 10111011 10111111
     = EF BB BF
  */
  uint8_t utf8_with_bom[] = {
    0xef,
    0xbb,
    0xbf,
    'e',
    0xc3,
    0xa8,
    0xc3,
    0xa9,
    0xc3,
    0xaa,
  };

  result = jscoverage_bytes_to_characters("UTF-8", utf8_with_bom, 10, &characters, &num_characters);

#if HAVE_ICONV || HAVE_MULTIBYTETOWIDECHAR
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  uint8_t utf16be[] = {
    0, 'e',
    0, 0xe8,
    0, 0xe9,
    0, 0xea,
  };

  result = jscoverage_bytes_to_characters("UTF-16BE", utf16be, 8, &characters, &num_characters);

#ifdef HAVE_ICONV
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  uint8_t utf16be_with_bom[] = {
    0xfe, 0xff,
    0, 'e',
    0, 0xe8,
    0, 0xe9,
    0, 0xea,
  };

  result = jscoverage_bytes_to_characters("UTF-16BE", utf16be_with_bom, 10, &characters, &num_characters);

#ifdef HAVE_ICONV
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  uint8_t utf16le[] = {
    'e', 0,
    0xe8, 0,
    0xe9, 0,
    0xea, 0,
  };

  result = jscoverage_bytes_to_characters("UTF-16LE", utf16le, 8, &characters, &num_characters);

#ifdef HAVE_ICONV
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  uint8_t utf16le_with_bom[] = {
    0xff, 0xfe,
    'e', 0,
    0xe8, 0,
    0xe9, 0,
    0xea, 0,
  };

  result = jscoverage_bytes_to_characters("UTF-16LE", utf16le_with_bom, 10, &characters, &num_characters);

#ifdef HAVE_ICONV
  assert(result == 0);
  assert(num_characters == 4);
  assert(characters[0] == 'e');
  assert(characters[1] == 0xe8);
  assert(characters[2] == 0xe9);
  assert(characters[3] == 0xea);

  free(characters);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  /* bogus encoding */
  uint8_t bogus[] = {'b', 'o', 'g', 'u', 's'};

  result = jscoverage_bytes_to_characters("BOGUS", bogus, 5, &characters, &num_characters);

  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);

#ifdef HAVE_ICONV
  /* malformed US-ASCII */
  /* NOTE: Windows simply discards the high bit */
  uint8_t malformed_ascii[] = {
    'e',
    0xe8,
    0xe9,
    0xea,
  };

  result = jscoverage_bytes_to_characters("US-ASCII", malformed_ascii, 4, &characters, &num_characters);

  assert(result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE);
#endif

  /* malformed UTF-8 */
  uint8_t malformed_utf8[] = {
    'e',
    0xe8,
    0xe9,
    0xea,
  };

  result = jscoverage_bytes_to_characters("UTF-8", malformed_utf8, 4, &characters, &num_characters);

#if HAVE_ICONV || HAVE_MULTIBYTETOWIDECHAR
  assert(result == JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE);
#else
  assert(result == JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED);
#endif

  return 0;
}
