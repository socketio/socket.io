/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set sw=4 ts=8 et tw=78:
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
 * JS lexical scanner.
 */
#include "jsstddef.h"
#include <stdio.h>      /* first to avoid trouble on some systems */
#include <errno.h>
#include <limits.h>
#include <math.h>
#ifdef HAVE_MEMORY_H
#include <memory.h>
#endif
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsutil.h" /* Added by JSIFY */
#include "jsdtoa.h"
#include "jsprf.h"
#include "jsapi.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsemit.h"
#include "jsexn.h"
#include "jsnum.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsregexp.h"
#include "jsscan.h"
#include "jsscript.h"
#include "jsstaticcheck.h"

#if JS_HAS_XML_SUPPORT
#include "jsxml.h"
#endif

#define JS_KEYWORD(keyword, type, op, version) \
    const char js_##keyword##_str[] = #keyword;
#include "jskeyword.tbl"
#undef JS_KEYWORD

struct keyword {
    const char  *chars;         /* C string with keyword text */
    JSTokenType tokentype;      /* JSTokenType */
    JSOp        op;             /* JSOp */
    JSVersion   version;        /* JSVersion */
};

static const struct keyword keyword_defs[] = {
#define JS_KEYWORD(keyword, type, op, version) \
    {js_##keyword##_str, type, op, version},
#include "jskeyword.tbl"
#undef JS_KEYWORD
};

#define KEYWORD_COUNT JS_ARRAY_LENGTH(keyword_defs)

static const struct keyword *
FindKeyword(const jschar *s, size_t length)
{
    register size_t i;
    const struct keyword *kw;
    const char *chars;

    JS_ASSERT(length != 0);

#define JSKW_LENGTH()           length
#define JSKW_AT(column)         s[column]
#define JSKW_GOT_MATCH(index)   i = (index); goto got_match;
#define JSKW_TEST_GUESS(index)  i = (index); goto test_guess;
#define JSKW_NO_MATCH()         goto no_match;
#include "jsautokw.h"
#undef JSKW_NO_MATCH
#undef JSKW_TEST_GUESS
#undef JSKW_GOT_MATCH
#undef JSKW_AT
#undef JSKW_LENGTH

  got_match:
    return &keyword_defs[i];

  test_guess:
    kw = &keyword_defs[i];
    chars = kw->chars;
    do {
        if (*s++ != (unsigned char)(*chars++))
            goto no_match;
    } while (--length != 0);
    return kw;

  no_match:
    return NULL;
}

JSTokenType
js_CheckKeyword(const jschar *str, size_t length)
{
    const struct keyword *kw;

    JS_ASSERT(length != 0);
    kw = FindKeyword(str, length);
    return kw ? kw->tokentype : TOK_EOF;
}

JS_FRIEND_API(void)
js_MapKeywords(void (*mapfun)(const char *))
{
    size_t i;

    for (i = 0; i != KEYWORD_COUNT; ++i)
        mapfun(keyword_defs[i].chars);
}

JSBool
js_IsIdentifier(JSString *str)
{
    size_t length;
    jschar c, *chars, *end;

    JSSTRING_CHARS_AND_LENGTH(str, chars, length);
    if (length == 0)
        return JS_FALSE;
    c = *chars;
    if (!JS_ISIDSTART(c))
        return JS_FALSE;
    end = chars + length;
    while (++chars != end) {
        c = *chars;
        if (!JS_ISIDENT(c))
            return JS_FALSE;
    }
    return JS_TRUE;
}

#define TBMIN   64

static JSBool
GrowTokenBuf(JSStringBuffer *sb, size_t newlength)
{
    JSContext *cx;
    jschar *base;
    ptrdiff_t offset, length;
    size_t tbsize;
    JSArenaPool *pool;

    cx = (JSContext*) sb->data;
    base = sb->base;
    offset = PTRDIFF(sb->ptr, base, jschar);
    pool = &cx->tempPool;
    if (!base) {
        tbsize = TBMIN * sizeof(jschar);
        length = TBMIN - 1;
        JS_ARENA_ALLOCATE_CAST(base, jschar *, pool, tbsize);
    } else {
        length = PTRDIFF(sb->limit, base, jschar);
        if ((size_t)length >= ~(size_t)0 / sizeof(jschar)) {
            base = NULL;
        } else {
            tbsize = (length + 1) * sizeof(jschar);
            length += length + 1;
            JS_ARENA_GROW_CAST(base, jschar *, pool, tbsize, tbsize);
        }
    }
    if (!base) {
        js_ReportOutOfScriptQuota(cx);
        sb->base = STRING_BUFFER_ERROR_BASE;
        return JS_FALSE;
    }
    sb->base = base;
    sb->limit = base + length;
    sb->ptr = base + offset;
    return JS_TRUE;
}

JSBool
js_InitTokenStream(JSContext *cx, JSTokenStream *ts,
                   const jschar *base, size_t length,
                   FILE *fp, const char *filename, uintN lineno)
{
    jschar *buf;
    size_t nb;

    JS_ASSERT_IF(fp, !base);
    JS_ASSERT_IF(!base, length == 0);
    nb = fp
         ? 2 * JS_LINE_LIMIT * sizeof(jschar)
         : JS_LINE_LIMIT * sizeof(jschar);
    JS_ARENA_ALLOCATE_CAST(buf, jschar *, &cx->tempPool, nb);
    if (!buf) {
        js_ReportOutOfScriptQuota(cx);
        return JS_FALSE;
    }
    memset(buf, 0, nb);
    memset(ts, 0, sizeof(*ts));
    ts->filename = filename;
    ts->lineno = lineno;
    ts->linebuf.base = ts->linebuf.limit = ts->linebuf.ptr = buf;
    if (fp) {
        ts->file = fp;
        ts->userbuf.base = buf + JS_LINE_LIMIT;
        ts->userbuf.ptr = ts->userbuf.limit = ts->userbuf.base + JS_LINE_LIMIT;
    } else {
        ts->userbuf.base = (jschar *)base;
        ts->userbuf.limit = (jschar *)base + length;
        ts->userbuf.ptr = (jschar *)base;
    }
    ts->tokenbuf.grow = GrowTokenBuf;
    ts->tokenbuf.data = cx;
    ts->listener = cx->debugHooks->sourceHandler;
    ts->listenerData = cx->debugHooks->sourceHandlerData;
    return JS_TRUE;
}

void
js_CloseTokenStream(JSContext *cx, JSTokenStream *ts)
{
    if (ts->flags & TSF_OWNFILENAME)
        JS_free(cx, (void *) ts->filename);
}

JS_FRIEND_API(int)
js_fgets(char *buf, int size, FILE *file)
{
    int n, i, c;
    JSBool crflag;

    n = size - 1;
    if (n < 0)
        return -1;

    crflag = JS_FALSE;
    for (i = 0; i < n && (c = getc(file)) != EOF; i++) {
        buf[i] = c;
        if (c == '\n') {        /* any \n ends a line */
            i++;                /* keep the \n; we know there is room for \0 */
            break;
        }
        if (crflag) {           /* \r not followed by \n ends line at the \r */
            ungetc(c, file);
            break;              /* and overwrite c in buf with \0 */
        }
        crflag = (c == '\r');
    }

    buf[i] = '\0';
    return i;
}

static int32
GetChar(JSTokenStream *ts)
{
    int32 c;
    ptrdiff_t i, j, len, olen;
    JSBool crflag;
    char cbuf[JS_LINE_LIMIT];
    jschar *ubuf, *nl;

    if (ts->ungetpos != 0) {
        c = ts->ungetbuf[--ts->ungetpos];
    } else {
        if (ts->linebuf.ptr == ts->linebuf.limit) {
            len = PTRDIFF(ts->userbuf.limit, ts->userbuf.ptr, jschar);
            if (len <= 0) {
                if (!ts->file) {
                    ts->flags |= TSF_EOF;
                    return EOF;
                }
        
                /* Fill ts->userbuf so that \r and \r\n convert to \n. */
                crflag = (ts->flags & TSF_CRFLAG) != 0;
                len = js_fgets(cbuf, JS_LINE_LIMIT - crflag, ts->file);
                if (len <= 0) {
                    ts->flags |= TSF_EOF;
                    return EOF;
                }
                olen = len;
                ubuf = ts->userbuf.base;
                i = 0;
                if (crflag) {
                    ts->flags &= ~TSF_CRFLAG;
                    if (cbuf[0] != '\n') {
                        ubuf[i++] = '\n';
                        len++;
                        ts->linepos--;
                    }
                }
                for (j = 0; i < len; i++, j++)
                    ubuf[i] = (jschar) (unsigned char) cbuf[j];
                ts->userbuf.limit = ubuf + len;
                ts->userbuf.ptr = ubuf;
            }
            if (ts->listener) {
                ts->listener(ts->filename, ts->lineno, ts->userbuf.ptr, len,
                             &ts->listenerTSData, ts->listenerData);
            }
        
            nl = ts->saveEOL;
            if (!nl) {
                /*
                 * Any one of \n, \r, or \r\n ends a line (the longest
                 * match wins).  Also allow the Unicode line and paragraph
                 * separators.
                 */
                for (nl = ts->userbuf.ptr; nl < ts->userbuf.limit; nl++) {
                    /*
                     * Try to prevent value-testing on most characters by
                     * filtering out characters that aren't 000x or 202x.
                     */
                    if ((*nl & 0xDFD0) == 0) {
                        if (*nl == '\n')
                            break;
                        if (*nl == '\r') {
                            if (nl + 1 < ts->userbuf.limit && nl[1] == '\n')
                                nl++;
                            break;
                        }
                        if (*nl == LINE_SEPARATOR || *nl == PARA_SEPARATOR)
                            break;
                    }
                }
            }
        
            /*
             * If there was a line terminator, copy thru it into linebuf.
             * Else copy JS_LINE_LIMIT-1 bytes into linebuf.
             */
            if (nl < ts->userbuf.limit)
                len = PTRDIFF(nl, ts->userbuf.ptr, jschar) + 1;
            if (len >= JS_LINE_LIMIT) {
                len = JS_LINE_LIMIT - 1;
                ts->saveEOL = nl;
            } else {
                ts->saveEOL = NULL;
            }
            js_strncpy(ts->linebuf.base, ts->userbuf.ptr, len);
            ts->userbuf.ptr += len;
            olen = len;
        
            /*
             * Make sure linebuf contains \n for EOL (don't do this in
             * userbuf because the user's string might be readonly).
             */
            if (nl < ts->userbuf.limit) {
                if (*nl == '\r') {
                    if (ts->linebuf.base[len-1] == '\r') {
                        /*
                         * Does the line segment end in \r?  We must check
                         * for a \n at the front of the next segment before
                         * storing a \n into linebuf.  This case matters
                         * only when we're reading from a file.
                         */
                        if (nl + 1 == ts->userbuf.limit && ts->file) {
                            len--;
                            ts->flags |= TSF_CRFLAG; /* clear NLFLAG? */
                            if (len == 0) {
                                /*
                                 * This can happen when a segment ends in
                                 * \r\r.  Start over.  ptr == limit in this
                                 * case, so we'll fall into buffer-filling
                                 * code.
                                 */
                                return GetChar(ts);
                            }
                        } else {
                            ts->linebuf.base[len-1] = '\n';
                        }
                    }
                } else if (*nl == '\n') {
                    if (nl > ts->userbuf.base &&
                        nl[-1] == '\r' &&
                        ts->linebuf.base[len-2] == '\r') {
                        len--;
                        JS_ASSERT(ts->linebuf.base[len] == '\n');
                        ts->linebuf.base[len-1] = '\n';
                    }
                } else if (*nl == LINE_SEPARATOR || *nl == PARA_SEPARATOR) {
                    ts->linebuf.base[len-1] = '\n';
                }
            }
        
            /* Reset linebuf based on adjusted segment length. */
            ts->linebuf.limit = ts->linebuf.base + len;
            ts->linebuf.ptr = ts->linebuf.base;
        
            /* Update position of linebuf within physical userbuf line. */
            if (!(ts->flags & TSF_NLFLAG))
                ts->linepos += ts->linelen;
            else
                ts->linepos = 0;
            if (ts->linebuf.limit[-1] == '\n')
                ts->flags |= TSF_NLFLAG;
            else
                ts->flags &= ~TSF_NLFLAG;
        
            /* Update linelen from original segment length. */
            ts->linelen = olen;
        }
        c = *ts->linebuf.ptr++;
    }
    if (c == '\n')
        ts->lineno++;
    return c;
}

static void
UngetChar(JSTokenStream *ts, int32 c)
{
    if (c == EOF)
        return;
    JS_ASSERT(ts->ungetpos < JS_ARRAY_LENGTH(ts->ungetbuf));
    if (c == '\n')
        ts->lineno--;
    ts->ungetbuf[ts->ungetpos++] = (jschar)c;
}

static int32
PeekChar(JSTokenStream *ts)
{
    int32 c;

    c = GetChar(ts);
    UngetChar(ts, c);
    return c;
}

/*
 * Peek n chars ahead into ts.  Return true if n chars were read, false if
 * there weren't enough characters in the input stream.  This function cannot
 * be used to peek into or past a newline.
 */
static JSBool
PeekChars(JSTokenStream *ts, intN n, jschar *cp)
{
    intN i, j;
    int32 c;

    for (i = 0; i < n; i++) {
        c = GetChar(ts);
        if (c == EOF)
            break;
        if (c == '\n') {
            UngetChar(ts, c);
            break;
        }
        cp[i] = (jschar)c;
    }
    for (j = i - 1; j >= 0; j--)
        UngetChar(ts, cp[j]);
    return i == n;
}

static void
SkipChars(JSTokenStream *ts, intN n)
{
    while (--n >= 0)
        GetChar(ts);
}

static JSBool
MatchChar(JSTokenStream *ts, int32 expect)
{
    int32 c;

    c = GetChar(ts);
    if (c == expect)
        return JS_TRUE;
    UngetChar(ts, c);
    return JS_FALSE;
}

JSBool
js_ReportCompileErrorNumber(JSContext *cx, JSTokenStream *ts, JSParseNode *pn,
                            uintN flags, uintN errorNumber, ...)
{
    JSErrorReport report;
    char *message;
    size_t linelength;
    jschar *linechars;
    char *linebytes;
    va_list ap;
    JSBool warning, ok;
    JSTokenPos *tp;
    uintN index, i;
    JSErrorReporter onError;

    JS_ASSERT(ts->linebuf.limit < ts->linebuf.base + JS_LINE_LIMIT);

    if ((flags & JSREPORT_STRICT) && !JS_HAS_STRICT_OPTION(cx))
        return JS_TRUE;

    memset(&report, 0, sizeof report);
    report.flags = flags;
    report.errorNumber = errorNumber;
    message = NULL;
    linechars = NULL;
    linebytes = NULL;

    MUST_FLOW_THROUGH("out");
    va_start(ap, errorNumber);
    ok = js_ExpandErrorArguments(cx, js_GetErrorMessage, NULL,
                                 errorNumber, &message, &report, &warning,
                                 !(flags & JSREPORT_UC), ap);
    va_end(ap);
    if (!ok) {
        warning = JS_FALSE;
        goto out;
    }

    report.filename = ts->filename;

    if (pn) {
        report.lineno = pn->pn_pos.begin.lineno;
        if (report.lineno != ts->lineno)
            goto report;
        tp = &pn->pn_pos;
    } else {
        /* Point to the current token, not the next one to get. */
        tp = &ts->tokens[ts->cursor].pos;
    }
    report.lineno = ts->lineno;
    linelength = PTRDIFF(ts->linebuf.limit, ts->linebuf.base, jschar);
    linechars = (jschar *)JS_malloc(cx, (linelength + 1) * sizeof(jschar));
    if (!linechars) {
        warning = JS_FALSE;
        goto out;
    }
    memcpy(linechars, ts->linebuf.base, linelength * sizeof(jschar));
    linechars[linelength] = 0;
    linebytes = js_DeflateString(cx, linechars, linelength);
    if (!linebytes) {
        warning = JS_FALSE;
        goto out;
    }
    report.linebuf = linebytes;

    /*
     * FIXME: What should instead happen here is that we should
     * find error-tokens in userbuf, if !ts->file.  That will
     * allow us to deliver a more helpful error message, which
     * includes all or part of the bad string or bad token.  The
     * code here yields something that looks truncated.
     * See https://bugzilla.mozilla.org/show_bug.cgi?id=352970
     */
    index = 0;
    if (tp->begin.lineno == tp->end.lineno) {
        if (tp->begin.index < ts->linepos)
            goto report;

        index = tp->begin.index - ts->linepos;
    }

    report.tokenptr = report.linebuf + index;
    report.uclinebuf = linechars;
    report.uctokenptr = report.uclinebuf + index;

    /*
     * If there's a runtime exception type associated with this error
     * number, set that as the pending exception.  For errors occuring at
     * compile time, this is very likely to be a JSEXN_SYNTAXERR.
     *
     * If an exception is thrown but not caught, the JSREPORT_EXCEPTION
     * flag will be set in report.flags.  Proper behavior for an error
     * reporter is to ignore a report with this flag for all but top-level
     * compilation errors.  The exception will remain pending, and so long
     * as the non-top-level "load", "eval", or "compile" native function
     * returns false, the top-level reporter will eventually receive the
     * uncaught exception report.
     *
     * XXX it'd probably be best if there was only one call to this
     * function, but there seem to be two error reporter call points.
     */
  report:
    onError = cx->errorReporter;

    /*
     * Try to raise an exception only if there isn't one already set --
     * otherwise the exception will describe the last compile-time error,
     * which is likely spurious.
     */
    if (!(ts->flags & TSF_ERROR)) {
        if (js_ErrorToException(cx, message, &report))
            onError = NULL;
    }

    /*
     * Suppress any compile-time errors that don't occur at the top level.
     * This may still fail, as interplevel may be zero in contexts where we
     * don't really want to call the error reporter, as when js is called
     * by other code which could catch the error.
     */
    if (cx->interpLevel != 0 && !JSREPORT_IS_WARNING(flags))
        onError = NULL;

    if (onError) {
        JSDebugErrorHook hook = cx->debugHooks->debugErrorHook;

        /*
         * If debugErrorHook is present then we give it a chance to veto
         * sending the error on to the regular error reporter.
         */
        if (hook && !hook(cx, message, &report,
                          cx->debugHooks->debugErrorHookData)) {
            onError = NULL;
        }
    }
    if (onError)
        (*onError)(cx, message, &report);

  out:
    if (linebytes)
        JS_free(cx, linebytes);
    if (linechars)
        JS_free(cx, linechars);
    if (message)
        JS_free(cx, message);
    if (report.ucmessage)
        JS_free(cx, (void *)report.ucmessage);

    if (report.messageArgs) {
        if (!(flags & JSREPORT_UC)) {
            i = 0;
            while (report.messageArgs[i])
                JS_free(cx, (void *)report.messageArgs[i++]);
        }
        JS_free(cx, (void *)report.messageArgs);
    }

    if (!JSREPORT_IS_WARNING(flags)) {
        /* Set the error flag to suppress spurious reports. */
        ts->flags |= TSF_ERROR;
    }

    return warning;
}

static JSBool
GrowStringBuffer(JSStringBuffer *sb, size_t newlength)
{
    ptrdiff_t offset;
    jschar *bp;

    offset = PTRDIFF(sb->ptr, sb->base, jschar);
    JS_ASSERT(offset >= 0);
    newlength += offset + 1;
    if ((size_t)offset < newlength && newlength < ~(size_t)0 / sizeof(jschar))
        bp = (jschar *) realloc(sb->base, newlength * sizeof(jschar));
    else
        bp = NULL;
    if (!bp) {
        free(sb->base);
        sb->base = STRING_BUFFER_ERROR_BASE;
        return JS_FALSE;
    }
    sb->base = bp;
    sb->ptr = bp + offset;
    sb->limit = bp + newlength - 1;
    return JS_TRUE;
}

static void
FreeStringBuffer(JSStringBuffer *sb)
{
    JS_ASSERT(STRING_BUFFER_OK(sb));
    if (sb->base)
        free(sb->base);
}

void
js_InitStringBuffer(JSStringBuffer *sb)
{
    sb->base = sb->limit = sb->ptr = NULL;
    sb->data = NULL;
    sb->grow = GrowStringBuffer;
    sb->free = FreeStringBuffer;
}

void
js_FinishStringBuffer(JSStringBuffer *sb)
{
    sb->free(sb);
}

#define ENSURE_STRING_BUFFER(sb,n) \
    ((sb)->ptr + (n) <= (sb)->limit || sb->grow(sb, n))

static void
FastAppendChar(JSStringBuffer *sb, jschar c)
{
    if (!STRING_BUFFER_OK(sb))
        return;
    if (!ENSURE_STRING_BUFFER(sb, 1))
        return;
    *sb->ptr++ = c;
}

void
js_AppendChar(JSStringBuffer *sb, jschar c)
{
    jschar *bp;

    if (!STRING_BUFFER_OK(sb))
        return;
    if (!ENSURE_STRING_BUFFER(sb, 1))
        return;
    bp = sb->ptr;
    *bp++ = c;
    *bp = 0;
    sb->ptr = bp;
}

void
js_AppendUCString(JSStringBuffer *sb, const jschar *buf, uintN len)
{
    jschar *bp;

    if (!STRING_BUFFER_OK(sb))
        return;
    if (len == 0 || !ENSURE_STRING_BUFFER(sb, len))
        return;
    bp = sb->ptr;
    js_strncpy(bp, buf, len);
    bp += len;
    *bp = 0;
    sb->ptr = bp;
}

#if JS_HAS_XML_SUPPORT

void
js_RepeatChar(JSStringBuffer *sb, jschar c, uintN count)
{
    jschar *bp;

    if (!STRING_BUFFER_OK(sb) || count == 0)
        return;
    if (!ENSURE_STRING_BUFFER(sb, count))
        return;
    for (bp = sb->ptr; count; --count)
        *bp++ = c;
    *bp = 0;
    sb->ptr = bp;
}

void
js_AppendCString(JSStringBuffer *sb, const char *asciiz)
{
    size_t length;
    jschar *bp;

    if (!STRING_BUFFER_OK(sb) || *asciiz == '\0')
        return;
    length = strlen(asciiz);
    if (!ENSURE_STRING_BUFFER(sb, length))
        return;
    for (bp = sb->ptr; length; --length)
        *bp++ = (jschar) *asciiz++;
    *bp = 0;
    sb->ptr = bp;
}

void
js_AppendJSString(JSStringBuffer *sb, JSString *str)
{
    js_AppendUCString(sb, JSSTRING_CHARS(str), JSSTRING_LENGTH(str));
}

static JSBool
GetXMLEntity(JSContext *cx, JSTokenStream *ts)
{
    ptrdiff_t offset, length, i;
    int32 c, d;
    JSBool ispair;
    jschar *bp, digit;
    char *bytes;
    JSErrNum msg;

    /* Put the entity, including the '&' already scanned, in ts->tokenbuf. */
    offset = PTRDIFF(ts->tokenbuf.ptr, ts->tokenbuf.base, jschar);
    FastAppendChar(&ts->tokenbuf, '&');
    if (!STRING_BUFFER_OK(&ts->tokenbuf))
        return JS_FALSE;
    while ((c = GetChar(ts)) != ';') {
        if (c == EOF || c == '\n') {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_END_OF_XML_ENTITY);
            return JS_FALSE;
        }
        FastAppendChar(&ts->tokenbuf, (jschar) c);
        if (!STRING_BUFFER_OK(&ts->tokenbuf))
            return JS_FALSE;
    }

    /* Let length be the number of jschars after the '&', including the ';'. */
    length = PTRDIFF(ts->tokenbuf.ptr, ts->tokenbuf.base, jschar) - offset;
    bp = ts->tokenbuf.base + offset;
    c = d = 0;
    ispair = JS_FALSE;
    if (length > 2 && bp[1] == '#') {
        /* Match a well-formed XML Character Reference. */
        i = 2;
        if (length > 3 && JS_TOLOWER(bp[i]) == 'x') {
            if (length > 9)     /* at most 6 hex digits allowed */
                goto badncr;
            while (++i < length) {
                digit = bp[i];
                if (!JS7_ISHEX(digit))
                    goto badncr;
                c = (c << 4) + JS7_UNHEX(digit);
            }
        } else {
            while (i < length) {
                digit = bp[i++];
                if (!JS7_ISDEC(digit))
                    goto badncr;
                c = (c * 10) + JS7_UNDEC(digit);
                if (c < 0)
                    goto badncr;
            }
        }

        if (0x10000 <= c && c <= 0x10FFFF) {
            /* Form a surrogate pair (c, d) -- c is the high surrogate. */
            d = 0xDC00 + (c & 0x3FF);
            c = 0xD7C0 + (c >> 10);
            ispair = JS_TRUE;
        } else {
            /* Enforce the http://www.w3.org/TR/REC-xml/#wf-Legalchar WFC. */
            if (c != 0x9 && c != 0xA && c != 0xD &&
                !(0x20 <= c && c <= 0xD7FF) &&
                !(0xE000 <= c && c <= 0xFFFD)) {
                goto badncr;
            }
        }
    } else {
        /* Try to match one of the five XML 1.0 predefined entities. */
        switch (length) {
          case 3:
            if (bp[2] == 't') {
                if (bp[1] == 'l')
                    c = '<';
                else if (bp[1] == 'g')
                    c = '>';
            }
            break;
          case 4:
            if (bp[1] == 'a' && bp[2] == 'm' && bp[3] == 'p')
                c = '&';
            break;
          case 5:
            if (bp[3] == 'o') {
                if (bp[1] == 'a' && bp[2] == 'p' && bp[4] == 's')
                    c = '\'';
                else if (bp[1] == 'q' && bp[2] == 'u' && bp[4] == 't')
                    c = '"';
            }
            break;
        }
        if (c == 0) {
            msg = JSMSG_UNKNOWN_XML_ENTITY;
            goto bad;
        }
    }

    /* If we matched, retract ts->tokenbuf and store the entity's value. */
    *bp++ = (jschar) c;
    if (ispair)
        *bp++ = (jschar) d;
    *bp = 0;
    ts->tokenbuf.ptr = bp;
    return JS_TRUE;

badncr:
    msg = JSMSG_BAD_XML_NCR;
bad:
    /* No match: throw a TypeError per ECMA-357 10.3.2.1 step 8(a). */
    JS_ASSERT(STRING_BUFFER_OK(&ts->tokenbuf));
    JS_ASSERT(PTRDIFF(ts->tokenbuf.ptr, bp, jschar) >= 1);
    bytes = js_DeflateString(cx, bp + 1,
                             PTRDIFF(ts->tokenbuf.ptr, bp, jschar) - 1);
    if (bytes) {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    msg, bytes);
        JS_free(cx, bytes);
    }
    return JS_FALSE;
}

