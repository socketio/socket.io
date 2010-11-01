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

#ifndef jsgc_h___
#define jsgc_h___
/*
 * JS Garbage Collector.
 */
#include "jsprvtd.h"
#include "jspubtd.h"
#include "jsdhash.h"
#include "jsbit.h"
#include "jsutil.h"

JS_BEGIN_EXTERN_C

JS_STATIC_ASSERT(JSTRACE_STRING == 2);

#define JSTRACE_XML         3

/*
 * One past the maximum trace kind.
 */
#define JSTRACE_LIMIT       4

/*
 * We use the trace kinds as the types for all GC things except external
 * strings.
 */
#define GCX_OBJECT              JSTRACE_OBJECT      /* JSObject */
#define GCX_DOUBLE              JSTRACE_DOUBLE      /* jsdouble */
#define GCX_STRING              JSTRACE_STRING      /* JSString */
#define GCX_XML                 JSTRACE_XML         /* JSXML */
#define GCX_EXTERNAL_STRING     JSTRACE_LIMIT       /* JSString with external
                                                       chars */
/*
 * The number of defined GC types.
 */
#define GCX_NTYPES              (GCX_EXTERNAL_STRING + 8)

/*
 * The maximum limit for the number of GC types.
 */
#define GCX_LIMIT_LOG2         4           /* type index bits */
#define GCX_LIMIT              JS_BIT(GCX_LIMIT_LOG2)

JS_STATIC_ASSERT(GCX_NTYPES <= GCX_LIMIT);

/* GC flag definitions, must fit in 8 bits (type index goes in the low bits). */
#define GCF_TYPEMASK    JS_BITMASK(GCX_LIMIT_LOG2)
#define GCF_MARK        JS_BIT(GCX_LIMIT_LOG2)
#define GCF_FINAL       JS_BIT(GCX_LIMIT_LOG2 + 1)
#define GCF_LOCKSHIFT   (GCX_LIMIT_LOG2 + 2)   /* lock bit shift */
#define GCF_LOCK        JS_BIT(GCF_LOCKSHIFT)   /* lock request bit in API */

/*
 * Get the type of the external string or -1 if the string was not created
 * with JS_NewExternalString.
 */
extern intN
js_GetExternalStringGCType(JSString *str);

extern JS_FRIEND_API(uint32)
js_GetGCThingTraceKind(void *thing);

/*
 * The sole purpose of the function is to preserve public API compatibility
 * in JS_GetStringBytes which takes only single JSString* argument.
 */
JSRuntime*
js_GetGCStringRuntime(JSString *str);

#if 1
/*
 * Since we're forcing a GC from JS_GC anyway, don't bother wasting cycles
 * loading oldval.  XXX remove implied force, fix jsinterp.c's "second arg
 * ignored", etc.
 */
#define GC_POKE(cx, oldval) ((cx)->runtime->gcPoke = JS_TRUE)
#else
#define GC_POKE(cx, oldval) ((cx)->runtime->gcPoke = JSVAL_IS_GCTHING(oldval))
#endif

/*
 * Write barrier macro monitoring property update from oldval to newval in
 * scope->object.
 *
 * Since oldval is used only for the branded scope case, and the oldval actual
 * argument expression is typically not used otherwise by callers, performance
 * benefits if oldval is *not* evaluated into a callsite temporary variable,
 * and instead passed to GC_WRITE_BARRIER for conditional evaluation (we rely
 * on modern compilers to do a good CSE job). Yay, C macros.
 */
#define GC_WRITE_BARRIER(cx,scope,oldval,newval)                              \
    JS_BEGIN_MACRO                                                            \
        if (SCOPE_IS_BRANDED(scope) &&                                        \
            (oldval) != (newval) &&                                           \
            (VALUE_IS_FUNCTION(cx,oldval) || VALUE_IS_FUNCTION(cx,newval))) { \
            SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);                               \
        }                                                                     \
        GC_POKE(cx, oldval);                                                  \
    JS_END_MACRO

extern JSBool
js_InitGC(JSRuntime *rt, uint32 maxbytes);

extern void
js_FinishGC(JSRuntime *rt);

extern intN
js_ChangeExternalStringFinalizer(JSStringFinalizeOp oldop,
                                 JSStringFinalizeOp newop);

extern JSBool
js_AddRoot(JSContext *cx, void *rp, const char *name);

extern JSBool
js_AddRootRT(JSRuntime *rt, void *rp, const char *name);

extern JSBool
js_RemoveRoot(JSRuntime *rt, void *rp);

#ifdef DEBUG
extern void
js_DumpNamedRoots(JSRuntime *rt,
                  void (*dump)(const char *name, void *rp, void *data),
                  void *data);
#endif

extern uint32
js_MapGCRoots(JSRuntime *rt, JSGCRootMapFun map, void *data);

/* Table of pointers with count valid members. */
typedef struct JSPtrTable {
    size_t      count;
    void        **array;
} JSPtrTable;

