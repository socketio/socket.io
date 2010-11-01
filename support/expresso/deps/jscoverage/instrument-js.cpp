/*
    instrument-js.cpp - JavaScript instrumentation routines
    Copyright (C) 2007, 2008 siliconforks.com

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

#include "instrument-js.h"

#include <assert.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#include <jsapi.h>
#include <jsarena.h>
#include <jsatom.h>
#include <jsemit.h>
#include <jsexn.h>
#include <jsfun.h>
#include <jsinterp.h>
#include <jsiter.h>
#include <jsparse.h>
#include <jsregexp.h>
#include <jsscope.h>
#include <jsstr.h>

#include "encoding.h"
#include "global.h"
#include "highlight.h"
#include "resource-manager.h"
#include "util.h"

struct IfDirective {
  const jschar * condition_start;
  const jschar * condition_end;
  uint16_t start_line;
  uint16_t end_line;
  struct IfDirective * next;
};

bool jscoverage_mozilla = false;

static bool * exclusive_directives = NULL;

static JSRuntime * runtime = NULL;
static JSContext * context = NULL;
static JSObject * global = NULL;
static JSVersion js_version = JSVERSION_ECMA_3;

/*
JSParseNode objects store line numbers starting from 1.
The lines array stores line numbers starting from 0.
*/
static const char * file_id = NULL;
static char * lines = NULL;
static uint16_t num_lines = 0;

void jscoverage_set_js_version(const char * version) {
  js_version = JS_StringToVersion(version);
  if (js_version != JSVERSION_UNKNOWN) {
    return;
  }

  char * end;
  js_version = (JSVersion) strtol(version, &end, 10);
  if ((size_t) (end - version) != strlen(version)) {
    fatal("invalid version: %s", version);
  }
}

void jscoverage_init(void) {
  runtime = JS_NewRuntime(8L * 1024L * 1024L);
  if (runtime == NULL) {
    fatal("cannot create runtime");
  }

  context = JS_NewContext(runtime, 8192);
  if (context == NULL) {
    fatal("cannot create context");
  }

  JS_SetVersion(context, js_version);

  global = JS_NewObject(context, NULL, NULL, NULL);
  if (global == NULL) {
    fatal("cannot create global object");
  }

  if (! JS_InitStandardClasses(context, global)) {
    fatal("cannot initialize standard classes");
  }
}

void jscoverage_cleanup(void) {
  JS_DestroyContext(context);
  JS_DestroyRuntime(runtime);
}

static void print_javascript(const jschar * characters, size_t num_characters, Stream * f) {
  for (size_t i = 0; i < num_characters; i++) {
    jschar c = characters[i];
    /*
    XXX does not handle no-break space, other unicode "space separator"
    */
    switch (c) {
    case 0x9:
    case 0xB:
    case 0xC:
      Stream_write_char(f, c);
      break;
    default:
      if (32 <= c && c <= 126) {
        Stream_write_char(f, c);
      }
      else {
        Stream_printf(f, "\\u%04x", c);
      }
      break;
    }
  }
}

static void print_string(JSString * s, Stream * f) {
  size_t length = JSSTRING_LENGTH(s);
  jschar * characters = JSSTRING_CHARS(s);
  for (size_t i = 0; i < length; i++) {
    jschar c = characters[i];
    if (32 <= c && c <= 126) {
      switch (c) {
      case '"':
        Stream_write_string(f, "\\\"");
        break;
/*
      case '\'':
        Stream_write_string(f, "\\'");
        break;
*/
      case '\\':
        Stream_write_string(f, "\\\\");
        break;
      default:
        Stream_write_char(f, c);
        break;
      }
    }
    else {
      switch (c) {
      case 0x8:
        Stream_write_string(f, "\\b");
        break;
      case 0x9:
        Stream_write_string(f, "\\t");
        break;
      case 0xa:
        Stream_write_string(f, "\\n");
        break;
      /* IE doesn't support this */
      /*
      case 0xb:
        Stream_write_string(f, "\\v");
        break;
      */
      case 0xc:
        Stream_write_string(f, "\\f");
        break;
      case 0xd:
        Stream_write_string(f, "\\r");
        break;
      default:
        Stream_printf(f, "\\u%04x", c);
        break;
      }
    }
  }
}

static void print_string_atom(JSAtom * atom, Stream * f) {
  assert(ATOM_IS_STRING(atom));
  JSString * s = ATOM_TO_STRING(atom);
  print_string(s, f);
}

static void print_regex(jsval value, Stream * f) {
  assert(JSVAL_IS_STRING(value));
  JSString * s = JSVAL_TO_STRING(value);
  size_t length = JSSTRING_LENGTH(s);
  jschar * characters = JSSTRING_CHARS(s);
  for (size_t i = 0; i < length; i++) {
    jschar c = characters[i];
    if (32 <= c && c <= 126) {
      Stream_write_char(f, c);
    }
    else {
      Stream_printf(f, "\\u%04x", c);
    }
  }
}

static void print_quoted_string_atom(JSAtom * atom, Stream * f) {
  assert(ATOM_IS_STRING(atom));
  JSString * s = ATOM_TO_STRING(atom);
  Stream_write_char(f, '"');
  print_string(s, f);
  Stream_write_char(f, '"');
}

static const char * get_op(uint8 op) {
  switch(op) {
  case JSOP_OR:
    return "||";
  case JSOP_AND:
    return "&&";
  case JSOP_BITOR:
    return "|";
  case JSOP_BITXOR:
    return "^";
  case JSOP_BITAND:
    return "&";
  case JSOP_EQ:
    return "==";
  case JSOP_NE:
    return "!=";
  case JSOP_STRICTEQ:
    return "===";
  case JSOP_STRICTNE:
    return "!==";
  case JSOP_LT:
    return "<";
  case JSOP_LE:
    return "<=";
  case JSOP_GT:
    return ">";
  case JSOP_GE:
    return ">=";
  case JSOP_LSH:
    return "<<";
  case JSOP_RSH:
    return ">>";
  case JSOP_URSH:
    return ">>>";
  case JSOP_ADD:
    return "+";
  case JSOP_SUB:
    return "-";
  case JSOP_MUL:
    return "*";
  case JSOP_DIV:
    return "/";
  case JSOP_MOD:
    return "%";
  default:
    abort();
  }
}

static void output_expression(JSParseNode * node, Stream * f, bool parenthesize_object_literals);
static void instrument_statement(JSParseNode * node, Stream * f, int indent, bool is_jscoverage_if);
static void output_statement(JSParseNode * node, Stream * f, int indent, bool is_jscoverage_if);

enum FunctionType {
  FUNCTION_NORMAL,
  FUNCTION_GETTER_OR_SETTER
};

static void output_for_in(JSParseNode * node, Stream * f) {
  assert(node->pn_type == TOK_FOR);
  assert(node->pn_arity == PN_BINARY);
  Stream_write_string(f, "for ");
  if (node->pn_iflags & JSITER_FOREACH) {
    Stream_write_string(f, "each ");
  }
  Stream_write_char(f, '(');
  output_expression(node->pn_left, f, false);
  Stream_write_char(f, ')');
}

