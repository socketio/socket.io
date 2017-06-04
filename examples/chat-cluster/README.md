
# Socket.IO Chat

A simple chat demo for socket.io

## How to use


### Starting Redis
This example uses Redis for communication between sockets that may be connected on different slave processes of the Node application.  

To install `redis-server` follow http://redis.io/topics/quickstart

Run redis with the default configuration. It will run on localhost port 6379.  This runs Redis in the foreground so keep this Terminal window open.

```
$ redis-server
```

### Running the example application

```
$ cd socket.io
$ npm install
$ cd examples/chat-cluster
$ npm install
$ node .
```

And point your browser to `http://localhost:3000`. Optionally, specify
a port by supplying the `PORT` env variable.

## Cluster Chat Features

- Forks the node process multiple times and routes requests to one of the slave processes of Node.


## Basic Chat Features (See other example)

- Multiple users can join a chat room by each entering a unique username
on website load.
- Users can type chat messages to the chat room.
- A notification is sent to all users when a user joins or leaves
the chatroom.
