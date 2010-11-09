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

#ifndef jsarena_h___
#define jsarena_h___
/*
 * Lifetime-based fast allocation, inspired by much prior art, including
 * "Fast Allocation and Deallocation of Memory Based on Object Lifetimes"
 * David R. Hanson, Software -- Practice and Experience, Vol. 20(1).
 *
 * Also supports LIFO allocation (JS_ARENA_MARK/JS_ARENA_RELEASE).
 */
#include <stdlib.h>
#include "jstypes.h"
#include "jscompat.h"

JS_BEGIN_EXTERN_C

typedef struct JSArena JSArena;
typedef struct JSArenaPool JSArenaPool;

struct JSArena {
    JSArena     *next;          /* next arena for this lifetime */
    jsuword     base;           /* aligned base address, follows this header */
    jsuword     limit;          /* one beyond last byte in arena */
    jsuword     avail;          /* points to next available byte */
};

#ifdef JS_ARENAMETER
typedef struct JSArenaStats JSArenaStats;

struct JSArenaStats {
    JSArenaStats *next;         /* next in arenaStats list */
    char        *name;          /* name for debugging */
    uint32      narenas;        /* number of arenas in pool */
    uint32      nallocs;        /* number of JS_ARENA_ALLOCATE() calls */
    uint32      nmallocs;       /* number of malloc() calls */
    uint32      ndeallocs;      /* number of lifetime deallocations */
    uint32      ngrows;         /* number of JS_ARENA_GROW() calls */
    uint32      ninplace;       /* number of in-place growths */
    uint32      nreallocs;      /* number of arena grow extending reallocs */
    uint32      nreleases;      /* number of JS_ARENA_RELEASE() calls */
    uint32      nfastrels;      /* number of "fast path" releases */
    size_t      nbytes;         /* total bytes allocated */
    size_t      maxalloc;       /* maximum allocation size in bytes */
    double      variance;       /* size variance accumulator */
};
#endif

struct JSArenaPool {
    JSArena     first;          /* first arena in pool list */
    JSArena     *current;       /* arena from which to allocate space */
    size_t      arenasize;      /* net exact size of a new arena */
    jsuword     mask;           /* alignment mask (power-of-2 - 1) */
    size_t      *quotap;        /* pointer to the quota on pool allocation
                                   size or null if pool is unlimited */
#ifdef JS_ARENAMETER
    JSArenaStats stats;
#endif
};

#ifdef JS_ARENAMETER
#define JS_INIT_NAMED_ARENA_POOL(pool, name, size, align, quotap)             \
    JS_InitArenaPool(pool, name, size, align, quotap)
#else
#define JS_INIT_NAMED_ARENA_POOL(pool, name, size, align, quotap)             \
    JS_InitArenaPool(pool, size, align, quotap)
#endif

/*
 * If the including .c file uses only one power-of-2 alignment, it may define
 * JS_ARENA_CONST_ALIGN_MASK to the alignment mask and save a few instructions
 * per ALLOCATE and GROW.
 */
#ifdef JS_ARENA_CONST_ALIGN_MASK
#define JS_ARENA_ALIGN(pool, n) (((jsuword)(n) + JS_ARENA_CONST_ALIGN_MASK)   \
                                 & ~(jsuword)JS_ARENA_CONST_ALIGN_MASK)

#define JS_INIT_ARENA_POOL(pool, name, size, quotap)                          \
    JS_INIT_NAMED_ARENA_POOL(pool, name, size, JS_ARENA_CONST_ALIGN_MASK + 1, \
                             quotap)

#else
#define JS_ARENA_ALIGN(pool, n) (((jsuword)(n) + (pool)->mask) & ~(pool)->mask)

#define JS_INIT_ARENA_POOL(pool, name, size, align, quotap)                   \
    JS_INIT_NAMED_ARENA_POOL(pool, name, size, align, quotap)

#endif

#define JS_ARENA_ALLOCATE(p, pool, nb)                                        \
    JS_ARENA_ALLOCATE_CAST(p, void *, pool, nb)

#define JS_ARENA_ALLOCATE_TYPE(p, type, pool)                                 \
    JS_ARENA_ALLOCATE_COMMON(p, type *, pool, sizeof(type), 0)

