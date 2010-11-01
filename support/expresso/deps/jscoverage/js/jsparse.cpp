/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=99:
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
 * JS parser.
 *
 * This is a recursive-descent parser for the JavaScript language specified by
 * "The JavaScript 1.5 Language Specification".  It uses lexical and semantic
 * feedback to disambiguate non-LL(1) structures.  It generates trees of nodes
 * induced by the recursive parsing (not precise syntax trees, see jsparse.h).
 * After tree construction, it rewrites trees to fold constants and evaluate
 * compile-time expressions.  Finally, it calls js_EmitTree (see jsemit.h) to
 * generate bytecode.
 *
 * This parser attempts no error recovery.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "jstypes.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsutil.h" /* Added by JSIFY */
#include "jsapi.h"
#include "jsarray.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsemit.h"
#include "jsfun.h"
#include "jsinterp.h"
#include "jsiter.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsparse.h"
#include "jsscan.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jsstaticcheck.h"

#if JS_HAS_XML_SUPPORT
#include "jsxml.h"
#endif

#if JS_HAS_DESTRUCTURING
#include "jsdhash.h"
#endif

/*
 * Asserts to verify assumptions behind pn_ macros.
 */
JS_STATIC_ASSERT(offsetof(JSParseNode, pn_u.name.atom) ==
                 offsetof(JSParseNode, pn_u.apair.atom));
JS_STATIC_ASSERT(offsetof(JSParseNode, pn_u.name.slot) ==
                 offsetof(JSParseNode, pn_u.lexical.slot));

/*
 * JS parsers, from lowest to highest precedence.
 *
 * Each parser takes a context, a token stream, and a tree context struct.
 * Each returns a parse node tree or null on error.
 */

typedef JSParseNode *
JSParser(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc);

typedef JSParseNode *
JSMemberParser(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
               JSBool allowCallSyntax);

typedef JSParseNode *
JSPrimaryParser(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                JSTokenType tt, JSBool afterDot);

typedef JSParseNode *
JSParenParser(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
              JSParseNode *pn1, JSBool *genexp);

static JSParser FunctionStmt;
static JSParser FunctionExpr;
static JSParser Statements;
static JSParser Statement;
static JSParser Variables;
static JSParser Expr;
static JSParser AssignExpr;
static JSParser CondExpr;
static JSParser OrExpr;
static JSParser AndExpr;
static JSParser BitOrExpr;
static JSParser BitXorExpr;
static JSParser BitAndExpr;
static JSParser EqExpr;
static JSParser RelExpr;
static JSParser ShiftExpr;
static JSParser AddExpr;
static JSParser MulExpr;
static JSParser UnaryExpr;
static JSMemberParser  MemberExpr;
static JSPrimaryParser PrimaryExpr;
static JSParenParser   ParenExpr;

/*
 * Insist that the next token be of type tt, or report errno and return null.
 * NB: this macro uses cx and ts from its lexical environment.
 */
#define MUST_MATCH_TOKEN(tt, errno)                                           \
    JS_BEGIN_MACRO                                                            \
        if (js_GetToken(cx, ts) != tt) {                                      \
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR, errno); \
            return NULL;                                                      \
        }                                                                     \
    JS_END_MACRO

#ifdef METER_PARSENODES
static uint32 parsenodes = 0;
static uint32 maxparsenodes = 0;
static uint32 recyclednodes = 0;
#endif

JSBool
js_InitParseContext(JSContext *cx, JSParseContext *pc, JSPrincipals *principals,
                    JSStackFrame *callerFrame,
                    const jschar *base, size_t length,
                    FILE *fp, const char *filename, uintN lineno)
{
    JS_ASSERT_IF(callerFrame, callerFrame->script);

    pc->tempPoolMark = JS_ARENA_MARK(&cx->tempPool);
    if (!js_InitTokenStream(cx, TS(pc), base, length, fp, filename, lineno)) {
        JS_ARENA_RELEASE(&cx->tempPool, pc->tempPoolMark);
        return JS_FALSE;
    }
    if (principals)
        JSPRINCIPALS_HOLD(cx, principals);
    pc->principals = principals;
    pc->callerFrame = callerFrame;
    pc->nodeList = NULL;
    pc->traceListHead = NULL;

    /* Root atoms and objects allocated for the parsed tree. */
    JS_KEEP_ATOMS(cx->runtime);
    JS_PUSH_TEMP_ROOT_PARSE_CONTEXT(cx, pc, &pc->tempRoot);
    return JS_TRUE;
}

void
js_FinishParseContext(JSContext *cx, JSParseContext *pc)
{
    if (pc->principals)
        JSPRINCIPALS_DROP(cx, pc->principals);
    JS_ASSERT(pc->tempRoot.u.parseContext == pc);
    JS_POP_TEMP_ROOT(cx, &pc->tempRoot);
    JS_UNKEEP_ATOMS(cx->runtime);
    js_CloseTokenStream(cx, TS(pc));
    JS_ARENA_RELEASE(&cx->tempPool, pc->tempPoolMark);
}

void
js_InitCompilePrincipals(JSContext *cx, JSParseContext *pc,
                         JSPrincipals *principals)
{
    JS_ASSERT(!pc->principals);
    if (principals)
        JSPRINCIPALS_HOLD(cx, principals);
    pc->principals = principals;
}

JSParsedObjectBox *
js_NewParsedObjectBox(JSContext *cx, JSParseContext *pc, JSObject *obj)
{
    JSParsedObjectBox *pob;

    /*
     * We use JSContext.tempPool to allocate parsed objects and place them on
     * a list in JSTokenStream to ensure GC safety. Thus the tempPool arenas
     * containing the entries must be alive until we are done with scanning,
     * parsing and code generation for the whole script or top-level function.
     */
    JS_ASSERT(obj);
    JS_ARENA_ALLOCATE_TYPE(pob, JSParsedObjectBox, &cx->tempPool);
    if (!pob) {
        js_ReportOutOfScriptQuota(cx);
        return NULL;
    }
    pob->traceLink = pc->traceListHead;
    pob->emitLink = NULL;
    pob->object = obj;
    pc->traceListHead = pob;
    return pob;
}


void
js_TraceParseContext(JSTracer *trc, JSParseContext *pc)
{
    JSParsedObjectBox *pob;

    JS_ASSERT(pc->tempRoot.u.parseContext == pc);
    pob = pc->traceListHead;
    while (pob) {
        JS_CALL_OBJECT_TRACER(trc, pob->object, "parser.object");
        pob = pob->traceLink;
    }
}

static JSParseNode *
RecycleTree(JSParseNode *pn, JSTreeContext *tc)
{
    JSParseNode *next;

    if (!pn)
        return NULL;

    /* Catch back-to-back dup recycles. */
    JS_ASSERT(pn != tc->parseContext->nodeList);
    next = pn->pn_next;
    pn->pn_next = tc->parseContext->nodeList;
    tc->parseContext->nodeList = pn;
#ifdef METER_PARSENODES
    recyclednodes++;
#endif
    return next;
}

static JSParseNode *
NewOrRecycledNode(JSContext *cx, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = tc->parseContext->nodeList;
    if (!pn) {
        JS_ARENA_ALLOCATE_TYPE(pn, JSParseNode, &cx->tempPool);
        if (!pn)
            js_ReportOutOfScriptQuota(cx);
    } else {
        tc->parseContext->nodeList = pn->pn_next;

        /* Recycle immediate descendents only, to save work and working set. */
        switch (pn->pn_arity) {
          case PN_FUNC:
            RecycleTree(pn->pn_body, tc);
            break;
          case PN_LIST:
            if (pn->pn_head) {
                /* XXX check for dup recycles in the list */
                *pn->pn_tail = tc->parseContext->nodeList;
                tc->parseContext->nodeList = pn->pn_head;
#ifdef METER_PARSENODES
                recyclednodes += pn->pn_count;
#endif
            }
            break;
          case PN_TERNARY:
            RecycleTree(pn->pn_kid1, tc);
            RecycleTree(pn->pn_kid2, tc);
            RecycleTree(pn->pn_kid3, tc);
            break;
          case PN_BINARY:
            if (pn->pn_left != pn->pn_right)
                RecycleTree(pn->pn_left, tc);
            RecycleTree(pn->pn_right, tc);
            break;
          case PN_UNARY:
            RecycleTree(pn->pn_kid, tc);
            break;
          case PN_NAME:
            RecycleTree(pn->pn_expr, tc);
            break;
          case PN_NULLARY:
            break;
        }
    }
    if (pn) {
#ifdef METER_PARSENODES
        parsenodes++;
        if (parsenodes - recyclednodes > maxparsenodes)
            maxparsenodes = parsenodes - recyclednodes;
#endif
        memset(&pn->pn_u, 0, sizeof pn->pn_u);
        pn->pn_next = NULL;
    }
    return pn;
}

/*
 * Allocate a JSParseNode from cx's temporary arena.
 */
static JSParseNode *
NewParseNode(JSContext *cx, JSTokenStream *ts, JSParseNodeArity arity,
             JSTreeContext *tc)
{
    JSParseNode *pn;
    JSToken *tp;

    pn = NewOrRecycledNode(cx, tc);
    if (!pn)
        return NULL;
    tp = &CURRENT_TOKEN(ts);
    pn->pn_type = tp->type;
    pn->pn_pos = tp->pos;
    pn->pn_op = JSOP_NOP;
    pn->pn_arity = arity;
    return pn;
}

static JSParseNode *
NewBinary(JSContext *cx, JSTokenType tt,
          JSOp op, JSParseNode *left, JSParseNode *right,
          JSTreeContext *tc)
{
    JSParseNode *pn, *pn1, *pn2;

    if (!left || !right)
        return NULL;

    /*
     * Flatten a left-associative (left-heavy) tree of a given operator into
     * a list, to reduce js_FoldConstants and js_EmitTree recursion.
     */
    if (left->pn_type == tt &&
        left->pn_op == op &&
        (js_CodeSpec[op].format & JOF_LEFTASSOC)) {
        if (left->pn_arity != PN_LIST) {
            pn1 = left->pn_left, pn2 = left->pn_right;
            left->pn_arity = PN_LIST;
            PN_INIT_LIST_1(left, pn1);
            PN_APPEND(left, pn2);
            if (tt == TOK_PLUS) {
                if (pn1->pn_type == TOK_STRING)
                    left->pn_extra |= PNX_STRCAT;
                else if (pn1->pn_type != TOK_NUMBER)
                    left->pn_extra |= PNX_CANTFOLD;
                if (pn2->pn_type == TOK_STRING)
                    left->pn_extra |= PNX_STRCAT;
                else if (pn2->pn_type != TOK_NUMBER)
                    left->pn_extra |= PNX_CANTFOLD;
            }
        }
        PN_APPEND(left, right);
        left->pn_pos.end = right->pn_pos.end;
        if (tt == TOK_PLUS) {
            if (right->pn_type == TOK_STRING)
                left->pn_extra |= PNX_STRCAT;
            else if (right->pn_type != TOK_NUMBER)
                left->pn_extra |= PNX_CANTFOLD;
        }
        return left;
    }

    /*
     * Fold constant addition immediately, to conserve node space and, what's
     * more, so js_FoldConstants never sees mixed addition and concatenation
     * operations with more than one leading non-string operand in a PN_LIST
     * generated for expressions such as 1 + 2 + "pt" (which should evaluate
     * to "3pt", not "12pt").
     */
    if (tt == TOK_PLUS &&
        left->pn_type == TOK_NUMBER &&
        right->pn_type == TOK_NUMBER) {
        left->pn_dval += right->pn_dval;
        left->pn_pos.end = right->pn_pos.end;
        RecycleTree(right, tc);
        return left;
    }

    pn = NewOrRecycledNode(cx, tc);
    if (!pn)
        return NULL;
    pn->pn_type = tt;
    pn->pn_pos.begin = left->pn_pos.begin;
    pn->pn_pos.end = right->pn_pos.end;
    pn->pn_op = op;
    pn->pn_arity = PN_BINARY;
    pn->pn_left = left;
    pn->pn_right = right;
    return pn;
}

#if JS_HAS_GETTER_SETTER
static JSTokenType
CheckGetterOrSetter(JSContext *cx, JSTokenStream *ts, JSTokenType tt)
{
    JSAtom *atom;
    JSRuntime *rt;
    JSOp op;
    const char *name;

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_NAME);
    atom = CURRENT_TOKEN(ts).t_atom;
    rt = cx->runtime;
    if (atom == rt->atomState.getterAtom)
        op = JSOP_GETTER;
    else if (atom == rt->atomState.setterAtom)
        op = JSOP_SETTER;
    else
        return TOK_NAME;
    if (js_PeekTokenSameLine(cx, ts) != tt)
        return TOK_NAME;
    (void) js_GetToken(cx, ts);
    if (CURRENT_TOKEN(ts).t_op != JSOP_NOP) {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_GETTER_OR_SETTER,
                                    (op == JSOP_GETTER)
                                    ? js_getter_str
                                    : js_setter_str);
        return TOK_ERROR;
    }
    CURRENT_TOKEN(ts).t_op = op;
    if (JS_HAS_STRICT_OPTION(cx)) {
        name = js_AtomToPrintableString(cx, atom);
        if (!name ||
            !js_ReportCompileErrorNumber(cx, ts, NULL,
                                         JSREPORT_WARNING | JSREPORT_STRICT,
                                         JSMSG_DEPRECATED_USAGE,
                                         name)) {
            return TOK_ERROR;
        }
    }
    return tt;
}
#endif

/*
 * Parse a top-level JS script.
 */
JSParseNode *
js_ParseScript(JSContext *cx, JSObject *chain, JSParseContext *pc)
{
    JSTreeContext tc;
    JSParseNode *pn;

    /*
     * Protect atoms from being collected by a GC activation, which might
     * - nest on this thread due to out of memory (the so-called "last ditch"
     *   GC attempted within js_NewGCThing), or
     * - run for any reason on another thread if this thread is suspended on
     *   an object lock before it finishes generating bytecode into a script
     *   protected from the GC by a root or a stack frame reference.
     */
    TREE_CONTEXT_INIT(&tc, pc);
    tc.u.scopeChain = chain;
    pn = Statements(cx, TS(pc), &tc);
    if (pn) {
        if (!js_MatchToken(cx, TS(pc), TOK_EOF)) {
            js_ReportCompileErrorNumber(cx, TS(pc), NULL, JSREPORT_ERROR,
                                        JSMSG_SYNTAX_ERROR);
            pn = NULL;
        } else {
            pn->pn_type = TOK_LC;
            if (!js_FoldConstants(cx, pn, &tc))
                pn = NULL;
        }
    }

    TREE_CONTEXT_FINISH(cx, &tc);
    return pn;
}

/*
 * Compile a top-level script.
 */
extern JSScript *
js_CompileScript(JSContext *cx, JSObject *scopeChain, JSStackFrame *callerFrame,
                 JSPrincipals *principals, uint32 tcflags,
                 const jschar *chars, size_t length,
                 FILE *file, const char *filename, uintN lineno)
{
    JSParseContext pc;
    JSArenaPool codePool, notePool;
    JSCodeGenerator cg;
    JSTokenType tt;
    JSParseNode *pn;
    uint32 scriptGlobals;
    JSScript *script;
#ifdef METER_PARSENODES
    void *sbrk(ptrdiff_t), *before = sbrk(0);
#endif

    JS_ASSERT(!(tcflags & ~(TCF_COMPILE_N_GO | TCF_NO_SCRIPT_RVAL |
                            TCF_STATIC_DEPTH_MASK)));

    /*
     * The scripted callerFrame can only be given for compile-and-go scripts
     * and non-zero static depth requires callerFrame.
     */
    JS_ASSERT_IF(callerFrame, tcflags & TCF_COMPILE_N_GO);
    JS_ASSERT_IF(TCF_GET_STATIC_DEPTH(tcflags) != 0, callerFrame);

    if (!js_InitParseContext(cx, &pc, principals, callerFrame, chars, length,
                             file, filename, lineno)) {
        return NULL;
    }

    JS_INIT_ARENA_POOL(&codePool, "code", 1024, sizeof(jsbytecode),
                       &cx->scriptStackQuota);
    JS_INIT_ARENA_POOL(&notePool, "note", 1024, sizeof(jssrcnote),
                       &cx->scriptStackQuota);
    js_InitCodeGenerator(cx, &cg, &pc, &codePool, &notePool,
                         pc.tokenStream.lineno);

    MUST_FLOW_THROUGH("out");
    cg.treeContext.flags |= (uint16) tcflags;
    cg.treeContext.u.scopeChain = scopeChain;
    cg.staticDepth = TCF_GET_STATIC_DEPTH(tcflags);

    if ((tcflags & TCF_COMPILE_N_GO) && callerFrame && callerFrame->fun) {
        /*
         * An eval script in a caller frame needs to have its enclosing function
         * captured in case it uses an upvar reference, and someone wishes to
         * decompile it while running.
         */
        JSParsedObjectBox *pob = js_NewParsedObjectBox(cx, &pc, callerFrame->callee);
        pob->emitLink = cg.objectList.lastPob;
        cg.objectList.lastPob = pob;
        cg.objectList.length++;
    }

    /* Inline Statements() to emit as we go to save space. */
    for (;;) {
        pc.tokenStream.flags |= TSF_OPERAND;
        tt = js_PeekToken(cx, &pc.tokenStream);
        pc.tokenStream.flags &= ~TSF_OPERAND;
        if (tt <= TOK_EOF) {
            if (tt == TOK_EOF)
                break;
            JS_ASSERT(tt == TOK_ERROR);
            script = NULL;
            goto out;
        }

        pn = Statement(cx, &pc.tokenStream, &cg.treeContext);
        if (!pn) {
            script = NULL;
            goto out;
        }
        JS_ASSERT(!cg.treeContext.blockNode);

        if (!js_FoldConstants(cx, pn, &cg.treeContext) ||
            !js_EmitTree(cx, &cg, pn)) {
            script = NULL;
            goto out;
        }
        RecycleTree(pn, &cg.treeContext);
    }

    /*
     * Global variables and regexps shares the index space with locals. Due to
     * incremental code generation we need to patch the bytecode to adjust the
     * local references to skip the globals.
     */
    scriptGlobals = cg.treeContext.ngvars + cg.regexpList.length;
    if (scriptGlobals != 0) {
        jsbytecode *code, *end;
        JSOp op;
        const JSCodeSpec *cs;
        uintN len, slot;

        if (scriptGlobals >= SLOTNO_LIMIT)
            goto too_many_slots;
        code = CG_BASE(&cg);
        for (end = code + CG_OFFSET(&cg); code != end; code += len) {
            JS_ASSERT(code < end);
            op = (JSOp) *code;
            cs = &js_CodeSpec[op];
            len = (cs->length > 0)
                  ? (uintN) cs->length
                  : js_GetVariableBytecodeLength(code);
            if (JOF_TYPE(cs->format) == JOF_LOCAL ||
                (JOF_TYPE(cs->format) == JOF_SLOTATOM)) {
                /*
                 * JSOP_GETARGPROP also has JOF_SLOTATOM type, but it may be
                 * emitted only for a function.
                 */
                JS_ASSERT((JOF_TYPE(cs->format) == JOF_SLOTATOM) ==
                          (op == JSOP_GETLOCALPROP));
                slot = GET_SLOTNO(code);
                slot += scriptGlobals;
                if (slot >= SLOTNO_LIMIT)
                    goto too_many_slots;
                SET_SLOTNO(code, slot);
            }
        }
    }

#ifdef METER_PARSENODES
    printf("Parser growth: %d (%u nodes, %u max, %u unrecycled)\n",
           (char *)sbrk(0) - (char *)before,
           parsenodes,
           maxparsenodes,
           parsenodes - recyclednodes);
    before = sbrk(0);
#endif

    /*
     * Nowadays the threaded interpreter needs a stop instruction, so we
     * do have to emit that here.
     */
    if (js_Emit1(cx, &cg, JSOP_STOP) < 0) {
        script = NULL;
        goto out;
    }
#ifdef METER_PARSENODES
    printf("Code-gen growth: %d (%u bytecodes, %u srcnotes)\n",
           (char *)sbrk(0) - (char *)before, CG_OFFSET(cg), cg->noteCount);
#endif
#ifdef JS_ARENAMETER
    JS_DumpArenaStats(stdout);
#endif
    script = js_NewScriptFromCG(cx, &cg);

#ifdef JS_SCOPE_DEPTH_METER
    if (script) {
        JSObject *obj = scopeChain;
        uintN depth = 1;
        while ((obj = OBJ_GET_PARENT(cx, obj)) != NULL)
            ++depth;
        JS_BASIC_STATS_ACCUM(&cx->runtime->hostenvScopeDepthStats, depth);
    }
#endif

  out:
    js_FinishCodeGenerator(cx, &cg);
    JS_FinishArenaPool(&codePool);
    JS_FinishArenaPool(&notePool);
    js_FinishParseContext(cx, &pc);
    return script;

  too_many_slots:
    js_ReportCompileErrorNumber(cx, &pc.tokenStream, NULL,
                                JSREPORT_ERROR, JSMSG_TOO_MANY_LOCALS);
    script = NULL;
    goto out;
}

/*
 * Insist on a final return before control flows out of pn.  Try to be a bit
 * smart about loops: do {...; return e2;} while(0) at the end of a function
 * that contains an early return e1 will get a strict warning.  Similarly for
 * iloops: while (true){...} is treated as though ... returns.
 */
#define ENDS_IN_OTHER   0
#define ENDS_IN_RETURN  1
#define ENDS_IN_BREAK   2

static int
HasFinalReturn(JSParseNode *pn)
{
    JSParseNode *pn2, *pn3;
    uintN rv, rv2, hasDefault;

    switch (pn->pn_type) {
      case TOK_LC:
        if (!pn->pn_head)
            return ENDS_IN_OTHER;
        return HasFinalReturn(PN_LAST(pn));

      case TOK_IF:
        if (!pn->pn_kid3)
            return ENDS_IN_OTHER;
        return HasFinalReturn(pn->pn_kid2) & HasFinalReturn(pn->pn_kid3);

      case TOK_WHILE:
        pn2 = pn->pn_left;
        if (pn2->pn_type == TOK_PRIMARY && pn2->pn_op == JSOP_TRUE)
            return ENDS_IN_RETURN;
        if (pn2->pn_type == TOK_NUMBER && pn2->pn_dval)
            return ENDS_IN_RETURN;
        return ENDS_IN_OTHER;

      case TOK_DO:
        pn2 = pn->pn_right;
        if (pn2->pn_type == TOK_PRIMARY) {
            if (pn2->pn_op == JSOP_FALSE)
                return HasFinalReturn(pn->pn_left);
            if (pn2->pn_op == JSOP_TRUE)
                return ENDS_IN_RETURN;
        }
        if (pn2->pn_type == TOK_NUMBER) {
            if (pn2->pn_dval == 0)
                return HasFinalReturn(pn->pn_left);
            return ENDS_IN_RETURN;
        }
        return ENDS_IN_OTHER;

      case TOK_FOR:
        pn2 = pn->pn_left;
        if (pn2->pn_arity == PN_TERNARY && !pn2->pn_kid2)
            return ENDS_IN_RETURN;
        return ENDS_IN_OTHER;

      case TOK_SWITCH:
        rv = ENDS_IN_RETURN;
        hasDefault = ENDS_IN_OTHER;
        pn2 = pn->pn_right;
        if (pn2->pn_type == TOK_LEXICALSCOPE)
            pn2 = pn2->pn_expr;
        for (pn2 = pn2->pn_head; rv && pn2; pn2 = pn2->pn_next) {
            if (pn2->pn_type == TOK_DEFAULT)
                hasDefault = ENDS_IN_RETURN;
            pn3 = pn2->pn_right;
            JS_ASSERT(pn3->pn_type == TOK_LC);
            if (pn3->pn_head) {
                rv2 = HasFinalReturn(PN_LAST(pn3));
                if (rv2 == ENDS_IN_OTHER && pn2->pn_next)
                    /* Falling through to next case or default. */;
                else
                    rv &= rv2;
            }
        }
        /* If a final switch has no default case, we judge it harshly. */
        rv &= hasDefault;
        return rv;

      case TOK_BREAK:
        return ENDS_IN_BREAK;

      case TOK_WITH:
        return HasFinalReturn(pn->pn_right);

      case TOK_RETURN:
        return ENDS_IN_RETURN;

      case TOK_COLON:
      case TOK_LEXICALSCOPE:
        return HasFinalReturn(pn->pn_expr);

      case TOK_THROW:
        return ENDS_IN_RETURN;

      case TOK_TRY:
        /* If we have a finally block that returns, we are done. */
        if (pn->pn_kid3) {
            rv = HasFinalReturn(pn->pn_kid3);
            if (rv == ENDS_IN_RETURN)
                return rv;
        }

        /* Else check the try block and any and all catch statements. */
        rv = HasFinalReturn(pn->pn_kid1);
        if (pn->pn_kid2) {
            JS_ASSERT(pn->pn_kid2->pn_arity == PN_LIST);
            for (pn2 = pn->pn_kid2->pn_head; pn2; pn2 = pn2->pn_next)
                rv &= HasFinalReturn(pn2);
        }
        return rv;

      case TOK_CATCH:
        /* Check this catch block's body. */
        return HasFinalReturn(pn->pn_kid3);

      case TOK_LET:
        /* Non-binary let statements are let declarations. */
        if (pn->pn_arity != PN_BINARY)
            return ENDS_IN_OTHER;
        return HasFinalReturn(pn->pn_right);

      default:
        return ENDS_IN_OTHER;
    }
}

static JSBool
ReportBadReturn(JSContext *cx, JSTreeContext *tc, uintN flags, uintN errnum,
                uintN anonerrnum)
{
    const char *name;

    JS_ASSERT(tc->flags & TCF_IN_FUNCTION);
    if (tc->u.fun->atom) {
        name = js_AtomToPrintableString(cx, tc->u.fun->atom);
    } else {
        errnum = anonerrnum;
        name = NULL;
    }
    return js_ReportCompileErrorNumber(cx, TS(tc->parseContext), NULL, flags,
                                       errnum, name);
}

static JSBool
CheckFinalReturn(JSContext *cx, JSTreeContext *tc, JSParseNode *pn)
{
    JS_ASSERT(tc->flags & TCF_IN_FUNCTION);
    return HasFinalReturn(pn) == ENDS_IN_RETURN ||
           ReportBadReturn(cx, tc, JSREPORT_WARNING | JSREPORT_STRICT,
                           JSMSG_NO_RETURN_VALUE, JSMSG_ANON_NO_RETURN_VALUE);
}

static JSParseNode *
FunctionBody(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSStmtInfo stmtInfo;
    uintN oldflags, firstLine;
    JSParseNode *pn;

    JS_ASSERT(tc->flags & TCF_IN_FUNCTION);
    js_PushStatement(tc, &stmtInfo, STMT_BLOCK, -1);
    stmtInfo.flags = SIF_BODY_BLOCK;

    oldflags = tc->flags;
    tc->flags &= ~(TCF_RETURN_EXPR | TCF_RETURN_VOID);

    /*
     * Save the body's first line, and store it in pn->pn_pos.begin.lineno
     * later, because we may have not peeked in ts yet, so Statements won't
     * acquire a valid pn->pn_pos.begin from the current token.
     */
    firstLine = ts->lineno;
#if JS_HAS_EXPR_CLOSURES
    if (CURRENT_TOKEN(ts).type == TOK_LC) {
        pn = Statements(cx, ts, tc);
    } else {
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (pn) {
            pn->pn_kid = AssignExpr(cx, ts, tc);
            if (!pn->pn_kid) {
                pn = NULL;
            } else {
                if (tc->flags & TCF_FUN_IS_GENERATOR) {
                    ReportBadReturn(cx, tc, JSREPORT_ERROR,
                                    JSMSG_BAD_GENERATOR_RETURN,
                                    JSMSG_BAD_ANON_GENERATOR_RETURN);
                    pn = NULL;
                } else {
                    pn->pn_type = TOK_RETURN;
                    pn->pn_op = JSOP_RETURN;
                    pn->pn_pos.end = pn->pn_kid->pn_pos.end;
                }
            }
        }
    }
#else
    pn = Statements(cx, ts, tc);
#endif

    if (pn) {
        js_PopStatement(tc);
        pn->pn_pos.begin.lineno = firstLine;

        /* Check for falling off the end of a function that returns a value. */
        if (JS_HAS_STRICT_OPTION(cx) && (tc->flags & TCF_RETURN_EXPR) &&
            !CheckFinalReturn(cx, tc, pn)) {
            pn = NULL;
        }
    }

    tc->flags = oldflags | (tc->flags & (TCF_FUN_FLAGS | TCF_HAS_DEFXMLNS));
    return pn;
}

