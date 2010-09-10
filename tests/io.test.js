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
	},
	
	'test serving static javascript client': function(assert){
		var server = require('http').createServer(function(){}), sio;
		server.listen(8080);
		sio = io.listen(server);
		assert.response(app,
		  { url: '/socket.io/socket.io.js' },
		  { body: /setPath/, headers: { 'Content-Type': 'text/javascript' }});
		assert.response(app,
		  { url: '/socket.io/lib/vendor/web-socket-js/WebSocketMain.swf' },
		  { headers: { 'Content-Type': 'application/x-shockwave-flash' }});
	}
	
};