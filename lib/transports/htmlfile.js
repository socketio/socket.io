
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

exports = module.exports = HTMLFile;

/**
 * HTMLFile transport constructor.
 *
 * @api public
 */

function HTMLFile (data, request) {
  HTTPTransport.call(this, data, request);
}

/**
 * Inherits from Transport.
 */

HTMLFile.prototype.__proto__ = HTTPTransport.prototype;

/**
 * Handles the request.
 *
 * @api private
 */

HTMLFile.prototype.handleRequest = function handleRequest (req) {
  HTTPTransport.prototype.handleRequest.call(this, req);

  if (req.method == 'GET') {
    req.res.writeHead(200, {
      'Content-Type': 'text/html',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked'
    });

    req.res.write(
        '<html><body>'
      + '<script>var _ = function (msg) { parent.s._(msg, document); };</script>'
      + new Array(174).join(' ')
    );
  }
};


/**
 * Performs the write.
 *
 * @api private
 */

HTMLFile.prototype.doWrite = function doWrite (data) {
  data = '<script>_(' + JSON.stringify(data) + ');</script>';

  this.response.write(data);
  this.log.debug('htmlfile writing', data);
};
