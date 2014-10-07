// Setup basic express server
var express = require('express');
var app = express();
// var server = require('http').createServer(app);
var http = require('http');
var port = process.env.PORT || 3000

// Required for cluster
var redisAdapter = require('socket.io-redis');
var sticky = require('sticky-session');
var redis = require('redis');
var cluster = require('cluster');

// number of slaves
var workers = process.env.WORKERS || 5;   // use 5 slaves if no number of works is specified


///////////////////////////////////
//      Server
//
// Configure sticky sessions to ensure requests go to the same
// child in the cluster.
// See : https://github.com/indutny/sticky-session
// NOTE: Sticky sessions are based on a hash of the IP address. 
// This means multiple web browsers or tabs on the same machine 
// will always hit the same slave.
//
///////////////////////////////////

sticky(workers, function() {

  // This code will be executed only in slave workers
  var server = http.createServer(app);

  var io = require('../..')(server);
  //var io = require('socket.io')(server);

  // configure socket.io to use redis adapter
  addRedisAdapter(io);

  // configure socket.io to respond to certain events
  addIOEventHandlers(io);

  return server;

}).listen(port, function() {

  // this code is executed in both slaves and master
  console.log('server started on port '+port+'. process id = '+process.pid);

});


///////////////////////////////////
//      Routing
///////////////////////////////////

app.use(express.static(__dirname + '/public'));


///////////////////////////////////
//      Redis Adapter
///////////////////////////////////

function addRedisAdapter(io) {
  var redisUrl = process.env.REDISTOGO_URL || 'redis://127.0.0.1:6379';
  var redisOptions = require('parse-redis-url')(redis).parse(redisUrl);
  var pub = redis.createClient(redisOptions.port, redisOptions.host, {
    detect_buffers: true,
    auth_pass: redisOptions.password
  });
  var sub = redis.createClient(redisOptions.port, redisOptions.host, {
    detect_buffers: true,
    auth_pass: redisOptions.password
  });

  io.adapter(redisAdapter({
    pubClient: pub,
    subClient: sub
  }));
  console.log('Redis adapter started with url: ' + redisUrl);
};

///////////////////////////////////
//      Chatroom Handlers
///////////////////////////////////

// usernames which are currently connected to the chat
// var usernames = {};
// var numUsers = 0;

function addIOEventHandlers(io) {

  io.on('connection', function (socket) {

    // var addedUser = false;
    console.log('Connection made. socket.id='+socket.id+' . pid = '+process.pid);

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
      // we tell the client to execute 'new message'

      console.log('emitting message: "'+data+'". socket.id='+socket.id+' . pid = '+process.pid);
      socket.broadcast.emit('new message', {
        username: socket.username,
        message: data
      });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (username) {
      // we store the username in the socket session for this client
      socket.username = username;
      // add the client's username to the global list
      // usernames[username] = username;
      // ++numUsers;
      // addedUser = true;
      socket.emit('login', {  // todo
        numUsers: 420
      });
      // echo globally (all clients) that a person has connected
      socket.broadcast.emit('user joined', {  // todo
        username: socket.username,
        numUsers: 421
      });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
      socket.broadcast.emit('typing', {
        username: socket.username
      });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {
      socket.broadcast.emit('stop typing', {
        username: socket.username
      });
    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      socket.broadcast.emit('user left', {  // todo
        username: socket.username,
        numUsers: 422
      });
    });

  });

};