/*
 * Compile a JS function body, which might appear as the value of an event
 * handler attribute in an HTML <INPUT> tag.
 */
JSBool
js_CompileFunctionBody(JSContext *cx, JSFunction *fun, JSPrincipals *principals,
                       const jschar *chars, size_t length,
                       const char *filename, uintN lineno)
{
    JSParseContext pc;
    JSArenaPool codePool, notePool;
    JSCodeGenerator funcg;
    JSParseNode *pn;

    if (!js_InitParseContext(cx, &pc, principals, NULL, chars, length, NULL,
                             filename, lineno)) {
        return JS_FALSE;
    }

    /* No early return from this point until js_FinishParseContext call. */
    JS_INIT_ARENA_POOL(&codePool, "code", 1024, sizeof(jsbytecode),
                       &cx->scriptStackQuota);
    JS_INIT_ARENA_POOL(&notePool, "note", 1024, sizeof(jssrcnote),
                       &cx->scriptStackQuota);
    js_InitCodeGenerator(cx, &funcg, &pc, &codePool, &notePool,
                         pc.tokenStream.lineno);
    funcg.treeContext.flags |= TCF_IN_FUNCTION;
    funcg.treeContext.u.fun = fun;

    /*
     * Farble the body so that it looks like a block statement to js_EmitTree,
     * which is called beneath FunctionBody; see Statements, further below in
     * this file.  FunctionBody pushes a STMT_BLOCK record around its call to
     * Statements, so Statements will not compile each statement as it loops
     * to save JSParseNode space -- it will not compile at all, only build a
     * JSParseNode tree.
     *
     * Therefore we must fold constants, allocate try notes, and generate code
     * for this function, including a stop opcode at the end.
     */
    CURRENT_TOKEN(&pc.tokenStream).type = TOK_LC;
    pn = FunctionBody(cx, &pc.tokenStream, &funcg.treeContext);
    if (pn) {
        if (!js_MatchToken(cx, &pc.tokenStream, TOK_EOF)) {
            js_ReportCompileErrorNumber(cx, &pc.tokenStream, NULL,
                                        JSREPORT_ERROR, JSMSG_SYNTAX_ERROR);
            pn = NULL;
        } else {
            if (!js_FoldConstants(cx, pn, &funcg.treeContext) ||
                !js_EmitFunctionScript(cx, &funcg, pn)) {
                pn = NULL;
            }
        }
    }

    /* Restore saved state and release code generation arenas. */
    js_FinishCodeGenerator(cx, &funcg);
    JS_FinishArenaPool(&codePool);
    JS_FinishArenaPool(&notePool);
    js_FinishParseContext(cx, &pc);
    return pn != NULL;
}

/*
 * Parameter block types for the several Binder functions.  We use a common
 * helper function signature in order to share code among destructuring and
 * simple variable declaration parsers.  In the destructuring case, the binder
 * function is called indirectly from the variable declaration parser by way
 * of CheckDestructuring and its friends.
 */
typedef struct BindData BindData;

typedef JSBool
(*Binder)(JSContext *cx, BindData *data, JSAtom *atom, JSTreeContext *tc);

struct BindData {
    JSParseNode             *pn;                /* error source coordinate */
    JSOp                    op;                 /* prolog bytecode or nop */
    Binder                  binder;             /* binder, discriminates u */
    union {
        struct {
            uintN           overflow;
        } let;
    } u;
};

static JSBool
BindArg(JSContext *cx, JSAtom *atom, JSTreeContext *tc)
{
    const char *name;

    /*
     * Check for a duplicate parameter name, a "feature" required by ECMA-262.
     */
    JS_ASSERT(tc->flags & TCF_IN_FUNCTION);
    if (js_LookupLocal(cx, tc->u.fun, atom, NULL) != JSLOCAL_NONE) {
        name = js_AtomToPrintableString(cx, atom);
        if (!name ||
            !js_ReportCompileErrorNumber(cx, TS(tc->parseContext), NULL,
                                         JSREPORT_WARNING | JSREPORT_STRICT,
                                         JSMSG_DUPLICATE_FORMAL,
                                         name)) {
            return JS_FALSE;
        }
    }

    return js_AddLocal(cx, tc->u.fun, atom, JSLOCAL_ARG);
}

static JSBool
BindLocalVariable(JSContext *cx, JSFunction *fun, JSAtom *atom,
                  JSLocalKind localKind)
{
    JS_ASSERT(localKind == JSLOCAL_VAR || localKind == JSLOCAL_CONST);

    /*
     * Don't bind a variable with the hidden name 'arguments', per ECMA-262.
     * Instead 'var arguments' always restates the predefined property of the
     * activation objects with unhidden name 'arguments'.  Assignment to such
     * a variable must be handled specially.
     */
    if (atom == cx->runtime->atomState.argumentsAtom)
        return JS_TRUE;

    return js_AddLocal(cx, fun, atom, localKind);
}

#if JS_HAS_DESTRUCTURING
/*
 * Forward declaration to maintain top-down presentation.
 */
static JSParseNode *
DestructuringExpr(JSContext *cx, BindData *data, JSTreeContext *tc,
                  JSTokenType tt);

static JSBool
BindDestructuringArg(JSContext *cx, BindData *data, JSAtom *atom,
                     JSTreeContext *tc)
{
    JSAtomListElement *ale;
    const char *name;

    JS_ASSERT(tc->flags & TCF_IN_FUNCTION);
    ATOM_LIST_SEARCH(ale, &tc->decls, atom);
    if (!ale) {
        ale = js_IndexAtom(cx, atom, &tc->decls);
        if (!ale)
            return JS_FALSE;
        ALE_SET_JSOP(ale, data->op);
    }

    if (js_LookupLocal(cx, tc->u.fun, atom, NULL) != JSLOCAL_NONE) {
        name = js_AtomToPrintableString(cx, atom);
        if (!name ||
            !js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                         JSREPORT_WARNING | JSREPORT_STRICT,
                                         JSMSG_DUPLICATE_FORMAL,
                                         name)) {
            return JS_FALSE;
        }
    } else {
        if (!BindLocalVariable(cx, tc->u.fun, atom, JSLOCAL_VAR))
            return JS_FALSE;
    }
    return JS_TRUE;
}
#endif /* JS_HAS_DESTRUCTURING */

static JSFunction *
NewCompilerFunction(JSContext *cx, JSTreeContext *tc, JSAtom *atom,
                    uintN lambda)
{
    JSObject *parent;
    JSFunction *fun;

    JS_ASSERT((lambda & ~JSFUN_LAMBDA) == 0);
    parent = (tc->flags & TCF_IN_FUNCTION)
             ? FUN_OBJECT(tc->u.fun)
             : tc->u.scopeChain;
    fun = js_NewFunction(cx, NULL, NULL, 0, JSFUN_INTERPRETED | lambda,
                         parent, atom);
    if (fun && !(tc->flags & TCF_COMPILE_N_GO)) {
        STOBJ_CLEAR_PARENT(FUN_OBJECT(fun));
        STOBJ_CLEAR_PROTO(FUN_OBJECT(fun));
    }
    return fun;
}

static JSParseNode *
FunctionDef(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
            uintN lambda)
{
    JSOp op, prevop;
    JSParseNode *pn, *body, *result;
    JSTokenType tt;
    JSAtom *funAtom;
    JSParsedObjectBox *funpob;
    JSAtomListElement *ale;
    JSFunction *fun;
    JSTreeContext funtc;
#if JS_HAS_DESTRUCTURING
    JSParseNode *item, *list = NULL;
#endif

    /* Make a TOK_FUNCTION node. */
#if JS_HAS_GETTER_SETTER
    op = CURRENT_TOKEN(ts).t_op;
#endif
    pn = NewParseNode(cx, ts, PN_FUNC, tc);
    if (!pn)
        return NULL;
#ifdef DEBUG
    pn->pn_index = (uint32) -1;
#endif

    /* Scan the optional function name into funAtom. */
    ts->flags |= TSF_KEYWORD_IS_NAME;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_KEYWORD_IS_NAME;
    if (tt == TOK_NAME) {
        funAtom = CURRENT_TOKEN(ts).t_atom;
    } else {
        if (lambda == 0 && (cx->options & JSOPTION_ANONFUNFIX)) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_SYNTAX_ERROR);
            return NULL;
        }
        funAtom = NULL;
        js_UngetToken(ts);
    }

    /*
     * Record names for function statements in tc->decls so we know when to
     * avoid optimizing variable references that might name a function.
     */
    if (lambda == 0 && funAtom) {
        ATOM_LIST_SEARCH(ale, &tc->decls, funAtom);
        if (ale) {
            prevop = ALE_JSOP(ale);
            if (JS_HAS_STRICT_OPTION(cx) || prevop == JSOP_DEFCONST) {
                const char *name = js_AtomToPrintableString(cx, funAtom);
                if (!name ||
                    !js_ReportCompileErrorNumber(cx, ts, NULL,
                                                 (prevop != JSOP_DEFCONST)
                                                 ? JSREPORT_WARNING |
                                                   JSREPORT_STRICT
                                                 : JSREPORT_ERROR,
                                                 JSMSG_REDECLARED_VAR,
                                                 (prevop == JSOP_DEFFUN)
                                                 ? js_function_str
                                                 : (prevop == JSOP_DEFCONST)
                                                 ? js_const_str
                                                 : js_var_str,
                                                 name)) {
                    return NULL;
                }
            }
            if (!AT_TOP_LEVEL(tc) && prevop == JSOP_DEFVAR)
                tc->flags |= TCF_FUN_CLOSURE_VS_VAR;
        } else {
            ale = js_IndexAtom(cx, funAtom, &tc->decls);
            if (!ale)
                return NULL;
        }
        ALE_SET_JSOP(ale, JSOP_DEFFUN);

        /*
         * A function nested at top level inside another's body needs only a
         * local variable to bind its name to its value, and not an activation
         * object property (it might also need the activation property, if the
         * outer function contains with statements, e.g., but the stack slot
         * wins when jsemit.c's BindNameToSlot can optimize a JSOP_NAME into a
         * JSOP_GETLOCAL bytecode).
         */
        if (AT_TOP_LEVEL(tc) && (tc->flags & TCF_IN_FUNCTION)) {
            JSLocalKind localKind;

            /*
             * Define a property on the outer function so that BindNameToSlot
             * can properly optimize accesses. Note that we need a variable,
             * not an argument, for the function statement. Thus we add a
             * variable even if the parameter with the given name already
             * exists.
             */
            localKind = js_LookupLocal(cx, tc->u.fun, funAtom, NULL);
            if (localKind == JSLOCAL_NONE || localKind == JSLOCAL_ARG) {
                if (!js_AddLocal(cx, tc->u.fun, funAtom, JSLOCAL_VAR))
                    return NULL;
            }
        }
    }

    fun = NewCompilerFunction(cx, tc, funAtom, lambda);
    if (!fun)
        return NULL;

#if JS_HAS_GETTER_SETTER
    if (op != JSOP_NOP)
        fun->flags |= (op == JSOP_GETTER) ? JSPROP_GETTER : JSPROP_SETTER;
#endif

    /*
     * Create wrapping box for fun->object early to protect against a
     * last-ditch GC.
     */
    funpob = js_NewParsedObjectBox(cx, tc->parseContext, FUN_OBJECT(fun));
    if (!funpob)
        return NULL;

    /* Initialize early for possible flags mutation via DestructuringExpr. */
    TREE_CONTEXT_INIT(&funtc, tc->parseContext);
    funtc.flags |= TCF_IN_FUNCTION | (tc->flags & TCF_COMPILE_N_GO);
    funtc.u.fun = fun;

    /* Now parse formal argument list and compute fun->nargs. */
    MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_FORMAL);
    if (!js_MatchToken(cx, ts, TOK_RP)) {
        do {
            tt = js_GetToken(cx, ts);
            switch (tt) {
#if JS_HAS_DESTRUCTURING
              case TOK_LB:
              case TOK_LC:
              {
                BindData data;
                JSParseNode *lhs, *rhs;
                jsint slot;

                /*
                 * A destructuring formal parameter turns into one or more
                 * local variables initialized from properties of a single
                 * anonymous positional parameter, so here we must tweak our
                 * binder and its data.
                 */
                data.pn = NULL;
                data.op = JSOP_DEFVAR;
                data.binder = BindDestructuringArg;
                lhs = DestructuringExpr(cx, &data, &funtc, tt);
                if (!lhs)
                    return NULL;

                /*
                 * Adjust fun->nargs to count the single anonymous positional
                 * parameter that is to be destructured.
                 */
                slot = fun->nargs;
                if (!js_AddLocal(cx, fun, NULL, JSLOCAL_ARG))
                    return NULL;

                /*
                 * Synthesize a destructuring assignment from the single
                 * anonymous positional parameter into the destructuring
                 * left-hand-side expression and accumulate it in list.
                 */
                rhs = NewParseNode(cx, ts, PN_NAME, tc);
                if (!rhs)
                    return NULL;
                rhs->pn_type = TOK_NAME;
                rhs->pn_op = JSOP_GETARG;
                rhs->pn_atom = cx->runtime->atomState.emptyAtom;
                rhs->pn_slot = slot;

                item = NewBinary(cx, TOK_ASSIGN, JSOP_NOP, lhs, rhs, tc);
                if (!item)
                    return NULL;
                if (!list) {
                    list = NewParseNode(cx, ts, PN_LIST, tc);
                    if (!list)
                        return NULL;
                    list->pn_type = TOK_COMMA;
                    PN_INIT_LIST(list);
                }
                PN_APPEND(list, item);
                break;
              }
#endif /* JS_HAS_DESTRUCTURING */

              case TOK_NAME:
                if (!BindArg(cx, CURRENT_TOKEN(ts).t_atom, &funtc))
                    return NULL;
                break;

              default:
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_MISSING_FORMAL);
                return NULL;
            }
        } while (js_MatchToken(cx, ts, TOK_COMMA));

        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_FORMAL);
    }

#if JS_HAS_EXPR_CLOSURES
    ts->flags |= TSF_OPERAND;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_OPERAND;
    if (tt != TOK_LC) {
        js_UngetToken(ts);
        fun->flags |= JSFUN_EXPR_CLOSURE;
    }
#else
    MUST_MATCH_TOKEN(TOK_LC, JSMSG_CURLY_BEFORE_BODY);
#endif
    pn->pn_pos.begin = CURRENT_TOKEN(ts).pos.begin;

    body = FunctionBody(cx, ts, &funtc);
    if (!body)
        return NULL;

#if JS_HAS_EXPR_CLOSURES
    if (tt == TOK_LC)
        MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_BODY);
    else if (lambda == 0)
        js_MatchToken(cx, ts, TOK_SEMI);
#else
    MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_BODY);
#endif
    pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;

#if JS_HAS_DESTRUCTURING
    /*
     * If there were destructuring formal parameters, prepend the initializing
     * comma expression that we synthesized to body.  If the body is a lexical
     * scope node, we must make a special TOK_SEQ node, to prepend the formal
     * parameter destructuring code without bracing the decompilation of the
     * function body's lexical scope.
     */
    if (list) {
        if (body->pn_arity != PN_LIST) {
            JSParseNode *block;

            block = NewParseNode(cx, ts, PN_LIST, tc);
            if (!block)
                return NULL;
            block->pn_type = TOK_SEQ;
            block->pn_pos = body->pn_pos;
            PN_INIT_LIST_1(block, body);

            body = block;
        }

        item = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!item)
            return NULL;

        item->pn_type = TOK_SEMI;
        item->pn_pos.begin = item->pn_pos.end = body->pn_pos.begin;
        item->pn_kid = list;
        item->pn_next = body->pn_head;
        body->pn_head = item;
        if (body->pn_tail == &body->pn_head)
            body->pn_tail = &item->pn_next;
        ++body->pn_count;
    }
#endif

    /*
     * If we collected flags that indicate nested heavyweight functions, or
     * this function contains heavyweight-making statements (references to
     * __parent__ or __proto__; use of with, or eval; and assignment to 
     * arguments), flag the function as heavyweight (requiring a call object 
     * per invocation).
     */
    if (funtc.flags & TCF_FUN_HEAVYWEIGHT) {
        fun->flags |= JSFUN_HEAVYWEIGHT;
        tc->flags |= TCF_FUN_HEAVYWEIGHT;
    } else {
        /*
         * If this function is a named statement function not at top-level
         * (i.e. not a top-level function definiton or expression), then
         * our enclosing function, if any, must be heavyweight.
         *
         * The TCF_FUN_USES_NONLOCALS flag is set only by the code generator,
         * so it won't be set here.  Assert that it's not.  We have to check
         * it later, in js_EmitTree, after js_EmitFunctionScript has traversed
         * the function's body.
         */
        JS_ASSERT(!(funtc.flags & TCF_FUN_USES_NONLOCALS));
        if (lambda == 0 && funAtom && !AT_TOP_LEVEL(tc))
            tc->flags |= TCF_FUN_HEAVYWEIGHT;
    }

    result = pn;
    if (lambda != 0) {
        /*
         * ECMA ed. 3 standard: function expression, possibly anonymous.
         */
        op = funAtom ? JSOP_NAMEDFUNOBJ : JSOP_ANONFUNOBJ;
    } else if (!funAtom) {
        /*
         * If this anonymous function definition is *not* embedded within a
         * larger expression, we treat it as an expression statement, not as
         * a function declaration -- and not as a syntax error (as ECMA-262
         * Edition 3 would have it).  Backward compatibility must trump all,
         * unless JSOPTION_ANONFUNFIX is set.
         */
        result = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!result)
            return NULL;
        result->pn_type = TOK_SEMI;
        result->pn_pos = pn->pn_pos;
        result->pn_kid = pn;
        op = JSOP_ANONFUNOBJ;
    } else if (!AT_TOP_LEVEL(tc)) {
        /*
         * ECMA ed. 3 extension: a function expression statement not at the
         * top level, e.g., in a compound statement such as the "then" part
         * of an "if" statement, binds a closure only if control reaches that
         * sub-statement.
         */
        op = JSOP_DEFFUN;
    } else {
        op = JSOP_NOP;
    }

    pn->pn_funpob = funpob;
    pn->pn_op = op;
    pn->pn_body = body;
    pn->pn_flags = funtc.flags & (TCF_FUN_FLAGS | TCF_HAS_DEFXMLNS | TCF_COMPILE_N_GO);
    TREE_CONTEXT_FINISH(cx, &funtc);
    return result;
}

static JSParseNode *
FunctionStmt(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    return FunctionDef(cx, ts, tc, 0);
}

static JSParseNode *
FunctionExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    return FunctionDef(cx, ts, tc, JSFUN_LAMBDA);
}

/*
 * Parse the statements in a block, creating a TOK_LC node that lists the
 * statements' trees.  If called from block-parsing code, the caller must
 * match { before and } after.
 */
static JSParseNode *
Statements(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2, *saveBlock;
    JSTokenType tt;

    JS_CHECK_RECURSION(cx, return NULL);

    pn = NewParseNode(cx, ts, PN_LIST, tc);
    if (!pn)
        return NULL;
    saveBlock = tc->blockNode;
    tc->blockNode = pn;
    PN_INIT_LIST(pn);

    for (;;) {
        ts->flags |= TSF_OPERAND;
        tt = js_PeekToken(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        if (tt <= TOK_EOF || tt == TOK_RC) {
            if (tt == TOK_ERROR)
                return NULL;
            break;
        }
        pn2 = Statement(cx, ts, tc);
        if (!pn2) {
            if (ts->flags & TSF_EOF)
                ts->flags |= TSF_UNEXPECTED_EOF;
            return NULL;
        }

        if (pn2->pn_type == TOK_FUNCTION) {
            /*
             * PNX_FUNCDEFS notifies the emitter that the block contains top-
             * level function definitions that should be processed before the
             * rest of nodes.
             *
             * TCF_HAS_FUNCTION_STMT is for the TOK_LC case in Statement. It
             * is relevant only for function definitions not at top-level,
             * which we call function statements.
             */
            if (AT_TOP_LEVEL(tc))
                pn->pn_extra |= PNX_FUNCDEFS;
            else
                tc->flags |= TCF_HAS_FUNCTION_STMT;
        }
        PN_APPEND(pn, pn2);
    }

    /*
     * Handle the case where there was a let declaration under this block.  If
     * it replaced tc->blockNode with a new block node then we must refresh pn
     * and then restore tc->blockNode.
     */
    if (tc->blockNode != pn)
        pn = tc->blockNode;
    tc->blockNode = saveBlock;

    pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
    return pn;
}

static JSParseNode *
Condition(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_COND);
    pn = ParenExpr(cx, ts, tc, NULL, NULL);
    if (!pn)
        return NULL;
    MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_COND);

    /*
     * Check for (a = b) and warn about possible (a == b) mistype iff b's
     * operator has greater precedence than ==.
     */
    if (pn->pn_type == TOK_ASSIGN &&
        pn->pn_op == JSOP_NOP &&
        pn->pn_right->pn_type > TOK_EQOP)
    {
        if (!js_ReportCompileErrorNumber(cx, ts, NULL,
                                         JSREPORT_WARNING | JSREPORT_STRICT,
                                         JSMSG_EQUAL_AS_ASSIGN,
                                         "")) {
            return NULL;
        }
    }
    return pn;
}

static JSBool
MatchLabel(JSContext *cx, JSTokenStream *ts, JSParseNode *pn)
{
    JSAtom *label;
    JSTokenType tt;

    tt = js_PeekTokenSameLine(cx, ts);
    if (tt == TOK_ERROR)
        return JS_FALSE;
    if (tt == TOK_NAME) {
        (void) js_GetToken(cx, ts);
        label = CURRENT_TOKEN(ts).t_atom;
    } else {
        label = NULL;
    }
    pn->pn_atom = label;
    return JS_TRUE;
}

static JSBool
BindLet(JSContext *cx, BindData *data, JSAtom *atom, JSTreeContext *tc)
{
    JSObject *blockObj;
    JSScopeProperty *sprop;
    JSAtomListElement *ale;
    uintN n;

    blockObj = tc->blockChain;
    sprop = SCOPE_GET_PROPERTY(OBJ_SCOPE(blockObj), ATOM_TO_JSID(atom));
    ATOM_LIST_SEARCH(ale, &tc->decls, atom);
    if (sprop || (ale && ALE_JSOP(ale) == JSOP_DEFCONST)) {
        const char *name;

        if (sprop) {
            JS_ASSERT(sprop->flags & SPROP_HAS_SHORTID);
            JS_ASSERT((uint16)sprop->shortid < OBJ_BLOCK_COUNT(cx, blockObj));
        }

        name = js_AtomToPrintableString(cx, atom);
        if (name) {
            js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                        JSREPORT_ERROR, JSMSG_REDECLARED_VAR,
                                        (ale && ALE_JSOP(ale) == JSOP_DEFCONST)
                                        ? js_const_str
                                        : "variable",
                                        name);
        }
        return JS_FALSE;
    }

    n = OBJ_BLOCK_COUNT(cx, blockObj);
    if (n == JS_BIT(16)) {
        js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                    JSREPORT_ERROR, data->u.let.overflow);
        return JS_FALSE;
    }

    /* Use JSPROP_ENUMERATE to aid the disassembler. */
    return js_DefineNativeProperty(cx, blockObj, ATOM_TO_JSID(atom),
                                   JSVAL_VOID, NULL, NULL,
                                   JSPROP_ENUMERATE |
                                   JSPROP_PERMANENT |
                                   JSPROP_SHARED,
                                   SPROP_HAS_SHORTID, (int16) n, NULL);
}

static JSBool
BindVarOrConst(JSContext *cx, BindData *data, JSAtom *atom, JSTreeContext *tc)
{
    JSStmtInfo *stmt;
    JSAtomListElement *ale;
    JSOp op, prevop;
    const char *name;
    JSLocalKind localKind;

    stmt = js_LexicalLookup(tc, atom, NULL);
    ATOM_LIST_SEARCH(ale, &tc->decls, atom);
    op = data->op;
    if ((stmt && stmt->type != STMT_WITH) || ale) {
        prevop = ale ? ALE_JSOP(ale) : JSOP_DEFVAR;
        if (JS_HAS_STRICT_OPTION(cx)
            ? op != JSOP_DEFVAR || prevop != JSOP_DEFVAR
            : op == JSOP_DEFCONST || prevop == JSOP_DEFCONST) {
            name = js_AtomToPrintableString(cx, atom);
            if (!name ||
                !js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                             (op != JSOP_DEFCONST &&
                                              prevop != JSOP_DEFCONST)
                                             ? JSREPORT_WARNING |
                                               JSREPORT_STRICT
                                             : JSREPORT_ERROR,
                                             JSMSG_REDECLARED_VAR,
                                             (prevop == JSOP_DEFFUN)
                                             ? js_function_str
                                             : (prevop == JSOP_DEFCONST)
                                             ? js_const_str
                                             : js_var_str,
                                             name)) {
                return JS_FALSE;
            }
        }
        if (op == JSOP_DEFVAR && prevop == JSOP_DEFFUN)
            tc->flags |= TCF_FUN_CLOSURE_VS_VAR;
    }
    if (!ale) {
        ale = js_IndexAtom(cx, atom, &tc->decls);
        if (!ale)
            return JS_FALSE;
    }
    ALE_SET_JSOP(ale, op);

    if (!(tc->flags & TCF_IN_FUNCTION)) {
        /*
         * Don't lookup global variables or variables in an active frame at
         * compile time.
         */
        return JS_TRUE;
    }

    localKind = js_LookupLocal(cx, tc->u.fun, atom, NULL);
    if (localKind == JSLOCAL_NONE) {
        /*
         * Property not found in current variable scope: we have not seen this
         * variable before.  Define a new local variable by adding a property
         * to the function's scope, allocating one slot in the function's vars
         * frame. Any locals declared in with statement bodies are handled at
         * runtime, by script prolog JSOP_DEFVAR opcodes generated for
         * slot-less vars.
         */
        localKind = (data->op == JSOP_DEFCONST) ? JSLOCAL_CONST : JSLOCAL_VAR;
        if (!js_InWithStatement(tc) &&
            !BindLocalVariable(cx, tc->u.fun, atom, localKind)) {
            return JS_FALSE;
        }
    } else if (localKind == JSLOCAL_ARG) {
        name = js_AtomToPrintableString(cx, atom);
        if (!name)
            return JS_FALSE;

        if (op == JSOP_DEFCONST) {
            js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                        JSREPORT_ERROR, JSMSG_REDECLARED_PARAM,
                                        name);
            return JS_FALSE;
        }
        if (!js_ReportCompileErrorNumber(cx, TS(tc->parseContext), data->pn,
                                         JSREPORT_WARNING | JSREPORT_STRICT,
                                         JSMSG_VAR_HIDES_ARG, name)) {
            return JS_FALSE;
        }
    } else {
        /* Not an argument, must be a redeclared local var. */
        JS_ASSERT(localKind == JSLOCAL_VAR || localKind == JSLOCAL_CONST);
    }
    return JS_TRUE;
}

static JSBool
MakeSetCall(JSContext *cx, JSParseNode *pn, JSTreeContext *tc, uintN msg)
{
    JSParseNode *pn2;

    JS_ASSERT(pn->pn_arity == PN_LIST);
    JS_ASSERT(pn->pn_op == JSOP_CALL || pn->pn_op == JSOP_EVAL || pn->pn_op == JSOP_APPLY);
    pn2 = pn->pn_head;
    if (pn2->pn_type == TOK_FUNCTION && (pn2->pn_flags & TCF_GENEXP_LAMBDA)) {
        js_ReportCompileErrorNumber(cx, TS(tc->parseContext), pn,
                                    JSREPORT_ERROR, msg);
        return JS_FALSE;
    }
    pn->pn_op = JSOP_SETCALL;
    return JS_TRUE;
}

#if JS_HAS_DESTRUCTURING

