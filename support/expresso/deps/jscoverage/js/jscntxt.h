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

#ifndef jscntxt_h___
#define jscntxt_h___
/*
 * JS execution context.
 */
#include "jsarena.h" /* Added by JSIFY */
#include "jsclist.h"
#include "jslong.h"
#include "jsatom.h"
#include "jsversion.h"
#include "jsdhash.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jsobj.h"
#include "jsprvtd.h"
#include "jspubtd.h"
#include "jsregexp.h"
#include "jsutil.h"

JS_BEGIN_EXTERN_C

/*
 * js_GetSrcNote cache to avoid O(n^2) growth in finding a source note for a
 * given pc in a script. We use the script->code pointer to tag the cache,
 * instead of the script address itself, so that source notes are always found
 * by offset from the bytecode with which they were generated.
 */
typedef struct JSGSNCache {
    jsbytecode      *code;
    JSDHashTable    table;
#ifdef JS_GSNMETER
    uint32          hits;
    uint32          misses;
    uint32          fills;
    uint32          clears;
# define GSN_CACHE_METER(cache,cnt) (++(cache)->cnt)
#else
# define GSN_CACHE_METER(cache,cnt) /* nothing */
#endif
} JSGSNCache;

#define GSN_CACHE_CLEAR(cache)                                                \
    JS_BEGIN_MACRO                                                            \
        (cache)->code = NULL;                                                 \
        if ((cache)->table.ops) {                                             \
            JS_DHashTableFinish(&(cache)->table);                             \
            (cache)->table.ops = NULL;                                        \
        }                                                                     \
        GSN_CACHE_METER(cache, clears);                                       \
    JS_END_MACRO

/* These helper macros take a cx as parameter and operate on its GSN cache. */
#define JS_CLEAR_GSN_CACHE(cx)      GSN_CACHE_CLEAR(&JS_GSN_CACHE(cx))
#define JS_METER_GSN_CACHE(cx,cnt)  GSN_CACHE_METER(&JS_GSN_CACHE(cx), cnt)

#ifdef __cplusplus
namespace nanojit {
    class Fragment;
    class Fragmento;
}
class TraceRecorder;
extern "C++" { template<typename T> class Queue; }
typedef Queue<uint16> SlotList;
class TypeMap;

# define CLS(T)  T*
#else
# define CLS(T)  void*
#endif

/*
 * Trace monitor. Every JSThread (if JS_THREADSAFE) or JSRuntime (if not
 * JS_THREADSAFE) has an associated trace monitor that keeps track of loop
 * frequencies for all JavaScript code loaded into that runtime.
 */
typedef struct JSTraceMonitor {
    /*
     * Flag set when running (or recording) JIT-compiled code. This prevents
     * both interpreter activation and last-ditch garbage collection when up
     * against our runtime's memory limits. This flag also suppresses calls to
     * JS_ReportOutOfMemory when failing due to runtime limits.
     */
    JSBool                  onTrace;
    CLS(nanojit::Fragmento) fragmento;
    CLS(TraceRecorder)      recorder;
    uint32                  globalShape;
    CLS(SlotList)           globalSlots;
    CLS(TypeMap)            globalTypeMap;
    jsval                   *recoveryDoublePool;
    jsval                   *recoveryDoublePoolPtr;

    /* Fragmento for the regular expression compiler. This is logically
     * a distinct compiler but needs to be managed in exactly the same
     * way as the real tracing Fragmento. */
    CLS(nanojit::Fragmento) reFragmento;

    /* Keep a list of recorders we need to abort on cache flush. */
    CLS(TraceRecorder)      abortStack;
} JSTraceMonitor;

#ifdef JS_TRACER
# define JS_ON_TRACE(cx)   (JS_TRACE_MONITOR(cx).onTrace)
#else
# define JS_ON_TRACE(cx)   JS_FALSE
#endif

#ifdef JS_THREADSAFE

/*
 * Structure uniquely representing a thread.  It holds thread-private data
 * that can be accessed without a global lock.
 */
struct JSThread {
    /* Linked list of all contexts active on this thread. */
    JSCList             contextList;

    /* Opaque thread-id, from NSPR's PR_GetCurrentThread(). */
    jsword              id;

    /*
     * Thread-local version of JSRuntime.gcMallocBytes to avoid taking
     * locks on each JS_malloc.
     */
    uint32              gcMallocBytes;

    /*
     * Store the GSN cache in struct JSThread, not struct JSContext, both to
     * save space and to simplify cleanup in js_GC.  Any embedding (Firefox
     * or another Gecko application) that uses many contexts per thread is
     * unlikely to interleave js_GetSrcNote-intensive loops in the decompiler
     * among two or more contexts running script in one thread.
     */
    JSGSNCache          gsnCache;

    /* Property cache for faster call/get/set invocation. */
    JSPropertyCache     propertyCache;

    /* Trace-tree JIT recorder/interpreter state. */
    JSTraceMonitor      traceMonitor;

    /* Lock-free list of scripts created by eval to garbage-collect. */
    JSScript            *scriptsToGC;
};

#define JS_GSN_CACHE(cx)        ((cx)->thread->gsnCache)
#define JS_PROPERTY_CACHE(cx)   ((cx)->thread->propertyCache)
#define JS_TRACE_MONITOR(cx)    ((cx)->thread->traceMonitor)
#define JS_SCRIPTS_TO_GC(cx)    ((cx)->thread->scriptsToGC)

extern void
js_ThreadDestructorCB(void *ptr);

extern JSBool
js_SetContextThread(JSContext *cx);

extern void
js_ClearContextThread(JSContext *cx);

extern JSThread *
js_GetCurrentThread(JSRuntime *rt);

#endif /* JS_THREADSAFE */

typedef enum JSDestroyContextMode {
    JSDCM_NO_GC,
    JSDCM_MAYBE_GC,
    JSDCM_FORCE_GC,
    JSDCM_NEW_FAILED
} JSDestroyContextMode;

