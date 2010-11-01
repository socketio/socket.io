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

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const struct {
    const char  *name;
    int         length;
} pairs[] = {
#define OPDEF(op,val,name,token,length,nuses,ndefs,prec,format)               \
    { #op, length } ,
#include "jsopcode.tbl"
#undef OPDEF
};

int
main(int argc, char **argv)
{
    FILE *fp;
    size_t maxNameWidth, i, nameWidth, tabStop;
    int lengthGap;

    static const char prefix[] = "#define ";
    static const char suffix[] = "_LENGTH";
    static const size_t tabWidth = 8;
    static const size_t prefixWidth = sizeof(prefix) - 1;
    static const size_t suffixWidth = sizeof(suffix) - 1;

    if (argc != 2) {
        fputs("Bad usage\n", stderr);
        return EXIT_FAILURE;
    }

    fp = fopen(argv[1], "w");
    if (!fp) {
        perror("fopen");
        return EXIT_FAILURE;
    }
    fputs("/*\n"
          " * Automatically generated header with JS opcode length constants.\n"
          " *\n"
          " * Do not edit it, alter jsopcode.tbl instead.\n"
          " */\n",
          fp);

    /*
     * Print
     *
     * #define name_LENGTH length
     *
     * with all length values aligned on the same column. The column is at the
     * second character position after a tab-stop with the first position
     * reserved for the minus sign of variable-length opcodes.
     */
    maxNameWidth = 0;
    for (i = 0; i != sizeof pairs / sizeof pairs[0]; ++i) {
        nameWidth = strlen(pairs[i].name);
        if (maxNameWidth < nameWidth)
            maxNameWidth = nameWidth;
    }

    tabStop = prefixWidth + maxNameWidth + suffixWidth + 1;
    tabStop = (tabStop + tabWidth - 1) / tabWidth * tabWidth;
    for (i = 0; i != sizeof pairs / sizeof pairs[0]; ++i) {
        lengthGap = (int) (tabStop - prefixWidth - strlen(pairs[i].name) -
                           suffixWidth);
        fprintf(fp, "%s%s%s%*c%2d\n",
                prefix, pairs[i].name, suffix, lengthGap, ' ',
                pairs[i].length);
        if (ferror(fp)) {
            perror("fclose");
            exit(EXIT_FAILURE);
        }
    }

    if (fclose(fp)) {
        perror("fclose");
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
