function createRequest() {
//#JSCOVERAGE_IF
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest();
  }
  else if (window.ActiveXObject) {
    return new ActiveXObject('Msxml2.XMLHTTP');
  }
  else {
    throw 'no XMLHttpRequest implementation available';
  }
}

function createRequest2() {
//#JSCOVERAGE_IF
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest();
  }

//#JSCOVERAGE_IF ! window.XMLHttpRequest
//#JSCOVERAGE_IF
  if (window.ActiveXObject) {
    return new ActiveXObject('Msxml2.XMLHTTP');
  }

//#JSCOVERAGE_IF 0
  throw 'no XMLHttpRequest implementation available';
//#JSCOVERAGE_ENDIF
//#JSCOVERAGE_ENDIF
}

function log(s) {
//#JSCOVERAGE_IF
  if (window.console && window.console.log) {
    console.log(s);
  }
  else if (window.opera && window.opera.postError) {
    opera.postError(s);
  }
}

var request = createRequest();
var request2 = createRequest2();
log('created requests');
