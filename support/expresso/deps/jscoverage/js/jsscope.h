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

#ifndef jsscope_h___
#define jsscope_h___
/*
 * JS symbol tables.
 */
#include "jstypes.h"
#include "jslock.h"
#include "jsobj.h"
#include "jsprvtd.h"
#include "jspubtd.h"

JS_BEGIN_EXTERN_C

/*
 * Given P independent, non-unique properties each of size S words mapped by
 * all scopes in a runtime, construct a property tree of N nodes each of size
 * S+L words (L for tree linkage).  A nominal L value is 2 for leftmost-child
 * and right-sibling links.  We hope that the N < P by enough that the space
 * overhead of L, and the overhead of scope entries pointing at property tree
 * nodes, is worth it.
 *
 * The tree construction goes as follows.  If any empty scope in the runtime
 * has a property X added to it, find or create a node under the tree root
 * labeled X, and set scope->lastProp to point at that node.  If any non-empty
 * scope whose most recently added property is labeled Y has another property
 * labeled Z added, find or create a node for Z under the node that was added
 * for Y, and set scope->lastProp to point at that node.
 *
 * A property is labeled by its members' values: id, getter, setter, slot,
 * attributes, tiny or short id, and a field telling for..in order.  Note that
 * labels are not unique in the tree, but they are unique among a node's kids
 * (barring rare and benign multi-threaded race condition outcomes, see below)
 * and along any ancestor line from the tree root to a given leaf node (except
 * for the hard case of duplicate formal parameters to a function).
 *
 * Thus the root of the tree represents all empty scopes, and the first ply
 * of the tree represents all scopes containing one property, etc.  Each node
 * in the tree can stand for any number of scopes having the same ordered set
 * of properties, where that node was the last added to the scope.  (We need
 * not store the root of the tree as a node, and do not -- all we need are
 * links to its kids.)
 *
 * Sidebar on for..in loop order: ECMA requires no particular order, but this
 * implementation has promised and delivered property definition order, and
 * compatibility is king.  We could use an order number per property, which
 * would require a sort in js_Enumerate, and an entry order generation number
 * per scope.  An order number beats a list, which should be doubly-linked for
 * O(1) delete.  An even better scheme is to use a parent link in the property
 * tree, so that the ancestor line can be iterated from scope->lastProp when
 * filling in a JSIdArray from back to front.  This parent link also helps the
 * GC to sweep properties iteratively.
 *
 * What if a property Y is deleted from a scope?  If Y is the last property in
 * the scope, we simply adjust the scope's lastProp member after we remove the
 * scope's hash-table entry pointing at that property node.  The parent link
 * mentioned in the for..in sidebar above makes this adjustment O(1).  But if
 * Y comes between X and Z in the scope, then we might have to "fork" the tree
 * at X, leaving X->Y->Z in case other scopes have those properties added in
 * that order; and to finish the fork, we'd add a node labeled Z with the path
 * X->Z, if it doesn't exist.  This could lead to lots of extra nodes, and to
 * O(n^2) growth when deleting lots of properties.
 *
 * Rather, for O(1) growth all around, we should share the path X->Y->Z among
 * scopes having those three properties added in that order, and among scopes
 * having only X->Z where Y was deleted.  All such scopes have a lastProp that
 * points to the Z child of Y.  But a scope in which Y was deleted does not
 * have a table entry for Y, and when iterating that scope by traversing the
 * ancestor line from Z, we will have to test for a table entry for each node,
 * skipping nodes that lack entries.
 *
 * What if we add Y again?  X->Y->Z->Y is wrong and we'll enumerate Y twice.
 * Therefore we must fork in such a case, if not earlier.  Because delete is
 * "bursty", we should not fork eagerly.  Delaying a fork till we are at risk
 * of adding Y after it was deleted already requires a flag in the JSScope, to
 * wit, SCOPE_MIDDLE_DELETE.
 *
 * What about thread safety?  If the property tree operations done by requests
 * are find-node and insert-node, then the only hazard is duplicate insertion.
 * This is harmless except for minor bloat.  When all requests have ended or
 * been suspended, the GC is free to sweep the tree after marking all nodes
 * reachable from scopes, performing remove-node operations as needed.
 *
 * Is the property tree worth it compared to property storage in each table's
 * entries?  To decide, we must find the relation <> between the words used
 * with a property tree and the words required without a tree.
 *
 * Model all scopes as one super-scope of capacity T entries (T a power of 2).
 * Let alpha be the load factor of this double hash-table.  With the property
 * tree, each entry in the table is a word-sized pointer to a node that can be
 * shared by many scopes.  But all such pointers are overhead compared to the
 * situation without the property tree, where the table stores property nodes
 * directly, as entries each of size S words.  With the property tree, we need
 * L=2 extra words per node for siblings and kids pointers.  Without the tree,
 * (1-alpha)*S*T words are wasted on free or removed sentinel-entries required
 * by double hashing.
 *
 * Therefore,
 *
 *      (property tree)                 <> (no property tree)
 *      N*(S+L) + T                     <> S*T
 *      N*(S+L) + T                     <> P*S + (1-alpha)*S*T
 *      N*(S+L) + alpha*T + (1-alpha)*T <> P*S + (1-alpha)*S*T
 *
 * Note that P is alpha*T by definition, so
 *
 *      N*(S+L) + P + (1-alpha)*T <> P*S + (1-alpha)*S*T
 *      N*(S+L)                   <> P*S - P + (1-alpha)*S*T - (1-alpha)*T
 *      N*(S+L)                   <> (P + (1-alpha)*T) * (S-1)
 *      N*(S+L)                   <> (P + (1-alpha)*P/alpha) * (S-1)
 *      N*(S+L)                   <> P * (1/alpha) * (S-1)
 *
 * Let N = P*beta for a compression ratio beta, beta <= 1:
 *
 *      P*beta*(S+L) <> P * (1/alpha) * (S-1)
 *      beta*(S+L)   <> (S-1)/alpha
 *      beta         <> (S-1)/((S+L)*alpha)
 *
 * For S = 6 (32-bit architectures) and L = 2, the property tree wins iff
 *
 *      beta < 5/(8*alpha)
 *
 * We ensure that alpha <= .75, so the property tree wins if beta < .83_.  An
 * average beta from recent Mozilla browser startups was around .6.
 *
 * Can we reduce L?  Observe that the property tree degenerates into a list of
 * lists if at most one property Y follows X in all scopes.  In or near such a
 * case, we waste a word on the right-sibling link outside of the root ply of
 * the tree.  Note also that the root ply tends to be large, so O(n^2) growth
 * searching it is likely, indicating the need for hashing (but with increased
 * thread safety costs).
 *
 * If only K out of N nodes in the property tree have more than one child, we
 * could eliminate the sibling link and overlay a children list or hash-table
 * pointer on the leftmost-child link (which would then be either null or an
 * only-child link; the overlay could be tagged in the low bit of the pointer,
 * or flagged elsewhere in the property tree node, although such a flag must
 * not be considered when comparing node labels during tree search).
 *
 * For such a system, L = 1 + (K * averageChildrenTableSize) / N instead of 2.
 * If K << N, L approaches 1 and the property tree wins if beta < .95.
 *
 * We observe that fan-out below the root ply of the property tree appears to
 * have extremely low degree (see the MeterPropertyTree code that histograms
 * child-counts in jsscope.c), so instead of a hash-table we use a linked list
 * of child node pointer arrays ("kid chunks").  The details are isolated in
 * jsscope.c; others must treat JSScopeProperty.kids as opaque.  We leave it
 * strongly typed for debug-ability of the common (null or one-kid) cases.
 *
 * One final twist (can you stand it?): the mean number of entries per scope
 * in Mozilla is < 5, with a large standard deviation (~8).  Instead of always
 * allocating scope->table, we leave it null while initializing all the other
 * scope members as if it were non-null and minimal-length.  Until a property
 * is added that crosses the threshold of 6 or more entries for hashing, or
 * until a "middle delete" occurs, we use linear search from scope->lastProp
 * to find a given id, and save on the space overhead of a hash table.
 */

