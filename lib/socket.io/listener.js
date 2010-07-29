var url = require('url'),
		sys = require('sys'),
		options = require('./utils').options,
		Client = require('./client'),
		transports = {
			'flashsocket': require('./transports/flashsocket'),
			'htmlfile': require('./transports/htmlfile'),
			'websocket': require('./transports/websocket'),
			'xhr-multipart': require('./transports/xhr-multipart'),
			'xhr-polling': require('./transports/xhr-polling')
		},

Listener = module.exports = function(server, options){
	process.EventEmitter.call(this);
	var self = this;
	this.server = server;
	this.options({
		origins: '*:*',
		resource: 'socket.io',
		transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling'],
		transportOptions: {
			'xhr-polling': {
				timeout: null, // no heartbeats for polling
				closeTimeout: 8000,
				duration: 20000
			}
		},
		log: function(message){
			require('sys').log(message);
		}
	}, options);
	this.clients = [];
	this.clientsIndex = {};
	
	var listeners = this.server.listeners('request');
	this.server.removeAllListeners('request');
	
	this.server.addListener('request', function(req, res){
		if (self.check(req, res)) return;
		for (var i = 0; i < listeners.length; i++){
			listeners[i].call(this, req, res);
		}
	});
	
	this.server.addListener('upgrade', function(req, socket, head){
		if (!self.check(req, socket, true, head)){
			socket.destroy();
		}
	});
	
	for (var i in transports){
		if ('init' in transports[i]) transports[i].init(this);
	}
	
	this.options.log('socket.io ready - accepting connections');
};

sys.inherits(Listener, process.EventEmitter);
for (var i in options) Listener.prototype[i] = options[i];

Listener.prototype.broadcast = function(message, except){
	for (var i = 0, l = this.clients.length; i < l; i++){
		if (this.clients[i] && (!except || [].concat(except).indexOf(this.clients[i].sessionId) == -1)){
			this.clients[i].send(message);
		}
	}
	return this;
};

Listener.prototype.check = function(req, res, httpUpgrade, head){
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
};

Listener.prototype._lookupClient = function(sid){
	return this.clientsIndex[sid];
};

Listener.prototype._onClientConnect = function(client){
	if (!(client instanceof Client) || !client.sessionId){
		return this.options.log('Invalid client');
	}
	client.i = this.clients.length;
	this.clients.push(client);
	this.clientsIndex[client.sessionId] = client;
	this.options.log('Client '+ client.sessionId +' connected');
	this.emit('clientConnect', client);
	this.emit('connection', client);
};

Listener.prototype._onClientMessage = function(data, client){
	this.emit('clientMessage', data, client);
};

Listener.prototype._onClientDisconnect = function(client){
	this.clientsIndex[client.sessionId] = null;
	this.clients[client.i] = null;
	this.options.log('Client '+ client.sessionId +' disconnected');
	this.emit('clientDisconnect', client);
};

Listener.prototype._onConnection = function(transport, req, res, httpUpgrade, head){
	if (this.options.transports.indexOf(transport) === -1 || (httpUpgrade && !transports[transport].httpUpgrade)){
		httpUpgrade ? res.destroy() : req.connection.destroy();
		return this.options.log('Illegal transport "'+ transport +'"');
	}
	this.options.log('Initializing client with transport "'+ transport +'"');
	new transports[transport](this, req, res, this.options.transportOptions[transport], head);
};