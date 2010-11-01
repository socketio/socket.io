/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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

#ifndef jsopcode_h___
#define jsopcode_h___
/*
 * JS bytecode definitions.
 */
#include <stddef.h>
#include "jsprvtd.h"
#include "jspubtd.h"
#include "jsutil.h"

JS_BEGIN_EXTERN_C

/*
 * JS operation bytecodes.
 */
typedef enum JSOp {
#define OPDEF(op,val,name,token,length,nuses,ndefs,prec,format) \
    op = val,
#include "jsopcode.tbl"
#undef OPDEF
    JSOP_LIMIT
} JSOp;

/*
 * JS bytecode formats.
 */
#define JOF_BYTE          0       /* single bytecode, no immediates */
#define JOF_JUMP          1       /* signed 16-bit jump offset immediate */
#define JOF_ATOM          2       /* unsigned 16-bit constant pool index */
#define JOF_UINT16        3       /* unsigned 16-bit immediate operand */
#define JOF_TABLESWITCH   4       /* table switch */
#define JOF_LOOKUPSWITCH  5       /* lookup switch */
#define JOF_QARG          6       /* quickened get/set function argument ops */
#define JOF_LOCAL         7       /* var or block-local variable */
#define JOF_SLOTATOM      8       /* uint16 slot index + constant pool index */
#define JOF_JUMPX         9       /* signed 32-bit jump offset immediate */
#define JOF_TABLESWITCHX  10      /* extended (32-bit offset) table switch */
#define JOF_LOOKUPSWITCHX 11      /* extended (32-bit offset) lookup switch */
#define JOF_UINT24        12      /* extended unsigned 24-bit literal (index) */
#define JOF_UINT8         13      /* uint8 immediate, e.g. top 8 bits of 24-bit
                                     atom index */
#define JOF_INT32         14      /* int32 immediate operand */
#define JOF_OBJECT        15      /* unsigned 16-bit object pool index */
#define JOF_SLOTOBJECT    16      /* uint16 slot index + object pool index */
#define JOF_REGEXP        17      /* unsigned 16-bit regexp pool index */
#define JOF_INT8          18      /* int8 immediate operand */
#define JOF_TYPEMASK      0x001f  /* mask for above immediate types */

#define JOF_NAME          (1U<<5) /* name operation */
#define JOF_PROP          (2U<<5) /* obj.prop operation */
#define JOF_ELEM          (3U<<5) /* obj[index] operation */
#define JOF_XMLNAME       (4U<<5) /* XML name: *, a::b, @a, @a::b, etc. */
#define JOF_VARPROP       (5U<<5) /* x.prop for this, arg, var, or local x */
#define JOF_MODEMASK      (7U<<5) /* mask for above addressing modes */
#define JOF_SET           (1U<<8) /* set (i.e., assignment) operation */
#define JOF_DEL           (1U<<9) /* delete operation */
#define JOF_DEC          (1U<<10) /* decrement (--, not ++) opcode */
#define JOF_INC          (2U<<10) /* increment (++, not --) opcode */
#define JOF_INCDEC       (3U<<10) /* increment or decrement opcode */
#define JOF_POST         (1U<<12) /* postorder increment or decrement */
#define JOF_FOR          (1U<<13) /* for-in property op (akin to JOF_SET) */
#define JOF_ASSIGNING     JOF_SET /* hint for JSClass.resolve, used for ops
                                     that do simplex assignment */
#define JOF_DETECTING    (1U<<14) /* object detection for JSNewResolveOp */
#define JOF_BACKPATCH    (1U<<15) /* backpatch placeholder during codegen */
#define JOF_LEFTASSOC    (1U<<16) /* left-associative operator */
#define JOF_DECLARING    (1U<<17) /* var, const, or function declaration op */
#define JOF_INDEXBASE    (1U<<18) /* atom segment base setting prefix op */
#define JOF_CALLOP       (1U<<19) /* call operation that pushes function and
                                     this */
#define JOF_PARENHEAD    (1U<<20) /* opcode consumes value of expression in
                                     parenthesized statement head */
#define JOF_INVOKE       (1U<<21) /* JSOP_CALL, JSOP_NEW, JSOP_EVAL */
#define JOF_TMPSLOT      (1U<<22) /* interpreter uses extra temporary slot
                                     to root intermediate objects besides
                                     the slots opcode uses */
#define JOF_TMPSLOT2     (2U<<22) /* interpreter uses extra 2 temporary slot
                                     besides the slots opcode uses */
#define JOF_TMPSLOT_SHIFT 22
#define JOF_TMPSLOT_MASK  (JS_BITMASK(2) << JOF_TMPSLOT_SHIFT)

