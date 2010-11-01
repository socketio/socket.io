/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=78:
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
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
 * JS File object
 */
#if JS_HAS_FILE_OBJECT

#include "jsstddef.h"
#include "jsfile.h"

/* ----------------- Platform-specific includes and defines ----------------- */
#if defined(XP_WIN) || defined(XP_OS2)
#   include <direct.h>
#   include <io.h>
#   include <sys/types.h>
#   include <sys/stat.h>
#   define FILESEPARATOR        '\\'
#   define FILESEPARATOR2       '/'
#   define CURRENT_DIR          "c:\\"
#   define POPEN                _popen
#   define PCLOSE               _pclose
#elif defined(XP_UNIX) || defined(XP_BEOS)
#   include <strings.h>
#   include <stdio.h>
#   include <stdlib.h>
#   include <unistd.h>
#   define FILESEPARATOR        '/'
#   define FILESEPARATOR2       '\0'
#   define CURRENT_DIR          "/"
#   define POPEN                popen
#   define PCLOSE               pclose
#endif

/* --------------- Platform-independent includes and defines ---------------- */
#include "jsapi.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsdate.h"
#include "jsdbgapi.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jslock.h"
#include "jsobj.h"
#include "jsparse.h"
#include "jsscan.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jsutil.h" /* Added by JSIFY */
#include <string.h>

/* NSPR dependencies */
#include "prio.h"
#include "prerror.h"

#define SPECIAL_FILE_STRING     "Special File"
#define CURRENTDIR_PROPERTY     "currentDir"
#define SEPARATOR_PROPERTY      "separator"
#define FILE_CONSTRUCTOR        "File"
#define PIPE_SYMBOL             '|'

#define ASCII                   0
#define UTF8                    1
#define UCS2                    2

#define asciistring             "text"
#define utfstring               "binary"
#define unicodestring           "unicode"

#define MAX_PATH_LENGTH         1024
#define MODE_SIZE               256
#define NUMBER_SIZE             32
#define MAX_LINE_LENGTH         256
#define URL_PREFIX              "file://"

#define STDINPUT_NAME           "Standard input stream"
#define STDOUTPUT_NAME          "Standard output stream"
#define STDERROR_NAME           "Standard error stream"

#define RESOLVE_PATH            js_canonicalPath        /* js_absolutePath */

/* Error handling */
typedef enum JSFileErrNum {
#define MSG_DEF(name, number, count, exception, format) \
    name = number,
#include "jsfile.msg"
#undef MSG_DEF
    JSFileErr_Limit
#undef MSGDEF
} JSFileErrNum;

#define JSFILE_HAS_DFLT_MSG_STRINGS 1

JSErrorFormatString JSFile_ErrorFormatString[JSFileErr_Limit] = {
#if JSFILE_HAS_DFLT_MSG_STRINGS
#define MSG_DEF(name, number, count, exception, format) \
    { format, count },
#else
#define MSG_DEF(name, number, count, exception, format) \
    { NULL, count },
#endif
#include "jsfile.msg"
#undef MSG_DEF
};

const JSErrorFormatString *
JSFile_GetErrorMessage(void *userRef, const char *locale,
                                                        const uintN errorNumber)
{
    if ((errorNumber > 0) && (errorNumber < JSFileErr_Limit))
        return &JSFile_ErrorFormatString[errorNumber];
    else
        return NULL;
}

#define JSFILE_CHECK_NATIVE(op)                                               \
    if (file->isNative) {                                                     \
        JS_ReportWarning(cx, "Cannot call or access \"%s\" on native file %s",\
                         op, file->path);                                     \
        goto out;                                                             \
    }

#define JSFILE_CHECK_WRITE                                                    \
    if (!file->isOpen) {                                                      \
        JS_ReportWarning(cx,                                                  \
                "File %s is closed, will open it for writing, proceeding",    \
                file->path);                                                  \
        js_FileOpen(cx, obj, file, "write,append,create");                    \
    }                                                                         \
    if (!js_canWrite(cx, file)) {                                             \
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,                \
                             JSFILEMSG_CANNOT_WRITE, file->path);             \
        goto out;                                                             \
    }

#define JSFILE_CHECK_READ                                                     \
    if (!file->isOpen) {                                                      \
        JS_ReportWarning(cx,                                                  \
                "File %s is closed, will open it for reading, proceeding",    \
                file->path);                                                  \
        js_FileOpen(cx, obj, file, "read");                                   \
    }                                                                         \
    if (!js_canRead(cx, file)) {                                              \
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,                \
                             JSFILEMSG_CANNOT_READ, file->path);              \
        goto out;                                                             \
    }

#define JSFILE_CHECK_OPEN(op)                                                 \
    if (!file->isOpen) {                                                      \
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,                \
                             JSFILEMSG_FILE_MUST_BE_OPEN, op);                \
        goto out;                                                             \
    }

#define JSFILE_CHECK_CLOSED(op)                                               \
    if (file->isOpen) {                                                       \
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,                \
                             JSFILEMSG_FILE_MUST_BE_CLOSED, op);              \
        goto out;                                                             \
    }

#define JSFILE_CHECK_ONE_ARG(op)                                              \
    if (argc != 1) {                                                          \
        char str[NUMBER_SIZE];                                                \
        sprintf(str, "%d", argc);                                             \
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,                \
                             JSFILEMSG_EXPECTS_ONE_ARG_ERROR, op, str);       \
        goto out;                                                             \
    }


/*
    Security mechanism, should define a callback for this.
    The parameters are as follows:
    SECURITY_CHECK(JSContext *cx, JSPrincipals *ps, char *op_name, JSFile *file)
    XXX Should this be a real function returning a JSBool result (and getting
    some typesafety help from the compiler?).
*/
#define SECURITY_CHECK(cx, ps, op, file)    \
        /* Define a callback here... */


/* Structure representing the file internally */
typedef struct JSFile {
    char        *path;          /* the path to the file. */
    JSBool      isOpen;
    int32       mode;           /* mode used to open the file: read, write, append, create, etc.. */
    int32       type;           /* Asciiz, utf, unicode */
    char        byteBuffer[3];  /* bytes read in advance by js_FileRead ( UTF8 encoding ) */
    jsint       nbBytesInBuf;   /* number of bytes stored in the buffer above */
    jschar      charBuffer;     /* character read in advance by readln ( mac files only ) */
    JSBool      charBufferUsed; /* flag indicating if the buffer above is being used */
    JSBool      hasRandomAccess;/* can the file be randomly accessed? false for stdin, and
                                 UTF-encoded files. */
    JSBool      hasAutoflush;   /* should we force a flush for each line break? */
    JSBool      isNative;       /* if the file is using OS-specific file FILE type */
    /* We can actually put the following two in a union since they should never be used at the same time */
    PRFileDesc  *handle;        /* the handle for the file, if open.  */
    FILE        *nativehandle;  /* native handle, for stuff NSPR doesn't do. */
    JSBool      isPipe;         /* if the file is really an OS pipe */
} JSFile;

/* a few forward declarations... */
JS_PUBLIC_API(JSObject*) js_NewFileObject(JSContext *cx, char *filename);
static JSBool file_open(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);
static JSBool file_close(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval);

/* New filename manipulation procesures */
/* assumes we don't have leading/trailing spaces */
static JSBool
js_filenameHasAPipe(const char *filename)
{
    if (!filename)
        return JS_FALSE;

    return  filename[0] == PIPE_SYMBOL ||
            filename[strlen(filename) - 1] == PIPE_SYMBOL;
}

static JSBool
js_isAbsolute(const char *name)
{
#if defined(XP_WIN) || defined(XP_OS2)
    return *name && name[1] == ':';
#else
    return (name[0]
#   if defined(XP_UNIX) || defined(XP_BEOS)
            ==
#   else
            !=
#   endif
            FILESEPARATOR);
#endif
}

/*
 * Concatenates base and name to produce a valid filename.
 * Returned string must be freed.
*/
static char*
js_combinePath(JSContext *cx, const char *base, const char *name)
{
    int len = strlen(base);
    char* result = JS_malloc(cx, len + strlen(name) + 2);

    if (!result)
        return NULL;

    strcpy(result, base);

    if (base[len - 1] != FILESEPARATOR && base[len - 1] != FILESEPARATOR2) {
        result[len] = FILESEPARATOR;
        result[len + 1] = '\0';
    }
    strcat(result, name);
    return result;
}

/* Extract the last component from a path name. Returned string must be freed */
static char *
js_fileBaseName(JSContext *cx, const char *pathname)
{
    jsint index, aux;
    char *result;

    index = strlen(pathname)-1;

    /* Chop off trailing seperators. */
    while (index > 0 && (pathname[index]==FILESEPARATOR ||
                         pathname[index]==FILESEPARATOR2)) {
        --index;
    }

    aux = index;

    /* Now find the next separator. */
    while (index >= 0 && pathname[index] != FILESEPARATOR &&
                         pathname[index] != FILESEPARATOR2) {
        --index;
    }

    /* Allocate and copy. */
    result = JS_malloc(cx, aux - index + 1);
    if (!result)
        return NULL;
    strncpy(result, pathname + index + 1, aux - index);
    result[aux - index] = '\0';
    return result;
}

/*
 * Returns everything but the last component from a path name.
 * Returned string must be freed.
 */
