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
 * JS regular expressions, after Perl.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "jstypes.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsutil.h" /* Added by JSIFY */
#include "jsapi.h"
#include "jsarray.h"
#include "jsatom.h"
#include "jsbuiltins.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsregexp.h"
#include "jsscan.h"
#include "jsscope.h"
#include "jsstr.h"

#ifdef JS_TRACER
#include "jstracer.h"
using namespace avmplus;
using namespace nanojit;

/* 
 * FIXME  Duplicated with jstracer.cpp, doing it this way for now
 *        to keep it private to files that need it. 
 */
#ifdef JS_JIT_SPEW
static bool verbose_debug = getenv("TRACEMONKEY") && strstr(getenv("TRACEMONKEY"), "verbose");
#define debug_only_v(x) if (verbose_debug) { x; }
#else
#define debug_only_v(x)
#endif
#endif

typedef enum REOp {
#define REOP_DEF(opcode, name) opcode,
#include "jsreops.tbl"
#undef REOP_DEF
    REOP_LIMIT /* META: no operator >= to this */
} REOp;

#define REOP_IS_SIMPLE(op)  ((op) <= REOP_NCLASS)

#ifdef REGEXP_DEBUG
const char *reop_names[] = {
#define REOP_DEF(opcode, name) name,
#include "jsreops.tbl"
#undef REOP_DEF
    NULL
};
#endif

#ifdef __GNUC__
static int
re_debug(const char *fmt, ...) __attribute__ ((format(printf, 1, 2)));
#endif

#ifdef REGEXP_DEBUG
static int
re_debug(const char *fmt, ...)
{
    va_list ap;
    int retval;

    va_start(ap, fmt);
    retval = vprintf(fmt, ap);
    va_end(ap);
    return retval;
}

static void
re_debug_chars(const jschar *chrs, size_t length)
{
    int i = 0;

    printf(" \"");
    while (*chrs && i++ < length) {
        putchar((char)*chrs++);
    }
    printf("\"");
}
#else  /* !REGEXP_DEBUG */
/* This should be optimized to a no-op by our tier-1 compilers. */
static int
re_debug(const char *fmt, ...)
{
    return 0;
}

static void
re_debug_chars(const jschar *chrs, size_t length)
{
}
#endif /* !REGEXP_DEBUG */

struct RENode {
    REOp            op;         /* r.e. op bytecode */
    RENode          *next;      /* next in concatenation order */
    void            *kid;       /* first operand */
    union {
        void        *kid2;      /* second operand */
        jsint       num;        /* could be a number */
        size_t      parenIndex; /* or a parenthesis index */
        struct {                /* or a quantifier range */
            uintN  min;
            uintN  max;
            JSPackedBool greedy;
        } range;
        struct {                /* or a character class */
            size_t  startIndex;
            size_t  kidlen;     /* length of string at kid, in jschars */
            size_t  index;      /* index into class list */
            uint16  bmsize;     /* bitmap size, based on max char code */
            JSPackedBool sense;
        } ucclass;
        struct {                /* or a literal sequence */
            jschar  chr;        /* of one character */
            size_t  length;     /* or many (via the kid) */
        } flat;
        struct {
            RENode  *kid2;      /* second operand from ALT */
            jschar  ch1;        /* match char for ALTPREREQ */
            jschar  ch2;        /* ditto, or class index for ALTPREREQ2 */
        } altprereq;
    } u;
};

#define RE_IS_LETTER(c)     (((c >= 'A') && (c <= 'Z')) ||                    \
                             ((c >= 'a') && (c <= 'z')) )
#define RE_IS_LINE_TERM(c)  ((c == '\n') || (c == '\r') ||                    \
                             (c == LINE_SEPARATOR) || (c == PARA_SEPARATOR))

#define CLASS_CACHE_SIZE    4

typedef struct CompilerState {
    JSContext       *context;
    JSTokenStream   *tokenStream; /* For reporting errors */
    const jschar    *cpbegin;
    const jschar    *cpend;
    const jschar    *cp;
    size_t          parenCount;
    size_t          classCount;   /* number of [] encountered */
    size_t          treeDepth;    /* maximum depth of parse tree */
    size_t          progLength;   /* estimated bytecode length */
    RENode          *result;
    size_t          classBitmapsMem; /* memory to hold all class bitmaps */
    struct {
        const jschar *start;        /* small cache of class strings */
        size_t length;              /* since they're often the same */
        size_t index;
    } classCache[CLASS_CACHE_SIZE];
    uint16          flags;
} CompilerState;

typedef struct EmitStateStackEntry {
    jsbytecode      *altHead;       /* start of REOP_ALT* opcode */
    jsbytecode      *nextAltFixup;  /* fixup pointer to next-alt offset */
    jsbytecode      *nextTermFixup; /* fixup ptr. to REOP_JUMP offset */
    jsbytecode      *endTermFixup;  /* fixup ptr. to REOPT_ALTPREREQ* offset */
    RENode          *continueNode;  /* original REOP_ALT* node being stacked */
    jsbytecode      continueOp;     /* REOP_JUMP or REOP_ENDALT continuation */
    JSPackedBool    jumpToJumpFlag; /* true if we've patched jump-to-jump to
                                       avoid 16-bit unsigned offset overflow */
} EmitStateStackEntry;

/*
 * Immediate operand sizes and getter/setters.  Unlike the ones in jsopcode.h,
 * the getters and setters take the pc of the offset, not of the opcode before
 * the offset.
 */
#define ARG_LEN             2
#define GET_ARG(pc)         ((uint16)(((pc)[0] << 8) | (pc)[1]))
#define SET_ARG(pc, arg)    ((pc)[0] = (jsbytecode) ((arg) >> 8),       \
                             (pc)[1] = (jsbytecode) (arg))

#define OFFSET_LEN          ARG_LEN
#define OFFSET_MAX          (JS_BIT(ARG_LEN * 8) - 1)
#define GET_OFFSET(pc)      GET_ARG(pc)

/*
 * Maximum supported tree depth is maximum size of EmitStateStackEntry stack.
 * For sanity, we limit it to 2^24 bytes.
 */
#define TREE_DEPTH_MAX  (JS_BIT(24) / sizeof(EmitStateStackEntry))

/*
 * The maximum memory that can be allocated for class bitmaps.
 * For sanity, we limit it to 2^24 bytes.
 */
#define CLASS_BITMAPS_MEM_LIMIT JS_BIT(24)

/*
 * Functions to get size and write/read bytecode that represent small indexes
 * compactly.
 * Each byte in the code represent 7-bit chunk of the index. 8th bit when set
 * indicates that the following byte brings more bits to the index. Otherwise
 * this is the last byte in the index bytecode representing highest index bits.
 */
static size_t
GetCompactIndexWidth(size_t index)
{
    size_t width;

    for (width = 1; (index >>= 7) != 0; ++width) { }
    return width;
}

static JS_ALWAYS_INLINE jsbytecode *
WriteCompactIndex(jsbytecode *pc, size_t index)
{
    size_t next;

    while ((next = index >> 7) != 0) {
        *pc++ = (jsbytecode)(index | 0x80);
        index = next;
    }
    *pc++ = (jsbytecode)index;
    return pc;
}

static JS_ALWAYS_INLINE jsbytecode *
ReadCompactIndex(jsbytecode *pc, size_t *result)
{
    size_t nextByte;

    nextByte = *pc++;
    if ((nextByte & 0x80) == 0) {
        /*
         * Short-circuit the most common case when compact index <= 127.
         */
        *result = nextByte;
    } else {
        size_t shift = 7;
        *result = 0x7F & nextByte;
        do {
            nextByte = *pc++;
            *result |= (nextByte & 0x7F) << shift;
            shift += 7;
        } while ((nextByte & 0x80) != 0);
    }
    return pc;
}

typedef struct RECapture {
    ptrdiff_t index;           /* start of contents, -1 for empty  */
    size_t length;             /* length of capture */
} RECapture;

typedef struct REMatchState {
    const jschar *cp;
    RECapture parens[1];      /* first of 're->parenCount' captures,
                                 allocated at end of this struct */
} REMatchState;

struct REBackTrackData;

typedef struct REProgState {
    jsbytecode *continue_pc;        /* current continuation data */
    jsbytecode continue_op;
    ptrdiff_t index;                /* progress in text */
    size_t parenSoFar;              /* highest indexed paren started */
    union {
        struct {
            uintN min;             /* current quantifier limits */
            uintN max;
        } quantifier;
        struct {
            size_t top;             /* backtrack stack state */
            size_t sz;
        } assertion;
    } u;
} REProgState;

typedef struct REBackTrackData {
    size_t sz;                      /* size of previous stack entry */
    jsbytecode *backtrack_pc;       /* where to backtrack to */
    jsbytecode backtrack_op;
    const jschar *cp;               /* index in text of match at backtrack */
    size_t parenIndex;              /* start index of saved paren contents */
    size_t parenCount;              /* # of saved paren contents */
    size_t saveStateStackTop;       /* number of parent states */
    /* saved parent states follow */
    /* saved paren contents follow */
} REBackTrackData;

#define INITIAL_STATESTACK  100
#define INITIAL_BACKTRACK   8000

typedef struct REGlobalData {
    JSContext *cx;
    JSRegExp *regexp;               /* the RE in execution */
    JSBool ok;                      /* runtime error (out_of_memory only?) */
    size_t start;                   /* offset to start at */
    ptrdiff_t skipped;              /* chars skipped anchoring this r.e. */
    const jschar    *cpbegin;       /* text base address */
    const jschar    *cpend;         /* text limit address */

    REProgState *stateStack;        /* stack of state of current parents */
    size_t stateStackTop;
    size_t stateStackLimit;

    REBackTrackData *backTrackStack;/* stack of matched-so-far positions */
    REBackTrackData *backTrackSP;
    size_t backTrackStackSize;
    size_t cursz;                   /* size of current stack entry */
    size_t backTrackCount;          /* how many times we've backtracked */
    size_t backTrackLimit;          /* upper limit on backtrack states */
} REGlobalData;

/*
 * 1. If IgnoreCase is false, return ch.
 * 2. Let u be ch converted to upper case as if by calling
 *    String.prototype.toUpperCase on the one-character string ch.
 * 3. If u does not consist of a single character, return ch.
 * 4. Let cu be u's character.
 * 5. If ch's code point value is greater than or equal to decimal 128 and cu's
 *    code point value is less than decimal 128, then return ch.
 * 6. Return cu.
 */
static JS_ALWAYS_INLINE uintN
upcase(uintN ch)
{
    uintN cu;

    JS_ASSERT((uintN) (jschar) ch == ch);
    if (ch < 128) {
        if (ch - (uintN) 'a' <= (uintN) ('z' - 'a'))
            ch -= (uintN) ('a' - 'A');
        return ch;
    }

    cu = JS_TOUPPER(ch);
    return (cu < 128) ? ch : cu;
}

static JS_ALWAYS_INLINE uintN
downcase(uintN ch)
{
    JS_ASSERT((uintN) (jschar) ch == ch);
    if (ch < 128) {
        if (ch - (uintN) 'A' <= (uintN) ('Z' - 'A'))
            ch += (uintN) ('a' - 'A');
        return ch;
    }

    return JS_TOLOWER(ch);
}

/* Construct and initialize an RENode, returning NULL for out-of-memory */
static RENode *
NewRENode(CompilerState *state, REOp op)
{
    JSContext *cx;
    RENode *ren;

    cx = state->context;
    JS_ARENA_ALLOCATE_CAST(ren, RENode *, &cx->tempPool, sizeof *ren);
    if (!ren) {
        js_ReportOutOfScriptQuota(cx);
        return NULL;
    }
    ren->op = op;
    ren->next = NULL;
    ren->kid = NULL;
    return ren;
}

/*
 * Validates and converts hex ascii value.
 */
static JSBool
isASCIIHexDigit(jschar c, uintN *digit)
{
    uintN cv = c;

    if (cv < '0')
        return JS_FALSE;
    if (cv <= '9') {
        *digit = cv - '0';
        return JS_TRUE;
    }
    cv |= 0x20;
    if (cv >= 'a' && cv <= 'f') {
        *digit = cv - 'a' + 10;
        return JS_TRUE;
    }
    return JS_FALSE;
}


typedef struct {
    REOp op;
    const jschar *errPos;
    size_t parenIndex;
} REOpData;

static JSBool
ReportRegExpErrorHelper(CompilerState *state, uintN flags, uintN errorNumber,
                        const jschar *arg)
{
    if (state->tokenStream) {
        return js_ReportCompileErrorNumber(state->context, state->tokenStream,
                                           NULL, JSREPORT_UC | flags,
                                           errorNumber, arg);
    }
    return JS_ReportErrorFlagsAndNumberUC(state->context, flags,
                                          js_GetErrorMessage, NULL,
                                          errorNumber, arg);
}

static JSBool
ReportRegExpError(CompilerState *state, uintN flags, uintN errorNumber)
{
    return ReportRegExpErrorHelper(state, flags, errorNumber, NULL);
}

/*
 * Process the op against the two top operands, reducing them to a single
 * operand in the penultimate slot. Update progLength and treeDepth.
 */
static JSBool
ProcessOp(CompilerState *state, REOpData *opData, RENode **operandStack,
          intN operandSP)
{
    RENode *result;

    switch (opData->op) {
      case REOP_ALT:
        result = NewRENode(state, REOP_ALT);
        if (!result)
            return JS_FALSE;
        result->kid = operandStack[operandSP - 2];
        result->u.kid2 = operandStack[operandSP - 1];
        operandStack[operandSP - 2] = result;

        if (state->treeDepth == TREE_DEPTH_MAX) {
            ReportRegExpError(state, JSREPORT_ERROR, JSMSG_REGEXP_TOO_COMPLEX);
            return JS_FALSE;
        }
        ++state->treeDepth;

        /*
         * Look at both alternates to see if there's a FLAT or a CLASS at
         * the start of each. If so, use a prerequisite match.
         */
        if (((RENode *) result->kid)->op == REOP_FLAT &&
            ((RENode *) result->u.kid2)->op == REOP_FLAT &&
            (state->flags & JSREG_FOLD) == 0) {
            result->op = REOP_ALTPREREQ;
            result->u.altprereq.ch1 = ((RENode *) result->kid)->u.flat.chr;
            result->u.altprereq.ch2 = ((RENode *) result->u.kid2)->u.flat.chr;
            /* ALTPREREQ, <end>, uch1, uch2, <next>, ...,
                                            JUMP, <end> ... ENDALT */
            state->progLength += 13;
        }
        else
        if (((RENode *) result->kid)->op == REOP_CLASS &&
            ((RENode *) result->kid)->u.ucclass.index < 256 &&
            ((RENode *) result->u.kid2)->op == REOP_FLAT &&
            (state->flags & JSREG_FOLD) == 0) {
            result->op = REOP_ALTPREREQ2;
            result->u.altprereq.ch1 = ((RENode *) result->u.kid2)->u.flat.chr;
            result->u.altprereq.ch2 = ((RENode *) result->kid)->u.ucclass.index;
            /* ALTPREREQ2, <end>, uch1, uch2, <next>, ...,
                                            JUMP, <end> ... ENDALT */
            state->progLength += 13;
        }
        else
        if (((RENode *) result->kid)->op == REOP_FLAT &&
            ((RENode *) result->u.kid2)->op == REOP_CLASS &&
            ((RENode *) result->u.kid2)->u.ucclass.index < 256 &&
            (state->flags & JSREG_FOLD) == 0) {
            result->op = REOP_ALTPREREQ2;
            result->u.altprereq.ch1 = ((RENode *) result->kid)->u.flat.chr;
            result->u.altprereq.ch2 =
                ((RENode *) result->u.kid2)->u.ucclass.index;
            /* ALTPREREQ2, <end>, uch1, uch2, <next>, ...,
                                          JUMP, <end> ... ENDALT */
            state->progLength += 13;
        }
        else {
            /* ALT, <next>, ..., JUMP, <end> ... ENDALT */
            state->progLength += 7;
        }
        break;

      case REOP_CONCAT:
        result = operandStack[operandSP - 2];
        while (result->next)
            result = result->next;
        result->next = operandStack[operandSP - 1];
        break;

      case REOP_ASSERT:
      case REOP_ASSERT_NOT:
      case REOP_LPARENNON:
      case REOP_LPAREN:
        /* These should have been processed by a close paren. */
        ReportRegExpErrorHelper(state, JSREPORT_ERROR, JSMSG_MISSING_PAREN,
                                opData->errPos);
        return JS_FALSE;

      default:;
    }
    return JS_TRUE;
}

/*
 * Parser forward declarations.
 */
static JSBool ParseTerm(CompilerState *state);
static JSBool ParseQuantifier(CompilerState *state);
static intN ParseMinMaxQuantifier(CompilerState *state, JSBool ignoreValues);

/*
 * Top-down regular expression grammar, based closely on Perl4.
 *
 *  regexp:     altern                  A regular expression is one or more
 *              altern '|' regexp       alternatives separated by vertical bar.
 */
#define INITIAL_STACK_SIZE  128

