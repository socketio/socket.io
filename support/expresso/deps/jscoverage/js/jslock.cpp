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

#ifdef JS_THREADSAFE

/*
 * JS locking stubs.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jspubtd.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jstypes.h"
#include "jsbit.h"
#include "jscntxt.h"
#include "jsdtoa.h"
#include "jsgc.h"
#include "jsfun.h"      /* for VALUE_IS_FUNCTION used by *_WRITE_BARRIER */
#include "jslock.h"
#include "jsscope.h"
#include "jsstr.h"

#define ReadWord(W) (W)

/* Implement NativeCompareAndSwap. */

#if defined(_WIN32) && defined(_M_IX86)
#pragma warning( disable : 4035 )
JS_BEGIN_EXTERN_C
extern long __cdecl
_InterlockedCompareExchange(long *volatile dest, long exchange, long comp);
JS_END_EXTERN_C
#pragma intrinsic(_InterlockedCompareExchange)

static JS_ALWAYS_INLINE int
NativeCompareAndSwapHelper(jsword *w, jsword ov, jsword nv)
{
    _InterlockedCompareExchange(w, nv, ov);
    __asm {
        sete al
    }
}

static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    return (NativeCompareAndSwapHelper(w, ov, nv) & 1);
}

#elif defined(XP_MACOSX) || defined(DARWIN)

#include <libkern/OSAtomic.h>

static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    /* Details on these functions available in the manpage for atomic */
#if JS_BYTES_PER_WORD == 8 && JS_BYTES_PER_LONG != 8
    return OSAtomicCompareAndSwap64Barrier(ov, nv, (int64_t*) w);
#else
    return OSAtomicCompareAndSwap32Barrier(ov, nv, (int32_t*) w);
#endif
}

#elif defined(__GNUC__) && defined(__i386__)

/* Note: This fails on 386 cpus, cmpxchgl is a >= 486 instruction */
static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    unsigned int res;

    __asm__ __volatile__ (
                          "lock\n"
                          "cmpxchgl %2, (%1)\n"
                          "sete %%al\n"
                          "andl $1, %%eax\n"
                          : "=a" (res)
                          : "r" (w), "r" (nv), "a" (ov)
                          : "cc", "memory");
    return (int)res;
}

#elif defined(__GNUC__) && defined(__x86_64__)
static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    unsigned int res;

    __asm__ __volatile__ (
                          "lock\n"
                          "cmpxchgq %2, (%1)\n"
                          "sete %%al\n"
                          "movzbl %%al, %%eax\n"
                          : "=a" (res)
                          : "r" (w), "r" (nv), "a" (ov)
                          : "cc", "memory");
    return (int)res;
}

#elif defined(SOLARIS) && defined(sparc) && defined(ULTRA_SPARC)

static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
#if defined(__GNUC__)
    unsigned int res;
    JS_ASSERT(ov != nv);
    asm volatile ("\
stbar\n\
cas [%1],%2,%3\n\
cmp %2,%3\n\
be,a 1f\n\
mov 1,%0\n\
mov 0,%0\n\
1:"
                  : "=r" (res)
                  : "r" (w), "r" (ov), "r" (nv));
    return (int)res;
#else /* !__GNUC__ */
    extern int compare_and_swap(jsword*, jsword, jsword);
    JS_ASSERT(ov != nv);
    return compare_and_swap(w, ov, nv);
#endif
}

#elif defined(AIX)

#include <sys/atomic_op.h>

static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    return !_check_lock((atomic_p)w, ov, nv);
}

#elif defined(USE_ARM_KUSER)

/* See https://bugzilla.mozilla.org/show_bug.cgi?id=429387 for a
 * description of this ABI; this is a function provided at a fixed
 * location by the kernel in the memory space of each process.
 */
typedef int (__kernel_cmpxchg_t)(int oldval, int newval, volatile int *ptr);
#define __kernel_cmpxchg (*(__kernel_cmpxchg_t *)0xffff0fc0)

JS_STATIC_ASSERT(sizeof(jsword) == sizeof(int));

static JS_ALWAYS_INLINE int
NativeCompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    volatile int *vp = (volatile int *) w;
    PRInt32 failed = 1;

    /* Loop until a __kernel_cmpxchg succeeds. See bug 446169 */
    do {
        failed = __kernel_cmpxchg(ov, nv, vp);
    } while (failed && *vp == ov);
    return !failed;
}

#elif JS_HAS_NATIVE_COMPARE_AND_SWAP

#error "JS_HAS_NATIVE_COMPARE_AND_SWAP should be 0 if your platform lacks a compare-and-swap instruction."

#endif /* arch-tests */

#if JS_HAS_NATIVE_COMPARE_AND_SWAP

JSBool
js_CompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    return !!NativeCompareAndSwap(w, ov, nv);
}

#elif defined(NSPR_LOCK)

# ifdef __GNUC__
# warning "js_CompareAndSwap is implemented using NSSP lock"
# endif

JSBool
js_CompareAndSwap(jsword *w, jsword ov, jsword nv)
{
    int result;
    static PRLock *CompareAndSwapLock = JS_NEW_LOCK();

    JS_ACQUIRE_LOCK(CompareAndSwapLock);
    result = (*w == ov);
    if (result)
        *w = nv;
    JS_RELEASE_LOCK(CompareAndSwapLock);
    return result;
}

#else /* !defined(NSPR_LOCK) */

#error "NSPR_LOCK should be on when the platform lacks native compare-and-swap."

#endif

#ifndef NSPR_LOCK

struct JSFatLock {
    int         susp;
    PRLock      *slock;
    PRCondVar   *svar;
    JSFatLock   *next;
    JSFatLock   **prevp;
};

