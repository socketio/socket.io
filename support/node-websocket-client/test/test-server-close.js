// Verify that a connection can be closed gracefully from the server.

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws/server').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var clientGotServerMessage = false;
var clientGotServerClose = false;
var serverGotClientClose = false;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.on('connection', function(c) {
    c.on('close', function() {
        serverGotClientClose = true;
        wss.close();
    });

    c.write(S_MSG);
    c.close();
});

var ws = new WebSocket('ws://localhost:' + PORT);
ws.onmessage = function(m) {
    assert.deepEqual(m, {data: S_MSG});

    clientGotServerMessage = true;
};
ws.onclose = function() {
    assert.equal(ws.CLOSED, ws.readyState);
    clientGotServerClose = true;
};

process.on('exit', function() {
    assert.ok(clientGotServerMessage);
    assert.ok(clientGotServerClose);
    assert.ok(serverGotClientClose);
});
