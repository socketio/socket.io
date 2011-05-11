
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket (data, request) {
  Transport.call(this, data, request);

  this.drained = true;
}

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function onSocketConnect () {
  var self = this;

  this.socket.on('drain', function drain () {
    self.drained = true;
  });
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function write () {
  this.drained = false;
};

/**
 * Writes a volatile message
 *
 * @api private
 */

WebSocket.prototype.writeVolatile = function writeVolatile () {
  if (this.drained) {
    this.write();
  } else {
    this.log.debug('ignoring volatile message, buffer not drained');
  }
};

/**
 * Writes a payload.
 *
 * @api private
 */

WebSocket.prototype.payload = function payload (msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.write(msgs[i]);
  }

  return this;
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function doClose () {
  this.connection.end();
};
