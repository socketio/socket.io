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
 *   Roland Mainz <roland.mainz@informatik.med.uni-giessen.de>
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
 * Generate CPU-specific bit-size and similar #defines.
 */
#include <stdio.h>
#include <stdlib.h>

#ifdef CROSS_COMPILE
#include <prtypes.h>
#define INT64 PRInt64
#else

/************************************************************************/

/* Generate cpucfg.h */

#if defined(XP_WIN) || defined(XP_OS2)
#ifdef WIN32
#if defined(__GNUC__)
#define INT64   long long
#else
#define INT64   _int64
#endif /* __GNUC__ */
#else
#define INT64   long
#endif
#else
#if defined(HPUX) || defined(__QNX__)
#define INT64   long
#else
#define INT64   long long
#endif
#endif

#endif /* CROSS_COMPILE */

#ifdef __GNUC__
#define NS_NEVER_INLINE __attribute__((noinline))
#else
#define NS_NEVER_INLINE
#endif

#ifdef __SUNPRO_C
static int StackGrowthDirection(int *dummy1addr);
#pragma no_inline(StackGrowthDirection)
#endif

typedef void *prword;

struct align_short {
    char c;
    short a;
};
struct align_int {
    char c;
    int a;
};
struct align_long {
    char c;
    long a;
};
struct align_int64 {
    char c;
    INT64 a;
};
struct align_fakelonglong {
    char c;
    struct {
        long hi, lo;
    } a;
};
struct align_float {
    char c;
    float a;
};
struct align_double {
    char c;
    double a;
};
struct align_pointer {
    char c;
    void *a;
};
struct align_prword {
    char c;
    prword a;
};

