
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('../parser')
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

  var self = this;

  this.socket = new (ws())(this.uri());
  this.socket.onopen = function () {
    self.onOpen();
  };
  this.socket.onclose = function () {
    self.onClose();
  };
  this.socket.onmessage = function (ev) {
    self.onData(ev.data);
  };
  this.socket.onerror = function (e) {
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @param {Function} drain callback.
 * @api private
 */

WS.prototype.write = function (packets, fn) {
  for (var i = 0, l = packets.length; i < l; i++) {
    this.socket.send(parser.encodePacket(packets[i]));
  }
  fn();
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
  var query = util.qs(this.query)
    , schema = this.secure ? 'wss' : 'ws'
    , port = ''

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.host + port + this.path + query;
};

/**
 * Getter for WS constructor.
 *
 * @api private
 */

function ws () {
  // if node
  return require('ws');
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