static JSBool
BindDestructuringVar(JSContext *cx, BindData *data, JSParseNode *pn,
                     JSTreeContext *tc)
{
    JSAtom *atom;

    /*
     * Destructuring is a form of assignment, so just as for an initialized
     * simple variable, we must check for assignment to 'arguments' and flag
     * the enclosing function (if any) as heavyweight.
     */
    JS_ASSERT(pn->pn_type == TOK_NAME);
    atom = pn->pn_atom;
    if (atom == cx->runtime->atomState.argumentsAtom)
        tc->flags |= TCF_FUN_HEAVYWEIGHT;

    data->pn = pn;
    if (!data->binder(cx, data, atom, tc))
        return JS_FALSE;
    data->pn = NULL;

    /*
     * Select the appropriate name-setting opcode, which may be specialized
     * further for local variable and argument slot optimizations.  At this
     * point, we can't select the optimal final opcode, yet we must preserve
     * the CONST bit and convey "set", not "get".
     */
    if (data->op == JSOP_DEFCONST) {
        pn->pn_op = JSOP_SETCONST;
        pn->pn_const = JS_TRUE;
    } else {
        pn->pn_op = JSOP_SETNAME;
        pn->pn_const = JS_FALSE;
    }
    return JS_TRUE;
}

/*
 * Here, we are destructuring {... P: Q, ...} = R, where P is any id, Q is any
 * LHS expression except a destructuring initialiser, and R is on the stack.
 * Because R is already evaluated, the usual LHS-specialized bytecodes won't
 * work.  After pushing R[P] we need to evaluate Q's "reference base" QB and
 * then push its property name QN.  At this point the stack looks like
 *
 *   [... R, R[P], QB, QN]
 *
 * We need to set QB[QN] = R[P].  This is a job for JSOP_ENUMELEM, which takes
 * its operands with left-hand side above right-hand side:
 *
 *   [rval, lval, xval]
 *
 * and pops all three values, setting lval[xval] = rval.  But we cannot select
 * JSOP_ENUMELEM yet, because the LHS may turn out to be an arg or local var,
 * which can be optimized further.  So we select JSOP_SETNAME.
 */
static JSBool
BindDestructuringLHS(JSContext *cx, JSParseNode *pn, JSTreeContext *tc)
{
    while (pn->pn_type == TOK_RP)
        pn = pn->pn_kid;

    switch (pn->pn_type) {
      case TOK_NAME:
        if (pn->pn_atom == cx->runtime->atomState.argumentsAtom)
            tc->flags |= TCF_FUN_HEAVYWEIGHT;
        /* FALL THROUGH */
      case TOK_DOT:
      case TOK_LB:
        pn->pn_op = JSOP_SETNAME;
        break;

#if JS_HAS_LVALUE_RETURN
      case TOK_LP:
        if (!MakeSetCall(cx, pn, tc, JSMSG_BAD_LEFTSIDE_OF_ASS))
            return JS_FALSE;
        break;
#endif

#if JS_HAS_XML_SUPPORT
      case TOK_UNARYOP:
        if (pn->pn_op == JSOP_XMLNAME) {
            pn->pn_op = JSOP_BINDXMLNAME;
            break;
        }
        /* FALL THROUGH */
#endif

      default:
        js_ReportCompileErrorNumber(cx, TS(tc->parseContext), pn,
                                    JSREPORT_ERROR, JSMSG_BAD_LEFTSIDE_OF_ASS);
        return JS_FALSE;
    }

    return JS_TRUE;
}

typedef struct FindPropValData {
    uint32          numvars;    /* # of destructuring vars in left side */
    uint32          maxstep;    /* max # of steps searching right side */
    JSDHashTable    table;      /* hash table for O(1) right side search */
} FindPropValData;

typedef struct FindPropValEntry {
    JSDHashEntryHdr hdr;
    JSParseNode     *pnkey;
    JSParseNode     *pnval;
} FindPropValEntry;

#define ASSERT_VALID_PROPERTY_KEY(pnkey)                                      \
    JS_ASSERT((pnkey)->pn_arity == PN_NULLARY &&                              \
              ((pnkey)->pn_type == TOK_NUMBER ||                              \
               (pnkey)->pn_type == TOK_STRING ||                              \
               (pnkey)->pn_type == TOK_NAME))

static JSDHashNumber
HashFindPropValKey(JSDHashTable *table, const void *key)
{
    const JSParseNode *pnkey = (const JSParseNode *)key;

    ASSERT_VALID_PROPERTY_KEY(pnkey);
    return (pnkey->pn_type == TOK_NUMBER)
           ? (JSDHashNumber) (JSDOUBLE_HI32(pnkey->pn_dval) ^
                              JSDOUBLE_LO32(pnkey->pn_dval))
           : ATOM_HASH(pnkey->pn_atom);
}

static JSBool
MatchFindPropValEntry(JSDHashTable *table,
                      const JSDHashEntryHdr *entry,
                      const void *key)
{
    const FindPropValEntry *fpve = (const FindPropValEntry *)entry;
    const JSParseNode *pnkey = (const JSParseNode *)key;

    ASSERT_VALID_PROPERTY_KEY(pnkey);
    return pnkey->pn_type == fpve->pnkey->pn_type &&
           ((pnkey->pn_type == TOK_NUMBER)
            ? pnkey->pn_dval == fpve->pnkey->pn_dval
            : pnkey->pn_atom == fpve->pnkey->pn_atom);
}

static const JSDHashTableOps FindPropValOps = {
    JS_DHashAllocTable,
    JS_DHashFreeTable,
    HashFindPropValKey,
    MatchFindPropValEntry,
    JS_DHashMoveEntryStub,
    JS_DHashClearEntryStub,
    JS_DHashFinalizeStub,
    NULL
};

#define STEP_HASH_THRESHOLD     10
#define BIG_DESTRUCTURING        5
#define BIG_OBJECT_INIT         20

static JSParseNode *
FindPropertyValue(JSParseNode *pn, JSParseNode *pnid, FindPropValData *data)
{
    FindPropValEntry *entry;
    JSParseNode *pnhit, *pnhead, *pnprop, *pnkey;
    uint32 step;

    /* If we have a hash table, use it as the sole source of truth. */
    if (data->table.ops) {
        entry = (FindPropValEntry *)
                JS_DHashTableOperate(&data->table, pnid, JS_DHASH_LOOKUP);
        return JS_DHASH_ENTRY_IS_BUSY(&entry->hdr) ? entry->pnval : NULL;
    }

    /* If pn is not an object initialiser node, we can't do anything here. */
    if (pn->pn_type != TOK_RC)
        return NULL;

    /*
     * We must search all the way through pn's list, to handle the case of an
     * id duplicated for two or more property initialisers.
     */
    pnhit = NULL;
    step = 0;
    ASSERT_VALID_PROPERTY_KEY(pnid);
    pnhead = pn->pn_head;
    if (pnhead && pnhead->pn_type == TOK_DEFSHARP)
        pnhead = pnhead->pn_next;
    if (pnid->pn_type == TOK_NUMBER) {
        for (pnprop = pnhead; pnprop; pnprop = pnprop->pn_next) {
            JS_ASSERT(pnprop->pn_type == TOK_COLON);
            if (pnprop->pn_op == JSOP_NOP) {
                pnkey = pnprop->pn_left;
                ASSERT_VALID_PROPERTY_KEY(pnkey);
                if (pnkey->pn_type == TOK_NUMBER &&
                    pnkey->pn_dval == pnid->pn_dval) {
                    pnhit = pnprop;
                }
                ++step;
            }
        }
    } else {
        for (pnprop = pnhead; pnprop; pnprop = pnprop->pn_next) {
            JS_ASSERT(pnprop->pn_type == TOK_COLON);
            if (pnprop->pn_op == JSOP_NOP) {
                pnkey = pnprop->pn_left;
                ASSERT_VALID_PROPERTY_KEY(pnkey);
                if (pnkey->pn_type == pnid->pn_type &&
                    pnkey->pn_atom == pnid->pn_atom) {
                    pnhit = pnprop;
                }
                ++step;
            }
        }
    }
    if (!pnhit)
        return NULL;

    /* Hit via full search -- see whether it's time to create the hash table. */
    JS_ASSERT(!data->table.ops);
    if (step > data->maxstep) {
        data->maxstep = step;
        if (step >= STEP_HASH_THRESHOLD &&
            data->numvars >= BIG_DESTRUCTURING &&
            pn->pn_count >= BIG_OBJECT_INIT &&
            JS_DHashTableInit(&data->table, &FindPropValOps, pn,
                              sizeof(FindPropValEntry),
                              JS_DHASH_DEFAULT_CAPACITY(pn->pn_count)))
        {
            for (pn = pnhead; pn; pn = pn->pn_next) {
                JS_ASSERT(pnprop->pn_type == TOK_COLON);
                ASSERT_VALID_PROPERTY_KEY(pn->pn_left);
                entry = (FindPropValEntry *)
                        JS_DHashTableOperate(&data->table, pn->pn_left,
                                             JS_DHASH_ADD);
                entry->pnval = pn->pn_right;
            }
        }
    }
    return pnhit->pn_right;
}

/*
 * If data is null, the caller is AssignExpr and instead of binding variables,
 * we specialize lvalues in the propery value positions of the left-hand side.
 * If right is null, just check for well-formed lvalues.
 */
static JSBool
CheckDestructuring(JSContext *cx, BindData *data,
                   JSParseNode *left, JSParseNode *right,
                   JSTreeContext *tc)
{
    JSBool ok;
    FindPropValData fpvd;
    JSParseNode *lhs, *rhs, *pn, *pn2;

    if (left->pn_type == TOK_ARRAYCOMP) {
        js_ReportCompileErrorNumber(cx, TS(tc->parseContext), left,
                                    JSREPORT_ERROR, JSMSG_ARRAY_COMP_LEFTSIDE);
        return JS_FALSE;
    }

#if JS_HAS_DESTRUCTURING_SHORTHAND
    if (right && right->pn_arity == PN_LIST && (right->pn_extra & PNX_SHORTHAND)) {
        js_ReportCompileErrorNumber(cx, TS(tc->parseContext), right,
                                    JSREPORT_ERROR, JSMSG_BAD_OBJECT_INIT);
        return JS_FALSE;
    }
#endif

    fpvd.table.ops = NULL;
    lhs = left->pn_head;
    if (lhs && lhs->pn_type == TOK_DEFSHARP) {
        pn = lhs;
        goto no_var_name;
    }

    if (left->pn_type == TOK_RB) {
        rhs = (right && right->pn_type == left->pn_type)
              ? right->pn_head
              : NULL;

        while (lhs) {
            pn = lhs, pn2 = rhs;
            if (!data) {
                /* Skip parenthesization if not in a variable declaration. */
                while (pn->pn_type == TOK_RP)
                    pn = pn->pn_kid;
                if (pn2) {
                    while (pn2->pn_type == TOK_RP)
                        pn2 = pn2->pn_kid;
                }
            }

            /* Nullary comma is an elision; binary comma is an expression.*/
            if (pn->pn_type != TOK_COMMA || pn->pn_arity != PN_NULLARY) {
                if (pn->pn_type == TOK_RB || pn->pn_type == TOK_RC) {
                    ok = CheckDestructuring(cx, data, pn, pn2, tc);
                } else {
                    if (data) {
                        if (pn->pn_type != TOK_NAME)
                            goto no_var_name;

                        ok = BindDestructuringVar(cx, data, pn, tc);
                    } else {
                        ok = BindDestructuringLHS(cx, pn, tc);
                    }
                }
                if (!ok)
                    goto out;
            }

            lhs = lhs->pn_next;
            if (rhs)
                rhs = rhs->pn_next;
        }
    } else {
        JS_ASSERT(left->pn_type == TOK_RC);
        fpvd.numvars = left->pn_count;
        fpvd.maxstep = 0;
        rhs = NULL;

        while (lhs) {
            JS_ASSERT(lhs->pn_type == TOK_COLON);
            pn = lhs->pn_right;
            if (!data) {
                /* Skip parenthesization if not in a variable declaration. */
                while (pn->pn_type == TOK_RP)
                    pn = pn->pn_kid;
            }

            if (pn->pn_type == TOK_RB || pn->pn_type == TOK_RC) {
                if (right) {
                    rhs = FindPropertyValue(right, lhs->pn_left, &fpvd);
                    if (rhs && !data) {
                        while (rhs->pn_type == TOK_RP)
                            rhs = rhs->pn_kid;
                    }
                }

                ok = CheckDestructuring(cx, data, pn, rhs, tc);
            } else if (data) {
                if (pn->pn_type != TOK_NAME)
                    goto no_var_name;

                ok = BindDestructuringVar(cx, data, pn, tc);
            } else {
                ok = BindDestructuringLHS(cx, pn, tc);
            }
            if (!ok)
                goto out;

            lhs = lhs->pn_next;
        }
    }

    /*
     * The catch/finally handler implementation in the interpreter assumes
     * that any operation that introduces a new scope (like a "let" or "with"
     * block) increases the stack depth. This way, it is possible to restore
     * the scope chain based on stack depth of the handler alone. "let" with
     * an empty destructuring pattern like in
     *
     *   let [] = 1;
     *
     * would violate this assumption as the there would be no let locals to
     * store on the stack. To satisfy it we add an empty property to such
     * blocks so that OBJ_BLOCK_COUNT(cx, blockObj), which gives the number of
     * slots, would be always positive.
     *
     * Note that we add such a property even if the block has locals due to
     * later let declarations in it. We optimize for code simplicity here,
     * not the fastest runtime performance with empty [] or {}.
     */
    if (data &&
        data->binder == BindLet &&
        OBJ_BLOCK_COUNT(cx, tc->blockChain) == 0) {
        ok = js_DefineNativeProperty(cx, tc->blockChain,
                                     ATOM_TO_JSID(cx->runtime->
                                                  atomState.emptyAtom),
                                     JSVAL_VOID, NULL, NULL,
                                     JSPROP_ENUMERATE |
                                     JSPROP_PERMANENT |
                                     JSPROP_SHARED,
                                     SPROP_HAS_SHORTID, 0, NULL);
        if (!ok)
            goto out;
    }

    ok = JS_TRUE;

  out:
    if (fpvd.table.ops)
        JS_DHashTableFinish(&fpvd.table);
    return ok;

  no_var_name:
    js_ReportCompileErrorNumber(cx, TS(tc->parseContext), pn, JSREPORT_ERROR,
                                JSMSG_NO_VARIABLE_NAME);
    ok = JS_FALSE;
    goto out;
}

static JSParseNode *
DestructuringExpr(JSContext *cx, BindData *data, JSTreeContext *tc,
                  JSTokenType tt)
{
    JSParseNode *pn;

    pn = PrimaryExpr(cx, TS(tc->parseContext), tc, tt, JS_FALSE);
    if (!pn)
        return NULL;
    if (!CheckDestructuring(cx, data, pn, NULL, tc))
        return NULL;
    return pn;
}

// Currently used only #if JS_HAS_DESTRUCTURING, in Statement's TOK_FOR case.
static JSParseNode *
CloneParseTree(JSContext *cx, JSParseNode *opn, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2, *opn2;

    pn = NewOrRecycledNode(cx, tc);
    if (!pn)
        return NULL;
    pn->pn_type = opn->pn_type;
    pn->pn_pos = opn->pn_pos;
    pn->pn_op = opn->pn_op;
    pn->pn_arity = opn->pn_arity;

    switch (pn->pn_arity) {
#define NULLCHECK(e)    JS_BEGIN_MACRO if (!(e)) return NULL; JS_END_MACRO

      case PN_FUNC:
        NULLCHECK(pn->pn_funpob =
                  js_NewParsedObjectBox(cx, tc->parseContext, opn->pn_funpob->object));
        NULLCHECK(pn->pn_body = CloneParseTree(cx, opn->pn_body, tc));
        pn->pn_flags = opn->pn_flags;
        pn->pn_index = opn->pn_index;
        break;

      case PN_LIST:
        PN_INIT_LIST(pn);
        for (opn2 = opn->pn_head; opn2; opn2 = opn2->pn_next) {
            NULLCHECK(pn2 = CloneParseTree(cx, opn2, tc));
            PN_APPEND(pn, pn2);
        }
        pn->pn_extra = opn->pn_extra;
        break;

      case PN_TERNARY:
        NULLCHECK(pn->pn_kid1 = CloneParseTree(cx, opn->pn_kid1, tc));
        NULLCHECK(pn->pn_kid2 = CloneParseTree(cx, opn->pn_kid2, tc));
        NULLCHECK(pn->pn_kid3 = CloneParseTree(cx, opn->pn_kid3, tc));
        break;

      case PN_BINARY:
        NULLCHECK(pn->pn_left = CloneParseTree(cx, opn->pn_left, tc));
        if (opn->pn_right != opn->pn_left)
            NULLCHECK(pn->pn_right = CloneParseTree(cx, opn->pn_right, tc));
        else
            pn->pn_right = pn->pn_left;
        pn->pn_val = opn->pn_val;
        pn->pn_iflags = opn->pn_iflags;
        break;

      case PN_UNARY:
        NULLCHECK(pn->pn_kid = CloneParseTree(cx, opn->pn_kid, tc));
        pn->pn_num = opn->pn_num;
        pn->pn_hidden = opn->pn_hidden;
        break;

      case PN_NAME:
        // PN_NAME could mean several arms in pn_u, so copy the whole thing.
        pn->pn_u = opn->pn_u;
        if (opn->pn_expr)
            NULLCHECK(pn->pn_expr = CloneParseTree(cx, opn->pn_expr, tc));
        break;

      case PN_NULLARY:
        // Even PN_NULLARY may have data (apair for E4X -- what a botch).
        pn->pn_u = opn->pn_u;
        break;

#undef NULLCHECK
    }
    return pn;
}

#endif /* JS_HAS_DESTRUCTURING */

extern const char js_with_statement_str[];

static JSParseNode *
ContainsStmt(JSParseNode *pn, JSTokenType tt)
{
    JSParseNode *pn2, *pnt;

    if (!pn)
        return NULL;
    if (pn->pn_type == tt)
        return pn;
    switch (pn->pn_arity) {
      case PN_LIST:
        for (pn2 = pn->pn_head; pn2; pn2 = pn2->pn_next) {
            pnt = ContainsStmt(pn2, tt);
            if (pnt)
                return pnt;
        }
        break;
      case PN_TERNARY:
        pnt = ContainsStmt(pn->pn_kid1, tt);
        if (pnt)
            return pnt;
        pnt = ContainsStmt(pn->pn_kid2, tt);
        if (pnt)
            return pnt;
        return ContainsStmt(pn->pn_kid3, tt);
      case PN_BINARY:
        /*
         * Limit recursion if pn is a binary expression, which can't contain a
         * var statement.
         */
        if (pn->pn_op != JSOP_NOP)
            return NULL;
        pnt = ContainsStmt(pn->pn_left, tt);
        if (pnt)
            return pnt;
        return ContainsStmt(pn->pn_right, tt);
      case PN_UNARY:
        if (pn->pn_op != JSOP_NOP)
            return NULL;
        return ContainsStmt(pn->pn_kid, tt);
      case PN_NAME:
        return ContainsStmt(pn->pn_expr, tt);
      default:;
    }
    return NULL;
}

static JSParseNode *
ReturnOrYield(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
              JSParser operandParser)
{
    JSTokenType tt, tt2;
    JSParseNode *pn, *pn2;

    tt = CURRENT_TOKEN(ts).type;
    if (tt == TOK_RETURN && !(tc->flags & TCF_IN_FUNCTION)) {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_RETURN_OR_YIELD, js_return_str);
        return NULL;
    }

    pn = NewParseNode(cx, ts, PN_UNARY, tc);
    if (!pn)
        return NULL;

#if JS_HAS_GENERATORS
    if (tt == TOK_YIELD)
        tc->flags |= TCF_FUN_IS_GENERATOR;
#endif

    /* This is ugly, but we don't want to require a semicolon. */
    ts->flags |= TSF_OPERAND;
    tt2 = js_PeekTokenSameLine(cx, ts);
    ts->flags &= ~TSF_OPERAND;
    if (tt2 == TOK_ERROR)
        return NULL;

    if (tt2 != TOK_EOF && tt2 != TOK_EOL && tt2 != TOK_SEMI && tt2 != TOK_RC
#if JS_HAS_GENERATORS
        && (tt != TOK_YIELD ||
            (tt2 != tt && tt2 != TOK_RB && tt2 != TOK_RP &&
             tt2 != TOK_COLON && tt2 != TOK_COMMA))
#endif
        ) {
        pn2 = operandParser(cx, ts, tc);
        if (!pn2)
            return NULL;
#if JS_HAS_GENERATORS
        if (tt == TOK_RETURN)
#endif
            tc->flags |= TCF_RETURN_EXPR;
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_kid = pn2;
    } else {
#if JS_HAS_GENERATORS
        if (tt == TOK_RETURN)
#endif
            tc->flags |= TCF_RETURN_VOID;
    }

    if ((~tc->flags & (TCF_RETURN_EXPR | TCF_FUN_IS_GENERATOR)) == 0) {
        /* As in Python (see PEP-255), disallow return v; in generators. */
        ReportBadReturn(cx, tc, JSREPORT_ERROR,
                        JSMSG_BAD_GENERATOR_RETURN,
                        JSMSG_BAD_ANON_GENERATOR_RETURN);
        return NULL;
    }

    if (JS_HAS_STRICT_OPTION(cx) &&
        (~tc->flags & (TCF_RETURN_EXPR | TCF_RETURN_VOID)) == 0 &&
        !ReportBadReturn(cx, tc, JSREPORT_WARNING | JSREPORT_STRICT,
                         JSMSG_NO_RETURN_VALUE,
                         JSMSG_ANON_NO_RETURN_VALUE)) {
        return NULL;
    }

    return pn;
}

static JSParseNode *
PushLexicalScope(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                 JSStmtInfo *stmtInfo)
{
    JSParseNode *pn;
    JSObject *obj;
    JSParsedObjectBox *blockpob;

    pn = NewParseNode(cx, ts, PN_NAME, tc);
    if (!pn)
        return NULL;

    obj = js_NewBlockObject(cx);
    if (!obj)
        return NULL;

    blockpob = js_NewParsedObjectBox(cx, tc->parseContext, obj);
    if (!blockpob)
        return NULL;

    js_PushBlockScope(tc, stmtInfo, obj, -1);
    pn->pn_type = TOK_LEXICALSCOPE;
    pn->pn_op = JSOP_LEAVEBLOCK;
    pn->pn_pob = blockpob;
    pn->pn_slot = -1;
    return pn;
}

#if JS_HAS_BLOCK_SCOPE

static JSParseNode *
LetBlock(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc, JSBool statement)
{
    JSParseNode *pn, *pnblock, *pnlet;
    JSStmtInfo stmtInfo;

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_LET);

    /* Create the let binary node. */
    pnlet = NewParseNode(cx, ts, PN_BINARY, tc);
    if (!pnlet)
        return NULL;

    MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_LET);

    /* This is a let block or expression of the form: let (a, b, c) .... */
    pnblock = PushLexicalScope(cx, ts, tc, &stmtInfo);
    if (!pnblock)
        return NULL;
    pn = pnblock;
    pn->pn_expr = pnlet;

    pnlet->pn_left = Variables(cx, ts, tc);
    if (!pnlet->pn_left)
        return NULL;
    pnlet->pn_left->pn_extra = PNX_POPVAR;

    MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_LET);

    ts->flags |= TSF_OPERAND;
    if (statement && !js_MatchToken(cx, ts, TOK_LC)) {
        /*
         * If this is really an expression in let statement guise, then we
         * need to wrap the TOK_LET node in a TOK_SEMI node so that we pop
         * the return value of the expression.
         */
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_SEMI;
        pn->pn_num = -1;
        pn->pn_kid = pnblock;

        statement = JS_FALSE;
    }
    ts->flags &= ~TSF_OPERAND;

    if (statement) {
        pnlet->pn_right = Statements(cx, ts, tc);
        if (!pnlet->pn_right)
            return NULL;
        MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_LET);
    } else {
        /*
         * Change pnblock's opcode to the variant that propagates the last
         * result down after popping the block, and clear statement.
         */
        pnblock->pn_op = JSOP_LEAVEBLOCKEXPR;
        pnlet->pn_right = AssignExpr(cx, ts, tc);
        if (!pnlet->pn_right)
            return NULL;
    }

    js_PopStatement(tc);
    return pn;
}

#endif /* JS_HAS_BLOCK_SCOPE */

