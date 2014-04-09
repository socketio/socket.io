
/**
 * Module dependencies.
 */

var Polling = require('./polling');
var qs = require('querystring');

/**
 * Module exports.
 */

module.exports = JSONP;

/**
 * JSON-P polling transport.
 *
 * @api public
 */

function JSONP (req) {
  Polling.call(this, req);

  this.head = '___eio[' + (req._query.j || '').replace(/[^0-9]/g, '') + '](';
  this.foot = ');';
};

/**
 * Inherits from Polling.
 */

JSONP.prototype.__proto__ = Polling.prototype;

/**
 * Handles incoming data.
 * Due to a bug in \n handling by browsers, we expect a escaped string.
 *
 * @api private
 */

JSONP.prototype.onData = function (data) {
  // we leverage the qs module so that we get built-in DoS protection
  // and the fast alternative to decodeURIComponent
  data = qs.parse(data).d;
  if ('string' == typeof data) {
    Polling.prototype.onData.call(this, data.replace(/\\n/g, '\n'));
  }
};

/**
 * Performs the write.
 *
 * @api private
 */

JSONP.prototype.doWrite = function (data) {
  // we must output valid javascript, not valid json
  // see: http://timelessrepo.com/json-isnt-a-javascript-subset
  var js = JSON.stringify(data)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // prepare response
  data = this.head + js + this.foot;

  // explicit UTF-8 is required for pages not served under utf
  var headers = {
    'Content-Type': 'text/javascript; charset=UTF-8',
    'Content-Length': Buffer.byteLength(data)
  };

  // prevent XSS warnings on IE
  // https://github.com/LearnBoost/socket.io/pull/1333
  var ua = this.req.headers['user-agent'];
  if (ua && (~ua.indexOf(';MSIE') || ~ua.indexOf('Trident/'))) {
    headers['X-XSS-Protection'] = '0';
  }

  this.res.writeHead(200, this.headers(this.req, headers));
  this.res.end(data);
};

/**
 * Returns headers for a response.
 *
 * @param {http.ServerRequest} request
 * @param {Object} extra headers
 * @api private
 */

JSONP.prototype.headers = function (req, headers) {
  headers = headers || {};

  // disable XSS protection for IE
  if (/MSIE 8\.0/.test(req.headers['user-agent'])) {
    headers['X-XSS-Protection'] = '0';
  }

  this.emit('headers', headers);
  return headers;
};
