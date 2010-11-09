// xbDebug.js revision: 0.003 2002-02-26

/* ***** BEGIN LICENSE BLOCK *****
 * Licensed under Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * Full Terms at /xbProjects-srce/license/mpl-tri-license.txt
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Netscape code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Bob Clary <bclary@netscape.com>
 *
 * ***** END LICENSE BLOCK ***** */

/*
ChangeLog:

2002-02-25: bclary - modified xbDebugTraceOject to make sure 
            that original versions of wrapped functions were not
            rewrapped. This had caused an infinite loop in IE.

2002-02-07: bclary - modified xbDebug.prototype.close to not null
            the debug window reference. This can cause problems with
	          Internet Explorer if the page is refreshed. These issues will
	          be addressed at a later date.
*/

function xbDebug()
{
    this.on = false;
    this.stack = new Array();
    this.debugwindow = null;
    this.execprofile = new Object();
}

xbDebug.prototype.push = function ()
{
    this.stack[this.stack.length] = this.on;
    this.on = true;
}

xbDebug.prototype.pop = function ()
{
    this.on = this.stack[this.stack.length - 1];
    --this.stack.length;
}

xbDebug.prototype.open = function ()
{
    if (this.debugwindow && !this.debugwindow.closed)
        this.close();

    this.debugwindow = window.open('about:blank', 'DEBUGWINDOW', 'height=400,width=600,resizable=yes,scrollbars=yes');

    this.debugwindow.title = 'xbDebug Window';
    this.debugwindow.document.write('<html><head><title>xbDebug Window</title></head><body><h3>Javascript Debug Window</h3></body></html>');
    this.debugwindow.focus();
}

xbDebug.prototype.close = function ()
{
    if (!this.debugwindow)
        return;

    if (!this.debugwindow.closed)
        this.debugwindow.close();

    // bc 2002-02-07, other windows may still hold a reference to this: this.debugwindow = null;
}

xbDebug.prototype.dump = function (msg)
{
    if (!this.on)
        return;

    if (!this.debugwindow || this.debugwindow.closed)
        this.open();

    this.debugwindow.document.write(msg + '<br>');

    return;
}

var xbDEBUG = new xbDebug();

window.onunload = function () {
    xbDEBUG.close();
}

function xbDebugGetFunctionName(funcref)
{

    if (!funcref)
    {
        return '';
    }

    if (funcref.name)
        return funcref.name;

    var name = funcref + '';
    name = name.substring(name.indexOf(' ') + 1, name.indexOf('('));
    funcref.name = name;

    if (!name) alert('name not defined');
    return name;
}

// emulate functionref.apply for IE mac and IE win < 5.5
function xbDebugApplyFunction(funcname, funcref, thisref, argumentsref)
{
    var rv;

    if (!funcref)
    {
        alert('xbDebugApplyFunction: funcref is null');
    }

    if (typeof(funcref.apply) != 'undefined')
        return funcref.apply(thisref, argumentsref);

    var applyexpr = 'thisref.xbDebug_orig_' + funcname + '(';
    var i;

    for (i = 0; i < argumentsref.length; i++)
    {
        applyexpr += 'argumentsref[' + i + '],';
    }

    if (argumentsref.length > 0)
    {
        applyexpr = applyexpr.substring(0, applyexpr.length - 1);
    }

    applyexpr += ')';

    return eval(applyexpr);
}

function xbDebugCreateFunctionWrapper(scopename, funcname, precall, postcall)
{
    var wrappedfunc;
    var scopeobject = eval(scopename);
    var funcref = scopeobject[funcname];

    scopeobject['xbDebug_orig_' + funcname] = funcref;

    wrappedfunc = function ()
    {
        var rv;

        precall(scopename, funcname, arguments);
        rv = xbDebugApplyFunction(funcname, funcref, scopeobject, arguments);
        postcall(scopename, funcname, arguments, rv);
        return rv;
    };

    if (typeof(funcref.constructor) != 'undefined')
        wrappedfunc.constructor = funcref.constuctor;

    if (typeof(funcref.prototype) != 'undefined')
        wrappedfunc.prototype = funcref.prototype;

    scopeobject[funcname] = wrappedfunc;
}

