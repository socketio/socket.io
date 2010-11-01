/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set ts=8 sw=4 et tw=80:
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
 * JS execution context.
 */
#include "jsstddef.h"
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsutil.h" /* Added by JSIFY */
#include "jsclist.h"
#include "jsprf.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsdbgapi.h"
#include "jsexn.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsopcode.h"
#include "jsscan.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jstracer.h"

#ifdef JS_THREADSAFE
#include "prtypes.h"

/*
 * The index for JSThread info, returned by PR_NewThreadPrivateIndex.  The
 * index value is visible and shared by all threads, but the data associated
 * with it is private to each thread.
 */
static PRUintn threadTPIndex;
static JSBool  tpIndexInited = JS_FALSE;

JS_BEGIN_EXTERN_C
JSBool
js_InitThreadPrivateIndex(void (*ptr)(void *))
{
    PRStatus status;

    if (tpIndexInited)
        return JS_TRUE;

    status = PR_NewThreadPrivateIndex(&threadTPIndex, ptr);

    if (status == PR_SUCCESS)
        tpIndexInited = JS_TRUE;
    return status == PR_SUCCESS;
}
JS_END_EXTERN_C

/*
 * Callback function to delete a JSThread info when the thread that owns it
 * is destroyed.
 */
void
js_ThreadDestructorCB(void *ptr)
{
    JSThread *thread = (JSThread *)ptr;

    if (!thread)
        return;

    /*
     * Check that this thread properly called either JS_DestroyContext or
     * JS_ClearContextThread on each JSContext it created or used.
     */
    JS_ASSERT(JS_CLIST_IS_EMPTY(&thread->contextList));
    GSN_CACHE_CLEAR(&thread->gsnCache);
#if defined JS_TRACER
    js_FinishJIT(&thread->traceMonitor);
#endif
    free(thread);
}

/*
 * Get current thread-local JSThread info, creating one if it doesn't exist.
 * Each thread has a unique JSThread pointer.
 *
 * Since we are dealing with thread-local data, no lock is needed.
 *
 * Return a pointer to the thread local info, NULL if the system runs out
 * of memory, or it failed to set thread private data (neither case is very
 * likely; both are probably due to out-of-memory).  It is up to the caller
 * to report an error, if possible.
 */
JSThread *
js_GetCurrentThread(JSRuntime *rt)
{
    JSThread *thread;

    thread = (JSThread *)PR_GetThreadPrivate(threadTPIndex);
    if (!thread) {
        thread = (JSThread *) malloc(sizeof(JSThread));
        if (!thread)
            return NULL;
#ifdef DEBUG
        memset(thread, JS_FREE_PATTERN, sizeof(JSThread));
#endif
        if (PR_FAILURE == PR_SetThreadPrivate(threadTPIndex, thread)) {
            free(thread);
            return NULL;
        }

        JS_INIT_CLIST(&thread->contextList);
        thread->id = js_CurrentThreadId();
        thread->gcMallocBytes = 0;
#ifdef JS_TRACER
        memset(&thread->traceMonitor, 0, sizeof(thread->traceMonitor));
        js_InitJIT(&thread->traceMonitor);
#endif
        thread->scriptsToGC = NULL;

        /*
         * js_SetContextThread initializes the remaining fields as necessary.
         */
    }
    return thread;
}

/*
 * Sets current thread as owning thread of a context by assigning the
 * thread-private info to the context. If the current thread doesn't have
 * private JSThread info, create one.
 */
JSBool
js_SetContextThread(JSContext *cx)
{
    JSThread *thread = js_GetCurrentThread(cx->runtime);

    if (!thread) {
        JS_ReportOutOfMemory(cx);
        return JS_FALSE;
    }

    /*
     * Clear caches on each transition from 0 to 1 context active on the
     * current thread. See bug 425828.
     */
    if (JS_CLIST_IS_EMPTY(&thread->contextList)) {
        memset(&thread->gsnCache, 0, sizeof(thread->gsnCache));
        memset(&thread->propertyCache, 0, sizeof(thread->propertyCache));
    }

    /* Assert that the previous cx->thread called JS_ClearContextThread(). */
    JS_ASSERT(!cx->thread || cx->thread == thread);
    if (!cx->thread)
        JS_APPEND_LINK(&cx->threadLinks, &thread->contextList);
    cx->thread = thread;
    return JS_TRUE;
}

/* Remove the owning thread info of a context. */
void
js_ClearContextThread(JSContext *cx)
{
    /*
     * If cx is associated with a thread, this must be called only from that
     * thread.  If not, this is a harmless no-op.
     */
    JS_ASSERT(cx->thread == js_GetCurrentThread(cx->runtime) || !cx->thread);
    JS_REMOVE_AND_INIT_LINK(&cx->threadLinks);
    cx->thread = NULL;
}

#endif /* JS_THREADSAFE */

void
js_OnVersionChange(JSContext *cx)
{
#ifdef DEBUG
    JSVersion version = JSVERSION_NUMBER(cx);

    JS_ASSERT(version == JSVERSION_DEFAULT || version >= JSVERSION_ECMA_3);
#endif
}

void
js_SetVersion(JSContext *cx, JSVersion version)
{
    cx->version = version;
    js_OnVersionChange(cx);
}

