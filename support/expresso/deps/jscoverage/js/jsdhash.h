/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla JavaScript code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999-2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Brendan Eich <brendan@mozilla.org> (Original Author)
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

#ifndef jsdhash_h___
#define jsdhash_h___
/*
 * Double hashing, a la Knuth 6.
 */
#include "jstypes.h"

JS_BEGIN_EXTERN_C

#if defined(__GNUC__) && defined(__i386__) && (__GNUC__ >= 3) && !defined(XP_OS2)
#define JS_DHASH_FASTCALL __attribute__ ((regparm (3),stdcall))
#elif defined(XP_WIN)
#define JS_DHASH_FASTCALL __fastcall
#else
#define JS_DHASH_FASTCALL
#endif

#ifdef DEBUG_XXXbrendan
#define JS_DHASHMETER 1
#endif

/* Table size limit, do not equal or exceed (see min&maxAlphaFrac, below). */
#undef JS_DHASH_SIZE_LIMIT
#define JS_DHASH_SIZE_LIMIT     JS_BIT(24)

/* Minimum table size, or gross entry count (net is at most .75 loaded). */
#ifndef JS_DHASH_MIN_SIZE
#define JS_DHASH_MIN_SIZE 16
#elif (JS_DHASH_MIN_SIZE & (JS_DHASH_MIN_SIZE - 1)) != 0
#error "JS_DHASH_MIN_SIZE must be a power of two!"
#endif

/*
 * Multiplicative hash uses an unsigned 32 bit integer and the golden ratio,
 * expressed as a fixed-point 32-bit fraction.
 */
#define JS_DHASH_BITS           32
#define JS_DHASH_GOLDEN_RATIO   0x9E3779B9U

/* Primitive and forward-struct typedefs. */
typedef uint32                  JSDHashNumber;
typedef struct JSDHashEntryHdr  JSDHashEntryHdr;
typedef struct JSDHashEntryStub JSDHashEntryStub;
typedef struct JSDHashTable     JSDHashTable;
typedef struct JSDHashTableOps  JSDHashTableOps;

/*
 * Table entry header structure.
 *
 * In order to allow in-line allocation of key and value, we do not declare
 * either here.  Instead, the API uses const void *key as a formal parameter.
 * The key need not be stored in the entry; it may be part of the value, but
 * need not be stored at all.
 *
 * Callback types are defined below and grouped into the JSDHashTableOps
 * structure, for single static initialization per hash table sub-type.
 *
 * Each hash table sub-type should nest the JSDHashEntryHdr structure at the
 * front of its particular entry type.  The keyHash member contains the result
 * of multiplying the hash code returned from the hashKey callback (see below)
 * by JS_DHASH_GOLDEN_RATIO, then constraining the result to avoid the magic 0
 * and 1 values.  The stored keyHash value is table size invariant, and it is
 * maintained automatically by JS_DHashTableOperate -- users should never set
 * it, and its only uses should be via the entry macros below.
 *
 * The JS_DHASH_ENTRY_IS_LIVE macro tests whether entry is neither free nor
 * removed.  An entry may be either busy or free; if busy, it may be live or
 * removed.  Consumers of this API should not access members of entries that
 * are not live.
 *
 * However, use JS_DHASH_ENTRY_IS_BUSY for faster liveness testing of entries
 * returned by JS_DHashTableOperate, as JS_DHashTableOperate never returns a
 * non-live, busy (i.e., removed) entry pointer to its caller.  See below for
 * more details on JS_DHashTableOperate's calling rules.
 */
struct JSDHashEntryHdr {
    JSDHashNumber       keyHash;        /* every entry must begin like this */
};

#define JS_DHASH_ENTRY_IS_FREE(entry)   ((entry)->keyHash == 0)
#define JS_DHASH_ENTRY_IS_BUSY(entry)   (!JS_DHASH_ENTRY_IS_FREE(entry))
#define JS_DHASH_ENTRY_IS_LIVE(entry)   ((entry)->keyHash >= 2)