static void output_array_comprehension_or_generator_expression(JSParseNode * node, Stream * f) {
  assert(node->pn_type == TOK_LEXICALSCOPE);
  assert(node->pn_arity == PN_NAME);
  JSParseNode * for_node = node->pn_expr;
  assert(for_node->pn_type == TOK_FOR);
  assert(for_node->pn_arity == PN_BINARY);
  JSParseNode * p = for_node;
  while (p->pn_type == TOK_FOR) {
    p = p->pn_right;
  }
  JSParseNode * if_node = NULL;
  if (p->pn_type == TOK_IF) {
    if_node = p;
    assert(if_node->pn_arity == PN_TERNARY);
    p = if_node->pn_kid2;
  }
  switch (p->pn_arity) {
  case PN_UNARY:
    p = p->pn_kid;
    if (p->pn_type == TOK_YIELD) {
      /* for generator expressions */
      p = p->pn_kid;
    }
    output_expression(p, f, false);
    break;
  case PN_LIST:
    /*
    When the array comprehension contains "if (0)", it will be optimized away and
    the result will be an empty TOK_LC list.
    */
    assert(p->pn_type == TOK_LC);
    assert(p->pn_head == NULL);
    /* the "1" is arbitrary (since the list is empty) */
    Stream_write_char(f, '1');
    break;
  default:
    abort();
    break;
  }

  p = for_node;
  while (p->pn_type == TOK_FOR) {
    Stream_write_char(f, ' ');
    output_for_in(p, f);
    p = p->pn_right;
  }
  if (p->pn_type == TOK_LC) {
    /* this is the optimized-away "if (0)" */
    Stream_write_string(f, " if (0)");
  }
  else if (if_node) {
    Stream_write_string(f, " if (");
    output_expression(if_node->pn_kid1, f, false);
    Stream_write_char(f, ')');
  }
}

static void instrument_function(JSParseNode * node, Stream * f, int indent, enum FunctionType type) {
  assert(node->pn_type == TOK_FUNCTION);
  assert(node->pn_arity == PN_FUNC);
  JSObject * object = node->pn_funpob->object;
  assert(JS_ObjectIsFunction(context, object));
  JSFunction * function = (JSFunction *) JS_GetPrivate(context, object);
  assert(function);
  assert(object == &function->object);
  Stream_printf(f, "%*s", indent, "");
  if (type == FUNCTION_NORMAL) {
    Stream_write_string(f, "function ");
  }

  /* function name */
  if (function->atom) {
    print_string_atom(function->atom, f);
  }

  /*
  function parameters - see JS_DecompileFunction in jsapi.cpp, which calls
  js_DecompileFunction in jsopcode.cpp
  */
  Stream_write_char(f, '(');
  JSArenaPool pool;
  JS_INIT_ARENA_POOL(&pool, "instrument_function", 256, 1, &context->scriptStackQuota);
  jsuword * local_names = NULL;
  if (JS_GET_LOCAL_NAME_COUNT(function)) {
    local_names = js_GetLocalNameArray(context, function, &pool);
    if (local_names == NULL) {
      fatal("out of memory");
    }
  }
  bool destructuring = false;
  for (int i = 0; i < function->nargs; i++) {
    if (i > 0) {
      Stream_write_string(f, ", ");
    }
    JSAtom * param = JS_LOCAL_NAME_TO_ATOM(local_names[i]);
    if (param == NULL) {
      destructuring = true;
      JSParseNode * expression = NULL;
      assert(node->pn_body->pn_type == TOK_LC || node->pn_body->pn_type == TOK_SEQ);
      JSParseNode * semi = node->pn_body->pn_head;
      assert(semi->pn_type == TOK_SEMI);
      JSParseNode * comma = semi->pn_kid;
      assert(comma->pn_type == TOK_COMMA);
      for (JSParseNode * p = comma->pn_head; p != NULL; p = p->pn_next) {
        assert(p->pn_type == TOK_ASSIGN);
        JSParseNode * rhs = p->pn_right;
        assert(JSSTRING_LENGTH(ATOM_TO_STRING(rhs->pn_atom)) == 0);
        if (rhs->pn_slot == i) {
          expression = p->pn_left;
          break;
        }
      }
      assert(expression != NULL);
      output_expression(expression, f, false);
    }
    else {
      print_string_atom(param, f);
    }
  }
  JS_FinishArenaPool(&pool);
  Stream_write_string(f, ") {\n");

  /* function body */
  if (function->flags & JSFUN_EXPR_CLOSURE) {
    /* expression closure - use output_statement instead of instrument_statement */
    if (node->pn_body->pn_type == TOK_SEQ) {
      assert(node->pn_body->pn_arity == PN_LIST);
      assert(node->pn_body->pn_count == 2);
      output_statement(node->pn_body->pn_head->pn_next, f, indent + 2, false);
    }
    else {
      output_statement(node->pn_body, f, indent + 2, false);
    }
  }
  else {
    assert(node->pn_body->pn_type == TOK_LC);
    assert(node->pn_body->pn_arity == PN_LIST);
    JSParseNode * p = node->pn_body->pn_head;
    if (destructuring) {
      p = p->pn_next;
    }
    for (; p != NULL; p = p->pn_next) {
      instrument_statement(p, f, indent + 2, false);
    }
  }

  Stream_write_char(f, '}');
}

static void instrument_function_call(JSParseNode * node, Stream * f) {
  JSParseNode * function_node = node->pn_head;
  if (function_node->pn_type == TOK_FUNCTION) {
    JSObject * object = function_node->pn_funpob->object;
    assert(JS_ObjectIsFunction(context, object));
    JSFunction * function = (JSFunction *) JS_GetPrivate(context, object);
    assert(function);
    assert(object == &function->object);

    if (function_node->pn_flags & TCF_GENEXP_LAMBDA) {
      /* it's a generator expression */
      Stream_write_char(f, '(');
      output_array_comprehension_or_generator_expression(function_node->pn_body, f);
      Stream_write_char(f, ')');
      return;
    }
  }
  output_expression(function_node, f, false);
  Stream_write_char(f, '(');
  for (struct JSParseNode * p = function_node->pn_next; p != NULL; p = p->pn_next) {
    if (p != node->pn_head->pn_next) {
      Stream_write_string(f, ", ");
    }
    output_expression(p, f, false);
  }
  Stream_write_char(f, ')');
}

static void instrument_declarations(JSParseNode * list, Stream * f) {
  assert(list->pn_arity == PN_LIST);
  for (JSParseNode * p = list->pn_head; p != NULL; p = p->pn_next) {
    if (p != list->pn_head) {
      Stream_write_string(f, ", ");
    }
    output_expression(p, f, false);
  }
}

