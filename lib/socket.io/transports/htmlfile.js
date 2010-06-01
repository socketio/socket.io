var Client = require('../client').Client, 
	qs = require('querystring');

exports.htmlfile = Client.extend({
	
	_onConnect: function(req, res){
		var self = this, body = '';
		switch (req.method){
			case 'GET':
				this.__super__(req, res);
				this.request.connection.addListener('close', function(){ self._onClose(); });
				this.response.useChunkedEncodingByDefault = true;
				this.response.shouldKeepAlive = true;
				this.response.writeHead(200, {
					'Content-Type': 'text/html',
					'Connection': 'keep-alive',
					'Transfer-Encoding': 'chunked'
				});
				this.response.write('<html><body>' + new Array(244).join(' '));
				this.response.flush();
				this._payload();
				this._heartbeatInterval = setInterval(function(){
					self.response.write('<!-- heartbeat -->');
					self.response.flush();
				}, this.options.heartbeatInterval);
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
		this.response.write('<script>parent.s._('+ message +', document);</script>');
		this.response.flush();
	}
	
});