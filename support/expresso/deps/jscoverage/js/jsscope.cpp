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

/*
 * JS symbol tables.
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsarena.h"
#include "jsbit.h"
#include "jsclist.h"
#include "jsdhash.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jsapi.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsdbgapi.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsscope.h"
#include "jsstr.h"

JSScope *
js_GetMutableScope(JSContext *cx, JSObject *obj)
{
    JSScope *scope, *newscope;
    JSClass *clasp;
    uint32 freeslot;

    scope = OBJ_SCOPE(obj);
    JS_ASSERT(JS_IS_SCOPE_LOCKED(cx, scope));
    if (scope->object == obj)
        return scope;
    newscope = js_NewScope(cx, 0, scope->map.ops, LOCKED_OBJ_GET_CLASS(obj),
                           obj);
    if (!newscope)
        return NULL;
    JS_LOCK_SCOPE(cx, newscope);
    obj->map = js_HoldObjectMap(cx, &newscope->map);
    JS_ASSERT(newscope->map.freeslot == JSSLOT_FREE(STOBJ_GET_CLASS(obj)));
    clasp = STOBJ_GET_CLASS(obj);
    if (clasp->reserveSlots) {
        freeslot = JSSLOT_FREE(clasp) + clasp->reserveSlots(cx, obj);
        if (freeslot > STOBJ_NSLOTS(obj))
            freeslot = STOBJ_NSLOTS(obj);
        if (newscope->map.freeslot < freeslot)
            newscope->map.freeslot = freeslot;
    }
    scope = (JSScope *) js_DropObjectMap(cx, &scope->map, obj);
    JS_TRANSFER_SCOPE_LOCK(cx, scope, newscope);
    return newscope;
}

/*
 * JSScope uses multiplicative hashing, _a la_ jsdhash.[ch], but specialized
 * to minimize footprint.  But if a scope has fewer than SCOPE_HASH_THRESHOLD
 * entries, we use linear search and avoid allocating scope->table.
 */
#define SCOPE_HASH_THRESHOLD    6
#define MIN_SCOPE_SIZE_LOG2     4
#define MIN_SCOPE_SIZE          JS_BIT(MIN_SCOPE_SIZE_LOG2)
#define SCOPE_TABLE_NBYTES(n)   ((n) * sizeof(JSScopeProperty *))

static void
InitMinimalScope(JSScope *scope)
{
    scope->shape = 0;
    scope->hashShift = JS_DHASH_BITS - MIN_SCOPE_SIZE_LOG2;
    scope->entryCount = scope->removedCount = 0;
    scope->table = NULL;
    scope->lastProp = NULL;
}

static JSBool
CreateScopeTable(JSContext *cx, JSScope *scope, JSBool report)
{
    int sizeLog2;
    JSScopeProperty *sprop, **spp;

    JS_ASSERT(!scope->table);
    JS_ASSERT(scope->lastProp);

    if (scope->entryCount > SCOPE_HASH_THRESHOLD) {
        /*
         * Either we're creating a table for a large scope that was populated
         * via property cache hit logic under JSOP_INITPROP, JSOP_SETNAME, or
         * JSOP_SETPROP; or else calloc failed at least once already. In any
         * event, let's try to grow, overallocating to hold at least twice the
         * current population.
         */
        sizeLog2 = JS_CeilingLog2(2 * scope->entryCount);
        scope->hashShift = JS_DHASH_BITS - sizeLog2;
    } else {
        JS_ASSERT(scope->hashShift == JS_DHASH_BITS - MIN_SCOPE_SIZE_LOG2);
        sizeLog2 = MIN_SCOPE_SIZE_LOG2;
    }

    scope->table = (JSScopeProperty **)
        calloc(JS_BIT(sizeLog2), sizeof(JSScopeProperty *));
    if (!scope->table) {
        if (report)
            JS_ReportOutOfMemory(cx);
        return JS_FALSE;
    }
    js_UpdateMallocCounter(cx, JS_BIT(sizeLog2) * sizeof(JSScopeProperty *));

    scope->hashShift = JS_DHASH_BITS - sizeLog2;
    for (sprop = scope->lastProp; sprop; sprop = sprop->parent) {
        spp = js_SearchScope(scope, sprop->id, JS_TRUE);
        SPROP_STORE_PRESERVING_COLLISION(spp, sprop);
    }
    return JS_TRUE;
}

JSScope *
js_NewScope(JSContext *cx, jsrefcount nrefs, JSObjectOps *ops, JSClass *clasp,
            JSObject *obj)
{
    JSScope *scope;

    scope = (JSScope *) JS_malloc(cx, sizeof(JSScope));
    if (!scope)
        return NULL;

    js_InitObjectMap(&scope->map, nrefs, ops, clasp);
    scope->object = obj;
    scope->flags = 0;
    InitMinimalScope(scope);

#ifdef JS_THREADSAFE
    js_InitTitle(cx, &scope->title);
#endif
    JS_RUNTIME_METER(cx->runtime, liveScopes);
    JS_RUNTIME_METER(cx->runtime, totalScopes);
    return scope;
}

#ifdef DEBUG_SCOPE_COUNT
extern void
js_unlog_scope(JSScope *scope);
#endif

#if defined DEBUG || defined JS_DUMP_PROPTREE_STATS
# include "jsprf.h"
# define LIVE_SCOPE_METER(cx,expr) JS_LOCK_RUNTIME_VOID(cx->runtime,expr)
#else
# define LIVE_SCOPE_METER(cx,expr) /* nothing */
#endif

void
js_DestroyScope(JSContext *cx, JSScope *scope)
{
#ifdef DEBUG_SCOPE_COUNT
    js_unlog_scope(scope);
#endif

#ifdef JS_THREADSAFE
    js_FinishTitle(cx, &scope->title);
#endif
    if (scope->table)
        JS_free(cx, scope->table);

    LIVE_SCOPE_METER(cx, cx->runtime->liveScopeProps -= scope->entryCount);
    JS_RUNTIME_UNMETER(cx->runtime, liveScopes);
    JS_free(cx, scope);
}

#ifdef JS_DUMP_PROPTREE_STATS
typedef struct JSScopeStats {
    jsrefcount          searches;
    jsrefcount          hits;
    jsrefcount          misses;
    jsrefcount          hashes;
    jsrefcount          steps;
    jsrefcount          stepHits;
    jsrefcount          stepMisses;
    jsrefcount          adds;
    jsrefcount          redundantAdds;
    jsrefcount          addFailures;
    jsrefcount          changeFailures;
    jsrefcount          compresses;
    jsrefcount          grows;
    jsrefcount          removes;
    jsrefcount          removeFrees;
    jsrefcount          uselessRemoves;
    jsrefcount          shrinks;
} JSScopeStats;

JS_FRIEND_DATA(JSScopeStats) js_scope_stats = {0};

# define METER(x)       JS_ATOMIC_INCREMENT(&js_scope_stats.x)
#else
# define METER(x)       /* nothing */
#endif

JS_STATIC_ASSERT(sizeof(JSHashNumber) == 4);
JS_STATIC_ASSERT(sizeof(jsid) == JS_BYTES_PER_WORD);

#if JS_BYTES_PER_WORD == 4
# define HASH_ID(id) ((JSHashNumber)(id))
#elif JS_BYTES_PER_WORD == 8
# define HASH_ID(id) ((JSHashNumber)(id) ^ (JSHashNumber)((id) >> 32))
#else
# error "Unsupported configuration"
#endif

/*
 * Double hashing needs the second hash code to be relatively prime to table
 * size, so we simply make hash2 odd.  The inputs to multiplicative hash are
 * the golden ratio, expressed as a fixed-point 32 bit fraction, and the id
 * itself.
 */
#define SCOPE_HASH0(id)                 (HASH_ID(id) * JS_GOLDEN_RATIO)
#define SCOPE_HASH1(hash0,shift)        ((hash0) >> (shift))
#define SCOPE_HASH2(hash0,log2,shift)   ((((hash0) << (log2)) >> (shift)) | 1)

