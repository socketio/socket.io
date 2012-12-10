
# socket.io-client

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
      socket.on('disconnect', fucntion(){});
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

### IO(url:Object, opts:Object):Socket

  Creates a new `Manager` but the URL settings are an engine.io compatible
  object (see [engine.io-client](http://github.com/learnbooost/engine.io-client))
  for details. You can use this signature to pass specific options to
  the transport, like to disable transports.

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

### Manager(url:Object, opts:Object)

  Identical to above, except the `url` object is passed to `engine.io`.
  You can also pass additional `engine.io` options this way.

## License

MIT
