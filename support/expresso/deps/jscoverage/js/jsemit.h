/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=79:
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

#ifndef jsemit_h___
#define jsemit_h___
/*
 * JS bytecode generation.
 */

#include "jsstddef.h"
#include "jstypes.h"
#include "jsatom.h"
#include "jsopcode.h"
#include "jsscript.h"
#include "jsprvtd.h"
#include "jspubtd.h"

JS_BEGIN_EXTERN_C

/*
 * NB: If you add enumerators for scope statements, add them between STMT_WITH
 * and STMT_CATCH, or you will break the STMT_TYPE_IS_SCOPE macro. If you add
 * non-looping statement enumerators, add them before STMT_DO_LOOP or you will
 * break the STMT_TYPE_IS_LOOP macro.
 *
 * Also remember to keep the statementName array in jsemit.c in sync.
 */
typedef enum JSStmtType {
    STMT_LABEL,                 /* labeled statement:  L: s */
    STMT_IF,                    /* if (then) statement */
    STMT_ELSE,                  /* else clause of if statement */
    STMT_SEQ,                   /* synthetic sequence of statements */
    STMT_BLOCK,                 /* compound statement: { s1[;... sN] } */
    STMT_SWITCH,                /* switch statement */
    STMT_WITH,                  /* with statement */
    STMT_CATCH,                 /* catch block */
    STMT_TRY,                   /* try block */
    STMT_FINALLY,               /* finally block */
    STMT_SUBROUTINE,            /* gosub-target subroutine body */
    STMT_DO_LOOP,               /* do/while loop statement */
    STMT_FOR_LOOP,              /* for loop statement */
    STMT_FOR_IN_LOOP,           /* for/in loop statement */
    STMT_WHILE_LOOP,            /* while loop statement */
    STMT_LIMIT
} JSStmtType;

#define STMT_TYPE_IN_RANGE(t,b,e) ((uint)((t) - (b)) <= (uintN)((e) - (b)))

/*
 * A comment on the encoding of the JSStmtType enum and type-testing macros:
 *
 * STMT_TYPE_MAYBE_SCOPE tells whether a statement type is always, or may
 * become, a lexical scope.  It therefore includes block and switch (the two
 * low-numbered "maybe" scope types) and excludes with (with has dynamic scope
 * pending the "reformed with" in ES4/JS2).  It includes all try-catch-finally
 * types, which are high-numbered maybe-scope types.
 *
 * STMT_TYPE_LINKS_SCOPE tells whether a JSStmtInfo of the given type eagerly
 * links to other scoping statement info records.  It excludes the two early
 * "maybe" types, block and switch, as well as the try and both finally types,
 * since try and the other trailing maybe-scope types don't need block scope
 * unless they contain let declarations.
 *
 * We treat WITH as a static scope because it prevents lexical binding from
 * continuing further up the static scope chain. With the lost "reformed with"
 * proposal for ES4, we would be able to model it statically, too.
 */
#define STMT_TYPE_MAYBE_SCOPE(type)                                           \
    (type != STMT_WITH &&                                                     \
     STMT_TYPE_IN_RANGE(type, STMT_BLOCK, STMT_SUBROUTINE))

#define STMT_TYPE_LINKS_SCOPE(type)                                           \
    STMT_TYPE_IN_RANGE(type, STMT_WITH, STMT_CATCH)

#define STMT_TYPE_IS_TRYING(type)                                             \
    STMT_TYPE_IN_RANGE(type, STMT_TRY, STMT_SUBROUTINE)

#define STMT_TYPE_IS_LOOP(type) ((type) >= STMT_DO_LOOP)

#define STMT_MAYBE_SCOPE(stmt)  STMT_TYPE_MAYBE_SCOPE((stmt)->type)
#define STMT_LINKS_SCOPE(stmt)  (STMT_TYPE_LINKS_SCOPE((stmt)->type) ||       \
                                 ((stmt)->flags & SIF_SCOPE))
#define STMT_IS_TRYING(stmt)    STMT_TYPE_IS_TRYING((stmt)->type)
#define STMT_IS_LOOP(stmt)      STMT_TYPE_IS_LOOP((stmt)->type)

typedef struct JSStmtInfo JSStmtInfo;

struct JSStmtInfo {
    uint16          type;           /* statement type */
    uint16          flags;          /* flags, see below */
    ptrdiff_t       update;         /* loop update offset (top if none) */
    ptrdiff_t       breaks;         /* offset of last break in loop */
    ptrdiff_t       continues;      /* offset of last continue in loop */
    union {
        JSAtom      *label;         /* name of LABEL */
        JSObject    *blockObj;      /* block scope object */
    } u;
    JSStmtInfo      *down;          /* info for enclosing statement */
    JSStmtInfo      *downScope;     /* next enclosing lexical scope */
};

