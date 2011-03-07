
/**
 * Listener creation shorcut
 *
 * @param {Server} node HTTP server
 * @param {Object} options
 * @api public
 */

exports.listen = function(server, options){
  return new exports.Listener(server, options);
};

/**
 * Listener constructor
 *
 * @api public
 */

exports.Listener = require('./listener');
exports.Client = require('./client');

exports.setClient = function(newClient){
  exports.Client = newClient;
}

/**
 * Version
 */

exports.version = '0.6.15';
