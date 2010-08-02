var io = require('./../'),
		Listener = io.Listener,
		Client = require('./../lib/socket.io/client'),
		WebSocket = require('./support/node-websocket-client/lib/websocket').WebSocket;

module.exports = {
	
	'test connection and handshake': function(assert){
		var server = require('http').createServer(function(){}), sio, client, clientCount, close;
		server.listen(8081);

		sio = io.listen(server);
		client;
		clientCount = 0;
		close = function(){
			client.close();
			server.close();
			assert.ok(clientCount, 1);
		};
		
		server.listen(port, function(){
			client = new WebSocket('ws://localhost:8081/socket.io/websocket', 'borf');
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