struct JSScope {
    JSObjectMap     map;                /* base class state */
#ifdef JS_THREADSAFE
    JSTitle         title;              /* lock state */
#endif
    JSObject        *object;            /* object that owns this scope */
    uint32          shape;              /* property cache shape identifier */
    uint8           flags;              /* flags, see below */
    int8            hashShift;          /* multiplicative hash shift */
    uint16          spare;              /* reserved */
    uint32          entryCount;         /* number of entries in table */
    uint32          removedCount;       /* removed entry sentinels in table */
    JSScopeProperty **table;            /* table of ptrs to shared tree nodes */
    JSScopeProperty *lastProp;          /* pointer to last property added */
};

#ifdef JS_THREADSAFE
JS_STATIC_ASSERT(offsetof(JSScope, title) == sizeof(JSObjectMap));
#endif

#define JS_IS_SCOPE_LOCKED(cx, scope)   JS_IS_TITLE_LOCKED(cx, &(scope)->title)

#define OBJ_SCOPE(obj)                  ((JSScope *)(obj)->map)
#define OBJ_SHAPE(obj)                  (OBJ_SCOPE(obj)->shape)

#define SCOPE_MAKE_UNIQUE_SHAPE(cx,scope)                                     \
    ((scope)->shape = js_GenerateShape((cx), JS_FALSE, NULL))