static JSBool
ParseRegExp(CompilerState *state)
{
    size_t parenIndex;
    RENode *operand;
    REOpData *operatorStack;
    RENode **operandStack;
    REOp op;
    intN i;
    JSBool result = JS_FALSE;

    intN operatorSP = 0, operatorStackSize = INITIAL_STACK_SIZE;
    intN operandSP = 0, operandStackSize = INITIAL_STACK_SIZE;

    /* Watch out for empty regexp */
    if (state->cp == state->cpend) {
        state->result = NewRENode(state, REOP_EMPTY);
        return (state->result != NULL);
    }

    operatorStack = (REOpData *)
        JS_malloc(state->context, sizeof(REOpData) * operatorStackSize);
    if (!operatorStack)
        return JS_FALSE;

    operandStack = (RENode **)
        JS_malloc(state->context, sizeof(RENode *) * operandStackSize);
    if (!operandStack)
        goto out;

    for (;;) {
        parenIndex = state->parenCount;
        if (state->cp == state->cpend) {
            /*
             * If we are at the end of the regexp and we're short one or more
             * operands, the regexp must have the form /x|/ or some such, with
             * left parentheses making us short more than one operand.
             */
            if (operatorSP >= operandSP) {
                operand = NewRENode(state, REOP_EMPTY);
                if (!operand)
                    goto out;
                goto pushOperand;
            }
        } else {
            switch (*state->cp) {
              case '(':
                ++state->cp;
                if (state->cp + 1 < state->cpend &&
                    *state->cp == '?' &&
                    (state->cp[1] == '=' ||
                     state->cp[1] == '!' ||
                     state->cp[1] == ':')) {
                    switch (state->cp[1]) {
                      case '=':
                        op = REOP_ASSERT;
                        /* ASSERT, <next>, ... ASSERTTEST */
                        state->progLength += 4;
                        break;
                      case '!':
                        op = REOP_ASSERT_NOT;
                        /* ASSERTNOT, <next>, ... ASSERTNOTTEST */
                        state->progLength += 4;
                        break;
                      default:
                        op = REOP_LPARENNON;
                        break;
                    }
                    state->cp += 2;
                } else {
                    op = REOP_LPAREN;
                    /* LPAREN, <index>, ... RPAREN, <index> */
                    state->progLength
                        += 2 * (1 + GetCompactIndexWidth(parenIndex));
                    state->parenCount++;
                    if (state->parenCount == 65535) {
                        ReportRegExpError(state, JSREPORT_ERROR,
                                          JSMSG_TOO_MANY_PARENS);
                        goto out;
                    }
                }
                goto pushOperator;

              case ')':
                /*
                 * If there's no stacked open parenthesis, throw syntax error.
                 */
                for (i = operatorSP - 1; ; i--) {
                    if (i < 0) {
                        ReportRegExpError(state, JSREPORT_ERROR,
                                          JSMSG_UNMATCHED_RIGHT_PAREN);
                        goto out;
                    }
                    if (operatorStack[i].op == REOP_ASSERT ||
                        operatorStack[i].op == REOP_ASSERT_NOT ||
                        operatorStack[i].op == REOP_LPARENNON ||
                        operatorStack[i].op == REOP_LPAREN) {
                        break;
                    }
                }
                /* FALL THROUGH */

              case '|':
                /* Expected an operand before these, so make an empty one */
                operand = NewRENode(state, REOP_EMPTY);
                if (!operand)
                    goto out;
                goto pushOperand;

              default:
                if (!ParseTerm(state))
                    goto out;
                operand = state->result;
pushOperand:
                if (operandSP == operandStackSize) {
                    RENode **tmp;
                    operandStackSize += operandStackSize;
                    tmp = (RENode **)
                        JS_realloc(state->context, operandStack,
                                   sizeof(RENode *) * operandStackSize);
                    if (!tmp)
                        goto out;
                    operandStack = tmp;
                }
                operandStack[operandSP++] = operand;
                break;
            }
        }

        /* At the end; process remaining operators. */
restartOperator:
        if (state->cp == state->cpend) {
            while (operatorSP) {
                --operatorSP;
                if (!ProcessOp(state, &operatorStack[operatorSP],
                               operandStack, operandSP))
                    goto out;
                --operandSP;
            }
            JS_ASSERT(operandSP == 1);
            state->result = operandStack[0];
            result = JS_TRUE;
            goto out;
        }

        switch (*state->cp) {
          case '|':
            /* Process any stacked 'concat' operators */
            ++state->cp;
            while (operatorSP &&
                   operatorStack[operatorSP - 1].op == REOP_CONCAT) {
                --operatorSP;
                if (!ProcessOp(state, &operatorStack[operatorSP],
                               operandStack, operandSP)) {
                    goto out;
                }
                --operandSP;
            }
            op = REOP_ALT;
            goto pushOperator;

          case ')':
            /*
             * If there's no stacked open parenthesis, throw syntax error.
             */
            for (i = operatorSP - 1; ; i--) {
                if (i < 0) {
                    ReportRegExpError(state, JSREPORT_ERROR,
                                      JSMSG_UNMATCHED_RIGHT_PAREN);
                    goto out;
                }
                if (operatorStack[i].op == REOP_ASSERT ||
                    operatorStack[i].op == REOP_ASSERT_NOT ||
                    operatorStack[i].op == REOP_LPARENNON ||
                    operatorStack[i].op == REOP_LPAREN) {
                    break;
                }
            }
            ++state->cp;

            /* Process everything on the stack until the open parenthesis. */
            for (;;) {
                JS_ASSERT(operatorSP);
                --operatorSP;
                switch (operatorStack[operatorSP].op) {
                  case REOP_ASSERT:
                  case REOP_ASSERT_NOT:
                  case REOP_LPAREN:
                    operand = NewRENode(state, operatorStack[operatorSP].op);
                    if (!operand)
                        goto out;
                    operand->u.parenIndex =
                        operatorStack[operatorSP].parenIndex;
                    JS_ASSERT(operandSP);
                    operand->kid = operandStack[operandSP - 1];
                    operandStack[operandSP - 1] = operand;
                    if (state->treeDepth == TREE_DEPTH_MAX) {
                        ReportRegExpError(state, JSREPORT_ERROR,
                                          JSMSG_REGEXP_TOO_COMPLEX);
                        goto out;
                    }
                    ++state->treeDepth;
                    /* FALL THROUGH */

                  case REOP_LPARENNON:
                    state->result = operandStack[operandSP - 1];
                    if (!ParseQuantifier(state))
                        goto out;
                    operandStack[operandSP - 1] = state->result;
                    goto restartOperator;
                  default:
                    if (!ProcessOp(state, &operatorStack[operatorSP],
                                   operandStack, operandSP))
                        goto out;
                    --operandSP;
                    break;
                }
            }
            break;

          case '{':
          {
            const jschar *errp = state->cp;

            if (ParseMinMaxQuantifier(state, JS_TRUE) < 0) {
                /*
                 * This didn't even scan correctly as a quantifier, so we should
                 * treat it as flat.
                 */
                op = REOP_CONCAT;
                goto pushOperator;
            }

            state->cp = errp;
            /* FALL THROUGH */
          }

          case '+':
          case '*':
          case '?':
            ReportRegExpErrorHelper(state, JSREPORT_ERROR, JSMSG_BAD_QUANTIFIER,
                                    state->cp);
            result = JS_FALSE;
            goto out;

          default:
            /* Anything else is the start of the next term. */
            op = REOP_CONCAT;
pushOperator:
            if (operatorSP == operatorStackSize) {
                REOpData *tmp;
                operatorStackSize += operatorStackSize;
                tmp = (REOpData *)
                    JS_realloc(state->context, operatorStack,
                               sizeof(REOpData) * operatorStackSize);
                if (!tmp)
                    goto out;
                operatorStack = tmp;
            }
            operatorStack[operatorSP].op = op;
            operatorStack[operatorSP].errPos = state->cp;
            operatorStack[operatorSP++].parenIndex = parenIndex;
            break;
        }
    }
out:
    if (operatorStack)
        JS_free(state->context, operatorStack);
    if (operandStack)
        JS_free(state->context, operandStack);
    return result;
}

/*
 * Hack two bits in CompilerState.flags, for use within FindParenCount to flag
 * its being on the stack, and to propagate errors to its callers.
 */
#define JSREG_FIND_PAREN_COUNT  0x8000
#define JSREG_FIND_PAREN_ERROR  0x4000

/*
 * Magic return value from FindParenCount and GetDecimalValue, to indicate
 * overflow beyond GetDecimalValue's max parameter, or a computed maximum if
 * its findMax parameter is non-null.
 */
#define OVERFLOW_VALUE          ((uintN)-1)

static uintN
FindParenCount(CompilerState *state)
{
    CompilerState temp;
    int i;

    if (state->flags & JSREG_FIND_PAREN_COUNT)
        return OVERFLOW_VALUE;

    /*
     * Copy state into temp, flag it so we never report an invalid backref,
     * and reset its members to parse the entire regexp.  This is obviously
     * suboptimal, but GetDecimalValue calls us only if a backref appears to
     * refer to a forward parenthetical, which is rare.
     */
    temp = *state;
    temp.flags |= JSREG_FIND_PAREN_COUNT;
    temp.cp = temp.cpbegin;
    temp.parenCount = 0;
    temp.classCount = 0;
    temp.progLength = 0;
    temp.treeDepth = 0;
    temp.classBitmapsMem = 0;
    for (i = 0; i < CLASS_CACHE_SIZE; i++)
        temp.classCache[i].start = NULL;

    if (!ParseRegExp(&temp)) {
        state->flags |= JSREG_FIND_PAREN_ERROR;
        return OVERFLOW_VALUE;
    }
    return temp.parenCount;
}

/*
 * Extract and return a decimal value at state->cp.  The initial character c
 * has already been read.  Return OVERFLOW_VALUE if the result exceeds max.
 * Callers who pass a non-null findMax should test JSREG_FIND_PAREN_ERROR in
 * state->flags to discover whether an error occurred under findMax.
 */
static uintN
GetDecimalValue(jschar c, uintN max, uintN (*findMax)(CompilerState *state),
                CompilerState *state)
{
    uintN value = JS7_UNDEC(c);
    JSBool overflow = (value > max && (!findMax || value > findMax(state)));

    /* The following restriction allows simpler overflow checks. */
    JS_ASSERT(max <= ((uintN)-1 - 9) / 10);
    while (state->cp < state->cpend) {
        c = *state->cp;
        if (!JS7_ISDEC(c))
            break;
        value = 10 * value + JS7_UNDEC(c);
        if (!overflow && value > max && (!findMax || value > findMax(state)))
            overflow = JS_TRUE;
        ++state->cp;
    }
    return overflow ? OVERFLOW_VALUE : value;
}

/*
 * Calculate the total size of the bitmap required for a class expression.
 */
static JSBool
CalculateBitmapSize(CompilerState *state, RENode *target, const jschar *src,
                    const jschar *end)
{
    uintN max = 0;
    JSBool inRange = JS_FALSE;
    jschar c, rangeStart = 0;
    uintN n, digit, nDigits, i;

    target->u.ucclass.bmsize = 0;
    target->u.ucclass.sense = JS_TRUE;

    if (src == end)
        return JS_TRUE;

    if (*src == '^') {
        ++src;
        target->u.ucclass.sense = JS_FALSE;
    }

    while (src != end) {
        JSBool canStartRange = JS_TRUE;
        uintN localMax = 0;

        switch (*src) {
          case '\\':
            ++src;
            c = *src++;
            switch (c) {
              case 'b':
                localMax = 0x8;
                break;
              case 'f':
                localMax = 0xC;
                break;
              case 'n':
                localMax = 0xA;
                break;
              case 'r':
                localMax = 0xD;
                break;
              case 't':
                localMax = 0x9;
                break;
              case 'v':
                localMax = 0xB;
                break;
              case 'c':
                if (src < end && RE_IS_LETTER(*src)) {
                    localMax = (uintN) (*src++) & 0x1F;
                } else {
                    --src;
                    localMax = '\\';
                }
                break;
              case 'x':
                nDigits = 2;
                goto lexHex;
              case 'u':
                nDigits = 4;
lexHex:
                n = 0;
                for (i = 0; (i < nDigits) && (src < end); i++) {
                    c = *src++;
                    if (!isASCIIHexDigit(c, &digit)) {
                        /*
                         * Back off to accepting the original
                         *'\' as a literal.
                         */
                        src -= i + 1;
                        n = '\\';
                        break;
                    }
                    n = (n << 4) | digit;
                }
                localMax = n;
                break;
              case 'd':
                canStartRange = JS_FALSE;
                if (inRange) {
                    JS_ReportErrorNumber(state->context,
                                         js_GetErrorMessage, NULL,
                                         JSMSG_BAD_CLASS_RANGE);
                    return JS_FALSE;
                }
                localMax = '9';
                break;
              case 'D':
              case 's':
              case 'S':
              case 'w':
              case 'W':
                canStartRange = JS_FALSE;
                if (inRange) {
                    JS_ReportErrorNumber(state->context,
                                         js_GetErrorMessage, NULL,
                                         JSMSG_BAD_CLASS_RANGE);
                    return JS_FALSE;
                }
                max = 65535;

                /*
                 * If this is the start of a range, ensure that it's less than
                 * the end.
                 */
                localMax = 0;
                break;
              case '0':
              case '1':
              case '2':
              case '3':
              case '4':
              case '5':
              case '6':
              case '7':
                /*
                 *  This is a non-ECMA extension - decimal escapes (in this
                 *  case, octal!) are supposed to be an error inside class
                 *  ranges, but supported here for backwards compatibility.
                 *
                 */
                n = JS7_UNDEC(c);
                c = *src;
                if ('0' <= c && c <= '7') {
                    src++;
                    n = 8 * n + JS7_UNDEC(c);
                    c = *src;
                    if ('0' <= c && c <= '7') {
                        src++;
                        i = 8 * n + JS7_UNDEC(c);
                        if (i <= 0377)
                            n = i;
                        else
                            src--;
                    }
                }
                localMax = n;
                break;

              default:
                localMax = c;
                break;
            }
            break;
          default:
            localMax = *src++;
            break;
        }

        if (inRange) {
            /* Throw a SyntaxError here, per ECMA-262, 15.10.2.15. */
            if (rangeStart > localMax) {
                JS_ReportErrorNumber(state->context,
                                     js_GetErrorMessage, NULL,
                                     JSMSG_BAD_CLASS_RANGE);
                return JS_FALSE;
            }
            inRange = JS_FALSE;
        } else {
            if (canStartRange && src < end - 1) {
                if (*src == '-') {
                    ++src;
                    inRange = JS_TRUE;
                    rangeStart = (jschar)localMax;
                    continue;
                }
            }
            if (state->flags & JSREG_FOLD)
                rangeStart = localMax;   /* one run of the uc/dc loop below */
        }

        if (state->flags & JSREG_FOLD) {
            jschar maxch = localMax;

            for (i = rangeStart; i <= localMax; i++) {
                jschar uch, dch;

                uch = upcase(i);
                dch = downcase(i);
                maxch = JS_MAX(maxch, uch);
                maxch = JS_MAX(maxch, dch);
            }
            localMax = maxch;
        }

        if (localMax > max)
            max = localMax;
    }
    target->u.ucclass.bmsize = max;
    return JS_TRUE;
}

/*
 *  item:       assertion               An item is either an assertion or
 *              quantatom               a quantified atom.
 *
 *  assertion:  '^'                     Assertions match beginning of string
 *                                      (or line if the class static property
 *                                      RegExp.multiline is true).
 *              '$'                     End of string (or line if the class
 *                                      static property RegExp.multiline is
 *                                      true).
 *              '\b'                    Word boundary (between \w and \W).
 *              '\B'                    Word non-boundary.
 *
 *  quantatom:  atom                    An unquantified atom.
 *              quantatom '{' n ',' m '}'
 *                                      Atom must occur between n and m times.
 *              quantatom '{' n ',' '}' Atom must occur at least n times.
 *              quantatom '{' n '}'     Atom must occur exactly n times.
 *              quantatom '*'           Zero or more times (same as {0,}).
 *              quantatom '+'           One or more times (same as {1,}).
 *              quantatom '?'           Zero or one time (same as {0,1}).
 *
 *              any of which can be optionally followed by '?' for ungreedy
 *
 *  atom:       '(' regexp ')'          A parenthesized regexp (what matched
 *                                      can be addressed using a backreference,
 *                                      see '\' n below).
 *              '.'                     Matches any char except '\n'.
 *              '[' classlist ']'       A character class.
 *              '[' '^' classlist ']'   A negated character class.
 *              '\f'                    Form Feed.
 *              '\n'                    Newline (Line Feed).
 *              '\r'                    Carriage Return.
 *              '\t'                    Horizontal Tab.
 *              '\v'                    Vertical Tab.
 *              '\d'                    A digit (same as [0-9]).
 *              '\D'                    A non-digit.
 *              '\w'                    A word character, [0-9a-z_A-Z].
 *              '\W'                    A non-word character.
 *              '\s'                    A whitespace character, [ \b\f\n\r\t\v].
 *              '\S'                    A non-whitespace character.
 *              '\' n                   A backreference to the nth (n decimal
 *                                      and positive) parenthesized expression.
 *              '\' octal               An octal escape sequence (octal must be
 *                                      two or three digits long, unless it is
 *                                      0 for the null character).
 *              '\x' hex                A hex escape (hex must be two digits).
 *              '\u' unicode            A unicode escape (must be four digits).
 *              '\c' ctrl               A control character, ctrl is a letter.
 *              '\' literalatomchar     Any character except one of the above
 *                                      that follow '\' in an atom.
 *              otheratomchar           Any character not first among the other
 *                                      atom right-hand sides.
 */
