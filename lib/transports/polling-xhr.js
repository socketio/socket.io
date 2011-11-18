
/*!
 * engine.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Transport = require('../transport')
  , Polling = require('./polling');

/**
 * Module exports.
 */

module.exports = XHRPolling;

/**
 * Ajax polling transport.
 *
 * @api public
 */

function XHRPolling (mng, req) {
  Transport.call(this, mng, req);
};

/**
 * Inherits from Transport.
 */

XHRPolling.prototype.__proto__ = Polling.prototype;

/**
 * Frames data prior to write.
 *
 * @api private
 */

XHRPolling.prototype.doWrite = function (data) {
  Polling.prototype.doWrite.call(this);

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
  this.log.debug(this.name + ' writing', data);
};
