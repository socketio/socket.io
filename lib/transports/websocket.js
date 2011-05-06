
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
};

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Writes a payload.
 *
 * @api private
 */

WebSocket.prototype.payload = function (msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.write(msgs[i]);
  }

  return this;
};


/**
 * Override end
 *
 * @api private
 */

WebSocket.prototype.end = function () {
  if (this.open) {
    this.socket.end();
  }

  return Transport.prototype.end.call(this);
};
