/*
    util.c - general purpose utility routines
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

#define _GNU_SOURCE

#include <config.h>

#include "util.h"

#include <assert.h>
#include <errno.h>
#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <strings.h>

#include <dirent.h>
#include <libgen.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

const char * program = NULL;

void fatal(const char * format, ...) {
  fprintf(stderr, "%s: ", program);
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
  fputc('\n', stderr);
  exit(EXIT_FAILURE);
}

void fatal_command_line(const char * format, ...) {
  fprintf(stderr, "%s: ", program);
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
  fputc('\n', stderr);
  fprintf(stderr, "Try `%s --help' for more information.\n", program);
  exit(EXIT_FAILURE);
}

void fatal_source(const char * source_file, unsigned int line_number, const char * format, ...) {
  fprintf(stderr, "%s:%s:%u: ", program, source_file, line_number);
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
  fputc('\n', stderr);
  exit(EXIT_FAILURE);
}

void warn_source(const char * source_file, unsigned int line_number, const char * format, ...) {
  fprintf(stderr, "%s:%s:%u: ", program, source_file, line_number);
  va_list ap;
  va_start(ap, format);
  vfprintf(stderr, format, ap);
  va_end(ap);
  fputc('\n', stderr);
}

void version(void) {
  printf("%s %s\n", program, VERSION);
  printf("Character encoding support: ");
#if HAVE_ICONV
  printf("iconv\n");
#elif HAVE_MULTIBYTETOWIDECHAR
  printf("MultiByteToWideChar\n");
#else
  printf("none\n");
#endif
  exit(EXIT_SUCCESS);
}

size_t addst(size_t x, size_t y) {
  if (SIZE_MAX - x < y) {
    fatal("integer overflow");
  }
  return x + y;
}

size_t mulst(size_t x, size_t y) {
  if (x == 0 || y == 0) {
    return 0;
  }
  if (SIZE_MAX / x < y) {
    fatal("integer overflow");
  }
  return x * y;
}

void * xmalloc(size_t size) {
  void * result = malloc(size);
  if (result == NULL) {
    fatal("out of memory");
  }
  return result;
}

void * xrealloc(void * p, size_t size) {
  void * result = realloc(p, size);
  if (result == NULL) {
    fatal("out of memory");
  }
  return result;
}

char * xstrdup(const char * s) {
  char * result = strdup(s);
  if (result == NULL) {
    fatal("out of memory");
  }
  return result;
}

char * xstrndup(const char * s, size_t size) {
  char * result = strndup(s, size);
  if (result == NULL) {
    fatal("out of memory");
  }
  return result;
}

int xasprintf(char ** s, const char * template, ...) {
  va_list a;
  va_start(a, template);
  int result = vasprintf(s, template, a);
  va_end(a);
  if (result < 0) {
    fatal("out of memory");
  }
  return result;
}

char * xgetcwd(void) {
  char * result = getcwd(NULL, 0);
  if (result == NULL) {
    fatal("out of memory");
  }
  return result;
}

FILE * xfopen(const char * file, const char * mode) {
  FILE * result = fopen(file, mode);
  if (result == NULL) {
    fatal("cannot open file: %s", file);
  }
  return result;
}

DIR * xopendir(const char * directory) {
  DIR * result = opendir(directory);
  if (result == NULL) {
    fatal("cannot open directory: %s", directory);
  }
  return result;
}

void xlstat(const char * file, struct stat * buf) {
#ifdef _WIN32
  return xstat(file, buf);
#else
  if (lstat(file, buf) == -1) {
    fatal("cannot stat file: %s", file);
  }
#endif
}

void xstat(const char * file, struct stat * buf) {
  if (stat(file, buf) == -1) {
    fatal("cannot stat file: %s", file);
  }
}

void xmkdir(const char * directory) {
  int result;
#ifdef _WIN32
  result = mkdir(directory);
#else
  result = mkdir(directory, 0755);
#endif
  if (result == -1) {
    fatal("cannot create directory: %s", directory);
  }
}

void mkdir_if_necessary(const char * directory) {
  struct stat buf;
  if (stat(directory, &buf) == 0) {
    if (! S_ISDIR(buf.st_mode)) {
      fatal("not a directory: %s", directory);
    }
  }
  else {
    if (errno == ENOENT) {
      xmkdir(directory);
    }
    else {
      fatal("cannot stat directory: %s", directory);
    }
  }
}

void mkdirs(const char * directory) {
  char * d = xmalloc(strlen(directory) + 1);
  for (const char * p = directory; *p != '\0'; p++) {
    if (*p == '/' && p > directory) {
      strncpy(d, directory, p - directory);
      d[p - directory] = '\0';
      mkdir_if_necessary(d);
    }
  }
  mkdir_if_necessary(directory);
  free(d);
}

void xchdir(const char * directory) {
  if (chdir(directory) == -1) {
    fatal("cannot change directory: %s", directory);
  }
}

bool str_starts_with(const char * string, const char * prefix) {
  const char * string_ptr = string;
  const char * prefix_ptr = prefix;
  while (*string_ptr != '\0' && *prefix_ptr != '\0') {
    if (*string_ptr != *prefix_ptr) {
      return false;
    }
    string_ptr++;
    prefix_ptr++;
  }
  if (*string_ptr == '\0' && *prefix_ptr != '\0') {
    return false;
  }
  return true;
}

bool str_ends_with(const char * string, const char * suffix) {
  size_t string_length = strlen(string);
  size_t suffix_length = strlen(suffix);
  if (string_length < suffix_length) {
    return false;
  }
  return strcmp(string + string_length - suffix_length, suffix) == 0;
}

char * make_path(const char * parent, const char * relative_path) {
  size_t parent_length = strlen(parent);
  size_t relative_path_length = strlen(relative_path);
  size_t result_length = addst(parent_length, relative_path_length);
  result_length = addst(result_length, 2);
  char * result = xmalloc(result_length);
  strcpy(result, parent);
  result[parent_length] = '/';
  strcpy(result + parent_length + 1, relative_path);
  return result;
}

char * make_canonical_path(const char * relative_path) {
  char * original_directory = xgetcwd();
  char * base = make_basename(relative_path);
  char * dir = make_dirname(relative_path);

  xchdir(dir);
  char * canonical_dir = xgetcwd();
  char * result = make_path(canonical_dir, base);

  free(canonical_dir);
  free(base);
  free(dir);
  xchdir(original_directory);
  free(original_directory);

  return result;
}

char * make_basename(const char * path) {
  char * copy = xstrdup(path);
  char * result = xstrdup(basename(copy));
  free(copy);
  return result;
}

char * make_dirname(const char * path) {
  char * copy = xstrdup(path);
  char * result = xstrdup(dirname(copy));
  free(copy);
  return result;
}

int is_same_file(const char * file1, const char * file2) {
#ifdef _WIN32
#define FILECMP strcasecmp
#else
#define FILECMP strcmp
#endif
  if (FILECMP(file1, file2) == 0) {
    return 1;
  }

  char * canonical1 = make_canonical_path(file1);
  char * canonical2 = make_canonical_path(file2);
  int cmp = FILECMP(canonical1, canonical2);
  free(canonical1);
  free(canonical2);
  if (cmp == 0) {
    return 1;
  }

#ifndef _WIN32
  struct stat buf1;
  if (stat(file1, &buf1) == -1) {
    if (errno == ENOENT) {
      return 0;
    }
    else {
      fatal("cannot stat file: %s", file1);
    }
  }
  struct stat buf2;
  if (stat(file2, &buf2) == -1) {
    if (errno == ENOENT) {
      return 0;
    }
    else {
      fatal("cannot stat file: %s", file2);
    }
  }
  if (buf1.st_dev == buf2.st_dev &&
      buf1.st_ino == buf2.st_ino) {
    return 1;
  }
#endif
  return 0;
#undef FILECMP
}

int contains_file(const char * file1, const char * file2) {
  int result = 0;
  char * ancestor = make_canonical_path(file1);
  char * d = make_canonical_path(file2);
  char * parent = make_dirname(d);
  while (strcmp(d, parent) != 0) {
    if (is_same_file(ancestor, parent)) {
      result = 1;
      break;
    }
    free(d);
    d = parent;
    parent = make_dirname(d);
  }
  free(d);
  free(parent);
  free(ancestor);
  return result;
}

void copy_stream(FILE * source, FILE * destination) {
  unsigned char buffer[8192];
  for (;;) {
    int bytes_read = fread(buffer, 1, sizeof(buffer), source);
    if (bytes_read == 0) {
      break;
    }
    fwrite(buffer, 1, bytes_read, destination);
  }
}

void copy_file(const char * source_file, const char * destination_file) {
  FILE * source = xfopen(source_file, "rb");
  FILE * destination = xfopen(destination_file, "wb");

  copy_stream(source, destination);

#ifndef _WIN32
  /* copy permissions */
  struct stat buf;
  if (fstat(fileno(source), &buf) == -1) {
    fatal("cannot stat file: %s", source_file);
  }
  fchmod(fileno(destination), buf.st_mode);
