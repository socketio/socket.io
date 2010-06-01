/**
 * Socket.IO client
 * 
 * @author Guillermo Rauch <guillermo@learnboost.com>
 * @license The MIT license.
 * @copyright Copyright (c) 2010 LearnBoost <dev@learnboost.com>
 */

io.Socket = ioClass({

	include: [io.util.Events, io.util.Options],

	options: {
		secure: false,
		document: document,
		port: document.location.port || 80,
		resource: 'socket.io',
		transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		transportOptions: {},
		rememberTransport: true
	},

	init: function(host, options){
		this.host = host || document.domain;
		this.setOptions(options);
		this.connected = false;
		this.connecting = false;
		this.transport = this.getTransport();
		if (!this.transport && 'console' in window) console.error('No transport available');
	},

	getTransport: function(){
		var transports = this.options.transports, match;
		if (this.options.rememberTransport){
			match = this.options.document.cookie.match('(?:^|;)\\s*socket\.io=([^;]*)');
			if (match) transports = [decodeURIComponent(match[1])];
		} 
		for (var i = 0; transport = transports[i]; i++){
			if (io.Transport[transport] 
				&& io.Transport[transport].check() 
				&& (!this._isXDomain() || io.Transport[transport].xdomainCheck())){
				return new io.Transport[transport](this, this.options.transportOptions[transport] || {});
			}
		}
		return null;
	},

	connect: function(){
		if (this.transport && !this.connected && !this.connecting){
			this.connecting = true;
			this.transport.connect();
		}      
		return this;
	},

	send: function(data){
		if (!this.transport || !this.transport.connected) return this._queue(data);
		this.transport.send(JSON.stringify([data]));
		return this;
	},

	disconnect: function(){
		this.transport.disconnect();
		return this;
	},

	_queue: function(message){
		if (!('_queueStack' in this)) this._queueStack = [];
		this._queueStack.push(message);
		return this;
	},

	_doQueue: function(){    
		if (!('_queueStack' in this) || !this._queueStack.length) return this;
		this.transport.send(JSON.stringify([].concat(this._queueStack)));
		this._queueStack = [];
		return this;
	},
	
	_isXDomain: function(){
		return this.host !== document.domain;
	},

	_onConnect: function(){
		this.connected = true;
		this.connecting = false;
		this._doQueue();
		if (this.options.rememberTransport) this.options.document.cookie = 'socket.io=' + encodeURIComponent(this.transport.type);
		this.fireEvent('connect');
	},

	_onMessage: function(data){
		this.fireEvent('message', data);
	},

	_onDisconnect: function(){
		this.fireEvent('disconnect');
	}

});