JS_FRIEND_API(JSScopeProperty **)
js_SearchScope(JSScope *scope, jsid id, JSBool adding)
{
    JSHashNumber hash0, hash1, hash2;
    int hashShift, sizeLog2;
    JSScopeProperty *stored, *sprop, **spp, **firstRemoved;
    uint32 sizeMask;

    METER(searches);
    if (!scope->table) {
        /* Not enough properties to justify hashing: search from lastProp. */
        JS_ASSERT(!SCOPE_HAD_MIDDLE_DELETE(scope));
        for (spp = &scope->lastProp; (sprop = *spp); spp = &sprop->parent) {
            if (sprop->id == id) {
                METER(hits);
                return spp;
            }
        }
        METER(misses);
        return spp;
    }

    /* Compute the primary hash address. */
    METER(hashes);
    hash0 = SCOPE_HASH0(id);
    hashShift = scope->hashShift;
    hash1 = SCOPE_HASH1(hash0, hashShift);
    spp = scope->table + hash1;

    /* Miss: return space for a new entry. */
    stored = *spp;
    if (SPROP_IS_FREE(stored)) {
        METER(misses);
        return spp;
    }

    /* Hit: return entry. */
    sprop = SPROP_CLEAR_COLLISION(stored);
    if (sprop && sprop->id == id) {
        METER(hits);
        return spp;
    }

    /* Collision: double hash. */
    sizeLog2 = JS_DHASH_BITS - hashShift;
    hash2 = SCOPE_HASH2(hash0, sizeLog2, hashShift);
    sizeMask = JS_BITMASK(sizeLog2);

    /* Save the first removed entry pointer so we can recycle it if adding. */
    if (SPROP_IS_REMOVED(stored)) {
        firstRemoved = spp;
    } else {
        firstRemoved = NULL;
        if (adding && !SPROP_HAD_COLLISION(stored))
            SPROP_FLAG_COLLISION(spp, sprop);
    }

    for (;;) {
        METER(steps);
        hash1 -= hash2;
        hash1 &= sizeMask;
        spp = scope->table + hash1;

        stored = *spp;
        if (SPROP_IS_FREE(stored)) {
            METER(stepMisses);
            return (adding && firstRemoved) ? firstRemoved : spp;
        }

        sprop = SPROP_CLEAR_COLLISION(stored);
        if (sprop && sprop->id == id) {
            METER(stepHits);
            return spp;
        }

        if (SPROP_IS_REMOVED(stored)) {
            if (!firstRemoved)
                firstRemoved = spp;
        } else {
            if (adding && !SPROP_HAD_COLLISION(stored))
                SPROP_FLAG_COLLISION(spp, sprop);
        }
    }

    /* NOTREACHED */
    return NULL;
}

static JSBool
ChangeScope(JSContext *cx, JSScope *scope, int change)
{
    int oldlog2, newlog2;
    uint32 oldsize, newsize, nbytes;
    JSScopeProperty **table, **oldtable, **spp, **oldspp, *sprop;

    if (!scope->table)
        return CreateScopeTable(cx, scope, JS_TRUE);

    /* Grow, shrink, or compress by changing scope->table. */
    oldlog2 = JS_DHASH_BITS - scope->hashShift;
    newlog2 = oldlog2 + change;
    oldsize = JS_BIT(oldlog2);
    newsize = JS_BIT(newlog2);
    nbytes = SCOPE_TABLE_NBYTES(newsize);
    table = (JSScopeProperty **) calloc(nbytes, 1);
    if (!table) {
        JS_ReportOutOfMemory(cx);
        return JS_FALSE;
    }

    /* Now that we have a new table allocated, update scope members. */
    scope->hashShift = JS_DHASH_BITS - newlog2;
    scope->removedCount = 0;
    oldtable = scope->table;
    scope->table = table;

    /* Treat the above calloc as a JS_malloc, to match CreateScopeTable. */
    cx->runtime->gcMallocBytes += nbytes;

    /* Copy only live entries, leaving removed and free ones behind. */
    for (oldspp = oldtable; oldsize != 0; oldspp++) {
        sprop = SPROP_FETCH(oldspp);
        if (sprop) {
            spp = js_SearchScope(scope, sprop->id, JS_TRUE);
            JS_ASSERT(SPROP_IS_FREE(*spp));
            *spp = sprop;
        }
        oldsize--;
    }

    /* Finally, free the old table storage. */
    JS_free(cx, oldtable);
    return JS_TRUE;
}

/*
 * Take care to exclude the mark bits in case we're called from the GC.
 */
#define SPROP_FLAGS_NOT_MATCHED (SPROP_MARK | SPROP_FLAG_SHAPE_REGEN)

static JSDHashNumber
js_HashScopeProperty(JSDHashTable *table, const void *key)
{
    const JSScopeProperty *sprop = (const JSScopeProperty *)key;
    JSDHashNumber hash;
    JSPropertyOp gsop;

    /* Accumulate from least to most random so the low bits are most random. */
    hash = 0;
    gsop = sprop->getter;
    if (gsop)
        hash = JS_ROTATE_LEFT32(hash, 4) ^ (jsword)gsop;
    gsop = sprop->setter;
    if (gsop)
        hash = JS_ROTATE_LEFT32(hash, 4) ^ (jsword)gsop;

    hash = JS_ROTATE_LEFT32(hash, 4)
           ^ (sprop->flags & ~SPROP_FLAGS_NOT_MATCHED);

    hash = JS_ROTATE_LEFT32(hash, 4) ^ sprop->attrs;
    hash = JS_ROTATE_LEFT32(hash, 4) ^ sprop->shortid;
    hash = JS_ROTATE_LEFT32(hash, 4) ^ sprop->slot;
    hash = JS_ROTATE_LEFT32(hash, 4) ^ sprop->id;
    return hash;
}

#define SPROP_MATCH(sprop, child)                                             \
    SPROP_MATCH_PARAMS(sprop, (child)->id, (child)->getter, (child)->setter,  \
                       (child)->slot, (child)->attrs, (child)->flags,         \
                       (child)->shortid)

#define SPROP_MATCH_PARAMS(sprop, aid, agetter, asetter, aslot, aattrs,       \
                           aflags, ashortid)                                  \
    ((sprop)->id == (aid) &&                                                  \
     SPROP_MATCH_PARAMS_AFTER_ID(sprop, agetter, asetter, aslot, aattrs,      \
                                 aflags, ashortid))

#define SPROP_MATCH_PARAMS_AFTER_ID(sprop, agetter, asetter, aslot, aattrs,   \
                                    aflags, ashortid)                         \
    ((sprop)->getter == (agetter) &&                                          \
     (sprop)->setter == (asetter) &&                                          \
     (sprop)->slot == (aslot) &&                                              \
     (sprop)->attrs == (aattrs) &&                                            \
     (((sprop)->flags ^ (aflags)) & ~SPROP_FLAGS_NOT_MATCHED) == 0 &&         \
     (sprop)->shortid == (ashortid))

static JSBool
js_MatchScopeProperty(JSDHashTable *table,
                      const JSDHashEntryHdr *hdr,
                      const void *key)
{
    const JSPropertyTreeEntry *entry = (const JSPropertyTreeEntry *)hdr;
    const JSScopeProperty *sprop = entry->child;
    const JSScopeProperty *kprop = (const JSScopeProperty *)key;

    return SPROP_MATCH(sprop, kprop);
}

static const JSDHashTableOps PropertyTreeHashOps = {
    JS_DHashAllocTable,
    JS_DHashFreeTable,
    js_HashScopeProperty,
    js_MatchScopeProperty,
    JS_DHashMoveEntryStub,
    JS_DHashClearEntryStub,
    JS_DHashFinalizeStub,
    NULL
};

/*
 * A property tree node on rt->propertyFreeList overlays the following prefix
 * struct on JSScopeProperty.
 */
typedef struct FreeNode {
    jsid                id;
    JSScopeProperty     *next;
    JSScopeProperty     **prevp;
} FreeNode;

#define FREENODE(sprop) ((FreeNode *) (sprop))

#define FREENODE_INSERT(list, sprop)                                          \
    JS_BEGIN_MACRO                                                            \
        FREENODE(sprop)->next = (list);                                       \
        FREENODE(sprop)->prevp = &(list);                                     \
        if (list)                                                             \
            FREENODE(list)->prevp = &FREENODE(sprop)->next;                   \
        (list) = (sprop);                                                     \
    JS_END_MACRO

#define FREENODE_REMOVE(sprop)                                                \
    JS_BEGIN_MACRO                                                            \
        *FREENODE(sprop)->prevp = FREENODE(sprop)->next;                      \
        if (FREENODE(sprop)->next)                                            \
            FREENODE(FREENODE(sprop)->next)->prevp = FREENODE(sprop)->prevp;  \
    JS_END_MACRO