JSContext *
js_NewContext(JSRuntime *rt, size_t stackChunkSize)
{
    JSContext *cx;
    JSBool ok, first;
    JSContextCallback cxCallback;

    cx = (JSContext *) malloc(sizeof *cx);
    if (!cx)
        return NULL;
    memset(cx, 0, sizeof *cx);

    cx->runtime = rt;
    JS_ClearOperationCallback(cx);
    cx->debugHooks = &rt->globalDebugHooks;
#if JS_STACK_GROWTH_DIRECTION > 0
    cx->stackLimit = (jsuword)-1;
#endif
    cx->scriptStackQuota = JS_DEFAULT_SCRIPT_STACK_QUOTA;
#ifdef JS_THREADSAFE
    cx->gcLocalFreeLists = (JSGCFreeListSet *) &js_GCEmptyFreeListSet;
    JS_INIT_CLIST(&cx->threadLinks);
    js_SetContextThread(cx);
#endif

    JS_LOCK_GC(rt);
    for (;;) {
        first = (rt->contextList.next == &rt->contextList);
        if (rt->state == JSRTS_UP) {
            JS_ASSERT(!first);
            break;
        }
        if (rt->state == JSRTS_DOWN) {
            JS_ASSERT(first);
            rt->state = JSRTS_LAUNCHING;
            break;
        }
        JS_WAIT_CONDVAR(rt->stateChange, JS_NO_TIMEOUT);
    }
    JS_APPEND_LINK(&cx->links, &rt->contextList);
    JS_UNLOCK_GC(rt);

    /*
     * First we do the infallible, every-time per-context initializations.
     * Should a later, fallible initialization (js_InitRegExpStatics, e.g.,
     * or the stuff under 'if (first)' below) fail, at least the version
     * and arena-pools will be valid and safe to use (say, from the last GC
     * done by js_DestroyContext).
     */
    cx->version = JSVERSION_DEFAULT;
    JS_INIT_ARENA_POOL(&cx->stackPool, "stack", stackChunkSize, sizeof(jsval),
                       &cx->scriptStackQuota);

    JS_INIT_ARENA_POOL(&cx->tempPool, "temp",
                       1024,  /* FIXME: bug 421435 */
                       sizeof(jsdouble), &cx->scriptStackQuota);

    /*
     * To avoid multiple allocations in InitMatch() (in jsregexp.c), the arena
     * size parameter should be at least as big as:
     *   INITIAL_BACKTRACK
     *   + (sizeof(REProgState) * INITIAL_STATESTACK)
     *   + (offsetof(REMatchState, parens) + avgParanSize * sizeof(RECapture))
     */
    JS_INIT_ARENA_POOL(&cx->regexpPool, "regexp",
                       12 * 1024 - 40,  /* FIXME: bug 421435 */
                       sizeof(void *), &cx->scriptStackQuota);

    if (!js_InitRegExpStatics(cx, &cx->regExpStatics)) {
        js_DestroyContext(cx, JSDCM_NEW_FAILED);
        return NULL;
    }

    cx->resolveFlags = 0;

    /*
     * If cx is the first context on this runtime, initialize well-known atoms,
     * keywords, numbers, and strings.  If one of these steps should fail, the
     * runtime will be left in a partially initialized state, with zeroes and
     * nulls stored in the default-initialized remainder of the struct.  We'll
     * clean the runtime up under js_DestroyContext, because cx will be "last"
     * as well as "first".
     */
    if (first) {
#ifdef JS_THREADSAFE
        JS_BeginRequest(cx);
#endif
        ok = js_InitCommonAtoms(cx);

        /*
         * scriptFilenameTable may be left over from a previous episode of
         * non-zero contexts alive in rt, so don't re-init the table if it's
         * not necessary.
         */
        if (ok && !rt->scriptFilenameTable)
            ok = js_InitRuntimeScriptState(rt);
        if (ok)
            ok = js_InitRuntimeNumberState(cx);
        if (ok)
            ok = js_InitRuntimeStringState(cx);
#ifdef JS_THREADSAFE
        JS_EndRequest(cx);
#endif
        if (!ok) {
            js_DestroyContext(cx, JSDCM_NEW_FAILED);
            return NULL;
        }

        JS_LOCK_GC(rt);
        rt->state = JSRTS_UP;
        JS_NOTIFY_ALL_CONDVAR(rt->stateChange);
        JS_UNLOCK_GC(rt);
    }

    cxCallback = rt->cxCallback;
    if (cxCallback && !cxCallback(cx, JSCONTEXT_NEW)) {
        js_DestroyContext(cx, JSDCM_NEW_FAILED);
        return NULL;
    }

    return cx;
}