static JSParseNode *
Statement(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSTokenType tt;
    JSParseNode *pn, *pn1, *pn2, *pn3, *pn4;
    JSStmtInfo stmtInfo, *stmt, *stmt2;
    JSAtom *label;

    JS_CHECK_RECURSION(cx, return NULL);

    ts->flags |= TSF_OPERAND;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_OPERAND;

#if JS_HAS_GETTER_SETTER
    if (tt == TOK_NAME) {
        tt = CheckGetterOrSetter(cx, ts, TOK_FUNCTION);
        if (tt == TOK_ERROR)
            return NULL;
    }
#endif

    switch (tt) {
      case TOK_FUNCTION:
#if JS_HAS_XML_SUPPORT
        ts->flags |= TSF_KEYWORD_IS_NAME;
        tt = js_PeekToken(cx, ts);
        ts->flags &= ~TSF_KEYWORD_IS_NAME;
        if (tt == TOK_DBLCOLON)
            goto expression;
#endif
        return FunctionStmt(cx, ts, tc);

      case TOK_IF:
        /* An IF node has three kids: condition, then, and optional else. */
        pn = NewParseNode(cx, ts, PN_TERNARY, tc);
        if (!pn)
            return NULL;
        pn1 = Condition(cx, ts, tc);
        if (!pn1)
            return NULL;
        js_PushStatement(tc, &stmtInfo, STMT_IF, -1);
        pn2 = Statement(cx, ts, tc);
        if (!pn2)
            return NULL;
        ts->flags |= TSF_OPERAND;
        if (js_MatchToken(cx, ts, TOK_ELSE)) {
            ts->flags &= ~TSF_OPERAND;
            stmtInfo.type = STMT_ELSE;
            pn3 = Statement(cx, ts, tc);
            if (!pn3)
                return NULL;
            pn->pn_pos.end = pn3->pn_pos.end;
        } else {
            ts->flags &= ~TSF_OPERAND;
            pn3 = NULL;
            pn->pn_pos.end = pn2->pn_pos.end;
        }
        js_PopStatement(tc);
        pn->pn_kid1 = pn1;
        pn->pn_kid2 = pn2;
        pn->pn_kid3 = pn3;
        return pn;

      case TOK_SWITCH:
      {
        JSParseNode *pn5, *saveBlock;
        JSBool seenDefault = JS_FALSE;

        pn = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn)
            return NULL;
        MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_SWITCH);

        /* pn1 points to the switch's discriminant. */
        pn1 = ParenExpr(cx, ts, tc, NULL, NULL);
        if (!pn1)
            return NULL;

        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_SWITCH);
        MUST_MATCH_TOKEN(TOK_LC, JSMSG_CURLY_BEFORE_SWITCH);

        /* pn2 is a list of case nodes. The default case has pn_left == NULL */
        pn2 = NewParseNode(cx, ts, PN_LIST, tc);
        if (!pn2)
            return NULL;
        saveBlock = tc->blockNode;
        tc->blockNode = pn2;
        PN_INIT_LIST(pn2);

        js_PushStatement(tc, &stmtInfo, STMT_SWITCH, -1);

        while ((tt = js_GetToken(cx, ts)) != TOK_RC) {
            switch (tt) {
              case TOK_DEFAULT:
                if (seenDefault) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_TOO_MANY_DEFAULTS);
                    return NULL;
                }
                seenDefault = JS_TRUE;
                /* FALL THROUGH */

              case TOK_CASE:
                pn3 = NewParseNode(cx, ts, PN_BINARY, tc);
                if (!pn3)
                    return NULL;
                if (tt == TOK_CASE) {
                    pn3->pn_left = Expr(cx, ts, tc);
                    if (!pn3->pn_left)
                        return NULL;
                }
                PN_APPEND(pn2, pn3);
                if (pn2->pn_count == JS_BIT(16)) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_TOO_MANY_CASES);
                    return NULL;
                }
                break;

              case TOK_ERROR:
                return NULL;

              default:
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_SWITCH);
                return NULL;
            }
            MUST_MATCH_TOKEN(TOK_COLON, JSMSG_COLON_AFTER_CASE);

            pn4 = NewParseNode(cx, ts, PN_LIST, tc);
            if (!pn4)
                return NULL;
            pn4->pn_type = TOK_LC;
            PN_INIT_LIST(pn4);
            ts->flags |= TSF_OPERAND;
            while ((tt = js_PeekToken(cx, ts)) != TOK_RC &&
                   tt != TOK_CASE && tt != TOK_DEFAULT) {
                ts->flags &= ~TSF_OPERAND;
                if (tt == TOK_ERROR)
                    return NULL;
                pn5 = Statement(cx, ts, tc);
                if (!pn5)
                    return NULL;
                pn4->pn_pos.end = pn5->pn_pos.end;
                PN_APPEND(pn4, pn5);
                ts->flags |= TSF_OPERAND;
            }
            ts->flags &= ~TSF_OPERAND;

            /* Fix the PN_LIST so it doesn't begin at the TOK_COLON. */
            if (pn4->pn_head)
                pn4->pn_pos.begin = pn4->pn_head->pn_pos.begin;
            pn3->pn_pos.end = pn4->pn_pos.end;
            pn3->pn_right = pn4;
        }

        /*
         * Handle the case where there was a let declaration in any case in
         * the switch body, but not within an inner block.  If it replaced
         * tc->blockNode with a new block node then we must refresh pn2 and
         * then restore tc->blockNode.
         */
        if (tc->blockNode != pn2)
            pn2 = tc->blockNode;
        tc->blockNode = saveBlock;
        js_PopStatement(tc);

        pn->pn_pos.end = pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        pn->pn_left = pn1;
        pn->pn_right = pn2;
        return pn;
      }

      case TOK_WHILE:
        pn = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn)
            return NULL;
        js_PushStatement(tc, &stmtInfo, STMT_WHILE_LOOP, -1);
        pn2 = Condition(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_left = pn2;
        pn2 = Statement(cx, ts, tc);
        if (!pn2)
            return NULL;
        js_PopStatement(tc);
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_right = pn2;
        return pn;

      case TOK_DO:
        pn = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn)
            return NULL;
        js_PushStatement(tc, &stmtInfo, STMT_DO_LOOP, -1);
        pn2 = Statement(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_left = pn2;
        MUST_MATCH_TOKEN(TOK_WHILE, JSMSG_WHILE_AFTER_DO);
        pn2 = Condition(cx, ts, tc);
        if (!pn2)
            return NULL;
        js_PopStatement(tc);
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_right = pn2;
        if (JSVERSION_NUMBER(cx) != JSVERSION_ECMA_3) {
            /*
             * All legacy and extended versions must do automatic semicolon
             * insertion after do-while.  See the testcase and discussion in
             * http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
             */
            (void) js_MatchToken(cx, ts, TOK_SEMI);
            return pn;
        }
        break;

      case TOK_FOR:
      {
        JSParseNode *pnseq = NULL;
#if JS_HAS_BLOCK_SCOPE
        JSParseNode *pnlet = NULL;
        JSStmtInfo blockInfo;
#endif

        /* A FOR node is binary, left is loop control and right is the body. */
        pn = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn)
            return NULL;
        js_PushStatement(tc, &stmtInfo, STMT_FOR_LOOP, -1);

        pn->pn_op = JSOP_ITER;
        pn->pn_iflags = 0;
        if (js_MatchToken(cx, ts, TOK_NAME)) {
            if (CURRENT_TOKEN(ts).t_atom == cx->runtime->atomState.eachAtom)
                pn->pn_iflags = JSITER_FOREACH;
            else
                js_UngetToken(ts);
        }

        MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_AFTER_FOR);
        ts->flags |= TSF_OPERAND;
        tt = js_PeekToken(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        if (tt == TOK_SEMI) {
            if (pn->pn_iflags & JSITER_FOREACH)
                goto bad_for_each;

            /* No initializer -- set first kid of left sub-node to null. */
            pn1 = NULL;
        } else {
            /*
             * Set pn1 to a var list or an initializing expression.
             *
             * Set the TCF_IN_FOR_INIT flag during parsing of the first clause
             * of the for statement.  This flag will be used by the RelExpr
             * production; if it is set, then the 'in' keyword will not be
             * recognized as an operator, leaving it available to be parsed as
             * part of a for/in loop.
             *
             * A side effect of this restriction is that (unparenthesized)
             * expressions involving an 'in' operator are illegal in the init
             * clause of an ordinary for loop.
             */
            tc->flags |= TCF_IN_FOR_INIT;
            if (tt == TOK_VAR) {
                (void) js_GetToken(cx, ts);
                pn1 = Variables(cx, ts, tc);
#if JS_HAS_BLOCK_SCOPE
            } else if (tt == TOK_LET) {
                (void) js_GetToken(cx, ts);
                if (js_PeekToken(cx, ts) == TOK_LP) {
                    pn1 = LetBlock(cx, ts, tc, JS_FALSE);
                    tt = TOK_LEXICALSCOPE;
                } else {
                    pnlet = PushLexicalScope(cx, ts, tc, &blockInfo);
                    if (!pnlet)
                        return NULL;
                    blockInfo.flags |= SIF_FOR_BLOCK;
                    pn1 = Variables(cx, ts, tc);
                }
#endif
            } else {
                pn1 = Expr(cx, ts, tc);
                if (pn1) {
                    while (pn1->pn_type == TOK_RP)
                        pn1 = pn1->pn_kid;
                }
            }
            tc->flags &= ~TCF_IN_FOR_INIT;
            if (!pn1)
                return NULL;
        }

        /*
         * We can be sure that it's a for/in loop if there's still an 'in'
         * keyword here, even if JavaScript recognizes 'in' as an operator,
         * as we've excluded 'in' from being parsed in RelExpr by setting
         * the TCF_IN_FOR_INIT flag in our JSTreeContext.
         */
        if (pn1 && js_MatchToken(cx, ts, TOK_IN)) {
            pn->pn_iflags |= JSITER_ENUMERATE;
            stmtInfo.type = STMT_FOR_IN_LOOP;

            /* Check that the left side of the 'in' is valid. */
            JS_ASSERT(!TOKEN_TYPE_IS_DECL(tt) || pn1->pn_type == tt);
            if (TOKEN_TYPE_IS_DECL(tt)
                ? (pn1->pn_count > 1 || pn1->pn_op == JSOP_DEFCONST
#if JS_HAS_DESTRUCTURING
                   || (JSVERSION_NUMBER(cx) == JSVERSION_1_7 &&
                       pn->pn_op == JSOP_ITER &&
                       !(pn->pn_iflags & JSITER_FOREACH) &&
                       (pn1->pn_head->pn_type == TOK_RC ||
                        (pn1->pn_head->pn_type == TOK_RB &&
                         pn1->pn_head->pn_count != 2) ||
                        (pn1->pn_head->pn_type == TOK_ASSIGN &&
                         (pn1->pn_head->pn_left->pn_type != TOK_RB ||
                          pn1->pn_head->pn_left->pn_count != 2))))
#endif
                  )
                : (pn1->pn_type != TOK_NAME &&
                   pn1->pn_type != TOK_DOT &&
#if JS_HAS_DESTRUCTURING
                   ((JSVERSION_NUMBER(cx) == JSVERSION_1_7 &&
                     pn->pn_op == JSOP_ITER &&
                     !(pn->pn_iflags & JSITER_FOREACH))
                    ? (pn1->pn_type != TOK_RB || pn1->pn_count != 2)
                    : (pn1->pn_type != TOK_RB && pn1->pn_type != TOK_RC)) &&
#endif
#if JS_HAS_LVALUE_RETURN
                   pn1->pn_type != TOK_LP &&
#endif
#if JS_HAS_XML_SUPPORT
                   (pn1->pn_type != TOK_UNARYOP ||
                    pn1->pn_op != JSOP_XMLNAME) &&
#endif
                   pn1->pn_type != TOK_LB)) {
                js_ReportCompileErrorNumber(cx, ts, pn1, JSREPORT_ERROR,
                                            JSMSG_BAD_FOR_LEFTSIDE);
                return NULL;
            }

            /* pn2 points to the name or destructuring pattern on in's left. */
            pn2 = NULL;

            if (TOKEN_TYPE_IS_DECL(tt)) {
                /* Tell js_EmitTree(TOK_VAR) that pn1 is part of a for/in. */
                pn1->pn_extra |= PNX_FORINVAR;

                /*
                 * Rewrite 'for (<decl> x = i in o)' where <decl> is 'let',
                 * 'var', or 'const' to hoist the initializer or the entire
                 * decl out of the loop head. TOK_VAR is the type for both
                 * 'var' and 'const'.
                 */
                pn2 = pn1->pn_head;
                if (pn2->pn_type == TOK_NAME && pn2->pn_expr
#if JS_HAS_DESTRUCTURING
                    || pn2->pn_type == TOK_ASSIGN
#endif
                    ) {
                    pnseq = NewParseNode(cx, ts, PN_LIST, tc);
                    if (!pnseq)
                        return NULL;
                    pnseq->pn_type = TOK_SEQ;
                    pnseq->pn_pos.begin = pn->pn_pos.begin;
                    if (tt == TOK_LET) {
                        /*
                         * Hoist just the 'i' from 'for (let x = i in o)' to
                         * before the loop, glued together via pnseq.
                         */
                        pn3 = NewParseNode(cx, ts, PN_UNARY, tc);
                        if (!pn3)
                            return NULL;
                        pn3->pn_type = TOK_SEMI;
                        pn3->pn_op = JSOP_NOP;
#if JS_HAS_DESTRUCTURING
                        if (pn2->pn_type == TOK_ASSIGN) {
                            pn4 = pn2->pn_right;
                            pn2 = pn1->pn_head = pn2->pn_left;
                        } else
#endif
                        {
                            pn4 = pn2->pn_expr;
                            pn2->pn_expr = NULL;
                        }
                        pn3->pn_pos = pn4->pn_pos;
                        pn3->pn_kid = pn4;
                        PN_INIT_LIST_1(pnseq, pn3);
                    } else {
                        /*
                         * All of 'var x = i' is hoisted above 'for (x in o)',
                         * so clear PNX_FORINVAR.
                         *
                         * Request JSOP_POP here since the var is for a simple
                         * name (it is not a destructuring binding's left-hand
                         * side) and it has an initializer.
                         */
                        pn1->pn_extra &= ~PNX_FORINVAR;
                        pn1->pn_extra |= PNX_POPVAR;
                        PN_INIT_LIST_1(pnseq, pn1);

#if JS_HAS_DESTRUCTURING
                        if (pn2->pn_type == TOK_ASSIGN) {
                            pn1 = CloneParseTree(cx, pn2->pn_left, tc);
                            if (!pn1)
                                return NULL;
                        } else
#endif
                        {
                            pn1 = NewParseNode(cx, ts, PN_NAME, tc);
                            if (!pn1)
                                return NULL;
                            pn1->pn_type = TOK_NAME;
                            pn1->pn_op = JSOP_NAME;
                            pn1->pn_pos = pn2->pn_pos;
                            pn1->pn_atom = pn2->pn_atom;
                            pn1->pn_expr = NULL;
                            pn1->pn_slot = -1;
                            pn1->pn_const = pn2->pn_const;
                        }
                        pn2 = pn1;
                    }
                }
            }

            if (!pn2) {
                pn2 = pn1;
#if JS_HAS_LVALUE_RETURN
                if (pn2->pn_type == TOK_LP &&
                    !MakeSetCall(cx, pn2, tc, JSMSG_BAD_LEFTSIDE_OF_ASS)) {
                    return NULL;
                }
#endif
#if JS_HAS_XML_SUPPORT
                if (pn2->pn_type == TOK_UNARYOP)
                    pn2->pn_op = JSOP_BINDXMLNAME;
#endif
            }

            switch (pn2->pn_type) {
              case TOK_NAME:
                /* Beware 'for (arguments in ...)' with or without a 'var'. */
                if (pn2->pn_atom == cx->runtime->atomState.argumentsAtom)
                    tc->flags |= TCF_FUN_HEAVYWEIGHT;
                break;

#if JS_HAS_DESTRUCTURING
              case TOK_ASSIGN:
                pn2 = pn2->pn_left;
                JS_ASSERT(pn2->pn_type == TOK_RB || pn2->pn_type == TOK_RC);
                /* FALL THROUGH */
              case TOK_RB:
              case TOK_RC:
                /* Check for valid lvalues in var-less destructuring for-in. */
                if (pn1 == pn2 && !CheckDestructuring(cx, NULL, pn2, NULL, tc))
                    return NULL;

                if (JSVERSION_NUMBER(cx) == JSVERSION_1_7) {
                    /*
                     * Destructuring for-in requires [key, value] enumeration
                     * in JS1.7.
                     */
                    JS_ASSERT(pn->pn_op == JSOP_ITER);
                    if (!(pn->pn_iflags & JSITER_FOREACH))
                        pn->pn_iflags |= JSITER_FOREACH | JSITER_KEYVALUE;
                }
                break;
#endif

              default:;
            }

            /* Parse the object expression as the right operand of 'in'. */
            pn2 = NewBinary(cx, TOK_IN, JSOP_NOP, pn1, Expr(cx, ts, tc), tc);
            if (!pn2)
                return NULL;
            pn->pn_left = pn2;
        } else {
            if (pn->pn_iflags & JSITER_FOREACH)
                goto bad_for_each;
            pn->pn_op = JSOP_NOP;

            /* Parse the loop condition or null into pn2. */
            MUST_MATCH_TOKEN(TOK_SEMI, JSMSG_SEMI_AFTER_FOR_INIT);
            ts->flags |= TSF_OPERAND;
            tt = js_PeekToken(cx, ts);
            ts->flags &= ~TSF_OPERAND;
            if (tt == TOK_SEMI) {
                pn2 = NULL;
            } else {
                pn2 = Expr(cx, ts, tc);
                if (!pn2)
                    return NULL;
            }

            /* Parse the update expression or null into pn3. */
            MUST_MATCH_TOKEN(TOK_SEMI, JSMSG_SEMI_AFTER_FOR_COND);
            ts->flags |= TSF_OPERAND;
            tt = js_PeekToken(cx, ts);
            ts->flags &= ~TSF_OPERAND;
            if (tt == TOK_RP) {
                pn3 = NULL;
            } else {
                pn3 = Expr(cx, ts, tc);
                if (!pn3)
                    return NULL;
            }

            /* Build the FORHEAD node to use as the left kid of pn. */
            pn4 = NewParseNode(cx, ts, PN_TERNARY, tc);
            if (!pn4)
                return NULL;
            pn4->pn_type = TOK_FORHEAD;
            pn4->pn_op = JSOP_NOP;
            pn4->pn_kid1 = pn1;
            pn4->pn_kid2 = pn2;
            pn4->pn_kid3 = pn3;
            pn->pn_left = pn4;
        }

        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_FOR_CTRL);

        /* Parse the loop body into pn->pn_right. */
        pn2 = Statement(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_right = pn2;

        /* Record the absolute line number for source note emission. */
        pn->pn_pos.end = pn2->pn_pos.end;

#if JS_HAS_BLOCK_SCOPE
        if (pnlet) {
            js_PopStatement(tc);
            pnlet->pn_expr = pn;
            pn = pnlet;
        }
#endif
        if (pnseq) {
            pnseq->pn_pos.end = pn->pn_pos.end;
            PN_APPEND(pnseq, pn);
            pn = pnseq;
        }
        js_PopStatement(tc);
        return pn;

      bad_for_each:
        js_ReportCompileErrorNumber(cx, ts, pn, JSREPORT_ERROR,
                                    JSMSG_BAD_FOR_EACH_LOOP);
        return NULL;
      }

      case TOK_TRY: {
        JSParseNode *catchList, *lastCatch;

        /*
         * try nodes are ternary.
         * kid1 is the try Statement
         * kid2 is the catch node list or null
         * kid3 is the finally Statement
         *
         * catch nodes are ternary.
         * kid1 is the lvalue (TOK_NAME, TOK_LB, or TOK_LC)
         * kid2 is the catch guard or null if no guard
         * kid3 is the catch block
         *
         * catch lvalue nodes are either:
         *   TOK_NAME for a single identifier
         *   TOK_RB or TOK_RC for a destructuring left-hand side
         *
         * finally nodes are TOK_LC Statement lists.
         */
        pn = NewParseNode(cx, ts, PN_TERNARY, tc);
        if (!pn)
            return NULL;
        pn->pn_op = JSOP_NOP;

        MUST_MATCH_TOKEN(TOK_LC, JSMSG_CURLY_BEFORE_TRY);
        js_PushStatement(tc, &stmtInfo, STMT_TRY, -1);
        pn->pn_kid1 = Statements(cx, ts, tc);
        if (!pn->pn_kid1)
            return NULL;
        MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_TRY);
        js_PopStatement(tc);

        catchList = NULL;
        tt = js_GetToken(cx, ts);
        if (tt == TOK_CATCH) {
            catchList = NewParseNode(cx, ts, PN_LIST, tc);
            if (!catchList)
                return NULL;
            catchList->pn_type = TOK_RESERVED;
            PN_INIT_LIST(catchList);
            lastCatch = NULL;

            do {
                JSParseNode *pnblock;
                BindData data;

                /* Check for another catch after unconditional catch. */
                if (lastCatch && !lastCatch->pn_kid2) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_CATCH_AFTER_GENERAL);
                    return NULL;
                }

                /*
                 * Create a lexical scope node around the whole catch clause,
                 * including the head.
                 */
                pnblock = PushLexicalScope(cx, ts, tc, &stmtInfo);
                if (!pnblock)
                    return NULL;
                stmtInfo.type = STMT_CATCH;

                /*
                 * Legal catch forms are:
                 *   catch (lhs)
                 *   catch (lhs if <boolean_expression>)
                 * where lhs is a name or a destructuring left-hand side.
                 * (the latter is legal only #ifdef JS_HAS_CATCH_GUARD)
                 */
                pn2 = NewParseNode(cx, ts, PN_TERNARY, tc);
                if (!pn2)
                    return NULL;
                pnblock->pn_expr = pn2;
                MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_CATCH);

                /*
                 * Contrary to ECMA Ed. 3, the catch variable is lexically
                 * scoped, not a property of a new Object instance.  This is
                 * an intentional change that anticipates ECMA Ed. 4.
                 */
                data.pn = NULL;
                data.op = JSOP_NOP;
                data.binder = BindLet;
                data.u.let.overflow = JSMSG_TOO_MANY_CATCH_VARS;

                tt = js_GetToken(cx, ts);
                switch (tt) {
#if JS_HAS_DESTRUCTURING
                  case TOK_LB:
                  case TOK_LC:
                    pn3 = DestructuringExpr(cx, &data, tc, tt);
                    if (!pn3)
                        return NULL;
                    break;
#endif

                  case TOK_NAME:
                    label = CURRENT_TOKEN(ts).t_atom;
                    if (!data.binder(cx, &data, label, tc))
                        return NULL;

                    pn3 = NewParseNode(cx, ts, PN_NAME, tc);
                    if (!pn3)
                        return NULL;
                    pn3->pn_atom = label;
                    pn3->pn_slot = -1;
                    break;

                  default:
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_CATCH_IDENTIFIER);
                    return NULL;
                }

                pn2->pn_kid1 = pn3;
#if JS_HAS_CATCH_GUARD
                /*
                 * We use 'catch (x if x === 5)' (not 'catch (x : x === 5)')
                 * to avoid conflicting with the JS2/ECMAv4 type annotation
                 * catchguard syntax.
                 */
                if (js_MatchToken(cx, ts, TOK_IF)) {
                    pn2->pn_kid2 = Expr(cx, ts, tc);
                    if (!pn2->pn_kid2)
                        return NULL;
                }
#endif
                MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_CATCH);

                MUST_MATCH_TOKEN(TOK_LC, JSMSG_CURLY_BEFORE_CATCH);
                pn2->pn_kid3 = Statements(cx, ts, tc);
                if (!pn2->pn_kid3)
                    return NULL;
                MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_CATCH);
                js_PopStatement(tc);

                PN_APPEND(catchList, pnblock);
                lastCatch = pn2;
                ts->flags |= TSF_OPERAND;
                tt = js_GetToken(cx, ts);
                ts->flags &= ~TSF_OPERAND;
            } while (tt == TOK_CATCH);
        }
        pn->pn_kid2 = catchList;

        if (tt == TOK_FINALLY) {
            MUST_MATCH_TOKEN(TOK_LC, JSMSG_CURLY_BEFORE_FINALLY);
            js_PushStatement(tc, &stmtInfo, STMT_FINALLY, -1);
            pn->pn_kid3 = Statements(cx, ts, tc);
            if (!pn->pn_kid3)
                return NULL;
            MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_AFTER_FINALLY);
            js_PopStatement(tc);
        } else {
            js_UngetToken(ts);
        }
        if (!catchList && !pn->pn_kid3) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_CATCH_OR_FINALLY);
            return NULL;
        }
        return pn;
      }

      case TOK_THROW:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;

        /* ECMA-262 Edition 3 says 'throw [no LineTerminator here] Expr'. */
        ts->flags |= TSF_OPERAND;
        tt = js_PeekTokenSameLine(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        if (tt == TOK_ERROR)
            return NULL;
        if (tt == TOK_EOF || tt == TOK_EOL || tt == TOK_SEMI || tt == TOK_RC) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_SYNTAX_ERROR);
            return NULL;
        }

        pn2 = Expr(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_op = JSOP_THROW;
        pn->pn_kid = pn2;
        break;

      /* TOK_CATCH and TOK_FINALLY are both handled in the TOK_TRY case */
      case TOK_CATCH:
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_CATCH_WITHOUT_TRY);
        return NULL;

      case TOK_FINALLY:
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_FINALLY_WITHOUT_TRY);
        return NULL;

      case TOK_BREAK:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        if (!MatchLabel(cx, ts, pn))
            return NULL;
        stmt = tc->topStmt;
        label = pn->pn_atom;
        if (label) {
            for (; ; stmt = stmt->down) {
                if (!stmt) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_LABEL_NOT_FOUND);
                    return NULL;
                }
                if (stmt->type == STMT_LABEL && stmt->u.label == label)
                    break;
            }
        } else {
            for (; ; stmt = stmt->down) {
                if (!stmt) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_TOUGH_BREAK);
                    return NULL;
                }
                if (STMT_IS_LOOP(stmt) || stmt->type == STMT_SWITCH)
                    break;
            }
        }
        if (label)
            pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        break;

      case TOK_CONTINUE:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        if (!MatchLabel(cx, ts, pn))
            return NULL;
        stmt = tc->topStmt;
        label = pn->pn_atom;
        if (label) {
            for (stmt2 = NULL; ; stmt = stmt->down) {
                if (!stmt) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_LABEL_NOT_FOUND);
                    return NULL;
                }
                if (stmt->type == STMT_LABEL) {
                    if (stmt->u.label == label) {
                        if (!stmt2 || !STMT_IS_LOOP(stmt2)) {
                            js_ReportCompileErrorNumber(cx, ts, NULL,
                                                        JSREPORT_ERROR,
                                                        JSMSG_BAD_CONTINUE);
                            return NULL;
                        }
                        break;
                    }
                } else {
                    stmt2 = stmt;
                }
            }
        } else {
            for (; ; stmt = stmt->down) {
                if (!stmt) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_BAD_CONTINUE);
                    return NULL;
                }
                if (STMT_IS_LOOP(stmt))
                    break;
            }
        }
        if (label)
            pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        break;

      case TOK_WITH:
        pn = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn)
            return NULL;
        MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_BEFORE_WITH);
        pn2 = ParenExpr(cx, ts, tc, NULL, NULL);
        if (!pn2)
            return NULL;
        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_WITH);
        pn->pn_left = pn2;

        js_PushStatement(tc, &stmtInfo, STMT_WITH, -1);
        pn2 = Statement(cx, ts, tc);
        if (!pn2)
            return NULL;
        js_PopStatement(tc);

        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_right = pn2;
        tc->flags |= TCF_FUN_HEAVYWEIGHT;
        return pn;

      case TOK_VAR:
        pn = Variables(cx, ts, tc);
        if (!pn)
            return NULL;

        /* Tell js_EmitTree to generate a final POP. */
        pn->pn_extra |= PNX_POPVAR;
        break;

#if JS_HAS_BLOCK_SCOPE
      case TOK_LET:
      {
        JSObject *obj;
        JSParsedObjectBox *blockpob;

        /* Check for a let statement or let expression. */
        if (js_PeekToken(cx, ts) == TOK_LP) {
            pn = LetBlock(cx, ts, tc, JS_TRUE);
            if (!pn || pn->pn_op == JSOP_LEAVEBLOCK)
                return pn;

            /* Let expressions require automatic semicolon insertion. */
            JS_ASSERT(pn->pn_type == TOK_SEMI ||
                      pn->pn_op == JSOP_LEAVEBLOCKEXPR);
            break;
        }

        /*
         * This is a let declaration. We must be directly under a block per
         * the proposed ES4 specs, but not an implicit block created due to
         * 'for (let ...)'. If we pass this error test, make the enclosing
         * JSStmtInfo be our scope. Further let declarations in this block
         * will find this scope statement and use the same block object.
         *
         * If we are the first let declaration in this block (i.e., when the
         * enclosing maybe-scope JSStmtInfo isn't yet a scope statement) then
         * we also need to set tc->blockNode to be our TOK_LEXICALSCOPE.
         */
        stmt = tc->topStmt;
        if (stmt &&
            (!STMT_MAYBE_SCOPE(stmt) || (stmt->flags & SIF_FOR_BLOCK))) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_LET_DECL_NOT_IN_BLOCK);
            return NULL;
        }

        if (stmt && (stmt->flags & SIF_SCOPE)) {
            JS_ASSERT(tc->blockChain == stmt->u.blockObj);
            obj = tc->blockChain;
        } else {
            if (!stmt || (stmt->flags & SIF_BODY_BLOCK)) {
                /*
                 * ES4 specifies that let at top level and at body-block scope
                 * does not shadow var, so convert back to var.
                 */
                CURRENT_TOKEN(ts).type = TOK_VAR;
                CURRENT_TOKEN(ts).t_op = JSOP_DEFVAR;

                pn = Variables(cx, ts, tc);
                if (!pn)
                    return NULL;
                pn->pn_extra |= PNX_POPVAR;
                break;
            }

            /*
             * Some obvious assertions here, but they may help clarify the
             * situation. This stmt is not yet a scope, so it must not be a
             * catch block (which is a lexical scope by definition).
             */
            JS_ASSERT(!(stmt->flags & SIF_SCOPE));
            JS_ASSERT(stmt != tc->topScopeStmt);
            JS_ASSERT(stmt->type == STMT_BLOCK ||
                      stmt->type == STMT_SWITCH ||
                      stmt->type == STMT_TRY ||
                      stmt->type == STMT_FINALLY);
            JS_ASSERT(!stmt->downScope);

            /* Convert the block statement into a scope statement. */
            obj = js_NewBlockObject(cx);
            if (!obj)
                return NULL;
            blockpob = js_NewParsedObjectBox(cx, tc->parseContext, obj);
            if (!blockpob)
                return NULL;

            /*
             * Insert stmt on the tc->topScopeStmt/stmtInfo.downScope linked
             * list stack, if it isn't already there.  If it is there, but it
             * lacks the SIF_SCOPE flag, it must be a try, catch, or finally
             * block.
             */
            stmt->flags |= SIF_SCOPE;
            stmt->downScope = tc->topScopeStmt;
            tc->topScopeStmt = stmt;
            JS_SCOPE_DEPTH_METERING(++tc->scopeDepth > tc->maxScopeDepth &&
                                    (tc->maxScopeDepth = tc->scopeDepth));

            STOBJ_SET_PARENT(obj, tc->blockChain);
            tc->blockChain = obj;
            stmt->u.blockObj = obj;

#ifdef DEBUG
            pn1 = tc->blockNode;
            JS_ASSERT(!pn1 || pn1->pn_type != TOK_LEXICALSCOPE);
#endif

            /* Create a new lexical scope node for these statements. */
            pn1 = NewParseNode(cx, ts, PN_NAME, tc);
            if (!pn1)
                return NULL;

            pn1->pn_type = TOK_LEXICALSCOPE;
            pn1->pn_op = JSOP_LEAVEBLOCK;
            pn1->pn_pos = tc->blockNode->pn_pos;
            pn1->pn_pob = blockpob;
            pn1->pn_expr = tc->blockNode;
            pn1->pn_slot = -1;
            tc->blockNode = pn1;
        }

        pn = Variables(cx, ts, tc);
        if (!pn)
            return NULL;
        pn->pn_extra = PNX_POPVAR;
        break;
      }
#endif /* JS_HAS_BLOCK_SCOPE */

      case TOK_RETURN:
        pn = ReturnOrYield(cx, ts, tc, Expr);
        if (!pn)
            return NULL;
        break;

      case TOK_LC:
      {
        uintN oldflags;

        oldflags = tc->flags;
        tc->flags = oldflags & ~TCF_HAS_FUNCTION_STMT;
        js_PushStatement(tc, &stmtInfo, STMT_BLOCK, -1);
        pn = Statements(cx, ts, tc);
        if (!pn)
            return NULL;

        MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_IN_COMPOUND);
        js_PopStatement(tc);

        /*
         * If we contain a function statement and our container is top-level
         * or another block, flag pn to preserve braces when decompiling.
         */
        if ((tc->flags & TCF_HAS_FUNCTION_STMT) &&
            (!tc->topStmt || tc->topStmt->type == STMT_BLOCK)) {
            pn->pn_extra |= PNX_NEEDBRACES;
        }
        tc->flags = oldflags | (tc->flags & (TCF_FUN_FLAGS | TCF_RETURN_FLAGS));
        return pn;
      }

      case TOK_EOL:
      case TOK_SEMI:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_SEMI;
        return pn;

