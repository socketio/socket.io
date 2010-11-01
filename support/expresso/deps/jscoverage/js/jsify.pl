#!/usr/local/bin/perl

# This script modifies C code to use the hijacked NSPR routines that are
# now baked into the JavaScript engine rather than using the NSPR
# routines that they were based on, i.e. types like PRArenaPool are changed
# to JSArenaPool.
#
# This script was used in 9/98 to facilitate the incorporation of some NSPR
# code into the JS engine so as to minimize dependency on NSPR.
#

# Command-line: jsify.pl [options] [filename]*
#
# Options:
#  -r         Reverse direction of transformation, i.e. JS ==> NSPR2
#  -outdir    Directory in which to place output files


# NSPR2 symbols that will be modified to JS symbols, e.g.
# PRArena <==> JSArena

@NSPR_symbols = (
"PRArena",
"PRArenaPool",
"PRArenaStats",
"PR_ARENAMETER",
"PR_ARENA_",
"PR_ARENA_ALIGN",
"PR_ARENA_ALLOCATE",
"PR_ARENA_CONST_ALIGN_MASK",
"PR_ARENA_DEFAULT_ALIGN",
"PR_ARENA_DESTROY",
"PR_ARENA_GROW",
"PR_ARENA_MARK",
"PR_ARENA_RELEASE",

"PR_smprintf",
"PR_smprintf_free",
"PR_snprintf",
"PR_sprintf_append",
"PR_sscanf",
"PR_sxprintf",
"PR_vsmprintf",
"PR_vsnprintf",
"PR_vsprintf_append",
"PR_vsxprintf",

"PRCList",
"PRCListStr",
"PRCLists",

"PRDestroyEventProc",
"PREvent",
"PREventFunProc",
"PREventQueue",
"PRHandleEventProc",
"PR_PostEvent",
"PR_PostSynchronousEvent",
"PR_ProcessPendingEvents",
"PR_CreateEventQueue",
"PR_DequeueEvent",
"PR_DestroyEvent",
"PR_DestroyEventQueue",
"PR_EventAvailable",
"PR_EventLoop",
"PR_GetEvent",
"PR_GetEventOwner",
"PR_GetEventQueueMonitor",
"PR_GetEventQueueSelectFD",
"PR_GetMainEventQueue",
"PR_HandleEvent",
"PR_InitEvent",
"PR_ENTER_EVENT_QUEUE_MONITOR",
"PR_EXIT_EVENT_QUEUE_MONITOR",
"PR_MapEvents",
"PR_RevokeEvents",

"PR_cnvtf",
"PR_dtoa",
"PR_strtod",

"PRFileDesc",

"PR_HASH_BITS",
"PR_GOLDEN_RATIO",
"PRHashAllocOps",
"PRHashComparator",
"PRHashEntry",
"PRHashEnumerator",
"PRHashFunction",
"PRHashNumber",
"PRHashTable",
"PR_HashString",
"PR_HashTableAdd",
"PR_HashTableDestroy",
"PR_HashTableDump",
"PR_HashTableEnumerateEntries",
"PR_HashTableLookup",
"PR_HashTableRawAdd",
"PR_HashTableRawLookup",
"PR_HashTableRawRemove",
"PR_HashTableRemove",

"PRBool",
"PRFloat64",
"PRInt16",
"PRInt32",
"PRInt64",
"PRInt8",
"PRIntn",
"PRUint16",
"PRUint32",
"PRUint64",
"PRUint8",
"PRUintn",
"PRPtrDiff",
"PRPtrdiff",
"PRUptrdiff",
"PRUword",
"PRWord",
"PRPackedBool",
"PRSize",
"PRStatus",
"pruword",
"prword",
"prword_t",

"PR_ALIGN_OF_DOUBLE",
"PR_ALIGN_OF_FLOAT",
"PR_ALIGN_OF_INT",
"PR_ALIGN_OF_INT64",
"PR_ALIGN_OF_LONG",
"PR_ALIGN_OF_POINTER",
"PR_ALIGN_OF_SHORT",
"PR_ALIGN_OF_WORD",
"PR_BITS_PER_BYTE",
"PR_BITS_PER_BYTE_LOG2",
"PR_BITS_PER_DOUBLE",
"PR_BITS_PER_DOUBLE_LOG2",
"PR_BITS_PER_FLOAT",
"PR_BITS_PER_FLOAT_LOG2",
"PR_BITS_PER_INT",
"PR_BITS_PER_INT64",
"PR_BITS_PER_INT64_LOG2",
"PR_BITS_PER_INT_LOG2",
"PR_BITS_PER_LONG",
"PR_BITS_PER_LONG_LOG2",
"PR_BITS_PER_SHORT",
"PR_BITS_PER_SHORT_LOG2",
"PR_BITS_PER_WORD",
"PR_BITS_PER_WORD_LOG2",
"PR_BYTES_PER_BYTE",
"PR_BYTES_PER_DOUBLE",
"PR_BYTES_PER_DWORD",
"PR_BYTES_PER_DWORD_LOG2",
"PR_BYTES_PER_FLOAT",
"PR_BYTES_PER_INT",
"PR_BYTES_PER_INT64",
"PR_BYTES_PER_LONG",
"PR_BYTES_PER_SHORT",
"PR_BYTES_PER_WORD",
"PR_BYTES_PER_WORD_LOG2",

"PRSegment",
"PRSegmentAccess",
"PRStuffFunc",
"PRThread",

"PR_APPEND_LINK",

"PR_ASSERT",

"PR_ATOMIC_DWORD_LOAD",
"PR_ATOMIC_DWORD_STORE",

"PR_Abort",

"PR_ArenaAllocate",
"PR_ArenaCountAllocation",
"PR_ArenaCountGrowth",
"PR_ArenaCountInplaceGrowth",
"PR_ArenaCountRelease",
"PR_ArenaCountRetract",
"PR_ArenaFinish",
"PR_ArenaGrow",
"PR_ArenaRelease",
"PR_CompactArenaPool",
"PR_DumpArenaStats",
"PR_FinishArenaPool",
"PR_FreeArenaPool",
"PR_InitArenaPool",

"PR_Assert",

"PR_AttachThread",

"PR_BEGIN_EXTERN_C",
"PR_BEGIN_MACRO",

"PR_BIT",
"PR_BITMASK",

"PR_BUFFER_OVERFLOW_ERROR",

"PR_CALLBACK",
"PR_CALLBACK_DECL",
"PR_CALLOC",
"PR_CEILING_LOG2",
"PR_CLEAR_ARENA",
"PR_CLEAR_BIT",
"PR_CLEAR_UNUSED",
"PR_CLIST_IS_EMPTY",
"PR_COUNT_ARENA",
"PR_CURRENT_THREAD",

"PR_GetSegmentAccess",
"PR_GetSegmentSize",
"PR_GetSegmentVaddr",
"PR_GrowSegment",
"PR_DestroySegment",
"PR_MapSegment",
"PR_NewSegment",
"PR_Segment",
"PR_Seg",
"PR_SEGMENT_NONE",
"PR_SEGMENT_RDONLY",
"PR_SEGMENT_RDWR",

"PR_Calloc",
"PR_CeilingLog2",
"PR_CompareStrings",
"PR_CompareValues",
"PR_DELETE",
"PR_END_EXTERN_C",
"PR_END_MACRO",
"PR_ENUMERATE_STOP",
"PR_FAILURE",
"PR_FALSE",
"PR_FLOOR_LOG2",
"PR_FREEIF",
"PR_FREE_PATTERN",
"PR_FloorLog2",
"PR_FormatTime",
"PR_Free",

"PR_GetEnv",
"PR_GetError",
"PR_INIT_ARENA_POOL",
"PR_INIT_CLIST",
"PR_INIT_STATIC_CLIST",
"PR_INLINE",
"PR_INSERT_AFTER",
"PR_INSERT_BEFORE",
"PR_INSERT_LINK",
"PR_INT32",
"PR_INTERVAL_NO_TIMEOUT",
"PR_INTERVAL_NO_WAIT",
"PR_Init",
"PR_LIST_HEAD",
"PR_LIST_TAIL",
"PR_LOG",
"PR_LOGGING",
"PR_LOG_ALWAYS",
"PR_LOG_BEGIN",
"PR_LOG_DEBUG",
"PR_LOG_DEFINE",
"PR_LOG_END",
"PR_LOG_ERROR",
"PR_LOG_MAX",
"PR_LOG_MIN",
"PR_LOG_NONE",
"PR_LOG_NOTICE",
"PR_LOG_TEST",
"PR_LOG_WARN",
"PR_LOG_WARNING",
"PR_LogFlush",
"PR_LogPrint",
"PR_MALLOC",
"PR_MAX",
"PR_MD_calloc",
"PR_MD_free",
"PR_MD_malloc",
"PR_MD_realloc",
"PR_MIN",
"PR_Malloc",
"PR_NEW",
"PR_NEWZAP",
"PR_NEXT_LINK",
"PR_NOT_REACHED",
"PR_NewCondVar",
"PR_NewHashTable",
"PR_NewLogModule",
"PR_PREV_LINK",
"PR_PUBLIC_API",
"PR_PUBLIC_DATA",
"PR_RANGE_ERROR",
"PR_REALLOC",
"PR_REMOVE_AND_INIT_LINK",
"PR_REMOVE_LINK",
"PR_ROUNDUP",
"PR_Realloc",

"PR_SET_BIT",
"PR_STATIC_CALLBACK",
"PR_SUCCESS",
"PR_SetError",
"PR_SetLogBuffering",
"PR_SetLogFile",

"PR_TEST_BIT",
"PR_TRUE",
"PR_UINT32",
"PR_UPTRDIFF",

"prarena_h___",
"prbit_h___",
"prclist_h___",
"prdtoa_h___",
"prlog_h___",
"prlong_h___",
"prmacos_h___",
"prmem_h___",
"prprf_h___",
"prtypes_h___",

"prarena",
"prbit",
"prbitmap_t",
"prclist",
"prcpucfg",
"prdtoa",
"prhash",
"plhash",
"prlong",
"prmacos",
"prmem",
"prosdep",
"protypes",
"prprf",
"prtypes"
);