/*
See <Expressions> in jsparse.h.
TOK_FUNCTION is handled as a statement and as an expression.
TOK_DBLDOT is not handled (XML op).
TOK_DEFSHARP and TOK_USESHARP are not handled.
TOK_ANYNAME is not handled (XML op).
TOK_AT is not handled (XML op).
TOK_DBLCOLON is not handled.
TOK_XML* are not handled.
There seem to be some undocumented expressions:
TOK_INSTANCEOF  binary
TOK_IN          binary
*/
static void output_expression(JSParseNode * node, Stream * f, bool parenthesize_object_literals) {
  switch (node->pn_type) {
  case TOK_FUNCTION:
    Stream_write_char(f, '(');
    instrument_function(node, f, 0, FUNCTION_NORMAL);
    Stream_write_char(f, ')');
    break;
  case TOK_COMMA:
    for (struct JSParseNode * p = node->pn_head; p != NULL; p = p->pn_next) {
      if (p != node->pn_head) {
        Stream_write_string(f, ", ");
      }
      output_expression(p, f, parenthesize_object_literals);
    }
    break;
  case TOK_ASSIGN:
    output_expression(node->pn_left, f, parenthesize_object_literals);
    Stream_write_char(f, ' ');
    switch (node->pn_op) {
    case JSOP_ADD:
    case JSOP_SUB:
    case JSOP_MUL:
    case JSOP_MOD:
    case JSOP_LSH:
    case JSOP_RSH:
    case JSOP_URSH:
    case JSOP_BITAND:
    case JSOP_BITOR:
    case JSOP_BITXOR:
    case JSOP_DIV:
      Stream_printf(f, "%s", get_op(node->pn_op));
      break;
    default:
      /* do nothing - it must be a simple assignment */
      break;
    }
    Stream_write_string(f, "= ");
    output_expression(node->pn_right, f, false);
    break;
  case TOK_HOOK:
    output_expression(node->pn_kid1, f, parenthesize_object_literals);
    Stream_write_string(f, "? ");
    output_expression(node->pn_kid2, f, false);
    Stream_write_string(f, ": ");
    output_expression(node->pn_kid3, f, false);
    break;
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
    switch (node->pn_arity) {
    case PN_BINARY:
      output_expression(node->pn_left, f, parenthesize_object_literals);
      Stream_printf(f, " %s ", get_op(node->pn_op));
      output_expression(node->pn_right, f, false);
      break;
    case PN_LIST:
      for (struct JSParseNode * p = node->pn_head; p != NULL; p = p->pn_next) {
        if (p == node->pn_head) {
          output_expression(p, f, parenthesize_object_literals);
        }
        else {
          Stream_printf(f, " %s ", get_op(node->pn_op));
          output_expression(p, f, false);
        }
      }
      break;
    default:
      abort();
    }
    break;
  case TOK_UNARYOP:
    switch (node->pn_op) {
    case JSOP_NEG:
      Stream_write_string(f, "- ");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_POS:
      Stream_write_string(f, "+ ");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_NOT:
      Stream_write_string(f, "! ");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_BITNOT:
      Stream_write_string(f, "~ ");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_TYPEOF:
      Stream_write_string(f, "typeof ");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_VOID:
      Stream_write_string(f, "void ");
      output_expression(node->pn_kid, f, false);
      break;
    default:
      fatal_source(file_id, node->pn_pos.begin.lineno, "unknown operator (%d)", node->pn_op);
      break;
    }
    break;
  case TOK_INC:
  case TOK_DEC:
    /*
    This is not documented, but node->pn_op tells whether it is pre- or post-increment.
    */
    switch (node->pn_op) {
    case JSOP_INCNAME:
    case JSOP_INCPROP:
    case JSOP_INCELEM:
      Stream_write_string(f, "++");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_DECNAME:
    case JSOP_DECPROP:
    case JSOP_DECELEM:
      Stream_write_string(f, "--");
      output_expression(node->pn_kid, f, false);
      break;
    case JSOP_NAMEINC:
    case JSOP_PROPINC:
    case JSOP_ELEMINC:
      output_expression(node->pn_kid, f, parenthesize_object_literals);
      Stream_write_string(f, "++");
      break;
    case JSOP_NAMEDEC:
    case JSOP_PROPDEC:
    case JSOP_ELEMDEC:
      output_expression(node->pn_kid, f, parenthesize_object_literals);
      Stream_write_string(f, "--");
      break;
    default:
      abort();
      break;
    }
    break;
  case TOK_NEW:
    Stream_write_string(f, "new ");
    instrument_function_call(node, f);
    break;
  case TOK_DELETE:
    Stream_write_string(f, "delete ");
    output_expression(node->pn_kid, f, false);
    break;
  case TOK_DOT:
    /* numeric literals must be parenthesized */
    switch (node->pn_expr->pn_type) {
    case TOK_NUMBER:
      Stream_write_char(f, '(');
      output_expression(node->pn_expr, f, false);
      Stream_write_char(f, ')');
      break;
    default:
      output_expression(node->pn_expr, f, true);
      break;
    }
    /*
    This may have originally been x['foo-bar'].  Because the string 'foo-bar'
    contains illegal characters, we have to use the subscript syntax instead of
    the dot syntax.
    */
    assert(ATOM_IS_STRING(node->pn_atom));
    {
      JSString * s = ATOM_TO_STRING(node->pn_atom);
      bool must_quote;
      if (JSSTRING_LENGTH(s) == 0) {
        must_quote = true;
      }
      else if (js_CheckKeyword(JSSTRING_CHARS(s), JSSTRING_LENGTH(s)) != TOK_EOF) {
        must_quote = true;
      }
      else if (! js_IsIdentifier(s)) {
        must_quote = true;
      }
      else {
        must_quote = false;
      }
      if (must_quote) {
        Stream_write_char(f, '[');
        print_quoted_string_atom(node->pn_atom, f);
        Stream_write_char(f, ']');
      }
      else {
        Stream_write_char(f, '.');
        print_string_atom(node->pn_atom, f);
      }
    }
    break;
  case TOK_LB:
    output_expression(node->pn_left, f, false);
    Stream_write_char(f, '[');
    output_expression(node->pn_right, f, false);
    Stream_write_char(f, ']');
    break;
  case TOK_LP:
    instrument_function_call(node, f);
    break;
  case TOK_RB:
    Stream_write_char(f, '[');
    for (struct JSParseNode * p = node->pn_head; p != NULL; p = p->pn_next) {
      if (p != node->pn_head) {
        Stream_write_string(f, ", ");
      }
      /* TOK_COMMA is a special case: a hole in the array */
      if (p->pn_type != TOK_COMMA) {
        output_expression(p, f, false);
      }
    }
    if (node->pn_extra == PNX_ENDCOMMA) {
      Stream_write_char(f, ',');
    }
    Stream_write_char(f, ']');
    break;
  case TOK_RC:
    if (parenthesize_object_literals) {
      Stream_write_char(f, '(');
    }
    Stream_write_char(f, '{');
    for (struct JSParseNode * p = node->pn_head; p != NULL; p = p->pn_next) {
      if (p->pn_type != TOK_COLON) {
        fatal_source(file_id, p->pn_pos.begin.lineno, "unsupported node type (%d)", p->pn_type);
      }
      if (p != node->pn_head) {
        Stream_write_string(f, ", ");
      }

      /* check whether this is a getter or setter */
      switch (p->pn_op) {
      case JSOP_GETTER:
      case JSOP_SETTER:
        if (p->pn_op == JSOP_GETTER) {
          Stream_write_string(f, "get ");
        }
        else {
          Stream_write_string(f, "set ");
        }
        output_expression(p->pn_left, f, false);
        Stream_write_char(f, ' ');
        if (p->pn_right->pn_type != TOK_FUNCTION) {
          fatal_source(file_id, p->pn_pos.begin.lineno, "expected function");
        }
        instrument_function(p->pn_right, f, 0, FUNCTION_GETTER_OR_SETTER);
        break;
      default:
        output_expression(p->pn_left, f, false);
        Stream_write_string(f, ": ");
        output_expression(p->pn_right, f, false);
        break;
      }
    }
    Stream_write_char(f, '}');
    if (parenthesize_object_literals) {
      Stream_write_char(f, ')');
    }
    break;
  case TOK_RP:
    Stream_write_char(f, '(');
    output_expression(node->pn_kid, f, false);
    Stream_write_char(f, ')');
    break;
  case TOK_NAME:
    print_string_atom(node->pn_atom, f);
    if (node->pn_expr != NULL) {
      Stream_write_string(f, " = ");
      output_expression(node->pn_expr, f, false);
    }
    break;
  case TOK_STRING:
    print_quoted_string_atom(node->pn_atom, f);
    break;
  case TOK_REGEXP:
    assert(node->pn_op == JSOP_REGEXP);
    {
      JSObject * object = node->pn_pob->object;
      jsval result;
      js_regexp_toString(context, object, &result);
      print_regex(result, f);
    }
    break;
  case TOK_NUMBER:
    /*
    A 64-bit IEEE 754 floating point number has a 52-bit fraction.
    2^(-52) = 2.22 x 10^(-16)
    Thus there are 16 significant digits.
    To keep the output simple, special-case zero.
    */
    if (node->pn_dval == 0.0) {
      if (signbit(node->pn_dval)) {
        Stream_write_string(f, "-0");
      }
      else {
        Stream_write_string(f, "0");
      }
    }
    else if (node->pn_dval == INFINITY) {
      Stream_write_string(f, "Number.POSITIVE_INFINITY");
    }
    else if (node->pn_dval == -INFINITY) {
      Stream_write_string(f, "Number.NEGATIVE_INFINITY");
    }
    else if (isnan(node->pn_dval)) {
      Stream_write_string(f, "Number.NaN");
    }
    else {
      Stream_printf(f, "%.15g", node->pn_dval);
    }
    break;
  case TOK_PRIMARY:
    switch (node->pn_op) {
    case JSOP_TRUE:
      Stream_write_string(f, "true");
      break;
    case JSOP_FALSE:
      Stream_write_string(f, "false");
      break;
    case JSOP_NULL:
      Stream_write_string(f, "null");
      break;
    case JSOP_THIS:
      Stream_write_string(f, "this");
      break;
    /* jsscan.h mentions `super' ??? */
    default:
      abort();
    }
    break;
  case TOK_INSTANCEOF:
    output_expression(node->pn_left, f, parenthesize_object_literals);
    Stream_write_string(f, " instanceof ");
    output_expression(node->pn_right, f, false);
    break;
  case TOK_IN:
    output_expression(node->pn_left, f, false);
    Stream_write_string(f, " in ");
    output_expression(node->pn_right, f, false);
    break;
  case TOK_LEXICALSCOPE:
    assert(node->pn_arity == PN_NAME);
    assert(node->pn_expr->pn_type == TOK_LET);
    assert(node->pn_expr->pn_arity == PN_BINARY);
    Stream_write_string(f, "let(");
    assert(node->pn_expr->pn_left->pn_type == TOK_LP);
    assert(node->pn_expr->pn_left->pn_arity == PN_LIST);
    instrument_declarations(node->pn_expr->pn_left, f);
    Stream_write_string(f, ") ");
    output_expression(node->pn_expr->pn_right, f, true);
    break;
  case TOK_YIELD:
    assert(node->pn_arity == PN_UNARY);
    Stream_write_string(f, "yield");
    if (node->pn_kid != NULL) {
      Stream_write_char(f, ' ');
      output_expression(node->pn_kid, f, true);
    }
    break;
  case TOK_ARRAYCOMP:
    assert(node->pn_arity == PN_LIST);
    {
      JSParseNode * block_node;
      switch (node->pn_count) {
      case 1:
        block_node = node->pn_head;
        break;
      case 2:
        block_node = node->pn_head->pn_next;
        break;
      default:
        abort();
        break;
      }
      Stream_write_char(f, '[');
      output_array_comprehension_or_generator_expression(block_node, f);
      Stream_write_char(f, ']');
    }
    break;
  case TOK_VAR:
    assert(node->pn_arity == PN_LIST);
    Stream_write_string(f, "var ");
    instrument_declarations(node, f);
    break;
  case TOK_LET:
    assert(node->pn_arity == PN_LIST);
    Stream_write_string(f, "let ");
    instrument_declarations(node, f);
    break;
  default:
    fatal_source(file_id, node->pn_pos.begin.lineno, "unsupported node type (%d)", node->pn_type);
  }
}

