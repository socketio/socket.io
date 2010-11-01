/*
    jscoverage.js - code coverage for JavaScript
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

/**
Initializes the _$jscoverage object in a window.  This should be the first
function called in the page.
@param  w  this should always be the global window object
*/
function jscoverage_init(w) {
  try {
    // in Safari, "import" is a syntax error
    Components.utils['import']('resource://gre/modules/jscoverage.jsm');
    jscoverage_isInvertedMode = true;
    return;
  }
  catch (e) {}

  if (w.opener && w.opener.top._$jscoverage) {
    // we are in inverted mode
    jscoverage_isInvertedMode = true;
    if (! w._$jscoverage) {
      w._$jscoverage = w.opener.top._$jscoverage;
    }
  }
  else {
    // we are not in inverted mode
    jscoverage_isInvertedMode = false;
    if (! w._$jscoverage) {
      w._$jscoverage = {};
    }
  }
}

var jscoverage_currentFile = null;
var jscoverage_currentLine = null;

var jscoverage_inLengthyOperation = false;

/*
Possible states:
			isInvertedMode	isServer	isReport	tabs
normal			false		false		false		Browser
inverted		true		false		false		
server, normal		false		true		false		Browser, Store
server, inverted	true		true		false		Store
report			false		false		true		
*/
var jscoverage_isInvertedMode = false;
var jscoverage_isServer = false;
var jscoverage_isReport = false;

jscoverage_init(window);

function jscoverage_createRequest() {
  // Note that the IE7 XMLHttpRequest does not support file URL's.
  // http://xhab.blogspot.com/2006/11/ie7-support-for-xmlhttprequest.html
  // http://blogs.msdn.com/ie/archive/2006/12/06/file-uris-in-windows.aspx
//#JSCOVERAGE_IF
  if (window.ActiveXObject) {
    return new ActiveXObject("Microsoft.XMLHTTP");
  }
  else {
    return new XMLHttpRequest();
  }
}

// http://www.quirksmode.org/js/findpos.html
function jscoverage_findPos(obj) {
  var result = 0;
  do {
    result += obj.offsetTop;
    obj = obj.offsetParent;
  }
  while (obj);
  return result;
}

// http://www.quirksmode.org/viewport/compatibility.html
function jscoverage_getViewportHeight() {
//#JSCOVERAGE_IF /MSIE/.test(navigator.userAgent)
  if (self.innerHeight) {
    // all except Explorer
    return self.innerHeight;
  }
  else if (document.documentElement && document.documentElement.clientHeight) {
    // Explorer 6 Strict Mode
    return document.documentElement.clientHeight;
  }
  else if (document.body) {
    // other Explorers
    return document.body.clientHeight;
  }
  else {
    throw "Couldn't calculate viewport height";
  }
//#JSCOVERAGE_ENDIF
}

/**
Indicates visually that a lengthy operation has begun.  The progress bar is
displayed, and the cursor is changed to busy (on browsers which support this).
*/
function jscoverage_beginLengthyOperation() {
  jscoverage_inLengthyOperation = true;

  var progressBar = document.getElementById('progressBar');
  progressBar.style.visibility = 'visible';
  ProgressBar.setPercentage(progressBar, 0);
  var progressLabel = document.getElementById('progressLabel');
  progressLabel.style.visibility = 'visible';

  /* blacklist buggy browsers */
//#JSCOVERAGE_IF
  if (! /Opera|WebKit/.test(navigator.userAgent)) {
    /*
    Change the cursor style of each element.  Note that changing the class of the
    element (to one with a busy cursor) is buggy in IE.
    */
    var tabs = document.getElementById('tabs').getElementsByTagName('div');
    var i;
    for (i = 0; i < tabs.length; i++) {
      tabs.item(i).style.cursor = 'wait';
    }
  }
}

/**
Removes the progress bar and busy cursor.
*/
function jscoverage_endLengthyOperation() {
  var progressBar = document.getElementById('progressBar');
  ProgressBar.setPercentage(progressBar, 100);
  setTimeout(function() {
    jscoverage_inLengthyOperation = false;
    progressBar.style.visibility = 'hidden';
    var progressLabel = document.getElementById('progressLabel');
    progressLabel.style.visibility = 'hidden';
    progressLabel.innerHTML = '';

    var tabs = document.getElementById('tabs').getElementsByTagName('div');
    var i;
    for (i = 0; i < tabs.length; i++) {
      tabs.item(i).style.cursor = '';
    }
  }, 50);
}

