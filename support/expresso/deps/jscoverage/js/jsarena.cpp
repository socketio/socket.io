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

/*
 * Lifetime-based fast allocation, inspired by much prior art, including
 * "Fast Allocation and Deallocation of Memory Based on Object Lifetimes"
 * David R. Hanson, Software -- Practice and Experience, Vol. 20(1).
 */
#include "jsstddef.h"
#include <stdlib.h>
#include <string.h>
#include "jstypes.h"
#include "jsbit.h"
#include "jsarena.h" /* Added by JSIFY */
#include "jsutil.h" /* Added by JSIFY */

#ifdef JS_ARENAMETER
static JSArenaStats *arena_stats_list;

#define COUNT(pool,what)  (pool)->stats.what++
#else
#define COUNT(pool,what)  /* nothing */
#endif

#define JS_ARENA_DEFAULT_ALIGN  sizeof(double)

JS_PUBLIC_API(void)
JS_INIT_NAMED_ARENA_POOL(JSArenaPool *pool, const char *name, size_t size,
                         size_t align, size_t *quotap)
{
    if (align == 0)
        align = JS_ARENA_DEFAULT_ALIGN;
    pool->mask = JS_BITMASK(JS_CeilingLog2(align));
    pool->first.next = NULL;
    pool->first.base = pool->first.avail = pool->first.limit =
        JS_ARENA_ALIGN(pool, &pool->first + 1);
    pool->current = &pool->first;
    pool->arenasize = size;
    pool->quotap = quotap;
#ifdef JS_ARENAMETER
    memset(&pool->stats, 0, sizeof pool->stats);
    pool->stats.name = strdup(name);
    pool->stats.next = arena_stats_list;
    arena_stats_list = &pool->stats;
#endif
}

/*
 * An allocation that consumes more than pool->arenasize also has a header
 * pointing back to its previous arena's next member.  This header is not
 * included in [a->base, a->limit), so its space can't be wrongly claimed.
 *
 * As the header is a pointer, it must be well-aligned.  If pool->mask is
 * greater than or equal to POINTER_MASK, the header just preceding a->base
 * for an oversized arena a is well-aligned, because a->base is well-aligned.
 * However, we may need to add more space to pad the JSArena ** back-pointer
 * so that it lies just behind a->base, because a might not be aligned such
 * that (jsuword)(a + 1) is on a pointer boundary.
 *
 * By how much must we pad?  Let M be the alignment modulus for pool and P
 * the modulus for a pointer.  Given M >= P, the base of an oversized arena
 * that satisfies M is well-aligned for P.
 *
 * On the other hand, if M < P, we must include enough space in the header
 * size to align the back-pointer on a P boundary so that it can be found by
 * subtracting P from a->base.  This means a->base must be on a P boundary,
 * even though subsequent allocations from a may be aligned on a lesser (M)
 * boundary.  Given powers of two M and P as above, the extra space needed
 * when M < P is P-M or POINTER_MASK - pool->mask.
 *
 * The size of a header including padding is given by the HEADER_SIZE macro,
 * below, for any pool (for any value of M).
 *
 * The mask to align a->base for any pool is (pool->mask | POINTER_MASK), or
 * HEADER_BASE_MASK(pool).
 *
 * PTR_TO_HEADER computes the address of the back-pointer, given an oversized
 * allocation at p.  By definition, p must be a->base for the arena a that
 * contains p.  GET_HEADER and SET_HEADER operate on an oversized arena a, in
 * the case of SET_HEADER with back-pointer ap.
 */
#define POINTER_MASK            ((jsuword)(JS_ALIGN_OF_POINTER - 1))
#define HEADER_SIZE(pool)       (sizeof(JSArena **)                           \
                                 + (((pool)->mask < POINTER_MASK)             \
                                    ? POINTER_MASK - (pool)->mask             \
                                    : 0))
#define HEADER_BASE_MASK(pool)  ((pool)->mask | POINTER_MASK)
#define PTR_TO_HEADER(pool,p)   (JS_ASSERT(((jsuword)(p)                      \
                                            & HEADER_BASE_MASK(pool))         \
                                           == 0),                             \
                                 (JSArena ***)(p) - 1)
#define GET_HEADER(pool,a)      (*PTR_TO_HEADER(pool, (a)->base))
#define SET_HEADER(pool,a,ap)   (*PTR_TO_HEADER(pool, (a)->base) = (ap))