/*
 * A JSDHashTable is currently 8 words (without the JS_DHASHMETER overhead)
 * on most architectures, and may be allocated on the stack or within another
 * structure or class (see below for the Init and Finish functions to use).
 *
 * To decide whether to use double hashing vs. chaining, we need to develop a
 * trade-off relation, as follows:
 *
 * Let alpha be the load factor, esize the entry size in words, count the
 * entry count, and pow2 the power-of-two table size in entries.
 *
 *   (JSDHashTable overhead)    > (JSHashTable overhead)
 *   (unused table entry space) > (malloc and .next overhead per entry) +
 *                                (buckets overhead)
 *   (1 - alpha) * esize * pow2 > 2 * count + pow2
 *
 * Notice that alpha is by definition (count / pow2):
 *
 *   (1 - alpha) * esize * pow2 > 2 * alpha * pow2 + pow2
 *   (1 - alpha) * esize        > 2 * alpha + 1
 *
 *   esize > (1 + 2 * alpha) / (1 - alpha)
 *
 * This assumes both tables must keep keyHash, key, and value for each entry,
 * where key and value point to separately allocated strings or structures.
 * If key and value can be combined into one pointer, then the trade-off is:
 *
 *   esize > (1 + 3 * alpha) / (1 - alpha)
 *
 * If the entry value can be a subtype of JSDHashEntryHdr, rather than a type
 * that must be allocated separately and referenced by an entry.value pointer
 * member, and provided key's allocation can be fused with its entry's, then
 * k (the words wasted per entry with chaining) is 4.
 *
 * To see these curves, feed gnuplot input like so:
 *
 *   gnuplot> f(x,k) = (1 + k * x) / (1 - x)
 *   gnuplot> plot [0:.75] f(x,2), f(x,3), f(x,4)
 *
 * For k of 2 and a well-loaded table (alpha > .5), esize must be more than 4
 * words for chaining to be more space-efficient than double hashing.
 *
 * Solving for alpha helps us decide when to shrink an underloaded table:
 *
 *   esize                     > (1 + k * alpha) / (1 - alpha)
 *   esize - alpha * esize     > 1 + k * alpha
 *   esize - 1                 > (k + esize) * alpha
 *   (esize - 1) / (k + esize) > alpha
 *
 *   alpha < (esize - 1) / (esize + k)
 *
 * Therefore double hashing should keep alpha >= (esize - 1) / (esize + k),
 * assuming esize is not too large (in which case, chaining should probably be
 * used for any alpha).  For esize=2 and k=3, we want alpha >= .2; for esize=3
 * and k=2, we want alpha >= .4.  For k=4, esize could be 6, and alpha >= .5
 * would still obtain.  See the JS_DHASH_MIN_ALPHA macro further below.
 *
 * The current implementation uses a configurable lower bound on alpha, which
 * defaults to .25, when deciding to shrink the table (while still respecting
 * JS_DHASH_MIN_SIZE).
 *
 * Note a qualitative difference between chaining and double hashing: under
 * chaining, entry addresses are stable across table shrinks and grows.  With
 * double hashing, you can't safely hold an entry pointer and use it after an
 * ADD or REMOVE operation, unless you sample table->generation before adding
 * or removing, and compare the sample after, dereferencing the entry pointer
 * only if table->generation has not changed.
 *
 * The moral of this story: there is no one-size-fits-all hash table scheme,
 * but for small table entry size, and assuming entry address stability is not
 * required, double hashing wins.
 */
struct JSDHashTable {
    const JSDHashTableOps *ops;         /* virtual operations, see below */
    void                *data;          /* ops- and instance-specific data */
    int16               hashShift;      /* multiplicative hash shift */
    uint8               maxAlphaFrac;   /* 8-bit fixed point max alpha */
    uint8               minAlphaFrac;   /* 8-bit fixed point min alpha */
    uint32              entrySize;      /* number of bytes in an entry */
    uint32              entryCount;     /* number of entries in table */
    uint32              removedCount;   /* removed entry sentinels in table */
    uint32              generation;     /* entry storage generation number */
    char                *entryStore;    /* entry storage */
#ifdef JS_DHASHMETER
    struct JSDHashStats {
        uint32          searches;       /* total number of table searches */
        uint32          steps;          /* hash chain links traversed */
        uint32          hits;           /* searches that found key */
        uint32          misses;         /* searches that didn't find key */
        uint32          lookups;        /* number of JS_DHASH_LOOKUPs */
        uint32          addMisses;      /* adds that miss, and do work */
        uint32          addOverRemoved; /* adds that recycled a removed entry */
        uint32          addHits;        /* adds that hit an existing entry */
        uint32          addFailures;    /* out-of-memory during add growth */
        uint32          removeHits;     /* removes that hit, and do work */
        uint32          removeMisses;   /* useless removes that miss */
        uint32          removeFrees;    /* removes that freed entry directly */
        uint32          removeEnums;    /* removes done by Enumerate */
        uint32          grows;          /* table expansions */
        uint32          shrinks;        /* table contractions */
        uint32          compresses;     /* table compressions */
        uint32          enumShrinks;    /* contractions after Enumerate */
    } stats;
#endif
};