function jscoverage_setSize() {
//#JSCOVERAGE_IF /MSIE/.test(navigator.userAgent)
  var viewportHeight = jscoverage_getViewportHeight();

  /*
  border-top-width:     1px
  padding-top:         10px
  padding-bottom:      10px
  border-bottom-width:  1px
  margin-bottom:       10px
                       ----
                       32px
  */
  var tabPages = document.getElementById('tabPages');
  var tabPageHeight = (viewportHeight - jscoverage_findPos(tabPages) - 32) + 'px';
  var nodeList = tabPages.childNodes;
  var length = nodeList.length;
  for (var i = 0; i < length; i++) {
    var node = nodeList.item(i);
    if (node.nodeType !== 1) {
      continue;
    }
    node.style.height = tabPageHeight;
  }

  var iframeDiv = document.getElementById('iframeDiv');
  // may not exist if we have removed the first tab
  if (iframeDiv) {
    iframeDiv.style.height = (viewportHeight - jscoverage_findPos(iframeDiv) - 21) + 'px';
  }

  var summaryDiv = document.getElementById('summaryDiv');
  summaryDiv.style.height = (viewportHeight - jscoverage_findPos(summaryDiv) - 21) + 'px';

  var sourceDiv = document.getElementById('sourceDiv');
  sourceDiv.style.height = (viewportHeight - jscoverage_findPos(sourceDiv) - 21) + 'px';

  var storeDiv = document.getElementById('storeDiv');
  if (storeDiv) {
    storeDiv.style.height = (viewportHeight - jscoverage_findPos(storeDiv) - 21) + 'px';
  }
//#JSCOVERAGE_ENDIF
}

/**
Returns the boolean value of a string.  Values 'false', 'f', 'no', 'n', 'off',
and '0' (upper or lower case) are false.
@param  s  the string
@return  a boolean value
*/
function jscoverage_getBooleanValue(s) {
  s = s.toLowerCase();
  if (s === 'false' || s === 'f' || s === 'no' || s === 'n' || s === 'off' || s === '0') {
    return false;
  }
  return true;
}

function jscoverage_removeTab(id) {
  var tab = document.getElementById(id + 'Tab');
  tab.parentNode.removeChild(tab);
  var tabPage = document.getElementById(id + 'TabPage');
  tabPage.parentNode.removeChild(tabPage);
}

/**
Initializes the contents of the tabs.  This sets the initial values of the
input field and iframe in the "Browser" tab and the checkbox in the "Summary"
tab.
@param  queryString  this should always be location.search
*/
function jscoverage_initTabContents(queryString) {
  var showMissingColumn = false;
  var parameters, parameter, i, index, url, name, value;
  if (queryString.length > 0) {
    // chop off the question mark
    queryString = queryString.substring(1);
    parameters = queryString.split(/&|;/);
    for (i = 0; i < parameters.length; i++) {
      parameter = parameters[i];
      index = parameter.indexOf('=');
      if (index === -1) {
        // still works with old syntax
        url = parameter;
      }
      else {
        name = parameter.substr(0, index);
        value = parameter.substr(index + 1);
        if (name === 'missing' || name === 'm') {
          showMissingColumn = jscoverage_getBooleanValue(value);
        }
        else if (name === 'url' || name === 'u') {
          url = value;
        }
      }
    }
  }

  var checkbox = document.getElementById('checkbox');
  checkbox.checked = showMissingColumn;
  if (showMissingColumn) {
    jscoverage_appendMissingColumn();
  }

  // this will automatically propagate to the input field
  if (url) {
    frames[0].location = url;
  }

  // if the browser tab is absent, we have to initialize the summary tab
  if (! document.getElementById('browserTab')) {
    jscoverage_recalculateSummaryTab();
  }
}