typedef enum JSRuntimeState {
    JSRTS_DOWN,
    JSRTS_LAUNCHING,
    JSRTS_UP,
    JSRTS_LANDING
} JSRuntimeState;

typedef struct JSPropertyTreeEntry {
    JSDHashEntryHdr     hdr;
    JSScopeProperty     *child;
} JSPropertyTreeEntry;

typedef struct JSSetSlotRequest JSSetSlotRequest;

struct JSSetSlotRequest {
    JSObject            *obj;           /* object containing slot to set */
    JSObject            *pobj;          /* new proto or parent reference */
    uint16              slot;           /* which to set, proto or parent */
    uint16              errnum;         /* JSMSG_NO_ERROR or error result */
    JSSetSlotRequest    *next;          /* next request in GC worklist */
};

struct JSRuntime {
    /* Runtime state, synchronized by the stateChange/gcLock condvar/lock. */
    JSRuntimeState      state;

    /* Context create/destroy callback. */
    JSContextCallback   cxCallback;

    /* Garbage collector state, used by jsgc.c. */
    JSGCChunkInfo       *gcChunkList;
    JSGCArenaList       gcArenaList[GC_NUM_FREELISTS];
    JSGCDoubleArenaList gcDoubleArenaList;
    JSGCFreeListSet     *gcFreeListsPool;
    JSDHashTable        gcRootsHash;
    JSDHashTable        *gcLocksHash;
    jsrefcount          gcKeepAtoms;
    uint32              gcBytes;
    uint32              gcLastBytes;
    uint32              gcMaxBytes;
    uint32              gcMaxMallocBytes;
    uint32              gcEmptyArenaPoolLifespan;
    uint32              gcLevel;
    uint32              gcNumber;
    JSTracer            *gcMarkingTracer;

    /*
     * NB: do not pack another flag here by claiming gcPadding unless the new
     * flag is written only by the GC thread.  Atomic updates to packed bytes
     * are not guaranteed, so stores issued by one thread may be lost due to
     * unsynchronized read-modify-write cycles on other threads.
     */
    JSPackedBool        gcPoke;
    JSPackedBool        gcRunning;
    uint16              gcPadding;
#ifdef JS_GC_ZEAL
    jsrefcount          gcZeal;
#endif

    JSGCCallback        gcCallback;
    uint32              gcMallocBytes;
    JSGCArenaInfo       *gcUntracedArenaStackTop;
#ifdef DEBUG
    size_t              gcTraceLaterCount;
#endif

    /*
     * Table for tracking iterators to ensure that we close iterator's state
     * before finalizing the iterable object.
     */
    JSPtrTable          gcIteratorTable;

    /*
     * The trace operation and its data argument to trace embedding-specific
     * GC roots.
     */
    JSTraceDataOp       gcExtraRootsTraceOp;
    void                *gcExtraRootsData;

    /*
     * Used to serialize cycle checks when setting __proto__ or __parent__ by
     * requesting the GC handle the required cycle detection. If the GC hasn't
     * been poked, it won't scan for garbage. This member is protected by
     * rt->gcLock.
     */
    JSSetSlotRequest    *setSlotRequests;

    /* Random number generator state, used by jsmath.c. */
    JSBool              rngInitialized;
    int64               rngMultiplier;
    int64               rngAddend;
    int64               rngMask;
    int64               rngSeed;
    jsdouble            rngDscale;

    /* Well-known numbers held for use by this runtime's contexts. */
    jsdouble            *jsNaN;
    jsdouble            *jsNegativeInfinity;
    jsdouble            *jsPositiveInfinity;

#ifdef JS_THREADSAFE
    JSLock              *deflatedStringCacheLock;
#endif
    JSHashTable         *deflatedStringCache;
#ifdef DEBUG
    uint32              deflatedStringCacheBytes;
#endif

    /*
     * Empty and unit-length strings held for use by this runtime's contexts.
     * The unitStrings array and its elements are created on demand.
     */
    JSString            *emptyString;
    JSString            **unitStrings;

    /* List of active contexts sharing this runtime; protected by gcLock. */
    JSCList             contextList;

    /* Per runtime debug hooks -- see jsprvtd.h and jsdbgapi.h. */
    JSDebugHooks        globalDebugHooks;

    /* More debugging state, see jsdbgapi.c. */
    JSCList             trapList;
    JSCList             watchPointList;

    /* Client opaque pointers */
    void                *data;

#ifdef JS_THREADSAFE
    /* These combine to interlock the GC and new requests. */
    PRLock              *gcLock;
    PRCondVar           *gcDone;
    PRCondVar           *requestDone;
    uint32              requestCount;
    JSThread            *gcThread;

    /* Lock and owning thread pointer for JS_LOCK_RUNTIME. */
    PRLock              *rtLock;
#ifdef DEBUG
    jsword              rtLockOwner;
#endif

    /* Used to synchronize down/up state change; protected by gcLock. */
    PRCondVar           *stateChange;

    /*
     * State for sharing single-threaded titles, once a second thread tries to
     * lock a title.  The titleSharingDone condvar is protected by rt->gcLock
     * to minimize number of locks taken in JS_EndRequest.
     *
     * The titleSharingTodo linked list is likewise "global" per runtime, not
     * one-list-per-context, to conserve space over all contexts, optimizing
     * for the likely case that titles become shared rarely, and among a very
     * small set of threads (contexts).
     */
    PRCondVar           *titleSharingDone;
    JSTitle             *titleSharingTodo;

/*
 * Magic terminator for the rt->titleSharingTodo linked list, threaded through
 * title->u.link.  This hack allows us to test whether a title is on the list
 * by asking whether title->u.link is non-null.  We use a large, likely bogus
 * pointer here to distinguish this value from any valid u.count (small int)
 * value.
 */
#define NO_TITLE_SHARING_TODO   ((JSTitle *) 0xfeedbeef)

