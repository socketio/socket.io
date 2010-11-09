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
 * PR time code.
 */
#include "jsstddef.h"
#ifdef SOLARIS
#define _REENTRANT 1
#endif
#include <string.h>
#include <time.h>
#include "jstypes.h"
#include "jsutil.h"

#include "jsprf.h"
#include "jslock.h"
#include "prmjtime.h"

#define PRMJ_DO_MILLISECONDS 1

#ifdef XP_OS2
#include <sys/timeb.h>
#endif
#ifdef XP_WIN
#include <windef.h>
#include <winbase.h>
#include <math.h>     /* for fabs */
#include <mmsystem.h> /* for timeBegin/EndPeriod */
/* VC++ 8.0 or later, and not WINCE */
#if _MSC_VER >= 1400 && !defined(WINCE)
#define NS_HAVE_INVALID_PARAMETER_HANDLER 1
#endif
#ifdef NS_HAVE_INVALID_PARAMETER_HANDLER
#include <stdlib.h>   /* for _set_invalid_parameter_handler */
#include <crtdbg.h>   /* for _CrtSetReportMode */
#endif

#ifdef JS_THREADSAFE
#include <prinit.h>
#endif

#endif

#if defined(XP_UNIX) || defined(XP_BEOS)

#ifdef _SVID_GETTOD   /* Defined only on Solaris, see Solaris <sys/types.h> */
extern int gettimeofday(struct timeval *tv);
#endif

#include <sys/time.h>

#endif /* XP_UNIX */

#define PRMJ_YEAR_DAYS 365L
#define PRMJ_FOUR_YEARS_DAYS (4 * PRMJ_YEAR_DAYS + 1)
#define PRMJ_CENTURY_DAYS (25 * PRMJ_FOUR_YEARS_DAYS - 1)
#define PRMJ_FOUR_CENTURIES_DAYS (4 * PRMJ_CENTURY_DAYS + 1)
#define PRMJ_HOUR_SECONDS  3600L
#define PRMJ_DAY_SECONDS  (24L * PRMJ_HOUR_SECONDS)
#define PRMJ_YEAR_SECONDS (PRMJ_DAY_SECONDS * PRMJ_YEAR_DAYS)
#define PRMJ_MAX_UNIX_TIMET 2145859200L /*time_t value equiv. to 12/31/2037 */

/* function prototypes */
static void PRMJ_basetime(JSInt64 tsecs, PRMJTime *prtm);
/*
 * get the difference in seconds between this time zone and UTC (GMT)
 */
JSInt32
PRMJ_LocalGMTDifference()
{
    struct tm ltime;

    /* get the difference between this time zone and GMT */
    memset((char *)&ltime,0,sizeof(ltime));
    ltime.tm_mday = 2;
    ltime.tm_year = 70;
    return (JSInt32)mktime(&ltime) - (24L * 3600L);
}

/* Constants for GMT offset from 1970 */
#define G1970GMTMICROHI        0x00dcdcad /* micro secs to 1970 hi */
#define G1970GMTMICROLOW       0x8b3fa000 /* micro secs to 1970 low */

#define G2037GMTMICROHI        0x00e45fab /* micro secs to 2037 high */
#define G2037GMTMICROLOW       0x7a238000 /* micro secs to 2037 low */

/* Convert from base time to extended time */
static JSInt64
PRMJ_ToExtendedTime(JSInt32 base_time)
{
    JSInt64 exttime;
    JSInt64 g1970GMTMicroSeconds;
    JSInt64 low;
    JSInt32 diff;
    JSInt64  tmp;
    JSInt64  tmp1;

    diff = PRMJ_LocalGMTDifference();
    JSLL_UI2L(tmp, PRMJ_USEC_PER_SEC);
    JSLL_I2L(tmp1,diff);
    JSLL_MUL(tmp,tmp,tmp1);

    JSLL_UI2L(g1970GMTMicroSeconds,G1970GMTMICROHI);
    JSLL_UI2L(low,G1970GMTMICROLOW);
#ifndef JS_HAVE_LONG_LONG
    JSLL_SHL(g1970GMTMicroSeconds,g1970GMTMicroSeconds,16);
    JSLL_SHL(g1970GMTMicroSeconds,g1970GMTMicroSeconds,16);
#else
    JSLL_SHL(g1970GMTMicroSeconds,g1970GMTMicroSeconds,32);
#endif
    JSLL_ADD(g1970GMTMicroSeconds,g1970GMTMicroSeconds,low);

    JSLL_I2L(exttime,base_time);
    JSLL_ADD(exttime,exttime,g1970GMTMicroSeconds);
    JSLL_SUB(exttime,exttime,tmp);
    return exttime;
}