static JSBool
ParseTerm(CompilerState *state)
{
    jschar c = *state->cp++;
    uintN nDigits;
    uintN num, tmp, n, i;
    const jschar *termStart;

    switch (c) {
    /* assertions and atoms */
      case '^':
        state->result = NewRENode(state, REOP_BOL);
        if (!state->result)
            return JS_FALSE;
        state->progLength++;
        return JS_TRUE;
      case '$':
        state->result = NewRENode(state, REOP_EOL);
        if (!state->result)
            return JS_FALSE;
        state->progLength++;
        return JS_TRUE;
      case '\\':
        if (state->cp >= state->cpend) {
            /* a trailing '\' is an error */
            ReportRegExpError(state, JSREPORT_ERROR, JSMSG_TRAILING_SLASH);
            return JS_FALSE;
        }
        c = *state->cp++;
        switch (c) {
        /* assertion escapes */
          case 'b' :
            state->result = NewRENode(state, REOP_WBDRY);
            if (!state->result)
                return JS_FALSE;
            state->progLength++;
            return JS_TRUE;
          case 'B':
            state->result = NewRENode(state, REOP_WNONBDRY);
            if (!state->result)
                return JS_FALSE;
            state->progLength++;
            return JS_TRUE;
          /* Decimal escape */
          case '0':
            /* Give a strict warning. See also the note below. */
            if (!ReportRegExpError(state, JSREPORT_WARNING | JSREPORT_STRICT,
                                   JSMSG_INVALID_BACKREF)) {
                return JS_FALSE;
            }
     doOctal:
            num = 0;
            while (state->cp < state->cpend) {
                c = *state->cp;
                if (c < '0' || '7' < c)
                    break;
                state->cp++;
                tmp = 8 * num + (uintN)JS7_UNDEC(c);
                if (tmp > 0377)
                    break;
                num = tmp;
            }
            c = (jschar)num;
    doFlat:
            state->result = NewRENode(state, REOP_FLAT);
            if (!state->result)
                return JS_FALSE;
            state->result->u.flat.chr = c;
            state->result->u.flat.length = 1;
            state->progLength += 3;
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            termStart = state->cp - 1;
            num = GetDecimalValue(c, state->parenCount, FindParenCount, state);
            if (state->flags & JSREG_FIND_PAREN_ERROR)
                return JS_FALSE;
            if (num == OVERFLOW_VALUE) {
                /* Give a strict mode warning. */
                if (!ReportRegExpError(state,
                                       JSREPORT_WARNING | JSREPORT_STRICT,
                                       (c >= '8')
                                       ? JSMSG_INVALID_BACKREF
                                       : JSMSG_BAD_BACKREF)) {
                    return JS_FALSE;
                }

                /*
                 * Note: ECMA 262, 15.10.2.9 says that we should throw a syntax
                 * error here. However, for compatibility with IE, we treat the
                 * whole backref as flat if the first character in it is not a
                 * valid octal character, and as an octal escape otherwise.
                 */
                state->cp = termStart;
                if (c >= '8') {
                    /* Treat this as flat. termStart - 1 is the \. */
                    c = '\\';
                    goto asFlat;
                }

                /* Treat this as an octal escape. */
                goto doOctal;
            }
            JS_ASSERT(1 <= num && num <= 0x10000);
            state->result = NewRENode(state, REOP_BACKREF);
            if (!state->result)
                return JS_FALSE;
            state->result->u.parenIndex = num - 1;
            state->progLength
                += 1 + GetCompactIndexWidth(state->result->u.parenIndex);
            break;
          /* Control escape */
          case 'f':
            c = 0xC;
            goto doFlat;
          case 'n':
            c = 0xA;
            goto doFlat;
          case 'r':
            c = 0xD;
            goto doFlat;
          case 't':
            c = 0x9;
            goto doFlat;
          case 'v':
            c = 0xB;
            goto doFlat;
          /* Control letter */
          case 'c':
            if (state->cp < state->cpend && RE_IS_LETTER(*state->cp)) {
                c = (jschar) (*state->cp++ & 0x1F);
            } else {
                /* back off to accepting the original '\' as a literal */
                --state->cp;
                c = '\\';
            }
            goto doFlat;
          /* HexEscapeSequence */
          case 'x':
            nDigits = 2;
            goto lexHex;
          /* UnicodeEscapeSequence */
          case 'u':
            nDigits = 4;
lexHex:
            n = 0;
            for (i = 0; i < nDigits && state->cp < state->cpend; i++) {
                uintN digit;
                c = *state->cp++;
                if (!isASCIIHexDigit(c, &digit)) {
                    /*
                     * Back off to accepting the original 'u' or 'x' as a
                     * literal.
                     */
                    state->cp -= i + 2;
                    n = *state->cp++;
                    break;
                }
                n = (n << 4) | digit;
            }
            c = (jschar) n;
            goto doFlat;
          /* Character class escapes */
          case 'd':
            state->result = NewRENode(state, REOP_DIGIT);
doSimple:
            if (!state->result)
                return JS_FALSE;
            state->progLength++;
            break;
          case 'D':
            state->result = NewRENode(state, REOP_NONDIGIT);
            goto doSimple;
          case 's':
            state->result = NewRENode(state, REOP_SPACE);
            goto doSimple;
          case 'S':
            state->result = NewRENode(state, REOP_NONSPACE);
            goto doSimple;
          case 'w':
            state->result = NewRENode(state, REOP_ALNUM);
            goto doSimple;
          case 'W':
            state->result = NewRENode(state, REOP_NONALNUM);
            goto doSimple;
          /* IdentityEscape */
          default:
            state->result = NewRENode(state, REOP_FLAT);
            if (!state->result)
                return JS_FALSE;
            state->result->u.flat.chr = c;
            state->result->u.flat.length = 1;
            state->result->kid = (void *) (state->cp - 1);
            state->progLength += 3;
            break;
        }
        break;
      case '[':
        state->result = NewRENode(state, REOP_CLASS);
        if (!state->result)
            return JS_FALSE;
        termStart = state->cp;
        state->result->u.ucclass.startIndex = termStart - state->cpbegin;
        for (;;) {
            if (state->cp == state->cpend) {
                ReportRegExpErrorHelper(state, JSREPORT_ERROR,
                                        JSMSG_UNTERM_CLASS, termStart);

                return JS_FALSE;
            }
            if (*state->cp == '\\') {
                state->cp++;
                if (state->cp != state->cpend)
                    state->cp++;
                continue;
            }
            if (*state->cp == ']') {
                state->result->u.ucclass.kidlen = state->cp - termStart;
                break;
            }
            state->cp++;
        }
        for (i = 0; i < CLASS_CACHE_SIZE; i++) {
            if (!state->classCache[i].start) {
                state->classCache[i].start = termStart;
                state->classCache[i].length = state->result->u.ucclass.kidlen;
                state->classCache[i].index = state->classCount;
                break;
            }
            if (state->classCache[i].length ==
                state->result->u.ucclass.kidlen) {
                for (n = 0; ; n++) {
                    if (n == state->classCache[i].length) {
                        state->result->u.ucclass.index
                            = state->classCache[i].index;
                        goto claim;
                    }
                    if (state->classCache[i].start[n] != termStart[n])
                        break;
                }
            }
        }
        state->result->u.ucclass.index = state->classCount++;

    claim:
        /*
         * Call CalculateBitmapSize now as we want any errors it finds
         * to be reported during the parse phase, not at execution.
         */
        if (!CalculateBitmapSize(state, state->result, termStart, state->cp++))
            return JS_FALSE;
        /*
         * Update classBitmapsMem with number of bytes to hold bmsize bits,
         * which is (bitsCount + 7) / 8 or (highest_bit + 1 + 7) / 8
         * or highest_bit / 8 + 1 where highest_bit is u.ucclass.bmsize.
         */
        n = (state->result->u.ucclass.bmsize >> 3) + 1;
        if (n > CLASS_BITMAPS_MEM_LIMIT - state->classBitmapsMem) {
            ReportRegExpError(state, JSREPORT_ERROR, JSMSG_REGEXP_TOO_COMPLEX);
            return JS_FALSE;
        }
        state->classBitmapsMem += n;
        /* CLASS, <index> */
        state->progLength
            += 1 + GetCompactIndexWidth(state->result->u.ucclass.index);
        break;

      case '.':
        state->result = NewRENode(state, REOP_DOT);
        goto doSimple;

      case '{':
      {
        const jschar *errp = state->cp--;
        intN err;

        err = ParseMinMaxQuantifier(state, JS_TRUE);
        state->cp = errp;

        if (err < 0)
            goto asFlat;

        /* FALL THROUGH */
      }
      case '*':
      case '+':
      case '?':
        ReportRegExpErrorHelper(state, JSREPORT_ERROR,
                                JSMSG_BAD_QUANTIFIER, state->cp - 1);
        return JS_FALSE;
      default:
asFlat:
        state->result = NewRENode(state, REOP_FLAT);
        if (!state->result)
            return JS_FALSE;
        state->result->u.flat.chr = c;
        state->result->u.flat.length = 1;
        state->result->kid = (void *) (state->cp - 1);
        state->progLength += 3;
        break;
    }
    return ParseQuantifier(state);
}

static JSBool
ParseQuantifier(CompilerState *state)
{
    RENode *term;
    term = state->result;
    if (state->cp < state->cpend) {
        switch (*state->cp) {
          case '+':
            state->result = NewRENode(state, REOP_QUANT);
            if (!state->result)
                return JS_FALSE;
            state->result->u.range.min = 1;
            state->result->u.range.max = (uintN)-1;
            /* <PLUS>, <next> ... <ENDCHILD> */
            state->progLength += 4;
            goto quantifier;
          case '*':
            state->result = NewRENode(state, REOP_QUANT);
            if (!state->result)
                return JS_FALSE;
            state->result->u.range.min = 0;
            state->result->u.range.max = (uintN)-1;
            /* <STAR>, <next> ... <ENDCHILD> */
            state->progLength += 4;
            goto quantifier;
          case '?':
            state->result = NewRENode(state, REOP_QUANT);
            if (!state->result)
                return JS_FALSE;
            state->result->u.range.min = 0;
            state->result->u.range.max = 1;
            /* <OPT>, <next> ... <ENDCHILD> */
            state->progLength += 4;
            goto quantifier;
          case '{':       /* balance '}' */
          {
            intN err;
            const jschar *errp = state->cp;

            err = ParseMinMaxQuantifier(state, JS_FALSE);
            if (err == 0)
                goto quantifier;
            if (err == -1)
                return JS_TRUE;

            ReportRegExpErrorHelper(state, JSREPORT_ERROR, err, errp);
            return JS_FALSE;
          }
          default:;
        }
    }
    return JS_TRUE;

quantifier:
    if (state->treeDepth == TREE_DEPTH_MAX) {
        ReportRegExpError(state, JSREPORT_ERROR, JSMSG_REGEXP_TOO_COMPLEX);
        return JS_FALSE;
    }

    ++state->treeDepth;
    ++state->cp;
    state->result->kid = term;
    if (state->cp < state->cpend && *state->cp == '?') {
        ++state->cp;
        state->result->u.range.greedy = JS_FALSE;
    } else {
        state->result->u.range.greedy = JS_TRUE;
    }
    return JS_TRUE;
}

static intN
ParseMinMaxQuantifier(CompilerState *state, JSBool ignoreValues)
{
    uintN min, max;
    jschar c;
    const jschar *errp = state->cp++;

    c = *state->cp;
    if (JS7_ISDEC(c)) {
        ++state->cp;
        min = GetDecimalValue(c, 0xFFFF, NULL, state);
        c = *state->cp;

        if (!ignoreValues && min == OVERFLOW_VALUE)
            return JSMSG_MIN_TOO_BIG;

        if (c == ',') {
            c = *++state->cp;
            if (JS7_ISDEC(c)) {
                ++state->cp;
                max = GetDecimalValue(c, 0xFFFF, NULL, state);
                c = *state->cp;
                if (!ignoreValues && max == OVERFLOW_VALUE)
                    return JSMSG_MAX_TOO_BIG;
                if (!ignoreValues && min > max)
                    return JSMSG_OUT_OF_ORDER;
            } else {
                max = (uintN)-1;
            }
        } else {
            max = min;
        }
        if (c == '}') {
            state->result = NewRENode(state, REOP_QUANT);
            if (!state->result)
                return JSMSG_OUT_OF_MEMORY;
            state->result->u.range.min = min;
            state->result->u.range.max = max;
            /*
             * QUANT, <min>, <max>, <next> ... <ENDCHILD>
             * where <max> is written as compact(max+1) to make
             * (uintN)-1 sentinel to occupy 1 byte, not width_of(max)+1.
             */
            state->progLength += (1 + GetCompactIndexWidth(min)
                                  + GetCompactIndexWidth(max + 1)
                                  +3);
            return 0;
        }
    }

    state->cp = errp;
    return -1;
}

static JSBool
SetForwardJumpOffset(jsbytecode *jump, jsbytecode *target)
{
    ptrdiff_t offset = target - jump;

    /* Check that target really points forward. */
    JS_ASSERT(offset >= 2);
    if ((size_t)offset > OFFSET_MAX)
        return JS_FALSE;

    jump[0] = JUMP_OFFSET_HI(offset);
    jump[1] = JUMP_OFFSET_LO(offset);
    return JS_TRUE;
}

/* Copy the charset data from a character class node to the charset list
 * in the regexp object. */
static JS_ALWAYS_INLINE RECharSet *
InitNodeCharSet(JSRegExp *re, RENode *node)
{
    RECharSet *charSet = &re->classList[node->u.ucclass.index];
    charSet->converted = JS_FALSE;
    charSet->length = node->u.ucclass.bmsize;
    charSet->u.src.startIndex = node->u.ucclass.startIndex;
    charSet->u.src.length = node->u.ucclass.kidlen;
    charSet->sense = node->u.ucclass.sense;
    return charSet;
}

/*
 * Generate bytecode for the tree rooted at t using an explicit stack instead
 * of recursion.
 */
static jsbytecode *
EmitREBytecode(CompilerState *state, JSRegExp *re, size_t treeDepth,
               jsbytecode *pc, RENode *t)
{
    EmitStateStackEntry *emitStateSP, *emitStateStack;
    REOp op;

    if (treeDepth == 0) {
        emitStateStack = NULL;
    } else {
        emitStateStack =
            (EmitStateStackEntry *)JS_malloc(state->context,
                                             sizeof(EmitStateStackEntry) *
                                             treeDepth);
        if (!emitStateStack)
            return NULL;
    }
    emitStateSP = emitStateStack;
    op = t->op;
    JS_ASSERT(op < REOP_LIMIT);

    for (;;) {
        *pc++ = op;
        switch (op) {
          case REOP_EMPTY:
            --pc;
            break;

          case REOP_ALTPREREQ2:
          case REOP_ALTPREREQ:
            JS_ASSERT(emitStateSP);
            emitStateSP->altHead = pc - 1;
            emitStateSP->endTermFixup = pc;
            pc += OFFSET_LEN;
            SET_ARG(pc, t->u.altprereq.ch1);
            pc += ARG_LEN;
            SET_ARG(pc, t->u.altprereq.ch2);
            pc += ARG_LEN;

            emitStateSP->nextAltFixup = pc;    /* offset to next alternate */
            pc += OFFSET_LEN;

            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_JUMP;
            emitStateSP->jumpToJumpFlag = JS_FALSE;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            JS_ASSERT(op < REOP_LIMIT);
            continue;

          case REOP_JUMP:
            emitStateSP->nextTermFixup = pc;    /* offset to following term */
            pc += OFFSET_LEN;
            if (!SetForwardJumpOffset(emitStateSP->nextAltFixup, pc))
                goto jump_too_big;
            emitStateSP->continueOp = REOP_ENDALT;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->u.kid2;
            op = t->op;
            JS_ASSERT(op < REOP_LIMIT);
            continue;

          case REOP_ENDALT:
            /*
             * If we already patched emitStateSP->nextTermFixup to jump to
             * a nearer jump, to avoid 16-bit immediate offset overflow, we
             * are done here.
             */
            if (emitStateSP->jumpToJumpFlag)
                break;

            /*
             * Fix up the REOP_JUMP offset to go to the op after REOP_ENDALT.
             * REOP_ENDALT is executed only on successful match of the last
             * alternate in a group.
             */
            if (!SetForwardJumpOffset(emitStateSP->nextTermFixup, pc))
                goto jump_too_big;
            if (t->op != REOP_ALT) {
                if (!SetForwardJumpOffset(emitStateSP->endTermFixup, pc))
                    goto jump_too_big;
            }

            /*
             * If the program is bigger than the REOP_JUMP offset range, then
             * we must check for alternates before this one that are part of
             * the same group, and fix up their jump offsets to target jumps
             * close enough to fit in a 16-bit unsigned offset immediate.
             */
            if ((size_t)(pc - re->program) > OFFSET_MAX &&
                emitStateSP > emitStateStack) {
                EmitStateStackEntry *esp, *esp2;
                jsbytecode *alt, *jump;
                ptrdiff_t span, header;

                esp2 = emitStateSP;
                alt = esp2->altHead;
                for (esp = esp2 - 1; esp >= emitStateStack; --esp) {
                    if (esp->continueOp == REOP_ENDALT &&
                        !esp->jumpToJumpFlag &&
                        esp->nextTermFixup + OFFSET_LEN == alt &&
                        (size_t)(pc - ((esp->continueNode->op != REOP_ALT)
                                       ? esp->endTermFixup
                                       : esp->nextTermFixup)) > OFFSET_MAX) {
                        alt = esp->altHead;
                        jump = esp->nextTermFixup;

                        /*
                         * The span must be 1 less than the distance from
                         * jump offset to jump offset, so we actually jump
                         * to a REOP_JUMP bytecode, not to its offset!
                         */
                        for (;;) {
                            JS_ASSERT(jump < esp2->nextTermFixup);
                            span = esp2->nextTermFixup - jump - 1;
                            if ((size_t)span <= OFFSET_MAX)
                                break;
                            do {
                                if (--esp2 == esp)
                                    goto jump_too_big;
                            } while (esp2->continueOp != REOP_ENDALT);
                        }

                        jump[0] = JUMP_OFFSET_HI(span);
                        jump[1] = JUMP_OFFSET_LO(span);

                        if (esp->continueNode->op != REOP_ALT) {
                            /*
                             * We must patch the offset at esp->endTermFixup
                             * as well, for the REOP_ALTPREREQ{,2} opcodes.
                             * If we're unlucky and endTermFixup is more than
                             * OFFSET_MAX bytes from its target, we cheat by
                             * jumping 6 bytes to the jump whose offset is at
                             * esp->nextTermFixup, which has the same target.
                             */
                            jump = esp->endTermFixup;
                            header = esp->nextTermFixup - jump;
                            span += header;
                            if ((size_t)span > OFFSET_MAX)
                                span = header;

                            jump[0] = JUMP_OFFSET_HI(span);
                            jump[1] = JUMP_OFFSET_LO(span);
                        }

                        esp->jumpToJumpFlag = JS_TRUE;
                    }
                }
            }
            break;

          case REOP_ALT:
            JS_ASSERT(emitStateSP);
            emitStateSP->altHead = pc - 1;
            emitStateSP->nextAltFixup = pc;     /* offset to next alternate */
            pc += OFFSET_LEN;
            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_JUMP;
            emitStateSP->jumpToJumpFlag = JS_FALSE;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            JS_ASSERT(op < REOP_LIMIT);
            continue;

          case REOP_FLAT:
            /*
             * Coalesce FLATs if possible and if it would not increase bytecode
             * beyond preallocated limit. The latter happens only when bytecode
             * size for coalesced string with offset p and length 2 exceeds 6
             * bytes preallocated for 2 single char nodes, i.e. when
             * 1 + GetCompactIndexWidth(p) + GetCompactIndexWidth(2) > 6 or
             * GetCompactIndexWidth(p) > 4.
             * Since when GetCompactIndexWidth(p) <= 4 coalescing of 3 or more
             * nodes strictly decreases bytecode size, the check has to be
             * done only for the first coalescing.
             */
            if (t->kid &&
                GetCompactIndexWidth((jschar *)t->kid - state->cpbegin) <= 4)
            {
                while (t->next &&
                       t->next->op == REOP_FLAT &&
                       (jschar*)t->kid + t->u.flat.length ==
                       (jschar*)t->next->kid) {
                    t->u.flat.length += t->next->u.flat.length;
                    t->next = t->next->next;
                }
            }
            if (t->kid && t->u.flat.length > 1) {
                pc[-1] = (state->flags & JSREG_FOLD) ? REOP_FLATi : REOP_FLAT;
                pc = WriteCompactIndex(pc, (jschar *)t->kid - state->cpbegin);
                pc = WriteCompactIndex(pc, t->u.flat.length);
            } else if (t->u.flat.chr < 256) {
                pc[-1] = (state->flags & JSREG_FOLD) ? REOP_FLAT1i : REOP_FLAT1;
                *pc++ = (jsbytecode) t->u.flat.chr;
            } else {
                pc[-1] = (state->flags & JSREG_FOLD)
                         ? REOP_UCFLAT1i
                         : REOP_UCFLAT1;
                SET_ARG(pc, t->u.flat.chr);
                pc += ARG_LEN;
            }
            break;

          case REOP_LPAREN:
            JS_ASSERT(emitStateSP);
            pc = WriteCompactIndex(pc, t->u.parenIndex);
            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_RPAREN;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            continue;

          case REOP_RPAREN:
            pc = WriteCompactIndex(pc, t->u.parenIndex);
            break;

          case REOP_BACKREF:
            pc = WriteCompactIndex(pc, t->u.parenIndex);
            break;

          case REOP_ASSERT:
            JS_ASSERT(emitStateSP);
            emitStateSP->nextTermFixup = pc;
            pc += OFFSET_LEN;
            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_ASSERTTEST;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            continue;

          case REOP_ASSERTTEST:
          case REOP_ASSERTNOTTEST:
            if (!SetForwardJumpOffset(emitStateSP->nextTermFixup, pc))
                goto jump_too_big;
            break;

          case REOP_ASSERT_NOT:
            JS_ASSERT(emitStateSP);
            emitStateSP->nextTermFixup = pc;
            pc += OFFSET_LEN;
            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_ASSERTNOTTEST;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            continue;

          case REOP_QUANT:
            JS_ASSERT(emitStateSP);
            if (t->u.range.min == 0 && t->u.range.max == (uintN)-1) {
                pc[-1] = (t->u.range.greedy) ? REOP_STAR : REOP_MINIMALSTAR;
            } else if (t->u.range.min == 0 && t->u.range.max == 1) {
                pc[-1] = (t->u.range.greedy) ? REOP_OPT : REOP_MINIMALOPT;
            } else if (t->u.range.min == 1 && t->u.range.max == (uintN) -1) {
                pc[-1] = (t->u.range.greedy) ? REOP_PLUS : REOP_MINIMALPLUS;
            } else {
                if (!t->u.range.greedy)
                    pc[-1] = REOP_MINIMALQUANT;
                pc = WriteCompactIndex(pc, t->u.range.min);
                /*
                 * Write max + 1 to avoid using size_t(max) + 1 bytes
                 * for (uintN)-1 sentinel.
                 */
                pc = WriteCompactIndex(pc, t->u.range.max + 1);
            }
            emitStateSP->nextTermFixup = pc;
            pc += OFFSET_LEN;
            emitStateSP->continueNode = t;
            emitStateSP->continueOp = REOP_ENDCHILD;
            ++emitStateSP;
            JS_ASSERT((size_t)(emitStateSP - emitStateStack) <= treeDepth);
            t = (RENode *) t->kid;
            op = t->op;
            continue;

          case REOP_ENDCHILD:
            if (!SetForwardJumpOffset(emitStateSP->nextTermFixup, pc))
                goto jump_too_big;
            break;

          case REOP_CLASS:
            if (!t->u.ucclass.sense)
                pc[-1] = REOP_NCLASS;
            pc = WriteCompactIndex(pc, t->u.ucclass.index);
            InitNodeCharSet(re, t);
            break;

          default:
            break;
        }

        t = t->next;
        if (t) {
            op = t->op;
        } else {
            if (emitStateSP == emitStateStack)
                break;
            --emitStateSP;
            t = emitStateSP->continueNode;
            op = (REOp) emitStateSP->continueOp;
        }
    }

  cleanup:
    if (emitStateStack)
        JS_free(state->context, emitStateStack);
    return pc;

  jump_too_big:
    ReportRegExpError(state, JSREPORT_ERROR, JSMSG_REGEXP_TOO_COMPLEX);
    pc = NULL;
    goto cleanup;
}