/* Shorthands for type from format and type from opcode. */
#define JOF_TYPE(fmt)   ((fmt) & JOF_TYPEMASK)
#define JOF_OPTYPE(op)  JOF_TYPE(js_CodeSpec[op].format)

/* Shorthands for mode from format and mode from opcode. */
#define JOF_MODE(fmt)   ((fmt) & JOF_MODEMASK)
#define JOF_OPMODE(op)  JOF_MODE(js_CodeSpec[op].format)

#define JOF_TYPE_IS_EXTENDED_JUMP(t) \
    ((unsigned)((t) - JOF_JUMPX) <= (unsigned)(JOF_LOOKUPSWITCHX - JOF_JUMPX))

/*
 * Immediate operand getters, setters, and bounds.
 */

/* Common uint16 immediate format helpers. */
#define UINT16_LEN              2
#define UINT16_HI(i)            ((jsbytecode)((i) >> 8))
#define UINT16_LO(i)            ((jsbytecode)(i))
#define GET_UINT16(pc)          ((uintN)(((pc)[1] << 8) | (pc)[2]))
#define SET_UINT16(pc,i)        ((pc)[1] = UINT16_HI(i), (pc)[2] = UINT16_LO(i))
#define UINT16_LIMIT            ((uintN)1 << 16)

/* Short (2-byte signed offset) relative jump macros. */
#define JUMP_OFFSET_LEN         2
#define JUMP_OFFSET_HI(off)     ((jsbytecode)((off) >> 8))
#define JUMP_OFFSET_LO(off)     ((jsbytecode)(off))
#define GET_JUMP_OFFSET(pc)     ((int16)GET_UINT16(pc))
#define SET_JUMP_OFFSET(pc,off) ((pc)[1] = JUMP_OFFSET_HI(off),               \
                                 (pc)[2] = JUMP_OFFSET_LO(off))
#define JUMP_OFFSET_MIN         ((int16)0x8000)
#define JUMP_OFFSET_MAX         ((int16)0x7fff)

/*
 * When a short jump won't hold a relative offset, its 2-byte immediate offset
 * operand is an unsigned index of a span-dependency record, maintained until
 * code generation finishes -- after which some (but we hope not nearly all)
 * span-dependent jumps must be extended (see OptimizeSpanDeps in jsemit.c).
 *
 * If the span-dependency record index overflows SPANDEP_INDEX_MAX, the jump
 * offset will contain SPANDEP_INDEX_HUGE, indicating that the record must be
 * found (via binary search) by its "before span-dependency optimization" pc
 * offset (from script main entry point).
 */
#define GET_SPANDEP_INDEX(pc)   ((uint16)GET_UINT16(pc))
#define SET_SPANDEP_INDEX(pc,i) ((pc)[1] = JUMP_OFFSET_HI(i),                 \
                                 (pc)[2] = JUMP_OFFSET_LO(i))
#define SPANDEP_INDEX_MAX       ((uint16)0xfffe)
#define SPANDEP_INDEX_HUGE      ((uint16)0xffff)

/* Ultimately, if short jumps won't do, emit long (4-byte signed) offsets. */
#define JUMPX_OFFSET_LEN        4
#define JUMPX_OFFSET_B3(off)    ((jsbytecode)((off) >> 24))
#define JUMPX_OFFSET_B2(off)    ((jsbytecode)((off) >> 16))
#define JUMPX_OFFSET_B1(off)    ((jsbytecode)((off) >> 8))
#define JUMPX_OFFSET_B0(off)    ((jsbytecode)(off))
#define GET_JUMPX_OFFSET(pc)    ((int32)(((pc)[1] << 24) | ((pc)[2] << 16)    \
                                         | ((pc)[3] << 8) | (pc)[4]))
#define SET_JUMPX_OFFSET(pc,off)((pc)[1] = JUMPX_OFFSET_B3(off),              \
                                 (pc)[2] = JUMPX_OFFSET_B2(off),              \
                                 (pc)[3] = JUMPX_OFFSET_B1(off),              \
                                 (pc)[4] = JUMPX_OFFSET_B0(off))
#define JUMPX_OFFSET_MIN        ((int32)0x80000000)
#define JUMPX_OFFSET_MAX        ((int32)0x7fffffff)

/*
 * A literal is indexed by a per-script atom or object maps. Most scripts
 * have relatively few literals, so the standard JOF_ATOM, JOF_OBJECT and
 * JOF_REGEXP formats specifies a fixed 16 bits of immediate operand index.
 * A script with more than 64K literals must wrap the bytecode into
 * JSOP_INDEXBASE and JSOP_RESETBASE pair.
 */