#endif

  fclose(source);
  fclose(destination);
}

bool directory_is_empty(const char * directory) {
  bool result = true;
  DIR * dir = xopendir(directory);
  struct dirent * e;
  while ((e = readdir(dir)) != NULL) {
    if (strcmp(e->d_name, ".") != 0 &&
        strcmp(e->d_name, "..") != 0) {
      result = false;
      break;
    }
  }
  closedir(dir);
  return result;
}

static struct DirListEntry * recursive_dir_list(const char * root, const char * directory_wrt_root, struct DirListEntry * head) {
  char * directory = directory_wrt_root == NULL? xstrdup(root): make_path(root, directory_wrt_root);
  DIR * dir = xopendir(directory);
  struct dirent * e;
  while ((e = readdir(dir)) != NULL) {
    if (strcmp(e->d_name, ".") == 0 ||
        strcmp(e->d_name, "..") == 0) {
      continue;
    }
    char * entry = make_path(directory, e->d_name);
    char * entry_wrt_root = directory_wrt_root == NULL? xstrdup(e->d_name): make_path(directory_wrt_root, e->d_name);
    struct stat buf;
    xlstat(entry, &buf);
    if (S_ISREG(buf.st_mode)) {
      struct DirListEntry * p = xmalloc(sizeof(struct DirListEntry));
      p->name = entry_wrt_root;
      p->next = head;
      head = p;
    }
    else if (S_ISDIR(buf.st_mode)) {
      head = recursive_dir_list(root, entry_wrt_root, head);
      free(entry_wrt_root);
    }
#ifndef _WIN32
    else if (S_ISLNK(buf.st_mode)) {
      /* check what it points to */
      xstat(entry, &buf);
      if (S_ISREG(buf.st_mode)) {
        struct DirListEntry * p = xmalloc(sizeof(struct DirListEntry));
        p->name = entry_wrt_root;
        p->next = head;
        head = p;
      }
      else {
        fatal("refusing to follow symbolic link: %s", entry);
      }
    }
#endif
    else {
      fatal("unknown file type: %s", entry);
    }
    free(entry);
  }
  closedir(dir);
  free(directory);
  return head;
}

