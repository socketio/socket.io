var url = require('url'),
	options = require('./util/options').options,
	Client = require('./client').Client,
	transports = {};

var Listener = exports.Listener = Class({
	
	include: [process.EventEmitter.prototype, options],
	
	options: {
		origins: '*:*',
		resource: 'socket.io',
		transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		transportOptions: {},
		log: function(message){
			require('sys').log(message);
		}
	},
  
  init: function(server, options){
		var self = this;
		process.EventEmitter.call(this);
		this.server = server;
		this.setOptions(options);
		this.clients = [];
		this.clientsIndex = {};
		
		var listeners = this.server.listeners('request');
		this.server.removeAllListeners('request');
		
		this.server.addListener('request', function(req, res){
			if (self.check(req, res)) return;
			for (var i = 0; i < listeners.length; i++) {
				listeners[i].call(this, req, res);
			}
		});
		
		this.server.addListener('upgrade', function(req, socket, head){
			if (!self.check(req, socket, true, head)){
				socket.destroy();
			}
		});
		
		this.options.transports.forEach(function(t){
			if (!(t in transports)){
				transports[t] = require('./transports/' + t)[t];
				if (transports[t].init) transports[t].init(this);
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

	check: function(req, res, httpUpgrade, head){
		var path = url.parse(req.url).pathname, parts, cn;
		if (path.indexOf('/' + this.options.resource) === 0){	
			parts = path.substr(1).split('/');
			if (parts[2]){
				cn = this._lookupClient(parts[2]);
				if (cn){
					cn._onConnect(req, res);
				} else {
					req.connection.end();
					this.options.log('Couldnt find client with session id "' + parts[2] + '"');
				}
			} else {
				this._onConnection(parts[1], req, res, httpUpgrade, head);
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
			return this.options.log('Invalid client');
		}
		client.i = this.clients.length;
		this.clients.push(client);
		this.clientsIndex[client.sessionId] = client;
		this.options.log('Client '+ client.sessionId +' connected');
		this.emit('clientConnect', client);
	},
	
	_onClientMessage: function(data, client){
		this.emit('clientMessage', data, client);
	},
	
	_onClientDisconnect: function(client){
		this.clientsIndex[client.sessionId] = null;
		this.clients[client.i] = null;
		this.options.log('Client '+ client.sessionId +' disconnected');		
		this.emit('clientDisconnect', client);
	},
	
	// new connections (no session id)
	_onConnection: function(transport, req, res, httpUpgrade, head){
		if (this.options.transports.indexOf(transport) === -1 || (httpUpgrade && !transports[transport].httpUpgrade)){
			httpUpgrade ? res.destroy() : req.connection.destroy();
			return this.options.log('Illegal transport "'+ transport +'"');
		}
		this.options.log('Initializing client with transport "'+ transport +'"');
		new transports[transport](this, req, res, this.options.transportOptions[transport], head);
	}
  
});
