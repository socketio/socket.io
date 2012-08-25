
/**
 * Module dependencies.
 */

var utils = require('./utils');

/**
 * Expose `Response`.
 */

module.exports = Response;

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * @param {ClientRequest} req
 * @param {IncomingMessage} res
 * @param {Object} options
 * @api private
 */

function Response(req, res, options) {
  options = options || {};
  this.req = req;
  this.res = res;
  this.links = {};
  this.text = res.text;
  this.body = res.body || {};
  this.files = res.files || {};
  this.header = this.headers = res.headers;
  this.setStatusProperties(res.statusCode);
  this.setHeaderProperties(this.header);
}

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // TODO: moar!
  // TODO: make this a util

  // content-type
  var ct = this.header['content-type'] || '';
  this.type = utils.type(ct);

  // params
  var params = utils.params(ct);
  for (var key in params) this[key] = params[key];

  // links
  if (header.link) this.links = utils.parseLinks(header.link);
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  var type = status / 100 | 0;

  // status / class
  this.status = this.statusCode = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.redirect = 3 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = 4 == type || 5 == type;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
};