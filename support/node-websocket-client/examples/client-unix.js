var sys = require('sys');
var WebSocket = require('../lib/websocket').WebSocket;

var ws = new WebSocket('ws+unix://' + process.argv[2], 'boffo');

ws.addListener('message', function(d) {
    sys.debug('Received message: ' + d.toString('utf8'));
});

ws.addListener('open', function() {
    ws.send('This is a message', 1);
});