#ifdef XP_WIN
typedef struct CalibrationData
{
    long double freq;         /* The performance counter frequency */
    long double offset;       /* The low res 'epoch' */
    long double timer_offset; /* The high res 'epoch' */

    /* The last high res time that we returned since recalibrating */
    JSInt64 last;

    JSBool calibrated;

#ifdef JS_THREADSAFE
    CRITICAL_SECTION data_lock;
    CRITICAL_SECTION calibration_lock;
#endif
} CalibrationData;

static const JSInt64 win2un = JSLL_INIT(0x19DB1DE, 0xD53E8000);

static CalibrationData calibration = { 0 };

#define FILETIME2INT64(ft) (((JSInt64)ft.dwHighDateTime) << 32LL | (JSInt64)ft.dwLowDateTime)

static void
NowCalibrate()
{
    FILETIME ft, ftStart;
    LARGE_INTEGER liFreq, now;

    if (calibration.freq == 0.0) {
        if(!QueryPerformanceFrequency(&liFreq)) {
            /* High-performance timer is unavailable */
            calibration.freq = -1.0;
        } else {
            calibration.freq = (long double) liFreq.QuadPart;
        }
    }
    if (calibration.freq > 0.0) {
        JSInt64 calibrationDelta = 0;

        /* By wrapping a timeBegin/EndPeriod pair of calls around this loop,
           the loop seems to take much less time (1 ms vs 15ms) on Vista. */
        timeBeginPeriod(1);
        GetSystemTimeAsFileTime(&ftStart);
        do {
            GetSystemTimeAsFileTime(&ft);
        } while (memcmp(&ftStart,&ft, sizeof(ft)) == 0);
        timeEndPeriod(1);

        /*
        calibrationDelta = (FILETIME2INT64(ft) - FILETIME2INT64(ftStart))/10;
        fprintf(stderr, "Calibration delta was %I64d us\n", calibrationDelta);
        */

        QueryPerformanceCounter(&now);

        calibration.offset = (long double) FILETIME2INT64(ft);
        calibration.timer_offset = (long double) now.QuadPart;

        /* The windows epoch is around 1600. The unix epoch is around
           1970. win2un is the difference (in windows time units which
           are 10 times more highres than the JS time unit) */
        calibration.offset -= win2un;
        calibration.offset *= 0.1;
        calibration.last = 0;

        calibration.calibrated = JS_TRUE;
    }
}

#define CALIBRATIONLOCK_SPINCOUNT 0
#define DATALOCK_SPINCOUNT 4096
#define LASTLOCK_SPINCOUNT 4096

#ifdef JS_THREADSAFE
static PRStatus
NowInit(void)
{
    memset(&calibration, 0, sizeof(calibration));
    NowCalibrate();
    InitializeCriticalSectionAndSpinCount(&calibration.calibration_lock, CALIBRATIONLOCK_SPINCOUNT);
    InitializeCriticalSectionAndSpinCount(&calibration.data_lock, DATALOCK_SPINCOUNT);
    return PR_SUCCESS;
}

void
PRMJ_NowShutdown()
{
    DeleteCriticalSection(&calibration.calibration_lock);
    DeleteCriticalSection(&calibration.data_lock);
}

#define MUTEX_LOCK(m) EnterCriticalSection(m)
#define MUTEX_TRYLOCK(m) TryEnterCriticalSection(m)
#define MUTEX_UNLOCK(m) LeaveCriticalSection(m)
#define MUTEX_SETSPINCOUNT(m, c) SetCriticalSectionSpinCount((m),(c))

static PRCallOnceType calibrationOnce = { 0 };

#else

#define MUTEX_LOCK(m)
#define MUTEX_TRYLOCK(m) 1
#define MUTEX_UNLOCK(m)
#define MUTEX_SETSPINCOUNT(m, c)

