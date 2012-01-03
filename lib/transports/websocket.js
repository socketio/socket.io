
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , debug = require('debug')('engine.transport')

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
 * Writes a packet.
 *
 * @param {Object} packet
 * @api private
 */

WebSocket.prototype.send = function (packet) {
  debug('ws writing packet: type %s | data %s', packet.type, packet.data);
  this.socket.send(parser.encodePacket(packet));
};

/**
 * Closes the transport.
 *
 * @api private
 */

WebSocket.prototype.doClose = function () {
  this.socket.close();
};