extern JSBool
js_RegisterCloseableIterator(JSContext *cx, JSObject *obj);

/*
 * The private JSGCThing struct, which describes a gcFreeList element.
 */
struct JSGCThing {
    JSGCThing   *next;
    uint8       *flagp;
};

#define GC_NBYTES_MAX           (10 * sizeof(JSGCThing))
#define GC_NUM_FREELISTS        (GC_NBYTES_MAX / sizeof(JSGCThing))
#define GC_FREELIST_NBYTES(i)   (((i) + 1) * sizeof(JSGCThing))
#define GC_FREELIST_INDEX(n)    (((n) / sizeof(JSGCThing)) - 1)

/*
 * Allocates a new GC thing of the given size. After a successful allocation
 * the caller must fully initialize the thing before calling any function that
 * can potentially trigger GC. This will ensure that GC tracing never sees junk
 * values stored in the partially initialized thing.
 */
extern void *
js_NewGCThing(JSContext *cx, uintN flags, size_t nbytes);

/*
 * Allocate a new double jsval and store the result in *vp. vp must be a root.
 * The function does not copy the result into any weak root.
 */
extern JSBool
js_NewDoubleInRootedValue(JSContext *cx, jsdouble d, jsval *vp);

/*
 * Return a pointer to a new GC-allocated and weakly-rooted jsdouble number,
 * or null when the allocation fails.
 */
extern jsdouble *
js_NewWeaklyRootedDouble(JSContext *cx, jsdouble d);

extern JSBool
js_LockGCThingRT(JSRuntime *rt, void *thing);

extern JSBool
js_UnlockGCThingRT(JSRuntime *rt, void *thing);

extern JSBool
js_IsAboutToBeFinalized(JSContext *cx, void *thing);

/*
 * Macro to test if a traversal is the marking phase of GC to avoid exposing
 * ScriptFilenameEntry to traversal implementations.
 */
#define IS_GC_MARKING_TRACER(trc) ((trc)->callback == NULL)

#if JS_HAS_XML_SUPPORT
# define JS_IS_VALID_TRACE_KIND(kind) ((uint32)(kind) < JSTRACE_LIMIT)
#else
# define JS_IS_VALID_TRACE_KIND(kind) ((uint32)(kind) <= JSTRACE_STRING)
#endif

/*
 * JS_IS_VALID_TRACE_KIND assumes that JSTRACE_STRING is the last non-xml
 * trace kind when JS_HAS_XML_SUPPORT is false.
 */
JS_STATIC_ASSERT(JSTRACE_STRING + 1 == JSTRACE_XML);

/*
 * Trace jsval when JSVAL_IS_OBJECT(v) can be an arbitrary GC thing casted as
 * JSVAL_OBJECT and js_GetGCThingTraceKind has to be used to find the real
 * type behind v.
 */
extern void
js_CallValueTracerIfGCThing(JSTracer *trc, jsval v);

extern void
js_TraceStackFrame(JSTracer *trc, JSStackFrame *fp);

extern void
js_TraceRuntime(JSTracer *trc, JSBool allAtoms);

extern JS_FRIEND_API(void)
js_TraceContext(JSTracer *trc, JSContext *acx);

/*
 * Kinds of js_GC invocation.
 */
typedef enum JSGCInvocationKind {
    /* Normal invocation. */
    GC_NORMAL           = 0,

    /*
     * Called from js_DestroyContext for last JSContext in a JSRuntime, when
     * it is imperative that rt->gcPoke gets cleared early in js_GC.
     */
    GC_LAST_CONTEXT     = 1,

    /*
     * Flag bit telling js_GC that the caller has already acquired rt->gcLock.
     * Currently, this flag is set for the invocation kinds that also preserve
     * atoms and weak roots, so we don't need another bit for GC_KEEP_ATOMS.
     */
    GC_LOCK_HELD        = 0x10,
    GC_KEEP_ATOMS       = GC_LOCK_HELD,

    /*
     * Called from js_SetProtoOrParent with a request to set an object's proto
     * or parent slot inserted on rt->setSlotRequests.
     */
    GC_SET_SLOT_REQUEST = GC_LOCK_HELD | 1,

    /*
     * Called from js_NewGCThing as a last-ditch GC attempt. See comments in
     * jsgc.c just before js_GC's definition for details.
     */
    GC_LAST_DITCH       = GC_LOCK_HELD | 2
} JSGCInvocationKind;

extern void
js_GC(JSContext *cx, JSGCInvocationKind gckind);

/* Call this after succesful malloc of memory for GC-related things. */
extern void
js_UpdateMallocCounter(JSContext *cx, size_t nbytes);

typedef struct JSGCArenaInfo JSGCArenaInfo;
typedef struct JSGCArenaList JSGCArenaList;
typedef struct JSGCChunkInfo JSGCChunkInfo;