void
js_DestroyContext(JSContext *cx, JSDestroyContextMode mode)
{
    JSRuntime *rt;
    JSContextCallback cxCallback;
    JSBool last;
    JSArgumentFormatMap *map;
    JSLocalRootStack *lrs;
    JSLocalRootChunk *lrc;

    rt = cx->runtime;

    if (mode != JSDCM_NEW_FAILED) {
        cxCallback = rt->cxCallback;
        if (cxCallback) {
            /*
             * JSCONTEXT_DESTROY callback is not allowed to fail and must
             * return true.
             */
#ifdef DEBUG
            JSBool callbackStatus =
#endif
            cxCallback(cx, JSCONTEXT_DESTROY);
            JS_ASSERT(callbackStatus);
        }
    }

    /* Remove cx from context list first. */
    JS_LOCK_GC(rt);
    JS_ASSERT(rt->state == JSRTS_UP || rt->state == JSRTS_LAUNCHING);
    JS_REMOVE_LINK(&cx->links);
    last = (rt->contextList.next == &rt->contextList);
    if (last)
        rt->state = JSRTS_LANDING;
#ifdef JS_THREADSAFE
    js_RevokeGCLocalFreeLists(cx);
#endif
    JS_UNLOCK_GC(rt);

    if (last) {
#ifdef JS_THREADSAFE
        /*
         * If cx is not in a request already, begin one now so that we wait
         * for any racing GC started on a not-last context to finish, before
         * we plow ahead and unpin atoms.  Note that even though we begin a
         * request here if necessary, we end all requests on cx below before
         * forcing a final GC.  This lets any not-last context destruction
         * racing in another thread try to force or maybe run the GC, but by
         * that point, rt->state will not be JSRTS_UP, and that GC attempt
         * will return early.
         */
        if (cx->requestDepth == 0)
            JS_BeginRequest(cx);
#endif

        /* Unlock and clear GC things held by runtime pointers. */
        js_FinishRuntimeNumberState(cx);
        js_FinishRuntimeStringState(cx);

        /* Unpin all common atoms before final GC. */
        js_FinishCommonAtoms(cx);

        /* Clear debugging state to remove GC roots. */
        JS_ClearAllTraps(cx);
        JS_ClearAllWatchPoints(cx);
    }

    /*
     * Remove more GC roots in regExpStatics, then collect garbage.
     * XXX anti-modularity alert: we rely on the call to js_RemoveRoot within
     * XXX this function call to wait for any racing GC to complete, in the
     * XXX case where JS_DestroyContext is called outside of a request on cx
     */
    js_FreeRegExpStatics(cx, &cx->regExpStatics);

#ifdef JS_THREADSAFE
    /*
     * Destroying a context implicitly calls JS_EndRequest().  Also, we must
     * end our request here in case we are "last" -- in that event, another
     * js_DestroyContext that was not last might be waiting in the GC for our
     * request to end.  We'll let it run below, just before we do the truly
     * final GC and then free atom state.
     *
     * At this point, cx must be inaccessible to other threads.  It's off the
     * rt->contextList, and it should not be reachable via any object private
     * data structure.
     */
    while (cx->requestDepth != 0)
        JS_EndRequest(cx);
#endif

    if (last) {
        js_GC(cx, GC_LAST_CONTEXT);

        /*
         * Free the script filename table if it exists and is empty. Do this
         * after the last GC to avoid finalizers tripping on free memory.
         */
        if (rt->scriptFilenameTable && rt->scriptFilenameTable->nentries == 0)
            js_FinishRuntimeScriptState(rt);

        /* Take the runtime down, now that it has no contexts or atoms. */
        JS_LOCK_GC(rt);
        rt->state = JSRTS_DOWN;
        JS_NOTIFY_ALL_CONDVAR(rt->stateChange);
        JS_UNLOCK_GC(rt);
    } else {
        if (mode == JSDCM_FORCE_GC)
            js_GC(cx, GC_NORMAL);
        else if (mode == JSDCM_MAYBE_GC)
            JS_MaybeGC(cx);
    }

    /* Free the stuff hanging off of cx. */
    JS_FinishArenaPool(&cx->stackPool);
    JS_FinishArenaPool(&cx->tempPool);
    JS_FinishArenaPool(&cx->regexpPool);

    if (cx->lastMessage)
        free(cx->lastMessage);

    /* Remove any argument formatters. */
    map = cx->argumentFormatMap;
    while (map) {
        JSArgumentFormatMap *temp = map;
        map = map->next;
        JS_free(cx, temp);
    }

    /* Destroy the resolve recursion damper. */
    if (cx->resolvingTable) {
        JS_DHashTableDestroy(cx->resolvingTable);
        cx->resolvingTable = NULL;
    }

    lrs = cx->localRootStack;
    if (lrs) {
        while ((lrc = lrs->topChunk) != &lrs->firstChunk) {
            lrs->topChunk = lrc->down;
            JS_free(cx, lrc);
        }
        JS_free(cx, lrs);
    }

#ifdef JS_THREADSAFE
    js_ClearContextThread(cx);
#endif

    /* Finally, free cx itself. */
    free(cx);
}

JSBool
js_ValidContextPointer(JSRuntime *rt, JSContext *cx)
{
    JSCList *cl;

    for (cl = rt->contextList.next; cl != &rt->contextList; cl = cl->next) {
        if (cl == &cx->links)
            return JS_TRUE;
    }
    JS_RUNTIME_METER(rt, deadContexts);
    return JS_FALSE;
}

JSContext *
js_ContextIterator(JSRuntime *rt, JSBool unlocked, JSContext **iterp)
{
    JSContext *cx = *iterp;

    if (unlocked)
        JS_LOCK_GC(rt);
    cx = (JSContext *) (cx ? cx->links.next : rt->contextList.next);
    if (&cx->links == &rt->contextList)
        cx = NULL;
    *iterp = cx;
    if (unlocked)
        JS_UNLOCK_GC(rt);
    return cx;
}

static JSDHashNumber
resolving_HashKey(JSDHashTable *table, const void *ptr)
{
    const JSResolvingKey *key = (const JSResolvingKey *)ptr;

    return ((JSDHashNumber)JS_PTR_TO_UINT32(key->obj) >> JSVAL_TAGBITS) ^ key->id;
}

JS_PUBLIC_API(JSBool)
resolving_MatchEntry(JSDHashTable *table,
                     const JSDHashEntryHdr *hdr,
                     const void *ptr)
{
    const JSResolvingEntry *entry = (const JSResolvingEntry *)hdr;
    const JSResolvingKey *key = (const JSResolvingKey *)ptr;

    return entry->key.obj == key->obj && entry->key.id == key->id;
}

