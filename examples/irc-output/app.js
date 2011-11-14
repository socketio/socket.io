/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , sio = require('../../lib/socket.io')
  , irc = require('./irc');

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }))
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', { layout: false });
});

/**
 * App listen.
 */

app.listen(3000, function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server
 */

var io = sio.listen(app)

/**
 * Connect to IRC.
 */

var client = new irc.Client('irc.freenode.net', 6667);
client.connect('socketio\\test\\' + String(Math.random()).substr(-3));
client.on('001', function () {
  this.send('JOIN', '#node.js');
});
client.on('PART', function (prefix) {
  io.sockets.emit('announcement', irc.user(prefix) + ' left the channel');
});
client.on('JOIN', function (prefix) {
  io.sockets.emit('announcement', irc.user(prefix) + ' joined the channel');
});
client.on('PRIVMSG', function (prefix, channel, text) {
  io.sockets.emit('irc message', irc.user(prefix), text);
});
