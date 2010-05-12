var Client = require('../client').Client, 
	qs = require('querystring'),
	sys = require('sys');

this['xhr-polling'] = Client.extend({
	
	options: {
		closeTimeout: 5000,
		duration: 20000
	},
	
	_onConnect: function(req, res){
		var self = this, body = '';
		switch (req.method){
			case 'GET':
				this.__super__(req, res);			
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
		if (this._closeTimeout) clearTimeout(this._closeTimeout);
		this.response.writeHead(200, {'Content-Type': 'text/plain', 'Content-Length': message.length});
		this.response.write(message);
		this.response.end();
		this._onClose();
	}
	
});