function jscoverage_body_load() {
  var progressBar = document.getElementById('progressBar');
  ProgressBar.init(progressBar);

  function reportError(e) {
    jscoverage_endLengthyOperation();
    var summaryThrobber = document.getElementById('summaryThrobber');
    summaryThrobber.style.visibility = 'hidden';
    var div = document.getElementById('summaryErrorDiv');
    div.innerHTML = 'Error: ' + e;
  }

  if (jscoverage_isReport) {
    jscoverage_beginLengthyOperation();
    var summaryThrobber = document.getElementById('summaryThrobber');
    summaryThrobber.style.visibility = 'visible';
    var request = jscoverage_createRequest();
    try {
      request.open('GET', 'jscoverage.json', true);
      request.onreadystatechange = function (event) {
        if (request.readyState === 4) {
          try {
            if (request.status !== 0 && request.status !== 200) {
              throw request.status;
            }
            var response = request.responseText;
            if (response === '') {
              throw 404;
            }
            var json = eval('(' + response + ')');
            var file;
            for (file in json) {
              var fileCoverage = json[file];
              _$jscoverage[file] = fileCoverage.coverage;
              _$jscoverage[file].source = fileCoverage.source;
            }
            jscoverage_recalculateSummaryTab();
            summaryThrobber.style.visibility = 'hidden';
          }
          catch (e) {
            reportError(e);
          }
        }
      };
      request.send(null);
    }
    catch (e) {
      reportError(e);
    }

    jscoverage_removeTab('browser');
    jscoverage_removeTab('store');
  }
  else {
    if (jscoverage_isInvertedMode) {
      jscoverage_removeTab('browser');
    }

    if (! jscoverage_isServer) {
      jscoverage_removeTab('store');
    }
  }

  jscoverage_initTabControl();

  jscoverage_initTabContents(location.search);
}

function jscoverage_body_resize() {
  if (/MSIE/.test(navigator.userAgent)) {
    jscoverage_setSize();
  }
}

// -----------------------------------------------------------------------------
// tab 1

function jscoverage_updateBrowser() {
  var input = document.getElementById("location");
  frames[0].location = input.value;
}

function jscoverage_input_keypress(e) {
  if (e.keyCode === 13) {
    jscoverage_updateBrowser();
  }
}

function jscoverage_button_click() {
  jscoverage_updateBrowser();
}

function jscoverage_browser_load() {
  /* update the input box */
  var input = document.getElementById("location");

  /* sometimes IE seems to fire this after the tab has been removed */
  if (input) {
    input.value = frames[0].location;
  }
}

// -----------------------------------------------------------------------------
// tab 2

function jscoverage_createLink(file, line) {
  var link = document.createElement("a");

  var url;
  var call;
  var text;
  if (line) {
    url = file + ".jscoverage.html?" + line;
    call = "jscoverage_get('" + file + "', " + line + ");";
    text = line.toString();
  }
  else {
    url = file + ".jscoverage.html";
    call = "jscoverage_get('" + file + "');";
    text = file;
  }

  link.setAttribute('href', 'javascript:' + call);
  link.appendChild(document.createTextNode(text));

  return link;
}