typedef struct JSFatLockTable {
    JSFatLock   *free;
    JSFatLock   *taken;
} JSFatLockTable;

#define GLOBAL_LOCK_INDEX(id)   (((uint32)(jsuword)(id)>>2) & global_locks_mask)

static void
js_Dequeue(JSThinLock *);

static PRLock **global_locks;
static uint32 global_lock_count = 1;
static uint32 global_locks_log2 = 0;
static uint32 global_locks_mask = 0;

static void
js_LockGlobal(void *id)
{
    uint32 i = GLOBAL_LOCK_INDEX(id);
    PR_Lock(global_locks[i]);
}

static void
js_UnlockGlobal(void *id)
{
    uint32 i = GLOBAL_LOCK_INDEX(id);
    PR_Unlock(global_locks[i]);
}

#endif /* !NSPR_LOCK */

void
js_InitLock(JSThinLock *tl)
{
#ifdef NSPR_LOCK
    tl->owner = 0;
    tl->fat = (JSFatLock*)JS_NEW_LOCK();
#else
    memset(tl, 0, sizeof(JSThinLock));
#endif
}

void
js_FinishLock(JSThinLock *tl)
{
#ifdef NSPR_LOCK
    tl->owner = 0xdeadbeef;
    if (tl->fat)
        JS_DESTROY_LOCK(((JSLock*)tl->fat));
#else
    JS_ASSERT(tl->owner == 0);
    JS_ASSERT(tl->fat == NULL);
#endif
}

#ifdef DEBUG_SCOPE_COUNT

#include <stdio.h>
#include "jsdhash.h"

static FILE *logfp;
static JSDHashTable logtbl;

typedef struct logentry {
    JSDHashEntryStub stub;
    char             op;
    const char       *file;
    int              line;
} logentry;

static void
logit(JSScope *scope, char op, const char *file, int line)
{
    logentry *entry;

    if (!logfp) {
        logfp = fopen("/tmp/scope.log", "w");
        if (!logfp)
            return;
        setvbuf(logfp, NULL, _IONBF, 0);
    }
    fprintf(logfp, "%p %c %s %d\n", scope, op, file, line);

    if (!logtbl.entryStore &&
        !JS_DHashTableInit(&logtbl, JS_DHashGetStubOps(), NULL,
                           sizeof(logentry), 100)) {
        return;
    }
    entry = (logentry *) JS_DHashTableOperate(&logtbl, scope, JS_DHASH_ADD);
    if (!entry)
        return;
    entry->stub.key = scope;
    entry->op = op;
    entry->file = file;
    entry->line = line;
}

void
js_unlog_scope(JSScope *scope)
{
    if (!logtbl.entryStore)
        return;
    (void) JS_DHashTableOperate(&logtbl, scope, JS_DHASH_REMOVE);
}

# define LOGIT(scope,op) logit(scope, op, __FILE__, __LINE__)

#else

# define LOGIT(scope,op) /* nothing */

#endif /* DEBUG_SCOPE_COUNT */

/*
 * Return true if scope's ownercx, or the ownercx of a single-threaded scope
 * for which ownercx is waiting to become multi-threaded and shared, is cx.
 * That condition implies deadlock in ClaimScope if cx's thread were to wait
 * to share scope.
 *
 * (i) rt->gcLock held
 */
static JSBool
WillDeadlock(JSTitle *title, JSContext *cx)
{
    JSContext *ownercx;

    do {
        ownercx = title->ownercx;
        if (ownercx == cx) {
            JS_RUNTIME_METER(cx->runtime, deadlocksAvoided);
            return JS_TRUE;
        }
    } while (ownercx && (title = ownercx->titleToShare) != NULL);
    return JS_FALSE;
}

/*
 * Make title multi-threaded, i.e. share its ownership among contexts in rt
 * using a "thin" or (if necessary due to contention) "fat" lock.  Called only
 * from ClaimTitle, immediately below, when we detect deadlock were we to wait
 * for title's lock, because its ownercx is waiting on a title owned by the
 * calling cx.
 *
 * (i) rt->gcLock held
 */
static void
ShareTitle(JSContext *cx, JSTitle *title)
{
    JSRuntime *rt;
    JSTitle **todop;

    rt = cx->runtime;
    if (title->u.link) {
        for (todop = &rt->titleSharingTodo; *todop != title;
             todop = &(*todop)->u.link) {
            JS_ASSERT(*todop != NO_TITLE_SHARING_TODO);
        }
        *todop = title->u.link;
        title->u.link = NULL;       /* null u.link for sanity ASAP */
        JS_NOTIFY_ALL_CONDVAR(rt->titleSharingDone);
    }
    js_InitLock(&title->lock);
    title->u.count = 0;
    js_FinishSharingTitle(cx, title);
}

/*
 * js_FinishSharingTitle is the tail part of ShareTitle, split out to become a
 * subroutine of JS_EndRequest too.  The bulk of the work here involves making
 * mutable strings in the title's object's slots be immutable.  We have to do
 * this because such strings will soon be available to multiple threads, so
 * their buffers can't be realloc'd any longer in js_ConcatStrings, and their
 * members can't be modified by js_ConcatStrings, js_MinimizeDependentStrings,
 * or js_UndependString.
 *
 * The last bit of work done by js_FinishSharingTitle nulls title->ownercx and
 * updates rt->sharedTitles.
 */