/*
 * Size in entries (gross, not net of free and removed sentinels) for table.
 * We store hashShift rather than sizeLog2 to optimize the collision-free case
 * in SearchTable.
 */
#define JS_DHASH_TABLE_SIZE(table)  JS_BIT(JS_DHASH_BITS - (table)->hashShift)

/*
 * Table space at entryStore is allocated and freed using these callbacks.
 * The allocator should return null on error only (not if called with nbytes
 * equal to 0; but note that jsdhash.c code will never call with 0 nbytes).
 */
typedef void *
(* JSDHashAllocTable)(JSDHashTable *table, uint32 nbytes);

typedef void
(* JSDHashFreeTable) (JSDHashTable *table, void *ptr);

/*
 * Compute the hash code for a given key to be looked up, added, or removed
 * from table.  A hash code may have any JSDHashNumber value.
 */
typedef JSDHashNumber
(* JSDHashHashKey)   (JSDHashTable *table, const void *key);

/*
 * Compare the key identifying entry in table with the provided key parameter.
 * Return JS_TRUE if keys match, JS_FALSE otherwise.
 */
typedef JSBool
(* JSDHashMatchEntry)(JSDHashTable *table, const JSDHashEntryHdr *entry,
                      const void *key);

/*
 * Copy the data starting at from to the new entry storage at to.  Do not add
 * reference counts for any strong references in the entry, however, as this
 * is a "move" operation: the old entry storage at from will be freed without
 * any reference-decrementing callback shortly.
 */
typedef void
(* JSDHashMoveEntry)(JSDHashTable *table, const JSDHashEntryHdr *from,
                     JSDHashEntryHdr *to);

/*
 * Clear the entry and drop any strong references it holds.  This callback is
 * invoked during a JS_DHASH_REMOVE operation (see below for operation codes),
 * but only if the given key is found in the table.
 */
typedef void
(* JSDHashClearEntry)(JSDHashTable *table, JSDHashEntryHdr *entry);

/*
 * Called when a table (whether allocated dynamically by itself, or nested in
 * a larger structure, or allocated on the stack) is finished.  This callback
 * allows table->ops-specific code to finalize table->data.
 */
typedef void
(* JSDHashFinalize)  (JSDHashTable *table);

/*
 * Initialize a new entry, apart from keyHash.  This function is called when
 * JS_DHashTableOperate's JS_DHASH_ADD case finds no existing entry for the
 * given key, and must add a new one.  At that point, entry->keyHash is not
 * set yet, to avoid claiming the last free entry in a severely overloaded
 * table.
 */
typedef JSBool
(* JSDHashInitEntry)(JSDHashTable *table, JSDHashEntryHdr *entry,
                     const void *key);

/*
 * Finally, the "vtable" structure for JSDHashTable.  The first eight hooks
 * must be provided by implementations; they're called unconditionally by the
 * generic jsdhash.c code.  Hooks after these may be null.
 *
 * Summary of allocation-related hook usage with C++ placement new emphasis:
 *  allocTable          Allocate raw bytes with malloc, no ctors run.
 *  freeTable           Free raw bytes with free, no dtors run.
 *  initEntry           Call placement new using default key-based ctor.
 *                      Return JS_TRUE on success, JS_FALSE on error.
 *  moveEntry           Call placement new using copy ctor, run dtor on old
 *                      entry storage.
 *  clearEntry          Run dtor on entry.
 *  finalize            Stub unless table->data was initialized and needs to
 *                      be finalized.
 *
 * Note the reason why initEntry is optional: the default hooks (stubs) clear
 * entry storage:  On successful JS_DHashTableOperate(tbl, key, JS_DHASH_ADD),
 * the returned entry pointer addresses an entry struct whose keyHash member
 * has been set non-zero, but all other entry members are still clear (null).
 * JS_DHASH_ADD callers can test such members to see whether the entry was
 * newly created by the JS_DHASH_ADD call that just succeeded.  If placement
 * new or similar initialization is required, define an initEntry hook.  Of
 * course, the clearEntry hook must zero or null appropriately.
 *
 * XXX assumes 0 is null for pointer types.
 */
