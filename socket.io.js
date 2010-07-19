var Listener = require('./lib/listener');

this.listen = function(server, options){
	return new Listener(server, options);
};