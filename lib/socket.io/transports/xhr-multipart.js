var Client = require('../client').Client, 
	qs = require('querystring');

this['xhr-multipart'] = Client.extend({

	options: {
		pingInterval: 7000
	},
	
	_pingInterval: null,

	_onConnect: function(req, res){
		var self = this, body = '';
		switch (req.method){
			case 'GET':
				var self = this;		
				this.__super__(req, res);
				var headers = {'Content-Type': 'multipart/x-mixed-replace;boundary="socketio"', 'Connection': 'keep-alive'};
				// For newer browsers that support CORS (cross-domain XHR) -- see: https://developer.mozilla.org/En/HTTP_Access_Control
				if (this.request.headers['origin'] && this._verifyOrigin(this.request.headers['origin'])) {
					headers['Access-Control-Allow-Origin'] = this.request.headers['origin'];
					if (this.request.headers['cookie'])
						headers['Access-Control-Allow-Credentials'] = 'true';
				}
				this.request.connection.addListener('end', function(){ self._onClose(); });
				this.response.useChunkedEncodingByDefault = false;
				this.response.shouldKeepAlive = true;
				this.response.writeHead(200, headers);
				this.response.write("--socketio\n");
				this.response.flush();
				this._payload();
				this._pingInterval = setInterval(function() {
					if (self.connected)
						self._write(String.fromCharCode(6));
					else
						clearInterval(self._pingInterval);
				}, this.options.pingInterval);
				break;
				
			case 'POST':
				req.addListener('data', function(message){
					body += message;
				});
				req.addListener('end', function(){
					try {
						var msg = qs.parse(body);
						self._onMessage(msg.data);
					} catch(e){}			
					res.writeHead(200);
					res.write('ok');
					res.end();
				});
				break;
		}
	},
	
	_write: function(message){
		this.response.write("Content-Type: text/plain" + (message.length == 1 && message.charCodeAt(0) == 6 ? "; charset=us-ascii" : "") + "\n\n");
		this.response.write(message + "\n");
		this.response.write("--socketio\n");
		this.response.flush();
	}
	
});