static void output_statement(JSParseNode * node, Stream * f, int indent, bool is_jscoverage_if) {
  switch (node->pn_type) {
  case TOK_FUNCTION:
    instrument_function(node, f, indent, FUNCTION_NORMAL);
    Stream_write_char(f, '\n');
    break;
  case TOK_LC:
    assert(node->pn_arity == PN_LIST);
/*
    Stream_write_string(f, "{\n");
*/
    for (struct JSParseNode * p = node->pn_u.list.head; p != NULL; p = p->pn_next) {
      instrument_statement(p, f, indent, false);
    }
/*
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "}\n");
*/
    break;
  case TOK_IF:
  {
    assert(node->pn_arity == PN_TERNARY);

    uint16_t line = node->pn_pos.begin.lineno;
    if (! is_jscoverage_if) {
      if (line > num_lines) {
        fatal("file %s contains more than 65,535 lines", file_id);
      }
      if (line >= 2 && exclusive_directives[line - 2]) {
        is_jscoverage_if = true;
      }
    }

    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "if (");
    output_expression(node->pn_kid1, f, false);
    Stream_write_string(f, ") {\n");
    if (is_jscoverage_if && node->pn_kid3) {
      uint16_t else_start = node->pn_kid3->pn_pos.begin.lineno;
      uint16_t else_end = node->pn_kid3->pn_pos.end.lineno + 1;
      Stream_printf(f, "%*s", indent + 2, "");
      Stream_printf(f, "_$jscoverage['%s'].conditionals[%d] = %d;\n", file_id, else_start, else_end);
    }
    instrument_statement(node->pn_kid2, f, indent + 2, false);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "}\n");

    if (node->pn_kid3 || is_jscoverage_if) {
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "else {\n");

      if (is_jscoverage_if) {
        uint16_t if_start = node->pn_kid2->pn_pos.begin.lineno + 1;
        uint16_t if_end = node->pn_kid2->pn_pos.end.lineno + 1;
        Stream_printf(f, "%*s", indent + 2, "");
        Stream_printf(f, "_$jscoverage['%s'].conditionals[%d] = %d;\n", file_id, if_start, if_end);
      }

      if (node->pn_kid3) {
        instrument_statement(node->pn_kid3, f, indent + 2, is_jscoverage_if);
      }

      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "}\n");
    }

    break;
  }
  case TOK_SWITCH:
    assert(node->pn_arity == PN_BINARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "switch (");
    output_expression(node->pn_left, f, false);
    Stream_write_string(f, ") {\n");
    {
      JSParseNode * list = node->pn_right;
      if (list->pn_type == TOK_LEXICALSCOPE) {
        list = list->pn_expr;
      }
      for (struct JSParseNode * p = list->pn_head; p != NULL; p = p->pn_next) {
        Stream_printf(f, "%*s", indent, "");
        switch (p->pn_type) {
        case TOK_CASE:
          Stream_write_string(f, "case ");
          output_expression(p->pn_left, f, false);
          Stream_write_string(f, ":\n");
          break;
        case TOK_DEFAULT:
          Stream_write_string(f, "default:\n");
          break;
        default:
          abort();
          break;
        }
        instrument_statement(p->pn_right, f, indent + 2, false);
      }
    }
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "}\n");
    break;
  case TOK_CASE:
  case TOK_DEFAULT:
    abort();
    break;
  case TOK_WHILE:
    assert(node->pn_arity == PN_BINARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "while (");
    output_expression(node->pn_left, f, false);
    Stream_write_string(f, ") {\n");
    instrument_statement(node->pn_right, f, indent + 2, false);
    Stream_write_string(f, "}\n");
    break;
  case TOK_DO:
    assert(node->pn_arity == PN_BINARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "do {\n");
    instrument_statement(node->pn_left, f, indent + 2, false);
    Stream_write_string(f, "}\n");
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "while (");
    output_expression(node->pn_right, f, false);
    Stream_write_string(f, ");\n");
    break;
  case TOK_FOR:
    assert(node->pn_arity == PN_BINARY);
    Stream_printf(f, "%*s", indent, "");
    switch (node->pn_left->pn_type) {
    case TOK_IN:
      /* for/in */
      assert(node->pn_left->pn_arity == PN_BINARY);
      output_for_in(node, f);
      break;
    case TOK_FORHEAD:
      /* for (;;) */
      assert(node->pn_left->pn_arity == PN_TERNARY);
      Stream_write_string(f, "for (");
      if (node->pn_left->pn_kid1) {
        output_expression(node->pn_left->pn_kid1, f, false);
      }
      Stream_write_string(f, ";");
      if (node->pn_left->pn_kid2) {
        Stream_write_char(f, ' ');
        output_expression(node->pn_left->pn_kid2, f, false);
      }
      Stream_write_string(f, ";");
      if (node->pn_left->pn_kid3) {
        Stream_write_char(f, ' ');
        output_expression(node->pn_left->pn_kid3, f, false);
      }
      Stream_write_char(f, ')');
      break;
    default:
      abort();
      break;
    }
    Stream_write_string(f, " {\n");
    instrument_statement(node->pn_right, f, indent + 2, false);
    Stream_write_string(f, "}\n");
    break;
  case TOK_THROW:
    assert(node->pn_arity == PN_UNARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "throw ");
    output_expression(node->pn_u.unary.kid, f, false);
    Stream_write_string(f, ";\n");
    break;
  case TOK_TRY:
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "try {\n");
    instrument_statement(node->pn_kid1, f, indent + 2, false);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "}\n");
    if (node->pn_kid2) {
      assert(node->pn_kid2->pn_type == TOK_RESERVED);
      for (JSParseNode * scope = node->pn_kid2->pn_head; scope != NULL; scope = scope->pn_next) {
        assert(scope->pn_type == TOK_LEXICALSCOPE);
        JSParseNode * catch_node = scope->pn_expr;
        assert(catch_node->pn_type == TOK_CATCH);
        Stream_printf(f, "%*s", indent, "");
        Stream_write_string(f, "catch (");
        output_expression(catch_node->pn_kid1, f, false);
        if (catch_node->pn_kid2) {
          Stream_write_string(f, " if ");
          output_expression(catch_node->pn_kid2, f, false);
        }
        Stream_write_string(f, ") {\n");
        instrument_statement(catch_node->pn_kid3, f, indent + 2, false);
        Stream_printf(f, "%*s", indent, "");
        Stream_write_string(f, "}\n");
      }
    }
    if (node->pn_kid3) {
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "finally {\n");
      instrument_statement(node->pn_kid3, f, indent + 2, false);
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "}\n");
    }
    break;
  case TOK_CATCH:
    abort();
    break;
  case TOK_BREAK:
  case TOK_CONTINUE:
    assert(node->pn_arity == PN_NAME || node->pn_arity == PN_NULLARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, node->pn_type == TOK_BREAK? "break": "continue");
    if (node->pn_atom != NULL) {
      Stream_write_char(f, ' ');
      print_string_atom(node->pn_atom, f);
    }
    Stream_write_string(f, ";\n");
    break;
  case TOK_WITH:
    assert(node->pn_arity == PN_BINARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "with (");
    output_expression(node->pn_left, f, false);
    Stream_write_string(f, ") {\n");
    instrument_statement(node->pn_right, f, indent + 2, false);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "}\n");
    break;
  case TOK_VAR:
    Stream_printf(f, "%*s", indent, "");
    output_expression(node, f, false);
    Stream_write_string(f, ";\n");
    break;
  case TOK_RETURN:
    assert(node->pn_arity == PN_UNARY);
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "return");
    if (node->pn_kid != NULL) {
      Stream_write_char(f, ' ');
      output_expression(node->pn_kid, f, true);
    }
    Stream_write_string(f, ";\n");
    break;
  case TOK_SEMI:
    assert(node->pn_arity == PN_UNARY);
    Stream_printf(f, "%*s", indent, "");
    if (node->pn_kid != NULL) {
      output_expression(node->pn_kid, f, true);
    }
    Stream_write_string(f, ";\n");
    break;
  case TOK_COLON:
  {
    assert(node->pn_arity == PN_NAME);
    Stream_printf(f, "%*s", indent < 2? 0: indent - 2, "");
    print_string_atom(node->pn_atom, f);
    Stream_write_string(f, ":\n");
    JSParseNode * labelled = node->pn_expr;
    if (labelled->pn_type == TOK_LEXICALSCOPE) {
      labelled = labelled->pn_expr;
    }
    if (labelled->pn_type == TOK_LC) {
      /* labelled block */
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "{\n");
      instrument_statement(labelled, f, indent + 2, false);
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "}\n");
    }
    else {
      /*
      This one is tricky: can't output instrumentation between the label and the
      statement it's supposed to label, so use output_statement instead of
      instrument_statement.
      */
      output_statement(labelled, f, indent, false);
    }
    break;
  }
  case TOK_LEXICALSCOPE:
    /* let statement */
    assert(node->pn_arity == PN_NAME);
    switch (node->pn_expr->pn_type) {
    case TOK_LET:
      /* let statement */
      assert(node->pn_expr->pn_arity == PN_BINARY);
      instrument_statement(node->pn_expr, f, indent, false);
      break;
    case TOK_LC:
      /* block */
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "{\n");
      instrument_statement(node->pn_expr, f, indent + 2, false);
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "}\n");
      break;
    case TOK_FOR:
      instrument_statement(node->pn_expr, f, indent, false);
      break;
    default:
      abort();
      break;
    }
    break;
  case TOK_LET:
    switch (node->pn_arity) {
    case PN_BINARY:
      /* let statement */
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "let (");
      assert(node->pn_left->pn_type == TOK_LP);
      assert(node->pn_left->pn_arity == PN_LIST);
      instrument_declarations(node->pn_left, f);
      Stream_write_string(f, ") {\n");
      instrument_statement(node->pn_right, f, indent + 2, false);
      Stream_printf(f, "%*s", indent, "");
      Stream_write_string(f, "}\n");
      break;
    case PN_LIST:
      /* let definition */
      Stream_printf(f, "%*s", indent, "");
      output_expression(node, f, false);
      Stream_write_string(f, ";\n");
      break;
    default:
      abort();
      break;
    }
    break;
  case TOK_DEBUGGER:
    Stream_printf(f, "%*s", indent, "");
    Stream_write_string(f, "debugger;\n");
    break;
  case TOK_SEQ:
    /*
    This occurs with the statement:
    for (var a = b in c) {}
    */
    assert(node->pn_arity == PN_LIST);
    for (JSParseNode * p = node->pn_head; p != NULL; p = p->pn_next) {
      instrument_statement(p, f, indent, false);
    }
    break;
  default:
    fatal_source(file_id, node->pn_pos.begin.lineno, "unsupported node type (%d)", node->pn_type);
  }
}

