
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
 * @param {http.ServerRequest}
 * @api public
 */

function WebSocket (req) {
  Transport.call(this, req);
  var self = this;
  this.socket = req.websocket;
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
 * Advertise upgrade support.
 *
 * @api public
 */

WebSocket.prototype.handlesUpgrades = true;

/**
 * Advertise framing support.
 *
 * @api public
 */

WebSocket.prototype.supportsFraming = true;

/**
 * Processes the incoming data.
 *
 * @param {String} encoded packet
 * @api private
 */

WebSocket.prototype.onData = function (data) {
  debug('received "%s"', data);
  Transport.prototype.onData.call(this, data);
};

/**
 * Writes a packet payload.
 *
 * @param {Array} packets
 * @api private
 */
var isIOS;
WebSocket.prototype.send = function (data){
  function send(packets){
    for (var i = 0, l = packets.length; i < l; i++) {
      var data = parser.encodePacket(packets[i]);
      debug('writing "%s"', data);
      this.writable = false;
      var self = this;
      this.socket.send(data, function (err){
        if (err) return self.onError('write error', err.stack);
        self.writable = true;
        self.emit('drain');
      });
    }
  }
  // Due to a bug in the current iOS browser, we need to wrap the send in a
  // setTimeout, when they resume from sleeping the browser will crash if
  // we don't allow the browser time to detect the socket has been closed
  isIOS = (isIOS !== undefined) ? isIOS : 'undefined' != typeof navigator
    && /iPad|iPhone|iPod/i.test(navigator.userAgent)
  if (isIOS) {
    var self = this;
    setTimeout(function() {
      send.call(self, data);
    }, 0);
  } else {
    send.call(this, data);
  }
}

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