#define JS_ARENA_ALLOCATE_CAST(p, type, pool, nb)                             \
    JS_ARENA_ALLOCATE_COMMON(p, type, pool, nb, _nb > _a->limit)

/*
 * NB: In JS_ARENA_ALLOCATE_CAST and JS_ARENA_GROW_CAST, always subtract _nb
 * from a->limit rather than adding _nb to _p, to avoid overflowing a 32-bit
 * address space (possible when running a 32-bit program on a 64-bit system
 * where the kernel maps the heap up against the top of the 32-bit address
 * space).
 *
 * Thanks to Juergen Kreileder <jk@blackdown.de>, who brought this up in
 * https://bugzilla.mozilla.org/show_bug.cgi?id=279273.
 */
#define JS_ARENA_ALLOCATE_COMMON(p, type, pool, nb, guard)                    \
    JS_BEGIN_MACRO                                                            \
        JSArena *_a = (pool)->current;                                        \
        size_t _nb = JS_ARENA_ALIGN(pool, nb);                                \
        jsuword _p = _a->avail;                                               \
        if ((guard) || _p > _a->limit - _nb)                                  \
            _p = (jsuword)JS_ArenaAllocate(pool, _nb);                        \
        else                                                                  \
            _a->avail = _p + _nb;                                             \
        p = (type) _p;                                                        \
        JS_ArenaCountAllocation(pool, nb);                                    \
    JS_END_MACRO

#define JS_ARENA_GROW(p, pool, size, incr)                                    \
    JS_ARENA_GROW_CAST(p, void *, pool, size, incr)

#define JS_ARENA_GROW_CAST(p, type, pool, size, incr)                         \
    JS_BEGIN_MACRO                                                            \
        JSArena *_a = (pool)->current;                                        \
        if (_a->avail == (jsuword)(p) + JS_ARENA_ALIGN(pool, size)) {         \
            size_t _nb = (size) + (incr);                                     \
            _nb = JS_ARENA_ALIGN(pool, _nb);                                  \
            if (_a->limit >= _nb && (jsuword)(p) <= _a->limit - _nb) {        \
                _a->avail = (jsuword)(p) + _nb;                               \
                JS_ArenaCountInplaceGrowth(pool, size, incr);                 \
            } else if ((jsuword)(p) == _a->base) {                            \
                p = (type) JS_ArenaRealloc(pool, p, size, incr);              \
            } else {                                                          \
                p = (type) JS_ArenaGrow(pool, p, size, incr);                 \
            }                                                                 \
        } else {                                                              \
            p = (type) JS_ArenaGrow(pool, p, size, incr);                     \
        }                                                                     \
        JS_ArenaCountGrowth(pool, size, incr);                                \
    JS_END_MACRO

#define JS_ARENA_MARK(pool)     ((void *) (pool)->current->avail)
#define JS_UPTRDIFF(p,q)        ((jsuword)(p) - (jsuword)(q))

/*
 * Check if the mark is inside arena's allocated area.
 */
#define JS_ARENA_MARK_MATCH(a, mark)                                          \
    (JS_UPTRDIFF(mark, (a)->base) <= JS_UPTRDIFF((a)->avail, (a)->base))

#ifdef DEBUG
#define JS_FREE_PATTERN         0xDA
#define JS_CLEAR_UNUSED(a)      (JS_ASSERT((a)->avail <= (a)->limit),         \
                                 memset((void*)(a)->avail, JS_FREE_PATTERN,   \
                                        (a)->limit - (a)->avail))
#define JS_CLEAR_ARENA(a)       memset((void*)(a), JS_FREE_PATTERN,           \
                                       (a)->limit - (jsuword)(a))
#else
#define JS_CLEAR_UNUSED(a)      /* nothing */
#define JS_CLEAR_ARENA(a)       /* nothing */
#endif