/* NB: Called with rt->gcLock held. */
static JSScopeProperty *
NewScopeProperty(JSRuntime *rt)
{
    JSScopeProperty *sprop;

    sprop = rt->propertyFreeList;
    if (sprop) {
        FREENODE_REMOVE(sprop);
    } else {
        JS_ARENA_ALLOCATE_CAST(sprop, JSScopeProperty *,
                               &rt->propertyArenaPool,
                               sizeof(JSScopeProperty));
        if (!sprop)
            return NULL;
    }

    JS_RUNTIME_METER(rt, livePropTreeNodes);
    JS_RUNTIME_METER(rt, totalPropTreeNodes);
    return sprop;
}

#define CHUNKY_KIDS_TAG         ((jsuword)1)
#define KIDS_IS_CHUNKY(kids)    ((jsuword)(kids) & CHUNKY_KIDS_TAG)
#define KIDS_TO_CHUNK(kids)     ((PropTreeKidsChunk *)                        \
                                 ((jsuword)(kids) & ~CHUNKY_KIDS_TAG))
#define CHUNK_TO_KIDS(chunk)    ((JSScopeProperty *)                          \
                                 ((jsuword)(chunk) | CHUNKY_KIDS_TAG))
#define MAX_KIDS_PER_CHUNK      10
#define CHUNK_HASH_THRESHOLD    30

typedef struct PropTreeKidsChunk PropTreeKidsChunk;

struct PropTreeKidsChunk {
    JSScopeProperty     *kids[MAX_KIDS_PER_CHUNK];
    JSDHashTable        *table;
    PropTreeKidsChunk   *next;
};

static PropTreeKidsChunk *
NewPropTreeKidsChunk(JSRuntime *rt)
{
    PropTreeKidsChunk *chunk;

    chunk = (PropTreeKidsChunk *) calloc(1, sizeof *chunk);
    if (!chunk)
        return NULL;
    JS_ASSERT(((jsuword)chunk & CHUNKY_KIDS_TAG) == 0);
    JS_RUNTIME_METER(rt, propTreeKidsChunks);
    return chunk;
}

static void
DestroyPropTreeKidsChunk(JSRuntime *rt, PropTreeKidsChunk *chunk)
{
    JS_RUNTIME_UNMETER(rt, propTreeKidsChunks);
    if (chunk->table)
        JS_DHashTableDestroy(chunk->table);
    free(chunk);
}

/* NB: Called with rt->gcLock held. */
static JSBool
InsertPropertyTreeChild(JSRuntime *rt, JSScopeProperty *parent,
                        JSScopeProperty *child, PropTreeKidsChunk *sweptChunk)
{
    JSDHashTable *table;
    JSPropertyTreeEntry *entry;
    JSScopeProperty **childp, *kids, *sprop;
    PropTreeKidsChunk *chunk, **chunkp;
    uintN i;

    JS_ASSERT(!parent || child->parent != parent);

    if (!parent) {
        table = &rt->propertyTreeHash;
        entry = (JSPropertyTreeEntry *)
                JS_DHashTableOperate(table, child, JS_DHASH_ADD);
        if (!entry)
            return JS_FALSE;
        childp = &entry->child;
        sprop = *childp;
        if (!sprop) {
            *childp = child;
        } else {
            /*
             * A "Duplicate child" case.
             *
             * We can't do away with child, as at least one live scope entry
             * still points at it.  What's more, that scope's lastProp chains
             * through an ancestor line to reach child, and js_Enumerate and
             * others count on this linkage.  We must leave child out of the
             * hash table, and not require it to be there when we eventually
             * GC it (see RemovePropertyTreeChild, below).
             *
             * It is necessary to leave the duplicate child out of the hash
             * table to preserve entry uniqueness.  It is safe to leave the
             * child out of the hash table (unlike the duplicate child cases
             * below), because the child's parent link will be null, which
             * can't dangle.
             */
            JS_ASSERT(sprop != child && SPROP_MATCH(sprop, child));
            JS_RUNTIME_METER(rt, duplicatePropTreeNodes);
        }
    } else {
        childp = &parent->kids;
        kids = *childp;
        if (kids) {
            if (KIDS_IS_CHUNKY(kids)) {
                chunk = KIDS_TO_CHUNK(kids);

                table = chunk->table;
                if (table) {
                    entry = (JSPropertyTreeEntry *)
                            JS_DHashTableOperate(table, child, JS_DHASH_ADD);
                    if (!entry)
                        return JS_FALSE;
                    if (!entry->child) {
                        entry->child = child;
                        while (chunk->next)
                            chunk = chunk->next;
                        for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                            childp = &chunk->kids[i];
                            sprop = *childp;
                            if (!sprop)
                                goto insert;
                        }
                        chunkp = &chunk->next;
                        goto new_chunk;
                    }
                }

                do {
                    for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                        childp = &chunk->kids[i];
                        sprop = *childp;
                        if (!sprop)
                            goto insert;

                        JS_ASSERT(sprop != child);
                        if (SPROP_MATCH(sprop, child)) {
                            /*
                             * Duplicate child, see comment above.  In this
                             * case, we must let the duplicate be inserted at
                             * this level in the tree, so we keep iterating,
                             * looking for an empty slot in which to insert.
                             */
                            JS_ASSERT(sprop != child);
                            JS_RUNTIME_METER(rt, duplicatePropTreeNodes);
                        }
                    }
                    chunkp = &chunk->next;
                } while ((chunk = *chunkp) != NULL);

            new_chunk:
                if (sweptChunk) {
                    chunk = sweptChunk;
                } else {
                    chunk = NewPropTreeKidsChunk(rt);
                    if (!chunk)
                        return JS_FALSE;
                }
                *chunkp = chunk;
                childp = &chunk->kids[0];
            } else {
                sprop = kids;
                JS_ASSERT(sprop != child);
                if (SPROP_MATCH(sprop, child)) {
                    /*
                     * Duplicate child, see comment above.  Once again, we
                     * must let duplicates created by deletion pile up in a
                     * kids-chunk-list, in order to find them when sweeping
                     * and thereby avoid dangling parent pointers.
                     */
                    JS_RUNTIME_METER(rt, duplicatePropTreeNodes);
                }
                if (sweptChunk) {
                    chunk = sweptChunk;
                } else {
                    chunk = NewPropTreeKidsChunk(rt);
                    if (!chunk)
                        return JS_FALSE;
                }
                parent->kids = CHUNK_TO_KIDS(chunk);
                chunk->kids[0] = sprop;
                childp = &chunk->kids[1];
            }
        }
    insert:
        *childp = child;
    }

    child->parent = parent;
    return JS_TRUE;
}

/* NB: Called with rt->gcLock held. */
static PropTreeKidsChunk *
RemovePropertyTreeChild(JSRuntime *rt, JSScopeProperty *child)
{
    PropTreeKidsChunk *freeChunk;
    JSScopeProperty *parent, *kids, *kid;
    JSDHashTable *table;
    PropTreeKidsChunk *list, *chunk, **chunkp, *lastChunk;
    uintN i, j;
    JSPropertyTreeEntry *entry;

    freeChunk = NULL;
    parent = child->parent;
    if (!parent) {
        /*
         * Don't remove child if it is not in rt->propertyTreeHash, but only
         * matches a root child in the table that has compatible members. See
         * the "Duplicate child" comments in InsertPropertyTreeChild, above.
         */
        table = &rt->propertyTreeHash;
    } else {
        kids = parent->kids;
        if (KIDS_IS_CHUNKY(kids)) {
            list = chunk = KIDS_TO_CHUNK(kids);
            chunkp = &list;
            table = chunk->table;

            do {
                for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                    if (chunk->kids[i] == child) {
                        lastChunk = chunk;
                        if (!lastChunk->next) {
                            j = i + 1;
                        } else {
                            j = 0;
                            do {
                                chunkp = &lastChunk->next;
                                lastChunk = *chunkp;
                            } while (lastChunk->next);
                        }
                        for (; j < MAX_KIDS_PER_CHUNK; j++) {
                            if (!lastChunk->kids[j])
                                break;
                        }
                        --j;
                        if (chunk != lastChunk || j > i)
                            chunk->kids[i] = lastChunk->kids[j];
                        lastChunk->kids[j] = NULL;
                        if (j == 0) {
                            *chunkp = NULL;
                            if (!list)
                                parent->kids = NULL;
                            freeChunk = lastChunk;
                        }
                        goto out;
                    }
                }

                chunkp = &chunk->next;
            } while ((chunk = *chunkp) != NULL);
        } else {
            table = NULL;
            kid = kids;
            if (kid == child)
                parent->kids = NULL;
        }
    }

out:
    if (table) {
        entry = (JSPropertyTreeEntry *)
                JS_DHashTableOperate(table, child, JS_DHASH_LOOKUP);

        if (entry->child == child)
            JS_DHashTableRawRemove(table, &entry->hdr);
    }
    return freeChunk;
}