#endif /* JS_HAS_XML_SUPPORT */

JSTokenType
js_PeekToken(JSContext *cx, JSTokenStream *ts)
{
    JSTokenType tt;

    if (ts->lookahead != 0) {
        tt = ts->tokens[(ts->cursor + ts->lookahead) & NTOKENS_MASK].type;
    } else {
        tt = js_GetToken(cx, ts);
        js_UngetToken(ts);
    }
    return tt;
}

JSTokenType
js_PeekTokenSameLine(JSContext *cx, JSTokenStream *ts)
{
    JSTokenType tt;

    if (!ON_CURRENT_LINE(ts, CURRENT_TOKEN(ts).pos))
        return TOK_EOL;
    ts->flags |= TSF_NEWLINES;
    tt = js_PeekToken(cx, ts);
    ts->flags &= ~TSF_NEWLINES;
    return tt;
}

/*
 * We have encountered a '\': check for a Unicode escape sequence after it,
 * returning the character code value if we found a Unicode escape sequence.
 * Otherwise, non-destructively return the original '\'.
 */
static int32
GetUnicodeEscape(JSTokenStream *ts)
{
    jschar cp[5];
    int32 c;

    if (PeekChars(ts, 5, cp) && cp[0] == 'u' &&
        JS7_ISHEX(cp[1]) && JS7_ISHEX(cp[2]) &&
        JS7_ISHEX(cp[3]) && JS7_ISHEX(cp[4]))
    {
        c = (((((JS7_UNHEX(cp[1]) << 4)
                + JS7_UNHEX(cp[2])) << 4)
              + JS7_UNHEX(cp[3])) << 4)
            + JS7_UNHEX(cp[4]);
        SkipChars(ts, 5);
        return c;
    }
    return '\\';
}

