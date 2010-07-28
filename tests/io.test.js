var io = require('./../'),
		Listener = io.Listener,
		Client = require('./../lib/socket.io/client'),
		WebSocket = require('./support/node-websocket-client/lib/websocket').WebSocket,
		empty = new Function,
		port = 8080,

create = function(fn){
	var server = require('http').createServer(empty), client;
	server.listen(port, function(){
		client = new WebSocket('ws://localhost:'+ port++ +'/socket.io/websocket', 'borf');
	});
	return {server: server, client: client, close: function(){
		client.close();
		server.close();
	}};
};

module.exports = {
	'test server initialization': function(assert){
		var http = create(),
				sio = io.listen(http.server);
		assert.ok(sio instanceof Listener);
		http.close();
	},
	
	'test connection and handshake': function(assert){
		var server = require('http').createServer(empty),
				sio = io.listen(server),
				client,
				clientCount = 0,
		
		close = function(){
			client.close();
			server.close();
			assert.ok(clientCount, 1);
		};
		
		server.listen(port, function(){
			client = new WebSocket('ws://localhost:'+ port++ +'/socket.io/websocket', 'borf');
			client.onmessage = function(){
				console.log('test');
			};
		});
		
		sio.on('connection', function(client){
			console.log('test');
			clientCount++;
			assert.ok(client instanceof Client);
		});
	}
};