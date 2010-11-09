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

#ifndef jsparse_h___
#define jsparse_h___
/*
 * JS parser definitions.
 */
#include "jsversion.h"
#include "jsprvtd.h"
#include "jspubtd.h"
#include "jsscan.h"

JS_BEGIN_EXTERN_C

/*
 * Parsing builds a tree of nodes that directs code generation.  This tree is
 * not a concrete syntax tree in all respects (for example, || and && are left
 * associative, but (A && B && C) translates into the right-associated tree
 * <A && <B && C>> so that code generation can emit a left-associative branch
 * around <B && C> when A is false).  Nodes are labeled by token type, with a
 * JSOp secondary label when needed:
 *
 * Label        Variant     Members
 * -----        -------     -------
 * <Definitions>
 * TOK_FUNCTION func        pn_funpob: JSParsedObjectBox holding function
 *                            object containing arg and var properties.  We
 *                            create the function object at parse (not emit)
 *                            time to specialize arg and var bytecodes early.
 *                          pn_body: TOK_LC node for function body statements
 *                          pn_flags: TCF_FUN_* flags (see jsemit.h) collected
 *                            while parsing the function's body
 *
 * <Statements>
 * TOK_LC       list        pn_head: list of pn_count statements
 * TOK_IF       ternary     pn_kid1: cond, pn_kid2: then, pn_kid3: else or null
 * TOK_SWITCH   binary      pn_left: discriminant
 *                          pn_right: list of TOK_CASE nodes, with at most one
 *                            TOK_DEFAULT node, or if there are let bindings
 *                            in the top level of the switch body's cases, a
 *                            TOK_LEXICALSCOPE node that contains the list of
 *                            TOK_CASE nodes.
 * TOK_CASE,    binary      pn_left: case expr or null if TOK_DEFAULT
 * TOK_DEFAULT              pn_right: TOK_LC node for this case's statements
 *                          pn_val: constant value if lookup or table switch
 * TOK_WHILE    binary      pn_left: cond, pn_right: body
 * TOK_DO       binary      pn_left: body, pn_right: cond
 * TOK_FOR      binary      pn_left: either
 *                            for/in loop: a binary TOK_IN node with
 *                              pn_left:  TOK_VAR or TOK_NAME to left of 'in'
 *                                if TOK_VAR, its pn_extra may have PNX_POPVAR
 *                                and PNX_FORINVAR bits set
 *                              pn_right: object expr to right of 'in'
 *                            for(;;) loop: a ternary TOK_RESERVED node with
 *                              pn_kid1:  init expr before first ';'
 *                              pn_kid2:  cond expr before second ';'
 *                              pn_kid3:  update expr after second ';'
 *                              any kid may be null
 *                          pn_right: body
 * TOK_THROW    unary       pn_op: JSOP_THROW, pn_kid: exception
 * TOK_TRY      ternary     pn_kid1: try block
 *                          pn_kid2: null or TOK_RESERVED list of
 *                          TOK_LEXICALSCOPE nodes, each with pn_expr pointing
 *                          to a TOK_CATCH node
 *                          pn_kid3: null or finally block
 * TOK_CATCH    ternary     pn_kid1: TOK_NAME, TOK_RB, or TOK_RC catch var node
 *                                   (TOK_RB or TOK_RC if destructuring)
 *                          pn_kid2: null or the catch guard expression
 *                          pn_kid3: catch block statements
 * TOK_BREAK    name        pn_atom: label or null
 * TOK_CONTINUE name        pn_atom: label or null
 * TOK_WITH     binary      pn_left: head expr, pn_right: body
 * TOK_VAR      list        pn_head: list of pn_count TOK_NAME nodes
 *                                   each name node has
 *                                     pn_atom: variable name
 *                                     pn_expr: initializer or null
 * TOK_RETURN   unary       pn_kid: return expr or null
 * TOK_SEMI     unary       pn_kid: expr or null statement
 * TOK_COLON    name        pn_atom: label, pn_expr: labeled statement
 *
 * <Expressions>
 * All left-associated binary trees of the same type are optimized into lists
 * to avoid recursion when processing expression chains.
 * TOK_COMMA    list        pn_head: list of pn_count comma-separated exprs
 * TOK_ASSIGN   binary      pn_left: lvalue, pn_right: rvalue
 *                          pn_op: JSOP_ADD for +=, etc.
 * TOK_HOOK     ternary     pn_kid1: cond, pn_kid2: then, pn_kid3: else
 * TOK_OR       binary      pn_left: first in || chain, pn_right: rest of chain
 * TOK_AND      binary      pn_left: first in && chain, pn_right: rest of chain
 * TOK_BITOR    binary      pn_left: left-assoc | expr, pn_right: ^ expr
 * TOK_BITXOR   binary      pn_left: left-assoc ^ expr, pn_right: & expr
 * TOK_BITAND   binary      pn_left: left-assoc & expr, pn_right: EQ expr
 * TOK_EQOP     binary      pn_left: left-assoc EQ expr, pn_right: REL expr
 *                          pn_op: JSOP_EQ, JSOP_NE,
 *                                 JSOP_STRICTEQ, JSOP_STRICTNE
 * TOK_RELOP    binary      pn_left: left-assoc REL expr, pn_right: SH expr
 *                          pn_op: JSOP_LT, JSOP_LE, JSOP_GT, JSOP_GE
 * TOK_SHOP     binary      pn_left: left-assoc SH expr, pn_right: ADD expr
 *                          pn_op: JSOP_LSH, JSOP_RSH, JSOP_URSH
 * TOK_PLUS,    binary      pn_left: left-assoc ADD expr, pn_right: MUL expr
 *                          pn_extra: if a left-associated binary TOK_PLUS
 *                            tree has been flattened into a list (see above
 *                            under <Expressions>), pn_extra will contain
 *                            PNX_STRCAT if at least one list element is a
 *                            string literal (TOK_STRING); if such a list has
 *                            any non-string, non-number term, pn_extra will
 *                            contain PNX_CANTFOLD.
 *                          pn_
 * TOK_MINUS                pn_op: JSOP_ADD, JSOP_SUB
 * TOK_STAR,    binary      pn_left: left-assoc MUL expr, pn_right: UNARY expr
 * TOK_DIVOP                pn_op: JSOP_MUL, JSOP_DIV, JSOP_MOD
 * TOK_UNARYOP  unary       pn_kid: UNARY expr, pn_op: JSOP_NEG, JSOP_POS,
 *                          JSOP_NOT, JSOP_BITNOT, JSOP_TYPEOF, JSOP_VOID
 * TOK_INC,     unary       pn_kid: MEMBER expr
 * TOK_DEC
 * TOK_NEW      list        pn_head: list of ctor, arg1, arg2, ... argN
 *                          pn_count: 1 + N (where N is number of args)
 *                          ctor is a MEMBER expr
 * TOK_DELETE   unary       pn_kid: MEMBER expr
 * TOK_DOT,     name        pn_expr: MEMBER expr to left of .
 * TOK_DBLDOT               pn_atom: name to right of .
 * TOK_LB       binary      pn_left: MEMBER expr to left of [
 *                          pn_right: expr between [ and ]
 * TOK_LP       list        pn_head: list of call, arg1, arg2, ... argN
 *                          pn_count: 1 + N (where N is number of args)
 *                          call is a MEMBER expr naming a callable object
 * TOK_RB       list        pn_head: list of pn_count array element exprs
 *                          [,,] holes are represented by TOK_COMMA nodes
 *                          #n=[...] produces TOK_DEFSHARP at head of list
 *                          pn_extra: PN_ENDCOMMA if extra comma at end
 * TOK_RC       list        pn_head: list of pn_count TOK_COLON nodes where
 *                          each has pn_left: property id, pn_right: value
 *                          #n={...} produces TOK_DEFSHARP at head of list
 *                          var {x} = object destructuring shorthand shares
 *                          PN_NAME node for x on left and right of TOK_COLON
 *                          node in TOK_RC's list, has PNX_SHORTHAND flag
 * TOK_DEFSHARP unary       pn_num: jsint value of n in #n=
 *                          pn_kid: null for #n=[...] and #n={...}, primary
 *                          if #n=primary for function, paren, name, object
 *                          literal expressions
 * TOK_USESHARP nullary     pn_num: jsint value of n in #n#
 * TOK_RP       unary       pn_kid: parenthesized expression
 * TOK_NAME,    name        pn_atom: name, string, or object atom
 * TOK_STRING,              pn_op: JSOP_NAME, JSOP_STRING, or JSOP_OBJECT, or
 *                                 JSOP_REGEXP
 * TOK_REGEXP               If JSOP_NAME, pn_op may be JSOP_*ARG or JSOP_*VAR
 *                          with pn_slot >= 0 and pn_const telling const-ness
 * TOK_NUMBER   dval        pn_dval: double value of numeric literal
 * TOK_PRIMARY  nullary     pn_op: JSOp bytecode
 *
 * <E4X node descriptions>
 * TOK_ANYNAME  nullary     pn_op: JSOP_ANYNAME
 *                          pn_atom: cx->runtime->atomState.starAtom
 * TOK_AT       unary       pn_op: JSOP_TOATTRNAME; pn_kid attribute id/expr
 * TOK_DBLCOLON binary      pn_op: JSOP_QNAME
 *                          pn_left: TOK_ANYNAME or TOK_NAME node
 *                          pn_right: TOK_STRING "*" node, or expr within []
 *              name        pn_op: JSOP_QNAMECONST
 *                          pn_expr: TOK_ANYNAME or TOK_NAME left operand
 *                          pn_atom: name on right of ::
 * TOK_XMLELEM  list        XML element node
 *                          pn_head: start tag, content1, ... contentN, end tag
 *                          pn_count: 2 + N where N is number of content nodes
 *                                    N may be > x.length() if {expr} embedded
 * TOK_XMLLIST  list        XML list node
 *                          pn_head: content1, ... contentN
 * TOK_XMLSTAGO, list       XML start, end, and point tag contents
 * TOK_XMLETAGC,            pn_head: tag name or {expr}, ... XML attrs ...
 * TOK_XMLPTAGO
 * TOK_XMLNAME  nullary     pn_atom: XML name, with no {expr} embedded
 * TOK_XMLNAME  list        pn_head: tag name or {expr}, ... name or {expr}
 * TOK_XMLATTR, nullary     pn_atom: attribute value string; pn_op: JSOP_STRING
 * TOK_XMLCDATA,
 * TOK_XMLCOMMENT
 * TOK_XMLPI    nullary     pn_atom: XML processing instruction target
 *                          pn_atom2: XML PI content, or null if no content
 * TOK_XMLTEXT  nullary     pn_atom: marked-up text, or null if empty string
 * TOK_LC       unary       {expr} in XML tag or content; pn_kid is expr
 *
 * So an XML tag with no {expr} and three attributes is a list with the form:
 *
 *    (tagname attrname1 attrvalue1 attrname2 attrvalue2 attrname2 attrvalue3)
 *
 * An XML tag with embedded expressions like so:
 *
 *    <name1{expr1} name2{expr2}name3={expr3}>
 *
 * would have the form:
 *
 *    ((name1 {expr1}) (name2 {expr2} name3) {expr3})
 *
 * where () bracket a list with elements separated by spaces, and {expr} is a
 * TOK_LC unary node with expr as its kid.
 *
 * Thus, the attribute name/value pairs occupy successive odd and even list
 * locations, where pn_head is the TOK_XMLNAME node at list location 0.  The
 * parser builds the same sort of structures for elements:
 *
 *    <a x={x}>Hi there!<b y={y}>How are you?</b><answer>{x + y}</answer></a>
 *
 * translates to:
 *
 *    ((a x {x}) 'Hi there!' ((b y {y}) 'How are you?') ((answer) {x + y}))
 *
 * <Non-E4X node descriptions, continued>
 *
 * Label              Variant   Members
 * -----              -------   -------
 * TOK_LEXICALSCOPE   name      pn_op: JSOP_LEAVEBLOCK or JSOP_LEAVEBLOCKEXPR
 *                              pn_pob: block object
 *                              pn_expr: block body
 * TOK_ARRAYCOMP      list      pn_head: list of pn_count (1 or 2) elements
 *                              if pn_count is 2, first element is #n=[...]
 *                                last element is block enclosing for loop(s)
 *                                and optionally if-guarded TOK_ARRAYPUSH
 *                              pn_extra: stack slot, used during code gen
 * TOK_ARRAYPUSH      unary     pn_op: JSOP_ARRAYCOMP
 *                              pn_kid: array comprehension expression
 */
