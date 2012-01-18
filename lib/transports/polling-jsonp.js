
/**
 * Module dependencies.
 */

var Polling = require('./polling')
  , qs = require('querystring')

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

  this.head = '___eio[' + req.query.j + '](';
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
  data = this.head + JSON.stringify(data) + this.foot;

  var headers = {
      'Content-Type': 'text/javascript; charset=UTF-8'
    , 'Content-Length': Buffer.byteLength(data)
    , 'Connection': 'Keep-Alive'
  };

  // disable XSS protection for IE
  if (/MSIE 8\.0/.test(this.req.headers['user-agent'])) {
    headers['X-XSS-Protection'] = '0';
  }

  this.res.writeHead(200, headers);
  this.res.end(data);
};
