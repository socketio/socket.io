# Engine.IO client

[![Build Status](https://secure.travis-ci.org/LearnBoost/engine.io-client.png)](http://travis-ci.org/LearnBoost/engine.io-client)

This is the client for [Engine](http://github.com/learnboost/engine.io), the
implementation of transport-based cross-browser/cross-device bi-directional
communication layer for [Socket.IO](http://github.com/learnboost/socket.io).

## Hello World

```html
<script src="/path/to/engine.js"></script>
<script>
  var socket = new eio.Socket({ host: 'localhost', port: 80 });
  socket.onopen = function () {
    socket.onmessage = function (data) { });
    socket.onclose = function () { });
  };
</script>
```

## Features

- Lightweight
  - Lazyloads Flash transport
- Isomorphic with WebSocket API
- Written for node, runs on browser thanks to
  [browserbuild](http://github.com/learnboost/browserbuild)
  - Maximizes code readability / maintenance.
  - Simplifies testing.
- Transports are independent of `Engine`
  - Easy to debug
  - Easy to unit test
- Runs inside HTML5 WebWorker

## API

<hr><br>

### Top-level

These are exposed in the `eio` global namespace (in the browser), or by
`require('engine.io-client')` (in Node.JS).

#### Properties

- `version` _(String)_: client version
- `protocol` _(Number)_: protocol revision number
- `Socket` _(Function)_: client constructor

### Socket

The client class. _Inherits from EventEmitter_.

#### Properties

- `onopen` (_Function_)
  - `open` event handler
- `onmessage` (_Function_)
  - `message` event handler
- `onclose` (_Function_)
  - `message` event handler

#### Events

- `open`
  - Fired upon successful connection.
- `message`
  - Fired when data is received from the server.
  - **Arguments**
    - `String`: utf-8 encoded data
- `close`
  - Fired upon disconnection.
- `error`
  - Fired when an error occurs.

#### Methods

- **constructor**
    - Initializes the client
    - **Parameters**
      - `Object`: optional, options object
    - **Options**
      - `host` (`String`): host name (`localhost`)
      - `port` (`Number`): port name (`80`)
      - `path` (`String`): path to intercept requests to (`/engine.io`)
      - `resource` (`String`): name of resource for this server (`default`).
        Setting a resource allows you to initialize multiple engine.io
        endpoints on the same host without them interfering, and without
        changing the `path` directly.
      - `query` (`Object`): optional query string addition (eg: `{ a: 'b' }`)
      - `secure` (`Boolean`): whether the connection is secure
      - `upgrade` (`Boolean`): defaults to true, whether the client should try
      to upgrade the transport from long-polling to something better.
      - `forceJSONP` (`Boolean`): forces JSONP for polling transport.
      - `timestampRequests` (`Boolean`): whether to add the timestamp with
        each transport request. Note: this is ignored if the browser is
        IE or Android, in which case requests are always stamped (`false`)
      - `timestampParam` (`String`): timestamp parameter (`t`)
      - `flashPath` (`String`): path to flash client files with trailing slash
      - `policyPort` (`Number`): port the policy server listens on (`843`)
      - `transports` (`Array`): a list of transports to try (in order).
      Defaults to `['polling', 'websocket', 'flashsocket']`. `Engine`
      always attempts to connect directly with the first one, provided the
      feature detection test for it passes.
- `send`
    - Sends a message to the server
    - **Parameters**
      - `String`: data to send
- `close`
    - Disconnects the client.

### Transport

The transport class. Private. _Inherits from EventEmitter_.

#### Events

- `poll`: emitted by polling transports upon starting a new request
- `pollComplete`: emitted by polling transports upon completing a request
- `drain`: emitted by polling transports upon a buffer drain

## Reconnecting

A `Socket` instance can be reused. After closing (either by calling
`Socket#close()` or network close), you can summon `open` again.

## Flash transport

In order for the Flash transport to work correctly, ensure the `flashPath`
property points to the location where the files `web_socket.js`,
`swfobject.js` and `WebSocketMainInsecure.swf` are located.

## Tests

`engine.io-client` is used to test
[engine](http://github.com/learnboost/engine.io)

## Support

The support channels for `engine.io-client` are the same as `socket.io`:
  - irc.freenode.net **#socket.io**
  - [Google Groups](http://groups.google.com/group/socket_io)
  - [Website](http://socket.io)

## Development

To contribute patches, run tests or benchmarks, make sure to clone the
repository:

```
git clone git://github.com/LearnBoost/engine.io-client.git
```

Then:

```
cd engine.io-client
npm install
```

## License 

(The MIT License)

Copyright (c) 2011 Guillermo Rauch &lt;guillermo@learnboost.com&gt;

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
