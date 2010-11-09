/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
/*
** Pathname subroutines.
**
** Brendan Eich, 8/29/95
*/
#include <assert.h>
#include <sys/types.h>
#include <dirent.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include "pathsub.h"

#ifdef USE_REENTRANT_LIBC
#include <libc_r.h>
#endif

#ifdef SUNOS4
#include "sunos4.h"
#endif

#ifndef D_INO
#define D_INO	d_ino
#endif

char *program;

void
fail(char *format, ...)
{
    int error;
    va_list ap;

#ifdef USE_REENTRANT_LIBC
    R_STRERROR_INIT_R();
#endif

    error = errno;
    fprintf(stderr, "%s: ", program);
    va_start(ap, format);
    vfprintf(stderr, format, ap);
    va_end(ap);
    if (error) {

#ifdef USE_REENTRANT_LIBC
    R_STRERROR_R(errno);
	fprintf(stderr, ": %s", r_strerror_r);
#else
	fprintf(stderr, ": %s", strerror(errno));
#endif
    }

    putc('\n', stderr);
    exit(1);
}

char *
getcomponent(char *path, char *name)
{
    if (*path == '\0')
	return 0;
    if (*path == '/') {
	*name++ = '/';
    } else {
	do {
	    *name++ = *path++;
	} while (*path != '/' && *path != '\0');
    }
    *name = '\0';
    while (*path == '/')
	path++;
    return path;
}

#ifdef LAME_READDIR
#include <sys/param.h>
/*
** The static buffer in Unixware's readdir is too small.
*/
struct dirent *readdir(DIR *d)
{
        static struct dirent *buf = NULL;

        if(buf == NULL)
                buf = (struct dirent *) malloc(sizeof(struct dirent) + MAXPATHLEN);
        return(readdir_r(d, buf));
}
#endif

char *
ino2name(ino_t ino, char *dir)
{
    DIR *dp;
    struct dirent *ep;
    char *name;

    dp = opendir("..");
    if (!dp)
	fail("cannot read parent directory");
    for (;;) {
	if (!(ep = readdir(dp)))
	    fail("cannot find current directory");
	if (ep->D_INO == ino)
	    break;
    }
    name = xstrdup(ep->d_name);
    closedir(dp);
    return name;
}

void *
xmalloc(size_t size)
{
    void *p = malloc(size);
    if (!p)
	fail("cannot allocate %u bytes", size);
    return p;
}

char *
xstrdup(char *s)
{
    return strcpy(xmalloc(strlen(s) + 1), s);
}

char *
xbasename(char *path)
{
    char *cp;

    while ((cp = strrchr(path, '/')) && cp[1] == '\0')
	*cp = '\0';
    if (!cp) return path;
    return cp + 1;
}

void
xchdir(char *dir)
{
    if (chdir(dir) < 0)
	fail("cannot change directory to %s", dir);
}

int
relatepaths(char *from, char *to, char *outpath)
{
    char *cp, *cp2;
    int len;
    char buf[NAME_MAX];

    assert(*from == '/' && *to == '/');
    for (cp = to, cp2 = from; *cp == *cp2; cp++, cp2++)
	if (*cp == '\0')
	    break;
    while (cp[-1] != '/')
	cp--, cp2--;
    if (cp - 1 == to) {
	/* closest common ancestor is /, so use full pathname */
	len = strlen(strcpy(outpath, to));
	if (outpath[len] != '/') {
	    outpath[len++] = '/';
	    outpath[len] = '\0';
	}
    } else {
	len = 0;
	while ((cp2 = getcomponent(cp2, buf)) != 0) {
	    strcpy(outpath + len, "../");
	    len += 3;
	}
	while ((cp = getcomponent(cp, buf)) != 0) {
	    sprintf(outpath + len, "%s/", buf);
	    len += strlen(outpath + len);
	}
    }
    return len;
}

void
reversepath(char *inpath, char *name, int len, char *outpath)
{
    char *cp, *cp2;
    char buf[NAME_MAX];
    struct stat sb;

    cp = strcpy(outpath + PATH_MAX - (len + 1), name);
    cp2 = inpath;
    while ((cp2 = getcomponent(cp2, buf)) != 0) {
	if (strcmp(buf, ".") == 0)
	    continue;
	if (strcmp(buf, "..") == 0) {
	    if (stat(".", &sb) < 0)
		fail("cannot stat current directory");
	    name = ino2name(sb.st_ino, "..");
	    len = strlen(name);
	    cp -= len + 1;
	    strcpy(cp, name);
	    cp[len] = '/';
	    free(name);
	    xchdir("..");
	} else {
	    cp -= 3;
	    strncpy(cp, "../", 3);
	    xchdir(buf);
	}
    }
    strcpy(outpath, cp);
}
