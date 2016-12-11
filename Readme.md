
# socket.io

[![Build Status](https://secure.travis-ci.org/socketio/socket.io.svg?branch=master)](https://travis-ci.org/socketio/socket.io)
[![Dependency Status](https://david-dm.org/socketio/socket.io.svg)](https://david-dm.org/socketio/socket.io)
[![devDependency Status](https://david-dm.org/socketio/socket.io/dev-status.svg)](https://david-dm.org/socketio/socket.io#info=devDependencies)
[![NPM version](https://badge.fury.io/js/socket.io.svg)](https://www.npmjs.com/package/socket.io)
![Downloads](https://img.shields.io/npm/dm/socket.io.svg?style=flat)
[![](http://slack.socket.io/badge.svg?)](http://slack.socket.io)

## How to use

The following example attaches socket.io to a plain Node.JS
HTTP server listening on port `3000`.

```js
var server = require('http').createServer();
var io = require('socket.io')(server);
io.on('connection', function(client){
  client.on('event', function(data){});
  client.on('disconnect', function(){});
});
server.listen(3000);
```

### Standalone

```js
var io = require('socket.io')();
io.on('connection', function(client){});
io.listen(3000);
```

### In conjunction with Express

Starting with **3.0**, express applications have become request handler
functions that you pass to `http` or `http` `Server` instances. You need
to pass the `Server` to `socket.io`, and not the express application
function.

```js
var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
io.on('connection', function(){ /* … */ });
server.listen(3000);
```

### In conjunction with Koa

Like Express.JS, Koa works by exposing an application as a request
handler function, but only by calling the `callback` method.

```js
var app = require('koa')();
var server = require('http').createServer(app.callback());
var io = require('socket.io')(server);
io.on('connection', function(){ /* … */ });
server.listen(3000);
```

### Emit cheatsheet

```js
// sending to sender-client only
socket.emit('message', 'this is a test');
// sending to all clients, including sender
io.emit('message', 'this is a test');
// sending to all clients except sender
socket.broadcast.emit('message', 'this is a test');
// sending to all clients in 'game' room except sender
socket.to('game').emit('message', 'nice game');
// sending to all clients in 'game' room, including sender
io.in('game').emit('message', 'cool game');
// sending to all clients in namespace 'myNamespace', including sender
io.of('myNamespace').emit('message', 'gg');
// sending to individual socketid (private message)
socket.to(socketid).emit('message', 'for your eyes only');
// sending with acknowledgement
socket.emit('question', function (answer) {});
// sending without compression
socket.compress(false).emit('message', 'uncompressed');
// sending a message that might be dropped if the client is not ready to receive messages
socket.volatile.emit('message', 'maybe');
```


## API

### Server

  Exposed by `require('socket.io')`.

##### Properties

- `sockets` _(Namespace)_: the default (`/`) namespace

##### Methods

- **constructor**
    - Creates a new `Server`. Works with and without `new`:

    ```js
    var io = require('socket.io')();
    // or
    var Server = require('socket.io');
    var io = new Server();
    ```

    - **Parameters**
      - `http.Server|Number|Object`
          - either an `http.Server` to bind to.
          - or a port to listen to (a new `http.Server` will be created)
          - or an options object
      - `Object`: optional, options object
    - **Options**
      - `path` (`String`): name of the path to capture (`/socket.io`)
      - `serveClient` (`Boolean`): whether to serve the client files (`true`)
      - `adapter` (`Adapter`): the adapter to use. Defaults to an instance of the `Adapter` that ships with socket.io which is memory based. See [socket.io-adapter](https://github.com/socketio/socket.io-adapter)
      - `origins` (`String`): the allowed origins (`*`)
      - `allowRequest` (`Function`): A function that receives a given handshake or upgrade request as its first parameter, and can decide whether to continue or not. The second argument is a function that needs to be called with the decided information: `fn(err, success)`, where `success` is a boolean value where false means that the request is rejected, and err is an error code.

      The same options passed to socket.io are always passed to the `engine.io` `Server` that gets created. See engine.io [options](https://github.com/socketio/engine.io#methods-1) as reference.


- `serveClient`
    - If `v` is `true` the attached server (see `Server#attach`) will serve the client files. Defaults to `true`.
    - This method has no effect after `attach` is called.
    - If no arguments are supplied this method returns the current value.
    - **Parameters**
      - `Boolean`: If `v` is `true` the attached server (see `Server#attach`) will serve the client files (`true`).
    - **Returns** `Server` for chaining

```js
// pass a server and the `serveClient` option
var io = require('socket.io')(http, { serveClient: false });

// or pass no server and then you can call the method
var io = require('socket.io')();
io.serveClient(false);
io.attach(http);
```

- `path`
    - Sets the path `v`under which `engine.io` and the static files will be
      served. Defaults to `/socket.io`.
    - If no arguments are supplied this method returns the current value.
    - **Parameters**
      - `String`: optional, the pathname to use
    - **Returns** `Server` for chaining

- `adapter`
    - Sets the adapter `v`. Defaults to an instance of the `Adapter` that
      ships with socket.io which is memory based. See
      [socket.io-adapter](https://github.com/socketio/socket.io-adapter).
    - If no arguments are supplied this method returns the current value.
    - **Parameters**
      - `Adapter`: optional, the adapter to use
    - **Returns** `Server` for chaining

- `origins`
    - Sets the allowed origins `v`. Defaults to any origins being allowed.
    - If no arguments are supplied this method returns the current value.
    - **Parameters**
      - `String|Function`: optional, either the allowed origins or a function taking two arguments `origin:String` and `callback(error, success)`, where `success` is a boolean value indicating whether origin is allowed or not.
    - **Returns** `Server` for chaining

      __Potential drawbacks__:
      * in some situations, when it is not possible to determine `origin` it may have value of `*`
      * As this function will be executed for every request, it is advised to make this function work as fast as possible
      * If `socket.io` is used together with `Express`, the CORS headers will be affected only for `socket.io` requests. For Express can use [cors](https://github.com/expressjs/cors).

- `attach` (or `listen`)
    - Attaches the `Server` to an engine.io instance on `srv` with the
      supplied `opts` (optionally).
    - **Parameters**
      - `http.Server|Number`: the server to attach to, or the port to listen on
      - `Object`: optional, the options passed to the engine.io instance.

- `bind`
    - Advanced use only. Binds the server to a specific engine.io `Server` (or compatible API) instance.
    - **Parameters**
      - `engine.Server`

- `onconnection`
    - Advanced use only. Creates a new `socket.io` client from the incoming engine.io (or compatible API) `socket`.
    - **Parameters**
      - `engine.Socket`

- `of`
    - Initializes and retrieves the given `Namespace` by its pathname identifier `nsp`.
    - If the namespace was already initialized it returns it immediately.
    - **Parameters**
      - `String` the namespace name
    - **Returns** `Namespace`

- `emit`
    - Emits an event to all connected clients. The following two are equivalent:

```js
var io = require('socket.io')();
io.sockets.emit('an event sent to all connected clients');
io.emit('an event sent to all connected clients');
```

- `close`
    - Closes socket.io server.
    - **Parameters**
      - `Function` optional, called when all connections are closed

```js
var Server = require('socket.io');
var PORT   = 3030;
var server = require('http').Server();

var io = Server(PORT);

io.close(); // Close current server

server.listen(PORT); // PORT is free to use

io = Server(server);
```

- For other available methods, see `Namespace` below.


### Namespace

  Represents a pool of sockets connected under a given scope identified
  by a pathname (eg: `/chat`).

  By default the client always connects to `/`.

##### Events

- `connection` / `connect`
    - Fired upon a connection.
    - **Arguments**
      - `Socket` the incoming socket.

##### Properties

- `name` _(String)_: the namespace identifier property.
- `connected`  _(Object<Socket>)_: hash of `Socket` objects that are connected to this namespace indexed by `id`.

##### Methods

- `clients`
    - Gets a list of client IDs connected to this namespace (across all nodes if applicable).
    - **Parameters**
      - `Function`

```js
var io = require('socket.io')();
io.of('/chat').clients(function(error, clients){
  if (error) throw error;
  console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
});
```

An example to get all clients in namespace's room:

```js
var io = require('socket.io')();
io.of('/chat').in('general').clients(function(error, clients){
  if (error) throw error;
  console.log(clients); // => [Anw2LatarvGVVXEIAAAD]
});
```

As with broadcasting, the default is all clients from the default namespace ('/'):

```js
var io = require('socket.io')();
io.clients(function(error, clients){
  if (error) throw error;
  console.log(clients); // => [6em3d4TJP8Et9EMNAAAA, G5p55dHhGgUnLUctAAAB]
});
```

- `use`
    - Registers a middleware, which is a function that gets executed
      for every incoming `Socket`, and receives as parameters the socket
      and a function to optionally defer execution to the next registered
      middleware.
    - Errors passed to middleware callbacks are sent as special `error`
      packets to clients.
    - **Parameters**
      - `Function` the function to execute

```js
var io = require('socket.io')();
io.use(function(socket, next){
  if (socket.request.headers.cookie) return next();
  next(new Error('Authentication error'));
});
```


### Socket

  A `Socket` is the fundamental class for interacting with browser clients. A `Socket` belongs to a certain `Namespace` (by default `/`) and uses an underlying `Client` to communicate.

  It should be noted the `Socket` doesn't relate directly to the actual underlying TCP/IP `socket` and it is only the name of the class.

  Within each `Namespace`, you can also define arbitrary channels (called `room`) that the `Socket` can join and leave. That provides a convenient way to broadcast to a group of `Socket`s (see `Socket#to` below).

##### Properties

- `id` _(String)_: A unique identifier for the session, that comes from the underlying `Client`.
- `rooms` _(Object)_: A hash of strings identifying the rooms this client is in, indexed by room name.
- `client` _(Client)_: A reference to the underlying `Client` object.
- `conn` _(Socket)_: A reference to the underlying `Client` transport connection (engine.io `Socket` object). This allows access to the IO transport layer, which still (mostly) abstracts the actual TCP/IP socket.
- `request` _(Request)_: A getter proxy that returns the reference to the `request` that originated the underlying engine.io `Client`. Useful for accessing request headers such as `Cookie` or `User-Agent`.

##### Methods

- `use`
  - Registers a middleware, which is a function that gets executed for
    every incoming `Packet` and receives as parameter the packet and a
    function to optionally defer execution to the next registered
    middleware.
  - Errors passed to middleware callbacks are sent as special `error`
    packets to clients.

```js
var io = require('socket.io')();
io.on('connection', function(socket){
  socket.use(function(packet, next){
    if (packet.doge === true) return next();
    next(new Error('Not a doge error'));
  });
});
```

- `emit` (or `send`)
    - Emits an event identified by the string `name` to the client. Any other parameters can be included.
    - All datastructures are supported, including `Buffer`. JavaScript functions can't be serialized/deserialized.
    - You can pass an acknowledgement function as the last parameter, which will be called when the client get the message (only available when emitting to one client).

```js
var io = require('socket.io')();
io.on('connection', function(client){
  client.emit('an event', { some: 'data' });

  client.emit('ferret', 'tobi', function (data) {
    console.log(data); // data will be 'woot'
  });

  // the client code
  // client.on('ferret', function (name, fn) {
  //   fn('woot');
  // });

});
```

- `join`
    - Adds the client to the `room`, and fires optionally a callback `fn` with `err` signature (if any).
    - The mechanics of leaving rooms are handled by the `Adapter` that has been configured (see `Server#adapter` above), defaulting to [socket.io-adapter](https://github.com/socketio/socket.io-adapter).
    - **Parameters**
      - `String` the room name
      - `Function` optional, a callback executed when the socket has joined the room
    - **Returns** `Socket` for chaining

For your convenience, each socket automatically joins a room identified by this id (see `Socket#id`). This makes it easy to broadcast messages to other sockets:

```
io.on('connection', function(client){
  client.on('say to someone', function(id, msg){
    // send a private message to the socket with the given id
    client.broadcast.to(id).emit('my message', msg);
  });
});
```

- `leave`
    - Removes the client from `room`, and fires optionally a callback `fn` with `err` signature (if any).
    - **Rooms are left automatically upon disconnection**.
    - The mechanics of leaving rooms are handled by the `Adapter` that has been configured (see `Server#adapter` above), defaulting to [socket.io-adapter](https://github.com/socketio/socket.io-adapter).
    - **Parameters**
      - `String` the room name
      - `Function` optional, a callback executed when the socket has left the room
    - **Returns** `Socket` for chaining

- `to` (or `in`)
    - Sets a modifier for a subsequent event emission that the event will only be _broadcasted_ to clients that have joined the given `room`.
    - To emit to multiple rooms, you can call `to` several times.
    - **Parameters**
      - `String` the room name
    - **Returns** `Socket` for chaining

```js
var io = require('socket.io')();
io.on('connection', function(client){
  // to one room
  client.to('others').emit('an event', { some: 'data' });
  // to multiple rooms
  client.to('room1').to('room2').emit('hello');
});
```

- `compress`
    - Sets a modifier for a subsequent event emission that the event data will only be _compressed_ if the value is `true`. Defaults to `true` when you don't call the method.
    - **Parameters**
      - `Boolean` whether to following packet will be compressed
    - **Returns** `Socket` for chaining

```js
var io = require('socket.io')();
io.on('connection', function(client){
  client.compress(false).emit('an event', { some: 'data' });
});
```

- `broadcast`
    - Sets a modifier for a subsequent event emission that the event data will only be _broadcast_ to every sockets but the sender.
    - **Returns** `Socket` for chaining

```js
var io = require('socket.io')();
io.on('connection', function(client){
  client.broadcast.emit('an event', { some: 'data' }); // everyone gets it but the sender
});
```

- `volatile`
    - Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to receive messages (because of network slowness or other issues, or because they’re connected through long polling and is in the middle of a request-response cycle)
    - **Returns** `Socket` for chaining

```js
var io = require('socket.io')();
io.on('connection', function(client){
  client.volatile.emit('an event', { some: 'data' }); // the client may or may not receive it
});
```

- `disconnect`
    - Disconnects this client. If value of close is `true`, closes the underlying connection. Otherwise, it just disconnects the namespace.
    - **Parameters**
      - `Boolean` whether to close the underlying connection
    - **Returns** `Socket`

##### Events

- `disconnect`
    - Fired upon disconnection.
    - **Arguments**
      - `String`: the reason of the disconnection (either client or server-side)
- `error`
    - Fired when an error occurs.
    - **Arguments**
      - `Object`: error data
- `disconnecting`
    - Fired when the client is going to be disconnected (but hasn't left its `rooms` yet).
    - **Arguments**
      - `String`: the reason of the disconnection (either client or server-side)

These are reserved events (along with `connect`, `newListener` and `removeListener`) which cannot be used as event names.


### Client

The `Client` class represents an incoming transport (engine.io) connection. A `Client` can be associated with many multiplexed `Socket`s that belong to different `Namespace`s.

##### Properties

- `conn` _(Socket)_: A reference to the underlying `engine.io` `Socket` connection.
- `request` _(Request)_: A getter proxy that returns the reference to the `request` that originated the engine.io connection. Useful for accessing request headers such as `Cookie` or `User-Agent`.


## Debug / logging

Socket.IO is powered by [debug](https://github.com/visionmedia/debug).
In order to see all the debug output, run your app with the environment variable
`DEBUG` including the desired scope.

To see the output from all of Socket.IO's debugging scopes you can use:

```
DEBUG=socket.io* node myapp
```

## Testing

```
npm test
```
This runs the `gulp` task `test`. By default the test will be run with the source code in `lib` directory.

Set the environmental variable `TEST_VERSION` to `compat` to test the transpiled es5-compat version of the code.

The `gulp` task `test` will always transpile the source code into es5 and export to `dist` first before running the test.

## License

[MIT](LICENSE)