#define INDEX_LEN               2
#define INDEX_HI(i)             ((jsbytecode)((i) >> 8))
#define INDEX_LO(i)             ((jsbytecode)(i))
#define GET_INDEX(pc)           GET_UINT16(pc)
#define SET_INDEX(pc,i)         ((pc)[1] = INDEX_HI(i), (pc)[2] = INDEX_LO(i))

#define GET_INDEXBASE(pc)       (JS_ASSERT(*(pc) == JSOP_INDEXBASE),          \
                                 ((uintN)((pc)[1])) << 16)
#define INDEXBASE_LEN           1

#define UINT24_HI(i)            ((jsbytecode)((i) >> 16))
#define UINT24_MID(i)           ((jsbytecode)((i) >> 8))
#define UINT24_LO(i)            ((jsbytecode)(i))
#define GET_UINT24(pc)          ((jsatomid)(((pc)[1] << 16) |                 \
                                            ((pc)[2] << 8) |                  \
                                            (pc)[3]))
#define SET_UINT24(pc,i)        ((pc)[1] = UINT24_HI(i),                      \
                                 (pc)[2] = UINT24_MID(i),                     \
                                 (pc)[3] = UINT24_LO(i))

#define GET_INT8(pc)            ((jsint)(int8)(pc)[1])

#define GET_INT32(pc)           ((jsint)(((uint32)((pc)[1]) << 24) |          \
                                         ((uint32)((pc)[2]) << 16) |          \
                                         ((uint32)((pc)[3]) << 8)  |          \
                                         (uint32)(pc)[4]))
#define SET_INT32(pc,i)         ((pc)[1] = (jsbytecode)((uint32)(i) >> 24),   \
                                 (pc)[2] = (jsbytecode)((uint32)(i) >> 16),   \
                                 (pc)[3] = (jsbytecode)((uint32)(i) >> 8),    \
                                 (pc)[4] = (jsbytecode)(uint32)(i))

/* Index limit is determined by SN_3BYTE_OFFSET_FLAG, see jsemit.h. */
#define INDEX_LIMIT_LOG2        23
#define INDEX_LIMIT             ((uint32)1 << INDEX_LIMIT_LOG2)

JS_STATIC_ASSERT(sizeof(uint32) * JS_BITS_PER_BYTE >= INDEX_LIMIT_LOG2 + 1);

/* Actual argument count operand format helpers. */
#define ARGC_HI(argc)           UINT16_HI(argc)
#define ARGC_LO(argc)           UINT16_LO(argc)
#define GET_ARGC(pc)            GET_UINT16(pc)
#define ARGC_LIMIT              UINT16_LIMIT

/* Synonyms for quick JOF_QARG and JOF_LOCAL bytecodes. */
#define GET_ARGNO(pc)           GET_UINT16(pc)
#define SET_ARGNO(pc,argno)     SET_UINT16(pc,argno)
#define ARGNO_LEN               2
#define ARGNO_LIMIT             UINT16_LIMIT

#define GET_SLOTNO(pc)          GET_UINT16(pc)
#define SET_SLOTNO(pc,varno)    SET_UINT16(pc,varno)
#define SLOTNO_LEN              2
#define SLOTNO_LIMIT            UINT16_LIMIT

struct JSCodeSpec {
    int8                length;         /* length including opcode byte */
    int8                nuses;          /* arity, -1 if variadic */
    int8                ndefs;          /* number of stack results */
    uint8               prec;           /* operator precedence */
    uint32              format;         /* immediate operand format */
};

extern const JSCodeSpec js_CodeSpec[];
extern uintN            js_NumCodeSpecs;
extern const char       *js_CodeName[];
extern const char       js_EscapeMap[];

/*
 * Return a GC'ed string containing the chars in str, with any non-printing
 * chars or quotes (' or " as specified by the quote argument) escaped, and
 * with the quote character at the beginning and end of the result string.
 */
extern JSString *
js_QuoteString(JSContext *cx, JSString *str, jschar quote);

/*
 * JSPrinter operations, for printf style message formatting.  The return
 * value from js_GetPrinterOutput() is the printer's cumulative output, in
 * a GC'ed string.
 */

#ifdef JS_ARENAMETER
# define JS_NEW_PRINTER(cx, name, fun, indent, pretty)                        \
    js_NewPrinter(cx, name, fun, indent, pretty)
#else
# define JS_NEW_PRINTER(cx, name, fun, indent, pretty)                        \
    js_NewPrinter(cx, fun, indent, pretty)
#endif

extern JSPrinter *
JS_NEW_PRINTER(JSContext *cx, const char *name, JSFunction *fun,
               uintN indent, JSBool pretty);

