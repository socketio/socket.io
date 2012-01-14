
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , debug = require('debug')('engine:transport')

/**
 * Export the constructor.
 */

module.exports = WebSocket;

/**
 * WebSocket transport 
 *
 * @param {wsio.Socket}
 * @api public
 */

function WebSocket (socket) {
  Transport.call(this, socket.req);
  this.socket = socket;
  this.socket.on('message', this.onData.bind(this));
  this.socket.once('close', this.onClose.bind(this));
  this.writable = true;
};

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Transport name
 *
 * @api public
 */

WebSocket.prototype.name = 'websocket';

/**
 * Writes a packet payload.
 *
 * @param {Array} packets
 * @api private
 */

WebSocket.prototype.send = function (packets) {
  // debug: ws writing packets, JSON.stringify(packets)
  for (var i = 0, l = packets.length; i < l; i++) {
    this.socket.send(parser.encodePacket(packets[i]));
  }
};

/**
 * Closes the transport.
 *
 * @api private
 */

WebSocket.prototype.doClose = function (fn) {
  this.socket.close();
  fn();
};
