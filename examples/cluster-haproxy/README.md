
# Socket.IO Chat with haproxy & redis

A simple chat demo for socket.io

## How to use

Install [Docker Compose](https://docs.docker.com/compose/install/), then:

```
$ docker-compose up -d
```

And then point your browser to `http://localhost:3000`.

This will start four Socket.IO nodes, behind a haproxy instance which will loadbalance the requests (using a cookie for sticky sessions, see [cookie](https://cbonte.github.io/haproxy-dconv/1.7/configuration.html#4.2-cookie)).

Each node connects to the redis backend, which will enable to broadcast to every client, no matter which node it is currently connected to.

```
# you can kill a given node, the client should reconnect to another node
$ docker-compose stop server-george
```

## Features

- Multiple users can join a chat room by each entering a unique username
on website load.
- Users can type chat messages to the chat room.
- A notification is sent to all users when a user joins or leaves
the chatroom.
