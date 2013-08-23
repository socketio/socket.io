### This Readme corresponds to the upcoming 1.0 release. Please refer to http://socket.io for the current 0.9.x documentation.

# socket.io-client

[![Build Status](https://secure.travis-ci.org/LearnBoost/socket.io-client.png)](http://travis-ci.org/LearnBoost/socket.io-client)

## How to use

### Standalone

  A standalone build of `socket.io-client` is exposed automatically by the
  socket.io server as `/socket.io/socket.io.js`. Alternatively you can
  serve the file `socket.io-client.js` found at the root of this repository.

  ```html
  <script src="/socket.io/socket.io.js"></script>
  <script>
    var socket = io('http://localhost');
    socket.on('connect', function(){
      socket.on('event', function(data){});
      socket.on('disconnect', function(){});
    });
  </script>
  ```

### Component

  Socket.IO is a [component](http://github.com/component/component), which
  means you can include it by using `require` on the browser:

  ```js
  var socket = require('socket.io')('http://localhost');
  socket.on('connect', function(){
    socket.on('event', function(data){});
    socket.on('disconnect', fucntion(){});
  });
  ```

### Node.JS

  Add `socket.io-client` to your `package.json` and then:

  ```js
  var socket = require('socket.io-client')('http://localhost');
  socket.on('connect', function(){
    socket.on('event', function(data){});
    socket.on('disconnect', fucntion(){});
  });
  ```

## API

### IO(url:String, opts:Object):Socket

  Exposed as the `io` namespace in the standalone build, or the result
  of calling `require('socket.io-client')`.

  When called, it creates a new `Manager` for the given URL, and attempts
  to reuse an existing `Manager` for subsequent calls, unless the
  `multiplex` option is passed with `false`.

  The rest of the options are passed to the `Manager` constructor (see below
  for details).

  A `Socket` instance is returned for the namespace specified by the
  pathname in the URL, defaulting to `/`. For example, if the `url` is
  `http://localhost/users`, a transport connection will be established to
  `http://localhost` and a Socket.IO connection will be established to
  `/users`.

### IO#protocol

  Socket.io protocol revision number this client works with.

### IO#Socket

  Reference to the `Socket` constructor.

### IO#Manager

  Reference to the `Manager` constructor.

### IO#Emitter

  Reference to the `Emitter` constructor.

### Manager(url:String, opts:Object)

  A `Manager` represents a connection to a given Socket.IO server. One or
  more `Socket` instances are associated with the manager. The manager
  can be accessed through the `io` property of each `Socket` instance.

  The `opts` are also passed to `engine.io` upon initialization of the
  underlying `Socket`.

  - `connect`. Fired upon a succesful connection.
  - `connect_error`. Fired upon a connection error.
    Parameters:
      - `Object` error object
  - `connect_timeout`. Fired upon a connection timeout.
  - `reconnect`. Fired upon a successful reconnection.
    Parameters:
      - `Number` reconnection attempt number
  - `reconnect_error`. Fired upon a reconnection attempt error.
    Parameters:
      - `Object` error object
  - `reconnect_failed`

### Socket

#### Events

  - `connect`. Fired upon connecting.
  - `error`. Fired upon a connection error
    Parameters:
      - `Object` error data
  - `disconnect`. Fired upon a disconnection.

## License

MIT
