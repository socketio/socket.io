
/**
 * Module dependencies.
 */

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var enchilada = require('enchilada');
var io = require('engine.io').attach(server);

app.use(enchilada({
  src: __dirname + '/public',
  debug: true
}));
app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res, next) {
  res.sendfile('index.html');
});

io.on('connection', function (socket) {
  socket.on('message', function (v) {
    socket.send('pong');
  });
});

var port = process.env.PORT || 3000;
server.listen(port, function () {
  console.log('\x1B[96mlistening on localhost:' + port + ' \x1B[39m');
});
