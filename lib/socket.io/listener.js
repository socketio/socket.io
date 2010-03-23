var url = require('url'),
		sys = require('sys'),
		Options = require('./util/options').Options, 
		Client = require('./client').Client,
		Transports = {},
		
Listener = this.Listener = Class({
	
	include: [process.EventEmitter.prototype, Options],
	
	options: {
		origins: '*:*',
		resource: 'socket.io',
		transports: ['websocket', 'server-events', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		timeout: 8000,
		log: function(message){
			sys.log(message);
		}
	},
  
  init: function(server, options){
		process.EventEmitter.call(this);
	
    this.server = server;
    this.setOptions(options);
		this.clients = [];
		this.clientsIndex = {};
		
		var listener = (this.server._events['request'] instanceof Array) 
			? this.server._events['request'][0] 
			: this.server._events['request'];
		if (listener){
			var self = this;
			this.server._events['request'] = function(req, res){
				if (self.check(req, res)) return;
				listener(req, res);				
			};
		} else {
			throw new Error('Couldn\'t find the `request` event in the HTTP server.');
		}
		
		this.options.transports.forEach(function(t){
			if (!(t in Transports)){
				Transports[t] = require('./transports/' + t)[t];
				if (Transports[t].init) Transports[t].init(this);
			} 
		}, this);
		
		this.options.log('socket.io ready - accepting connections');
  },

	broadcast: function(message, except){
		for (var i = 0, l = this.clients.length; i < l; i++){
			if (this.clients[i] && (!except || [].concat(except).indexOf(this.clients[i].sessionId) == -1)){
				this.clients[i].send(message);
			}				
		}
		return this;
	},

	check: function(req, res){
		var path = url.parse(req.url).pathname, parts, cn;		
		if (path.indexOf('/' + this.options.resource) === 0){	
			parts = path.substr(1).split('/');
			if (parts[2]){
				cn = this._lookupClient(parts[2]);
				if (cn){
					cn._onConnect(req, res);
				} else {
					req.connection.close();
					sys.log('Couldnt find client with session id "' + parts[2] + '"');
				}
			} else {
				this._onConnection(parts[1], req, res);
			}			
			return true;
		}		
		return false;
	},
	
	_lookupClient: function(sid){
		return this.clientsIndex[sid];
	},
	
	_onClientConnect: function(client){
		if (!(client instanceof Client) || !client.sessionId){
			return sys.log('Invalid client');
		}
		client.i = this.clients.length;
		this.clients.push(client);
		this.clientsIndex[client.sessionId] = client;
		sys.log('Client '+ client.sessionId +' connected');
		this.emit('clientConnect', client);
	},
	
	_onClientMessage: function(data, client){
		this.emit('clientMessage', data, client);
	},
	
	_onClientDisconnect: function(client){
		this.clientsIndex[client.sessionId] = null;
		this.clients[client.i] = null;
		sys.log('Client '+ client.sessionId +' disconnected');		
		this.emit('clientDisconnect', client);
	},
	
	// new connections (no session id)
	_onConnection: function(transport, req, res){
		if (this.options.transports.indexOf(transport) === -1){
			req.connection.close();
			return sys.log('Illegal transport "'+ transport +'"');
		}
		sys.log('Initializing client with transport "'+ transport +'"');
		new Transports[transport](this, req, res);
	}
  
});