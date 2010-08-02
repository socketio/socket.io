var Client = require('../client'), 
		qs = require('querystring'),

Polling = module.exports = function(){
	Client.apply(this, arguments);
};

require('sys').inherits(Polling, Client);

Polling.prototype._onConnect = function(req, res){
	var self = this, body = '';
	switch (req.method){
		case 'GET':
			Client.prototype._onConnect.apply(this, [req, res]);
			this.request.connection.addListener('end', function(){ self._onClose(); });
			this._closeTimeout = setTimeout(function(){
				self._write('');
			}, this.options.duration);
			this._payload();
			break;
			
		case 'POST':
			req.addListener('data', function(message){
				body += message;
			});
			req.addListener('end', function(){
				try {
					// optimization: just strip first 5 characters here?
					var msg = qs.parse(body);
					self._onMessage(msg.data);
				} catch(e){}
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.write('ok');
				res.end();
			});
			break;
	}
};
	
Polling.prototype._write = function(message){
	if (this._closeTimeout) clearTimeout(this._closeTimeout);
	var headers = {'Content-Type': 'text/plain', 'Content-Length': message.length};
	// https://developer.mozilla.org/En/HTTP_Access_Control
	if (this.request.headers.origin && this._verifyOrigin(this.request.headers.origin)){
		headers['Access-Control-Allow-Origin'] = this.request.headersorigin;
		if (this.request.headers.cookie) headers['Access-Control-Allow-Credentials'] = 'true';
	}
	this.response.writeHead(200, headers);
	this.response.write(message);
	this.response.end();
	this._onClose();
};