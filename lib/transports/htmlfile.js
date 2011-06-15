
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
      // DVV: if we don't send define _ here, but use <script>parent.s._(...)</script> inline in #write(),
      // the problem vanishes
      //+ '<script>var _ = function (msg) { parent.s._(msg, document); };</script>'
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
  // DVV: defining _ once (see above) causes JScript Run-time Errors 5011 "Can't execute code from a freed script"
  //data = '<script>_(' + JSON.stringify(data) + ');</script>';
  data = '<script>parent.s._(' + JSON.stringify(data) + ', document);</script>';

  this.drained = false;
  this.response.write(data);
  this.log.debug('htmlfile writing', data);
};