static JSToken *
NewToken(JSTokenStream *ts, ptrdiff_t adjust)
{
    JSToken *tp;

    ts->cursor = (ts->cursor + 1) & NTOKENS_MASK;
    tp = &CURRENT_TOKEN(ts);
    tp->ptr = ts->linebuf.ptr + adjust;
    tp->pos.begin.index = ts->linepos +
                          PTRDIFF(tp->ptr, ts->linebuf.base, jschar) -
                          ts->ungetpos;
    tp->pos.begin.lineno = tp->pos.end.lineno = (uint16)ts->lineno;
    return tp;
}

static JS_ALWAYS_INLINE JSBool
ScanAsSpace(jschar c)
{
    /* Treat little- and big-endian BOMs as whitespace for compatibility. */
    if (JS_ISSPACE(c) || c == 0xfffe || c == 0xfeff)
        return JS_TRUE;
    return JS_FALSE;
}

JSTokenType
js_GetToken(JSContext *cx, JSTokenStream *ts)
{
    JSTokenType tt;
    int32 c, qc;
    JSToken *tp;
    JSAtom *atom;
    JSBool hadUnicodeEscape;
    const struct keyword *kw;
#if JS_HAS_XML_SUPPORT
    JSBool inTarget;
    size_t targetLength;
    ptrdiff_t contentIndex;
#endif

#define INIT_TOKENBUF()     (ts->tokenbuf.ptr = ts->tokenbuf.base)
#define TOKENBUF_LENGTH()   PTRDIFF(ts->tokenbuf.ptr, ts->tokenbuf.base, jschar)
#define TOKENBUF_OK()       STRING_BUFFER_OK(&ts->tokenbuf)
#define TOKENBUF_TO_ATOM()  (TOKENBUF_OK()                                    \
                             ? js_AtomizeChars(cx,                            \
                                               TOKENBUF_BASE(),               \
                                               TOKENBUF_LENGTH(),             \
                                               0)                             \
                             : NULL)
