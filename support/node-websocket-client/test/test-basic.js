// Verify that we can connect to a WebSocket server, exchange messages, and
// shut down cleanly.

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);
var C_MSG = 'Client test: ' + (Math.random() * 100);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var serverGotConnection = false;
var clientGotOpen = false;
var clientGotData = false;
var clientGotMessage = false;
var serverGotMessage = false;
var serverGotClose = false;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.addListener('connection', function(c) {
    serverGotConnection = true;

    c.write(S_MSG);

    c.addListener('message', function(m) {
        assert.equal(m, C_MSG);
        serverGotMessage = true;
    });

    c.addListener('close', function() {
        serverGotClose = true;
        wss.close();
    });
});

var ws = new WebSocket('ws://localhost:' + PORT + '/', 'biff');
ws.addListener('open', function() {
    clientGotOpen = true;
});
ws.addListener('data', function(buf) {
    assert.equal(typeof buf, 'object');
    assert.equal(buf.toString('utf8'), S_MSG);

    clientGotData = true;

    ws.send(C_MSG);
    ws.close();
});
ws.onmessage = function(m) {
    assert.equal(m, S_MSG);
    assert.equal(typeof m, 'string');
    clientGotMessage = true;
};

process.addListener('exit', function() {
    assert.ok(serverGotConnection);
    assert.ok(clientGotOpen);
    assert.ok(clientGotData);
    assert.ok(clientGotMessage);
    assert.ok(serverGotMessage);
    assert.ok(serverGotClose);
});
