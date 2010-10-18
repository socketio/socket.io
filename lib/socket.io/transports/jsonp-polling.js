var XHRPolling = require('./xhr-polling');

JSONPPolling = module.exports = function(){
  XHRPolling.apply(this, arguments);
};

require('sys').inherits(JSONPPolling, XHRPolling);
  
JSONPPolling.prototype.getOptions = function(){
  return {
    timeout: null, // no heartbeats
    closeTimeout: 8000,
    duration: 20000
  };
};
  
JSONPPolling.prototype._onConnect = function(req, res){
  this._index = req.url.match(/\/([0-9]+)\/?$/).pop();
  XHRPolling.prototype._onConnect.call(this, req, res);
};
  
JSONPPolling.prototype._write = function(message){
  if (this._closeTimeout) clearTimeout(this._closeTimeout);
  if (this.request.headers.origin && !this._verifyOrigin(this.request.headers.origin)){
    message = "alert('Cross domain security restrictions not met');";
  } else {
    message = "io.JSONP["+ this._index +"]._("+ JSON.stringify(message) +");";
  }
  this.response.writeHead(200, {'Content-Type': 'text/javascript; charset=UTF-8', 'Content-Length': Buffer.byteLength(message)});
  this.response.write(message);
  this.response.end();
  this._onClose();
};