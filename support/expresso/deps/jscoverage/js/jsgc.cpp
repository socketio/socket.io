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
 * JS Mark-and-Sweep Garbage Collector.
 *
 * This GC allocates fixed-sized things with sizes up to GC_NBYTES_MAX (see
 * jsgc.h). It allocates from a special GC arena pool with each arena allocated
 * using malloc. It uses an ideally parallel array of flag bytes to hold the
 * mark bit, finalizer type index, etc.
 *
 * XXX swizzle page to freelist for better locality of reference
 */
#include "jsstddef.h"
#include <stdlib.h>     /* for free */
#include <math.h>
#include <string.h>     /* for memset used when DEBUG */
#include "jstypes.h"
#include "jsutil.h" /* Added by JSIFY */
#include "jshash.h" /* Added by JSIFY */
#include "jsbit.h"
#include "jsclist.h"
#include "jsprf.h"
#include "jsapi.h"
#include "jsatom.h"
#include "jscntxt.h"
#include "jsversion.h"
#include "jsdbgapi.h"
#include "jsexn.h"
#include "jsfun.h"
#include "jsgc.h"
#include "jsinterp.h"
#include "jsiter.h"
#include "jslock.h"
#include "jsnum.h"
#include "jsobj.h"
#include "jsparse.h"
#include "jsscope.h"
#include "jsscript.h"
#include "jsstr.h"
#include "jstracer.h"

#if JS_HAS_XML_SUPPORT
#include "jsxml.h"
#endif

/*
 * Check if posix_memalign is available.
 */
#if _POSIX_C_SOURCE >= 200112L || _XOPEN_SOURCE >= 600 || MOZ_MEMORY
# define HAS_POSIX_MEMALIGN 1
#else
# define HAS_POSIX_MEMALIGN 0
#endif

/*
 * jemalloc provides posix_memalign.
 */
#ifdef MOZ_MEMORY
extern "C" {
#include "../../memory/jemalloc/jemalloc.h"
}
#endif

/*
 * Include the headers for mmap unless we have posix_memalign and do not
 * insist on mmap.
 */
#if JS_GC_USE_MMAP || (!defined JS_GC_USE_MMAP && !HAS_POSIX_MEMALIGN)
# if defined(XP_WIN)
#  ifndef JS_GC_USE_MMAP
#   define JS_GC_USE_MMAP 1
#  endif
#  include <windows.h>
# else
#  if defined(XP_UNIX) || defined(XP_BEOS)
#   include <unistd.h>
#  endif
#  if _POSIX_MAPPED_FILES > 0
#   ifndef JS_GC_USE_MMAP
#    define JS_GC_USE_MMAP 1
#   endif
#   include <sys/mman.h>

/* On Mac OS X MAP_ANONYMOUS is not defined. */
#   if !defined(MAP_ANONYMOUS) && defined(MAP_ANON)
#    define MAP_ANONYMOUS MAP_ANON
#   endif
#  else
#   if JS_GC_USE_MMAP
#    error "JS_GC_USE_MMAP is set when mmap is not available"
#   endif
#  endif
# endif
#endif

/*
 * A GC arena contains a fixed number of flag bits for each thing in its heap,
 * and supports O(1) lookup of a flag given its thing's address.
 *
 * To implement this, we allocate things of the same size from a GC arena
 * containing GC_ARENA_SIZE bytes aligned on GC_ARENA_SIZE boundary. The
 * following picture shows arena's layout:
 *
 *  +------------------------------+--------------------+---------------+
 *  | allocation area for GC thing | flags of GC things | JSGCArenaInfo |
 *  +------------------------------+--------------------+---------------+
 *
 * To find the flag bits for the thing we calculate the thing index counting
 * from arena's start using:
 *
 *   thingIndex = (thingAddress & GC_ARENA_MASK) / thingSize
 *
 * The details of flag's lookup depend on thing's kind. For all GC things
 * except doubles we use one byte of flags where the 4 bits determine thing's
 * type and the rest is used to implement GC marking, finalization and
 * locking. We calculate the address of flag's byte using:
 *
 *   flagByteAddress =
 *       (thingAddress | GC_ARENA_MASK) - sizeof(JSGCArenaInfo) - thingIndex
 *
 * where
 *
 *   (thingAddress | GC_ARENA_MASK) - sizeof(JSGCArenaInfo)
 *
 * is the last byte of flags' area.
 *
 * This implies that the things are allocated from the start of their area and
 * flags are allocated from the end. This arrangement avoids a relatively
 * expensive calculation of the location of the boundary separating things and
 * flags. The boundary's offset from the start of the arena is given by:
 *
 *   thingsPerArena * thingSize
 *
 * where thingsPerArena is the number of things that the arena can hold:
 *
 *   (GC_ARENA_SIZE - sizeof(JSGCArenaInfo)) / (thingSize + 1).
 *
 * To allocate doubles we use a specialized arena. It can contain only numbers
 * so we do not need the type bits. Moreover, since the doubles do not require
 * a finalizer and very few of them are locked via js_LockGCThing API, we use
 * just one bit of flags per double to denote if it was marked during the
 * marking phase of the GC. The locking is implemented via a hash table. Thus
 * for doubles the flag area becomes a bitmap.
 *
 * JS_GC_USE_MMAP macro governs the choice of the aligned arena allocator.
 * When it is true, a platform-dependent function like mmap is used to get
 * memory aligned on CPU page boundaries. If the macro is false or undefined,
 * posix_memalign is used when available. Otherwise the code uses malloc to
 * over-allocate a chunk with js_gcArenasPerChunk aligned arenas. The
 * approximate space overhead of this is 1/js_gcArenasPerChunk. For details,
 * see NewGCChunk/DestroyGCChunk below.
 *
 * The code also allocates arenas in chunks when JS_GC_USE_MMAP is 1 to
 * minimize the overhead of mmap/munmap. In this case js_gcArenasPerChunk can
 * not be a compile-time constant as the system page size is not known until
 * runtime.
 */
#if JS_GC_USE_MMAP
static uint32 js_gcArenasPerChunk = 0;
static JSBool js_gcUseMmap = JS_FALSE;
#elif HAS_POSIX_MEMALIGN
# define js_gcArenasPerChunk 1
#else
# define js_gcArenasPerChunk 7
#endif

#if defined(js_gcArenasPerChunk) && js_gcArenasPerChunk == 1
# define CHUNKED_ARENA_ALLOCATION 0
#else
# define CHUNKED_ARENA_ALLOCATION 1
#endif

#define GC_ARENA_SHIFT              12
#define GC_ARENA_MASK               ((jsuword) JS_BITMASK(GC_ARENA_SHIFT))
#define GC_ARENA_SIZE               JS_BIT(GC_ARENA_SHIFT)

/*
 * JS_GC_ARENA_PAD defines the number of bytes to pad JSGCArenaInfo structure.
 * It is used to improve allocation efficiency when using posix_memalign. If
 * malloc's implementation uses internal headers, then calling
 *
 *   posix_memalign(&p, GC_ARENA_SIZE, GC_ARENA_SIZE * js_gcArenasPerChunk)
 *
 * in a sequence leaves holes between allocations of the size GC_ARENA_SIZE
 * due to the need to fit headers. JS_GC_ARENA_PAD mitigates that so the code
 * calls
 *
 *     posix_memalign(&p, GC_ARENA_SIZE,
 *                    GC_ARENA_SIZE * js_gcArenasPerChunk - JS_GC_ARENA_PAD)
 *
 * When JS_GC_ARENA_PAD is equal or greater than the number of words in the
 * system header, the system can pack all allocations together without holes.
 *
 * With JS_GC_USE_MEMALIGN we want at least 2 word pad unless posix_memalign
 * comes from jemalloc that does not use any headers/trailers.
 */
#ifndef JS_GC_ARENA_PAD
# if HAS_POSIX_MEMALIGN && !MOZ_MEMORY
#  define JS_GC_ARENA_PAD (2 * JS_BYTES_PER_WORD)
# else
#  define JS_GC_ARENA_PAD 0
# endif
#endif

struct JSGCArenaInfo {
    /*
     * Allocation list for the arena or NULL if the arena holds double values.
     */
    JSGCArenaList   *list;

    /*
     * Pointer to the previous arena in a linked list. The arena can either
     * belong to one of JSContext.gcArenaList lists or, when it does not have
     * any allocated GC things, to the list of free arenas in the chunk with
     * head stored in JSGCChunkInfo.lastFreeArena.
     */
    JSGCArenaInfo   *prev;

#if !CHUNKED_ARENA_ALLOCATION
    jsuword         prevUntracedPage;
#else
    /*
     * A link field for the list of arenas with marked but not yet traced
     * things. The field is encoded as arena's page to share the space with
     * firstArena and arenaIndex fields.
     */
    jsuword         prevUntracedPage :  JS_BITS_PER_WORD - GC_ARENA_SHIFT;

    /*
     * When firstArena is false, the index of arena in the chunk. When
     * firstArena is true, the index of a free arena holding JSGCChunkInfo or
     * NO_FREE_ARENAS if there are no free arenas in the chunk.
     *
     * GET_ARENA_INDEX and GET_CHUNK_INFO_INDEX are convenience macros to
     * access either of indexes.
     */
    jsuword         arenaIndex :        GC_ARENA_SHIFT - 1;

    /* Flag indicating if the arena is the first in the chunk. */
    jsuword         firstArena :        1;
#endif

    union {
        jsuword     untracedThings;     /* bitset for fast search of marked
                                           but not yet traced things */
        JSBool      hasMarkedDoubles;   /* the arena has marked doubles */
    } u;

#if JS_GC_ARENA_PAD != 0
    uint8           pad[JS_GC_ARENA_PAD];
#endif
};

/*
 * Verify that the bit fields are indeed shared and JSGCArenaInfo is as small
 * as possible. The code does not rely on this check so if on a particular
 * platform this does not compile, then, as a workaround, comment the assert
 * out and submit a bug report.
 */
JS_STATIC_ASSERT(offsetof(JSGCArenaInfo, u) == 3 * sizeof(jsuword));

/*
 * Macros to convert between JSGCArenaInfo, the start address of the arena and
 * arena's page defined as (start address) >> GC_ARENA_SHIFT.
 */
#define ARENA_INFO_OFFSET (GC_ARENA_SIZE - (uint32) sizeof(JSGCArenaInfo))

#define IS_ARENA_INFO_ADDRESS(arena)                                          \
    (((jsuword) (arena) & GC_ARENA_MASK) == ARENA_INFO_OFFSET)

#define ARENA_START_TO_INFO(arenaStart)                                       \
    (JS_ASSERT(((arenaStart) & (jsuword) GC_ARENA_MASK) == 0),                \
     (JSGCArenaInfo *) ((arenaStart) + (jsuword) ARENA_INFO_OFFSET))

#define ARENA_INFO_TO_START(arena)                                            \
    (JS_ASSERT(IS_ARENA_INFO_ADDRESS(arena)),                                 \
     (jsuword) (arena) & ~(jsuword) GC_ARENA_MASK)

#define ARENA_PAGE_TO_INFO(arenaPage)                                         \
    (JS_ASSERT(arenaPage != 0),                                               \
     JS_ASSERT(!((jsuword)(arenaPage) >> (JS_BITS_PER_WORD-GC_ARENA_SHIFT))), \
     ARENA_START_TO_INFO((arenaPage) << GC_ARENA_SHIFT))

#define ARENA_INFO_TO_PAGE(arena)                                             \
    (JS_ASSERT(IS_ARENA_INFO_ADDRESS(arena)),                                 \
     ((jsuword) (arena) >> GC_ARENA_SHIFT))

#define GET_ARENA_INFO(chunk, index)                                          \
    (JS_ASSERT((index) < js_gcArenasPerChunk),                                \
     ARENA_START_TO_INFO(chunk + ((index) << GC_ARENA_SHIFT)))

#if CHUNKED_ARENA_ALLOCATION
/*
 * Definitions for allocating arenas in chunks.
 *
 * All chunks that have at least one free arena are put on the doubly-linked
 * list with the head stored in JSRuntime.gcChunkList. JSGCChunkInfo contains
 * the head of the chunk's free arena list together with the link fields for
 * gcChunkList.
 *
 * Structure stored in one of chunk's free arenas. GET_CHUNK_INFO_INDEX gives
 * the index of this arena. When all arenas in the chunk are used, it is
 * removed from the list and the index is set to NO_FREE_ARENAS indicating
 * that the chunk is not on gcChunkList and has no JSGCChunkInfo available.
 */

struct JSGCChunkInfo {
    JSGCChunkInfo   **prevp;
    JSGCChunkInfo   *next;
    JSGCArenaInfo   *lastFreeArena;
    uint32          numFreeArenas;
};

#define NO_FREE_ARENAS              JS_BITMASK(GC_ARENA_SHIFT - 1)

#ifdef js_gcArenasPerChunk
JS_STATIC_ASSERT(1 <= js_gcArenasPerChunk &&
                 js_gcArenasPerChunk <= NO_FREE_ARENAS);
#endif

#define GET_ARENA_CHUNK(arena, index)                                         \
    (JS_ASSERT(GET_ARENA_INDEX(arena) == index),                              \
     ARENA_INFO_TO_START(arena) - ((index) << GC_ARENA_SHIFT))

#define GET_ARENA_INDEX(arena)                                                \
    ((arena)->firstArena ? 0 : (uint32) (arena)->arenaIndex)

#define GET_CHUNK_INFO_INDEX(chunk)                                           \
    ((uint32) ARENA_START_TO_INFO(chunk)->arenaIndex)

#define SET_CHUNK_INFO_INDEX(chunk, index)                                    \
    (JS_ASSERT((index) < js_gcArenasPerChunk || (index) == NO_FREE_ARENAS),   \
     (void) (ARENA_START_TO_INFO(chunk)->arenaIndex = (jsuword) (index)))

#define GET_CHUNK_INFO(chunk, infoIndex)                                      \
    (JS_ASSERT(GET_CHUNK_INFO_INDEX(chunk) == (infoIndex)),                   \
     JS_ASSERT((uint32) (infoIndex) < js_gcArenasPerChunk),                   \
     (JSGCChunkInfo *) ((chunk) + ((infoIndex) << GC_ARENA_SHIFT)))

#define CHUNK_INFO_TO_INDEX(ci)                                               \
    GET_ARENA_INDEX(ARENA_START_TO_INFO((jsuword)ci))

#endif

/*
 * Macros for GC-thing operations.
 */
#define THINGS_PER_ARENA(thingSize)                                           \
    ((GC_ARENA_SIZE - (uint32) sizeof(JSGCArenaInfo)) / ((thingSize) + 1U))

#define THING_TO_ARENA(thing)                                                 \
    ((JSGCArenaInfo *)(((jsuword) (thing) | GC_ARENA_MASK) +                  \
                       1 - sizeof(JSGCArenaInfo)))

#define THING_TO_INDEX(thing, thingSize)                                      \
    ((uint32) ((jsuword) (thing) & GC_ARENA_MASK) / (uint32) (thingSize))

#define THING_FLAGS_END(arena) ((uint8 *)(arena))

#define THING_FLAGP(arena, thingIndex)                                        \
    (JS_ASSERT((jsuword) (thingIndex)                                         \
               < (jsuword) THINGS_PER_ARENA((arena)->list->thingSize)),       \
     (uint8 *)(arena) - 1 - (thingIndex))

#define THING_TO_FLAGP(thing, thingSize)                                      \
    THING_FLAGP(THING_TO_ARENA(thing), THING_TO_INDEX(thing, thingSize))

#define FLAGP_TO_ARENA(flagp) THING_TO_ARENA(flagp)

#define FLAGP_TO_INDEX(flagp)                                                 \
    (JS_ASSERT(((jsuword) (flagp) & GC_ARENA_MASK) < ARENA_INFO_OFFSET),      \
     (ARENA_INFO_OFFSET - 1 - (uint32) ((jsuword) (flagp) & GC_ARENA_MASK)))

#define FLAGP_TO_THING(flagp, thingSize)                                      \
    (JS_ASSERT(((jsuword) (flagp) & GC_ARENA_MASK) >=                         \
               (ARENA_INFO_OFFSET - THINGS_PER_ARENA(thingSize))),            \
     (JSGCThing *)(((jsuword) (flagp) & ~GC_ARENA_MASK) +                     \
                   (thingSize) * FLAGP_TO_INDEX(flagp)))

