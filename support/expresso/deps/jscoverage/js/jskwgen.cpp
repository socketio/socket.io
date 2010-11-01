/* -*- Mode: C; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * vim: set sw=4 ts=8 et tw=80:
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
 * The Original Code is String Switch Generator for JavaScript Keywords,
 * released 2005-12-09.
 *
 * The Initial Developer of the Original Code is
 * Igor Bukanov.
 * Portions created by the Initial Developer are Copyright (C) 2005-2006
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

#include "jsstddef.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <ctype.h>

#include "jsversion.h"

const char * const keyword_list[] = {
#define JS_KEYWORD(keyword, type, op, version) #keyword,
#include "jskeyword.tbl"
#undef JS_KEYWORD
};

struct gen_opt {
    FILE *output;                       /* output file for generated source */
    unsigned use_if_threshold;          /* max number of choices to generate
                                           "if" selector instead of "switch" */
    unsigned char_tail_test_threshold;  /* max number of unprocessed columns
                                           to use inlined char compare
                                           for remaining chars and not generic
                                           string compare code */
    unsigned indent_level;              /* current source identation level */
};

static unsigned column_to_compare;

static int
length_comparator(const void *a, const void *b)
{
    const char *str1 = keyword_list[*(unsigned *)a];
    const char *str2 = keyword_list[*(unsigned *)b];
    return (int)strlen(str1) - (int)strlen(str2);
}

static int
column_comparator(const void *a, const void *b)
{
    const char *str1 = keyword_list[*(unsigned *)a];
    const char *str2 = keyword_list[*(unsigned *)b];
    return (int)str1[column_to_compare] - (int)str2[column_to_compare];
}

static unsigned
count_different_lengths(unsigned indexes[], unsigned nelem)
{
    unsigned nlength, current_length, i, l;

    current_length = 0;
    nlength = 0;
    for (i = 0; i != nelem; ++i) {
        l = (unsigned)strlen(keyword_list[indexes[i]]);
        assert(l != 0);
        if (current_length != l) {
            ++nlength;
            current_length = l;
        }
    }
    return nlength;
}

static void
find_char_span_and_count(unsigned indexes[], unsigned nelem, unsigned column,
                         unsigned *span_result, unsigned *count_result)
{
    unsigned i, count;
    unsigned char c, prev, minc, maxc;

    assert(nelem != 0);
    minc = maxc = prev = (unsigned char)keyword_list[indexes[0]][column];
    count = 1;
    for (i = 1; i != nelem; ++i) {
        c = (unsigned char)keyword_list[indexes[i]][column];
        if (prev != c) {
            prev = c;
            ++count;
            if (minc > c) {
                minc = c;
            } else if (maxc < c) {
                maxc = c;
            }
        }
    }

    *span_result = maxc - minc + 1;
    *count_result = count;
}

static unsigned
find_optimal_switch_column(struct gen_opt *opt,
                           unsigned indexes[], unsigned nelem,
                           unsigned columns[], unsigned unprocessed_columns,
                           int *use_if_result)
{
    unsigned i;
    unsigned span, min_span, min_span_index;
    unsigned nchar, min_nchar, min_nchar_index;

    assert(unprocessed_columns != 0);
    i = 0;
    min_nchar = min_span = (unsigned)-1;
    min_nchar_index = min_span_index = 0;
    do {
        column_to_compare = columns[i];
        qsort(indexes, nelem, sizeof(indexes[0]), column_comparator);
        find_char_span_and_count(indexes, nelem, column_to_compare,
                                 &span, &nchar);
        assert(span != 0);
        if (span == 1) {
            assert(nchar == 1);
            *use_if_result = 1;
            return 1;
        }
        assert(nchar != 1);
        if (min_span > span) {
            min_span = span;
            min_span_index = i;
        }
        if (min_nchar > nchar) {
            min_nchar = nchar;
            min_nchar_index = i;
        }
    } while (++i != unprocessed_columns);

    if (min_nchar <= opt->use_if_threshold) {
        *use_if_result = 1;
        i = min_nchar_index;
    } else {
        *use_if_result = 0;
        i = min_span_index;
    }

    /*
     * Restore order corresponding to i if it was destroyed by
     * subsequent sort.
     */
    if (i != unprocessed_columns - 1) {
        column_to_compare = columns[i];
        qsort(indexes, nelem, sizeof(indexes[0]), column_comparator);
    }

    return i;
}