void
js_FinishSharingTitle(JSContext *cx, JSTitle *title)
{
    JSObjectMap *map;
    JSScope *scope;
    JSObject *obj;
    uint32 nslots, i;
    jsval v;

    map = TITLE_TO_MAP(title);
    if (!MAP_IS_NATIVE(map))
        return;
    scope = (JSScope *)map;

    obj = scope->object;
    if (obj) {
        nslots = scope->map.freeslot;
        for (i = 0; i != nslots; ++i) {
            v = STOBJ_GET_SLOT(obj, i);
            if (JSVAL_IS_STRING(v) &&
                !js_MakeStringImmutable(cx, JSVAL_TO_STRING(v))) {
                /*
                 * FIXME bug 363059: The following error recovery changes
                 * runtime execution semantics, arbitrarily and silently
                 * ignoring errors except out-of-memory, which should have been
                 * reported through JS_ReportOutOfMemory at this point.
                 */
                STOBJ_SET_SLOT(obj, i, JSVAL_VOID);
            }
        }
    }

    title->ownercx = NULL;  /* NB: set last, after lock init */
    JS_RUNTIME_METER(cx->runtime, sharedTitles);
}

/*
 * Given a title with apparently non-null ownercx different from cx, try to
 * set ownercx to cx, claiming exclusive (single-threaded) ownership of title.
 * If we claim ownership, return true.  Otherwise, we wait for ownercx to be
 * set to null (indicating that title is multi-threaded); or if waiting would
 * deadlock, we set ownercx to null ourselves via ShareTitle.  In any case,
 * once ownercx is null we return false.
 */
static JSBool
ClaimTitle(JSTitle *title, JSContext *cx)
{
    JSRuntime *rt;
    JSContext *ownercx;
    jsrefcount saveDepth;
    PRStatus stat;

    rt = cx->runtime;
    JS_RUNTIME_METER(rt, claimAttempts);
    JS_LOCK_GC(rt);

    /* Reload in case ownercx went away while we blocked on the lock. */
    while ((ownercx = title->ownercx) != NULL) {
        /*
         * Avoid selflock if ownercx is dead, or is not running a request, or
         * has the same thread as cx.  Set title->ownercx to cx so that the
         * matching JS_UNLOCK_SCOPE or JS_UNLOCK_OBJ macro call will take the
         * fast path around the corresponding js_UnlockTitle or js_UnlockObj
         * function call.
         *
         * If title->u.link is non-null, title has already been inserted on
         * the rt->titleSharingTodo list, because another thread's context
         * already wanted to lock title while ownercx was running a request.
         * We can't claim any title whose u.link is non-null at this point,
         * even if ownercx->requestDepth is 0 (see below where we suspend our
         * request before waiting on rt->titleSharingDone).
         */
        if (!title->u.link &&
            (!js_ValidContextPointer(rt, ownercx) ||
             !ownercx->requestDepth ||
             ownercx->thread == cx->thread)) {
            JS_ASSERT(title->u.count == 0);
            title->ownercx = cx;
            JS_UNLOCK_GC(rt);
            JS_RUNTIME_METER(rt, claimedTitles);
            return JS_TRUE;
        }

        /*
         * Avoid deadlock if title's owner context is waiting on a title that
         * we own, by revoking title's ownership.  This approach to deadlock
         * avoidance works because the engine never nests title locks.
         *
         * If cx could hold locks on ownercx->titleToShare, or if ownercx could
         * hold locks on title, we would need to keep reentrancy counts for all
         * such "flyweight" (ownercx != NULL) locks, so that control would
         * unwind properly once these locks became "thin" or "fat".  The engine
         * promotes a title from exclusive to shared access only when locking,
         * never when holding or unlocking.
         *
         * Avoid deadlock before any of this title/context cycle detection if
         * cx is on the active GC's thread, because in that case, no requests
         * will run until the GC completes.  Any title wanted by the GC (from
         * a finalizer) that can't be claimed must become shared.
         */
        if (rt->gcThread == cx->thread ||
            (ownercx->titleToShare &&
             WillDeadlock(ownercx->titleToShare, cx))) {
            ShareTitle(cx, title);
            break;
        }

        /*
         * Thanks to the non-zero NO_TITLE_SHARING_TODO link terminator, we
         * can decide whether title is on rt->titleSharingTodo with a single
         * non-null test, and avoid double-insertion bugs.
         */
        if (!title->u.link) {
            title->u.link = rt->titleSharingTodo;
            rt->titleSharingTodo = title;
            js_HoldObjectMap(cx, TITLE_TO_MAP(title));
        }

        /*
         * Inline JS_SuspendRequest before we wait on rt->titleSharingDone,
         * saving and clearing cx->requestDepth so we don't deadlock if the
         * GC needs to run on ownercx.
         *
         * Unlike JS_SuspendRequest and JS_EndRequest, we must take care not
         * to decrement rt->requestCount if cx is active on the GC's thread,
         * because the GC has already reduced rt->requestCount to exclude all
         * such such contexts.
         */
        saveDepth = cx->requestDepth;
        if (saveDepth) {
            cx->requestDepth = 0;
            if (rt->gcThread != cx->thread) {
                JS_ASSERT(rt->requestCount > 0);
                rt->requestCount--;
                if (rt->requestCount == 0)
                    JS_NOTIFY_REQUEST_DONE(rt);
            }
        }

        /*
         * We know that some other thread's context owns title, which is now
         * linked onto rt->titleSharingTodo, awaiting the end of that other
         * thread's request.  So it is safe to wait on rt->titleSharingDone.
         */
        cx->titleToShare = title;
        stat = PR_WaitCondVar(rt->titleSharingDone, PR_INTERVAL_NO_TIMEOUT);
        JS_ASSERT(stat != PR_FAILURE);

        /*
         * Inline JS_ResumeRequest after waiting on rt->titleSharingDone,
         * restoring cx->requestDepth.  Same note as above for the inlined,
         * specialized JS_SuspendRequest code: beware rt->gcThread.
         */
        if (saveDepth) {
            if (rt->gcThread != cx->thread) {
                while (rt->gcLevel > 0)
                    JS_AWAIT_GC_DONE(rt);
                rt->requestCount++;
            }
            cx->requestDepth = saveDepth;
        }

        /*
         * Don't clear cx->titleToShare until after we're through waiting on
         * all condition variables protected by rt->gcLock -- that includes
         * rt->titleSharingDone *and* rt->gcDone (hidden in JS_AWAIT_GC_DONE,
         * in the inlined JS_ResumeRequest code immediately above).
         *
         * Otherwise, the GC could easily deadlock with another thread that
         * owns a title wanted by a finalizer.  By keeping cx->titleToShare
         * set till here, we ensure that such deadlocks are detected, which
         * results in the finalized object's title being shared (it must, of
         * course, have other, live objects sharing it).
         */
        cx->titleToShare = NULL;
    }

    JS_UNLOCK_GC(rt);
    return JS_FALSE;
}

