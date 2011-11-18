
/**
 * Inheritance.
 *
 * @param {Function} ctor a
 * @param {Function} ctor b
 * @api public
 */

exports.inherits = function inherits (a, b) {
  function c () { }
  c.prototype = b.prototype;
  a.prototype = new c;
}

/**
 * UA / engines detection namespace.
 *
 * @namespace
 */

util.ua = {};

/**
 * Whether the UA supports CORS for XHR.
 *
 * @api public
 */

util.ua.hasCORS = 'undefined' != typeof XMLHttpRequest && (function () {
  try {
    var a = new XMLHttpRequest();
  } catch (e) {
    return false;
  }

  return a.withCredentials != undefined;
})();

/**
 * Detect webkit.
 *
 * @api public
 */

util.ua.webkit = 'undefined' != typeof navigator &&
  /webkit/i.test(navigator.userAgent);

/**
 * Detect gecko.
 *
 * @api public
 */

util.ua.gecko = 'undefined' != typeof navigator && 
  /gecko/i.test(navigator.userAgent);

// end

/**
 * XHR request helper.
 *
 * @param {Boolean} whether we need xdomain
 * @api private
 */

util.request = function request (xdomain) {
  // if node
  var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
  return new XMLHttpRequest();
  // end

  if (xdomain && 'undefined' != typeof XDomainRequest) {
    return new XDomainRequest();
  }

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' != typeof XMLHttpRequest && (!xdomain || util.ua.hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } catch(e) { }
  }
};