#define SIF_SCOPE        0x0001     /* statement has its own lexical scope */
#define SIF_BODY_BLOCK   0x0002     /* STMT_BLOCK type is a function body */
#define SIF_FOR_BLOCK    0x0004     /* for (let ...) induced block scope */

/*
 * To reuse space in JSStmtInfo, rename breaks and continues for use during
 * try/catch/finally code generation and backpatching. To match most common
 * use cases, the macro argument is a struct, not a struct pointer. Only a
 * loop, switch, or label statement info record can have breaks and continues,
 * and only a for loop has an update backpatch chain, so it's safe to overlay
 * these for the "trying" JSStmtTypes.
 */
#define CATCHNOTE(stmt)  ((stmt).update)
#define GOSUBS(stmt)     ((stmt).breaks)
#define GUARDJUMP(stmt)  ((stmt).continues)

#define AT_TOP_LEVEL(tc)                                                      \
    (!(tc)->topStmt || ((tc)->topStmt->flags & SIF_BODY_BLOCK))

#define SET_STATEMENT_TOP(stmt, top)                                          \
    ((stmt)->update = (top), (stmt)->breaks = (stmt)->continues = (-1))

struct JSTreeContext {              /* tree context for semantic checks */
    uint16          flags;          /* statement state flags, see below */
    uint16          ngvars;         /* max. no. of global variables/regexps */
    JSStmtInfo      *topStmt;       /* top of statement info stack */
    JSStmtInfo      *topScopeStmt;  /* top lexical scope statement */
    JSObject        *blockChain;    /* compile time block scope chain (NB: one
                                       deeper than the topScopeStmt/downScope
                                       chain when in head of let block/expr) */
    JSParseNode     *blockNode;     /* parse node for a lexical scope.
                                       XXX combine with blockChain? */
    JSAtomList      decls;          /* function, const, and var declarations */
    JSParseContext  *parseContext;

    union {

        JSFunction  *fun;           /* function to store argument and variable
                                       names when flags & TCF_IN_FUNCTION */
        JSObject    *scopeChain;    /* scope chain object for the script */
    } u;

#ifdef JS_SCOPE_DEPTH_METER
    uint16          scopeDepth;     /* current lexical scope chain depth */
    uint16          maxScopeDepth;  /* maximum lexical scope chain depth */
#endif
};

#define TCF_IN_FUNCTION        0x01 /* parsing inside function body */
#define TCF_RETURN_EXPR        0x02 /* function has 'return expr;' */
#define TCF_RETURN_VOID        0x04 /* function has 'return;' */
#define TCF_IN_FOR_INIT        0x08 /* parsing init expr of for; exclude 'in' */
#define TCF_FUN_CLOSURE_VS_VAR 0x10 /* function and var with same name */
#define TCF_FUN_USES_NONLOCALS 0x20 /* function refers to non-local names */
#define TCF_FUN_HEAVYWEIGHT    0x40 /* function needs Call object per call */
#define TCF_FUN_IS_GENERATOR   0x80 /* parsed yield statement in function */
#define TCF_HAS_DEFXMLNS      0x100 /* default xml namespace = ...; parsed */
#define TCF_HAS_FUNCTION_STMT 0x200 /* block contains a function statement */
#define TCF_GENEXP_LAMBDA     0x400 /* flag lambda from generator expression */
#define TCF_COMPILE_N_GO      0x800 /* compiler-and-go mode of script, can
                                       optimize name references based on scope
                                       chain */
#define TCF_NO_SCRIPT_RVAL   0x1000 /* API caller does not want result value
                                       from global script */
/*
 * Flags to propagate out of the blocks.
 */
#define TCF_RETURN_FLAGS        (TCF_RETURN_EXPR | TCF_RETURN_VOID)

/*
 * Flags to propagate from FunctionBody.
 */
#define TCF_FUN_FLAGS           (TCF_FUN_IS_GENERATOR   |                     \
                                 TCF_FUN_HEAVYWEIGHT    |                     \
                                 TCF_FUN_USES_NONLOCALS |                     \
                                 TCF_FUN_CLOSURE_VS_VAR)

/*
 * Flags field, not stored in JSTreeContext.flags, for passing staticDepth
 * into js_CompileScript.
 */
#define TCF_STATIC_DEPTH_MASK   0xffff0000
#define TCF_GET_STATIC_DEPTH(f) ((uint32)(f) >> 16)
#define TCF_PUT_STATIC_DEPTH(d) ((uint16)(d) << 16)

#ifdef JS_SCOPE_DEPTH_METER
# define JS_SCOPE_DEPTH_METERING(code) ((void) (code))
#else
# define JS_SCOPE_DEPTH_METERING(code) ((void) 0)
#endif

