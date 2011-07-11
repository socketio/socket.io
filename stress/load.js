'use strict';

var freemem = require('os').freemem;
var io = require('../');

// hackery to serve /socket.io/index.html page by means of internal static server
io.Manager.static.paths['/index.html'] = __dirname + '/index.html';
io.Manager.static.mime.html = {
  contentType: 'text/html',
  encoding: 'utf8'
};

var server = io.listen(8080);
server.set('log level', 0);

var done = false;
var sent = 0;

var payload = '0';
for (var i = 0; i < 10; ++i) payload += payload;

server.sockets.on('connection', function(sock) {
  socket = sock;
  t0 = Date.now();
  process.nextTick(flood);
});

var t0 = null;
var socket = null;
function flood() {
  for (var i = 0; i < 5000; ++i) {
    socket.send(payload);
    ++sent;
  }
  console.log('After ' + (Date.now() - t0) / 1000 + ' seconds sent ' + sent + ' messages of length ' + payload.length + '; free memory: ' + freemem());
  process.nextTick(flood);
}

/*
var seconds = 0;
setInterval(function() {
  ++seconds;
  console.log(seconds + ' sent ' + sent + ' messages; free memory: ' + freemem());
}, 1000);
*/
