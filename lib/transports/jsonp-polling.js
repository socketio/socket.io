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

exports = module.exports = JSONPPolling;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function JSONPPolling (mng, data) {
  HTTPPolling.call(this, mng, data);

  this.head = 'io.j(';
  this.foot = ');';

  if (data.query.i) {
    this.head = 'io[' + data.query.i + '](';
  }
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
  HTTPPolling.prototype.doWrite.call(this);

  var data = data === undefined
      ? '' : this.head + JSON.stringify(data) + this.foot;

  this.response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=UTF-8'
    , 'Content-Length': Buffer.byteLength(data)
    , 'Connection': 'Keep-Alive'
  });

  this.response.write(data);
  this.log.debug('json-p writing', data);
};
