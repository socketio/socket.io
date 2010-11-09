var TRACE_LEVEL_NONE = new JsUnitTraceLevel(0, null);
var TRACE_LEVEL_WARNING = new JsUnitTraceLevel(1, "#FF0000");
var TRACE_LEVEL_INFO = new JsUnitTraceLevel(2, "#009966");
var TRACE_LEVEL_DEBUG = new JsUnitTraceLevel(3, "#0000FF");

function JsUnitTracer(testManager) {
    this._testManager = testManager;
    this._traceWindow = null;
    this.popupWindowsBlocked = false;
}

JsUnitTracer.prototype.initialize = function() {
    if (this._traceWindow != null && top.testManager.closeTraceWindowOnNewRun.checked)
        this._traceWindow.close();
    this._traceWindow = null;
}

JsUnitTracer.prototype.finalize = function() {
    if (this._traceWindow != null) {
        this._traceWindow.document.write('<\/body>\n<\/html>');
        this._traceWindow.document.close();
    }
}

JsUnitTracer.prototype.warn = function() {
    this._trace(arguments[0], arguments[1], TRACE_LEVEL_WARNING);
}

JsUnitTracer.prototype.inform = function() {
    this._trace(arguments[0], arguments[1], TRACE_LEVEL_INFO);
}

JsUnitTracer.prototype.debug = function() {
    this._trace(arguments[0], arguments[1], TRACE_LEVEL_DEBUG);
}

JsUnitTracer.prototype._trace = function(message, value, traceLevel) {
    if (!top.shouldSubmitResults() && this._getChosenTraceLevel().matches(traceLevel)) {
        var traceString = message;
        if (value)
            traceString += ': ' + value;
        var prefix = this._testManager.getTestFileName() + ":" +
                     this._testManager.getTestFunctionName() + " - ";
        this._writeToTraceWindow(prefix, traceString, traceLevel);
    }
}

JsUnitTracer.prototype._getChosenTraceLevel = function() {
    var levelNumber = eval(top.testManager.traceLevel.value);
    return traceLevelByLevelNumber(levelNumber);
}

JsUnitTracer.prototype._writeToTraceWindow = function(prefix, traceString, traceLevel) {
    var htmlToAppend = '<p class="jsUnitDefault">' + prefix + '<font color="' + traceLevel.getColor() + '">' + traceString + '</font><\/p>\n';
    this._getTraceWindow().document.write(htmlToAppend);
}

JsUnitTracer.prototype._getTraceWindow = function() {
    if (this._traceWindow == null && !top.shouldSubmitResults() && !this.popupWindowsBlocked) {
        this._traceWindow = window.open('', '', 'width=600, height=350,status=no,resizable=yes,scrollbars=yes');
        if (!this._traceWindow)
            this.popupWindowsBlocked = true;
        else {
            var resDoc = this._traceWindow.document;
            resDoc.write('<html>\n<head>\n<link rel="stylesheet" href="css/jsUnitStyle.css">\n<title>Tracing - JsUnit<\/title>\n<head>\n<body>');
            resDoc.write('<h2>Tracing - JsUnit<\/h2>\n');
            resDoc.write('<p class="jsUnitDefault"><i>(Traces are color coded: ');
            resDoc.write('<font color="' + TRACE_LEVEL_WARNING.getColor() + '">Warning</font> - ');
            resDoc.write('<font color="' + TRACE_LEVEL_INFO.getColor() + '">Information</font> - ');
            resDoc.write('<font color="' + TRACE_LEVEL_DEBUG.getColor() + '">Debug</font>');
            resDoc.write(')</i></p>');
        }
    }
    return this._traceWindow;
}

if (xbDEBUG.on) {
    xbDebugTraceObject('window', 'JsUnitTracer');
}

function JsUnitTraceLevel(levelNumber, color) {
    this._levelNumber = levelNumber;
    this._color = color;
}

JsUnitTraceLevel.prototype.matches = function(anotherTraceLevel) {
    return this._levelNumber >= anotherTraceLevel._levelNumber;
}

JsUnitTraceLevel.prototype.getColor = function() {
    return this._color;
}

function traceLevelByLevelNumber(levelNumber) {
    switch (levelNumber) {
        case 0: return TRACE_LEVEL_NONE;
        case 1: return TRACE_LEVEL_WARNING;
        case 2: return TRACE_LEVEL_INFO;
        case 3: return TRACE_LEVEL_DEBUG;
    }
    return null;
}