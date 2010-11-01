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
 * This is the JavaScript error message file.
 *
 * The format for each JS error message is:
 *
 * MSG_DEF(<SYMBOLIC_NAME>, <ERROR_NUMBER>, <ARGUMENT_COUNT>, <EXCEPTION_NAME>,
 *         <FORMAT_STRING>)
 *
 * where ;
 * <SYMBOLIC_NAME> is a legal C identifer that will be used in the
 * JS engine source.
 *
 * <ERROR_NUMBER> is an unique integral value identifying this error.
 *
 * <ARGUMENT_COUNT> is an integer literal specifying the total number of
 * replaceable arguments in the following format string.
 *
 * <EXCEPTION_NAME> is an exception index from the enum in jsexn.c;
 * JSEXN_NONE for none.  The given exception index will be raised by the
 * engine when the corresponding error occurs.
 *
 * <FORMAT_STRING> is a string literal, optionally containing sequences
 * {X} where X  is an integer representing the argument number that will
 * be replaced with a string value when the error is reported.
 *
 * e.g.
 *
 * MSG_DEF(JSMSG_NOT_A_SUBSPECIES, 73, JSEXN_NONE, 2,
 *         "{0} is not a member of the {1} family")
 *
 * can be used:
 *
 * JS_ReportErrorNumber(JSMSG_NOT_A_SUBSPECIES, "Rhino", "Monkey");
 *
 * to report:
 *
 * "Rhino is not a member of the Monkey family"
 *
 * Before adding a new MSG_DEF at the end, look for JSMSG_UNUSED<n> free
 * index placeholders in the middle of the list.
 */

