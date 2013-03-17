
/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , parser = require('engine.io-parser')
  , util = require('../util')
  , debug = require('debug')('engine.io-client:websocket');

/**
 * Module exports.
 */

module.exports = WS;

/**
 * Global reference.
 */

var global = util.global();

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS(opts){
  Transport.call(this, opts);
  this.bufferedAmountId;
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

WS.prototype.doOpen = function(){
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var self = this;

  this.socket = new (ws())(this.uri());
  this.socket.onopen = function(){
    self.onOpen();
  };
  this.socket.onclose = function(){
    self.onClose();
  };
  this.socket.onmessage = function(ev){
    self.onData(ev.data);
  };
  this.socket.onerror = function(e){
    self.onError('websocket error', e);
  };
};

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function(packets){
  var self = this;
  // encodePayload instead of encodePacket
  this.writable = false;
  this.socket.send(parser.encodePayload(packets));
  // check periodically if we're done sending
  if ('bufferedAmount' in this.socket) {
    this.bufferedAmountId = this.setInterval(function() {
      if (this.socket.bufferedAmount == 0) {
        clearInterval(self.bufferedAmountId);
        this.writable = true;
        this.emit('drain');
      }
    }, 50);
  } else {
    // fake drain
    this.writable = true;
    this.emit('drain');
  }
};

WS.prototype.intervalCleanup = function(){
  if (this.bufferedAmountId) {
    clearInterval(this.bufferedAmountId);
  }
}

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function(){
  if (typeof this.socket !== 'undefined') {
    this.socket.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = +new Date;
  }

  query = util.qs(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.hostname + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function(){
  var websocket = ws();
  return !!websocket && !('__initialize' in websocket && this.name === WS.prototype.name);
};

/**
 * Getter for WS constructor.
 *
 * @api private
 */

function ws(){
  if ('undefined' == typeof window) {
    return require('ws');
  }

  return global.WebSocket || global.MozWebSocket;
}
