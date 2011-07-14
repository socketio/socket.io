
/*!
* socket.io-node
* Copyright(c) 2011 LearnBoost <dev@learnboost.com>
* MIT Licensed
*/

/**
 * Module dependencies.
 */

var client = require('socket.io-client')
  , cp = require('child_process');

/**
 * Export the constructor
 */

exports = module.exports = Static;

/**
 * Static constructor
 *
 * @api public
 */

function Static () {
  this.cache = {};
  this.paths = {};
  this.etag = client.version;
}

/**
 * Gzip compress buffers
 *
 * @param {Buffer} buffer The buffer that needs gzip compression
 * @param {Function} callback
 * @api public
 */

Static.prototype.gzip = function (buffer, callback) {

};

/**
 * Is the path a staic file
 *
 * @param {String} path The path that needs to be checked
 * @api public
 */

Static.prototype.has = function (path) {

};

/**
 * Add new paths new paths that can be served using the static provider
 *
 * @param {String} path The path to respond to
 * @param {Options} options Options for writing out the response
 * @param {Function} [callback] Optional callback if no options.file is
 * supplied this would be called instead.
 * @api public
 */

Static.prototype.add = function (path, options, callback) {

};

/**
 * Writes a static response
 *
 * @param {String} path The path for the static content
 * @param {HTTPRequest} req The request object
 * @param {HTTPResponse} res The response object
 * @api public
 */

Static.prototype.write = function (path, req, res) {

};