    /*
     * Lock serializing trapList and watchPointList accesses, and count of all
     * mutations to trapList and watchPointList made by debugger threads.  To
     * keep the code simple, we define debuggerMutations for the thread-unsafe
     * case too.
     */
    PRLock              *debuggerLock;
#endif /* JS_THREADSAFE */
    uint32              debuggerMutations;

    /*
     * Security callbacks set on the runtime are used by each context unless
     * an override is set on the context.
     */
    JSSecurityCallbacks *securityCallbacks;

    /*
     * Shared scope property tree, and arena-pool for allocating its nodes.
     * The propertyRemovals counter is incremented for every js_ClearScope,
     * and for each js_RemoveScopeProperty that frees a slot in an object.
     * See js_NativeGet and js_NativeSet in jsobj.c.
     */
    JSDHashTable        propertyTreeHash;
    JSScopeProperty     *propertyFreeList;
    JSArenaPool         propertyArenaPool;
    int32               propertyRemovals;

    /* Script filename table. */
    struct JSHashTable  *scriptFilenameTable;
    JSCList             scriptFilenamePrefixes;
#ifdef JS_THREADSAFE
    PRLock              *scriptFilenameTableLock;
#endif

    /* Number localization, used by jsnum.c */
    const char          *thousandsSeparator;
    const char          *decimalSeparator;
    const char          *numGrouping;

    /*
     * Weak references to lazily-created, well-known XML singletons.
     *
     * NB: Singleton objects must be carefully disconnected from the rest of
     * the object graph usually associated with a JSContext's global object,
     * including the set of standard class objects.  See jsxml.c for details.
     */
    JSObject            *anynameObject;
    JSObject            *functionNamespaceObject;

    /*
     * A helper list for the GC, so it can mark native iterator states. See
     * js_TraceNativeEnumerators for details.
     */
    JSNativeEnumerator  *nativeEnumerators;

#ifndef JS_THREADSAFE
    /*
     * For thread-unsafe embeddings, the GSN cache lives in the runtime and
     * not each context, since we expect it to be filled once when decompiling
     * a longer script, then hit repeatedly as js_GetSrcNote is called during
     * the decompiler activation that filled it.
     */
    JSGSNCache          gsnCache;

    /* Property cache for faster call/get/set invocation. */
    JSPropertyCache     propertyCache;

    /* Trace-tree JIT recorder/interpreter state. */
    JSTraceMonitor      traceMonitor;

    /* Lock-free list of scripts created by eval to garbage-collect. */
    JSScript            *scriptsToGC;

#define JS_GSN_CACHE(cx)        ((cx)->runtime->gsnCache)
#define JS_PROPERTY_CACHE(cx)   ((cx)->runtime->propertyCache)
#define JS_TRACE_MONITOR(cx)    ((cx)->runtime->traceMonitor)
#define JS_SCRIPTS_TO_GC(cx)    ((cx)->runtime->scriptsToGC)
#endif

    /*
     * Object shape (property cache structural type) identifier generator.
     *
     * Type 0 stands for the empty scope, and must not be regenerated due to
     * uint32 wrap-around. Since we use atomic pre-increment, the initial
     * value for the first typed non-empty scope will be 1.
     *
     * The GC compresses live types, minimizing rt->shapeGen in the process.
     * If this counter overflows into SHAPE_OVERFLOW_BIT (in jsinterp.h), the
     * GC will disable property caches for all threads, to avoid aliasing two
     * different types. Updated by js_GenerateShape (in jsinterp.c).
     */
    uint32              shapeGen;

    /* Literal table maintained by jsatom.c functions. */
    JSAtomState         atomState;

    /*
     * Cache of reusable JSNativeEnumerators mapped by shape identifiers (as
     * stored in scope->shape). This cache is nulled by the GC and protected
     * by gcLock.
     */
#define NATIVE_ENUM_CACHE_LOG2  8
#define NATIVE_ENUM_CACHE_MASK  JS_BITMASK(NATIVE_ENUM_CACHE_LOG2)
#define NATIVE_ENUM_CACHE_SIZE  JS_BIT(NATIVE_ENUM_CACHE_LOG2)

#define NATIVE_ENUM_CACHE_HASH(shape)                                         \
    ((((shape) >> NATIVE_ENUM_CACHE_LOG2) ^ (shape)) & NATIVE_ENUM_CACHE_MASK)

    jsuword             nativeEnumCache[NATIVE_ENUM_CACHE_SIZE];

    /*
     * Runtime-wide flag set to true when any Array prototype has an indexed
     * property defined on it, creating a hazard for code reading or writing
     * over a hole from a dense Array instance that is not prepared to look up
     * the proto chain (the writing case must involve a check for a read-only
     * element, which cannot be shadowed).
     */
    JSBool              anyArrayProtoHasElement;

    /*
     * Various metering fields are defined at the end of JSRuntime. In this
     * way there is no need to recompile all the code that refers to other
     * fields of JSRuntime after enabling the corresponding metering macro.
     */
#ifdef JS_DUMP_ENUM_CACHE_STATS
    int32               nativeEnumProbes;
    int32               nativeEnumMisses;
# define ENUM_CACHE_METER(name)     JS_ATOMIC_INCREMENT(&cx->runtime->name)
#else
# define ENUM_CACHE_METER(name)     ((void) 0)
#endif

#ifdef JS_DUMP_LOOP_STATS
    /* Loop statistics, to trigger trace recording and compiling. */
    JSBasicStats        loopStats;
#endif

#if defined DEBUG || defined JS_DUMP_PROPTREE_STATS
    /* Function invocation metering. */
    jsrefcount          inlineCalls;
    jsrefcount          nativeCalls;
    jsrefcount          nonInlineCalls;
    jsrefcount          constructs;