struct DirListEntry * make_recursive_dir_list(const char * directory) {
  return recursive_dir_list(directory, NULL, NULL);
}

void free_dir_list(struct DirListEntry * list) {
  while (list != NULL) {
    struct DirListEntry * next = list->next;
    free(list->name);
    free(list);
    list = next;
  }
}

#ifndef HAVE_STRNDUP
char * strndup(const char * s, size_t size) {
  size_t length = strlen(s);
  if (length > size) {
    char * result = xmalloc(size + 1);
    strncpy(result, s, size);
    result[size] = '\0';
    return result;
  }
  else {
    char * result = xmalloc(length + 1);
    strcpy(result, s);
    return result;
  }
}
#endif

#ifndef HAVE_VASPRINTF
int vasprintf(char ** s, const char * template, va_list a) {
  int size = 100;
  *s = malloc(size);
  if (*s == NULL) {
    return -1;
  }

  va_list copy;
  va_copy(copy, a);
  int result = vsnprintf(*s, size, template, copy);
  if (result >= size) {
    int new_size = result;
    if (new_size == INT_MAX) {
      free(*s);
      return -1;
    }
    new_size++;
    char * new_s = realloc(*s, new_size);
    if (new_s == NULL) {
      free(*s);
      return -1;
    }
    *s = new_s;
    size = new_size;
    va_copy(copy, a);
    result = vsnprintf(*s, size, template, copy);
    assert(result == size - 1);
  }
  else if (result == -1) {
    while (result == -1) {
      if (size == INT_MAX) {
        free(*s);
        return -1;
      }
      int new_size;
      if (size > INT_MAX / 2) {
        new_size = INT_MAX;
      }
      else {
        new_size = 2 * size;
      }
      char * new_s = realloc(*s, new_size);
      if (new_s == NULL) {
        free(*s);
        return -1;
      }
      *s = new_s;
      size = new_size;
      va_copy(copy, a);
      result = vsnprintf(*s, size, template, copy);
    }
    assert(result <= size - 1);
  }

  return result;
}
#endif

#ifndef HAVE_ASPRINTF
int asprintf(char ** s, const char * template, ...) {
  va_list a;
  va_start(a, template);
  int result = vasprintf(s, template, a);
  va_end(a);
  return result;
}
#endif
