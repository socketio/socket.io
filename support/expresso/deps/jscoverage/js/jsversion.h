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
 * JS configuration macros.
 */
#ifndef JS_VERSION
#define JS_VERSION 180
#endif

/*
 * Compile-time JS version configuration.  The JS version numbers lie on the
 * number line like so:
 *
 * 1.0     1.1     1.2     1.3     1.4     ECMAv3  1.5     1.6     1.7     1.8
 *         ^                       ^
 *         |                       |
 *         basis for ECMAv1        close to ECMAv2
 *
 * where ECMAv3 stands for ECMA-262 Edition 3.  See the runtime version enum
 * JSVersion in jspubtd.h.  Code in the engine can therefore count on version
 * <= JSVERSION_1_4 to mean "before the Third Edition of ECMA-262" and version
 * > JSVERSION_1_4 to mean "at or after the Third Edition".
 *
 * In the (likely?) event that SpiderMonkey grows to implement JavaScript 2.0,
 * or ECMA-262 Edition 4 (JS2 without certain extensions), the version number
 * to use would be near 200, or greater.
 *
 * The JS_VERSION_ECMA_3 version is the minimal configuration conforming to
 * the ECMA-262 Edition 3 specification.  Use it for minimal embeddings, where
 * you're sure you don't need any of the extensions disabled in this version.
 * In order to facilitate testing, JS_HAS_OBJ_PROTO_PROP is defined as part of
 * the JS_VERSION_ECMA_3_TEST version.
 *
 * To keep things sane in the modern age, where we need exceptions in order to
 * implement, e.g., iterators and generators, we are dropping support for all
 * versions <= 1.4.
 */
#define JS_VERSION_ECMA_3       148
#define JS_VERSION_ECMA_3_TEST  149

#if JS_VERSION == JS_VERSION_ECMA_3 ||                                        \
    JS_VERSION == JS_VERSION_ECMA_3_TEST

#define JS_HAS_STR_HTML_HELPERS 0       /* has str.anchor, str.bold, etc. */
#define JS_HAS_PERL_SUBSTR      0       /* has str.substr */
#if JS_VERSION == JS_VERSION_ECMA_3_TEST
#define JS_HAS_OBJ_PROTO_PROP   1       /* has o.__proto__ etc. */
#else
#define JS_HAS_OBJ_PROTO_PROP   0       /* has o.__proto__ etc. */
#endif
#define JS_HAS_OBJ_WATCHPOINT   0       /* has o.watch and o.unwatch */
#define JS_HAS_EVAL_THIS_SCOPE  0       /* Math.eval is same as with (Math) */
#define JS_HAS_SHARP_VARS       0       /* has #n=, #n# for object literals */
#define JS_HAS_SCRIPT_OBJECT    0       /* has (new Script("x++")).exec() */
#define JS_HAS_XDR              0       /* has XDR API and internal support */
#define JS_HAS_XDR_FREEZE_THAW  0       /* has XDR freeze/thaw script methods */
#define JS_HAS_TOSOURCE         0       /* has Object/Array toSource method */
#define JS_HAS_DEBUGGER_KEYWORD 0       /* has hook for debugger keyword */
#define JS_HAS_CATCH_GUARD      0       /* has exception handling catch guard */
#define JS_HAS_SPARSE_ARRAYS    0       /* array methods preserve empty elems */
#define JS_HAS_GETTER_SETTER    0       /* has JS2 getter/setter functions */
#define JS_HAS_UNEVAL           0       /* has uneval() top-level function */
#define JS_HAS_CONST            0       /* has JS2 const as alternative var */
#define JS_HAS_FUN_EXPR_STMT    0       /* has function expression statement */
#define JS_HAS_LVALUE_RETURN    1       /* has o.item(i) = j; for native item */
#define JS_HAS_NO_SUCH_METHOD   0       /* has o.__noSuchMethod__ handler */
#define JS_HAS_XML_SUPPORT      0       /* has ECMAScript for XML support */
#define JS_HAS_ARRAY_EXTRAS     0       /* has indexOf and Lispy extras */
#define JS_HAS_GENERATORS       0       /* has yield in generator function */
#define JS_HAS_BLOCK_SCOPE      0       /* has block scope via let/arraycomp */
#define JS_HAS_DESTRUCTURING    0       /* has [a,b] = ... or {p:a,q:b} = ... */
#define JS_HAS_GENERATOR_EXPRS  0       /* has (expr for (lhs in iterable)) */
#define JS_HAS_EXPR_CLOSURES    0       /* has function (formals) listexpr */

#elif JS_VERSION < 150

#error "unsupported JS_VERSION"

#elif JS_VERSION == 150