#define SCOPE_EXTEND_SHAPE(cx,scope,sprop)                                    \
    JS_BEGIN_MACRO                                                            \
        if (!(scope)->lastProp ||                                             \
            (scope)->shape == (scope)->lastProp->shape) {                     \
            (scope)->shape = (sprop)->shape;                                  \
        } else {                                                              \
            (scope)->shape = js_GenerateShape((cx), JS_FALSE, sprop);         \
        }                                                                     \
    JS_END_MACRO

/* By definition, hashShift = JS_DHASH_BITS - log2(capacity). */
#define SCOPE_CAPACITY(scope)           JS_BIT(JS_DHASH_BITS-(scope)->hashShift)

/* Scope flags and some macros to hide them from other files than jsscope.c. */
#define SCOPE_MIDDLE_DELETE             0x0001
#define SCOPE_SEALED                    0x0002
#define SCOPE_BRANDED                   0x0004

#define SCOPE_HAD_MIDDLE_DELETE(scope)  ((scope)->flags & SCOPE_MIDDLE_DELETE)
#define SCOPE_SET_MIDDLE_DELETE(scope)  ((scope)->flags |= SCOPE_MIDDLE_DELETE)
#define SCOPE_CLR_MIDDLE_DELETE(scope)  ((scope)->flags &= ~SCOPE_MIDDLE_DELETE)

#define SCOPE_IS_SEALED(scope)          ((scope)->flags & SCOPE_SEALED)
#define SCOPE_SET_SEALED(scope)         ((scope)->flags |= SCOPE_SEALED)
#if 0
/*
 * Don't define this, it can't be done safely because JS_LOCK_OBJ will avoid
 * taking the lock if the object owns its scope and the scope is sealed.
 */
#undef  SCOPE_CLR_SEALED(scope)         ((scope)->flags &= ~SCOPE_SEALED)
#endif

/*
 * A branded scope's object contains plain old methods (function-valued
 * properties without magic getters and setters), and its scope->shape
 * evolves whenever a function value changes.
 */
