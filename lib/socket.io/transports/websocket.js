var Client = require('../client').Client, 
		url = require('url');

this.websocket = Client.extend({
  
	_onConnect: function(req, socket){
		var self = this;
		this.request = req;
		this.connection = socket;
		this.data = '';
		
		if (this.request.headers['upgrade'] !== 'WebSocket' || !this._verifyOrigin(this.request.headers['origin'])){
			this.listener.options.log('WebSocket connection invalid');
			this.connection.end();
		}
		
		this.connection.setTimeout(0);
		this.connection.setEncoding('utf8');
		this.connection.setNoDelay(true);
		this.connection.write([
			'HTTP/1.1 101 Web Socket Protocol Handshake', 
			'Upgrade: WebSocket', 
			'Connection: Upgrade',
			'WebSocket-Origin: ' + this.request.headers.origin,
			'WebSocket-Location: ws://' + this.request.headers.host + this.request.url,
			'', ''
		].join('\r\n'));
		this.connection.addListener('end', function(){ self._onClose(); });
		this.connection.addListener('data', function(data){ self._handle(data); });
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
				this.connection.destroy();
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
		this.connection.write('\u0000', 'binary');
		this.connection.write(message, 'utf8');
		this.connection.write('\uffff', 'binary');
	}
  
});

this.websocket.httpUpgrade = true;