struct JSDHashTableOps {
    /* Mandatory hooks.  All implementations must provide these. */
    JSDHashAllocTable   allocTable;
    JSDHashFreeTable    freeTable;
    JSDHashHashKey      hashKey;
    JSDHashMatchEntry   matchEntry;
    JSDHashMoveEntry    moveEntry;
    JSDHashClearEntry   clearEntry;
    JSDHashFinalize     finalize;

    /* Optional hooks start here.  If null, these are not called. */
    JSDHashInitEntry    initEntry;
};

/*
 * Default implementations for the above ops.
 */
extern JS_PUBLIC_API(void *)
JS_DHashAllocTable(JSDHashTable *table, uint32 nbytes);

extern JS_PUBLIC_API(void)
JS_DHashFreeTable(JSDHashTable *table, void *ptr);

extern JS_PUBLIC_API(JSDHashNumber)
JS_DHashStringKey(JSDHashTable *table, const void *key);

/* A minimal entry contains a keyHash header and a void key pointer. */
struct JSDHashEntryStub {
    JSDHashEntryHdr hdr;
    const void      *key;
};

extern JS_PUBLIC_API(JSDHashNumber)
JS_DHashVoidPtrKeyStub(JSDHashTable *table, const void *key);

extern JS_PUBLIC_API(JSBool)
JS_DHashMatchEntryStub(JSDHashTable *table,
                       const JSDHashEntryHdr *entry,
                       const void *key);

extern JS_PUBLIC_API(JSBool)
JS_DHashMatchStringKey(JSDHashTable *table,
                       const JSDHashEntryHdr *entry,
                       const void *key);

extern JS_PUBLIC_API(void)
JS_DHashMoveEntryStub(JSDHashTable *table,
                      const JSDHashEntryHdr *from,
                      JSDHashEntryHdr *to);

extern JS_PUBLIC_API(void)
JS_DHashClearEntryStub(JSDHashTable *table, JSDHashEntryHdr *entry);

extern JS_PUBLIC_API(void)
JS_DHashFreeStringKey(JSDHashTable *table, JSDHashEntryHdr *entry);

extern JS_PUBLIC_API(void)
JS_DHashFinalizeStub(JSDHashTable *table);

/*
 * If you use JSDHashEntryStub or a subclass of it as your entry struct, and
 * if your entries move via memcpy and clear via memset(0), you can use these
 * stub operations.
 */
extern JS_PUBLIC_API(const JSDHashTableOps *)
JS_DHashGetStubOps(void);

/*
 * Dynamically allocate a new JSDHashTable using malloc, initialize it using
 * JS_DHashTableInit, and return its address.  Return null on malloc failure.
 * Note that the entry storage at table->entryStore will be allocated using
 * the ops->allocTable callback.
 */
extern JS_PUBLIC_API(JSDHashTable *)
JS_NewDHashTable(const JSDHashTableOps *ops, void *data, uint32 entrySize,
                 uint32 capacity);

/*
 * Finalize table's data, free its entry storage (via table->ops->freeTable),
 * and return the memory starting at table to the malloc heap.
 */
extern JS_PUBLIC_API(void)
JS_DHashTableDestroy(JSDHashTable *table);

/*
 * Initialize table with ops, data, entrySize, and capacity.  Capacity is a
 * guess for the smallest table size at which the table will usually be less
 * than 75% loaded (the table will grow or shrink as needed; capacity serves
 * only to avoid inevitable early growth from JS_DHASH_MIN_SIZE).
 */
extern JS_PUBLIC_API(JSBool)
JS_DHashTableInit(JSDHashTable *table, const JSDHashTableOps *ops, void *data,
                  uint32 entrySize, uint32 capacity);