#if JS_HAS_DEBUGGER_KEYWORD
      case TOK_DEBUGGER:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_DEBUGGER;
        tc->flags |= TCF_FUN_HEAVYWEIGHT;
        break;
#endif /* JS_HAS_DEBUGGER_KEYWORD */

#if JS_HAS_XML_SUPPORT
      case TOK_DEFAULT:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        if (!js_MatchToken(cx, ts, TOK_NAME) ||
            CURRENT_TOKEN(ts).t_atom != cx->runtime->atomState.xmlAtom ||
            !js_MatchToken(cx, ts, TOK_NAME) ||
            CURRENT_TOKEN(ts).t_atom != cx->runtime->atomState.namespaceAtom ||
            !js_MatchToken(cx, ts, TOK_ASSIGN) ||
            CURRENT_TOKEN(ts).t_op != JSOP_NOP) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_DEFAULT_XML_NAMESPACE);
            return NULL;
        }
        pn2 = Expr(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_op = JSOP_DEFXMLNS;
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_kid = pn2;
        tc->flags |= TCF_HAS_DEFXMLNS;
        break;
#endif

      case TOK_ERROR:
        return NULL;

      default:
#if JS_HAS_XML_SUPPORT
      expression:
#endif
        js_UngetToken(ts);
        pn2 = Expr(cx, ts, tc);
        if (!pn2)
            return NULL;

        if (js_PeekToken(cx, ts) == TOK_COLON) {
            if (pn2->pn_type != TOK_NAME) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_LABEL);
                return NULL;
            }
            label = pn2->pn_atom;
            for (stmt = tc->topStmt; stmt; stmt = stmt->down) {
                if (stmt->type == STMT_LABEL && stmt->u.label == label) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_DUPLICATE_LABEL);
                    return NULL;
                }
            }
            (void) js_GetToken(cx, ts);

            /* Push a label struct and parse the statement. */
            js_PushStatement(tc, &stmtInfo, STMT_LABEL, -1);
            stmtInfo.u.label = label;
            pn = Statement(cx, ts, tc);
            if (!pn)
                return NULL;

            /* Normalize empty statement to empty block for the decompiler. */
            if (pn->pn_type == TOK_SEMI && !pn->pn_kid) {
                pn->pn_type = TOK_LC;
                pn->pn_arity = PN_LIST;
                PN_INIT_LIST(pn);
            }

            /* Pop the label, set pn_expr, and return early. */
            js_PopStatement(tc);
            pn2->pn_type = TOK_COLON;
            pn2->pn_pos.end = pn->pn_pos.end;
            pn2->pn_expr = pn;
            return pn2;
        }

        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_SEMI;
        pn->pn_pos = pn2->pn_pos;
        pn->pn_kid = pn2;
        break;
    }

    /* Check termination of this primitive statement. */
    if (ON_CURRENT_LINE(ts, pn->pn_pos)) {
        ts->flags |= TSF_OPERAND;
        tt = js_PeekTokenSameLine(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        if (tt == TOK_ERROR)
            return NULL;
        if (tt != TOK_EOF && tt != TOK_EOL && tt != TOK_SEMI && tt != TOK_RC) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_SEMI_BEFORE_STMNT);
            return NULL;
        }
    }

    (void) js_MatchToken(cx, ts, TOK_SEMI);
    return pn;
}

static JSParseNode *
Variables(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSTokenType tt;
    JSBool let;
    JSStmtInfo *scopeStmt;
    BindData data;
    JSParseNode *pn, *pn2;
    JSAtom *atom;

    /*
     * The three options here are:
     * - TOK_LET: We are parsing a let declaration.
     * - TOK_LP: We are parsing the head of a let block.
     * - Otherwise, we're parsing var declarations.
     */
    tt = CURRENT_TOKEN(ts).type;
    let = (tt == TOK_LET || tt == TOK_LP);
    JS_ASSERT(let || tt == TOK_VAR);

    /* Make sure that Statement set the tree context up correctly. */
    scopeStmt = tc->topScopeStmt;
    if (let) {
        while (scopeStmt && !(scopeStmt->flags & SIF_SCOPE)) {
            JS_ASSERT(!STMT_MAYBE_SCOPE(scopeStmt));
            scopeStmt = scopeStmt->downScope;
        }
        JS_ASSERT(scopeStmt);
    }

    data.pn = NULL;
    data.op = let ? JSOP_NOP : CURRENT_TOKEN(ts).t_op;
    pn = NewParseNode(cx, ts, PN_LIST, tc);
    if (!pn)
        return NULL;
    pn->pn_op = data.op;
    PN_INIT_LIST(pn);

    /*
     * The tricky part of this code is to create special parsenode opcodes for
     * getting and setting variables (which will be stored as special slots in
     * the frame).  The most complicated case is an eval() inside a function.
     * If the evaluated string references variables in the enclosing function,
     * then we need to generate the special variable opcodes.  We determine
     * this by looking up the variable's id in the current variable object.
     * Fortunately, we can avoid doing this for let declared variables.
     */
    if (let) {
        JS_ASSERT(tc->blockChain == scopeStmt->u.blockObj);
        data.binder = BindLet;
        data.u.let.overflow = JSMSG_TOO_MANY_LOCALS;
    } else {
        data.binder = BindVarOrConst;
    }

    do {
        tt = js_GetToken(cx, ts);
#if JS_HAS_DESTRUCTURING
        if (tt == TOK_LB || tt == TOK_LC) {
            pn2 = PrimaryExpr(cx, ts, tc, tt, JS_FALSE);
            if (!pn2)
                return NULL;

            if ((tc->flags & TCF_IN_FOR_INIT) &&
                js_PeekToken(cx, ts) == TOK_IN) {
                if (!CheckDestructuring(cx, &data, pn2, NULL, tc))
                    return NULL;
                PN_APPEND(pn, pn2);
                continue;
            }

            MUST_MATCH_TOKEN(TOK_ASSIGN, JSMSG_BAD_DESTRUCT_DECL);
            if (CURRENT_TOKEN(ts).t_op != JSOP_NOP)
                goto bad_var_init;

            pn2 = NewBinary(cx, TOK_ASSIGN, JSOP_NOP,
                            pn2, AssignExpr(cx, ts, tc),
                            tc);
            if (!pn2 ||
                !CheckDestructuring(cx, &data,
                                    pn2->pn_left, pn2->pn_right,
                                    tc)) {
                return NULL;
            }
            PN_APPEND(pn, pn2);
            continue;
        }
#endif

        if (tt != TOK_NAME) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_NO_VARIABLE_NAME);
            return NULL;
        }
        atom = CURRENT_TOKEN(ts).t_atom;
        if (!data.binder(cx, &data, atom, tc))
            return NULL;

        pn2 = NewParseNode(cx, ts, PN_NAME, tc);
        if (!pn2)
            return NULL;
        pn2->pn_op = JSOP_NAME;
        pn2->pn_atom = atom;
        pn2->pn_slot = -1;
        if (!let)
            pn2->pn_const = (data.op == JSOP_DEFCONST);
        PN_APPEND(pn, pn2);

        if (js_MatchToken(cx, ts, TOK_ASSIGN)) {
            if (CURRENT_TOKEN(ts).t_op != JSOP_NOP)
                goto bad_var_init;

            pn2->pn_expr = AssignExpr(cx, ts, tc);
            if (!pn2->pn_expr)
                return NULL;
            pn2->pn_op = (!let && data.op == JSOP_DEFCONST)
                         ? JSOP_SETCONST
                         : JSOP_SETNAME;
            if (!let && atom == cx->runtime->atomState.argumentsAtom)
                tc->flags |= TCF_FUN_HEAVYWEIGHT;
        }
    } while (js_MatchToken(cx, ts, TOK_COMMA));

    pn->pn_pos.end = PN_LAST(pn)->pn_pos.end;
    return pn;

bad_var_init:
    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                JSMSG_BAD_VAR_INIT);
    return NULL;
}

static JSParseNode *
Expr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2;

    pn = AssignExpr(cx, ts, tc);
    if (pn && js_MatchToken(cx, ts, TOK_COMMA)) {
        pn2 = NewParseNode(cx, ts, PN_LIST, tc);
        if (!pn2)
            return NULL;
        pn2->pn_pos.begin = pn->pn_pos.begin;
        PN_INIT_LIST_1(pn2, pn);
        pn = pn2;
        do {
#if JS_HAS_GENERATORS
            pn2 = PN_LAST(pn);
            if (pn2->pn_type == TOK_YIELD) {
                js_ReportCompileErrorNumber(cx, ts, pn2, JSREPORT_ERROR,
                                            JSMSG_BAD_GENERATOR_SYNTAX,
                                            js_yield_str);
                return NULL;
            }
#endif
            pn2 = AssignExpr(cx, ts, tc);
            if (!pn2)
                return NULL;
            PN_APPEND(pn, pn2);
        } while (js_MatchToken(cx, ts, TOK_COMMA));
        pn->pn_pos.end = PN_LAST(pn)->pn_pos.end;
    }
    return pn;
}

static JSParseNode *
AssignExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2;
    JSTokenType tt;
    JSOp op;

    JS_CHECK_RECURSION(cx, return NULL);

#if JS_HAS_GENERATORS
    ts->flags |= TSF_OPERAND;
    if (js_MatchToken(cx, ts, TOK_YIELD)) {
        ts->flags &= ~TSF_OPERAND;
        return ReturnOrYield(cx, ts, tc, AssignExpr);
    }
    ts->flags &= ~TSF_OPERAND;
#endif

    pn = CondExpr(cx, ts, tc);
    if (!pn)
        return NULL;

    tt = js_GetToken(cx, ts);
#if JS_HAS_GETTER_SETTER
    if (tt == TOK_NAME) {
        tt = CheckGetterOrSetter(cx, ts, TOK_ASSIGN);
        if (tt == TOK_ERROR)
            return NULL;
    }
#endif
    if (tt != TOK_ASSIGN) {
        js_UngetToken(ts);
        return pn;
    }

    op = CURRENT_TOKEN(ts).t_op;
    for (pn2 = pn; pn2->pn_type == TOK_RP; pn2 = pn2->pn_kid)
        continue;
    switch (pn2->pn_type) {
      case TOK_NAME:
        pn2->pn_op = JSOP_SETNAME;
        if (pn2->pn_atom == cx->runtime->atomState.argumentsAtom)
            tc->flags |= TCF_FUN_HEAVYWEIGHT;
        break;
      case TOK_DOT:
        pn2->pn_op = JSOP_SETPROP;
        break;
      case TOK_LB:
        pn2->pn_op = JSOP_SETELEM;
        break;
#if JS_HAS_DESTRUCTURING
      case TOK_RB:
      case TOK_RC:
        if (op != JSOP_NOP) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_DESTRUCT_ASS);
            return NULL;
        }
        pn = AssignExpr(cx, ts, tc);
        if (!pn || !CheckDestructuring(cx, NULL, pn2, pn, tc))
            return NULL;
        return NewBinary(cx, TOK_ASSIGN, op, pn2, pn, tc);
#endif
#if JS_HAS_LVALUE_RETURN
      case TOK_LP:
        if (!MakeSetCall(cx, pn2, tc, JSMSG_BAD_LEFTSIDE_OF_ASS))
            return NULL;
        break;
#endif
#if JS_HAS_XML_SUPPORT
      case TOK_UNARYOP:
        if (pn2->pn_op == JSOP_XMLNAME) {
            pn2->pn_op = JSOP_SETXMLNAME;
            break;
        }
        /* FALL THROUGH */
#endif
      default:
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_LEFTSIDE_OF_ASS);
        return NULL;
    }

    return NewBinary(cx, TOK_ASSIGN, op, pn2, AssignExpr(cx, ts, tc), tc);
}

static JSParseNode *
CondExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn1, *pn2, *pn3;
    uintN oldflags;

    pn = OrExpr(cx, ts, tc);
    if (pn && js_MatchToken(cx, ts, TOK_HOOK)) {
        pn1 = pn;
        pn = NewParseNode(cx, ts, PN_TERNARY, tc);
        if (!pn)
            return NULL;
        /*
         * Always accept the 'in' operator in the middle clause of a ternary,
         * where it's unambiguous, even if we might be parsing the init of a
         * for statement.
         */
        oldflags = tc->flags;
        tc->flags &= ~TCF_IN_FOR_INIT;
        pn2 = AssignExpr(cx, ts, tc);
        tc->flags = oldflags | (tc->flags & TCF_FUN_FLAGS);

        if (!pn2)
            return NULL;
        MUST_MATCH_TOKEN(TOK_COLON, JSMSG_COLON_IN_COND);
        pn3 = AssignExpr(cx, ts, tc);
        if (!pn3)
            return NULL;
        pn->pn_pos.begin = pn1->pn_pos.begin;
        pn->pn_pos.end = pn3->pn_pos.end;
        pn->pn_kid1 = pn1;
        pn->pn_kid2 = pn2;
        pn->pn_kid3 = pn3;
    }
    return pn;
}

static JSParseNode *
OrExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = AndExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_OR))
        pn = NewBinary(cx, TOK_OR, JSOP_OR, pn, AndExpr(cx, ts, tc), tc);
    return pn;
}

static JSParseNode *
AndExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = BitOrExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_AND))
        pn = NewBinary(cx, TOK_AND, JSOP_AND, pn, BitOrExpr(cx, ts, tc), tc);
    return pn;
}

static JSParseNode *
BitOrExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = BitXorExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_BITOR)) {
        pn = NewBinary(cx, TOK_BITOR, JSOP_BITOR, pn, BitXorExpr(cx, ts, tc),
                       tc);
    }
    return pn;
}

static JSParseNode *
BitXorExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = BitAndExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_BITXOR)) {
        pn = NewBinary(cx, TOK_BITXOR, JSOP_BITXOR, pn, BitAndExpr(cx, ts, tc),
                       tc);
    }
    return pn;
}

static JSParseNode *
BitAndExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = EqExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_BITAND))
        pn = NewBinary(cx, TOK_BITAND, JSOP_BITAND, pn, EqExpr(cx, ts, tc), tc);
    return pn;
}

static JSParseNode *
EqExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSOp op;

    pn = RelExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_EQOP)) {
        op = CURRENT_TOKEN(ts).t_op;
        pn = NewBinary(cx, TOK_EQOP, op, pn, RelExpr(cx, ts, tc), tc);
    }
    return pn;
}

static JSParseNode *
RelExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSTokenType tt;
    JSOp op;
    uintN inForInitFlag = tc->flags & TCF_IN_FOR_INIT;

    /*
     * Uses of the in operator in ShiftExprs are always unambiguous,
     * so unset the flag that prohibits recognizing it.
     */
    tc->flags &= ~TCF_IN_FOR_INIT;

    pn = ShiftExpr(cx, ts, tc);
    while (pn &&
           (js_MatchToken(cx, ts, TOK_RELOP) ||
            /*
             * Recognize the 'in' token as an operator only if we're not
             * currently in the init expr of a for loop.
             */
            (inForInitFlag == 0 && js_MatchToken(cx, ts, TOK_IN)) ||
            js_MatchToken(cx, ts, TOK_INSTANCEOF))) {
        tt = CURRENT_TOKEN(ts).type;
        op = CURRENT_TOKEN(ts).t_op;
        pn = NewBinary(cx, tt, op, pn, ShiftExpr(cx, ts, tc), tc);
    }
    /* Restore previous state of inForInit flag. */
    tc->flags |= inForInitFlag;

    return pn;
}

static JSParseNode *
ShiftExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSOp op;

    pn = AddExpr(cx, ts, tc);
    while (pn && js_MatchToken(cx, ts, TOK_SHOP)) {
        op = CURRENT_TOKEN(ts).t_op;
        pn = NewBinary(cx, TOK_SHOP, op, pn, AddExpr(cx, ts, tc), tc);
    }
    return pn;
}

static JSParseNode *
AddExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSTokenType tt;
    JSOp op;

    pn = MulExpr(cx, ts, tc);
    while (pn &&
           (js_MatchToken(cx, ts, TOK_PLUS) ||
            js_MatchToken(cx, ts, TOK_MINUS))) {
        tt = CURRENT_TOKEN(ts).type;
        op = (tt == TOK_PLUS) ? JSOP_ADD : JSOP_SUB;
        pn = NewBinary(cx, tt, op, pn, MulExpr(cx, ts, tc), tc);
    }
    return pn;
}

static JSParseNode *
MulExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSTokenType tt;
    JSOp op;

    pn = UnaryExpr(cx, ts, tc);
    while (pn &&
           (js_MatchToken(cx, ts, TOK_STAR) ||
            js_MatchToken(cx, ts, TOK_DIVOP))) {
        tt = CURRENT_TOKEN(ts).type;
        op = CURRENT_TOKEN(ts).t_op;
        pn = NewBinary(cx, tt, op, pn, UnaryExpr(cx, ts, tc), tc);
    }
    return pn;
}

static JSParseNode *
SetLvalKid(JSContext *cx, JSTokenStream *ts, JSParseNode *pn, JSParseNode *kid,
           const char *name)
{
    while (kid->pn_type == TOK_RP)
        kid = kid->pn_kid;
    if (kid->pn_type != TOK_NAME &&
        kid->pn_type != TOK_DOT &&
#if JS_HAS_LVALUE_RETURN
        (kid->pn_type != TOK_LP ||
         (kid->pn_op != JSOP_CALL && kid->pn_op != JSOP_EVAL && kid->pn_op != JSOP_APPLY)) &&
#endif
#if JS_HAS_XML_SUPPORT
        (kid->pn_type != TOK_UNARYOP || kid->pn_op != JSOP_XMLNAME) &&
#endif
        kid->pn_type != TOK_LB) {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_OPERAND, name);
        return NULL;
    }
    pn->pn_kid = kid;
    return kid;
}

static const char incop_name_str[][10] = {"increment", "decrement"};

static JSBool
SetIncOpKid(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
            JSParseNode *pn, JSParseNode *kid,
            JSTokenType tt, JSBool preorder)
{
    JSOp op;

    kid = SetLvalKid(cx, ts, pn, kid, incop_name_str[tt == TOK_DEC]);
    if (!kid)
        return JS_FALSE;
    switch (kid->pn_type) {
      case TOK_NAME:
        op = (tt == TOK_INC)
             ? (preorder ? JSOP_INCNAME : JSOP_NAMEINC)
             : (preorder ? JSOP_DECNAME : JSOP_NAMEDEC);
        if (kid->pn_atom == cx->runtime->atomState.argumentsAtom)
            tc->flags |= TCF_FUN_HEAVYWEIGHT;
        break;

      case TOK_DOT:
        op = (tt == TOK_INC)
             ? (preorder ? JSOP_INCPROP : JSOP_PROPINC)
             : (preorder ? JSOP_DECPROP : JSOP_PROPDEC);
        break;

#if JS_HAS_LVALUE_RETURN
      case TOK_LP:
        if (!MakeSetCall(cx, kid, tc, JSMSG_BAD_INCOP_OPERAND))
            return JS_FALSE;
        /* FALL THROUGH */
#endif
#if JS_HAS_XML_SUPPORT
      case TOK_UNARYOP:
        if (kid->pn_op == JSOP_XMLNAME)
            kid->pn_op = JSOP_SETXMLNAME;
        /* FALL THROUGH */
#endif
      case TOK_LB:
        op = (tt == TOK_INC)
             ? (preorder ? JSOP_INCELEM : JSOP_ELEMINC)
             : (preorder ? JSOP_DECELEM : JSOP_ELEMDEC);
        break;

      default:
        JS_ASSERT(0);
        op = JSOP_NOP;
    }
    pn->pn_op = op;
    return JS_TRUE;
}

static JSParseNode *
UnaryExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSTokenType tt;
    JSParseNode *pn, *pn2;

    JS_CHECK_RECURSION(cx, return NULL);

    ts->flags |= TSF_OPERAND;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_OPERAND;

    switch (tt) {
      case TOK_UNARYOP:
      case TOK_PLUS:
      case TOK_MINUS:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_UNARYOP;      /* PLUS and MINUS are binary */
        pn->pn_op = CURRENT_TOKEN(ts).t_op;
        pn2 = UnaryExpr(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_pos.end = pn2->pn_pos.end;
        pn->pn_kid = pn2;
        break;

      case TOK_INC:
      case TOK_DEC:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn2 = MemberExpr(cx, ts, tc, JS_TRUE);
        if (!pn2)
            return NULL;
        if (!SetIncOpKid(cx, ts, tc, pn, pn2, tt, JS_TRUE))
            return NULL;
        pn->pn_pos.end = pn2->pn_pos.end;
        break;

      case TOK_DELETE:
        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn2 = UnaryExpr(cx, ts, tc);
        if (!pn2)
            return NULL;
        pn->pn_pos.end = pn2->pn_pos.end;

        /*
         * Under ECMA3, deleting any unary expression is valid -- it simply
         * returns true. Here we strip off any parentheses and fold constants
         * before checking for a call expression, in order to rule out delete
         * of a generator expression.
         */
        while (pn2->pn_type == TOK_RP)
            pn2 = pn2->pn_kid;
        if (!js_FoldConstants(cx, pn2, tc))
            return NULL;
        if (pn2->pn_type == TOK_LP &&
            pn2->pn_op != JSOP_SETCALL &&
            !MakeSetCall(cx, pn2, tc, JSMSG_BAD_DELETE_OPERAND)) {
            return NULL;
        }
        pn->pn_kid = pn2;
        break;

      case TOK_ERROR:
        return NULL;

      default:
        js_UngetToken(ts);
        pn = MemberExpr(cx, ts, tc, JS_TRUE);
        if (!pn)
            return NULL;

        /* Don't look across a newline boundary for a postfix incop. */
        if (ON_CURRENT_LINE(ts, pn->pn_pos)) {
            ts->flags |= TSF_OPERAND;
            tt = js_PeekTokenSameLine(cx, ts);
            ts->flags &= ~TSF_OPERAND;
            if (tt == TOK_INC || tt == TOK_DEC) {
                (void) js_GetToken(cx, ts);
                pn2 = NewParseNode(cx, ts, PN_UNARY, tc);
                if (!pn2)
                    return NULL;
                if (!SetIncOpKid(cx, ts, tc, pn2, pn, tt, JS_FALSE))
                    return NULL;
                pn2->pn_pos.begin = pn->pn_pos.begin;
                pn = pn2;
            }
        }
        break;
    }
    return pn;
}

#if JS_HAS_GENERATORS

/*
 * Starting from a |for| keyword after the first array initialiser element or
 * an expression in an open parenthesis, parse the tail of the comprehension
 * or generator expression signified by this |for| keyword in context.
 *
 * Return null on failure, else return the top-most parse node for the array
 * comprehension or generator expression, with a unary node as the body of the
 * (possibly nested) for-loop, initialized by |type, op, kid|.
 */
static JSParseNode *
ComprehensionTail(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                  JSTokenType type, JSOp op, JSParseNode *kid)
{
    JSParseNode *pn, *pn2, *pn3, **pnp;
    JSStmtInfo stmtInfo;
    BindData data;
    JSRuntime *rt;
    JSTokenType tt;
    JSAtom *atom;

    JS_ASSERT(type == TOK_SEMI || type == TOK_ARRAYPUSH);
    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_FOR);

    /*
     * Make a parse-node and literal object representing the block scope of
     * this array comprehension or generator expression.
     */
    pn = PushLexicalScope(cx, ts, tc, &stmtInfo);
    if (!pn)
        return NULL;
    pnp = &pn->pn_expr;

    data.pn = NULL;
    data.op = JSOP_NOP;
    data.binder = BindLet;
    data.u.let.overflow = JSMSG_ARRAY_INIT_TOO_BIG;

    rt = cx->runtime;
    do {
        /*
         * FOR node is binary, left is loop control and right is body.  Use
         * index to count each block-local let-variable on the left-hand side
         * of the IN.
         */
        pn2 = NewParseNode(cx, ts, PN_BINARY, tc);
        if (!pn2)
            return NULL;

        pn2->pn_op = JSOP_ITER;
        pn2->pn_iflags = JSITER_ENUMERATE;
        if (js_MatchToken(cx, ts, TOK_NAME)) {
            if (CURRENT_TOKEN(ts).t_atom == rt->atomState.eachAtom)
                pn2->pn_iflags |= JSITER_FOREACH;
            else
                js_UngetToken(ts);
        }
        MUST_MATCH_TOKEN(TOK_LP, JSMSG_PAREN_AFTER_FOR);

        tt = js_GetToken(cx, ts);
        switch (tt) {
#if JS_HAS_DESTRUCTURING
          case TOK_LB:
          case TOK_LC:
            pn3 = DestructuringExpr(cx, &data, tc, tt);
            if (!pn3)
                return NULL;

            if (pn3->pn_type != TOK_RB || pn3->pn_count != 2) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_FOR_LEFTSIDE);
                return NULL;
            }

            if (JSVERSION_NUMBER(cx) == JSVERSION_1_7) {
                /* Destructuring requires [key, value] enumeration in JS1.7. */
                JS_ASSERT(pn2->pn_op == JSOP_ITER);
                JS_ASSERT(pn2->pn_iflags & JSITER_ENUMERATE);
                if (!(pn2->pn_iflags & JSITER_FOREACH))
                    pn2->pn_iflags |= JSITER_FOREACH | JSITER_KEYVALUE;
            }
            break;
#endif

          case TOK_NAME:
            atom = CURRENT_TOKEN(ts).t_atom;
            if (!data.binder(cx, &data, atom, tc))
                return NULL;

            /*
             * Create a name node with pn_op JSOP_NAME.  We can't set pn_op to
             * JSOP_GETLOCAL here, because we don't yet know the block's depth
             * in the operand stack frame.  The code generator computes that,
             * and it tries to bind all names to slots, so we must let it do
             * the deed.
             */
            pn3 = NewParseNode(cx, ts, PN_NAME, tc);
            if (!pn3)
                return NULL;
            pn3->pn_op = JSOP_NAME;
            pn3->pn_atom = atom;
            pn3->pn_slot = -1;
            break;

          default:
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_NO_VARIABLE_NAME);

          case TOK_ERROR:
            return NULL;
        }

        MUST_MATCH_TOKEN(TOK_IN, JSMSG_IN_AFTER_FOR_NAME);
        pn3 = NewBinary(cx, TOK_IN, JSOP_NOP, pn3,
                        Expr(cx, ts, tc), tc);
        if (!pn3)
            return NULL;

        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_AFTER_FOR_CTRL);
        pn2->pn_left = pn3;
        *pnp = pn2;
        pnp = &pn2->pn_right;
    } while (js_MatchToken(cx, ts, TOK_FOR));

    if (js_MatchToken(cx, ts, TOK_IF)) {
        pn2 = NewParseNode(cx, ts, PN_TERNARY, tc);
        if (!pn2)
            return NULL;
        pn2->pn_kid1 = Condition(cx, ts, tc);
        if (!pn2->pn_kid1)
            return NULL;
        *pnp = pn2;
        pnp = &pn2->pn_kid2;
    }

    pn2 = NewParseNode(cx, ts, PN_UNARY, tc);
    if (!pn2)
        return NULL;
    pn2->pn_type = type;
    pn2->pn_op = op;
    pn2->pn_kid = kid;
    *pnp = pn2;

    js_PopStatement(tc);
    return pn;
}

#if JS_HAS_GENERATOR_EXPRS

/*
 * Starting from a |for| keyword after an expression, parse the comprehension
 * tail completing this generator expression. Wrap the expression at kid in a
 * generator function that is immediately called to evaluate to the generator
 * iterator that is the value of this generator expression.
 *
 * Callers pass a blank unary node via pn, which GeneratorExpr fills in as the
 * yield expression, which ComprehensionTail in turn wraps in a TOK_SEMI-type
 * expression-statement node that constitutes the body of the |for| loop(s) in
 * the generator function.
 *
 * Note how unlike Python, we do not evaluate the expression to the right of
 * the first |in| in the chain of |for| heads. Instead, a generator expression
 * is merely sugar for a generator function expression and its application.
 */
