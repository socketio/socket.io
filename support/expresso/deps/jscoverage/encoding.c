/*
    encoding.c - character encoding
    Copyright (C) 2008 siliconforks.com

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

#include <config.h>

#include "encoding.h"

#include <assert.h>
#include <limits.h>
#include <string.h>

#ifdef HAVE_ICONV_H
#include <iconv.h>
#elif defined HAVE_WINDOWS_H
#include <windows.h>
#endif

#include "util.h"

static void skip_bom(jschar ** characters, size_t * num_characters) {
  jschar * c = *characters;
  size_t nc = *num_characters;

  size_t i;
  for (i = 0; i < nc; i++) {
    if (c[i] != 0xfeff) {
      break;
    }
  }

  if (i == 0) {
    return;
  }

  nc -= i;
  jschar * old = c;
  c = xnew(jschar, nc);
  memcpy(c, old + i, nc * sizeof(jschar));
  free(old);

  *characters = c;
  *num_characters = nc;
}

#ifdef HAVE_ICONV

#ifdef WORDS_BIGENDIAN
#define UTF_16_INTERNAL "UTF-16BE"
#else
#define UTF_16_INTERNAL "UTF-16LE"
#endif

int jscoverage_bytes_to_characters(const char * encoding, const uint8_t * bytes, size_t num_bytes, jschar ** characters, size_t * num_characters) {
  assert(encoding != NULL);

  iconv_t state = iconv_open(UTF_16_INTERNAL, encoding);
  if (state == (iconv_t) -1) {
    return JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED;
  }

  ICONV_CONST char * input = (char *) bytes;
  size_t input_bytes_left = num_bytes;

  jschar * c = xnew(jschar, num_bytes);
  char * output = (char *) c;
  size_t output_bytes_left = sizeof(jschar) * num_bytes;

  size_t result = iconv(state, &input, &input_bytes_left, &output, &output_bytes_left);
  iconv_close(state);
  if (result == (size_t) -1) {
    free(c);
    return JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE;
  }

  assert(input_bytes_left == 0);

  size_t nc = ((jschar *) output) - c;

  skip_bom(&c, &nc);

  *characters = c;
  *num_characters = nc;
  return 0;
}

#elif HAVE_MULTIBYTETOWIDECHAR

/* http://msdn.microsoft.com/en-us/library/ms776446(VS.85).aspx */
static struct CodePage {
  UINT value;
  LPCSTR string;
} code_pages[] = {
  {37,		"IBM037"},			/* IBM EBCDIC US-Canada */
  {437,		"IBM437"},			/* OEM United States */
  {500,		"IBM500"},			/* IBM EBCDIC International */
  {708,		"ASMO-708"},			/* Arabic (ASMO 708) */
  {720,		"DOS-720"},			/* Arabic (Transparent ASMO); Arabic (DOS) */
  {737,		"ibm737"},			/* OEM Greek (formerly 437G); Greek (DOS) */
  {775,		"ibm775"},			/* OEM Baltic; Baltic (DOS) */
  {850,		"ibm850"},			/* OEM Multilingual Latin 1; Western European (DOS) */
  {852,		"ibm852"},			/* OEM Latin 2; Central European (DOS) */
  {855,		"IBM855"},			/* OEM Cyrillic (primarily Russian) */
  {857,		"ibm857"},			/* OEM Turkish; Turkish (DOS) */
  {858,		"IBM00858"},			/* OEM Multilingual Latin 1 + Euro symbol */
  {860,		"IBM860"},			/* OEM Portuguese; Portuguese (DOS) */
  {861,		"ibm861"},			/* OEM Icelandic; Icelandic (DOS) */
  {862,		"DOS-862"},			/* OEM Hebrew; Hebrew (DOS) */
  {863,		"IBM863"},			/* OEM French Canadian; French Canadian (DOS) */
  {864,		"IBM864"},			/* OEM Arabic; Arabic (864) */
  {865,		"IBM865"},			/* OEM Nordic; Nordic (DOS) */
  {866,		"cp866"},			/* OEM Russian; Cyrillic (DOS) */
  {869,		"ibm869"},			/* OEM Modern Greek; Greek, Modern (DOS) */
  {870,		"IBM870"},			/* IBM EBCDIC Multilingual/ROECE (Latin 2); IBM EBCDIC Multilingual Latin 2 */
  {874,		"windows-874"},			/* ANSI/OEM Thai (same as 28605, ISO 8859-15); Thai (Windows) */
  {875,		"cp875"},			/* IBM EBCDIC Greek Modern */
  {932,		"shift_jis"},			/* ANSI/OEM Japanese; Japanese (Shift-JIS) */
  {936,		"gb2312"},			/* ANSI/OEM Simplified Chinese (PRC, Singapore); Chinese Simplified (GB2312) */
  {949,		"ks_c_5601-1987"},		/* ANSI/OEM Korean (Unified Hangul Code) */
  {950,		"big5"},			/* ANSI/OEM Traditional Chinese (Taiwan; Hong Kong SAR, PRC); Chinese Traditional (Big5) */
  {1026,	"IBM1026"},			/* IBM EBCDIC Turkish (Latin 5) */
  {1047,	"IBM01047"},			/* IBM EBCDIC Latin 1/Open System */
  {1140,	"IBM01140"},			/* IBM EBCDIC US-Canada (037 + Euro symbol); IBM EBCDIC (US-Canada-Euro) */
  {1141,	"IBM01141"},			/* IBM EBCDIC Germany (20273 + Euro symbol); IBM EBCDIC (Germany-Euro) */
  {1142,	"IBM01142"},			/* IBM EBCDIC Denmark-Norway (20277 + Euro symbol); IBM EBCDIC (Denmark-Norway-Euro) */
  {1143,	"IBM01143"},			/* IBM EBCDIC Finland-Sweden (20278 + Euro symbol); IBM EBCDIC (Finland-Sweden-Euro) */
  {1144,	"IBM01144"},			/* IBM EBCDIC Italy (20280 + Euro symbol); IBM EBCDIC (Italy-Euro) */
  {1145,	"IBM01145"},			/* IBM EBCDIC Latin America-Spain (20284 + Euro symbol); IBM EBCDIC (Spain-Euro) */
  {1146,	"IBM01146"},			/* IBM EBCDIC United Kingdom (20285 + Euro symbol); IBM EBCDIC (UK-Euro) */
  {1147,	"IBM01147"},			/* IBM EBCDIC France (20297 + Euro symbol); IBM EBCDIC (France-Euro) */
  {1148,	"IBM01148"},			/* IBM EBCDIC International (500 + Euro symbol); IBM EBCDIC (International-Euro) */
  {1149,	"IBM01149"},			/* IBM EBCDIC Icelandic (20871 + Euro symbol); IBM EBCDIC (Icelandic-Euro) */
  {1200,	"utf-16"},			/* Unicode UTF-16, little endian byte order (BMP of ISO 10646); available only to managed applications */
  {1201,	"unicodeFFFE"},			/* Unicode UTF-16, big endian byte order; available only to managed applications */
  {1250,	"windows-1250"},		/* ANSI Central European; Central European (Windows) */
  {1251,	"windows-1251"},		/* ANSI Cyrillic; Cyrillic (Windows) */
  {1252,	"windows-1252"},		/* ANSI Latin 1; Western European (Windows) */
  {1253,	"windows-1253"},		/* ANSI Greek; Greek (Windows) */
  {1254,	"windows-1254"},		/* ANSI Turkish; Turkish (Windows) */
  {1255,	"windows-1255"},		/* ANSI Hebrew; Hebrew (Windows) */
  {1256,	"windows-1256"},		/* ANSI Arabic; Arabic (Windows) */
  {1257,	"windows-1257"},		/* ANSI Baltic; Baltic (Windows) */
  {1258,	"windows-1258"},		/* ANSI/OEM Vietnamese; Vietnamese (Windows) */
  {1361,	"Johab"},			/* Korean (Johab) */
  {10000,	"macintosh"},			/* MAC Roman; Western European (Mac) */
  {10001,	"x-mac-japanese"},		/* Japanese (Mac) */
  {10002,	"x-mac-chinesetrad"},		/* MAC Traditional Chinese (Big5); Chinese Traditional (Mac) */
  {10003,	"x-mac-korean"},		/* Korean (Mac) */
  {10004,	"x-mac-arabic"},		/* Arabic (Mac) */
  {10005,	"x-mac-hebrew"},		/* Hebrew (Mac) */
  {10006,	"x-mac-greek"},			/* Greek (Mac) */
  {10007,	"x-mac-cyrillic"},		/* Cyrillic (Mac) */
  {10008,	"x-mac-chinesesimp"},		/* MAC Simplified Chinese (GB 2312); Chinese Simplified (Mac) */
  {10010,	"x-mac-romanian"},		/* Romanian (Mac) */
  {10017,	"x-mac-ukrainian"},		/* Ukrainian (Mac) */
  {10021,	"x-mac-thai"},			/* Thai (Mac) */
  {10029,	"x-mac-ce"},			/* MAC Latin 2; Central European (Mac) */
  {10079,	"x-mac-icelandic"},		/* Icelandic (Mac) */
  {10081,	"x-mac-turkish"},		/* Turkish (Mac) */
  {10082,	"x-mac-croatian"},		/* Croatian (Mac) */
  {12000,	"utf-32"},			/* Unicode UTF-32, little endian byte order; available only to managed applications */
  {12001,	"utf-32BE"},			/* Unicode UTF-32, big endian byte order; available only to managed applications */
  {20000,	"x-Chinese_CNS"},		/* CNS Taiwan; Chinese Traditional (CNS) */
  {20001,	"x-cp20001"},			/* TCA Taiwan */
  {20002,	"x_Chinese-Eten"},		/* Eten Taiwan; Chinese Traditional (Eten) */
  {20003,	"x-cp20003"},			/* IBM5550 Taiwan */
  {20004,	"x-cp20004"},			/* TeleText Taiwan */
  {20005,	"x-cp20005"},			/* Wang Taiwan */
  {20105,	"x-IA5"},			/* IA5 (IRV International Alphabet No. 5, 7-bit); Western European (IA5) */
  {20106,	"x-IA5-German"},		/* IA5 German (7-bit) */
  {20107,	"x-IA5-Swedish"},		/* IA5 Swedish (7-bit) */
  {20108,	"x-IA5-Norwegian"},		/* IA5 Norwegian (7-bit) */
  {20127,	"us-ascii"},			/* US-ASCII (7-bit) */
  {20261,	"x-cp20261"},			/* T.61 */
  {20269,	"x-cp20269"},			/* ISO 6937 Non-Spacing Accent */
  {20273,	"IBM273"},			/* IBM EBCDIC Germany */
  {20277,	"IBM277"},			/* IBM EBCDIC Denmark-Norway */
  {20278,	"IBM278"},			/* IBM EBCDIC Finland-Sweden */
  {20280,	"IBM280"},			/* IBM EBCDIC Italy */
  {20284,	"IBM284"},			/* IBM EBCDIC Latin America-Spain */
  {20285,	"IBM285"},			/* IBM EBCDIC United Kingdom */
  {20290,	"IBM290"},			/* IBM EBCDIC Japanese Katakana Extended */
  {20297,	"IBM297"},			/* IBM EBCDIC France */
  {20420,	"IBM420"},			/* IBM EBCDIC Arabic */
  {20423,	"IBM423"},			/* IBM EBCDIC Greek */
  {20424,	"IBM424"},			/* IBM EBCDIC Hebrew */
  {20833,	"x-EBCDIC-KoreanExtended"},	/* IBM EBCDIC Korean Extended */
  {20838,	"IBM-Thai"},			/* IBM EBCDIC Thai */
  {20866,	"koi8-r"},			/* Russian (KOI8-R); Cyrillic (KOI8-R) */
  {20871,	"IBM871"},			/* IBM EBCDIC Icelandic */
  {20880,	"IBM880"},			/* IBM EBCDIC Cyrillic Russian */
  {20905,	"IBM905"},			/* IBM EBCDIC Turkish */
  {20924,	"IBM00924"},			/* IBM EBCDIC Latin 1/Open System (1047 + Euro symbol) */
  {20932,	"EUC-JP"},			/* Japanese (JIS 0208-1990 and 0121-1990) */
  {20936,	"x-cp20936"},			/* Simplified Chinese (GB2312); Chinese Simplified (GB2312-80) */
  {20949,	"x-cp20949"},			/* Korean Wansung */
  {21025,	"cp1025"},			/* IBM EBCDIC Cyrillic Serbian-Bulgarian */
  {21866,	"koi8-u"},			/* Ukrainian (KOI8-U); Cyrillic (KOI8-U) */
  {28591,	"iso-8859-1"},			/* ISO 8859-1 Latin 1; Western European (ISO) */
  {28592,	"iso-8859-2"},			/* ISO 8859-2 Central European; Central European (ISO) */
  {28593,	"iso-8859-3"},			/* ISO 8859-3 Latin 3 */
  {28594,	"iso-8859-4"},			/* ISO 8859-4 Baltic */
  {28595,	"iso-8859-5"},			/* ISO 8859-5 Cyrillic */
  {28596,	"iso-8859-6"},			/* ISO 8859-6 Arabic */
  {28597,	"iso-8859-7"},			/* ISO 8859-7 Greek */
  {28598,	"iso-8859-8"},			/* ISO 8859-8 Hebrew; Hebrew (ISO-Visual) */
  {28599,	"iso-8859-9"},			/* ISO 8859-9 Turkish */
  {28603,	"iso-8859-13"},			/* ISO 8859-13 Estonian */
  {28605,	"iso-8859-15"},			/* ISO 8859-15 Latin 9 */
  {29001,	"x-Europa"},			/* Europa 3 */
  {38598,	"iso-8859-8-i"},		/* ISO 8859-8 Hebrew; Hebrew (ISO-Logical) */
  {50220,	"iso-2022-jp"},			/* ISO 2022 Japanese with no halfwidth Katakana; Japanese (JIS) */
  {50221,	"csISO2022JP"},			/* ISO 2022 Japanese with halfwidth Katakana; Japanese (JIS-Allow 1 byte Kana) */
  {50222,	"iso-2022-jp"},			/* ISO 2022 Japanese JIS X 0201-1989; Japanese (JIS-Allow 1 byte Kana - SO/SI) */
  {50225,	"iso-2022-kr"},			/* ISO 2022 Korean */
  {50227,	"x-cp50227"},			/* ISO 2022 Simplified Chinese; Chinese Simplified (ISO 2022) */
  {51932,	"euc-jp"},			/* EUC Japanese */
  {51936,	"EUC-CN"},			/* EUC Simplified Chinese; Chinese Simplified (EUC) */
  {51949,	"euc-kr"},			/* EUC Korean */
  {52936,	"hz-gb-2312"},			/* HZ-GB2312 Simplified Chinese; Chinese Simplified (HZ) */
  {54936,	"GB18030"},			/* Windows XP and later: GB18030 Simplified Chinese (4 byte); Chinese Simplified (GB18030) */
  {57002,	"x-iscii-de"},			/* ISCII Devanagari */
  {57003,	"x-iscii-be"},			/* ISCII Bengali */
  {57004,	"x-iscii-ta"},			/* ISCII Tamil */
  {57005,	"x-iscii-te"},			/* ISCII Telugu */
  {57006,	"x-iscii-as"},			/* ISCII Assamese */
  {57007,	"x-iscii-or"},			/* ISCII Oriya */
  {57008,	"x-iscii-ka"},			/* ISCII Kannada */
  {57009,	"x-iscii-ma"},			/* ISCII Malayalam */
  {57010,	"x-iscii-gu"},			/* ISCII Gujarati */
  {57011,	"x-iscii-pa"},			/* ISCII Punjabi */
  {65000,	"utf-7"},			/* Unicode (UTF-7) */
  {65001,	"utf-8"},			/* Unicode (UTF-8) */
};