    /* Title lock and scope property metering. */
    jsrefcount          claimAttempts;
    jsrefcount          claimedTitles;
    jsrefcount          deadContexts;
    jsrefcount          deadlocksAvoided;
    jsrefcount          liveScopes;
    jsrefcount          sharedTitles;
    jsrefcount          totalScopes;
    jsrefcount          liveScopeProps;
    jsrefcount          liveScopePropsPreSweep;
    jsrefcount          totalScopeProps;
    jsrefcount          livePropTreeNodes;
    jsrefcount          duplicatePropTreeNodes;
    jsrefcount          totalPropTreeNodes;
    jsrefcount          propTreeKidsChunks;
    jsrefcount          middleDeleteFixups;

    /* String instrumentation. */
    jsrefcount          liveStrings;
    jsrefcount          totalStrings;
    jsrefcount          liveDependentStrings;
    jsrefcount          totalDependentStrings;
    jsrefcount          badUndependStrings;
    double              lengthSum;
    double              lengthSquaredSum;
    double              strdepLengthSum;
    double              strdepLengthSquaredSum;
#endif /* DEBUG || JS_DUMP_PROPTREE_STATS */

#ifdef JS_SCOPE_DEPTH_METER
    /*
     * Stats on runtime prototype chain lookups and scope chain depths, i.e.,
     * counts of objects traversed on a chain until the wanted id is found.
     */
    JSBasicStats        protoLookupDepthStats;
    JSBasicStats        scopeSearchDepthStats;

    /*
     * Stats on compile-time host environment and lexical scope chain lengths
     * (maximum depths).
     */
    JSBasicStats        hostenvScopeDepthStats;
    JSBasicStats        lexicalScopeDepthStats;
#endif

#ifdef JS_GCMETER
    JSGCStats           gcStats;
#endif
};

#ifdef DEBUG
# define JS_RUNTIME_METER(rt, which)    JS_ATOMIC_INCREMENT(&(rt)->which)
# define JS_RUNTIME_UNMETER(rt, which)  JS_ATOMIC_DECREMENT(&(rt)->which)
#else
# define JS_RUNTIME_METER(rt, which)    /* nothing */
# define JS_RUNTIME_UNMETER(rt, which)  /* nothing */
#endif

#define JS_KEEP_ATOMS(rt)   JS_ATOMIC_INCREMENT(&(rt)->gcKeepAtoms);
#define JS_UNKEEP_ATOMS(rt) JS_ATOMIC_DECREMENT(&(rt)->gcKeepAtoms);

#ifdef JS_ARGUMENT_FORMATTER_DEFINED
/*
 * Linked list mapping format strings for JS_{Convert,Push}Arguments{,VA} to
 * formatter functions.  Elements are sorted in non-increasing format string
 * length order.
 */
struct JSArgumentFormatMap {
    const char          *format;
    size_t              length;
    JSArgumentFormatter formatter;
    JSArgumentFormatMap *next;
};
#endif

struct JSStackHeader {
    uintN               nslots;
    JSStackHeader       *down;
};

#define JS_STACK_SEGMENT(sh)    ((jsval *)(sh) + 2)

/*
 * Key and entry types for the JSContext.resolvingTable hash table, typedef'd
 * here because all consumers need to see these declarations (and not just the
 * typedef names, as would be the case for an opaque pointer-to-typedef'd-type
 * declaration), along with cx->resolvingTable.
 */
typedef struct JSResolvingKey {
    JSObject            *obj;
    jsid                id;
} JSResolvingKey;

typedef struct JSResolvingEntry {
    JSDHashEntryHdr     hdr;
    JSResolvingKey      key;
    uint32              flags;
} JSResolvingEntry;

#define JSRESFLAG_LOOKUP        0x1     /* resolving id from lookup */
#define JSRESFLAG_WATCH         0x2     /* resolving id from watch */

typedef struct JSLocalRootChunk JSLocalRootChunk;

#define JSLRS_CHUNK_SHIFT       8
#define JSLRS_CHUNK_SIZE        JS_BIT(JSLRS_CHUNK_SHIFT)
#define JSLRS_CHUNK_MASK        JS_BITMASK(JSLRS_CHUNK_SHIFT)

struct JSLocalRootChunk {
    jsval               roots[JSLRS_CHUNK_SIZE];
    JSLocalRootChunk    *down;
};

typedef struct JSLocalRootStack {
    uint32              scopeMark;
    uint32              rootCount;
    JSLocalRootChunk    *topChunk;
    JSLocalRootChunk    firstChunk;
} JSLocalRootStack;

#define JSLRS_NULL_MARK ((uint32) -1)

/*
 * Macros to push/pop JSTempValueRooter instances to context-linked stack of
 * temporary GC roots. If you need to protect a result value that flows out of
 * a C function across several layers of other functions, use the
 * js_LeaveLocalRootScopeWithResult internal API (see further below) instead.
 *
 * The macros also provide a simple way to get a single rooted pointer via
 * JS_PUSH_TEMP_ROOT_<KIND>(cx, NULL, &tvr). Then &tvr.u.<kind> gives the
 * necessary pointer.
 *
 * JSTempValueRooter.count defines the type of the rooted value referenced by
 * JSTempValueRooter.u union of type JSTempValueUnion. When count is positive
 * or zero, u.array points to a vector of jsvals. Otherwise it must be one of
 * the following constants:
 */
#define JSTVU_SINGLE        (-1)    /* u.value or u.<gcthing> is single jsval
                                       or GC-thing */
#define JSTVU_TRACE         (-2)    /* u.trace is a hook to trace a custom
                                     * structure */
#define JSTVU_SPROP         (-3)    /* u.sprop roots property tree node */
#define JSTVU_WEAK_ROOTS    (-4)    /* u.weakRoots points to saved weak roots */
#define JSTVU_PARSE_CONTEXT (-5)    /* u.parseContext roots JSParseContext* */
#define JSTVU_SCRIPT        (-6)    /* u.script roots JSScript* */

