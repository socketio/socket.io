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

// usernames which are currently connected to the chat
var usernames = {};

io.sockets.on('connection', function (socket) {

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'update chat' with 2 parameters
    io.sockets.emit('update chat', socket.username, data);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    // echo to client they've connected
    socket.emit('update chat', 'SERVER', 'you (' + username + ') have connected. ' + getNumberOfUsersString());
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('update chat', 'SERVER', username + ' has connected. ' + getNumberOfUsersString());
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    delete usernames[socket.username];
    // echo globally that this client has left
    socket.broadcast.emit('update chat', 'SERVER', socket.username + ' has disconnected. ' + getNumberOfUsersString());
  });
});

// Gets a string that contains the number of users in the chatroom
function getNumberOfUsersString () {
  var numUsers = Object.keys(usernames).length;
  var numUsersString = '<span class="log">(' + numUsers + ' ' + ((numUsers === 1) ? 'user' : 'users') + ' in chatroom)</span>';
  return numUsersString;
}