/*
See <Statements> in jsparse.h.
TOK_FUNCTION is handled as a statement and as an expression.
TOK_EXPORT, TOK_IMPORT are not handled.
*/
static void instrument_statement(JSParseNode * node, Stream * f, int indent, bool is_jscoverage_if) {
  if (node->pn_type != TOK_LC && node->pn_type != TOK_LEXICALSCOPE) {
    uint16_t line = node->pn_pos.begin.lineno;
    if (line > num_lines) {
      fatal("file %s contains more than 65,535 lines", file_id);
    }

    /* the root node has line number 0 */
    if (line != 0) {
      Stream_printf(f, "%*s", indent, "");
      Stream_printf(f, "_$jscoverage['%s'][%d]++;\n", file_id, line);
      lines[line - 1] = 1;
    }
  }
  output_statement(node, f, indent, is_jscoverage_if);
}

static bool characters_start_with(const jschar * characters, size_t line_start, size_t line_end, const char * prefix) {
  const jschar * characters_end = characters + line_end;
  const jschar * cp = characters + line_start;
  const char * bp = prefix;
  for (;;) {
    if (*bp == '\0') {
      return true;
    }
    else if (cp == characters_end) {
      return false;
    }
    else if (*cp != *bp) {
      return false;
    }
    bp++;
    cp++;
  }
}