#define TREE_CONTEXT_INIT(tc, pc)                                             \
    ((tc)->flags = (tc)->ngvars = 0,                                          \
     (tc)->topStmt = (tc)->topScopeStmt = NULL,                               \
     (tc)->blockChain = NULL,                                                 \
     ATOM_LIST_INIT(&(tc)->decls),                                            \
     (tc)->blockNode = NULL,                                                  \
     (tc)->parseContext = (pc),                                               \
     (tc)->u.scopeChain = NULL,                                               \
     JS_SCOPE_DEPTH_METERING((tc)->scopeDepth = (tc)->maxScopeDepth = 0))

/*
 * For functions TREE_CONTEXT_FINISH is called the second time to finish the
 * extra tc created during code generation. We skip stats update in such
 * cases.
 */
#define TREE_CONTEXT_FINISH(cx, tc)                                           \
    JS_SCOPE_DEPTH_METERING(                                                  \
        (tc)->maxScopeDepth == (uintN) -1 ||                                  \
        JS_BASIC_STATS_ACCUM(&(cx)->runtime->lexicalScopeDepthStats,          \
                             (tc)->maxScopeDepth))

/*
 * Span-dependent instructions are jumps whose span (from the jump bytecode to
 * the jump target) may require 2 or 4 bytes of immediate operand.
 */
typedef struct JSSpanDep    JSSpanDep;
typedef struct JSJumpTarget JSJumpTarget;

struct JSSpanDep {
    ptrdiff_t       top;        /* offset of first bytecode in an opcode */
    ptrdiff_t       offset;     /* offset - 1 within opcode of jump operand */
    ptrdiff_t       before;     /* original offset - 1 of jump operand */
    JSJumpTarget    *target;    /* tagged target pointer or backpatch delta */
};

/*
 * Jump targets are stored in an AVL tree, for O(log(n)) lookup with targets
 * sorted by offset from left to right, so that targets after a span-dependent
 * instruction whose jump offset operand must be extended can be found quickly
 * and adjusted upward (toward higher offsets).
 */
struct JSJumpTarget {
    ptrdiff_t       offset;     /* offset of span-dependent jump target */
    int             balance;    /* AVL tree balance number */
    JSJumpTarget    *kids[2];   /* left and right AVL tree child pointers */
};

#define JT_LEFT                 0
#define JT_RIGHT                1
#define JT_OTHER_DIR(dir)       (1 - (dir))
#define JT_IMBALANCE(dir)       (((dir) << 1) - 1)
#define JT_DIR(imbalance)       (((imbalance) + 1) >> 1)

/*
 * Backpatch deltas are encoded in JSSpanDep.target if JT_TAG_BIT is clear,
 * so we can maintain backpatch chains when using span dependency records to
 * hold jump offsets that overflow 16 bits.
 */
#define JT_TAG_BIT              ((jsword) 1)
#define JT_UNTAG_SHIFT          1
#define JT_SET_TAG(jt)          ((JSJumpTarget *)((jsword)(jt) | JT_TAG_BIT))
#define JT_CLR_TAG(jt)          ((JSJumpTarget *)((jsword)(jt) & ~JT_TAG_BIT))
#define JT_HAS_TAG(jt)          ((jsword)(jt) & JT_TAG_BIT)

#define BITS_PER_PTRDIFF        (sizeof(ptrdiff_t) * JS_BITS_PER_BYTE)
#define BITS_PER_BPDELTA        (BITS_PER_PTRDIFF - 1 - JT_UNTAG_SHIFT)
#define BPDELTA_MAX             (((ptrdiff_t)1 << BITS_PER_BPDELTA) - 1)
#define BPDELTA_TO_JT(bp)       ((JSJumpTarget *)((bp) << JT_UNTAG_SHIFT))
#define JT_TO_BPDELTA(jt)       ((ptrdiff_t)((jsword)(jt) >> JT_UNTAG_SHIFT))

#define SD_SET_TARGET(sd,jt)    ((sd)->target = JT_SET_TAG(jt))
#define SD_GET_TARGET(sd)       (JS_ASSERT(JT_HAS_TAG((sd)->target)),         \
                                 JT_CLR_TAG((sd)->target))
#define SD_SET_BPDELTA(sd,bp)   ((sd)->target = BPDELTA_TO_JT(bp))
#define SD_GET_BPDELTA(sd)      (JS_ASSERT(!JT_HAS_TAG((sd)->target)),        \
                                 JT_TO_BPDELTA((sd)->target))

/* Avoid asserting twice by expanding SD_GET_TARGET in the "then" clause. */
#define SD_SPAN(sd,pivot)       (SD_GET_TARGET(sd)                            \
                                 ? JT_CLR_TAG((sd)->target)->offset - (pivot) \
                                 : 0)

typedef struct JSTryNode JSTryNode;

struct JSTryNode {
    JSTryNote       note;
    JSTryNode       *prev;
};

