/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * This section typedefs the old 'native' types to the new PR<type>s.
 * These definitions are scheduled to be eliminated at the earliest
 * possible time. The NSPR API is implemented and documented using
 * the new definitions.
 */

/*
 * Note that we test for PROTYPES_H, not JSOTYPES_H.  This is to avoid
 * double-definitions of scalar types such as uint32, if NSPR's
 * protypes.h is also included.
 */
#ifndef PROTYPES_H
#define PROTYPES_H

#ifdef XP_BEOS
/* BeOS defines most int types in SupportDefs.h (int8, uint8, int16,
 * uint16, int32, uint32, int64, uint64), so in the interest of
 * not conflicting with other definitions elsewhere we have to skip the
 * #ifdef jungle below, duplicate some definitions, and do our stuff.
 */
#include <SupportDefs.h>

typedef JSUintn uintn;
#ifndef _XP_Core_
typedef JSIntn intn;
#endif

#else

/* SVR4 typedef of uint is commonly found on UNIX machines. */
#ifdef XP_UNIX
#include <sys/types.h>
#else
typedef JSUintn uint;
#endif

typedef JSUintn uintn;
typedef JSUint64 uint64;
#if !defined(_WIN32) && !defined(XP_OS2)
typedef JSUint32 uint32;
#else
typedef unsigned long uint32;
#endif
typedef JSUint16 uint16;
typedef JSUint8 uint8;

#ifndef _XP_Core_
typedef JSIntn intn;
#endif

/*
 * On AIX 4.3, sys/inttypes.h (which is included by sys/types.h, a very
 * common header file) defines the types int8, int16, int32, and int64.
 * So we don't define these four types here to avoid conflicts in case
 * the code also includes sys/types.h.
 */
#if defined(AIX) && defined(HAVE_SYS_INTTYPES_H)
#include <sys/inttypes.h>
#else
typedef JSInt64 int64;

/* /usr/include/model.h on HP-UX defines int8, int16, and int32 */
#ifdef HPUX
#include <model.h>
#else
#if !defined(_WIN32) && !defined(XP_OS2)
typedef JSInt32 int32;
#else
typedef long int32;
#endif
typedef JSInt16 int16;
typedef JSInt8 int8;
#endif /* HPUX */
#endif /* AIX && HAVE_SYS_INTTYPES_H */

#endif  /* XP_BEOS */

typedef JSFloat64 float64;

/* Re: jsbit.h */
#define TEST_BIT        JS_TEST_BIT
#define SET_BIT         JS_SET_BIT
#define CLEAR_BIT       JS_CLEAR_BIT

/* Re: prarena.h->plarena.h */
#define PRArena PLArena
#define PRArenaPool PLArenaPool
#define PRArenaStats PLArenaStats
#define PR_ARENA_ALIGN PL_ARENA_ALIGN
#define PR_INIT_ARENA_POOL PL_INIT_ARENA_POOL
#define PR_ARENA_ALLOCATE PL_ARENA_ALLOCATE
#define PR_ARENA_GROW PL_ARENA_GROW
#define PR_ARENA_MARK PL_ARENA_MARK
#define PR_CLEAR_UNUSED PL_CLEAR_UNUSED
#define PR_CLEAR_ARENA PL_CLEAR_ARENA
#define PR_ARENA_RELEASE PL_ARENA_RELEASE
#define PR_COUNT_ARENA PL_COUNT_ARENA
#define PR_ARENA_DESTROY PL_ARENA_DESTROY
#define PR_InitArenaPool PL_InitArenaPool
#define PR_FreeArenaPool PL_FreeArenaPool
#define PR_FinishArenaPool PL_FinishArenaPool
#define PR_CompactArenaPool PL_CompactArenaPool
#define PR_ArenaFinish PL_ArenaFinish
#define PR_ArenaAllocate PL_ArenaAllocate
#define PR_ArenaGrow PL_ArenaGrow
#define PR_ArenaRelease PL_ArenaRelease
#define PR_ArenaCountAllocation PL_ArenaCountAllocation
#define PR_ArenaCountInplaceGrowth PL_ArenaCountInplaceGrowth
#define PR_ArenaCountGrowth PL_ArenaCountGrowth
#define PR_ArenaCountRelease PL_ArenaCountRelease
#define PR_ArenaCountRetract PL_ArenaCountRetract

/* Re: prevent.h->plevent.h */
#define PREvent PLEvent
#define PREventQueue PLEventQueue
#define PR_CreateEventQueue PL_CreateEventQueue
#define PR_DestroyEventQueue PL_DestroyEventQueue
#define PR_GetEventQueueMonitor PL_GetEventQueueMonitor
#define PR_ENTER_EVENT_QUEUE_MONITOR PL_ENTER_EVENT_QUEUE_MONITOR
#define PR_EXIT_EVENT_QUEUE_MONITOR PL_EXIT_EVENT_QUEUE_MONITOR
#define PR_PostEvent PL_PostEvent
#define PR_PostSynchronousEvent PL_PostSynchronousEvent
#define PR_GetEvent PL_GetEvent
#define PR_EventAvailable PL_EventAvailable
#define PREventFunProc PLEventFunProc
#define PR_MapEvents PL_MapEvents
#define PR_RevokeEvents PL_RevokeEvents
#define PR_ProcessPendingEvents PL_ProcessPendingEvents
#define PR_WaitForEvent PL_WaitForEvent
#define PR_EventLoop PL_EventLoop
#define PR_GetEventQueueSelectFD PL_GetEventQueueSelectFD
#define PRHandleEventProc PLHandleEventProc
#define PRDestroyEventProc PLDestroyEventProc
#define PR_InitEvent PL_InitEvent
#define PR_GetEventOwner PL_GetEventOwner
#define PR_HandleEvent PL_HandleEvent
#define PR_DestroyEvent PL_DestroyEvent
#define PR_DequeueEvent PL_DequeueEvent
#define PR_GetMainEventQueue PL_GetMainEventQueue

/* Re: prhash.h->plhash.h */
#define PRHashEntry PLHashEntry
#define PRHashTable PLHashTable
#define PRHashNumber PLHashNumber
#define PRHashFunction PLHashFunction
#define PRHashComparator PLHashComparator
#define PRHashEnumerator PLHashEnumerator
#define PRHashAllocOps PLHashAllocOps
#define PR_NewHashTable PL_NewHashTable
#define PR_HashTableDestroy PL_HashTableDestroy
#define PR_HashTableRawLookup PL_HashTableRawLookup
#define PR_HashTableRawAdd PL_HashTableRawAdd
#define PR_HashTableRawRemove PL_HashTableRawRemove
#define PR_HashTableAdd PL_HashTableAdd
#define PR_HashTableRemove PL_HashTableRemove
#define PR_HashTableEnumerateEntries PL_HashTableEnumerateEntries
#define PR_HashTableLookup PL_HashTableLookup
#define PR_HashTableDump PL_HashTableDump
#define PR_HashString PL_HashString
#define PR_CompareStrings PL_CompareStrings
#define PR_CompareValues PL_CompareValues

#endif /* !defined(PROTYPES_H) */
