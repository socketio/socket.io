
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
  var self = this;
  this.socket = socket;
  this.socket.on('message', this.onData.bind(this));
  this.socket.once('close', this.onClose.bind(this));
  this.socket.on('error', this.onError.bind(this));
  this.socket.on('headers', function (headers) {
    self.emit('headers', headers);
  });
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
    
  //save packet item state in array
  var packetItems = [];
  for (var i = 0, l = packets.length; i < l; i++) {
    var data = parser.encodePacket(packets[i]);
    debug('writing', data);
    this.writable = false;
    var self = this;
    
    //TODO: review this part again
    packetItems.push(packets[i]);
    this.socket.send(data, function (err){
      if (err) return self.onError('write error', err.stack);
      
      var packetSeqId = null;
      if(packetItems.length > 0) {
        packetSeqId = packetItems[0].seq || null;
        packetItems.splice(0,1);
      }
      
      self.writable = true;
      if(packetSeqId != null) {
      	self.emit('drain', packetSeqId);
      } else {
      	self.emit('drain');
      }
    });
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
