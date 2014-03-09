
# Engine.IO client

[![Build Status](https://secure.travis-ci.org/LearnBoost/engine.io-client.png)](http://travis-ci.org/LearnBoost/engine.io-client)
[![NPM version](https://badge.fury.io/js/engine.io-client.png)](http://badge.fury.io/js/engine.io-client)

This is the client for [Engine.IO](http://github.com/learnboost/engine.io), the
implementation of transport-based cross-browser/cross-device bi-directional
communication layer for [Socket.IO](http://github.com/learnboost/socket.io).

## How to use

### Standalone

You can find an `engine.io.js` file in this repository, which is a
standalone build you can use as follows:

```html
<script src="/path/to/engine.io.js"></script>
<script>
  // eio = Socket
  var socket = eio('ws://localhost');
  socket.onopen = function(){
    socket.onmessage = function(data){};
    socket.onclose = function(){};
  };
</script>
```

### With browserify

Engine.IO is a commonjs module, which means you can include it by using
`require` on the browser and package using [browserify](http://browserify.org/):

1. install the client package
``` shell
npm install engine.io-client
```

1. write your app code
```js
var socket = require('engine.io-client')('ws://localhost');
socket.onopen = function(){
    socket.onmessage = function(data){};
    socket.onclose = function(){};
};
```

1. build your app bundle
```bash
$ browserify app.js > bundle.js
```

1. include on your page
```html
<script src="/path/to/bundle.js"></script>
```

### Sending and receiving binary

```html
<script src="/path/to/engine.io.js"></script>
<script>
  var socket = new eio.Socket('ws://localhost/');
  socket.binaryType = 'blob'; // receives Blob instead of ArrayBuffer (default)
  socket.on('open', function () {
    socket.send(new Int8Array(5));
    socket.on('message', function (data) {
      // data instanceof Blob => true when receiving binary
    });
    socket.on('close', function () { });
  });
</script>
```

### Node.JS

Add `engine.io-client` to your `package.json` and then:

```js
var socket = require('engine.io-client')('ws://localhost');
socket.onopen = function(){
  socket.onmessage = function(data){};
  socket.onclose = function(){};
};
```

## Features

- Lightweight
  - Lazyloads Flash transport
- Isomorphic with WebSocket API
- Runs on browser and node.js seamlessly
- Transports are independent of `Engine`
  - Easy to debug
  - Easy to unit test
- Runs inside HTML5 WebWorker
- Can send and receive binary data
  - Receives as ArrayBuffer or Blob when in browser, and Buffer or ArrayBuffer
    in Node
  - When XHR2 or WebSockets are used, binary is emitted directly. Otherwise
    binary is encoded into base64 strings, and decoded when binary types are
    supported.
  - With browsers that don't support ArrayBuffer, an object { base64: true,
    data: dataAsBase64String } is emitted in onmessage

## API

### Socket

The client class. Mixes in [Emitter](http://github.com/component/emitter).
Exposed as `eio` in the browser standalone build.

#### Properties

- `protocol` _(Number)_: protocol revision number
- `onopen` (_Function_)
  - `open` event handler
- `onmessage` (_Function_)
  - `message` event handler
- `onclose` (_Function_)
  - `message` event handler
- `binaryType` _(String)_ : can be set to 'arraybuffer' or 'blob' in browsers,
  and `buffer` or `arraybuffer` in Node. Blob is only used in browser if it's
  supported.

#### Events

- `open`
  - Fired upon successful connection.
- `message`
  - Fired when data is received from the server.
  - **Arguments**
    - `String` | `ArrayBuffer`: utf-8 encoded data or ArrayBuffer containing
      binary data
- `close`
  - Fired upon disconnection. In compliance with the WebSocket API spec, this event may be 
    fired even if the `open` event does not occur (i.e. due to connection error or `close()`).
- `error`
  - Fired when an error occurs.
- `flush`
  - Fired upon completing a buffer flush
- `drain`
  - Fired after `drain` event of transport if writeBuffer is empty
- `upgradeError`
  - Fired if an error occurs with a transport we're trying to upgrade to.
- `upgrade`
  - Fired upon upgrade success, after the new transport is set

#### Methods

- **constructor**
    - Initializes the client
    - **Parameters**
      - `String` uri
      - `Object`: optional, options object
    - **Options**
      - `agent` (`http.Agent`): `http.Agent` to use, defaults to `false` (NodeJS only)
      - `upgrade` (`Boolean`): defaults to true, whether the client should try
      to upgrade the transport from long-polling to something better.
      - `forceJSONP` (`Boolean`): forces JSONP for polling transport.
      - `forceBase64` (`Boolean`): forces base 64 encoding for polling transport even when XHR2 responseType is available and WebSocket even if the used standard supports binary.
      - `timestampRequests` (`Boolean`): whether to add the timestamp with
        each transport request. Note: this is ignored if the browser is
        IE or Android, in which case requests are always stamped (`false`)
      - `timestampParam` (`String`): timestamp parameter (`t`)
      - `flashPath` (`String`): path to flash client files with trailing slash
      - `policyPort` (`Number`): port the policy server listens on (`843`)
      - `path` (`String`): path to connect to, default is `/engine.io`
      - `transports` (`Array`): a list of transports to try (in order).
      Defaults to `['polling', 'websocket', 'flashsocket']`. `Engine`
      always attempts to connect directly with the first one, provided the
      feature detection test for it passes.
      - `rememberUpgrade` (`Boolean`): defaults to false.
        If true and if the previous websocket connection to the server succeeded,
        the connection attempt will bypass the normal upgrade process and will initially
        try websocket. A connection attempt following a transport error will use the 
        normal upgrade process. It is recommended you turn this on only when using
        SSL/TLS connections, or if you know that your network does not block websockets.
- `send`
    - Sends a message to the server
    - **Parameters**
      - `String` | `ArrayBuffer` | `ArrayBufferView` | `Blob`: data to send
      - `Function`: optional, callback upon `drain`
- `close`
    - Disconnects the client.

### Transport

The transport class. Private. _Inherits from EventEmitter_.

#### Events

- `poll`: emitted by polling transports upon starting a new request
- `pollComplete`: emitted by polling transports upon completing a request
- `drain`: emitted by polling transports upon a buffer drain

## Flash transport

In order for the Flash transport to work correctly, ensure the `flashPath`
property points to the location where the files `web_socket.js`,
`swfobject.js` and `WebSocketMainInsecure.swf` are located.

These files can be found here
[https://github.com/gimite/web-socket-js.git](https://github.com/gimite/web-socket-js.git)

## Tests

`engine.io-client` is used to test
[engine](http://github.com/learnboost/engine.io). Running the `engine.io`
test suite ensures the client works and vice-versa.

Browser tests are run using [zuul](https://github.com/defunctzombie/zuul). You can
run the tests locally using the following command.

```
./node_modules/.bin/zuul --local 8080 -- test/index.js
```

Additionally, `engine.io-client` has a standalone test suite you can run
with `make test` which will run node.js and browser tests. You must have zuul setup with
a saucelabs account.

## Support

The support channels for `engine.io-client` are the same as `socket.io`:
  - irc.freenode.net **#socket.io**
  - [Google Groups](http://groups.google.com/group/socket_io)
  - [Website](http://socket.io)

## Development

To contribute patches, run tests or benchmarks, make sure to clone the
repository:

```bash
git clone git://github.com/LearnBoost/engine.io-client.git
```

Then:

```bash
cd engine.io-client
npm install
```

See the `Tests` section above for how to run tests before submitting any patches.

## License

(The MIT License)

Copyright (c) 2014 Guillermo Rauch &lt;guillermo@learnboost.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