static bool characters_are_white_space(const jschar * characters, size_t line_start, size_t line_end) {
  /* XXX - other Unicode space */
  const jschar * end = characters + line_end;
  for (const jschar * p = characters + line_start; p < end; p++) {
    jschar c = *p;
    if (c == 0x9 || c == 0xB || c == 0xC || c == 0x20 || c == 0xA0) {
      continue;
    }
    else {
      return false;
    }
  }
  return true;
}

static void error_reporter(JSContext * context, const char * message, JSErrorReport * report) {
  warn_source(file_id, report->lineno, "%s", message);
}

void jscoverage_instrument_js(const char * id, const uint16_t * characters, size_t num_characters, Stream * output) {
  file_id = id;

  /* parse the javascript */
  JSParseContext parse_context;
  if (! js_InitParseContext(context, &parse_context, NULL, NULL, characters, num_characters, NULL, NULL, 1)) {
    fatal("cannot create token stream from file %s", file_id);
  }
  JSErrorReporter old_error_reporter = JS_SetErrorReporter(context, error_reporter);
  JSParseNode * node = js_ParseScript(context, global, &parse_context);
  if (node == NULL) {
    js_ReportUncaughtException(context);
    fatal("parse error in file %s", file_id);
  }
  JS_SetErrorReporter(context, old_error_reporter);
  num_lines = node->pn_pos.end.lineno;
  lines = (char *) xmalloc(num_lines);
  for (unsigned int i = 0; i < num_lines; i++) {
    lines[i] = 0;
  }

  /* search code for conditionals */
  exclusive_directives = xnew(bool, num_lines);
  for (unsigned int i = 0; i < num_lines; i++) {
    exclusive_directives[i] = false;
  }

  bool has_conditionals = false;
  struct IfDirective * if_directives = NULL;
  size_t line_number = 0;
  size_t i = 0;
  while (i < num_characters) {
    if (line_number == UINT16_MAX) {
      fatal("file %s contains more than 65,535 lines", file_id);
    }
    line_number++;
    size_t line_start = i;
    jschar c;
    bool done = false;
    while (! done && i < num_characters) {
      c = characters[i];
      switch (c) {
      case '\r':
      case '\n':
      case 0x2028:
      case 0x2029:
        done = true;
        break;
      default:
        i++;
      }
    }
    size_t line_end = i;
    if (i < num_characters) {
      i++;
      if (c == '\r' && i < num_characters && characters[i] == '\n') {
        i++;
      }
    }

    if (characters_start_with(characters, line_start, line_end, "//#JSCOVERAGE_IF")) {
      has_conditionals = true;

      if (characters_are_white_space(characters, line_start + 16, line_end)) {
        exclusive_directives[line_number - 1] = true;
      }
      else {
        struct IfDirective * if_directive = xnew(struct IfDirective, 1);
        if_directive->condition_start = characters + line_start + 16;
        if_directive->condition_end = characters + line_end;
        if_directive->start_line = line_number;
        if_directive->end_line = 0;
        if_directive->next = if_directives;
        if_directives = if_directive;
      }
    }
    else if (characters_start_with(characters, line_start, line_end, "//#JSCOVERAGE_ENDIF")) {
      for (struct IfDirective * p = if_directives; p != NULL; p = p->next) {
        if (p->end_line == 0) {
          p->end_line = line_number;
          break;
        }
      }
    }
  }

  /*
  An instrumented JavaScript file has 4 sections:
  1. initialization
  2. instrumented source code
  3. conditionals
  4. original source code
  */

  Stream * instrumented = Stream_new(0);
  instrument_statement(node, instrumented, 0, false);
  js_FinishParseContext(context, &parse_context);

  /* write line number info to the output */
  Stream_write_string(output, "/* automatically generated by JSCoverage - do not edit */\n");
	Stream_write_string(output, "if (typeof _$jscoverage === 'undefined') _$jscoverage = {};\n");
  Stream_printf(output, "if (! _$jscoverage['%s']) {\n", file_id);
  Stream_printf(output, "  _$jscoverage['%s'] = [];\n", file_id);
  for (int i = 0; i < num_lines; i++) {
    if (lines[i]) {
      Stream_printf(output, "  _$jscoverage['%s'][%d] = 0;\n", file_id, i + 1);
    }
  }
  Stream_write_string(output, "}\n");
  free(lines);
  lines = NULL;
  free(exclusive_directives);
  exclusive_directives = NULL;

  /* conditionals */
  if (has_conditionals) {
    Stream_printf(output, "_$jscoverage['%s'].conditionals = [];\n", file_id);
  }

  /* copy the instrumented source code to the output */
  Stream_write(output, instrumented->data, instrumented->length);

  /* conditionals */
  for (struct IfDirective * if_directive = if_directives; if_directive != NULL; if_directive = if_directive->next) {
    Stream_write_string(output, "if (!(");
    print_javascript(if_directive->condition_start, if_directive->condition_end - if_directive->condition_start, output);
    Stream_write_string(output, ")) {\n");
    Stream_printf(output, "  _$jscoverage['%s'].conditionals[%d] = %d;\n", file_id, if_directive->start_line, if_directive->end_line);
    Stream_write_string(output, "}\n");
  }

  /* free */
  while (if_directives != NULL) {
    struct IfDirective * if_directive = if_directives;
    if_directives = if_directives->next;
    free(if_directive);
  }

  /* copy the original source to the output */
  Stream_printf(output, "_$jscoverage['%s'].source = ", file_id);
  jscoverage_write_source(id, characters, num_characters, output);
  Stream_printf(output, ";\n");

  Stream_delete(instrumented);

  file_id = NULL;
}

