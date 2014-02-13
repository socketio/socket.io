
// this is a test server to support tests which make requests

var io = require('socket.io');
var server = io(process.env.ZUUL_PORT);

server.on('connection', function(socket){
  // simple test
  socket.on('hi', function(){
    socket.emit('hi');
  });

  // ack tests
  socket.on('ack', function(){
    socket.emit('ack', function(a, b){
      if (a == 5 && b.test) {
        socket.emit('got it');
      }
    });
  });

  // false test
  socket.on('false', function(){
    socket.emit('false', false);
  });
});