static char *
js_fileDirectoryName(JSContext *cx, const char *pathname)
{
    char *result;
    const char *cp, *end;
    size_t pathsize;

    end = pathname + strlen(pathname);
    cp = end - 1;

    /* If this is already a directory, chop off the trailing /s. */
    while (cp >= pathname) {
        if (*cp != FILESEPARATOR && *cp != FILESEPARATOR2)
            break;
        --cp;
    }

    if (cp < pathname && end != pathname) {
        /* There were just /s, return the root. */
        result = JS_malloc(cx, 1 + 1); /* The separator + trailing NUL. */
        result[0] = FILESEPARATOR;
        result[1] = '\0';
        return result;
    }

    /* Now chop off the last portion. */
    while (cp >= pathname) {
        if (*cp == FILESEPARATOR || *cp == FILESEPARATOR2)
            break;
        --cp;
    }

    /* Check if this is a leaf. */
    if (cp < pathname) {
        /* It is, return "pathname/". */
        if (end[-1] == FILESEPARATOR || end[-1] == FILESEPARATOR2) {
            /* Already has its terminating /. */
            return JS_strdup(cx, pathname);
        }

        pathsize = end - pathname + 1;
        result = JS_malloc(cx, pathsize + 1);
        if (!result)
            return NULL;

        strcpy(result, pathname);
        result[pathsize - 1] = FILESEPARATOR;
        result[pathsize] = '\0';

        return result;
    }

    /* Return everything up to and including the seperator. */
    pathsize = cp - pathname + 1;
    result = JS_malloc(cx, pathsize + 1);
    if (!result)
        return NULL;

    strncpy(result, pathname, pathsize);
    result[pathsize] = '\0';

    return result;
}

static char *
js_absolutePath(JSContext *cx, const char * path)
{
    JSObject *obj;
    JSString *str;
    jsval prop;

    if (js_isAbsolute(path)) {
        return JS_strdup(cx, path);
    } else {
        obj = JS_GetGlobalObject(cx);
        if (!JS_GetProperty(cx, obj, FILE_CONSTRUCTOR, &prop)) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_FILE_CONSTRUCTOR_UNDEFINED_ERROR);
            return JS_strdup(cx, path);
        }

        obj = JSVAL_TO_OBJECT(prop);
        if (!JS_GetProperty(cx, obj, CURRENTDIR_PROPERTY, &prop)) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_FILE_CURRENTDIR_UNDEFINED_ERROR);
            return JS_strdup(cx, path);
        }

        str = JS_ValueToString(cx, prop);
        if (!str)
            return JS_strdup(cx, path);

        /* should we have an array of curr dirs indexed by drive for windows? */
        return js_combinePath(cx, JS_GetStringBytes(str), path);
    }
}

/* Side effect: will remove spaces in the beginning/end of the filename */
static char *
js_canonicalPath(JSContext *cx, char *oldpath)
{
    char *tmp;
    char *path = oldpath;
    char *base, *dir, *current, *result;
    jsint c;
    jsint back = 0;
    unsigned int i = 0, j = strlen(path)-1;

    /* This is probably optional */
	/* Remove possible spaces in the beginning and end */
    while (i < j && path[i] == ' ')
        i++;
    while (j >= 0 && path[j] == ' ')
        j--;

    tmp = JS_malloc(cx, j-i+2);
    if (!tmp)
        return NULL;

    strncpy(tmp, path + i, j - i + 1);
    tmp[j - i + 1] = '\0';

    path = tmp;

    /* Pipe support. */
    if (js_filenameHasAPipe(path))
        return path;

    /* file:// support. */
    if (!strncmp(path, URL_PREFIX, strlen(URL_PREFIX))) {
        tmp = js_canonicalPath(cx, path + strlen(URL_PREFIX));
        JS_free(cx, path);
        return tmp;
    }

    if (!js_isAbsolute(path)) {
        tmp = js_absolutePath(cx, path);
        if (!tmp)
            return NULL;
        JS_free(cx, path);
        path = tmp;
    }

    result = JS_strdup(cx, "");

    current = path;

    base = js_fileBaseName(cx, current);
    dir = js_fileDirectoryName(cx, current);

    while (strcmp(dir, current)) {
        if (!strcmp(base, "..")) {
            back++;
        } else {
            if (back > 0) {
                back--;
            } else {
                tmp = result;
                result = JS_malloc(cx, strlen(base) + 1 + strlen(tmp) + 1);
                if (!result)
                    goto out;

                strcpy(result, base);
                c = strlen(result);
                if (*tmp) {
                    result[c] = FILESEPARATOR;
                    result[c + 1] = '\0';
                    strcat(result, tmp);
                }
                JS_free(cx, tmp);
            }
        }
        JS_free(cx, current);
        JS_free(cx, base);
        current = dir;
        base =  js_fileBaseName(cx, current);
        dir = js_fileDirectoryName(cx, current);
    }

    tmp = result;
    result = JS_malloc(cx, strlen(dir)+1+strlen(tmp)+1);
    if (!result)
        goto out;

    strcpy(result, dir);
    c = strlen(result);
    if (tmp[0]!='\0') {
        if ((result[c-1]!=FILESEPARATOR)&&(result[c-1]!=FILESEPARATOR2)) {
            result[c] = FILESEPARATOR;
            result[c+1] = '\0';
        }
        strcat(result, tmp);
    }

out:
    if (tmp)
        JS_free(cx, tmp);
    if (dir)
        JS_free(cx, dir);
    if (base)
        JS_free(cx, base);
    if (current)
        JS_free(cx, current);

    return result;
}

/* -------------------------- Text conversion ------------------------------- */
/* The following is ripped from libi18n/unicvt.c and include files.. */

/*
 * UTF8 defines and macros
 */
#define ONE_OCTET_BASE          0x00    /* 0xxxxxxx */
#define ONE_OCTET_MASK          0x7F    /* x1111111 */
#define CONTINUING_OCTET_BASE   0x80    /* 10xxxxxx */
#define CONTINUING_OCTET_MASK   0x3F    /* 00111111 */
#define TWO_OCTET_BASE          0xC0    /* 110xxxxx */
#define TWO_OCTET_MASK          0x1F    /* 00011111 */
#define THREE_OCTET_BASE        0xE0    /* 1110xxxx */
#define THREE_OCTET_MASK        0x0F    /* 00001111 */
#define FOUR_OCTET_BASE         0xF0    /* 11110xxx */
#define FOUR_OCTET_MASK         0x07    /* 00000111 */
#define FIVE_OCTET_BASE         0xF8    /* 111110xx */
#define FIVE_OCTET_MASK         0x03    /* 00000011 */
#define SIX_OCTET_BASE          0xFC    /* 1111110x */
#define SIX_OCTET_MASK          0x01    /* 00000001 */

#define IS_UTF8_1ST_OF_1(x) (( (x)&~ONE_OCTET_MASK  ) == ONE_OCTET_BASE)
#define IS_UTF8_1ST_OF_2(x) (( (x)&~TWO_OCTET_MASK  ) == TWO_OCTET_BASE)
#define IS_UTF8_1ST_OF_3(x) (( (x)&~THREE_OCTET_MASK) == THREE_OCTET_BASE)
#define IS_UTF8_1ST_OF_4(x) (( (x)&~FOUR_OCTET_MASK ) == FOUR_OCTET_BASE)
#define IS_UTF8_1ST_OF_5(x) (( (x)&~FIVE_OCTET_MASK ) == FIVE_OCTET_BASE)
#define IS_UTF8_1ST_OF_6(x) (( (x)&~SIX_OCTET_MASK  ) == SIX_OCTET_BASE)
#define IS_UTF8_2ND_THRU_6TH(x) \
                    (( (x)&~CONTINUING_OCTET_MASK  ) == CONTINUING_OCTET_BASE)
#define IS_UTF8_1ST_OF_UCS2(x) \
            IS_UTF8_1ST_OF_1(x) \
            || IS_UTF8_1ST_OF_2(x) \
            || IS_UTF8_1ST_OF_3(x)


#define MAX_UCS2            0xFFFF
#define DEFAULT_CHAR        0x003F  /* Default char is "?" */
#define BYTE_MASK           0xBF
#define BYTE_MARK           0x80


/* Function: one_ucs2_to_utf8_char
 *
 * Function takes one UCS-2 char and writes it to a UTF-8 buffer.
 * We need a UTF-8 buffer because we don't know before this
 * function how many bytes of utf-8 data will be written. It also
 * takes a pointer to the end of the UTF-8 buffer so that we don't
 * overwrite data. This function returns the number of UTF-8 bytes
 * of data written, or -1 if the buffer would have been overrun.
 */

#define LINE_SEPARATOR      0x2028
#define PARAGRAPH_SEPARATOR 0x2029
static int16 one_ucs2_to_utf8_char(unsigned char *tobufp,
                                   unsigned char *tobufendp,
                                   uint16 onechar)
{
    int16 numUTF8bytes = 0;

    if (onechar == LINE_SEPARATOR || onechar == PARAGRAPH_SEPARATOR) {
        strcpy((char*)tobufp, "\n");
        return strlen((char*)tobufp);
    }

    if (onechar < 0x80) {
        numUTF8bytes = 1;
    } else if (onechar < 0x800) {
        numUTF8bytes = 2;
    } else {
        /* 0x800 >= onechar <= MAX_UCS2 */
        numUTF8bytes = 3;
    }

    tobufp += numUTF8bytes;

    /* return error if we don't have space for the whole character */
    if (tobufp > tobufendp) {
        return(-1);
    }

    switch(numUTF8bytes) {
      case 3: *--tobufp = (onechar | BYTE_MARK) & BYTE_MASK; onechar >>=6;
              *--tobufp = (onechar | BYTE_MARK) & BYTE_MASK; onechar >>=6;
              *--tobufp = onechar |  THREE_OCTET_BASE;
              break;

      case 2: *--tobufp = (onechar | BYTE_MARK) & BYTE_MASK; onechar >>=6;
              *--tobufp = onechar | TWO_OCTET_BASE;
              break;

      case 1: *--tobufp = (unsigned char)onechar;
              break;
    }

    return numUTF8bytes;
}

/*
 * utf8_to_ucs2_char
 *
 * Convert a utf8 multibyte character to ucs2
 *
 * inputs: pointer to utf8 character(s)
 *         length of utf8 buffer ("read" length limit)
 *         pointer to return ucs2 character
 *
 * outputs: number of bytes in the utf8 character
 *          -1 if not a valid utf8 character sequence
 *          -2 if the buffer is too short
 */