static JSParseNode *
GeneratorExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
              uintN oldflags, JSParseNode *pn, JSParseNode *kid)
{
    JSParseNode *body, *lambda;
    JSFunction *fun;

    /* Initialize pn, connecting it to kid. */
    JS_ASSERT(pn->pn_arity == PN_UNARY);
    pn->pn_type = TOK_YIELD;
    pn->pn_op = JSOP_YIELD;
    pn->pn_pos = kid->pn_pos;
    pn->pn_kid = kid;
    pn->pn_hidden = JS_TRUE;

    /*
     * Parse the comprehension tail at hand, making pn the kid of the loop
     * body's expression statement.
     */
    body = ComprehensionTail(cx, ts, tc, TOK_SEMI, JSOP_NOP, pn);
    if (!body)
        return NULL;
    body->pn_pos.begin = kid->pn_pos.begin;

    /*
     * Make the generator function and flag it as interpreted ASAP (see the
     * comment in FunctionBody).
     */
    fun = NewCompilerFunction(cx, tc, NULL, JSFUN_LAMBDA);
    if (!fun)
        return NULL;

    /*
     * This generator function is referenced by an anonymous function object
     * node. Here is where we must take care to propagate certain tc->flags
     * that may have changed from oldflags to reflect crucial facts about the
     * expression on the left of |for| and in the comprehension tail after it.
     */
    lambda = NewParseNode(cx, ts, PN_FUNC, tc);
    if (!lambda)
        return NULL;
    lambda->pn_type = TOK_FUNCTION;
    lambda->pn_op = JSOP_ANONFUNOBJ;
    lambda->pn_pos.begin = body->pn_pos.begin;
    lambda->pn_funpob = js_NewParsedObjectBox(cx, tc->parseContext,
                                              FUN_OBJECT(fun));
    if (!lambda->pn_funpob)
        return NULL;
    lambda->pn_body = body;
    lambda->pn_flags = TCF_FUN_IS_GENERATOR | TCF_GENEXP_LAMBDA |
                       ((oldflags ^ tc->flags) & TCF_FUN_FLAGS);

    /*
     * Re-use pn to name the result node, a call expression invoking the
     * anonymous generator function object.
     */
    pn = NewParseNode(cx, ts, PN_LIST, tc);
    if (!pn)
        return NULL;
    pn->pn_type = TOK_LP;
    pn->pn_op = JSOP_CALL;
    pn->pn_pos.begin = lambda->pn_pos.begin;
    PN_INIT_LIST_1(pn, lambda);

    body->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
    tc->flags = oldflags;
    return pn;
}

static const char js_generator_str[] = "generator";

#endif /* JS_HAS_GENERATOR_EXPRS */
#endif /* JS_HAS_GENERATORS */

static JSBool
ArgumentList(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
             JSParseNode *listNode)
{
    JSBool matched;

    ts->flags |= TSF_OPERAND;
    matched = js_MatchToken(cx, ts, TOK_RP);
    ts->flags &= ~TSF_OPERAND;
    if (!matched) {
        do {
#if JS_HAS_GENERATOR_EXPRS
            uintN oldflags = tc->flags;
#endif
            JSParseNode *argNode = AssignExpr(cx, ts, tc);
            if (!argNode)
                return JS_FALSE;
#if JS_HAS_GENERATORS
            if (argNode->pn_type == TOK_YIELD &&
                js_PeekToken(cx, ts) == TOK_COMMA) {
                js_ReportCompileErrorNumber(cx, ts, argNode, JSREPORT_ERROR,
                                            JSMSG_BAD_GENERATOR_SYNTAX,
                                            js_yield_str);
                return JS_FALSE;
            }
#endif
#if JS_HAS_GENERATOR_EXPRS
            if (js_MatchToken(cx, ts, TOK_FOR)) {
                JSParseNode *pn = NewParseNode(cx, ts, PN_UNARY, tc);
                if (!pn)
                    return JS_FALSE;
                argNode = GeneratorExpr(cx, ts, tc, oldflags, pn, argNode);
                if (!argNode)
                    return JS_FALSE;
                if (listNode->pn_count > 1 ||
                    js_PeekToken(cx, ts) == TOK_COMMA) {
                    js_ReportCompileErrorNumber(cx, ts, argNode, JSREPORT_ERROR,
                                                JSMSG_BAD_GENERATOR_SYNTAX,
                                                js_generator_str);
                    return JS_FALSE;
                }
            }
#endif
            PN_APPEND(listNode, argNode);
        } while (js_MatchToken(cx, ts, TOK_COMMA));

        if (js_GetToken(cx, ts) != TOK_RP) {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_PAREN_AFTER_ARGS);
            return JS_FALSE;
        }
    }
    return JS_TRUE;
}

static JSParseNode *
MemberExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
           JSBool allowCallSyntax)
{
    JSParseNode *pn, *pn2, *pn3;
    JSTokenType tt;

    JS_CHECK_RECURSION(cx, return NULL);

    /* Check for new expression first. */
    ts->flags |= TSF_OPERAND;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_OPERAND;
    if (tt == TOK_NEW) {
        pn = NewParseNode(cx, ts, PN_LIST, tc);
        if (!pn)
            return NULL;
        pn2 = MemberExpr(cx, ts, tc, JS_FALSE);
        if (!pn2)
            return NULL;
        pn->pn_op = JSOP_NEW;
        PN_INIT_LIST_1(pn, pn2);
        pn->pn_pos.begin = pn2->pn_pos.begin;

        if (js_MatchToken(cx, ts, TOK_LP) && !ArgumentList(cx, ts, tc, pn))
            return NULL;
        if (pn->pn_count > ARGC_LIMIT) {
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_TOO_MANY_CON_ARGS);
            return NULL;
        }
        pn->pn_pos.end = PN_LAST(pn)->pn_pos.end;
    } else {
        pn = PrimaryExpr(cx, ts, tc, tt, JS_FALSE);
        if (!pn)
            return NULL;

        if (pn->pn_type == TOK_ANYNAME ||
            pn->pn_type == TOK_AT ||
            pn->pn_type == TOK_DBLCOLON) {
            pn2 = NewOrRecycledNode(cx, tc);
            if (!pn2)
                return NULL;
            pn2->pn_type = TOK_UNARYOP;
            pn2->pn_pos = pn->pn_pos;
            pn2->pn_op = JSOP_XMLNAME;
            pn2->pn_arity = PN_UNARY;
            pn2->pn_kid = pn;
            pn = pn2;
        }
    }

    while ((tt = js_GetToken(cx, ts)) > TOK_EOF) {
        if (tt == TOK_DOT) {
            pn2 = NewParseNode(cx, ts, PN_NAME, tc);
            if (!pn2)
                return NULL;
            pn2->pn_slot = -1;
#if JS_HAS_XML_SUPPORT
            ts->flags |= TSF_OPERAND | TSF_KEYWORD_IS_NAME;
            tt = js_GetToken(cx, ts);
            ts->flags &= ~(TSF_OPERAND | TSF_KEYWORD_IS_NAME);
            pn3 = PrimaryExpr(cx, ts, tc, tt, JS_TRUE);
            if (!pn3)
                return NULL;
            tt = PN_TYPE(pn3);
            if (tt == TOK_NAME) {
                pn2->pn_op = JSOP_GETPROP;
                pn2->pn_expr = pn;
                pn2->pn_atom = pn3->pn_atom;
                RecycleTree(pn3, tc);
            } else {
                if (TOKEN_TYPE_IS_XML(tt)) {
                    pn2->pn_type = TOK_LB;
                    pn2->pn_op = JSOP_GETELEM;
                } else if (tt == TOK_RP) {
                    JSParseNode *group = pn3;

                    /* Recycle the useless TOK_RP node. */
                    pn3 = group->pn_kid;
                    group->pn_kid = NULL;
                    RecycleTree(group, tc);
                    pn2->pn_type = TOK_FILTER;
                    pn2->pn_op = JSOP_FILTER;

                    /* A filtering predicate is like a with statement. */
                    tc->flags |= TCF_FUN_HEAVYWEIGHT;
                } else {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_NAME_AFTER_DOT);
                    return NULL;
                }
                pn2->pn_arity = PN_BINARY;
                pn2->pn_left = pn;
                pn2->pn_right = pn3;
            }
#else
            ts->flags |= TSF_KEYWORD_IS_NAME;
            MUST_MATCH_TOKEN(TOK_NAME, JSMSG_NAME_AFTER_DOT);
            ts->flags &= ~TSF_KEYWORD_IS_NAME;
            pn2->pn_op = JSOP_GETPROP;
            pn2->pn_expr = pn;
            pn2->pn_atom = CURRENT_TOKEN(ts).t_atom;
#endif
            pn2->pn_pos.begin = pn->pn_pos.begin;
            pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
#if JS_HAS_XML_SUPPORT
        } else if (tt == TOK_DBLDOT) {
            pn2 = NewParseNode(cx, ts, PN_BINARY, tc);
            if (!pn2)
                return NULL;
            ts->flags |= TSF_OPERAND | TSF_KEYWORD_IS_NAME;
            tt = js_GetToken(cx, ts);
            ts->flags &= ~(TSF_OPERAND | TSF_KEYWORD_IS_NAME);
            pn3 = PrimaryExpr(cx, ts, tc, tt, JS_TRUE);
            if (!pn3)
                return NULL;
            tt = PN_TYPE(pn3);
            if (tt == TOK_NAME) {
                pn3->pn_type = TOK_STRING;
                pn3->pn_arity = PN_NULLARY;
                pn3->pn_op = JSOP_QNAMEPART;
            } else if (!TOKEN_TYPE_IS_XML(tt)) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_NAME_AFTER_DOT);
                return NULL;
            }
            pn2->pn_op = JSOP_DESCENDANTS;
            pn2->pn_left = pn;
            pn2->pn_right = pn3;
            pn2->pn_pos.begin = pn->pn_pos.begin;
            pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
#endif
        } else if (tt == TOK_LB) {
            pn2 = NewParseNode(cx, ts, PN_BINARY, tc);
            if (!pn2)
                return NULL;
            pn3 = Expr(cx, ts, tc);
            if (!pn3)
                return NULL;

            MUST_MATCH_TOKEN(TOK_RB, JSMSG_BRACKET_IN_INDEX);
            pn2->pn_pos.begin = pn->pn_pos.begin;
            pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;

            /*
             * Optimize o['p'] to o.p by rewriting pn2, but avoid rewriting
             * o['0'] to use JSOP_GETPROP, to keep fast indexing disjoint in
             * the interpreter from fast property access. However, if the
             * bracketed string is a uint32, we rewrite pn3 to be a number
             * instead of a string.
             */
            do {
                if (pn3->pn_type == TOK_STRING) {
                    jsuint index;

                    if (!js_IdIsIndex(ATOM_TO_JSID(pn3->pn_atom), &index)) {
                        pn2->pn_type = TOK_DOT;
                        pn2->pn_op = JSOP_GETPROP;
                        pn2->pn_arity = PN_NAME;
                        pn2->pn_expr = pn;
                        pn2->pn_atom = pn3->pn_atom;
                        break;
                    }
                    pn3->pn_type = TOK_NUMBER;
                    pn3->pn_op = JSOP_DOUBLE;
                    pn3->pn_dval = index;
                }
                pn2->pn_op = JSOP_GETELEM;
                pn2->pn_left = pn;
                pn2->pn_right = pn3;
            } while (0);
        } else if (allowCallSyntax && tt == TOK_LP) {
            pn2 = NewParseNode(cx, ts, PN_LIST, tc);
            if (!pn2)
                return NULL;

            pn2->pn_op = JSOP_CALL;
            if (pn->pn_op == JSOP_NAME &&
                pn->pn_atom == cx->runtime->atomState.evalAtom) {
                /* Pick JSOP_EVAL and flag tc as heavyweight if eval(...). */
                pn2->pn_op = JSOP_EVAL;
                tc->flags |= TCF_FUN_HEAVYWEIGHT;
            } else if (pn->pn_op == JSOP_GETPROP &&
                       (pn->pn_atom == cx->runtime->atomState.applyAtom ||
                        pn->pn_atom == cx->runtime->atomState.callAtom)) {
                /* Pick JSOP_APPLY if apply(...). */
                pn2->pn_op = JSOP_APPLY;
            } 

            PN_INIT_LIST_1(pn2, pn);
            pn2->pn_pos.begin = pn->pn_pos.begin;

            if (!ArgumentList(cx, ts, tc, pn2))
                return NULL;
            if (pn2->pn_count > ARGC_LIMIT) {
                JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                     JSMSG_TOO_MANY_FUN_ARGS);
                return NULL;
            }
            pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        } else {
            js_UngetToken(ts);
            return pn;
        }

        pn = pn2;
    }
    if (tt == TOK_ERROR)
        return NULL;
    return pn;
}

static JSParseNode *
BracketedExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    uintN oldflags;
    JSParseNode *pn;

    /*
     * Always accept the 'in' operator in a parenthesized expression,
     * where it's unambiguous, even if we might be parsing the init of a
     * for statement.
     */
    oldflags = tc->flags;
    tc->flags &= ~TCF_IN_FOR_INIT;
    pn = Expr(cx, ts, tc);
    tc->flags = oldflags | (tc->flags & TCF_FUN_FLAGS);
    return pn;
}

#if JS_HAS_XML_SUPPORT

static JSParseNode *
EndBracketedExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = BracketedExpr(cx, ts, tc);
    if (!pn)
        return NULL;

    MUST_MATCH_TOKEN(TOK_RB, JSMSG_BRACKET_AFTER_ATTR_EXPR);
    return pn;
}

/*
 * From the ECMA-357 grammar in 11.1.1 and 11.1.2:
 *
 *      AttributeIdentifier:
 *              @ PropertySelector
 *              @ QualifiedIdentifier
 *              @ [ Expression ]
 *
 *      PropertySelector:
 *              Identifier
 *              *
 *
 *      QualifiedIdentifier:
 *              PropertySelector :: PropertySelector
 *              PropertySelector :: [ Expression ]
 *
 * We adapt AttributeIdentifier and QualifiedIdentier to be LL(1), like so:
 *
 *      AttributeIdentifier:
 *              @ QualifiedIdentifier
 *              @ [ Expression ]
 *
 *      PropertySelector:
 *              Identifier
 *              *
 *
 *      QualifiedIdentifier:
 *              PropertySelector :: PropertySelector
 *              PropertySelector :: [ Expression ]
 *              PropertySelector
 *
 * As PrimaryExpression: Identifier is in ECMA-262 and we want the semantics
 * for that rule to result in a name node, but ECMA-357 extends the grammar
 * to include PrimaryExpression: QualifiedIdentifier, we must factor further:
 *
 *      QualifiedIdentifier:
 *              PropertySelector QualifiedSuffix
 *
 *      QualifiedSuffix:
 *              :: PropertySelector
 *              :: [ Expression ]
 *              /nothing/
 *
 * And use this production instead of PrimaryExpression: QualifiedIdentifier:
 *
 *      PrimaryExpression:
 *              Identifier QualifiedSuffix
 *
 * We hoist the :: match into callers of QualifiedSuffix, in order to tweak
 * PropertySelector vs. Identifier pn_arity, pn_op, and other members.
 */
static JSParseNode *
PropertySelector(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = NewParseNode(cx, ts, PN_NULLARY, tc);
    if (!pn)
        return NULL;
    if (pn->pn_type == TOK_STAR) {
        pn->pn_type = TOK_ANYNAME;
        pn->pn_op = JSOP_ANYNAME;
        pn->pn_atom = cx->runtime->atomState.starAtom;
    } else {
        JS_ASSERT(pn->pn_type == TOK_NAME);
        pn->pn_op = JSOP_QNAMEPART;
        pn->pn_arity = PN_NAME;
        pn->pn_atom = CURRENT_TOKEN(ts).t_atom;
        pn->pn_slot = -1;
    }
    return pn;
}

static JSParseNode *
QualifiedSuffix(JSContext *cx, JSTokenStream *ts, JSParseNode *pn,
                JSTreeContext *tc)
{
    JSParseNode *pn2, *pn3;
    JSTokenType tt;

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_DBLCOLON);
    pn2 = NewParseNode(cx, ts, PN_NAME, tc);
    if (!pn2)
        return NULL;

    /* Left operand of :: must be evaluated if it is an identifier. */
    if (pn->pn_op == JSOP_QNAMEPART)
        pn->pn_op = JSOP_NAME;

    ts->flags |= TSF_KEYWORD_IS_NAME;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_KEYWORD_IS_NAME;
    if (tt == TOK_STAR || tt == TOK_NAME) {
        /* Inline and specialize PropertySelector for JSOP_QNAMECONST. */
        pn2->pn_op = JSOP_QNAMECONST;
        pn2->pn_atom = (tt == TOK_STAR)
                       ? cx->runtime->atomState.starAtom
                       : CURRENT_TOKEN(ts).t_atom;
        pn2->pn_expr = pn;
        pn2->pn_slot = -1;
        return pn2;
    }

    if (tt != TOK_LB) {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_SYNTAX_ERROR);
        return NULL;
    }
    pn3 = EndBracketedExpr(cx, ts, tc);
    if (!pn3)
        return NULL;

    pn2->pn_op = JSOP_QNAME;
    pn2->pn_arity = PN_BINARY;
    pn2->pn_left = pn;
    pn2->pn_right = pn3;
    return pn2;
}

static JSParseNode *
QualifiedIdentifier(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;

    pn = PropertySelector(cx, ts, tc);
    if (!pn)
        return NULL;
    if (js_MatchToken(cx, ts, TOK_DBLCOLON))
        pn = QualifiedSuffix(cx, ts, pn, tc);
    return pn;
}

static JSParseNode *
AttributeIdentifier(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2;
    JSTokenType tt;

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_AT);
    pn = NewParseNode(cx, ts, PN_UNARY, tc);
    if (!pn)
        return NULL;
    pn->pn_op = JSOP_TOATTRNAME;
    ts->flags |= TSF_KEYWORD_IS_NAME;
    tt = js_GetToken(cx, ts);
    ts->flags &= ~TSF_KEYWORD_IS_NAME;
    if (tt == TOK_STAR || tt == TOK_NAME) {
        pn2 = QualifiedIdentifier(cx, ts, tc);
    } else if (tt == TOK_LB) {
        pn2 = EndBracketedExpr(cx, ts, tc);
    } else {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_SYNTAX_ERROR);
        return NULL;
    }
    if (!pn2)
        return NULL;
    pn->pn_kid = pn2;
    return pn;
}

/*
 * Make a TOK_LC unary node whose pn_kid is an expression.
 */
static JSParseNode *
XMLExpr(JSContext *cx, JSTokenStream *ts, JSBool inTag, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2;
    uintN oldflags;

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_LC);
    pn = NewParseNode(cx, ts, PN_UNARY, tc);
    if (!pn)
        return NULL;

    /*
     * Turn off XML tag mode, but don't restore it after parsing this braced
     * expression.  Instead, simply restore ts's old flags.  This is required
     * because XMLExpr is called both from within a tag, and from within text
     * contained in an element, but outside of any start, end, or point tag.
     */
    oldflags = ts->flags;
    ts->flags = oldflags & ~TSF_XMLTAGMODE;
    pn2 = Expr(cx, ts, tc);
    if (!pn2)
        return NULL;

    MUST_MATCH_TOKEN(TOK_RC, JSMSG_CURLY_IN_XML_EXPR);
    ts->flags = oldflags;
    pn->pn_kid = pn2;
    pn->pn_op = inTag ? JSOP_XMLTAGEXPR : JSOP_XMLELTEXPR;
    return pn;
}

/*
 * Make a terminal node for one of TOK_XMLNAME, TOK_XMLATTR, TOK_XMLSPACE,
 * TOK_XMLTEXT, TOK_XMLCDATA, TOK_XMLCOMMENT, or TOK_XMLPI.  When converting
 * parse tree to XML, we preserve a TOK_XMLSPACE node only if it's the sole
 * child of a container tag.
 */
static JSParseNode *
XMLAtomNode(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn;
    JSToken *tp;

    pn = NewParseNode(cx, ts, PN_NULLARY, tc);
    if (!pn)
        return NULL;
    tp = &CURRENT_TOKEN(ts);
    pn->pn_op = tp->t_op;
    pn->pn_atom = tp->t_atom;
    if (tp->type == TOK_XMLPI)
        pn->pn_atom2 = tp->t_atom2;
    return pn;
}

/*
 * Parse the productions:
 *
 *      XMLNameExpr:
 *              XMLName XMLNameExpr?
 *              { Expr } XMLNameExpr?
 *
 * Return a PN_LIST, PN_UNARY, or PN_NULLARY according as XMLNameExpr produces
 * a list of names and/or expressions, a single expression, or a single name.
 * If PN_LIST or PN_NULLARY, pn_type will be TOK_XMLNAME; if PN_UNARY, pn_type
 * will be TOK_LC.
 */
static JSParseNode *
XMLNameExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc)
{
    JSParseNode *pn, *pn2, *list;
    JSTokenType tt;

    pn = list = NULL;
    do {
        tt = CURRENT_TOKEN(ts).type;
        if (tt == TOK_LC) {
            pn2 = XMLExpr(cx, ts, JS_TRUE, tc);
            if (!pn2)
                return NULL;
        } else {
            JS_ASSERT(tt == TOK_XMLNAME);
            pn2 = XMLAtomNode(cx, ts, tc);
            if (!pn2)
                return NULL;
        }

        if (!pn) {
            pn = pn2;
        } else {
            if (!list) {
                list = NewParseNode(cx, ts, PN_LIST, tc);
                if (!list)
                    return NULL;
                list->pn_type = TOK_XMLNAME;
                list->pn_pos.begin = pn->pn_pos.begin;
                PN_INIT_LIST_1(list, pn);
                list->pn_extra = PNX_CANTFOLD;
                pn = list;
            }
            pn->pn_pos.end = pn2->pn_pos.end;
            PN_APPEND(pn, pn2);
        }
    } while ((tt = js_GetToken(cx, ts)) == TOK_XMLNAME || tt == TOK_LC);

    js_UngetToken(ts);
    return pn;
}

/*
 * Macro to test whether an XMLNameExpr or XMLTagContent node can be folded
 * at compile time into a JSXML tree.
 */
#define XML_FOLDABLE(pn)        ((pn)->pn_arity == PN_LIST                    \
                                 ? ((pn)->pn_extra & PNX_CANTFOLD) == 0       \
                                 : (pn)->pn_type != TOK_LC)

/*
 * Parse the productions:
 *
 *      XMLTagContent:
 *              XMLNameExpr
 *              XMLTagContent S XMLNameExpr S? = S? XMLAttr
 *              XMLTagContent S XMLNameExpr S? = S? { Expr }
 *
 * Return a PN_LIST, PN_UNARY, or PN_NULLARY according to how XMLTagContent
 * produces a list of name and attribute values and/or braced expressions, a
 * single expression, or a single name.
 *
 * If PN_LIST or PN_NULLARY, pn_type will be TOK_XMLNAME for the case where
 * XMLTagContent: XMLNameExpr.  If pn_type is not TOK_XMLNAME but pn_arity is
 * PN_LIST, pn_type will be tagtype.  If PN_UNARY, pn_type will be TOK_LC and
 * we parsed exactly one expression.
 */
static JSParseNode *
XMLTagContent(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
              JSTokenType tagtype, JSAtom **namep)
{
    JSParseNode *pn, *pn2, *list;
    JSTokenType tt;

    pn = XMLNameExpr(cx, ts, tc);
    if (!pn)
        return NULL;
    *namep = (pn->pn_arity == PN_NULLARY) ? pn->pn_atom : NULL;
    list = NULL;

    while (js_MatchToken(cx, ts, TOK_XMLSPACE)) {
        tt = js_GetToken(cx, ts);
        if (tt != TOK_XMLNAME && tt != TOK_LC) {
            js_UngetToken(ts);
            break;
        }

        pn2 = XMLNameExpr(cx, ts, tc);
        if (!pn2)
            return NULL;
        if (!list) {
            list = NewParseNode(cx, ts, PN_LIST, tc);
            if (!list)
                return NULL;
            list->pn_type = tagtype;
            list->pn_pos.begin = pn->pn_pos.begin;
            PN_INIT_LIST_1(list, pn);
            pn = list;
        }
        PN_APPEND(pn, pn2);
        if (!XML_FOLDABLE(pn2))
            pn->pn_extra |= PNX_CANTFOLD;

        js_MatchToken(cx, ts, TOK_XMLSPACE);
        MUST_MATCH_TOKEN(TOK_ASSIGN, JSMSG_NO_ASSIGN_IN_XML_ATTR);
        js_MatchToken(cx, ts, TOK_XMLSPACE);

        tt = js_GetToken(cx, ts);
        if (tt == TOK_XMLATTR) {
            pn2 = XMLAtomNode(cx, ts, tc);
        } else if (tt == TOK_LC) {
            pn2 = XMLExpr(cx, ts, JS_TRUE, tc);
            pn->pn_extra |= PNX_CANTFOLD;
        } else {
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_XML_ATTR_VALUE);
            return NULL;
        }
        if (!pn2)
            return NULL;
        pn->pn_pos.end = pn2->pn_pos.end;
        PN_APPEND(pn, pn2);
    }

    return pn;
}

#define XML_CHECK_FOR_ERROR_AND_EOF(tt,result)                                \
    JS_BEGIN_MACRO                                                            \
        if ((tt) <= TOK_EOF) {                                                \
            if ((tt) == TOK_EOF) {                                            \
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,     \
                                            JSMSG_END_OF_XML_SOURCE);         \
            }                                                                 \
            return result;                                                    \
        }                                                                     \
    JS_END_MACRO

static JSParseNode *
XMLElementOrList(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                 JSBool allowList);

/*
 * Consume XML element tag content, including the TOK_XMLETAGO (</) sequence
 * that opens the end tag for the container.
 */
static JSBool
XMLElementContent(JSContext *cx, JSTokenStream *ts, JSParseNode *pn,
                  JSTreeContext *tc)
{
    JSTokenType tt;
    JSParseNode *pn2;
    JSAtom *textAtom;

    ts->flags &= ~TSF_XMLTAGMODE;
    for (;;) {
        ts->flags |= TSF_XMLTEXTMODE;
        tt = js_GetToken(cx, ts);
        ts->flags &= ~TSF_XMLTEXTMODE;
        XML_CHECK_FOR_ERROR_AND_EOF(tt, JS_FALSE);

        JS_ASSERT(tt == TOK_XMLSPACE || tt == TOK_XMLTEXT);
        textAtom = CURRENT_TOKEN(ts).t_atom;
        if (textAtom) {
            /* Non-zero-length XML text scanned. */
            pn2 = XMLAtomNode(cx, ts, tc);
            if (!pn2)
                return JS_FALSE;
            pn->pn_pos.end = pn2->pn_pos.end;
            PN_APPEND(pn, pn2);
        }

        ts->flags |= TSF_OPERAND;
        tt = js_GetToken(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        XML_CHECK_FOR_ERROR_AND_EOF(tt, JS_FALSE);
        if (tt == TOK_XMLETAGO)
            break;

        if (tt == TOK_LC) {
            pn2 = XMLExpr(cx, ts, JS_FALSE, tc);
            pn->pn_extra |= PNX_CANTFOLD;
        } else if (tt == TOK_XMLSTAGO) {
            pn2 = XMLElementOrList(cx, ts, tc, JS_FALSE);
            if (pn2) {
                pn2->pn_extra &= ~PNX_XMLROOT;
                pn->pn_extra |= pn2->pn_extra;
            }
        } else {
            JS_ASSERT(tt == TOK_XMLCDATA || tt == TOK_XMLCOMMENT ||
                      tt == TOK_XMLPI);
            pn2 = XMLAtomNode(cx, ts, tc);
        }
        if (!pn2)
            return JS_FALSE;
        pn->pn_pos.end = pn2->pn_pos.end;
        PN_APPEND(pn, pn2);
    }

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_XMLETAGO);
    ts->flags |= TSF_XMLTAGMODE;
    return JS_TRUE;
}

/*
 * Return a PN_LIST node containing an XML or XMLList Initialiser.
 */
