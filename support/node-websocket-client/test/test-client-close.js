// Verify that a connection can be closed gracefully from the client.

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws/server').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);
var C_MSG = 'Client test: ' + (Math.random() * 100);

var serverGotClientMessage = false;
var clientGotServerClose = false;
var serverGotClientClose = false;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.on('connection', function(c) {
    c.on('message', function(m) {
        assert.equal(m, C_MSG);
        serverGotClientMessage = true;
    });
    c.on('close', function() {
        serverGotClientClose = true;
        wss.close();
    });
});

var ws = new WebSocket('ws://localhost:' + PORT);
ws.onopen = function() {
    ws.send(C_MSG);

    // XXX: Add a timeout here 
    ws.close(5);
};
ws.onclose = function() {
    assert.equal(ws.CLOSED, ws.readyState);
    clientGotServerClose = true;
};

process.on('exit', function() {
    assert.ok(serverGotClientMessage);
    assert.ok(clientGotServerClose);
    assert.ok(serverGotClientClose);
});
