/*
    encoding.h - character encoding
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

#ifndef ENCODING_H_
#define ENCODING_H_

#include <stdint.h>
#include <stdlib.h>

#include <jsapi.h>

#define JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED (-1)
#define JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE (-2)

int jscoverage_bytes_to_characters(const char * encoding, const uint8_t * bytes, size_t num_bytes, jschar ** characters, size_t * num_characters);

#endif /* ENCODING_H_ */
