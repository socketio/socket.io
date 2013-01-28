
### This Readme corresponds to the upcoming 1.0 release. Please refer to http://socket.io for the current 0.9.x documentation.

<hr />

# socket.io

[![Build Status](https://secure.travis-ci.org/LearnBoost/socket.io.png)](http://travis-ci.org/LearnBoost/socket.io)

## How to use

```js
var server = require('http').Server();
var io = require('socket.io')(server);
io.on('connection', function(socket){
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
});
server.listen(3000);
```

### In conjunction with `Express`

Starting with **3.0**, express applications have become request handler
functions that you pass to `http` or `http` `Server` instances. You need
to pass the `Server` to `socket.io`, and not the express application
function.

```js
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
io.on('connection', function(){ // … });
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

  - `static` sets the value for Server#static()
  - `path` sets the value for Server#path()

  Options are always passed to the `engine.io` `Server` that gets created.

### Server(srv:http#Server, opts:Object)

  Creates a new `Server` and attaches it to the given `srv`. Optionally
  `opts` can be passed.

### Server(port:Number, opts:Object)

  Binds socket.io to a new `http.Server` that listens on `port`.

### Server#static(v:Boolean):Server

  If `v` is `true` the attached server (see `Server#attach`) will serve
  the client files. Defaults to `true`.

  This method has no effect after `attach` is called.

  ```js
  // pass a server and the `static` option
  var io = require('socket.io')(http, { static: false });

  // or pass no server and then you can call the method
  var io = require('socket.io')();
  io.static(false);
  io.attach(http);
  ```

  If no arguments are supplied this method returns the current value.

### Server#path(v:String):Server

  Sets the path `v` under which `engine.io` and the static files will be
  served. Defaults to `/socket.io`.

  If no arguments are supplied this method returns the current value.

### Server#adapter(v:Adapter):Server

  Sets the adapter `v`. Defaults to an instance of the `Adapter` that
  ships with socket.io which is memory based (see below).

  If no arguments are supplied this method returns the current value.

### Server#sockets:Namespace

  The default (`/`) namespace.

### Server#attach(srv:http#Server, opts:Object):Server

  Attaches the `Server` to an engine.io instance on `srv` with the
  supplied `opts` (optionally).

### Server#attach(port:Number, opts:Object):Server

  Attaches the `Server` to an engine.io instance that is bound to `port`
  with the given `opts` (optionally).

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
  var io = require('socket.io');
  io.sockets.emit('an event sent to all connected clients');
  io.emit('an event sent to all connected clients');
  ```

  For other available methods, see `Namespace` below.

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

### Socket

  A `Socket` is the fundamental class for interacting with browser
  clients.

### Socket#rooms:Array

  A list of strings identifying the rooms this socket is in.

### Client

  The `Client` class represents an incoming transport (engine.io)
  connection. A `Client` can be associated with many multiplexed `Socket`
  that belong to different `Namespace`s.

### Adapter

  The `Adapter` is in charge of keeping track of what rooms each socket
  is connected to, and passing messages to them.

  By default the `Adapter` is memory based. In order to pass messages
  across multiple processes, make sure to use an appropriate adapter.
  (configurable through `Server#adapter`).

## License

MIT
