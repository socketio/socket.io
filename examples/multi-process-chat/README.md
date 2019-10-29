
# Socket.IO Chat

A simple chat demo for socket.io

## How to use

```
$ wget http://download.redis.io/redis-stable.tar.gz
$ tar xvzf redis-stable.tar.gz
$ cd redis-stable
$ make
$ cd socket.io
$ npm install
$ cd examples/multi-process-chat
$ npm install
$ npm start
```

And point your browser to `http://localhost:8080`. Optionally, specify
a port by supplying the `PORT` env variable.

## Features

- Multiple users can join a chat room by each entering a unique username
on website load.
- Users can type chat messages to the chat room.
- A notification is sent to all users when a user joins or leaves
the chatroom.