#define ADD_TO_TOKENBUF(c)  FastAppendChar(&ts->tokenbuf, (jschar) (c))

/* The following 4 macros should only be used when TOKENBUF_OK() is true. */
#define TOKENBUF_BASE()     (ts->tokenbuf.base)
#define TOKENBUF_END()      (ts->tokenbuf.ptr)
#define TOKENBUF_CHAR(i)    (ts->tokenbuf.base[i])
#define TRIM_TOKENBUF(i)    (ts->tokenbuf.ptr = ts->tokenbuf.base + i)
#define NUL_TERM_TOKENBUF() (*ts->tokenbuf.ptr = 0)

    /* Check for a pushed-back token resulting from mismatching lookahead. */
    while (ts->lookahead != 0) {
        JS_ASSERT(!(ts->flags & TSF_XMLTEXTMODE));
        ts->lookahead--;
        ts->cursor = (ts->cursor + 1) & NTOKENS_MASK;
        tt = CURRENT_TOKEN(ts).type;
        if (tt != TOK_EOL || (ts->flags & TSF_NEWLINES))
            return tt;
    }

    /* If there was a fatal error, keep returning TOK_ERROR. */
    if (ts->flags & TSF_ERROR)
        return TOK_ERROR;

#if JS_HAS_XML_SUPPORT
    if (ts->flags & TSF_XMLTEXTMODE) {
        tt = TOK_XMLSPACE;      /* veto if non-space, return TOK_XMLTEXT */
        tp = NewToken(ts, 0);
        INIT_TOKENBUF();
        qc = (ts->flags & TSF_XMLONLYMODE) ? '<' : '{';

        while ((c = GetChar(ts)) != qc && c != '<' && c != EOF) {
            if (c == '&' && qc == '<') {
                if (!GetXMLEntity(cx, ts))
                    goto error;
                tt = TOK_XMLTEXT;
                continue;
            }

            if (!JS_ISXMLSPACE(c))
                tt = TOK_XMLTEXT;
            ADD_TO_TOKENBUF(c);
        }
        UngetChar(ts, c);

        if (TOKENBUF_LENGTH() == 0) {
            atom = NULL;
        } else {
            atom = TOKENBUF_TO_ATOM();
            if (!atom)
                goto error;
        }
        tp->pos.end.lineno = (uint16)ts->lineno;
        tp->t_op = JSOP_STRING;
        tp->t_atom = atom;
        goto out;
    }

    if (ts->flags & TSF_XMLTAGMODE) {
        tp = NewToken(ts, 0);
        c = GetChar(ts);
        if (JS_ISXMLSPACE(c)) {
            do {
                c = GetChar(ts);
            } while (JS_ISXMLSPACE(c));
            UngetChar(ts, c);
            tt = TOK_XMLSPACE;
            goto out;
        }

        if (c == EOF) {
            tt = TOK_EOF;
            goto out;
        }

        INIT_TOKENBUF();
        if (JS_ISXMLNSSTART(c)) {
            JSBool sawColon = JS_FALSE;

            ADD_TO_TOKENBUF(c);
            while ((c = GetChar(ts)) != EOF && JS_ISXMLNAME(c)) {
                if (c == ':') {
                    int nextc;

                    if (sawColon ||
                        (nextc = PeekChar(ts),
                         ((ts->flags & TSF_XMLONLYMODE) || nextc != '{') &&
                         !JS_ISXMLNAME(nextc))) {
                        js_ReportCompileErrorNumber(cx, ts, NULL,
                                                    JSREPORT_ERROR,
                                                    JSMSG_BAD_XML_QNAME);
                        goto error;
                    }
                    sawColon = JS_TRUE;
                }

                ADD_TO_TOKENBUF(c);
            }

            UngetChar(ts, c);
            atom = TOKENBUF_TO_ATOM();
            if (!atom)
                goto error;
            tp->t_op = JSOP_STRING;
            tp->t_atom = atom;
            tt = TOK_XMLNAME;
            goto out;
        }

        switch (c) {
          case '{':
            if (ts->flags & TSF_XMLONLYMODE)
                goto bad_xml_char;
            tt = TOK_LC;
            goto out;

          case '=':
            tt = TOK_ASSIGN;
            goto out;

          case '"':
          case '\'':
            qc = c;
            while ((c = GetChar(ts)) != qc) {
                if (c == EOF) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_UNTERMINATED_STRING);
                    goto error;
                }

                /*
                 * XML attribute values are double-quoted when pretty-printed,
                 * so escape " if it is expressed directly in a single-quoted
                 * attribute value.
                 */
                if (c == '"' && !(ts->flags & TSF_XMLONLYMODE)) {
                    JS_ASSERT(qc == '\'');
                    js_AppendCString(&ts->tokenbuf, js_quot_entity_str);
                    continue;
                }

                if (c == '&' && (ts->flags & TSF_XMLONLYMODE)) {
                    if (!GetXMLEntity(cx, ts))
                        goto error;
                    continue;
                }

                ADD_TO_TOKENBUF(c);
            }
            atom = TOKENBUF_TO_ATOM();
            if (!atom)
                goto error;
            tp->pos.end.lineno = (uint16)ts->lineno;
            tp->t_op = JSOP_STRING;
            tp->t_atom = atom;
            tt = TOK_XMLATTR;
            goto out;

          case '>':
            tt = TOK_XMLTAGC;
            goto out;

          case '/':
            if (MatchChar(ts, '>')) {
                tt = TOK_XMLPTAGC;
                goto out;
            }
            /* FALL THROUGH */

          bad_xml_char:
          default:
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_XML_CHARACTER);
            goto error;
        }
        /* NOTREACHED */
    }
