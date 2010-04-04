var Client = require('../client').Client, 
		url = require('url');

this.websocket = Client.extend({
  
	_onConnect: function(req, res){
		var self = this;
		this.__super__(req, res);
		this.data = '';
		
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
			self.connection.setEncoding('utf8');
			self.connection.setNoDelay(true);
			self.connection.addListener('end', function(){ self._onClose(); });
			self.connection.addListener('data', function(data){ self._handle(data); });
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
	
	_handle: function(data){
		this.data += data;
		chunks = this.data.split('\ufffd');
	  chunk_count = chunks.length - 1;
	  for (var i = 0; i < chunk_count; i++) {
	    chunk = chunks[i];
	    if (chunk[0] != '\u0000') {
	      this.listener.options.log('Data incorrectly framed by UA. Dropping connection');
	      this.connection.close();
	      return false;
	    }

	    this._onMessage(chunk.slice(1));
	  }

	  this.data = chunks[chunks.length - 1];
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