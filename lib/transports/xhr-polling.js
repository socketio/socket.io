
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

exports = module.exports = XHRPolling;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHRPolling (data, request) {
  HTTPPolling.call(this, data, request);
};

/**
 * Inherits from Transport.
 */

XHRPolling.prototype.__proto__ = HTTPPolling.prototype;

/**
 * Frames data prior to write.
 *
 * @api private
 */

XHRPolling.prototype.doWrite = function (data) {
  var origin = this.req.headers.origin
    , headers = {
          'Content-Type': 'text/plain; charset=UTF-8'
        , 'Content-Length': Buffer.byteLength(data)
        , 'Connection': 'Keep-Alive'
      };

  // https://developer.mozilla.org/En/HTTP_Access_Control
  headers['Access-Control-Allow-Origin'] = '*';

  if (this.req.headers.cookie) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  this.response.writeHead(200, headers);
  this.response.write(data);
  this.log.debug('writing', data);
};