/*
 * Here single JSTVU_SINGLE covers both jsval and pointers to any GC-thing via
 * reinterpreting the thing as JSVAL_OBJECT. It works because the GC-thing is
 * aligned on a 0 mod 8 boundary, and object has the 0 jsval tag. So any
 * GC-thing may be tagged as if it were an object and untagged, if it's then
 * used only as an opaque pointer until discriminated by other means than tag
 * bits. This is how, for example, js_GetGCThingTraceKind uses its |thing|
 * parameter -- it consults GC-thing flags stored separately from the thing to
 * decide the kind of thing.
 *
 * The following checks that this type-punning is possible.
 */
JS_STATIC_ASSERT(sizeof(JSTempValueUnion) == sizeof(jsval));
JS_STATIC_ASSERT(sizeof(JSTempValueUnion) == sizeof(void *));

#define JS_PUSH_TEMP_ROOT_COMMON(cx,x,tvr,cnt,kind)                           \
    JS_BEGIN_MACRO                                                            \
        JS_ASSERT((cx)->tempValueRooters != (tvr));                           \
        (tvr)->count = (cnt);                                                 \
        (tvr)->u.kind = (x);                                                  \
        (tvr)->down = (cx)->tempValueRooters;                                 \
        (cx)->tempValueRooters = (tvr);                                       \
    JS_END_MACRO

#define JS_POP_TEMP_ROOT(cx,tvr)                                              \
    JS_BEGIN_MACRO                                                            \
        JS_ASSERT((cx)->tempValueRooters == (tvr));                           \
        (cx)->tempValueRooters = (tvr)->down;                                 \
    JS_END_MACRO

#define JS_PUSH_TEMP_ROOT(cx,cnt,arr,tvr)                                     \
    JS_BEGIN_MACRO                                                            \
        JS_ASSERT((int)(cnt) >= 0);                                           \
        JS_PUSH_TEMP_ROOT_COMMON(cx, arr, tvr, (ptrdiff_t) (cnt), array);     \
    JS_END_MACRO

#define JS_PUSH_SINGLE_TEMP_ROOT(cx,val,tvr)                                  \
    JS_PUSH_TEMP_ROOT_COMMON(cx, val, tvr, JSTVU_SINGLE, value)

#define JS_PUSH_TEMP_ROOT_OBJECT(cx,obj,tvr)                                  \
    JS_PUSH_TEMP_ROOT_COMMON(cx, obj, tvr, JSTVU_SINGLE, object)

#define JS_PUSH_TEMP_ROOT_STRING(cx,str,tvr)                                  \
    JS_PUSH_TEMP_ROOT_COMMON(cx, str, tvr, JSTVU_SINGLE, string)

#define JS_PUSH_TEMP_ROOT_XML(cx,xml_,tvr)                                    \
    JS_PUSH_TEMP_ROOT_COMMON(cx, xml_, tvr, JSTVU_SINGLE, xml)

#define JS_PUSH_TEMP_ROOT_TRACE(cx,trace_,tvr)                                \
    JS_PUSH_TEMP_ROOT_COMMON(cx, trace_, tvr, JSTVU_TRACE, trace)

#define JS_PUSH_TEMP_ROOT_SPROP(cx,sprop_,tvr)                                \
    JS_PUSH_TEMP_ROOT_COMMON(cx, sprop_, tvr, JSTVU_SPROP, sprop)

#define JS_PUSH_TEMP_ROOT_WEAK_COPY(cx,weakRoots_,tvr)                        \
    JS_PUSH_TEMP_ROOT_COMMON(cx, weakRoots_, tvr, JSTVU_WEAK_ROOTS, weakRoots)

#define JS_PUSH_TEMP_ROOT_PARSE_CONTEXT(cx,pc,tvr)                            \
    JS_PUSH_TEMP_ROOT_COMMON(cx, pc, tvr, JSTVU_PARSE_CONTEXT, parseContext)

#define JS_PUSH_TEMP_ROOT_SCRIPT(cx,script_,tvr)                              \
    JS_PUSH_TEMP_ROOT_COMMON(cx, script_, tvr, JSTVU_SCRIPT, script)


#define JSRESOLVE_INFER         0xffff  /* infer bits from current bytecode */

struct JSContext {
    /* JSRuntime contextList linkage. */
    JSCList             links;

    /*
     * Operation count. It is declared early in the structure as a frequently
     * accessed field.
     */
    int32               operationCount;

#if JS_HAS_XML_SUPPORT
    /*
     * Bit-set formed from binary exponentials of the XML_* tiny-ids defined
     * for boolean settings in jsxml.c, plus an XSF_CACHE_VALID bit.  Together
     * these act as a cache of the boolean XML.ignore* and XML.prettyPrinting
     * property values associated with this context's global object.
     */
    uint8               xmlSettingFlags;
    uint8               padding;
#else
    uint16              padding;
#endif

    /*
     * Classic Algol "display" static link optimization.
     */
#define JS_DISPLAY_SIZE 16

    JSStackFrame        *display[JS_DISPLAY_SIZE];

    /* Runtime version control identifier. */
    uint16              version;

    /* Per-context options. */
    uint32              options;            /* see jsapi.h for JSOPTION_* */

    /* Locale specific callbacks for string conversion. */
    JSLocaleCallbacks   *localeCallbacks;

    /*
     * cx->resolvingTable is non-null and non-empty if we are initializing
     * standard classes lazily, or if we are otherwise recursing indirectly
     * from js_LookupProperty through a JSClass.resolve hook.  It is used to
     * limit runaway recursion (see jsapi.c and jsobj.c).
     */
    JSDHashTable        *resolvingTable;

#if JS_HAS_LVALUE_RETURN
    /*
     * Secondary return value from native method called on the left-hand side
     * of an assignment operator.  The native should store the object in which
     * to set a property in *rval, and return the property's id expressed as a
     * jsval by calling JS_SetCallReturnValue2(cx, idval).
     */
    jsval               rval2;
    JSPackedBool        rval2set;
#endif

