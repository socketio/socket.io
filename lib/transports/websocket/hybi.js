
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
 
/**
 * Module requirements.
 */

var Transport = require('../../transport')
  , EventEmitter = process.EventEmitter
  , crypto = require('crypto')
  , url = require('url')
  , parser = require('../../parser')
  , WebSocketServer = require('ws').Server
  , util = require('../../util');

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
  var self = this;
  this.wss = new WebSocketServer({
    noServer: true, 
    verifyOrigin: function(o) { return self.verifyOrigin(o); }
  });
  this.manager = mng;
  Transport.call(this, mng, data, req);
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
 * Websocket draft version
 *
 * @api public
 */

WebSocket.prototype.protocolVersion = 'hybi';

/**
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function () {
  var self = this;
  this.ws = this.wss.handleUpgrade(this.req, this.socket);
  if (this.ws) {
    this.ws.on('message', function(message) {
      self.onMessage(parser.decodePacket(message));    
    });
    this.ws.on('close', function () {
      self.end();
    });
    this.ws.on('error', function (reason) {
      self.log.warn(self.name + ' parser error: ' + reason);
      self.end();
    });
  }
  else this.end();
};

/**
 * Verifies the origin of a request.
 *
 * @api private
 */

WebSocket.prototype.verifyOrigin = function (origin) {
  var origins = this.manager.get('origins');

  if (origin === 'null') origin = '*';

  if (origins.indexOf('*:*') !== -1) {
    return true;
  }

  if (origin) {
    try {
      var parts = url.parse(origin);
      parts.port = parts.port || 80;
      var ok =
        ~origins.indexOf(parts.hostname + ':' + parts.port) ||
        ~origins.indexOf(parts.hostname + ':*') ||
        ~origins.indexOf('*:' + parts.port);
      if (!ok) this.log.warn('illegal origin: ' + origin);
      return ok;
    } catch (ex) {
      this.log.warn('error parsing origin');
    }
  }
  else {
    this.log.warn('origin missing from websocket call, yet required by config');        
  }
  return false;
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function (data) {
  if (this.open && this.ws) {
    this.ws.send(data);
    this.log.debug(this.name + ' writing', data);
  }
};

/**
 * Writes a payload.
 *
 * @api private
 */

WebSocket.prototype.payload = function (msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.write(msgs[i]);
  }
  return this;
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function () {
  this.socket.end();
};