#endif /* JS_HAS_XML_SUPPORT */

retry:
    do {
        c = GetChar(ts);
        if (c == '\n') {
            ts->flags &= ~TSF_DIRTYLINE;
            if (ts->flags & TSF_NEWLINES)
                break;
        }
    } while (ScanAsSpace((jschar)c));

    tp = NewToken(ts, -1);
    if (c == EOF) {
        tt = TOK_EOF;
        goto out;
    }

    hadUnicodeEscape = JS_FALSE;
    if (JS_ISIDSTART(c) ||
        (c == '\\' &&
         (qc = GetUnicodeEscape(ts),
          hadUnicodeEscape = JS_ISIDSTART(qc)))) {
        if (hadUnicodeEscape)
            c = qc;
        INIT_TOKENBUF();
        for (;;) {
            ADD_TO_TOKENBUF(c);
            c = GetChar(ts);
            if (c == '\\') {
                qc = GetUnicodeEscape(ts);
                if (!JS_ISIDENT(qc))
                    break;
                c = qc;
                hadUnicodeEscape = JS_TRUE;
            } else {
                if (!JS_ISIDENT(c))
                    break;
            }
        }
        UngetChar(ts, c);

        /*
         * Check for keywords unless we saw Unicode escape or parser asks
         * to ignore keywords.
         */
        if (!hadUnicodeEscape &&
            !(ts->flags & TSF_KEYWORD_IS_NAME) &&
            TOKENBUF_OK() &&
            (kw = FindKeyword(TOKENBUF_BASE(), TOKENBUF_LENGTH()))) {
            if (kw->tokentype == TOK_RESERVED) {
                if (!js_ReportCompileErrorNumber(cx, ts, NULL,
                                                 JSREPORT_WARNING |
                                                 JSREPORT_STRICT,
                                                 JSMSG_RESERVED_ID,
                                                 kw->chars)) {
                    goto error;
                }
            } else if (kw->version <= JSVERSION_NUMBER(cx)) {
                tt = kw->tokentype;
                tp->t_op = (JSOp) kw->op;
                goto out;
            }
        }

        atom = TOKENBUF_TO_ATOM();
        if (!atom)
            goto error;
        tp->t_op = JSOP_NAME;
        tp->t_atom = atom;
        tt = TOK_NAME;
        goto out;
    }

    if (JS7_ISDEC(c) || (c == '.' && JS7_ISDEC(PeekChar(ts)))) {
        jsint radix;
        const jschar *endptr;
        jsdouble dval;

        radix = 10;
        INIT_TOKENBUF();

        if (c == '0') {
            ADD_TO_TOKENBUF(c);
            c = GetChar(ts);
            if (JS_TOLOWER(c) == 'x') {
                ADD_TO_TOKENBUF(c);
                c = GetChar(ts);
                radix = 16;
            } else if (JS7_ISDEC(c)) {
                radix = 8;
            }
        }

        while (JS7_ISHEX(c)) {
            if (radix < 16) {
                if (JS7_ISLET(c))
                    break;

                /*
                 * We permit 08 and 09 as decimal numbers, which makes our
                 * behaviour a superset of the ECMA numeric grammar.  We might
                 * not always be so permissive, so we warn about it.
                 */
                if (radix == 8 && c >= '8') {
                    if (!js_ReportCompileErrorNumber(cx, ts, NULL,
                                                     JSREPORT_WARNING,
                                                     JSMSG_BAD_OCTAL,
                                                     c == '8' ? "08" : "09")) {
                        goto error;
                    }
                    radix = 10;
                }
            }
            ADD_TO_TOKENBUF(c);
            c = GetChar(ts);
        }

        if (radix == 10 && (c == '.' || JS_TOLOWER(c) == 'e')) {
            if (c == '.') {
                do {
                    ADD_TO_TOKENBUF(c);
                    c = GetChar(ts);
                } while (JS7_ISDEC(c));
            }
            if (JS_TOLOWER(c) == 'e') {
                ADD_TO_TOKENBUF(c);
                c = GetChar(ts);
                if (c == '+' || c == '-') {
                    ADD_TO_TOKENBUF(c);
                    c = GetChar(ts);
                }
                if (!JS7_ISDEC(c)) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_MISSING_EXPONENT);
                    goto error;
                }
                do {
                    ADD_TO_TOKENBUF(c);
                    c = GetChar(ts);
                } while (JS7_ISDEC(c));
            }
        }

        /* Put back the next char and NUL-terminate tokenbuf for js_strto*. */
        UngetChar(ts, c);
        ADD_TO_TOKENBUF(0);

        if (!TOKENBUF_OK())
            goto error;
        if (radix == 10) {
            if (!js_strtod(cx, TOKENBUF_BASE(), TOKENBUF_END(),
                           &endptr, &dval)) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_OUT_OF_MEMORY);
                goto error;
            }
        } else {
            if (!js_strtointeger(cx, TOKENBUF_BASE(), TOKENBUF_END(),
                                 &endptr, radix, &dval)) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_OUT_OF_MEMORY);
                goto error;
            }
        }
        tp->t_dval = dval;
        tt = TOK_NUMBER;
        goto out;
    }

    if (c == '"' || c == '\'') {
        qc = c;
        INIT_TOKENBUF();
        while ((c = GetChar(ts)) != qc) {
            if (c == '\n' || c == EOF) {
                UngetChar(ts, c);
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_UNTERMINATED_STRING);
                goto error;
            }
            if (c == '\\') {
                switch (c = GetChar(ts)) {
                  case 'b': c = '\b'; break;
                  case 'f': c = '\f'; break;
                  case 'n': c = '\n'; break;
                  case 'r': c = '\r'; break;
                  case 't': c = '\t'; break;
                  case 'v': c = '\v'; break;

                  default:
                    if ('0' <= c && c < '8') {
                        int32 val = JS7_UNDEC(c);

                        c = PeekChar(ts);
                        if ('0' <= c && c < '8') {
                            val = 8 * val + JS7_UNDEC(c);
                            GetChar(ts);
                            c = PeekChar(ts);
                            if ('0' <= c && c < '8') {
                                int32 save = val;
                                val = 8 * val + JS7_UNDEC(c);
                                if (val <= 0377)
                                    GetChar(ts);
                                else
                                    val = save;
                            }
                        }

                        c = (jschar)val;
                    } else if (c == 'u') {
                        jschar cp[4];
                        if (PeekChars(ts, 4, cp) &&
                            JS7_ISHEX(cp[0]) && JS7_ISHEX(cp[1]) &&
                            JS7_ISHEX(cp[2]) && JS7_ISHEX(cp[3])) {
                            c = (((((JS7_UNHEX(cp[0]) << 4)
                                    + JS7_UNHEX(cp[1])) << 4)
                                  + JS7_UNHEX(cp[2])) << 4)
                                + JS7_UNHEX(cp[3]);
                            SkipChars(ts, 4);
                        }
                    } else if (c == 'x') {
                        jschar cp[2];
                        if (PeekChars(ts, 2, cp) &&
                            JS7_ISHEX(cp[0]) && JS7_ISHEX(cp[1])) {
                            c = (JS7_UNHEX(cp[0]) << 4) + JS7_UNHEX(cp[1]);
                            SkipChars(ts, 2);
                        }
                    } else if (c == '\n') {
                        /* ECMA follows C by removing escaped newlines. */
                        continue;
                    }
                    break;
                }
            }
            ADD_TO_TOKENBUF(c);
        }
        atom = TOKENBUF_TO_ATOM();
        if (!atom)
            goto error;
        tp->pos.end.lineno = (uint16)ts->lineno;
        tp->t_op = JSOP_STRING;
        tp->t_atom = atom;
        tt = TOK_STRING;
        goto out;
    }

    switch (c) {
      case '\n': tt = TOK_EOL; goto eol_out;
      case ';':  tt = TOK_SEMI; break;
      case '[':  tt = TOK_LB; break;
      case ']':  tt = TOK_RB; break;
      case '{':  tt = TOK_LC; break;
      case '}':  tt = TOK_RC; break;
      case '(':  tt = TOK_LP; break;
      case ')':  tt = TOK_RP; break;
      case ',':  tt = TOK_COMMA; break;
      case '?':  tt = TOK_HOOK; break;

      case '.':
#if JS_HAS_XML_SUPPORT
        if (MatchChar(ts, c))
            tt = TOK_DBLDOT;
        else
#endif
            tt = TOK_DOT;
        break;

      case ':':
#if JS_HAS_XML_SUPPORT
        if (MatchChar(ts, c)) {
            tt = TOK_DBLCOLON;
            break;
        }
#endif
        /*
         * Default so compiler can modify to JSOP_GETTER if 'p getter: v' in an
         * object initializer, likewise for setter.
         */
        tp->t_op = JSOP_NOP;
        tt = TOK_COLON;
        break;

      case '|':
        if (MatchChar(ts, c)) {
            tt = TOK_OR;
        } else if (MatchChar(ts, '=')) {
            tp->t_op = JSOP_BITOR;
            tt = TOK_ASSIGN;
        } else {
            tt = TOK_BITOR;
        }
        break;

      case '^':
        if (MatchChar(ts, '=')) {
            tp->t_op = JSOP_BITXOR;
            tt = TOK_ASSIGN;
        } else {
            tt = TOK_BITXOR;
        }
        break;

      case '&':
        if (MatchChar(ts, c)) {
            tt = TOK_AND;
        } else if (MatchChar(ts, '=')) {
            tp->t_op = JSOP_BITAND;
            tt = TOK_ASSIGN;
        } else {
            tt = TOK_BITAND;
        }
        break;

      case '=':
        if (MatchChar(ts, c)) {
            tp->t_op = MatchChar(ts, c) ? JSOP_STRICTEQ : JSOP_EQ;
            tt = TOK_EQOP;
        } else {
            tp->t_op = JSOP_NOP;
            tt = TOK_ASSIGN;
        }
        break;

      case '!':
        if (MatchChar(ts, '=')) {
            tp->t_op = MatchChar(ts, '=') ? JSOP_STRICTNE : JSOP_NE;
            tt = TOK_EQOP;
        } else {
            tp->t_op = JSOP_NOT;
            tt = TOK_UNARYOP;
        }
        break;

#if JS_HAS_XML_SUPPORT
      case '@':
        tt = TOK_AT;
        break;
#endif

      case '<':
#if JS_HAS_XML_SUPPORT
        /*
         * After much testing, it's clear that Postel's advice to protocol
         * designers ("be liberal in what you accept, and conservative in what
         * you send") invites a natural-law repercussion for JS as "protocol":
         *
         * "If you are liberal in what you accept, others will utterly fail to
         *  be conservative in what they send."
         *
         * Which means you will get <!-- comments to end of line in the middle
         * of .js files, and after if conditions whose then statements are on
         * the next line, and other wonders.  See at least the following bugs:
         * https://bugzilla.mozilla.org/show_bug.cgi?id=309242
         * https://bugzilla.mozilla.org/show_bug.cgi?id=309712
         * https://bugzilla.mozilla.org/show_bug.cgi?id=310993
         *
         * So without JSOPTION_XML, we never scan an XML comment or CDATA
         * literal.  We always scan <! as the start of an HTML comment hack
         * to end of line, used since Netscape 2 to hide script tag content
         * from script-unaware browsers.
         */
        if ((ts->flags & TSF_OPERAND) &&
            (JS_HAS_XML_OPTION(cx) || PeekChar(ts) != '!')) {
            /* Check for XML comment or CDATA section. */
            if (MatchChar(ts, '!')) {
                INIT_TOKENBUF();

                /* Scan XML comment. */
                if (MatchChar(ts, '-')) {
                    if (!MatchChar(ts, '-'))
                        goto bad_xml_markup;
                    while ((c = GetChar(ts)) != '-' || !MatchChar(ts, '-')) {
                        if (c == EOF)
                            goto bad_xml_markup;
                        ADD_TO_TOKENBUF(c);
                    }
                    tt = TOK_XMLCOMMENT;
                    tp->t_op = JSOP_XMLCOMMENT;
                    goto finish_xml_markup;
                }

                /* Scan CDATA section. */
                if (MatchChar(ts, '[')) {
                    jschar cp[6];
                    if (PeekChars(ts, 6, cp) &&
                        cp[0] == 'C' &&
                        cp[1] == 'D' &&
                        cp[2] == 'A' &&
                        cp[3] == 'T' &&
                        cp[4] == 'A' &&
                        cp[5] == '[') {
                        SkipChars(ts, 6);
                        while ((c = GetChar(ts)) != ']' ||
                               !PeekChars(ts, 2, cp) ||
                               cp[0] != ']' ||
                               cp[1] != '>') {
                            if (c == EOF)
                                goto bad_xml_markup;
                            ADD_TO_TOKENBUF(c);
                        }
                        GetChar(ts);            /* discard ] but not > */
                        tt = TOK_XMLCDATA;
                        tp->t_op = JSOP_XMLCDATA;
                        goto finish_xml_markup;
                    }
                    goto bad_xml_markup;
                }
            }

            /* Check for processing instruction. */
            if (MatchChar(ts, '?')) {
                inTarget = JS_TRUE;
                targetLength = 0;
                contentIndex = -1;

                INIT_TOKENBUF();
                while ((c = GetChar(ts)) != '?' || PeekChar(ts) != '>') {
                    if (c == EOF)
                        goto bad_xml_markup;
                    if (inTarget) {
                        if (JS_ISXMLSPACE(c)) {
                            if (TOKENBUF_LENGTH() == 0)
                                goto bad_xml_markup;
                            inTarget = JS_FALSE;
                        } else {
                            if (!((TOKENBUF_LENGTH() == 0)
                                  ? JS_ISXMLNSSTART(c)
                                  : JS_ISXMLNS(c))) {
                                goto bad_xml_markup;
                            }
                            ++targetLength;
                        }
                    } else {
                        if (contentIndex < 0 && !JS_ISXMLSPACE(c))
                            contentIndex = TOKENBUF_LENGTH();
                    }
                    ADD_TO_TOKENBUF(c);
                }
                if (targetLength == 0)
                    goto bad_xml_markup;
                if (!TOKENBUF_OK())
                    goto error;
                if (contentIndex < 0) {
                    atom = cx->runtime->atomState.emptyAtom;
                } else {
                    atom = js_AtomizeChars(cx,
                                           &TOKENBUF_CHAR(contentIndex),
                                           TOKENBUF_LENGTH() - contentIndex,
                                           0);
                    if (!atom)
                        goto error;
                }
                TRIM_TOKENBUF(targetLength);
                tp->t_atom2 = atom;
                tt = TOK_XMLPI;

        finish_xml_markup:
                if (!MatchChar(ts, '>'))
                    goto bad_xml_markup;
                atom = TOKENBUF_TO_ATOM();
                if (!atom)
                    goto error;
                tp->t_atom = atom;
                tp->pos.end.lineno = (uint16)ts->lineno;
                goto out;
            }

            /* An XML start-of-tag character. */
            tt = MatchChar(ts, '/') ? TOK_XMLETAGO : TOK_XMLSTAGO;
            goto out;

        bad_xml_markup:
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_XML_MARKUP);
            goto error;
        }