void jscoverage_write_source(const char * id, const jschar * characters, size_t num_characters, Stream * output) {
  Stream_write_string(output, "[");
  if (jscoverage_highlight) {
    Stream * highlighted_stream = Stream_new(num_characters);
    jscoverage_highlight_js(context, id, characters, num_characters, highlighted_stream);
    size_t i = 0;
    while (i < highlighted_stream->length) {
      if (i > 0) {
        Stream_write_char(output, ',');
      }

      Stream_write_char(output, '"');
      bool done = false;
      while (! done) {
        char c = highlighted_stream->data[i];
        switch (c) {
        case 0x8:
          /* backspace */
          Stream_write_string(output, "\\b");
          break;
        case 0x9:
          /* horizontal tab */
          Stream_write_string(output, "\\t");
          break;
        case 0xa:
          /* line feed (new line) */
          done = true;
          break;
        /* IE doesn't support this */
        /*
        case 0xb:
          Stream_write_string(output, "\\v");
          break;
        */
        case 0xc:
          /* form feed */
          Stream_write_string(output, "\\f");
          break;
        case 0xd:
          /* carriage return */
          done = true;
          if (i + 1 < highlighted_stream->length && highlighted_stream->data[i + 1] == '\n') {
            i++;
          }
          break;
        case '"':
          Stream_write_string(output, "\\\"");
          break;
        case '\\':
          Stream_write_string(output, "\\\\");
          break;
        default:
          Stream_write_char(output, c);
          break;
        }
        i++;
        if (i >= highlighted_stream->length) {
          done = true;
        }
      }
      Stream_write_char(output, '"');
    }
    Stream_delete(highlighted_stream);
  }
  else {
    size_t i = 0;
    while (i < num_characters) {
      if (i > 0) {
        Stream_write_char(output, ',');
      }

      Stream_write_char(output, '"');
      bool done = false;
      while (! done) {
        jschar c = characters[i];
        switch (c) {
        case 0x8:
          /* backspace */
          Stream_write_string(output, "\\b");
          break;
        case 0x9:
          /* horizontal tab */
          Stream_write_string(output, "\\t");
          break;
        case 0xa:
          /* line feed (new line) */
          done = true;
          break;
        /* IE doesn't support this */
        /*
        case 0xb:
          Stream_write_string(output, "\\v");
          break;
        */
        case 0xc:
          /* form feed */
          Stream_write_string(output, "\\f");
          break;
        case 0xd:
          /* carriage return */
          done = true;
          if (i + 1 < num_characters && characters[i + 1] == '\n') {
            i++;
          }
          break;
        case '"':
          Stream_write_string(output, "\\\"");
          break;
        case '\\':
          Stream_write_string(output, "\\\\");
          break;
        case '&':
          Stream_write_string(output, "&amp;");
          break;
        case '<':
          Stream_write_string(output, "&lt;");
          break;
        case '>':
          Stream_write_string(output, "&gt;");
          break;
        case 0x2028:
        case 0x2029:
          done = true;
          break;
        default:
          if (32 <= c && c <= 126) {
            Stream_write_char(output, c);
          }
          else {
            Stream_printf(output, "&#%d;", c);
          }
          break;
        }
        i++;
        if (i >= num_characters) {
          done = true;
        }
      }
      Stream_write_char(output, '"');
    }
  }
  Stream_write_string(output, "]");
}

void jscoverage_copy_resources(const char * destination_directory) {
  copy_resource("jscoverage.html", destination_directory);
  copy_resource("jscoverage.css", destination_directory);
  copy_resource("jscoverage.js", destination_directory);
  copy_resource("jscoverage-ie.css", destination_directory);
  copy_resource("jscoverage-throbber.gif", destination_directory);
  copy_resource("jscoverage-highlight.css", destination_directory);
}

/*
coverage reports
*/

struct FileCoverageList {
  FileCoverage * file_coverage;
  struct FileCoverageList * next;
};

struct Coverage {
  JSHashTable * coverage_table;
  struct FileCoverageList * coverage_list;
};

static int compare_strings(const void * p1, const void * p2) {
  return strcmp((const char *) p1, (const char *) p2) == 0;
}

Coverage * Coverage_new(void) {
  Coverage * result = (Coverage *) xmalloc(sizeof(Coverage));
  result->coverage_table = JS_NewHashTable(1024, JS_HashString, compare_strings, NULL, NULL, NULL);
  if (result->coverage_table == NULL) {
    fatal("cannot create hash table");
  }
  result->coverage_list = NULL;
  return result;
}

void Coverage_delete(Coverage * coverage) {
  JS_HashTableDestroy(coverage->coverage_table);
  struct FileCoverageList * p = coverage->coverage_list;
  while (p != NULL) {
    free(p->file_coverage->coverage_lines);
    if (p->file_coverage->source_lines != NULL) {
      for (uint32 i = 0; i < p->file_coverage->num_source_lines; i++) {
        free(p->file_coverage->source_lines[i]);
      }
      free(p->file_coverage->source_lines);
    }
    free(p->file_coverage->id);
    free(p->file_coverage);
    struct FileCoverageList * q = p;
    p = p->next;
    free(q);
  }
  free(coverage);
}

struct EnumeratorArg {
  CoverageForeachFunction f;
  void * p;
};

static intN enumerator(JSHashEntry * entry, intN i, void * arg) {
  struct EnumeratorArg * enumerator_arg = (struct EnumeratorArg *) arg;
  enumerator_arg->f((FileCoverage *) entry->value, i, enumerator_arg->p);
  return 0;
}

