/*
    resource-manager.h - handles embedded files
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

#ifndef RESOURCE_MANAGER_H_
#define RESOURCE_MANAGER_H_

#include <stdio.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

struct Resource {
  const char * name;
  const unsigned char * data;
  const size_t length;
};

const struct Resource * get_resource(const char * name);

void copy_resource_to_stream(const char * resource, FILE * stream);

void copy_resource(const char * resource, const char * destination_directory);

#ifdef __cplusplus
}
#endif

#endif /* RESOURCE_MANAGER_H_ */