    /*
     * True if generating an error, to prevent runaway recursion.
     * NB: generatingError packs with rval2set, #if JS_HAS_LVALUE_RETURN;
     * with insideGCMarkCallback and with throwing below.
     */
    JSPackedBool        generatingError;

    /* Flag to indicate that we run inside gcCallback(cx, JSGC_MARK_END). */
    JSPackedBool        insideGCMarkCallback;

    /* Exception state -- the exception member is a GC root by definition. */
    JSPackedBool        throwing;           /* is there a pending exception? */
    jsval               exception;          /* most-recently-thrown exception */

    /* Limit pointer for checking native stack consumption during recursion. */
    jsuword             stackLimit;

    /* Quota on the size of arenas used to compile and execute scripts. */
    size_t              scriptStackQuota;

    /* Data shared by threads in an address space. */
    JSRuntime           *runtime;

    /* Stack arena pool and frame pointer register. */
    JSArenaPool         stackPool;
    JSStackFrame        *fp;

    /* Temporary arena pool used while compiling and decompiling. */
    JSArenaPool         tempPool;

    /* Top-level object and pointer to top stack frame's scope chain. */
    JSObject            *globalObject;

    /* Storage to root recently allocated GC things and script result. */
    JSWeakRoots         weakRoots;

    /* Regular expression class statics (XXX not shared globally). */
    JSRegExpStatics     regExpStatics;

    /* State for object and array toSource conversion. */
    JSSharpObjectMap    sharpObjectMap;

    /* Argument formatter support for JS_{Convert,Push}Arguments{,VA}. */
    JSArgumentFormatMap *argumentFormatMap;

    /* Last message string and trace file for debugging. */
    char                *lastMessage;
#ifdef DEBUG
    void                *tracefp;
#endif

    /* Per-context optional error reporter. */
    JSErrorReporter     errorReporter;

    /*
     * Flag indicating that the operation callback is set. When the flag is 0
     * but operationCallback is not null, operationCallback stores the branch
     * callback.
     */
    uint32              operationCallbackIsSet :    1;
    uint32              operationLimit         :    31;
    JSOperationCallback operationCallback;

    /* Interpreter activation count. */
    uintN               interpLevel;

    /* Client opaque pointers. */
    void                *data;
    void                *data2;

    /* GC and thread-safe state. */
    JSStackFrame        *dormantFrameChain; /* dormant stack frame to scan */
#ifdef JS_THREADSAFE
    JSThread            *thread;
    jsrefcount          requestDepth;
    /* Same as requestDepth but ignoring JS_SuspendRequest/JS_ResumeRequest */
    jsrefcount          outstandingRequests;
    JSTitle             *titleToShare;      /* weak reference, see jslock.c */
    JSTitle             *lockedSealedTitle; /* weak ref, for low-cost sealed
                                               title locking */
    JSCList             threadLinks;        /* JSThread contextList linkage */

#define CX_FROM_THREAD_LINKS(tl) \
    ((JSContext *)((char *)(tl) - offsetof(JSContext, threadLinks)))
#endif

    /* PDL of stack headers describing stack slots not rooted by argv, etc. */
    JSStackHeader       *stackHeaders;

    /* Optional stack of heap-allocated scoped local GC roots. */
    JSLocalRootStack    *localRootStack;

    /* Stack of thread-stack-allocated temporary GC roots. */
    JSTempValueRooter   *tempValueRooters;

#ifdef JS_THREADSAFE
    JSGCFreeListSet     *gcLocalFreeLists;
#endif

    /* List of pre-allocated doubles. */
    JSGCDoubleCell      *doubleFreeList;

    /* Debug hooks associated with the current context. */
    JSDebugHooks        *debugHooks;

    /* Security callbacks that override any defined on the runtime. */
    JSSecurityCallbacks *securityCallbacks;

    /* Pinned regexp pool used for regular expressions. */
    JSArenaPool         regexpPool;

    /* Stored here to avoid passing it around as a parameter. */
    uintN               resolveFlags;
};

#ifdef JS_THREADSAFE
# define JS_THREAD_ID(cx)       ((cx)->thread ? (cx)->thread->id : 0)
#endif

#ifdef __cplusplus
/* FIXME(bug 332648): Move this into a public header. */
class JSAutoTempValueRooter
{
  public:
    JSAutoTempValueRooter(JSContext *cx, size_t len, jsval *vec)
        : mContext(cx) {
        JS_PUSH_TEMP_ROOT(mContext, len, vec, &mTvr);
    }
    JSAutoTempValueRooter(JSContext *cx, jsval v)
        : mContext(cx) {
        JS_PUSH_SINGLE_TEMP_ROOT(mContext, v, &mTvr);
    }

    ~JSAutoTempValueRooter() {
        JS_POP_TEMP_ROOT(mContext, &mTvr);
    }

  protected:
    JSContext *mContext;

  private:
#ifndef AIX
    static void *operator new(size_t);
    static void operator delete(void *, size_t);
#endif

    JSTempValueRooter mTvr;
};

class JSAutoResolveFlags
{
  public:
    JSAutoResolveFlags(JSContext *cx, uintN flags)
        : mContext(cx), mSaved(cx->resolveFlags) {
        cx->resolveFlags = flags;
    }

    ~JSAutoResolveFlags() { mContext->resolveFlags = mSaved; }

  private:
    JSContext *mContext;
    uintN mSaved;
};
#endif