struct JSGCArenaList {
    JSGCArenaInfo   *last;          /* last allocated GC arena */
    uint16          lastCount;      /* number of allocated things in the last
                                       arena */
    uint16          thingSize;      /* size of things to allocate on this list
                                     */
    JSGCThing       *freeList;      /* list of free GC things */
};

typedef union JSGCDoubleCell JSGCDoubleCell;

union JSGCDoubleCell {
    double          number;
    JSGCDoubleCell  *link;
};

JS_STATIC_ASSERT(sizeof(JSGCDoubleCell) == sizeof(double));

typedef struct JSGCDoubleArenaList {
    JSGCArenaInfo   *first;             /* first allocated GC arena */
    jsbitmap        *nextDoubleFlags;   /* bitmask with flags to check for free
                                           things */
} JSGCDoubleArenaList;

typedef struct JSGCFreeListSet JSGCFreeListSet;

struct JSGCFreeListSet {
    JSGCThing           *array[GC_NUM_FREELISTS];
    JSGCFreeListSet     *link;
};

extern const JSGCFreeListSet js_GCEmptyFreeListSet;

extern void
js_RevokeGCLocalFreeLists(JSContext *cx);

struct JSWeakRoots {
    /* Most recently created things by type, members of the GC's root set. */
    void            *newborn[GCX_NTYPES];

    /* Atom root for the last-looked-up atom on this context. */
    jsval           lastAtom;

    /* Root for the result of the most recent js_InternalInvoke call. */
    jsval           lastInternalResult;
};

JS_STATIC_ASSERT(JSVAL_NULL == 0);
#define JS_CLEAR_WEAK_ROOTS(wr) (memset((wr), 0, sizeof(JSWeakRoots)))

/*
 * Increase runtime->gcBytes by sz bytes to account for an allocation outside
 * the GC that will be freed only after the GC is run. The function may run
 * the last ditch GC to ensure that gcBytes does not exceed gcMaxBytes. It will
 * fail if the latter is not possible.
 *
 * This function requires that runtime->gcLock is held on entry. On successful
 * return the lock is still held and on failure it will be released with
 * the error reported.
 */
extern JSBool
js_AddAsGCBytes(JSContext *cx, size_t sz);

extern void
js_RemoveAsGCBytes(JSRuntime* rt, size_t sz);

#ifdef DEBUG_notme
#define JS_GCMETER 1
#endif

#ifdef JS_GCMETER

typedef struct JSGCArenaStats {
    uint32  alloc;          /* allocation attempts */
    uint32  localalloc;     /* allocations from local lists */
    uint32  retry;          /* allocation retries after running the GC */
    uint32  fail;           /* allocation failures */
    uint32  nthings;        /* live GC things */
    uint32  maxthings;      /* maximum of live GC cells */
    double  totalthings;    /* live GC things the GC scanned so far */
    uint32  narenas;        /* number of arena in list before the GC */
    uint32  newarenas;      /* new arenas allocated before the last GC */
    uint32  livearenas;     /* number of live arenas after the last GC */
    uint32  maxarenas;      /* maximum of allocated arenas */
    uint32  totalarenas;    /* total number of arenas with live things that
                               GC scanned so far */
} JSGCArenaStats;

typedef struct JSGCStats {
    uint32  finalfail;  /* finalizer calls allocator failures */
    uint32  lockborn;   /* things born locked */
    uint32  lock;       /* valid lock calls */
    uint32  unlock;     /* valid unlock calls */
    uint32  depth;      /* mark tail recursion depth */
    uint32  maxdepth;   /* maximum mark tail recursion depth */
    uint32  cdepth;     /* mark recursion depth of C functions */
    uint32  maxcdepth;  /* maximum mark recursion depth of C functions */
    uint32  untraced;   /* number of times tracing of GC thing's children were
                           delayed due to a low C stack */
#ifdef DEBUG
    uint32  maxuntraced;/* maximum number of things with children to trace
                           later */
#endif
    uint32  maxlevel;   /* maximum GC nesting (indirect recursion) level */
    uint32  poke;       /* number of potentially useful GC calls */
    uint32  afree;      /* thing arenas freed so far */
    uint32  stackseg;   /* total extraordinary stack segments scanned */
    uint32  segslots;   /* total stack segment jsval slots scanned */
    uint32  nclose;     /* number of objects with close hooks */
    uint32  maxnclose;  /* max number of objects with close hooks */
    uint32  closelater; /* number of close hooks scheduled to run */
    uint32  maxcloselater; /* max number of close hooks scheduled to run */

    JSGCArenaStats  arenaStats[GC_NUM_FREELISTS];
    JSGCArenaStats  doubleArenaStats;
} JSGCStats;

extern JS_FRIEND_API(void)
js_DumpGCStats(JSRuntime *rt, FILE *fp);

#endif /* JS_GCMETER */

JS_END_EXTERN_C

#endif /* jsgc_h___ */