#endif


#endif /* XP_WIN */

/*

Win32 python-esque pseudo code
Please see bug 363258 for why the win32 timing code is so complex.

calibration mutex : Win32CriticalSection(spincount=0)
data mutex : Win32CriticalSection(spincount=4096)

def NowInit():
  init mutexes
  PRMJ_NowCalibration()

def NowCalibration():
  expensive up-to-15ms call

def PRMJ_Now():
  returnedTime = 0
  needCalibration = False
  cachedOffset = 0.0
  calibrated = False
  PR_CallOnce(PRMJ_NowInit)
  do
    if not global.calibrated or needCalibration:
      acquire calibration mutex
        acquire data mutex

          // Only recalibrate if someone didn't already
          if cachedOffset == calibration.offset:
            // Have all waiting threads immediately wait
            set data mutex spin count = 0
            PRMJ_NowCalibrate()
            calibrated = 1

            set data mutex spin count = default
        release data mutex
      release calibration mutex

    calculate lowres time

    if highres timer available:
      acquire data mutex
        calculate highres time
        cachedOffset = calibration.offset
        highres time = calibration.last = max(highres time, calibration.last)
      release data mutex

      get kernel tick interval

      if abs(highres - lowres) < kernel tick:
        returnedTime = highres time
        needCalibration = False
      else:
        if calibrated:
          returnedTime = lowres
          needCalibration = False
        else:
          needCalibration = True
    else:
      returnedTime = lowres
  while needCalibration

*/