void Coverage_foreach_file(Coverage * coverage, CoverageForeachFunction f, void * p) {
  struct EnumeratorArg enumerator_arg;
  enumerator_arg.f = f;
  enumerator_arg.p = p;
  JS_HashTableEnumerateEntries(coverage->coverage_table, enumerator, &enumerator_arg);
}

int jscoverage_parse_json(Coverage * coverage, const uint8_t * json, size_t length) {
  int result = 0;

  jschar * base = js_InflateString(context, (char *) json, &length);
  if (base == NULL) {
    fatal("out of memory");
  }

  jschar * parenthesized_json = xnew(jschar, addst(length, 2));
  parenthesized_json[0] = '(';
  memcpy(parenthesized_json + 1, base, mulst(length, sizeof(jschar)));
  parenthesized_json[length + 1] = ')';

  JS_free(context, base);

  JSParseContext parse_context;
  if (! js_InitParseContext(context, &parse_context, NULL, NULL, parenthesized_json, length + 2, NULL, NULL, 1)) {
    free(parenthesized_json);
    return -1;
  }
  JSParseNode * root = js_ParseScript(context, global, &parse_context);
  free(parenthesized_json);

  JSParseNode * semi = NULL;
  JSParseNode * object = NULL;

  if (root == NULL) {
    result = -1;
    goto done;
  }

  /* root node must be TOK_LC */
  if (root->pn_type != TOK_LC) {
    result = -1;
    goto done;
  }
  semi = root->pn_u.list.head;

  /* the list must be TOK_SEMI and it must contain only one element */
  if (semi->pn_type != TOK_SEMI || semi->pn_next != NULL) {
    result = -1;
    goto done;
  }
  object = semi->pn_kid;

  /* this must be an object literal */
  if (object->pn_type != TOK_RC) {
    result = -1;
    goto done;
  }

  for (JSParseNode * p = object->pn_head; p != NULL; p = p->pn_next) {
    /* every element of this list must be TOK_COLON */
    if (p->pn_type != TOK_COLON) {
      result = -1;
      goto done;
    }

    /* the key must be a string representing the file */
    JSParseNode * key = p->pn_left;
    if (key->pn_type != TOK_STRING || ! ATOM_IS_STRING(key->pn_atom)) {
      result = -1;
      goto done;
    }
    char * id_bytes = JS_GetStringBytes(ATOM_TO_STRING(key->pn_atom));

    /* the value must be an object literal OR an array */
    JSParseNode * value = p->pn_right;
    if (! (value->pn_type == TOK_RC || value->pn_type == TOK_RB)) {
      result = -1;
      goto done;
    }

    JSParseNode * array = NULL;
    JSParseNode * source = NULL;
    if (value->pn_type == TOK_RB) {
      /* an array */
      array = value;
    }
    else if (value->pn_type == TOK_RC) {
      /* an object literal */
      if (value->pn_count != 2) {
        result = -1;
        goto done;
      }
      for (JSParseNode * element = value->pn_head; element != NULL; element = element->pn_next) {
        if (element->pn_type != TOK_COLON) {
          result = -1;
          goto done;
        }
        JSParseNode * left = element->pn_left;
        if (left->pn_type != TOK_STRING || ! ATOM_IS_STRING(left->pn_atom)) {
          result = -1;
          goto done;
        }
        const char * s = JS_GetStringBytes(ATOM_TO_STRING(left->pn_atom));
        if (strcmp(s, "coverage") == 0) {
          array = element->pn_right;
          if (array->pn_type != TOK_RB) {
            result = -1;
            goto done;
          }
        }
        else if (strcmp(s, "source") == 0) {
          source = element->pn_right;
          if (source->pn_type != TOK_RB) {
            result = -1;
            goto done;
          }
        }
        else {
          result = -1;
          goto done;
        }
      }
    }
    else {
      result = -1;
      goto done;
    }

    if (array == NULL) {
      result = -1;
      goto done;
    }

    /* look up the file in the coverage table */
    FileCoverage * file_coverage = (FileCoverage *) JS_HashTableLookup(coverage->coverage_table, id_bytes);
    if (file_coverage == NULL) {
      /* not there: create a new one */
      char * id = xstrdup(id_bytes);
      file_coverage = (FileCoverage *) xmalloc(sizeof(FileCoverage));
      file_coverage->id = id;
      file_coverage->num_coverage_lines = array->pn_count;
      file_coverage->coverage_lines = xnew(int, array->pn_count);
      file_coverage->source_lines = NULL;

      /* set coverage for all lines */
      uint32 i = 0;
      for (JSParseNode * element = array->pn_head; element != NULL; element = element->pn_next, i++) {
        if (element->pn_type == TOK_NUMBER) {
          file_coverage->coverage_lines[i] = (int) element->pn_dval;
        }
        else if (element->pn_type == TOK_PRIMARY && element->pn_op == JSOP_NULL) {
          file_coverage->coverage_lines[i] = -1;
        }
        else {
          result = -1;
          goto done;
        }
      }
      assert(i == array->pn_count);

      /* add to the hash table */
      JS_HashTableAdd(coverage->coverage_table, id, file_coverage);
      struct FileCoverageList * coverage_list = (FileCoverageList *) xmalloc(sizeof(struct FileCoverageList));
      coverage_list->file_coverage = file_coverage;
      coverage_list->next = coverage->coverage_list;
      coverage->coverage_list = coverage_list;
    }
    else {
      /* sanity check */
      assert(strcmp(file_coverage->id, id_bytes) == 0);
      if (file_coverage->num_coverage_lines != array->pn_count) {
        result = -2;
        goto done;
      }

      /* merge the coverage */
      uint32 i = 0;
      for (JSParseNode * element = array->pn_head; element != NULL; element = element->pn_next, i++) {
        if (element->pn_type == TOK_NUMBER) {
          if (file_coverage->coverage_lines[i] == -1) {
            result = -2;
            goto done;
          }
          file_coverage->coverage_lines[i] += (int) element->pn_dval;
        }
        else if (element->pn_type == TOK_PRIMARY && element->pn_op == JSOP_NULL) {
          if (file_coverage->coverage_lines[i] != -1) {
            result = -2;
            goto done;
          }
        }
        else {
          result = -1;
          goto done;
        }
      }
      assert(i == array->pn_count);
    }

    /* if this JSON file has source, use it */
    if (file_coverage->source_lines == NULL && source != NULL) {
      file_coverage->num_source_lines = source->pn_count;
      file_coverage->source_lines = xnew(char *, source->pn_count);
      uint32 i = 0;
      for (JSParseNode * element = source->pn_head; element != NULL; element = element->pn_next, i++) {
        if (element->pn_type != TOK_STRING) {
          result = -1;
          goto done;
        }
        file_coverage->source_lines[i] = xstrdup(JS_GetStringBytes(ATOM_TO_STRING(element->pn_atom)));
      }
      assert(i == source->pn_count);
    }
  }

done:
  js_FinishParseContext(context, &parse_context);
  return result;
}
