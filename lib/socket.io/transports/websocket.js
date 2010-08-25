var Client = require('../client'),
		url = require('url'),
		Buffer = require('buffer').Buffer,
		crypto = require('crypto'),

WebSocket = module.exports = function(){
	Client.apply(this, arguments);
};

require('sys').inherits(WebSocket, Client);

WebSocket.prototype._onConnect = function(req, socket){
	var self = this, headers = [];
	this.request = req;
	this.connection = socket;
	this.data = '';

	if (this.request.headers.upgrade !== 'WebSocket' || !this._verifyOrigin(this.request.headers.origin)){
		this.listener.options.log('WebSocket connection invalid');
		this.connection.writeHead(500);
		this.connection.end();
		return false;
	}

	this.connection.setTimeout(0);
	this.connection.setEncoding('utf8');
	this.connection.setNoDelay(true);

	if ('sec-websocket-key1' in this.request.headers){
		this.draft = 76;
	}

	if (this.draft == 76){
		var origin = this.request.headers.origin;
		
		headers = [
			'HTTP/1.1 101 WebSocket Protocol Handshake',
			'Upgrade: WebSocket',
			'Connection: Upgrade',
			'Sec-WebSocket-Origin: ' + (origin || 'null'),
			'Sec-WebSocket-Location: ws://' + this.request.headers.host + this.request.url
		];
		
		if ('sec-websocket-protocol' in this.request.headers){
			headers.push('Sec-WebSocket-Protocol: ' + this.request.headers['sec-websocket-protocol']);
		}
	} else {
		
		headers = [
			'HTTP/1.1 101 Web Socket Protocol Handshake',
			'Upgrade: WebSocket',
			'Connection: Upgrade',
			'WebSocket-Origin: ' + this.request.headers.origin,
			'WebSocket-Location: ws://' + this.request.headers.host + this.request.url
		];
		
		try {
			this.connection.write(headers.concat('', '').join('\r\n'));
		} catch(e){
			this._onClose();
		}
	}
	
	this.connection.addListener('end', function(){
		self._onClose();
	});
	
	this.connection.addListener('data', function(data){
		self._handle(data);
	});

	if (this._proveReception(headers)) this._payload();
};

WebSocket.prototype._handle = function(data){
	var chunk, chunks, chunk_count;
	this.data += data;
	chunks = this.data.split('\ufffd');
	chunk_count = chunks.length - 1;
	for (var i = 0; i < chunk_count; i++){
		chunk = chunks[i];
		if (chunk[0] !== '\u0000'){
			this.listener.options.log('Data incorrectly framed by UA. Dropping connection');
			this.connection.end();
			return false;
		}
		this._onMessage(chunk.slice(1));
	}
	this.data = chunks[chunks.length - 1];
};

// http://www.whatwg.org/specs/web-apps/current-work/complete/network.html#opening-handshake
WebSocket.prototype._proveReception = function(headers){
	var k1 = this.request.headers['sec-websocket-key1'],
			k2 = this.request.headers['sec-websocket-key2'];
	
	if (k1 && k2){
		var md5 = crypto.createHash('md5');

		[k1, k2].forEach(function(k){
			var n = parseInt(k.replace(/[^\d]/g, '')),
					spaces = k.replace(/[^ ]/g, '').length;
					
			if (spaces === 0 || n % spaces !== 0){
				this.listener.options.log('Invalid WebSocket key: "' + k + '". Dropping connection');
				this.connection.writeHead(500);
				this.connection.end();
				return false;
			}

			n /= spaces;
			
			md5.update(String.fromCharCode(
				n >> 24 & 0xFF,
				n >> 16 & 0xFF,
				n >> 8  & 0xFF,
				n       & 0xFF));
		});

		md5.update(this.upgradeHead.toString('binary'));
		
		try {
			this.connection.write(headers.concat('', '').join('\r\n') + md5.digest('binary'), 'binary');
		} catch(e){
			this._onClose();
		}
	}
	
	return true;
};

WebSocket.prototype._write = function(message){
	try {
		this.connection.write('\u0000', 'binary');
		this.connection.write(message, 'utf8');
		this.connection.write('\uffff', 'binary');
	} catch(e){
		this._onClose();
	}
};

WebSocket.httpUpgrade = true;