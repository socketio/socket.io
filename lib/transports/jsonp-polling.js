
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

const HTTPPolling = require('./http-polling');

/**
 * Export the constructor.
 */

exports = module.exports = JSONPPolling;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function JSONPPolling (data, request) {
  HTTPPolling.call(this, data, request);
};

/**
 * Inherits from Transport.
 */

JSONPPolling.prototype.__proto__ = HTTPPolling.prototype;

/**
 * Performs the write.
 *
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data) {
  this.response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=UTF-8'
    , 'Content-Length': Buffer.byteLength(data)
    , 'Connection': 'Keep-Alive'
  });

  this.response.write(data);
  this.log.debug('writing', data);
};