#define SCOPE_IS_BRANDED(scope)         ((scope)->flags & SCOPE_BRANDED)
#define SCOPE_SET_BRANDED(scope)        ((scope)->flags |= SCOPE_BRANDED)
#define SCOPE_CLR_BRANDED(scope)        ((scope)->flags &= ~SCOPE_BRANDED)

/*
 * A little information hiding for scope->lastProp, in case it ever becomes
 * a tagged pointer again.
 */
#define SCOPE_LAST_PROP(scope)          ((scope)->lastProp)
#define SCOPE_REMOVE_LAST_PROP(scope)   ((scope)->lastProp =                  \
                                         (scope)->lastProp->parent)

struct JSScopeProperty {
    jsid            id;                 /* int-tagged jsval/untagged JSAtom* */
    JSPropertyOp    getter;             /* getter and setter hooks or objects */
    JSPropertyOp    setter;
    uint32          slot;               /* abstract index in object slots */
    uint8           attrs;              /* attributes, see jsapi.h JSPROP_* */
    uint8           flags;              /* flags, see below for defines */
    int16           shortid;            /* tinyid, or local arg/var index */
    JSScopeProperty *parent;            /* parent node, reverse for..in order */
    JSScopeProperty *kids;              /* null, single child, or a tagged ptr
                                           to many-kids data structure */
    uint32          shape;              /* property cache shape identifier */
};

/* JSScopeProperty pointer tag bit indicating a collision. */
#define SPROP_COLLISION                 ((jsuword)1)
#define SPROP_REMOVED                   ((JSScopeProperty *) SPROP_COLLISION)

/* Macros to get and set sprop pointer values and collision flags. */
#define SPROP_IS_FREE(sprop)            ((sprop) == NULL)
#define SPROP_IS_REMOVED(sprop)         ((sprop) == SPROP_REMOVED)
#define SPROP_IS_LIVE(sprop)            ((sprop) > SPROP_REMOVED)
#define SPROP_FLAG_COLLISION(spp,sprop) (*(spp) = (JSScopeProperty *)         \
                                         ((jsuword)(sprop) | SPROP_COLLISION))
#define SPROP_HAD_COLLISION(sprop)      ((jsuword)(sprop) & SPROP_COLLISION)
#define SPROP_FETCH(spp)                SPROP_CLEAR_COLLISION(*(spp))

#define SPROP_CLEAR_COLLISION(sprop)                                          \
    ((JSScopeProperty *) ((jsuword)(sprop) & ~SPROP_COLLISION))

#define SPROP_STORE_PRESERVING_COLLISION(spp, sprop)                          \
    (*(spp) = (JSScopeProperty *) ((jsuword)(sprop)                           \
                                   | SPROP_HAD_COLLISION(*(spp))))

/* Bits stored in sprop->flags. */
#define SPROP_MARK                      0x01
#define SPROP_IS_ALIAS                  0x02
#define SPROP_HAS_SHORTID               0x04
#define SPROP_FLAG_SHAPE_REGEN          0x08

/*
 * If SPROP_HAS_SHORTID is set in sprop->flags, we use sprop->shortid rather
 * than id when calling sprop's getter or setter.
 */
#define SPROP_USERID(sprop)                                                   \
    (((sprop)->flags & SPROP_HAS_SHORTID) ? INT_TO_JSVAL((sprop)->shortid)    \
                                          : ID_TO_VALUE((sprop)->id))

#define SPROP_INVALID_SLOT              0xffffffff

#define SLOT_IN_SCOPE(slot,scope)         ((slot) < (scope)->map.freeslot)
#define SPROP_HAS_VALID_SLOT(sprop,scope) SLOT_IN_SCOPE((sprop)->slot, scope)

#define SPROP_HAS_STUB_GETTER(sprop)    (!(sprop)->getter)
#define SPROP_HAS_STUB_SETTER(sprop)    (!(sprop)->setter)

/*
 * NB: SPROP_GET must not be called if SPROP_HAS_STUB_GETTER(sprop).
 */
