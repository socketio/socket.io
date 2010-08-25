exports.Listener = require('./listener');
exports.listen = function(server, options){
	return new exports.Listener(server, options);
};