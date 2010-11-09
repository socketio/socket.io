/*
    highlight.c - JavaScript syntax highlighting
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

#include "highlight.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include <jslock.h>
#include <jsscan.h>

#include "util.h"

enum Class {
  CLASS_NONE,
  CLASS_COMMENT,
  CLASS_REGEXP,
  CLASS_NUMBER,
  CLASS_STRING,
  CLASS_SPECIALCHAR,
  CLASS_KEYWORD,
  CLASS_TYPE,
  CLASS_SYMBOL,
  CLASS_CBRACKET
};

static const char * get_class_name(enum Class class) {
  switch (class) {
  case CLASS_NONE:
    abort();
    break;
  case CLASS_COMMENT:
    return "c";
    break;
  case CLASS_REGEXP:
    return "s";
    break;
  case CLASS_NUMBER:
    return "s";
    break;
  case CLASS_STRING:
    return "s";
    break;
  case CLASS_SPECIALCHAR:
    return "t";
    break;
  case CLASS_KEYWORD:
    return "k";
    break;
  case CLASS_TYPE:
    return "k";
    break;
  case CLASS_SYMBOL:
    return "k";
    break;
  case CLASS_CBRACKET:
    return "k";
    break;
  default:
    abort();
    break;
  }
}

static const char * g_id;
static const jschar * g_characters;
static size_t g_num_characters;
static Stream * g_output;
static size_t character_offset;
static uint16_t line_num;
static uint16_t column_num;
static enum Class current_class;

static void output_character(jschar c, enum Class class) {
  if (c == '\r' || c == '\n' || c == 0x2028 || c == 0x2029) {
    class = CLASS_NONE;
  }

  if (class != current_class) {
    /* output the end tag */
    if (current_class != CLASS_NONE) {
      Stream_write_string(g_output, "</span>");
    }

    current_class = class;

    /* output the start tag */
    if (current_class != CLASS_NONE) {
      Stream_printf(g_output, "<span class=\"%s\">", get_class_name(class));
    }
  }

  if (column_num == UINT16_MAX) {
    fatal("%s: script contains a line with more than 65,535 columns", g_id);
  }
  column_num++;
  switch (c) {
  case '&':
    Stream_write_string(g_output, "&amp;");
    break;
  case '<':
    Stream_write_string(g_output, "&lt;");
    break;
  case '>':
    Stream_write_string(g_output, "&gt;");
    break;
  case '\t':
    Stream_write_char(g_output, c);
    break;
  case '\r':
  case '\n':
  case 0x2028:
  case 0x2029:
    if (c == '\r' && character_offset + 1 < g_num_characters && g_characters[character_offset + 1] == '\n') {
      break;
    }
    Stream_write_char(g_output, '\n');
    column_num = 0;
    if (line_num == UINT16_MAX) {
      fatal("%s: script contains more than 65,535 lines", g_id);
    }
    line_num++;
    break;
  default:
    if (32 <= c && c <= 126) {
      Stream_write_char(g_output, c);
    }
    else {
      Stream_printf(g_output, "&#%d;", c);
    }
    break;
  }
  character_offset++;
}

static void mark_nontoken_chars(uint16_t end_line, uint16_t end_column) {
  enum State {
    STATE_NORMAL,
    STATE_LINE_COMMENT,
    STATE_MULTILINE_COMMENT
  };

  enum State state = STATE_NORMAL;
  while (character_offset < g_num_characters) {
    if (end_line != 0 && line_num > end_line) {
      break;
    }
    else if (line_num == end_line && column_num >= end_column) {
      break;
    }

    jschar c = g_characters[character_offset];
    if (c == '\0') {
      fatal("%s: script contains NULL character", g_id);
    }

    switch (state) {
    case STATE_NORMAL:
      if (c == '/' && character_offset + 1 < g_num_characters && g_characters[character_offset + 1] == '/') {
        state = STATE_LINE_COMMENT;
      }
      else if (c == '/' && character_offset + 1 < g_num_characters && g_characters[character_offset + 1] == '*') {
        state = STATE_MULTILINE_COMMENT;
        output_character('/', CLASS_COMMENT);
        output_character('*', CLASS_COMMENT);
        continue;
      }
      break;
    case STATE_LINE_COMMENT:
      if (c == '\r' || c == '\n' || c == 0x2028 || c == 0x2029) {
        state = STATE_NORMAL;
      }
      break;
    case STATE_MULTILINE_COMMENT:
      if (c == '*' && character_offset + 1 < g_num_characters && g_characters[character_offset + 1] == '/') {
        output_character('*', CLASS_COMMENT);
        output_character('/', CLASS_COMMENT);
        state = STATE_NORMAL;
        continue;
      }
      break;
    }

    if (state == STATE_NORMAL) {
      output_character(c, CLASS_NONE);
    }
    else {
      output_character(c, CLASS_COMMENT);
    }
  }
}