static void
p(struct gen_opt *opt, const char *format, ...)
{
    va_list ap;

    va_start(ap, format);
    vfprintf(opt->output, format, ap);
    va_end(ap);
}

/* Size for '\xxx' where xxx is octal escape */
#define MIN_QUOTED_CHAR_BUFFER 7

static char *
qchar(char c, char *quoted_buffer)
{
    char *s;

    s = quoted_buffer;
    *s++ = '\'';
    switch (c) {
      case '\n': c = 'n'; goto one_char_escape;
      case '\r': c = 'r'; goto one_char_escape;
      case '\t': c = 't'; goto one_char_escape;
      case '\f': c = 't'; goto one_char_escape;
      case '\0': c = '0'; goto one_char_escape;
      case '\'': goto one_char_escape;
      one_char_escape:
        *s++ = '\\';
        break;
      default:
        if (!isprint(c)) {
            *s++ = '\\';
            *s++ = (char)('0' + (0x3 & (((unsigned char)c) >> 6)));
            *s++ = (char)('0' + (0x7 & (((unsigned char)c) >> 3)));
            c = (char)('0' + (0x7 & ((unsigned char)c)));
        }
    }
    *s++ = c;
    *s++ = '\'';
    *s = '\0';
    assert(s + 1 <= quoted_buffer + MIN_QUOTED_CHAR_BUFFER);
    return quoted_buffer;
}

static void
nl(struct gen_opt *opt)
{
    putc('\n', opt->output);
}

static void
indent(struct gen_opt *opt)
{
    unsigned n = opt->indent_level;
    while (n != 0) {
        --n;
        fputs("    ", opt->output);
    }
}

static void
line(struct gen_opt *opt, const char *format, ...)
{
    va_list ap;

    indent(opt);
    va_start(ap, format);
    vfprintf(opt->output, format, ap);
    va_end(ap);
    nl(opt);
}

static void
generate_letter_switch_r(struct gen_opt *opt,
                         unsigned indexes[], unsigned nelem,
                         unsigned columns[], unsigned unprocessed_columns)
{
    char qbuf[MIN_QUOTED_CHAR_BUFFER];

    assert(nelem != 0);
    if (nelem == 1) {
        unsigned kw_index = indexes[0];
        const char *keyword = keyword_list[kw_index];

        if (unprocessed_columns == 0) {
            line(opt, "JSKW_GOT_MATCH(%u) /* %s */", kw_index, keyword);
        } else if (unprocessed_columns > opt->char_tail_test_threshold) {
            line(opt, "JSKW_TEST_GUESS(%u) /* %s */", kw_index, keyword);
        } else {
            unsigned i, column;

            indent(opt); p(opt, "if (");
            for (i = 0; i != unprocessed_columns; ++i) {
                column = columns[i];
                qchar(keyword[column], qbuf);
                p(opt, "%sJSKW_AT(%u)==%s", (i == 0) ? "" : " && ",
                  column, qbuf);
            }
            p(opt, ") {"); nl(opt);
            ++opt->indent_level;
            line(opt, "JSKW_GOT_MATCH(%u) /* %s */", kw_index, keyword);
            --opt->indent_level;
            line(opt, "}");
            line(opt, "JSKW_NO_MATCH()");
        }
    } else {
        unsigned optimal_column_index, optimal_column;
        unsigned i;
        int use_if;
        char current;

        assert(unprocessed_columns != 0);
        optimal_column_index = find_optimal_switch_column(opt, indexes, nelem,
                                                          columns,
                                                          unprocessed_columns,
                                                          &use_if);
        optimal_column = columns[optimal_column_index];
        columns[optimal_column_index] = columns[unprocessed_columns - 1];

        if (!use_if)
            line(opt, "switch (JSKW_AT(%u)) {", optimal_column);

        current = keyword_list[indexes[0]][optimal_column];
        for (i = 0; i != nelem;) {
            unsigned same_char_begin = i;
            char next = current;

            for (++i; i != nelem; ++i) {
                next = keyword_list[indexes[i]][optimal_column];
                if (next != current)
                    break;
            }
            qchar(current, qbuf);
            if (use_if) {
                line(opt, "if (JSKW_AT(%u) == %s) {", optimal_column, qbuf);
            } else {
                line(opt, "  case %s:", qbuf);
            }
            ++opt->indent_level;
            generate_letter_switch_r(opt, indexes + same_char_begin,
                                     i - same_char_begin,
                                     columns, unprocessed_columns - 1);
            --opt->indent_level;
            if (use_if) {
                line(opt, "}");
            }
            current = next;
        }

        if (!use_if) {
            line(opt, "}");
        }

        columns[optimal_column_index] = optimal_column;

        line(opt, "JSKW_NO_MATCH()");
    }
}

