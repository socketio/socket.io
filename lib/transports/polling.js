
/*!
 * engine.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../transport')
  , XHR = require('./polling-xhr')
  , JSONP = require('./polling-jsonp')

/**
 * Exports the constructor.
 */

module.exports = HTTPPolling;

/**
 * HTTP polling constructor.
 *
 * @api public.
 */

function HTTPPolling (mng, req) {
  if (~req.url.indexOf('jsonp')) {
    return new JSONP(mng, req);
  } else {
    return new XHR(mng, req);
  }
};

/**
 * Inherits from Transport.
 *
 * @api public.
 */

HTTPPolling.prototype.__proto__ = Transport.prototype;

/**
 * Clears polling timeout
 *
 * @api private
 */

HTTPPolling.prototype.clearPollTimeout = function () {
  if (this.pollTimeout) {
    clearTimeout(this.pollTimeout);
    this.pollTimeout = null;
    this.log.debug('clearing poll timeout');
  }

  return this;
};

/**
 * Override clear timeouts to clear the poll timeout
 *
 * @api private
 */

HTTPPolling.prototype.clearTimeouts = function () {
  HTTPTransport.prototype.clearTimeouts.call(this);

  this.clearPollTimeout();
};

/**
 * doWrite to clear poll timeout
 *
 * @api private
 */

HTTPPolling.prototype.doWrite = function () {
  this.clearPollTimeout();
};

/**
 * Performs a write.
 *
 * @api private.
 */

HTTPPolling.prototype.write = function (data, close) {
  this.doWrite(data);
  this.response.end();
  this.onClose();
};

/**
 * Override end.
 *
 * @api private
 */

HTTPPolling.prototype.end = function () {
  this.clearPollTimeout();
  return HTTPTransport.prototype.end.call(this);
};


/**
 * Handles a request.
 *
 * @api private
 */

HTTPTransport.prototype.handleRequest = function (req) {
  if (req.method == 'POST') {
    var buffer = ''
      , res = req.res
      , origin = req.headers.origin
      , headers = { 'Content-Length': 1 }
      , self = this;

    req.on('data', function (data) {
      buffer += data;
    });

    req.on('end', function () {
      res.writeHead(200, headers);
      res.end('1');

      self.onData(self.postEncoded ? qs.parse(buffer).d : buffer);
    });

    if (origin) {
      // https://developer.mozilla.org/En/HTTP_Access_Control
      headers['Access-Control-Allow-Origin'] = '*';

      if (req.headers.cookie) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }
  } else {
    this.response = req.res;

    if (req.method == 'GET') {
      var self = this;

      this.pollTimeout = setTimeout(function () {
        self.packet({ type: 'noop' });
        self.log.debug(self.name + ' closed due to exceeded duration');
      }, this.manager.get('polling duration') * 1000);

      this.log.debug('setting poll timeout');
    }
  }
};

/**
 * Handles data payload.
 *
 * @api private
 */

HTTPTransport.prototype.onData = function (data) {
  var messages = parser.decodePayload(data);
  this.log.debug(this.name + ' received data packet', data);

  for (var i = 0, l = messages.length; i < l; i++) {
    this.onMessage(messages[i]);
  }
};

/**
 * Closes the request-response cycle
 *
 * @api private
 */

HTTPTransport.prototype.doClose = function () {
  this.response.end();
};

/**
 * Writes a payload of messages
 *
 * @api private
 */

HTTPTransport.prototype.payload = function (msgs) {
  this.write(parser.encodePayload(msgs));
};