static int16
utf8_to_ucs2_char(const unsigned char *utf8p, int16 buflen, uint16 *ucs2p)
{
    uint16 lead, cont1, cont2;

    /*
     * Check for minimum buffer length
     */
    if ((buflen < 1) || (utf8p == NULL)) {
        return -2;
    }
    lead = (uint16) (*utf8p);

    /*
     * Check for a one octet sequence
     */
    if (IS_UTF8_1ST_OF_1(lead)) {
        *ucs2p = lead & ONE_OCTET_MASK;
        return 1;
    }

    /*
     * Check for a two octet sequence
     */
    if (IS_UTF8_1ST_OF_2(*utf8p)) {
        if (buflen < 2)
            return -2;
        cont1 = (uint16) *(utf8p+1);
        if (!IS_UTF8_2ND_THRU_6TH(cont1))
            return -1;
        *ucs2p =  (lead & TWO_OCTET_MASK) << 6;
        *ucs2p |= cont1 & CONTINUING_OCTET_MASK;
        return 2;
    }

    /*
     * Check for a three octet sequence
     */
    else if (IS_UTF8_1ST_OF_3(lead)) {
        if (buflen < 3)
            return -2;
        cont1 = (uint16) *(utf8p+1);
        cont2 = (uint16) *(utf8p+2);
        if (   (!IS_UTF8_2ND_THRU_6TH(cont1))
            || (!IS_UTF8_2ND_THRU_6TH(cont2)))
            return -1;
        *ucs2p =  (lead & THREE_OCTET_MASK) << 12;
        *ucs2p |= (cont1 & CONTINUING_OCTET_MASK) << 6;
        *ucs2p |= cont2 & CONTINUING_OCTET_MASK;
        return 3;
    }
    else { /* not a valid utf8/ucs2 character */
        return -1;
    }
}

/* ----------------------------- Helper functions --------------------------- */
/* Ripped off from lm_win.c .. */
/* where is strcasecmp?.. for now, it's case sensitive..
 *
 * strcasecmp is in strings.h, but on windows it's called _stricmp...
 * will need to #ifdef this
*/

static int32
js_FileHasOption(JSContext *cx, const char *oldoptions, const char *name)
{
    char *comma, *equal, *current;
    char *options = JS_strdup(cx, oldoptions);
    int32 found = 0;

    current = options;
    for (;;) {
        comma = strchr(current, ',');
        if (comma) *comma = '\0';
        equal = strchr(current, '=');
        if (equal) *equal = '\0';
        if (strcmp(current, name) == 0) {
            if (!equal || strcmp(equal + 1, "yes") == 0)
                found = 1;
            else
                found = atoi(equal + 1);
        }
        if (equal) *equal = '=';
        if (comma) *comma = ',';
        if (found || !comma)
            break;
        current = comma + 1;
    }
    JS_free(cx, options);
    return found;
}

/* empty the buffer */
static void
js_ResetBuffers(JSFile * file)
{
    file->charBufferUsed = JS_FALSE;
    file->nbBytesInBuf = 0;
}

/* Reset file attributes */
static void
js_ResetAttributes(JSFile * file)
{
    file->mode = file->type = 0;
    file->isOpen = JS_FALSE;
    file->handle = NULL;
    file->nativehandle = NULL;
    file->hasRandomAccess = JS_TRUE; /* Innocent until proven guilty. */
    file->hasAutoflush = JS_FALSE;
    file->isNative = JS_FALSE;
    file->isPipe = JS_FALSE;

    js_ResetBuffers(file);
}

static JSBool
js_FileOpen(JSContext *cx, JSObject *obj, JSFile *file, char *mode){
    JSString *type, *mask;
    jsval v[2];
    jsval rval;

    type =  JS_InternString(cx, asciistring);
    mask =  JS_NewStringCopyZ(cx, mode);
    v[0] = STRING_TO_JSVAL(mask);
    v[1] = STRING_TO_JSVAL(type);

    if (!file_open(cx, obj, 2, v, &rval))
        return JS_FALSE;
    return JS_TRUE;
}

/* Buffered version of PR_Read. Used by js_FileRead */
static int32
js_BufferedRead(JSFile *f, unsigned char *buf, int32 len)
{
    int32 count = 0;

    while (f->nbBytesInBuf>0&&len>0) {
        buf[0] = f->byteBuffer[0];
        f->byteBuffer[0] = f->byteBuffer[1];
        f->byteBuffer[1] = f->byteBuffer[2];
        f->nbBytesInBuf--;
        len--;
        buf+=1;
        count++;
    }

    if (len > 0) {
        count += (!f->isNative)
                 ? PR_Read(f->handle, buf, len)
                 : fread(buf, 1, len, f->nativehandle);
    }
    return count;
}

static int32
js_FileRead(JSContext *cx, JSFile *file, jschar *buf, int32 len, int32 mode)
{
    unsigned char *aux;
    int32 count = 0, i;
    jsint remainder;
    unsigned char utfbuf[3];

    if (file->charBufferUsed) {
        buf[0] = file->charBuffer;
        buf++;
        len--;
        file->charBufferUsed = JS_FALSE;
    }

    switch (mode) {
      case ASCII:
        aux = (unsigned char*)JS_malloc(cx, len);
        if (!aux)
            return 0;

        count = js_BufferedRead(file, aux, len);
        if (count == -1) {
            JS_free(cx, aux);
            return 0;
        }

        for (i = 0; i < len; i++)
            buf[i] = (jschar)aux[i];

        JS_free(cx, aux);
        break;

      case UTF8:
        remainder = 0;
        for (count = 0;count<len;count++) {
            i = js_BufferedRead(file, utfbuf+remainder, 3-remainder);
            if (i<=0) {
                return count;
            }
            i = utf8_to_ucs2_char(utfbuf, (int16)i, &buf[count] );
            if (i<0) {
                return count;
            } else {
                if (i==1) {
                    utfbuf[0] = utfbuf[1];
                    utfbuf[1] = utfbuf[2];
                    remainder = 2;
                } else if (i==2) {
                    utfbuf[0] = utfbuf[2];
                    remainder = 1;
                } else if (i==3) {
                    remainder = 0;
                }
            }
        }
        while (remainder>0) {
            file->byteBuffer[file->nbBytesInBuf] = utfbuf[0];
            file->nbBytesInBuf++;
            utfbuf[0] = utfbuf[1];
            utfbuf[1] = utfbuf[2];
            remainder--;
        }
        break;

      case UCS2:
        count = js_BufferedRead(file, (unsigned char *)buf, len * 2) >> 1;
        if (count == -1)
            return 0;

        break;

      default:
        /* Not reached. */
        JS_ASSERT(0);
    }

    if(count == -1) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_OP_FAILED, "read", file->path);
    }

    return count;
}

static int32
js_FileSeek(JSContext *cx, JSFile *file, int32 len, int32 mode)
{
    int32 count = 0, i;
    jsint remainder;
    unsigned char utfbuf[3];
    jschar tmp;

    switch (mode) {
      case ASCII:
        count = PR_Seek(file->handle, len, PR_SEEK_CUR);
        break;

      case UTF8:
        remainder = 0;
        for (count = 0;count<len;count++) {
            i = js_BufferedRead(file, utfbuf+remainder, 3-remainder);
            if (i<=0) {
                return 0;
            }
            i = utf8_to_ucs2_char(utfbuf, (int16)i, &tmp );
            if (i<0) {
                return 0;
            } else {
                if (i==1) {
                    utfbuf[0] = utfbuf[1];
                    utfbuf[1] = utfbuf[2];
                    remainder = 2;
                } else if (i==2) {
                    utfbuf[0] = utfbuf[2];
                    remainder = 1;
                } else if (i==3) {
                    remainder = 0;
                }
            }
        }
        while (remainder>0) {
            file->byteBuffer[file->nbBytesInBuf] = utfbuf[0];
            file->nbBytesInBuf++;
            utfbuf[0] = utfbuf[1];
            utfbuf[1] = utfbuf[2];
            remainder--;
        }
        break;

      case UCS2:
        count = PR_Seek(file->handle, len*2, PR_SEEK_CUR)/2;
        break;

      default:
        /* Not reached. */
        JS_ASSERT(0);
    }

    if(count == -1) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_OP_FAILED, "seek", file->path);
    }

    return count;
}

static int32
js_FileWrite(JSContext *cx, JSFile *file, jschar *buf, int32 len, int32 mode)
{
    unsigned char   *aux;
    int32           count = 0, i, j;
    unsigned char   *utfbuf;

    switch (mode) {
      case ASCII:
        aux = (unsigned char*)JS_malloc(cx, len);
        if (!aux)
            return 0;

        for (i = 0; i<len; i++)
            aux[i] = buf[i] % 256;

        count = (!file->isNative)
                ? PR_Write(file->handle, aux, len)
                : fwrite(aux, 1, len, file->nativehandle);

        if (count==-1) {
            JS_free(cx, aux);
            return 0;
        }

        JS_free(cx, aux);
        break;

      case UTF8:
        utfbuf = (unsigned char*)JS_malloc(cx, len*3);
        if (!utfbuf)  return 0;
        i = 0;
        for (count = 0;count<len;count++) {
            j = one_ucs2_to_utf8_char(utfbuf+i, utfbuf+len*3, buf[count]);
            if (j==-1) {
                JS_free(cx, utfbuf);
                return 0;
            }
            i+=j;
        }
        j = (!file->isNative)
            ? PR_Write(file->handle, utfbuf, i)
            : fwrite(utfbuf, 1, i, file->nativehandle);

        if (j<i) {
            JS_free(cx, utfbuf);
            return 0;
        }
        JS_free(cx, utfbuf);
        break;

      case UCS2:
        count = (!file->isNative)
                ? PR_Write(file->handle, buf, len*2) >> 1
                : fwrite(buf, 1, len*2, file->nativehandle) >> 1;

        if (count == -1)
            return 0;
        break;

      default:
        /* Not reached. */
        JS_ASSERT(0);
    }

    if(count == -1) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_OP_FAILED, "write", file->path);
    }

    return count;
}

/* ----------------------------- Property checkers -------------------------- */
static JSBool
js_exists(JSContext *cx, JSFile *file)
{
    if (file->isNative) {
        /* It doesn't make sense for a pipe of stdstream. */
        return JS_FALSE;
    }

    return PR_Access(file->path, PR_ACCESS_EXISTS) == PR_SUCCESS;
}