static const JSDHashTableOps resolving_dhash_ops = {
    JS_DHashAllocTable,
    JS_DHashFreeTable,
    resolving_HashKey,
    resolving_MatchEntry,
    JS_DHashMoveEntryStub,
    JS_DHashClearEntryStub,
    JS_DHashFinalizeStub,
    NULL
};

JSBool
js_StartResolving(JSContext *cx, JSResolvingKey *key, uint32 flag,
                  JSResolvingEntry **entryp)
{
    JSDHashTable *table;
    JSResolvingEntry *entry;

    table = cx->resolvingTable;
    if (!table) {
        table = JS_NewDHashTable(&resolving_dhash_ops, NULL,
                                 sizeof(JSResolvingEntry),
                                 JS_DHASH_MIN_SIZE);
        if (!table)
            goto outofmem;
        cx->resolvingTable = table;
    }

    entry = (JSResolvingEntry *)
            JS_DHashTableOperate(table, key, JS_DHASH_ADD);
    if (!entry)
        goto outofmem;

    if (entry->flags & flag) {
        /* An entry for (key, flag) exists already -- dampen recursion. */
        entry = NULL;
    } else {
        /* Fill in key if we were the first to add entry, then set flag. */
        if (!entry->key.obj)
            entry->key = *key;
        entry->flags |= flag;
    }
    *entryp = entry;
    return JS_TRUE;

outofmem:
    JS_ReportOutOfMemory(cx);
    return JS_FALSE;
}

void
js_StopResolving(JSContext *cx, JSResolvingKey *key, uint32 flag,
                 JSResolvingEntry *entry, uint32 generation)
{
    JSDHashTable *table;

    /*
     * Clear flag from entry->flags and return early if other flags remain.
     * We must take care to re-lookup entry if the table has changed since
     * it was found by js_StartResolving.
     */
    table = cx->resolvingTable;
    if (!entry || table->generation != generation) {
        entry = (JSResolvingEntry *)
                JS_DHashTableOperate(table, key, JS_DHASH_LOOKUP);
    }
    JS_ASSERT(JS_DHASH_ENTRY_IS_BUSY(&entry->hdr));
    entry->flags &= ~flag;
    if (entry->flags)
        return;

    /*
     * Do a raw remove only if fewer entries were removed than would cause
     * alpha to be less than .5 (alpha is at most .75).  Otherwise, we just
     * call JS_DHashTableOperate to re-lookup the key and remove its entry,
     * compressing or shrinking the table as needed.
     */
    if (table->removedCount < JS_DHASH_TABLE_SIZE(table) >> 2)
        JS_DHashTableRawRemove(table, &entry->hdr);
    else
        JS_DHashTableOperate(table, key, JS_DHASH_REMOVE);
}

JSBool
js_EnterLocalRootScope(JSContext *cx)
{
    JSLocalRootStack *lrs;
    int mark;

    lrs = cx->localRootStack;
    if (!lrs) {
        lrs = (JSLocalRootStack *) JS_malloc(cx, sizeof *lrs);
        if (!lrs)
            return JS_FALSE;
        lrs->scopeMark = JSLRS_NULL_MARK;
        lrs->rootCount = 0;
        lrs->topChunk = &lrs->firstChunk;
        lrs->firstChunk.down = NULL;
        cx->localRootStack = lrs;
    }

    /* Push lrs->scopeMark to save it for restore when leaving. */
    mark = js_PushLocalRoot(cx, lrs, INT_TO_JSVAL(lrs->scopeMark));
    if (mark < 0)
        return JS_FALSE;
    lrs->scopeMark = (uint32) mark;
    return JS_TRUE;
}

void
js_LeaveLocalRootScopeWithResult(JSContext *cx, jsval rval)
{
    JSLocalRootStack *lrs;
    uint32 mark, m, n;
    JSLocalRootChunk *lrc;

    /* Defend against buggy native callers. */
    lrs = cx->localRootStack;
    JS_ASSERT(lrs && lrs->rootCount != 0);
    if (!lrs || lrs->rootCount == 0)
        return;

    mark = lrs->scopeMark;
    JS_ASSERT(mark != JSLRS_NULL_MARK);
    if (mark == JSLRS_NULL_MARK)
        return;

    /* Free any chunks being popped by this leave operation. */
    m = mark >> JSLRS_CHUNK_SHIFT;
    n = (lrs->rootCount - 1) >> JSLRS_CHUNK_SHIFT;
    while (n > m) {
        lrc = lrs->topChunk;
        JS_ASSERT(lrc != &lrs->firstChunk);
        lrs->topChunk = lrc->down;
        JS_free(cx, lrc);
        --n;
    }

    /*
     * Pop the scope, restoring lrs->scopeMark.  If rval is a GC-thing, push
     * it on the caller's scope, or store it in lastInternalResult if we are
     * leaving the outermost scope.  We don't need to allocate a new lrc
     * because we can overwrite the old mark's slot with rval.
     */
    lrc = lrs->topChunk;
    m = mark & JSLRS_CHUNK_MASK;
    lrs->scopeMark = (uint32) JSVAL_TO_INT(lrc->roots[m]);
    if (JSVAL_IS_GCTHING(rval) && !JSVAL_IS_NULL(rval)) {
        if (mark == 0) {
            cx->weakRoots.lastInternalResult = rval;
        } else {
            /*
             * Increment m to avoid the "else if (m == 0)" case below.  If
             * rval is not a GC-thing, that case would take care of freeing
             * any chunk that contained only the old mark.  Since rval *is*
             * a GC-thing here, we want to reuse that old mark's slot.
             */
            lrc->roots[m++] = rval;
            ++mark;
        }
    }
    lrs->rootCount = (uint32) mark;

    /*
     * Free the stack eagerly, risking malloc churn.  The alternative would
     * require an lrs->entryCount member, maintained by Enter and Leave, and
     * tested by the GC in addition to the cx->localRootStack non-null test.
     *
     * That approach would risk hoarding 264 bytes (net) per context.  Right
     * now it seems better to give fresh (dirty in CPU write-back cache, and
     * the data is no longer needed) memory back to the malloc heap.
     */
    if (mark == 0) {
        cx->localRootStack = NULL;
        JS_free(cx, lrs);
    } else if (m == 0) {
        lrs->topChunk = lrc->down;
        JS_free(cx, lrc);
    }
}