MSG_DEF(JSMSG_NOT_AN_ERROR,             0, 0, JSEXN_NONE, "<Error #0 is reserved>")
MSG_DEF(JSMSG_NOT_DEFINED,              1, 1, JSEXN_REFERENCEERR, "{0} is not defined")
MSG_DEF(JSMSG_INACTIVE,                 2, 0, JSEXN_INTERNALERR, "nothing active on context")
MSG_DEF(JSMSG_MORE_ARGS_NEEDED,         3, 3, JSEXN_TYPEERR, "{0} requires more than {1} argument{2}")
MSG_DEF(JSMSG_BAD_CHAR,                 4, 1, JSEXN_INTERNALERR, "invalid format character {0}")
MSG_DEF(JSMSG_BAD_TYPE,                 5, 1, JSEXN_TYPEERR, "unknown type {0}")
MSG_DEF(JSMSG_ALLOC_OVERFLOW,           6, 0, JSEXN_INTERNALERR, "allocation size overflow")
MSG_DEF(JSMSG_CANT_UNLOCK,              7, 0, JSEXN_INTERNALERR, "can't unlock memory")
MSG_DEF(JSMSG_INCOMPATIBLE_PROTO,       8, 3, JSEXN_TYPEERR, "{0}.prototype.{1} called on incompatible {2}")
MSG_DEF(JSMSG_NO_CONSTRUCTOR,           9, 1, JSEXN_TYPEERR, "{0} has no constructor")
MSG_DEF(JSMSG_CANT_ALIAS,              10, 3, JSEXN_TYPEERR, "can't alias {0} to {1} in class {2}")
MSG_DEF(JSMSG_NOT_SCRIPTED_FUNCTION,   11, 1, JSEXN_TYPEERR, "{0} is not a scripted function")
MSG_DEF(JSMSG_BAD_SORT_ARG,            12, 0, JSEXN_TYPEERR, "invalid Array.prototype.sort argument")
MSG_DEF(JSMSG_BAD_ATOMIC_NUMBER,       13, 1, JSEXN_INTERNALERR, "internal error: no index for atom {0}")
MSG_DEF(JSMSG_TOO_MANY_LITERALS,       14, 0, JSEXN_INTERNALERR, "too many literals")
MSG_DEF(JSMSG_CANT_WATCH,              15, 1, JSEXN_TYPEERR, "can't watch non-native objects of class {0}")
MSG_DEF(JSMSG_STACK_UNDERFLOW,         16, 2, JSEXN_INTERNALERR, "internal error compiling {0}: stack underflow at pc {1}")
MSG_DEF(JSMSG_NEED_DIET,               17, 1, JSEXN_INTERNALERR, "{0} too large")
MSG_DEF(JSMSG_TOO_MANY_LOCAL_ROOTS,    18, 0, JSEXN_ERR, "out of local root space")
MSG_DEF(JSMSG_READ_ONLY,               19, 1, JSEXN_ERR, "{0} is read-only")
MSG_DEF(JSMSG_BAD_FORMAL,              20, 0, JSEXN_SYNTAXERR, "malformed formal parameter")
MSG_DEF(JSMSG_BAD_ITERATOR,            21, 3, JSEXN_TYPEERR, "{0} has invalid {1} value {2}")
MSG_DEF(JSMSG_NOT_FUNCTION,            22, 1, JSEXN_TYPEERR, "{0} is not a function")
MSG_DEF(JSMSG_NOT_CONSTRUCTOR,         23, 1, JSEXN_TYPEERR, "{0} is not a constructor")
MSG_DEF(JSMSG_SCRIPT_STACK_QUOTA,      24, 0, JSEXN_INTERNALERR, "script stack space quota is exhausted")
MSG_DEF(JSMSG_TOO_DEEP,                25, 1, JSEXN_INTERNALERR, "{0} nested too deeply")
MSG_DEF(JSMSG_OVER_RECURSED,           26, 0, JSEXN_INTERNALERR, "too much recursion")
MSG_DEF(JSMSG_IN_NOT_OBJECT,           27, 1, JSEXN_TYPEERR, "invalid 'in' operand {0}")
MSG_DEF(JSMSG_BAD_NEW_RESULT,          28, 1, JSEXN_TYPEERR, "invalid new expression result {0}")
MSG_DEF(JSMSG_BAD_SHARP_DEF,           29, 1, JSEXN_ERR, "invalid sharp variable definition #{0}=")
MSG_DEF(JSMSG_BAD_SHARP_USE,           30, 1, JSEXN_ERR, "invalid sharp variable use #{0}#")
MSG_DEF(JSMSG_BAD_INSTANCEOF_RHS,      31, 1, JSEXN_TYPEERR, "invalid 'instanceof' operand {0}")
MSG_DEF(JSMSG_BAD_BYTECODE,            32, 1, JSEXN_INTERNALERR, "unimplemented JavaScript bytecode {0}")
MSG_DEF(JSMSG_BAD_RADIX,               33, 1, JSEXN_ERR, "illegal radix {0}")
MSG_DEF(JSMSG_PAREN_BEFORE_LET,        34, 0, JSEXN_SYNTAXERR, "missing ( before let head")
MSG_DEF(JSMSG_CANT_CONVERT,            35, 1, JSEXN_ERR, "can't convert {0} to an integer")
MSG_DEF(JSMSG_CYCLIC_VALUE,            36, 1, JSEXN_ERR, "cyclic {0} value")
MSG_DEF(JSMSG_COMPILE_EXECED_SCRIPT,   37, 0, JSEXN_TYPEERR, "cannot compile over a script that is currently executing")
MSG_DEF(JSMSG_CANT_CONVERT_TO,         38, 2, JSEXN_TYPEERR, "can't convert {0} to {1}")
MSG_DEF(JSMSG_NO_PROPERTIES,           39, 1, JSEXN_TYPEERR, "{0} has no properties")
MSG_DEF(JSMSG_CANT_FIND_CLASS,         40, 1, JSEXN_TYPEERR, "can't find class id {0}")
MSG_DEF(JSMSG_CANT_XDR_CLASS,          41, 1, JSEXN_TYPEERR, "can't XDR class {0}")
MSG_DEF(JSMSG_BYTECODE_TOO_BIG,        42, 2, JSEXN_INTERNALERR, "bytecode {0} too large (limit {1})")
MSG_DEF(JSMSG_UNKNOWN_FORMAT,          43, 1, JSEXN_INTERNALERR, "unknown bytecode format {0}")
MSG_DEF(JSMSG_TOO_MANY_CON_ARGS,       44, 0, JSEXN_SYNTAXERR, "too many constructor arguments")
MSG_DEF(JSMSG_TOO_MANY_FUN_ARGS,       45, 0, JSEXN_SYNTAXERR, "too many function arguments")
MSG_DEF(JSMSG_BAD_QUANTIFIER,          46, 1, JSEXN_SYNTAXERR, "invalid quantifier {0}")
MSG_DEF(JSMSG_MIN_TOO_BIG,             47, 1, JSEXN_SYNTAXERR, "overlarge minimum {0}")
MSG_DEF(JSMSG_MAX_TOO_BIG,             48, 1, JSEXN_SYNTAXERR, "overlarge maximum {0}")
MSG_DEF(JSMSG_OUT_OF_ORDER,            49, 1, JSEXN_SYNTAXERR, "maximum {0} less than minimum")
MSG_DEF(JSMSG_BAD_DESTRUCT_DECL,       50, 0, JSEXN_SYNTAXERR, "missing = in destructuring declaration")
MSG_DEF(JSMSG_BAD_DESTRUCT_ASS,        51, 0, JSEXN_SYNTAXERR, "invalid destructuring assignment operator")
MSG_DEF(JSMSG_PAREN_AFTER_LET,         52, 0, JSEXN_SYNTAXERR, "missing ) after let head")
MSG_DEF(JSMSG_CURLY_AFTER_LET,         53, 0, JSEXN_SYNTAXERR, "missing } after let block")
MSG_DEF(JSMSG_MISSING_PAREN,           54, 0, JSEXN_SYNTAXERR, "unterminated parenthetical")
MSG_DEF(JSMSG_UNTERM_CLASS,            55, 1, JSEXN_SYNTAXERR, "unterminated character class {0}")
MSG_DEF(JSMSG_TRAILING_SLASH,          56, 0, JSEXN_SYNTAXERR, "trailing \\ in regular expression")
MSG_DEF(JSMSG_BAD_CLASS_RANGE,         57, 0, JSEXN_SYNTAXERR, "invalid range in character class")
MSG_DEF(JSMSG_BAD_FLAG,                58, 1, JSEXN_SYNTAXERR, "invalid regular expression flag {0}")
MSG_DEF(JSMSG_NO_INPUT,                59, 5, JSEXN_SYNTAXERR, "no input for /{0}/{1}{2}{3}{4}")
MSG_DEF(JSMSG_CANT_OPEN,               60, 2, JSEXN_ERR, "can't open {0}: {1}")
MSG_DEF(JSMSG_BAD_STRING_MASK,         61, 1, JSEXN_ERR, "invalid string escape mask {0}")
MSG_DEF(JSMSG_UNMATCHED_RIGHT_PAREN,   62, 0, JSEXN_SYNTAXERR, "unmatched ) in regular expression")
MSG_DEF(JSMSG_END_OF_DATA,             63, 0, JSEXN_INTERNALERR, "unexpected end of data")
MSG_DEF(JSMSG_SEEK_BEYOND_START,       64, 0, JSEXN_INTERNALERR, "illegal seek beyond start")
MSG_DEF(JSMSG_SEEK_BEYOND_END,         65, 0, JSEXN_INTERNALERR, "illegal seek beyond end")
MSG_DEF(JSMSG_END_SEEK,                66, 0, JSEXN_INTERNALERR, "illegal end-based seek")
MSG_DEF(JSMSG_WHITHER_WHENCE,          67, 1, JSEXN_INTERNALERR, "unknown seek whence: {0}")
MSG_DEF(JSMSG_BAD_SCRIPT_MAGIC,        68, 0, JSEXN_INTERNALERR, "bad script XDR magic number")
MSG_DEF(JSMSG_PAREN_BEFORE_FORMAL,     69, 0, JSEXN_SYNTAXERR, "missing ( before formal parameters")
MSG_DEF(JSMSG_MISSING_FORMAL,          70, 0, JSEXN_SYNTAXERR, "missing formal parameter")
MSG_DEF(JSMSG_PAREN_AFTER_FORMAL,      71, 0, JSEXN_SYNTAXERR, "missing ) after formal parameters")
MSG_DEF(JSMSG_CURLY_BEFORE_BODY,       72, 0, JSEXN_SYNTAXERR, "missing { before function body")
MSG_DEF(JSMSG_CURLY_AFTER_BODY,        73, 0, JSEXN_SYNTAXERR, "missing } after function body")
MSG_DEF(JSMSG_PAREN_BEFORE_COND,       74, 0, JSEXN_SYNTAXERR, "missing ( before condition")
MSG_DEF(JSMSG_PAREN_AFTER_COND,        75, 0, JSEXN_SYNTAXERR, "missing ) after condition")
MSG_DEF(JSMSG_UNUSED76,                76, 0, JSEXN_NONE, "unused76")
MSG_DEF(JSMSG_NAME_AFTER_DOT,          77, 0, JSEXN_SYNTAXERR, "missing name after . operator")
MSG_DEF(JSMSG_BRACKET_IN_INDEX,        78, 0, JSEXN_SYNTAXERR, "missing ] in index expression")
MSG_DEF(JSMSG_UNUSED79,                79, 0, JSEXN_NONE, "unused79")
MSG_DEF(JSMSG_PAREN_BEFORE_SWITCH,     80, 0, JSEXN_SYNTAXERR, "missing ( before switch expression")
MSG_DEF(JSMSG_PAREN_AFTER_SWITCH,      81, 0, JSEXN_SYNTAXERR, "missing ) after switch expression")
MSG_DEF(JSMSG_CURLY_BEFORE_SWITCH,     82, 0, JSEXN_SYNTAXERR, "missing { before switch body")
MSG_DEF(JSMSG_COLON_AFTER_CASE,        83, 0, JSEXN_SYNTAXERR, "missing : after case label")
MSG_DEF(JSMSG_WHILE_AFTER_DO,          84, 0, JSEXN_SYNTAXERR, "missing while after do-loop body")
MSG_DEF(JSMSG_PAREN_AFTER_FOR,         85, 0, JSEXN_SYNTAXERR, "missing ( after for")
MSG_DEF(JSMSG_SEMI_AFTER_FOR_INIT,     86, 0, JSEXN_SYNTAXERR, "missing ; after for-loop initializer")
MSG_DEF(JSMSG_SEMI_AFTER_FOR_COND,     87, 0, JSEXN_SYNTAXERR, "missing ; after for-loop condition")
MSG_DEF(JSMSG_PAREN_AFTER_FOR_CTRL,    88, 0, JSEXN_SYNTAXERR, "missing ) after for-loop control")
MSG_DEF(JSMSG_CURLY_BEFORE_TRY,        89, 0, JSEXN_SYNTAXERR, "missing { before try block")
MSG_DEF(JSMSG_CURLY_AFTER_TRY,         90, 0, JSEXN_SYNTAXERR, "missing } after try block")
MSG_DEF(JSMSG_PAREN_BEFORE_CATCH,      91, 0, JSEXN_SYNTAXERR, "missing ( before catch")
MSG_DEF(JSMSG_CATCH_IDENTIFIER,        92, 0, JSEXN_SYNTAXERR, "missing identifier in catch")
MSG_DEF(JSMSG_PAREN_AFTER_CATCH,       93, 0, JSEXN_SYNTAXERR, "missing ) after catch")
MSG_DEF(JSMSG_CURLY_BEFORE_CATCH,      94, 0, JSEXN_SYNTAXERR, "missing { before catch block")
MSG_DEF(JSMSG_CURLY_AFTER_CATCH,       95, 0, JSEXN_SYNTAXERR, "missing } after catch block")
MSG_DEF(JSMSG_CURLY_BEFORE_FINALLY,    96, 0, JSEXN_SYNTAXERR, "missing { before finally block")
MSG_DEF(JSMSG_CURLY_AFTER_FINALLY,     97, 0, JSEXN_SYNTAXERR, "missing } after finally block")
MSG_DEF(JSMSG_CATCH_OR_FINALLY,        98, 0, JSEXN_SYNTAXERR, "missing catch or finally after try")
MSG_DEF(JSMSG_PAREN_BEFORE_WITH,       99, 0, JSEXN_SYNTAXERR, "missing ( before with-statement object")
MSG_DEF(JSMSG_PAREN_AFTER_WITH,       100, 0, JSEXN_SYNTAXERR, "missing ) after with-statement object")
MSG_DEF(JSMSG_CURLY_IN_COMPOUND,      101, 0, JSEXN_SYNTAXERR, "missing } in compound statement")
MSG_DEF(JSMSG_NO_VARIABLE_NAME,       102, 0, JSEXN_SYNTAXERR, "missing variable name")
MSG_DEF(JSMSG_COLON_IN_COND,          103, 0, JSEXN_SYNTAXERR, "missing : in conditional expression")
MSG_DEF(JSMSG_PAREN_AFTER_ARGS,       104, 0, JSEXN_SYNTAXERR, "missing ) after argument list")
MSG_DEF(JSMSG_BRACKET_AFTER_LIST,     105, 0, JSEXN_SYNTAXERR, "missing ] after element list")
MSG_DEF(JSMSG_COLON_AFTER_ID,         106, 0, JSEXN_SYNTAXERR, "missing : after property id")
MSG_DEF(JSMSG_CURLY_AFTER_LIST,       107, 0, JSEXN_SYNTAXERR, "missing } after property list")
MSG_DEF(JSMSG_PAREN_IN_PAREN,         108, 0, JSEXN_SYNTAXERR, "missing ) in parenthetical")
MSG_DEF(JSMSG_SEMI_BEFORE_STMNT,      109, 0, JSEXN_SYNTAXERR, "missing ; before statement")
MSG_DEF(JSMSG_NO_RETURN_VALUE,        110, 1, JSEXN_TYPEERR, "function {0} does not always return a value")
MSG_DEF(JSMSG_DUPLICATE_FORMAL,       111, 1, JSEXN_TYPEERR, "duplicate formal argument {0}")
MSG_DEF(JSMSG_EQUAL_AS_ASSIGN,        112, 1, JSEXN_SYNTAXERR, "test for equality (==) mistyped as assignment (=)?{0}")
MSG_DEF(JSMSG_UNUSED113,              113, 0, JSEXN_NONE, "unused113")
MSG_DEF(JSMSG_TOO_MANY_DEFAULTS,      114, 0, JSEXN_SYNTAXERR, "more than one switch default")
MSG_DEF(JSMSG_TOO_MANY_CASES,         115, 0, JSEXN_INTERNALERR, "too many switch cases")
MSG_DEF(JSMSG_BAD_SWITCH,             116, 0, JSEXN_SYNTAXERR, "invalid switch statement")
MSG_DEF(JSMSG_BAD_FOR_LEFTSIDE,       117, 0, JSEXN_SYNTAXERR, "invalid for/in left-hand side")
MSG_DEF(JSMSG_CATCH_AFTER_GENERAL,    118, 0, JSEXN_SYNTAXERR, "catch after unconditional catch")
MSG_DEF(JSMSG_CATCH_WITHOUT_TRY,      119, 0, JSEXN_SYNTAXERR, "catch without try")
MSG_DEF(JSMSG_FINALLY_WITHOUT_TRY,    120, 0, JSEXN_SYNTAXERR, "finally without try")
MSG_DEF(JSMSG_LABEL_NOT_FOUND,        121, 0, JSEXN_SYNTAXERR, "label not found")
MSG_DEF(JSMSG_TOUGH_BREAK,            122, 0, JSEXN_SYNTAXERR, "unlabeled break must be inside loop or switch")
MSG_DEF(JSMSG_BAD_CONTINUE,           123, 0, JSEXN_SYNTAXERR, "continue must be inside loop")
MSG_DEF(JSMSG_BAD_RETURN_OR_YIELD,    124, 1, JSEXN_SYNTAXERR, "{0} not in function")
MSG_DEF(JSMSG_BAD_LABEL,              125, 0, JSEXN_SYNTAXERR, "invalid label")
MSG_DEF(JSMSG_DUPLICATE_LABEL,        126, 0, JSEXN_SYNTAXERR, "duplicate label")
MSG_DEF(JSMSG_VAR_HIDES_ARG,          127, 1, JSEXN_TYPEERR, "variable {0} redeclares argument")
MSG_DEF(JSMSG_BAD_VAR_INIT,           128, 0, JSEXN_SYNTAXERR, "invalid variable initialization")
MSG_DEF(JSMSG_BAD_LEFTSIDE_OF_ASS,    129, 0, JSEXN_SYNTAXERR, "invalid assignment left-hand side")
MSG_DEF(JSMSG_BAD_OPERAND,            130, 1, JSEXN_SYNTAXERR, "invalid {0} operand")
MSG_DEF(JSMSG_BAD_PROP_ID,            131, 0, JSEXN_SYNTAXERR, "invalid property id")
MSG_DEF(JSMSG_RESERVED_ID,            132, 1, JSEXN_SYNTAXERR, "{0} is a reserved identifier")
MSG_DEF(JSMSG_SYNTAX_ERROR,           133, 0, JSEXN_SYNTAXERR, "syntax error")
MSG_DEF(JSMSG_BAD_SHARP_VAR_DEF,      134, 0, JSEXN_SYNTAXERR, "invalid sharp variable definition")
MSG_DEF(JSMSG_BAD_PROTOTYPE,          135, 1, JSEXN_TYPEERR,   "'prototype' property of {0} is not an object")
MSG_DEF(JSMSG_MISSING_EXPONENT,       136, 0, JSEXN_SYNTAXERR, "missing exponent")
MSG_DEF(JSMSG_OUT_OF_MEMORY,          137, 0, JSEXN_ERR, "out of memory")
MSG_DEF(JSMSG_UNTERMINATED_STRING,    138, 0, JSEXN_SYNTAXERR, "unterminated string literal")
MSG_DEF(JSMSG_TOO_MANY_PARENS,        139, 0, JSEXN_INTERNALERR, "too many parentheses in regular expression")
MSG_DEF(JSMSG_UNTERMINATED_COMMENT,   140, 0, JSEXN_SYNTAXERR, "unterminated comment")
MSG_DEF(JSMSG_UNTERMINATED_REGEXP,    141, 0, JSEXN_SYNTAXERR, "unterminated regular expression literal")
MSG_DEF(JSMSG_BAD_REGEXP_FLAG,        142, 0, JSEXN_SYNTAXERR, "invalid flag after regular expression")
MSG_DEF(JSMSG_SHARPVAR_TOO_BIG,       143, 0, JSEXN_SYNTAXERR, "overlarge sharp variable number")
MSG_DEF(JSMSG_ILLEGAL_CHARACTER,      144, 0, JSEXN_SYNTAXERR, "illegal character")
MSG_DEF(JSMSG_BAD_OCTAL,              145, 1, JSEXN_SYNTAXERR, "{0} is not a legal ECMA-262 octal constant")
MSG_DEF(JSMSG_BAD_INDIRECT_CALL,      146, 1, JSEXN_EVALERR, "function {0} must be called directly, and not by way of a function of another name")
MSG_DEF(JSMSG_UNCAUGHT_EXCEPTION,     147, 1, JSEXN_INTERNALERR, "uncaught exception: {0}")
MSG_DEF(JSMSG_INVALID_BACKREF,        148, 0, JSEXN_SYNTAXERR, "non-octal digit in an escape sequence that doesn't match a back-reference")
MSG_DEF(JSMSG_BAD_BACKREF,            149, 0, JSEXN_SYNTAXERR, "back-reference exceeds number of capturing parentheses")
MSG_DEF(JSMSG_PRECISION_RANGE,        150, 1, JSEXN_RANGEERR, "precision {0} out of range")
MSG_DEF(JSMSG_BAD_GETTER_OR_SETTER,   151, 1, JSEXN_SYNTAXERR, "invalid {0} usage")
MSG_DEF(JSMSG_BAD_ARRAY_LENGTH,       152, 0, JSEXN_RANGEERR, "invalid array length")
MSG_DEF(JSMSG_CANT_DESCRIBE_PROPS,    153, 1, JSEXN_TYPEERR, "can't describe non-native properties of class {0}")
MSG_DEF(JSMSG_BAD_APPLY_ARGS,         154, 1, JSEXN_TYPEERR, "second argument to Function.prototype.{0} must be an array")
MSG_DEF(JSMSG_REDECLARED_VAR,         155, 2, JSEXN_TYPEERR, "redeclaration of {0} {1}")
MSG_DEF(JSMSG_UNDECLARED_VAR,         156, 1, JSEXN_TYPEERR, "assignment to undeclared variable {0}")
MSG_DEF(JSMSG_ANON_NO_RETURN_VALUE,   157, 0, JSEXN_TYPEERR, "anonymous function does not always return a value")
MSG_DEF(JSMSG_DEPRECATED_USAGE,       158, 1, JSEXN_REFERENCEERR, "deprecated {0} usage")
MSG_DEF(JSMSG_BAD_URI,                159, 0, JSEXN_URIERR, "malformed URI sequence")
MSG_DEF(JSMSG_GETTER_ONLY,            160, 0, JSEXN_TYPEERR, "setting a property that has only a getter")
MSG_DEF(JSMSG_TRAILING_COMMA,         161, 0, JSEXN_SYNTAXERR, "trailing comma is not legal in ECMA-262 object initializers")
MSG_DEF(JSMSG_UNDEFINED_PROP,         162, 1, JSEXN_REFERENCEERR, "reference to undefined property {0}")
MSG_DEF(JSMSG_USELESS_EXPR,           163, 0, JSEXN_TYPEERR, "useless expression")
MSG_DEF(JSMSG_REDECLARED_PARAM,       164, 1, JSEXN_TYPEERR, "redeclaration of formal parameter {0}")
MSG_DEF(JSMSG_NEWREGEXP_FLAGGED,      165, 0, JSEXN_TYPEERR, "can't supply flags when constructing one RegExp from another")
MSG_DEF(JSMSG_RESERVED_SLOT_RANGE,    166, 0, JSEXN_RANGEERR, "reserved slot index out of range")
MSG_DEF(JSMSG_CANT_DECODE_PRINCIPALS, 167, 0, JSEXN_INTERNALERR, "can't decode JSPrincipals")
MSG_DEF(JSMSG_CANT_SEAL_OBJECT,       168, 1, JSEXN_ERR, "can't seal {0} objects")
MSG_DEF(JSMSG_TOO_MANY_CATCH_VARS,    169, 0, JSEXN_SYNTAXERR, "too many catch variables")
MSG_DEF(JSMSG_BAD_XML_MARKUP,         170, 0, JSEXN_SYNTAXERR, "invalid XML markup")
MSG_DEF(JSMSG_BAD_XML_CHARACTER,      171, 0, JSEXN_SYNTAXERR, "illegal XML character")
MSG_DEF(JSMSG_BAD_DEFAULT_XML_NAMESPACE,172,0,JSEXN_SYNTAXERR, "invalid default XML namespace")
MSG_DEF(JSMSG_BAD_XML_NAME_SYNTAX,    173, 0, JSEXN_SYNTAXERR, "invalid XML name")
MSG_DEF(JSMSG_BRACKET_AFTER_ATTR_EXPR,174, 0, JSEXN_SYNTAXERR, "missing ] after attribute expression")
MSG_DEF(JSMSG_NESTING_GENERATOR,      175, 1, JSEXN_TYPEERR, "already executing generator {0}")
MSG_DEF(JSMSG_CURLY_IN_XML_EXPR,      176, 0, JSEXN_SYNTAXERR, "missing } in XML expression")
MSG_DEF(JSMSG_BAD_XML_NAMESPACE,      177, 1, JSEXN_TYPEERR, "invalid XML namespace {0}")
MSG_DEF(JSMSG_BAD_XML_ATTR_NAME,      178, 1, JSEXN_TYPEERR, "invalid XML attribute name {0}")
MSG_DEF(JSMSG_BAD_XML_NAME,           179, 1, JSEXN_TYPEERR, "invalid XML name {0}")
MSG_DEF(JSMSG_BAD_XML_CONVERSION,     180, 1, JSEXN_TYPEERR, "can't convert {0} to XML")
MSG_DEF(JSMSG_BAD_XMLLIST_CONVERSION, 181, 1, JSEXN_TYPEERR, "can't convert {0} to XMLList")
MSG_DEF(JSMSG_BAD_GENERATOR_SEND,     182, 1, JSEXN_TYPEERR, "attempt to send {0} to newborn generator")
MSG_DEF(JSMSG_NO_ASSIGN_IN_XML_ATTR,  183, 0, JSEXN_SYNTAXERR, "missing = in XML attribute")
MSG_DEF(JSMSG_BAD_XML_ATTR_VALUE,     184, 0, JSEXN_SYNTAXERR, "invalid XML attribute value")
MSG_DEF(JSMSG_XML_TAG_NAME_MISMATCH,  185, 1, JSEXN_SYNTAXERR, "XML tag name mismatch (expected {0})")
MSG_DEF(JSMSG_BAD_XML_TAG_SYNTAX,     186, 0, JSEXN_SYNTAXERR, "invalid XML tag syntax")
MSG_DEF(JSMSG_BAD_XML_LIST_SYNTAX,    187, 0, JSEXN_SYNTAXERR, "invalid XML list syntax")
MSG_DEF(JSMSG_INCOMPATIBLE_METHOD,    188, 3, JSEXN_TYPEERR, "{0} {1} called on incompatible {2}")
MSG_DEF(JSMSG_CANT_SET_XML_ATTRS,     189, 0, JSEXN_INTERNALERR, "can't set XML property attributes")
MSG_DEF(JSMSG_END_OF_XML_SOURCE,      190, 0, JSEXN_SYNTAXERR, "unexpected end of XML source")
MSG_DEF(JSMSG_END_OF_XML_ENTITY,      191, 0, JSEXN_SYNTAXERR, "unexpected end of XML entity")
MSG_DEF(JSMSG_BAD_XML_QNAME,          192, 0, JSEXN_SYNTAXERR, "invalid XML qualified name")
MSG_DEF(JSMSG_BAD_FOR_EACH_LOOP,      193, 0, JSEXN_SYNTAXERR, "invalid for each loop")
MSG_DEF(JSMSG_BAD_XMLLIST_PUT,        194, 1, JSEXN_TYPEERR, "can't set property {0} in XMLList")
MSG_DEF(JSMSG_UNKNOWN_XML_ENTITY,     195, 1, JSEXN_TYPEERR, "unknown XML entity {0}")
MSG_DEF(JSMSG_BAD_XML_NCR,            196, 1, JSEXN_TYPEERR, "malformed XML character {0}")
MSG_DEF(JSMSG_UNDEFINED_XML_NAME,     197, 1, JSEXN_REFERENCEERR, "reference to undefined XML name {0}")
MSG_DEF(JSMSG_DUPLICATE_XML_ATTR,     198, 1, JSEXN_TYPEERR, "duplicate XML attribute {0}")
MSG_DEF(JSMSG_TOO_MANY_LOCALS,        199, 0, JSEXN_SYNTAXERR, "too many local variables")
MSG_DEF(JSMSG_ARRAY_INIT_TOO_BIG,     200, 0, JSEXN_INTERNALERR, "array initialiser too large")
MSG_DEF(JSMSG_REGEXP_TOO_COMPLEX,     201, 0, JSEXN_INTERNALERR, "regular expression too complex")
MSG_DEF(JSMSG_BUFFER_TOO_SMALL,       202, 0, JSEXN_INTERNALERR, "buffer too small")
MSG_DEF(JSMSG_BAD_SURROGATE_CHAR,     203, 1, JSEXN_TYPEERR, "bad surrogate character {0}")
MSG_DEF(JSMSG_UTF8_CHAR_TOO_LARGE,    204, 1, JSEXN_TYPEERR, "UTF-8 character {0} too large")
MSG_DEF(JSMSG_MALFORMED_UTF8_CHAR,    205, 1, JSEXN_TYPEERR, "malformed UTF-8 character sequence at offset {0}")
MSG_DEF(JSMSG_USER_DEFINED_ERROR,     206, 0, JSEXN_ERR, "JS_ReportError was called")
MSG_DEF(JSMSG_WRONG_CONSTRUCTOR,      207, 1, JSEXN_TYPEERR, "wrong constructor called for {0}")
MSG_DEF(JSMSG_BAD_GENERATOR_RETURN,   208, 1, JSEXN_TYPEERR, "generator function {0} returns a value")
MSG_DEF(JSMSG_BAD_ANON_GENERATOR_RETURN, 209, 0, JSEXN_TYPEERR, "anonymous generator function returns a value")
MSG_DEF(JSMSG_NAME_AFTER_FOR_PAREN,   210, 0, JSEXN_SYNTAXERR, "missing name after for (")
MSG_DEF(JSMSG_IN_AFTER_FOR_NAME,      211, 0, JSEXN_SYNTAXERR, "missing in after for")
MSG_DEF(JSMSG_BAD_ITERATOR_RETURN,    212, 2, JSEXN_TYPEERR, "{0}.{1} returned a primitive value")
MSG_DEF(JSMSG_KEYWORD_NOT_NS,         213, 0, JSEXN_SYNTAXERR, "keyword is used as namespace")
MSG_DEF(JSMSG_BAD_GENERATOR_YIELD,    214, 1, JSEXN_TYPEERR, "yield from closing generator {0}")
MSG_DEF(JSMSG_BAD_GENERATOR_SYNTAX,   215, 1, JSEXN_SYNTAXERR, "{0} expression must be parenthesized")
MSG_DEF(JSMSG_ARRAY_COMP_LEFTSIDE,    216, 0, JSEXN_SYNTAXERR, "invalid array comprehension left-hand side")
MSG_DEF(JSMSG_NON_XML_FILTER,         217, 1, JSEXN_TYPEERR, "XML filter is applied to non-XML value {0}")
MSG_DEF(JSMSG_EMPTY_ARRAY_REDUCE,     218, 0, JSEXN_TYPEERR, "reduce of empty array with no initial value")
MSG_DEF(JSMSG_NON_LIST_XML_METHOD,    219, 2, JSEXN_TYPEERR, "cannot call {0} method on an XML list with {1} elements")
MSG_DEF(JSMSG_BAD_DELETE_OPERAND,     220, 0, JSEXN_SYNTAXERR, "invalid delete operand")
MSG_DEF(JSMSG_BAD_INCOP_OPERAND,      221, 0, JSEXN_SYNTAXERR, "invalid increment/decrement operand")
MSG_DEF(JSMSG_NULL_OR_UNDEFINED,      222, 2, JSEXN_TYPEERR, "{0} is {1}")
MSG_DEF(JSMSG_LET_DECL_NOT_IN_BLOCK,  223, 0, JSEXN_SYNTAXERR, "let declaration not directly within block")
MSG_DEF(JSMSG_BAD_OBJECT_INIT,        224, 0, JSEXN_SYNTAXERR, "invalid object initializer")
MSG_DEF(JSMSG_CANT_SET_ARRAY_ATTRS,   225, 0, JSEXN_INTERNALERR, "can't set attributes on indexed array properties")
MSG_DEF(JSMSG_EVAL_ARITY,             226, 0, JSEXN_TYPEERR, "eval accepts only one parameter")
MSG_DEF(JSMSG_MISSING_FUN_ARG,        227, 2, JSEXN_TYPEERR, "missing argument {0} when calling function {1}")