static JSBool
js_canRead(JSContext *cx, JSFile *file)
{
    if (!file->isNative) {
        if (file->isOpen && !(file->mode & PR_RDONLY))
            return JS_FALSE;
        return PR_Access(file->path, PR_ACCESS_READ_OK) == PR_SUCCESS;
    }

    if (file->isPipe) {
        /* Is this pipe open for reading? */
        return file->path[0] == PIPE_SYMBOL;
    }

    return !strcmp(file->path, STDINPUT_NAME);
}

static JSBool
js_canWrite(JSContext *cx, JSFile *file)
{
    if (!file->isNative) {
        if (file->isOpen && !(file->mode & PR_WRONLY))
            return JS_FALSE;
        return PR_Access(file->path, PR_ACCESS_WRITE_OK) == PR_SUCCESS;
    }

    if(file->isPipe) {
        /* Is this pipe open for writing? */
        return file->path[strlen(file->path)-1] == PIPE_SYMBOL;
    }

    return !strcmp(file->path, STDOUTPUT_NAME) ||
           !strcmp(file->path, STDERROR_NAME);
}

static JSBool
js_isFile(JSContext *cx, JSFile *file)
{
    if (!file->isNative) {
        PRFileInfo info;

        if (file->isOpen
            ? PR_GetOpenFileInfo(file->handle, &info)
            : PR_GetFileInfo(file->path, &info) != PR_SUCCESS) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_CANNOT_ACCESS_FILE_STATUS, file->path);
            return JS_FALSE;
        }

        return info.type == PR_FILE_FILE;
    }

    /* This doesn't make sense for a pipe of stdstream. */
    return JS_FALSE;
}

static JSBool
js_isDirectory(JSContext *cx, JSFile *file)
{
    if(!file->isNative){
        PRFileInfo info;

        /* Hack needed to get get_property to work. */
        if (!js_exists(cx, file))
            return JS_FALSE;

        if (file->isOpen
            ? PR_GetOpenFileInfo(file->handle, &info)
            : PR_GetFileInfo(file->path, &info) != PR_SUCCESS) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_CANNOT_ACCESS_FILE_STATUS, file->path);
            return JS_FALSE;
        }

        return info.type == PR_FILE_DIRECTORY;
    }

    /* This doesn't make sense for a pipe of stdstream. */
    return JS_FALSE;
}

static jsval
js_size(JSContext *cx, JSFile *file)
{
    PRFileInfo info;

    JSFILE_CHECK_NATIVE("size");

    if (file->isOpen
        ? PR_GetOpenFileInfo(file->handle, &info)
        : PR_GetFileInfo(file->path, &info) != PR_SUCCESS) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_CANNOT_ACCESS_FILE_STATUS, file->path);
        return JSVAL_VOID;
    }

    return INT_TO_JSVAL(info.size);

out:
    return JSVAL_VOID;
}

/*
 * Return the parent object
 */
static JSBool
js_parent(JSContext *cx, JSFile *file, jsval *resultp)
{
    char *str;

    /* Since we only care about pipes and native files, return NULL. */
    if (file->isNative) {
        *resultp = JSVAL_VOID;
        return JS_TRUE;
    }

    str = js_fileDirectoryName(cx, file->path);
    if (!str)
        return JS_FALSE;

    /* If the directory is equal to the original path, we're at the root. */
    if (!strcmp(file->path, str)) {
        *resultp = JSVAL_NULL;
    } else {
        JSObject *obj = js_NewFileObject(cx, str);
        if (!obj) {
            JS_free(cx, str);
            return JS_FALSE;
        }
        *resultp = OBJECT_TO_JSVAL(obj);
    }

    JS_free(cx, str);
    return JS_TRUE;
}

static JSBool
js_name(JSContext *cx, JSFile *file, jsval *vp)
{
    char *name;
    JSString *str;

    if (file->isPipe) {
        *vp = JSVAL_VOID;
        return JS_TRUE;
    }

    name = js_fileBaseName(cx, file->path);
    if (!name)
        return JS_FALSE;

    str = JS_NewString(cx, name, strlen(name));
    if (!str) {
        JS_free(cx, name);
        return JS_FALSE;
    }

    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

/* ------------------------------ File object methods ---------------------------- */
static JSBool
file_open(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString	*strmode, *strtype;
    char        *ctype, *mode;
    int32       mask, type;
    int         len;

    mode = NULL;

    SECURITY_CHECK(cx, NULL, "open", file);

    /* A native file that is already open */
    if(file->isOpen && file->isNative) {
        JS_ReportWarning(cx, "Native file %s is already open, proceeding",
                         file->path);
        goto good;
    }

    /* Close before proceeding */
    if (file->isOpen) {
        JS_ReportWarning(cx, "File %s is already open, we will close it and "
                         "reopen, proceeding", file->path);
        if(!file_close(cx, obj, 0, NULL, rval))
            goto out;
    }

    if (js_isDirectory(cx, file)) {
        JS_ReportWarning(cx, "%s seems to be a directory, there is no point in "
                         "trying to open it, proceeding", file->path);
        goto good;
    }

    /* Path must be defined at this point */
    len = strlen(file->path);

    /* Mode */
    if (argc >= 1) {
        strmode = JS_ValueToString(cx, argv[0]);
        if (!strmode) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_FIRST_ARGUMENT_OPEN_NOT_STRING_ERROR,
                                 argv[0]);
            goto out;
        }
        mode = JS_strdup(cx, JS_GetStringBytes(strmode));
    } else {
        if(file->path[0]==PIPE_SYMBOL) {
            /* pipe default mode */
            mode = JS_strdup(cx, "read");
        } else if(file->path[len-1]==PIPE_SYMBOL) {
            /* pipe default mode */
            mode = JS_strdup(cx, "write");
        } else {
            /* non-destructive, permissive defaults. */
            mode = JS_strdup(cx, "readWrite,append,create");
        }
    }

    /* Process the mode */
    mask = 0;
    /* TODO: this is pretty ugly, we walk thru the string too many times */
    mask |= js_FileHasOption(cx, mode, "read")     ? PR_RDONLY       :   0;
    mask |= js_FileHasOption(cx, mode, "write")    ? PR_WRONLY       :   0;
    mask |= js_FileHasOption(cx, mode, "readWrite")? PR_RDWR         :   0;
    mask |= js_FileHasOption(cx, mode, "append")   ? PR_APPEND       :   0;
    mask |= js_FileHasOption(cx, mode, "create")   ? PR_CREATE_FILE  :   0;
    mask |= js_FileHasOption(cx, mode, "replace")  ? PR_TRUNCATE     :   0;

    if (mask & PR_RDWR)
        mask |= (PR_RDONLY | PR_WRONLY);
    if ((mask & PR_RDONLY) && (mask & PR_WRONLY))
        mask |= PR_RDWR;

    file->hasAutoflush |= js_FileHasOption(cx, mode, "autoflush");

    /* Type */
    if (argc > 1) {
        strtype = JS_ValueToString(cx, argv[1]);
        if (!strtype) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                JSFILEMSG_SECOND_ARGUMENT_OPEN_NOT_STRING_ERROR,
                                 argv[1]);
            goto out;
        }
        ctype = JS_GetStringBytes(strtype);

        if(!strcmp(ctype, utfstring)) {
            type = UTF8;
        } else if (!strcmp(ctype, unicodestring)) {
            type = UCS2;
        } else {
            if (strcmp(ctype, asciistring)) {
                JS_ReportWarning(cx, "File type %s is not supported, using "
                                 "'text' instead, proceeding", ctype);
            }
            type = ASCII;
        }
    } else {
        type = ASCII;
    }

    /* Save the relevant fields */
    file->type = type;
    file->mode = mask;
    file->nativehandle = NULL;
    file->hasRandomAccess = (type != UTF8);

    /*
     * Deal with pipes here. We can't use NSPR for pipes, so we have to use
     * POPEN.
     */
    if (file->path[0]==PIPE_SYMBOL || file->path[len-1]==PIPE_SYMBOL) {
        if (file->path[0] == PIPE_SYMBOL && file->path[len-1] == PIPE_SYMBOL) {
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                 JSFILEMSG_BIDIRECTIONAL_PIPE_NOT_SUPPORTED);
            goto out;
        } else {
            int i = 0;
            char pipemode[3];
            SECURITY_CHECK(cx, NULL, "pipe_open", file);

            if(file->path[0] == PIPE_SYMBOL){
                if(mask & (PR_WRONLY | PR_APPEND | PR_CREATE_FILE | PR_TRUNCATE)){
                    JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                                   JSFILEMSG_OPEN_MODE_NOT_SUPPORTED_WITH_PIPES,
                                         mode, file->path);
                    goto out;
                }
                /* open(SPOOLER, "| cat -v | lpr -h 2>/dev/null") -- pipe for writing */
                pipemode[i++] = 'r';
#ifndef XP_UNIX
                pipemode[i++] = file->type==UTF8 ? 'b' : 't';
#endif
                pipemode[i++] = '\0';
                file->nativehandle = POPEN(&file->path[1], pipemode);
            } else if(file->path[len-1] == PIPE_SYMBOL) {
                char *command = JS_malloc(cx, len);

                strncpy(command, file->path, len-1);
                command[len-1] = '\0';
                /* open(STATUS, "netstat -an 2>&1 |") */
                pipemode[i++] = 'w';
#ifndef XP_UNIX
                pipemode[i++] = file->type==UTF8 ? 'b' : 't';
#endif
                pipemode[i++] = '\0';
                file->nativehandle = POPEN(command, pipemode);
                JS_free(cx, command);
            }
            /* set the flags */
            file->isNative = JS_TRUE;
            file->isPipe  = JS_TRUE;
            file->hasRandomAccess = JS_FALSE;
        }
    } else {
        /* TODO: what about the permissions?? Java ignores the problem... */
        file->handle = PR_Open(file->path, mask, 0644);
    }

    js_ResetBuffers(file);
    JS_free(cx, mode);
    mode = NULL;

    /* Set the open flag and return result */
    if (file->handle == NULL && file->nativehandle == NULL) {
        file->isOpen = JS_FALSE;

        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_OP_FAILED, "open", file->path);
        goto out;
    }