void
js_ForgetLocalRoot(JSContext *cx, jsval v)
{
    JSLocalRootStack *lrs;
    uint32 i, j, m, n, mark;
    JSLocalRootChunk *lrc, *lrc2;
    jsval top;

    lrs = cx->localRootStack;
    JS_ASSERT(lrs && lrs->rootCount);
    if (!lrs || lrs->rootCount == 0)
        return;

    /* Prepare to pop the top-most value from the stack. */
    n = lrs->rootCount - 1;
    m = n & JSLRS_CHUNK_MASK;
    lrc = lrs->topChunk;
    top = lrc->roots[m];

    /* Be paranoid about calls on an empty scope. */
    mark = lrs->scopeMark;
    JS_ASSERT(mark < n);
    if (mark >= n)
        return;

    /* If v was not the last root pushed in the top scope, find it. */
    if (top != v) {
        /* Search downward in case v was recently pushed. */
        i = n;
        j = m;
        lrc2 = lrc;
        while (--i > mark) {
            if (j == 0)
                lrc2 = lrc2->down;
            j = i & JSLRS_CHUNK_MASK;
            if (lrc2->roots[j] == v)
                break;
        }

        /* If we didn't find v in this scope, assert and bail out. */
        JS_ASSERT(i != mark);
        if (i == mark)
            return;

        /* Swap top and v so common tail code can pop v. */
        lrc2->roots[j] = top;
    }

    /* Pop the last value from the stack. */
    lrc->roots[m] = JSVAL_NULL;
    lrs->rootCount = n;
    if (m == 0) {
        JS_ASSERT(n != 0);
        JS_ASSERT(lrc != &lrs->firstChunk);
        lrs->topChunk = lrc->down;
        JS_free(cx, lrc);
    }
}

int
js_PushLocalRoot(JSContext *cx, JSLocalRootStack *lrs, jsval v)
{
    uint32 n, m;
    JSLocalRootChunk *lrc;

    n = lrs->rootCount;
    m = n & JSLRS_CHUNK_MASK;
    if (n == 0 || m != 0) {
        /*
         * At start of first chunk, or not at start of a non-first top chunk.
         * Check for lrs->rootCount overflow.
         */
        if ((uint32)(n + 1) == 0) {
            JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                                 JSMSG_TOO_MANY_LOCAL_ROOTS);
            return -1;
        }
        lrc = lrs->topChunk;
        JS_ASSERT(n != 0 || lrc == &lrs->firstChunk);
    } else {
        /*
         * After lrs->firstChunk, trying to index at a power-of-two chunk
         * boundary: need a new chunk.
         */
        lrc = (JSLocalRootChunk *) JS_malloc(cx, sizeof *lrc);
        if (!lrc)
            return -1;
        lrc->down = lrs->topChunk;
        lrs->topChunk = lrc;
    }
    lrs->rootCount = n + 1;
    lrc->roots[m] = v;
    return (int) n;
}

void
js_TraceLocalRoots(JSTracer *trc, JSLocalRootStack *lrs)
{
    uint32 n, m, mark;
    JSLocalRootChunk *lrc;
    jsval v;

    n = lrs->rootCount;
    if (n == 0)
        return;

    mark = lrs->scopeMark;
    lrc = lrs->topChunk;
    do {
        while (--n > mark) {
            m = n & JSLRS_CHUNK_MASK;
            v = lrc->roots[m];
            JS_ASSERT(JSVAL_IS_GCTHING(v) && v != JSVAL_NULL);
            JS_SET_TRACING_INDEX(trc, "local_root", n);
            js_CallValueTracerIfGCThing(trc, v);
            if (m == 0)
                lrc = lrc->down;
        }
        m = n & JSLRS_CHUNK_MASK;
        mark = JSVAL_TO_INT(lrc->roots[m]);
        if (m == 0)
            lrc = lrc->down;
    } while (n != 0);
    JS_ASSERT(!lrc);
}

static void
ReportError(JSContext *cx, const char *message, JSErrorReport *reportp)
{
    /*
     * Check the error report, and set a JavaScript-catchable exception
     * if the error is defined to have an associated exception.  If an
     * exception is thrown, then the JSREPORT_EXCEPTION flag will be set
     * on the error report, and exception-aware hosts should ignore it.
     */
    JS_ASSERT(reportp);
    if (reportp->errorNumber == JSMSG_UNCAUGHT_EXCEPTION)
        reportp->flags |= JSREPORT_EXCEPTION;

    /*
     * Call the error reporter only if an exception wasn't raised.
     *
     * If an exception was raised, then we call the debugErrorHook
     * (if present) to give it a chance to see the error before it
     * propagates out of scope.  This is needed for compatability
     * with the old scheme.
     */
    if (!cx->fp || !js_ErrorToException(cx, message, reportp)) {
        js_ReportErrorAgain(cx, message, reportp);
    } else if (cx->debugHooks->debugErrorHook && cx->errorReporter) {
        JSDebugErrorHook hook = cx->debugHooks->debugErrorHook;
        /* test local in case debugErrorHook changed on another thread */
        if (hook)
            hook(cx, message, reportp, cx->debugHooks->debugErrorHookData);
    }
}

