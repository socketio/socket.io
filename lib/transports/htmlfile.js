
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

function HTMLFile (mng, data) {
  HTTPTransport.call(this, mng, data);
};

/**
 * Inherits from Transport.
 */

HTMLFile.prototype.__proto__ = HTTPTransport.prototype;

/**
 * Handles the request.
 *
 * @api private
 */

HTMLFile.prototype.handleRequest = function (req) {
  HTTPTransport.prototype.handleRequest.call(this, req);

  if (req.method == 'GET') {
    req.res.writeHead(200, {
        'Content-Type': 'text/html'
      , 'Connection': 'keep-alive'
      , 'Transfer-Encoding': 'chunked'
    });

    req.res.write(
        '<html><body>'
      + '<script>var _ = function (msg) { parent.s.transport._(msg, document); };</script>'
      + new Array(174).join(' ')
    );
  }
};


/**
 * Performs the write.
 *
 * @api private
 */

HTMLFile.prototype.write = function (data) {
  //DVV: very bad to overwrite global _, it's usually for underscore.js :|
  // data = '<script>_(' + JSON.stringify(data) + ');</script>';
  data = '<script>parent.s.transport._(' + JSON.stringify(data) + ', document);</script>';

  this.drain = false;
  this.response.write(data);
  this.log.debug('htmlfile writing', data);
};