function jscoverage_recalculateSummaryTab(cc) {
  var checkbox = document.getElementById('checkbox');
  var showMissingColumn = checkbox.checked;

  if (! cc) {
    cc = window._$jscoverage;
  }
  if (! cc) {
//#JSCOVERAGE_IF 0
    throw "No coverage information found.";
//#JSCOVERAGE_ENDIF
  }

  var tbody = document.getElementById("summaryTbody");
  while (tbody.hasChildNodes()) {
    tbody.removeChild(tbody.firstChild);
  }

  var totals = { files:0, statements:0, executed:0, coverage:0, skipped:0 };

  var file;
  var files = [];
  for (file in cc) {
    files.push(file);
  }
  files.sort();

  var rowCounter = 0;
  for (var f = 0; f < files.length; f++) {
    file = files[f];
    var lineNumber;
    var num_statements = 0;
    var num_executed = 0;
    var missing = [];
    var fileCC = cc[file];
    var length = fileCC.length;
    var currentConditionalEnd = 0;
    var conditionals = null;
    if (fileCC.conditionals) {
      conditionals = fileCC.conditionals;
    }
    for (lineNumber = 0; lineNumber < length; lineNumber++) {
      var n = fileCC[lineNumber];

      if (lineNumber === currentConditionalEnd) {
        currentConditionalEnd = 0;
      }
      else if (currentConditionalEnd === 0 && conditionals && conditionals[lineNumber]) {
        currentConditionalEnd = conditionals[lineNumber];
      }

      if (currentConditionalEnd !== 0) {
        continue;
      }

      if (n === undefined || n === null) {
        continue;
      }

      if (n === 0) {
        missing.push(lineNumber);
      }
      else {
        num_executed++;
      }
      num_statements++;
    }

    var percentage = ( num_statements === 0 ? 0 : parseInt(100 * num_executed / num_statements) );

    var row = document.createElement("tr");
    row.className = ( rowCounter++ % 2 == 0 ? "odd" : "even" );

    var cell = document.createElement("td");
    cell.className = 'leftColumn';
    var link = jscoverage_createLink(file);
    cell.appendChild(link);

    row.appendChild(cell);

    cell = document.createElement("td");
    cell.className = 'numeric';
    cell.appendChild(document.createTextNode(num_statements));
    row.appendChild(cell);

    cell = document.createElement("td");
    cell.className = 'numeric';
    cell.appendChild(document.createTextNode(num_executed));
    row.appendChild(cell);

    // new coverage td containing a bar graph
    cell = document.createElement("td");
    cell.className = 'coverage';
    var pctGraph = document.createElement("div"),
        covered = document.createElement("div"),
        pct = document.createElement("span");
    pctGraph.className = "pctGraph";
    if( num_statements === 0 ) {
        covered.className = "skipped";
        pct.appendChild(document.createTextNode("N/A"));
    } else {
        covered.className = "covered";
        covered.style.width = percentage + "px";
        pct.appendChild(document.createTextNode(percentage + '%'));
    }
    pct.className = "pct";
    pctGraph.appendChild(covered);
    cell.appendChild(pctGraph);
    cell.appendChild(pct);
    row.appendChild(cell);

    if (showMissingColumn) {
      cell = document.createElement("td");
      for (var i = 0; i < missing.length; i++) {
        if (i !== 0) {
          cell.appendChild(document.createTextNode(", "));
        }
        link = jscoverage_createLink(file, missing[i]);
        cell.appendChild(link);
      }
      row.appendChild(cell);
    }

    tbody.appendChild(row);

    totals['files'] ++;
    totals['statements'] += num_statements;
    totals['executed'] += num_executed;
    totals['coverage'] += percentage;
    if( num_statements === 0 ) {
        totals['skipped']++;
    }

    // write totals data into summaryTotals row
    var tr = document.getElementById("summaryTotals");
    if (tr) {
        var tds = tr.getElementsByTagName("td");
        tds[0].getElementsByTagName("span")[1].firstChild.nodeValue = totals['files'];
        tds[1].firstChild.nodeValue = totals['statements'];
        tds[2].firstChild.nodeValue = totals['executed'];

        var coverage = parseInt(totals['coverage'] / ( totals['files'] - totals['skipped'] ) );
        if( isNaN( coverage ) ) {
            coverage = 0;
        }
        tds[3].getElementsByTagName("span")[0].firstChild.nodeValue = coverage + '%';
        tds[3].getElementsByTagName("div")[1].style.width = coverage + 'px';
    }

  }
  jscoverage_endLengthyOperation();
}

function jscoverage_appendMissingColumn() {
  var headerRow = document.getElementById('headerRow');
  var missingHeader = document.createElement('th');
  missingHeader.id = 'missingHeader';
  missingHeader.innerHTML = '<abbr title="List of statements missed during execution">Missing</abbr>';
  headerRow.appendChild(missingHeader);
  var summaryTotals = document.getElementById('summaryTotals');
  var empty = document.createElement('td');
  empty.id = 'missingCell';
  summaryTotals.appendChild(empty);
}