JSInt64
PRMJ_Now(void)
{
#ifdef XP_OS2
    JSInt64 s, us, ms2us, s2us;
    struct timeb b;
#endif
#ifdef XP_WIN
    static int nCalls = 0;
    long double lowresTime, highresTimerValue;
    FILETIME ft;
    LARGE_INTEGER now;
    JSBool calibrated = JS_FALSE;
    JSBool needsCalibration = JS_FALSE;
    JSInt64 returnedTime;
    long double cachedOffset = 0.0;
#endif
#if defined(XP_UNIX) || defined(XP_BEOS)
    struct timeval tv;
    JSInt64 s, us, s2us;
#endif /* XP_UNIX */

#ifdef XP_OS2
    ftime(&b);
    JSLL_UI2L(ms2us, PRMJ_USEC_PER_MSEC);
    JSLL_UI2L(s2us, PRMJ_USEC_PER_SEC);
    JSLL_UI2L(s, b.time);
    JSLL_UI2L(us, b.millitm);
    JSLL_MUL(us, us, ms2us);
    JSLL_MUL(s, s, s2us);
    JSLL_ADD(s, s, us);
    return s;
#endif
#ifdef XP_WIN

    /* To avoid regressing startup time (where high resolution is likely
       not needed), give the old behavior for the first few calls.
       This does not appear to be needed on Vista as the timeBegin/timeEndPeriod
       calls seem to immediately take effect. */
    int thiscall = JS_ATOMIC_INCREMENT(&nCalls);
    /* 10 seems to be the number of calls to load with a blank homepage */
    if (thiscall <= 10) {
        GetSystemTimeAsFileTime(&ft);
        return (FILETIME2INT64(ft)-win2un)/10L;
    }

    /* For non threadsafe platforms, NowInit is not necessary */
#ifdef JS_THREADSAFE
    PR_CallOnce(&calibrationOnce, NowInit);
#endif
    do {
        if (!calibration.calibrated || needsCalibration) {
            MUTEX_LOCK(&calibration.calibration_lock);
            MUTEX_LOCK(&calibration.data_lock);

            /* Recalibrate only if no one else did before us */
            if(calibration.offset == cachedOffset) {
                /* Since calibration can take a while, make any other
                   threads immediately wait */
                MUTEX_SETSPINCOUNT(&calibration.data_lock, 0);

                NowCalibrate();

                calibrated = JS_TRUE;

                /* Restore spin count */
                MUTEX_SETSPINCOUNT(&calibration.data_lock, DATALOCK_SPINCOUNT);
            }
            MUTEX_UNLOCK(&calibration.data_lock);
            MUTEX_UNLOCK(&calibration.calibration_lock);
        }


        /* Calculate a low resolution time */
        GetSystemTimeAsFileTime(&ft);
        lowresTime = 0.1*(long double)(FILETIME2INT64(ft) - win2un);

        if (calibration.freq > 0.0) {
            long double highresTime, diff;

            DWORD timeAdjustment, timeIncrement;
            BOOL timeAdjustmentDisabled;

            /* Default to 15.625 ms if the syscall fails */
            long double skewThreshold = 15625.25;
            /* Grab high resolution time */
            QueryPerformanceCounter(&now);
            highresTimerValue = (long double)now.QuadPart;

            MUTEX_LOCK(&calibration.data_lock);
            highresTime = calibration.offset + PRMJ_USEC_PER_SEC*
                 (highresTimerValue-calibration.timer_offset)/calibration.freq;
            cachedOffset = calibration.offset;

            /* On some dual processor/core systems, we might get an earlier time
               so we cache the last time that we returned */
            calibration.last = max(calibration.last,(JSInt64)highresTime);
            returnedTime = calibration.last;
            MUTEX_UNLOCK(&calibration.data_lock);

            /* Rather than assume the NT kernel ticks every 15.6ms, ask it */
            if (GetSystemTimeAdjustment(&timeAdjustment,
                                        &timeIncrement,
                                        &timeAdjustmentDisabled)) {
                if (timeAdjustmentDisabled) {
                    /* timeAdjustment is in units of 100ns */
                    skewThreshold = timeAdjustment/10.0;
                } else {
                    /* timeIncrement is in units of 100ns */
                    skewThreshold = timeIncrement/10.0;
                }
            }

            /* Check for clock skew */
            diff = lowresTime - highresTime;

            /* For some reason that I have not determined, the skew can be
               up to twice a kernel tick. This does not seem to happen by
               itself, but I have only seen it triggered by another program
               doing some kind of file I/O. The symptoms are a negative diff
               followed by an equally large positive diff. */
            if (fabs(diff) > 2*skewThreshold) {
                /*fprintf(stderr,"Clock skew detected (diff = %f)!\n", diff);*/

                if (calibrated) {
                    /* If we already calibrated once this instance, and the
                       clock is still skewed, then either the processor(s) are
                       wildly changing clockspeed or the system is so busy that
                       we get switched out for long periods of time. In either
                       case, it would be infeasible to make use of high
                       resolution results for anything, so let's resort to old
                       behavior for this call. It's possible that in the
                       future, the user will want the high resolution timer, so
                       we don't disable it entirely. */
                    returnedTime = (JSInt64)lowresTime;
                    needsCalibration = JS_FALSE;
                } else {
                    /* It is possible that when we recalibrate, we will return a
                       value less than what we have returned before; this is
                       unavoidable. We cannot tell the different between a
                       faulty QueryPerformanceCounter implementation and user
                       changes to the operating system time. Since we must
                       respect user changes to the operating system time, we
                       cannot maintain the invariant that Date.now() never
                       decreases; the old implementation has this behavior as
                       well. */
                    needsCalibration = JS_TRUE;
                }
            } else {
                /* No detectable clock skew */
                returnedTime = (JSInt64)highresTime;
                needsCalibration = JS_FALSE;
            }
        } else {
            /* No high resolution timer is available, so fall back */
            returnedTime = (JSInt64)lowresTime;
        }
    } while (needsCalibration);

    return returnedTime;
#endif

#if defined(XP_UNIX) || defined(XP_BEOS)
#ifdef _SVID_GETTOD   /* Defined only on Solaris, see Solaris <sys/types.h> */
    gettimeofday(&tv);
#else
    gettimeofday(&tv, 0);
#endif /* _SVID_GETTOD */
    JSLL_UI2L(s2us, PRMJ_USEC_PER_SEC);
    JSLL_UI2L(s, tv.tv_sec);
    JSLL_UI2L(us, tv.tv_usec);
    JSLL_MUL(s, s, s2us);
    JSLL_ADD(s, s, us);
    return s;
#endif /* XP_UNIX */
}

