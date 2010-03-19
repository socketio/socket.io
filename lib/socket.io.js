require.paths.unshift(__dirname + '/vendor/js-oo/lib');
require('oo');

var sys = require('sys'),
	Listener = require('./socket.io/listener').Listener;

this.listen = function(server, options){
	return new Listener(server, options);
};