/*
 * Macros for the specialized arena for doubles.
 *
 * DOUBLES_PER_ARENA defines the maximum number of doubles that the arena can
 * hold. We find it as the following. Let n be the number of doubles in the
 * arena. Together with the bitmap of flags and JSGCArenaInfo they should fit
 * the arena. Hence DOUBLES_PER_ARENA or n_max is the maximum value of n for
 * which the following holds:
 *
 *   n*s + ceil(n/B) <= M                                               (1)
 *
 * where "/" denotes normal real division,
 *       ceil(r) gives the least integer not smaller than the number r,
 *       s is the number of words in jsdouble,
 *       B is number of bits per word or B == JS_BITS_PER_WORD
 *       M is the number of words in the arena before JSGCArenaInfo or
 *       M == (GC_ARENA_SIZE - sizeof(JSGCArenaInfo)) / sizeof(jsuword).
 *       M == ARENA_INFO_OFFSET / sizeof(jsuword)
 *
 * We rewrite the inequality as
 *
 *   n*B*s/B + ceil(n/B) <= M,
 *   ceil(n*B*s/B + n/B) <= M,
 *   ceil(n*(B*s + 1)/B) <= M                                           (2)
 *
 * We define a helper function e(n, s, B),
 *
 *   e(n, s, B) := ceil(n*(B*s + 1)/B) - n*(B*s + 1)/B, 0 <= e(n, s, B) < 1.
 *
 * It gives:
 *
 *   n*(B*s + 1)/B + e(n, s, B) <= M,
 *   n + e*B/(B*s + 1) <= M*B/(B*s + 1)
 *
 * We apply the floor function to both sides of the last equation, where
 * floor(r) gives the biggest integer not greater than r. As a consequence we
 * have:
 *
 *   floor(n + e*B/(B*s + 1)) <= floor(M*B/(B*s + 1)),
 *   n + floor(e*B/(B*s + 1)) <= floor(M*B/(B*s + 1)),
 *   n <= floor(M*B/(B*s + 1)),                                         (3)
 *
 * where floor(e*B/(B*s + 1)) is zero as e*B/(B*s + 1) < B/(B*s + 1) < 1.
 * Thus any n that satisfies the original constraint (1) or its equivalent (2),
 * must also satisfy (3). That is, we got an upper estimate for the maximum
 * value of n. Lets show that this upper estimate,
 *
 *   floor(M*B/(B*s + 1)),                                              (4)
 *
 * also satisfies (1) and, as such, gives the required maximum value.
 * Substituting it into (2) gives:
 *
 *   ceil(floor(M*B/(B*s + 1))*(B*s + 1)/B) == ceil(floor(M/X)*X)
 *
 * where X == (B*s + 1)/B > 1. But then floor(M/X)*X <= M/X*X == M and
 *
 *   ceil(floor(M/X)*X) <= ceil(M) == M.
 *
 * Thus the value of (4) gives the maximum n satisfying (1).
 *
 * For the final result we observe that in (4)
 *
 *    M*B == ARENA_INFO_OFFSET / sizeof(jsuword) * JS_BITS_PER_WORD
 *        == ARENA_INFO_OFFSET * JS_BITS_PER_BYTE
 *
 *  and
 *
 *    B*s == JS_BITS_PER_WORD * sizeof(jsdouble) / sizeof(jsuword)
 *        == JS_BITS_PER_DOUBLE.
 */
#define DOUBLES_PER_ARENA                                                     \
    ((ARENA_INFO_OFFSET * JS_BITS_PER_BYTE) / (JS_BITS_PER_DOUBLE + 1))

/*
 * Check that  ARENA_INFO_OFFSET and sizeof(jsdouble) divides sizeof(jsuword).
 */
JS_STATIC_ASSERT(ARENA_INFO_OFFSET % sizeof(jsuword) == 0);
JS_STATIC_ASSERT(sizeof(jsdouble) % sizeof(jsuword) == 0);
JS_STATIC_ASSERT(sizeof(jsbitmap) == sizeof(jsuword));

#define DOUBLES_ARENA_BITMAP_WORDS                                            \
    (JS_HOWMANY(DOUBLES_PER_ARENA, JS_BITS_PER_WORD))

/* Check that DOUBLES_PER_ARENA indeed maximises (1). */
JS_STATIC_ASSERT(DOUBLES_PER_ARENA * sizeof(jsdouble) +
                 DOUBLES_ARENA_BITMAP_WORDS * sizeof(jsuword) <=
                 ARENA_INFO_OFFSET);

JS_STATIC_ASSERT((DOUBLES_PER_ARENA + 1) * sizeof(jsdouble) +
                 sizeof(jsuword) *
                 JS_HOWMANY((DOUBLES_PER_ARENA + 1), JS_BITS_PER_WORD) >
                 ARENA_INFO_OFFSET);

/*
 * When DOUBLES_PER_ARENA % BITS_PER_DOUBLE_FLAG_UNIT != 0, some bits in the
 * last byte of the occupation bitmap are unused.
 */
#define UNUSED_DOUBLE_BITMAP_BITS                                             \
    (DOUBLES_ARENA_BITMAP_WORDS * JS_BITS_PER_WORD - DOUBLES_PER_ARENA)

JS_STATIC_ASSERT(UNUSED_DOUBLE_BITMAP_BITS < JS_BITS_PER_WORD);

#define DOUBLES_ARENA_BITMAP_OFFSET                                           \
    (ARENA_INFO_OFFSET - DOUBLES_ARENA_BITMAP_WORDS * sizeof(jsuword))

#define CHECK_DOUBLE_ARENA_INFO(arenaInfo)                                    \
    (JS_ASSERT(IS_ARENA_INFO_ADDRESS(arenaInfo)),                             \
     JS_ASSERT(!(arenaInfo)->list))                                           \

/*
 * Get the start of the bitmap area containing double mark flags in the arena.
 * To access the flag the code uses
 *
 *   JS_TEST_BIT(bitmapStart, index)
 *
 * That is, compared with the case of arenas with non-double things, we count
 * flags from the start of the bitmap area, not from the end.
 */
#define DOUBLE_ARENA_BITMAP(arenaInfo)                                        \
    (CHECK_DOUBLE_ARENA_INFO(arenaInfo),                                      \
     (jsbitmap *) arenaInfo - DOUBLES_ARENA_BITMAP_WORDS)

#define DOUBLE_THING_TO_INDEX(thing)                                          \
    (CHECK_DOUBLE_ARENA_INFO(THING_TO_ARENA(thing)),                          \
     JS_ASSERT(((jsuword) (thing) & GC_ARENA_MASK) <                          \
               DOUBLES_ARENA_BITMAP_OFFSET),                                  \
     ((uint32) (((jsuword) (thing) & GC_ARENA_MASK) / sizeof(jsdouble))))

static void
ClearDoubleArenaFlags(JSGCArenaInfo *a)
{
    jsbitmap *bitmap, mask;
    uintN nused;

    /*
     * When some high bits in the last byte of the double occupation bitmap
     * are unused, we must set them. Otherwise RefillDoubleFreeList will
     * assume that they corresponds to some free cells and tries to allocate
     * them.
     *
     * Note that the code works correctly with UNUSED_DOUBLE_BITMAP_BITS == 0.
     */
    bitmap = DOUBLE_ARENA_BITMAP(a);
    memset(bitmap, 0, (DOUBLES_ARENA_BITMAP_WORDS - 1) * sizeof *bitmap);
    mask = ((jsbitmap) 1 << UNUSED_DOUBLE_BITMAP_BITS) - 1;
    nused = JS_BITS_PER_WORD - UNUSED_DOUBLE_BITMAP_BITS;
    bitmap[DOUBLES_ARENA_BITMAP_WORDS - 1] = mask << nused;
}

static JS_ALWAYS_INLINE JSBool
IsMarkedDouble(JSGCArenaInfo *a, uint32 index)
{
    jsbitmap *bitmap;

    JS_ASSERT(a->u.hasMarkedDoubles);
    bitmap = DOUBLE_ARENA_BITMAP(a);
    return JS_TEST_BIT(bitmap, index);
}

/*
 * JSRuntime.gcDoubleArenaList.nextDoubleFlags points either to:
 *
 *   1. The next byte in the bitmap area for doubles to check for unmarked
 *      (or free) doubles.
 *   2. Or to the end of the bitmap area when all GC cells of the arena are
 *      allocated.
 *   3. Or to a special sentinel value indicating that there are no arenas
 *      to check for unmarked doubles.
 *
 * We set the sentinel to ARENA_INFO_OFFSET so the single check
 *
 *   ((jsuword) nextDoubleFlags & GC_ARENA_MASK) == ARENA_INFO_OFFSET
 *
 * will cover both the second and the third cases.
 */
#define DOUBLE_BITMAP_SENTINEL  ((jsbitmap *) ARENA_INFO_OFFSET)

#ifdef JS_THREADSAFE
/*
 * The maximum number of things to put on the local free list by taking
 * several things from the global free list or from the tail of the last
 * allocated arena to amortize the cost of rt->gcLock.
 *
 * We use number 8 based on benchmarks from bug 312238.
 */
#define MAX_THREAD_LOCAL_THINGS 8

#endif

JS_STATIC_ASSERT(sizeof(JSStackHeader) >= 2 * sizeof(jsval));

JS_STATIC_ASSERT(sizeof(JSGCThing) >= sizeof(JSString));
JS_STATIC_ASSERT(sizeof(JSGCThing) >= sizeof(jsdouble));

/* We want to use all the available GC thing space for object's slots. */
JS_STATIC_ASSERT(sizeof(JSObject) % sizeof(JSGCThing) == 0);

/*
 * Ensure that JSObject is allocated from a different GC-list rather than
 * jsdouble and JSString so we can easily finalize JSObject before these 2
 * types of GC things. See comments in js_GC.
 */
JS_STATIC_ASSERT(GC_FREELIST_INDEX(sizeof(JSString)) !=
                 GC_FREELIST_INDEX(sizeof(JSObject)));
JS_STATIC_ASSERT(GC_FREELIST_INDEX(sizeof(jsdouble)) !=
                 GC_FREELIST_INDEX(sizeof(JSObject)));

/*
 * JSPtrTable capacity growth descriptor. The table grows by powers of two
 * starting from capacity JSPtrTableInfo.minCapacity, but switching to linear
 * growth when capacity reaches JSPtrTableInfo.linearGrowthThreshold.
 */
typedef struct JSPtrTableInfo {
    uint16      minCapacity;
    uint16      linearGrowthThreshold;
} JSPtrTableInfo;

#define GC_ITERATOR_TABLE_MIN     4
#define GC_ITERATOR_TABLE_LINEAR  1024

static const JSPtrTableInfo iteratorTableInfo = {
    GC_ITERATOR_TABLE_MIN,
    GC_ITERATOR_TABLE_LINEAR
};

/* Calculate table capacity based on the current value of JSPtrTable.count. */
static size_t
PtrTableCapacity(size_t count, const JSPtrTableInfo *info)
{
    size_t linear, log, capacity;

    linear = info->linearGrowthThreshold;
    JS_ASSERT(info->minCapacity <= linear);

    if (count == 0) {
        capacity = 0;
    } else if (count < linear) {
        log = JS_CEILING_LOG2W(count);
        JS_ASSERT(log != JS_BITS_PER_WORD);
        capacity = (size_t)1 << log;
        if (capacity < info->minCapacity)
            capacity = info->minCapacity;
    } else {
        capacity = JS_ROUNDUP(count, linear);
    }

    JS_ASSERT(capacity >= count);
    return capacity;
}

static void
FreePtrTable(JSPtrTable *table, const JSPtrTableInfo *info)
{
    if (table->array) {
        JS_ASSERT(table->count > 0);
        free(table->array);
        table->array = NULL;
        table->count = 0;
    }
    JS_ASSERT(table->count == 0);
}

static JSBool
AddToPtrTable(JSContext *cx, JSPtrTable *table, const JSPtrTableInfo *info,
              void *ptr)
{
    size_t count, capacity;
    void **array;

    count = table->count;
    capacity = PtrTableCapacity(count, info);

    if (count == capacity) {
        if (capacity < info->minCapacity) {
            JS_ASSERT(capacity == 0);
            JS_ASSERT(!table->array);
            capacity = info->minCapacity;
        } else {
            /*
             * Simplify the overflow detection assuming pointer is bigger
             * than byte.
             */
            JS_STATIC_ASSERT(2 <= sizeof table->array[0]);
            capacity = (capacity < info->linearGrowthThreshold)
                       ? 2 * capacity
                       : capacity + info->linearGrowthThreshold;
            if (capacity > (size_t)-1 / sizeof table->array[0])
                goto bad;
        }
        array = (void **) realloc(table->array,
                                  capacity * sizeof table->array[0]);
        if (!array)
            goto bad;
#ifdef DEBUG
        memset(array + count, JS_FREE_PATTERN,
               (capacity - count) * sizeof table->array[0]);
#endif
        table->array = array;
    }

    table->array[count] = ptr;
    table->count = count + 1;

    return JS_TRUE;

  bad:
    JS_ReportOutOfMemory(cx);
    return JS_FALSE;
}

static void
ShrinkPtrTable(JSPtrTable *table, const JSPtrTableInfo *info,
               size_t newCount)
{
    size_t oldCapacity, capacity;
    void **array;

    JS_ASSERT(newCount <= table->count);
    if (newCount == table->count)
        return;

    oldCapacity = PtrTableCapacity(table->count, info);
    table->count = newCount;
    capacity = PtrTableCapacity(newCount, info);

    if (oldCapacity != capacity) {
        array = table->array;
        JS_ASSERT(array);
        if (capacity == 0) {
            free(array);
            table->array = NULL;
            return;
        }
        array = (void **) realloc(array, capacity * sizeof array[0]);
        if (array)
            table->array = array;
    }
#ifdef DEBUG
    memset(table->array + newCount, JS_FREE_PATTERN,
           (capacity - newCount) * sizeof table->array[0]);
#endif
}

#ifdef JS_GCMETER
# define METER(x)               ((void) (x))
# define METER_IF(condition, x) ((void) ((condition) && (x)))
#else
# define METER(x)               ((void) 0)
# define METER_IF(condition, x) ((void) 0)
#endif

#define METER_UPDATE_MAX(maxLval, rval)                                       \
    METER_IF((maxLval) < (rval), (maxLval) = (rval))

#if JS_GC_USE_MMAP || !HAS_POSIX_MEMALIGN

/*
 * For chunks allocated via over-sized malloc, get a pointer to store the gap
 * between the malloc's result and the first arena in the chunk.
 */
static uint32 *
GetMallocedChunkGapPtr(jsuword chunk)
{
    JS_ASSERT((chunk & GC_ARENA_MASK) == 0);

    /* Use the memory after the chunk, see NewGCChunk for details. */
    return (uint32 *) (chunk + (js_gcArenasPerChunk << GC_ARENA_SHIFT));
}

#endif