typedef enum JSParseNodeArity {
    PN_FUNC     = -3,
    PN_LIST     = -2,
    PN_TERNARY  =  3,
    PN_BINARY   =  2,
    PN_UNARY    =  1,
    PN_NAME     = -1,
    PN_NULLARY  =  0
} JSParseNodeArity;

struct JSParseNode {
    uint16              pn_type;
    uint8               pn_op;
    int8                pn_arity;
    JSTokenPos          pn_pos;
    ptrdiff_t           pn_offset;      /* first generated bytecode offset */
    union {
        struct {                        /* TOK_FUNCTION node */
            JSParsedObjectBox *funpob;  /* function object */
            JSParseNode *body;          /* TOK_LC list of statements */
            uint16      flags;          /* accumulated tree context flags */
            uint32      index;          /* emitter's index */
        } func;
        struct {                        /* list of next-linked nodes */
            JSParseNode *head;          /* first node in list */
            JSParseNode **tail;         /* ptr to ptr to last node in list */
            uint32      count;          /* number of nodes in list */
            uint32      extra;          /* extra flags, see below */
        } list;
        struct {                        /* ternary: if, for(;;), ?: */
            JSParseNode *kid1;          /* condition, discriminant, etc. */
            JSParseNode *kid2;          /* then-part, case list, etc. */
            JSParseNode *kid3;          /* else-part, default case, etc. */
        } ternary;
        struct {                        /* two kids if binary */
            JSParseNode *left;
            JSParseNode *right;
            jsval       val;            /* switch case value */
            uintN       iflags;         /* JSITER_* flags for TOK_FOR node */
        } binary;
        struct {                        /* one kid if unary */
            JSParseNode *kid;
            jsint       num;            /* -1 or sharp variable number */
            JSBool      hidden;         /* hidden genexp-induced JSOP_YIELD */
        } unary;
        struct {                        /* name, labeled statement, etc. */
            JSAtom      *atom;          /* name or label atom, null if slot */
            JSParseNode *expr;          /* object or initializer */
            jsint       slot;           /* -1 or arg or local var slot */
            JSBool      isconst;        /* true for const names */
        } name;
        struct {                        /* lexical scope. */
            JSParsedObjectBox *pob;     /* block object */
            JSParseNode *expr;          /* object or initializer */
            jsint       slot;           /* -1 or arg or local var slot */
        } lexical;
        struct {
            JSAtom      *atom;          /* first atom in pair */
            JSAtom      *atom2;         /* second atom in pair or null */
        } apair;
        struct {                        /* object literal */
            JSParsedObjectBox *pob;
        } object;
        jsdouble        dval;           /* aligned numeric literal value */
    } pn_u;
    JSParseNode         *pn_next;       /* to align dval and pn_u on RISCs */
};