static JSParseNode *
XMLElementOrList(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                 JSBool allowList)
{
    JSParseNode *pn, *pn2, *list;
    JSTokenType tt;
    JSAtom *startAtom, *endAtom;

    JS_CHECK_RECURSION(cx, return NULL);

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_XMLSTAGO);
    pn = NewParseNode(cx, ts, PN_LIST, tc);
    if (!pn)
        return NULL;

    ts->flags |= TSF_XMLTAGMODE;
    tt = js_GetToken(cx, ts);
    if (tt == TOK_ERROR)
        return NULL;

    if (tt == TOK_XMLNAME || tt == TOK_LC) {
        /*
         * XMLElement.  Append the tag and its contents, if any, to pn.
         */
        pn2 = XMLTagContent(cx, ts, tc, TOK_XMLSTAGO, &startAtom);
        if (!pn2)
            return NULL;
        js_MatchToken(cx, ts, TOK_XMLSPACE);

        tt = js_GetToken(cx, ts);
        if (tt == TOK_XMLPTAGC) {
            /* Point tag (/>): recycle pn if pn2 is a list of tag contents. */
            if (pn2->pn_type == TOK_XMLSTAGO) {
                PN_INIT_LIST(pn);
                RecycleTree(pn, tc);
                pn = pn2;
            } else {
                JS_ASSERT(pn2->pn_type == TOK_XMLNAME ||
                          pn2->pn_type == TOK_LC);
                PN_INIT_LIST_1(pn, pn2);
                if (!XML_FOLDABLE(pn2))
                    pn->pn_extra |= PNX_CANTFOLD;
            }
            pn->pn_type = TOK_XMLPTAGC;
            pn->pn_extra |= PNX_XMLROOT;
        } else {
            /* We had better have a tag-close (>) at this point. */
            if (tt != TOK_XMLTAGC) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_XML_TAG_SYNTAX);
                return NULL;
            }
            pn2->pn_pos.end = CURRENT_TOKEN(ts).pos.end;

            /* Make sure pn2 is a TOK_XMLSTAGO list containing tag contents. */
            if (pn2->pn_type != TOK_XMLSTAGO) {
                PN_INIT_LIST_1(pn, pn2);
                if (!XML_FOLDABLE(pn2))
                    pn->pn_extra |= PNX_CANTFOLD;
                pn2 = pn;
                pn = NewParseNode(cx, ts, PN_LIST, tc);
                if (!pn)
                    return NULL;
            }

            /* Now make pn a nominal-root TOK_XMLELEM list containing pn2. */
            pn->pn_type = TOK_XMLELEM;
            PN_INIT_LIST_1(pn, pn2);
            if (!XML_FOLDABLE(pn2))
                pn->pn_extra |= PNX_CANTFOLD;
            pn->pn_extra |= PNX_XMLROOT;

            /* Get element contents and delimiting end-tag-open sequence. */
            if (!XMLElementContent(cx, ts, pn, tc))
                return NULL;

            tt = js_GetToken(cx, ts);
            XML_CHECK_FOR_ERROR_AND_EOF(tt, NULL);
            if (tt != TOK_XMLNAME && tt != TOK_LC) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_XML_TAG_SYNTAX);
                return NULL;
            }

            /* Parse end tag; check mismatch at compile-time if we can. */
            pn2 = XMLTagContent(cx, ts, tc, TOK_XMLETAGO, &endAtom);
            if (!pn2)
                return NULL;
            if (pn2->pn_type == TOK_XMLETAGO) {
                /* Oops, end tag has attributes! */
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_XML_TAG_SYNTAX);
                return NULL;
            }
            if (endAtom && startAtom && endAtom != startAtom) {
                JSString *str = ATOM_TO_STRING(startAtom);

                /* End vs. start tag name mismatch: point to the tag name. */
                js_ReportCompileErrorNumber(cx, ts, pn2,
                                            JSREPORT_UC | JSREPORT_ERROR,
                                            JSMSG_XML_TAG_NAME_MISMATCH,
                                            JSSTRING_CHARS(str));
                return NULL;
            }

            /* Make a TOK_XMLETAGO list with pn2 as its single child. */
            JS_ASSERT(pn2->pn_type == TOK_XMLNAME || pn2->pn_type == TOK_LC);
            list = NewParseNode(cx, ts, PN_LIST, tc);
            if (!list)
                return NULL;
            list->pn_type = TOK_XMLETAGO;
            PN_INIT_LIST_1(list, pn2);
            PN_APPEND(pn, list);
            if (!XML_FOLDABLE(pn2)) {
                list->pn_extra |= PNX_CANTFOLD;
                pn->pn_extra |= PNX_CANTFOLD;
            }

            js_MatchToken(cx, ts, TOK_XMLSPACE);
            MUST_MATCH_TOKEN(TOK_XMLTAGC, JSMSG_BAD_XML_TAG_SYNTAX);
        }

        /* Set pn_op now that pn has been updated to its final value. */
        pn->pn_op = JSOP_TOXML;
    } else if (allowList && tt == TOK_XMLTAGC) {
        /* XMLList Initialiser. */
        pn->pn_type = TOK_XMLLIST;
        pn->pn_op = JSOP_TOXMLLIST;
        PN_INIT_LIST(pn);
        pn->pn_extra |= PNX_XMLROOT;
        if (!XMLElementContent(cx, ts, pn, tc))
            return NULL;

        MUST_MATCH_TOKEN(TOK_XMLTAGC, JSMSG_BAD_XML_LIST_SYNTAX);
    } else {
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_XML_NAME_SYNTAX);
        return NULL;
    }

    pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
    ts->flags &= ~TSF_XMLTAGMODE;
    return pn;
}

static JSParseNode *
XMLElementOrListRoot(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
                     JSBool allowList)
{
    uint32 oldopts;
    JSParseNode *pn;

    /*
     * Force XML support to be enabled so that comments and CDATA literals
     * are recognized, instead of <! followed by -- starting an HTML comment
     * to end of line (used in script tags to hide content from old browsers
     * that don't recognize <script>).
     */
    oldopts = JS_SetOptions(cx, cx->options | JSOPTION_XML);
    pn = XMLElementOrList(cx, ts, tc, allowList);
    JS_SetOptions(cx, oldopts);
    return pn;
}

JS_FRIEND_API(JSParseNode *)
js_ParseXMLText(JSContext *cx, JSObject *chain, JSParseContext *pc,
                JSBool allowList)
{
    JSParseNode *pn;
    JSTreeContext tc;
    JSTokenType tt;

    /*
     * Push a compiler frame if we have no frames, or if the top frame is a
     * lightweight function activation, or if its scope chain doesn't match
     * the one passed to us.
     */
    TREE_CONTEXT_INIT(&tc, pc);
    tc.u.scopeChain = chain;

    /* Set XML-only mode to turn off special treatment of {expr} in XML. */
    TS(pc)->flags |= TSF_OPERAND | TSF_XMLONLYMODE;
    tt = js_GetToken(cx, TS(pc));
    TS(pc)->flags &= ~TSF_OPERAND;

    if (tt != TOK_XMLSTAGO) {
        js_ReportCompileErrorNumber(cx, TS(pc), NULL, JSREPORT_ERROR,
                                    JSMSG_BAD_XML_MARKUP);
        pn = NULL;
    } else {
        pn = XMLElementOrListRoot(cx, TS(pc), &tc, allowList);
    }

    TS(pc)->flags &= ~TSF_XMLONLYMODE;
    TREE_CONTEXT_FINISH(cx, &tc);
    return pn;
}

#endif /* JS_HAS_XMLSUPPORT */

static JSParseNode *
PrimaryExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
            JSTokenType tt, JSBool afterDot)
{
    JSParseNode *pn, *pn2, *pn3;
    JSOp op;
#if JS_HAS_SHARP_VARS
    JSParseNode *defsharp;
    JSBool notsharp;
#endif

    JS_CHECK_RECURSION(cx, return NULL);

#if JS_HAS_SHARP_VARS
    defsharp = NULL;
    notsharp = JS_FALSE;
  again:
    /*
     * Control flows here after #n= is scanned.  If the following primary is
     * not valid after such a "sharp variable" definition, the tt switch case
     * should set notsharp.
     */
#endif

#if JS_HAS_GETTER_SETTER
    if (tt == TOK_NAME) {
        tt = CheckGetterOrSetter(cx, ts, TOK_FUNCTION);
        if (tt == TOK_ERROR)
            return NULL;
    }
#endif

    switch (tt) {
      case TOK_FUNCTION:
#if JS_HAS_XML_SUPPORT
        ts->flags |= TSF_KEYWORD_IS_NAME;
        if (js_MatchToken(cx, ts, TOK_DBLCOLON)) {
            ts->flags &= ~TSF_KEYWORD_IS_NAME;
            pn2 = NewParseNode(cx, ts, PN_NULLARY, tc);
            if (!pn2)
                return NULL;
            pn2->pn_type = TOK_FUNCTION;
            pn = QualifiedSuffix(cx, ts, pn2, tc);
            if (!pn)
                return NULL;
            break;
        }
        ts->flags &= ~TSF_KEYWORD_IS_NAME;
#endif
        pn = FunctionExpr(cx, ts, tc);
        if (!pn)
            return NULL;
        break;

      case TOK_LB:
      {
        JSBool matched;
        jsuint index;

        pn = NewParseNode(cx, ts, PN_LIST, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_RB;
        pn->pn_op = JSOP_NEWINIT;

#if JS_HAS_SHARP_VARS
        if (defsharp) {
            PN_INIT_LIST_1(pn, defsharp);
            defsharp = NULL;
        } else
#endif
            PN_INIT_LIST(pn);

        ts->flags |= TSF_OPERAND;
        matched = js_MatchToken(cx, ts, TOK_RB);
        ts->flags &= ~TSF_OPERAND;
        if (!matched) {
            for (index = 0; ; index++) {
                if (index == ARRAY_INIT_LIMIT) {
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_ARRAY_INIT_TOO_BIG);
                    return NULL;
                }

                ts->flags |= TSF_OPERAND;
                tt = js_PeekToken(cx, ts);
                ts->flags &= ~TSF_OPERAND;
                if (tt == TOK_RB) {
                    pn->pn_extra |= PNX_ENDCOMMA;
                    break;
                }

                if (tt == TOK_COMMA) {
                    /* So CURRENT_TOKEN gets TOK_COMMA and not TOK_LB. */
                    js_MatchToken(cx, ts, TOK_COMMA);
                    pn2 = NewParseNode(cx, ts, PN_NULLARY, tc);
                } else {
                    pn2 = AssignExpr(cx, ts, tc);
                }
                if (!pn2)
                    return NULL;
                PN_APPEND(pn, pn2);

                if (tt != TOK_COMMA) {
                    /* If we didn't already match TOK_COMMA in above case. */
                    if (!js_MatchToken(cx, ts, TOK_COMMA))
                        break;
                }
            }

#if JS_HAS_GENERATORS
            /*
             * At this point, (index == 0 && pn->pn_count != 0) implies one
             * element initialiser was parsed (possibly with a defsharp before
             * the left bracket).
             *
             * An array comprehension of the form:
             *
             *   [i * j for (i in o) for (j in p) if (i != j)]
             *
             * translates to roughly the following let expression:
             *
             *   let (array = new Array, i, j) {
             *     for (i in o) let {
             *       for (j in p)
             *         if (i != j)
             *           array.push(i * j)
             *     }
             *     array
             *   }
             *
             * where array is a nameless block-local variable.  The "roughly"
             * means that an implementation may optimize away the array.push.
             * An array comprehension opens exactly one block scope, no matter
             * how many for heads it contains.
             *
             * Each let () {...} or for (let ...) ... compiles to:
             *
             *   JSOP_ENTERBLOCK <o> ... JSOP_LEAVEBLOCK <n>
             *
             * where <o> is a literal object representing the block scope,
             * with <n> properties, naming each var declared in the block.
             *
             * Each var declaration in a let-block binds a name in <o> at
             * compile time, and allocates a slot on the operand stack at
             * runtime via JSOP_ENTERBLOCK.  A block-local var is accessed
             * by the JSOP_GETLOCAL and JSOP_SETLOCAL ops, and iterated with
             * JSOP_FORLOCAL.  These ops all have an immediate operand, the
             * local slot's stack index from fp->spbase.
             *
             * The array comprehension iteration step, array.push(i * j) in
             * the example above, is done by <i * j>; JSOP_ARRAYCOMP <array>,
             * where <array> is the index of array's stack slot.
             */
            if (index == 0 &&
                pn->pn_count != 0 &&
                js_MatchToken(cx, ts, TOK_FOR)) {
                JSParseNode *pnexp, *pntop;

                /* Relabel pn as an array comprehension node. */
                pn->pn_type = TOK_ARRAYCOMP;

                /*
                 * Remove the comprehension expression from pn's linked list
                 * and save it via pnexp.  We'll re-install it underneath the
                 * ARRAYPUSH node after we parse the rest of the comprehension.
                 */
                pnexp = PN_LAST(pn);
                JS_ASSERT(pn->pn_count == 1 || pn->pn_count == 2);
                pn->pn_tail = (--pn->pn_count == 1)
                              ? &pn->pn_head->pn_next
                              : &pn->pn_head;
                *pn->pn_tail = NULL;

                pntop = ComprehensionTail(cx, ts, tc, TOK_ARRAYPUSH,
                                          JSOP_ARRAYPUSH, pnexp);
                if (!pntop)
                    return NULL;
                PN_APPEND(pn, pntop);
            }
#endif /* JS_HAS_GENERATORS */

            MUST_MATCH_TOKEN(TOK_RB, JSMSG_BRACKET_AFTER_LIST);
        }
        pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        return pn;
      }

      case TOK_LC:
      {
        JSBool afterComma;
        JSParseNode *pnval;

        pn = NewParseNode(cx, ts, PN_LIST, tc);
        if (!pn)
            return NULL;
        pn->pn_type = TOK_RC;
        pn->pn_op = JSOP_NEWINIT;

#if JS_HAS_SHARP_VARS
        if (defsharp) {
            PN_INIT_LIST_1(pn, defsharp);
            defsharp = NULL;
        } else
#endif
            PN_INIT_LIST(pn);

        afterComma = JS_FALSE;
        for (;;) {
            ts->flags |= TSF_KEYWORD_IS_NAME;
            tt = js_GetToken(cx, ts);
            ts->flags &= ~TSF_KEYWORD_IS_NAME;
            switch (tt) {
              case TOK_NUMBER:
                pn3 = NewParseNode(cx, ts, PN_NULLARY, tc);
                if (pn3)
                    pn3->pn_dval = CURRENT_TOKEN(ts).t_dval;
                break;
              case TOK_NAME:
#if JS_HAS_GETTER_SETTER
                {
                    JSAtom *atom;

                    atom = CURRENT_TOKEN(ts).t_atom;
                    if (atom == cx->runtime->atomState.getAtom)
                        op = JSOP_GETTER;
                    else if (atom == cx->runtime->atomState.setAtom)
                        op = JSOP_SETTER;
                    else
                        goto property_name;

                    ts->flags |= TSF_KEYWORD_IS_NAME;
                    tt = js_GetToken(cx, ts);
                    ts->flags &= ~TSF_KEYWORD_IS_NAME;
                    if (tt != TOK_NAME) {
                        js_UngetToken(ts);
                        goto property_name;
                    }
                    pn3 = NewParseNode(cx, ts, PN_NAME, tc);
                    if (!pn3)
                        return NULL;
                    pn3->pn_atom = CURRENT_TOKEN(ts).t_atom;
                    pn3->pn_slot = -1;

                    /* We have to fake a 'function' token here. */
                    CURRENT_TOKEN(ts).t_op = JSOP_NOP;
                    CURRENT_TOKEN(ts).type = TOK_FUNCTION;
                    pn2 = FunctionExpr(cx, ts, tc);
                    pn2 = NewBinary(cx, TOK_COLON, op, pn3, pn2, tc);
                    goto skip;
                }
              property_name:
#endif
              case TOK_STRING:
                pn3 = NewParseNode(cx, ts, PN_NULLARY, tc);
                if (pn3)
                    pn3->pn_atom = CURRENT_TOKEN(ts).t_atom;
                break;
              case TOK_RC:
                if (afterComma &&
                    !js_ReportCompileErrorNumber(cx, ts, NULL,
                                                 JSREPORT_WARNING |
                                                 JSREPORT_STRICT,
                                                 JSMSG_TRAILING_COMMA)) {
                        return NULL;
                }
                goto end_obj_init;
              default:
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_PROP_ID);
                return NULL;
            }

            tt = js_GetToken(cx, ts);
#if JS_HAS_GETTER_SETTER
            if (tt == TOK_NAME) {
                tt = CheckGetterOrSetter(cx, ts, TOK_COLON);
                if (tt == TOK_ERROR)
                    return NULL;
            }
#endif

            if (tt != TOK_COLON) {
#if JS_HAS_DESTRUCTURING_SHORTHAND
                if (tt != TOK_COMMA && tt != TOK_RC) {
#endif
                    js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                                JSMSG_COLON_AFTER_ID);
                    return NULL;
#if JS_HAS_DESTRUCTURING_SHORTHAND
                }

                /*
                 * Support, e.g., |var {x, y} = o| as destructuring shorthand
                 * for |var {x: x, y: y} = o|, per proposed JS2/ES4 for JS1.8.
                 */
                js_UngetToken(ts);
                pn->pn_extra |= PNX_SHORTHAND;
                pnval = pn3;
                if (pnval->pn_type == TOK_NAME) {
                    pnval->pn_arity = PN_NAME;
                    pnval->pn_expr = NULL;
                    pnval->pn_slot = -1;
                    pnval->pn_const = JS_FALSE;
                }
                op = JSOP_NOP;
#endif
            } else {
                op = CURRENT_TOKEN(ts).t_op;
                pnval = AssignExpr(cx, ts, tc);
            }

            pn2 = NewBinary(cx, TOK_COLON, op, pn3, pnval, tc);
#if JS_HAS_GETTER_SETTER
          skip:
#endif
            if (!pn2)
                return NULL;
            PN_APPEND(pn, pn2);

            tt = js_GetToken(cx, ts);
            if (tt == TOK_RC)
                goto end_obj_init;
            if (tt != TOK_COMMA) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_CURLY_AFTER_LIST);
                return NULL;
            }
            afterComma = JS_TRUE;
        }

      end_obj_init:
        pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        return pn;
      }

#if JS_HAS_BLOCK_SCOPE
      case TOK_LET:
        pn = LetBlock(cx, ts, tc, JS_FALSE);
        if (!pn)
            return NULL;
        break;
#endif

#if JS_HAS_SHARP_VARS
      case TOK_DEFSHARP:
        if (defsharp)
            goto badsharp;
        defsharp = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!defsharp)
            return NULL;
        defsharp->pn_num = (jsint) CURRENT_TOKEN(ts).t_dval;
        ts->flags |= TSF_OPERAND;
        tt = js_GetToken(cx, ts);
        ts->flags &= ~TSF_OPERAND;
        goto again;

      case TOK_USESHARP:
        /* Check for forward/dangling references at runtime, to allow eval. */
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        pn->pn_num = (jsint) CURRENT_TOKEN(ts).t_dval;
        notsharp = JS_TRUE;
        break;
#endif /* JS_HAS_SHARP_VARS */

      case TOK_LP:
      {
        JSBool genexp;

        pn = NewParseNode(cx, ts, PN_UNARY, tc);
        if (!pn)
            return NULL;
        pn2 = ParenExpr(cx, ts, tc, pn, &genexp);
        if (!pn2)
            return NULL;
        if (genexp)
            return pn2;

        MUST_MATCH_TOKEN(TOK_RP, JSMSG_PAREN_IN_PAREN);
        if (pn2->pn_type == TOK_RP ||
            (js_CodeSpec[pn2->pn_op].prec >= js_CodeSpec[JSOP_GETPROP].prec &&
             !afterDot)) {
            /*
             * Avoid redundant JSOP_GROUP opcodes, for efficiency and mainly
             * to help the decompiler look ahead from a JSOP_ENDINIT to see a
             * JSOP_GROUP followed by a POP or POPV.  That sequence means the
             * parentheses are mandatory, to disambiguate object initialisers
             * as expression statements from block statements.
             *
             * Also drop pn if pn2 is a member or a primary expression of any
             * kind.  This is required to avoid generating a JSOP_GROUP that
             * will null the |obj| interpreter register, causing |this| in any
             * call of that member expression to bind to the global object.
             */
            RecycleTree(pn, tc);
            pn = pn2;
        } else {
            pn->pn_type = TOK_RP;
            pn->pn_kid = pn2;
        }
        pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
        break;
      }

#if JS_HAS_XML_SUPPORT
      case TOK_STAR:
        pn = QualifiedIdentifier(cx, ts, tc);
        if (!pn)
            return NULL;
        notsharp = JS_TRUE;
        break;

      case TOK_AT:
        pn = AttributeIdentifier(cx, ts, tc);
        if (!pn)
            return NULL;
        notsharp = JS_TRUE;
        break;

      case TOK_XMLSTAGO:
        pn = XMLElementOrListRoot(cx, ts, tc, JS_TRUE);
        if (!pn)
            return NULL;
        notsharp = JS_TRUE;     /* XXXbe could be sharp? */
        break;
#endif /* JS_HAS_XML_SUPPORT */

      case TOK_STRING:
#if JS_HAS_SHARP_VARS
        notsharp = JS_TRUE;
        /* FALL THROUGH */
#endif

#if JS_HAS_XML_SUPPORT
      case TOK_XMLCDATA:
      case TOK_XMLCOMMENT:
      case TOK_XMLPI:
#endif
      case TOK_NAME:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        pn->pn_atom = CURRENT_TOKEN(ts).t_atom;
#if JS_HAS_XML_SUPPORT
        if (tt == TOK_XMLPI)
            pn->pn_atom2 = CURRENT_TOKEN(ts).t_atom2;
        else
#endif
            pn->pn_op = CURRENT_TOKEN(ts).t_op;
        if (tt == TOK_NAME) {
            pn->pn_arity = PN_NAME;
            pn->pn_slot = -1;

#if JS_HAS_XML_SUPPORT
            if (js_MatchToken(cx, ts, TOK_DBLCOLON)) {
                if (afterDot) {
                    JSString *str;

                    /*
                     * Here PrimaryExpr is called after '.' or '..' and we
                     * just scanned .name:: or ..name:: . This is the only
                     * case where a keyword after '.' or '..' is not
                     * treated as a property name.
                     */
                    str = ATOM_TO_STRING(pn->pn_atom);
                    tt = js_CheckKeyword(JSSTRING_CHARS(str),
                                         JSSTRING_LENGTH(str));
                    if (tt == TOK_FUNCTION) {
                        pn->pn_arity = PN_NULLARY;
                        pn->pn_type = TOK_FUNCTION;
                    } else if (tt != TOK_EOF) {
                        js_ReportCompileErrorNumber(
                            cx, ts, NULL, JSREPORT_ERROR,
                            JSMSG_KEYWORD_NOT_NS);
                        return NULL;
                    }
                }
                pn = QualifiedSuffix(cx, ts, pn, tc);
                if (!pn)
                    return NULL;
                break;
            }
#endif

            /* Unqualified __parent__ and __proto__ uses require activations. */
            if (pn->pn_atom == cx->runtime->atomState.parentAtom ||
                pn->pn_atom == cx->runtime->atomState.protoAtom) {
                tc->flags |= TCF_FUN_HEAVYWEIGHT;
            }
        }
        break;

      case TOK_REGEXP:
      {
        JSObject *obj;

        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;

        /* Token stream ensures that tokenbuf is NUL-terminated. */
        JS_ASSERT(*ts->tokenbuf.ptr == (jschar) 0);
        obj = js_NewRegExpObject(cx, ts,
                                 ts->tokenbuf.base,
                                 ts->tokenbuf.ptr - ts->tokenbuf.base,
                                 CURRENT_TOKEN(ts).t_reflags);
        if (!obj)
            return NULL;
        if (!(tc->flags & TCF_COMPILE_N_GO)) {
            STOBJ_CLEAR_PARENT(obj);
            STOBJ_CLEAR_PROTO(obj);
        }

        pn->pn_pob = js_NewParsedObjectBox(cx, tc->parseContext, obj);
        if (!pn->pn_pob)
            return NULL;

        pn->pn_op = JSOP_REGEXP;
        break;
      }

      case TOK_NUMBER:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        pn->pn_op = JSOP_DOUBLE;
        pn->pn_dval = CURRENT_TOKEN(ts).t_dval;
#if JS_HAS_SHARP_VARS
        notsharp = JS_TRUE;
#endif
        break;

      case TOK_PRIMARY:
        pn = NewParseNode(cx, ts, PN_NULLARY, tc);
        if (!pn)
            return NULL;
        pn->pn_op = CURRENT_TOKEN(ts).t_op;
#if JS_HAS_SHARP_VARS
        notsharp = JS_TRUE;
#endif
        break;

      case TOK_ERROR:
        /* The scanner or one of its subroutines reported the error. */
        return NULL;

      default:
        js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                    JSMSG_SYNTAX_ERROR);
        return NULL;
    }

#if JS_HAS_SHARP_VARS
    if (defsharp) {
        if (notsharp) {
  badsharp:
            js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                        JSMSG_BAD_SHARP_VAR_DEF);
            return NULL;
        }
        defsharp->pn_kid = pn;
        return defsharp;
    }
#endif
    return pn;
}

static JSParseNode *
ParenExpr(JSContext *cx, JSTokenStream *ts, JSTreeContext *tc,
          JSParseNode *pn1, JSBool *genexp)
{
    JSTokenPtr begin;
    JSParseNode *pn;
#if JS_HAS_GENERATOR_EXPRS
    uintN oldflags = tc->flags;
#endif

    JS_ASSERT(CURRENT_TOKEN(ts).type == TOK_LP);
    begin = CURRENT_TOKEN(ts).pos.begin;

    if (genexp)
        *genexp = JS_FALSE;
    pn = BracketedExpr(cx, ts, tc);
    if (!pn)
        return NULL;

#if JS_HAS_GENERATOR_EXPRS
    if (js_MatchToken(cx, ts, TOK_FOR)) {
        if (pn->pn_type == TOK_YIELD) {
            js_ReportCompileErrorNumber(cx, ts, pn, JSREPORT_ERROR,
                                        JSMSG_BAD_GENERATOR_SYNTAX,
                                        js_yield_str);
            return NULL;
        }
        if (pn->pn_type == TOK_COMMA) {
            js_ReportCompileErrorNumber(cx, ts, PN_LAST(pn), JSREPORT_ERROR,
                                        JSMSG_BAD_GENERATOR_SYNTAX,
                                        js_generator_str);
            return NULL;
        }
        if (!pn1) {
            pn1 = NewParseNode(cx, ts, PN_UNARY, tc);
            if (!pn1)
                return NULL;
        }
        pn->pn_pos.begin = begin;
        pn = GeneratorExpr(cx, ts, tc, oldflags, pn1, pn);
        if (!pn)
            return NULL;
        if (genexp) {
            if (js_GetToken(cx, ts) != TOK_RP) {
                js_ReportCompileErrorNumber(cx, ts, NULL, JSREPORT_ERROR,
                                            JSMSG_BAD_GENERATOR_SYNTAX,
                                            js_generator_str);
                return NULL;
            }
            pn->pn_pos.end = CURRENT_TOKEN(ts).pos.end;
            *genexp = JS_TRUE;
        }
    }
#endif /* JS_HAS_GENERATOR_EXPRS */

    return pn;
}

/*
 * Fold from one constant type to another.
 * XXX handles only strings and numbers for now
 */
static JSBool
FoldType(JSContext *cx, JSParseNode *pn, JSTokenType type)
{
    if (pn->pn_type != type) {
        switch (type) {
          case TOK_NUMBER:
            if (pn->pn_type == TOK_STRING) {
                jsdouble d;
                if (!JS_ValueToNumber(cx, ATOM_KEY(pn->pn_atom), &d))
                    return JS_FALSE;
                pn->pn_dval = d;
                pn->pn_type = TOK_NUMBER;
                pn->pn_op = JSOP_DOUBLE;
            }
            break;

          case TOK_STRING:
            if (pn->pn_type == TOK_NUMBER) {
                JSString *str = js_NumberToString(cx, pn->pn_dval);
                if (!str)
                    return JS_FALSE;
                pn->pn_atom = js_AtomizeString(cx, str, 0);
                if (!pn->pn_atom)
                    return JS_FALSE;
                pn->pn_type = TOK_STRING;
                pn->pn_op = JSOP_STRING;
            }
            break;

          default:;
        }
    }
    return JS_TRUE;
}

/*
 * Fold two numeric constants.  Beware that pn1 and pn2 are recycled, unless
 * one of them aliases pn, so you can't safely fetch pn2->pn_next, e.g., after
 * a successful call to this function.
 */