#define JS_ARENA_RELEASE(pool, mark)                                          \
    JS_BEGIN_MACRO                                                            \
        char *_m = (char *)(mark);                                            \
        JSArena *_a = (pool)->current;                                        \
        if (_a != &(pool)->first && JS_ARENA_MARK_MATCH(_a, _m)) {            \
            _a->avail = (jsuword)JS_ARENA_ALIGN(pool, _m);                    \
            JS_ASSERT(_a->avail <= _a->limit);                                \
            JS_CLEAR_UNUSED(_a);                                              \
            JS_ArenaCountRetract(pool, _m);                                   \
        } else {                                                              \
            JS_ArenaRelease(pool, _m);                                        \
        }                                                                     \
        JS_ArenaCountRelease(pool, _m);                                       \
    JS_END_MACRO

#ifdef JS_ARENAMETER
#define JS_COUNT_ARENA(pool,op) ((pool)->stats.narenas op)
#else
#define JS_COUNT_ARENA(pool,op)
#endif

#define JS_ARENA_DESTROY(pool, a, pnext)                                      \
    JS_BEGIN_MACRO                                                            \
        JS_COUNT_ARENA(pool,--);                                              \
        if ((pool)->current == (a)) (pool)->current = &(pool)->first;         \
        *(pnext) = (a)->next;                                                 \
        JS_CLEAR_ARENA(a);                                                    \
        free(a);                                                              \
        (a) = NULL;                                                           \
    JS_END_MACRO

/*
 * Initialize an arena pool with a minimum size per arena of size bytes.
 * Always call JS_SET_ARENA_METER_NAME before calling this or use
 * JS_INIT_ARENA_POOL macro to provide a name for for debugging and metering.
 */
extern JS_PUBLIC_API(void)
JS_INIT_NAMED_ARENA_POOL(JSArenaPool *pool, const char *name, size_t size,
                         size_t align, size_t *quotap);

/*
 * Free the arenas in pool.  The user may continue to allocate from pool
 * after calling this function.  There is no need to call JS_InitArenaPool()
 * again unless JS_FinishArenaPool(pool) has been called.
 */
extern JS_PUBLIC_API(void)
JS_FreeArenaPool(JSArenaPool *pool);

/*
 * Free the arenas in pool and finish using it altogether.
 */
extern JS_PUBLIC_API(void)
JS_FinishArenaPool(JSArenaPool *pool);

/*
 * Deprecated do-nothing function.
 */
extern JS_PUBLIC_API(void)
JS_ArenaFinish(void);

/*
 * Deprecated do-nothing function.
 */
extern JS_PUBLIC_API(void)
JS_ArenaShutDown(void);

/*
 * Friend functions used by the JS_ARENA_*() macros.
 */
extern JS_PUBLIC_API(void *)
JS_ArenaAllocate(JSArenaPool *pool, size_t nb);

extern JS_PUBLIC_API(void *)
JS_ArenaRealloc(JSArenaPool *pool, void *p, size_t size, size_t incr);

extern JS_PUBLIC_API(void *)
JS_ArenaGrow(JSArenaPool *pool, void *p, size_t size, size_t incr);

extern JS_PUBLIC_API(void)
JS_ArenaRelease(JSArenaPool *pool, char *mark);

#ifdef JS_ARENAMETER

#include <stdio.h>

extern JS_PUBLIC_API(void)
JS_ArenaCountAllocation(JSArenaPool *pool, size_t nb);

extern JS_PUBLIC_API(void)
JS_ArenaCountInplaceGrowth(JSArenaPool *pool, size_t size, size_t incr);

extern JS_PUBLIC_API(void)
JS_ArenaCountGrowth(JSArenaPool *pool, size_t size, size_t incr);

extern JS_PUBLIC_API(void)
JS_ArenaCountRelease(JSArenaPool *pool, char *mark);

extern JS_PUBLIC_API(void)
JS_ArenaCountRetract(JSArenaPool *pool, char *mark);

extern JS_PUBLIC_API(void)
JS_DumpArenaStats(FILE *fp);

#else  /* !JS_ARENAMETER */

#define JS_ArenaCountAllocation(ap, nb)                 /* nothing */
#define JS_ArenaCountInplaceGrowth(ap, size, incr)      /* nothing */
#define JS_ArenaCountGrowth(ap, size, incr)             /* nothing */
#define JS_ArenaCountRelease(ap, mark)                  /* nothing */
#define JS_ArenaCountRetract(ap, mark)                  /* nothing */

#endif /* !JS_ARENAMETER */

JS_END_EXTERN_C

#endif /* jsarena_h___ */