#define pn_funpob       pn_u.func.funpob
#define pn_body         pn_u.func.body
#define pn_flags        pn_u.func.flags
#define pn_index        pn_u.func.index
#define pn_head         pn_u.list.head
#define pn_tail         pn_u.list.tail
#define pn_count        pn_u.list.count
#define pn_extra        pn_u.list.extra
#define pn_kid1         pn_u.ternary.kid1
#define pn_kid2         pn_u.ternary.kid2
#define pn_kid3         pn_u.ternary.kid3
#define pn_left         pn_u.binary.left
#define pn_right        pn_u.binary.right
#define pn_val          pn_u.binary.val
#define pn_iflags       pn_u.binary.iflags
#define pn_kid          pn_u.unary.kid
#define pn_num          pn_u.unary.num
#define pn_hidden       pn_u.unary.hidden
#define pn_atom         pn_u.name.atom
#define pn_expr         pn_u.name.expr
#define pn_slot         pn_u.name.slot
#define pn_const        pn_u.name.isconst
#define pn_dval         pn_u.dval
#define pn_atom2        pn_u.apair.atom2
#define pn_pob          pn_u.object.pob

/* PN_LIST pn_extra flags. */
#define PNX_STRCAT      0x01            /* TOK_PLUS list has string term */
#define PNX_CANTFOLD    0x02            /* TOK_PLUS list has unfoldable term */
#define PNX_POPVAR      0x04            /* TOK_VAR last result needs popping */
#define PNX_FORINVAR    0x08            /* TOK_VAR is left kid of TOK_IN node,
                                           which is left kid of TOK_FOR */