/* Get the DST timezone offset for the time passed in */
JSInt64
PRMJ_DSTOffset(JSInt64 local_time)
{
    JSInt64 us2s;
    time_t local;
    JSInt32 diff;
    JSInt64  maxtimet;
    struct tm tm;
    PRMJTime prtm;
#ifndef HAVE_LOCALTIME_R
    struct tm *ptm;
#endif


    JSLL_UI2L(us2s, PRMJ_USEC_PER_SEC);
    JSLL_DIV(local_time, local_time, us2s);

    /* get the maximum of time_t value */
    JSLL_UI2L(maxtimet,PRMJ_MAX_UNIX_TIMET);

    if(JSLL_CMP(local_time,>,maxtimet)){
        JSLL_UI2L(local_time,PRMJ_MAX_UNIX_TIMET);
    } else if(!JSLL_GE_ZERO(local_time)){
        /*go ahead a day to make localtime work (does not work with 0) */
        JSLL_UI2L(local_time,PRMJ_DAY_SECONDS);
    }
    JSLL_L2UI(local,local_time);
    PRMJ_basetime(local_time,&prtm);
#ifndef HAVE_LOCALTIME_R
    ptm = localtime(&local);
    if(!ptm){
        return 0;
    }
    tm = *ptm;
#else
    localtime_r(&local,&tm); /* get dst information */
#endif

    diff = ((tm.tm_hour - prtm.tm_hour) * PRMJ_HOUR_SECONDS) +
	((tm.tm_min - prtm.tm_min) * 60);

    if(diff < 0){
	diff += PRMJ_DAY_SECONDS;
    }

    JSLL_UI2L(local_time,diff);

    JSLL_MUL(local_time,local_time,us2s);

    return(local_time);
}

#ifdef NS_HAVE_INVALID_PARAMETER_HANDLER
static void
PRMJ_InvalidParameterHandler(const wchar_t *expression,
                             const wchar_t *function,
                             const wchar_t *file,
                             unsigned int   line,
                             uintptr_t      pReserved)
{
    /* empty */
}
#endif

/* Format a time value into a buffer. Same semantics as strftime() */
size_t
PRMJ_FormatTime(char *buf, int buflen, const char *fmt, PRMJTime *prtm)
{
    size_t result = 0;
#if defined(XP_UNIX) || defined(XP_WIN) || defined(XP_OS2) || defined(XP_BEOS)
    struct tm a;
    int fake_tm_year = 0;
#ifdef NS_HAVE_INVALID_PARAMETER_HANDLER
    _invalid_parameter_handler oldHandler;
    int oldReportMode;
#endif

    /* Zero out the tm struct.  Linux, SunOS 4 struct tm has extra members int
     * tm_gmtoff, char *tm_zone; when tm_zone is garbage, strftime gets
     * confused and dumps core.  NSPR20 prtime.c attempts to fill these in by
     * calling mktime on the partially filled struct, but this doesn't seem to
     * work as well; the result string has "can't get timezone" for ECMA-valid
     * years.  Might still make sense to use this, but find the range of years
     * for which valid tz information exists, and map (per ECMA hint) from the
     * given year into that range.

     * N.B. This hasn't been tested with anything that actually _uses_
     * tm_gmtoff; zero might be the wrong thing to set it to if you really need
     * to format a time.  This fix is for jsdate.c, which only uses
     * JS_FormatTime to get a string representing the time zone.  */
    memset(&a, 0, sizeof(struct tm));

    a.tm_sec = prtm->tm_sec;
    a.tm_min = prtm->tm_min;
    a.tm_hour = prtm->tm_hour;
    a.tm_mday = prtm->tm_mday;
    a.tm_mon = prtm->tm_mon;
    a.tm_wday = prtm->tm_wday;

    /*
     * Years before 1900 and after 9999 cause strftime() to abort on Windows.
     * To avoid that we replace it with FAKE_YEAR_BASE + year % 100 and then
     * replace matching substrings in the strftime() result with the real year.
     * Note that FAKE_YEAR_BASE should be a multiple of 100 to make 2-digit
     * year formats (%y) work correctly (since we won't find the fake year
     * in that case).
     * e.g. new Date(1873, 0).toLocaleFormat('%Y %y') => "1873 73"
     * See bug 327869.
     */
#define FAKE_YEAR_BASE 9900
    if (prtm->tm_year < 1900 || prtm->tm_year > 9999) {
        fake_tm_year = FAKE_YEAR_BASE + prtm->tm_year % 100;
        a.tm_year = fake_tm_year - 1900;
    }
    else {
        a.tm_year = prtm->tm_year - 1900;
    }
    a.tm_yday = prtm->tm_yday;
    a.tm_isdst = prtm->tm_isdst;

    /*
     * Even with the above, SunOS 4 seems to detonate if tm_zone and tm_gmtoff
     * are null.  This doesn't quite work, though - the timezone is off by
     * tzoff + dst.  (And mktime seems to return -1 for the exact dst
     * changeover time.)
     */

#ifdef NS_HAVE_INVALID_PARAMETER_HANDLER
    oldHandler = _set_invalid_parameter_handler(PRMJ_InvalidParameterHandler);
    oldReportMode = _CrtSetReportMode(_CRT_ASSERT, 0);
#endif

    result = strftime(buf, buflen, fmt, &a);

#ifdef NS_HAVE_INVALID_PARAMETER_HANDLER
    _set_invalid_parameter_handler(oldHandler);
    _CrtSetReportMode(_CRT_ASSERT, oldReportMode);
#endif

    if (fake_tm_year && result) {
        char real_year[16];
        char fake_year[16];
        size_t real_year_len;
        size_t fake_year_len;
        char* p;

        sprintf(real_year, "%d", prtm->tm_year);
        real_year_len = strlen(real_year);
        sprintf(fake_year, "%d", fake_tm_year);
        fake_year_len = strlen(fake_year);

        /* Replace the fake year in the result with the real year. */
        for (p = buf; (p = strstr(p, fake_year)); p += real_year_len) {
            size_t new_result = result + real_year_len - fake_year_len;
            if ((int)new_result >= buflen) {
                return 0;
            }
            memmove(p + real_year_len, p + fake_year_len, strlen(p + fake_year_len));
            memcpy(p, real_year, real_year_len);
            result = new_result;
            *(buf + result) = '\0';
        }
    }
#endif
    return result;
}