static jsuword
NewGCChunk(void)
{
    void *p;

#if JS_GC_USE_MMAP
    if (js_gcUseMmap) {
# if defined(XP_WIN)
        p = VirtualAlloc(NULL, js_gcArenasPerChunk << GC_ARENA_SHIFT,
                         MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
        return (jsuword) p;
# else
        p = mmap(NULL, js_gcArenasPerChunk << GC_ARENA_SHIFT,
                 PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        return (p == MAP_FAILED) ? 0 : (jsuword) p;
# endif
    }
#endif

#if HAS_POSIX_MEMALIGN
    if (0 != posix_memalign(&p, GC_ARENA_SIZE,
                            GC_ARENA_SIZE * js_gcArenasPerChunk -
                            JS_GC_ARENA_PAD)) {
        return 0;
    }
    return (jsuword) p;
#else
    /*
     * Implement chunk allocation using oversized malloc if mmap and
     * posix_memalign are not available.
     *
     * Since malloc allocates pointers aligned on the word boundary, to get
     * js_gcArenasPerChunk aligned arenas, we need to malloc only
     *
     *   ((js_gcArenasPerChunk + 1) << GC_ARENA_SHIFT) - sizeof(size_t)
     *
     * bytes. But since we stores the gap between the malloced pointer and the
     * first arena in the chunk after the chunk, we need to ask for
     *
     *   ((js_gcArenasPerChunk + 1) << GC_ARENA_SHIFT)
     *
     * bytes to ensure that we always have room to store the gap.
     */
    p = malloc((js_gcArenasPerChunk + 1) << GC_ARENA_SHIFT);
    if (!p)
        return 0;

    {
        jsuword chunk;

        chunk = ((jsuword) p + GC_ARENA_MASK) & ~GC_ARENA_MASK;
        *GetMallocedChunkGapPtr(chunk) = (uint32) (chunk - (jsuword) p);
        return chunk;
    }
#endif
}

static void
DestroyGCChunk(jsuword chunk)
{
    JS_ASSERT((chunk & GC_ARENA_MASK) == 0);
#if JS_GC_USE_MMAP
    if (js_gcUseMmap) {
# if defined(XP_WIN)
        VirtualFree((void *) chunk, 0, MEM_RELEASE);
# elif defined(SOLARIS)
        munmap((char *) chunk, js_gcArenasPerChunk << GC_ARENA_SHIFT);
# else
        munmap((void *) chunk, js_gcArenasPerChunk << GC_ARENA_SHIFT);
# endif
        return;
    }
#endif

#if HAS_POSIX_MEMALIGN
    free((void *) chunk);
#else
    /* See comments in NewGCChunk. */
    JS_ASSERT(*GetMallocedChunkGapPtr(chunk) < GC_ARENA_SIZE);
    free((void *) (chunk - *GetMallocedChunkGapPtr(chunk)));
#endif
}

#if CHUNKED_ARENA_ALLOCATION

static void
AddChunkToList(JSRuntime *rt, JSGCChunkInfo *ci)
{
    ci->prevp = &rt->gcChunkList;
    ci->next = rt->gcChunkList;
    if (rt->gcChunkList) {
        JS_ASSERT(rt->gcChunkList->prevp == &rt->gcChunkList);
        rt->gcChunkList->prevp = &ci->next;
    }
    rt->gcChunkList = ci;
}

static void
RemoveChunkFromList(JSRuntime *rt, JSGCChunkInfo *ci)
{
    *ci->prevp = ci->next;
    if (ci->next) {
        JS_ASSERT(ci->next->prevp == &ci->next);
        ci->next->prevp = ci->prevp;
    }
}

#endif

static JSGCArenaInfo *
NewGCArena(JSRuntime *rt)
{
    jsuword chunk;
    JSGCArenaInfo *a;

    if (rt->gcBytes >= rt->gcMaxBytes)
        return NULL;

#if CHUNKED_ARENA_ALLOCATION
    if (js_gcArenasPerChunk == 1) {
#endif
        chunk = NewGCChunk();
        if (chunk == 0)
            return NULL;
        a = ARENA_START_TO_INFO(chunk);
#if CHUNKED_ARENA_ALLOCATION
    } else {
        JSGCChunkInfo *ci;
        uint32 i;
        JSGCArenaInfo *aprev;

        ci = rt->gcChunkList;
        if (!ci) {
            chunk = NewGCChunk();
            if (chunk == 0)
                return NULL;
            JS_ASSERT((chunk & GC_ARENA_MASK) == 0);
            a = GET_ARENA_INFO(chunk, 0);
            a->firstArena = JS_TRUE;
            a->arenaIndex = 0;
            aprev = NULL;
            i = 0;
            do {
                a->prev = aprev;
                aprev = a;
                ++i;
                a = GET_ARENA_INFO(chunk, i);
                a->firstArena = JS_FALSE;
                a->arenaIndex = i;
            } while (i != js_gcArenasPerChunk - 1);
            ci = GET_CHUNK_INFO(chunk, 0);
            ci->lastFreeArena = aprev;
            ci->numFreeArenas = js_gcArenasPerChunk - 1;
            AddChunkToList(rt, ci);
        } else {
            JS_ASSERT(ci->prevp == &rt->gcChunkList);
            a = ci->lastFreeArena;
            aprev = a->prev;
            if (!aprev) {
                JS_ASSERT(ci->numFreeArenas == 1);
                JS_ASSERT(ARENA_INFO_TO_START(a) == (jsuword) ci);
                RemoveChunkFromList(rt, ci);
                chunk = GET_ARENA_CHUNK(a, GET_ARENA_INDEX(a));
                SET_CHUNK_INFO_INDEX(chunk, NO_FREE_ARENAS);
            } else {
                JS_ASSERT(ci->numFreeArenas >= 2);
                JS_ASSERT(ARENA_INFO_TO_START(a) != (jsuword) ci);
                ci->lastFreeArena = aprev;
                ci->numFreeArenas--;
            }
        }
    }
#endif

    rt->gcBytes += GC_ARENA_SIZE;
    a->prevUntracedPage = 0;
    memset(&a->u, 0, sizeof(a->u));

    return a;
}

static void
DestroyGCArenas(JSRuntime *rt, JSGCArenaInfo *last)
{
    JSGCArenaInfo *a;

    while (last) {
        a = last;
        last = last->prev;

        METER(rt->gcStats.afree++);
        JS_ASSERT(rt->gcBytes >= GC_ARENA_SIZE);
        rt->gcBytes -= GC_ARENA_SIZE;

#if CHUNKED_ARENA_ALLOCATION
        if (js_gcArenasPerChunk == 1) {
#endif
            DestroyGCChunk(ARENA_INFO_TO_START(a));
#if CHUNKED_ARENA_ALLOCATION
        } else {
            uint32 arenaIndex;
            jsuword chunk;
            uint32 chunkInfoIndex;
            JSGCChunkInfo *ci;
# ifdef DEBUG
            jsuword firstArena;

            firstArena = a->firstArena;
            arenaIndex = a->arenaIndex;
            memset((void *) ARENA_INFO_TO_START(a), JS_FREE_PATTERN,
                   GC_ARENA_SIZE - JS_GC_ARENA_PAD);
            a->firstArena = firstArena;
            a->arenaIndex = arenaIndex;
# endif
            arenaIndex = GET_ARENA_INDEX(a);
            chunk = GET_ARENA_CHUNK(a, arenaIndex);
            chunkInfoIndex = GET_CHUNK_INFO_INDEX(chunk);
            if (chunkInfoIndex == NO_FREE_ARENAS) {
                chunkInfoIndex = arenaIndex;
                SET_CHUNK_INFO_INDEX(chunk, arenaIndex);
                ci = GET_CHUNK_INFO(chunk, chunkInfoIndex);
                a->prev = NULL;
                ci->lastFreeArena = a;
                ci->numFreeArenas = 1;
                AddChunkToList(rt, ci);
            } else {
                JS_ASSERT(chunkInfoIndex != arenaIndex);
                ci = GET_CHUNK_INFO(chunk, chunkInfoIndex);
                JS_ASSERT(ci->numFreeArenas != 0);
                JS_ASSERT(ci->lastFreeArena);
                JS_ASSERT(a != ci->lastFreeArena);
                if (ci->numFreeArenas == js_gcArenasPerChunk - 1) {
                    RemoveChunkFromList(rt, ci);
                    DestroyGCChunk(chunk);
                } else {
                    ++ci->numFreeArenas;
                    a->prev = ci->lastFreeArena;
                    ci->lastFreeArena = a;
                }
            }
        }
# endif
    }
}

static void
InitGCArenaLists(JSRuntime *rt)
{
    uintN i, thingSize;
    JSGCArenaList *arenaList;

    for (i = 0; i < GC_NUM_FREELISTS; i++) {
        arenaList = &rt->gcArenaList[i];
        thingSize = GC_FREELIST_NBYTES(i);
        JS_ASSERT((size_t)(uint16)thingSize == thingSize);
        arenaList->last = NULL;
        arenaList->lastCount = (uint16) THINGS_PER_ARENA(thingSize);
        arenaList->thingSize = (uint16) thingSize;
        arenaList->freeList = NULL;
    }
    rt->gcDoubleArenaList.first = NULL;
    rt->gcDoubleArenaList.nextDoubleFlags = DOUBLE_BITMAP_SENTINEL;
}

static void
FinishGCArenaLists(JSRuntime *rt)
{
    uintN i;
    JSGCArenaList *arenaList;

    for (i = 0; i < GC_NUM_FREELISTS; i++) {
        arenaList = &rt->gcArenaList[i];
        DestroyGCArenas(rt, arenaList->last);
        arenaList->last = NULL;
        arenaList->lastCount = THINGS_PER_ARENA(arenaList->thingSize);
        arenaList->freeList = NULL;
    }
    DestroyGCArenas(rt, rt->gcDoubleArenaList.first);
    rt->gcDoubleArenaList.first = NULL;
    rt->gcDoubleArenaList.nextDoubleFlags = DOUBLE_BITMAP_SENTINEL;

    rt->gcBytes = 0;
    JS_ASSERT(rt->gcChunkList == 0);
}

/*
 * This function must not be called when thing is jsdouble.
 */
static uint8 *
GetGCThingFlags(void *thing)
{
    JSGCArenaInfo *a;
    uint32 index;

    a = THING_TO_ARENA(thing);
    index = THING_TO_INDEX(thing, a->list->thingSize);
    return THING_FLAGP(a, index);
}

/*
 * This function returns null when thing is jsdouble.
 */
static uint8 *
GetGCThingFlagsOrNull(void *thing)
{
    JSGCArenaInfo *a;
    uint32 index;

    a = THING_TO_ARENA(thing);
    if (!a->list)
        return NULL;
    index = THING_TO_INDEX(thing, a->list->thingSize);
    return THING_FLAGP(a, index);
}

intN
js_GetExternalStringGCType(JSString *str)
{
    uintN type;

    type = (uintN) *GetGCThingFlags(str) & GCF_TYPEMASK;
    JS_ASSERT(type == GCX_STRING || type >= GCX_EXTERNAL_STRING);
    return (type == GCX_STRING) ? -1 : (intN) (type - GCX_EXTERNAL_STRING);
}

static uint32
MapGCFlagsToTraceKind(uintN flags)
{
    uint32 type;

    type = flags & GCF_TYPEMASK;
    JS_ASSERT(type != GCX_DOUBLE);
    JS_ASSERT(type < GCX_NTYPES);
    return (type < GCX_EXTERNAL_STRING) ? type : JSTRACE_STRING;
}

JS_FRIEND_API(uint32)
js_GetGCThingTraceKind(void *thing)
{
    JSGCArenaInfo *a;
    uint32 index;

    a = THING_TO_ARENA(thing);
    if (!a->list)
        return JSTRACE_DOUBLE;

    index = THING_TO_INDEX(thing, a->list->thingSize);
    return MapGCFlagsToTraceKind(*THING_FLAGP(a, index));
}

JSRuntime*
js_GetGCStringRuntime(JSString *str)
{
    JSGCArenaList *list;

    list = THING_TO_ARENA(str)->list;

    JS_ASSERT(list->thingSize == sizeof(JSGCThing));
    JS_ASSERT(GC_FREELIST_INDEX(sizeof(JSGCThing)) == 0);

    return (JSRuntime *)((uint8 *)list - offsetof(JSRuntime, gcArenaList));
}

JSBool
js_IsAboutToBeFinalized(JSContext *cx, void *thing)
{
    JSGCArenaInfo *a;
    uint32 index, flags;

    a = THING_TO_ARENA(thing);
    if (!a->list) {
        /*
         * Check if arena has no marked doubles. In that case the bitmap with
         * the mark flags contains all garbage as it is initialized only when
         * marking the first double in the arena.
         */
        if (!a->u.hasMarkedDoubles)
            return JS_TRUE;
        index = DOUBLE_THING_TO_INDEX(thing);
        return !IsMarkedDouble(a, index);
    }
    index = THING_TO_INDEX(thing, a->list->thingSize);
    flags = *THING_FLAGP(a, index);
    return !(flags & (GCF_MARK | GCF_LOCK | GCF_FINAL));
}

/* This is compatible with JSDHashEntryStub. */
typedef struct JSGCRootHashEntry {
    JSDHashEntryHdr hdr;
    void            *root;
    const char      *name;
} JSGCRootHashEntry;

/* Initial size of the gcRootsHash table (SWAG, small enough to amortize). */
#define GC_ROOTS_SIZE   256

#if CHUNKED_ARENA_ALLOCATION

/*
 * For a CPU with extremely large pages using them for GC things wastes
 * too much memory.
 */
# define GC_ARENAS_PER_CPU_PAGE_LIMIT JS_BIT(18 - GC_ARENA_SHIFT)

JS_STATIC_ASSERT(GC_ARENAS_PER_CPU_PAGE_LIMIT <= NO_FREE_ARENAS);

#endif

JSBool
js_InitGC(JSRuntime *rt, uint32 maxbytes)
{
#if JS_GC_USE_MMAP
    if (js_gcArenasPerChunk == 0) {
        size_t cpuPageSize, arenasPerPage;
# if defined(XP_WIN)
        SYSTEM_INFO si;

        GetSystemInfo(&si);
        cpuPageSize = si.dwPageSize;

# elif defined(XP_UNIX) || defined(XP_BEOS)
        cpuPageSize = (size_t) sysconf(_SC_PAGESIZE);
# else
#  error "Not implemented"
# endif
        /* cpuPageSize is a power of 2. */
        JS_ASSERT((cpuPageSize & (cpuPageSize - 1)) == 0);
        arenasPerPage = cpuPageSize >> GC_ARENA_SHIFT;
#ifdef DEBUG
        if (arenasPerPage == 0) {
            fprintf(stderr,
"JS engine warning: the size of the CPU page, %u bytes, is too low to use\n"
"paged allocation for the garbage collector. Please report this.\n",
                    (unsigned) cpuPageSize);
        }
#endif
        if (arenasPerPage - 1 <= (size_t) (GC_ARENAS_PER_CPU_PAGE_LIMIT - 1)) {
            /*
             * Use at least 4 GC arenas per paged allocation chunk to minimize
             * the overhead of mmap/VirtualAlloc.
             */
            js_gcUseMmap = JS_TRUE;
            js_gcArenasPerChunk = JS_MAX((uint32) arenasPerPage, 4);
        } else {
            js_gcUseMmap = JS_FALSE;
            js_gcArenasPerChunk = 7;
        }
    }
    JS_ASSERT(1 <= js_gcArenasPerChunk &&
              js_gcArenasPerChunk <= NO_FREE_ARENAS);
#endif

    InitGCArenaLists(rt);
    if (!JS_DHashTableInit(&rt->gcRootsHash, JS_DHashGetStubOps(), NULL,
                           sizeof(JSGCRootHashEntry), GC_ROOTS_SIZE)) {
        rt->gcRootsHash.ops = NULL;
        return JS_FALSE;
    }
    rt->gcLocksHash = NULL;     /* create lazily */

    /*
     * Separate gcMaxMallocBytes from gcMaxBytes but initialize to maxbytes
     * for default backward API compatibility.
     */
    rt->gcMaxBytes = rt->gcMaxMallocBytes = maxbytes;
    rt->gcEmptyArenaPoolLifespan = 30000;

    METER(memset(&rt->gcStats, 0, sizeof rt->gcStats));
    return JS_TRUE;
}

#ifdef JS_GCMETER

static void
UpdateArenaStats(JSGCArenaStats *st, uint32 nlivearenas, uint32 nkilledArenas,
                 uint32 nthings)
{
    size_t narenas;

    narenas = nlivearenas + nkilledArenas;
    JS_ASSERT(narenas >= st->livearenas);

    st->newarenas = narenas - st->livearenas;
    st->narenas = narenas;
    st->livearenas = nlivearenas;
    if (st->maxarenas < narenas)
        st->maxarenas = narenas;
    st->totalarenas += narenas;

    st->nthings = nthings;
    if (st->maxthings < nthings)
        st->maxthings = nthings;
    st->totalthings += nthings;
}

JS_FRIEND_API(void)
js_DumpGCStats(JSRuntime *rt, FILE *fp)
{
    int i;
    size_t sumArenas, sumTotalArenas;
    size_t sumThings, sumMaxThings;
    size_t sumThingSize, sumTotalThingSize;
    size_t sumArenaCapacity, sumTotalArenaCapacity;
    JSGCArenaStats *st;
    size_t thingSize, thingsPerArena;
    size_t sumAlloc, sumLocalAlloc, sumFail, sumRetry;

    fprintf(fp, "\nGC allocation statistics:\n");

#define UL(x)       ((unsigned long)(x))
#define ULSTAT(x)   UL(rt->gcStats.x)
#define PERCENT(x,y)  (100.0 * (double) (x) / (double) (y))

    sumArenas = 0;
    sumTotalArenas = 0;
    sumThings = 0;
    sumMaxThings = 0;
    sumThingSize = 0;
    sumTotalThingSize = 0;
    sumArenaCapacity = 0;
    sumTotalArenaCapacity = 0;
    sumAlloc = 0;
    sumLocalAlloc = 0;
    sumFail = 0;
    sumRetry = 0;
    for (i = -1; i < (int) GC_NUM_FREELISTS; i++) {
        if (i == -1) {
            thingSize = sizeof(jsdouble);
            thingsPerArena = DOUBLES_PER_ARENA;
            st = &rt->gcStats.doubleArenaStats;
            fprintf(fp,
                    "Arena list for double values (%lu doubles per arena):",
                    UL(thingsPerArena));
        } else {
            thingSize = rt->gcArenaList[i].thingSize;
            thingsPerArena = THINGS_PER_ARENA(thingSize);
            st = &rt->gcStats.arenaStats[i];
            fprintf(fp,
                    "Arena list %d (thing size %lu, %lu things per arena):",
                    i, UL(GC_FREELIST_NBYTES(i)), UL(thingsPerArena));
        }
        if (st->maxarenas == 0) {
            fputs(" NEVER USED\n", fp);
            continue;
        }
        putc('\n', fp);
        fprintf(fp, "           arenas before GC: %lu\n", UL(st->narenas));
        fprintf(fp, "       new arenas before GC: %lu (%.1f%%)\n",
                UL(st->newarenas), PERCENT(st->newarenas, st->narenas));
        fprintf(fp, "            arenas after GC: %lu (%.1f%%)\n",
                UL(st->livearenas), PERCENT(st->livearenas, st->narenas));
        fprintf(fp, "                 max arenas: %lu\n", UL(st->maxarenas));
        fprintf(fp, "                     things: %lu\n", UL(st->nthings));
        fprintf(fp, "        GC cell utilization: %.1f%%\n",
                PERCENT(st->nthings, thingsPerArena * st->narenas));
        fprintf(fp, "   average cell utilization: %.1f%%\n",
                PERCENT(st->totalthings, thingsPerArena * st->totalarenas));
        fprintf(fp, "                 max things: %lu\n", UL(st->maxthings));
        fprintf(fp, "             alloc attempts: %lu\n", UL(st->alloc));
        fprintf(fp, "        alloc without locks: %1u  (%.1f%%)\n",
                UL(st->localalloc), PERCENT(st->localalloc, st->alloc));
        sumArenas += st->narenas;
        sumTotalArenas += st->totalarenas;
        sumThings += st->nthings;
        sumMaxThings += st->maxthings;
        sumThingSize += thingSize * st->nthings;
        sumTotalThingSize += thingSize * st->totalthings;
        sumArenaCapacity += thingSize * thingsPerArena * st->narenas;
        sumTotalArenaCapacity += thingSize * thingsPerArena * st->totalarenas;
        sumAlloc += st->alloc;
        sumLocalAlloc += st->localalloc;
        sumFail += st->fail;
        sumRetry += st->retry;
    }
    fprintf(fp, "TOTAL STATS:\n");
    fprintf(fp, "            bytes allocated: %lu\n", UL(rt->gcBytes));
    fprintf(fp, "            total GC arenas: %lu\n", UL(sumArenas));
    fprintf(fp, "            total GC things: %lu\n", UL(sumThings));
    fprintf(fp, "        max total GC things: %lu\n", UL(sumMaxThings));
    fprintf(fp, "        GC cell utilization: %.1f%%\n",
            PERCENT(sumThingSize, sumArenaCapacity));
    fprintf(fp, "   average cell utilization: %.1f%%\n",
            PERCENT(sumTotalThingSize, sumTotalArenaCapacity));
    fprintf(fp, "allocation retries after GC: %lu\n", UL(sumRetry));
    fprintf(fp, "             alloc attempts: %lu\n", UL(sumAlloc));
    fprintf(fp, "        alloc without locks: %1u  (%.1f%%)\n",
            UL(sumLocalAlloc), PERCENT(sumLocalAlloc, sumAlloc));
    fprintf(fp, "        allocation failures: %lu\n", UL(sumFail));
    fprintf(fp, "         things born locked: %lu\n", ULSTAT(lockborn));
    fprintf(fp, "           valid lock calls: %lu\n", ULSTAT(lock));
    fprintf(fp, "         valid unlock calls: %lu\n", ULSTAT(unlock));
    fprintf(fp, "       mark recursion depth: %lu\n", ULSTAT(depth));
    fprintf(fp, "     maximum mark recursion: %lu\n", ULSTAT(maxdepth));
    fprintf(fp, "     mark C recursion depth: %lu\n", ULSTAT(cdepth));
    fprintf(fp, "   maximum mark C recursion: %lu\n", ULSTAT(maxcdepth));
    fprintf(fp, "      delayed tracing calls: %lu\n", ULSTAT(untraced));
#ifdef DEBUG
    fprintf(fp, "      max trace later count: %lu\n", ULSTAT(maxuntraced));
#endif
    fprintf(fp, "   maximum GC nesting level: %lu\n", ULSTAT(maxlevel));
    fprintf(fp, "potentially useful GC calls: %lu\n", ULSTAT(poke));
    fprintf(fp, "  thing arenas freed so far: %lu\n", ULSTAT(afree));
    fprintf(fp, "     stack segments scanned: %lu\n", ULSTAT(stackseg));
    fprintf(fp, "stack segment slots scanned: %lu\n", ULSTAT(segslots));
    fprintf(fp, "reachable closeable objects: %lu\n", ULSTAT(nclose));
    fprintf(fp, "    max reachable closeable: %lu\n", ULSTAT(maxnclose));
    fprintf(fp, "      scheduled close hooks: %lu\n", ULSTAT(closelater));
    fprintf(fp, "  max scheduled close hooks: %lu\n", ULSTAT(maxcloselater));

#undef UL
#undef ULSTAT
#undef PERCENT

#ifdef JS_ARENAMETER
    JS_DumpArenaStats(fp);
#endif
}
#endif

#ifdef DEBUG
static void
CheckLeakedRoots(JSRuntime *rt);
#endif

#ifdef JS_THREADSAFE
static void
TrimGCFreeListsPool(JSRuntime *rt, uintN keepCount);
#endif

void
js_FinishGC(JSRuntime *rt)
{
#ifdef JS_ARENAMETER
    JS_DumpArenaStats(stdout);
#endif
#ifdef JS_GCMETER
    js_DumpGCStats(rt, stdout);
#endif

    FreePtrTable(&rt->gcIteratorTable, &iteratorTableInfo);
#ifdef JS_THREADSAFE
    TrimGCFreeListsPool(rt, 0);
    JS_ASSERT(!rt->gcFreeListsPool);
#endif
    FinishGCArenaLists(rt);

    if (rt->gcRootsHash.ops) {
#ifdef DEBUG
        CheckLeakedRoots(rt);
#endif
        JS_DHashTableFinish(&rt->gcRootsHash);
        rt->gcRootsHash.ops = NULL;
    }
    if (rt->gcLocksHash) {
        JS_DHashTableDestroy(rt->gcLocksHash);
        rt->gcLocksHash = NULL;
    }
}

JSBool
js_AddRoot(JSContext *cx, void *rp, const char *name)
{
    JSBool ok = js_AddRootRT(cx->runtime, rp, name);
    if (!ok)
        JS_ReportOutOfMemory(cx);
    return ok;
}

JSBool
js_AddRootRT(JSRuntime *rt, void *rp, const char *name)
{
    JSBool ok;
    JSGCRootHashEntry *rhe;

    /*
     * Due to the long-standing, but now removed, use of rt->gcLock across the
     * bulk of js_GC, API users have come to depend on JS_AddRoot etc. locking
     * properly with a racing GC, without calling JS_AddRoot from a request.
     * We have to preserve API compatibility here, now that we avoid holding
     * rt->gcLock across the mark phase (including the root hashtable mark).
     *
     * If the GC is running and we're called on another thread, wait for this
     * GC activation to finish.  We can safely wait here (in the case where we
     * are called within a request on another thread's context) without fear
     * of deadlock because the GC doesn't set rt->gcRunning until after it has
     * waited for all active requests to end.
     */
    JS_LOCK_GC(rt);
#ifdef JS_THREADSAFE
    JS_ASSERT(!rt->gcRunning || rt->gcLevel > 0);
    if (rt->gcRunning && rt->gcThread->id != js_CurrentThreadId()) {
        do {
            JS_AWAIT_GC_DONE(rt);
        } while (rt->gcLevel > 0);
    }
#endif
    rhe = (JSGCRootHashEntry *)
          JS_DHashTableOperate(&rt->gcRootsHash, rp, JS_DHASH_ADD);
    if (rhe) {
        rhe->root = rp;
        rhe->name = name;
        ok = JS_TRUE;
    } else {
        ok = JS_FALSE;
    }
    JS_UNLOCK_GC(rt);
    return ok;
}

JSBool
js_RemoveRoot(JSRuntime *rt, void *rp)
{
    /*
     * Due to the JS_RemoveRootRT API, we may be called outside of a request.
     * Same synchronization drill as above in js_AddRoot.
     */
    JS_LOCK_GC(rt);
#ifdef JS_THREADSAFE
    JS_ASSERT(!rt->gcRunning || rt->gcLevel > 0);
    if (rt->gcRunning && rt->gcThread->id != js_CurrentThreadId()) {
        do {
            JS_AWAIT_GC_DONE(rt);
        } while (rt->gcLevel > 0);
    }
#endif
    (void) JS_DHashTableOperate(&rt->gcRootsHash, rp, JS_DHASH_REMOVE);
    rt->gcPoke = JS_TRUE;
    JS_UNLOCK_GC(rt);
    return JS_TRUE;
}

#ifdef DEBUG

static JSDHashOperator
js_root_printer(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 i, void *arg)
{
    uint32 *leakedroots = (uint32 *)arg;
    JSGCRootHashEntry *rhe = (JSGCRootHashEntry *)hdr;

    (*leakedroots)++;
    fprintf(stderr,
            "JS engine warning: leaking GC root \'%s\' at %p\n",
            rhe->name ? (char *)rhe->name : "", rhe->root);

    return JS_DHASH_NEXT;
}

static void
CheckLeakedRoots(JSRuntime *rt)
{
    uint32 leakedroots = 0;

    /* Warn (but don't assert) debug builds of any remaining roots. */
    JS_DHashTableEnumerate(&rt->gcRootsHash, js_root_printer,
                           &leakedroots);
    if (leakedroots > 0) {
        if (leakedroots == 1) {
            fprintf(stderr,
"JS engine warning: 1 GC root remains after destroying the JSRuntime at %p.\n"
"                   This root may point to freed memory. Objects reachable\n"
"                   through it have not been finalized.\n",
                    (void *) rt);
        } else {
            fprintf(stderr,
"JS engine warning: %lu GC roots remain after destroying the JSRuntime at %p.\n"
"                   These roots may point to freed memory. Objects reachable\n"
"                   through them have not been finalized.\n",
                    (unsigned long) leakedroots, (void *) rt);
        }
    }
}

typedef struct NamedRootDumpArgs {
    void (*dump)(const char *name, void *rp, void *data);
    void *data;
} NamedRootDumpArgs;

static JSDHashOperator
js_named_root_dumper(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 number,
                     void *arg)
{
    NamedRootDumpArgs *args = (NamedRootDumpArgs *) arg;
    JSGCRootHashEntry *rhe = (JSGCRootHashEntry *)hdr;

    if (rhe->name)
        args->dump(rhe->name, rhe->root, args->data);
    return JS_DHASH_NEXT;
}

JS_BEGIN_EXTERN_C
void
js_DumpNamedRoots(JSRuntime *rt,
                  void (*dump)(const char *name, void *rp, void *data),
                  void *data)
{
    NamedRootDumpArgs args;

    args.dump = dump;
    args.data = data;
    JS_DHashTableEnumerate(&rt->gcRootsHash, js_named_root_dumper, &args);
}
JS_END_EXTERN_C

#endif /* DEBUG */

typedef struct GCRootMapArgs {
    JSGCRootMapFun map;
    void *data;
} GCRootMapArgs;

static JSDHashOperator
js_gcroot_mapper(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 number,
                 void *arg)
{
    GCRootMapArgs *args = (GCRootMapArgs *) arg;
    JSGCRootHashEntry *rhe = (JSGCRootHashEntry *)hdr;
    intN mapflags;
    int op;

    mapflags = args->map(rhe->root, rhe->name, args->data);

#if JS_MAP_GCROOT_NEXT == JS_DHASH_NEXT &&                                     \
    JS_MAP_GCROOT_STOP == JS_DHASH_STOP &&                                     \
    JS_MAP_GCROOT_REMOVE == JS_DHASH_REMOVE
    op = (JSDHashOperator)mapflags;
#else
    op = JS_DHASH_NEXT;
    if (mapflags & JS_MAP_GCROOT_STOP)
        op |= JS_DHASH_STOP;
    if (mapflags & JS_MAP_GCROOT_REMOVE)
        op |= JS_DHASH_REMOVE;
#endif

    return (JSDHashOperator) op;
}

uint32
js_MapGCRoots(JSRuntime *rt, JSGCRootMapFun map, void *data)
{
    GCRootMapArgs args;
    uint32 rv;

    args.map = map;
    args.data = data;
    JS_LOCK_GC(rt);
    rv = JS_DHashTableEnumerate(&rt->gcRootsHash, js_gcroot_mapper, &args);
    JS_UNLOCK_GC(rt);
    return rv;
}

JSBool
js_RegisterCloseableIterator(JSContext *cx, JSObject *obj)
{
    JSRuntime *rt;
    JSBool ok;

    rt = cx->runtime;
    JS_ASSERT(!rt->gcRunning);

    JS_LOCK_GC(rt);
    ok = AddToPtrTable(cx, &rt->gcIteratorTable, &iteratorTableInfo, obj);
    JS_UNLOCK_GC(rt);
    return ok;
}

static void
CloseNativeIterators(JSContext *cx)
{
    JSRuntime *rt;
    size_t count, newCount, i;
    void **array;
    JSObject *obj;

    rt = cx->runtime;
    count = rt->gcIteratorTable.count;
    array = rt->gcIteratorTable.array;

    newCount = 0;
    for (i = 0; i != count; ++i) {
        obj = (JSObject *)array[i];
        if (js_IsAboutToBeFinalized(cx, obj))
            js_CloseNativeIterator(cx, obj);
        else
            array[newCount++] = obj;
    }
    ShrinkPtrTable(&rt->gcIteratorTable, &iteratorTableInfo, newCount);
}

#if defined(DEBUG_brendan) || defined(DEBUG_timeless)
#define DEBUG_gchist
#endif

#ifdef DEBUG_gchist
#define NGCHIST 64

static struct GCHist {
    JSBool      lastDitch;
    JSGCThing   *freeList;
} gchist[NGCHIST];

unsigned gchpos = 0;
#endif

#ifdef JS_THREADSAFE

const JSGCFreeListSet js_GCEmptyFreeListSet = {
    { NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL }, NULL
};

static void
TrimGCFreeListsPool(JSRuntime *rt, uintN keepCount)
{
    JSGCFreeListSet **cursor, *freeLists, *link;

    cursor = &rt->gcFreeListsPool;
    while (keepCount != 0) {
        --keepCount;
        freeLists = *cursor;
        if (!freeLists)
            return;
        memset(freeLists->array, 0, sizeof freeLists->array);
        cursor = &freeLists->link;
    }
    freeLists = *cursor;
    if (freeLists) {
        *cursor = NULL;
        do {
            link = freeLists->link;
            free(freeLists);
        } while ((freeLists = link) != NULL);
    }
}

void
js_RevokeGCLocalFreeLists(JSContext *cx)
{
    JS_ASSERT(!cx->gcLocalFreeLists->link);
    if (cx->gcLocalFreeLists != &js_GCEmptyFreeListSet) {
        cx->gcLocalFreeLists->link = cx->runtime->gcFreeListsPool;
        cx->runtime->gcFreeListsPool = cx->gcLocalFreeLists;
        cx->gcLocalFreeLists = (JSGCFreeListSet *) &js_GCEmptyFreeListSet;
    }
}

static JSGCFreeListSet *
EnsureLocalFreeList(JSContext *cx)
{
    JSGCFreeListSet *freeLists;

    freeLists = cx->gcLocalFreeLists;
    if (freeLists != &js_GCEmptyFreeListSet) {
        JS_ASSERT(freeLists);
        return freeLists;
    }

    freeLists = cx->runtime->gcFreeListsPool;
    if (freeLists) {
        cx->runtime->gcFreeListsPool = freeLists->link;
        freeLists->link = NULL;
    } else {
        /* JS_malloc is not used as the caller reports out-of-memory itself. */
        freeLists = (JSGCFreeListSet *) calloc(1, sizeof *freeLists);
        if (!freeLists)
            return NULL;
    }
    cx->gcLocalFreeLists = freeLists;
    return freeLists;
}

#endif

void *
js_NewGCThing(JSContext *cx, uintN flags, size_t nbytes)
{
    JSRuntime *rt;
    uintN flindex;
    JSBool doGC;
    JSGCThing *thing;
    uint8 *flagp;
    JSGCArenaList *arenaList;
    JSGCArenaInfo *a;
    uintN thingsLimit;
    JSLocalRootStack *lrs;
#ifdef JS_GCMETER
    JSGCArenaStats *astats;
#endif
#ifdef JS_THREADSAFE
    JSBool gcLocked;
    uintN localMallocBytes;
    JSGCFreeListSet *freeLists;
    JSGCThing **lastptr;
    JSGCThing *tmpthing;
    uint8 *tmpflagp;
    uintN maxFreeThings;         /* max to take from the global free list */
#endif

    JS_ASSERT((flags & GCF_TYPEMASK) != GCX_DOUBLE);
    rt = cx->runtime;
    nbytes = JS_ROUNDUP(nbytes, sizeof(JSGCThing));
    flindex = GC_FREELIST_INDEX(nbytes);

    /* Updates of metering counters here may not be thread-safe. */
    METER(astats = &cx->runtime->gcStats.arenaStats[flindex]);
    METER(astats->alloc++);

#ifdef JS_THREADSAFE
    gcLocked = JS_FALSE;
    JS_ASSERT(cx->thread);
    freeLists = cx->gcLocalFreeLists;
    thing = freeLists->array[flindex];
    localMallocBytes = cx->thread->gcMallocBytes;
    if (thing && rt->gcMaxMallocBytes - rt->gcMallocBytes > localMallocBytes) {
        flagp = thing->flagp;
        freeLists->array[flindex] = thing->next;
        METER(astats->localalloc++);
        goto success;
    }

    JS_LOCK_GC(rt);
    gcLocked = JS_TRUE;

    /* Transfer thread-local counter to global one. */
    if (localMallocBytes != 0) {
        cx->thread->gcMallocBytes = 0;
        if (rt->gcMaxMallocBytes - rt->gcMallocBytes < localMallocBytes)
            rt->gcMallocBytes = rt->gcMaxMallocBytes;
        else
            rt->gcMallocBytes += localMallocBytes;
    }
#endif
    JS_ASSERT(!rt->gcRunning);
    if (rt->gcRunning) {
        METER(rt->gcStats.finalfail++);
        JS_UNLOCK_GC(rt);
        return NULL;
    }

    doGC = (rt->gcMallocBytes >= rt->gcMaxMallocBytes && rt->gcPoke);
#ifdef JS_GC_ZEAL
    doGC = doGC || rt->gcZeal >= 2 || (rt->gcZeal >= 1 && rt->gcPoke);
#endif

    arenaList = &rt->gcArenaList[flindex];
    for (;;) {
        if (doGC && !JS_ON_TRACE(cx)) {
            /*
             * Keep rt->gcLock across the call into js_GC so we don't starve
             * and lose to racing threads who deplete the heap just after
             * js_GC has replenished it (or has synchronized with a racing
             * GC that collected a bunch of garbage).  This unfair scheduling
             * can happen on certain operating systems. For the gory details,
             * see bug 162779 at https://bugzilla.mozilla.org/.
             */
            js_GC(cx, GC_LAST_DITCH);
            METER(astats->retry++);
        }

        /* Try to get thing from the free list. */
        thing = arenaList->freeList;
        if (thing) {
            arenaList->freeList = thing->next;
            flagp = thing->flagp;
            JS_ASSERT(*flagp & GCF_FINAL);

#ifdef JS_THREADSAFE
            /*
             * Refill the local free list by taking several things from the
             * global free list unless we are still at rt->gcMaxMallocBytes
             * barrier or the free list is already populated. The former
             * happens when GC is canceled due to !gcCallback(cx, JSGC_BEGIN)
             * or no gcPoke. The latter is caused via allocating new things
             * in gcCallback(cx, JSGC_END).
             */
            if (rt->gcMallocBytes >= rt->gcMaxMallocBytes)
                break;

            freeLists = EnsureLocalFreeList(cx);
            if (!freeLists)
                goto fail;
            if (freeLists->array[flindex])
                break;

            tmpthing = arenaList->freeList;
            if (tmpthing) {
                maxFreeThings = MAX_THREAD_LOCAL_THINGS;
                do {
                    if (!tmpthing->next)
                        break;
                    tmpthing = tmpthing->next;
                } while (--maxFreeThings != 0);

                freeLists->array[flindex] = arenaList->freeList;
                arenaList->freeList = tmpthing->next;
                tmpthing->next = NULL;
            }
#endif
            break;
        }

        /*
         * Try to allocate things from the last arena. If it is fully used,
         * check if we can allocate a new one and, if we cannot, consider
         * doing a "last ditch" GC unless already tried.
         */
        thingsLimit = THINGS_PER_ARENA(nbytes);
        if (arenaList->lastCount != thingsLimit) {
            JS_ASSERT(arenaList->lastCount < thingsLimit);
            a = arenaList->last;
        } else {
            a = NewGCArena(rt);
            if (!a) {
                if (doGC || JS_ON_TRACE(cx))
                    goto fail;
                doGC = JS_TRUE;
                continue;
            }
            a->list = arenaList;
            a->prev = arenaList->last;
            a->prevUntracedPage = 0;
            a->u.untracedThings = 0;
            arenaList->last = a;
            arenaList->lastCount = 0;
        }

        flagp = THING_FLAGP(a, arenaList->lastCount);
        thing = FLAGP_TO_THING(flagp, nbytes);
        arenaList->lastCount++;

#ifdef JS_THREADSAFE
        /*
         * Refill the local free list by taking free things from the last
         * arena. Prefer to order free things by ascending address in the
         * (unscientific) hope of better cache locality.
         */
        if (rt->gcMallocBytes >= rt->gcMaxMallocBytes)
            break;

        freeLists = EnsureLocalFreeList(cx);
        if (!freeLists)
            goto fail;
        if (freeLists->array[flindex])
            break;
        lastptr = &freeLists->array[flindex];
        maxFreeThings = thingsLimit - arenaList->lastCount;
        if (maxFreeThings > MAX_THREAD_LOCAL_THINGS)
            maxFreeThings = MAX_THREAD_LOCAL_THINGS;
        while (maxFreeThings != 0) {
            --maxFreeThings;

            tmpflagp = THING_FLAGP(a, arenaList->lastCount);
            tmpthing = FLAGP_TO_THING(tmpflagp, nbytes);
            arenaList->lastCount++;
            tmpthing->flagp = tmpflagp;
            *tmpflagp = GCF_FINAL;    /* signifying that thing is free */

            *lastptr = tmpthing;
            lastptr = &tmpthing->next;
        }
        *lastptr = NULL;
#endif
        break;
    }

    /* We successfully allocated the thing. */
#ifdef JS_THREADSAFE
  success:
#endif
    lrs = cx->localRootStack;
    if (lrs) {
        /*
         * If we're in a local root scope, don't set newborn[type] at all, to
         * avoid entraining garbage from it for an unbounded amount of time
         * on this context.  A caller will leave the local root scope and pop
         * this reference, allowing thing to be GC'd if it has no other refs.
         * See JS_EnterLocalRootScope and related APIs.
         */
        if (js_PushLocalRoot(cx, lrs, (jsval) thing) < 0) {
            /*
             * When we fail for a thing allocated through the tail of the last
             * arena, thing's flag byte is not initialized. So to prevent GC
             * accessing the uninitialized flags during the finalization, we
             * always mark the thing as final. See bug 337407.
             */
            *flagp = GCF_FINAL;
            goto fail;
        }
    } else {
        /*
         * No local root scope, so we're stuck with the old, fragile model of
         * depending on a pigeon-hole newborn per type per context.
         */
        cx->weakRoots.newborn[flags & GCF_TYPEMASK] = thing;
    }

    /* We can't fail now, so update flags. */
    *flagp = (uint8)flags;

#ifdef DEBUG_gchist
    gchist[gchpos].lastDitch = doGC;
    gchist[gchpos].freeList = rt->gcArenaList[flindex].freeList;
    if (++gchpos == NGCHIST)
        gchpos = 0;
#endif

    /* This is not thread-safe for thread-local allocations. */
    METER_IF(flags & GCF_LOCK, rt->gcStats.lockborn++);

#ifdef JS_THREADSAFE
    if (gcLocked)
        JS_UNLOCK_GC(rt);
#endif
    JS_COUNT_OPERATION(cx, JSOW_ALLOCATION);
    return thing;

fail:
#ifdef JS_THREADSAFE
    if (gcLocked)
        JS_UNLOCK_GC(rt);
#endif
    METER(astats->fail++);
    if (!JS_ON_TRACE(cx))
        JS_ReportOutOfMemory(cx);
    return NULL;
}

static JSGCDoubleCell *
RefillDoubleFreeList(JSContext *cx)
{
    JSRuntime *rt;
    jsbitmap *doubleFlags, usedBits;
    JSBool didGC = JS_FALSE;
    JSGCArenaInfo *a;
    uintN bit, index;
    JSGCDoubleCell *cell, *list, *lastcell;

    JS_ASSERT(!cx->doubleFreeList);

    rt = cx->runtime;
    JS_LOCK_GC(rt);

    JS_ASSERT(!rt->gcRunning);
    if (rt->gcRunning) {
        METER(rt->gcStats.finalfail++);
        JS_UNLOCK_GC(rt);
        return NULL;
    }

    if (rt->gcMallocBytes >= rt->gcMaxMallocBytes && rt->gcPoke
#ifdef JS_GC_ZEAL
        && (rt->gcZeal >= 2 || (rt->gcZeal >= 1 && rt->gcPoke))
#endif
        ) {
        goto do_gc;
    }

    /*
     * Loop until we find a flag bitmap byte with unset bits indicating free
     * double cells, then set all bits as used and put the cells to the free
     * list for the current context.
     */
    doubleFlags = rt->gcDoubleArenaList.nextDoubleFlags;
    for (;;) {
        if (((jsuword) doubleFlags & GC_ARENA_MASK) ==
            ARENA_INFO_OFFSET) {
            if (doubleFlags == DOUBLE_BITMAP_SENTINEL ||
                !((JSGCArenaInfo *) doubleFlags)->prev) {
                a = NewGCArena(rt);
                if (!a) {
                  do_gc:
                    if (didGC || JS_ON_TRACE(cx)) {
                        METER(rt->gcStats.doubleArenaStats.fail++);
                        JS_UNLOCK_GC(rt);
                        if (!JS_ON_TRACE(cx))
                            JS_ReportOutOfMemory(cx);
                        return NULL;
                    }
                    js_GC(cx, GC_LAST_DITCH);
                    METER(rt->gcStats.doubleArenaStats.retry++);
                    doubleFlags = rt->gcDoubleArenaList.nextDoubleFlags;
                    didGC = JS_TRUE;
                    continue;
                }
                a->list = NULL;
                a->prev = NULL;
                if (doubleFlags == DOUBLE_BITMAP_SENTINEL) {
                    JS_ASSERT(!rt->gcDoubleArenaList.first);
                    rt->gcDoubleArenaList.first = a;
                } else {
                    JS_ASSERT(rt->gcDoubleArenaList.first);
                    ((JSGCArenaInfo *) doubleFlags)->prev = a;
                }
                ClearDoubleArenaFlags(a);
                doubleFlags = DOUBLE_ARENA_BITMAP(a);
                break;
            }
            doubleFlags =
                DOUBLE_ARENA_BITMAP(((JSGCArenaInfo *) doubleFlags)->prev);
        }

        /*
         * When doubleFlags points the last bitmap's word in the arena, its
         * high bits corresponds to non-existing cells. ClearDoubleArenaFlags
         * sets such bits to 1. Thus even for this last word its bit is unset
         * iff the corresponding cell exists and free.
         */
        if (*doubleFlags != (jsbitmap) -1)
            break;
        ++doubleFlags;
    }

    rt->gcDoubleArenaList.nextDoubleFlags = doubleFlags + 1;
    usedBits = *doubleFlags;
    JS_ASSERT(usedBits != (jsbitmap) -1);
    *doubleFlags = (jsbitmap) -1;
    JS_UNLOCK_GC(rt);

    /*
     * Find the index corresponding to the first bit in *doubleFlags. The last
     * bit will have "index + JS_BITS_PER_WORD - 1".
     */
    index = ((uintN) ((jsuword) doubleFlags & GC_ARENA_MASK) -
             DOUBLES_ARENA_BITMAP_OFFSET) * JS_BITS_PER_BYTE;
    cell = (JSGCDoubleCell *) ((jsuword) doubleFlags & ~GC_ARENA_MASK) + index;

    if (usedBits == 0) {
        /* The common case when all doubles from *doubleFlags are free. */
        JS_ASSERT(index + JS_BITS_PER_WORD <= DOUBLES_PER_ARENA);
        list = cell;
        for (lastcell = cell + JS_BITS_PER_WORD - 1; cell != lastcell; ++cell)
            cell->link = cell + 1;
        lastcell->link = NULL;
    } else {
        /*
         * Assemble the free list from free cells from *doubleFlags starting
         * from the tail. In the loop
         *
         *   index + bit >= DOUBLES_PER_ARENA
         *
         * when bit is one of the unused bits. We do not check for such bits
         * explicitly as they must be set and the "if" check filters them out.
         */
        JS_ASSERT(index + JS_BITS_PER_WORD <=
                  DOUBLES_PER_ARENA + UNUSED_DOUBLE_BITMAP_BITS);
        bit = JS_BITS_PER_WORD;
        cell += bit;
        list = NULL;
        do {
            --bit;
            --cell;
            if (!(((jsbitmap) 1 << bit) & usedBits)) {
                JS_ASSERT(index + bit < DOUBLES_PER_ARENA);
                JS_ASSERT_IF(index + bit == DOUBLES_PER_ARENA - 1, !list);
                cell->link = list;
                list = cell;
            }
        } while (bit != 0);
    }
    JS_ASSERT(list);
    JS_COUNT_OPERATION(cx, JSOW_ALLOCATION * JS_BITS_PER_WORD);

    /*
     * We delegate assigning cx->doubleFreeList to js_NewDoubleInRootedValue as
     * it immediately consumes the head of the list.
     */
    return list;
}

JSBool
js_NewDoubleInRootedValue(JSContext *cx, jsdouble d, jsval *vp)
{
#ifdef JS_GCMETER
    JSGCArenaStats *astats;
#endif
    JSGCDoubleCell *cell;

    /* Updates of metering counters here are not thread-safe. */
    METER(astats = &cx->runtime->gcStats.doubleArenaStats);
    METER(astats->alloc++);
    cell = cx->doubleFreeList;
    if (!cell) {
        cell = RefillDoubleFreeList(cx);
        if (!cell) {
            METER(astats->fail++);
            return JS_FALSE;
        }
    } else {
        METER(astats->localalloc++);
    }
    cx->doubleFreeList = cell->link;
    cell->number = d;
    *vp = DOUBLE_TO_JSVAL(&cell->number);
    return JS_TRUE;
}

jsdouble *
js_NewWeaklyRootedDouble(JSContext *cx, jsdouble d)
{
    jsval v;
    jsdouble *dp;

    if (!js_NewDoubleInRootedValue(cx, d, &v))
        return NULL;

    JS_ASSERT(JSVAL_IS_DOUBLE(v));
    dp = JSVAL_TO_DOUBLE(v);
    if (cx->localRootStack) {
        if (js_PushLocalRoot(cx, cx->localRootStack, v) < 0)
            return NULL;
    } else {
        cx->weakRoots.newborn[GCX_DOUBLE] = dp;
    }
    return dp;
}

JSBool
js_AddAsGCBytes(JSContext *cx, size_t sz)
{
    JSRuntime *rt;

    rt = cx->runtime;
    if (rt->gcBytes >= rt->gcMaxBytes ||
        sz > (size_t) (rt->gcMaxBytes - rt->gcBytes)
#ifdef JS_GC_ZEAL
        || rt->gcZeal >= 2 || (rt->gcZeal >= 1 && rt->gcPoke)
#endif
        ) {
        if (JS_ON_TRACE(cx)) {
            JS_UNLOCK_GC(rt);
            return JS_FALSE;
        }
        js_GC(cx, GC_LAST_DITCH);
        if (rt->gcBytes >= rt->gcMaxBytes ||
            sz > (size_t) (rt->gcMaxBytes - rt->gcBytes)) {
            JS_UNLOCK_GC(rt);
            JS_ReportOutOfMemory(cx);
            return JS_FALSE;
        }
    }
    rt->gcBytes += (uint32) sz;
    return JS_TRUE;
}

void
js_RemoveAsGCBytes(JSRuntime *rt, size_t sz)
{
    JS_ASSERT((size_t) rt->gcBytes >= sz);
    rt->gcBytes -= (uint32) sz;
}

/*
 * Shallow GC-things can be locked just by setting the GCF_LOCK bit, because
 * they have no descendants to mark during the GC. Currently the optimization
 * is only used for non-dependant strings.
 */
#define GC_THING_IS_SHALLOW(flagp, thing)                                     \
    ((flagp) &&                                                               \
     ((*(flagp) & GCF_TYPEMASK) >= GCX_EXTERNAL_STRING ||                     \
      ((*(flagp) & GCF_TYPEMASK) == GCX_STRING &&                             \
       !JSSTRING_IS_DEPENDENT((JSString *) (thing)))))

/* This is compatible with JSDHashEntryStub. */
typedef struct JSGCLockHashEntry {
    JSDHashEntryHdr hdr;
    const void      *thing;
    uint32          count;
} JSGCLockHashEntry;

JSBool
js_LockGCThingRT(JSRuntime *rt, void *thing)
{
    JSBool shallow, ok;
    uint8 *flagp;
    JSGCLockHashEntry *lhe;

    if (!thing)
        return JS_TRUE;

    flagp = GetGCThingFlagsOrNull(thing);
    JS_LOCK_GC(rt);
    shallow = GC_THING_IS_SHALLOW(flagp, thing);

    /*
     * Avoid adding a rt->gcLocksHash entry for shallow things until someone
     * nests a lock.
     */
    if (shallow && !(*flagp & GCF_LOCK)) {
        *flagp |= GCF_LOCK;
        METER(rt->gcStats.lock++);
        ok = JS_TRUE;
        goto out;
    }

    if (!rt->gcLocksHash) {
        rt->gcLocksHash = JS_NewDHashTable(JS_DHashGetStubOps(), NULL,
                                           sizeof(JSGCLockHashEntry),
                                           GC_ROOTS_SIZE);
        if (!rt->gcLocksHash) {
            ok = JS_FALSE;
            goto out;
        }
    }

    lhe = (JSGCLockHashEntry *)
          JS_DHashTableOperate(rt->gcLocksHash, thing, JS_DHASH_ADD);
    if (!lhe) {
        ok = JS_FALSE;
        goto out;
    }
    if (!lhe->thing) {
        lhe->thing = thing;
        lhe->count = 1;
    } else {
        JS_ASSERT(lhe->count >= 1);
        lhe->count++;
    }

    METER(rt->gcStats.lock++);
    ok = JS_TRUE;
  out:
    JS_UNLOCK_GC(rt);
    return ok;
}

JSBool
js_UnlockGCThingRT(JSRuntime *rt, void *thing)
{
    uint8 *flagp;
    JSBool shallow;
    JSGCLockHashEntry *lhe;

    if (!thing)
        return JS_TRUE;

    flagp = GetGCThingFlagsOrNull(thing);
    JS_LOCK_GC(rt);
    shallow = GC_THING_IS_SHALLOW(flagp, thing);

    if (shallow && !(*flagp & GCF_LOCK))
        goto out;
    if (!rt->gcLocksHash ||
        (lhe = (JSGCLockHashEntry *)
         JS_DHashTableOperate(rt->gcLocksHash, thing,
                              JS_DHASH_LOOKUP),
             JS_DHASH_ENTRY_IS_FREE(&lhe->hdr))) {
        /* Shallow entry is not in the hash -> clear its lock bit. */
        if (shallow)
            *flagp &= ~GCF_LOCK;
        else
            goto out;
    } else {
        if (--lhe->count != 0)
            goto out;
        JS_DHashTableOperate(rt->gcLocksHash, thing, JS_DHASH_REMOVE);
    }

    rt->gcPoke = JS_TRUE;
    METER(rt->gcStats.unlock++);
  out:
    JS_UNLOCK_GC(rt);
    return JS_TRUE;
}

JS_PUBLIC_API(void)
JS_TraceChildren(JSTracer *trc, void *thing, uint32 kind)
{
    JSObject *obj;
    size_t nslots, i;
    jsval v;
    JSString *str;

    switch (kind) {
      case JSTRACE_OBJECT:
        /* If obj has no map, it must be a newborn. */
        obj = (JSObject *) thing;
        if (!obj->map)
            break;
        if (obj->map->ops->trace) {
            obj->map->ops->trace(trc, obj);
        } else {
            nslots = STOBJ_NSLOTS(obj);
            for (i = 0; i != nslots; ++i) {
                v = STOBJ_GET_SLOT(obj, i);
                if (JSVAL_IS_TRACEABLE(v)) {
                    JS_SET_TRACING_INDEX(trc, "slot", i);
                    JS_CallTracer(trc, JSVAL_TO_TRACEABLE(v),
                                  JSVAL_TRACE_KIND(v));
                }
            }
        }
        break;

      case JSTRACE_STRING:
        str = (JSString *)thing;
        if (JSSTRING_IS_DEPENDENT(str))
            JS_CALL_STRING_TRACER(trc, JSSTRDEP_BASE(str), "base");
        break;

#if JS_HAS_XML_SUPPORT
      case JSTRACE_XML:
        js_TraceXML(trc, (JSXML *)thing);
        break;
#endif
    }
}

/*
 * Number of things covered by a single bit of JSGCArenaInfo.u.untracedThings.
 */
#define THINGS_PER_UNTRACED_BIT(thingSize)                                    \
    JS_HOWMANY(THINGS_PER_ARENA(thingSize), JS_BITS_PER_WORD)

static void
DelayTracingChildren(JSRuntime *rt, uint8 *flagp)
{
    JSGCArenaInfo *a;
    uint32 untracedBitIndex;
    jsuword bit;

    /*
     * Things with children to be traced later are marked with
     * GCF_MARK | GCF_FINAL flags.
     */
    JS_ASSERT((*flagp & (GCF_MARK | GCF_FINAL)) == GCF_MARK);
    *flagp |= GCF_FINAL;

    METER(rt->gcStats.untraced++);
#ifdef DEBUG
    ++rt->gcTraceLaterCount;
    METER_UPDATE_MAX(rt->gcStats.maxuntraced, rt->gcTraceLaterCount);
#endif

    a = FLAGP_TO_ARENA(flagp);
    untracedBitIndex = FLAGP_TO_INDEX(flagp) /
                       THINGS_PER_UNTRACED_BIT(a->list->thingSize);
    JS_ASSERT(untracedBitIndex < JS_BITS_PER_WORD);
    bit = (jsuword)1 << untracedBitIndex;
    if (a->u.untracedThings != 0) {
        JS_ASSERT(rt->gcUntracedArenaStackTop);
        if (a->u.untracedThings & bit) {
            /* bit already covers things with children to trace later. */
            return;
        }
        a->u.untracedThings |= bit;
    } else {
        /*
         * The thing is the first thing with not yet traced children in the
         * whole arena, so push the arena on the stack of arenas with things
         * to be traced later unless the arena has already been pushed. We
         * detect that through checking prevUntracedPage as the field is 0
         * only for not yet pushed arenas. To ensure that
         *   prevUntracedPage != 0
         * even when the stack contains one element, we make prevUntracedPage
         * for the arena at the bottom to point to itself.
         *
         * See comments in TraceDelayedChildren.
         */
        a->u.untracedThings = bit;
        if (a->prevUntracedPage == 0) {
            if (!rt->gcUntracedArenaStackTop) {
                /* Stack was empty, mark the arena as the bottom element. */
                a->prevUntracedPage = ARENA_INFO_TO_PAGE(a);
            } else {
                JS_ASSERT(rt->gcUntracedArenaStackTop->prevUntracedPage != 0);
                a->prevUntracedPage =
                    ARENA_INFO_TO_PAGE(rt->gcUntracedArenaStackTop);
            }
            rt->gcUntracedArenaStackTop = a;
        }
    }
    JS_ASSERT(rt->gcUntracedArenaStackTop);
}

static void
TraceDelayedChildren(JSTracer *trc)
{
    JSRuntime *rt;
    JSGCArenaInfo *a, *aprev;
    uint32 thingSize;
    uint32 thingsPerUntracedBit;
    uint32 untracedBitIndex, thingIndex, indexLimit, endIndex;
    JSGCThing *thing;
    uint8 *flagp;

    rt = trc->context->runtime;
    a = rt->gcUntracedArenaStackTop;
    if (!a) {
        JS_ASSERT(rt->gcTraceLaterCount == 0);
        return;
    }

    for (;;) {
        /*
         * The following assert verifies that the current arena belongs to the
         * untraced stack, since DelayTracingChildren ensures that even for
         * stack's bottom prevUntracedPage != 0 but rather points to itself.
         */
        JS_ASSERT(a->prevUntracedPage != 0);
        JS_ASSERT(rt->gcUntracedArenaStackTop->prevUntracedPage != 0);
        thingSize = a->list->thingSize;
        indexLimit = (a == a->list->last)
                     ? a->list->lastCount
                     : THINGS_PER_ARENA(thingSize);
        thingsPerUntracedBit = THINGS_PER_UNTRACED_BIT(thingSize);

        /*
         * We cannot use do-while loop here as a->u.untracedThings can be zero
         * before the loop as a leftover from the previous iterations. See
         * comments after the loop.
         */
        while (a->u.untracedThings != 0) {
            untracedBitIndex = JS_FLOOR_LOG2W(a->u.untracedThings);
            a->u.untracedThings &= ~((jsuword)1 << untracedBitIndex);
            thingIndex = untracedBitIndex * thingsPerUntracedBit;
            endIndex = thingIndex + thingsPerUntracedBit;

            /*
             * endIndex can go beyond the last allocated thing as the real
             * limit can be "inside" the bit.
             */
            if (endIndex > indexLimit)
                endIndex = indexLimit;
            JS_ASSERT(thingIndex < indexLimit);

            do {
                /*
                 * Skip free or already traced things that share the bit
                 * with untraced ones.
                 */
                flagp = THING_FLAGP(a, thingIndex);
                if ((*flagp & (GCF_MARK|GCF_FINAL)) != (GCF_MARK|GCF_FINAL))
                    continue;
                *flagp &= ~GCF_FINAL;
#ifdef DEBUG
                JS_ASSERT(rt->gcTraceLaterCount != 0);
                --rt->gcTraceLaterCount;
#endif
                thing = FLAGP_TO_THING(flagp, thingSize);
                JS_TraceChildren(trc, thing, MapGCFlagsToTraceKind(*flagp));
            } while (++thingIndex != endIndex);
        }

        /*
         * We finished tracing of all things in the the arena but we can only
         * pop it from the stack if the arena is the stack's top.
         *
         * When JS_TraceChildren from the above calls JS_CallTracer that in
         * turn on low C stack calls DelayTracingChildren and the latter
         * pushes new arenas to the untraced stack, we have to skip popping
         * of this arena until it becomes the top of the stack again.
         */
        if (a == rt->gcUntracedArenaStackTop) {
            aprev = ARENA_PAGE_TO_INFO(a->prevUntracedPage);
            a->prevUntracedPage = 0;
            if (a == aprev) {
                /*
                 * prevUntracedPage points to itself and we reached the
                 * bottom of the stack.
                 */
                break;
            }
            rt->gcUntracedArenaStackTop = a = aprev;
        } else {
            a = rt->gcUntracedArenaStackTop;
        }
    }
    JS_ASSERT(rt->gcUntracedArenaStackTop);
    JS_ASSERT(rt->gcUntracedArenaStackTop->prevUntracedPage == 0);
    rt->gcUntracedArenaStackTop = NULL;
    JS_ASSERT(rt->gcTraceLaterCount == 0);
}

JS_PUBLIC_API(void)
JS_CallTracer(JSTracer *trc, void *thing, uint32 kind)
{
    JSContext *cx;
    JSRuntime *rt;
    JSGCArenaInfo *a;
    uintN index;
    uint8 *flagp;

    JS_ASSERT(thing);
    JS_ASSERT(JS_IS_VALID_TRACE_KIND(kind));
    JS_ASSERT(trc->debugPrinter || trc->debugPrintArg);

    if (!IS_GC_MARKING_TRACER(trc)) {
        trc->callback(trc, thing, kind);
        goto out;
    }

    cx = trc->context;
    rt = cx->runtime;
    JS_ASSERT(rt->gcMarkingTracer == trc);
    JS_ASSERT(rt->gcLevel > 0);

    /*
     * Optimize for string and double as their size is known and their tracing
     * is not recursive.
     */
    switch (kind) {
      case JSTRACE_DOUBLE:
        a = THING_TO_ARENA(thing);
        JS_ASSERT(!a->list);
        if (!a->u.hasMarkedDoubles) {
            ClearDoubleArenaFlags(a);
            a->u.hasMarkedDoubles = JS_TRUE;
        }
        index = DOUBLE_THING_TO_INDEX(thing);
        JS_SET_BIT(DOUBLE_ARENA_BITMAP(a), index);
        goto out;

      case JSTRACE_STRING:
        for (;;) {
            flagp = THING_TO_FLAGP(thing, sizeof(JSGCThing));
            JS_ASSERT((*flagp & GCF_FINAL) == 0);
            JS_ASSERT(kind == MapGCFlagsToTraceKind(*flagp));
            if (!JSSTRING_IS_DEPENDENT((JSString *) thing)) {
                *flagp |= GCF_MARK;
                goto out;
            }
            if (*flagp & GCF_MARK)
                goto out;
            *flagp |= GCF_MARK;
            thing = JSSTRDEP_BASE((JSString *) thing);
        }
        /* NOTREACHED */
    }

    flagp = GetGCThingFlags(thing);
    JS_ASSERT(kind == MapGCFlagsToTraceKind(*flagp));
    if (*flagp & GCF_MARK)
        goto out;

    /*
     * We check for non-final flag only if mark is unset as
     * DelayTracingChildren uses the flag. See comments in the function.
     */
    JS_ASSERT(*flagp != GCF_FINAL);
    *flagp |= GCF_MARK;
    if (!cx->insideGCMarkCallback) {
        /*
         * With JS_GC_ASSUME_LOW_C_STACK defined the mark phase of GC always
         * uses the non-recursive code that otherwise would be called only on
         * a low C stack condition.
         */
#ifdef JS_GC_ASSUME_LOW_C_STACK
# define RECURSION_TOO_DEEP() JS_TRUE
#else
        int stackDummy;
# define RECURSION_TOO_DEEP() (!JS_CHECK_STACK_SIZE(cx, stackDummy))
#endif
        if (RECURSION_TOO_DEEP())
            DelayTracingChildren(rt, flagp);
        else
            JS_TraceChildren(trc, thing, kind);
    } else {
        /*
         * For API compatibility we allow for the callback to assume that
         * after it calls JS_MarkGCThing for the last time, the callback can
         * start to finalize its own objects that are only referenced by
         * unmarked GC things.
         *
         * Since we do not know which call from inside the callback is the
         * last, we ensure that children of all marked things are traced and
         * call TraceDelayedChildren(trc) after tracing the thing.
         *
         * As TraceDelayedChildren unconditionally invokes JS_TraceChildren
         * for the things with untraced children, calling DelayTracingChildren
         * is useless here. Hence we always trace thing's children even with a
         * low native stack.
         */
        cx->insideGCMarkCallback = JS_FALSE;
        JS_TraceChildren(trc, thing, kind);
        TraceDelayedChildren(trc);
        cx->insideGCMarkCallback = JS_TRUE;
    }

  out:
#ifdef DEBUG
    trc->debugPrinter = NULL;
    trc->debugPrintArg = NULL;
#endif
    return;     /* to avoid out: right_curl when DEBUG is not defined */
}

void
js_CallValueTracerIfGCThing(JSTracer *trc, jsval v)
{
    void *thing;
    uint32 kind;

    if (JSVAL_IS_DOUBLE(v) || JSVAL_IS_STRING(v)) {
        thing = JSVAL_TO_TRACEABLE(v);
        kind = JSVAL_TRACE_KIND(v);
        JS_ASSERT(kind == js_GetGCThingTraceKind(JSVAL_TO_GCTHING(v)));
    } else if (JSVAL_IS_OBJECT(v) && v != JSVAL_NULL) {
        /* v can be an arbitrary GC thing reinterpreted as an object. */
        thing = JSVAL_TO_OBJECT(v);
        kind = js_GetGCThingTraceKind(thing);
    } else {
        return;
    }
    JS_CallTracer(trc, thing, kind);
}

static JSDHashOperator
gc_root_traversal(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 num,
                  void *arg)
{
    JSGCRootHashEntry *rhe = (JSGCRootHashEntry *)hdr;
    JSTracer *trc = (JSTracer *)arg;
    jsval *rp = (jsval *)rhe->root;
    jsval v = *rp;

    /* Ignore null object and scalar values. */
    if (!JSVAL_IS_NULL(v) && JSVAL_IS_GCTHING(v)) {
#ifdef DEBUG
        JSBool root_points_to_gcArenaList = JS_FALSE;
        jsuword thing = (jsuword) JSVAL_TO_GCTHING(v);
        JSRuntime *rt;
        uintN i;
        JSGCArenaList *arenaList;
        uint32 thingSize;
        JSGCArenaInfo *a;
        size_t limit;

        rt = trc->context->runtime;
        for (i = 0; i < GC_NUM_FREELISTS; i++) {
            arenaList = &rt->gcArenaList[i];
            thingSize = arenaList->thingSize;
            limit = (size_t) arenaList->lastCount * thingSize;
            for (a = arenaList->last; a; a = a->prev) {
                if (thing - ARENA_INFO_TO_START(a) < limit) {
                    root_points_to_gcArenaList = JS_TRUE;
                    break;
                }
                limit = (size_t) THINGS_PER_ARENA(thingSize) * thingSize;
            }
        }
        if (!root_points_to_gcArenaList) {
            for (a = rt->gcDoubleArenaList.first; a; a = a->prev) {
                if (thing - ARENA_INFO_TO_START(a) <
                    DOUBLES_PER_ARENA * sizeof(jsdouble)) {
                    root_points_to_gcArenaList = JS_TRUE;
                    break;
                }
            }
        }
        if (!root_points_to_gcArenaList && rhe->name) {
            fprintf(stderr,
"JS API usage error: the address passed to JS_AddNamedRoot currently holds an\n"
"invalid jsval.  This is usually caused by a missing call to JS_RemoveRoot.\n"
"The root's name is \"%s\".\n",
                    rhe->name);
        }
        JS_ASSERT(root_points_to_gcArenaList);
#endif
        JS_SET_TRACING_NAME(trc, rhe->name ? rhe->name : "root");
        js_CallValueTracerIfGCThing(trc, v);
    }

    return JS_DHASH_NEXT;
}

static JSDHashOperator
gc_lock_traversal(JSDHashTable *table, JSDHashEntryHdr *hdr, uint32 num,
                  void *arg)
{
    JSGCLockHashEntry *lhe = (JSGCLockHashEntry *)hdr;
    void *thing = (void *)lhe->thing;
    JSTracer *trc = (JSTracer *)arg;
    uint32 traceKind;

    JS_ASSERT(lhe->count >= 1);
    traceKind = js_GetGCThingTraceKind(thing);
    JS_CALL_TRACER(trc, thing, traceKind, "locked object");
    return JS_DHASH_NEXT;
}

#define TRACE_JSVALS(trc, len, vec, name)                                     \
    JS_BEGIN_MACRO                                                            \
    jsval _v, *_vp, *_end;                                                    \
                                                                              \
        for (_vp = vec, _end = _vp + len; _vp < _end; _vp++) {                \
            _v = *_vp;                                                        \
            if (JSVAL_IS_TRACEABLE(_v)) {                                     \
                JS_SET_TRACING_INDEX(trc, name, _vp - (vec));                 \
                JS_CallTracer(trc, JSVAL_TO_TRACEABLE(_v),                    \
                              JSVAL_TRACE_KIND(_v));                          \
            }                                                                 \
        }                                                                     \
    JS_END_MACRO

void
js_TraceStackFrame(JSTracer *trc, JSStackFrame *fp)
{
    uintN nslots, minargs, skip;

    if (fp->callobj)
        JS_CALL_OBJECT_TRACER(trc, fp->callobj, "call");
    if (fp->argsobj)
        JS_CALL_OBJECT_TRACER(trc, fp->argsobj, "arguments");
    if (fp->varobj)
        JS_CALL_OBJECT_TRACER(trc, fp->varobj, "variables");
    if (fp->script) {
        js_TraceScript(trc, fp->script);
        if (fp->regs) {
            /*
             * Don't mark what has not been pushed yet, or what has been
             * popped already.
             */
            nslots = (uintN) (fp->regs->sp - fp->slots);
            TRACE_JSVALS(trc, nslots, fp->slots, "slot");
        }
    } else {
        JS_ASSERT(!fp->slots);
        JS_ASSERT(!fp->regs);
    }

    /* Allow for primitive this parameter due to JSFUN_THISP_* flags. */
    JS_ASSERT(JSVAL_IS_OBJECT((jsval)fp->thisp) ||
              (fp->fun && JSFUN_THISP_FLAGS(fp->fun->flags)));
    JS_CALL_VALUE_TRACER(trc, (jsval)fp->thisp, "this");

    if (fp->callee)
        JS_CALL_OBJECT_TRACER(trc, fp->callee, "callee");

    if (fp->argv) {
        nslots = fp->argc;
        skip = 0;
        if (fp->fun) {
            minargs = FUN_MINARGS(fp->fun);
            if (minargs > nslots)
                nslots = minargs;
            if (!FUN_INTERPRETED(fp->fun)) {
                JS_ASSERT(!(fp->fun->flags & JSFUN_FAST_NATIVE));
                nslots += fp->fun->u.n.extra;
            }
            if (fp->fun->flags & JSFRAME_ROOTED_ARGV)
                skip = 2 + fp->argc;
        }
        TRACE_JSVALS(trc, 2 + nslots - skip, fp->argv - 2 + skip, "operand");
    }

    JS_CALL_VALUE_TRACER(trc, fp->rval, "rval");
    if (fp->scopeChain)
        JS_CALL_OBJECT_TRACER(trc, fp->scopeChain, "scope chain");
    if (fp->sharpArray)
        JS_CALL_OBJECT_TRACER(trc, fp->sharpArray, "sharp array");

    if (fp->xmlNamespace)
        JS_CALL_OBJECT_TRACER(trc, fp->xmlNamespace, "xmlNamespace");
}

static void
TraceWeakRoots(JSTracer *trc, JSWeakRoots *wr)
{
    uint32 i;
    void *thing;

#ifdef DEBUG
    static const char *weakRootNames[JSTRACE_LIMIT] = {
        "newborn object",
        "newborn double",
        "newborn string",
        "newborn xml"
    };
#endif

    for (i = 0; i != JSTRACE_LIMIT; i++) {
        thing = wr->newborn[i];
        if (thing)
            JS_CALL_TRACER(trc, thing, i, weakRootNames[i]);
    }
    JS_ASSERT(i == GCX_EXTERNAL_STRING);
    for (; i != GCX_NTYPES; ++i) {
        thing = wr->newborn[i];
        if (thing) {
            JS_SET_TRACING_INDEX(trc, "newborn external string",
                                 i - GCX_EXTERNAL_STRING);
            JS_CallTracer(trc, thing, JSTRACE_STRING);
        }
    }

    JS_CALL_VALUE_TRACER(trc, wr->lastAtom, "lastAtom");
    JS_SET_TRACING_NAME(trc, "lastInternalResult");
    js_CallValueTracerIfGCThing(trc, wr->lastInternalResult);
}

JS_FRIEND_API(void)
js_TraceContext(JSTracer *trc, JSContext *acx)
{
    JSStackFrame *fp, *nextChain;
    JSStackHeader *sh;
    JSTempValueRooter *tvr;

    if (IS_GC_MARKING_TRACER(trc)) {

#define FREE_OLD_ARENAS(pool)                                                 \
        JS_BEGIN_MACRO                                                        \
            int64 _age;                                                       \
            JSArena * _a = (pool).current;                                    \
            if (_a == (pool).first.next &&                                    \
                _a->avail == _a->base + sizeof(int64)) {                      \
                _age = JS_Now() - *(int64 *) _a->base;                        \
                if (_age > (int64) acx->runtime->gcEmptyArenaPoolLifespan *   \
                           1000)                                              \
                    JS_FreeArenaPool(&(pool));                                \
            }                                                                 \
        JS_END_MACRO

#ifdef JS_THREADSAFE
        js_RevokeGCLocalFreeLists(acx);
#endif

        /*
         * Release the stackPool's arenas if the stackPool has existed for
         * longer than the limit specified by gcEmptyArenaPoolLifespan.
         */
        FREE_OLD_ARENAS(acx->stackPool);

        /*
         * Release the regexpPool's arenas based on the same criterion as for
         * the stackPool.
         */
        FREE_OLD_ARENAS(acx->regexpPool);

        /*
         * Clear the double free list to release all the pre-allocated doubles.
         */
        acx->doubleFreeList = NULL;
    }

    /*
     * Iterate frame chain and dormant chains.
     *
     * (NB: see comment on this whole "dormant" thing in js_Execute.)
     */
    fp = acx->fp;
    nextChain = acx->dormantFrameChain;
    if (!fp)
        goto next_chain;

    /* The top frame must not be dormant. */
    JS_ASSERT(!fp->dormantNext);
    for (;;) {
        do {
            js_TraceStackFrame(trc, fp);
        } while ((fp = fp->down) != NULL);

      next_chain:
        if (!nextChain)
            break;
        fp = nextChain;
        nextChain = nextChain->dormantNext;
    }

    /* Mark other roots-by-definition in acx. */
    if (acx->globalObject)
        JS_CALL_OBJECT_TRACER(trc, acx->globalObject, "global object");
    TraceWeakRoots(trc, &acx->weakRoots);
    if (acx->throwing) {
        JS_CALL_VALUE_TRACER(trc, acx->exception, "exception");
    } else {
        /* Avoid keeping GC-ed junk stored in JSContext.exception. */
        acx->exception = JSVAL_NULL;
    }
#if JS_HAS_LVALUE_RETURN
    if (acx->rval2set)
        JS_CALL_VALUE_TRACER(trc, acx->rval2, "rval2");
#endif

    for (sh = acx->stackHeaders; sh; sh = sh->down) {
        METER(trc->context->runtime->gcStats.stackseg++);
        METER(trc->context->runtime->gcStats.segslots += sh->nslots);
        TRACE_JSVALS(trc, sh->nslots, JS_STACK_SEGMENT(sh), "stack");
    }

    if (acx->localRootStack)
        js_TraceLocalRoots(trc, acx->localRootStack);

    for (tvr = acx->tempValueRooters; tvr; tvr = tvr->down) {
        switch (tvr->count) {
          case JSTVU_SINGLE:
            JS_SET_TRACING_NAME(trc, "tvr->u.value");
            js_CallValueTracerIfGCThing(trc, tvr->u.value);
            break;
          case JSTVU_TRACE:
            tvr->u.trace(trc, tvr);
            break;
          case JSTVU_SPROP:
            TRACE_SCOPE_PROPERTY(trc, tvr->u.sprop);
            break;
          case JSTVU_WEAK_ROOTS:
            TraceWeakRoots(trc, tvr->u.weakRoots);
            break;
          case JSTVU_PARSE_CONTEXT:
            js_TraceParseContext(trc, tvr->u.parseContext);
            break;
          case JSTVU_SCRIPT:
            js_TraceScript(trc, tvr->u.script);
            break;
          default:
            JS_ASSERT(tvr->count >= 0);
            TRACE_JSVALS(trc, tvr->count, tvr->u.array, "tvr->u.array");
        }
    }

    if (acx->sharpObjectMap.depth > 0)
        js_TraceSharpMap(trc, &acx->sharpObjectMap);
}

void
js_TraceTraceMonitor(JSTracer *trc, JSTraceMonitor *tm)
{
    if (IS_GC_MARKING_TRACER(trc)) {
        tm->recoveryDoublePoolPtr = tm->recoveryDoublePool;
        /* Make sure the global shape changes and will force a flush
           of the code cache. */
        tm->globalShape = -1; 
    }
}

void
js_TraceRuntime(JSTracer *trc, JSBool allAtoms)
{
    JSRuntime *rt = trc->context->runtime;
    JSContext *iter, *acx;

    JS_DHashTableEnumerate(&rt->gcRootsHash, gc_root_traversal, trc);
    if (rt->gcLocksHash)
        JS_DHashTableEnumerate(rt->gcLocksHash, gc_lock_traversal, trc);
    js_TraceAtomState(trc, allAtoms);
    js_TraceNativeEnumerators(trc);
    js_TraceRuntimeNumberState(trc);

    iter = NULL;
    while ((acx = js_ContextIterator(rt, JS_TRUE, &iter)) != NULL)
        js_TraceContext(trc, acx);

    if (rt->gcExtraRootsTraceOp)
        rt->gcExtraRootsTraceOp(trc, rt->gcExtraRootsData);

#ifdef JS_THREADSAFE
    /* Trace the loop table(s) which can contain pointers to code objects. */
   while ((acx = js_ContextIterator(rt, JS_FALSE, &iter)) != NULL) {
       if (!acx->thread)
           continue;
       js_TraceTraceMonitor(trc, &acx->thread->traceMonitor);
   }
#else
   js_TraceTraceMonitor(trc, &rt->traceMonitor);
#endif
}

static void
ProcessSetSlotRequest(JSContext *cx, JSSetSlotRequest *ssr)
{
    JSObject *obj, *pobj;
    uint32 slot;

    obj = ssr->obj;
    pobj = ssr->pobj;
    slot = ssr->slot;

    while (pobj) {
        pobj = js_GetWrappedObject(cx, pobj);
        if (pobj == obj) {
            ssr->errnum = JSMSG_CYCLIC_VALUE;
            return;
        }
        pobj = JSVAL_TO_OBJECT(STOBJ_GET_SLOT(pobj, slot));
    }

    pobj = ssr->pobj;

    if (slot == JSSLOT_PROTO && OBJ_IS_NATIVE(obj)) {
        JSScope *scope, *newscope;
        JSObject *oldproto;

        /* Check to see whether obj shares its prototype's scope. */
        scope = OBJ_SCOPE(obj);
        oldproto = STOBJ_GET_PROTO(obj);
        if (oldproto && OBJ_SCOPE(oldproto) == scope) {
            /* Either obj needs a new empty scope, or it should share pobj's. */
            if (!pobj ||
                !OBJ_IS_NATIVE(pobj) ||
                OBJ_GET_CLASS(cx, pobj) != STOBJ_GET_CLASS(oldproto)) {
                /*
                 * With no proto and no scope of its own, obj is truly empty.
                 *
                 * If pobj is not native, obj needs its own empty scope -- it
                 * should not continue to share oldproto's scope once oldproto
                 * is not on obj's prototype chain.  That would put properties
                 * from oldproto's scope ahead of properties defined by pobj,
                 * in lookup order.
                 *
                 * If pobj's class differs from oldproto's, we may need a new
                 * scope to handle differences in private and reserved slots,
                 * so we suboptimally but safely make one.
                 */
                if (!js_GetMutableScope(cx, obj)) {
                    ssr->errnum = JSMSG_OUT_OF_MEMORY;
                    return;
                }
            } else if (OBJ_SCOPE(pobj) != scope) {
                newscope = (JSScope *) js_HoldObjectMap(cx, pobj->map);
                obj->map = &newscope->map;
                js_DropObjectMap(cx, &scope->map, obj);
                JS_TRANSFER_SCOPE_LOCK(cx, scope, newscope);
            }
        }

        /*
         * Regenerate property cache shape ids for all of the scopes along the
         * old prototype chain, in case any property cache entries were filled
         * by looking up starting from obj.
         */
        while (oldproto && OBJ_IS_NATIVE(oldproto)) {
            scope = OBJ_SCOPE(oldproto);
            SCOPE_MAKE_UNIQUE_SHAPE(cx, scope);
            oldproto = STOBJ_GET_PROTO(scope->object);
        }
    }

    /* Finally, do the deed. */
    STOBJ_SET_SLOT(obj, slot, OBJECT_TO_JSVAL(pobj));
}

static void
DestroyScriptsToGC(JSContext *cx, JSScript **listp)
{
    JSScript *script;

    while ((script = *listp) != NULL) {
        *listp = script->u.nextToGC;
        script->u.nextToGC = NULL;
        js_DestroyScript(cx, script);
    }
}

/*
 * The gckind flag bit GC_LOCK_HELD indicates a call from js_NewGCThing with
 * rt->gcLock already held, so the lock should be kept on return.
 */
void
js_GC(JSContext *cx, JSGCInvocationKind gckind)
{
    JSRuntime *rt;
    JSBool keepAtoms;
    JSGCCallback callback;
    uintN i, type;
    JSTracer trc;
    uint32 thingSize, indexLimit;
    JSGCArenaInfo *a, **ap, *emptyArenas;
    uint8 flags, *flagp;
    JSGCThing *thing, *freeList;
    JSGCArenaList *arenaList;
    JSBool allClear;
#ifdef JS_THREADSAFE
    uint32 requestDebit;
    JSContext *acx, *iter;
#endif
#ifdef JS_GCMETER
    uint32 nlivearenas, nkilledarenas, nthings;
#endif

    JS_ASSERT_IF(gckind == GC_LAST_DITCH, !JS_ON_TRACE(cx));
    rt = cx->runtime;
#ifdef JS_THREADSAFE
    /* Avoid deadlock. */
    JS_ASSERT(!JS_IS_RUNTIME_LOCKED(rt));
#endif

    if (gckind & GC_KEEP_ATOMS) {
        /*
         * The set slot request and last ditch GC kinds preserve all atoms and
         * weak roots.
         */
        keepAtoms = JS_TRUE;
    } else {
        /* Keep atoms when a suspended compile is running on another context. */
        keepAtoms = (rt->gcKeepAtoms != 0);
        JS_CLEAR_WEAK_ROOTS(&cx->weakRoots);
    }

    /*
     * Don't collect garbage if the runtime isn't up, and cx is not the last
     * context in the runtime.  The last context must force a GC, and nothing
     * should suppress that final collection or there may be shutdown leaks,
     * or runtime bloat until the next context is created.
     */
    if (rt->state != JSRTS_UP && gckind != GC_LAST_CONTEXT)
        return;

  restart_at_beginning:
    /*
     * Let the API user decide to defer a GC if it wants to (unless this
     * is the last context).  Invoke the callback regardless. Sample the
     * callback in case we are freely racing with a JS_SetGCCallback{,RT} on
     * another thread.
     */
    if (gckind != GC_SET_SLOT_REQUEST && (callback = rt->gcCallback)) {
        JSBool ok;

        if (gckind & GC_LOCK_HELD)
            JS_UNLOCK_GC(rt);
        ok = callback(cx, JSGC_BEGIN);
        if (gckind & GC_LOCK_HELD)
            JS_LOCK_GC(rt);
        if (!ok && gckind != GC_LAST_CONTEXT) {
            /*
             * It's possible that we've looped back to this code from the 'goto
             * restart_at_beginning' below in the GC_SET_SLOT_REQUEST code and
             * that rt->gcLevel is now 0. Don't return without notifying!
             */
            if (rt->gcLevel == 0 && (gckind & GC_LOCK_HELD))
                JS_NOTIFY_GC_DONE(rt);
            return;
        }
    }

    /* Lock out other GC allocator and collector invocations. */
    if (!(gckind & GC_LOCK_HELD))
        JS_LOCK_GC(rt);

    METER(rt->gcStats.poke++);
    rt->gcPoke = JS_FALSE;

#ifdef JS_THREADSAFE
    JS_ASSERT(cx->thread->id == js_CurrentThreadId());

    /* Bump gcLevel and return rather than nest on this thread. */
    if (rt->gcThread == cx->thread) {
        JS_ASSERT(rt->gcLevel > 0);
        rt->gcLevel++;
        METER_UPDATE_MAX(rt->gcStats.maxlevel, rt->gcLevel);
        if (!(gckind & GC_LOCK_HELD))
            JS_UNLOCK_GC(rt);
        return;
    }

    /*
     * If we're in one or more requests (possibly on more than one context)
     * running on the current thread, indicate, temporarily, that all these
     * requests are inactive.  If cx->thread is NULL, then cx is not using
     * the request model, and does not contribute to rt->requestCount.
     */
    requestDebit = 0;
    if (cx->thread) {
        JSCList *head, *link;

        /*
         * Check all contexts on cx->thread->contextList for active requests,
         * counting each such context against requestDebit.
         */
        head = &cx->thread->contextList;
        for (link = head->next; link != head; link = link->next) {
            acx = CX_FROM_THREAD_LINKS(link);
            JS_ASSERT(acx->thread == cx->thread);
            if (acx->requestDepth)
                requestDebit++;
        }
    } else {
        /*
         * We assert, but check anyway, in case someone is misusing the API.
         * Avoiding the loop over all of rt's contexts is a win in the event
         * that the GC runs only on request-less contexts with null threads,
         * in a special thread such as might be used by the UI/DOM/Layout
         * "mozilla" or "main" thread in Mozilla-the-browser.
         */
        JS_ASSERT(cx->requestDepth == 0);
        if (cx->requestDepth)
            requestDebit = 1;
    }
    if (requestDebit) {
        JS_ASSERT(requestDebit <= rt->requestCount);
        rt->requestCount -= requestDebit;
        if (rt->requestCount == 0)
            JS_NOTIFY_REQUEST_DONE(rt);
    }

    /* If another thread is already in GC, don't attempt GC; wait instead. */
    if (rt->gcLevel > 0) {
        /* Bump gcLevel to restart the current GC, so it finds new garbage. */
        rt->gcLevel++;
        METER_UPDATE_MAX(rt->gcStats.maxlevel, rt->gcLevel);

        /* Wait for the other thread to finish, then resume our request. */
        while (rt->gcLevel > 0)
            JS_AWAIT_GC_DONE(rt);
        if (requestDebit)
            rt->requestCount += requestDebit;
        if (!(gckind & GC_LOCK_HELD))
            JS_UNLOCK_GC(rt);
        return;
    }

    /* No other thread is in GC, so indicate that we're now in GC. */
    rt->gcLevel = 1;
    rt->gcThread = cx->thread;

    /* Wait for all other requests to finish. */
    while (rt->requestCount > 0)
        JS_AWAIT_REQUEST_DONE(rt);

#else  /* !JS_THREADSAFE */

    /* Bump gcLevel and return rather than nest; the outer gc will restart. */
    rt->gcLevel++;
    METER_UPDATE_MAX(rt->gcStats.maxlevel, rt->gcLevel);
    if (rt->gcLevel > 1)
        return;

#endif /* !JS_THREADSAFE */

    /*
     * Set rt->gcRunning here within the GC lock, and after waiting for any
     * active requests to end, so that new requests that try to JS_AddRoot,
     * JS_RemoveRoot, or JS_RemoveRootRT block in JS_BeginRequest waiting for
     * rt->gcLevel to drop to zero, while request-less calls to the *Root*
     * APIs block in js_AddRoot or js_RemoveRoot (see above in this file),
     * waiting for GC to finish.
     */
    rt->gcRunning = JS_TRUE;

    if (gckind == GC_SET_SLOT_REQUEST) {
        JSSetSlotRequest *ssr;

        while ((ssr = rt->setSlotRequests) != NULL) {
            rt->setSlotRequests = ssr->next;
            JS_UNLOCK_GC(rt);
            ssr->next = NULL;
            ProcessSetSlotRequest(cx, ssr);
            JS_LOCK_GC(rt);
        }

        /*
         * We assume here that killing links to parent and prototype objects
         * does not create garbage (such objects typically are long-lived and
         * widely shared, e.g. global objects, Function.prototype, etc.). We
         * collect garbage only if a racing thread attempted GC and is waiting
         * for us to finish (gcLevel > 1) or if someone already poked us.
         */
        if (rt->gcLevel == 1 && !rt->gcPoke)
            goto done_running;

        rt->gcLevel = 0;
        rt->gcPoke = JS_FALSE;
        rt->gcRunning = JS_FALSE;
#ifdef JS_THREADSAFE
        rt->gcThread = NULL;
        rt->requestCount += requestDebit;
#endif
        gckind = GC_LOCK_HELD;
        goto restart_at_beginning;
    }

    JS_UNLOCK_GC(rt);

#ifdef JS_TRACER
    if (JS_ON_TRACE(cx))
        goto out;
#endif

    /* Reset malloc counter. */
    rt->gcMallocBytes = 0;

#ifdef JS_DUMP_SCOPE_METERS
  { extern void js_DumpScopeMeters(JSRuntime *rt);
    js_DumpScopeMeters(rt);
  }
#endif

    /* Clear property and JIT oracle caches (only for cx->thread if JS_THREADSAFE). */
    js_FlushPropertyCache(cx);
#ifdef JS_TRACER
    js_FlushJITOracle(cx);
#endif

    /* Destroy eval'ed scripts. */
    DestroyScriptsToGC(cx, &JS_SCRIPTS_TO_GC(cx));

#ifdef JS_THREADSAFE
    /*
     * Clear thread-based caches. To avoid redundant clearing we unroll the
     * current thread's step.
     *
     * In case a JSScript wrapped within an object was finalized, we null
     * acx->thread->gsnCache.script and finish the cache's hashtable. Note
     * that js_DestroyScript, called from script_finalize, will have already
     * cleared cx->thread->gsnCache above during finalization, so we don't
     * have to here.
     */
    iter = NULL;
    while ((acx = js_ContextIterator(rt, JS_FALSE, &iter)) != NULL) {
        if (!acx->thread || acx->thread == cx->thread)
            continue;
        GSN_CACHE_CLEAR(&acx->thread->gsnCache);
        js_FlushPropertyCache(acx);
#ifdef JS_TRACER
        js_FlushJITOracle(acx);
#endif
        DestroyScriptsToGC(cx, &acx->thread->scriptsToGC);
    }
#else
    /* The thread-unsafe case just has to clear the runtime's GSN cache. */
    GSN_CACHE_CLEAR(&rt->gsnCache);
#endif

  restart:
    rt->gcNumber++;
    JS_ASSERT(!rt->gcUntracedArenaStackTop);
    JS_ASSERT(rt->gcTraceLaterCount == 0);

    /* Reset the property cache's type id generator so we can compress ids. */
    rt->shapeGen = 0;

    /*
     * Mark phase.
     */
    JS_TRACER_INIT(&trc, cx, NULL);
    rt->gcMarkingTracer = &trc;
    JS_ASSERT(IS_GC_MARKING_TRACER(&trc));

    for (a = rt->gcDoubleArenaList.first; a; a = a->prev)
        a->u.hasMarkedDoubles = JS_FALSE;

    js_TraceRuntime(&trc, keepAtoms);
    js_MarkScriptFilenames(rt, keepAtoms);

    /*
     * Mark children of things that caused too deep recursion during the above
     * tracing.
     */
    TraceDelayedChildren(&trc);

    JS_ASSERT(!cx->insideGCMarkCallback);
    if (rt->gcCallback) {
        cx->insideGCMarkCallback = JS_TRUE;
        (void) rt->gcCallback(cx, JSGC_MARK_END);
        JS_ASSERT(cx->insideGCMarkCallback);
        cx->insideGCMarkCallback = JS_FALSE;
    }
    JS_ASSERT(rt->gcTraceLaterCount == 0);

    rt->gcMarkingTracer = NULL;

    /*
     * Sweep phase.
     *
     * Finalize as we sweep, outside of rt->gcLock but with rt->gcRunning set
     * so that any attempt to allocate a GC-thing from a finalizer will fail,
     * rather than nest badly and leave the unmarked newborn to be swept.
     *
     * We first sweep atom state so we can use js_IsAboutToBeFinalized on
     * JSString or jsdouble held in a hashtable to check if the hashtable
     * entry can be freed. Note that even after the entry is freed, JSObject
     * finalizers can continue to access the corresponding jsdouble* and
     * JSString* assuming that they are unique. This works since the
     * atomization API must not be called during GC.
     */
    js_SweepAtomState(cx);

    /* Finalize iterator states before the objects they iterate over. */
    CloseNativeIterators(cx);

    /* Finalize watch points associated with unreachable objects. */
    js_SweepWatchPoints(cx);

#ifdef DEBUG
    /* Save the pre-sweep count of scope-mapped properties. */
    rt->liveScopePropsPreSweep = rt->liveScopeProps;
#endif

    /*
     * Here we need to ensure that JSObject instances are finalized before GC-
     * allocated JSString and jsdouble instances so object's finalizer can
     * access them even if they will be freed. For that we simply finalize the
     * list containing JSObject first since the static assert at the beginning
     * of the file guarantees that JSString and jsdouble instances are
     * allocated from a different list.
     */
    emptyArenas = NULL;
    for (i = 0; i < GC_NUM_FREELISTS; i++) {
        arenaList = &rt->gcArenaList[i == 0
                                     ? GC_FREELIST_INDEX(sizeof(JSObject))
                                     : i == GC_FREELIST_INDEX(sizeof(JSObject))
                                     ? 0
                                     : i];
        ap = &arenaList->last;
        if (!(a = *ap))
            continue;

        JS_ASSERT(arenaList->lastCount > 0);
        arenaList->freeList = NULL;
        freeList = NULL;
        thingSize = arenaList->thingSize;
        indexLimit = THINGS_PER_ARENA(thingSize);
        flagp = THING_FLAGP(a, arenaList->lastCount - 1);
        METER((nlivearenas = 0, nkilledarenas = 0, nthings = 0));
        for (;;) {
            JS_ASSERT(a->prevUntracedPage == 0);
            JS_ASSERT(a->u.untracedThings == 0);
            allClear = JS_TRUE;
            do {
                flags = *flagp;
                if (flags & (GCF_MARK | GCF_LOCK)) {
                    *flagp &= ~GCF_MARK;
                    allClear = JS_FALSE;
                    METER(nthings++);
                } else {
                    thing = FLAGP_TO_THING(flagp, thingSize);
                    if (!(flags & GCF_FINAL)) {
                        /*
                         * Call the finalizer with GCF_FINAL ORed into flags.
                         */
                        *flagp = (uint8)(flags | GCF_FINAL);
                        type = flags & GCF_TYPEMASK;
                        switch (type) {
                          case GCX_OBJECT:
                            js_FinalizeObject(cx, (JSObject *) thing);
                            break;
                          case GCX_DOUBLE:
                            /* Do nothing. */
                            break;
#if JS_HAS_XML_SUPPORT
                          case GCX_XML:
                            js_FinalizeXML(cx, (JSXML *) thing);
                            break;
#endif
                          default:
                            JS_ASSERT(type == GCX_STRING ||
                                      type - GCX_EXTERNAL_STRING <
                                      GCX_NTYPES - GCX_EXTERNAL_STRING);
                            js_FinalizeStringRT(rt, (JSString *) thing,
                                                (intN) (type -
                                                        GCX_EXTERNAL_STRING),
                                                cx);
                            break;
                        }
#ifdef DEBUG
                        memset(thing, JS_FREE_PATTERN, thingSize);
#endif
                    }
                    thing->flagp = flagp;
                    thing->next = freeList;
                    freeList = thing;
                }
            } while (++flagp != THING_FLAGS_END(a));

            if (allClear) {
                /*
                 * Forget just assembled free list head for the arena and
                 * add the arena itself to the destroy list.
                 */
                freeList = arenaList->freeList;
                if (a == arenaList->last)
                    arenaList->lastCount = (uint16) indexLimit;
                *ap = a->prev;
                a->prev = emptyArenas;
                emptyArenas = a;
                METER(nkilledarenas++);
            } else {
                arenaList->freeList = freeList;
                ap = &a->prev;
                METER(nlivearenas++);
            }
            if (!(a = *ap))
                break;
            flagp = THING_FLAGP(a, indexLimit - 1);
        }

        /*
         * We use arenaList - &rt->gcArenaList[0], not i, as the stat index
         * due to the enumeration reorder at the beginning of the loop.
         */
        METER(UpdateArenaStats(&rt->gcStats.arenaStats[arenaList -
                                                       &rt->gcArenaList[0]],
                               nlivearenas, nkilledarenas, nthings));
    }

#ifdef JS_THREADSAFE
    /*
     * Release all but two free list sets to avoid allocating a new set in
     * js_NewGCThing.
     */
    TrimGCFreeListsPool(rt, 2);
#endif

    ap = &rt->gcDoubleArenaList.first;
    METER((nlivearenas = 0, nkilledarenas = 0, nthings = 0));
    while ((a = *ap) != NULL) {
        if (!a->u.hasMarkedDoubles) {
            /* No marked double values in the arena. */
            *ap = a->prev;
            a->prev = emptyArenas;
            emptyArenas = a;
            METER(nkilledarenas++);
        } else {
            ap = &a->prev;
#ifdef JS_GCMETER
            for (i = 0; i != DOUBLES_PER_ARENA; ++i) {
                if (IsMarkedDouble(a, index))
                    METER(nthings++);
            }
            METER(nlivearenas++);
#endif
        }
    }
    METER(UpdateArenaStats(&rt->gcStats.doubleArenaStats,
                           nlivearenas, nkilledarenas, nthings));
    rt->gcDoubleArenaList.nextDoubleFlags =
        rt->gcDoubleArenaList.first
        ? DOUBLE_ARENA_BITMAP(rt->gcDoubleArenaList.first)
        : DOUBLE_BITMAP_SENTINEL;

    /*
     * Sweep the runtime's property tree after finalizing objects, in case any
     * had watchpoints referencing tree nodes.
     */
    js_SweepScopeProperties(cx);

    /*
     * Sweep script filenames after sweeping functions in the generic loop
     * above. In this way when a scripted function's finalizer destroys the
     * script and calls rt->destroyScriptHook, the hook can still access the
     * script's filename. See bug 323267.
     */
    js_SweepScriptFilenames(rt);

    /*
     * Destroy arenas after we finished the sweeping sofinalizers can safely
     * use js_IsAboutToBeFinalized().
     */
    DestroyGCArenas(rt, emptyArenas);

    if (rt->gcCallback)
        (void) rt->gcCallback(cx, JSGC_FINALIZE_END);
#ifdef DEBUG_srcnotesize
  { extern void DumpSrcNoteSizeHist();
    DumpSrcNoteSizeHist();
    printf("GC HEAP SIZE %lu\n", (unsigned long)rt->gcBytes);
  }
#endif

#ifdef JS_SCOPE_DEPTH_METER
  { static FILE *fp;
    if (!fp)
        fp = fopen("/tmp/scopedepth.stats", "w");

    if (fp) {
        JS_DumpBasicStats(&rt->protoLookupDepthStats, "proto-lookup depth", fp);
        JS_DumpBasicStats(&rt->scopeSearchDepthStats, "scope-search depth", fp);
        JS_DumpBasicStats(&rt->hostenvScopeDepthStats, "hostenv scope depth", fp);
        JS_DumpBasicStats(&rt->lexicalScopeDepthStats, "lexical scope depth", fp);

        putc('\n', fp);
        fflush(fp);
    }
  }
#endif /* JS_SCOPE_DEPTH_METER */

#ifdef JS_DUMP_LOOP_STATS
  { static FILE *lsfp;
    if (!lsfp)
        lsfp = fopen("/tmp/loopstats", "w");
    if (lsfp) {
        JS_DumpBasicStats(&rt->loopStats, "loops", lsfp);
        fflush(lsfp);
    }
  }
#endif /* JS_DUMP_LOOP_STATS */

#ifdef JS_TRACER
out:
#endif
    JS_LOCK_GC(rt);

    /*
     * We want to restart GC if js_GC was called recursively or if any of the
     * finalizers called js_RemoveRoot or js_UnlockGCThingRT.
     */
    if (rt->gcLevel > 1 || rt->gcPoke) {
        rt->gcLevel = 1;
        rt->gcPoke = JS_FALSE;
        JS_UNLOCK_GC(rt);
        goto restart;
    }

    if (rt->shapeGen >= SHAPE_OVERFLOW_BIT - 1) {
        /*
         * FIXME bug 440834: The shape id space has overflowed. Currently we
         * cope badly with this. Every call to js_GenerateShape does GC, and
         * we never re-enable the property cache.
         */
        js_DisablePropertyCache(cx);
#ifdef JS_THREADSAFE
        iter = NULL;
        while ((acx = js_ContextIterator(rt, JS_FALSE, &iter)) != NULL) {
            if (!acx->thread || acx->thread == cx->thread)
                continue;
            js_DisablePropertyCache(acx);
        }
#endif
    }

    rt->gcLastBytes = rt->gcBytes;
  done_running:
    rt->gcLevel = 0;
    rt->gcRunning = JS_FALSE;

#ifdef JS_THREADSAFE
    /* If we were invoked during a request, pay back the temporary debit. */
    if (requestDebit)
        rt->requestCount += requestDebit;
    rt->gcThread = NULL;
    JS_NOTIFY_GC_DONE(rt);

    /*
     * Unlock unless we have GC_LOCK_HELD which requires locked GC on return.
     */
    if (!(gckind & GC_LOCK_HELD))
        JS_UNLOCK_GC(rt);
#endif

    /*
     * Execute JSGC_END callback outside the lock. Again, sample the callback
     * pointer in case it changes, since we are outside of the GC vs. requests
     * interlock mechanism here.
     */
    if (gckind != GC_SET_SLOT_REQUEST && (callback = rt->gcCallback)) {
        JSWeakRoots savedWeakRoots;
        JSTempValueRooter tvr;

        if (gckind & GC_KEEP_ATOMS) {
            /*
             * We allow JSGC_END implementation to force a full GC or allocate
             * new GC things. Thus we must protect the weak roots from garbage
             * collection and overwrites.
             */
            savedWeakRoots = cx->weakRoots;
            JS_PUSH_TEMP_ROOT_WEAK_COPY(cx, &savedWeakRoots, &tvr);
            JS_KEEP_ATOMS(rt);
            JS_UNLOCK_GC(rt);
        }

        (void) callback(cx, JSGC_END);

        if (gckind & GC_KEEP_ATOMS) {
            JS_LOCK_GC(rt);
            JS_UNKEEP_ATOMS(rt);
            JS_POP_TEMP_ROOT(cx, &tvr);
        } else if (gckind == GC_LAST_CONTEXT && rt->gcPoke) {
            /*
             * On shutdown iterate until JSGC_END callback stops creating
             * garbage.
             */
            goto restart_at_beginning;
        }
    }
}

void
js_UpdateMallocCounter(JSContext *cx, size_t nbytes)
{
    uint32 *pbytes, bytes;

#ifdef JS_THREADSAFE
    pbytes = &cx->thread->gcMallocBytes;
#else
    pbytes = &cx->runtime->gcMallocBytes;
#endif
    bytes = *pbytes;
    *pbytes = ((uint32)-1 - bytes <= nbytes) ? (uint32)-1 : bytes + nbytes;
}
