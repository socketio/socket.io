var Client = require('../client').Client, 
	url = require('url'),
	sys = require('sys');

this.websocket = Client.extend({
  
	_onConnect: function(req, res){		
		var self = this;
		this.__super__(req, res);				
		
		if (this.request.headers['connection'] !== 'Upgrade' 
			|| this.request.headers['upgrade'] !== 'WebSocket' 
			|| !this._verifyOrigin(this.request.headers['origin'])){
			this.listener.options.log('WebSocket connection invalid');
			this.connection.close();
			return;
		}
				
		this.request.addListener('end', function(){
			if (!('hijack' in self.connection)){
				throw new Error('You have to patch Node! Please refer to the README');
			}

			self.connection.hijack();
			self.connection.setTimeout(0);
			self.connection.setNoDelay(true);
			self.connection.addListener('end', function(){ self._onClose(); });							
			self.connection.addListener('data', function(data){
			    if (data[0] !== '\u0000' && data[data.length - 1] !== '\ufffd'){
					self.connection.close();
			    } else {
					self._onMessage(data.substr(1, data.length - 2));
				}
		    });
		});
		
		this.response.use_chunked_encoding_by_default = false;
	    this.response.writeHeader(101, 'Web Socket Protocol Handshake', {
			'Upgrade': 'WebSocket',
			'Connection': 'Upgrade',
			'WebSocket-Origin': this.request.headers.origin,
			'WebSocket-Location': 'ws://' + this.request.headers.host + this.request.url
	    });
	    this.response.flush();
		
		this._payload();
	},
	
	_verifyOrigin: function(origin){
		var parts = url.parse(origin);
		return this.listener.options.origins.indexOf('*:*') !== -1
			|| this.listener.options.origins.indexOf(parts.host + ':' + parts.port) !== -1 
			|| this.listener.options.origins.indexOf(parts.host + ':*') !== -1 
			|| this.listener.options.origins.indexOf('*:' + parts.port) !== -1;
	},
	
	_write: function(message){
		this.connection.write('\u0000' + message + '\uffff');
	}
  
});