/*
 * Set maximum and minimum alpha for table.  The defaults are 0.75 and .25.
 * maxAlpha must be in [0.5, 0.9375] for the default JS_DHASH_MIN_SIZE; or if
 * MinSize=JS_DHASH_MIN_SIZE <= 256, in [0.5, (float)(MinSize-1)/MinSize]; or
 * else in [0.5, 255.0/256].  minAlpha must be in [0, maxAlpha / 2), so that
 * we don't shrink on the very next remove after growing a table upon adding
 * an entry that brings entryCount past maxAlpha * tableSize.
 */
extern JS_PUBLIC_API(void)
JS_DHashTableSetAlphaBounds(JSDHashTable *table,
                            float maxAlpha,
                            float minAlpha);

/*
 * Call this macro with k, the number of pointer-sized words wasted per entry
 * under chaining, to compute the minimum alpha at which double hashing still
 * beats chaining.
 */
#define JS_DHASH_MIN_ALPHA(table, k)                                          \
    ((float)((table)->entrySize / sizeof(void *) - 1)                         \
     / ((table)->entrySize / sizeof(void *) + (k)))

/*
 * Default max/min alpha, and macros to compute the value for the |capacity|
 * parameter to JS_NewDHashTable and JS_DHashTableInit, given default or any
 * max alpha, such that adding entryCount entries right after initializing the
 * table will not require a reallocation (so JS_DHASH_ADD can't fail for those
 * JS_DHashTableOperate calls).
 *
 * NB: JS_DHASH_CAP is a helper macro meant for use only in JS_DHASH_CAPACITY.
 * Don't use it directly!
 */
#define JS_DHASH_DEFAULT_MAX_ALPHA 0.75
#define JS_DHASH_DEFAULT_MIN_ALPHA 0.25

#define JS_DHASH_CAP(entryCount, maxAlpha)                                    \
    ((uint32)((double)(entryCount) / (maxAlpha)))

#define JS_DHASH_CAPACITY(entryCount, maxAlpha)                               \
    (JS_DHASH_CAP(entryCount, maxAlpha) +                                     \
     (((JS_DHASH_CAP(entryCount, maxAlpha) * (uint8)(0x100 * (maxAlpha)))     \
       >> 8) < (entryCount)))

#define JS_DHASH_DEFAULT_CAPACITY(entryCount)                                 \
    JS_DHASH_CAPACITY(entryCount, JS_DHASH_DEFAULT_MAX_ALPHA)

/*
 * Finalize table's data, free its entry storage using table->ops->freeTable,
 * and leave its members unchanged from their last live values (which leaves
 * pointers dangling).  If you want to burn cycles clearing table, it's up to
 * your code to call memset.
 */
extern JS_PUBLIC_API(void)
JS_DHashTableFinish(JSDHashTable *table);

/*
 * To consolidate keyHash computation and table grow/shrink code, we use a
 * single entry point for lookup, add, and remove operations.  The operation
 * codes are declared here, along with codes returned by JSDHashEnumerator
 * functions, which control JS_DHashTableEnumerate's behavior.
 */
typedef enum JSDHashOperator {
    JS_DHASH_LOOKUP = 0,        /* lookup entry */
    JS_DHASH_ADD = 1,           /* add entry */
    JS_DHASH_REMOVE = 2,        /* remove entry, or enumerator says remove */
    JS_DHASH_NEXT = 0,          /* enumerator says continue */
    JS_DHASH_STOP = 1           /* enumerator says stop */
} JSDHashOperator;

