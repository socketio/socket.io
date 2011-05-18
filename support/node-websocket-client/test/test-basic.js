// Verify that we can connect to a WebSocket server, exchange messages, and
// shut down cleanly.

var assert = require('assert');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws/server').Server;

var PORT = 1024 + Math.floor(Math.random() * 4096);
var C_MSG = 'Client test: ' + (Math.random() * 100);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var serverGotConnection = false;
var clientGotOpen = false;
var clientGotData = false;
var clientGotMessage = false;
var serverGotMessage = false;
var serverGotClose = false;
var clientGotClose = false;

var wss = new WebSocketServer();
wss.listen(PORT, 'localhost');
wss.on('connection', function(c) {
    serverGotConnection = true;

    c.on('message', function(m) {
        assert.equal(m, C_MSG);
        serverGotMessage = true;

        c.close();
    });

    c.on('close', function() {
        serverGotClose = true;
        wss.close();
    });

    c.write(S_MSG);
});

var ws = new WebSocket('ws://localhost:' + PORT + '/', 'biff');
ws.on('open', function() {
    clientGotOpen = true;
});
ws.on('data', function(buf) {
    assert.equal(typeof buf, 'object');
    assert.equal(buf.toString('utf8'), S_MSG);

    clientGotData = true;

    ws.send(C_MSG);
});
ws.onmessage = function(m) {
    assert.deepEqual(m, {data : S_MSG});
    clientGotMessage = true;
};
ws.onclose = function() {
    clientGotClose = true;
};

process.on('exit', function() {
    assert.ok(serverGotConnection);
    assert.ok(clientGotOpen);
    assert.ok(clientGotData);
    assert.ok(clientGotMessage);
    assert.ok(serverGotMessage);
    assert.ok(serverGotClose);
    assert.ok(clientGotClose);
});