void jscoverage_highlight_js(JSContext * context, const char * id, const jschar * characters, size_t num_characters, Stream * output) {
  g_id = id;
  g_characters = characters;
  g_num_characters = num_characters;
  g_output = output;

  character_offset = 0;
  line_num = 1;
  column_num = 0;
  current_class = CLASS_NONE;

  /* tokenize the JavaScript */
  JSTokenStream token_stream;
  if (! js_InitTokenStream(context, &token_stream, characters, num_characters, NULL, NULL, 1)) {
    fatal("cannot create token stream from JavaScript file %s", id);
  }

  for (;;) {
    JSTokenType tt = js_GetToken(context, &token_stream);

    if (tt == TOK_ERROR) {
      fatal("JavaScript parse error: %s: line = %d, col = %d\n", id, line_num, column_num);
    }

    if (tt == TOK_EOF) {
      mark_nontoken_chars(0, 0);
      break;
    }

    /* mark the chars before the token */
    JSToken t = CURRENT_TOKEN(&token_stream);
    mark_nontoken_chars(t.pos.begin.lineno, t.pos.begin.index);

    /* mark the token */
    enum Class class;
    switch (tt) {
    case TOK_ERROR:
    case TOK_EOF:
      abort();
    case TOK_EOL:
      class = CLASS_NONE;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_SEMI:
    case TOK_COMMA:
    case TOK_ASSIGN:
    case TOK_HOOK:
    case TOK_COLON:
    case TOK_OR:
    case TOK_AND:
    case TOK_BITOR:
    case TOK_BITXOR:
    case TOK_BITAND:
    case TOK_EQOP:
    case TOK_RELOP:
    case TOK_SHOP:
    case TOK_PLUS:
    case TOK_MINUS:
    case TOK_STAR:
    case TOK_DIVOP:
      class = CLASS_SYMBOL;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_UNARYOP:
      switch (t.t_op) {
      case JSOP_NEG:
      case JSOP_POS:
      case JSOP_NOT:
      case JSOP_BITNOT:
        class = CLASS_SYMBOL;
        token_stream.flags |= TSF_OPERAND;
        break;
      case JSOP_TYPEOF:
        class = CLASS_KEYWORD;
        token_stream.flags |= TSF_OPERAND;
        break;
      case JSOP_VOID:
        class = CLASS_TYPE;
        token_stream.flags |= TSF_OPERAND;
        break;
      default:
        abort();
      }
      break;
    case TOK_INC:
    case TOK_DEC:
      class = CLASS_SYMBOL;
      /* token_stream.flags does not change w.r.t. TSF_OPERAND */
      break;
    case TOK_DOT:
    case TOK_LB:
      class = CLASS_SYMBOL;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_RB:
      class = CLASS_SYMBOL;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_LC:
      class = CLASS_CBRACKET;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_RC:
      class = CLASS_CBRACKET;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_LP:
      class = CLASS_SYMBOL;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_RP:
      class = CLASS_SYMBOL;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_NAME:
      class = CLASS_NONE;
      token_stream.flags &= ~TSF_OPERAND;
      if (js_PeekToken(context, &token_stream) == TOK_LP) {
        /* function */
        class = CLASS_NONE;
      }
      break;
    case TOK_NUMBER:
      class = CLASS_NUMBER;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_STRING:
      class = CLASS_STRING;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_REGEXP:
      class = CLASS_REGEXP;
      token_stream.flags &= ~TSF_OPERAND;
      break;
    case TOK_PRIMARY:
      switch (t.t_op) {
      case JSOP_TRUE:
      case JSOP_FALSE:
      case JSOP_NULL:
      case JSOP_THIS:
        class = CLASS_KEYWORD;
        token_stream.flags &= ~TSF_OPERAND;
        break;
      default:
        abort();
      }
      break;
    case TOK_FUNCTION:
      class = CLASS_KEYWORD;
      token_stream.flags |= TSF_OPERAND;
      break;
    case TOK_IF:
    case TOK_ELSE:
    case TOK_SWITCH:
    case TOK_CASE:
    case TOK_DEFAULT:
    case TOK_WHILE:
    case TOK_DO:
    case TOK_FOR:
    case TOK_BREAK:
    case TOK_CONTINUE:
    case TOK_IN:
    case TOK_VAR:
    case TOK_WITH:
    case TOK_RETURN:
    case TOK_NEW:
    case TOK_DELETE:
      token_stream.flags |= TSF_OPERAND;
      class = CLASS_KEYWORD;
      break;
    case TOK_DEFSHARP:
    case TOK_USESHARP:
      abort();
      break;
    case TOK_TRY:
    case TOK_CATCH:
    case TOK_FINALLY:
    case TOK_THROW:
    case TOK_INSTANCEOF:
    case TOK_DEBUGGER:
      token_stream.flags |= TSF_OPERAND;
      class = CLASS_KEYWORD;
      break;
    case TOK_XMLSTAGO:
    case TOK_XMLETAGO:
    case TOK_XMLPTAGC:
    case TOK_XMLTAGC:
    case TOK_XMLNAME:
    case TOK_XMLATTR:
    case TOK_XMLSPACE:
    case TOK_XMLTEXT:
    case TOK_XMLCOMMENT:
    case TOK_XMLCDATA:
    case TOK_XMLPI:
    case TOK_AT:
    case TOK_DBLCOLON:
    case TOK_ANYNAME:
    case TOK_DBLDOT:
    case TOK_FILTER:
    case TOK_XMLELEM:
    case TOK_XMLLIST:
      abort();
      break;
    case TOK_YIELD:
      token_stream.flags |= TSF_OPERAND;
      class = CLASS_KEYWORD;
      break;
    case TOK_ARRAYCOMP:
    case TOK_ARRAYPUSH:
    case TOK_LEXICALSCOPE:
      abort();
      break;
    case TOK_LET:
      token_stream.flags |= TSF_OPERAND;
      class = CLASS_KEYWORD;
      break;
    case TOK_SEQ:
    case TOK_FORHEAD:
    case TOK_RESERVED:
    case TOK_LIMIT:
      abort();
      break;
    default:
      abort();
      break;
    }

    uint16_t start_line = t.pos.begin.lineno;
    uint16_t end_line = t.pos.end.lineno;
    uint16_t start_column = t.pos.begin.index;
    uint16_t end_column = t.pos.end.index;
    assert(line_num == start_line);
    assert(column_num == start_column);
    if (start_line == end_line && start_column >= end_column) {
      fatal("%s: script contains line with more than 65,535 characters", id);
    }
    for (;;) {
      assert(character_offset < num_characters);
      jschar c = characters[character_offset];
      if (tt == TOK_STRING && c == '\\') {
        output_character(c, CLASS_SPECIALCHAR);
        assert(character_offset < num_characters);
        c = characters[character_offset];
        output_character(c, CLASS_SPECIALCHAR);
      }
      else {
        output_character(c, class);
      }

      if (line_num > end_line) {
        break;
      }
      else if (line_num == end_line && column_num >= end_column) {
        break;
      }
    }

    assert(line_num == end_line);
    assert(column_num = end_column);
  }

  if (current_class != CLASS_NONE) {
    output_character('\n', CLASS_NONE);
  }

  js_CloseTokenStream(context, &token_stream);
}
