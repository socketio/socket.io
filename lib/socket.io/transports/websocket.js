var Client = require('../client').Client, 
		url = require('url'),
		Buffer = require('buffer').Buffer,
		crypto = require('crypto');

exports.websocket = Client.extend({
  
	_onConnect: function(req, socket){
		var self = this, headers = [];
		this.request = req;
		this.connection = socket;
		this.data = '';
		
		if (this.request.headers.upgrade !== 'WebSocket' || !this._verifyOrigin(this.request.headers.origin)){
			this.listener.options.log('WebSocket connection invalid');
			this.connection.end();
		}
		
		this.connection.setTimeout(0);
		this.connection.setEncoding('utf8');
		this.connection.setNoDelay(true);
		
		headers = [
			'HTTP/1.1 101 Web Socket Protocol Handshake', 
			'Upgrade: WebSocket', 
			'Connection: Upgrade',
			'WebSocket-Origin: ' + this.request.headers.origin,
			'WebSocket-Location: ws://' + this.request.headers.host + this.request.url
		];
		
		if ('sec-websocket-key1' in this.request.headers){
		  headers.push(
		    'Sec-WebSocket-Origin: ' + this.request.headers.origin, 
		    'Sec-WebSocket-Location: ws://' + this.request.headers.host + this.request.url);
		}
		
		this.connection.write(headers.concat('', '').join('\r\n'));
		this.connection.addListener('end', function(){ self._onClose(); });
		this.connection.addListener('data', function(data){ self._handle(data); });
		if (this._proveReception()) {
			this._payload();
		}
	},
	
	_handle: function(data){
		var chunk, chunks, chunk_count;
		this.data += data;
		chunks = this.data.split('\ufffd');
		chunk_count = chunks.length - 1;
		for (var i = 0; i < chunk_count; i++) {
			chunk = chunks[i];
			if (chunk[0] !== '\u0000') {
				this.listener.options.log('Data incorrectly framed by UA. Dropping connection');
				this.connection.destroy();
				return false;
			}
			this._onMessage(chunk.slice(1));
		}
		this.data = chunks[chunks.length - 1];
	},

	// http://www.whatwg.org/specs/web-apps/current-work/complete/network.html#opening-handshake
	_proveReception: function(){
		var k1 = this.request.headers['sec-websocket-key1'],
		    k2 = this.request.headers['sec-websocket-key2'];
		if (k1 && k2) {
			var md5 = crypto.createHash('md5');

			[k1, k2].forEach(function(k) {
				var n = k.replace(/[^\d]/g, ''),
						spaces = k.replace(/[^ ]/g, '').length,
						buf = new Buffer(4);
				if (spaces === 0) {
					this.listener.options.log('Invalid WebSocket key: "' + k + '". Dropping connection');
					this.connection.destroy();
					return false;
				}

				n /= spaces;
				buf[3] = n & 0xff;
				buf[2] = (n >>= 8) & 0xff;
				buf[1] = (n >>= 8) & 0xff;
				buf[0] = (n >>= 8) & 0xff;

				md5.update(buf.toString('binary'));
			});
			
			md5.update(this.upgradeHead.toString('binary'));
			this.connection.write(md5.digest('binary'), 'binary');
		}
		return true;
	},

	_write: function(message){
		try {
			this.connection.write('\u0000', 'binary');
			this.connection.write(message, 'utf8');
			this.connection.write('\uffff', 'binary');
		} catch(e){
			this._onClose();
		}
	}
  
});

exports.websocket.httpUpgrade = true;