/* Exported to js.c, which calls it via OBJ_GET_* and JSVAL_IS_* macros. */
JS_FRIEND_API(jsval)
js_GetSlotThreadSafe(JSContext *cx, JSObject *obj, uint32 slot)
{
    jsval v;
    JSScope *scope;
    JSTitle *title;
#ifndef NSPR_LOCK
    JSThinLock *tl;
    jsword me;
#endif

    /*
     * We handle non-native objects via JSObjectOps.getRequiredSlot, treating
     * all slots starting from 0 as required slots.  A property definition or
     * some prior arrangement must have allocated slot.
     *
     * Note once again (see jspubtd.h, before JSGetRequiredSlotOp's typedef)
     * the crucial distinction between a |required slot number| that's passed
     * to the get/setRequiredSlot JSObjectOps, and a |reserved slot index|
     * passed to the JS_Get/SetReservedSlot APIs.
     */
    if (!OBJ_IS_NATIVE(obj))
        return OBJ_GET_REQUIRED_SLOT(cx, obj, slot);

    /*
     * Native object locking is inlined here to optimize the single-threaded
     * and contention-free multi-threaded cases.
     */
    scope = OBJ_SCOPE(obj);
    title = &scope->title;
    JS_ASSERT(title->ownercx != cx);
    JS_ASSERT(slot < obj->map->freeslot);

    /*
     * Avoid locking if called from the GC.  Also avoid locking an object
     * owning a sealed scope.  If neither of those special cases applies, try
     * to claim scope's flyweight lock from whatever context may have had it in
     * an earlier request.
     */
    if (CX_THREAD_IS_RUNNING_GC(cx) ||
        (SCOPE_IS_SEALED(scope) && scope->object == obj) ||
        (title->ownercx && ClaimTitle(title, cx))) {
        return STOBJ_GET_SLOT(obj, slot);
    }

#ifndef NSPR_LOCK
    tl = &title->lock;
    me = CX_THINLOCK_ID(cx);
    JS_ASSERT(CURRENT_THREAD_IS_ME(me));
    if (NativeCompareAndSwap(&tl->owner, 0, me)) {
        /*
         * Got the lock with one compare-and-swap.  Even so, someone else may
         * have mutated obj so it now has its own scope and lock, which would
         * require either a restart from the top of this routine, or a thin
         * lock release followed by fat lock acquisition.
         */
        if (scope == OBJ_SCOPE(obj)) {
            v = STOBJ_GET_SLOT(obj, slot);
            if (!NativeCompareAndSwap(&tl->owner, me, 0)) {
                /* Assert that scope locks never revert to flyweight. */
                JS_ASSERT(title->ownercx != cx);
                LOGIT(scope, '1');
                title->u.count = 1;
                js_UnlockObj(cx, obj);
            }
            return v;
        }
        if (!NativeCompareAndSwap(&tl->owner, me, 0))
            js_Dequeue(tl);
    }
    else if (Thin_RemoveWait(ReadWord(tl->owner)) == me) {
        return STOBJ_GET_SLOT(obj, slot);
    }
#endif

    js_LockObj(cx, obj);
    v = STOBJ_GET_SLOT(obj, slot);

    /*
     * Test whether cx took ownership of obj's scope during js_LockObj.
     *
     * This does not mean that a given scope reverted to flyweight from "thin"
     * or "fat" -- it does mean that obj's map pointer changed due to another
     * thread setting a property, requiring obj to cease sharing a prototype
     * object's scope (whose lock was not flyweight, else we wouldn't be here
     * in the first place!).
     */
    title = &OBJ_SCOPE(obj)->title;
    if (title->ownercx != cx)
        js_UnlockTitle(cx, title);
    return v;
}

