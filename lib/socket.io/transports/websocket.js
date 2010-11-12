var Client = require('../client')
  , Stream = require('net').Stream
  , url = require('url')
  , crypto = require('crypto');

WebSocket = module.exports = function(){
  Client.apply(this, arguments);
};

require('sys').inherits(WebSocket, Client);

WebSocket.prototype._onConnect = function(req, socket){
  var self = this
    , headers = [];
  
  Client.prototype._onConnect.call(this, req);
    
  this.data = '';
  
  if (this.request.headers.upgrade !== 'WebSocket' || !this._verifyOrigin(this.request.headers.origin)){
    this.listener.options.log('WebSocket connection invalid or Origin not verified');
    this._onClose();
    return false;
  }
  
  var origin = this.request.headers.origin,
      location = (origin && origin.substr(0, 5) == 'https' ? 'wss' : 'ws')
               + '://' + this.request.headers.host + this.request.url;
    
  if ('sec-websocket-key1' in this.request.headers){
    /*  We need to send the 101 response immediately when using Draft 76 with
      	a load balancing proxy, such as HAProxy.  In order to protect an
      	unsuspecting non-websocket HTTP server, HAProxy will not send the
      	8-byte nonce through the connection until the Upgrade: WebSocket
      	request has been confirmed by the WebSocket server by a 101 response
      	indicating that the server can handle the upgraded protocol.  We
      	therefore must send the 101 response immediately, and then wait for
      	the nonce to be forwarded to us afterward in order to finish the
      	Draft 76 handshake.
      */

	  // If we don't have the nonce yet, wait for it.
    if (!(this.upgradeHead && this.upgradeHead.length >= 8)) {
		  this.waitingForNonce = true;
    }

    headers = [
      'HTTP/1.1 101 WebSocket Protocol Handshake',
      'Upgrade: WebSocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Origin: ' + origin,
      'Sec-WebSocket-Location: ' + location
    ];
    
    if ('sec-websocket-protocol' in this.request.headers){
      headers.push('Sec-WebSocket-Protocol: ' + this.request.headers['sec-websocket-protocol']);
    }
  } else {
    headers = [
      'HTTP/1.1 101 Web Socket Protocol Handshake',
      'Upgrade: WebSocket',
      'Connection: Upgrade',
      'WebSocket-Origin: ' + origin,
      'WebSocket-Location: ' + location
    ];
  }    

  try {
    this.connection.write(headers.concat('', '').join('\r\n'));
  } catch(e){
    this._onClose();
  }
  
  this.connection.setTimeout(0);
  this.connection.setNoDelay(true);
  this.connection.setEncoding('utf-8');
  
  this.connection.addListener('data', function(data){
    self._handle(data);
  });

  req.addListener('error', function(err){
    req.end && req.end() || req.destroy && req.destroy();
  });
  socket.addListener('error', function(data){
    socket && (socket.end && socket.end() || socket.destroy && socket.destroy());
  });

  if (this.waitingForNonce) {
  	// Since we will be receiving the binary nonce through the normal HTTP
  	// data event, set the connection to 'binary' temporarily
  	this.connection.setEncoding('binary');
  	this._headers = headers;
  }
  else {
  	if (this._proveReception(headers)) this._payload();
  }
};

WebSocket.prototype._handle = function(data){
  var chunk, chunks, chunk_count;
  this.data += data;
	if (this.waitingForNonce) {
		if (this.data.length < 8) { return; }
		// Restore the connection to utf8 encoding after receiving the nonce
		this.connection.setEncoding('utf8');
		this.waitingForNonce = false;
		// Stuff the nonce into the location where it's expected to be
		this.upgradeHead = this.data.substr(0,8);
		this.data = this.data.substr(8);
		if (this._proveReception(this._headers)) { this._payload(); }
		return;
	}
  
  chunks = this.data.split('\ufffd');
  chunk_count = chunks.length - 1;
  for (var i = 0; i < chunk_count; i++){
    chunk = chunks[i];
    if (chunk[0] !== '\u0000'){
      this.listener.options.log('Data incorrectly framed by UA. Dropping connection');
      this._onClose();
      return false;
    }
    this._onMessage(chunk.slice(1));
  }
  this.data = chunks[chunks.length - 1];
};

// http://www.whatwg.org/specs/web-apps/current-work/complete/network.html#opening-handshake
WebSocket.prototype._proveReception = function(headers){
  var self = this
    , k1 = this.request.headers['sec-websocket-key1']
    , k2 = this.request.headers['sec-websocket-key2'];
  
  if (k1 && k2){
    var md5 = crypto.createHash('md5');

    [k1, k2].forEach(function(k){
      var n = parseInt(k.replace(/[^\d]/g, '')),
          spaces = k.replace(/[^ ]/g, '').length;
          
      if (spaces === 0 || n % spaces !== 0){
        self.listener.options.log('Invalid WebSocket key: "' + k + '". Dropping connection');
        self._onClose();
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
      this.connection.write(md5.digest('binary'), 'binary');
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