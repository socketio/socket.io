// Verify that both sides of the WS connection can both send and receive file
// descriptors.

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var sys = require('sys');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws').Server;

var PATH = path.join(__dirname, 'sock.' + process.pid);
var C_MSG = 'Client test: ' + (Math.random() * 100);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var clientReceivedData = false;
var clientReceivedFD = false;
var serverReceivedData = false;
var serverReceivedFD = false;

var wss = new WebSocketServer();
wss.addListener('listening', function() {
    var ws = new WebSocket('ws+unix://' + PATH);
    ws.addListener('data', function(d) {
        assert.equal(d.toString('utf8'), S_MSG);

        clientReceivedData = true;

        ws.send(C_MSG, 1);
        ws.close();
    });
    ws.addListener('fd', function(fd) {
        assert.ok(fd >= 0);

        clientReceivedFD = true;
    });
});
wss.addListener('connection', function(c) {
    c.write(S_MSG, 0);
    c._req.socket.addListener('fd', function(fd) {
        assert.ok(fd >= 0);

        serverReceivedFD = true;
    });
    c.addListener('message', function(d) {
        assert.equal(d, C_MSG);

        serverReceivedData = true;

        wss.close();
    });
});
wss.listen(PATH);

process.addListener('exit', function() {
    assert.ok(clientReceivedFD);
    assert.ok(clientReceivedData);
    assert.ok(serverReceivedFD);
    assert.ok(serverReceivedData);

    try {
        fs.unlinkSync(PATH);
    } catch (e) { }
});
