/*
    stream.h - `Stream' object
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

#ifndef STREAM_H_
#define STREAM_H_

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct Stream {
  uint8_t * data;
  size_t length;
  size_t capacity;
} Stream;

Stream * Stream_new(size_t capacity);

void Stream_write(Stream * stream, const void * p, size_t size);

void Stream_write_string(Stream * stream, const char * s);

void Stream_write_char(Stream * stream, char c);

void Stream_printf(Stream * stream, const char * format, ...) __attribute__((format(printf, 2, 3)));

void Stream_write_file_contents(Stream * stream, FILE * f);

void Stream_reset(Stream * stream);

void Stream_delete(Stream * stream);

#ifdef __cplusplus
}
#endif

#endif /* STREAM_H_ */