void
js_SetSlotThreadSafe(JSContext *cx, JSObject *obj, uint32 slot, jsval v)
{
    JSTitle *title;
    JSScope *scope;
#ifndef NSPR_LOCK
    JSThinLock *tl;
    jsword me;
#endif

    /* Any string stored in a thread-safe object must be immutable. */
    if (JSVAL_IS_STRING(v) &&
        !js_MakeStringImmutable(cx, JSVAL_TO_STRING(v))) {
        /* FIXME bug 363059: See comments in js_FinishSharingScope. */
        v = JSVAL_NULL;
    }

    /*
     * We handle non-native objects via JSObjectOps.setRequiredSlot, as above
     * for the Get case.
     */
    if (!OBJ_IS_NATIVE(obj)) {
        OBJ_SET_REQUIRED_SLOT(cx, obj, slot, v);
        return;
    }

    /*
     * Native object locking is inlined here to optimize the single-threaded
     * and contention-free multi-threaded cases.
     */
    scope = OBJ_SCOPE(obj);
    title = &scope->title;
    JS_ASSERT(title->ownercx != cx);
    JS_ASSERT(slot < obj->map->freeslot);

    /*
     * Avoid locking if called from the GC.  Also avoid locking an object
     * owning a sealed scope.  If neither of those special cases applies, try
     * to claim scope's flyweight lock from whatever context may have had it in
     * an earlier request.
     */
    if (CX_THREAD_IS_RUNNING_GC(cx) ||
        (SCOPE_IS_SEALED(scope) && scope->object == obj) ||
        (title->ownercx && ClaimTitle(title, cx))) {
        LOCKED_OBJ_WRITE_BARRIER(cx, obj, slot, v);
        return;
    }

#ifndef NSPR_LOCK
    tl = &title->lock;
    me = CX_THINLOCK_ID(cx);
    JS_ASSERT(CURRENT_THREAD_IS_ME(me));
    if (NativeCompareAndSwap(&tl->owner, 0, me)) {
        if (scope == OBJ_SCOPE(obj)) {
            LOCKED_OBJ_WRITE_BARRIER(cx, obj, slot, v);
            if (!NativeCompareAndSwap(&tl->owner, me, 0)) {
                /* Assert that scope locks never revert to flyweight. */
                JS_ASSERT(title->ownercx != cx);
                LOGIT(scope, '1');
                title->u.count = 1;
                js_UnlockObj(cx, obj);
            }
            return;
        }
        if (!NativeCompareAndSwap(&tl->owner, me, 0))
            js_Dequeue(tl);
    }
    else if (Thin_RemoveWait(ReadWord(tl->owner)) == me) {
        LOCKED_OBJ_WRITE_BARRIER(cx, obj, slot, v);
        return;
    }
#endif

    js_LockObj(cx, obj);
    LOCKED_OBJ_WRITE_BARRIER(cx, obj, slot, v);

    /*
     * Same drill as above, in js_GetSlotThreadSafe.
     */
    title = &OBJ_SCOPE(obj)->title;
    if (title->ownercx != cx)
        js_UnlockTitle(cx, title);
}

#ifndef NSPR_LOCK

static JSFatLock *
NewFatlock()
{
    JSFatLock *fl = (JSFatLock *)malloc(sizeof(JSFatLock)); /* for now */
    if (!fl) return NULL;
    fl->susp = 0;
    fl->next = NULL;
    fl->prevp = NULL;
    fl->slock = PR_NewLock();
    fl->svar = PR_NewCondVar(fl->slock);
    return fl;
}

static void
DestroyFatlock(JSFatLock *fl)
{
    PR_DestroyLock(fl->slock);
    PR_DestroyCondVar(fl->svar);
    free(fl);
}

static JSFatLock *
ListOfFatlocks(int listc)
{
    JSFatLock *m;
    JSFatLock *m0;
    int i;

    JS_ASSERT(listc>0);
    m0 = m = NewFatlock();
    for (i=1; i<listc; i++) {
        m->next = NewFatlock();
        m = m->next;
    }
    return m0;
}

static void
DeleteListOfFatlocks(JSFatLock *m)
{
    JSFatLock *m0;
    for (; m; m=m0) {
        m0 = m->next;
        DestroyFatlock(m);
    }
}

static JSFatLockTable *fl_list_table = NULL;
static uint32          fl_list_table_len = 0;
static uint32          fl_list_chunk_len = 0;

static JSFatLock *
GetFatlock(void *id)
{
    JSFatLock *m;

    uint32 i = GLOBAL_LOCK_INDEX(id);
    if (fl_list_table[i].free == NULL) {
#ifdef DEBUG
        if (fl_list_table[i].taken)
            printf("Ran out of fat locks!\n");
#endif
        fl_list_table[i].free = ListOfFatlocks(fl_list_chunk_len);
    }
    m = fl_list_table[i].free;
    fl_list_table[i].free = m->next;
    m->susp = 0;
    m->next = fl_list_table[i].taken;
    m->prevp = &fl_list_table[i].taken;
    if (fl_list_table[i].taken)
        fl_list_table[i].taken->prevp = &m->next;
    fl_list_table[i].taken = m;
    return m;
}

static void
PutFatlock(JSFatLock *m, void *id)
{
    uint32 i;
    if (m == NULL)
        return;

    /* Unlink m from fl_list_table[i].taken. */
    *m->prevp = m->next;
    if (m->next)
        m->next->prevp = m->prevp;

    /* Insert m in fl_list_table[i].free. */
    i = GLOBAL_LOCK_INDEX(id);
    m->next = fl_list_table[i].free;
    fl_list_table[i].free = m;
}

#endif /* !NSPR_LOCK */

JSBool
js_SetupLocks(int listc, int globc)
{
#ifndef NSPR_LOCK
    uint32 i;

    if (global_locks)
        return JS_TRUE;
#ifdef DEBUG
    if (listc > 10000 || listc < 0) /* listc == fat lock list chunk length */
        printf("Bad number %d in js_SetupLocks()!\n", listc);
    if (globc > 100 || globc < 0)   /* globc == number of global locks */
        printf("Bad number %d in js_SetupLocks()!\n", listc);
#endif
    global_locks_log2 = JS_CeilingLog2(globc);
    global_locks_mask = JS_BITMASK(global_locks_log2);
    global_lock_count = JS_BIT(global_locks_log2);
    global_locks = (PRLock **) malloc(global_lock_count * sizeof(PRLock*));
    if (!global_locks)
        return JS_FALSE;
    for (i = 0; i < global_lock_count; i++) {
        global_locks[i] = PR_NewLock();
        if (!global_locks[i]) {
            global_lock_count = i;
            js_CleanupLocks();
            return JS_FALSE;
        }
    }
    fl_list_table = (JSFatLockTable *) malloc(i * sizeof(JSFatLockTable));
    if (!fl_list_table) {
        js_CleanupLocks();
        return JS_FALSE;
    }
    fl_list_table_len = global_lock_count;
    for (i = 0; i < global_lock_count; i++)
        fl_list_table[i].free = fl_list_table[i].taken = NULL;
    fl_list_chunk_len = listc;
#endif /* !NSPR_LOCK */
    return JS_TRUE;
}

