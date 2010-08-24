var urlparse = require('url').parse,
		options = require('./utils').options,
		frame = '~m~',

Client = module.exports = function(listener, req, res, options, head){
	process.EventEmitter.call(this);
	this.listener = listener;
	this.options({
		timeout: 8000,
		heartbeatInterval: 10000,
		closeTimeout: 0
	}, options);
	this.connections = 0;
	this.connected = false;
	this._heartbeats = 0;
	this.upgradeHead = head;
	this._onConnect(req, res);
};

require('sys').inherits(Client, process.EventEmitter);

Client.prototype.send = function(message){
	if (!this.connected || !(this.connection.readyState === 'open' ||
			this.connection.readyState === 'writeOnly')){
		return this._queue(message);
	}
	this._write(this._encode(message));
	return this;
};

Client.prototype.broadcast = function(message){
	if (!('sessionId' in this)) return this;
	this.listener.broadcast(message, this.sessionId);
	return this;
};

Client.prototype._onMessage = function(data){
	var messages = this._decode(data);
	if (messages === false) return this.listener.options.log('Bad message received from client ' + this.sessionId);
	for (var i = 0, l = messages.length, frame; i < l; i++){
		frame = messages[i].substr(0, 3);
		switch (frame){
			case '~h~':
				return this._onHeartbeat(messages[i].substr(3));
			case '~j~':
				messages[i] = JSON.parse(messages[i].substr(3));
				break;
		}
		this.emit('message', messages[i]);
		this.listener._onClientMessage(messages[i], this);
	}
};

Client.prototype._onConnect = function(req, res){
	var self = this;
	this.request = req;
	this.response = res;
	this.connection = this.request.connection;
	if (this._disconnectTimeout) clearTimeout(this._disconnectTimeout);
};
	
Client.prototype._encode = function(messages){
	var ret = '', message,
			messages = Array.isArray(messages) ? messages : [messages];
	for (var i = 0, l = messages.length; i < l; i++){
		message = messages[i] === null || messages[i] === undefined ? '' : stringify(messages[i]);
		ret += frame + message.length + frame + message;
	}
	return ret;
};
	
Client.prototype._decode = function(data){
	var messages = [], number, n;
	do {
		if (data.substr(0, 3) !== frame) return messages;
		data = data.substr(3);
		number = '', n = '';
		for (var i = 0, l = data.length; i < l; i++){
			n = Number(data.substr(i, 1));
			if (data.substr(i, 1) == n){
				number += n;
			} else {	
				data = data.substr(number.length + frame.length)
				number = Number(number);
				break;
			} 
		}
		messages.push(data.substr(0, number)); // here
		data = data.substr(number);
	} while(data !== '');
	return messages;
};
	
Client.prototype._payload = function(){
	var payload = [];
	
	this.connections++;
	this.connected = true;
	
	if (!this.handshaked){
		this._generateSessionId();
		payload.push(this.sessionId);
		this.handshaked = true;
	}
	
	payload = payload.concat(this._writeQueue || []);
	this._writeQueue = [];
	
	if (payload.length) this._write(this._encode(payload));
	if (this.connections === 1) this.listener._onClientConnect(this);
	
	if (this.options.timeout) this._heartbeat();
};
	
Client.prototype._heartbeat = function(){
	var self = this;
	setTimeout(function(){
		self.send('~h~' + ++self._heartbeats);
		self._heartbeatTimeout = setTimeout(function(){
			self._onClose();
		}, self.options.timeout);
	}, self.options.heartbeatInterval);
};
	
Client.prototype._onHeartbeat = function(h){
	if (h == this._heartbeats){
		clearTimeout(this._heartbeatTimeout);
		this._heartbeat();
	}
};

Client.prototype._onClose = function(){
	if (this.connected){
		var self = this;
		if ('_heartbeatTimeout' in this) clearTimeout(this._heartbeatTimeout);
		this.connected = false;
		this._disconnectTimeout = setTimeout(function(){
			self._onDisconnect();
		}, this.options.closeTimeout);
	}
};

Client.prototype._onDisconnect = function(){
	if (!this.finalized){
		this._writeQueue = [];
		this.connected = false;
		this.finalized = true;
		if (this.handshaked){
			this.emit('disconnect');
			this.listener._onClientDisconnect(this);
		} 
	}
};

Client.prototype._queue = function(message){
	if (!('_writeQueue' in this)){
		this._writeQueue = [];
	}
	this._writeQueue.push(message);
	return this;
};

Client.prototype._generateSessionId = function(){
	if (this.sessionId) return this.listener.options.log('This client already has a session id');
	this.sessionId = Math.random().toString().substr(2);
	return this;
};

Client.prototype._verifyOrigin = function(origin){
	var parts = urlparse(origin), origins = this.listener.options.origins;
	return origins.indexOf('*:*') !== -1 ||
		origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
		origins.indexOf(parts.host + ':*') !== -1 ||
		origins.indexOf('*:' + parts.port) !== -1;
};

for (var i in options) Client.prototype[i] = options[i];

function stringify(message){
	if (Object.prototype.toString.call(message) == '[object Object]'){
		return '~j~' + JSON.stringify(message);
	} else {
		return String(message);
	}
};