good:
    file->isOpen = JS_TRUE;
    *rval = JSVAL_TRUE;
    return JS_TRUE;

out:
    if(mode)
        JS_free(cx, mode);
    return JS_FALSE;
}

static JSBool
file_close(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile  *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    SECURITY_CHECK(cx, NULL, "close", file);

    if(!file->isOpen){
        JS_ReportWarning(cx, "File %s is not open, can't close it, proceeding",
            file->path);
        goto out;
    }

    if(!file->isPipe){
        if(file->isNative){
            JS_ReportWarning(cx, "Unable to close a native file, proceeding", file->path);
            goto out;
        }else{
            if(file->handle && PR_Close(file->handle)){
                JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                    JSFILEMSG_OP_FAILED, "close", file->path);

                goto out;
            }
        }
    }else{
        if(PCLOSE(file->nativehandle)==-1){
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_OP_FAILED, "pclose", file->path);
            goto out;
        }
    }

    js_ResetAttributes(file);
    *rval = JSVAL_TRUE;
    return JS_TRUE;

out:
    return JS_FALSE;
}


static JSBool
file_remove(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
	JSFile  *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    SECURITY_CHECK(cx, NULL, "remove", file);
    JSFILE_CHECK_NATIVE("remove");
    JSFILE_CHECK_CLOSED("remove");

    if ((js_isDirectory(cx, file) ?
            PR_RmDir(file->path) : PR_Delete(file->path))==PR_SUCCESS) {
        js_ResetAttributes(file);
        *rval = JSVAL_TRUE;
        return JS_TRUE;
    } else {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OP_FAILED, "remove", file->path);
        goto out;
    }
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

/* Raw PR-based function. No text processing. Just raw data copying. */
static JSBool
file_copyTo(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    char        *dest = NULL;
    PRFileDesc  *handle = NULL;
    char        *buffer;
    jsval		count, size;
    JSBool      fileInitiallyOpen=JS_FALSE;

    SECURITY_CHECK(cx, NULL, "copyTo", file);   /* may need a second argument!*/
    JSFILE_CHECK_ONE_ARG("copyTo");
    JSFILE_CHECK_NATIVE("copyTo");
    /* remeber the state */
    fileInitiallyOpen = file->isOpen;
    JSFILE_CHECK_READ;

    dest = JS_GetStringBytes(JS_ValueToString(cx, argv[0]));

    /* make sure we are not reading a file open for writing */
    if (file->isOpen && !js_canRead(cx, file)) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_CANNOT_COPY_FILE_OPEN_FOR_WRITING_ERROR, file->path);
        goto out;
    }

    if (file->handle==NULL){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OP_FAILED, "open", file->path);
        goto out;
    }

    handle = PR_Open(dest, PR_WRONLY|PR_CREATE_FILE|PR_TRUNCATE, 0644);

    if(!handle){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OP_FAILED, "open", dest);
        goto out;
    }

    if ((size=js_size(cx, file))==JSVAL_VOID) {
        goto out;
    }

    buffer = JS_malloc(cx, size);

    count = INT_TO_JSVAL(PR_Read(file->handle, buffer, size));

    /* reading panic */
    if (count!=size) {
        JS_free(cx, buffer);
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
              JSFILEMSG_COPY_READ_ERROR, file->path);
        goto out;
    }

    count = INT_TO_JSVAL(PR_Write(handle, buffer, JSVAL_TO_INT(size)));

    /* writing panic */
    if (count!=size) {
        JS_free(cx, buffer);
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
              JSFILEMSG_COPY_WRITE_ERROR, file->path);
        goto out;
    }

    JS_free(cx, buffer);

	if(!fileInitiallyOpen){
		if(!file_close(cx, obj, 0, NULL, rval)) goto out;
	}

    if(PR_Close(handle)!=PR_SUCCESS){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
              JSFILEMSG_OP_FAILED, "close", dest);
        goto out;
    }

    *rval = JSVAL_TRUE;
    return JS_TRUE;
out:
    if(file->isOpen && !fileInitiallyOpen){
        if(PR_Close(file->handle)!=PR_SUCCESS){
            JS_ReportWarning(cx, "Can't close %s, proceeding", file->path);
        }
    }

    if(handle && PR_Close(handle)!=PR_SUCCESS){
        JS_ReportWarning(cx, "Can't close %s, proceeding", dest);
    }

    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_renameTo(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile  *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    char    *dest;

    SECURITY_CHECK(cx, NULL, "renameTo", file); /* may need a second argument!*/
    JSFILE_CHECK_ONE_ARG("renameTo");
    JSFILE_CHECK_NATIVE("renameTo");
    JSFILE_CHECK_CLOSED("renameTo");

    dest = RESOLVE_PATH(cx, JS_GetStringBytes(JS_ValueToString(cx, argv[0])));

    if (PR_Rename(file->path, dest)==PR_SUCCESS){
        /* copy the new filename */
        JS_free(cx, file->path);
        file->path = dest;
        *rval = JSVAL_TRUE;
        return JS_TRUE;
    }else{
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_RENAME_FAILED, file->path, dest);
        goto out;
    }
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_flush(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    SECURITY_CHECK(cx, NULL, "flush", file);
    JSFILE_CHECK_NATIVE("flush");
    JSFILE_CHECK_OPEN("flush");

    if (PR_Sync(file->handle)==PR_SUCCESS){
      *rval = JSVAL_TRUE;
      return JS_TRUE;
    }else{
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
           JSFILEMSG_OP_FAILED, "flush", file->path);
       goto out;
    }
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_write(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString    *str;
    int32       count;
    uintN       i;

    SECURITY_CHECK(cx, NULL, "write", file);
    JSFILE_CHECK_WRITE;

    for (i = 0; i<argc; i++) {
        str = JS_ValueToString(cx, argv[i]);
        count = js_FileWrite(cx, file, JS_GetStringChars(str),
            JS_GetStringLength(str), file->type);
        if (count==-1){
          *rval = JSVAL_FALSE;
          return JS_FALSE;
        }
    }

    *rval = JSVAL_TRUE;
    return JS_TRUE;
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_writeln(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString    *str;

    SECURITY_CHECK(cx, NULL, "writeln", file);
    JSFILE_CHECK_WRITE;

    /* don't report an error here */
    if(!file_write(cx, obj, argc, argv, rval))  return JS_FALSE;
    /* don't do security here -- we passed the check in file_write */
    str = JS_NewStringCopyZ(cx, "\n");

    if (js_FileWrite(cx, file, JS_GetStringChars(str), JS_GetStringLength(str),
            file->type)==-1){
        *rval = JSVAL_FALSE;
        return JS_FALSE;
    }

    /* eol causes flush if hasAutoflush is turned on */
    if (file->hasAutoflush)
        file_flush(cx, obj, 0, NULL, rval);

    *rval =  JSVAL_TRUE;
    return JS_TRUE;
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_writeAll(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    jsuint      i;
    jsuint      limit;
    JSObject    *array;
    JSObject    *elem;
    jsval       elemval;

    SECURITY_CHECK(cx, NULL, "writeAll", file);
    JSFILE_CHECK_ONE_ARG("writeAll");
    JSFILE_CHECK_WRITE;

    if (!JS_IsArrayObject(cx, JSVAL_TO_OBJECT(argv[0]))) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_FIRST_ARGUMENT_WRITEALL_NOT_ARRAY_ERROR);
        goto out;
    }

    array = JSVAL_TO_OBJECT(argv[0]);

    JS_GetArrayLength(cx, array, &limit);

    for (i = 0; i<limit; i++) {
        if (!JS_GetElement(cx, array, i, &elemval))  return JS_FALSE;
        elem = JSVAL_TO_OBJECT(elemval);
        file_writeln(cx, obj, 1, &elemval, rval);
    }

    *rval = JSVAL_TRUE;
    return JS_TRUE;
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_read(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString    *str;
    int32       want, count;
    jschar      *buf;

    SECURITY_CHECK(cx, NULL, "read", file);
    JSFILE_CHECK_ONE_ARG("read");
    JSFILE_CHECK_READ;

    if (!JS_ValueToInt32(cx, argv[0], &want)){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_NUMBER, "read", argv[0]);
        goto out;
    }

    /* want = (want>262144)?262144:want; * arbitrary size limitation */

    buf = JS_malloc(cx, want*sizeof buf[0]);
    if (!buf)  goto out;

    count =  js_FileRead(cx, file, buf, want, file->type);
    if (count>0) {
        str = JS_NewUCStringCopyN(cx, buf, count);
        *rval = STRING_TO_JSVAL(str);
        JS_free(cx, buf);
        return JS_TRUE;
    } else {
        JS_free(cx, buf);
        goto out;
    }
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_readln(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString    *str;
    jschar      *buf = NULL, *tmp;
    int32       offset, read;
    intN        room;
    jschar      data, data2;

    SECURITY_CHECK(cx, NULL, "readln", file);
    JSFILE_CHECK_READ;

    buf = JS_malloc(cx, MAX_LINE_LENGTH * sizeof data);
    if (!buf)
        return JS_FALSE;

    room = MAX_LINE_LENGTH - 1;
    offset = 0;

    for (;;) {
        read = js_FileRead(cx, file, &data, 1, file->type);
        if (read < 0)
            goto out;
        if (read == 0)
            goto eof;

        switch (data) {
          case '\r':
            read = js_FileRead(cx, file, &data2, 1, file->type);
            if (read < 0)
                goto out;

            if (read == 1 && data2 != '\n') {
                /* We read one char too far.  Buffer it. */
                file->charBuffer = data2;
                file->charBufferUsed = JS_TRUE;
            }

            /* Fall through. */
          case '\n':
            goto done;

          default:
            if (--room < 0) {
                tmp = JS_realloc(cx, buf,
                                 (offset + MAX_LINE_LENGTH) * sizeof data);
                if (!tmp)
                    goto out;

                room = MAX_LINE_LENGTH - 1;
                buf = tmp;
            }

            buf[offset++] = data;
            break;
        }
    }

eof:
    if (offset == 0) {
        *rval = JSVAL_NULL;
        return JS_TRUE;
    }

done:
    buf[offset] = 0;
    tmp = JS_realloc(cx, buf, (offset + 1) * sizeof data);
    if (!tmp)
        goto out;

    str = JS_NewUCString(cx, tmp, offset);
    if (!str)
        goto out;

    *rval = STRING_TO_JSVAL(str);
    return JS_TRUE;

out:
    if (buf)
        JS_free(cx, buf);

    return JS_FALSE;
}

static JSBool
file_readAll(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSObject    *array;
    jsint       len;
    jsval       line;
    JSBool      lineok = JS_FALSE;

    SECURITY_CHECK(cx, NULL, "readAll", file);
    JSFILE_CHECK_READ;

    array = JS_NewArrayObject(cx, 0, NULL);
    if (!array)
        return JS_FALSE;
    *rval = OBJECT_TO_JSVAL(array);

    len = 0;

    lineok = file_readln(cx, obj, 0, NULL, &line);
    while (lineok && !JSVAL_IS_NULL(line)) {
        JS_SetElement(cx, array, len++, &line);
        lineok = file_readln(cx, obj, 0, NULL, &line);
    }

out:
    return lineok;
}

static JSBool
file_seek(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    int32       toskip;
    int32       pos;

    SECURITY_CHECK(cx, NULL, "seek", file);
    JSFILE_CHECK_ONE_ARG("seek");
    JSFILE_CHECK_NATIVE("seek");
    JSFILE_CHECK_READ;

    if (!JS_ValueToInt32(cx, argv[0], &toskip)){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_NUMBER, "seek", argv[0]);
        goto out;
    }

    if(!file->hasRandomAccess){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_NO_RANDOM_ACCESS, file->path);
       goto out;
    }

    if(js_isDirectory(cx, file)){
        JS_ReportWarning(cx,"Seek on directories is not supported, proceeding");
        goto out;
    }

    pos = js_FileSeek(cx, file, toskip, file->type);

    if (pos!=-1) {
        *rval = INT_TO_JSVAL(pos);
        return JS_TRUE;
    }
