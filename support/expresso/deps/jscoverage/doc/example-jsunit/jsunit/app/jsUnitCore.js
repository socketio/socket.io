var JSUNIT_UNDEFINED_VALUE;
var JSUNIT_VERSION = 2.2;
var isTestPageLoaded = false;

//hack for NS62 bug
function jsUnitFixTop() {
    var tempTop = top;
    if (!tempTop) {
        tempTop = window;
        while (tempTop.parent) {
            tempTop = tempTop.parent;
            if (tempTop.top && tempTop.top.jsUnitTestSuite) {
                tempTop = tempTop.top;
                break;
            }
        }
    }
    try {
        window.top = tempTop;
    } catch (e) {
    }
}

jsUnitFixTop();

/**
 + * A more functional typeof
 + * @param Object o
 + * @return String
 + */
function _trueTypeOf(something) {
    var result = typeof something;
    try {
        switch (result) {
            case 'string':
            case 'boolean':
            case 'number':
                break;
            case 'object':
            case 'function':
                switch (something.constructor)
                        {
                    case String:
                        result = 'String';
                        break;
                    case Boolean:
                        result = 'Boolean';
                        break;
                    case Number:
                        result = 'Number';
                        break;
                    case Array:
                        result = 'Array';
                        break;
                    case RegExp:
                        result = 'RegExp';
                        break;
                    case Function:
                        result = 'Function';
                        break;
                    default:
                        var m = something.constructor.toString().match(/function\s*([^( ]+)\(/);
                        if (m)
                            result = m[1];
                        else
                            break;
                }
                break;
        }
    }
    finally {
        result = result.substr(0, 1).toUpperCase() + result.substr(1);
        return result;
    }
}

function _displayStringForValue(aVar) {
    var result = '<' + aVar + '>';
    if (!(aVar === null || aVar === top.JSUNIT_UNDEFINED_VALUE)) {
        result += ' (' + _trueTypeOf(aVar) + ')';
    }
    return result;
}

function fail(failureMessage) {
    throw new JsUnitException("Call to fail()", failureMessage);
}

function error(errorMessage) {
    var errorObject = new Object();
    errorObject.description = errorMessage;
    errorObject.stackTrace = getStackTrace();
    throw errorObject;
}

function argumentsIncludeComments(expectedNumberOfNonCommentArgs, args) {
    return args.length == expectedNumberOfNonCommentArgs + 1;
}

function commentArg(expectedNumberOfNonCommentArgs, args) {
    if (argumentsIncludeComments(expectedNumberOfNonCommentArgs, args))
        return args[0];

    return null;
}

function nonCommentArg(desiredNonCommentArgIndex, expectedNumberOfNonCommentArgs, args) {
    return argumentsIncludeComments(expectedNumberOfNonCommentArgs, args) ?
           args[desiredNonCommentArgIndex] :
           args[desiredNonCommentArgIndex - 1];
}

function _validateArguments(expectedNumberOfNonCommentArgs, args) {
    if (!( args.length == expectedNumberOfNonCommentArgs ||
           (args.length == expectedNumberOfNonCommentArgs + 1 && typeof(args[0]) == 'string') ))
        error('Incorrect arguments passed to assert function');
}

function _assert(comment, booleanValue, failureMessage) {
    if (!booleanValue)
        throw new JsUnitException(comment, failureMessage);
}

function assert() {
    _validateArguments(1, arguments);
    var booleanValue = nonCommentArg(1, 1, arguments);

    if (typeof(booleanValue) != 'boolean')
        error('Bad argument to assert(boolean)');

    _assert(commentArg(1, arguments), booleanValue === true, 'Call to assert(boolean) with false');
}

function assertTrue() {
    _validateArguments(1, arguments);
    var booleanValue = nonCommentArg(1, 1, arguments);

    if (typeof(booleanValue) != 'boolean')
        error('Bad argument to assertTrue(boolean)');

    _assert(commentArg(1, arguments), booleanValue === true, 'Call to assertTrue(boolean) with false');
}

function assertFalse() {
    _validateArguments(1, arguments);
    var booleanValue = nonCommentArg(1, 1, arguments);

    if (typeof(booleanValue) != 'boolean')
        error('Bad argument to assertFalse(boolean)');

    _assert(commentArg(1, arguments), booleanValue === false, 'Call to assertFalse(boolean) with true');
}

function assertEquals() {
    _validateArguments(2, arguments);
    var var1 = nonCommentArg(1, 2, arguments);
    var var2 = nonCommentArg(2, 2, arguments);
    _assert(commentArg(2, arguments), var1 === var2, 'Expected ' + _displayStringForValue(var1) + ' but was ' + _displayStringForValue(var2));
}

function assertNotEquals() {
    _validateArguments(2, arguments);
    var var1 = nonCommentArg(1, 2, arguments);
    var var2 = nonCommentArg(2, 2, arguments);
    _assert(commentArg(2, arguments), var1 !== var2, 'Expected not to be ' + _displayStringForValue(var2));
}

function assertNull() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), aVar === null, 'Expected ' + _displayStringForValue(null) + ' but was ' + _displayStringForValue(aVar));
}

