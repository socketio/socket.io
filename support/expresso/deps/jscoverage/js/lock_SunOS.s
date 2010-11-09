! 
! ***** BEGIN LICENSE BLOCK *****
! Version: MPL 1.1/GPL 2.0/LGPL 2.1
!
! The contents of this file are subject to the Mozilla Public License Version
! 1.1 (the "License"); you may not use this file except in compliance with
! the License. You may obtain a copy of the License at
! http://www.mozilla.org/MPL/
!
! Software distributed under the License is distributed on an "AS IS" basis,
! WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
! for the specific language governing rights and limitations under the
! License.
!
! The Original Code is Mozilla Communicator client code, released
! March 31, 1998.
!
! The Initial Developer of the Original Code is
! Netscape Communications Corporation.
! Portions created by the Initial Developer are Copyright (C) 1998-1999
! the Initial Developer. All Rights Reserved.
!
! Contributor(s):
!
! Alternatively, the contents of this file may be used under the terms of
! either the GNU General Public License Version 2 or later (the "GPL"), or
! the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
! in which case the provisions of the GPL or the LGPL are applicable instead
! of those above. If you wish to allow use of your version of this file only
! under the terms of either the GPL or the LGPL, and not to allow others to
! use your version of this file under the terms of the MPL, indicate your
! decision by deleting the provisions above and replace them with the notice
! and other provisions required by the GPL or the LGPL. If you do not delete
! the provisions above, a recipient may use your version of this file under
! the terms of any one of the MPL, the GPL or the LGPL.
!
! ***** END LICENSE BLOCK *****

!
!  atomic compare-and-swap routines for V8 sparc 
!  and for V8+ (ultrasparc)
!
!
!  standard asm linkage macros; this module must be compiled
!  with the -P option (use C preprocessor)

#include <sys/asm_linkage.h>

!  ======================================================================
!
!  Perform the sequence *a = b atomically with respect to previous value
!  of a (a0). If *a==a0 then assign *a to b, all in one atomic operation.
!  Returns 1 if assignment happened, and 0 otherwise.	
!
!  usage : old_val = compare_and_swap(address, oldval, newval)
!
!  -----------------------
!  Note on REGISTER USAGE:
!  as this is a LEAF procedure, a new stack frame is not created;
!  we use the caller stack frame so what would normally be %i (input)
!  registers are actually %o (output registers).  Also, we must not
!  overwrite the contents of %l (local) registers as they are not
!  assumed to be volatile during calls.
!
!  So, the registers used are:
!     %o0  [input]   - the address of the value to increment
!     %o1  [input]   - the old value to compare with	
!     %o2  [input]   - the new value to set for [%o0]
!     %o3  [local]   - work register
!  -----------------------
#ifndef ULTRA_SPARC
!  v8	

        ENTRY(compare_and_swap)         ! standard assembler/ELF prologue

	stbar
	mov -1,%o3                      ! busy flag
	swap [%o0],%o3                  ! get current value
l1:	cmp %o3,-1                      ! busy?
	be,a l1                         ! if so, spin
	swap [%o0],%o3                  ! using branch-delay to swap back value
	cmp %o1,%o3                     ! compare old with current
	be,a l2                         ! if equal then swap in new value
	swap [%o0],%o2                  ! done.
	swap [%o0],%o3                  ! otherwise, swap back current value
	retl
	mov 0,%o0                       ! return false
l2:	retl
	mov 1,%o0                       ! return true
	
	SET_SIZE(compare_and_swap)      ! standard assembler/ELF epilogue

!
!  end
!
#else /* ULTRA_SPARC */
!  ======================================================================
!
!  v9

        ENTRY(compare_and_swap)         ! standard assembler/ELF prologue

	stbar
	cas [%o0],%o1,%o2               ! compare *w with old value and set to new if equal
	cmp %o1,%o2                     ! did we succeed?
	be,a m1                         ! yes
	mov 1,%o0                       ! return true (annulled when no jump)
        mov 0,%o0                       ! return false
m1:	retl
	nop
		
	SET_SIZE(compare_and_swap)      ! standard assembler/ELF epilogue

!
!  end
!
!  ======================================================================
!
#endif