/*
 * To lookup a key in table, call:
 *
 *  entry = JS_DHashTableOperate(table, key, JS_DHASH_LOOKUP);
 *
 * If JS_DHASH_ENTRY_IS_BUSY(entry) is true, key was found and it identifies
 * entry.  If JS_DHASH_ENTRY_IS_FREE(entry) is true, key was not found.
 *
 * To add an entry identified by key to table, call:
 *
 *  entry = JS_DHashTableOperate(table, key, JS_DHASH_ADD);
 *
 * If entry is null upon return, then either the table is severely overloaded,
 * and memory can't be allocated for entry storage via table->ops->allocTable;
 * Or if table->ops->initEntry is non-null, the table->ops->initEntry op may
 * have returned false.
 *
 * Otherwise, entry->keyHash has been set so that JS_DHASH_ENTRY_IS_BUSY(entry)
 * is true, and it is up to the caller to initialize the key and value parts
 * of the entry sub-type, if they have not been set already (i.e. if entry was
 * not already in the table, and if the optional initEntry hook was not used).
 *
 * To remove an entry identified by key from table, call:
 *
 *  (void) JS_DHashTableOperate(table, key, JS_DHASH_REMOVE);
 *
 * If key's entry is found, it is cleared (via table->ops->clearEntry) and
 * the entry is marked so that JS_DHASH_ENTRY_IS_FREE(entry).  This operation
 * returns null unconditionally; you should ignore its return value.
 */
extern JS_PUBLIC_API(JSDHashEntryHdr *) JS_DHASH_FASTCALL
JS_DHashTableOperate(JSDHashTable *table, const void *key, JSDHashOperator op);

/*
 * Remove an entry already accessed via LOOKUP or ADD.
 *
 * NB: this is a "raw" or low-level routine, intended to be used only where
 * the inefficiency of a full JS_DHashTableOperate (which rehashes in order
 * to find the entry given its key) is not tolerable.  This function does not
 * shrink the table if it is underloaded.  It does not update stats #ifdef
 * JS_DHASHMETER, either.
 */
extern JS_PUBLIC_API(void)
JS_DHashTableRawRemove(JSDHashTable *table, JSDHashEntryHdr *entry);

/*
 * Enumerate entries in table using etor:
 *
 *   count = JS_DHashTableEnumerate(table, etor, arg);
 *
 * JS_DHashTableEnumerate calls etor like so:
 *
 *   op = etor(table, entry, number, arg);
 *
 * where number is a zero-based ordinal assigned to live entries according to
 * their order in table->entryStore.
 *
 * The return value, op, is treated as a set of flags.  If op is JS_DHASH_NEXT,
 * then continue enumerating.  If op contains JS_DHASH_REMOVE, then clear (via
 * table->ops->clearEntry) and free entry.  Then we check whether op contains
 * JS_DHASH_STOP; if so, stop enumerating and return the number of live entries
 * that were enumerated so far.  Return the total number of live entries when
 * enumeration completes normally.
 *
 * If etor calls JS_DHashTableOperate on table with op != JS_DHASH_LOOKUP, it
 * must return JS_DHASH_STOP; otherwise undefined behavior results.
 *
 * If any enumerator returns JS_DHASH_REMOVE, table->entryStore may be shrunk
 * or compressed after enumeration, but before JS_DHashTableEnumerate returns.
 * Such an enumerator therefore can't safely set aside entry pointers, but an
 * enumerator that never returns JS_DHASH_REMOVE can set pointers to entries
 * aside, e.g., to avoid copying live entries into an array of the entry type.
 * Copying entry pointers is cheaper, and safe so long as the caller of such a
 * "stable" Enumerate doesn't use the set-aside pointers after any call either
 * to PL_DHashTableOperate, or to an "unstable" form of Enumerate, which might
 * grow or shrink entryStore.
 *
 * If your enumerator wants to remove certain entries, but set aside pointers
 * to other entries that it retains, it can use JS_DHashTableRawRemove on the
 * entries to be removed, returning JS_DHASH_NEXT to skip them.  Likewise, if
 * you want to remove entries, but for some reason you do not want entryStore
 * to be shrunk or compressed, you can call JS_DHashTableRawRemove safely on
 * the entry being enumerated, rather than returning JS_DHASH_REMOVE.
 */
typedef JSDHashOperator
(* JSDHashEnumerator)(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 number,
                      void *arg);

extern JS_PUBLIC_API(uint32)
JS_DHashTableEnumerate(JSDHashTable *table, JSDHashEnumerator etor, void *arg);

#ifdef JS_DHASHMETER
#include <stdio.h>

extern JS_PUBLIC_API(void)
JS_DHashTableDumpMeter(JSDHashTable *table, JSDHashEnumerator dump, FILE *fp);
#endif

JS_END_EXTERN_C

#endif /* jsdhash_h___ */