function jscoverage_removeMissingColumn() {
  var missingNode;
  missingNode = document.getElementById('missingHeader');
  missingNode.parentNode.removeChild(missingNode);
  missingNode = document.getElementById('missingCell');
  missingNode.parentNode.removeChild(missingNode);
}

function jscoverage_checkbox_click() {
  if (jscoverage_inLengthyOperation) {
    return false;
  }
  jscoverage_beginLengthyOperation();
  var checkbox = document.getElementById('checkbox');
  var showMissingColumn = checkbox.checked;
  setTimeout(function() {
    if (showMissingColumn) {
      jscoverage_appendMissingColumn();
    }
    else {
      jscoverage_removeMissingColumn();
    }
    jscoverage_recalculateSummaryTab();
  }, 50);
  return true;
}

// -----------------------------------------------------------------------------
// tab 3

function jscoverage_makeTable() {
  var coverage = _$jscoverage[jscoverage_currentFile];
  var lines = coverage.source;

  // this can happen if there is an error in the original JavaScript file
  if (! lines) {
    lines = [];
  }

  var rows = ['<table id="sourceTable">'];
  var i = 0;
  var progressBar = document.getElementById('progressBar');
  var tableHTML;
  var currentConditionalEnd = 0;

  function joinTableRows() {
    tableHTML = rows.join('');
    ProgressBar.setPercentage(progressBar, 60);
    /*
    This may be a long delay, so set a timeout of 100 ms to make sure the
    display is updated.
    */
    setTimeout(appendTable, 100);
  }

  function appendTable() {
    var sourceDiv = document.getElementById('sourceDiv');
    sourceDiv.innerHTML = tableHTML;
    ProgressBar.setPercentage(progressBar, 80);
    setTimeout(jscoverage_scrollToLine, 0);
  }

  while (i < lines.length) {
    var lineNumber = i + 1;

    if (lineNumber === currentConditionalEnd) {
      currentConditionalEnd = 0;
    }
    else if (currentConditionalEnd === 0 && coverage.conditionals && coverage.conditionals[lineNumber]) {
      currentConditionalEnd = coverage.conditionals[lineNumber];
    }

    var row = '<tr>';
    row += '<td class="numeric">' + lineNumber + '</td>';
    var timesExecuted = coverage[lineNumber];
    if (timesExecuted !== undefined && timesExecuted !== null) {
      if (currentConditionalEnd !== 0) {
        row += '<td class="y numeric">';
      }
      else if (timesExecuted === 0) {
        row += '<td class="r numeric" id="line-' + lineNumber + '">';
      }
      else {
        row += '<td class="g numeric">';
      }
      row += timesExecuted;
      row += '</td>';
    }
    else {
      row += '<td></td>';
    }
    row += '<td><pre>' + lines[i] + '</pre></td>';
    row += '</tr>';
    row += '\n';
    rows[lineNumber] = row;
    i++;
  }
  rows[i + 1] = '</table>';
  ProgressBar.setPercentage(progressBar, 40);
  setTimeout(joinTableRows, 0);
}

function jscoverage_scrollToLine() {
  jscoverage_selectTab('sourceTab');
  if (! window.jscoverage_currentLine) {
    jscoverage_endLengthyOperation();
    return;
  }
  var div = document.getElementById('sourceDiv');
  if (jscoverage_currentLine === 1) {
    div.scrollTop = 0;
  }
  else {
    var cell = document.getElementById('line-' + jscoverage_currentLine);

    // this might not be there if there is an error in the original JavaScript
    if (cell) {
      var divOffset = jscoverage_findPos(div);
      var cellOffset = jscoverage_findPos(cell);
      div.scrollTop = cellOffset - divOffset;
    }
  }
  jscoverage_currentLine = 0;
  jscoverage_endLengthyOperation();
}