/*
 * Slightly more readable macros for testing per-context option settings (also
 * to hide bitset implementation detail).
 *
 * JSOPTION_XML must be handled specially in order to propagate from compile-
 * to run-time (from cx->options to script->version/cx->version).  To do that,
 * we copy JSOPTION_XML from cx->options into cx->version as JSVERSION_HAS_XML
 * whenever options are set, and preserve this XML flag across version number
 * changes done via the JS_SetVersion API.
 *
 * But when executing a script or scripted function, the interpreter changes
 * cx->version, including the XML flag, to script->version.  Thus JSOPTION_XML
 * is a compile-time option that causes a run-time version change during each
 * activation of the compiled script.  That version change has the effect of
 * changing JS_HAS_XML_OPTION, so that any compiling done via eval enables XML
 * support.  If an XML-enabled script or function calls a non-XML function,
 * the flag bit will be cleared during the callee's activation.
 *
 * Note that JS_SetVersion API calls never pass JSVERSION_HAS_XML or'd into
 * that API's version parameter.
 *
 * Note also that script->version must contain this XML option flag in order
 * for XDR'ed scripts to serialize and deserialize with that option preserved
 * for detection at run-time.  We can't copy other compile-time options into
 * script->version because that would break backward compatibility (certain
 * other options, e.g. JSOPTION_VAROBJFIX, are analogous to JSOPTION_XML).
 */
#define JS_HAS_OPTION(cx,option)        (((cx)->options & (option)) != 0)
#define JS_HAS_STRICT_OPTION(cx)        JS_HAS_OPTION(cx, JSOPTION_STRICT)
#define JS_HAS_WERROR_OPTION(cx)        JS_HAS_OPTION(cx, JSOPTION_WERROR)
#define JS_HAS_COMPILE_N_GO_OPTION(cx)  JS_HAS_OPTION(cx, JSOPTION_COMPILE_N_GO)
#define JS_HAS_ATLINE_OPTION(cx)        JS_HAS_OPTION(cx, JSOPTION_ATLINE)

#define JSVERSION_MASK                  0x0FFF  /* see JSVersion in jspubtd.h */
#define JSVERSION_HAS_XML               0x1000  /* flag induced by XML option */

#define JSVERSION_NUMBER(cx)            ((JSVersion)((cx)->version &          \
                                                     JSVERSION_MASK))
#define JS_HAS_XML_OPTION(cx)           ((cx)->version & JSVERSION_HAS_XML || \
                                         JSVERSION_NUMBER(cx) >= JSVERSION_1_6)

/*
 * Initialize a library-wide thread private data index, and remember that it
 * has already been done, so that it happens only once ever.  Returns true on
 * success.
 */
extern JSBool
js_InitThreadPrivateIndex(void (*ptr)(void *));

/*
 * Common subroutine of JS_SetVersion and js_SetVersion, to update per-context
 * data that depends on version.
 */
extern void
js_OnVersionChange(JSContext *cx);

/*
 * Unlike the JS_SetVersion API, this function stores JSVERSION_HAS_XML and
 * any future non-version-number flags induced by compiler options.
 */
extern void
js_SetVersion(JSContext *cx, JSVersion version);

/*
 * Create and destroy functions for JSContext, which is manually allocated
 * and exclusively owned.
 */
extern JSContext *
js_NewContext(JSRuntime *rt, size_t stackChunkSize);

extern void
js_DestroyContext(JSContext *cx, JSDestroyContextMode mode);

/*
 * Return true if cx points to a context in rt->contextList, else return false.
 * NB: the caller (see jslock.c:ClaimTitle) must hold rt->gcLock.
 */
extern JSBool
js_ValidContextPointer(JSRuntime *rt, JSContext *cx);

/*
 * If unlocked, acquire and release rt->gcLock around *iterp update; otherwise
 * the caller must be holding rt->gcLock.
 */
extern JSContext *
js_ContextIterator(JSRuntime *rt, JSBool unlocked, JSContext **iterp);

/*
 * JSClass.resolve and watchpoint recursion damping machinery.
 */
extern JSBool
js_StartResolving(JSContext *cx, JSResolvingKey *key, uint32 flag,
                  JSResolvingEntry **entryp);

extern void
js_StopResolving(JSContext *cx, JSResolvingKey *key, uint32 flag,
                 JSResolvingEntry *entry, uint32 generation);

/*
 * Local root set management.
 *
 * NB: the jsval parameters below may be properly tagged jsvals, or GC-thing
 * pointers cast to (jsval).  This relies on JSObject's tag being zero, but
 * on the up side it lets us push int-jsval-encoded scopeMark values on the
 * local root stack.
 */
extern JSBool
js_EnterLocalRootScope(JSContext *cx);

#define js_LeaveLocalRootScope(cx) \
    js_LeaveLocalRootScopeWithResult(cx, JSVAL_NULL)

extern void
js_LeaveLocalRootScopeWithResult(JSContext *cx, jsval rval);

extern void
js_ForgetLocalRoot(JSContext *cx, jsval v);

extern int
js_PushLocalRoot(JSContext *cx, JSLocalRootStack *lrs, jsval v);

extern void
js_TraceLocalRoots(JSTracer *trc, JSLocalRootStack *lrs);

/*
 * Report an exception, which is currently realized as a printf-style format
 * string and its arguments.
 */
typedef enum JSErrNum {
#define MSG_DEF(name, number, count, exception, format) \
    name = number,
#include "js.msg"
#undef MSG_DEF
    JSErr_Limit
} JSErrNum;

extern JS_FRIEND_API(const JSErrorFormatString *)
js_GetErrorMessage(void *userRef, const char *locale, const uintN errorNumber);

#ifdef va_start
extern JSBool
js_ReportErrorVA(JSContext *cx, uintN flags, const char *format, va_list ap);

extern JSBool
js_ReportErrorNumberVA(JSContext *cx, uintN flags, JSErrorCallback callback,
                       void *userRef, const uintN errorNumber,
                       JSBool charArgs, va_list ap);

