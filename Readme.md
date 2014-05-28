### This Readme corresponds to the upcoming 1.0 release. Please refer to http://socket.io for the current 0.9.x documentation.

<hr />

# socket.io

[![Build Status](https://secure.travis-ci.org/automattic/socket.io.png)](http://travis-ci.org/automattic/socket.io)
[![NPM version](https://badge.fury.io/js/socket.io.png)](http://badge.fury.io/js/socket.io)

## How to use

The following example attaches socket.io to a plain Node.JS
HTTP server listening on port `3000`.

```js
var server = require('http').Server();
var io = require('socket.io')(server);
io.on('connection', function(socket){
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
});
server.listen(3000);
```

### Standalone

```js
var io = require('socket.io')();
io.on('connection', function(socket){});
io.listen(3000);
```

### In conjunction with Express

Starting with **3.0**, express applications have become request handler
functions that you pass to `http` or `http` `Server` instances. You need
to pass the `Server` to `socket.io`, and not the express application
function.

```js
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
io.on('connection', function(){ /* … */ });
server.listen(3000);
```

### In conjunction with Koa

Like Express.JS, Koa works by exposing an application as a request
handler function, but only by calling the `callback` method.

```js
var app = require('koa')();
var server = require('http').Server(app.callback());
var io = require('socket.io')(server);
io.on('connection', function(){ /* … */ });
server.listen(3000);
```

## API

### Server

  Exposed by `require('socket.io')`.

### Server()

  Creates a new `Server`. Works with and without `new`:

  ```js
  var io = require('socket.io')();
  // or
  var Server = require('socket.io');
  var io = new Server();
  ```

### Server(opts:Object)

  Optionally, the first or second argument (see below) of the `Server`
  constructor can be an options object.

  The following options are supported:

  - `serveClient` sets the value for Server#serveClient()
  - `path` sets the value for Server#path()

  The same options passed to socket.io are always passed to
  the `engine.io` `Server` that gets created. See engine.io
  [options](https://github.com/learnboost/engine.io#methods-1)
  as reference.

### Server(srv:http#Server, opts:Object)

  Creates a new `Server` and attaches it to the given `srv`. Optionally
  `opts` can be passed.

### Server(port:Number, opts:Object)

  Binds socket.io to a new `http.Server` that listens on `port`.

### Server#serveClient(v:Boolean):Server

  If `v` is `true` the attached server (see `Server#attach`) will serve
  the client files. Defaults to `true`.

  This method has no effect after `attach` is called.

  ```js
  // pass a server and the `serveClient` option
  var io = require('socket.io')(http, { serveClient: false });

  // or pass no server and then you can call the method
  var io = require('socket.io')();
  io.serveClient(false);
  io.attach(http);
  ```

  If no arguments are supplied this method returns the current value.

### Server#path(v:String):Server

  Sets the path `v` under which `engine.io` and the static files will be
  served. Defaults to `/socket.io`.

  If no arguments are supplied this method returns the current value.

### Server#adapter(v:Adapter):Server

  Sets the adapter `v`. Defaults to an instance of the `Adapter` that
  ships with socket.io which is memory based. See
  [socket.io-adapter](https://github.com/learnboost/socket.io-adapter).

  If no arguments are supplied this method returns the current value.

### Server#origins(v:String):Server

  Sets the allowed origins `v`. Defaults to any origins being allowed.

  If no arguments are supplied this method returns the current value.


### Server#sockets:Namespace

  The default (`/`) namespace.

### Server#attach(srv:http#Server, opts:Object):Server

  Attaches the `Server` to an engine.io instance on `srv` with the
  supplied `opts` (optionally).

### Server#attach(port:Number, opts:Object):Server

  Attaches the `Server` to an engine.io instance that is bound to `port`
  with the given `opts` (optionally).

### Server#listen

  Synonym of `Server#attach`.

### Server#bind(srv:engine#Server):Server

  Advanced use only. Binds the server to a specific engine.io `Server` 
  (or compatible API) instance.

### Server#onconnection(socket:engine#Socket):Server

  Advanced use only. Creates a new `socket.io` client from the incoming
  engine.io (or compatible API) `socket`.

### Server#of(nsp:String):Namespace

  Initializes and retrieves the given `Namespace` by its pathname 
  identifier `nsp`.

  If the namespace was already initialized it returns it right away.

### Server#emit

  Emits an event to all connected clients. The following two are 
  equivalent:

  ```js
  var io = require('socket.io')();
  io.sockets.emit('an event sent to all connected clients');
  io.emit('an event sent to all connected clients');
  ```

  For other available methods, see `Namespace` below.

### Server#use

  See `Namespace#use` below.

### Namespace

  Represents a pool of sockets connected under a given scope identified
  by a pathname (eg: `/chat`).

  By default the client always connects to `/`.

#### Events

  - `connection` / `connect`. Fired upon a connection.

    Parameters:
    - `Socket` the incoming socket.

### Namespace#name:String

  The namespace identifier property.

### Namespace#connected:Object<Socket>

  Hash of `Socket` objects that are connected to this namespace indexed
  by `id`.

### Namespace#use(fn:Function):Namespace

  Registers a middleware, which is a function that gets executed for
  every incoming `Socket` and receives as parameter the socket and a
  function to optionally defer execution to the next registered
  middleware.

  ```js
  var io = require('socket.io')();
  io.use(function(socket, next){
    if (socket.request.headers.cookie) return next();
    next(new Error('Authentication error'));
  });
  ```

  Errors passed to middleware callbacks are sent as special `error`
  packets to clients.

### Socket

  A `Socket` is the fundamental class for interacting with browser
  clients. A `Socket` belongs to a certain `Namespace` (by default `/`)
  and uses an underlying `Client` to communicate.

### Socket#rooms:Array

  A list of strings identifying the rooms this socket is in.

### Socket#client:Client

  A reference to the underlying `Client` object.

### Socket#conn:Socket

  A reference to the underyling `Client` transport connection (engine.io
  `Socket` object).

### Socket#request:Request

  A getter proxy that returns the reference to the `request` that
  originated the underlying engine.io `Client`. Useful for accessing
  request headers such as `Cookie` or `User-Agent`.

### Socket#id:String

  A unique identifier for the socket session, that comes from the
  underlying `Client`.

### Socket#emit(name:String[, …]):Socket

  Emits an event to the socket identified by the string `name`. Any
  other parameters can be included.

  All datastructures are supported, including `Buffer`. JavaScript
  functions can't be serialized/deserialized.

  ```js
  var io = require('socket.io')();
  io.on('connection', function(socket){
    socket.emit('an event', { some: 'data' });
  });
  ```

### Socket#join(name:String[, fn:Function]):Socket

  Adds the socket to the `room`, and fires optionally a callback `fn`
  with `err` signature (if any).

  The socket is automatically a member of a room identified with its
  session id (see `Socket#id`).

  The mechanics of joining  rooms are handled by the `Adapter`
  that has been configured (see `Server#adapter` above), defaulting to
  [socket.io-adapter](https://github.com/socket.io/socket.io-adapter).

### Socket#leave(name:String[, fn:Function]):Socket

  Removes the socket from `room`, and fires optionally a callback `fn`
  with `err` signature (if any).

  **Rooms are left automatically upon disconnection**.

  The mechanics of leaving rooms are handled by the `Adapter`
  that has been configured (see `Server#adapter` above), defaulting to
  [socket.io-adapter](https://github.com/socket.io/socket.io-adapter).

### Socket#to(room:String):Socket
### Socket#in(room:String):Socket

  Sets a modifier for a subsequent event emission that the event will
  only be _broadcasted_ to sockets that have joined the given `room`.

  To emit to multiple rooms, you can call `to` several times.

  ```js
  var io = require('socket.io')();
  io.on('connection', function(socket){
    socket.to('others').emit('an event', { some: 'data' });
  });
  ```

### Client

  The `Client` class represents an incoming transport (engine.io)
  connection. A `Client` can be associated with many multiplexed `Socket`
  that belong to different `Namespace`s.

### Client#conn

  A reference to the underlying `engine.io` `Socket` connection.

### Client#request

  A getter proxy that returns the reference to the `request` that
  originated the engine.io connection. Useful for accessing
  request headers such as `Cookie` or `User-Agent`.

## Debug / logging

Socket.IO is powered by [debug](http://github.com/visionmedia/debug).
In order to see all the debug output, run your app with the environment variable
`DEBUG` including the desired scope.

To see the output from all of Socket.IO's debugging scopes you can use:

```
DEBUG=socket.io* node myapp
```

## License

MIT