/**
Loads the given file (and optional line) in the source tab.
*/
function jscoverage_get(file, line) {
  if (jscoverage_inLengthyOperation) {
    return;
  }
  jscoverage_beginLengthyOperation();
  setTimeout(function() {
    var sourceDiv = document.getElementById('sourceDiv');
    sourceDiv.innerHTML = '';
    jscoverage_selectTab('sourceTab');
    if (file === jscoverage_currentFile) {
      jscoverage_currentLine = line;
      jscoverage_recalculateSourceTab();
    }
    else {
      if (jscoverage_currentFile === null) {
        var tab = document.getElementById('sourceTab');
        tab.className = '';
        tab.onclick = jscoverage_tab_click;
      }
      jscoverage_currentFile = file;
      jscoverage_currentLine = line || 1;  // when changing the source, always scroll to top
      var fileDiv = document.getElementById('fileDiv');
      fileDiv.innerHTML = jscoverage_currentFile;
      jscoverage_recalculateSourceTab();
      return;
    }
  }, 50);
}

/**
Calculates coverage statistics for the current source file.
*/
function jscoverage_recalculateSourceTab() {
  if (! jscoverage_currentFile) {
    jscoverage_endLengthyOperation();
    return;
  }
  var progressLabel = document.getElementById('progressLabel');
  progressLabel.innerHTML = 'Calculating coverage ...';
  var progressBar = document.getElementById('progressBar');
  ProgressBar.setPercentage(progressBar, 20);
  setTimeout(jscoverage_makeTable, 0);
}

// -----------------------------------------------------------------------------
// tabs

/**
Initializes the tab control.  This function must be called when the document is
loaded.
*/
function jscoverage_initTabControl() {
  var tabs = document.getElementById('tabs');
  var i;
  var child;
  var tabNum = 0;
  for (i = 0; i < tabs.childNodes.length; i++) {
    child = tabs.childNodes.item(i);
    if (child.nodeType === 1) {
      if (child.className !== 'disabled') {
        child.onclick = jscoverage_tab_click;
      }
      tabNum++;
    }
  }
  jscoverage_selectTab(0);
}

/**
Selects a tab.
@param  tab  the integer index of the tab (0, 1, 2, or 3)
             OR
             the ID of the tab element
             OR
             the tab element itself
*/
function jscoverage_selectTab(tab) {
  if (typeof tab !== 'number') {
    tab = jscoverage_tabIndexOf(tab);
  }
  var tabs = document.getElementById('tabs');
  var tabPages = document.getElementById('tabPages');
  var nodeList;
  var tabNum;
  var i;
  var node;

  nodeList = tabs.childNodes;
  tabNum = 0;
  for (i = 0; i < nodeList.length; i++) {
    node = nodeList.item(i);
    if (node.nodeType !== 1) {
      continue;
    }

    if (node.className !== 'disabled') {
      if (tabNum === tab) {
        node.className = 'selected';
      }
      else {
        node.className = '';
      }
    }
    tabNum++;
  }

  nodeList = tabPages.childNodes;
  tabNum = 0;
  for (i = 0; i < nodeList.length; i++) {
    node = nodeList.item(i);
    if (node.nodeType !== 1) {
      continue;
    }

    if (tabNum === tab) {
      node.className = 'selected TabPage';
    }
    else {
      node.className = 'TabPage';
    }
    tabNum++;
  }
}

/**
Returns an integer (0, 1, 2, or 3) representing the index of a given tab.
@param  tab  the ID of the tab element
             OR
             the tab element itself
*/
function jscoverage_tabIndexOf(tab) {
  if (typeof tab === 'string') {
    tab = document.getElementById(tab);
  }
  var tabs = document.getElementById('tabs');
  var i;
  var child;
  var tabNum = 0;
  for (i = 0; i < tabs.childNodes.length; i++) {
    child = tabs.childNodes.item(i);
    if (child.nodeType === 1) {
      if (child === tab) {
        return tabNum;
      }
      tabNum++;
    }
  }
//#JSCOVERAGE_IF 0
  throw "Tab not found";
//#JSCOVERAGE_ENDIF
}

