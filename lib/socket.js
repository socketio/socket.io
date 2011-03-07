/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

(function(){
	var io = this.io;
	
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
			connectTimeout: 5000,
			reconnect: true,
			reconnectionDelay: 500,
			maxReconnectionAttempts: 10,
			tryTransportsOnConnectTimeout: true,
			rememberTransport: true
		};
		io.util.merge(this.options, options);
		this.connected = false;
		this.connecting = false;
		this._events = {};
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	};
	
	Socket.prototype.getTransport = function(override){
		var transports = override || this.options.transports, match;
		if (this.options.rememberTransport && !override){
			match = this.options.document.cookie.match('(?:^|;)\\s*socketio=([^;]*)');
			if (match){
				this._rememberedTransport = true;
				transports = [decodeURIComponent(match[1])];
			}
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
			if (this.connecting) this.disconnect(true);
			this.connecting = true;
			this.emit('connecting', [this.transport.type]);
			this.transport.connect();
			if (this.options.connectTimeout){
				var self = this;
				this.connectTimeoutTimer = setTimeout(function(){
					if (!self.connected){
						self.disconnect(true);
						if (self.options.tryTransportsOnConnectTimeout && !self._rememberedTransport){
							if(!self._remainingTransports) self._remainingTransports = self.options.transports.slice(0);
							var transports = self._remainingTransports;
							while(transports.length > 0 && transports.splice(0,1)[0] != self.transport.type){}
							if(transports.length){
								self.transport = self.getTransport(transports);
								self.connect();
							}
						}
						if(!self._remainingTransports || self._remainingTransports.length == 0) self.emit('connect_failed');
					}
					if(self._remainingTransports && self._remainingTransports.length == 0) delete self._remainingTransports;
				}, this.options.connectTimeout);
			}
		}
		return this;
	};
	
	Socket.prototype.send = function(data){
		if (!this.transport || !this.transport.connected) return this._queue(data);
		this.transport.send(data);
		return this;
	};
	
	Socket.prototype.disconnect = function(reconnect){
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
		if (!reconnect) this.options.reconnect = false;
		this.transport.disconnect();
		return this;
	};
	
	Socket.prototype.on = function(name, fn){
		if (!(name in this._events)) this._events[name] = [];
		this._events[name].push(fn);
		return this;
	};
	
  Socket.prototype.emit = function(name, args){
    if (name in this._events){
      var events = this._events[name].concat();
      for (var i = 0, ii = events.length; i < ii; i++)
        events[i].apply(this, args === undefined ? [] : args);
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
    var locPort = window.location.port || 80;
		return this.host !== document.domain || this.options.port != locPort;
	};
	
	Socket.prototype._onConnect = function(){
		this.connected = true;
		this.connecting = false;
		this._doQueue();
		if (this.options.rememberTransport) this.options.document.cookie = 'socketio=' + encodeURIComponent(this.transport.type);
		this.emit('connect');
	};
	
	Socket.prototype._onMessage = function(data){
		this.emit('message', [data]);
	};
	
	Socket.prototype._onDisconnect = function(){
		var wasConnected = this.connected;
		this.connected = false;
		this.connecting = false;
		this._queueStack = [];
		if (wasConnected){
			this.emit('disconnect');
			if (this.options.reconnect && !this.reconnecting) this._onReconnect();
		}
	};
	
	Socket.prototype._onReconnect = function(){
		this.reconnecting = true;
		this.reconnectionAttempts = 0;
		this.reconnectionDelay = this.options.reconnectionDelay;
		
		var self = this
			, tryTransportsOnConnectTimeout = this.options.tryTransportsOnConnectTimeout
			, rememberTransport = this.options.rememberTransport;
		
		function reset(){
			if(self.connected) self.emit('reconnect',[self.transport.type,self.reconnectionAttempts]);
			self.removeEvent('connect_failed', maybeReconnect).removeEvent('connect', maybeReconnect);
			delete self.reconnecting;
			delete self.reconnectionAttempts;
			delete self.reconnectionDelay;
			delete self.reconnectionTimer;
			delete self.redoTransports;
			self.options.tryTransportsOnConnectTimeout = tryTransportsOnConnectTimeout;
			self.options.rememberTransport = rememberTransport;
			
			return;
		};
		
		function maybeReconnect(){
			if (!self.reconnecting) return;
			if (!self.connected){
				if (self.connecting && self.reconnecting) return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
				
				if (self.reconnectionAttempts++ >= self.options.maxReconnectionAttempts){
					if (!self.redoTransports){
						self.on('connect_failed', maybeReconnect);
						self.options.tryTransportsOnConnectTimeout = true;
						self.transport = self.getTransport(self.options.transports); // overwrite with all enabled transports
						self.redoTransports = true;
						self.connect();
					} else {
						self.emit('reconnect_failed');
						reset();
					}
				} else {
					self.reconnectionDelay *= 2; // exponential backoff
					self.connect();
					self.emit('reconnecting', [self.reconnectionDelay,self.reconnectionAttempts]);
					self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
				}
			} else {
				reset();
			}
		};
		this.options.tryTransportsOnConnectTimeout = false;
		this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);
		
		this.on('connect', maybeReconnect);
	};

  Socket.prototype.fire = Socket.prototype.emit;
	Socket.prototype.addListener = Socket.prototype.addEvent = Socket.prototype.addEventListener = Socket.prototype.on;
	Socket.prototype.removeListener = Socket.prototype.removeEventListener = Socket.prototype.removeEvent;
	
})();