#endif /* JS_HAS_XML_SUPPORT */

        /* NB: treat HTML begin-comment as comment-till-end-of-line */
        if (MatchChar(ts, '!')) {
            if (MatchChar(ts, '-')) {
                if (MatchChar(ts, '-')) {
                    ts->flags |= TSF_IN_HTML_COMMENT;
                    goto skipline;
                }
                UngetChar(ts, '-');
            }
            UngetChar(ts, '!');
        }
        if (MatchChar(ts, c)) {
            tp->t_op = JSOP_LSH;
            tt = MatchChar(ts, '=') ? TOK_ASSIGN : TOK_SHOP;
        } else {
            tp->t_op = MatchChar(ts, '=') ? JSOP_LE : JSOP_LT;
            tt = TOK_RELOP;
        }
        break;

      case '>':
        if (MatchChar(ts, c)) {
            tp->t_op = MatchChar(ts, c) ? JSOP_URSH : JSOP_RSH;
            tt = MatchChar(ts, '=') ? TOK_ASSIGN : TOK_SHOP;
        } else {
            tp->t_op = MatchChar(ts, '=') ? JSOP_GE : JSOP_GT;
            tt = TOK_RELOP;
        }
        break;

      case '*':
        tp->t_op = JSOP_MUL;
        tt = MatchChar(ts, '=') ? TOK_ASSIGN : TOK_STAR;
        break;

      case '/':
        if (MatchChar(ts, '/')) {
            /*
             * Hack for source filters such as the Mozilla XUL preprocessor:
             * "//@line 123\n" sets the number of the *next* line after the
             * comment to 123.
             */
            if (JS_HAS_ATLINE_OPTION(cx)) {
                jschar cp[5];
                uintN i, line, temp;
                char filename[1024];

                if (PeekChars(ts, 5, cp) &&
                    cp[0] == '@' &&
                    cp[1] == 'l' &&
                    cp[2] == 'i' &&
                    cp[3] == 'n' &&
                    cp[4] == 'e') {
                    SkipChars(ts, 5);
                    while ((c = GetChar(ts)) != '\n' && ScanAsSpace((jschar)c))
                        continue;
                    if (JS7_ISDEC(c)) {
                        line = JS7_UNDEC(c);
                        while ((c = GetChar(ts)) != EOF && JS7_ISDEC(c)) {
                            temp = 10 * line + JS7_UNDEC(c);
                            if (temp < line) {
                                /* Ignore overlarge line numbers. */
                                goto skipline;
                            }
                            line = temp;
                        }
                        while (c != '\n' && ScanAsSpace((jschar)c))
                            c = GetChar(ts);
                        i = 0;
                        if (c == '"') {
                            while ((c = GetChar(ts)) != EOF && c != '"') {
                                if (c == '\n') {
                                    UngetChar(ts, c);
                                    goto skipline;
                                }
                                if ((c >> 8) != 0 || i >= sizeof filename - 1)
                                    goto skipline;
                                filename[i++] = (char) c;
                            }
                            if (c == '"') {
                                while ((c = GetChar(ts)) != '\n' &&
                                       ScanAsSpace((jschar)c)) {
                                    continue;
                                }
                            }
                        }
                        filename[i] = '\0';
                        if (c == '\n') {
                            if (i > 0) {
                                if (ts->flags & TSF_OWNFILENAME)
                                    JS_free(cx, (void *) ts->filename);
                                ts->filename = JS_strdup(cx, filename);
                                if (!ts->filename)
                                    goto error;
                                ts->flags |= TSF_OWNFILENAME;
                            }
                            ts->lineno = line;
                        }
                    }
                    UngetChar(ts, c);
                }
            }

skipline:
            /* Optimize line skipping if we are not in an HTML comment. */
            if (ts->flags & TSF_IN_HTML_COMMENT) {
                while ((c = GetChar(ts)) != EOF && c != '\n') {
                    if (c == '-' && MatchChar(ts, '-') && MatchChar(ts, '>'))
                        ts->flags &= ~TSF_IN_HTML_COMMENT;
                }
            } else {
                while ((c = GetChar(ts)) != EOF && c != '\n')
                    continue;
            }
            UngetChar(ts, c);
            ts->cursor = (ts->cursor - 1) & NTOKENS_MASK;
            goto retry;
        }

        if (MatchChar(ts, '*')) {
            while ((c = GetChar(ts)) != EOF &&
                   !(c == '*' && MatchChar(ts, '/'))) {
                /* Ignore all characters until comment close. */
            }
            if (c == EOF) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_UNTERMINATED_COMMENT);
                goto error;
            }
            ts->cursor = (ts->cursor - 1) & NTOKENS_MASK;
            goto retry;
        }

        if (ts->flags & TSF_OPERAND) {
            uintN flags;
            JSBool inCharClass = JS_FALSE;

            INIT_TOKENBUF();
            for (;;) {
                c = GetChar(ts);
                if (c == '\n' || c == EOF) {
                    UngetChar(ts, c);
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_UNTERMINATED_REGEXP);
                    goto error;
                }
                if (c == '\\') {
                    ADD_TO_TOKENBUF(c);
                    c = GetChar(ts);
                } else if (c == '[') {
                    inCharClass = JS_TRUE;
                } else if (c == ']') {
                    inCharClass = JS_FALSE;
                } else if (c == '/' && !inCharClass) {
                    /* For compat with IE, allow unescaped / in char classes. */
                    break;
                }
                ADD_TO_TOKENBUF(c);
            }
            for (flags = 0; ; ) {
                c = PeekChar(ts);
                if (c == 'g')
                    flags |= JSREG_GLOB;
                else if (c == 'i')
                    flags |= JSREG_FOLD;
                else if (c == 'm')
                    flags |= JSREG_MULTILINE;
                else if (c == 'y')
                    flags |= JSREG_STICKY;
                else
                    break;
                GetChar(ts);
            }
            c = PeekChar(ts);
            if (JS7_ISLET(c)) {
                tp->ptr = ts->linebuf.ptr - 1;
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_REGEXP_FLAG);
                (void) GetChar(ts);
                goto error;
            }
            /* XXXbe fix jsregexp.c so it doesn't depend on NUL termination */
            if (!TOKENBUF_OK())
                goto error;
            NUL_TERM_TOKENBUF();
            tp->t_reflags = flags;
            tt = TOK_REGEXP;
            break;
        }

        tp->t_op = JSOP_DIV;
        tt = MatchChar(ts, '=') ? TOK_ASSIGN : TOK_DIVOP;
        break;

      case '%':
        tp->t_op = JSOP_MOD;
        tt = MatchChar(ts, '=') ? TOK_ASSIGN : TOK_DIVOP;
        break;

      case '~':
        tp->t_op = JSOP_BITNOT;
        tt = TOK_UNARYOP;
        break;

      case '+':
        if (MatchChar(ts, '=')) {
            tp->t_op = JSOP_ADD;
            tt = TOK_ASSIGN;
        } else if (MatchChar(ts, c)) {
            tt = TOK_INC;
        } else {
            tp->t_op = JSOP_POS;
            tt = TOK_PLUS;
        }
        break;

      case '-':
        if (MatchChar(ts, '=')) {
            tp->t_op = JSOP_SUB;
            tt = TOK_ASSIGN;
        } else if (MatchChar(ts, c)) {
            if (PeekChar(ts) == '>' && !(ts->flags & TSF_DIRTYLINE)) {
                ts->flags &= ~TSF_IN_HTML_COMMENT;
                goto skipline;
            }
            tt = TOK_DEC;
        } else {
            tp->t_op = JSOP_NEG;
            tt = TOK_MINUS;
        }
        break;