/*
 * We don't post an exception in this case, since doing so runs into
 * complications of pre-allocating an exception object which required
 * running the Exception class initializer early etc.
 * Instead we just invoke the errorReporter with an "Out Of Memory"
 * type message, and then hope the process ends swiftly.
 */
void
js_ReportOutOfMemory(JSContext *cx)
{
    JSStackFrame *fp;
    JSErrorReport report;
    JSErrorReporter onError = cx->errorReporter;

    /* Get the message for this error, but we won't expand any arguments. */
    const JSErrorFormatString *efs =
        js_GetLocalizedErrorMessage(cx, NULL, NULL, JSMSG_OUT_OF_MEMORY);
    const char *msg = efs ? efs->format : "Out of memory";

    /* Fill out the report, but don't do anything that requires allocation. */
    memset(&report, 0, sizeof (struct JSErrorReport));
    report.flags = JSREPORT_ERROR;
    report.errorNumber = JSMSG_OUT_OF_MEMORY;

    /*
     * Walk stack until we find a frame that is associated with some script
     * rather than a native frame.
     */
    for (fp = cx->fp; fp; fp = fp->down) {
        if (fp->regs) {
            report.filename = fp->script->filename;
            report.lineno = js_FramePCToLineNumber(cx, fp);
            break;
        }
    }

    /*
     * If debugErrorHook is present then we give it a chance to veto sending
     * the error on to the regular ErrorReporter. We also clear a pending
     * exception if any now so the hooks can replace the out-of-memory error
     * by a script-catchable exception.
     */
    cx->throwing = JS_FALSE;
    if (onError) {
        JSDebugErrorHook hook = cx->debugHooks->debugErrorHook;
        if (hook &&
            !hook(cx, msg, &report, cx->debugHooks->debugErrorHookData)) {
            onError = NULL;
        }
    }

    if (onError)
        onError(cx, msg, &report);
}

void
js_ReportOutOfScriptQuota(JSContext *cx)
{
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_SCRIPT_STACK_QUOTA);
}

void
js_ReportOverRecursed(JSContext *cx)
{
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_OVER_RECURSED);
}

void
js_ReportAllocationOverflow(JSContext *cx)
{
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_ALLOC_OVERFLOW);
}

JSBool
js_ReportErrorVA(JSContext *cx, uintN flags, const char *format, va_list ap)
{
    char *message;
    jschar *ucmessage;
    size_t messagelen;
    JSStackFrame *fp;
    JSErrorReport report;
    JSBool warning;

    if ((flags & JSREPORT_STRICT) && !JS_HAS_STRICT_OPTION(cx))
        return JS_TRUE;

    message = JS_vsmprintf(format, ap);
    if (!message)
        return JS_FALSE;
    messagelen = strlen(message);

    memset(&report, 0, sizeof (struct JSErrorReport));
    report.flags = flags;
    report.errorNumber = JSMSG_USER_DEFINED_ERROR;
    report.ucmessage = ucmessage = js_InflateString(cx, message, &messagelen);

    /* Find the top-most active script frame, for best line number blame. */
    for (fp = cx->fp; fp; fp = fp->down) {
        if (fp->regs) {
            report.filename = fp->script->filename;
            report.lineno = js_FramePCToLineNumber(cx, fp);
            break;
        }
    }

    warning = JSREPORT_IS_WARNING(report.flags);
    if (warning && JS_HAS_WERROR_OPTION(cx)) {
        report.flags &= ~JSREPORT_WARNING;
        warning = JS_FALSE;
    }

    ReportError(cx, message, &report);
    free(message);
    JS_free(cx, ucmessage);
    return warning;
}

/*
 * The arguments from ap need to be packaged up into an array and stored
 * into the report struct.
 *
 * The format string addressed by the error number may contain operands
 * identified by the format {N}, where N is a decimal digit. Each of these
 * is to be replaced by the Nth argument from the va_list. The complete
 * message is placed into reportp->ucmessage converted to a JSString.
 *
 * Returns true if the expansion succeeds (can fail if out of memory).
 */
