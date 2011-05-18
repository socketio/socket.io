// Verify that some attributes of a WebSocket object are read-only.

var assert = require('assert');
var sys = require('sys');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws/server').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.on('connection', function(c) {
    c.close();
    wss.close();
});
var ws = new WebSocket('ws://localhost:' + PORT + '/', 'biff');
ws.on('open', function() {
    assert.equal(ws.CONNECTING, 0);
    try {
        ws.CONNECTING = 13;
        assert.equal(
            ws.CONNECTING, 0,
            'Should not have been able to set read-only CONNECTING attribute'
        );
    } catch (e) {
        assert.equal(e.type, 'no_setter_in_callback');
    }

    assert.equal(ws.OPEN, 1);
    assert.equal(ws.CLOSING, 2);
    assert.equal(ws.CLOSED, 3);

    assert.equal(ws.url, 'ws://localhost:' + PORT + '/');
    try {
        ws.url = 'foobar';
        assert.equal(
            ws.url, 'ws://localhost:' + PORT + '/',
            'Should not have been able to set read-only url attribute'
        );
    } catch (e) {
        assert.equal(e.type, 'no_setter_in_callback');
    }
});
