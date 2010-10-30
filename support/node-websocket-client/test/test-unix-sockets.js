// Verify that we can connect to a server over UNIX domain sockets.

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var sys = require('sys');
var WebSocket = require('../lib/websocket').WebSocket;
var WebSocketServer = require('websocket-server/ws').Server;

var PATH = path.join(__dirname, 'sock.' + process.pid);
var S_MSG = 'Server test: ' + (Math.random() * 100);

var serverGotConnection = false;
var clientGotOpen = false;
var clientGotData = false;

var wss = new WebSocketServer();
wss.addListener('listening', function() {
    var ws = new WebSocket('ws+unix://' + PATH);
    ws.addListener('open', function() {
        clientGotOpen = true;

        ws.close();
    });
    ws.addListener('data', function(d) {
        assert.equal(d.toString('utf8'), S_MSG);
        clientGotData = true;
    });
});
wss.addListener('connection', function(c) {
    serverGotConnection = true;

    c.write(S_MSG);
    wss.close();
});
wss.listen(PATH);

process.addListener('exit', function() {
    assert.ok(serverGotConnection);
    assert.ok(clientGotOpen);
    assert.ok(clientGotData);

    try {
        fs.unlinkSync(PATH);
    } catch(e) { }
});
