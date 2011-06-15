
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var HTTPTransport = require('./http');

/**
 * Export the constructor.
 */

exports = module.exports = XHRMultipart;

/**
 * XHRMultipart transport constructor.
 *
 * @api public
 */

function XHRMultipart (mng, data) {
  HTTPTransport.call(this, mng, data);
};

/**
 * Inherits from Transport.
 */

XHRMultipart.prototype.__proto__ = HTTPTransport.prototype;

/**
 * Handles the request.
 *
 * @api private
 */

XHRMultipart.prototype.handleRequest = function (req) {
  HTTPTransport.prototype.handleRequest.call(this, req);

  if (req.method === 'GET') {
    req.res.useChunkedEncodingByDefault = false;
    req.res.shouldKeepAlive = true;
    req.res.writeHead(200, {
        'Content-Type': 'text/html'
      , 'Connection': 'keep-alive'
      , 'Transfer-Encoding': 'chunked'
      , 'Content-Type': 'multipart/x-mixed-replace; boundary="socketio"'
    });
  }
};


/**
 * Performs the write.
 *
 * @api private
 */

XHRMultipart.prototype.write = function (data) {
  this.drained = false;
  this.response.write('Content-Type: text/plain; charset=UTF-8\n\n');
  this.response.write(data + '\n--socketio\n');
  this.log.debug('xhr-multipart writing', data);
};
