/*
    util.h - general purpose utility routines
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

#ifndef UTIL_H_
#define UTIL_H_

#ifndef HAVE_VASPRINTF
#include <stdarg.h>
#endif
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

#include <sys/stat.h>

#ifdef __cplusplus
extern "C" {
#endif

extern const char * program;

void fatal(const char * format, ...)
  __attribute__((__noreturn__))
  __attribute__((__format__(printf, 1, 2)));

void fatal_command_line(const char * format, ...)
  __attribute__((__noreturn__))
  __attribute__((__format__(printf, 1, 2)));

void fatal_source(const char * source_file, unsigned int line_number, const char * format, ...)
  __attribute__((__noreturn__))
  __attribute__((__format__(printf, 3, 4)));

void warn_source(const char * source_file, unsigned int line_number, const char * format, ...)
  __attribute__((__format__(printf, 3, 4)));

void version(void)
  __attribute__((__noreturn__));

size_t addst(size_t x, size_t y);

size_t mulst(size_t x, size_t y);

void * xmalloc(size_t size);

#define xnew(type, count) ((type *) xmalloc(mulst((count), sizeof(type))))

void * xrealloc(void * p, size_t size);

char * xstrdup(const char * s);

char * xstrndup(const char * s, size_t size);

int xasprintf(char ** s, const char * format, ...) __attribute__((__format__(printf, 2, 3)));

char * xgetcwd(void);

FILE * xfopen(const char * file, const char * mode);

void xstat(const char * file, struct stat * buf);

void xlstat(const char * file, struct stat * buf);

void xmkdir(const char * directory);

void mkdir_if_necessary(const char * directory);

void mkdirs(const char * path);

bool str_starts_with(const char * string, const char * prefix);

bool str_ends_with(const char * string, const char * suffix);

char * make_path(const char * parent, const char * relative_path);

char * make_canonical_path(const char * relative_path);

char * make_basename(const char * path);

char * make_dirname(const char * path);

int is_same_file(const char * file1, const char * file2);

int contains_file(const char * file1, const char * file2);

void copy_stream(FILE * source, FILE * destination);

void copy_file(const char * source_file, const char * destination_file);

bool directory_is_empty(const char * directory);

struct DirListEntry {
  char * name;
  struct DirListEntry * next;
};

struct DirListEntry * make_recursive_dir_list(const char * directory);

void free_dir_list(struct DirListEntry * list);

#ifndef HAVE_STRNDUP
char * strndup(const char * s, size_t size);
#endif

#ifndef HAVE_VASPRINTF
int vasprintf(char ** s, const char * format, va_list a);
#endif

#ifndef HAVE_ASPRINTF
int asprintf(char ** s, const char * format, ...) __attribute__((__format__(printf, 2, 3)));
#endif

#ifdef __cplusplus
}
#endif

#endif /* UTIL_H_ */
