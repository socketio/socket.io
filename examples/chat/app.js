// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..').listen(server);
var port = 8000;

server.listen(port);
console.log('Server listening at port %d', port);

// Routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
app.get('/main.js', function (req, res) {
  res.sendfile(__dirname + '/main.js');
});
app.get('/style.css', function (req, res) {
  res.sendfile(__dirname + '/style.css');
});

// Chatroom

var COLORS = [
  '#e21400', '#91580f', '#f8a700', '#f78b00',
  '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
  '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
];

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      color: socket.color,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    socket.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      color: socket.color
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;
    }
    // echo globally that this client has left
    socket.broadcast.emit('user left', {
      username: socket.username
    });
  });
});