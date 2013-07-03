
/**
 * Module dependencies.
 */

var engine = require('./engine.io')
  , util = require('./util');

/**
 * Invoking the library as a function delegates to attach
 *
 * @param {http.Server} server
 * @param {Object} options
 * @return {Server} engine server
 * @api public
 */

exports = module.exports = function() {
  return engine.attach.apply(this, arguments);
};

/**
 * Merge engine.
 */

util.merge(exports, engine);
