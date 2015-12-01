
/**
 * Module dependencies.
 */

var Polling = require('./polling');
var Transport = require('../transport');
var debug = require('debug')('engine:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHR(req){
  Polling.call(this, req);
}

/**
 * Inherits from Polling.
 */

XHR.prototype.__proto__ = Polling.prototype;

/**
 * Overrides `onRequest` to handle `OPTIONS`..
 *
 * @param {http.ServerRequest}
 * @api private
 */

XHR.prototype.onRequest = function (req) {
  if ('OPTIONS' == req.method) {
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
 * @param {http.ServerRequest} request
 * @param {Object} extra headers
 * @api private
 */

XHR.prototype.headers = function(req, headers){
  headers = headers || {};

  if (req.headers.origin) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Origin'] = req.headers.origin;
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return Polling.prototype.headers.call(this, req, headers);
};