static JSDHashTable *
HashChunks(PropTreeKidsChunk *chunk, uintN n)
{
    JSDHashTable *table;
    uintN i;
    JSScopeProperty *sprop;
    JSPropertyTreeEntry *entry;

    table = JS_NewDHashTable(&PropertyTreeHashOps, NULL,
                             sizeof(JSPropertyTreeEntry),
                             JS_DHASH_DEFAULT_CAPACITY(n + 1));
    if (!table)
        return NULL;
    do {
        for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
            sprop = chunk->kids[i];
            if (!sprop)
                break;
            entry = (JSPropertyTreeEntry *)
                    JS_DHashTableOperate(table, sprop, JS_DHASH_ADD);
            entry->child = sprop;
        }
    } while ((chunk = chunk->next) != NULL);
    return table;
}

/*
 * Called without cx->runtime->gcLock held. This function acquires that lock
 * only when inserting a new child.  Thus there may be races to find or add a
 * node that result in duplicates.  We expect such races to be rare!
 *
 * We use rt->gcLock, not rt->rtLock, to allow the GC potentially to nest here
 * under js_GenerateShape.
 */
static JSScopeProperty *
GetPropertyTreeChild(JSContext *cx, JSScopeProperty *parent,
                     JSScopeProperty *child)
{
    JSRuntime *rt;
    JSDHashTable *table;
    JSPropertyTreeEntry *entry;
    JSScopeProperty *sprop;
    PropTreeKidsChunk *chunk;
    uintN i, n;
    uint32 shape;

    rt = cx->runtime;
    if (!parent) {
        JS_LOCK_GC(rt);

        table = &rt->propertyTreeHash;
        entry = (JSPropertyTreeEntry *)
                JS_DHashTableOperate(table, child, JS_DHASH_ADD);
        if (!entry)
            goto out_of_memory;

        sprop = entry->child;
        if (sprop)
            goto out;
    } else {
        /*
         * Because chunks are appended at the end and never deleted except by
         * the GC, we can search without taking the runtime's GC lock.  We may
         * miss a matching sprop added by another thread, and make a duplicate
         * one, but that is an unlikely, therefore small, cost.  The property
         * tree has extremely low fan-out below its root in popular embeddings
         * with real-world workloads.
         *
         * Patterns such as defining closures that capture a constructor's
         * environment as getters or setters on the new object that is passed
         * in as |this| can significantly increase fan-out below the property
         * tree root -- see bug 335700 for details.
         */
        entry = NULL;
        sprop = parent->kids;
        if (sprop) {
            if (KIDS_IS_CHUNKY(sprop)) {
                chunk = KIDS_TO_CHUNK(sprop);

                table = chunk->table;
                if (table) {
                    JS_LOCK_GC(rt);
                    entry = (JSPropertyTreeEntry *)
                            JS_DHashTableOperate(table, child, JS_DHASH_LOOKUP);
                    sprop = entry->child;
                    if (sprop) {
                        JS_UNLOCK_GC(rt);
                        return sprop;
                    }
                    goto locked_not_found;
                }

                n = 0;
                do {
                    for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                        sprop = chunk->kids[i];
                        if (!sprop) {
                            n += i;
                            if (n >= CHUNK_HASH_THRESHOLD) {
                                chunk = KIDS_TO_CHUNK(parent->kids);
                                if (!chunk->table) {
                                    table = HashChunks(chunk, n);
                                    JS_LOCK_GC(rt);
                                    if (!table)
                                        goto out_of_memory;
                                    if (chunk->table)
                                        JS_DHashTableDestroy(table);
                                    else
                                        chunk->table = table;
                                    goto locked_not_found;
                                }
                            }
                            goto not_found;
                        }

                        if (SPROP_MATCH(sprop, child))
                            return sprop;
                    }
                    n += MAX_KIDS_PER_CHUNK;
                } while ((chunk = chunk->next) != NULL);
            } else {
                if (SPROP_MATCH(sprop, child))
                    return sprop;
            }
        }

    not_found:
        JS_LOCK_GC(rt);
    }

locked_not_found:
    /*
     * Call js_GenerateShape before the allocation to prevent collecting the
     * new property when the shape generation triggers the GC.
     */
    shape = js_GenerateShape(cx, JS_TRUE, NULL);

    sprop = NewScopeProperty(rt);
    if (!sprop)
        goto out_of_memory;

    sprop->id = child->id;
    sprop->getter = child->getter;
    sprop->setter = child->setter;
    sprop->slot = child->slot;
    sprop->attrs = child->attrs;
    sprop->flags = child->flags;
    sprop->shortid = child->shortid;
    sprop->parent = sprop->kids = NULL;
    sprop->shape = shape;

    if (!parent) {
        entry->child = sprop;
    } else {
        if (!InsertPropertyTreeChild(rt, parent, sprop, NULL))
            goto out_of_memory;
    }

out:
    JS_UNLOCK_GC(rt);
    return sprop;

out_of_memory:
    JS_UNLOCK_GC(rt);
    JS_ReportOutOfMemory(cx);
    return NULL;
}

#ifdef DEBUG_notbrendan
#define CHECK_ANCESTOR_LINE(scope, sparse)                                    \
    JS_BEGIN_MACRO                                                            \
        if ((scope)->table) CheckAncestorLine(scope, sparse);                 \
    JS_END_MACRO

static void
CheckAncestorLine(JSScope *scope, JSBool sparse)
{
    uint32 size;
    JSScopeProperty **spp, **start, **end, *ancestorLine, *sprop, *aprop;
    uint32 entryCount, ancestorCount;

    ancestorLine = SCOPE_LAST_PROP(scope);
    if (ancestorLine)
        JS_ASSERT(SCOPE_HAS_PROPERTY(scope, ancestorLine));

    entryCount = 0;
    size = SCOPE_CAPACITY(scope);
    start = scope->table;
    for (spp = start, end = start + size; spp < end; spp++) {
        sprop = SPROP_FETCH(spp);
        if (sprop) {
            entryCount++;
            for (aprop = ancestorLine; aprop; aprop = aprop->parent) {
                if (aprop == sprop)
                    break;
            }
            JS_ASSERT(aprop);
        }
    }
    JS_ASSERT(entryCount == scope->entryCount);

    ancestorCount = 0;
    for (sprop = ancestorLine; sprop; sprop = sprop->parent) {
        if (SCOPE_HAD_MIDDLE_DELETE(scope) &&
            !SCOPE_HAS_PROPERTY(scope, sprop)) {
            JS_ASSERT(sparse);
            continue;
        }
        ancestorCount++;
    }
    JS_ASSERT(ancestorCount == scope->entryCount);
}
#else
#define CHECK_ANCESTOR_LINE(scope, sparse) /* nothing */
#endif

static void
ReportReadOnlyScope(JSContext *cx, JSScope *scope)
{
    JSString *str;
    const char *bytes;

    str = js_ValueToString(cx, OBJECT_TO_JSVAL(scope->object));
    if (!str)
        return;
    bytes = js_GetStringBytes(cx, str);
    if (!bytes)
        return;
    JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL, JSMSG_READ_ONLY, bytes);
}