out:
    *rval = JSVAL_VOID;
    return JS_FALSE;
}

static JSBool
file_list(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    PRDir       *dir;
    PRDirEntry  *entry;
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSObject    *array;
    JSObject    *eachFile;
    jsint       len;
    jsval       v;
    JSRegExp    *re = NULL;
    JSFunction  *func = NULL;
    JSString    *str;
    jsval       args[1];
    char        *filePath;

    SECURITY_CHECK(cx, NULL, "list", file);
    JSFILE_CHECK_NATIVE("list");

    if (argc==1) {
        if (VALUE_IS_REGEXP(cx, argv[0])) {
            re = JS_GetPrivate(cx, JSVAL_TO_OBJECT(argv[0]));
        }else
        if (VALUE_IS_FUNCTION(cx, argv[0])) {
            func = JS_GetPrivate(cx, JSVAL_TO_OBJECT(argv[0]));
        }else{
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_FUNCTION_OR_REGEX, argv[0]);
            goto out;
        }
    }

    if (!js_isDirectory(cx, file)) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_CANNOT_DO_LIST_ON_A_FILE, file->path);
        goto out;
    }

    dir = PR_OpenDir(file->path);
    if(!dir){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OP_FAILED, "open", file->path);
        goto out;
    }

    /* create JSArray here... */
    array = JS_NewArrayObject(cx, 0, NULL);
    len = 0;

    while ((entry = PR_ReadDir(dir, PR_SKIP_BOTH))!=NULL) {
        /* first, check if we have a regexp */
        if (re!=NULL) {
            size_t index = 0;

            str = JS_NewStringCopyZ(cx, entry->name);
            if(!js_ExecuteRegExp(cx, re, str, &index, JS_TRUE, &v)){
                /* don't report anything here */
                goto out;
            }
            /* not matched! */
            if (JSVAL_IS_NULL(v)) {
                continue;
            }
        }else
        if (func!=NULL) {
            str = JS_NewStringCopyZ(cx, entry->name);
            args[0] = STRING_TO_JSVAL(str);
            if(!JS_CallFunction(cx, obj, func, 1, args, &v)){
                goto out;
            }

            if (v==JSVAL_FALSE) {
                continue;
            }
        }

        filePath = js_combinePath(cx, file->path, (char*)entry->name);

        eachFile = js_NewFileObject(cx, filePath);
        JS_free(cx, filePath);
        if (!eachFile){
            JS_ReportWarning(cx, "File %s cannot be retrieved", filePath);
            continue;
        }
        v = OBJECT_TO_JSVAL(eachFile);
        JS_SetElement(cx, array, len, &v);
        JS_SetProperty(cx, array, entry->name, &v);
        len++;
    }

    if(PR_CloseDir(dir)!=PR_SUCCESS){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OP_FAILED, "close", file->path);
        goto out;
    }
    *rval = OBJECT_TO_JSVAL(array);
    return JS_TRUE;
out:
    *rval = JSVAL_NULL;
    return JS_FALSE;
}

static JSBool
file_mkdir(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    SECURITY_CHECK(cx, NULL, "mkdir", file);
    JSFILE_CHECK_ONE_ARG("mkdir");
    JSFILE_CHECK_NATIVE("mkdir");

    /* if the current file is not a directory, find out the directory name */
    if (!js_isDirectory(cx, file)) {
        char        *dir = js_fileDirectoryName(cx, file->path);
        JSObject    *dirObj = js_NewFileObject(cx, dir);

        JS_free(cx, dir);

        /* call file_mkdir with the right set of parameters if needed */
        if (file_mkdir(cx, dirObj, argc, argv, rval))
			return JS_TRUE;
		else
            goto out;
    }else{
        char *dirName = JS_GetStringBytes(JS_ValueToString(cx, argv[0]));
        char *fullName;

        fullName = js_combinePath(cx, file->path, dirName);
        if (PR_MkDir(fullName, 0755)==PR_SUCCESS){
            *rval = JSVAL_TRUE;
            JS_free(cx, fullName);
            return JS_TRUE;
        }else{
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_OP_FAILED, "mkdir", fullName);
            JS_free(cx, fullName);
            goto out;
        }
    }
out:
    *rval = JSVAL_FALSE;
    return JS_FALSE;
}

static JSBool
file_toString(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval*rval)
{
    JSFile *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    JSString *str;

    str = JS_NewStringCopyZ(cx, file->path);
    if (!str)
        return JS_FALSE;
    *rval = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
file_toURL(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    JSFile *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    char url[MAX_PATH_LENGTH];
    jschar *urlChars;
    size_t len;
    JSString *str;

    JSFILE_CHECK_NATIVE("toURL");

    sprintf(url, "file://%s", file->path);

    len = strlen(url);
    urlChars = js_InflateString(cx, url, &len);
    if (!urlChars)
        return JS_FALSE;
    str = js_NewString(cx, urlChars, len);
    if (!str) {
        JS_free(cx, urlChars);
        return JS_FALSE;
    }
    *rval = STRING_TO_JSVAL(str);

    /* TODO: js_escape in jsstr.h may go away at some point */
    return js_str_escape(cx, obj, 0, rval, rval);

out:
    *rval = JSVAL_VOID;
    return JS_FALSE;
}


static void
file_finalize(JSContext *cx, JSObject *obj)
{
    JSFile *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    if(file) {
        /* Close the file before exiting. */
        if(file->isOpen && !file->isNative) {
            jsval vp;
            file_close(cx, obj, 0, NULL, &vp);
        }

        if (file->path)
            JS_free(cx, file->path);

        JS_free(cx, file);
    }
}

/*
    Allocates memory for the file object, sets fields to defaults.
*/
static JSFile*
file_init(JSContext *cx, JSObject *obj, char *bytes)
{
    JSFile *file;

    file = JS_malloc(cx, sizeof *file);
    if (!file)
        return NULL;
    memset(file, 0 , sizeof *file);

    js_ResetAttributes(file);

    file->path = RESOLVE_PATH(cx, bytes);

    if (!JS_SetPrivate(cx, obj, file)) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                             JSFILEMSG_CANNOT_SET_PRIVATE_FILE, file->path);
        JS_free(cx, file);
        return NULL;
    }

    return file;
}

/* Returns a JSObject. This function is globally visible */
JS_PUBLIC_API(JSObject*)
js_NewFileObject(JSContext *cx, char *filename)
{
    JSObject    *obj;
    JSFile      *file;

    obj = JS_NewObject(cx, &js_FileClass, NULL, NULL);
    if (!obj){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OBJECT_CREATION_FAILED, "js_NewFileObject");
        return NULL;
    }
    file = file_init(cx, obj, filename);
    if(!file) return NULL;
    return obj;
}

/* Internal function, used for cases which NSPR file support doesn't cover */
JSObject*
js_NewFileObjectFromFILE(JSContext *cx, FILE *nativehandle, char *filename,
    int32 mode, JSBool open, JSBool randomAccess)
{
    JSObject *obj;
    JSFile   *file;

    obj = JS_NewObject(cx, &js_FileClass, NULL, NULL);
    if (!obj){
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_OBJECT_CREATION_FAILED, "js_NewFileObjectFromFILE");
        return NULL;
    }
    file = file_init(cx, obj, filename);
    if(!file) return NULL;

    file->nativehandle = nativehandle;

    /* free result of RESOLVE_PATH from file_init. */
    JS_ASSERT(file->path != NULL);
    JS_free(cx, file->path);

    file->path = strdup(filename);
    file->isOpen = open;
    file->mode = mode;
    file->hasRandomAccess = randomAccess;
    file->isNative = JS_TRUE;
    return obj;
}