void
js_CleanupLocks()
{
#ifndef NSPR_LOCK
    uint32 i;

    if (global_locks) {
        for (i = 0; i < global_lock_count; i++)
            PR_DestroyLock(global_locks[i]);
        free(global_locks);
        global_locks = NULL;
        global_lock_count = 1;
        global_locks_log2 = 0;
        global_locks_mask = 0;
    }
    if (fl_list_table) {
        for (i = 0; i < fl_list_table_len; i++) {
            DeleteListOfFatlocks(fl_list_table[i].free);
            fl_list_table[i].free = NULL;
            DeleteListOfFatlocks(fl_list_table[i].taken);
            fl_list_table[i].taken = NULL;
        }
        free(fl_list_table);
        fl_list_table = NULL;
        fl_list_table_len = 0;
    }
#endif /* !NSPR_LOCK */
}

#ifdef NSPR_LOCK

static JS_ALWAYS_INLINE void
ThinLock(JSThinLock *tl, jsword me)
{
    JS_ACQUIRE_LOCK((JSLock *) tl->fat);
    tl->owner = me;
}

static JS_ALWAYS_INLINE void
ThinUnlock(JSThinLock *tl, jsword /*me*/)
{
    tl->owner = 0;
    JS_RELEASE_LOCK((JSLock *) tl->fat);
}

#else

/*
 * Fast locking and unlocking is implemented by delaying the allocation of a
 * system lock (fat lock) until contention.  As long as a locking thread A
 * runs uncontended, the lock is represented solely by storing A's identity in
 * the object being locked.
 *
 * If another thread B tries to lock the object currently locked by A, B is
 * enqueued into a fat lock structure (which might have to be allocated and
 * pointed to by the object), and suspended using NSPR conditional variables
 * (wait).  A wait bit (Bacon bit) is set in the lock word of the object,
 * signalling to A that when releasing the lock, B must be dequeued and
 * notified.
 *
 * The basic operation of the locking primitives (js_Lock, js_Unlock,
 * js_Enqueue, and js_Dequeue) is compare-and-swap.  Hence, when locking into
 * the word pointed at by p, compare-and-swap(p, 0, A) success implies that p
 * is unlocked.  Similarly, when unlocking p, if compare-and-swap(p, A, 0)
 * succeeds this implies that p is uncontended (no one is waiting because the
 * wait bit is not set).
 *
 * When dequeueing, the lock is released, and one of the threads suspended on
 * the lock is notified.  If other threads still are waiting, the wait bit is
 * kept (in js_Enqueue), and if not, the fat lock is deallocated.
 *
 * The functions js_Enqueue, js_Dequeue, js_SuspendThread, and js_ResumeThread
 * are serialized using a global lock.  For scalability, a hashtable of global
 * locks is used, which is indexed modulo the thin lock pointer.
 */

/*
 * Invariants:
 * (i)  global lock is held
 * (ii) fl->susp >= 0
 */
static int
js_SuspendThread(JSThinLock *tl)
{
    JSFatLock *fl;
    PRStatus stat;

    if (tl->fat == NULL)
        fl = tl->fat = GetFatlock(tl);
    else
        fl = tl->fat;
    JS_ASSERT(fl->susp >= 0);
    fl->susp++;
    PR_Lock(fl->slock);
    js_UnlockGlobal(tl);
    stat = PR_WaitCondVar(fl->svar, PR_INTERVAL_NO_TIMEOUT);
    JS_ASSERT(stat != PR_FAILURE);
    PR_Unlock(fl->slock);
    js_LockGlobal(tl);
    fl->susp--;
    if (fl->susp == 0) {
        PutFatlock(fl, tl);
        tl->fat = NULL;
    }
    return tl->fat == NULL;
}

/*
 * (i)  global lock is held
 * (ii) fl->susp > 0
 */
static void
js_ResumeThread(JSThinLock *tl)
{
    JSFatLock *fl = tl->fat;
    PRStatus stat;

    JS_ASSERT(fl != NULL);
    JS_ASSERT(fl->susp > 0);
    PR_Lock(fl->slock);
    js_UnlockGlobal(tl);
    stat = PR_NotifyCondVar(fl->svar);
    JS_ASSERT(stat != PR_FAILURE);
    PR_Unlock(fl->slock);
}

static void
js_Enqueue(JSThinLock *tl, jsword me)
{
    jsword o, n;

    js_LockGlobal(tl);
    for (;;) {
        o = ReadWord(tl->owner);
        n = Thin_SetWait(o);
        if (o != 0 && NativeCompareAndSwap(&tl->owner, o, n)) {
            if (js_SuspendThread(tl))
                me = Thin_RemoveWait(me);
            else
                me = Thin_SetWait(me);
        }
        else if (NativeCompareAndSwap(&tl->owner, 0, me)) {
            js_UnlockGlobal(tl);
            return;
        }
    }
}

