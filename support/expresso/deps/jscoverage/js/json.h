/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is SpiderMonkey JSON.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Sayre <sayrer@gmail.com>
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

#ifndef json_h___
#define json_h___
/*
 * JS JSON functions.
 */

#define JSON_MAX_DEPTH  2048
#define JSON_PARSER_BUFSIZE 1024

JS_BEGIN_EXTERN_C

extern JSClass js_JSONClass;

extern JSObject *
js_InitJSONClass(JSContext *cx, JSObject *obj);

extern JSBool
js_Stringify(JSContext *cx, jsval *vp, JSObject *replacer,
             JSONWriteCallback callback, void *data, uint32 depth);

extern JSBool js_TryJSON(JSContext *cx, jsval *vp);

enum JSONParserState {
    JSON_PARSE_STATE_INIT,
    JSON_PARSE_STATE_OBJECT_VALUE,
    JSON_PARSE_STATE_VALUE,
    JSON_PARSE_STATE_OBJECT,
    JSON_PARSE_STATE_OBJECT_PAIR,
    JSON_PARSE_STATE_OBJECT_IN_PAIR,
    JSON_PARSE_STATE_ARRAY,
    JSON_PARSE_STATE_STRING,
    JSON_PARSE_STATE_STRING_ESCAPE,
    JSON_PARSE_STATE_STRING_HEX,
    JSON_PARSE_STATE_NUMBER,
    JSON_PARSE_STATE_KEYWORD,
    JSON_PARSE_STATE_FINISHED
};

enum JSONDataType {
    JSON_DATA_STRING,
    JSON_DATA_KEYSTRING,
    JSON_DATA_NUMBER,
    JSON_DATA_KEYWORD
};

struct JSONParser {
    /* Used while handling \uNNNN in strings */
    jschar hexChar;
    uint8 numHex;

    JSONParserState *statep;
    JSONParserState stateStack[JSON_MAX_DEPTH];
    jsval *rootVal;
    JSStringBuffer *objectKey;
    JSStringBuffer *buffer;
    JSObject *objectStack;
};

extern JSONParser *
js_BeginJSONParse(JSContext *cx, jsval *rootVal);

extern JSBool
js_ConsumeJSONText(JSContext *cx, JSONParser *jp, const jschar *data, uint32 len);

extern JSBool
js_FinishJSONParse(JSContext *cx, JSONParser *jp);

JS_END_EXTERN_C

#endif /* json_h___ */
