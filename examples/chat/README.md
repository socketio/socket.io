
# Socket.IO Chat

A simple chat demo for Socket.IO

## How to use

```
$ npm i
$ npm start
```

And point your browser to `http://localhost:3000`. Optionally, specify
a port by supplying the `PORT` env variable.


## Docker 
You can run this example with Docker:

```
docker run -d -p 3000:3000 crstian/socket-io-chat
```

Or you can build for your own:

```
docker build -t . username/socket-io-chat
```

Docker-compose
```
version: '3.7'
services:
    socketio:
        image: crstian/socket-io-chat
        ports:
            - "3000:3000"
```


## Features

- Multiple users can join a chat room by each entering a unique username
on website load.
- Users can type chat messages to the chat room.
- A notification is sent to all users when a user joins or leaves
the chatroom.