#if JS_HAS_SHARP_VARS
      case '#':
      {
        uint32 n;

        c = GetChar(ts);
        if (!JS7_ISDEC(c)) {
            UngetChar(ts, c);
            goto badchar;
        }
        n = (uint32)JS7_UNDEC(c);
        for (;;) {
            c = GetChar(ts);
            if (!JS7_ISDEC(c))
                break;
            n = 10 * n + JS7_UNDEC(c);
            if (n >= UINT16_LIMIT) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_SHARPVAR_TOO_BIG);
                goto error;
            }
        }
        tp->t_dval = (jsdouble) n;
        if (JS_HAS_STRICT_OPTION(cx) &&
            (c == '=' || c == '#')) {
            char buf[20];
            JS_snprintf(buf, sizeof buf, "#%u%c", n, c);
            if (!js_ReportCompileErrorNumber(cx, ts, NULL,
                                             JSREPORT_WARNING |
                                             JSREPORT_STRICT,
                                             JSMSG_DEPRECATED_USAGE,
                                             buf)) {
                goto error;
            }
        }
        if (c == '=')
            tt = TOK_DEFSHARP;
        else if (c == '#')
            tt = TOK_USESHARP;
        else
            goto badchar;
        break;
      }
#endif /* JS_HAS_SHARP_VARS */

