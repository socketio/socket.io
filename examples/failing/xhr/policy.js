var server = require('net').createServer(function(socket) {
	socket.on('error', function(err) {
		if (socket && socket.end) {
			socket.end();
			socket.destroy();
		}
	});
	if (socket && socket.readyState === 'open') {
		socket.end(defaultPolicy);
	}
});
server.listen(843);

var defaultPolicy =
  '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
  ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n' +
  '<allow-access-from domain="*" to-ports="*"/>\n' +
  '</cross-domain-policy>\n';