JS_PUBLIC_API(void *)
JS_ArenaAllocate(JSArenaPool *pool, size_t nb)
{
    JSArena **ap, *a, *b;
    jsuword extra, hdrsz, gross;
    void *p;

    /*
     * Search pool from current forward till we find or make enough space.
     *
     * NB: subtract nb from a->limit in the loop condition, instead of adding
     * nb to a->avail, to avoid overflowing a 32-bit address space (possible
     * when running a 32-bit program on a 64-bit system where the kernel maps
     * the heap up against the top of the 32-bit address space).
     *
     * Thanks to Juergen Kreileder <jk@blackdown.de>, who brought this up in
     * https://bugzilla.mozilla.org/show_bug.cgi?id=279273.
     */
    JS_ASSERT((nb & pool->mask) == 0);
    for (a = pool->current; nb > a->limit || a->avail > a->limit - nb;
         pool->current = a) {
        ap = &a->next;
        if (!*ap) {
            /* Not enough space in pool, so we must malloc. */
            extra = (nb > pool->arenasize) ? HEADER_SIZE(pool) : 0;
            hdrsz = sizeof *a + extra + pool->mask;
            gross = hdrsz + JS_MAX(nb, pool->arenasize);
            if (gross < nb)
                return NULL;
            if (pool->quotap) {
                if (gross > *pool->quotap)
                    return NULL;
                b = (JSArena *) malloc(gross);
                if (!b)
                    return NULL;
                *pool->quotap -= gross;
            } else {
                b = (JSArena *) malloc(gross);
                if (!b)
                    return NULL;
            }

            b->next = NULL;
            b->limit = (jsuword)b + gross;
            JS_COUNT_ARENA(pool,++);
            COUNT(pool, nmallocs);

            /* If oversized, store ap in the header, just before a->base. */
            *ap = a = b;
            JS_ASSERT(gross <= JS_UPTRDIFF(a->limit, a));
            if (extra) {
                a->base = a->avail =
                    ((jsuword)a + hdrsz) & ~HEADER_BASE_MASK(pool);
                SET_HEADER(pool, a, ap);
            } else {
                a->base = a->avail = JS_ARENA_ALIGN(pool, a + 1);
            }
            continue;
        }
        a = *ap;                                /* move to next arena */
    }

    p = (void *)a->avail;
    a->avail += nb;
    JS_ASSERT(a->base <= a->avail && a->avail <= a->limit);
    return p;
}

JS_PUBLIC_API(void *)
JS_ArenaRealloc(JSArenaPool *pool, void *p, size_t size, size_t incr)
{
    JSArena **ap, *a, *b;
    jsuword boff, aoff, extra, hdrsz, gross, growth;

    /*
     * Use the oversized-single-allocation header to avoid searching for ap.
     * See JS_ArenaAllocate, the SET_HEADER call.
     */
    if (size > pool->arenasize) {
        ap = *PTR_TO_HEADER(pool, p);
        a = *ap;
    } else {
        ap = &pool->first.next;
        while ((a = *ap) != pool->current)
            ap = &a->next;
    }

    JS_ASSERT(a->base == (jsuword)p);
    boff = JS_UPTRDIFF(a->base, a);
    aoff = JS_ARENA_ALIGN(pool, size + incr);
    JS_ASSERT(aoff > pool->arenasize);
    extra = HEADER_SIZE(pool);                  /* oversized header holds ap */
    hdrsz = sizeof *a + extra + pool->mask;     /* header and alignment slop */
    gross = hdrsz + aoff;
    JS_ASSERT(gross > aoff);
    if (pool->quotap) {
        growth = gross - (a->limit - (jsuword) a);
        if (growth > *pool->quotap)
            return NULL;
        a = (JSArena *) realloc(a, gross);
        if (!a)
            return NULL;
        *pool->quotap -= growth;
    } else {
        a = (JSArena *) realloc(a, gross);
        if (!a)
            return NULL;
    }
#ifdef JS_ARENAMETER
    pool->stats.nreallocs++;
#endif

    if (a != *ap) {
        /* Oops, realloc moved the allocation: update other pointers to a. */
        if (pool->current == *ap)
            pool->current = a;
        b = a->next;
        if (b && b->avail - b->base > pool->arenasize) {
            JS_ASSERT(GET_HEADER(pool, b) == &(*ap)->next);
            SET_HEADER(pool, b, &a->next);
        }

        /* Now update *ap, the next link of the arena before a. */
        *ap = a;
    }

    a->base = ((jsuword)a + hdrsz) & ~HEADER_BASE_MASK(pool);
    a->limit = (jsuword)a + gross;
    a->avail = a->base + aoff;
    JS_ASSERT(a->base <= a->avail && a->avail <= a->limit);

    /* Check whether realloc aligned differently, and copy if necessary. */
    if (boff != JS_UPTRDIFF(a->base, a))
        memmove((void *)a->base, (char *)a + boff, size);

    /* Store ap in the oversized-load arena header. */
    SET_HEADER(pool, a, ap);
    return (void *)a->base;
}

JS_PUBLIC_API(void *)
JS_ArenaGrow(JSArenaPool *pool, void *p, size_t size, size_t incr)
{
    void *newp;

    /*
     * If p points to an oversized allocation, it owns an entire arena, so we
     * can simply realloc the arena.
     */
    if (size > pool->arenasize)
        return JS_ArenaRealloc(pool, p, size, incr);

    JS_ARENA_ALLOCATE(newp, pool, size + incr);
    if (newp)
        memcpy(newp, p, size);
    return newp;
}

/*
 * Free tail arenas linked after head, which may not be the true list head.
 * Reset pool->current to point to head in case it pointed at a tail arena.
 */
