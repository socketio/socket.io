/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport')
  , EventEmitter = process.EventEmitter
  , crypto = require('crypto')
  , parser = require('../parser')
  , WebSocketRequest = require('websocket').request;

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
  // parser
  var self = this;

  this.websocketConfig = {
      // 64KiB max frame size.
      maxReceivedFrameSize: 0x10000,

      // 1MiB max message size, only applicable if
      // assembleFragments is true
      maxReceivedMessageSize: 0x100000,

      // Outgoing messages larger than fragmentationThreshold will be
      // split into multiple fragments.
      fragmentOutgoingMessages: false,

      // Outgoing frames are fragmented if they exceed this threshold.
      // Default is 16KiB
      fragmentationThreshold: 0x4000,

      // If true, the server will automatically send a ping to all
      // clients every 'keepaliveInterval' milliseconds.
      keepalive: false,

      // The interval to send keepalive pings to connected clients.
      keepaliveInterval: 20000,

      // If true, fragmented messages will be automatically assembled
      // and the full message will be emitted via a 'message' event.
      // If false, each frame will be emitted via a 'frame' event and
      // the application will be responsible for aggregating multiple
      // fragmented frames.  Single-frame messages will emit a 'message'
      // event in addition to the 'frame' event.
      // Most users will want to leave this set to 'true'
      assembleFragments: true,

      // The number of milliseconds to wait after sending a close frame
      // for an acknowledgement to come back before giving up and just
      // closing the socket.
      closeTimeout: 5000
  };

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
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function () {
  var self = this;

  this.buffer = true;
  this.buffered = [];

  var wsRequest = new WebSocketRequest(this.socket, this.req, this.websocketConfig);
  try {
    wsRequest.readHandshake();
  }
  catch(e) {
    wsRequest.reject(e.httpCode ? e.httpCode : 400, e.message, e.headers);
    this.log.warn(this.name + ' WebSocket: Invalid handshake: ' + e.message);
    return;
  }

  wsRequest.once('requestAccepted', function(wsConnection) {
    self.wsConnection = wsConnection;
    self.flush();

    wsConnection.on('message', function(message) {
      if (message.type === 'utf8') {
        self.onMessage(parser.decodePacket(message.utf8Data));
      }
      else if (message.type === 'binary') {
        self.log.warn(self.name + ' unsupported websocket binary message received.');
      }
    });
    wsConnection.on('close', function() {
      self.onClose();
    });
    wsConnection.on('error', function(error) {
      self.log.warn(self.name + ' connection error: ' + error);
    });
  });

  // TODO: Make the cross-origin and protocol handling secure
  wsRequest.accept(wsRequest.requestedProtocols[0], wsRequest.origin);
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function (data) {
  if (this.open) {
    this.drained = false;

    if (this.buffer) {
      this.buffered.push(data);
      return this;
    }

    this.wsConnection.sendUTF(data);
    this.drained = true;

    this.log.debug(this.name + ' writing', data);
  }
};

/**
 * Flushes the internal buffer
 *
 * @api private
 */

WebSocket.prototype.flush = function () {
  this.buffer = false;

  for (var i = 0, l = this.buffered.length; i < l; i++) {
    this.write(this.buffered.splice(0, 1)[0]);
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
  this.wsConnection.close();
};