int find_code_page(const char * encoding, UINT * code_page) {
  for (size_t i = 0; i < sizeof(code_pages) / sizeof(code_pages[0]); i++) {
    if (strcasecmp(encoding, code_pages[i].string) == 0) {
      *code_page = code_pages[i].value;
      return 0;
    }
  }
  return -1;
}

int jscoverage_bytes_to_characters(const char * encoding, const uint8_t * bytes, size_t num_bytes, jschar ** characters, size_t * num_characters) {
  assert(encoding != NULL);

  if (num_bytes == 0) {
    *characters = xnew(jschar, 0);
    *num_characters = 0;
    return 0;
  }

  UINT code_page;
  if (find_code_page(encoding, &code_page) != 0) {
    return JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED;
  }

  if (num_bytes > INT_MAX) {
    fatal("overflow");
  }

  *characters = xnew(jschar, num_bytes);

  int result = MultiByteToWideChar(code_page, MB_ERR_INVALID_CHARS, bytes, num_bytes, *characters, num_bytes);
  if (result == 0) {
    free(*characters);
    return JSCOVERAGE_ERROR_INVALID_BYTE_SEQUENCE;
  }

  *num_characters = result;
  skip_bom(characters, num_characters);
  return 0;
}

#else

int jscoverage_bytes_to_characters(const char * encoding, const uint8_t * bytes, size_t num_bytes, jschar ** characters, size_t * num_characters) {
  assert(encoding != NULL);

  if (strcasecmp(encoding, "us-ascii") != 0 && strcasecmp(encoding, "iso-8859-1") != 0 && strcasecmp(encoding, "utf-8") != 0) {
    return JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED;
  }

  jschar * c = xnew(jschar, num_bytes);
  for (size_t i = 0; i < num_bytes; i++) {
    if (bytes[i] > 127) {
      free(c);
      return JSCOVERAGE_ERROR_ENCODING_NOT_SUPPORTED;
    }
    c[i] = bytes[i];
  }

  *characters = c;
  *num_characters = num_bytes;
  return 0;
}

#endif
