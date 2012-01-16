
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('../parser')
  , debug = require('debug')('engine:ws')

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
 * Processes the incoming data.
 * 
 * @param {String} encoded packet
 * @api private
 */

WebSocket.prototype.onData = function (data) {
  debug('data', data);
  Transport.prototype.onData.call(this, data);
};

/**
 * Writes a packet payload.
 *
 * @param {Array} packets
 * @api private
 */

WebSocket.prototype.send = function (packets) {
  for (var i = 0, l = packets.length; i < l; i++) {
    var data = parser.encodePacket(packets[i]);
    debug('writing', data);
    this.socket.send(data);
  }
};

/**
 * Closes the transport.
 *
 * @api private
 */

WebSocket.prototype.doClose = function (fn) {
  debug('closing');
  this.socket.close();
  fn && fn();
};