typedef struct JSEmittedObjectList {
    uint32              length;     /* number of emitted so far objects */
    JSParsedObjectBox   *lastPob;   /* last emitted object */
} JSEmittedObjectList;

extern void
FinishParsedObjects(JSEmittedObjectList *emittedList, JSObjectArray *objectMap);

struct JSCodeGenerator {
    JSTreeContext   treeContext;    /* base state: statement info stack, etc. */

    JSArenaPool     *codePool;      /* pointer to thread code arena pool */
    JSArenaPool     *notePool;      /* pointer to thread srcnote arena pool */
    void            *codeMark;      /* low watermark in cg->codePool */
    void            *noteMark;      /* low watermark in cg->notePool */

    struct {
        jsbytecode  *base;          /* base of JS bytecode vector */
        jsbytecode  *limit;         /* one byte beyond end of bytecode */
        jsbytecode  *next;          /* pointer to next free bytecode */
        jssrcnote   *notes;         /* source notes, see below */
        uintN       noteCount;      /* number of source notes so far */
        uintN       noteMask;       /* growth increment for notes */
        ptrdiff_t   lastNoteOffset; /* code offset for last source note */
        uintN       currentLine;    /* line number for tree-based srcnote gen */
    } prolog, main, *current;

    JSAtomList      atomList;       /* literals indexed for mapping */
    uintN           firstLine;      /* first line, for js_NewScriptFromCG */

    intN            stackDepth;     /* current stack depth in script frame */
    uintN           maxStackDepth;  /* maximum stack depth so far */

    uintN           ntrynotes;      /* number of allocated so far try notes */
    JSTryNode       *lastTryNode;   /* the last allocated try node */

    JSSpanDep       *spanDeps;      /* span dependent instruction records */
    JSJumpTarget    *jumpTargets;   /* AVL tree of jump target offsets */
    JSJumpTarget    *jtFreeList;    /* JT_LEFT-linked list of free structs */
    uintN           numSpanDeps;    /* number of span dependencies */
    uintN           numJumpTargets; /* number of jump targets */
    ptrdiff_t       spanDepTodo;    /* offset from main.base of potentially
                                       unoptimized spandeps */

    uintN           arrayCompDepth; /* stack depth of array in comprehension */

    uintN           emitLevel;      /* js_EmitTree recursion level */
    JSAtomList      constList;      /* compile time constants */

    JSEmittedObjectList objectList; /* list of emitted so far objects */
    JSEmittedObjectList regexpList; /* list of emitted so far regexp
                                       that will be cloned during execution */

    uintN           staticDepth;    /* static frame chain depth */
    JSAtomList      upvarList;      /* map of atoms to upvar indexes */
    JSUpvarArray    upvarMap;       /* indexed upvar pairs (JS_realloc'ed) */
    JSCodeGenerator *parent;        /* enclosing function or global context */
};

#define CG_TS(cg)               TS((cg)->treeContext.parseContext)

#define CG_BASE(cg)             ((cg)->current->base)
#define CG_LIMIT(cg)            ((cg)->current->limit)
#define CG_NEXT(cg)             ((cg)->current->next)
#define CG_CODE(cg,offset)      (CG_BASE(cg) + (offset))
#define CG_OFFSET(cg)           PTRDIFF(CG_NEXT(cg), CG_BASE(cg), jsbytecode)

#define CG_NOTES(cg)            ((cg)->current->notes)
#define CG_NOTE_COUNT(cg)       ((cg)->current->noteCount)
#define CG_NOTE_MASK(cg)        ((cg)->current->noteMask)
#define CG_LAST_NOTE_OFFSET(cg) ((cg)->current->lastNoteOffset)
#define CG_CURRENT_LINE(cg)     ((cg)->current->currentLine)

#define CG_PROLOG_BASE(cg)      ((cg)->prolog.base)
#define CG_PROLOG_LIMIT(cg)     ((cg)->prolog.limit)
#define CG_PROLOG_NEXT(cg)      ((cg)->prolog.next)
#define CG_PROLOG_CODE(cg,poff) (CG_PROLOG_BASE(cg) + (poff))
#define CG_PROLOG_OFFSET(cg)    PTRDIFF(CG_PROLOG_NEXT(cg), CG_PROLOG_BASE(cg),\
                                        jsbytecode)

#define CG_SWITCH_TO_MAIN(cg)   ((cg)->current = &(cg)->main)
#define CG_SWITCH_TO_PROLOG(cg) ((cg)->current = &(cg)->prolog)

/*
 * Initialize cg to allocate bytecode space from codePool, source note space
 * from notePool, and all other arena-allocated temporaries from cx->tempPool.
 */
extern JS_FRIEND_API(void)
js_InitCodeGenerator(JSContext *cx, JSCodeGenerator *cg, JSParseContext *pc,
                     JSArenaPool *codePool, JSArenaPool *notePool,
                     uintN lineno);