extern void
js_DestroyPrinter(JSPrinter *jp);

extern JSString *
js_GetPrinterOutput(JSPrinter *jp);

extern int
js_printf(JSPrinter *jp, const char *format, ...);

extern JSBool
js_puts(JSPrinter *jp, const char *s);

/*
 * Get index operand from the bytecode using a bytecode analysis to deduce the
 * the index register. This function is infallible, in spite of taking cx as
 * its first parameter; it uses only cx->runtime when calling JS_GetTrapOpcode.
 * The GET_*_FROM_BYTECODE macros that call it pick up cx from their caller's
 * lexical environments.
 */
uintN
js_GetIndexFromBytecode(JSContext *cx, JSScript *script, jsbytecode *pc,
                        ptrdiff_t pcoff);

/*
 * A slower version of GET_ATOM when the caller does not want to maintain
 * the index segment register itself.
 */
#define GET_ATOM_FROM_BYTECODE(script, pc, pcoff, atom)                       \
    JS_BEGIN_MACRO                                                            \
        uintN index_ = js_GetIndexFromBytecode(cx, (script), (pc), (pcoff));  \
        JS_GET_SCRIPT_ATOM((script), index_, atom);                           \
    JS_END_MACRO

#define GET_OBJECT_FROM_BYTECODE(script, pc, pcoff, obj)                      \
    JS_BEGIN_MACRO                                                            \
        uintN index_ = js_GetIndexFromBytecode(cx, (script), (pc), (pcoff));  \
        JS_GET_SCRIPT_OBJECT((script), index_, obj);                          \
    JS_END_MACRO

#define GET_FUNCTION_FROM_BYTECODE(script, pc, pcoff, fun)                    \
    JS_BEGIN_MACRO                                                            \
        uintN index_ = js_GetIndexFromBytecode(cx, (script), (pc), (pcoff));  \
        JS_GET_SCRIPT_FUNCTION((script), index_, fun);                        \
    JS_END_MACRO

#define GET_REGEXP_FROM_BYTECODE(script, pc, pcoff, obj)                      \
    JS_BEGIN_MACRO                                                            \
        uintN index_ = js_GetIndexFromBytecode(cx, (script), (pc), (pcoff));  \
        JS_GET_SCRIPT_REGEXP((script), index_, obj);                          \
    JS_END_MACRO

/*
 * Get the length of variable-length bytecode like JSOP_TABLESWITCH.
 */
extern uintN
js_GetVariableBytecodeLength(jsbytecode *pc);

/*
 * Find the number of stack slots used by a variadic opcode such as JSOP_CALL
 * or JSOP_NEWARRAY (for such ops, JSCodeSpec.nuses is -1).
 */
extern uintN
js_GetVariableStackUseLength(JSOp op, jsbytecode *pc);

#ifdef DEBUG
/*
 * Disassemblers, for debugging only.
 */
#include <stdio.h>

extern JS_FRIEND_API(JSBool)
js_Disassemble(JSContext *cx, JSScript *script, JSBool lines, FILE *fp);

extern JS_FRIEND_API(uintN)
js_Disassemble1(JSContext *cx, JSScript *script, jsbytecode *pc, uintN loc,
                JSBool lines, FILE *fp);
#endif /* DEBUG */

/*
 * Decompilers, for script, function, and expression pretty-printing.
 */
extern JSBool
js_DecompileScript(JSPrinter *jp, JSScript *script);

extern JSBool
js_DecompileFunctionBody(JSPrinter *jp);

extern JSBool
js_DecompileFunction(JSPrinter *jp);

/*
 * Find the source expression that resulted in v, and return a newly allocated
 * C-string containing it.  Fall back on v's string conversion (fallback) if we
 * can't find the bytecode that generated and pushed v on the operand stack.
 *
 * Search the current stack frame if spindex is JSDVG_SEARCH_STACK.  Don't
 * look for v on the stack if spindex is JSDVG_IGNORE_STACK.  Otherwise,
 * spindex is the negative index of v, measured from cx->fp->sp, or from a
 * lower frame's sp if cx->fp is native.
 *
 * The caller must call JS_free on the result after a succsesful call.
 */
extern char *
js_DecompileValueGenerator(JSContext *cx, intN spindex, jsval v,
                           JSString *fallback);

#define JSDVG_IGNORE_STACK      0
#define JSDVG_SEARCH_STACK      1

/*
 * Given bytecode address pc in script's main program code, return the operand
 * stack depth just before (JSOp) *pc executes.
 */
extern uintN
js_ReconstructStackDepth(JSContext *cx, JSScript *script, jsbytecode *pc);

JS_END_EXTERN_C

#endif /* jsopcode_h___ */