static void
js_Dequeue(JSThinLock *tl)
{
    jsword o;

    js_LockGlobal(tl);
    o = ReadWord(tl->owner);
    JS_ASSERT(Thin_GetWait(o) != 0);
    JS_ASSERT(tl->fat != NULL);
    if (!NativeCompareAndSwap(&tl->owner, o, 0)) /* release it */
        JS_ASSERT(0);
    js_ResumeThread(tl);
}

static JS_ALWAYS_INLINE void
ThinLock(JSThinLock *tl, jsword me)
{
    JS_ASSERT(CURRENT_THREAD_IS_ME(me));
    if (NativeCompareAndSwap(&tl->owner, 0, me))
        return;
    if (Thin_RemoveWait(ReadWord(tl->owner)) != me)
        js_Enqueue(tl, me);
#ifdef DEBUG
    else
        JS_ASSERT(0);
#endif
}

static JS_ALWAYS_INLINE void
ThinUnlock(JSThinLock *tl, jsword me)
{
    JS_ASSERT(CURRENT_THREAD_IS_ME(me));

    /*
     * Since we can race with the NativeCompareAndSwap in js_Enqueue, we need
     * to use a C_A_S here as well -- Arjan van de Ven 30/1/08
     */
    if (NativeCompareAndSwap(&tl->owner, me, 0))
        return;

    JS_ASSERT(Thin_GetWait(tl->owner));
    if (Thin_RemoveWait(ReadWord(tl->owner)) == me)
        js_Dequeue(tl);
#ifdef DEBUG
    else
        JS_ASSERT(0);   /* unbalanced unlock */
#endif
}

#endif /* !NSPR_LOCK */

void
js_Lock(JSContext *cx, JSThinLock *tl)
{
    ThinLock(tl, CX_THINLOCK_ID(cx));
}

void
js_Unlock(JSContext *cx, JSThinLock *tl)
{
    ThinUnlock(tl, CX_THINLOCK_ID(cx));
}

void
js_LockRuntime(JSRuntime *rt)
{
    PR_Lock(rt->rtLock);
#ifdef DEBUG
    rt->rtLockOwner = js_CurrentThreadId();
#endif
}

void
js_UnlockRuntime(JSRuntime *rt)
{
#ifdef DEBUG
    rt->rtLockOwner = 0;
#endif
    PR_Unlock(rt->rtLock);
}

void
js_LockTitle(JSContext *cx, JSTitle *title)
{
    jsword me = CX_THINLOCK_ID(cx);

    JS_ASSERT(CURRENT_THREAD_IS_ME(me));
    JS_ASSERT(title->ownercx != cx);
    if (CX_THREAD_IS_RUNNING_GC(cx))
        return;
    if (title->ownercx && ClaimTitle(title, cx))
        return;

    if (Thin_RemoveWait(ReadWord(title->lock.owner)) == me) {
        JS_ASSERT(title->u.count > 0);
        LOGIT(scope, '+');
        title->u.count++;
    } else {
        ThinLock(&title->lock, me);
        JS_ASSERT(title->u.count == 0);
        LOGIT(scope, '1');
        title->u.count = 1;
    }
}

void
js_UnlockTitle(JSContext *cx, JSTitle *title)
{
    jsword me = CX_THINLOCK_ID(cx);

    /* We hope compilers use me instead of reloading cx->thread in the macro. */
    if (CX_THREAD_IS_RUNNING_GC(cx))
        return;
    if (cx->lockedSealedTitle == title) {
        cx->lockedSealedTitle = NULL;
        return;
    }

    /*
     * If title->ownercx is not null, it's likely that two contexts not using
     * requests nested locks for title.  The first context, cx here, claimed
     * title; the second, title->ownercx here, re-claimed it because the first
     * was not in a request, or was on the same thread.  We don't want to keep
     * track of such nesting, because it penalizes the common non-nested case.
     * Instead of asserting here and silently coping, we simply re-claim title
     * for cx and return.
     *
     * See http://bugzilla.mozilla.org/show_bug.cgi?id=229200 for a real world
     * case where an asymmetric thread model (Mozilla's main thread is known
     * to be the only thread that runs the GC) combined with multiple contexts
     * per thread has led to such request-less nesting.
     */
    if (title->ownercx) {
        JS_ASSERT(title->u.count == 0);
        JS_ASSERT(title->lock.owner == 0);
        title->ownercx = cx;
        return;
    }

    JS_ASSERT(title->u.count > 0);
    if (Thin_RemoveWait(ReadWord(title->lock.owner)) != me) {
        JS_ASSERT(0);   /* unbalanced unlock */
        return;
    }
    LOGIT(scope, '-');
    if (--title->u.count == 0)
        ThinUnlock(&title->lock, me);
}

/*
 * NB: oldtitle may be null if our caller is js_GetMutableScope and it just
 * dropped the last reference to oldtitle.
 */
