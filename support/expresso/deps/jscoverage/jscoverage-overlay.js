/*
    jscoverage-overlay.js - script for XUL overlay
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

Components.utils.import('resource://gre/modules/jscoverage.jsm');

// https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
function openAndReuseOneTabPerURL(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var browserEnumerator = wm.getEnumerator("navigator:browser");

  // Check each browser instance for our URL
  var found = false;
  while (!found && browserEnumerator.hasMoreElements()) {
    var browserWin = browserEnumerator.getNext();
    var tabbrowser = browserWin.getBrowser();

    // Check each tab of this browser instance
    var numTabs = tabbrowser.browsers.length;
    for(var index=0; index<numTabs; index++) {
      var currentBrowser = tabbrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec) {

        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.mTabs[index];

        // Focus *this* browser-window
        browserWin.focus();

        found = true;
        break;
      }
    }
  }

  // Our URL isn't open. Open it now.
  if (!found) {
    var recentWindow = wm.getMostRecentWindow("navigator:browser");
    if (recentWindow) {
      // Use an existing browser window
      recentWindow.delayedOpenTab(url, null, null, null, null);
    }
    else {
      // No browser windows are open, so open a new one.
      window.open(url);
    }
  }
}

function jscoverage_view() {
  openAndReuseOneTabPerURL('chrome://jscoverage/content/jscoverage.html');
}

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
    case '\v':
      return '\\v';
    case '"':
      return '\\"';
    case '\\':
      return '\\\\';
    default:
      return '\\u' + jscoverage_pad(c.charCodeAt(0).toString(16));
    }
  }) + '"';
}

function jscoverage_store() {
  try {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    var directoryService = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
    var reportDirectory = directoryService.get('CurWorkD', Ci.nsILocalFile);
    reportDirectory.appendRelativePath('jscoverage-report');
    if (! reportDirectory.exists()) {
      reportDirectory.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    }

    var ioService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var copyChrome = function(filename) {
      var channel = ioService.newChannel('chrome://jscoverage/content/' + filename, null, null);
      var binaryInputStream = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
      try {
        binaryInputStream.setInputStream(channel.open());

        var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        file.initWithFile(reportDirectory);
        file.appendRelativePath(filename);
        var fileOutputStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
        fileOutputStream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
        var binaryOutputStream = Cc['@mozilla.org/binaryoutputstream;1'].createInstance(Ci.nsIBinaryOutputStream);
        try {
          binaryOutputStream.setOutputStream(fileOutputStream);

          for (;;) {
            var available = binaryInputStream.available();
            if (available === 0) {
              break;
            }
            var bytes = binaryInputStream.readBytes(available);
            binaryOutputStream.writeBytes(bytes, bytes.length);
          }

          if (filename === 'jscoverage.js') {
            var s = 'jscoverage_isReport = true;\n';
            binaryOutputStream.write(s, s.length);
          }
        }
        finally {
          binaryOutputStream.close();
        }
      }
      finally {
        binaryInputStream.close();
      }
    };
    copyChrome('jscoverage.html');
    copyChrome('jscoverage.js');
    copyChrome('jscoverage.css');
    copyChrome('jscoverage-throbber.gif');
    copyChrome('jscoverage-highlight.css');

    // write the coverage data
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    file.initWithFile(reportDirectory);
    file.appendRelativePath('jscoverage.json');
    var fileOutputStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    try {
      fileOutputStream.init(file, 0x02 | 0x08 | 0x20, 0644, 0);
      function write(s) {
        fileOutputStream.write(s, s.length);
      }
      write('{');
      var first = true;
      for (var file in _$jscoverage) {
        if (first) {
          first = false;
        }
        else {
          write(',');
        }
        write(jscoverage_quote(file));
        write(':{"coverage":[');
        var coverage = _$jscoverage[file];
        var length = coverage.length;
        for (var line = 0; line < length; line++) {
          if (line > 0) {
            write(',');
          }
          var value = coverage[line];
          if (value === undefined || value === null) {
            value = 'null';
          }
          write(value.toString());
        }
        write('],"source":[');
        var source = coverage.source;
        length = source.length;
        for (line = 0; line < length; line++) {
          if (line > 0) {
            write(',');
          }
          write(jscoverage_quote(source[line]));
        }
        write(']}');
      }
      write('}');
      alert('Coverage data stored.');
    }
    finally {
      fileOutputStream.close();
    }
  }
  catch (e) {
    alert(e);
    dump(e);
    dump('\n');
  }
}
