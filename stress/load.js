'use strict';

var os = require('os');
var io = require('../');

// hackery to serve /socket.io/index.html page by means of internal static server
io.Manager.static.paths['/index.html'] = __dirname + '/index.html';
io.Manager.static.mime.html = {
  contentType: 'text/html',
  encoding: 'utf8'
};

var server = io.listen(3000);
server.set('log level', 2);

var done = false;
var sent = 0;
var acked = 0;

var payload = '0';
for (var i = 0; i < 8; ++i) payload += payload;

server.sockets.on('connection', function(sock) {
  sockets.push(sock);
  t0 = Date.now();
  process.nextTick(flood);
});

var threshold = 300000;

var t0 = null;
var sockets = [];
function flood() {
  if (sent < threshold) for (var i = 0; i < 4000; ++i) {
    for (var j = 0; j < sockets.length; ++j) {
      //sockets[j].send(payload);
      sockets[j].send(payload, function(aaa) { ++acked; });
      //sockets[j].emit('foo', payload, function(aaa) { ++acked; });
      ++sent;
    }
  }
  console.log('After ' + (Date.now() - t0) / 1000 + ' seconds sent ' + sent + ' messages of length ' + payload.length + '; acked: ' + acked + '; free memory: ' + os.freemem() + '; load: ' + os.loadavg()[0]);
  //sent < threshold ? process.nextTick(flood) : setTimeout(flood, 1000);
  sent < threshold ? setTimeout(flood, 100) : setTimeout(flood, 1000);
}
