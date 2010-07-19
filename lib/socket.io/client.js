var options = require('./util/options').options, urlparse = require('url').parse;

exports.Client = Class({
	
	include: [options],
	
	options: {
		timeout: 12000,
		closeTimeout: 0
	},

	init: function(listener, req, res, options, head){
		this.listener = listener;
		this.setOptions(options);
		this.connections = 0;
		this.connected = false;
		this._heartbeats = 0;
		this.upgradeHead = head;
		this._onConnect(req, res);
	},

	send: function(message){
		if (!this.connected || !(this.connection.readyState === 'open' ||
				this.connection.readyState === 'writeOnly')){
			return this._queue(message);
		}
		this._write(this._encode(message));
		return this;
	},

	broadcast: function(message){
		if (!('sessionId' in this)) {
			return this;
		}
		this.listener.broadcast(message, this.sessionId);
		return this;
	},

	_onMessage: function(data){
		var messages = this._decode(data);
		if (messages === false) return this.listener.options.log('Bad message received from client ' + this.sessionId);
		for (var i = 0, l = messages.length; i < l; i++){
			if (messages[i].substr(0, 3) == '\ufffdh\ufffd'){
				return this._onHeartbeat(data.substr(3));
			}
			this.listener._onClientMessage(messages[i], this);
		}
	},

	_onConnect: function(req, res){
		var self = this;
		this.request = req;
		this.response = res;
		this.connection = this.request.connection;
		if (this._disconnectTimeout) clearTimeout(this._disconnectTimeout);
	},
	
	_encode: function(messages){
		var ret = '',
				messages = messages instanceof Array ? messages : [];
		for (var i = 0, l = messages.length; i < l; i++){
			ret += messages[i].length + message;
		}
		return '\ufffdm\ufffd' + ret;
	},
	
	_decode: function(data){
		if (data.substr(0, 3) !== '\ufffdm\ufffd') return false;
		var messages = [];
		do(){
			for (var i = 0, n, number = '';; i++;){
				var n = data.substr(i, 1);
				if (Number(n) != n){
					number = Number(number);
					break;
				}
				number += n;
			}
			messages.push(data.substr(i, i + number)); // here
			data = data.substr(i + number);
		} while(data !== '');
		return messages;
	},
	
	_payload: function(){
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
		
		if (this.listener.options.timeout) this._heartbeat();
	},
	
	_heartbeat: function(){
		var self = this;
		this.send('\ufffdh\ufffd' + ++this._heartbeats);
		this._heartbitTimeout = setTimeout(function(){
			self.close();
		}, this.listener.options.timeout);
	},
	
	_onHeartbeat: function(h){
		if (h === this._heartbeats) clearTimeout(this._heartbitTimeout);
	},

	_onClose: function(){
		var self = this;
		clearTimeout(this._heartbeatTimeout);
		this.connected = false;
		this._disconnectTimeout = setTimeout(function(){
			self._onDisconnect();
		}, this.options.closeTimeout);
	},

	_onDisconnect: function(){
		if (!this.finalized){
			this._writeQueue = [];
			this.connected = false;
			this.finalized = true;
			if (this.handshaked) this.listener._onClientDisconnect(this);
		}
	},

	_queue: function(message){
		if (!('_writeQueue' in this)){
			this._writeQueue = [];
		}
		this._writeQueue.push(message);
		return this;
	},

	_generateSessionId: function(){
		if (this.sessionId) return this.listener.options.log('This client already has a session id');
		this.sessionId = Math.random().toString().substr(2);
		return this;
	},

	_verifyOrigin: function(origin){
		var parts = urlparse(origin), origins = this.listener.options.origins;
		return origins.indexOf('*:*') !== -1 ||
			origins.indexOf(parts.host + ':' + parts.port) !== -1 ||
			origins.indexOf(parts.host + ':*') !== -1 ||
			origins.indexOf('*:' + parts.port) !== -1;
	}

});