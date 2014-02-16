// this is a test server to support tests which make requests

var express = require('express');
var app = express();
var join = require('path').join;
var http = require('http').Server(app);
var server = require('engine.io').attach(http);
http.listen(process.env.ZUUL_PORT);

// serve `engine.io.js` and `worker.js` for worker tests
app.use('/test/support', express.static(join(__dirname, 'public')));

server.on('connection', function(socket){
  socket.send('hi');

  // Bounce any received messages back
  socket.on('message', function (data) {
    if (data === 'give binary') {
      var abv = new Int8Array(5);
      for (var i = 0; i < 5; i++) {
        abv[i] = i;
      }
      socket.send(abv);
      return;
    }

    socket.send(data);
  });
});
