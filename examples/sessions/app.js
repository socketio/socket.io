
/**
 * Bootstrap app.
 */

require.paths.unshift(__dirname + '/../../lib/');

/**
 * Module dependencies.
 */

var express = require('express')
  , sio = require('socket.io');

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

/// //////////////////////////////////
/// setup cookie sessions middleware
/// //////////////////////////////////
var Session = require('cookie-sessions');
var sessionOptions = {
  session_key: 'sid',
  secret: 'change-me-in-production-env',
  path: '/',
  timeout: 86400000
};
var sessionHandler = Session(sessionOptions);

app.configure(function () {
  app.use(express.static(__dirname + '/public'));


  app.use(sessionHandler);


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
 * Session routes
 */

app.all('/signin', function (req, res) {
  req.session = {uid: Math.random()};
  res.redirect('/');
});

app.all('/signout', function (req, res) {
  delete req.session;
  res.redirect('/');
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

var io = sio.listen(app);


io.set('authorization', function(data, ack) {

  // reuse session middleware


  var req = { headers: { cookie: data.headers.cookie } };
  console.error('REQ', req);
  sessionHandler(req, {}, function() {
    data.session = req.session || {};
    ack(null, true);
  });


});

io.sockets.on('connection', function(client) {


  // report current session
  client.emit('session', client.handshake.session);


  // direct auth by client side cookie
  client.on('signin', function(uid, ack) {
    if (uid) {
      var session = client.handshake.session = {uid: uid};
      // reuse session middleware codec
      var str = Session.serialize(sessionOptions.secret, session);
      ack(sessionOptions.session_key + '=' + str, session);
    } else {
      delete client.handshake.session;
      ack(sessionOptions.session_key + '=;expires='+(new Date(0)), {});
    }
  });


});
