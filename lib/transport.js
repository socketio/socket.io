
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , parser = require('./parser')

/**
 * Expose the constructor.
 */

module.exports = Transport;

/**
 * Transport constructor.
 *
 * @api public
 */

function Transport (req) {
  this.readyState = 'opening';
  this.onRequest(req);
};

/**
 * Inherits from EventEmitter.
 */

Transport.prototype.__proto__ = EventEmitter.prototype;

Transport.prototype.onRequest = function (req) {
  this.req = req;
};

Transport.prototype.close = function () {
  this.doClose();
};

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
};

/**
 * Called upon data packet.
 */

Transport.prototype.onData = function (data) {
  this.onPacket(parser.decodePacket(data));
};

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};
