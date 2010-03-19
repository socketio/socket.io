var websocket = require('./websocket').websocket, 
	tcp = require('tcp'),
	listeners = [];

this.flashsocket = websocket.extend({});

this.flashsocket.init = function(listener){
	listeners.push(listener);
};

tcp.createServer(function(socket){
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
	socket.close();	
}).listen(843);