#define ALIGN_OF(type) \
    (((char*)&(((struct align_##type *)0)->a)) - ((char*)0))

unsigned int bpb;

static int Log2(unsigned int n)
{
    int log2 = 0;

    if (n & (n-1))
        log2++;
    if (n >> 16)
        log2 += 16, n >>= 16;
    if (n >> 8)
        log2 += 8, n >>= 8;
    if (n >> 4)
        log2 += 4, n >>= 4;
    if (n >> 2)
        log2 += 2, n >>= 2;
    if (n >> 1)
        log2++;
    return log2;
}

/*
 * Conceivably this could actually be used, but there is lots of code out
 * there with ands and shifts in it that assumes a byte is exactly 8 bits,
 * so forget about porting THIS code to all those non 8 bit byte machines.
 */
static void BitsPerByte(void)
{
    bpb = 8;
}

static int NS_NEVER_INLINE StackGrowthDirection(int *dummy1addr)
{
    int dummy2;

    return (&dummy2 < dummy1addr) ? -1 : 1;
}

int main(int argc, char **argv)
{
    int sizeof_char, sizeof_short, sizeof_int, sizeof_int64, sizeof_long,
        sizeof_float, sizeof_double, sizeof_word, sizeof_dword;
    int bits_per_int64_log2, align_of_short, align_of_int, align_of_long,
        align_of_int64, align_of_float, align_of_double, align_of_pointer,
        align_of_word;
    int dummy1;

    BitsPerByte();

    printf("#ifndef js_cpucfg___\n");
    printf("#define js_cpucfg___\n\n");

    printf("/* AUTOMATICALLY GENERATED - DO NOT EDIT */\n\n");

#ifdef CROSS_COMPILE
#if defined(IS_LITTLE_ENDIAN)
    printf("#define IS_LITTLE_ENDIAN 1\n");
    printf("#undef  IS_BIG_ENDIAN\n\n");
#elif defined(IS_BIG_ENDIAN)
    printf("#undef  IS_LITTLE_ENDIAN\n");
    printf("#define IS_BIG_ENDIAN 1\n\n");
#else
#error "Endianess not defined."
#endif

    sizeof_char         = PR_BYTES_PER_BYTE;
    sizeof_short        = PR_BYTES_PER_SHORT;
    sizeof_int          = PR_BYTES_PER_INT;
    sizeof_int64        = PR_BYTES_PER_INT64;
    sizeof_long         = PR_BYTES_PER_LONG;
    sizeof_float        = PR_BYTES_PER_FLOAT;
    sizeof_double       = PR_BYTES_PER_DOUBLE;
    sizeof_word         = PR_BYTES_PER_WORD;
    sizeof_dword        = PR_BYTES_PER_DWORD;

    bits_per_int64_log2 = PR_BITS_PER_INT64_LOG2;

    align_of_short      = PR_ALIGN_OF_SHORT;
    align_of_int        = PR_ALIGN_OF_INT;
    align_of_long       = PR_ALIGN_OF_LONG;
    align_of_int64      = PR_ALIGN_OF_INT64;
    align_of_float      = PR_ALIGN_OF_FLOAT;
    align_of_double     = PR_ALIGN_OF_DOUBLE;
    align_of_pointer    = PR_ALIGN_OF_POINTER;
    align_of_word       = PR_ALIGN_OF_WORD;

#else /* !CROSS_COMPILE */

    /*
     * We don't handle PDP-endian or similar orders: if a short is big-endian,
     * so must int and long be big-endian for us to generate the IS_BIG_ENDIAN
     * #define and the IS_LITTLE_ENDIAN #undef.
     */
    {
        int big_endian = 0, little_endian = 0, ntests = 0;

        if (sizeof(short) == 2) {
            /* force |volatile| here to get rid of any compiler optimisations
             * (var in register etc.) which may be appiled to |auto| vars -
             * even those in |union|s...
             * (|static| is used to get the same functionality for compilers
             * which do not honor |volatile|...).
             */
            volatile static union {
                short i;
                char c[2];
            } u;

            u.i = 0x0102;
            big_endian += (u.c[0] == 0x01 && u.c[1] == 0x02);
            little_endian += (u.c[0] == 0x02 && u.c[1] == 0x01);
            ntests++;
        }

        if (sizeof(int) == 4) {
            /* force |volatile| here ... */
            volatile static union {
                int i;
                char c[4];
            } u;

            u.i = 0x01020304;
            big_endian += (u.c[0] == 0x01 && u.c[1] == 0x02 &&
                           u.c[2] == 0x03 && u.c[3] == 0x04);
            little_endian += (u.c[0] == 0x04 && u.c[1] == 0x03 &&
                              u.c[2] == 0x02 && u.c[3] == 0x01);
            ntests++;
        }

        if (sizeof(long) == 8) {
            /* force |volatile| here ... */
            volatile static union {
                long i;
                char c[8];
            } u;

            /*
             * Write this as portably as possible: avoid 0x0102030405060708L
             * and <<= 32.
             */
            u.i = 0x01020304;
            u.i <<= 16, u.i <<= 16;
            u.i |= 0x05060708;
            big_endian += (u.c[0] == 0x01 && u.c[1] == 0x02 &&
                           u.c[2] == 0x03 && u.c[3] == 0x04 &&
                           u.c[4] == 0x05 && u.c[5] == 0x06 &&
                           u.c[6] == 0x07 && u.c[7] == 0x08);
            little_endian += (u.c[0] == 0x08 && u.c[1] == 0x07 &&
                              u.c[2] == 0x06 && u.c[3] == 0x05 &&
                              u.c[4] == 0x04 && u.c[5] == 0x03 &&
                              u.c[6] == 0x02 && u.c[7] == 0x01);
            ntests++;
        }

        if (big_endian && big_endian == ntests) {
            printf("#undef  IS_LITTLE_ENDIAN\n");
            printf("#define IS_BIG_ENDIAN 1\n\n");
        } else if (little_endian && little_endian == ntests) {
            printf("#define IS_LITTLE_ENDIAN 1\n");
            printf("#undef  IS_BIG_ENDIAN\n\n");
        } else {
            fprintf(stderr, "%s: unknown byte order"
                    "(big_endian=%d, little_endian=%d, ntests=%d)!\n",
                    argv[0], big_endian, little_endian, ntests);
            return EXIT_FAILURE;
        }
    }

    sizeof_char         = sizeof(char);
    sizeof_short        = sizeof(short);
    sizeof_int          = sizeof(int);
    sizeof_int64        = 8;
    sizeof_long         = sizeof(long);
    sizeof_float        = sizeof(float);
    sizeof_double       = sizeof(double);
    sizeof_word         = sizeof(prword);
    sizeof_dword        = 8;

    bits_per_int64_log2 = 6;

    align_of_short      = ALIGN_OF(short);
    align_of_int        = ALIGN_OF(int);
    align_of_long       = ALIGN_OF(long);
    if (sizeof(INT64) < 8) {
        /* this machine doesn't actually support int64's */
        align_of_int64  = ALIGN_OF(fakelonglong);
    } else {
        align_of_int64  = ALIGN_OF(int64);
    }
    align_of_float      = ALIGN_OF(float);
    align_of_double     = ALIGN_OF(double);
    align_of_pointer    = ALIGN_OF(pointer);
    align_of_word       = ALIGN_OF(prword);

#endif /* CROSS_COMPILE */

    printf("#define JS_BYTES_PER_BYTE   %dL\n", sizeof_char);
    printf("#define JS_BYTES_PER_SHORT  %dL\n", sizeof_short);
    printf("#define JS_BYTES_PER_INT    %dL\n", sizeof_int);
    printf("#define JS_BYTES_PER_INT64  %dL\n", sizeof_int64);
    printf("#define JS_BYTES_PER_LONG   %dL\n", sizeof_long);
    printf("#define JS_BYTES_PER_FLOAT  %dL\n", sizeof_float);
    printf("#define JS_BYTES_PER_DOUBLE %dL\n", sizeof_double);
    printf("#define JS_BYTES_PER_WORD   %dL\n", sizeof_word);
    printf("#define JS_BYTES_PER_DWORD  %dL\n", sizeof_dword);
    printf("\n");

    printf("#define JS_BITS_PER_BYTE    %dL\n", bpb);
    printf("#define JS_BITS_PER_SHORT   %dL\n", bpb * sizeof_short);
    printf("#define JS_BITS_PER_INT     %dL\n", bpb * sizeof_int);
    printf("#define JS_BITS_PER_INT64   %dL\n", bpb * sizeof_int64);
    printf("#define JS_BITS_PER_LONG    %dL\n", bpb * sizeof_long);
    printf("#define JS_BITS_PER_FLOAT   %dL\n", bpb * sizeof_float);
    printf("#define JS_BITS_PER_DOUBLE  %dL\n", bpb * sizeof_double);
    printf("#define JS_BITS_PER_WORD    %dL\n", bpb * sizeof_word);
    printf("\n");

    printf("#define JS_BITS_PER_BYTE_LOG2   %dL\n", Log2(bpb));
    printf("#define JS_BITS_PER_SHORT_LOG2  %dL\n", Log2(bpb * sizeof_short));
    printf("#define JS_BITS_PER_INT_LOG2    %dL\n", Log2(bpb * sizeof_int));
    printf("#define JS_BITS_PER_INT64_LOG2  %dL\n", bits_per_int64_log2);
    printf("#define JS_BITS_PER_LONG_LOG2   %dL\n", Log2(bpb * sizeof_long));
    printf("#define JS_BITS_PER_FLOAT_LOG2  %dL\n", Log2(bpb * sizeof_float));
    printf("#define JS_BITS_PER_DOUBLE_LOG2 %dL\n", Log2(bpb * sizeof_double));
    printf("#define JS_BITS_PER_WORD_LOG2   %dL\n", Log2(bpb * sizeof_word));
    printf("\n");

    printf("#define JS_ALIGN_OF_SHORT   %dL\n", align_of_short);
    printf("#define JS_ALIGN_OF_INT     %dL\n", align_of_int);
    printf("#define JS_ALIGN_OF_LONG    %dL\n", align_of_long);
    printf("#define JS_ALIGN_OF_INT64   %dL\n", align_of_int64);
    printf("#define JS_ALIGN_OF_FLOAT   %dL\n", align_of_float);
    printf("#define JS_ALIGN_OF_DOUBLE  %dL\n", align_of_double);
    printf("#define JS_ALIGN_OF_POINTER %dL\n", align_of_pointer);
    printf("#define JS_ALIGN_OF_WORD    %dL\n", align_of_word);
    printf("\n");

    printf("#define JS_BYTES_PER_WORD_LOG2   %dL\n", Log2(sizeof_word));
    printf("#define JS_BYTES_PER_DWORD_LOG2  %dL\n", Log2(sizeof_dword));
    printf("#define JS_WORDS_PER_DWORD_LOG2  %dL\n", Log2(sizeof_dword/sizeof_word));
    printf("\n");

    printf("#define JS_STACK_GROWTH_DIRECTION (%d)\n", StackGrowthDirection(&dummy1));
    printf("\n");

    printf("#define JS_HAVE_LONG_LONG\n");
    printf("\n");

#if defined __GNUC__ && defined __x86_64__
    printf("#define HAVE_VA_LIST_AS_ARRAY 1\n");
    printf("\n");
#endif

    printf("#endif /* js_cpucfg___ */\n");

    return EXIT_SUCCESS;
}