/*
 * Release cg->codePool, cg->notePool, and cx->tempPool to marks set by
 * js_InitCodeGenerator. Note that cgs are magic: they own the arena pool
 * "tops-of-stack" space above their codeMark, noteMark, and tempMark points.
 * This means you cannot alloc from tempPool and save the pointer beyond the
 * next JS_FinishCodeGenerator.
 */
extern JS_FRIEND_API(void)
js_FinishCodeGenerator(JSContext *cx, JSCodeGenerator *cg);

/*
 * Emit one bytecode.
 */
extern ptrdiff_t
js_Emit1(JSContext *cx, JSCodeGenerator *cg, JSOp op);

/*
 * Emit two bytecodes, an opcode (op) with a byte of immediate operand (op1).
 */
extern ptrdiff_t
js_Emit2(JSContext *cx, JSCodeGenerator *cg, JSOp op, jsbytecode op1);

/*
 * Emit three bytecodes, an opcode with two bytes of immediate operands.
 */
extern ptrdiff_t
js_Emit3(JSContext *cx, JSCodeGenerator *cg, JSOp op, jsbytecode op1,
         jsbytecode op2);

/*
 * Emit (1 + extra) bytecodes, for N bytes of op and its immediate operand.
 */
extern ptrdiff_t
js_EmitN(JSContext *cx, JSCodeGenerator *cg, JSOp op, size_t extra);

/*
 * Unsafe macro to call js_SetJumpOffset and return false if it does.
 */
#define CHECK_AND_SET_JUMP_OFFSET_CUSTOM(cx,cg,pc,off,BAD_EXIT)               \
    JS_BEGIN_MACRO                                                            \
        if (!js_SetJumpOffset(cx, cg, pc, off)) {                             \
            BAD_EXIT;                                                         \
        }                                                                     \
    JS_END_MACRO

#define CHECK_AND_SET_JUMP_OFFSET(cx,cg,pc,off)                               \
    CHECK_AND_SET_JUMP_OFFSET_CUSTOM(cx,cg,pc,off,return JS_FALSE)

#define CHECK_AND_SET_JUMP_OFFSET_AT_CUSTOM(cx,cg,off,BAD_EXIT)               \
    CHECK_AND_SET_JUMP_OFFSET_CUSTOM(cx, cg, CG_CODE(cg,off),                 \
                                     CG_OFFSET(cg) - (off), BAD_EXIT)

#define CHECK_AND_SET_JUMP_OFFSET_AT(cx,cg,off)                               \
    CHECK_AND_SET_JUMP_OFFSET_AT_CUSTOM(cx, cg, off, return JS_FALSE)

extern JSBool
js_SetJumpOffset(JSContext *cx, JSCodeGenerator *cg, jsbytecode *pc,
                 ptrdiff_t off);

/* Test whether we're in a statement of given type. */
extern JSBool
js_InStatement(JSTreeContext *tc, JSStmtType type);

/* Test whether we're in a with statement. */
#define js_InWithStatement(tc)      js_InStatement(tc, STMT_WITH)

/*
 * Push the C-stack-allocated struct at stmt onto the stmtInfo stack.
 */
extern void
js_PushStatement(JSTreeContext *tc, JSStmtInfo *stmt, JSStmtType type,
                 ptrdiff_t top);

/*
 * Push a block scope statement and link blockObj into tc->blockChain. To pop
 * this statement info record, use js_PopStatement as usual, or if appropriate
 * (if generating code), js_PopStatementCG.
 */
extern void
js_PushBlockScope(JSTreeContext *tc, JSStmtInfo *stmt, JSObject *blockObj,
                  ptrdiff_t top);

/*
 * Pop tc->topStmt. If the top JSStmtInfo struct is not stack-allocated, it
 * is up to the caller to free it.
 */
extern void
js_PopStatement(JSTreeContext *tc);

/*
 * Like js_PopStatement(&cg->treeContext), also patch breaks and continues
 * unless the top statement info record represents a try-catch-finally suite.
 * May fail if a jump offset overflows.
 */
extern JSBool
js_PopStatementCG(JSContext *cx, JSCodeGenerator *cg);

/*
 * Define and lookup a primitive jsval associated with the const named by atom.
 * js_DefineCompileTimeConstant analyzes the constant-folded initializer at pn
 * and saves the const's value in cg->constList, if it can be used at compile
 * time. It returns true unless an error occurred.
 *
 * If the initializer's value could not be saved, js_DefineCompileTimeConstant
 * calls will return the undefined value. js_DefineCompileTimeConstant tries
 * to find a const value memorized for atom, returning true with *vp set to a
 * value other than undefined if the constant was found, true with *vp set to
 * JSVAL_VOID if not found, and false on error.
 */
extern JSBool
js_DefineCompileTimeConstant(JSContext *cx, JSCodeGenerator *cg, JSAtom *atom,
                             JSParseNode *pn);