JSBool
js_ExpandErrorArguments(JSContext *cx, JSErrorCallback callback,
                        void *userRef, const uintN errorNumber,
                        char **messagep, JSErrorReport *reportp,
                        JSBool *warningp, JSBool charArgs, va_list ap)
{
    const JSErrorFormatString *efs;
    int i;
    int argCount;

    *warningp = JSREPORT_IS_WARNING(reportp->flags);
    if (*warningp && JS_HAS_WERROR_OPTION(cx)) {
        reportp->flags &= ~JSREPORT_WARNING;
        *warningp = JS_FALSE;
    }

    *messagep = NULL;

    /* Most calls supply js_GetErrorMessage; if this is so, assume NULL. */
    if (!callback || callback == js_GetErrorMessage)
        efs = js_GetLocalizedErrorMessage(cx, userRef, NULL, errorNumber);
    else
        efs = callback(userRef, NULL, errorNumber);
    if (efs) {
        size_t totalArgsLength = 0;
        size_t argLengths[10]; /* only {0} thru {9} supported */
        argCount = efs->argCount;
        JS_ASSERT(argCount <= 10);
        if (argCount > 0) {
            /*
             * Gather the arguments into an array, and accumulate
             * their sizes. We allocate 1 more than necessary and
             * null it out to act as the caboose when we free the
             * pointers later.
             */
            reportp->messageArgs = (const jschar **)
                JS_malloc(cx, sizeof(jschar *) * (argCount + 1));
            if (!reportp->messageArgs)
                return JS_FALSE;
            reportp->messageArgs[argCount] = NULL;
            for (i = 0; i < argCount; i++) {
                if (charArgs) {
                    char *charArg = va_arg(ap, char *);
                    size_t charArgLength = strlen(charArg);
                    reportp->messageArgs[i]
                        = js_InflateString(cx, charArg, &charArgLength);
                    if (!reportp->messageArgs[i])
                        goto error;
                } else {
                    reportp->messageArgs[i] = va_arg(ap, jschar *);
                }
                argLengths[i] = js_strlen(reportp->messageArgs[i]);
                totalArgsLength += argLengths[i];
            }
            /* NULL-terminate for easy copying. */
            reportp->messageArgs[i] = NULL;
        }
        /*
         * Parse the error format, substituting the argument X
         * for {X} in the format.
         */
        if (argCount > 0) {
            if (efs->format) {
                jschar *buffer, *fmt, *out;
                int expandedArgs = 0;
                size_t expandedLength;
                size_t len = strlen(efs->format);

                buffer = fmt = js_InflateString (cx, efs->format, &len);
                if (!buffer)
                    goto error;
                expandedLength = len
                                 - (3 * argCount)       /* exclude the {n} */
                                 + totalArgsLength;

                /*
                * Note - the above calculation assumes that each argument
                * is used once and only once in the expansion !!!
                */
                reportp->ucmessage = out = (jschar *)
                    JS_malloc(cx, (expandedLength + 1) * sizeof(jschar));
                if (!out) {
                    JS_free (cx, buffer);
                    goto error;
                }
                while (*fmt) {
                    if (*fmt == '{') {
                        if (isdigit(fmt[1])) {
                            int d = JS7_UNDEC(fmt[1]);
                            JS_ASSERT(d < argCount);
                            js_strncpy(out, reportp->messageArgs[d],
                                       argLengths[d]);
                            out += argLengths[d];
                            fmt += 3;
                            expandedArgs++;
                            continue;
                        }
                    }
                    *out++ = *fmt++;
                }
                JS_ASSERT(expandedArgs == argCount);
                *out = 0;
                JS_free (cx, buffer);
                *messagep =
                    js_DeflateString(cx, reportp->ucmessage,
                                     (size_t)(out - reportp->ucmessage));
                if (!*messagep)
                    goto error;
            }
        } else {
            /*
             * Zero arguments: the format string (if it exists) is the
             * entire message.
             */
            if (efs->format) {
                size_t len;
                *messagep = JS_strdup(cx, efs->format);
                if (!*messagep)
                    goto error;
                len = strlen(*messagep);
                reportp->ucmessage = js_InflateString(cx, *messagep, &len);
                if (!reportp->ucmessage)
                    goto error;
            }
        }
    }
    if (*messagep == NULL) {
        /* where's the right place for this ??? */
        const char *defaultErrorMessage
            = "No error message available for error number %d";
        size_t nbytes = strlen(defaultErrorMessage) + 16;
        *messagep = (char *)JS_malloc(cx, nbytes);
        if (!*messagep)
            goto error;
        JS_snprintf(*messagep, nbytes, defaultErrorMessage, errorNumber);
    }
    return JS_TRUE;

error:
    if (reportp->messageArgs) {
        /* free the arguments only if we allocated them */
        if (charArgs) {
            i = 0;
            while (reportp->messageArgs[i])
                JS_free(cx, (void *)reportp->messageArgs[i++]);
        }
        JS_free(cx, (void *)reportp->messageArgs);
        reportp->messageArgs = NULL;
    }
    if (reportp->ucmessage) {
        JS_free(cx, (void *)reportp->ucmessage);
        reportp->ucmessage = NULL;
    }
    if (*messagep) {
        JS_free(cx, (void *)*messagep);
        *messagep = NULL;
    }
    return JS_FALSE;
}

JSBool
js_ReportErrorNumberVA(JSContext *cx, uintN flags, JSErrorCallback callback,
                       void *userRef, const uintN errorNumber,
                       JSBool charArgs, va_list ap)
{
    JSStackFrame *fp;
    JSErrorReport report;
    char *message;
    JSBool warning;

    if ((flags & JSREPORT_STRICT) && !JS_HAS_STRICT_OPTION(cx))
        return JS_TRUE;

    memset(&report, 0, sizeof (struct JSErrorReport));
    report.flags = flags;
    report.errorNumber = errorNumber;

    /*
     * If we can't find out where the error was based on the current frame,
     * see if the next frame has a script/pc combo we can use.
     */
    for (fp = cx->fp; fp; fp = fp->down) {
        if (fp->regs) {
            report.filename = fp->script->filename;
            report.lineno = js_FramePCToLineNumber(cx, fp);
            break;
        }
    }

    if (!js_ExpandErrorArguments(cx, callback, userRef, errorNumber,
                                 &message, &report, &warning, charArgs, ap)) {
        return JS_FALSE;
    }

    ReportError(cx, message, &report);

    if (message)
        JS_free(cx, message);
    if (report.messageArgs) {
        /*
         * js_ExpandErrorArguments owns its messageArgs only if it had to
         * inflate the arguments (from regular |char *|s).
         */
        if (charArgs) {
            int i = 0;
            while (report.messageArgs[i])
                JS_free(cx, (void *)report.messageArgs[i++]);
        }
        JS_free(cx, (void *)report.messageArgs);
    }
    if (report.ucmessage)
        JS_free(cx, (void *)report.ucmessage);

    return warning;
}