static JSBool
FoldBinaryNumeric(JSContext *cx, JSOp op, JSParseNode *pn1, JSParseNode *pn2,
                  JSParseNode *pn, JSTreeContext *tc)
{
    jsdouble d, d2;
    int32 i, j;

    JS_ASSERT(pn1->pn_type == TOK_NUMBER && pn2->pn_type == TOK_NUMBER);
    d = pn1->pn_dval;
    d2 = pn2->pn_dval;
    switch (op) {
      case JSOP_LSH:
      case JSOP_RSH:
        i = js_DoubleToECMAInt32(d);
        j = js_DoubleToECMAInt32(d2);
        j &= 31;
        d = (op == JSOP_LSH) ? i << j : i >> j;
        break;

      case JSOP_URSH:
        j = js_DoubleToECMAInt32(d2);
        j &= 31;
        d = js_DoubleToECMAUint32(d) >> j;
        break;

      case JSOP_ADD:
        d += d2;
        break;

      case JSOP_SUB:
        d -= d2;
        break;

      case JSOP_MUL:
        d *= d2;
        break;

      case JSOP_DIV:
        if (d2 == 0) {
#if defined(XP_WIN)
            /* XXX MSVC miscompiles such that (NaN == 0) */
            if (JSDOUBLE_IS_NaN(d2))
                d = *cx->runtime->jsNaN;
            else
#endif
            if (d == 0 || JSDOUBLE_IS_NaN(d))
                d = *cx->runtime->jsNaN;
            else if ((JSDOUBLE_HI32(d) ^ JSDOUBLE_HI32(d2)) >> 31)
                d = *cx->runtime->jsNegativeInfinity;
            else
                d = *cx->runtime->jsPositiveInfinity;
        } else {
            d /= d2;
        }
        break;

      case JSOP_MOD:
        if (d2 == 0) {
            d = *cx->runtime->jsNaN;
        } else {
#if defined(XP_WIN)
          /* Workaround MS fmod bug where 42 % (1/0) => NaN, not 42. */
          if (!(JSDOUBLE_IS_FINITE(d) && JSDOUBLE_IS_INFINITE(d2)))
#endif
            d = fmod(d, d2);
        }
        break;

      default:;
    }

    /* Take care to allow pn1 or pn2 to alias pn. */
    if (pn1 != pn)
        RecycleTree(pn1, tc);
    if (pn2 != pn)
        RecycleTree(pn2, tc);
    pn->pn_type = TOK_NUMBER;
    pn->pn_op = JSOP_DOUBLE;
    pn->pn_arity = PN_NULLARY;
    pn->pn_dval = d;
    return JS_TRUE;
}

#if JS_HAS_XML_SUPPORT

static JSBool
FoldXMLConstants(JSContext *cx, JSParseNode *pn, JSTreeContext *tc)
{
    JSTokenType tt;
    JSParseNode **pnp, *pn1, *pn2;
    JSString *accum, *str;
    uint32 i, j;
    JSTempValueRooter tvr;

    JS_ASSERT(pn->pn_arity == PN_LIST);
    tt = PN_TYPE(pn);
    pnp = &pn->pn_head;
    pn1 = *pnp;
    accum = NULL;
    if ((pn->pn_extra & PNX_CANTFOLD) == 0) {
        if (tt == TOK_XMLETAGO)
            accum = ATOM_TO_STRING(cx->runtime->atomState.etagoAtom);
        else if (tt == TOK_XMLSTAGO || tt == TOK_XMLPTAGC)
            accum = ATOM_TO_STRING(cx->runtime->atomState.stagoAtom);
    }

    /*
     * GC Rooting here is tricky: for most of the loop, |accum| is safe via
     * the newborn string root. However, when |pn2->pn_type| is TOK_XMLCDATA,
     * TOK_XMLCOMMENT, or TOK_XMLPI it is knocked out of the newborn root.
     * Therefore, we have to add additonal protection from GC nesting under
     * js_ConcatStrings.
     */
    for (pn2 = pn1, i = j = 0; pn2; pn2 = pn2->pn_next, i++) {
        /* The parser already rejected end-tags with attributes. */
        JS_ASSERT(tt != TOK_XMLETAGO || i == 0);
        switch (pn2->pn_type) {
          case TOK_XMLATTR:
            if (!accum)
                goto cantfold;
            /* FALL THROUGH */
          case TOK_XMLNAME:
          case TOK_XMLSPACE:
          case TOK_XMLTEXT:
          case TOK_STRING:
            if (pn2->pn_arity == PN_LIST)
                goto cantfold;
            str = ATOM_TO_STRING(pn2->pn_atom);
            break;

          case TOK_XMLCDATA:
            str = js_MakeXMLCDATAString(cx, ATOM_TO_STRING(pn2->pn_atom));
            if (!str)
                return JS_FALSE;
            break;

          case TOK_XMLCOMMENT:
            str = js_MakeXMLCommentString(cx, ATOM_TO_STRING(pn2->pn_atom));
            if (!str)
                return JS_FALSE;
            break;

          case TOK_XMLPI:
            str = js_MakeXMLPIString(cx, ATOM_TO_STRING(pn2->pn_atom),
                                         ATOM_TO_STRING(pn2->pn_atom2));
            if (!str)
                return JS_FALSE;
            break;

          cantfold:
          default:
            JS_ASSERT(*pnp == pn1);
            if ((tt == TOK_XMLSTAGO || tt == TOK_XMLPTAGC) &&
                (i & 1) ^ (j & 1)) {
#ifdef DEBUG_brendanXXX
                printf("1: %d, %d => ", i, j);
                if (accum)
                    js_FileEscapedString(stdout, accum, 0);
                else
                    fputs("NULL", stdout);
                fputc('\n', stdout);
#endif
            } else if (accum && pn1 != pn2) {
                while (pn1->pn_next != pn2) {
                    pn1 = RecycleTree(pn1, tc);
                    --pn->pn_count;
                }
                pn1->pn_type = TOK_XMLTEXT;
                pn1->pn_op = JSOP_STRING;
                pn1->pn_arity = PN_NULLARY;
                pn1->pn_atom = js_AtomizeString(cx, accum, 0);
                if (!pn1->pn_atom)
                    return JS_FALSE;
                JS_ASSERT(pnp != &pn1->pn_next);
                *pnp = pn1;
            }
            pnp = &pn2->pn_next;
            pn1 = *pnp;
            accum = NULL;
            continue;
        }

        if (accum) {
            JS_PUSH_TEMP_ROOT_STRING(cx, accum, &tvr);
            str = ((tt == TOK_XMLSTAGO || tt == TOK_XMLPTAGC) && i != 0)
                  ? js_AddAttributePart(cx, i & 1, accum, str)
                  : js_ConcatStrings(cx, accum, str);
            JS_POP_TEMP_ROOT(cx, &tvr);
            if (!str)
                return JS_FALSE;
#ifdef DEBUG_brendanXXX
            printf("2: %d, %d => ", i, j);
            js_FileEscapedString(stdout, str, 0);
            printf(" (%u)\n", JSSTRING_LENGTH(str));
#endif
            ++j;
        }
        accum = str;
    }

    if (accum) {
        str = NULL;
        if ((pn->pn_extra & PNX_CANTFOLD) == 0) {
            if (tt == TOK_XMLPTAGC)
                str = ATOM_TO_STRING(cx->runtime->atomState.ptagcAtom);
            else if (tt == TOK_XMLSTAGO || tt == TOK_XMLETAGO)
                str = ATOM_TO_STRING(cx->runtime->atomState.tagcAtom);
        }
        if (str) {
            accum = js_ConcatStrings(cx, accum, str);
            if (!accum)
                return JS_FALSE;
        }

        JS_ASSERT(*pnp == pn1);
        while (pn1->pn_next) {
            pn1 = RecycleTree(pn1, tc);
            --pn->pn_count;
        }
        pn1->pn_type = TOK_XMLTEXT;
        pn1->pn_op = JSOP_STRING;
        pn1->pn_arity = PN_NULLARY;
        pn1->pn_atom = js_AtomizeString(cx, accum, 0);
        if (!pn1->pn_atom)
            return JS_FALSE;
        JS_ASSERT(pnp != &pn1->pn_next);
        *pnp = pn1;
    }

    if (pn1 && pn->pn_count == 1) {
        /*
         * Only one node under pn, and it has been folded: move pn1 onto pn
         * unless pn is an XML root (in which case we need it to tell the code
         * generator to emit a JSOP_TOXML or JSOP_TOXMLLIST op).  If pn is an
         * XML root *and* it's a point-tag, rewrite it to TOK_XMLELEM to avoid
         * extra "<" and "/>" bracketing at runtime.
         */
        if (!(pn->pn_extra & PNX_XMLROOT)) {
            PN_MOVE_NODE(pn, pn1);
        } else if (tt == TOK_XMLPTAGC) {
            pn->pn_type = TOK_XMLELEM;
            pn->pn_op = JSOP_TOXML;
        }
    }
    return JS_TRUE;
}

#endif /* JS_HAS_XML_SUPPORT */

static JSBool
StartsWith(JSParseNode *pn, JSTokenType tt)
{
#define TAIL_RECURSE(pn2) JS_BEGIN_MACRO pn = (pn2); goto recur; JS_END_MACRO

recur:
    if (pn->pn_type == tt)
        return JS_TRUE;
    switch (pn->pn_arity) {
      case PN_FUNC:
        return  tt == TOK_FUNCTION;
      case PN_LIST:
        if (pn->pn_head)
            TAIL_RECURSE(pn->pn_head);
        break;
      case PN_TERNARY:
        if (pn->pn_kid1)
            TAIL_RECURSE(pn->pn_kid1);
        break;
      case PN_BINARY:
        if (pn->pn_left)
            TAIL_RECURSE(pn->pn_left);
        break;
      case PN_UNARY:
        /* A parenthesized expression starts with a left parenthesis. */
        if (pn->pn_type == TOK_RP)
            return tt == TOK_LP;
        if (pn->pn_kid)
            TAIL_RECURSE(pn->pn_kid);
        break;
      case PN_NAME:
        if (pn->pn_type == TOK_DOT || pn->pn_type == TOK_DBLDOT)
            TAIL_RECURSE(pn->pn_expr);
        /* FALL THROUGH */
    }
    return JS_FALSE;
#undef TAIL_RECURSE
}

static int
Boolish(JSParseNode *pn)
{
    switch (pn->pn_op) {
      case JSOP_DOUBLE:
        return pn->pn_dval != 0 && !JSDOUBLE_IS_NaN(pn->pn_dval);

      case JSOP_STRING:
        return JSSTRING_LENGTH(ATOM_TO_STRING(pn->pn_atom)) != 0;

#if JS_HAS_GENERATOR_EXPRS
      case JSOP_CALL:
      {
        /*
         * A generator expression as an if or loop condition has no effects, it
         * simply results in a truthy object reference. This condition folding
         * is needed for the decompiler. See bug 442342 and bug 443074.
         */
        if (pn->pn_count != 1)
            break;
        JSParseNode *pn2 = pn->pn_head;
        if (pn2->pn_type != TOK_FUNCTION)
            break;
        if (!(pn2->pn_flags & TCF_GENEXP_LAMBDA))
            break;
        /* FALL THROUGH */
      }
#endif

      case JSOP_DEFFUN:
      case JSOP_NAMEDFUNOBJ:
      case JSOP_ANONFUNOBJ:
      case JSOP_THIS:
      case JSOP_TRUE:
        return 1;

      case JSOP_NULL:
      case JSOP_FALSE:
        return 0;

      default:;
    }
    return -1;
}

JSBool
js_FoldConstants(JSContext *cx, JSParseNode *pn, JSTreeContext *tc, bool inCond)
{
    JSParseNode *pn1 = NULL, *pn2 = NULL, *pn3 = NULL;

    JS_CHECK_RECURSION(cx, return JS_FALSE);

    switch (pn->pn_arity) {
      case PN_FUNC:
      {
        uint16 oldflags = tc->flags;

        tc->flags = (uint16) pn->pn_flags;
        if (!js_FoldConstants(cx, pn->pn_body, tc))
            return JS_FALSE;
        tc->flags = oldflags;
        break;
      }

      case PN_LIST:
      {
        /* Propagate inCond through logical connectives. */
        bool cond = inCond && (pn->pn_type == TOK_OR || pn->pn_type == TOK_AND);

        /* Save the list head in pn1 for later use. */
        for (pn1 = pn2 = pn->pn_head; pn2; pn2 = pn2->pn_next) {
            if (!js_FoldConstants(cx, pn2, tc, cond))
                return JS_FALSE;
        }
        break;
      }

      case PN_TERNARY:
        /* Any kid may be null (e.g. for (;;)). */
        pn1 = pn->pn_kid1;
        pn2 = pn->pn_kid2;
        pn3 = pn->pn_kid3;
        if (pn1 && !js_FoldConstants(cx, pn1, tc, pn->pn_type == TOK_IF))
            return JS_FALSE;
        if (pn2) {
            if (!js_FoldConstants(cx, pn2, tc, pn->pn_type == TOK_FORHEAD))
                return JS_FALSE;
            if (pn->pn_type == TOK_FORHEAD && pn2->pn_op == JSOP_TRUE) {
                RecycleTree(pn2, tc);
                pn->pn_kid2 = NULL;
            }
        }
        if (pn3 && !js_FoldConstants(cx, pn3, tc))
            return JS_FALSE;
        break;

      case PN_BINARY:
        pn1 = pn->pn_left;
        pn2 = pn->pn_right;

        /* Propagate inCond through logical connectives. */
        if (pn->pn_type == TOK_OR || pn->pn_type == TOK_AND) {
            if (!js_FoldConstants(cx, pn1, tc, inCond))
                return JS_FALSE;
            if (!js_FoldConstants(cx, pn2, tc, inCond))
                return JS_FALSE;
            break;
        }

        /* First kid may be null (for default case in switch). */
        if (pn1 && !js_FoldConstants(cx, pn1, tc, pn->pn_type == TOK_WHILE))
            return JS_FALSE;
        if (!js_FoldConstants(cx, pn2, tc, pn->pn_type == TOK_DO))
            return JS_FALSE;
        break;

      case PN_UNARY:
        /* Our kid may be null (e.g. return; vs. return e;). */
        pn1 = pn->pn_kid;
        if (pn1 &&
            !js_FoldConstants(cx, pn1, tc,
                              (inCond && pn->pn_type == TOK_RP) ||
                              pn->pn_op == JSOP_NOT)) {
            return JS_FALSE;
        }
        break;

      case PN_NAME:
        /*
         * Skip pn1 down along a chain of dotted member expressions to avoid
         * excessive recursion.  Our only goal here is to fold constants (if
         * any) in the primary expression operand to the left of the first
         * dot in the chain.
         */
        pn1 = pn->pn_expr;
        while (pn1 && pn1->pn_arity == PN_NAME)
            pn1 = pn1->pn_expr;
        if (pn1 && !js_FoldConstants(cx, pn1, tc))
            return JS_FALSE;
        break;

      case PN_NULLARY:
        break;
    }

    switch (pn->pn_type) {
      case TOK_IF:
        if (ContainsStmt(pn2, TOK_VAR) || ContainsStmt(pn3, TOK_VAR))
            break;
        /* FALL THROUGH */

      case TOK_HOOK:
        /* Reduce 'if (C) T; else E' into T for true C, E for false. */
        while (pn1->pn_type == TOK_RP)
            pn1 = pn1->pn_kid;
        switch (pn1->pn_type) {
          case TOK_NUMBER:
            if (pn1->pn_dval == 0 || JSDOUBLE_IS_NaN(pn1->pn_dval))
                pn2 = pn3;
            break;
          case TOK_STRING:
            if (JSSTRING_LENGTH(ATOM_TO_STRING(pn1->pn_atom)) == 0)
                pn2 = pn3;
            break;
          case TOK_PRIMARY:
            if (pn1->pn_op == JSOP_TRUE)
                break;
            if (pn1->pn_op == JSOP_FALSE || pn1->pn_op == JSOP_NULL) {
                pn2 = pn3;
                break;
            }
            /* FALL THROUGH */
          default:
            /* Early return to dodge common code that copies pn2 to pn. */
            return JS_TRUE;
        }

#if JS_HAS_GENERATOR_EXPRS
        /* Don't fold a trailing |if (0)| in a generator expression. */
        if (!pn2 && (tc->flags & TCF_GENEXP_LAMBDA))
            break;
#endif

        if (pn2) {
            /*
             * pn2 is the then- or else-statement subtree to compile.  Take
             * care not to expose an object initialiser, which would be parsed
             * as a block, to the Statement parser via eval(uneval(e)) where e
             * is '1 ? {p:2, q:3}[i] : r;' or the like.
             */
            if (pn->pn_type == TOK_HOOK && StartsWith(pn2, TOK_RC)) {
                pn->pn_type = TOK_RP;
                pn->pn_arity = PN_UNARY;
                pn->pn_kid = pn2;
                if (pn3 && pn3 != pn2)
                    RecycleTree(pn3, tc);
                break;
            }
            PN_MOVE_NODE(pn, pn2);
        }
        if (!pn2 || (pn->pn_type == TOK_SEMI && !pn->pn_kid)) {
            /*
             * False condition and no else, or an empty then-statement was
             * moved up over pn.  Either way, make pn an empty block (not an
             * empty statement, which does not decompile, even when labeled).
             * NB: pn must be a TOK_IF as TOK_HOOK can never have a null kid
             * or an empty statement for a child.
             */
            pn->pn_type = TOK_LC;
            pn->pn_arity = PN_LIST;
            PN_INIT_LIST(pn);
        }
        RecycleTree(pn2, tc);
        if (pn3 && pn3 != pn2)
            RecycleTree(pn3, tc);
        break;

      case TOK_OR:
      case TOK_AND:
        if (inCond) {
            if (pn->pn_arity == PN_LIST) {
                JSParseNode **pnp = &pn->pn_head;
                JS_ASSERT(*pnp == pn1);
                do {
                    int cond = Boolish(pn1);
                    if (cond == (pn->pn_type == TOK_OR)) {
                        for (pn2 = pn1->pn_next; pn2; pn2 = pn3) {
                            pn3 = pn2->pn_next;
                            RecycleTree(pn2, tc);
                            --pn->pn_count;
                        }
                        pn1->pn_next = NULL;
                        break;
                    }
                    if (cond != -1) {
                        JS_ASSERT(cond == (pn->pn_type == TOK_AND));
                        if (pn->pn_count == 1)
                            break;
                        *pnp = pn1->pn_next;
                        RecycleTree(pn1, tc);
                        --pn->pn_count;
                    } else {
                        pnp = &pn1->pn_next;
                    }
                } while ((pn1 = *pnp) != NULL);

                // We may have to change arity from LIST to BINARY.
                pn1 = pn->pn_head;
                if (pn->pn_count == 2) {
                    pn2 = pn1->pn_next;
                    pn1->pn_next = NULL;
                    JS_ASSERT(!pn2->pn_next);
                    pn->pn_arity = PN_BINARY;
                    pn->pn_left = pn1;
                    pn->pn_right = pn2;
                } else if (pn->pn_count == 1) {
                    PN_MOVE_NODE(pn, pn1);
                    RecycleTree(pn1, tc);
                }
            } else {
                int cond = Boolish(pn1);
                if (cond == (pn->pn_type == TOK_OR)) {
                    RecycleTree(pn2, tc);
                    PN_MOVE_NODE(pn, pn1);
                } else if (cond != -1) {
                    JS_ASSERT(cond == (pn->pn_type == TOK_AND));
                    RecycleTree(pn1, tc);
                    PN_MOVE_NODE(pn, pn2);
                }
            }
        }
        break;

      case TOK_ASSIGN:
        /*
         * Compound operators such as *= should be subject to folding, in case
         * the left-hand side is constant, and so that the decompiler produces
         * the same string that you get from decompiling a script or function
         * compiled from that same string.  As with +, += is special.
         */
        if (pn->pn_op == JSOP_NOP)
            break;
        if (pn->pn_op != JSOP_ADD)
            goto do_binary_op;
        /* FALL THROUGH */

      case TOK_PLUS:
        if (pn->pn_arity == PN_LIST) {
            size_t length, length2;
            jschar *chars;
            JSString *str, *str2;

            /*
             * Any string literal term with all others number or string means
             * this is a concatenation.  If any term is not a string or number
             * literal, we can't fold.
             */
            JS_ASSERT(pn->pn_count > 2);
            if (pn->pn_extra & PNX_CANTFOLD)
                return JS_TRUE;
            if (pn->pn_extra != PNX_STRCAT)
                goto do_binary_op;

            /* Ok, we're concatenating: convert non-string constant operands. */
            length = 0;
            for (pn2 = pn1; pn2; pn2 = pn2->pn_next) {
                if (!FoldType(cx, pn2, TOK_STRING))
                    return JS_FALSE;
                /* XXX fold only if all operands convert to string */
                if (pn2->pn_type != TOK_STRING)
                    return JS_TRUE;
                length += JSFLATSTR_LENGTH(ATOM_TO_STRING(pn2->pn_atom));
            }

            /* Allocate a new buffer and string descriptor for the result. */
            chars = (jschar *) JS_malloc(cx, (length + 1) * sizeof(jschar));
            if (!chars)
                return JS_FALSE;
            str = js_NewString(cx, chars, length);
            if (!str) {
                JS_free(cx, chars);
                return JS_FALSE;
            }

            /* Fill the buffer, advancing chars and recycling kids as we go. */
            for (pn2 = pn1; pn2; pn2 = RecycleTree(pn2, tc)) {
                str2 = ATOM_TO_STRING(pn2->pn_atom);
                length2 = JSFLATSTR_LENGTH(str2);
                js_strncpy(chars, JSFLATSTR_CHARS(str2), length2);
                chars += length2;
            }
            *chars = 0;

            /* Atomize the result string and mutate pn to refer to it. */
            pn->pn_atom = js_AtomizeString(cx, str, 0);
            if (!pn->pn_atom)
                return JS_FALSE;
            pn->pn_type = TOK_STRING;
            pn->pn_op = JSOP_STRING;
            pn->pn_arity = PN_NULLARY;
            break;
        }

        /* Handle a binary string concatenation. */
        JS_ASSERT(pn->pn_arity == PN_BINARY);
        if (pn1->pn_type == TOK_STRING || pn2->pn_type == TOK_STRING) {
            JSString *left, *right, *str;

            if (!FoldType(cx, (pn1->pn_type != TOK_STRING) ? pn1 : pn2,
                          TOK_STRING)) {
                return JS_FALSE;
            }
            if (pn1->pn_type != TOK_STRING || pn2->pn_type != TOK_STRING)
                return JS_TRUE;
            left = ATOM_TO_STRING(pn1->pn_atom);
            right = ATOM_TO_STRING(pn2->pn_atom);
            str = js_ConcatStrings(cx, left, right);
            if (!str)
                return JS_FALSE;
            pn->pn_atom = js_AtomizeString(cx, str, 0);
            if (!pn->pn_atom)
                return JS_FALSE;
            pn->pn_type = TOK_STRING;
            pn->pn_op = JSOP_STRING;
            pn->pn_arity = PN_NULLARY;
            RecycleTree(pn1, tc);
            RecycleTree(pn2, tc);
            break;
        }

        /* Can't concatenate string literals, let's try numbers. */
        goto do_binary_op;

      case TOK_STAR:
      case TOK_SHOP:
      case TOK_MINUS:
      case TOK_DIVOP:
      do_binary_op:
        if (pn->pn_arity == PN_LIST) {
            JS_ASSERT(pn->pn_count > 2);
            for (pn2 = pn1; pn2; pn2 = pn2->pn_next) {
                if (!FoldType(cx, pn2, TOK_NUMBER))
                    return JS_FALSE;
            }
            for (pn2 = pn1; pn2; pn2 = pn2->pn_next) {
                /* XXX fold only if all operands convert to number */
                if (pn2->pn_type != TOK_NUMBER)
                    break;
            }
            if (!pn2) {
                JSOp op = PN_OP(pn);

                pn2 = pn1->pn_next;
                pn3 = pn2->pn_next;
                if (!FoldBinaryNumeric(cx, op, pn1, pn2, pn, tc))
                    return JS_FALSE;
                while ((pn2 = pn3) != NULL) {
                    pn3 = pn2->pn_next;
                    if (!FoldBinaryNumeric(cx, op, pn, pn2, pn, tc))
                        return JS_FALSE;
                }
            }
        } else {
            JS_ASSERT(pn->pn_arity == PN_BINARY);
            if (!FoldType(cx, pn1, TOK_NUMBER) ||
                !FoldType(cx, pn2, TOK_NUMBER)) {
                return JS_FALSE;
            }
            if (pn1->pn_type == TOK_NUMBER && pn2->pn_type == TOK_NUMBER) {
                if (!FoldBinaryNumeric(cx, PN_OP(pn), pn1, pn2, pn, tc))
                    return JS_FALSE;
            }
        }
        break;

      case TOK_UNARYOP:
        while (pn1->pn_type == TOK_RP)
            pn1 = pn1->pn_kid;
        if (pn1->pn_type == TOK_NUMBER) {
            jsdouble d;

            /* Operate on one numeric constant. */
            d = pn1->pn_dval;
            switch (pn->pn_op) {
              case JSOP_BITNOT:
                d = ~js_DoubleToECMAInt32(d);
                break;

              case JSOP_NEG:
#ifdef HPUX
                /*
                 * Negation of a zero doesn't produce a negative
                 * zero on HPUX. Perform the operation by bit
                 * twiddling.
                 */
                JSDOUBLE_HI32(d) ^= JSDOUBLE_HI32_SIGNBIT;
#else
                d = -d;
#endif
                break;

              case JSOP_POS:
                break;

              case JSOP_NOT:
                pn->pn_type = TOK_PRIMARY;
                pn->pn_op = (d == 0 || JSDOUBLE_IS_NaN(d)) ? JSOP_TRUE : JSOP_FALSE;
                pn->pn_arity = PN_NULLARY;
                /* FALL THROUGH */

              default:
                /* Return early to dodge the common TOK_NUMBER code. */
                return JS_TRUE;
            }
            pn->pn_type = TOK_NUMBER;
            pn->pn_op = JSOP_DOUBLE;
            pn->pn_arity = PN_NULLARY;
            pn->pn_dval = d;
            RecycleTree(pn1, tc);
        } else if (pn1->pn_type == TOK_PRIMARY) {
            if (pn->pn_op == JSOP_NOT &&
                (pn1->pn_op == JSOP_TRUE ||
                 pn1->pn_op == JSOP_FALSE)) {
                PN_MOVE_NODE(pn, pn1);
                pn->pn_op = (pn->pn_op == JSOP_TRUE) ? JSOP_FALSE : JSOP_TRUE;
                RecycleTree(pn1, tc);
            }
        }
        break;

#if JS_HAS_XML_SUPPORT
      case TOK_XMLELEM:
      case TOK_XMLLIST:
      case TOK_XMLPTAGC:
      case TOK_XMLSTAGO:
      case TOK_XMLETAGO:
      case TOK_XMLNAME:
        if (pn->pn_arity == PN_LIST) {
            JS_ASSERT(pn->pn_type == TOK_XMLLIST || pn->pn_count != 0);
            if (!FoldXMLConstants(cx, pn, tc))
                return JS_FALSE;
        }
        break;

      case TOK_AT:
        if (pn1->pn_type == TOK_XMLNAME) {
            jsval v;
            JSParsedObjectBox *xmlpob;

            v = ATOM_KEY(pn1->pn_atom);
            if (!js_ToAttributeName(cx, &v))
                return JS_FALSE;
            JS_ASSERT(!JSVAL_IS_PRIMITIVE(v));

            xmlpob = js_NewParsedObjectBox(cx, tc->parseContext,
                                           JSVAL_TO_OBJECT(v));
            if (!xmlpob)
                return JS_FALSE;

            pn->pn_type = TOK_XMLNAME;
            pn->pn_op = JSOP_OBJECT;
            pn->pn_arity = PN_NULLARY;
            pn->pn_pob = xmlpob;
            RecycleTree(pn1, tc);
        }
        break;
#endif /* JS_HAS_XML_SUPPORT */

      default:;
    }

    if (inCond) {
        int cond = Boolish(pn);
        if (cond >= 0) {
            if (pn->pn_arity == PN_LIST) {
                pn2 = pn->pn_head;
                do {
                    pn3 = pn2->pn_next;
                    RecycleTree(pn2, tc);
                } while ((pn2 = pn3) != NULL);
            }
            pn->pn_type = TOK_PRIMARY;
            pn->pn_op = cond ? JSOP_TRUE : JSOP_FALSE;
            pn->pn_arity = PN_NULLARY;
        }
    }

    return JS_TRUE;
}
