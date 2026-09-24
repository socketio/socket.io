<h1>API</h1>

**Table of Contents**

<!-- TOC -->
  * [Top-level](#top-level)
    * [Events](#events)
    * [Properties](#properties)
    * [Methods](#methods)
  * [Server](#server)
    * [Events](#events-1)
    * [Properties](#properties-1)
    * [Methods](#methods-1)
  * [Socket](#socket)
    * [Events](#events-2)
    * [Properties](#properties-2)
    * [Methods](#methods-2)
<!-- TOC -->

## Top-level

These are exposed by `require('engine.io')`:

### Events

- `flush`
  - Called when a socket buffer is being flushed.
  - **Arguments**
    - `Socket`: socket being flushed
    - `Array`: write buffer
- `drain`
  - Called when a socket buffer is drained
  - **Arguments**
    - `Socket`: socket being flushed

### Properties

- `protocol` _(Number)_: protocol revision number
- `Server`: Server class constructor
- `Socket`: Socket class constructor
- `Transport` _(Function)_: transport constructor
- `transports` _(Object)_: map of available transports

### Methods

- `()`
  - Returns a new `Server` instance. If the first argument is an `http.Server` then the
    new `Server` instance will be attached to it. Otherwise, the arguments are passed
    directly to the `Server` constructor.
  - **Parameters**
    - `http.Server`: optional, server to attach to.
    - `Object`: optional, options object (see `Server#constructor` api docs below)

  The following are identical ways to instantiate a server and then attach it.

```js
const httpServer; // previously created with `http.createServer();` from node.js api.

// create a server first, and then attach
const eioServer = require('engine.io').Server();
eioServer.attach(httpServer);

// or call the module as a function to get `Server`
const eioServer = require('engine.io')();
eioServer.attach(httpServer);

// immediately attach
const eioServer = require('engine.io')(httpServer);

// with custom options
const eioServer = require('engine.io')(httpServer, {
  maxHttpBufferSize: 1e3
});
```

- `listen`
  - Creates an `http.Server` which listens on the given port and attaches WS
    to it. It returns `501 Not Implemented` for regular http requests.
  - **Parameters**
    - `Number`: port to listen on.
    - `Object`: optional, options object
    - `Function`: callback for `listen`.
  - **Options**
    - All options from `Server.attach` method, documented below.
    - **Additionally** See Server `constructor` below for options you can pass for creating the new Server
  - **Returns** `Server`

```js
const engine = require('engine.io');
const server = engine.listen(3000, {
  pingTimeout: 2000,
  pingInterval: 10000
});

server.on('connection', /* ... */);
```

- `attach`
  - Captures `upgrade` requests for a `http.Server`. In other words, makes
    a regular http.Server WebSocket-compatible.
  - **Parameters**
    - `http.Server`: server to attach to.
    - `Object`: optional, options object
  - **Options**
    - All options from `Server.attach` method, documented below.
    - **Additionally** See Server `constructor` below for options you can pass for creating the new Server
  - **Returns** `Server` a new Server instance.

```js
const engine = require('engine.io');
const httpServer = require('http').createServer().listen(3000);
const server = engine.attach(httpServer, {
  wsEngine: require('eiows').Server // requires having eiows as dependency
});

server.on('connection', /* ... */);
```

## Server

The main server/manager. _Inherits from EventEmitter_.

### Events

- `connection`
  - Fired when a new connection is established.
  - **Arguments**
    - `Socket`: a Socket object

- `initial_headers`
  - Fired on the first request of the connection, before writing the response headers
  - **Arguments**
    - `headers` (`Object`): a hash of headers
    - `req` (`http.IncomingMessage`): the request

- `headers`
  - Fired on the all requests of the connection, before writing the response headers
  - **Arguments**
    - `headers` (`Object`): a hash of headers
    - `req` (`http.IncomingMessage`): the request

- `connection_error`
  - Fired when an error occurs when establishing the connection.
  - **Arguments**
    - `error`: an object with following properties:
      - `req` (`http.IncomingMessage`): the request that was dropped
      - `code` (`Number`): one of `Server.errors`
      - `message` (`string`): one of `Server.errorMessages`
      - `context` (`Object`): extra info about the error

| Code | Message                        |
|------|--------------------------------|
| 0    | "Transport unknown"            |
| 1    | "Session ID unknown"           |
| 2    | "Bad handshake method"         |
| 3    | "Bad request"                  |
| 4    | "Forbidden"                    |
| 5    | "Unsupported protocol version" |

### Properties

**Important**: if you plan to use Engine.IO in a scalable way, please
keep in mind the properties below will only reflect the clients connected
to a single process.

- `clients` _(Object)_: hash of connected clients by id.
- `clientsCount` _(Number)_: number of connected clients.

### Methods

- **constructor**
  - Initializes the server
  - **Parameters**
    - `Object`: optional, options object
  - **Options**
    - `pingTimeout` (`Number`): how many ms without a pong packet to
      consider the connection closed (`20000`)
    - `pingInterval` (`Number`): how many ms before sending a new ping
      packet (`25000`)
    - `upgradeTimeout` (`Number`): how many ms before an uncompleted transport upgrade is cancelled (`10000`)
    - `maxHttpBufferSize` (`Number`): how many bytes or characters a message
      can be, before closing the session (to avoid DoS). Default
      value is `1E6`.
    - `allowRequest` (`Function`): A function that receives a given handshake
      or upgrade request as its first parameter, and can decide whether to
      continue or not. The second argument is a function that needs to be
      called with the decided information: `fn(err, success)`, where
      `success` is a boolean value where false means that the request is
      rejected, and err is an error code.
    - `transports` (`<Array> String`): transports to allow connections
      to (`['polling', 'websocket']`)
    - `allowUpgrades` (`Boolean`): whether to allow transport upgrades
      (`true`)
    - `perMessageDeflate` (`Object|Boolean`): parameters of the WebSocket permessage-deflate extension
      (see [ws module](https://github.com/einaros/ws) api docs). Set to `true` to enable. (defaults to `false`)
      - `threshold` (`Number`): data is compressed only if the byte size is above this value (`1024`)
    - `httpCompression` (`Object|Boolean`): parameters of the http compression for the polling transports
      (see [zlib](http://nodejs.org/api/zlib.html#zlib_options) api docs). Set to `false` to disable. (`true`)
      - `threshold` (`Number`): data is compressed only if the byte size is above this value (`1024`)
    - `cookie` (`Object|Boolean`): configuration of the cookie that
      contains the client sid to send as part of handshake response
      headers. This cookie might be used for sticky-session. Defaults to not sending any cookie (`false`).
      See [here](https://github.com/jshttp/cookie#options-1) for all supported options.
    - `wsEngine` (`Function`): what WebSocket server implementation to use. Specified module must conform to the `ws` interface (see [ws module api docs](https://github.com/websockets/ws/blob/master/doc/ws.md)). Default value is `ws`. An alternative c++ addon is also available by installing `eiows` module.
    - `cors` (`Object`): the options that will be forwarded to the cors module. See [there](https://github.com/expressjs/cors#configuration-options) for all available options. Defaults to no CORS allowed.
    - `initialPacket` (`Object`): an optional packet which will be concatenated to the handshake packet emitted by Engine.IO.
    - `allowEIO3` (`Boolean`): whether to support v3 Engine.IO clients (defaults to `false`)
- `close`
  - Closes all clients
  - **Returns** `Server` for chaining
- `handleRequest`
  - Called internally when a `Engine` request is intercepted.
  - **Parameters**
    - `http.IncomingMessage`: a node request object
    - `http.ServerResponse`: a node response object
  - **Returns** `Server` for chaining
- `handleUpgrade`
  - Called internally when a `Engine` ws upgrade is intercepted.
  - **Parameters** (same as `upgrade` event)
    - `http.IncomingMessage`: a node request object
    - `net.Stream`: TCP socket for the request
    - `Buffer`: legacy tail bytes
  - **Returns** `Server` for chaining
- `attach`
  - Attach this Server instance to an `http.Server`
  - Captures `upgrade` requests for a `http.Server`. In other words, makes
    a regular http.Server WebSocket-compatible.
  - **Parameters**
    - `http.Server`: server to attach to.
    - `Object`: optional, options object
  - **Options**
    - `path` (`String`): name of the path to capture (`/engine.io`).
    - `destroyUpgrade` (`Boolean`): destroy unhandled upgrade requests (`true`)
    - `destroyUpgradeTimeout` (`Number`): milliseconds after which unhandled requests are ended (`1000`)
- `generateId`
  - Generate a socket id.
  - Overwrite this method to generate your custom socket id.
  - **Parameters**
    - `http.IncomingMessage`: a node request object
  - **Returns** A socket id for connected client.

<hr><br>

## Socket

A representation of a client. _Inherits from EventEmitter_.

### Events

- `close`
  - Fired when the client is disconnected.
  - **Arguments**
    - `String`: reason for closing
    - `Object`: description object (optional)
- `message`
  - Fired when the client sends a message.
  - **Arguments**
    - `String` or `Buffer`: Unicode string or Buffer with binary contents
- `error`
  - Fired when an error occurs.
  - **Arguments**
    - `Error`: error object
- `upgrading`
  - Fired when the client starts the upgrade to a better transport like WebSocket.
  - **Arguments**
    - `Object`: the transport
- `upgrade`
  - Fired when the client completes the upgrade to a better transport like WebSocket.
  - **Arguments**
    - `Object`: the transport
- `flush`
  - Called when the write buffer is being flushed.
  - **Arguments**
    - `Array`: write buffer
- `drain`
  - Called when the write buffer is drained
- `packet`
  - Called when a socket received a packet (`message`, `ping`)
  - **Arguments**
    - `type`: packet type
    - `data`: packet data (if type is message)
- `packetCreate`
  - Called before a socket sends a packet (`message`, `ping`)
  - **Arguments**
    - `type`: packet type
    - `data`: packet data (if type is message)
- `heartbeat`
  - Called when `ping` or `pong` packed is received (depends of client version)

### Properties

- `id` _(String)_: unique identifier
- `server` _(Server)_: engine parent reference
- `request` _(http.IncomingMessage)_: request that originated the Socket
- `upgraded` _(Boolean)_: whether the transport has been upgraded
- `readyState` _(String)_: opening|open|closing|closed
- `transport` _(Transport)_: transport reference

### Methods

- `send`:
  - Sends a message, performing `message = toString(arguments[0])` unless
    sending binary data, which is sent as is.
  - **Parameters**
    - `String` | `Buffer` | `ArrayBuffer` | `ArrayBufferView`: a string or any object implementing `toString()`, with outgoing data, or a Buffer or ArrayBuffer with binary data. Also any ArrayBufferView can be sent as is.
    - `Object`: optional, options object
    - `Function`: optional, a callback executed when the message gets flushed out by the transport
  - **Options**
    - `compress` (`Boolean`): whether to compress sending data. This option might be ignored and forced to be `true` when using polling. (`true`)
  - **Returns** `Socket` for chaining
- `close`
  - Disconnects the client
  - **Returns** `Socket` for chaining