function xbDebugCreateMethodWrapper(contextname, classname, methodname, precall, postcall)
{
    var context = eval(contextname);
    var methodref = context[classname].prototype[methodname];

    context[classname].prototype['xbDebug_orig_' + methodname] = methodref;

    var wrappedmethod = function ()
    {
        var rv;
        // eval 'this' at method run time to pick up reference to the object's instance
        var thisref = eval('this');
        // eval 'arguments' at method run time to pick up method's arguments
        var argsref = arguments;

        precall(contextname + '.' + classname, methodname, argsref);
        rv = xbDebugApplyFunction(methodname, methodref, thisref, argsref);
        postcall(contextname + '.' + classname, methodname, argsref, rv);
        return rv;
    };

    return wrappedmethod;
}

function xbDebugPersistToString(obj)
{
    var s = '';
    var p;

    if (obj == null)
        return 'null';

    switch (typeof(obj))
            {
        case 'number':
            return obj;
        case 'string':
            return '"' + obj + '"';
        case 'undefined':
            return 'undefined';
        case 'boolean':
            return obj + '';
    }

    if (obj.constructor)
        return '[' + xbDebugGetFunctionName(obj.constructor) + ']';

    return null;
}

function xbDebugTraceBefore(scopename, funcname, funcarguments)
{
    var i;
    var s = '';
    var execprofile = xbDEBUG.execprofile[scopename + '.' + funcname];
    if (!execprofile)
        execprofile = xbDEBUG.execprofile[scopename + '.' + funcname] = { started: 0, time: 0, count: 0 };

    for (i = 0; i < funcarguments.length; i++)
    {
        s += xbDebugPersistToString(funcarguments[i]);
        if (i < funcarguments.length - 1)
            s += ', ';
    }

    xbDEBUG.dump('enter ' + scopename + '.' + funcname + '(' + s + ')');
    execprofile.started = (new Date()).getTime();
}

function xbDebugTraceAfter(scopename, funcname, funcarguments, rv)
{
    var i;
    var s = '';
    var execprofile = xbDEBUG.execprofile[scopename + '.' + funcname];
    if (!execprofile)
        xbDEBUG.dump('xbDebugTraceAfter: execprofile not created for ' + scopename + '.' + funcname);
    else if (execprofile.started == 0)
        xbDEBUG.dump('xbDebugTraceAfter: execprofile.started == 0 for ' + scopename + '.' + funcname);
    else
    {
        execprofile.time += (new Date()).getTime() - execprofile.started;
        execprofile.count++;
        execprofile.started = 0;
    }

    for (i = 0; i < funcarguments.length; i++)
    {
        s += xbDebugPersistToString(funcarguments[i]);
        if (i < funcarguments.length - 1)
            s += ', ';
    }

    xbDEBUG.dump('exit  ' + scopename + '.' + funcname + '(' + s + ')==' + xbDebugPersistToString(rv));
}

function xbDebugTraceFunction(scopename, funcname)
{
    xbDebugCreateFunctionWrapper(scopename, funcname, xbDebugTraceBefore, xbDebugTraceAfter);
}

function xbDebugTraceObject(contextname, classname)
{
    var classref = eval(contextname + '.' + classname);
    var p;
    var sp;

    if (!classref || !classref.prototype)
        return;

    for (p in classref.prototype)
    {
        sp = p + '';
        if (typeof(classref.prototype[sp]) == 'function' && (sp).indexOf('xbDebug_orig') == -1)
        {
            classref.prototype[sp] = xbDebugCreateMethodWrapper(contextname, classname, sp, xbDebugTraceBefore, xbDebugTraceAfter);
        }
    }
}

function xbDebugDumpProfile()
{
    var p;
    var execprofile;
    var avg;

    for (p in xbDEBUG.execprofile)
    {
        execprofile = xbDEBUG.execprofile[p];
        avg = Math.round(100 * execprofile.time / execprofile.count) / 100;
        xbDEBUG.dump('Execution profile ' + p + ' called ' + execprofile.count + ' times. Total time=' + execprofile.time + 'ms. Avg Time=' + avg + 'ms.');
    }
}
