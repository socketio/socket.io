var io = require('./../'),
		Listener = io.Listener,
		port = 8080;
		Client = require('./../lib/socket.io/client'),
		WebSocket = require('./support/node-websocket-client/lib/websocket').WebSocket,

module.exports = {
	
	'test server initialization': function(assert){
		var server = require('http').createServer(function(){}), sio;
		server.listen(8080);
		sio = io.listen(server);
		assert.ok(sio instanceof Listener);
		server.close();
	}
	
};