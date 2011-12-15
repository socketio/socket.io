
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , util = require('../util')
  , global = this

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS (opts) {
  Transport.call(this, opts);
};

/**
 * Inherits from Transport.
 */

util.inherits(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function () {
  if (!check()) {
    // let probe timeout
    return;
  }

  this.socket = new ws()(this.uri);
  this.socket.onopen = function () {
    self.onOpen();
  };
  this.socket.onclose = function () {
    self.onClose();
  };
  this.socket.ondata = function (ev) {
    self.onData(ev.data);
  };
};

/**
 * Writes data to socket.
 *
 * @param {String} data.
 * @param {Function} flush callback.
 * @api private
 */

WS.prototype.write = function (data, fn) {
  this.socket.send(data);
  fn();
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @api private
 */

WS.prototype.writeMany = function (packets) {
  for (var i = 0, l = packets.length; i < l; i++) {
    this.write(packets[0]);
  }
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function () {
  this.socket.close();
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function () {
  return [
      this.options.secure ? 'wss' : 'ws'
    , this.options.host
    , ':'
    , this.options.port
    , this.options.path
    , this.options.query
  ].join('')
};

/**
 * Getter for WS constructor.
 *
 * @api private
 */

function ws () {
  // if node
  return require('easy-websocket');
  // end

  return global.WebSocket || global.MozWebSocket;
}

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

function check () {
  return !!ws();
}
