
/*!
 * Socket.IO - transports - JSONPPolling
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var XHRPolling = require('./xhr-polling');

/**
 * Expose `JSONPPolling`.
 */

module.exports = JSONPPolling;

/**
 * Initialize a `JSONPPolling` client.
 *
 * @api private
 */

function JSONPPolling() {
  XHRPolling.apply(this, arguments);
};

/**
 * Inherit from `XHRPolling.prototype`.
 */

JSONPPolling.prototype.__proto__ = XHRPolling.prototype;

/**
 * Options.
 */

JSONPPolling.prototype.options = {
    timeout: null
  , closeTimeout: 8000
  , duration: 20000
};

/**
 * Connection implementation.
 * 
 * @api private
 */
  
JSONPPolling.prototype._onConnect = function(req, res){
  this._index = req.url.match(/\/([0-9]+)\/?$/).pop();
  XHRPolling.prototype._onConnect.call(this, req, res);
};

/**
 * Write implementation.
 * 
 * @param {String} message
 * @api private
 */

JSONPPolling.prototype._write = function(message){
  if (this._open){
    var req = this.request
      , res = this.response
      , origin = req.headers.origin;

    if (origin && !this._verifyOrigin(origin)){
      message = "alert('Cross domain security restrictions not met');";
    } else {
      message = "io.JSONP["+ this._index +"]._("+ JSON.stringify(message) +");";
    }

    res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
    res.setHeader('Content-Length', Buffer.byteLength(message));
    res.end(message);
    this._onClose();
  }
};
