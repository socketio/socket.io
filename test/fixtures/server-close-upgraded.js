var eioc = require('engine.io-client');
var listen = require('../common').listen;

var engine = listen(function (port) {
  var socket = new eioc.Socket('ws://localhost:' + port);
  socket.on('upgrade', function () {
    engine.httpServer.close();
    engine.close();
  });
});
