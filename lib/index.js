
/**
 * Module dependencies.
 */

var engine = require('./engine.io');

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

for (var k in engine) exports[k] = engine[k];
