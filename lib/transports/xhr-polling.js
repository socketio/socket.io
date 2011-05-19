
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var HTTPPolling = require('./http-polling');

/**
 * Export the constructor.
 */

exports = module.exports = XHRPolling;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHRPolling (mng, data) {
  HTTPPolling.call(this, mng, data);
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
  HTTPPolling.prototype.doWrite.call(this);

  var origin = this.req.headers.origin
    , headers = {
          'Content-Type': 'text/plain; charset=UTF-8'
        , 'Content-Length': data === undefined ? 0 : Buffer.byteLength(data)
        , 'Connection': 'Keep-Alive'
      };

  if (origin) {
    // https://developer.mozilla.org/En/HTTP_Access_Control
    headers['Access-Control-Allow-Origin'] = '*';

    if (this.req.headers.cookie) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  this.response.writeHead(200, headers);
  this.response.write(data);
  this.log.debug('xhr-polling writing', data);
};