JSScopeProperty *
js_AddScopeProperty(JSContext *cx, JSScope *scope, jsid id,
                    JSPropertyOp getter, JSPropertyOp setter, uint32 slot,
                    uintN attrs, uintN flags, intN shortid)
{
    JSScopeProperty **spp, *sprop, *overwriting, **spvec, **spp2, child;
    uint32 size, splen, i;
    int change;
    JSTempValueRooter tvr;

    JS_ASSERT(JS_IS_SCOPE_LOCKED(cx, scope));
    CHECK_ANCESTOR_LINE(scope, JS_TRUE);

    /*
     * You can't add properties to a sealed scope.  But note well that you can
     * change property attributes in a sealed scope, even though that replaces
     * a JSScopeProperty * in the scope's hash table -- but no id is added, so
     * the scope remains sealed.
     */
    if (SCOPE_IS_SEALED(scope)) {
        ReportReadOnlyScope(cx, scope);
        return NULL;
    }

    /*
     * Normalize stub getter and setter values for faster is-stub testing in
     * the SPROP_CALL_[GS]ETTER macros.
     */
    if (getter == JS_PropertyStub)
        getter = NULL;
    if (setter == JS_PropertyStub)
        setter = NULL;

    /*
     * Search for id in order to claim its entry, allocating a property tree
     * node if one doesn't already exist for our parameters.
     */
    spp = js_SearchScope(scope, id, JS_TRUE);
    sprop = overwriting = SPROP_FETCH(spp);
    if (!sprop) {
        JS_COUNT_OPERATION(cx, JSOW_NEW_PROPERTY);

        /* Check whether we need to grow, if the load factor is >= .75. */
        size = SCOPE_CAPACITY(scope);
        if (scope->entryCount + scope->removedCount >= size - (size >> 2)) {
            if (scope->removedCount >= size >> 2) {
                METER(compresses);
                change = 0;
            } else {
                METER(grows);
                change = 1;
            }
            if (!ChangeScope(cx, scope, change) &&
                scope->entryCount + scope->removedCount == size - 1) {
                METER(addFailures);
                return NULL;
            }
            spp = js_SearchScope(scope, id, JS_TRUE);
            JS_ASSERT(!SPROP_FETCH(spp));
        }
    } else {
        /* Property exists: js_SearchScope must have returned a valid entry. */
        JS_ASSERT(!SPROP_IS_REMOVED(*spp));

        /*
         * If all property members match, this is a redundant add and we can
         * return early.  If the caller wants to allocate a slot, but doesn't
         * care which slot, copy sprop->slot into slot so we can match sprop,
         * if all other members match.
         */
        if (!(attrs & JSPROP_SHARED) &&
            slot == SPROP_INVALID_SLOT &&
            SPROP_HAS_VALID_SLOT(sprop, scope)) {
            slot = sprop->slot;
        }
        if (SPROP_MATCH_PARAMS_AFTER_ID(sprop, getter, setter, slot, attrs,
                                        flags, shortid)) {
            METER(redundantAdds);
            return sprop;
        }

        /*
         * If we are clearing sprop to force an existing property to be
         * overwritten (apart from a duplicate formal parameter), we must
         * unlink it from the ancestor line at scope->lastProp, lazily if
         * sprop is not lastProp.  And we must remove the entry at *spp,
         * precisely so the lazy "middle delete" fixup code further below
         * won't find sprop in scope->table, in spite of sprop being on
         * the ancestor line.
         *
         * When we finally succeed in finding or creating a new sprop
         * and storing its pointer at *spp, we'll use the |overwriting|
         * local saved when we first looked up id to decide whether we're
         * indeed creating a new entry, or merely overwriting an existing
         * property.
         */
        if (sprop == SCOPE_LAST_PROP(scope)) {
            do {
                SCOPE_REMOVE_LAST_PROP(scope);
                if (!SCOPE_HAD_MIDDLE_DELETE(scope))
                    break;
                sprop = SCOPE_LAST_PROP(scope);
            } while (sprop && !SCOPE_HAS_PROPERTY(scope, sprop));
        } else if (!SCOPE_HAD_MIDDLE_DELETE(scope)) {
            /*
             * If we have no hash table yet, we need one now.  The middle
             * delete code is simple-minded that way!
             */
            if (!scope->table) {
                if (!CreateScopeTable(cx, scope, JS_TRUE))
                    return NULL;
                spp = js_SearchScope(scope, id, JS_TRUE);
                sprop = overwriting = SPROP_FETCH(spp);
            }
            SCOPE_SET_MIDDLE_DELETE(scope);
        }
        SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);

        /*
         * If we fail later on trying to find or create a new sprop, we will
         * goto fail_overwrite and restore *spp from |overwriting|.  Note that
         * we don't bother to keep scope->removedCount in sync, because we'll
         * fix up *spp and scope->entryCount shortly, no matter how control
         * flow returns from this function.
         */
        if (scope->table)
            SPROP_STORE_PRESERVING_COLLISION(spp, NULL);
        scope->entryCount--;
        CHECK_ANCESTOR_LINE(scope, JS_TRUE);
        sprop = NULL;
    }

    if (!sprop) {
        /*
         * If properties were deleted from the middle of the list starting at
         * scope->lastProp, we may need to fork the property tree and squeeze
         * all deleted properties out of scope's ancestor line.  Otherwise we
         * risk adding a node with the same id as a "middle" node, violating
         * the rule that properties along an ancestor line have distinct ids.
         */
        if (SCOPE_HAD_MIDDLE_DELETE(scope)) {
            JS_ASSERT(scope->table);
            CHECK_ANCESTOR_LINE(scope, JS_TRUE);

            splen = scope->entryCount;
            if (splen == 0) {
                JS_ASSERT(scope->lastProp == NULL);
            } else {
                /*
                 * Enumerate live entries in scope->table using a temporary
                 * vector, by walking the (possibly sparse, due to deletions)
                 * ancestor line from scope->lastProp.
                 */
                spvec = (JSScopeProperty **)
                        JS_malloc(cx, SCOPE_TABLE_NBYTES(splen));
                if (!spvec)
                    goto fail_overwrite;
                i = splen;
                sprop = SCOPE_LAST_PROP(scope);
                JS_ASSERT(sprop);
                do {
                    /*
                     * NB: test SCOPE_GET_PROPERTY, not SCOPE_HAS_PROPERTY --
                     * the latter insists that sprop->id maps to sprop, while
                     * the former simply tests whether sprop->id is bound in
                     * scope.  We must allow for duplicate formal parameters
                     * along the ancestor line, and fork them as needed.
                     */
                    if (!SCOPE_GET_PROPERTY(scope, sprop->id))
                        continue;

                    JS_ASSERT(sprop != overwriting);
                    if (i == 0) {
                        /*
                         * If our original splen estimate, scope->entryCount,
                         * is less than the ancestor line height, there must
                         * be duplicate formal parameters in this (function
                         * object) scope.  Count remaining ancestors in order
                         * to realloc spvec.
                         */
                        JSScopeProperty *tmp = sprop;
                        do {
                            if (SCOPE_GET_PROPERTY(scope, tmp->id))
                                i++;
                        } while ((tmp = tmp->parent) != NULL);
                        spp2 = (JSScopeProperty **)
                             JS_realloc(cx, spvec, SCOPE_TABLE_NBYTES(splen+i));
                        if (!spp2) {
                            JS_free(cx, spvec);
                            goto fail_overwrite;
                        }

                        spvec = spp2;
                        memmove(spvec + i, spvec, SCOPE_TABLE_NBYTES(splen));
                        splen += i;
                    }

                    spvec[--i] = sprop;
                } while ((sprop = sprop->parent) != NULL);
                JS_ASSERT(i == 0);

                /*
                 * Now loop forward through spvec, forking the property tree
                 * whenever we see a "parent gap" due to deletions from scope.
                 * NB: sprop is null on first entry to the loop body.
                 */
                do {
                    if (spvec[i]->parent == sprop) {
                        sprop = spvec[i];
                    } else {
                        sprop = GetPropertyTreeChild(cx, sprop, spvec[i]);
                        if (!sprop) {
                            JS_free(cx, spvec);
                            goto fail_overwrite;
                        }

                        spp2 = js_SearchScope(scope, sprop->id, JS_FALSE);
                        JS_ASSERT(SPROP_FETCH(spp2) == spvec[i]);
                        SPROP_STORE_PRESERVING_COLLISION(spp2, sprop);
                    }
                } while (++i < splen);
                JS_free(cx, spvec);

                /*
                 * Now sprop points to the last property in scope, where the
                 * ancestor line from sprop to the root is dense w.r.t. scope:
                 * it contains no nodes not mapped by scope->table, apart from
                 * any stinking ECMA-mandated duplicate formal parameters.
                 */
                scope->lastProp = sprop;
                CHECK_ANCESTOR_LINE(scope, JS_FALSE);
                JS_RUNTIME_METER(cx->runtime, middleDeleteFixups);
            }

            SCOPE_CLR_MIDDLE_DELETE(scope);
        }

        /*
         * Aliases share another property's slot, passed in the |slot| param.
         * Shared properties have no slot.  Unshared properties that do not
         * alias another property's slot get one here, but may lose it due to
         * a JS_ClearScope call.
         */
        if (!(flags & SPROP_IS_ALIAS)) {
            if (attrs & JSPROP_SHARED) {
                slot = SPROP_INVALID_SLOT;
            } else {
                /*
                 * We may have set slot from a nearly-matching sprop, above.
                 * If so, we're overwriting that nearly-matching sprop, so we
                 * can reuse its slot -- we don't need to allocate a new one.
                 * Similarly, we use a specific slot if provided by the caller.
                 */
                if (slot == SPROP_INVALID_SLOT &&
                    !js_AllocSlot(cx, scope->object, &slot)) {
                    goto fail_overwrite;
                }
            }
        }

        /*
         * Check for a watchpoint on a deleted property; if one exists, change
         * setter to js_watch_set.
         * XXXbe this could get expensive with lots of watchpoints...
         */
        if (!JS_CLIST_IS_EMPTY(&cx->runtime->watchPointList) &&
            js_FindWatchPoint(cx->runtime, scope, id)) {
            JS_PUSH_TEMP_ROOT_SPROP(cx, overwriting, &tvr);
            setter = js_WrapWatchedSetter(cx, id, attrs, setter);
            JS_POP_TEMP_ROOT(cx, &tvr);
            if (!setter)
                goto fail_overwrite;
        }

        /* Find or create a property tree node labeled by our arguments. */
        child.id = id;
        child.getter = getter;
        child.setter = setter;
        child.slot = slot;
        child.attrs = attrs;
        child.flags = flags;
        child.shortid = shortid;
        sprop = GetPropertyTreeChild(cx, scope->lastProp, &child);
        if (!sprop)
            goto fail_overwrite;

        /*
         * The scope's shape defaults to its last property's shape, but may
         * be regenerated later as the scope diverges (from the property cache
         * point of view) from the structural type associated with sprop.
         */
        SCOPE_EXTEND_SHAPE(cx, scope, sprop);

        /* Store the tree node pointer in the table entry for id. */
        if (scope->table)
            SPROP_STORE_PRESERVING_COLLISION(spp, sprop);
        scope->entryCount++;
        scope->lastProp = sprop;
        CHECK_ANCESTOR_LINE(scope, JS_FALSE);
#ifdef DEBUG
        if (!overwriting) {
            LIVE_SCOPE_METER(cx, ++cx->runtime->liveScopeProps);
            JS_RUNTIME_METER(cx->runtime, totalScopeProps);
        }
#endif

        /*
         * If we reach the hashing threshold, try to allocate scope->table.
         * If we can't (a rare event, preceded by swapping to death on most
         * modern OSes), stick with linear search rather than whining about
         * this little set-back.  Therefore we must test !scope->table and
         * scope->entryCount >= SCOPE_HASH_THRESHOLD, not merely whether the
         * entry count just reached the threshold.
         */
        if (!scope->table && scope->entryCount >= SCOPE_HASH_THRESHOLD)
            (void) CreateScopeTable(cx, scope, JS_FALSE);
    }

    METER(adds);
    return sprop;

