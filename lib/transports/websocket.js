
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var url = require('url')
  , parser = require('../parser')
  , Transport = require('../transport');

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

function WebSocket (mng, data, req) {
  Transport.call(this, mng, data, req);
  var self = this;
  this.wsclient = req.wsclient;
  req.wsclient.onerror = function(){
    self.end('socket error');
  };
  req.wsclient.onclose = function(){
    self.end('socket end');
  };
  req.wsclient.onmessage = function(ev){
    self.onMessage(parser.decodePacket(ev.data));
  };
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
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function (data) {
  this.wsclient.send(data);
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function () {
  this.req.socket.end();
};