function assertNotNull() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), aVar !== null, 'Expected not to be ' + _displayStringForValue(null));
}

function assertUndefined() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), aVar === top.JSUNIT_UNDEFINED_VALUE, 'Expected ' + _displayStringForValue(top.JSUNIT_UNDEFINED_VALUE) + ' but was ' + _displayStringForValue(aVar));
}

function assertNotUndefined() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), aVar !== top.JSUNIT_UNDEFINED_VALUE, 'Expected not to be ' + _displayStringForValue(top.JSUNIT_UNDEFINED_VALUE));
}

function assertNaN() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), isNaN(aVar), 'Expected NaN');
}

function assertNotNaN() {
    _validateArguments(1, arguments);
    var aVar = nonCommentArg(1, 1, arguments);
    _assert(commentArg(1, arguments), !isNaN(aVar), 'Expected not NaN');
}

function assertObjectEquals() {
    _validateArguments(2, arguments);
    var var1 = nonCommentArg(1, 2, arguments);
    var var2 = nonCommentArg(2, 2, arguments);
    var type;
    var msg = commentArg(2, arguments)?commentArg(2, arguments):'';
    var isSame = (var1 === var2);
    //shortpath for references to same object
    var isEqual = ( (type = _trueTypeOf(var1)) == _trueTypeOf(var2) );
    if (isEqual && !isSame) {
        switch (type) {
            case 'String':
            case 'Number':
                isEqual = (var1 == var2);
                break;
            case 'Boolean':
            case 'Date':
                isEqual = (var1 === var2);
                break;
            case 'RegExp':
            case 'Function':
                isEqual = (var1.toString() === var2.toString());
                break;
            default: //Object | Array
                var i;
                if (isEqual = (var1.length === var2.length))
                    for (i in var1)
                        assertObjectEquals(msg + ' found nested ' + type + '@' + i + '\n', var1[i], var2[i]);
        }
        _assert(msg, isEqual, 'Expected ' + _displayStringForValue(var1) + ' but was ' + _displayStringForValue(var2));
    }
}

assertArrayEquals = assertObjectEquals;

function assertEvaluatesToTrue() {
    _validateArguments(1, arguments);
    var value = nonCommentArg(1, 1, arguments);
    if (!value)
        fail(commentArg(1, arguments));
}

function assertEvaluatesToFalse() {
    _validateArguments(1, arguments);
    var value = nonCommentArg(1, 1, arguments);
    if (value)
        fail(commentArg(1, arguments));
}

function assertHTMLEquals() {
    _validateArguments(2, arguments);
    var var1 = nonCommentArg(1, 2, arguments);
    var var2 = nonCommentArg(2, 2, arguments);
    var var1Standardized = standardizeHTML(var1);
    var var2Standardized = standardizeHTML(var2);

    _assert(commentArg(2, arguments), var1Standardized === var2Standardized, 'Expected ' + _displayStringForValue(var1Standardized) + ' but was ' + _displayStringForValue(var2Standardized));
}

function assertHashEquals() {
    _validateArguments(2, arguments);
    var var1 = nonCommentArg(1, 2, arguments);
    var var2 = nonCommentArg(2, 2, arguments);
    for (var key in var1) {
        assertNotUndefined("Expected hash had key " + key + " that was not found", var2[key]);
        assertEquals(
                "Value for key " + key + " mismatch - expected = " + var1[key] + ", actual = " + var2[key],
                var1[key], var2[key]
                );
    }
    for (var key in var2) {
        assertNotUndefined("Actual hash had key " + key + " that was not expected", var1[key]);
    }
}

function assertRoughlyEquals() {
    _validateArguments(3, arguments);
    var expected = nonCommentArg(1, 3, arguments);
    var actual = nonCommentArg(2, 3, arguments);
    var tolerance = nonCommentArg(3, 3, arguments);
    assertTrue(
            "Expected " + expected + ", but got " + actual + " which was more than " + tolerance + " away",
            Math.abs(expected - actual) < tolerance
            );
}

function assertContains() {
    _validateArguments(2, arguments);
    var contained = nonCommentArg(1, 2, arguments);
    var container = nonCommentArg(2, 2, arguments);
    assertTrue(
            "Expected '" + container + "' to contain '" + contained + "'",
            container.indexOf(contained) != -1
            );
}

function standardizeHTML(html) {
    var translator = document.createElement("DIV");
    translator.innerHTML = html;
    return translator.innerHTML;
}

function isLoaded() {
    return isTestPageLoaded;
}

function setUp() {
}

function tearDown() {
}

function getFunctionName(aFunction) {
    var regexpResult = aFunction.toString().match(/function(\s*)(\w*)/);
    if (regexpResult && regexpResult.length >= 2 && regexpResult[2]) {
        return regexpResult[2];
    }
    return 'anonymous';
}

