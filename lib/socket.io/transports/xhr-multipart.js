var Client = require('../client').Client, 
	qs = require('querystring');

exports['xhr-multipart'] = Client.extend({

	options: {
		pingInterval: 7000
	},
	
	_pingInterval: null,

	_onConnect: function(req, res){
		var self = this, body = '', headers = {};
		// https://developer.mozilla.org/En/HTTP_Access_Control
		if (req.headers.origin && this._verifyOrigin(req.headers.origin)) {
			headers['Access-Control-Allow-Origin'] = req.headers.origin;
			headers['Access-Control-Allow-Credentials'] = 'true';
		}
		if (typeof req.headers['access-control-request-method'] !== 'undefined') {
			// CORS preflight message
			headers['Access-Control-Allow-Methods'] = req.headers['access-control-request-method'];
			res.writeHead(200, headers);
			res.write('ok');
			res.end();
			return;
		}
		switch (req.method){
			case 'GET':
				this.__super__(req, res);
				headers['Content-Type'] = 'multipart/x-mixed-replace;boundary="socketio"';
				headers['Connection'] = 'keep-alive';
				this.request.connection.addListener('end', function(){ self._onClose(); });
				this.response.useChunkedEncodingByDefault = false;
				this.response.shouldKeepAlive = true;
				this.response.writeHead(200, headers);
				this.response.write("--socketio\n");
				this.response.flush();
				this._payload();
				this._heartbeatInterval = setInterval(function(){
					self._write(String.fromCharCode(6));
				}, this.options.heartbeatInterval);
				break;
				
			case 'POST':
				req.addListener('data', function(message){
					body += message.toString();
				});
				req.addListener('end', function(){
					try {
						var msg = qs.parse(body);
						self._onMessage(msg.data);
					} catch(e){}
					res.writeHead(200, headers);
					res.write('ok');
					res.end();
					body = '';
				});
				break;
		}
	},
	
	_write: function(message){
		this.response.write("Content-Type: text/plain" + (message.length === 1 && message.charCodeAt(0) === 6 ? "; charset=us-ascii" : "") + "\n\n");
		this.response.write(message + "\n");
		this.response.write("--socketio\n");
		this.response.flush();
	}
	
});