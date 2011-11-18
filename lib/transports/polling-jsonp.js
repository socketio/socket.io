
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

module.exports = JSONPPolling;

/**
 * JSON-P polling transport.
 *
 * @api public
 */

function JSONPPolling (mng, req) {
  Transport.call(this, mng, req);

  this.head = 'io.j[0](';
  this.foot = ');';

  // TODO: avoid query parsing and do a simple regexp
  if (req.query.jsonp) {
    this.head = 'io.j[' + req.query.jsonp + '](';
  }
};

/**
 * Inherits from Transport.
 */

JSONPPolling.prototype.__proto__ = Polling.prototype;

/**
 * Make sure POST are decoded.
 */

JSONPPolling.prototype.postEncoded = true;

/**
 * Handles incoming data.
 * Due to a bug in \n handling by browsers, we expect a JSONified string.
 *
 * @api private
 */

JSONPPolling.prototype.onData = function (data) {
  try {
    data = JSON.parse(data);
  } catch (e) {
    this.error('parse', 'reconnect');
    return;
  }

  HTTPPolling.prototype.onData.call(this, data);
};

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
    , 'X-XSS-Protection': '0'
  });

  this.response.write(data);
  this.log.debug(this.name + ' writing', data);
};