fail_overwrite:
    if (overwriting) {
        /*
         * We may or may not have forked overwriting out of scope's ancestor
         * line, so we must check (the alternative is to set a flag above, but
         * that hurts the common, non-error case).  If we did fork overwriting
         * out, we'll add it back at scope->lastProp.  This means enumeration
         * order can change due to a failure to overwrite an id.
         * XXXbe very minor incompatibility
         */
        for (sprop = SCOPE_LAST_PROP(scope); ; sprop = sprop->parent) {
            if (!sprop) {
                sprop = SCOPE_LAST_PROP(scope);
                if (overwriting->parent == sprop) {
                    scope->lastProp = overwriting;
                } else {
                    sprop = GetPropertyTreeChild(cx, sprop, overwriting);
                    if (sprop) {
                        JS_ASSERT(sprop != overwriting);
                        scope->lastProp = sprop;
                    }
                    overwriting = sprop;
                }
                break;
            }
            if (sprop == overwriting)
                break;
        }
        if (overwriting) {
            if (scope->table)
                SPROP_STORE_PRESERVING_COLLISION(spp, overwriting);
            scope->entryCount++;
        }
        CHECK_ANCESTOR_LINE(scope, JS_TRUE);
    }
    METER(addFailures);
    return NULL;
}

JSScopeProperty *
js_ChangeScopePropertyAttrs(JSContext *cx, JSScope *scope,
                            JSScopeProperty *sprop, uintN attrs, uintN mask,
                            JSPropertyOp getter, JSPropertyOp setter)
{
    JSScopeProperty child, *newsprop, **spp;

    CHECK_ANCESTOR_LINE(scope, JS_TRUE);

    /* Allow only shared (slot-less) => unshared (slot-full) transition. */
    attrs |= sprop->attrs & mask;
    JS_ASSERT(!((attrs ^ sprop->attrs) & JSPROP_SHARED) ||
              !(attrs & JSPROP_SHARED));
    if (getter == JS_PropertyStub)
        getter = NULL;
    if (setter == JS_PropertyStub)
        setter = NULL;
    if (sprop->attrs == attrs &&
        sprop->getter == getter &&
        sprop->setter == setter) {
        return sprop;
    }

    child.id = sprop->id;
    child.getter = getter;
    child.setter = setter;
    child.slot = sprop->slot;
    child.attrs = attrs;
    child.flags = sprop->flags;
    child.shortid = sprop->shortid;

    if (SCOPE_LAST_PROP(scope) == sprop) {
        /*
         * Optimize the case where the last property added to scope is changed
         * to have a different attrs, getter, or setter.  In the last property
         * case, we need not fork the property tree.  But since we do not call
         * js_AddScopeProperty, we may need to allocate a new slot directly.
         */
        if ((sprop->attrs & JSPROP_SHARED) && !(attrs & JSPROP_SHARED)) {
            JS_ASSERT(child.slot == SPROP_INVALID_SLOT);
            if (!js_AllocSlot(cx, scope->object, &child.slot))
                return NULL;
        }

        newsprop = GetPropertyTreeChild(cx, sprop->parent, &child);
        if (newsprop) {
            spp = js_SearchScope(scope, sprop->id, JS_FALSE);
            JS_ASSERT(SPROP_FETCH(spp) == sprop);

            if (scope->table)
                SPROP_STORE_PRESERVING_COLLISION(spp, newsprop);
            scope->lastProp = newsprop;
            CHECK_ANCESTOR_LINE(scope, JS_TRUE);
        }
    } else {
        /*
         * Let js_AddScopeProperty handle this |overwriting| case, including
         * the conservation of sprop->slot (if it's valid).  We must not call
         * js_RemoveScopeProperty here, it will free a valid sprop->slot and
         * js_AddScopeProperty won't re-allocate it.
         */
        newsprop = js_AddScopeProperty(cx, scope, child.id,
                                       child.getter, child.setter, child.slot,
                                       child.attrs, child.flags, child.shortid);
    }

    if (newsprop) {
        if (scope->shape == sprop->shape)
            scope->shape = newsprop->shape;
        else
            SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);
    }
#ifdef JS_DUMP_PROPTREE_STATS
    else
        METER(changeFailures);
#endif
    return newsprop;
}

JSBool
js_RemoveScopeProperty(JSContext *cx, JSScope *scope, jsid id)
{
    JSScopeProperty **spp, *stored, *sprop;
    uint32 size;

    JS_ASSERT(JS_IS_SCOPE_LOCKED(cx, scope));
    CHECK_ANCESTOR_LINE(scope, JS_TRUE);
    if (SCOPE_IS_SEALED(scope)) {
        ReportReadOnlyScope(cx, scope);
        return JS_FALSE;
    }
    METER(removes);

    spp = js_SearchScope(scope, id, JS_FALSE);
    stored = *spp;
    sprop = SPROP_CLEAR_COLLISION(stored);
    if (!sprop) {
        METER(uselessRemoves);
        return JS_TRUE;
    }

    /* Convert from a list to a hash so we can handle "middle deletes". */
    if (!scope->table && sprop != scope->lastProp) {
        if (!CreateScopeTable(cx, scope, JS_TRUE))
            return JS_FALSE;
        spp = js_SearchScope(scope, id, JS_FALSE);
        stored = *spp;
        sprop = SPROP_CLEAR_COLLISION(stored);
    }

    /* First, if sprop is unshared and not cleared, free its slot number. */
    if (SPROP_HAS_VALID_SLOT(sprop, scope)) {
        js_FreeSlot(cx, scope->object, sprop->slot);
        JS_ATOMIC_INCREMENT(&cx->runtime->propertyRemovals);
    }

    /* Next, remove id by setting its entry to a removed or free sentinel. */
    if (SPROP_HAD_COLLISION(stored)) {
        JS_ASSERT(scope->table);
        *spp = SPROP_REMOVED;
        scope->removedCount++;
    } else {
        METER(removeFrees);
        if (scope->table)
            *spp = NULL;
    }
    scope->entryCount--;
    LIVE_SCOPE_METER(cx, --cx->runtime->liveScopeProps);

    /* Update scope->lastProp directly, or set its deferred update flag. */
    if (sprop == SCOPE_LAST_PROP(scope)) {
        do {
            SCOPE_REMOVE_LAST_PROP(scope);
            if (!SCOPE_HAD_MIDDLE_DELETE(scope))
                break;
            sprop = SCOPE_LAST_PROP(scope);
        } while (sprop && !SCOPE_HAS_PROPERTY(scope, sprop));
    } else if (!SCOPE_HAD_MIDDLE_DELETE(scope)) {
        SCOPE_SET_MIDDLE_DELETE(scope);
    }
    SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);
    CHECK_ANCESTOR_LINE(scope, JS_TRUE);

    /* Last, consider shrinking scope's table if its load factor is <= .25. */
    size = SCOPE_CAPACITY(scope);
    if (size > MIN_SCOPE_SIZE && scope->entryCount <= size >> 2) {
        METER(shrinks);
        (void) ChangeScope(cx, scope, -1);
    }

    return JS_TRUE;
}

