
/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , sio = require('socket.io')
  , path = require('path')
  , fs = require('fs');

/**
 * App.
 */

var app = express.createServer();

/**
 * Initial port to listen to.
 */

var port = 3000;

/**
 * A map of tests to socket.io ports we're listening on.
 */

var testsPorts = {};

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
  res.render('index', {
      layout: false
    , testsPorts: testsPorts
  });
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

app.listen(port++, function () {
  var addr = app.address();
  console.error('   listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Override handler to simplify development
 */

function handler (req, res) {
  fs.readFile(__dirname + '/../../dist/socket.io.js', 'utf8', function (err, b) {
    if (err) {
      res.writeHead(404);
      res.end('Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(b);
  });
};

/**
 * Socket.IO default server (to serve client)
 */

var io = sio.listen(app);

io.configure(function () {
  io.set('browser client handler', handler);
});

/**
 * Scopes servers for a given test suite.
 */

var currentSuite;

function suite (name, fn) {
  currentSuite = testsPorts[name] = {};
  fn();
};

/**
 * Creates a socket io server
 */

function server (name, fn) {
  currentSuite[name] = port++;
  fn(sio.listen(port));
};

/**
 * Socket.IO servers.
 */

suite('socket.test.js', function () {

  server('test connecting the socket and disconnecting', function (io) {
    io.on('connection', function () {
      console.error('woot');
    });
  });

});