static void
FreeArenaList(JSArenaPool *pool, JSArena *head)
{
    JSArena **ap, *a;

    ap = &head->next;
    a = *ap;
    if (!a)
        return;

#ifdef DEBUG
    do {
        JS_ASSERT(a->base <= a->avail && a->avail <= a->limit);
        a->avail = a->base;
        JS_CLEAR_UNUSED(a);
    } while ((a = a->next) != NULL);
    a = *ap;
#endif

    do {
        *ap = a->next;
        if (pool->quotap)
            *pool->quotap += a->limit - (jsuword) a;
        JS_CLEAR_ARENA(a);
        JS_COUNT_ARENA(pool,--);
        free(a);
    } while ((a = *ap) != NULL);

    pool->current = head;
}

JS_PUBLIC_API(void)
JS_ArenaRelease(JSArenaPool *pool, char *mark)
{
    JSArena *a;

    for (a = &pool->first; a; a = a->next) {
        JS_ASSERT(a->base <= a->avail && a->avail <= a->limit);

        if (JS_ARENA_MARK_MATCH(a, mark)) {
            a->avail = JS_ARENA_ALIGN(pool, mark);
            JS_ASSERT(a->avail <= a->limit);
            FreeArenaList(pool, a);
            return;
        }
    }
}

JS_PUBLIC_API(void)
JS_FreeArenaPool(JSArenaPool *pool)
{
    FreeArenaList(pool, &pool->first);
    COUNT(pool, ndeallocs);
}

JS_PUBLIC_API(void)
JS_FinishArenaPool(JSArenaPool *pool)
{
    FreeArenaList(pool, &pool->first);
#ifdef JS_ARENAMETER
    {
        JSArenaStats *stats, **statsp;

        if (pool->stats.name) {
            free(pool->stats.name);
            pool->stats.name = NULL;
        }
        for (statsp = &arena_stats_list; (stats = *statsp) != 0;
             statsp = &stats->next) {
            if (stats == &pool->stats) {
                *statsp = stats->next;
                return;
            }
        }
    }
#endif
}

JS_PUBLIC_API(void)
JS_ArenaFinish()
{
}

JS_PUBLIC_API(void)
JS_ArenaShutDown(void)
{
}

#ifdef JS_ARENAMETER
JS_PUBLIC_API(void)
JS_ArenaCountAllocation(JSArenaPool *pool, size_t nb)
{
    pool->stats.nallocs++;
    pool->stats.nbytes += nb;
    if (nb > pool->stats.maxalloc)
        pool->stats.maxalloc = nb;
    pool->stats.variance += nb * nb;
}

JS_PUBLIC_API(void)
JS_ArenaCountInplaceGrowth(JSArenaPool *pool, size_t size, size_t incr)
{
    pool->stats.ninplace++;
}

JS_PUBLIC_API(void)
JS_ArenaCountGrowth(JSArenaPool *pool, size_t size, size_t incr)
{
    pool->stats.ngrows++;
    pool->stats.nbytes += incr;
    pool->stats.variance -= size * size;
    size += incr;
    if (size > pool->stats.maxalloc)
        pool->stats.maxalloc = size;
    pool->stats.variance += size * size;
}

JS_PUBLIC_API(void)
JS_ArenaCountRelease(JSArenaPool *pool, char *mark)
{
    pool->stats.nreleases++;
}

JS_PUBLIC_API(void)
JS_ArenaCountRetract(JSArenaPool *pool, char *mark)
{
    pool->stats.nfastrels++;
}

#include <stdio.h>

JS_PUBLIC_API(void)
JS_DumpArenaStats(FILE *fp)
{
    JSArenaStats *stats;
    double mean, sigma;

    for (stats = arena_stats_list; stats; stats = stats->next) {
        mean = JS_MeanAndStdDev(stats->nallocs, stats->nbytes, stats->variance,
                                &sigma);

        fprintf(fp, "\n%s allocation statistics:\n", stats->name);
        fprintf(fp, "              number of arenas: %u\n", stats->narenas);
        fprintf(fp, "         number of allocations: %u\n", stats->nallocs);
        fprintf(fp, "        number of malloc calls: %u\n", stats->nmallocs);
        fprintf(fp, "       number of deallocations: %u\n", stats->ndeallocs);
        fprintf(fp, "  number of allocation growths: %u\n", stats->ngrows);
        fprintf(fp, "    number of in-place growths: %u\n", stats->ninplace);
        fprintf(fp, " number of realloc'ing growths: %u\n", stats->nreallocs);
        fprintf(fp, "number of released allocations: %u\n", stats->nreleases);
        fprintf(fp, "       number of fast releases: %u\n", stats->nfastrels);
        fprintf(fp, "         total bytes allocated: %u\n", stats->nbytes);
        fprintf(fp, "          mean allocation size: %g\n", mean);
        fprintf(fp, "            standard deviation: %g\n", sigma);
        fprintf(fp, "       maximum allocation size: %u\n", stats->maxalloc);
    }
}
#endif /* JS_ARENAMETER */