void
js_ClearScope(JSContext *cx, JSScope *scope)
{
    CHECK_ANCESTOR_LINE(scope, JS_TRUE);
    LIVE_SCOPE_METER(cx, cx->runtime->liveScopeProps -= scope->entryCount);

    if (scope->table)
        free(scope->table);
    SCOPE_CLR_MIDDLE_DELETE(scope);
    InitMinimalScope(scope);
    JS_ATOMIC_INCREMENT(&cx->runtime->propertyRemovals);
}

void
js_TraceId(JSTracer *trc, jsid id)
{
    jsval v;

    v = ID_TO_VALUE(id);
    JS_CALL_VALUE_TRACER(trc, v, "id");
}

#ifdef DEBUG
static void
PrintPropertyGetterOrSetter(JSTracer *trc, char *buf, size_t bufsize)
{
    JSScopeProperty *sprop;
    jsid id;
    size_t n;
    const char *name;

    JS_ASSERT(trc->debugPrinter == PrintPropertyGetterOrSetter);
    sprop = (JSScopeProperty *)trc->debugPrintArg;
    id = sprop->id;
    name = trc->debugPrintIndex ? js_setter_str : js_getter_str;

    if (JSID_IS_ATOM(id)) {
        n = js_PutEscapedString(buf, bufsize - 1,
                                ATOM_TO_STRING(JSID_TO_ATOM(id)), 0);
        if (n < bufsize - 1)
            JS_snprintf(buf + n, bufsize - n, " %s", name);
    } else if (JSID_IS_INT(sprop->id)) {
        JS_snprintf(buf, bufsize, "%d %s", JSID_TO_INT(id), name);
    } else {
        JS_snprintf(buf, bufsize, "<object> %s", name);
    }
}
#endif


void
js_TraceScopeProperty(JSTracer *trc, JSScopeProperty *sprop)
{
    if (IS_GC_MARKING_TRACER(trc))
        sprop->flags |= SPROP_MARK;
    TRACE_ID(trc, sprop->id);

#if JS_HAS_GETTER_SETTER
    if (sprop->attrs & (JSPROP_GETTER | JSPROP_SETTER)) {
        if (sprop->attrs & JSPROP_GETTER) {
            JS_ASSERT(JSVAL_IS_OBJECT((jsval) sprop->getter));
            JS_SET_TRACING_DETAILS(trc, PrintPropertyGetterOrSetter, sprop, 0);
            JS_CallTracer(trc, JSVAL_TO_OBJECT((jsval) sprop->getter),
                          JSTRACE_OBJECT);
        }
        if (sprop->attrs & JSPROP_SETTER) {
            JS_ASSERT(JSVAL_IS_OBJECT((jsval) sprop->setter));
            JS_SET_TRACING_DETAILS(trc, PrintPropertyGetterOrSetter, sprop, 1);
            JS_CallTracer(trc, JSVAL_TO_OBJECT((jsval) sprop->setter),
                          JSTRACE_OBJECT);
        }
    }
#endif /* JS_HAS_GETTER_SETTER */
}

#ifdef JS_DUMP_PROPTREE_STATS

#include <stdio.h>

static void
MeterKidCount(JSBasicStats *bs, uintN nkids)
{
    JS_BASIC_STATS_ACCUM(bs, nkids);
    bs->hist[JS_MIN(nkids, 10)]++;
}

static void
MeterPropertyTree(JSBasicStats *bs, JSScopeProperty *node)
{
    uintN i, nkids;
    JSScopeProperty *kids, *kid;
    PropTreeKidsChunk *chunk;

    nkids = 0;
    kids = node->kids;
    if (kids) {
        if (KIDS_IS_CHUNKY(kids)) {
            for (chunk = KIDS_TO_CHUNK(kids); chunk; chunk = chunk->next) {
                for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                    kid = chunk->kids[i];
                    if (!kid)
                        break;
                    MeterPropertyTree(bs, kid);
                    nkids++;
                }
            }
        } else {
            MeterPropertyTree(bs, kids);
            nkids = 1;
        }
    }

    MeterKidCount(bs, nkids);
}

static JSDHashOperator
js_MeterPropertyTree(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 number,
                     void *arg)
{
    JSPropertyTreeEntry *entry = (JSPropertyTreeEntry *)hdr;
    JSBasicStats *bs = (JSBasicStats *)arg;

    MeterPropertyTree(bs, entry->child);
    return JS_DHASH_NEXT;
}

static void
DumpSubtree(JSContext *cx, JSScopeProperty *sprop, int level, FILE *fp)
{
    jsval v;
    JSString *str;
    JSScopeProperty *kids, *kid;
    PropTreeKidsChunk *chunk;
    uintN i;

    fprintf(fp, "%*sid ", level, "");
    v = ID_TO_VALUE(sprop->id);
    if (JSID_IS_INT(sprop->id)) {
        fprintf(fp, "%d", JSVAL_TO_INT(v));
    } else {
        if (JSID_IS_ATOM(sprop->id)) {
            str = JSVAL_TO_STRING(v);
        } else {
            JS_ASSERT(JSID_IS_OBJECT(sprop->id));
            str = js_ValueToString(cx, v);
            fputs("object ", fp);
        }
        if (!str)
            fputs("<error>", fp);
        else
            js_FileEscapedString(fp, str, '"');
    }

    fprintf(fp, " g/s %p/%p slot %u attrs %x flags %x shortid %d\n",
            (void *) sprop->getter, (void *) sprop->setter, sprop->slot,
            sprop->attrs, sprop->flags, sprop->shortid);
    kids = sprop->kids;
    if (kids) {
        ++level;
        if (KIDS_IS_CHUNKY(kids)) {
            chunk = KIDS_TO_CHUNK(kids);
            do {
                for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                    kid = chunk->kids[i];
                    if (!kid)
                        break;
                    JS_ASSERT(kid->parent == sprop);
                    DumpSubtree(cx, kid, level, fp);
                }
            } while ((chunk = chunk->next) != NULL);
        } else {
            kid = kids;
            DumpSubtree(cx, kid, level, fp);
        }
    }
}

#endif /* JS_DUMP_PROPTREE_STATS */

