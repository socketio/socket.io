var server = require('http').createServer();
var ioc = require('socket.io-client');
var io = require('../..')(server);

server.listen(function () {
  var socket = ioc('ws://localhost:' + server.address().port);
  socket.on('connect', function () {
    io.close();
    socket.close();
  });
});