/* table for number of days in a month */
static int mtab[] = {
    /* jan, feb,mar,apr,may,jun */
    31,28,31,30,31,30,
    /* july,aug,sep,oct,nov,dec */
    31,31,30,31,30,31
};

/*
 * basic time calculation functionality for localtime and gmtime
 * setups up prtm argument with correct values based upon input number
 * of seconds.
 */
static void
PRMJ_basetime(JSInt64 tsecs, PRMJTime *prtm)
{
    /* convert tsecs back to year,month,day,hour,secs */
    JSInt32 year    = 0;
    JSInt32 month   = 0;
    JSInt32 yday    = 0;
    JSInt32 mday    = 0;
    JSInt32 wday    = 6; /* start on a Sunday */
    JSInt32 days    = 0;
    JSInt32 seconds = 0;
    JSInt32 minutes = 0;
    JSInt32 hours   = 0;
    JSInt32 isleap  = 0;

    /* Temporaries used for various computations */
    JSInt64 result;
    JSInt64	result1;
    JSInt64	result2;

    JSInt64 base;

    /* Some variables for intermediate result storage to make computing isleap
       easier/faster */
    JSInt32 fourCenturyBlocks;
    JSInt32 centuriesLeft;
    JSInt32 fourYearBlocksLeft;
    JSInt32 yearsLeft;

    /* Since leap years work by 400/100/4 year intervals, precompute the length
       of those in seconds if they start at the beginning of year 1. */
    JSInt64 fourYears;
    JSInt64 century;
    JSInt64 fourCenturies;

    JSLL_UI2L(result, PRMJ_DAY_SECONDS);

    JSLL_I2L(fourYears, PRMJ_FOUR_YEARS_DAYS);
    JSLL_MUL(fourYears, fourYears, result);

    JSLL_I2L(century, PRMJ_CENTURY_DAYS);
    JSLL_MUL(century, century, result);

    JSLL_I2L(fourCenturies, PRMJ_FOUR_CENTURIES_DAYS);
    JSLL_MUL(fourCenturies, fourCenturies, result);

    /* get the base time via UTC */
    base = PRMJ_ToExtendedTime(0);
    JSLL_UI2L(result,  PRMJ_USEC_PER_SEC);
    JSLL_DIV(base,base,result);
    JSLL_ADD(tsecs,tsecs,base);

    /* Compute our |year|, |isleap|, and part of |days|.  When this part is
       done, |year| should hold the year our date falls in (number of whole
       years elapsed before our date), isleap should hold 1 if the year the
       date falls in is a leap year and 0 otherwise. */

    /* First do year 0; it's special and nonleap. */
    JSLL_UI2L(result, PRMJ_YEAR_SECONDS);
    if (!JSLL_CMP(tsecs,<,result)) {
        days = PRMJ_YEAR_DAYS;
        year = 1;
        JSLL_SUB(tsecs, tsecs, result);
    }

    /* Now use those constants we computed above */
    JSLL_UDIVMOD(&result1, &result2, tsecs, fourCenturies);
    JSLL_L2I(fourCenturyBlocks, result1);
    year += fourCenturyBlocks * 400;
    days += fourCenturyBlocks * PRMJ_FOUR_CENTURIES_DAYS;
    tsecs = result2;

    JSLL_UDIVMOD(&result1, &result2, tsecs, century);
    JSLL_L2I(centuriesLeft, result1);
    year += centuriesLeft * 100;
    days += centuriesLeft * PRMJ_CENTURY_DAYS;
    tsecs = result2;

    JSLL_UDIVMOD(&result1, &result2, tsecs, fourYears);
    JSLL_L2I(fourYearBlocksLeft, result1);
    year += fourYearBlocksLeft * 4;
    days += fourYearBlocksLeft * PRMJ_FOUR_YEARS_DAYS;
    tsecs = result2;

    /* Recall that |result| holds PRMJ_YEAR_SECONDS */
    JSLL_UDIVMOD(&result1, &result2, tsecs, result);
    JSLL_L2I(yearsLeft, result1);
    year += yearsLeft;
    days += yearsLeft * PRMJ_YEAR_DAYS;
    tsecs = result2;

    /* now compute isleap.  Note that we don't have to use %, since we've
       already computed those remainders.  Also note that they're all offset by
       1 because of the 1 for year 0. */
    isleap =
        (yearsLeft == 3) && (fourYearBlocksLeft != 24 || centuriesLeft == 3);
    JS_ASSERT(isleap ==
              ((year % 4 == 0) && (year % 100 != 0 || year % 400 == 0)));

    JSLL_UI2L(result1,PRMJ_DAY_SECONDS);

    JSLL_DIV(result,tsecs,result1);
    JSLL_L2I(mday,result);

    /* let's find the month */
    while(((month == 1 && isleap) ?
            (mday >= mtab[month] + 1) :
            (mday >= mtab[month]))){
	 yday += mtab[month];
	 days += mtab[month];

	 mday -= mtab[month];

         /* it's a Feb, check if this is a leap year */
	 if(month == 1 && isleap != 0){
	     yday++;
	     days++;
	     mday--;
	 }
	 month++;
    }

    /* now adjust tsecs */
    JSLL_MUL(result,result,result1);
    JSLL_SUB(tsecs,tsecs,result);

    mday++; /* day of month always start with 1 */
    days += mday;
    wday = (days + wday) % 7;

    yday += mday;

    /* get the hours */
    JSLL_UI2L(result1,PRMJ_HOUR_SECONDS);
    JSLL_DIV(result,tsecs,result1);
    JSLL_L2I(hours,result);
    JSLL_MUL(result,result,result1);
    JSLL_SUB(tsecs,tsecs,result);

    /* get minutes */
    JSLL_UI2L(result1,60);
    JSLL_DIV(result,tsecs,result1);
    JSLL_L2I(minutes,result);
    JSLL_MUL(result,result,result1);
    JSLL_SUB(tsecs,tsecs,result);

    JSLL_L2I(seconds,tsecs);

    prtm->tm_usec  = 0L;
    prtm->tm_sec   = (JSInt8)seconds;
    prtm->tm_min   = (JSInt8)minutes;
    prtm->tm_hour  = (JSInt8)hours;
    prtm->tm_mday  = (JSInt8)mday;
    prtm->tm_mon   = (JSInt8)month;
    prtm->tm_wday  = (JSInt8)wday;
    prtm->tm_year  = (JSInt16)year;
    prtm->tm_yday  = (JSInt16)yday;
}
