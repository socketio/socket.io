var net = require('net'),
		WebSocket = require('./websocket'),
		listeners = [],
		netserver,

Flashsocket = module.exports = function(){
	WebSocket.apply(this, arguments);
};

require('sys').inherits(Flashsocket, WebSocket);

Flashsocket.httpUpgrade = true;

Flashsocket.init = function(listener){
	listeners.push(listener);
	listener.server.on('close', function(){
		try {
			netserver.close();
		} catch(e){}
	});
};

try {
	netserver = net.createServer(function(socket){
		socket.write('<?xml version="1.0"?>\n');
		socket.write('<!DOCTYPE cross-domain-policy SYSTEM "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n');
		socket.write('<cross-domain-policy>\n');

		listeners.forEach(function(l){
			[].concat(l.options.origins).forEach(function(origin){
				var parts = origin.split(':');
				socket.write('<allow-access-from domain="' + parts[0] + '" to-ports="'+ parts[1] +'"/>\n');
			});
		});

		socket.write('</cross-domain-policy>\n');
		socket.end();	
	}).listen(843);
} catch(e){}