/*
 * Find a lexically scoped variable (one declared by let, catch, or an array
 * comprehension) named by atom, looking in tc's compile-time scopes.
 *
 * If a WITH statement is reached along the scope stack, return its statement
 * info record, so callers can tell that atom is ambiguous. If slotp is not
 * null, then if atom is found, set *slotp to its stack slot, otherwise to -1.
 * This means that if slotp is not null, all the block objects on the lexical
 * scope chain must have had their depth slots computed by the code generator,
 * so the caller must be under js_EmitTree.
 *
 * In any event, directly return the statement info record in which atom was
 * found. Otherwise return null.
 */
extern JSStmtInfo *
js_LexicalLookup(JSTreeContext *tc, JSAtom *atom, jsint *slotp);

/*
 * Emit code into cg for the tree rooted at pn.
 */
extern JSBool
js_EmitTree(JSContext *cx, JSCodeGenerator *cg, JSParseNode *pn);

/*
 * Emit function code using cg for the tree rooted at body.
 */
extern JSBool
js_EmitFunctionScript(JSContext *cx, JSCodeGenerator *cg, JSParseNode *body);

/*
 * Source notes generated along with bytecode for decompiling and debugging.
 * A source note is a uint8 with 5 bits of type and 3 of offset from the pc of
 * the previous note. If 3 bits of offset aren't enough, extended delta notes
 * (SRC_XDELTA) consisting of 2 set high order bits followed by 6 offset bits
 * are emitted before the next note. Some notes have operand offsets encoded
 * immediately after them, in note bytes or byte-triples.
 *
 *                 Source Note               Extended Delta
 *              +7-6-5-4-3+2-1-0+           +7-6-5+4-3-2-1-0+
 *              |note-type|delta|           |1 1| ext-delta |
 *              +---------+-----+           +---+-----------+
 *
 * At most one "gettable" note (i.e., a note of type other than SRC_NEWLINE,
 * SRC_SETLINE, and SRC_XDELTA) applies to a given bytecode.
 *
 * NB: the js_SrcNoteSpec array in jsemit.c is indexed by this enum, so its
 * initializers need to match the order here.
 *
 * Note on adding new source notes: every pair of bytecodes (A, B) where A and
 * B have disjoint sets of source notes that could apply to each bytecode may
 * reuse the same note type value for two notes (snA, snB) that have the same
 * arity, offsetBias, and isSpanDep initializers in js_SrcNoteSpec. This is
 * why SRC_IF and SRC_INITPROP have the same value below. For bad historical
 * reasons, some bytecodes below that could be overlayed have not been, but
 * before using SRC_EXTENDED, consider compressing the existing note types.
 *
 * Don't forget to update JSXDR_BYTECODE_VERSION in jsxdrapi.h for all such
 * incompatible source note or other bytecode changes.
 */
typedef enum JSSrcNoteType {
    SRC_NULL        = 0,        /* terminates a note vector */
    SRC_IF          = 1,        /* JSOP_IFEQ bytecode is from an if-then */
    SRC_BREAK       = 1,        /* JSOP_GOTO is a break */
    SRC_INITPROP    = 1,        /* disjoint meaning applied to JSOP_INITELEM or
                                   to an index label in a regular (structuring)
                                   or a destructuring object initialiser */
    SRC_GENEXP      = 1,        /* JSOP_ANONFUNOBJ from generator expression */
    SRC_IF_ELSE     = 2,        /* JSOP_IFEQ bytecode is from an if-then-else */
    SRC_FOR_IN      = 2,        /* JSOP_GOTO to for-in loop condition from
                                   before loop (same arity as SRC_IF_ELSE) */
    SRC_FOR         = 3,        /* JSOP_NOP or JSOP_POP in for(;;) loop head */
    SRC_WHILE       = 4,        /* JSOP_GOTO to for or while loop condition
                                   from before loop, else JSOP_NOP at top of
                                   do-while loop */
    SRC_CONTINUE    = 5,        /* JSOP_GOTO is a continue, not a break;
                                   also used on JSOP_ENDINIT if extra comma
                                   at end of array literal: [1,2,,] */
    SRC_DECL        = 6,        /* type of a declaration (var, const, let*) */
    SRC_DESTRUCT    = 6,        /* JSOP_DUP starting a destructuring assignment
                                   operation, with SRC_DECL_* offset operand */
    SRC_PCDELTA     = 7,        /* distance forward from comma-operator to
                                   next POP, or from CONDSWITCH to first CASE
                                   opcode, etc. -- always a forward delta */
    SRC_GROUPASSIGN = 7,        /* SRC_DESTRUCT variant for [a, b] = [c, d] */
    SRC_ASSIGNOP    = 8,        /* += or another assign-op follows */
    SRC_COND        = 9,        /* JSOP_IFEQ is from conditional ?: operator */
    SRC_BRACE       = 10,       /* mandatory brace, for scope or to avoid
                                   dangling else */
    SRC_HIDDEN      = 11,       /* opcode shouldn't be decompiled */
    SRC_PCBASE      = 12,       /* distance back from annotated getprop or
                                   setprop op to left-most obj.prop.subprop
                                   bytecode -- always a backward delta */
    SRC_LABEL       = 13,       /* JSOP_NOP for label: with atomid immediate */
    SRC_LABELBRACE  = 14,       /* JSOP_NOP for label: {...} begin brace */
    SRC_ENDBRACE    = 15,       /* JSOP_NOP for label: {...} end brace */
    SRC_BREAK2LABEL = 16,       /* JSOP_GOTO for 'break label' with atomid */
    SRC_CONT2LABEL  = 17,       /* JSOP_GOTO for 'continue label' with atomid */
    SRC_SWITCH      = 18,       /* JSOP_*SWITCH with offset to end of switch,
                                   2nd off to first JSOP_CASE if condswitch */
    SRC_FUNCDEF     = 19,       /* JSOP_NOP for function f() with atomid */
    SRC_CATCH       = 20,       /* catch block has guard */
    SRC_EXTENDED    = 21,       /* extended source note, 32-159, in next byte */
    SRC_NEWLINE     = 22,       /* bytecode follows a source newline */
    SRC_SETLINE     = 23,       /* a file-absolute source line number note */
    SRC_XDELTA      = 24        /* 24-31 are for extended delta notes */
} JSSrcNoteType;

