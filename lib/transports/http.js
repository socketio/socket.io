
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
};

/**
 * Inherits from Transport.
 */

HTTPTransport.prototype.__proto__ = Transport.prototype;

/**
 * Handles a request.
 *
 * @api private
 */

HTTPTransport.prototype.handleRequest = function (req) {
  if (req.method == 'POST') {
    var buffer = ''
      , res = req.res;

    res.on('data', function (data) {
      buffer += data;
    });

    res.on('end', function () {
      self.onData(buffer);
    });
  } else {
    this.response = req.res;
    this.open = true;
    Transport.prototype.handleRequest.call(this, req);
  }
};

/**
 * Writes a payload of messages
 *
 * @api private
 */

HTTPTransport.prototype.payload = function (msgs) {
  this.write(parser.encodePayload(msgs));
};