static void
generate_letter_switch(struct gen_opt *opt,
                       unsigned indexes[], unsigned nelem,
                       unsigned current_length)
{
    unsigned *columns;
    unsigned i;

    columns = (unsigned *) malloc(sizeof(columns[0]) * current_length);
    if (!columns) {
        perror("malloc");
        exit(EXIT_FAILURE);
    }
    for (i = 0; i != current_length; ++i) {
        columns[i] = i;
    }
    generate_letter_switch_r(opt, indexes, nelem, columns, current_length);
    free(columns);
}


static void
generate_switch(struct gen_opt *opt)
{
    unsigned *indexes;
    unsigned nlength;
    unsigned i, current;
    int use_if;
    unsigned nelem;

    nelem = sizeof(keyword_list)/sizeof(keyword_list[0]);

    line(opt, "/*");
    line(opt, " * Generating switch for the list of %u entries:", nelem);
    for (i = 0; i != nelem; ++i) {
        line(opt, " * %s", keyword_list[i]);
    }
    line(opt, " */");

    indexes = (unsigned *) malloc(sizeof(indexes[0]) * nelem);
    if (!indexes) {
        perror("malloc");
        exit(EXIT_FAILURE);
    }
    for (i = 0; i != nelem; ++i)
        indexes[i] = i;
    qsort(indexes, nelem, sizeof(indexes[i]), length_comparator);
    nlength = count_different_lengths(indexes, nelem);

    use_if = (nlength <= opt->use_if_threshold);

    if (!use_if)
        line(opt, "switch (JSKW_LENGTH()) {");

    current = (unsigned)strlen(keyword_list[indexes[0]]);
    for (i = 0; i != nelem;) {
        unsigned same_length_begin = i;
        unsigned next = current;

        for (++i; i != nelem; ++i) {
            next = (unsigned)strlen(keyword_list[indexes[i]]);
            if (next != current)
                break;
        }
        if (use_if) {
            line(opt, "if (JSKW_LENGTH() == %u) {", current);
        } else {
            line(opt, "  case %u:", current);
        }
        ++opt->indent_level;
        generate_letter_switch(opt, indexes + same_length_begin,
                               i - same_length_begin,
                               current);
        --opt->indent_level;
        if (use_if) {
            line(opt, "}");
        }
        current = next;
    }
    if (!use_if)
        line(opt, "}");
    line(opt, "JSKW_NO_MATCH()");
    free(indexes);
}

int main(int argc, char **argv)
{
    struct gen_opt opt;

    if (argc < 2) {
        opt.output = stdout;
    } else {
        opt.output = fopen(argv[1], "w");
        if (!opt.output) {
            perror("fopen");
            exit(EXIT_FAILURE);
        }
    }
    opt.indent_level = 1;
    opt.use_if_threshold = 3;
    opt.char_tail_test_threshold = 4;

    generate_switch(&opt);

    if (opt.output != stdout) {
        if (fclose(opt.output)) {
            perror("fclose");
            exit(EXIT_FAILURE);
        }
    }

    return EXIT_SUCCESS;
}
