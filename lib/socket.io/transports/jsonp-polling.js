var XHRPolling = require('./xhr-polling');

JSONPPolling = module.exports = function(){
	Client.apply(this, arguments);
};

require('sys').inherits(JSONPPolling, XHRPolling);
	
JSONPPolling.prototype._onConnect = function(req, res){
	XHRPolling.prototype._onConnect.call(this, req, res);
	this._index = req.url.match(/\/([0-9]+)\/?$/).pop();
};
	
JSONPPolling.prototype._write = function(message){
	if (this._closeTimeout) clearTimeout(this._closeTimeout);
	this.response.writeHead(200, {'Content-Type': 'text/plain', 'Content-Length': message.length});
	if (this.request.headers.origin && !this._verifyOrigin(this.request.headers.origin)){
		this.response.write("<script>alert('Cross domain security restrictions not met')</script>");
		this.response.end();
	} else {
		this.response.write("<script>io.JSONP["+ this._index +"]._("+ JSON.stringify(message) +")</script>");
		this.response.end();
	}
	this._onClose();
};