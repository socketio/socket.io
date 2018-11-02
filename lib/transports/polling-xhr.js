
/**
 * Module dependencies.
 */

var Polling = require('./polling');
var util = require('util');

/**
 * Module exports.
 */

module.exports = XHR;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHR (req, opts) {
  Polling.call(this, req, opts);
}

/**
 * Inherits from Polling.
 */

util.inherits(XHR, Polling);

/**
 * Overrides `onRequest` to handle `OPTIONS`..
 *
 * @param {http.IncomingMessage}
 * @api private
 */

XHR.prototype.onRequest = function (req) {
  if ('OPTIONS' === req.method) {
    var res = req.res;
    var headers = this.headers(req);
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    res.writeHead(200, headers);
    res.end();
  } else {
    Polling.prototype.onRequest.call(this, req);
  }
};

/**
 * Returns headers for a response.
 *
 * @param {http.IncomingMessage} request
 * @param {Object} extra headers
 * @api private
 */

XHR.prototype.headers = function (req, headers) {
  headers = headers || {};

  headers['Access-Control-Allow-Origin'] = this.origins;
  headers['Vary'] = 'Origin';
  if (req.headers.origin) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return Polling.prototype.headers.call(this, req, headers);
};