function getStackTrace() {
    var result = '';

    if (typeof(arguments.caller) != 'undefined') { // IE, not ECMA
        for (var a = arguments.caller; a != null; a = a.caller) {
            result += '> ' + getFunctionName(a.callee) + '\n';
            if (a.caller == a) {
                result += '*';
                break;
            }
        }
    }
    else { // Mozilla, not ECMA
        // fake an exception so we can get Mozilla's error stack
        var testExcp;
        try
        {
            foo.bar;
        }
        catch(testExcp)
        {
            var stack = parseErrorStack(testExcp);
            for (var i = 1; i < stack.length; i++)
            {
                result += '> ' + stack[i] + '\n';
            }
        }
    }

    return result;
}

function parseErrorStack(excp)
{
    var stack = [];
    var name;

    if (!excp || !excp.stack)
    {
        return stack;
    }

    var stacklist = excp.stack.split('\n');

    for (var i = 0; i < stacklist.length - 1; i++)
    {
        var framedata = stacklist[i];

        name = framedata.match(/^(\w*)/)[1];
        if (!name) {
            name = 'anonymous';
        }

        stack[stack.length] = name;
    }
    // remove top level anonymous functions to match IE

    while (stack.length && stack[stack.length - 1] == 'anonymous')
    {
        stack.length = stack.length - 1;
    }
    return stack;
}

function JsUnitException(comment, message) {
    this.isJsUnitException = true;
    this.comment = comment;
    this.jsUnitMessage = message;
    this.stackTrace = getStackTrace();
}

function warn() {
    if (top.tracer != null)
        top.tracer.warn(arguments[0], arguments[1]);
}

function inform() {
    if (top.tracer != null)
        top.tracer.inform(arguments[0], arguments[1]);
}

function info() {
    inform(arguments[0], arguments[1]);
}

function debug() {
    if (top.tracer != null)
        top.tracer.debug(arguments[0], arguments[1]);
}

function setJsUnitTracer(aJsUnitTracer) {
    top.tracer = aJsUnitTracer;
}

function trim(str) {
    if (str == null)
        return null;

    var startingIndex = 0;
    var endingIndex = str.length - 1;

    while (str.substring(startingIndex, startingIndex + 1) == ' ')
        startingIndex++;

    while (str.substring(endingIndex, endingIndex + 1) == ' ')
        endingIndex--;

    if (endingIndex < startingIndex)
        return '';

    return str.substring(startingIndex, endingIndex + 1);
}

function isBlank(str) {
    return trim(str) == '';
}

// the functions push(anArray, anObject) and pop(anArray)
// exist because the JavaScript Array.push(anObject) and Array.pop()
// functions are not available in IE 5.0

function push(anArray, anObject) {
    anArray[anArray.length] = anObject;
}
function pop(anArray) {
    if (anArray.length >= 1) {
        delete anArray[anArray.length - 1];
        anArray.length--;
    }
}

function jsUnitGetParm(name)
{
    if (typeof(top.jsUnitParmHash[name]) != 'undefined')
    {
        return top.jsUnitParmHash[name];
    }
    return null;
}

if (top && typeof(top.xbDEBUG) != 'undefined' && top.xbDEBUG.on && top.testManager)
{
    top.xbDebugTraceObject('top.testManager.containerTestFrame', 'JSUnitException');
    // asserts
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', '_displayStringForValue');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'error');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'argumentsIncludeComments');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'commentArg');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'nonCommentArg');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', '_validateArguments');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', '_assert');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assert');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertTrue');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertEquals');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNotEquals');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNull');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNotNull');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertUndefined');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNotUndefined');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNaN');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'assertNotNaN');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'isLoaded');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'setUp');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'tearDown');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'getFunctionName');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'getStackTrace');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'warn');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'inform');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'debug');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'setJsUnitTracer');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'trim');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'isBlank');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'newOnLoadEvent');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'push');
    top.xbDebugTraceFunction('top.testManager.containerTestFrame', 'pop');
}

function newOnLoadEvent() {
    isTestPageLoaded = true;
}

function jsUnitSetOnLoad(windowRef, onloadHandler)
{
    var isKonqueror = navigator.userAgent.indexOf('Konqueror/') != -1 ||
                      navigator.userAgent.indexOf('Safari/') != -1;

    if (typeof(windowRef.attachEvent) != 'undefined') {
        // Internet Explorer, Opera
        windowRef.attachEvent("onload", onloadHandler);
    } else if (typeof(windowRef.addEventListener) != 'undefined' && !isKonqueror) {
        // Mozilla, Konqueror
        // exclude Konqueror due to load issues
        windowRef.addEventListener("load", onloadHandler, false);
    } else if (typeof(windowRef.document.addEventListener) != 'undefined' && !isKonqueror) {
        // DOM 2 Events
        // exclude Mozilla, Konqueror due to load issues
        windowRef.document.addEventListener("load", onloadHandler, false);
    } else if (typeof(windowRef.onload) != 'undefined' && windowRef.onload) {
        windowRef.jsunit_original_onload = windowRef.onload;
        windowRef.onload = function() {
            windowRef.jsunit_original_onload();
            onloadHandler();
        };
    } else {
        // browsers that do not support windowRef.attachEvent or
        // windowRef.addEventListener will override a page's own onload event
        windowRef.onload = onloadHandler;
    }
}

jsUnitSetOnLoad(window, newOnLoadEvent);