#if JS_HAS_SHARP_VARS || JS_HAS_XML_SUPPORT
      badchar:
#endif

      default:
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_ILLEGAL_CHARACTER);
        goto error;
    }

out:
    JS_ASSERT(tt != TOK_EOL);
    ts->flags |= TSF_DIRTYLINE;

eol_out:
    if (!STRING_BUFFER_OK(&ts->tokenbuf))
        tt = TOK_ERROR;
    JS_ASSERT(tt < TOK_LIMIT);
    tp->pos.end.index = ts->linepos +
                        PTRDIFF(ts->linebuf.ptr, ts->linebuf.base, jschar) -
                        ts->ungetpos;
    tp->type = tt;
    return tt;

error:
    tt = TOK_ERROR;
    ts->flags |= TSF_ERROR;
    goto out;

#undef INIT_TOKENBUF
#undef TOKENBUF_LENGTH
#undef TOKENBUF_OK
#undef TOKENBUF_TO_ATOM
#undef ADD_TO_TOKENBUF
#undef TOKENBUF_BASE
#undef TOKENBUF_CHAR
#undef TRIM_TOKENBUF
#undef NUL_TERM_TOKENBUF
}

void
js_UngetToken(JSTokenStream *ts)
{
    JS_ASSERT(ts->lookahead < NTOKENS_MASK);
    ts->lookahead++;
    ts->cursor = (ts->cursor - 1) & NTOKENS_MASK;
}

JSBool
js_MatchToken(JSContext *cx, JSTokenStream *ts, JSTokenType tt)
{
    if (js_GetToken(cx, ts) == tt)
        return JS_TRUE;
    js_UngetToken(ts);
    return JS_FALSE;
}