/*
    Real file constructor that is called from JavaScript.
    Basically, does error processing and calls file_init.
*/
static JSBool
file_constructor(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                 jsval *rval)
{
    JSString *str;
    JSFile   *file;

    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        /* Replace obj with a new File object. */
        obj = JS_NewObject(cx, &js_FileClass, NULL, NULL);
        if (!obj)
            return JS_FALSE;
        *rval = OBJECT_TO_JSVAL(obj);
    }

    str = (argc == 0)
          ? JS_InternString(cx, "")
          : JS_ValueToString(cx, argv[0]);

    if (!str) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                         JSFILEMSG_FIRST_ARGUMENT_CONSTRUCTOR_NOT_STRING_ERROR,
                             argv[0]);
        return JS_FALSE;
    }

    file = file_init(cx, obj, JS_GetStringBytes(str));
    if (!file)
        return JS_FALSE;

    SECURITY_CHECK(cx, NULL, "constructor", file);

    return JS_TRUE;
}

/* -------------------- File methods and properties ------------------------- */
static JSFunctionSpec file_functions[] = {
    { "open",           file_open, 0},
    { "close",          file_close, 0},
    { "remove",         file_remove, 0},
    { "copyTo",         file_copyTo, 0},
    { "renameTo",       file_renameTo, 0},
    { "flush",          file_flush, 0},
    { "seek",           file_seek, 0},
    { "read",           file_read, 0},
    { "readln",         file_readln, 0},
    { "readAll",        file_readAll, 0},
    { "write",          file_write, 0},
    { "writeln",        file_writeln, 0},
    { "writeAll",       file_writeAll, 0},
    { "list",           file_list, 0},
    { "mkdir",          file_mkdir, 0},
    { "toString",       file_toString, 0},
    { "toURL",          file_toURL, 0},
    {0}
};

enum file_tinyid {
    FILE_LENGTH             = -2,
    FILE_PARENT             = -3,
    FILE_PATH               = -4,
    FILE_NAME               = -5,
    FILE_ISDIR              = -6,
    FILE_ISFILE             = -7,
    FILE_EXISTS             = -8,
    FILE_CANREAD            = -9,
    FILE_CANWRITE           = -10,
    FILE_OPEN               = -11,
    FILE_TYPE               = -12,
    FILE_MODE               = -13,
    FILE_CREATED            = -14,
    FILE_MODIFIED           = -15,
    FILE_SIZE               = -16,
    FILE_RANDOMACCESS       = -17,
    FILE_POSITION           = -18,
    FILE_APPEND             = -19,
    FILE_REPLACE            = -20,
    FILE_AUTOFLUSH          = -21,
    FILE_ISNATIVE           = -22,
};

static JSPropertySpec file_props[] = {
   {"length",          FILE_LENGTH,        JSPROP_ENUMERATE | JSPROP_READONLY },
   {"parent",          FILE_PARENT,        JSPROP_ENUMERATE | JSPROP_READONLY },
   {"path",            FILE_PATH,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"name",            FILE_NAME,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"isDirectory",     FILE_ISDIR,         JSPROP_ENUMERATE | JSPROP_READONLY },
   {"isFile",          FILE_ISFILE,        JSPROP_ENUMERATE | JSPROP_READONLY },
   {"exists",          FILE_EXISTS,        JSPROP_ENUMERATE | JSPROP_READONLY },
   {"canRead",         FILE_CANREAD,       JSPROP_ENUMERATE | JSPROP_READONLY },
   {"canWrite",        FILE_CANWRITE,      JSPROP_ENUMERATE | JSPROP_READONLY },
   {"canAppend",       FILE_APPEND,        JSPROP_ENUMERATE | JSPROP_READONLY },
   {"canReplace",      FILE_REPLACE,       JSPROP_ENUMERATE | JSPROP_READONLY },
   {"isOpen",          FILE_OPEN,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"type",            FILE_TYPE,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"mode",            FILE_MODE,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"creationTime",    FILE_CREATED,       JSPROP_ENUMERATE | JSPROP_READONLY },
   {"lastModified",    FILE_MODIFIED,      JSPROP_ENUMERATE | JSPROP_READONLY },
   {"size",            FILE_SIZE,          JSPROP_ENUMERATE | JSPROP_READONLY },
   {"hasRandomAccess", FILE_RANDOMACCESS,  JSPROP_ENUMERATE | JSPROP_READONLY },
   {"hasAutoFlush",    FILE_AUTOFLUSH,     JSPROP_ENUMERATE | JSPROP_READONLY },
   {"position",        FILE_POSITION,      JSPROP_ENUMERATE },
   {"isNative",        FILE_ISNATIVE,      JSPROP_ENUMERATE | JSPROP_READONLY },
   {0}
};

/* ------------------------- Property getter/setter ------------------------- */
static JSBool
file_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSFile      *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    char        *bytes;
    JSString    *str;
    jsint       tiny;
    PRFileInfo  info;
    JSBool      flag;
    PRExplodedTime expandedTime;

    tiny = JSVAL_TO_INT(id);
    if (!file)
        return JS_TRUE;

    switch (tiny) {
    case FILE_PARENT:
        SECURITY_CHECK(cx, NULL, "parent", file);
        if (!js_parent(cx, file, vp))
            return JS_FALSE;
        break;
    case FILE_PATH:
        str = JS_NewStringCopyZ(cx, file->path);
        if (!str)
            return JS_FALSE;
        *vp = STRING_TO_JSVAL(str);
        break;
    case FILE_NAME:
        if (!js_name(cx, file, vp))
            return JS_FALSE;
        break;
    case FILE_ISDIR:
        SECURITY_CHECK(cx, NULL, "isDirectory", file);
        *vp = BOOLEAN_TO_JSVAL(js_isDirectory(cx, file));
        break;
    case FILE_ISFILE:
        SECURITY_CHECK(cx, NULL, "isFile", file);
        *vp = BOOLEAN_TO_JSVAL(js_isFile(cx, file));
        break;
    case FILE_EXISTS:
        SECURITY_CHECK(cx, NULL, "exists", file);
        *vp = BOOLEAN_TO_JSVAL(js_exists(cx, file));
        break;
    case FILE_ISNATIVE:
        SECURITY_CHECK(cx, NULL, "isNative", file);
        *vp = BOOLEAN_TO_JSVAL(file->isNative);
        break;
    case FILE_CANREAD:
        SECURITY_CHECK(cx, NULL, "canRead", file);
        *vp = BOOLEAN_TO_JSVAL(js_canRead(cx, file));
        break;
    case FILE_CANWRITE:
        SECURITY_CHECK(cx, NULL, "canWrite", file);
        *vp = BOOLEAN_TO_JSVAL(js_canWrite(cx, file));
        break;
    case FILE_OPEN:
        SECURITY_CHECK(cx, NULL, "isOpen", file);
        *vp = BOOLEAN_TO_JSVAL(file->isOpen);
        break;
    case FILE_APPEND :
        SECURITY_CHECK(cx, NULL, "canAppend", file);
        JSFILE_CHECK_OPEN("canAppend");
        *vp = BOOLEAN_TO_JSVAL(!file->isNative &&
                (file->mode&PR_APPEND)==PR_APPEND);
        break;
    case FILE_REPLACE :
        SECURITY_CHECK(cx, NULL, "canReplace", file);
        JSFILE_CHECK_OPEN("canReplace");
        *vp = BOOLEAN_TO_JSVAL(!file->isNative &&
                (file->mode&PR_TRUNCATE)==PR_TRUNCATE);
        break;
    case FILE_AUTOFLUSH :
        SECURITY_CHECK(cx, NULL, "hasAutoFlush", file);
        JSFILE_CHECK_OPEN("hasAutoFlush");
        *vp = BOOLEAN_TO_JSVAL(!file->isNative && file->hasAutoflush);
        break;
    case FILE_TYPE:
        SECURITY_CHECK(cx, NULL, "type", file);
        JSFILE_CHECK_OPEN("type");
        if(js_isDirectory(cx, file)){
            *vp = JSVAL_VOID;
            break;
        }

        switch (file->type) {
        case ASCII:
            *vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, asciistring));
            break;
        case UTF8:
            *vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, utfstring));
            break;
        case UCS2:
            *vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, unicodestring));
            break;
        default:
            JS_ReportWarning(cx, "Unsupported file type %d, proceeding",
                file->type);
        }
        break;
    case FILE_MODE:
        SECURITY_CHECK(cx, NULL, "mode", file);
        JSFILE_CHECK_OPEN("mode");
        bytes = JS_malloc(cx, MODE_SIZE);
        bytes[0] = '\0';
        flag = JS_FALSE;

        if ((file->mode&PR_RDONLY)==PR_RDONLY) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "read");
            flag = JS_TRUE;
        }
        if ((file->mode&PR_WRONLY)==PR_WRONLY) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "write");
            flag = JS_TRUE;
        }
        if ((file->mode&PR_RDWR)==PR_RDWR) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "readWrite");
            flag = JS_TRUE;
        }
        if ((file->mode&PR_APPEND)==PR_APPEND) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "append");
            flag = JS_TRUE;
        }
        if ((file->mode&PR_CREATE_FILE)==PR_CREATE_FILE) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "create");
            flag = JS_TRUE;
        }
        if ((file->mode&PR_TRUNCATE)==PR_TRUNCATE) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "replace");
            flag = JS_TRUE;
        }
        if (file->hasAutoflush) {
            if (flag) strcat(bytes, ",");
            strcat(bytes, "hasAutoFlush");
            flag = JS_TRUE;
        }
        *vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, bytes));
        JS_free(cx, bytes);
        break;
    case FILE_CREATED:
        SECURITY_CHECK(cx, NULL, "creationTime", file);
        JSFILE_CHECK_NATIVE("creationTime");
        if(((file->isOpen)?
                        PR_GetOpenFileInfo(file->handle, &info):
                        PR_GetFileInfo(file->path, &info))!=PR_SUCCESS){
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_CANNOT_ACCESS_FILE_STATUS, file->path);
            goto out;
        }

        PR_ExplodeTime(info.creationTime, PR_LocalTimeParameters,&expandedTime);
        *vp = OBJECT_TO_JSVAL(js_NewDateObject(cx,  expandedTime.tm_year,
                                    expandedTime.tm_month,
                                    expandedTime.tm_mday,
                                    expandedTime.tm_hour,
                                    expandedTime.tm_min,
                                    expandedTime.tm_sec));
        break;
    case FILE_MODIFIED:
        SECURITY_CHECK(cx, NULL, "lastModified", file);
        JSFILE_CHECK_NATIVE("lastModified");
        if(((file->isOpen)?
                        PR_GetOpenFileInfo(file->handle, &info):
                        PR_GetFileInfo(file->path, &info))!=PR_SUCCESS){
            JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                JSFILEMSG_CANNOT_ACCESS_FILE_STATUS, file->path);
            goto out;
        }

        PR_ExplodeTime(info.modifyTime, PR_LocalTimeParameters, &expandedTime);
        *vp = OBJECT_TO_JSVAL(js_NewDateObject(cx, expandedTime.tm_year,
                                    expandedTime.tm_month,
                                    expandedTime.tm_mday,
                                    expandedTime.tm_hour,
                                    expandedTime.tm_min,
                                    expandedTime.tm_sec));
        break;
    case FILE_SIZE:
        SECURITY_CHECK(cx, NULL, "size", file);
        *vp = js_size(cx, file);
        break;
    case FILE_LENGTH:
        SECURITY_CHECK(cx, NULL, "length", file);
        JSFILE_CHECK_NATIVE("length");

        if (js_isDirectory(cx, file)) { /* XXX debug me */
            PRDir       *dir;
            PRDirEntry  *entry;
            jsint       count = 0;

            if(!(dir = PR_OpenDir(file->path))){
                JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                    JSFILEMSG_CANNOT_OPEN_DIR, file->path);
                goto out;
            }

            while ((entry = PR_ReadDir(dir, PR_SKIP_BOTH))) {
                count++;
            }

            if(!PR_CloseDir(dir)){
                JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                    JSFILEMSG_OP_FAILED, "close", file->path);

                goto out;
            }

            *vp = INT_TO_JSVAL(count);
            break;
        }else{
            /* return file size */
            *vp = js_size(cx, file);
        }
        break;
    case FILE_RANDOMACCESS:
            SECURITY_CHECK(cx, NULL, "hasRandomAccess", file);
            JSFILE_CHECK_OPEN("hasRandomAccess");
            *vp = BOOLEAN_TO_JSVAL(file->hasRandomAccess);
        break;
    case FILE_POSITION:
        SECURITY_CHECK(cx, NULL, "position", file);
        JSFILE_CHECK_NATIVE("position");
        JSFILE_CHECK_OPEN("position");

        if(!file->hasRandomAccess){
            JS_ReportWarning(cx, "File %s doesn't support random access, can't report the position, proceeding");
            *vp = JSVAL_VOID;
            break;
        }

        if (file->isOpen && js_isFile(cx, file)) {
            int pos = PR_Seek(file->handle, 0, PR_SEEK_CUR);
            if(pos!=-1){
                *vp = INT_TO_JSVAL(pos);
            }else{
                JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                    JSFILEMSG_CANNOT_REPORT_POSITION, file->path);
                goto out;
            }
        }else {
            JS_ReportWarning(cx, "File %s is closed or not a plain file,"
                " can't report position, proceeding");
            goto out;
        }
        break;
    default:
        SECURITY_CHECK(cx, NULL, "file_access", file);

        /* this is some other property -- try to use the dir["file"] syntax */
        if (js_isDirectory(cx, file)) {
            PRDir *dir = NULL;
            PRDirEntry *entry = NULL;
            char *prop_name;

            str = JS_ValueToString(cx, id);
            if (!str)
                return JS_FALSE;

            prop_name = JS_GetStringBytes(str);

            /* no native files past this point */
            dir = PR_OpenDir(file->path);
            if(!dir) {
                /* This is probably not a directory */
                JS_ReportWarning(cx, "Can't open directory %s", file->path);
                return JS_FALSE;
            }

            while ((entry = PR_ReadDir(dir, PR_SKIP_NONE)) != NULL) {
                if (!strcmp(entry->name, prop_name)){
                    bytes = js_combinePath(cx, file->path, prop_name);
                    *vp = OBJECT_TO_JSVAL(js_NewFileObject(cx, bytes));
                    PR_CloseDir(dir);
                    JS_free(cx, bytes);
                    return !JSVAL_IS_NULL(*vp);
                }
            }
            PR_CloseDir(dir);
        }
    }
    return JS_TRUE;