/*
 * Constants for the SRC_DECL source note. Note that span-dependent bytecode
 * selection means that any SRC_DECL offset greater than SRC_DECL_LET may need
 * to be adjusted, but these "offsets" are too small to span a span-dependent
 * instruction, so can be used to denote distinct declaration syntaxes to the
 * decompiler.
 *
 * NB: the var_prefix array in jsopcode.c depends on these dense indexes from
 * SRC_DECL_VAR through SRC_DECL_LET.
 */
#define SRC_DECL_VAR            0
#define SRC_DECL_CONST          1
#define SRC_DECL_LET            2
#define SRC_DECL_NONE           3

#define SN_TYPE_BITS            5
#define SN_DELTA_BITS           3
#define SN_XDELTA_BITS          6
#define SN_TYPE_MASK            (JS_BITMASK(SN_TYPE_BITS) << SN_DELTA_BITS)
#define SN_DELTA_MASK           ((ptrdiff_t)JS_BITMASK(SN_DELTA_BITS))
#define SN_XDELTA_MASK          ((ptrdiff_t)JS_BITMASK(SN_XDELTA_BITS))

#define SN_MAKE_NOTE(sn,t,d)    (*(sn) = (jssrcnote)                          \
                                          (((t) << SN_DELTA_BITS)             \
                                           | ((d) & SN_DELTA_MASK)))
#define SN_MAKE_XDELTA(sn,d)    (*(sn) = (jssrcnote)                          \
                                          ((SRC_XDELTA << SN_DELTA_BITS)      \
                                           | ((d) & SN_XDELTA_MASK)))

#define SN_IS_XDELTA(sn)        ((*(sn) >> SN_DELTA_BITS) >= SRC_XDELTA)
#define SN_TYPE(sn)             ((JSSrcNoteType)(SN_IS_XDELTA(sn)             \
                                                 ? SRC_XDELTA                 \
                                                 : *(sn) >> SN_DELTA_BITS))
#define SN_SET_TYPE(sn,type)    SN_MAKE_NOTE(sn, type, SN_DELTA(sn))
#define SN_IS_GETTABLE(sn)      (SN_TYPE(sn) < SRC_NEWLINE)

#define SN_DELTA(sn)            ((ptrdiff_t)(SN_IS_XDELTA(sn)                 \
                                             ? *(sn) & SN_XDELTA_MASK         \
                                             : *(sn) & SN_DELTA_MASK))
#define SN_SET_DELTA(sn,delta)  (SN_IS_XDELTA(sn)                             \
                                 ? SN_MAKE_XDELTA(sn, delta)                  \
                                 : SN_MAKE_NOTE(sn, SN_TYPE(sn), delta))

#define SN_DELTA_LIMIT          ((ptrdiff_t)JS_BIT(SN_DELTA_BITS))
#define SN_XDELTA_LIMIT         ((ptrdiff_t)JS_BIT(SN_XDELTA_BITS))

/*
 * Offset fields follow certain notes and are frequency-encoded: an offset in
 * [0,0x7f] consumes one byte, an offset in [0x80,0x7fffff] takes three, and
 * the high bit of the first byte is set.
 */
#define SN_3BYTE_OFFSET_FLAG    0x80
#define SN_3BYTE_OFFSET_MASK    0x7f

