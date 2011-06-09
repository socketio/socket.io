
/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , sio = require('socket.io')
  , path = require('path');

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public' }))
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', { layout: false });
});

/**
 * Sends test files.
 */

app.get('/test/:file', function (req, res) {
  res.sendfile(path.normalize(__dirname + '/../../test/' + req.params.file));
});

/**
 * App listen.
 */

app.listen(3000, function () {
  var addr = app.address();
  console.error('   listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , nicknames = {};

io.sockets.on('connection', function (socket) {

});