extern JSBool
js_ExpandErrorArguments(JSContext *cx, JSErrorCallback callback,
                        void *userRef, const uintN errorNumber,
                        char **message, JSErrorReport *reportp,
                        JSBool *warningp, JSBool charArgs, va_list ap);
#endif

extern void
js_ReportOutOfMemory(JSContext *cx);

/*
 * Report that cx->scriptStackQuota is exhausted.
 */
extern void
js_ReportOutOfScriptQuota(JSContext *cx);

extern void
js_ReportOverRecursed(JSContext *cx);

extern void
js_ReportAllocationOverflow(JSContext *cx);

#define JS_CHECK_RECURSION(cx, onerror)                                       \
    JS_BEGIN_MACRO                                                            \
        int stackDummy_;                                                      \
                                                                              \
        if (!JS_CHECK_STACK_SIZE(cx, stackDummy_)) {                          \
            js_ReportOverRecursed(cx);                                        \
            onerror;                                                          \
        }                                                                     \
    JS_END_MACRO

/*
 * Report an exception using a previously composed JSErrorReport.
 * XXXbe remove from "friend" API
 */
extern JS_FRIEND_API(void)
js_ReportErrorAgain(JSContext *cx, const char *message, JSErrorReport *report);

extern void
js_ReportIsNotDefined(JSContext *cx, const char *name);

/*
 * Report an attempt to access the property of a null or undefined value (v).
 */
extern JSBool
js_ReportIsNullOrUndefined(JSContext *cx, intN spindex, jsval v,
                           JSString *fallback);

extern void
js_ReportMissingArg(JSContext *cx, jsval *vp, uintN arg);

/*
 * Report error using js_DecompileValueGenerator(cx, spindex, v, fallback) as
 * the first argument for the error message. If the error message has less
 * then 3 arguments, use null for arg1 or arg2.
 */
extern JSBool
js_ReportValueErrorFlags(JSContext *cx, uintN flags, const uintN errorNumber,
                         intN spindex, jsval v, JSString *fallback,
                         const char *arg1, const char *arg2);

#define js_ReportValueError(cx,errorNumber,spindex,v,fallback)                \
    ((void)js_ReportValueErrorFlags(cx, JSREPORT_ERROR, errorNumber,          \
                                    spindex, v, fallback, NULL, NULL))

#define js_ReportValueError2(cx,errorNumber,spindex,v,fallback,arg1)          \
    ((void)js_ReportValueErrorFlags(cx, JSREPORT_ERROR, errorNumber,          \
                                    spindex, v, fallback, arg1, NULL))

#define js_ReportValueError3(cx,errorNumber,spindex,v,fallback,arg1,arg2)     \
    ((void)js_ReportValueErrorFlags(cx, JSREPORT_ERROR, errorNumber,          \
                                    spindex, v, fallback, arg1, arg2))

extern JSErrorFormatString js_ErrorFormatString[JSErr_Limit];

/*
 * See JS_SetThreadStackLimit in jsapi.c, where we check that the stack grows
 * in the expected direction.  On Unix-y systems, JS_STACK_GROWTH_DIRECTION is
 * computed on the build host by jscpucfg.c and written into jsautocfg.h.  The
 * macro is hardcoded in jscpucfg.h on Windows and Mac systems (for historical
 * reasons pre-dating autoconf usage).
 */
#if JS_STACK_GROWTH_DIRECTION > 0
# define JS_CHECK_STACK_SIZE(cx, lval)  ((jsuword)&(lval) < (cx)->stackLimit)
#else
# define JS_CHECK_STACK_SIZE(cx, lval)  ((jsuword)&(lval) > (cx)->stackLimit)
#endif

/*
 * Update the operation counter according to the given weight and call the
 * operation callback when we reach the operation limit. To make this
 * frequently executed macro faster we decrease the counter from
 * JSContext.operationLimit and compare against zero to check the limit.
 *
 * This macro can run the full GC. Return true if it is OK to continue and
 * false otherwise.
 */
#define JS_CHECK_OPERATION_LIMIT(cx, weight)                                  \
    (JS_CHECK_OPERATION_WEIGHT(weight),                                       \
     (((cx)->operationCount -= (weight)) > 0 || js_ResetOperationCount(cx)))

/*
 * A version of JS_CHECK_OPERATION_LIMIT that just updates the operation count
 * without calling the operation callback or any other API. This macro resets
 * the count to 0 when it becomes negative to prevent a wrap-around when the
 * macro is called repeatably.
 */
#define JS_COUNT_OPERATION(cx, weight)                                        \
    ((void)(JS_CHECK_OPERATION_WEIGHT(weight),                                \
            (cx)->operationCount = ((cx)->operationCount > 0)                 \
                                   ? (cx)->operationCount - (weight)          \
                                   : 0))

/*
 * The implementation of the above macros assumes that subtracting weights
 * twice from a positive number does not wrap-around INT32_MIN.
 */
#define JS_CHECK_OPERATION_WEIGHT(weight)                                     \
    (JS_ASSERT((uint32) (weight) > 0),                                        \
     JS_ASSERT((uint32) (weight) < JS_BIT(30)))

/* Relative operations weights. */
#define JSOW_JUMP                   1
#define JSOW_ALLOCATION             100
#define JSOW_LOOKUP_PROPERTY        5
#define JSOW_GET_PROPERTY           10
#define JSOW_SET_PROPERTY           20
#define JSOW_NEW_PROPERTY           200
#define JSOW_DELETE_PROPERTY        30
#define JSOW_ENTER_SHARP            JS_OPERATION_WEIGHT_BASE
#define JSOW_SCRIPT_JUMP            JS_OPERATION_WEIGHT_BASE

/*
 * Reset the operation count and call the operation callback assuming that the
 * operation limit is reached.
 */
extern JSBool
js_ResetOperationCount(JSContext *cx);

JS_END_EXTERN_C

#endif /* jscntxt_h___ */