typedef struct JSSrcNoteSpec {
    const char      *name;      /* name for disassembly/debugging output */
    int8            arity;      /* number of offset operands */
    uint8           offsetBias; /* bias of offset(s) from annotated pc */
    int8            isSpanDep;  /* 1 or -1 if offsets could span extended ops,
                                   0 otherwise; sign tells span direction */
} JSSrcNoteSpec;

extern JS_FRIEND_DATA(JSSrcNoteSpec) js_SrcNoteSpec[];
extern JS_FRIEND_API(uintN)          js_SrcNoteLength(jssrcnote *sn);

#define SN_LENGTH(sn)           ((js_SrcNoteSpec[SN_TYPE(sn)].arity == 0) ? 1 \
                                 : js_SrcNoteLength(sn))
#define SN_NEXT(sn)             ((sn) + SN_LENGTH(sn))

/* A source note array is terminated by an all-zero element. */
#define SN_MAKE_TERMINATOR(sn)  (*(sn) = SRC_NULL)
#define SN_IS_TERMINATOR(sn)    (*(sn) == SRC_NULL)

/*
 * Append a new source note of the given type (and therefore size) to cg's
 * notes dynamic array, updating cg->noteCount. Return the new note's index
 * within the array pointed at by cg->current->notes. Return -1 if out of
 * memory.
 */
extern intN
js_NewSrcNote(JSContext *cx, JSCodeGenerator *cg, JSSrcNoteType type);

extern intN
js_NewSrcNote2(JSContext *cx, JSCodeGenerator *cg, JSSrcNoteType type,
               ptrdiff_t offset);

extern intN
js_NewSrcNote3(JSContext *cx, JSCodeGenerator *cg, JSSrcNoteType type,
               ptrdiff_t offset1, ptrdiff_t offset2);

/*
 * NB: this function can add at most one extra extended delta note.
 */
extern jssrcnote *
js_AddToSrcNoteDelta(JSContext *cx, JSCodeGenerator *cg, jssrcnote *sn,
                     ptrdiff_t delta);

/*
 * Get and set the offset operand identified by which (0 for the first, etc.).
 */
extern JS_FRIEND_API(ptrdiff_t)
js_GetSrcNoteOffset(jssrcnote *sn, uintN which);

extern JSBool
js_SetSrcNoteOffset(JSContext *cx, JSCodeGenerator *cg, uintN index,
                    uintN which, ptrdiff_t offset);

/*
 * Finish taking source notes in cx's notePool, copying final notes to the new
 * stable store allocated by the caller and passed in via notes. Return false
 * on malloc failure, which means this function reported an error.
 *
 * To compute the number of jssrcnotes to allocate and pass in via notes, use
 * the CG_COUNT_FINAL_SRCNOTES macro. This macro knows a lot about details of
 * js_FinishTakingSrcNotes, SO DON'T CHANGE jsemit.c's js_FinishTakingSrcNotes
 * FUNCTION WITHOUT CHECKING WHETHER THIS MACRO NEEDS CORRESPONDING CHANGES!
 */
#define CG_COUNT_FINAL_SRCNOTES(cg, cnt)                                      \
    JS_BEGIN_MACRO                                                            \
        ptrdiff_t diff_ = CG_PROLOG_OFFSET(cg) - (cg)->prolog.lastNoteOffset; \
        cnt = (cg)->prolog.noteCount + (cg)->main.noteCount + 1;              \
        if ((cg)->prolog.noteCount &&                                         \
            (cg)->prolog.currentLine != (cg)->firstLine) {                    \
            if (diff_ > SN_DELTA_MASK)                                        \
                cnt += JS_HOWMANY(diff_ - SN_DELTA_MASK, SN_XDELTA_MASK);     \
            cnt += 2 + (((cg)->firstLine > SN_3BYTE_OFFSET_MASK) << 1);       \
        } else if (diff_ > 0) {                                               \
            if (cg->main.noteCount) {                                         \
                jssrcnote *sn_ = (cg)->main.notes;                            \
                diff_ -= SN_IS_XDELTA(sn_)                                    \
                         ? SN_XDELTA_MASK - (*sn_ & SN_XDELTA_MASK)           \
                         : SN_DELTA_MASK - (*sn_ & SN_DELTA_MASK);            \
            }                                                                 \
            if (diff_ > 0)                                                    \
                cnt += JS_HOWMANY(diff_, SN_XDELTA_MASK);                     \
        }                                                                     \
    JS_END_MACRO

extern JSBool
js_FinishTakingSrcNotes(JSContext *cx, JSCodeGenerator *cg, jssrcnote *notes);

extern void
js_FinishTakingTryNotes(JSCodeGenerator *cg, JSTryNoteArray *array);

JS_END_EXTERN_C

#endif /* jsemit_h___ */
