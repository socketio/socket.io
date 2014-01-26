// this is a test server to support tests which make requests

var express = require('express');
var app = express();
var join = require('path').join;
var http = require('http').Server(app);
var server = require('engine.io').attach(http);
var browserify = require('browserify');

http.listen(process.env.ZUUL_PORT);

// server worker.js as raw file
app.use('/test/support', express.static(join(__dirname, 'public')));

// server engine.io.js via browserify
app.get('/test/support/engine.io.js', function(err, res, next) {
  var opts = { standalone: 'eio' };
  browserify(require.resolve('../../')).bundle(opts, function(err, src) {
    if (err) {
      return next(err);
    }
    res.set('Content-Type', 'application/javascript');
    res.send(src);
  });
});

server.on('connection', function(socket){
  socket.send('hi');
});
