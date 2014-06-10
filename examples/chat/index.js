// Setup basic express server 设置基本的快速服务器
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing 路由部分
app.use(express.static(__dirname + '/public'));

// Chatroom 聊天室

// usernames which are currently connected to the chat 用来存储已连接用户名的数组
var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes 当有新消息（new message事件）时，运行此功能（node的事件驱动特性开始显现）
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message' 广播告诉所有的客户端，新消息（包括username和data）
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes 当有新用户加入（add user事件）时，运行此功能函数
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client 提取soket中的username
    socket.username = username;
    // add the client's username to the global list 将上述的username加入全局用户数组，并增加用户数numUsers，并驱动login事件
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected 广播用户上线提示，驱动user joined事件
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others 广播正在输入提示，驱动typing事件
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others 广播停止输入提示，驱动stop typing事件
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this 当用户下线时
  socket.on('disconnect', function () {
    // remove the username from global usernames list 从全局数组里移除该用户
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left 广播此用户离去
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