JS_FRIEND_API(void)
js_ReportErrorAgain(JSContext *cx, const char *message, JSErrorReport *reportp)
{
    JSErrorReporter onError;

    if (!message)
        return;

    if (cx->lastMessage)
        free(cx->lastMessage);
    cx->lastMessage = JS_strdup(cx, message);
    if (!cx->lastMessage)
        return;
    onError = cx->errorReporter;

    /*
     * If debugErrorHook is present then we give it a chance to veto
     * sending the error on to the regular ErrorReporter.
     */
    if (onError) {
        JSDebugErrorHook hook = cx->debugHooks->debugErrorHook;
        if (hook &&
            !hook(cx, cx->lastMessage, reportp,
                  cx->debugHooks->debugErrorHookData)) {
            onError = NULL;
        }
    }
    if (onError)
        onError(cx, cx->lastMessage, reportp);
}

void
js_ReportIsNotDefined(JSContext *cx, const char *name)
{
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_NOT_DEFINED, name);
}

JSBool
js_ReportIsNullOrUndefined(JSContext *cx, intN spindex, jsval v,
                           JSString *fallback)
{
    char *bytes;
    JSBool ok;

    bytes = js_DecompileValueGenerator(cx, spindex, v, fallback);
    if (!bytes)
        return JS_FALSE;

    if (strcmp(bytes, js_undefined_str) == 0 ||
        strcmp(bytes, js_null_str) == 0) {
        ok = JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                          js_GetErrorMessage, NULL,
                                          JSMSG_NO_PROPERTIES, bytes,
                                          NULL, NULL);
    } else if (JSVAL_IS_VOID(v)) {
        ok = JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                          js_GetErrorMessage, NULL,
                                          JSMSG_NULL_OR_UNDEFINED, bytes,
                                          js_undefined_str, NULL);
    } else {
        JS_ASSERT(JSVAL_IS_NULL(v));
        ok = JS_ReportErrorFlagsAndNumber(cx, JSREPORT_ERROR,
                                          js_GetErrorMessage, NULL,
                                          JSMSG_NULL_OR_UNDEFINED, bytes,
                                          js_null_str, NULL);
    }

    JS_free(cx, bytes);
    return ok;
}

void
js_ReportMissingArg(JSContext *cx, jsval *vp, uintN arg)
{
    char argbuf[11];
    char *bytes;
    JSAtom *atom;

    JS_snprintf(argbuf, sizeof argbuf, "%u", arg);
    bytes = NULL;
    if (VALUE_IS_FUNCTION(cx, *vp)) {
        atom = GET_FUNCTION_PRIVATE(cx, JSVAL_TO_OBJECT(*vp))->atom;
        bytes = js_DecompileValueGenerator(cx, JSDVG_SEARCH_STACK, *vp,
                                           ATOM_TO_STRING(atom));
        if (!bytes)
            return;
    }
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,
                         JSMSG_MISSING_FUN_ARG, argbuf,
                         bytes ? bytes : "");
    JS_free(cx, bytes);
}

JSBool
js_ReportValueErrorFlags(JSContext *cx, uintN flags, const uintN errorNumber,
                         intN spindex, jsval v, JSString *fallback,
                         const char *arg1, const char *arg2)
{
    char *bytes;
    JSBool ok;

    JS_ASSERT(js_ErrorFormatString[errorNumber].argCount >= 1);
    JS_ASSERT(js_ErrorFormatString[errorNumber].argCount <= 3);
    bytes = js_DecompileValueGenerator(cx, spindex, v, fallback);
    if (!bytes)
        return JS_FALSE;

    ok = JS_ReportErrorFlagsAndNumber(cx, flags, js_GetErrorMessage,
                                      NULL, errorNumber, bytes, arg1, arg2);
    JS_free(cx, bytes);
    return ok;
}

#if defined DEBUG && defined XP_UNIX
/* For gdb usage. */
void js_traceon(JSContext *cx)  { cx->tracefp = stderr; }
void js_traceoff(JSContext *cx) { cx->tracefp = NULL; }
#endif

JSErrorFormatString js_ErrorFormatString[JSErr_Limit] = {
#define MSG_DEF(name, number, count, exception, format) \
    { format, count, exception } ,
#include "js.msg"
#undef MSG_DEF
};

JS_FRIEND_API(const JSErrorFormatString *)
js_GetErrorMessage(void *userRef, const char *locale, const uintN errorNumber)
{
    if ((errorNumber > 0) && (errorNumber < JSErr_Limit))
        return &js_ErrorFormatString[errorNumber];
    return NULL;
}

JSBool
js_ResetOperationCount(JSContext *cx)
{
    JSScript *script;

    JS_ASSERT(cx->operationCount <= 0);
    JS_ASSERT(cx->operationLimit > 0);

    cx->operationCount = (int32) cx->operationLimit;
    if (cx->operationCallbackIsSet)
        return cx->operationCallback(cx);

    if (cx->operationCallback) {
        /*
         * Invoke the deprecated branch callback. It may be called only when
         * the top-most frame is scripted or JSOPTION_NATIVE_BRANCH_CALLBACK
         * is set.
         */
        script = cx->fp ? cx->fp->script : NULL;
        if (script || JS_HAS_OPTION(cx, JSOPTION_NATIVE_BRANCH_CALLBACK))
            return ((JSBranchCallback) cx->operationCallback)(cx, script);
    }
    return JS_TRUE;
}
