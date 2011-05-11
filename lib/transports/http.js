
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
      , res = req.res;

    res.on('data', function data (data) {
      buffer += data;
    });

    res.on('end', function end () {
      self.onData(buffer);
    });
  } else {
    var self = this;

    this.response = req.res;
    this.open = true;

    Transport.prototype.handleRequest.call(this, req);
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
