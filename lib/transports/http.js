/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport')
  , parser = require('../parser');

/**
 * Export the constructor.
 */

exports = module.exports = HTTPTransport;

/**
 * HTTP interface constructor. For all non-websocket transports.
 *
 * @api public
 */

function HTTPTransport (mng, data) {
  Transport.call(this, mng, data);
}

/**
 * Inherits from Transport.
 */

HTTPTransport.prototype.__proto__ = Transport.prototype;

/**
 * Handles a request.
 *
 * @api private
 */

HTTPTransport.prototype.handleRequest = function handleRequest (req) {
  if (req.method == 'POST') {
    var buffer = ''
      , res = req.res
      , self = this;

    req.on('data', function (data) {
      buffer += data;
    });

    req.on('end', function () {
      self.onData(buffer);
    });

    res.writeHead(200);
    res.end('');
  } else {
    this.response = req.res;

    Transport.prototype.handleRequest.call(this, req);
  }
};

/**
 * Handles data payload.
 *
 * @api private
 */

HTTPTransport.prototype.onData = function onData (data) {
  var messages = parser.decodePayload(data);

  for (var i = 0, l = messages.length; i < l; i++) {
    this.onMessage(messages[i]);
  }
};

/**
 * Closes the request-response cycle
 *
 * @api private
 */

HTTPTransport.prototype.doClose = function doClose () {
  this.response.end();
};

/**
 * Writes a payload of messages
 *
 * @api private
 */

HTTPTransport.prototype.payload = function payload (msgs) {
  this.write(parser.encodePayload(msgs));
};
