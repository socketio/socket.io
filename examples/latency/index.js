
/**
 * Module dependencies.
 */

var express = require('express')
  , app = express(app)
  , server = require('http').createServer(app)
  , io = require('engine.io').attach(server);

app.use(express.static('public'));
app.get('/', function(req, res, next){
  res.sendfile('index.html');
});

io.on('connection', function(socket){
  socket.on('message', function(v){
    socket.send('pong');
  });
});

server.listen(process.env.PORT || 3000, function(){
  console.log('\033[96mlistening on localhost:3000 \033[39m');
});
