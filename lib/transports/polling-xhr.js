
/**
 * Module dependencies.
 */

var Polling = require('./polling')
  , Transport = require('../transport')

/**
 * Module exports.
 */

module.exports = XHR;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHR (req) {
  Polling.call(this, req);
};

/**
 * Inherits from Polling.
 */

XHR.prototype.__proto__ = Polling.prototype;

/**
 * Frames data prior to write.
 *
 * @api private
 */

XHR.prototype.doWrite = function (data) {
  var headers = {
      'Content-Type': 'text/plain; charset=UTF-8'
    , 'Content-Length': Buffer.byteLength(data)
    , 'Connection': 'Keep-Alive'
  };

  if (this.req.headers.origin) {
    if (this.req.headers.cookie) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      headers['Access-Control-Allow-Origin'] = this.req.headers.origin;
    }
  }

  this.res.writeHead(200, headers);
  this.res.end(data);
};