while ($ARGV[0] =~ /^-/) {
    if ($ARGV[0] eq "-r") {
	shift;
	$reverse_conversion = 1;
    } elsif ($ARGV[0] eq "-outdir") {
	shift;
	$outdir = shift;
    }
}

# Given an NSPR symbol compute the JS equivalent or
# vice-versa
sub subst {
    local ($replacement);
    local ($sym) = @_;
    
    $replacement = substr($sym,0,2) eq "pr" ? "js" : "JS";
    $replacement .= substr($sym, 2);
    return $replacement;
}

# Build the regular expression that will convert between the NSPR
# types and the JS types
if ($reverse_conversion) {
    die "Not implemented yet";
} else {
    foreach $sym (@NSPR_symbols) {
	$regexp .= $sym . "|"
    }
    # Get rid of the last "!"
    chop $regexp;

    # Replace PR* with JS* and replace pr* with js*
    $regexp = 's/(^|\\W)(' . $regexp . ')/$1 . &subst($2)/eg';
#    print $regexp;
}

# Pre-compile a little subroutine to perform the regexp substitution
# between NSPR types and JS types
eval('sub convert_from_NSPR {($line) = @_; $line =~ ' . $regexp . ';}');

sub convert_mallocs {
    ($line) = @_;
    $line =~ s/PR_MALLOC/malloc/g;
    $line =~ s/PR_REALLOC/realloc/g;
    $line =~ s/PR_FREE/free/g;
    return $line;
}

