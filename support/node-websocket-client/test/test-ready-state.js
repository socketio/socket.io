// Verify that readyState transitions are implemented correctly

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');

var ws = new WebSocket('ws://localhost:' + PORT);
assert.equal(ws.readyState, ws.CONNECTING);
ws.onopen = function() {
    assert.equal(ws.readyState, ws.OPEN);

    ws.close();
    assert.ok(ws.readyState == ws.CLOSING);
};
ws.onclose = function() {
    assert.equal(ws.readyState, ws.CLOSED);
    wss.close();
};