#define JS_HAS_STR_HTML_HELPERS 1       /* has str.anchor, str.bold, etc. */
#define JS_HAS_PERL_SUBSTR      1       /* has str.substr */
#define JS_HAS_OBJ_PROTO_PROP   1       /* has o.__proto__ etc. */
#define JS_HAS_OBJ_WATCHPOINT   1       /* has o.watch and o.unwatch */
#define JS_HAS_EVAL_THIS_SCOPE  1       /* Math.eval is same as with (Math) */
#define JS_HAS_SHARP_VARS       1       /* has #n=, #n# for object literals */
#define JS_HAS_SCRIPT_OBJECT    1       /* has (new Script("x++")).exec() */
#define JS_HAS_XDR              1       /* has XDR API and internal support */
#define JS_HAS_XDR_FREEZE_THAW  0       /* has XDR freeze/thaw script methods */
#define JS_HAS_TOSOURCE         1       /* has Object/Array toSource method */
#define JS_HAS_DEBUGGER_KEYWORD 1       /* has hook for debugger keyword */
#define JS_HAS_CATCH_GUARD      1       /* has exception handling catch guard */
#define JS_HAS_SPARSE_ARRAYS    0       /* array methods preserve empty elems */
#define JS_HAS_GETTER_SETTER    1       /* has JS2 getter/setter functions */
#define JS_HAS_UNEVAL           1       /* has uneval() top-level function */
#define JS_HAS_CONST            1       /* has JS2 const as alternative var */
#define JS_HAS_FUN_EXPR_STMT    1       /* has function expression statement */
#define JS_HAS_LVALUE_RETURN    1       /* has o.item(i) = j; for native item */
#define JS_HAS_NO_SUCH_METHOD   1       /* has o.__noSuchMethod__ handler */
#define JS_HAS_XML_SUPPORT      0       /* has ECMAScript for XML support */
#define JS_HAS_ARRAY_EXTRAS     0       /* has indexOf and Lispy extras */
#define JS_HAS_GENERATORS       0       /* has yield in generator function */
#define JS_HAS_BLOCK_SCOPE      0       /* has block scope via let/arraycomp */
#define JS_HAS_DESTRUCTURING    0       /* has [a,b] = ... or {p:a,q:b} = ... */
#define JS_HAS_GENERATOR_EXPRS  0       /* has (expr for (lhs in iterable)) */
#define JS_HAS_EXPR_CLOSURES    0       /* has function (formals) listexpr */

#elif JS_VERSION == 160

#define JS_HAS_STR_HTML_HELPERS 1       /* has str.anchor, str.bold, etc. */
#define JS_HAS_PERL_SUBSTR      1       /* has str.substr */
#define JS_HAS_OBJ_PROTO_PROP   1       /* has o.__proto__ etc. */
#define JS_HAS_OBJ_WATCHPOINT   1       /* has o.watch and o.unwatch */
#define JS_HAS_EVAL_THIS_SCOPE  1       /* Math.eval is same as with (Math) */
#define JS_HAS_SHARP_VARS       1       /* has #n=, #n# for object literals */
#define JS_HAS_SCRIPT_OBJECT    1       /* has (new Script("x++")).exec() */
#define JS_HAS_XDR              1       /* has XDR API and internal support */
#define JS_HAS_XDR_FREEZE_THAW  0       /* has XDR freeze/thaw script methods */
#define JS_HAS_TOSOURCE         1       /* has Object/Array toSource method */
#define JS_HAS_DEBUGGER_KEYWORD 1       /* has hook for debugger keyword */
#define JS_HAS_CATCH_GUARD      1       /* has exception handling catch guard */
#define JS_HAS_SPARSE_ARRAYS    0       /* array methods preserve empty elems */
#define JS_HAS_GETTER_SETTER    1       /* has JS2 getter/setter functions */
#define JS_HAS_UNEVAL           1       /* has uneval() top-level function */
#define JS_HAS_CONST            1       /* has JS2 const as alternative var */
#define JS_HAS_FUN_EXPR_STMT    1       /* has function expression statement */
#define JS_HAS_LVALUE_RETURN    1       /* has o.item(i) = j; for native item */
#define JS_HAS_NO_SUCH_METHOD   1       /* has o.__noSuchMethod__ handler */
#define JS_HAS_XML_SUPPORT      1       /* has ECMAScript for XML support */
#define JS_HAS_ARRAY_EXTRAS     1       /* has indexOf and Lispy extras */
#define JS_HAS_GENERATORS       0       /* has yield in generator function */
#define JS_HAS_BLOCK_SCOPE      0       /* has block scope via let/arraycomp */
#define JS_HAS_DESTRUCTURING    0       /* has [a,b] = ... or {p:a,q:b} = ... */
#define JS_HAS_GENERATOR_EXPRS  0       /* has (expr for (lhs in iterable)) */
#define JS_HAS_EXPR_CLOSURES    0       /* has function (formals) listexpr */

#elif JS_VERSION == 170