#define SPROP_GET(cx,sprop,obj,obj2,vp)                                       \
    (((sprop)->attrs & JSPROP_GETTER)                                         \
     ? js_InternalGetOrSet(cx, obj, (sprop)->id,                              \
                           OBJECT_TO_JSVAL((sprop)->getter), JSACC_READ,      \
                           0, 0, vp)                                          \
     : (sprop)->getter(cx, OBJ_THIS_OBJECT(cx,obj), SPROP_USERID(sprop), vp))

/*
 * NB: SPROP_SET must not be called if (SPROP_HAS_STUB_SETTER(sprop) &&
 * !(sprop->attrs & JSPROP_GETTER)).
 */
#define SPROP_SET(cx,sprop,obj,obj2,vp)                                       \
    (((sprop)->attrs & JSPROP_SETTER)                                         \
     ? js_InternalGetOrSet(cx, obj, (sprop)->id,                              \
                           OBJECT_TO_JSVAL((sprop)->setter), JSACC_WRITE,     \
                           1, vp, vp)                                         \
     : ((sprop)->attrs & JSPROP_GETTER)                                       \
     ? (JS_ReportErrorNumber(cx, js_GetErrorMessage, NULL,                    \
                             JSMSG_GETTER_ONLY, NULL), JS_FALSE)              \
     : (sprop)->setter(cx, OBJ_THIS_OBJECT(cx,obj), SPROP_USERID(sprop), vp))

/* Macro for common expression to test for shared permanent attributes. */
#define SPROP_IS_SHARED_PERMANENT(sprop)                                      \
    ((~(sprop)->attrs & (JSPROP_SHARED | JSPROP_PERMANENT)) == 0)

extern JSScope *
js_GetMutableScope(JSContext *cx, JSObject *obj);

extern JSScope *
js_NewScope(JSContext *cx, jsrefcount nrefs, JSObjectOps *ops, JSClass *clasp,
            JSObject *obj);

extern void
js_DestroyScope(JSContext *cx, JSScope *scope);

extern JS_FRIEND_API(JSScopeProperty **)
js_SearchScope(JSScope *scope, jsid id, JSBool adding);

#define SCOPE_GET_PROPERTY(scope, id)                                         \
    SPROP_FETCH(js_SearchScope(scope, id, JS_FALSE))

#define SCOPE_HAS_PROPERTY(scope, sprop)                                      \
    (SCOPE_GET_PROPERTY(scope, (sprop)->id) == (sprop))

extern JSScopeProperty *
js_AddScopeProperty(JSContext *cx, JSScope *scope, jsid id,
                    JSPropertyOp getter, JSPropertyOp setter, uint32 slot,
                    uintN attrs, uintN flags, intN shortid);

extern JSScopeProperty *
js_ChangeScopePropertyAttrs(JSContext *cx, JSScope *scope,
                            JSScopeProperty *sprop, uintN attrs, uintN mask,
                            JSPropertyOp getter, JSPropertyOp setter);

extern JSBool
js_RemoveScopeProperty(JSContext *cx, JSScope *scope, jsid id);

extern void
js_ClearScope(JSContext *cx, JSScope *scope);

/*
 * These macros used to inline short code sequences, but they grew over time.
 * We retain them for internal backward compatibility, and in case one or both
 * ever shrink to inline-able size.
 */
#define TRACE_ID(trc, id)                js_TraceId(trc, id)
#define TRACE_SCOPE_PROPERTY(trc, sprop) js_TraceScopeProperty(trc, sprop)

extern void
js_TraceId(JSTracer *trc, jsid id);

extern void
js_TraceScopeProperty(JSTracer *trc, JSScopeProperty *sprop);

extern void
js_SweepScopeProperties(JSContext *cx);

extern JSBool
js_InitPropertyTree(JSRuntime *rt);

extern void
js_FinishPropertyTree(JSRuntime *rt);

JS_END_EXTERN_C

#endif /* jsscope_h___ */
