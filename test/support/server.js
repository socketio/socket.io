
// this is a test server to support tests which make requests

var io = require('socket.io');
var server = io(process.env.ZUUL_PORT);

server.on('connection', function(socket){
  socket.emit('hi');
});