sub convert_includes {
    ($line) = @_;
    if ($line !~ /include/) {
	return $line;
    }

    if ($line =~ /prlog\.h/) {
	$line = '#include "jsutil.h"'. " /* Added by JSIFY */\n";
    } elsif ($line =~ /plhash\.h/) {
	$line = '#include "jshash.h"'. " /* Added by JSIFY */\n";
    } elsif ($line =~ /plarena\.h/) {
	$line = '#include "jsarena.h"'. " /* Added by JSIFY */\n";
    } elsif ($line =~ /prmem\.h/) {
	$line  = "";
    } elsif ($line =~ /jsmsg\.def/) {
	$line  = '#include "js.msg"' . "\n";
    } elsif ($line =~ /shellmsg\.def/) {
	$line  = '#include "jsshell.msg"' . "\n";
    } elsif ($line =~ /jsopcode\.def/) {
	$line  = '#include "jsopcode.tbl"' . "\n";
    }
    return $line;
}

sub convert_declarations {
    ($line) = @_;
    $line =~ s/PR_EXTERN/JS_EXTERN_API/g;
    $line =~ s/PR_IMPLEMENT_DATA/JS_EXPORT_DATA/g;
    $line =~ s/PR_IMPLEMENT/JS_EXPORT_API/g;
    $line =~ s/PR_IMPORT/JS_IMPORT/g;
    $line =~ s/PR_PUBLIC_API/JS_EXPORT_API/g;
    $line =~ s/PR_PUBLIC_DATA/JS_EXPORT_DATA/g;
    return $line;
}    

sub convert_long_long_macros {
    ($line) = @_;
    $line =~ s/\b(LL_)/JSLL_/g;
    return $line;
}    

sub convert_asserts {
    ($line) = @_;
    $line =~ s/\bPR_ASSERT/JS_ASSERT/g;
    return $line;
}

while ($#ARGV >= 0) {
    $infile = shift;

    # Change filename, e.g. prtime.h to jsprtime.h, except for legacy
    # files that start with 'prmj', like prmjtime.h.
    $outfile = $infile;
    if ($infile !~ /^prmj/) {
	$outfile =~ s/^pr/js/;
	$outfile =~ s/^pl/js/;
    }
    
    if ($outdir) {
	$outfile = $outdir . '/' . $outfile;
    }	

    if ($infile eq $outfile) {
	die "Error: refuse to overwrite $outfile, use -outdir option."
    }
    die "Can't open $infile" if !open(INFILE, "<$infile");
    die "Can't open $outfile for writing" if !open(OUTFILE, ">$outfile");

    while (<INFILE>) {
	$line = $_;
	
	#Get rid of #include "prlog.h"
	&convert_includes($line);

	# Rename PR_EXTERN, PR_IMPORT, etc.
	&convert_declarations($line);

	# Convert from PR_MALLOC to malloc, etc.
	&convert_mallocs($line);
	
	# Convert from PR_ASSERT to JS_ASSERT
#	&convert_asserts($line);

	# Convert from, e.g. PRArena to JSPRArena
	&convert_from_NSPR($line);

	# Change LL_* macros to JSLL_*
	&convert_long_long_macros($line);
	
	print OUTFILE $line;
    }
}