void
js_TransferTitle(JSContext *cx, JSTitle *oldtitle, JSTitle *newtitle)
{
    JS_ASSERT(JS_IS_TITLE_LOCKED(cx, newtitle));

    /*
     * If the last reference to oldtitle went away, newtitle needs no lock
     * state update.
     */
    if (!oldtitle)
        return;
    JS_ASSERT(JS_IS_TITLE_LOCKED(cx, oldtitle));

    /*
     * Special case in js_LockTitle and js_UnlockTitle for the GC calling
     * code that locks, unlocks, or mutates.  Nothing to do in these cases,
     * because title and newtitle were "locked" by the GC thread, so neither
     * was actually locked.
     */
    if (CX_THREAD_IS_RUNNING_GC(cx))
        return;

    /*
     * Special case in js_LockObj and js_UnlockTitle for locking the sealed
     * scope of an object that owns that scope (the prototype or mutated obj
     * for which OBJ_SCOPE(obj)->object == obj), and unlocking it.
     */
    JS_ASSERT(cx->lockedSealedTitle != newtitle);
    if (cx->lockedSealedTitle == oldtitle) {
        JS_ASSERT(newtitle->ownercx == cx ||
                  (!newtitle->ownercx && newtitle->u.count == 1));
        cx->lockedSealedTitle = NULL;
        return;
    }

    /*
     * If oldtitle is single-threaded, there's nothing to do.
     */
    if (oldtitle->ownercx) {
        JS_ASSERT(oldtitle->ownercx == cx);
        JS_ASSERT(newtitle->ownercx == cx ||
                  (!newtitle->ownercx && newtitle->u.count == 1));
        return;
    }

    /*
     * We transfer oldtitle->u.count only if newtitle is not single-threaded.
     * Flow unwinds from here through some number of JS_UNLOCK_TITLE and/or
     * JS_UNLOCK_OBJ macro calls, which will decrement newtitle->u.count only
     * if they find newtitle->ownercx != cx.
     */
    if (newtitle->ownercx != cx) {
        JS_ASSERT(!newtitle->ownercx);
        newtitle->u.count = oldtitle->u.count;
    }

    /*
     * Reset oldtitle's lock state so that it is completely unlocked.
     */
    LOGIT(oldscope, '0');
    oldtitle->u.count = 0;
    ThinUnlock(&oldtitle->lock, CX_THINLOCK_ID(cx));
}

void
js_LockObj(JSContext *cx, JSObject *obj)
{
    JSScope *scope;
    JSTitle *title;

    JS_ASSERT(OBJ_IS_NATIVE(obj));

    /*
     * We must test whether the GC is calling and return without mutating any
     * state, especially cx->lockedSealedScope.  Note asymmetry with respect to
     * js_UnlockObj, which is a thin-layer on top of js_UnlockTitle.
     */
    if (CX_THREAD_IS_RUNNING_GC(cx))
        return;

    for (;;) {
        scope = OBJ_SCOPE(obj);
        title = &scope->title;
        if (SCOPE_IS_SEALED(scope) && scope->object == obj &&
            !cx->lockedSealedTitle) {
            cx->lockedSealedTitle = title;
            return;
        }

        js_LockTitle(cx, title);

        /* If obj still has this scope, we're done. */
        if (scope == OBJ_SCOPE(obj))
            return;

        /* Lost a race with a mutator; retry with obj's new scope. */
        js_UnlockTitle(cx, title);
    }
}

void
js_UnlockObj(JSContext *cx, JSObject *obj)
{
    JS_ASSERT(OBJ_IS_NATIVE(obj));
    js_UnlockTitle(cx, &OBJ_SCOPE(obj)->title);
}

void
js_InitTitle(JSContext *cx, JSTitle *title)
{
#ifdef JS_THREADSAFE
    title->ownercx = cx;
    memset(&title->lock, 0, sizeof title->lock);

    /*
     * Set u.link = NULL, not u.count = 0, in case the target architecture's
     * null pointer has a non-zero integer representation.
     */
    title->u.link = NULL;

#ifdef JS_DEBUG_TITLE_LOCKS
    title->file[0] = title->file[1] = title->file[2] = title->file[3] = NULL;
    title->line[0] = title->line[1] = title->line[2] = title->line[3] = 0;
#endif
#endif
}

void
js_FinishTitle(JSContext *cx, JSTitle *title)
{
#ifdef JS_THREADSAFE
    /* Title must be single-threaded at this point, so set ownercx. */
    JS_ASSERT(title->u.count == 0);
    title->ownercx = cx;
    js_FinishLock(&title->lock);
#endif
}

#ifdef DEBUG

JSBool
js_IsRuntimeLocked(JSRuntime *rt)
{
    return js_CurrentThreadId() == rt->rtLockOwner;
}

JSBool
js_IsObjLocked(JSContext *cx, JSObject *obj)
{
    JSScope *scope = OBJ_SCOPE(obj);

    return MAP_IS_NATIVE(&scope->map) && js_IsTitleLocked(cx, &scope->title);
}

JSBool
js_IsTitleLocked(JSContext *cx, JSTitle *title)
{
    /* Special case: the GC locking any object's title, see js_LockTitle. */
    if (CX_THREAD_IS_RUNNING_GC(cx))
        return JS_TRUE;

    /* Special case: locked object owning a sealed scope, see js_LockObj. */
    if (cx->lockedSealedTitle == title)
        return JS_TRUE;

    /*
     * General case: the title is either exclusively owned (by cx), or it has
     * a thin or fat lock to cope with shared (concurrent) ownership.
     */
    if (title->ownercx) {
        JS_ASSERT(title->ownercx == cx || title->ownercx->thread == cx->thread);
        return JS_TRUE;
    }
    return js_CurrentThreadId() ==
           ((JSThread *)Thin_RemoveWait(ReadWord(title->lock.owner)))->id;
}

#ifdef JS_DEBUG_TITLE_LOCKS
void
js_SetScopeInfo(JSScope *scope, const char *file, int line)
{
    JSTitle *title = &scope->title;
    if (!title->ownercx) {
        jsrefcount count = title->u.count;
        JS_ASSERT_IF(!SCOPE_IS_SEALED(scope), count > 0);
        JS_ASSERT(count <= 4);
        title->file[count - 1] = file;
        title->line[count - 1] = line;
    }
}
#endif /* JS_DEBUG_TITLE_LOCKS */
#endif /* DEBUG */
#endif /* JS_THREADSAFE */
