
/**
 * Module dependencies.
 */

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , enchilada = require('enchilada')
  , io = require('engine.io').attach(server);

app.use(enchilada({
  src: __dirname + '/public',
  debug: true
}));
app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res, next){
  res.sendfile('index.html');
});

io.on('connection', function(socket){
  socket.on('message', function(v){
    socket.send('pong');
  });
});

server.listen(process.env.PORT || 3000, function(){
  console.log('\033[96mlistening on localhost:' + process.env.PORT || 3000 + ' \033[39m');
});
