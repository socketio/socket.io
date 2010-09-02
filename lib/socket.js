/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	
	var Socket = io.Socket = function(host, options){
		this.host = host || document.domain;
		this.options = {
			secure: false,
			document: document,
			port: document.location.port || 80,
			resource: 'socket.io',
			transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
			transportOptions: {
				'xhr-polling': {
					timeout: 25000 // based on polling duration default
				},
				'jsonp-polling': {
					timeout: 25000
				}
			},
			rememberTransport: false
		};
		for (var i in options) 
			if (this.options.hasOwnProperty(i))
				this.options[i] = options[i];
		this.connected = false;
		this.connecting = false;
		this._events = {};
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	};
	
	Socket.prototype.getTransport = function(){
		var transports = this.options.transports, match;
		if (this.options.rememberTransport){
			match = this.options.document.cookie.match('(?:^|;)\\s*socket\.io=([^;]*)');
			if (match) transports = [decodeURIComponent(match[1])];
		} 
		for (var i = 0, transport; transport = transports[i]; i++){
			if (io.Transport[transport] 
				&& io.Transport[transport].check() 
				&& (!this._isXDomain() || io.Transport[transport].xdomainCheck())){
				return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
			}
		}
		return null;
	};
	
	Socket.prototype.connect = function(){
		if (this.transport && !this.connected){
			if (this.connecting) this.disconnect();
			this.connecting = true;
			this.transport.connect();
		}
		return this;
	};
	
	Socket.prototype.send = function(data){
		if (!this.transport || !this.transport.connected) return this._queue(data);
		this.transport.send(data);
		return this;
	};
	
	Socket.prototype.disconnect = function(){
		this.transport.disconnect();
		return this;
	};
	
	Socket.prototype.on = function(name, fn){
		if (!(name in this._events)) this._events[name] = [];
		this._events[name].push(fn);
		return this;
	};
	
	Socket.prototype.fire = function(name, args){
		if (name in this._events){
			for (var i = 0, ii = this._events[name].length; i < ii; i++) 
				this._events[name][i].apply(this, args === undefined ? [] : args);
		}
		return this;
	};
	
	Socket.prototype.removeEvent = function(name, fn){
		if (name in this._events){
			for (var a = 0, l = this._events[name].length; a < l; a++)
				if (this._events[name][a] == fn) this._events[name].splice(a, 1);		
		}
		return this;
	};
	
	Socket.prototype._queue = function(message){
		if (!('_queueStack' in this)) this._queueStack = [];
		this._queueStack.push(message);
		return this;
	};
	
	Socket.prototype._doQueue = function(){
		if (!('_queueStack' in this) || !this._queueStack.length) return this;
		this.transport.send(this._queueStack);
		this._queueStack = [];
		return this;
	};
	
	Socket.prototype._isXDomain = function(){
		return this.host !== document.domain;
	};
	
	Socket.prototype._onConnect = function(){
		this.connected = true;
		this.connecting = false;
		this._doQueue();
		if (this.options.rememberTransport) this.options.document.cookie = 'socket.io=' + encodeURIComponent(this.transport.type);
		this.fire('connect');
	};
	
	Socket.prototype._onMessage = function(data){
		this.fire('message', [data]);
	};
	
	Socket.prototype._onDisconnect = function(){
		var wasConnected = this.connected;
		this.connected = false;
		this.connecting = false;
		this._queueStack = [];
		if (wasConnected) this.fire('disconnect');
	};
	
	Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
	
})();