void
js_SweepScopeProperties(JSContext *cx)
{
    JSRuntime *rt = cx->runtime;
    JSArena **ap, *a;
    JSScopeProperty *limit, *sprop, *parent, *kids, *kid;
    uintN liveCount;
    PropTreeKidsChunk *chunk, *nextChunk, *freeChunk;
    uintN i;

#ifdef JS_DUMP_PROPTREE_STATS
    JSBasicStats bs;
    uint32 livePropCapacity = 0, totalLiveCount = 0;
    static FILE *logfp;
    if (!logfp)
        logfp = fopen("/tmp/proptree.stats", "w");

    JS_BASIC_STATS_INIT(&bs);
    MeterKidCount(&bs, rt->propertyTreeHash.entryCount);
    JS_DHashTableEnumerate(&rt->propertyTreeHash, js_MeterPropertyTree, &bs);

    {
        double props, nodes, mean, sigma;

        props = rt->liveScopePropsPreSweep;
        nodes = rt->livePropTreeNodes;
        JS_ASSERT(nodes == bs.sum);
        mean = JS_MeanAndStdDevBS(&bs, &sigma);

        fprintf(logfp,
                "props %g nodes %g beta %g meankids %g sigma %g max %u\n",
                props, nodes, nodes / props, mean, sigma, bs.max);
    }

    JS_DumpHistogram(&bs, logfp);
#endif

    ap = &rt->propertyArenaPool.first.next;
    while ((a = *ap) != NULL) {
        limit = (JSScopeProperty *) a->avail;
        liveCount = 0;
        for (sprop = (JSScopeProperty *) a->base; sprop < limit; sprop++) {
            /* If the id is null, sprop is already on the freelist. */
            if (sprop->id == JSVAL_NULL)
                continue;

            /*
             * If the mark bit is set, sprop is alive, so clear the mark bit
             * and continue the while loop.
             *
             * Regenerate sprop->shape if it hasn't already been refreshed
             * during the mark phase, when live scopes' lastProp members are
             * followed to update both scope->shape and lastProp->shape.
             */
            if (sprop->flags & SPROP_MARK) {
                sprop->flags &= ~SPROP_MARK;
                if (sprop->flags & SPROP_FLAG_SHAPE_REGEN) {
                    sprop->flags &= ~SPROP_FLAG_SHAPE_REGEN;
                } else {
                    sprop->shape = ++cx->runtime->shapeGen;
                    JS_ASSERT(sprop->shape != 0);
                }
                liveCount++;
                continue;
            }

            /* Ok, sprop is garbage to collect: unlink it from its parent. */
            freeChunk = RemovePropertyTreeChild(rt, sprop);

            /*
             * Take care to reparent all sprop's kids to their grandparent.
             * InsertPropertyTreeChild can potentially fail for two reasons:
             *
             * 1. If parent is null, insertion into the root property hash
             *    table may fail. We are forced to leave the kid out of the
             *    table (as can already happen with duplicates) but ensure
             *    that the kid's parent pointer is set to null.
             *
             * 2. If parent is non-null, allocation of a new KidsChunk can
             *    fail. To prevent this from happening, we allow sprops's own
             *    chunks to be reused by the grandparent, which removes the
             *    need for InsertPropertyTreeChild to malloc a new KidsChunk.
             *
             *    If sprop does not have chunky kids, then we rely on the
             *    RemovePropertyTreeChild call above (which removed sprop from
             *    its parent) either leaving one free entry, or else returning
             *    the now-unused chunk to us so we can reuse it.
             *
             * We also require the grandparent to have either no kids or else
             * chunky kids. A single non-chunky kid would force a new chunk to
             * be malloced in some cases (if sprop had a single non-chunky
             * kid, or a multiple of MAX_KIDS_PER_CHUNK kids). Note that
             * RemovePropertyTreeChild never converts a single-entry chunky
             * kid back to a non-chunky kid, so we are assured of correct
             * behaviour.
             */
            kids = sprop->kids;
            if (kids) {
                sprop->kids = NULL;
                parent = sprop->parent;

                /* Assert that grandparent has no kids or chunky kids. */
                JS_ASSERT(!parent || !parent->kids ||
                          KIDS_IS_CHUNKY(parent->kids));
                if (KIDS_IS_CHUNKY(kids)) {
                    chunk = KIDS_TO_CHUNK(kids);
                    do {
                        nextChunk = chunk->next;
                        chunk->next = NULL;
                        for (i = 0; i < MAX_KIDS_PER_CHUNK; i++) {
                            kid = chunk->kids[i];
                            if (!kid)
                                break;
                            JS_ASSERT(kid->parent == sprop);

                            /*
                             * Clear a space in the kids array for possible
                             * re-use by InsertPropertyTreeChild.
                             */
                            chunk->kids[i] = NULL;
                            if (!InsertPropertyTreeChild(rt, parent, kid,
                                                         chunk)) {
                                /*
                                 * This can happen only if we failed to add an
                                 * entry to the root property hash table.
                                 */
                                JS_ASSERT(!parent);
                                kid->parent = NULL;
                            }
                        }
                        if (!chunk->kids[0]) {
                            /* The chunk wasn't reused, so we must free it. */
                            DestroyPropTreeKidsChunk(rt, chunk);
                        }
                    } while ((chunk = nextChunk) != NULL);
                } else {
                    kid = kids;
                    if (!InsertPropertyTreeChild(rt, parent, kid, freeChunk)) {
                        /*
                         * This can happen only if we failed to add an entry
                         * to the root property hash table.
                         */
                        JS_ASSERT(!parent);
                        kid->parent = NULL;
                    }
                }
            }

            if (freeChunk && !freeChunk->kids[0]) {
                /* The chunk wasn't reused, so we must free it. */
                DestroyPropTreeKidsChunk(rt, freeChunk);
            }

            /* Clear id so we know (above) that sprop is on the freelist. */
            sprop->id = JSVAL_NULL;
            FREENODE_INSERT(rt->propertyFreeList, sprop);
            JS_RUNTIME_UNMETER(rt, livePropTreeNodes);
        }

        /* If a contains no live properties, return it to the malloc heap. */
        if (liveCount == 0) {
            for (sprop = (JSScopeProperty *) a->base; sprop < limit; sprop++)
                FREENODE_REMOVE(sprop);
            JS_ARENA_DESTROY(&rt->propertyArenaPool, a, ap);
        } else {
#ifdef JS_DUMP_PROPTREE_STATS
            livePropCapacity += limit - (JSScopeProperty *) a->base;
            totalLiveCount += liveCount;
#endif
            ap = &a->next;
        }
    }

#ifdef JS_DUMP_PROPTREE_STATS
    fprintf(logfp, "arenautil %g%%\n",
            (totalLiveCount && livePropCapacity)
            ? (totalLiveCount * 100.0) / livePropCapacity
            : 0.0);

#define RATE(f1, f2) (((double)js_scope_stats.f1 / js_scope_stats.f2) * 100.0)

    fprintf(logfp, "Scope search stats:\n"
            "  searches:       %6u\n"
            "  hits:           %6u %5.2f%% of searches\n"
            "  misses:         %6u %5.2f%%\n"
            "  hashes:         %6u %5.2f%%\n"
            "  steps:          %6u %5.2f%% %5.2f%% of hashes\n"
            "  stepHits:       %6u %5.2f%% %5.2f%%\n"
            "  stepMisses:     %6u %5.2f%% %5.2f%%\n"
            "  adds:           %6u\n"
            "  redundantAdds:  %6u\n"
            "  addFailures:    %6u\n"
            "  changeFailures: %6u\n"
            "  compresses:     %6u\n"
            "  grows:          %6u\n"
            "  removes:        %6u\n"
            "  removeFrees:    %6u\n"
            "  uselessRemoves: %6u\n"
            "  shrinks:        %6u\n",
            js_scope_stats.searches,
            js_scope_stats.hits, RATE(hits, searches),
            js_scope_stats.misses, RATE(misses, searches),
            js_scope_stats.hashes, RATE(hashes, searches),
            js_scope_stats.steps, RATE(steps, searches), RATE(steps, hashes),
            js_scope_stats.stepHits,
            RATE(stepHits, searches), RATE(stepHits, hashes),
            js_scope_stats.stepMisses,
            RATE(stepMisses, searches), RATE(stepMisses, hashes),
            js_scope_stats.adds,
            js_scope_stats.redundantAdds,
            js_scope_stats.addFailures,
            js_scope_stats.changeFailures,
            js_scope_stats.compresses,
            js_scope_stats.grows,
            js_scope_stats.removes,
            js_scope_stats.removeFrees,
            js_scope_stats.uselessRemoves,
            js_scope_stats.shrinks);

#undef RATE

    fflush(logfp);
#endif

#ifdef DUMP_PROPERTY_TREE
    {
        FILE *dumpfp = fopen("/tmp/proptree.dump", "w");
        if (dumpfp) {
            JSPropertyTreeEntry *pte, *end;

            pte = (JSPropertyTreeEntry *) rt->propertyTreeHash.entryStore;
            end = pte + JS_DHASH_TABLE_SIZE(&rt->propertyTreeHash);
            while (pte < end) {
                if (pte->child)
                    DumpSubtree(cx, pte->child, 0, dumpfp);
                pte++;
            }
            fclose(dumpfp);
        }
    }
#endif
}

JSBool
js_InitPropertyTree(JSRuntime *rt)
{
    if (!JS_DHashTableInit(&rt->propertyTreeHash, &PropertyTreeHashOps, NULL,
                           sizeof(JSPropertyTreeEntry), JS_DHASH_MIN_SIZE)) {
        rt->propertyTreeHash.ops = NULL;
        return JS_FALSE;
    }
    JS_INIT_ARENA_POOL(&rt->propertyArenaPool, "properties",
                       256 * sizeof(JSScopeProperty), sizeof(void *), NULL);
    return JS_TRUE;
}

void
js_FinishPropertyTree(JSRuntime *rt)
{
    if (rt->propertyTreeHash.ops) {
        JS_DHashTableFinish(&rt->propertyTreeHash);
        rt->propertyTreeHash.ops = NULL;
    }
    JS_FinishArenaPool(&rt->propertyArenaPool);
}