function jscoverage_tab_click(e) {
  if (jscoverage_inLengthyOperation) {
    return;
  }
  var target;
//#JSCOVERAGE_IF
  if (e) {
    target = e.target;
  }
  else if (window.event) {
    // IE
    target = window.event.srcElement;
  }
  if (target.className === 'selected') {
    return;
  }
  jscoverage_beginLengthyOperation();
  setTimeout(function() {
    if (target.id === 'summaryTab') {
      var tbody = document.getElementById("summaryTbody");
      while (tbody.hasChildNodes()) {
        tbody.removeChild(tbody.firstChild);
      }
    }
    else if (target.id === 'sourceTab') {
      var sourceDiv = document.getElementById('sourceDiv');
      sourceDiv.innerHTML = '';
    }
    jscoverage_selectTab(target);
    if (target.id === 'summaryTab') {
      jscoverage_recalculateSummaryTab();
    }
    else if (target.id === 'sourceTab') {
      jscoverage_recalculateSourceTab();
    }
    else {
      jscoverage_endLengthyOperation();
    }
  }, 50);
}

// -----------------------------------------------------------------------------
// progress bar

var ProgressBar = {
  init: function(element) {
    element._percentage = 0;

    /* doing this via JavaScript crashes Safari */
/*
    var pctGraph = document.createElement('div');
    pctGraph.className = 'pctGraph';
    element.appendChild(pctGraph);
    var covered = document.createElement('div');
    covered.className = 'covered';
    pctGraph.appendChild(covered);
    var pct = document.createElement('span');
    pct.className = 'pct';
    element.appendChild(pct);
*/

    ProgressBar._update(element);
  },
  setPercentage: function(element, percentage) {
    element._percentage = percentage;
    ProgressBar._update(element);
  },
  _update: function(element) {
    var pctGraph = element.getElementsByTagName('div').item(0);
    var covered = pctGraph.getElementsByTagName('div').item(0);
    var pct = element.getElementsByTagName('span').item(0);
    pct.innerHTML = element._percentage.toString() + '%';
    covered.style.width = element._percentage + 'px';
  }
};

// -----------------------------------------------------------------------------
// reports

function jscoverage_pad(s) {
  return '0000'.substr(s.length) + s;
}

function jscoverage_quote(s) {
  return '"' + s.replace(/[\u0000-\u001f"\\\u007f-\uffff]/g, function (c) {
    switch (c) {
    case '\b':
      return '\\b';
    case '\f':
      return '\\f';
    case '\n':
      return '\\n';
    case '\r':
      return '\\r';
    case '\t':
      return '\\t';
    // IE doesn't support this
    /*
    case '\v':
      return '\\v';
    */
    case '"':
      return '\\"';
    case '\\':
      return '\\\\';
    default:
      return '\\u' + jscoverage_pad(c.charCodeAt(0).toString(16));
    }
  }) + '"';
}

function jscoverage_serializeCoverageToJSON() {
  var json = [];
  for (var file in _$jscoverage) {
    var coverage = _$jscoverage[file];
    var array = [];
    var length = coverage.length;
    for (var line = 0; line < length; line++) {
      var value = coverage[line];
      if (value === undefined || value === null) {
        value = 'null';
      }
      array.push(value);
    }
    json.push(jscoverage_quote(file) + ':[' + array.join(',') + ']');
  }
  return '{' + json.join(',') + '}';
}

function jscoverage_storeButton_click() {
  if (jscoverage_inLengthyOperation) {
    return;
  }

  jscoverage_beginLengthyOperation();
  var img = document.getElementById('storeImg');
  img.style.visibility = 'visible';

  var request = jscoverage_createRequest();
  request.open('POST', '/jscoverage-store', true);
  request.onreadystatechange = function (event) {
    if (request.readyState === 4) {
      var message;
      try {
        if (request.status !== 200 && request.status !== 201 && request.status !== 204) {
          throw request.status;
        }
        message = request.responseText;
      }
      catch (e) {
        if (e.toString().search(/^\d{3}$/) === 0) {
          message = e + ': ' + request.responseText;
        }
        else {
          message = 'Could not connect to server: ' + e;
        }
      }

      jscoverage_endLengthyOperation();
      var img = document.getElementById('storeImg');
      img.style.visibility = 'hidden';

      var div = document.getElementById('storeDiv');
      div.appendChild(document.createTextNode(new Date() + ': ' + message));
      div.appendChild(document.createElement('br'));
    }
  };
  request.setRequestHeader('Content-Type', 'application/json');
  var json = jscoverage_serializeCoverageToJSON();
  request.setRequestHeader('Content-Length', json.length.toString());
  request.send(json);
}