#ifdef JS_TRACER
typedef List<LIns*, LIST_NonGCObjects> LInsList;

/* Dummy GC for nanojit placement new. */
static GC gc;

class RegExpNativeCompiler {
 private:
    JSRegExp*        re;   /* Careful: not fully initialized */
    CompilerState*   cs;   /* RegExp to compile */
    Fragment*        fragment;
    LirWriter*       lir;

    LIns*            state;
    LIns*            gdata;
    LIns*            cpend;

    JSBool isCaseInsensitive() const { return cs->flags & JSREG_FOLD; }

    void targetCurrentPoint(LIns* ins) { ins->target(lir->ins0(LIR_label)); }

    void targetCurrentPoint(LInsList& fails) 
    {
        LIns* fail = lir->ins0(LIR_label);
        for (size_t i = 0; i < fails.size(); ++i) {
            fails[i]->target(fail);
        }
        fails.clear();
    }

    /* 
     * These functions return the new position after their match operation,
     * or NULL if there was an error.
     */
    LIns* compileEmpty(RENode* node, LIns* pos, LInsList& fails) 
    {
        return pos;
    }

    LIns* compileFlatSingleChar(RENode* node, LIns* pos, LInsList& fails) 
    {
        /* 
         * Fast case-insensitive test for ASCII letters: convert text
         * char to lower case by bit-or-ing in 32 and compare.
         */
        JSBool useFastCI = JS_FALSE;
        jschar ch = node->u.flat.chr; /* char to test for */
        jschar ch2 = ch;              /* 2nd char to test for if ci */
        if (cs->flags & JSREG_FOLD) {
            if (L'A' <= ch && ch <= L'Z' || L'a' <= ch || ch <= L'z') {
                ch |= 32;
                ch2 = ch;
                useFastCI = JS_TRUE;
            } else if (JS_TOLOWER(ch) != ch) {
                ch2 = JS_TOLOWER(ch);
                ch = JS_TOUPPER(ch);
            }
        }

        LIns* to_fail = lir->insBranch(LIR_jf, lir->ins2(LIR_lt, pos, cpend), 0);
        fails.add(to_fail);
        LIns* text_ch = lir->insLoad(LIR_ldcs, pos, lir->insImm(0));
        LIns* comp_ch = useFastCI ? 
            lir->ins2(LIR_or, text_ch, lir->insImm(32)) : 
            text_ch;
        if (ch == ch2) {
            fails.add(lir->insBranch(LIR_jf, lir->ins2(LIR_eq, comp_ch, lir->insImm(ch)), 0));
        } else {
            LIns* to_ok = lir->insBranch(LIR_jt, lir->ins2(LIR_eq, comp_ch, lir->insImm(ch)), 0);
            fails.add(lir->insBranch(LIR_jf, lir->ins2(LIR_eq, comp_ch, lir->insImm(ch2)), 0));
            targetCurrentPoint(to_ok);
        }

        return lir->ins2(LIR_piadd, pos, lir->insImm(2));
    }

    LIns* compileClass(RENode* node, LIns* pos, LInsList& fails) 
    {
        if (!node->u.ucclass.sense) 
            return JS_FALSE;

        RECharSet* charSet = InitNodeCharSet(re, node);
        LIns* to_fail = lir->insBranch(LIR_jf, lir->ins2(LIR_lt, pos, cpend), 0);
        fails.add(to_fail);
        LIns* text_ch = lir->insLoad(LIR_ldcs, pos, lir->insImm(0));
        fails.add(lir->insBranch(LIR_jf, lir->ins2(LIR_le, text_ch, lir->insImm(charSet->length)), 0));
        LIns* byteIndex = lir->ins2(LIR_rsh, text_ch, lir->insImm(3));
        LIns* bitmap = lir->insLoad(LIR_ld, lir->insImmPtr(charSet), (int) offsetof(RECharSet, u.bits));
        LIns* byte = lir->insLoad(LIR_ldcb, lir->ins2(LIR_piadd, bitmap, byteIndex), (int) 0);
        LIns* bitMask = lir->ins2(LIR_lsh, lir->insImm(1),
                               lir->ins2(LIR_and, text_ch, lir->insImm(0x7)));
        LIns* test = lir->ins2(LIR_eq, lir->ins2(LIR_and, byte, bitMask), lir->insImm(0));
        
        LIns* to_next = lir->insBranch(LIR_jt, test, 0);
        fails.add(to_next);
        return lir->ins2(LIR_piadd, pos, lir->insImm(2));
    }

    LIns* compileAlt(RENode* node, LIns* pos, LInsList& fails) 
    {
        LInsList kidFails(NULL);
        if (!compileNode((RENode *) node->kid, pos, kidFails)) 
            return JS_FALSE;
        if (!compileNode(node->next, pos, kidFails)) 
            return JS_FALSE;

        targetCurrentPoint(kidFails);
        if (!compileNode(node->u.altprereq.kid2, pos, fails)) 
            return JS_FALSE;
        /* 
         * Disable compilation for any regexp where something follows an
         * alternation. To make this work, we need to redesign to either
         * (a) pass around continuations so we know the right place to go
         * when we logically return, or (b) generate explicit backtracking
         * code. 
         */
        if (node->next) 
            return JS_FALSE;
        return pos;
    }

    JSBool compileNode(RENode* node, LIns* pos, LInsList& fails) 
    {
        for (; node; node = node->next) {
            if (fragment->lirbuf->outOmem()) 
                return JS_FALSE;

            switch (node->op) {
            case REOP_EMPTY:
                pos = compileEmpty(node, pos, fails);
                break;
            case REOP_FLAT:
                if (node->u.flat.length != 1) 
                    return JS_FALSE;
                pos = compileFlatSingleChar(node, pos, fails);
                break;
            case REOP_ALT:
            case REOP_ALTPREREQ:
                pos = compileAlt(node, pos, fails);
                break;
            case REOP_CLASS:
                pos = compileClass(node, pos, fails);
                break;
            default:
                return JS_FALSE;
            }
            if (!pos) 
                return JS_FALSE;
        }

        lir->insStorei(pos, state, (int) offsetof(REMatchState, cp));
        lir->ins1(LIR_ret, state);
        return JS_TRUE;
    }

    JSBool compileSticky(RENode* root, LIns* start) 
    {
        LInsList fails(NULL);
        if (!compileNode(root, start, fails)) 
            return JS_FALSE;
        targetCurrentPoint(fails);
        lir->ins1(LIR_ret, lir->insImm(0));
        return JS_TRUE;
    }

    JSBool compileAnchoring(RENode* root, LIns* start) 
    {
        /* Even at the end, the empty regexp would match. */
        LIns* to_next = lir->insBranch(LIR_jf, 
                                       lir->ins2(LIR_le, start, cpend), 0);
        LInsList fails(NULL);
        if (!compileNode(root, start, fails)) 
            return JS_FALSE;

        targetCurrentPoint(to_next);
        lir->ins1(LIR_ret, lir->insImm(0));
        
        targetCurrentPoint(fails);
        lir->insStorei(lir->ins2(LIR_piadd, start, lir->insImm(2)), gdata, 
                       (int) offsetof(REGlobalData, skipped));
        
        return JS_TRUE;
    }

    inline LIns*
    addName(LirBuffer* lirbuf, LIns* ins, const char* name)
    {
        debug_only_v(lirbuf->names->addName(ins, name);)
        return ins;
    }

 public:
    RegExpNativeCompiler(JSRegExp *re, CompilerState *cs) 
        : re(re), cs(cs), fragment(NULL) {  }

    JSBool compile(JSContext* cx) 
    {
        GuardRecord* guard;
        LIns* skip;
        LIns* start;
        bool oom = false;
        
        Fragmento* fragmento = JS_TRACE_MONITOR(cx).reFragmento;
        fragment = fragmento->getLoop(re);
        if (!fragment) {
            fragment = fragmento->getAnchor(re);
            fragment->lirbuf = new (&gc) LirBuffer(fragmento, NULL);
            /* Scary: required to have the onDestroy method delete the lirbuf. */
            fragment->root = fragment;
        }
        LirBuffer* lirbuf = fragment->lirbuf;
        LirBufWriter* lirb;
        if (lirbuf->outOmem()) goto fail2;
        /* FIXME Use bug 463260 smart pointer when available. */
        lir = lirb = new (&gc) LirBufWriter(lirbuf);

        /* FIXME Use bug 463260 smart pointer when available. */
        debug_only_v(fragment->lirbuf->names = new (&gc) LirNameMap(&gc, NULL, fragmento->labels);)
        /* FIXME Use bug 463260 smart pointer when available. */
        debug_only_v(lir = new (&gc) VerboseWriter(&gc, lir, lirbuf->names);)

        lir->ins0(LIR_start);
        lirbuf->state = state = addName(lirbuf, lir->insParam(0, 0), "state");
        lirbuf->param1 = gdata = addName(lirbuf, lir->insParam(1, 0), "gdata");
        start = addName(lirbuf, lir->insLoad(LIR_ldp, lirbuf->param1, (int) offsetof(REGlobalData, skipped)), "start");
        cpend = addName(lirbuf, lir->insLoad(LIR_ldp, lirbuf->param1, offsetof(REGlobalData, cpend)), "cpend");

        if (cs->flags & JSREG_STICKY) {
            if (!compileSticky(cs->result, start)) goto fail;
        } else {
            if (!compileAnchoring(cs->result, start)) goto fail;
        }

        /* Create fake guard record for loop edge. */
        skip = lirb->skip(sizeof(GuardRecord) + sizeof(SideExit));
        guard = (GuardRecord *) skip->payload();
        memset(guard, 0, sizeof(*guard));
        guard->exit = (SideExit *) guard+1;
        guard->exit->target = fragment;
        fragment->lastIns = lir->insGuard(LIR_loop, lir->insImm(1), skip);

        ::compile(fragmento->assm(), fragment);
        if (fragmento->assm()->error() != nanojit::None) {
            oom = fragmento->assm()->error() == nanojit::OutOMem;
            goto fail;
        }

        delete lirb;
        debug_only_v(delete lir;)
        return JS_TRUE;
    fail:
        delete lirb;
        debug_only_v(delete lir;)
    fail2:
        if (lirbuf->outOmem() || oom) 
            fragmento->clearFrags();
        return JS_FALSE;
    }
};

static inline JSBool
js_CompileRegExpToNative(JSContext *cx, JSRegExp *re, CompilerState *cs)
{
    RegExpNativeCompiler rc(re, cs);
    return rc.compile(cx);
}
#endif

JSRegExp *
js_NewRegExp(JSContext *cx, JSTokenStream *ts,
             JSString *str, uintN flags, JSBool flat)
{
    JSRegExp *re;
    void *mark;
    CompilerState state;
    size_t resize;
    jsbytecode *endPC;
    uintN i;
    size_t len;

    re = NULL;
    mark = JS_ARENA_MARK(&cx->tempPool);
    len = JSSTRING_LENGTH(str);

    state.context = cx;
    state.tokenStream = ts;
    state.cp = js_UndependString(cx, str);
    if (!state.cp)
        goto out;
    state.cpbegin = state.cp;
    state.cpend = state.cp + len;
    state.flags = flags;
    state.parenCount = 0;
    state.classCount = 0;
    state.progLength = 0;
    state.treeDepth = 0;
    state.classBitmapsMem = 0;
    for (i = 0; i < CLASS_CACHE_SIZE; i++)
        state.classCache[i].start = NULL;

    if (len != 0 && flat) {
        state.result = NewRENode(&state, REOP_FLAT);
        if (!state.result)
            goto out;
        state.result->u.flat.chr = *state.cpbegin;
        state.result->u.flat.length = len;
        state.result->kid = (void *) state.cpbegin;
        /* Flat bytecode: REOP_FLAT compact(string_offset) compact(len). */
        state.progLength += 1 + GetCompactIndexWidth(0)
                          + GetCompactIndexWidth(len);
    } else {
        if (!ParseRegExp(&state))
            goto out;
    }

    resize = offsetof(JSRegExp, program) + state.progLength + 1;
    re = (JSRegExp *) JS_malloc(cx, resize);
    if (!re)
        goto out;

    re->nrefs = 1;
    JS_ASSERT(state.classBitmapsMem <= CLASS_BITMAPS_MEM_LIMIT);
    re->classCount = state.classCount;
    if (re->classCount) {
        re->classList = (RECharSet *)
            JS_malloc(cx, re->classCount * sizeof(RECharSet));
        if (!re->classList) {
            js_DestroyRegExp(cx, re);
            re = NULL;
            goto out;
        }
        for (i = 0; i < re->classCount; i++)
            re->classList[i].converted = JS_FALSE;
    } else {
        re->classList = NULL;
    }

#ifdef JS_TRACER
    /*
     * Try compiling the native code version. For the time being we also 
     * compile the bytecode version in case we evict the native code
     * version from the code cache.
     */
    if (TRACING_ENABLED(cx))
        js_CompileRegExpToNative(cx, re, &state);
#endif
    /* Compile the bytecode version. */
    endPC = EmitREBytecode(&state, re, state.treeDepth, re->program, state.result);
    if (!endPC) {
        js_DestroyRegExp(cx, re);
        re = NULL;
        goto out;
    }
    *endPC++ = REOP_END;
    /*
     * Check whether size was overestimated and shrink using realloc.
     * This is safe since no pointers to newly parsed regexp or its parts
     * besides re exist here.
     */
#if 0 
    /*
     * FIXME: Until bug 464866 is fixed, we can't move the re object so
     * don't shrink it for now.
     */
    if ((size_t)(endPC - re->program) != state.progLength + 1) {
        JSRegExp *tmp;
        JS_ASSERT((size_t)(endPC - re->program) < state.progLength + 1);
        resize = offsetof(JSRegExp, program) + (endPC - re->program);
        tmp = (JSRegExp *) JS_realloc(cx, re, resize);
        if (tmp)
            re = tmp;
    }
#endif    

    re->flags = flags;
    re->parenCount = state.parenCount;
    re->source = str;

out:
    JS_ARENA_RELEASE(&cx->tempPool, mark);
    return re;
}

JSRegExp *
js_NewRegExpOpt(JSContext *cx, JSString *str, JSString *opt, JSBool flat)
{
    uintN flags;
    jschar *s;
    size_t i, n;
    char charBuf[2];

    flags = 0;
    if (opt) {
        JSSTRING_CHARS_AND_LENGTH(opt, s, n);
        for (i = 0; i < n; i++) {
            switch (s[i]) {
              case 'g':
                flags |= JSREG_GLOB;
                break;
              case 'i':
                flags |= JSREG_FOLD;
                break;
              case 'm':
                flags |= JSREG_MULTILINE;
                break;
              case 'y':
                flags |= JSREG_STICKY;
                break;
              default:
                charBuf[0] = (char)s[i];
                charBuf[1] = '\0';
                JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                             js_GetErrorMessage, NULL,
                                             JSMSG_BAD_FLAG, charBuf);
                return NULL;
            }
        }
    }
    return js_NewRegExp(cx, NULL, str, flags, flat);
}

/*
 * Save the current state of the match - the position in the input
 * text as well as the position in the bytecode. The state of any
 * parent expressions is also saved (preceding state).
 * Contents of parenCount parentheses from parenIndex are also saved.
 */
static REBackTrackData *
PushBackTrackState(REGlobalData *gData, REOp op,
                   jsbytecode *target, REMatchState *x, const jschar *cp,
                   size_t parenIndex, size_t parenCount)
{
    size_t i;
    REBackTrackData *result =
        (REBackTrackData *) ((char *)gData->backTrackSP + gData->cursz);

    size_t sz = sizeof(REBackTrackData) +
                gData->stateStackTop * sizeof(REProgState) +
                parenCount * sizeof(RECapture);

    ptrdiff_t btsize = gData->backTrackStackSize;
    ptrdiff_t btincr = ((char *)result + sz) -
                       ((char *)gData->backTrackStack + btsize);

    re_debug("\tBT_Push: %lu,%lu",
             (unsigned long) parenIndex, (unsigned long) parenCount);

    JS_COUNT_OPERATION(gData->cx, JSOW_JUMP * (1 + parenCount));
    if (btincr > 0) {
        ptrdiff_t offset = (char *)result - (char *)gData->backTrackStack;

        JS_COUNT_OPERATION(gData->cx, JSOW_ALLOCATION);
        btincr = JS_ROUNDUP(btincr, btsize);
        JS_ARENA_GROW_CAST(gData->backTrackStack, REBackTrackData *,
                           &gData->cx->regexpPool, btsize, btincr);
        if (!gData->backTrackStack) {
            js_ReportOutOfScriptQuota(gData->cx);
            gData->ok = JS_FALSE;
            return NULL;
        }
        gData->backTrackStackSize = btsize + btincr;
        result = (REBackTrackData *) ((char *)gData->backTrackStack + offset);
    }
    gData->backTrackSP = result;
    result->sz = gData->cursz;
    gData->cursz = sz;

    result->backtrack_op = op;
    result->backtrack_pc = target;
    result->cp = cp;
    result->parenCount = parenCount;
    result->parenIndex = parenIndex;

    result->saveStateStackTop = gData->stateStackTop;
    JS_ASSERT(gData->stateStackTop);
    memcpy(result + 1, gData->stateStack,
           sizeof(REProgState) * result->saveStateStackTop);

    if (parenCount != 0) {
        memcpy((char *)(result + 1) +
               sizeof(REProgState) * result->saveStateStackTop,
               &x->parens[parenIndex],
               sizeof(RECapture) * parenCount);
        for (i = 0; i != parenCount; i++)
            x->parens[parenIndex + i].index = -1;
    }

    return result;
}


