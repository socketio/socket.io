var Listener = require('./lib/socket.io/listener');

this.listen = function(server, options){
	return new Listener(server, options);
};