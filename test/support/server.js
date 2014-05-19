// this is a test server to support tests which make requests

var express = require('express');
var app = express();
var join = require('path').join;
var http = require('http').Server(app);
var server = require('engine.io').attach(http, {'pingInterval': 500});
var browserify = require('../../support/browserify');

http.listen(process.env.ZUUL_PORT);

// server worker.js as raw file
app.use('/test/support', express.static(join(__dirname, 'public')));

// server engine.io.js via browserify
app.get('/test/support/engine.io.js', function(err, res, next) {
  browserify(function(err, src) {
    if (err) return next(err);
    res.set('Content-Type', 'application/javascript');
    res.send(src);
  });
});

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