/*
 *   Consecutive literal characters.
 */
#if 0
static REMatchState *
FlatNMatcher(REGlobalData *gData, REMatchState *x, jschar *matchChars,
             size_t length)
{
    size_t i;
    if (length > gData->cpend - x->cp)
        return NULL;
    for (i = 0; i != length; i++) {
        if (matchChars[i] != x->cp[i])
            return NULL;
    }
    x->cp += length;
    return x;
}
#endif

static JS_ALWAYS_INLINE REMatchState *
FlatNIMatcher(REGlobalData *gData, REMatchState *x, jschar *matchChars,
              size_t length)
{
    size_t i;
    JS_ASSERT(gData->cpend >= x->cp);
    if (length > (size_t)(gData->cpend - x->cp))
        return NULL;
    for (i = 0; i != length; i++) {
        if (upcase(matchChars[i]) != upcase(x->cp[i]))
            return NULL;
    }
    x->cp += length;
    return x;
}

/*
 * 1. Evaluate DecimalEscape to obtain an EscapeValue E.
 * 2. If E is not a character then go to step 6.
 * 3. Let ch be E's character.
 * 4. Let A be a one-element RECharSet containing the character ch.
 * 5. Call CharacterSetMatcher(A, false) and return its Matcher result.
 * 6. E must be an integer. Let n be that integer.
 * 7. If n=0 or n>NCapturingParens then throw a SyntaxError exception.
 * 8. Return an internal Matcher closure that takes two arguments, a State x
 *    and a Continuation c, and performs the following:
 *     1. Let cap be x's captures internal array.
 *     2. Let s be cap[n].
 *     3. If s is undefined, then call c(x) and return its result.
 *     4. Let e be x's endIndex.
 *     5. Let len be s's length.
 *     6. Let f be e+len.
 *     7. If f>InputLength, return failure.
 *     8. If there exists an integer i between 0 (inclusive) and len (exclusive)
 *        such that Canonicalize(s[i]) is not the same character as
 *        Canonicalize(Input [e+i]), then return failure.
 *     9. Let y be the State (f, cap).
 *     10. Call c(y) and return its result.
 */
static REMatchState *
BackrefMatcher(REGlobalData *gData, REMatchState *x, size_t parenIndex)
{
    size_t len, i;
    const jschar *parenContent;
    RECapture *cap = &x->parens[parenIndex];

    if (cap->index == -1)
        return x;

    len = cap->length;
    if (x->cp + len > gData->cpend)
        return NULL;

    parenContent = &gData->cpbegin[cap->index];
    if (gData->regexp->flags & JSREG_FOLD) {
        for (i = 0; i < len; i++) {
            if (upcase(parenContent[i]) != upcase(x->cp[i]))
                return NULL;
        }
    } else {
        for (i = 0; i < len; i++) {
            if (parenContent[i] != x->cp[i])
                return NULL;
        }
    }
    x->cp += len;
    return x;
}


/* Add a single character to the RECharSet */
static void
AddCharacterToCharSet(RECharSet *cs, jschar c)
{
    uintN byteIndex = (uintN)(c >> 3);
    JS_ASSERT(c <= cs->length);
    cs->u.bits[byteIndex] |= 1 << (c & 0x7);
}


/* Add a character range, c1 to c2 (inclusive) to the RECharSet */
static void
AddCharacterRangeToCharSet(RECharSet *cs, uintN c1, uintN c2)
{
    uintN i;

    uintN byteIndex1 = c1 >> 3;
    uintN byteIndex2 = c2 >> 3;

    JS_ASSERT(c2 <= cs->length && c1 <= c2);

    c1 &= 0x7;
    c2 &= 0x7;

    if (byteIndex1 == byteIndex2) {
        cs->u.bits[byteIndex1] |= ((uint8)0xFF >> (7 - (c2 - c1))) << c1;
    } else {
        cs->u.bits[byteIndex1] |= 0xFF << c1;
        for (i = byteIndex1 + 1; i < byteIndex2; i++)
            cs->u.bits[i] = 0xFF;
        cs->u.bits[byteIndex2] |= (uint8)0xFF >> (7 - c2);
    }
}

struct CharacterRange {
    jschar start;
    jschar end;
};

/*
 * The following characters are taken from the ECMA-262 standard, section 7.2
 * and 7.3, and the Unicode 3 standard, Table 6-1.
 */
static const CharacterRange WhiteSpaceRanges[] = {
    /* TAB, LF, VT, FF, CR */
    { 0x0009, 0x000D },
    /* SPACE */
    { 0x0020, 0x0020 },
    /* NO-BREAK SPACE */
    { 0x00A0, 0x00A0 },
    /*
     * EN QUAD, EM QUAD, EN SPACE, EM SPACE, THREE-PER-EM SPACE, FOUR-PER-EM
     * SPACE, SIX-PER-EM SPACE, FIGURE SPACE, PUNCTUATION SPACE, THIN SPACE,
     * HAIR SPACE, ZERO WIDTH SPACE
     */
    { 0x2000, 0x200B },
    /* LS, PS */
    { 0x2028, 0x2029 },
    /* NARROW NO-BREAK SPACE */
    { 0x202F, 0x202F },
    /* IDEOGRAPHIC SPACE */
    { 0x3000, 0x3000 }
};

/* ECMA-262 standard, section 15.10.2.6. */
static const CharacterRange WordRanges[] = {
    { jschar('0'), jschar('9') },
    { jschar('A'), jschar('Z') },
    { jschar('_'), jschar('_') },
    { jschar('a'), jschar('z') }
};

static void
AddCharacterRanges(RECharSet *charSet,
                   const CharacterRange *range,
                   const CharacterRange *end)
{
    for (; range < end; ++range)
        AddCharacterRangeToCharSet(charSet, range->start, range->end);
}

static void
AddInvertedCharacterRanges(RECharSet *charSet,
                           const CharacterRange *range,
                           const CharacterRange *end)
{
    uint16 previous = 0;
    for (; range < end; ++range) {
        AddCharacterRangeToCharSet(charSet, previous, range->start - 1);
        previous = range->end + 1;
    }
    AddCharacterRangeToCharSet(charSet, previous, charSet->length);
}
    
/* Compile the source of the class into a RECharSet */
static JSBool
ProcessCharSet(REGlobalData *gData, RECharSet *charSet)
{
    const jschar *src, *end;
    JSBool inRange = JS_FALSE;
    jschar rangeStart = 0;
    uintN byteLength, n;
    jschar c, thisCh;
    intN nDigits, i;

    JS_ASSERT(!charSet->converted);
    /*
     * Assert that startIndex and length points to chars inside [] inside
     * source string.
     */
    JS_ASSERT(1 <= charSet->u.src.startIndex);
    JS_ASSERT(charSet->u.src.startIndex
              < JSSTRING_LENGTH(gData->regexp->source));
    JS_ASSERT(charSet->u.src.length <= JSSTRING_LENGTH(gData->regexp->source)
                                       - 1 - charSet->u.src.startIndex);

    charSet->converted = JS_TRUE;
    src = JSSTRING_CHARS(gData->regexp->source) + charSet->u.src.startIndex;
    end = src + charSet->u.src.length;
    JS_ASSERT(src[-1] == '[');
    JS_ASSERT(end[0] == ']');

    byteLength = (charSet->length >> 3) + 1;
    charSet->u.bits = (uint8 *)JS_malloc(gData->cx, byteLength);
    if (!charSet->u.bits) {
        JS_ReportOutOfMemory(gData->cx);
        gData->ok = JS_FALSE;
        return JS_FALSE;
    }
    memset(charSet->u.bits, 0, byteLength);

    if (src == end)
        return JS_TRUE;

    if (*src == '^') {
        JS_ASSERT(charSet->sense == JS_FALSE);
        ++src;
    } else {
        JS_ASSERT(charSet->sense == JS_TRUE);
    }

    while (src != end) {
        switch (*src) {
          case '\\':
            ++src;
            c = *src++;
            switch (c) {
              case 'b':
                thisCh = 0x8;
                break;
              case 'f':
                thisCh = 0xC;
                break;
              case 'n':
                thisCh = 0xA;
                break;
              case 'r':
                thisCh = 0xD;
                break;
              case 't':
                thisCh = 0x9;
                break;
              case 'v':
                thisCh = 0xB;
                break;
              case 'c':
                if (src < end && JS_ISWORD(*src)) {
                    thisCh = (jschar)(*src++ & 0x1F);
                } else {
                    --src;
                    thisCh = '\\';
                }
                break;
              case 'x':
                nDigits = 2;
                goto lexHex;
              case 'u':
                nDigits = 4;
            lexHex:
                n = 0;
                for (i = 0; (i < nDigits) && (src < end); i++) {
                    uintN digit;
                    c = *src++;
                    if (!isASCIIHexDigit(c, &digit)) {
                        /*
                         * Back off to accepting the original '\'
                         * as a literal
                         */
                        src -= i + 1;
                        n = '\\';
                        break;
                    }
                    n = (n << 4) | digit;
                }
                thisCh = (jschar)n;
                break;
              case '0':
              case '1':
              case '2':
              case '3':
              case '4':
              case '5':
              case '6':
              case '7':
                /*
                 *  This is a non-ECMA extension - decimal escapes (in this
                 *  case, octal!) are supposed to be an error inside class
                 *  ranges, but supported here for backwards compatibility.
                 */
                n = JS7_UNDEC(c);
                c = *src;
                if ('0' <= c && c <= '7') {
                    src++;
                    n = 8 * n + JS7_UNDEC(c);
                    c = *src;
                    if ('0' <= c && c <= '7') {
                        src++;
                        i = 8 * n + JS7_UNDEC(c);
                        if (i <= 0377)
                            n = i;
                        else
                            src--;
                    }
                }
                thisCh = (jschar)n;
                break;

              case 'd':
                AddCharacterRangeToCharSet(charSet, '0', '9');
                continue;   /* don't need range processing */
              case 'D':
                AddCharacterRangeToCharSet(charSet, 0, '0' - 1);
                AddCharacterRangeToCharSet(charSet,
                                           (jschar)('9' + 1),
                                           (jschar)charSet->length);
                continue;
              case 's':
                AddCharacterRanges(charSet, WhiteSpaceRanges,
                                   WhiteSpaceRanges + JS_ARRAY_LENGTH(WhiteSpaceRanges));
                continue;
              case 'S':
                AddInvertedCharacterRanges(charSet, WhiteSpaceRanges,
                                           WhiteSpaceRanges + JS_ARRAY_LENGTH(WhiteSpaceRanges));
                continue;
              case 'w':
                AddCharacterRanges(charSet, WordRanges,
                                   WordRanges + JS_ARRAY_LENGTH(WordRanges));
                continue;
              case 'W':
                AddInvertedCharacterRanges(charSet, WordRanges,
                                           WordRanges + JS_ARRAY_LENGTH(WordRanges));
                continue;
              default:
                thisCh = c;
                break;

            }
            break;

          default:
            thisCh = *src++;
            break;

        }
        if (inRange) {
            if (gData->regexp->flags & JSREG_FOLD) {
                int i;

                JS_ASSERT(rangeStart <= thisCh);
                for (i = rangeStart; i <= thisCh; i++) {
                    jschar uch, dch;

                    AddCharacterToCharSet(charSet, i);
                    uch = upcase(i);
                    dch = downcase(i);
                    if (i != uch)
                        AddCharacterToCharSet(charSet, uch);
                    if (i != dch)
                        AddCharacterToCharSet(charSet, dch);
                }
            } else {
                AddCharacterRangeToCharSet(charSet, rangeStart, thisCh);
            }
            inRange = JS_FALSE;
        } else {
            if (gData->regexp->flags & JSREG_FOLD) {
                AddCharacterToCharSet(charSet, upcase(thisCh));
                AddCharacterToCharSet(charSet, downcase(thisCh));
            } else {
                AddCharacterToCharSet(charSet, thisCh);
            }
            if (src < end - 1) {
                if (*src == '-') {
                    ++src;
                    inRange = JS_TRUE;
                    rangeStart = thisCh;
                }
            }
        }
    }
    return JS_TRUE;
}

void
js_DestroyRegExp(JSContext *cx, JSRegExp *re)
{
    if (JS_ATOMIC_DECREMENT(&re->nrefs) == 0) {
#ifdef JS_TRACER
        /* Don't reuse this compiled code for some new regexp at same addr. */
        Fragment* fragment = JS_TRACE_MONITOR(cx).reFragmento->getLoop(re);
        if (fragment) 
            fragment->blacklist();
#endif
        if (re->classList) {
            uintN i;
            for (i = 0; i < re->classCount; i++) {
                if (re->classList[i].converted)
                    JS_free(cx, re->classList[i].u.bits);
                re->classList[i].u.bits = NULL;
            }
            JS_free(cx, re->classList);
        }
        JS_free(cx, re);
    }
}

static JSBool
ReallocStateStack(REGlobalData *gData)
{
    size_t limit = gData->stateStackLimit;
    size_t sz = sizeof(REProgState) * limit;

    JS_ARENA_GROW_CAST(gData->stateStack, REProgState *,
                       &gData->cx->regexpPool, sz, sz);
    if (!gData->stateStack) {
        js_ReportOutOfScriptQuota(gData->cx);
        gData->ok = JS_FALSE;
        return JS_FALSE;
    }
    gData->stateStackLimit = limit + limit;
    return JS_TRUE;
}

#define PUSH_STATE_STACK(data)                                                \
    JS_BEGIN_MACRO                                                            \
        ++(data)->stateStackTop;                                              \
        if ((data)->stateStackTop == (data)->stateStackLimit &&               \
            !ReallocStateStack((data))) {                                     \
            return NULL;                                                      \
        }                                                                     \
    JS_END_MACRO

/*
 * Apply the current op against the given input to see if it's going to match
 * or fail. Return false if we don't get a match, true if we do. If updatecp is
 * true, then update the current state's cp. Always update startpc to the next
 * op.
 */
