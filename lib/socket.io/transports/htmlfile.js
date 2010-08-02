var	Client = require('../client'),
		qs = require('querystring'),

HTMLFile = module.exports = function(){
	Client.apply(this, arguments);
};

require('sys').inherits(HTMLFile, Client);
	
HTMLFile.prototype._onConnect = function(req, res){
	var self = this, body = '';
	switch (req.method){
		case 'GET':
			Client.prototype._onConnect.apply(this, [req, res]);
			this.request.connection.addListener('close', function(){ self._onClose(); });
			this.response.useChunkedEncodingByDefault = true;
			this.response.shouldKeepAlive = true;
			this.response.writeHead(200, {
				'Content-Type': 'text/html',
				'Connection': 'keep-alive',
				'Transfer-Encoding': 'chunked'
			});
			this.response.write('<html><body>' + new Array(244).join(' '));
			if ('flush' in this.response) this.response.flush();
			this._payload();
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
				res.writeHead(200, {'Content-Type': 'text/plain'});
				res.write('ok');
				res.end();
			});
			break;
	}
};
	
HTMLFile.prototype._write = function(message){
	this.response.write('<script>parent.s._('+ JSON.stringify(message) +', document);</script>'); //json for escaping
	if ('flush' in this.response) this.response.flush();
};