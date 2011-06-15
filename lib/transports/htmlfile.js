
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
      // DVV: this causes JScript Run-time Errors 5011 "Can't execute code from a freed script"
      // DVV: when the window is quickly refreshed several times.
      // DVV: indeed, this script is namely doesn't exist, when we try to use it!
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

HTMLFile.prototype.write = function (data) {
  //data = '<script>_(' + JSON.stringify(data) + ');</script>';
  // DVV: This try/catch illustrates the problem -- we send packets to transport which should be considered closed
  data = '<script>try{_(' + JSON.stringify(data) + ');}catch(err){console.error("Martian caught!")}</script>';
  //data = '<script>parent.s._(' + JSON.stringify(data) + ', document);</script>';

  this.drained = false;
  this.response.write(data);
  this.log.debug('htmlfile writing', data);
};