#define JS_HAS_STR_HTML_HELPERS 1       /* has str.anchor, str.bold, etc. */
#define JS_HAS_PERL_SUBSTR      1       /* has str.substr */
#define JS_HAS_OBJ_PROTO_PROP   1       /* has o.__proto__ etc. */
#define JS_HAS_OBJ_WATCHPOINT   1       /* has o.watch and o.unwatch */
#define JS_HAS_EVAL_THIS_SCOPE  1       /* Math.eval is same as with (Math) */
#define JS_HAS_SHARP_VARS       1       /* has #n=, #n# for object literals */
#define JS_HAS_SCRIPT_OBJECT    0       /* has (new Script("x++")).exec() */
#define JS_HAS_XDR              1       /* has XDR API and internal support */
#define JS_HAS_XDR_FREEZE_THAW  0       /* has XDR freeze/thaw script methods */
#define JS_HAS_TOSOURCE         1       /* has Object/Array toSource method */
#define JS_HAS_DEBUGGER_KEYWORD 1       /* has hook for debugger keyword */
#define JS_HAS_CATCH_GUARD      1       /* has exception handling catch guard */
#define JS_HAS_SPARSE_ARRAYS    0       /* array methods preserve empty elems */
#define JS_HAS_GETTER_SETTER    1       /* has JS2 getter/setter functions */
#define JS_HAS_UNEVAL           1       /* has uneval() top-level function */
#define JS_HAS_CONST            1       /* has JS2 const as alternative var */
#define JS_HAS_FUN_EXPR_STMT    1       /* has function expression statement */
#define JS_HAS_LVALUE_RETURN    1       /* has o.item(i) = j; for native item */
#define JS_HAS_NO_SUCH_METHOD   1       /* has o.__noSuchMethod__ handler */
#define JS_HAS_XML_SUPPORT      1       /* has ECMAScript for XML support */
#define JS_HAS_ARRAY_EXTRAS     1       /* has indexOf and Lispy extras */
#define JS_HAS_GENERATORS       1       /* has yield in generator function */
#define JS_HAS_BLOCK_SCOPE      1       /* has block scope via let/arraycomp */
#define JS_HAS_DESTRUCTURING    1       /* has [a,b] = ... or {p:a,q:b} = ... */
#define JS_HAS_GENERATOR_EXPRS  0       /* has (expr for (lhs in iterable)) */
#define JS_HAS_EXPR_CLOSURES    0       /* has function (formals) listexpr */

#elif JS_VERSION == 180

#define JS_HAS_STR_HTML_HELPERS 1       /* has str.anchor, str.bold, etc. */
#define JS_HAS_PERL_SUBSTR      1       /* has str.substr */
#define JS_HAS_OBJ_PROTO_PROP   1       /* has o.__proto__ etc. */
#define JS_HAS_OBJ_WATCHPOINT   1       /* has o.watch and o.unwatch */
#define JS_HAS_EVAL_THIS_SCOPE  1       /* Math.eval is same as with (Math) */
#define JS_HAS_SHARP_VARS       1       /* has #n=, #n# for object literals */
#define JS_HAS_SCRIPT_OBJECT    0       /* has (new Script("x++")).exec() */
#define JS_HAS_XDR              1       /* has XDR API and internal support */
#define JS_HAS_XDR_FREEZE_THAW  0       /* has XDR freeze/thaw script methods */
#define JS_HAS_TOSOURCE         1       /* has Object/Array toSource method */
#define JS_HAS_DEBUGGER_KEYWORD 1       /* has hook for debugger keyword */
#define JS_HAS_CATCH_GUARD      1       /* has exception handling catch guard */
#define JS_HAS_SPARSE_ARRAYS    0       /* array methods preserve empty elems */
#define JS_HAS_GETTER_SETTER    1       /* has JS2 getter/setter functions */
#define JS_HAS_UNEVAL           1       /* has uneval() top-level function */
#define JS_HAS_CONST            1       /* has JS2 const as alternative var */
#define JS_HAS_FUN_EXPR_STMT    1       /* has function expression statement */
#define JS_HAS_LVALUE_RETURN    1       /* has o.item(i) = j; for native item */
#define JS_HAS_NO_SUCH_METHOD   1       /* has o.__noSuchMethod__ handler */
#define JS_HAS_XML_SUPPORT      1       /* has ECMAScript for XML support */
#define JS_HAS_ARRAY_EXTRAS     1       /* has indexOf and Lispy extras */
#define JS_HAS_GENERATORS       1       /* has yield in generator function */
#define JS_HAS_BLOCK_SCOPE      1       /* has block scope via let/arraycomp */
#define JS_HAS_DESTRUCTURING    2       /* has [a,b] = ... or {p:a,q:b} = ... */
#define JS_HAS_GENERATOR_EXPRS  1       /* has (expr for (lhs in iterable)) */
#define JS_HAS_EXPR_CLOSURES    1       /* has function (formals) listexpr */

#else

#error "unknown JS_VERSION"

#endif

/* Features that are present in all versions. */
#define JS_HAS_RESERVED_JAVA_KEYWORDS   1
#define JS_HAS_RESERVED_ECMA_KEYWORDS   1

/* Feature-test macro for evolving destructuring support. */
#define JS_HAS_DESTRUCTURING_SHORTHAND  (JS_HAS_DESTRUCTURING == 2)
