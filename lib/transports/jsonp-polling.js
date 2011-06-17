
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
 * JSON-P interface constructor.
 *
 * @api public
 */

function JSONPPolling (mng, data) {
  HTTPPolling.call(this, mng, data);
  this.name = 'json-polling';

  this.head = 'io.j[0](';
  this.foot = ');';

  if (data.query.i) {
    this.head = 'io.j[' + data.query.i + '](';
  }
};

/**
 * Inherits from HTTPPolling.
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
  this.log.debug(this.name, 'writing', data);
};