#define PNX_ENDCOMMA    0x10            /* array literal has comma at end */
#define PNX_XMLROOT     0x20            /* top-most node in XML literal tree */
#define PNX_GROUPINIT   0x40            /* var [a, b] = [c, d]; unit list */
#define PNX_NEEDBRACES  0x80            /* braces necessary due to closure */
#define PNX_FUNCDEFS   0x100            /* contains top-level function
                                           statements */
#define PNX_SHORTHAND  0x200            /* shorthand syntax used, at present
                                           object destructuring ({x,y}) only */

/*
 * Move pn2 into pn, preserving pn->pn_pos and pn->pn_offset and handing off
 * any kids in pn2->pn_u, by clearing pn2.
 */
#define PN_MOVE_NODE(pn, pn2)                                                 \
    JS_BEGIN_MACRO                                                            \
        (pn)->pn_type = (pn2)->pn_type;                                       \
        (pn)->pn_op = (pn2)->pn_op;                                           \
        (pn)->pn_arity = (pn2)->pn_arity;                                     \
        (pn)->pn_u = (pn2)->pn_u;                                             \
        PN_CLEAR_NODE(pn2);                                                   \
    JS_END_MACRO

#define PN_CLEAR_NODE(pn)                                                     \
    JS_BEGIN_MACRO                                                            \
        (pn)->pn_type = TOK_EOF;                                              \
        (pn)->pn_op = JSOP_NOP;                                               \
        (pn)->pn_arity = PN_NULLARY;                                          \
    JS_END_MACRO

