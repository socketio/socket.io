
/*!
 * Socket.IO - transports - JSONPPolling
 * Copyright (c) 2010-2011 Guillermo Rauch <guillermo@learnboost.com>
 * MIT Licensed
 */

var XHRPolling = require('./xhr-polling');

JSONPPolling = module.exports = function(){
  XHRPolling.apply(this, arguments);
};

/**
 * Inherit from `XHRPolling.prototype`.
 */

JSONPPolling.prototype.__proto__ = XHRPolling.prototype;

JSONPPolling.prototype.options = {
    timeout: null
  , closeTimeout: 8000
  , duration: 20000
};
  
JSONPPolling.prototype._onConnect = function(req, res){
  this._index = req.url.match(/\/([0-9]+)\/?$/).pop();
  XHRPolling.prototype._onConnect.call(this, req, res);
};
  
JSONPPolling.prototype._write = function(message){
  if (this._open){
    if (this.request.headers.origin && !this._verifyOrigin(this.request.headers.origin)){
      message = "alert('Cross domain security restrictions not met');";
    } else {
      message = "io.JSONP["+ this._index +"]._("+ JSON.stringify(message) +");";
    }
    this.response.writeHead(200, {'Content-Type': 'text/javascript; charset=UTF-8', 'Content-Length': Buffer.byteLength(message)});
    this.response.write(message);
    this.response.end();
    this._onClose();
  }
};