out:
    return JS_FALSE;
}

static JSBool
file_setProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSFile  *file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);
    jsint   slot;

    if (JSVAL_IS_STRING(id)){
        return JS_TRUE;
    }

    slot = JSVAL_TO_INT(id);

    switch (slot) {
    /* File.position  = 10 */
    case FILE_POSITION:
        SECURITY_CHECK(cx, NULL, "set_position", file);
        JSFILE_CHECK_NATIVE("set_position");

        if(!file->hasRandomAccess){
            JS_ReportWarning(cx, "File %s doesn't support random access, can't "
                "report the position, proceeding");
            goto out;
        }

        if (file->isOpen && js_isFile(cx, file)) {
            int32 pos;
		    int32 offset;

			if (!JS_ValueToInt32(cx, *vp, &offset)){
				JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
					JSFILEMSG_FIRST_ARGUMENT_MUST_BE_A_NUMBER, "position", *vp);
				goto out;
			}

			pos = PR_Seek(file->handle, offset, PR_SEEK_SET);

            if(pos!=-1){
                *vp = INT_TO_JSVAL(pos);
            }else{
                JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
                    JSFILEMSG_CANNOT_SET_POSITION, file->path);
                goto out;
            }
        } else {
            JS_ReportWarning(cx, "File %s is closed or not a file, can't set "
                "position, proceeding", file->path);
            goto out;
        }
    }

    return JS_TRUE;
out:
    return JS_FALSE;
}

/*
    File.currentDir = new File("D:\") or File.currentDir = "D:\"
*/
static JSBool
file_currentDirSetter(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSFile   *file;

    file = JS_GetInstancePrivate(cx, obj, &js_FileClass, NULL);

    /* Look at the rhs and extract a file object from it */
    if (JSVAL_IS_OBJECT(*vp)) {
        if (JS_InstanceOf(cx, obj, &js_FileClass, NULL)) {
            /* Braindamaged rhs -- just return the old value */
            if (file && (!js_exists(cx, file) || !js_isDirectory(cx, file))) {
                JS_GetProperty(cx, obj, CURRENTDIR_PROPERTY, vp);
                return JS_FALSE;
            } else {
                chdir(file->path);
                return JS_TRUE;
            }
        } else {
            return JS_FALSE;
        }
    } else {
        JSObject *rhsObject;
        char     *path;

        path      = JS_GetStringBytes(JS_ValueToString(cx, *vp));
        rhsObject = js_NewFileObject(cx, path);
        if (!rhsObject)
            return JS_FALSE;

        if (!file || !js_exists(cx, file) || !js_isDirectory(cx, file)){
            JS_GetProperty(cx, obj, CURRENTDIR_PROPERTY, vp);
        } else {
            *vp = OBJECT_TO_JSVAL(rhsObject);
            chdir(path);
        }
    }

    return JS_TRUE;
}

/* Declare class */
JSClass js_FileClass = {
    "File", JSCLASS_HAS_PRIVATE | JSCLASS_HAS_CACHED_PROTO(JSProto_File),
    JS_PropertyStub,  JS_PropertyStub,  file_getProperty,  file_setProperty,
    JS_EnumerateStub, JS_ResolveStub,   JS_ConvertStub,    file_finalize
};

/* -------------------- Functions exposed to the outside -------------------- */
JS_PUBLIC_API(JSObject*)
js_InitFileClass(JSContext *cx, JSObject* obj)
{
    JSObject *file, *ctor, *afile;
    jsval    vp;
    char     *currentdir;
    char     separator[2];

    file = JS_InitClass(cx, obj, NULL, &js_FileClass, file_constructor, 1,
        file_props, file_functions, NULL, NULL);
    if (!file) {
        JS_ReportErrorNumber(cx, JSFile_GetErrorMessage, NULL,
            JSFILEMSG_INIT_FAILED);
        return NULL;
    }

    ctor = JS_GetConstructor(cx, file);
    if (!ctor)  return NULL;

	/* Define CURRENTDIR property. We are doing this to get a
	slash at the end of the current dir */
    afile = js_NewFileObject(cx, CURRENT_DIR);
    currentdir =  JS_malloc(cx, MAX_PATH_LENGTH);
    currentdir =  getcwd(currentdir, MAX_PATH_LENGTH);
    afile = js_NewFileObject(cx, currentdir);
    JS_free(cx, currentdir);
    vp = OBJECT_TO_JSVAL(afile);
    JS_DefinePropertyWithTinyId(cx, ctor, CURRENTDIR_PROPERTY, 0, vp,
                JS_PropertyStub, file_currentDirSetter,
                JSPROP_ENUMERATE | JSPROP_READONLY );

    /* Define input */
    vp = OBJECT_TO_JSVAL(js_NewFileObjectFromFILE(cx, stdin,
            STDINPUT_NAME, PR_RDONLY, JS_TRUE, JS_FALSE));
    JS_SetProperty(cx, ctor, "input", &vp);

    /* Define output */
    vp = OBJECT_TO_JSVAL(js_NewFileObjectFromFILE(cx, stdout,
            STDOUTPUT_NAME, PR_WRONLY, JS_TRUE, JS_FALSE));
    JS_SetProperty(cx, ctor, "output", &vp);

    /* Define error */
    vp = OBJECT_TO_JSVAL(js_NewFileObjectFromFILE(cx, stderr,
            STDERROR_NAME, PR_WRONLY, JS_TRUE, JS_FALSE));
    JS_SetProperty(cx, ctor, "error", &vp);

    separator[0] = FILESEPARATOR;
    separator[1] = '\0';
    vp = STRING_TO_JSVAL(JS_NewStringCopyZ(cx, separator));
    JS_DefinePropertyWithTinyId(cx, ctor, SEPARATOR_PROPERTY, 0, vp,
                JS_PropertyStub, JS_PropertyStub,
                JSPROP_ENUMERATE | JSPROP_READONLY );
    return file;
}
#endif /* JS_HAS_FILE_OBJECT */