/* True if pn is a parsenode representing a literal constant. */
#define PN_IS_CONSTANT(pn)                                                    \
    ((pn)->pn_type == TOK_NUMBER ||                                           \
     (pn)->pn_type == TOK_STRING ||                                           \
     ((pn)->pn_type == TOK_PRIMARY && (pn)->pn_op != JSOP_THIS))

#define PN_OP(pn)    ((JSOp)(pn)->pn_op)
#define PN_TYPE(pn)  ((JSTokenType)(pn)->pn_type)

/*
 * Compute a pointer to the last JSParseNode element in a singly-linked list.
 * NB: list must be non-empty for correct PN_LAST usage!
 */
#define PN_LAST(list) \
    ((JSParseNode *)((char *)(list)->pn_tail - offsetof(JSParseNode, pn_next)))

#define PN_INIT_LIST(list)                                                    \
    JS_BEGIN_MACRO                                                            \
        (list)->pn_head = NULL;                                               \
        (list)->pn_tail = &(list)->pn_head;                                   \
        (list)->pn_count = (list)->pn_extra = 0;                              \
    JS_END_MACRO

#define PN_INIT_LIST_1(list, pn)                                              \
    JS_BEGIN_MACRO                                                            \
        (list)->pn_head = (pn);                                               \
        (list)->pn_tail = &(pn)->pn_next;                                     \
        (list)->pn_count = 1;                                                 \
        (list)->pn_extra = 0;                                                 \
    JS_END_MACRO