static JS_ALWAYS_INLINE REMatchState *
SimpleMatch(REGlobalData *gData, REMatchState *x, REOp op,
            jsbytecode **startpc, JSBool updatecp)
{
    REMatchState *result = NULL;
    jschar matchCh;
    size_t parenIndex;
    size_t offset, length, index;
    jsbytecode *pc = *startpc;  /* pc has already been incremented past op */
    jschar *source;
    const jschar *startcp = x->cp;
    jschar ch;
    RECharSet *charSet;

#ifdef REGEXP_DEBUG
    const char *opname = reop_names[op];
    re_debug("\n%06d: %*s%s", pc - gData->regexp->program,
             gData->stateStackTop * 2, "", opname);
#endif
    switch (op) {
      case REOP_EMPTY:
        result = x;
        break;
      case REOP_BOL:
        if (x->cp != gData->cpbegin) {
            if (!gData->cx->regExpStatics.multiline &&
                !(gData->regexp->flags & JSREG_MULTILINE)) {
                break;
            }
            if (!RE_IS_LINE_TERM(x->cp[-1]))
                break;
        }
        result = x;
        break;
      case REOP_EOL:
        if (x->cp != gData->cpend) {
            if (!gData->cx->regExpStatics.multiline &&
                !(gData->regexp->flags & JSREG_MULTILINE)) {
                break;
            }
            if (!RE_IS_LINE_TERM(*x->cp))
                break;
        }
        result = x;
        break;
      case REOP_WBDRY:
        if ((x->cp == gData->cpbegin || !JS_ISWORD(x->cp[-1])) ^
            !(x->cp != gData->cpend && JS_ISWORD(*x->cp))) {
            result = x;
        }
        break;
      case REOP_WNONBDRY:
        if ((x->cp == gData->cpbegin || !JS_ISWORD(x->cp[-1])) ^
            (x->cp != gData->cpend && JS_ISWORD(*x->cp))) {
            result = x;
        }
        break;
      case REOP_DOT:
        if (x->cp != gData->cpend && !RE_IS_LINE_TERM(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_DIGIT:
        if (x->cp != gData->cpend && JS7_ISDEC(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_NONDIGIT:
        if (x->cp != gData->cpend && !JS7_ISDEC(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_ALNUM:
        if (x->cp != gData->cpend && JS_ISWORD(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_NONALNUM:
        if (x->cp != gData->cpend && !JS_ISWORD(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_SPACE:
        if (x->cp != gData->cpend && JS_ISSPACE(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_NONSPACE:
        if (x->cp != gData->cpend && !JS_ISSPACE(*x->cp)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_BACKREF:
        pc = ReadCompactIndex(pc, &parenIndex);
        JS_ASSERT(parenIndex < gData->regexp->parenCount);
        result = BackrefMatcher(gData, x, parenIndex);
        break;
      case REOP_FLAT:
        pc = ReadCompactIndex(pc, &offset);
        JS_ASSERT(offset < JSSTRING_LENGTH(gData->regexp->source));
        pc = ReadCompactIndex(pc, &length);
        JS_ASSERT(1 <= length);
        JS_ASSERT(length <= JSSTRING_LENGTH(gData->regexp->source) - offset);
        if (length <= (size_t)(gData->cpend - x->cp)) {
            source = JSSTRING_CHARS(gData->regexp->source) + offset;
            re_debug_chars(source, length);
            for (index = 0; index != length; index++) {
                if (source[index] != x->cp[index])
                    return NULL;
            }
            x->cp += length;
            result = x;
        }
        break;
      case REOP_FLAT1:
        matchCh = *pc++;
        re_debug(" '%c' == '%c'", (char)matchCh, (char)*x->cp);
        if (x->cp != gData->cpend && *x->cp == matchCh) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_FLATi:
        pc = ReadCompactIndex(pc, &offset);
        JS_ASSERT(offset < JSSTRING_LENGTH(gData->regexp->source));
        pc = ReadCompactIndex(pc, &length);
        JS_ASSERT(1 <= length);
        JS_ASSERT(length <= JSSTRING_LENGTH(gData->regexp->source) - offset);
        source = JSSTRING_CHARS(gData->regexp->source);
        result = FlatNIMatcher(gData, x, source + offset, length);
        break;
      case REOP_FLAT1i:
        matchCh = *pc++;
        if (x->cp != gData->cpend && upcase(*x->cp) == upcase(matchCh)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_UCFLAT1:
        matchCh = GET_ARG(pc);
        re_debug(" '%c' == '%c'", (char)matchCh, (char)*x->cp);
        pc += ARG_LEN;
        if (x->cp != gData->cpend && *x->cp == matchCh) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_UCFLAT1i:
        matchCh = GET_ARG(pc);
        pc += ARG_LEN;
        if (x->cp != gData->cpend && upcase(*x->cp) == upcase(matchCh)) {
            result = x;
            result->cp++;
        }
        break;
      case REOP_CLASS:
        pc = ReadCompactIndex(pc, &index);
        JS_ASSERT(index < gData->regexp->classCount);
        if (x->cp != gData->cpend) {
            charSet = &gData->regexp->classList[index];
            JS_ASSERT(charSet->converted);
            ch = *x->cp;
            index = ch >> 3;
            if (charSet->length != 0 &&
                ch <= charSet->length &&
                (charSet->u.bits[index] & (1 << (ch & 0x7)))) {
                result = x;
                result->cp++;
            }
        }
        break;
      case REOP_NCLASS:
        pc = ReadCompactIndex(pc, &index);
        JS_ASSERT(index < gData->regexp->classCount);
        if (x->cp != gData->cpend) {
            charSet = &gData->regexp->classList[index];
            JS_ASSERT(charSet->converted);
            ch = *x->cp;
            index = ch >> 3;
            if (charSet->length == 0 ||
                ch > charSet->length ||
                !(charSet->u.bits[index] & (1 << (ch & 0x7)))) {
                result = x;
                result->cp++;
            }
        }
        break;

      default:
        JS_ASSERT(JS_FALSE);
    }
    if (result) {
        if (!updatecp)
            x->cp = startcp;
        *startpc = pc;
        re_debug(" * ");
        return result;
    }
    x->cp = startcp;
    return NULL;
}

static JS_ALWAYS_INLINE REMatchState *
ExecuteREBytecode(REGlobalData *gData, REMatchState *x)
{
    REMatchState *result = NULL;
    REBackTrackData *backTrackData;
    jsbytecode *nextpc, *testpc;
    REOp nextop;
    RECapture *cap;
    REProgState *curState;
    const jschar *startcp;
    size_t parenIndex, k;
    size_t parenSoFar = 0;

    jschar matchCh1, matchCh2;
    RECharSet *charSet;

    JSBool anchor;
    jsbytecode *pc = gData->regexp->program;
    REOp op = (REOp) *pc++;

    /*
     * If the first node is a simple match, step the index into the string
     * until that match is made, or fail if it can't be found at all.
     */
    if (REOP_IS_SIMPLE(op) && !(gData->regexp->flags & JSREG_STICKY)) {
        anchor = JS_FALSE;
        while (x->cp <= gData->cpend) {
            nextpc = pc;    /* reset back to start each time */
            result = SimpleMatch(gData, x, op, &nextpc, JS_TRUE);
            if (result) {
                anchor = JS_TRUE;
                x = result;
                pc = nextpc;    /* accept skip to next opcode */
                op = (REOp) *pc++;
                JS_ASSERT(op < REOP_LIMIT);
                break;
            }
            gData->skipped++;
            x->cp++;
        }
        if (!anchor)
            goto bad;
    }

    for (;;) {
#ifdef REGEXP_DEBUG
        const char *opname = reop_names[op];
        re_debug("\n%06d: %*s%s", pc - gData->regexp->program,
                 gData->stateStackTop * 2, "", opname);
#endif
        if (REOP_IS_SIMPLE(op)) {
            result = SimpleMatch(gData, x, op, &pc, JS_TRUE);
        } else {
            curState = &gData->stateStack[gData->stateStackTop];
            switch (op) {
              case REOP_END:
                goto good;
              case REOP_ALTPREREQ2:
                nextpc = pc + GET_OFFSET(pc);   /* start of next op */
                pc += ARG_LEN;
                matchCh2 = GET_ARG(pc);
                pc += ARG_LEN;
                k = GET_ARG(pc);
                pc += ARG_LEN;

                if (x->cp != gData->cpend) {
                    if (*x->cp == matchCh2)
                        goto doAlt;

                    charSet = &gData->regexp->classList[k];
                    if (!charSet->converted && !ProcessCharSet(gData, charSet))
                        goto bad;
                    matchCh1 = *x->cp;
                    k = matchCh1 >> 3;
                    if ((charSet->length == 0 ||
                         matchCh1 > charSet->length ||
                         !(charSet->u.bits[k] & (1 << (matchCh1 & 0x7)))) ^
                        charSet->sense) {
                        goto doAlt;
                    }
                }
                result = NULL;
                break;

              case REOP_ALTPREREQ:
                nextpc = pc + GET_OFFSET(pc);   /* start of next op */
                pc += ARG_LEN;
                matchCh1 = GET_ARG(pc);
                pc += ARG_LEN;
                matchCh2 = GET_ARG(pc);
                pc += ARG_LEN;
                if (x->cp == gData->cpend ||
                    (*x->cp != matchCh1 && *x->cp != matchCh2)) {
                    result = NULL;
                    break;
                }
                /* else false thru... */

              case REOP_ALT:
              doAlt:
                nextpc = pc + GET_OFFSET(pc);   /* start of next alternate */
                pc += ARG_LEN;                  /* start of this alternate */
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                op = (REOp) *pc++;
                startcp = x->cp;
                if (REOP_IS_SIMPLE(op)) {
                    if (!SimpleMatch(gData, x, op, &pc, JS_TRUE)) {
                        op = (REOp) *nextpc++;
                        pc = nextpc;
                        continue;
                    }
                    result = x;
                    op = (REOp) *pc++;
                }
                nextop = (REOp) *nextpc++;
                if (!PushBackTrackState(gData, nextop, nextpc, x, startcp, 0, 0))
                    goto bad;
                continue;

              /*
               * Occurs at (successful) end of REOP_ALT,
               */
              case REOP_JUMP:
                /*
                 * If we have not gotten a result here, it is because of an
                 * empty match.  Do the same thing REOP_EMPTY would do.
                 */
                if (!result)
                    result = x;

                --gData->stateStackTop;
                pc += GET_OFFSET(pc);
                op = (REOp) *pc++;
                continue;

              /*
               * Occurs at last (successful) end of REOP_ALT,
               */
              case REOP_ENDALT:
                /*
                 * If we have not gotten a result here, it is because of an
                 * empty match.  Do the same thing REOP_EMPTY would do.
                 */
                if (!result)
                    result = x;

                --gData->stateStackTop;
                op = (REOp) *pc++;
                continue;

              case REOP_LPAREN:
                pc = ReadCompactIndex(pc, &parenIndex);
                re_debug("[ %lu ]", (unsigned long) parenIndex);
                JS_ASSERT(parenIndex < gData->regexp->parenCount);
                if (parenIndex + 1 > parenSoFar)
                    parenSoFar = parenIndex + 1;
                x->parens[parenIndex].index = x->cp - gData->cpbegin;
                x->parens[parenIndex].length = 0;
                op = (REOp) *pc++;
                continue;

              case REOP_RPAREN:
              {
                ptrdiff_t delta;

                pc = ReadCompactIndex(pc, &parenIndex);
                JS_ASSERT(parenIndex < gData->regexp->parenCount);
                cap = &x->parens[parenIndex];
                delta = x->cp - (gData->cpbegin + cap->index);
                cap->length = (delta < 0) ? 0 : (size_t) delta;
                op = (REOp) *pc++;

                if (!result)
                    result = x;
                continue;
              }
              case REOP_ASSERT:
                nextpc = pc + GET_OFFSET(pc);  /* start of term after ASSERT */
                pc += ARG_LEN;                 /* start of ASSERT child */
                op = (REOp) *pc++;
                testpc = pc;
                if (REOP_IS_SIMPLE(op) &&
                    !SimpleMatch(gData, x, op, &testpc, JS_FALSE)) {
                    result = NULL;
                    break;
                }
                curState->u.assertion.top =
                    (char *)gData->backTrackSP - (char *)gData->backTrackStack;
                curState->u.assertion.sz = gData->cursz;
                curState->index = x->cp - gData->cpbegin;
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                if (!PushBackTrackState(gData, REOP_ASSERTTEST,
                                        nextpc, x, x->cp, 0, 0)) {
                    goto bad;
                }
                continue;

              case REOP_ASSERT_NOT:
                nextpc = pc + GET_OFFSET(pc);
                pc += ARG_LEN;
                op = (REOp) *pc++;
                testpc = pc;
                if (REOP_IS_SIMPLE(op) /* Note - fail to fail! */ &&
                    SimpleMatch(gData, x, op, &testpc, JS_FALSE) &&
                    *testpc == REOP_ASSERTNOTTEST) {
                    result = NULL;
                    break;
                }
                curState->u.assertion.top
                    = (char *)gData->backTrackSP -
                      (char *)gData->backTrackStack;
                curState->u.assertion.sz = gData->cursz;
                curState->index = x->cp - gData->cpbegin;
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                if (!PushBackTrackState(gData, REOP_ASSERTNOTTEST,
                                        nextpc, x, x->cp, 0, 0)) {
                    goto bad;
                }
                continue;

              case REOP_ASSERTTEST:
                --gData->stateStackTop;
                --curState;
                x->cp = gData->cpbegin + curState->index;
                gData->backTrackSP =
                    (REBackTrackData *) ((char *)gData->backTrackStack +
                                         curState->u.assertion.top);
                gData->cursz = curState->u.assertion.sz;
                if (result)
                    result = x;
                break;

              case REOP_ASSERTNOTTEST:
                --gData->stateStackTop;
                --curState;
                x->cp = gData->cpbegin + curState->index;
                gData->backTrackSP =
                    (REBackTrackData *) ((char *)gData->backTrackStack +
                                         curState->u.assertion.top);
                gData->cursz = curState->u.assertion.sz;
                result = (!result) ? x : NULL;
                break;
              case REOP_STAR:
                curState->u.quantifier.min = 0;
                curState->u.quantifier.max = (uintN)-1;
                goto quantcommon;
              case REOP_PLUS:
                curState->u.quantifier.min = 1;
                curState->u.quantifier.max = (uintN)-1;
                goto quantcommon;
              case REOP_OPT:
                curState->u.quantifier.min = 0;
                curState->u.quantifier.max = 1;
                goto quantcommon;
              case REOP_QUANT:
                pc = ReadCompactIndex(pc, &k);
                curState->u.quantifier.min = k;
                pc = ReadCompactIndex(pc, &k);
                /* max is k - 1 to use one byte for (uintN)-1 sentinel. */
                curState->u.quantifier.max = k - 1;
                JS_ASSERT(curState->u.quantifier.min
                          <= curState->u.quantifier.max);
              quantcommon:
                if (curState->u.quantifier.max == 0) {
                    pc = pc + GET_OFFSET(pc);
                    op = (REOp) *pc++;
                    result = x;
                    continue;
                }
                /* Step over <next> */
                nextpc = pc + ARG_LEN;
                op = (REOp) *nextpc++;
                startcp = x->cp;
                if (REOP_IS_SIMPLE(op)) {
                    if (!SimpleMatch(gData, x, op, &nextpc, JS_TRUE)) {
                        if (curState->u.quantifier.min == 0)
                            result = x;
                        else
                            result = NULL;
                        pc = pc + GET_OFFSET(pc);
                        break;
                    }
                    op = (REOp) *nextpc++;
                    result = x;
                }
                curState->index = startcp - gData->cpbegin;
                curState->continue_op = REOP_REPEAT;
                curState->continue_pc = pc;
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                if (curState->u.quantifier.min == 0 &&
                    !PushBackTrackState(gData, REOP_REPEAT, pc, x, startcp,
                                        0, 0)) {
                    goto bad;
                }
                pc = nextpc;
                continue;

              case REOP_ENDCHILD: /* marks the end of a quantifier child */
                pc = curState[-1].continue_pc;
                op = (REOp) curState[-1].continue_op;

                if (!result)
                    result = x;
                continue;

              case REOP_REPEAT:
                --curState;
                do {
                    --gData->stateStackTop;
                    if (!result) {
                        /* Failed, see if we have enough children. */
                        if (curState->u.quantifier.min == 0)
                            goto repeatDone;
                        goto break_switch;
                    }
                    if (curState->u.quantifier.min == 0 &&
                        x->cp == gData->cpbegin + curState->index) {
                        /* matched an empty string, that'll get us nowhere */
                        result = NULL;
                        goto break_switch;
                    }
                    if (curState->u.quantifier.min != 0)
                        curState->u.quantifier.min--;
                    if (curState->u.quantifier.max != (uintN) -1)
                        curState->u.quantifier.max--;
                    if (curState->u.quantifier.max == 0)
                        goto repeatDone;
                    nextpc = pc + ARG_LEN;
                    nextop = (REOp) *nextpc;
                    startcp = x->cp;
                    if (REOP_IS_SIMPLE(nextop)) {
                        nextpc++;
                        if (!SimpleMatch(gData, x, nextop, &nextpc, JS_TRUE)) {
                            if (curState->u.quantifier.min == 0)
                                goto repeatDone;
                            result = NULL;
                            goto break_switch;
                        }
                        result = x;
                    }
                    curState->index = startcp - gData->cpbegin;
                    PUSH_STATE_STACK(gData);
                    if (curState->u.quantifier.min == 0 &&
                        !PushBackTrackState(gData, REOP_REPEAT,
                                            pc, x, startcp,
                                            curState->parenSoFar,
                                            parenSoFar -
                                            curState->parenSoFar)) {
                        goto bad;
                    }
                } while (*nextpc == REOP_ENDCHILD);
                pc = nextpc;
                op = (REOp) *pc++;
                parenSoFar = curState->parenSoFar;
                continue;

              repeatDone:
                result = x;
                pc += GET_OFFSET(pc);
                goto break_switch;

              case REOP_MINIMALSTAR:
                curState->u.quantifier.min = 0;
                curState->u.quantifier.max = (uintN)-1;
                goto minimalquantcommon;
              case REOP_MINIMALPLUS:
                curState->u.quantifier.min = 1;
                curState->u.quantifier.max = (uintN)-1;
                goto minimalquantcommon;
              case REOP_MINIMALOPT:
                curState->u.quantifier.min = 0;
                curState->u.quantifier.max = 1;
                goto minimalquantcommon;
              case REOP_MINIMALQUANT:
                pc = ReadCompactIndex(pc, &k);
                curState->u.quantifier.min = k;
                pc = ReadCompactIndex(pc, &k);
                /* See REOP_QUANT comments about k - 1. */
                curState->u.quantifier.max = k - 1;
                JS_ASSERT(curState->u.quantifier.min
                          <= curState->u.quantifier.max);
              minimalquantcommon:
                curState->index = x->cp - gData->cpbegin;
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                if (curState->u.quantifier.min != 0) {
                    curState->continue_op = REOP_MINIMALREPEAT;
                    curState->continue_pc = pc;
                    /* step over <next> */
                    pc += OFFSET_LEN;
                    op = (REOp) *pc++;
                } else {
                    if (!PushBackTrackState(gData, REOP_MINIMALREPEAT,
                                            pc, x, x->cp, 0, 0)) {
                        goto bad;
                    }
                    --gData->stateStackTop;
                    pc = pc + GET_OFFSET(pc);
                    op = (REOp) *pc++;
                }
                continue;

              case REOP_MINIMALREPEAT:
                --gData->stateStackTop;
                --curState;

                re_debug("{%d,%d}", curState->u.quantifier.min,
                         curState->u.quantifier.max);
#define PREPARE_REPEAT()                                                      \
    JS_BEGIN_MACRO                                                            \
        curState->index = x->cp - gData->cpbegin;                             \
        curState->continue_op = REOP_MINIMALREPEAT;                           \
        curState->continue_pc = pc;                                           \
        pc += ARG_LEN;                                                        \
        for (k = curState->parenSoFar; k < parenSoFar; k++)                   \
            x->parens[k].index = -1;                                          \
        PUSH_STATE_STACK(gData);                                              \
        op = (REOp) *pc++;                                                    \
        JS_ASSERT(op < REOP_LIMIT);                                           \
    JS_END_MACRO

                if (!result) {
                    re_debug(" - ");
                    /*
                     * Non-greedy failure - try to consume another child.
                     */
                    if (curState->u.quantifier.max == (uintN) -1 ||
                        curState->u.quantifier.max > 0) {
                        PREPARE_REPEAT();
                        continue;
                    }
                    /* Don't need to adjust pc since we're going to pop. */
                    break;
                }
                if (curState->u.quantifier.min == 0 &&
                    x->cp == gData->cpbegin + curState->index) {
                    /* Matched an empty string, that'll get us nowhere. */
                    result = NULL;
                    break;
                }
                if (curState->u.quantifier.min != 0)
                    curState->u.quantifier.min--;
                if (curState->u.quantifier.max != (uintN) -1)
                    curState->u.quantifier.max--;
                if (curState->u.quantifier.min != 0) {
                    PREPARE_REPEAT();
                    continue;
                }
                curState->index = x->cp - gData->cpbegin;
                curState->parenSoFar = parenSoFar;
                PUSH_STATE_STACK(gData);
                if (!PushBackTrackState(gData, REOP_MINIMALREPEAT,
                                        pc, x, x->cp,
                                        curState->parenSoFar,
                                        parenSoFar - curState->parenSoFar)) {
                    goto bad;
                }
                --gData->stateStackTop;
                pc = pc + GET_OFFSET(pc);
                op = (REOp) *pc++;
                JS_ASSERT(op < REOP_LIMIT);
                continue;
              default:
                JS_ASSERT(JS_FALSE);
                result = NULL;
            }
          break_switch:;
        }

        /*
         *  If the match failed and there's a backtrack option, take it.
         *  Otherwise this is a complete and utter failure.
         */
        if (!result) {
            if (gData->cursz == 0)
                return NULL;
            if (!JS_CHECK_OPERATION_LIMIT(gData->cx, JSOW_JUMP)) {
                gData->ok = JS_FALSE;
                return NULL;
            }

            /* Potentially detect explosive regex here. */
            gData->backTrackCount++;
            if (gData->backTrackLimit &&
                gData->backTrackCount >= gData->backTrackLimit) {
                JS_ReportErrorNumber(gData->cx, js_GetErrorMessage, NULL,
                                     JSMSG_REGEXP_TOO_COMPLEX);
                gData->ok = JS_FALSE;
                return NULL;
            }

            backTrackData = gData->backTrackSP;
            gData->cursz = backTrackData->sz;
            gData->backTrackSP =
                (REBackTrackData *) ((char *)backTrackData - backTrackData->sz);
            x->cp = backTrackData->cp;
            pc = backTrackData->backtrack_pc;
            op = (REOp) backTrackData->backtrack_op;
            JS_ASSERT(op < REOP_LIMIT);
            gData->stateStackTop = backTrackData->saveStateStackTop;
            JS_ASSERT(gData->stateStackTop);

            memcpy(gData->stateStack, backTrackData + 1,
                   sizeof(REProgState) * backTrackData->saveStateStackTop);
            curState = &gData->stateStack[gData->stateStackTop - 1];

            if (backTrackData->parenCount) {
                memcpy(&x->parens[backTrackData->parenIndex],
                       (char *)(backTrackData + 1) +
                       sizeof(REProgState) * backTrackData->saveStateStackTop,
                       sizeof(RECapture) * backTrackData->parenCount);
                parenSoFar = backTrackData->parenIndex + backTrackData->parenCount;
            } else {
                for (k = curState->parenSoFar; k < parenSoFar; k++)
                    x->parens[k].index = -1;
                parenSoFar = curState->parenSoFar;
            }

            re_debug("\tBT_Pop: %ld,%ld",
                     (unsigned long) backTrackData->parenIndex,
                     (unsigned long) backTrackData->parenCount);
            continue;
        }
        x = result;

        /*
         *  Continue with the expression.
         */
        op = (REOp)*pc++;
        JS_ASSERT(op < REOP_LIMIT);
    }

bad:
    re_debug("\n");
    return NULL;

good:
    re_debug("\n");
    return x;
}

static REMatchState *
MatchRegExp(REGlobalData *gData, REMatchState *x)
{
    REMatchState *result;
    const jschar *cp = x->cp;
    const jschar *cp2;
    uintN j;
#ifdef JS_TRACER
    Fragment *fragment;

    /* Run with native regexp if possible. */
    if (TRACING_ENABLED(gData->cx) &&
        ((fragment = JS_TRACE_MONITOR(gData->cx).reFragmento->getLoop(gData->regexp)) != NULL)
        && fragment->code() && !fragment->isBlacklisted()) {
        union { NIns *code; REMatchState* (FASTCALL *func)(void*, void*); } u;
        u.code = fragment->code();
        REMatchState *lr;
        gData->skipped = (ptrdiff_t) x->cp;

        debug_only_v(printf("entering REGEXP trace at %s:%u@%u, code: %p\n",
                            gData->cx->fp->script->filename,
                            js_FramePCToLineNumber(gData->cx, gData->cx->fp),
                            FramePCOffset(gData->cx->fp),
                            fragment->code()););

#if defined(JS_NO_FASTCALL) && defined(NANOJIT_IA32)
        SIMULATE_FASTCALL(lr, x, gData, u.func);
#else
        lr = u.func(x, gData);
#endif

        debug_only_v(printf("leaving REGEXP trace\n"));

        gData->skipped = ((const jschar *) gData->skipped) - cp;
        return lr;
    }
#endif
    /*
     * Have to include the position beyond the last character
     * in order to detect end-of-input/line condition.
     */
    for (cp2 = cp; cp2 <= gData->cpend; cp2++) {
        gData->skipped = cp2 - cp;
        x->cp = cp2;
        for (j = 0; j < gData->regexp->parenCount; j++)
            x->parens[j].index = -1;
        result = ExecuteREBytecode(gData, x);
        if (!gData->ok || result || (gData->regexp->flags & JSREG_STICKY))
            return result;
        gData->backTrackSP = gData->backTrackStack;
        gData->cursz = 0;
        gData->stateStackTop = 0;
        cp2 = cp + gData->skipped;
    }
    return NULL;
}

#define MIN_BACKTRACK_LIMIT 400000

static REMatchState *
InitMatch(JSContext *cx, REGlobalData *gData, JSRegExp *re, size_t length)
{
    REMatchState *result;
    uintN i;

    gData->backTrackStackSize = INITIAL_BACKTRACK;
    JS_ARENA_ALLOCATE_CAST(gData->backTrackStack, REBackTrackData *,
                           &cx->regexpPool,
                           INITIAL_BACKTRACK);
    if (!gData->backTrackStack)
        goto bad;

    gData->backTrackSP = gData->backTrackStack;
    gData->cursz = 0;
    gData->backTrackCount = 0;
    gData->backTrackLimit = 0;
    if (JS_GetOptions(cx) & JSOPTION_RELIMIT) {
        gData->backTrackLimit = length * length * length; /* O(n^3) */
        if (gData->backTrackLimit < MIN_BACKTRACK_LIMIT)
            gData->backTrackLimit = MIN_BACKTRACK_LIMIT;
    }

    gData->stateStackLimit = INITIAL_STATESTACK;
    JS_ARENA_ALLOCATE_CAST(gData->stateStack, REProgState *,
                           &cx->regexpPool,
                           sizeof(REProgState) * INITIAL_STATESTACK);
    if (!gData->stateStack)
        goto bad;

    gData->stateStackTop = 0;
    gData->cx = cx;
    gData->regexp = re;
    gData->ok = JS_TRUE;

    JS_ARENA_ALLOCATE_CAST(result, REMatchState *,
                           &cx->regexpPool,
                           offsetof(REMatchState, parens)
                           + re->parenCount * sizeof(RECapture));
    if (!result)
        goto bad;

    for (i = 0; i < re->classCount; i++) {
        if (!re->classList[i].converted &&
            !ProcessCharSet(gData, &re->classList[i])) {
            return NULL;
        }
    }

    return result;

bad:
    js_ReportOutOfScriptQuota(cx);
    gData->ok = JS_FALSE;
    return NULL;
}

JSBool
js_ExecuteRegExp(JSContext *cx, JSRegExp *re, JSString *str, size_t *indexp,
                 JSBool test, jsval *rval)
{
    REGlobalData gData;
    REMatchState *x, *result;

    const jschar *cp, *ep;
    size_t i, length, start;
    JSSubString *morepar;
    JSBool ok;
    JSRegExpStatics *res;
    ptrdiff_t matchlen;
    uintN num, morenum;
    JSString *parstr, *matchstr;
    JSObject *obj;

    RECapture *parsub = NULL;
    void *mark;
    int64 *timestamp;

    /*
     * It's safe to load from cp because JSStrings have a zero at the end,
     * and we never let cp get beyond cpend.
     */
    start = *indexp;
    JSSTRING_CHARS_AND_LENGTH(str, cp, length);
    if (start > length)
        start = length;
    gData.cpbegin = cp;
    gData.cpend = cp + length;
    cp += start;
    gData.start = start;
    gData.skipped = 0;

    if (!cx->regexpPool.first.next) {
        /*
         * The first arena in the regexpPool must have a timestamp at its base.
         */
        JS_ARENA_ALLOCATE_CAST(timestamp, int64 *,
                               &cx->regexpPool, sizeof *timestamp);
        if (!timestamp)
            return JS_FALSE;
        *timestamp = JS_Now();
    }
    mark = JS_ARENA_MARK(&cx->regexpPool);

    x = InitMatch(cx, &gData, re, length);

    if (!x) {
        ok = JS_FALSE;
        goto out;
    }
    x->cp = cp;

    /*
     * Call the recursive matcher to do the real work.  Return null on mismatch
     * whether testing or not.  On match, return an extended Array object.
     */
    result = MatchRegExp(&gData, x);
    ok = gData.ok;
    if (!ok)
        goto out;
    if (!result) {
        *rval = JSVAL_NULL;
        goto out;
    }
    cp = result->cp;
    i = cp - gData.cpbegin;
    *indexp = i;
    matchlen = i - (start + gData.skipped);
    ep = cp;
    cp -= matchlen;

    if (test) {
        /*
         * Testing for a match and updating cx->regExpStatics: don't allocate
         * an array object, do return true.
         */
        *rval = JSVAL_TRUE;

        /* Avoid warning.  (gcc doesn't detect that obj is needed iff !test); */
        obj = NULL;
    } else {
        /*
         * The array returned on match has element 0 bound to the matched
         * string, elements 1 through state.parenCount bound to the paren
         * matches, an index property telling the length of the left context,
         * and an input property referring to the input string.
         */
        obj = js_NewSlowArrayObject(cx);
        if (!obj) {
            ok = JS_FALSE;
            goto out;
        }
        *rval = OBJECT_TO_JSVAL(obj);

#define DEFVAL(val, id) {                                                     \
    ok = js_DefineProperty(cx, obj, id, val,                                  \
                           JS_PropertyStub, JS_PropertyStub,                  \
                           JSPROP_ENUMERATE, NULL);                           \
    if (!ok) {                                                                \
        cx->weakRoots.newborn[GCX_OBJECT] = NULL;                             \
        cx->weakRoots.newborn[GCX_STRING] = NULL;                             \
        goto out;                                                             \
    }                                                                         \
}

        matchstr = js_NewStringCopyN(cx, cp, matchlen);
        if (!matchstr) {
            cx->weakRoots.newborn[GCX_OBJECT] = NULL;
            ok = JS_FALSE;
            goto out;
        }
        DEFVAL(STRING_TO_JSVAL(matchstr), INT_TO_JSID(0));
    }

    res = &cx->regExpStatics;
    res->input = str;
    res->parenCount = re->parenCount;
    if (re->parenCount == 0) {
        res->lastParen = js_EmptySubString;
    } else {
        for (num = 0; num < re->parenCount; num++) {
            parsub = &result->parens[num];
            if (num < 9) {
                if (parsub->index == -1) {
                    res->parens[num].chars = NULL;
                    res->parens[num].length = 0;
                } else {
                    res->parens[num].chars = gData.cpbegin + parsub->index;
                    res->parens[num].length = parsub->length;
                }
            } else {
                morenum = num - 9;
                morepar = res->moreParens;
                if (!morepar) {
                    res->moreLength = 10;
                    morepar = (JSSubString*)
                        JS_malloc(cx, 10 * sizeof(JSSubString));
                } else if (morenum >= res->moreLength) {
                    res->moreLength += 10;
                    morepar = (JSSubString*)
                        JS_realloc(cx, morepar,
                                   res->moreLength * sizeof(JSSubString));
                }
                if (!morepar) {
                    cx->weakRoots.newborn[GCX_OBJECT] = NULL;
                    cx->weakRoots.newborn[GCX_STRING] = NULL;
                    ok = JS_FALSE;
                    goto out;
                }
                res->moreParens = morepar;
                if (parsub->index == -1) {
                    morepar[morenum].chars = NULL;
                    morepar[morenum].length = 0;
                } else {
                    morepar[morenum].chars = gData.cpbegin + parsub->index;
                    morepar[morenum].length = parsub->length;
                }
            }
            if (test)
                continue;
            if (parsub->index == -1) {
                ok = js_DefineProperty(cx, obj, INT_TO_JSID(num + 1),
                                       JSVAL_VOID, NULL, NULL,
                                       JSPROP_ENUMERATE, NULL);
            } else {
                parstr = js_NewStringCopyN(cx, gData.cpbegin + parsub->index,
                                           parsub->length);
                if (!parstr) {
                    cx->weakRoots.newborn[GCX_OBJECT] = NULL;
                    cx->weakRoots.newborn[GCX_STRING] = NULL;
                    ok = JS_FALSE;
                    goto out;
                }
                ok = js_DefineProperty(cx, obj, INT_TO_JSID(num + 1),
                                       STRING_TO_JSVAL(parstr), NULL, NULL,
                                       JSPROP_ENUMERATE, NULL);
            }
            if (!ok) {
                cx->weakRoots.newborn[GCX_OBJECT] = NULL;
                cx->weakRoots.newborn[GCX_STRING] = NULL;
                goto out;
            }
        }
        if (parsub->index == -1) {
            res->lastParen = js_EmptySubString;
        } else {
            res->lastParen.chars = gData.cpbegin + parsub->index;
            res->lastParen.length = parsub->length;
        }
    }

    if (!test) {
        /*
         * Define the index and input properties last for better for/in loop
         * order (so they come after the elements).
         */
        DEFVAL(INT_TO_JSVAL(start + gData.skipped),
               ATOM_TO_JSID(cx->runtime->atomState.indexAtom));
        DEFVAL(STRING_TO_JSVAL(str),
               ATOM_TO_JSID(cx->runtime->atomState.inputAtom));
    }

#undef DEFVAL

    res->lastMatch.chars = cp;
    res->lastMatch.length = matchlen;

    /*
     * For JS1.3 and ECMAv2, emulate Perl5 exactly:
     *
     * js1.3        "hi", "hi there"            "hihitherehi therebye"
     */
    res->leftContext.chars = JSSTRING_CHARS(str);
    res->leftContext.length = start + gData.skipped;
    res->rightContext.chars = ep;
    res->rightContext.length = gData.cpend - ep;

out:
    JS_ARENA_RELEASE(&cx->regexpPool, mark);
    return ok;
}

/************************************************************************/

#define REGEXP_PROP_ATTRS     (JSPROP_PERMANENT | JSPROP_SHARED)
#define RO_REGEXP_PROP_ATTRS  (REGEXP_PROP_ATTRS | JSPROP_READONLY)

static JSPropertySpec regexp_props[] = {
    {"source",     REGEXP_SOURCE,      RO_REGEXP_PROP_ATTRS,0,0},
    {"global",     REGEXP_GLOBAL,      RO_REGEXP_PROP_ATTRS,0,0},
    {"ignoreCase", REGEXP_IGNORE_CASE, RO_REGEXP_PROP_ATTRS,0,0},
    {"lastIndex",  REGEXP_LAST_INDEX,  REGEXP_PROP_ATTRS,0,0},
    {"multiline",  REGEXP_MULTILINE,   RO_REGEXP_PROP_ATTRS,0,0},
    {"sticky",     REGEXP_STICKY,      RO_REGEXP_PROP_ATTRS,0,0},
    {0,0,0,0,0}
};

static JSBool
regexp_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    jsint slot;
    JSRegExp *re;

    if (!JSVAL_IS_INT(id))
        return JS_TRUE;
    while (OBJ_GET_CLASS(cx, obj) != &js_RegExpClass) {
        obj = OBJ_GET_PROTO(cx, obj);
        if (!obj)
            return JS_TRUE;
    }
    slot = JSVAL_TO_INT(id);
    if (slot == REGEXP_LAST_INDEX)
        return JS_GetReservedSlot(cx, obj, 0, vp);

    JS_LOCK_OBJ(cx, obj);
    re = (JSRegExp *) JS_GetPrivate(cx, obj);
    if (re) {
        switch (slot) {
          case REGEXP_SOURCE:
            *vp = STRING_TO_JSVAL(re->source);
            break;
          case REGEXP_GLOBAL:
            *vp = BOOLEAN_TO_JSVAL((re->flags & JSREG_GLOB) != 0);
            break;
          case REGEXP_IGNORE_CASE:
            *vp = BOOLEAN_TO_JSVAL((re->flags & JSREG_FOLD) != 0);
            break;
          case REGEXP_MULTILINE:
            *vp = BOOLEAN_TO_JSVAL((re->flags & JSREG_MULTILINE) != 0);
            break;
          case REGEXP_STICKY:
            *vp = BOOLEAN_TO_JSVAL((re->flags & JSREG_STICKY) != 0);
            break;
        }
    }
    JS_UNLOCK_OBJ(cx, obj);
    return JS_TRUE;
}

static JSBool
regexp_setProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSBool ok;
    jsint slot;
    jsdouble lastIndex;

    ok = JS_TRUE;
    if (!JSVAL_IS_INT(id))
        return ok;
    while (OBJ_GET_CLASS(cx, obj) != &js_RegExpClass) {
        obj = OBJ_GET_PROTO(cx, obj);
        if (!obj)
            return JS_TRUE;
    }
    slot = JSVAL_TO_INT(id);
    if (slot == REGEXP_LAST_INDEX) {
        if (!JS_ValueToNumber(cx, *vp, &lastIndex))
            return JS_FALSE;
        lastIndex = js_DoubleToInteger(lastIndex);
        ok = JS_NewNumberValue(cx, lastIndex, vp) &&
             JS_SetReservedSlot(cx, obj, 0, *vp);
    }
    return ok;
}

/*
 * RegExp class static properties and their Perl counterparts:
 *
 *  RegExp.input                $_
 *  RegExp.multiline            $*
 *  RegExp.lastMatch            $&
 *  RegExp.lastParen            $+
 *  RegExp.leftContext          $`
 *  RegExp.rightContext         $'
 */
enum regexp_static_tinyid {
    REGEXP_STATIC_INPUT         = -1,
    REGEXP_STATIC_MULTILINE     = -2,
    REGEXP_STATIC_LAST_MATCH    = -3,
    REGEXP_STATIC_LAST_PAREN    = -4,
    REGEXP_STATIC_LEFT_CONTEXT  = -5,
    REGEXP_STATIC_RIGHT_CONTEXT = -6
};

JSBool
js_InitRegExpStatics(JSContext *cx, JSRegExpStatics *res)
{
    JS_ClearRegExpStatics(cx);
    return js_AddRoot(cx, &res->input, "res->input");
}

void
js_FreeRegExpStatics(JSContext *cx, JSRegExpStatics *res)
{
    if (res->moreParens) {
        JS_free(cx, res->moreParens);
        res->moreParens = NULL;
    }
    js_RemoveRoot(cx->runtime, &res->input);
}

static JSBool
regexp_static_getProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    jsint slot;
    JSRegExpStatics *res;
    JSString *str;
    JSSubString *sub;

    res = &cx->regExpStatics;
    if (!JSVAL_IS_INT(id))
        return JS_TRUE;
    slot = JSVAL_TO_INT(id);
    switch (slot) {
      case REGEXP_STATIC_INPUT:
        *vp = res->input ? STRING_TO_JSVAL(res->input)
                         : JS_GetEmptyStringValue(cx);
        return JS_TRUE;
      case REGEXP_STATIC_MULTILINE:
        *vp = BOOLEAN_TO_JSVAL(res->multiline);
        return JS_TRUE;
      case REGEXP_STATIC_LAST_MATCH:
        sub = &res->lastMatch;
        break;
      case REGEXP_STATIC_LAST_PAREN:
        sub = &res->lastParen;
        break;
      case REGEXP_STATIC_LEFT_CONTEXT:
        sub = &res->leftContext;
        break;
      case REGEXP_STATIC_RIGHT_CONTEXT:
        sub = &res->rightContext;
        break;
      default:
        sub = REGEXP_PAREN_SUBSTRING(res, slot);
        break;
    }
    str = js_NewStringCopyN(cx, sub->chars, sub->length);
    if (!str)
        return JS_FALSE;
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
regexp_static_setProperty(JSContext *cx, JSObject *obj, jsval id, jsval *vp)
{
    JSRegExpStatics *res;

    if (!JSVAL_IS_INT(id))
        return JS_TRUE;
    res = &cx->regExpStatics;
    /* XXX use if-else rather than switch to keep MSVC1.52 from crashing */
    if (JSVAL_TO_INT(id) == REGEXP_STATIC_INPUT) {
        if (!JSVAL_IS_STRING(*vp) &&
            !JS_ConvertValue(cx, *vp, JSTYPE_STRING, vp)) {
            return JS_FALSE;
        }
        res->input = JSVAL_TO_STRING(*vp);
    } else if (JSVAL_TO_INT(id) == REGEXP_STATIC_MULTILINE) {
        if (!JSVAL_IS_BOOLEAN(*vp) &&
            !JS_ConvertValue(cx, *vp, JSTYPE_BOOLEAN, vp)) {
            return JS_FALSE;
        }
        res->multiline = JSVAL_TO_BOOLEAN(*vp);
    }
    return JS_TRUE;
}
#define REGEXP_STATIC_PROP_ATTRS    (REGEXP_PROP_ATTRS | JSPROP_ENUMERATE)
#define RO_REGEXP_STATIC_PROP_ATTRS (REGEXP_STATIC_PROP_ATTRS | JSPROP_READONLY)

static JSPropertySpec regexp_static_props[] = {
    {"input",
     REGEXP_STATIC_INPUT,
     REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_setProperty},
    {"multiline",
     REGEXP_STATIC_MULTILINE,
     REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_setProperty},
    {"lastMatch",
     REGEXP_STATIC_LAST_MATCH,
     RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"lastParen",
     REGEXP_STATIC_LAST_PAREN,
     RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"leftContext",
     REGEXP_STATIC_LEFT_CONTEXT,
     RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"rightContext",
     REGEXP_STATIC_RIGHT_CONTEXT,
     RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},

    /* XXX should have block scope and local $1, etc. */
    {"$1", 0, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$2", 1, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$3", 2, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$4", 3, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$5", 4, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$6", 5, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$7", 6, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$8", 7, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},
    {"$9", 8, RO_REGEXP_STATIC_PROP_ATTRS,
     regexp_static_getProperty,    regexp_static_getProperty},

    {0,0,0,0,0}
};

static void
regexp_finalize(JSContext *cx, JSObject *obj)
{
    JSRegExp *re;

    re = (JSRegExp *) JS_GetPrivate(cx, obj);
    if (!re)
        return;
    js_DestroyRegExp(cx, re);
}

/* Forward static prototype. */
static JSBool
regexp_exec_sub(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                JSBool test, jsval *rval);

static JSBool
regexp_call(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    return regexp_exec_sub(cx, JSVAL_TO_OBJECT(argv[-2]), argc, argv,
                           JS_FALSE, rval);
}

#if JS_HAS_XDR

#include "jsxdrapi.h"

static JSBool
regexp_xdrObject(JSXDRState *xdr, JSObject **objp)
{
    JSRegExp *re;
    JSString *source;
    uint32 flagsword;
    JSObject *obj;

    if (xdr->mode == JSXDR_ENCODE) {
        re = (JSRegExp *) JS_GetPrivate(xdr->cx, *objp);
        if (!re)
            return JS_FALSE;
        source = re->source;
        flagsword = (uint32)re->flags;
    }
    if (!JS_XDRString(xdr, &source) ||
        !JS_XDRUint32(xdr, &flagsword)) {
        return JS_FALSE;
    }
    if (xdr->mode == JSXDR_DECODE) {
        obj = js_NewObject(xdr->cx, &js_RegExpClass, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;
        STOBJ_CLEAR_PARENT(obj);
        STOBJ_CLEAR_PROTO(obj);
        re = js_NewRegExp(xdr->cx, NULL, source, (uint8)flagsword, JS_FALSE);
        if (!re)
            return JS_FALSE;
        if (!JS_SetPrivate(xdr->cx, obj, re) ||
            !js_SetLastIndex(xdr->cx, obj, 0)) {
            js_DestroyRegExp(xdr->cx, re);
            return JS_FALSE;
        }
        *objp = obj;
    }
    return JS_TRUE;
}

#else  /* !JS_HAS_XDR */

#define regexp_xdrObject NULL

#endif /* !JS_HAS_XDR */

static void
regexp_trace(JSTracer *trc, JSObject *obj)
{
    JSRegExp *re;

    re = (JSRegExp *) JS_GetPrivate(trc->context, obj);
    if (re && re->source)
        JS_CALL_STRING_TRACER(trc, re->source, "source");
}

JSClass js_RegExpClass = {
    js_RegExp_str,
    JSCLASS_HAS_PRIVATE | JSCLASS_HAS_RESERVED_SLOTS(1) |
    JSCLASS_MARK_IS_TRACE | JSCLASS_HAS_CACHED_PROTO(JSProto_RegExp),
    JS_PropertyStub,    JS_PropertyStub,
    regexp_getProperty, regexp_setProperty,
    JS_EnumerateStub,   JS_ResolveStub,
    JS_ConvertStub,     regexp_finalize,
    NULL,               NULL,
    regexp_call,        NULL,
    regexp_xdrObject,   NULL,
    JS_CLASS_TRACE(regexp_trace), 0
};

static const jschar empty_regexp_ucstr[] = {'(', '?', ':', ')', 0};

JSBool
js_regexp_toString(JSContext *cx, JSObject *obj, jsval *vp)
{
    JSRegExp *re;
    const jschar *source;
    jschar *chars;
    size_t length, nflags;
    uintN flags;
    JSString *str;

    if (!JS_InstanceOf(cx, obj, &js_RegExpClass, vp + 2))
        return JS_FALSE;
    JS_LOCK_OBJ(cx, obj);
    re = (JSRegExp *) JS_GetPrivate(cx, obj);
    if (!re) {
        JS_UNLOCK_OBJ(cx, obj);
        *vp = STRING_TO_JSVAL(cx->runtime->emptyString);
        return JS_TRUE;
    }

    JSSTRING_CHARS_AND_LENGTH(re->source, source, length);
    if (length == 0) {
        source = empty_regexp_ucstr;
        length = JS_ARRAY_LENGTH(empty_regexp_ucstr) - 1;
    }
    length += 2;
    nflags = 0;
    for (flags = re->flags; flags != 0; flags &= flags - 1)
        nflags++;
    chars = (jschar*) JS_malloc(cx, (length + nflags + 1) * sizeof(jschar));
    if (!chars) {
        JS_UNLOCK_OBJ(cx, obj);
        return JS_FALSE;
    }

    chars[0] = '/';
    js_strncpy(&chars[1], source, length - 2);
    chars[length-1] = '/';
    if (nflags) {
        if (re->flags & JSREG_GLOB)
            chars[length++] = 'g';
        if (re->flags & JSREG_FOLD)
            chars[length++] = 'i';
        if (re->flags & JSREG_MULTILINE)
            chars[length++] = 'm';
        if (re->flags & JSREG_STICKY)
            chars[length++] = 'y';
    }
    JS_UNLOCK_OBJ(cx, obj);
    chars[length] = 0;

    str = js_NewString(cx, chars, length);
    if (!str) {
        JS_free(cx, chars);
        return JS_FALSE;
    }
    *vp = STRING_TO_JSVAL(str);
    return JS_TRUE;
}

static JSBool
regexp_toString(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    return obj && js_regexp_toString(cx, obj, vp);
}

static JSBool
regexp_compile_sub(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                   jsval *rval)
{
    JSString *opt, *str;
    JSRegExp *oldre, *re;
    JSBool ok, ok2;
    JSObject *obj2;
    size_t length, nbytes;
    const jschar *cp, *start, *end;
    jschar *nstart, *ncp, *tmp;

    if (!JS_InstanceOf(cx, obj, &js_RegExpClass, argv))
        return JS_FALSE;
    opt = NULL;
    if (argc == 0) {
        str = cx->runtime->emptyString;
    } else {
        if (JSVAL_IS_OBJECT(argv[0])) {
            /*
             * If we get passed in a RegExp object we construct a new
             * RegExp that is a duplicate of it by re-compiling the
             * original source code. ECMA requires that it be an error
             * here if the flags are specified. (We must use the flags
             * from the original RegExp also).
             */
            obj2 = JSVAL_TO_OBJECT(argv[0]);
            if (obj2 && OBJ_GET_CLASS(cx, obj2) == &js_RegExpClass) {
                if (argc >= 2 && !JSVAL_IS_VOID(argv[1])) { /* 'flags' passed */
                    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                         JSMSG_NEWREGEXP_FLAGGED);
                    return JS_FALSE;
                }
                JS_LOCK_OBJ(cx, obj2);
                re = (JSRegExp *) JS_GetPrivate(cx, obj2);
                if (!re) {
                    JS_UNLOCK_OBJ(cx, obj2);
                    return JS_FALSE;
                }
                re = js_NewRegExp(cx, NULL, re->source, re->flags, JS_FALSE);
                JS_UNLOCK_OBJ(cx, obj2);
                goto created;
            }
        }
        str = js_ValueToString(cx, argv[0]);
        if (!str)
            return JS_FALSE;
        argv[0] = STRING_TO_JSVAL(str);
        if (argc > 1) {
            if (JSVAL_IS_VOID(argv[1])) {
                opt = NULL;
            } else {
                opt = js_ValueToString(cx, argv[1]);
                if (!opt)
                    return JS_FALSE;
                argv[1] = STRING_TO_JSVAL(opt);
            }
        }

        /* Escape any naked slashes in the regexp source. */
        JSSTRING_CHARS_AND_LENGTH(str, start, length);
        end = start + length;
        nstart = ncp = NULL;
        for (cp = start; cp < end; cp++) {
            if (*cp == '/' && (cp == start || cp[-1] != '\\')) {
                nbytes = (++length + 1) * sizeof(jschar);
                if (!nstart) {
                    nstart = (jschar *) JS_malloc(cx, nbytes);
                    if (!nstart)
                        return JS_FALSE;
                    ncp = nstart + (cp - start);
                    js_strncpy(nstart, start, cp - start);
                } else {
                    tmp = (jschar *) JS_realloc(cx, nstart, nbytes);
                    if (!tmp) {
                        JS_free(cx, nstart);
                        return JS_FALSE;
                    }
                    ncp = tmp + (ncp - nstart);
                    nstart = tmp;
                }
                *ncp++ = '\\';
            }
            if (nstart)
                *ncp++ = *cp;
        }

        if (nstart) {
            /* Don't forget to store the backstop after the new string. */
            JS_ASSERT((size_t)(ncp - nstart) == length);
            *ncp = 0;
            str = js_NewString(cx, nstart, length);
            if (!str) {
                JS_free(cx, nstart);
                return JS_FALSE;
            }
            argv[0] = STRING_TO_JSVAL(str);
        }
    }

    re = js_NewRegExpOpt(cx, str, opt, JS_FALSE);
created:
    if (!re)
        return JS_FALSE;
    JS_LOCK_OBJ(cx, obj);
    oldre = (JSRegExp *) JS_GetPrivate(cx, obj);
    ok = JS_SetPrivate(cx, obj, re);
    ok2 = js_SetLastIndex(cx, obj, 0);
    JS_UNLOCK_OBJ(cx, obj);
    if (!ok) {
        js_DestroyRegExp(cx, re);
        return JS_FALSE;
    }
    if (oldre)
        js_DestroyRegExp(cx, oldre);
    *rval = OBJECT_TO_JSVAL(obj);
    return ok2;
}

static JSBool
regexp_compile(JSContext *cx, uintN argc, jsval *vp)
{
    JSObject *obj;

    obj = JS_THIS_OBJECT(cx, vp);
    return obj && regexp_compile_sub(cx, obj, argc, vp + 2, vp);
}

static JSBool
regexp_exec_sub(JSContext *cx, JSObject *obj, uintN argc, jsval *argv,
                JSBool test, jsval *rval)
{
    JSBool ok, sticky;
    JSRegExp *re;
    jsdouble lastIndex;
    JSString *str;
    size_t i;

    ok = JS_InstanceOf(cx, obj, &js_RegExpClass, argv);
    if (!ok)
        return JS_FALSE;
    JS_LOCK_OBJ(cx, obj);
    re = (JSRegExp *) JS_GetPrivate(cx, obj);
    if (!re) {
        JS_UNLOCK_OBJ(cx, obj);
        return JS_TRUE;
    }

    /* NB: we must reach out: after this paragraph, in order to drop re. */
    HOLD_REGEXP(cx, re);
    sticky = (re->flags & JSREG_STICKY) != 0;
    if (re->flags & (JSREG_GLOB | JSREG_STICKY)) {
        ok = js_GetLastIndex(cx, obj, &lastIndex);
    } else {
        lastIndex = 0;
    }
    JS_UNLOCK_OBJ(cx, obj);
    if (!ok)
        goto out;

    /* Now that obj is unlocked, it's safe to (potentially) grab the GC lock. */
    if (argc == 0) {
        str = cx->regExpStatics.input;
        if (!str) {
            const char *bytes = js_GetStringBytes(cx, re->source);

            if (bytes) {
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_NO_INPUT,
                                     bytes,
                                     (re->flags & JSREG_GLOB) ? "g" : "",
                                     (re->flags & JSREG_FOLD) ? "i" : "",
                                     (re->flags & JSREG_MULTILINE) ? "m" : "",
                                     (re->flags & JSREG_STICKY) ? "y" : "");
            }
            ok = JS_FALSE;
            goto out;
        }
    } else {
        str = js_ValueToString(cx, argv[0]);
        if (!str) {
            ok = JS_FALSE;
            goto out;
        }
        argv[0] = STRING_TO_JSVAL(str);
    }

    if (lastIndex < 0 || JSSTRING_LENGTH(str) < lastIndex) {
        ok = js_SetLastIndex(cx, obj, 0);
        *rval = JSVAL_NULL;
    } else {
        i = (size_t) lastIndex;
        ok = js_ExecuteRegExp(cx, re, str, &i, test, rval);
        if (ok &&
            ((re->flags & JSREG_GLOB) || (*rval != JSVAL_NULL && sticky))) {
            ok = js_SetLastIndex(cx, obj, (*rval == JSVAL_NULL) ? 0 : i);
        }
    }

out:
    DROP_REGEXP(cx, re);
    return ok;
}

static JSBool
regexp_exec(JSContext *cx, uintN argc, jsval *vp)
{
    return regexp_exec_sub(cx, JS_THIS_OBJECT(cx, vp), argc, vp + 2, JS_FALSE,
                           vp);
}

static JSBool
regexp_test(JSContext *cx, uintN argc, jsval *vp)
{
    if (!regexp_exec_sub(cx, JS_THIS_OBJECT(cx, vp), argc, vp + 2, JS_TRUE, vp))
        return JS_FALSE;
    if (*vp != JSVAL_TRUE)
        *vp = JSVAL_FALSE;
    return JS_TRUE;
}

#ifdef JS_TRACER
static jsint FASTCALL
Regexp_p_test(JSContext* cx, JSObject* regexp, JSString* str)
{
    jsval vp[3] = { JSVAL_NULL, OBJECT_TO_JSVAL(regexp), STRING_TO_JSVAL(str) };
    if (!regexp_exec_sub(cx, regexp, 1, vp + 2, JS_TRUE, vp))
        return JSVAL_TO_BOOLEAN(JSVAL_VOID);
    return *vp == JSVAL_TRUE;
}

JS_DEFINE_TRCINFO_1(regexp_test,
    (3, (static, BOOL_FAIL, Regexp_p_test, CONTEXT, THIS, STRING,  1, 1)))

#endif

static JSFunctionSpec regexp_methods[] = {
#if JS_HAS_TOSOURCE
    JS_FN(js_toSource_str,  regexp_toString,    0,0),
#endif
    JS_FN(js_toString_str,  regexp_toString,    0,0),
    JS_FN("compile",        regexp_compile,     2,0),
    JS_FN("exec",           regexp_exec,        1,0),
    JS_TN("test",           regexp_test,        1,0, regexp_test_trcinfo),
    JS_FS_END
};

static JSBool
RegExp(JSContext *cx, JSObject *obj, uintN argc, jsval *argv, jsval *rval)
{
    if (!(cx->fp->flags & JSFRAME_CONSTRUCTING)) {
        /*
         * If first arg is regexp and no flags are given, just return the arg.
         * (regexp_compile_sub detects the regexp + flags case and throws a
         * TypeError.)  See 10.15.3.1.
         */
        if ((argc < 2 || JSVAL_IS_VOID(argv[1])) &&
            !JSVAL_IS_PRIMITIVE(argv[0]) &&
            OBJ_GET_CLASS(cx, JSVAL_TO_OBJECT(argv[0])) == &js_RegExpClass) {
            *rval = argv[0];
            return JS_TRUE;
        }

        /* Otherwise, replace obj with a new RegExp object. */
        obj = js_NewObject(cx, &js_RegExpClass, NULL, NULL, 0);
        if (!obj)
            return JS_FALSE;

        /*
         * regexp_compile_sub does not use rval to root its temporaries so we
         * can use it to root obj.
         */
        *rval = OBJECT_TO_JSVAL(obj);
    }
    return regexp_compile_sub(cx, obj, argc, argv, rval);
}

JSObject *
js_InitRegExpClass(JSContext *cx, JSObject *obj)
{
    JSObject *proto, *ctor;
    jsval rval;

    proto = JS_InitClass(cx, obj, NULL, &js_RegExpClass, RegExp, 1,
                         regexp_props, regexp_methods,
                         regexp_static_props, NULL);

    if (!proto || !(ctor = JS_GetConstructor(cx, proto)))
        return NULL;
    if (!JS_AliasProperty(cx, ctor, "input",        "$_") ||
        !JS_AliasProperty(cx, ctor, "multiline",    "$*") ||
        !JS_AliasProperty(cx, ctor, "lastMatch",    "$&") ||
        !JS_AliasProperty(cx, ctor, "lastParen",    "$+") ||
        !JS_AliasProperty(cx, ctor, "leftContext",  "$`") ||
        !JS_AliasProperty(cx, ctor, "rightContext", "$'")) {
        goto bad;
    }

    /* Give RegExp.prototype private data so it matches the empty string. */
    if (!regexp_compile_sub(cx, proto, 0, NULL, &rval))
        goto bad;
    return proto;

bad:
    JS_DeleteProperty(cx, obj, js_RegExpClass.name);
    return NULL;
}

JSObject *
js_NewRegExpObject(JSContext *cx, JSTokenStream *ts,
                   jschar *chars, size_t length, uintN flags)
{
    JSString *str;
    JSObject *obj;
    JSRegExp *re;
    JSTempValueRooter tvr;

    str = js_NewStringCopyN(cx, chars, length);
    if (!str)
        return NULL;
    re = js_NewRegExp(cx, ts,  str, flags, JS_FALSE);
    if (!re)
        return NULL;
    JS_PUSH_TEMP_ROOT_STRING(cx, str, &tvr);
    obj = js_NewObject(cx, &js_RegExpClass, NULL, NULL, 0);
    if (!obj || !JS_SetPrivate(cx, obj, re)) {
        js_DestroyRegExp(cx, re);
        obj = NULL;
    }
    if (obj && !js_SetLastIndex(cx, obj, 0))
        obj = NULL;
    JS_POP_TEMP_ROOT(cx, &tvr);
    return obj;
}

JSObject *
js_CloneRegExpObject(JSContext *cx, JSObject *obj, JSObject *parent)
{
    JSObject *clone;
    JSRegExp *re;

    JS_ASSERT(OBJ_GET_CLASS(cx, obj) == &js_RegExpClass);
    clone = js_NewObject(cx, &js_RegExpClass, NULL, parent, 0);
    if (!clone)
        return NULL;
    re = (JSRegExp *) JS_GetPrivate(cx, obj);
    if (!JS_SetPrivate(cx, clone, re) || !js_SetLastIndex(cx, clone, 0)) {
        cx->weakRoots.newborn[GCX_OBJECT] = NULL;
        return NULL;
    }
    HOLD_REGEXP(cx, re);
    return clone;
}

JSBool
js_GetLastIndex(JSContext *cx, JSObject *obj, jsdouble *lastIndex)
{
    jsval v;

    return JS_GetReservedSlot(cx, obj, 0, &v) &&
           JS_ValueToNumber(cx, v, lastIndex);
}

JSBool
js_SetLastIndex(JSContext *cx, JSObject *obj, jsdouble lastIndex)
{
    jsval v;

    return JS_NewNumberValue(cx, lastIndex, &v) &&
           JS_SetReservedSlot(cx, obj, 0, v);
}