#define PN_APPEND(list, pn)                                                   \
    JS_BEGIN_MACRO                                                            \
        *(list)->pn_tail = (pn);                                              \
        (list)->pn_tail = &(pn)->pn_next;                                     \
        (list)->pn_count++;                                                   \
    JS_END_MACRO

struct JSParsedObjectBox {
    JSParsedObjectBox   *traceLink;
    JSParsedObjectBox   *emitLink;
    JSObject            *object;
};

struct JSParseContext {
    JSTokenStream       tokenStream;
    void                *tempPoolMark;  /* initial JSContext.tempPool mark */
    JSPrincipals        *principals;    /* principals associated with source */
    JSStackFrame        *callerFrame;   /* scripted caller frame for eval and
                                           debug scripts */
    JSParseNode         *nodeList;      /* list of recyclable parse-node
                                           structs */
    JSParsedObjectBox   *traceListHead; /* list of parsed object for GC
                                           tracing */
    JSTempValueRooter   tempRoot;       /* root to trace traceListHead */
};

/*
 * Convenience macro to access JSParseContext.tokenStream as a pointer.
 */
#define TS(pc) (&(pc)->tokenStream)

/*
 * Parse a top-level JS script.
 */
extern JSParseNode *
js_ParseScript(JSContext *cx, JSObject *chain, JSParseContext *pc);

extern JSScript *
js_CompileScript(JSContext *cx, JSObject *scopeChain, JSStackFrame *callerFrame,
                 JSPrincipals *principals, uint32 tcflags,
                 const jschar *chars, size_t length,
                 FILE *file, const char *filename, uintN lineno);

extern JSBool
js_CompileFunctionBody(JSContext *cx, JSFunction *fun, JSPrincipals *principals,
                       const jschar *chars, size_t length,
                       const char *filename, uintN lineno);

extern JSBool
js_FoldConstants(JSContext *cx, JSParseNode *pn, JSTreeContext *tc,
                 bool inCond = false);

#if JS_HAS_XML_SUPPORT
JS_FRIEND_API(JSParseNode *)
js_ParseXMLText(JSContext *cx, JSObject *chain, JSParseContext *pc,
                JSBool allowList);
#endif

/*
 * Initialize a parse context. All parameters after pc are passed to
 * js_InitTokenStream.
 *
 * The parse context owns the arena pool "tops-of-stack" space above the
 * current JSContext.tempPool mark. This means you cannot allocate from
 * tempPool and save the pointer beyond the next js_FinishParseContext.
 */
extern JSBool
js_InitParseContext(JSContext *cx, JSParseContext *pc, JSPrincipals *principals,
                    JSStackFrame *callerFrame,
                    const jschar *base, size_t length, FILE *fp,
                    const char *filename, uintN lineno);

extern void
js_FinishParseContext(JSContext *cx, JSParseContext *pc);

extern void
js_InitCompilePrincipals(JSContext *cx, JSParseContext *pc,
                         JSPrincipals *principals);

/*
 * Allocate a new parseed object node from cx->tempPool.
 */
extern JSParsedObjectBox *
js_NewParsedObjectBox(JSContext *cx, JSParseContext *pc, JSObject *obj);

extern void
js_TraceParseContext(JSTracer *trc, JSParseContext *pc);

JS_END_EXTERN_C

#endif /* jsparse_h___ */
