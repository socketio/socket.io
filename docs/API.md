
## Table of Contents

- [IO](#io)
  - [io.protocol](#ioprotocol)
  - [io(url[, options])](#iourl-options)
  - [Class: io.Manager](#manager)
    - [new Manager(url[, options])](#new-managerurl-options)
    - [manager.reconnection([value])](#managerreconnectionvalue)
    - [manager.reconnectionAttempts([value])](#managerreconnectionattemptsvalue)
    - [manager.reconnectionDelay([value])](#managerreconnectiondelayvalue)
    - [manager.reconnectionDelayMax([value])](#managerreconnectiondelaymaxvalue)
    - [manager.timeout([value])](#managertimeoutvalue)
    - [manager.open([callback])](#manageropencallback)
    - [manager.connect([callback])](#managerconnectcallback)
    - [manager.socket(nsp, options)](#managersocketnsp-options)
    - [Event: 'connect_error'](#event-connect_error)
    - [Event: 'connect_timeout'](#event-connect_timeout)
    - [Event: 'reconnect'](#event-reconnect)
    - [Event: 'reconnect_attempt'](#event-reconnect_attempt)
    - [Event: 'reconnecting'](#event-reconnecting)
    - [Event: 'reconnect_error'](#event-reconnect_error)
    - [Event: 'reconnect_failed'](#event-reconnect_failed)
    - [Event: 'ping'](#event-ping)
    - [Event: 'pong'](#event-pong)
  - [Class: io.Socket](#socket)
    - [socket.id](#socketid)
    - [socket.open()](#socketopen)
    - [socket.connect()](#socketconnect)
    - [socket.send([...args][, ack])](#socketsendargs-ack)
    - [socket.emit(eventName[, ...args][, ack])](#socketemiteventname-args-ack)
    - [socket.on(eventName, callback)](#socketoneventname-callback)
    - [socket.compress(value)](#socketcompressvalue)
    - [socket.close()](#socketclose)
    - [socket.disconnect()](#socketdisconnect)
    - [Event: 'connect'](#event-connect)
    - [Event: 'connect_error'](#event-connect_error-1)
    - [Event: 'connect_timeout'](#event-connect_timeout-1)
    - [Event: 'error'](#event-error)
    - [Event: 'disconnect'](#event-disconnect)
    - [Event: 'reconnect'](#event-reconnect-1)
    - [Event: 'reconnect_attempt'](#event-reconnect_attempt-1)
    - [Event: 'reconnecting'](#event-reconnecting-1)
    - [Event: 'reconnect_error'](#event-reconnect_error-1)
    - [Event: 'reconnect_failed'](#event-reconnect_failed-1)


### IO

Exposed as the `io` namespace in the standalone build, or the result of calling `require('socket.io-client')`.

#### io.protocol

  * _(Number)_

The protocol revision number.

#### io(url[, options])

  - `url` _(String)_
  - `options` _(Object)_
  - **Returns** `Socket`

Creates a new `Manager` for the given URL, and attempts to reuse an existing `Manager` for subsequent calls, unless the `multiplex` option is passed with `false`. Passing this option is the equivalent of passing `'force new connection': true` or `forceNew: true`.

A new `Socket` instance is returned for the namespace specified by the pathname in the URL, defaulting to `/`. For example, if the `url` is `http://localhost/users`, a transport connection will be established to `http://localhost` and a Socket.IO connection will be established to `/users`.

Query parameters can also be provided, either with the `query` option or directly in the url (example: `http://localhost/users?token=abc`).

See [new Manager(url[, options])](#new-managerurl-options) for available `options`.

### Manager

#### new Manager(url[, options])

  - `url` _(String)_
  - `options` _(Object)_
    - `path` _(String)_ name of the path that is captured on the server side (`/socket.io`)
    - `reconnection` _(Boolean)_ whether to reconnect automatically (`true`)
    - `reconnectionAttempts` _(Number)_ number of reconnection attempts before giving up (`Infinity`)
    - `reconnectionDelay` _(Number)_ how long to initially wait before attempting a new
      reconnection (`1000`). Affected by +/- `randomizationFactor`,
      for example the default initial delay will be between 500 to 1500ms.
    - `reconnectionDelayMax` _(Number)_ maximum amount of time to wait between
      reconnections (`5000`). Each attempt increases the reconnection delay by 2x
      along with a randomization as above
    - `randomizationFactor` _(Number)_ (`0.5`), 0 <= randomizationFactor <= 1
    - `timeout` _(Number)_ connection timeout before a `connect_error`
      and `connect_timeout` events are emitted (`20000`)
    - `autoConnect` _(Boolean)_ by setting this false, you have to call `manager.open`
      whenever you decide it's appropriate
    - `query` _(Object)_: additional query parameters that are sent when connecting a namespace (then found in `socket.handshake.query` object on the server-side)
  - **Returns** `Manager`

The `options` are also passed to `engine.io-client` upon initialization of the underlying `Socket`. See the available `options` [here](https://github.com/socketio/engine.io-client#methods).

#### manager.reconnection([value])

  - `value` _(Boolean)_
  - **Returns** `Manager|Boolean`

Sets the `reconnection` option, or returns it if no parameters are passed.

#### manager.reconnectionAttempts([value])

  - `value` _(Number)_
  - **Returns** `Manager|Number`

Sets the `reconnectionAttempts` option, or returns it if no parameters are passed.

#### manager.reconnectionDelay([value])

  - `value` _(Number)_
  - **Returns** `Manager|Number`

Sets the `reconnectionDelay` option, or returns it if no parameters are passed.

#### manager.reconnectionDelayMax([value])

  - `value` _(Number)_
  - **Returns** `Manager|Number`

Sets the `reconnectionDelayMax` option, or returns it if no parameters are passed.

#### manager.timeout([value])

  - `value` _(Number)_
  - **Returns** `Manager|Number`

Sets the `timeout` option, or returns it if no parameters are passed.

#### manager.open([callback])

  - `callback` _(Function)_
  - **Returns** `Manager`

If the manager was initiated with `autoConnect` to `false`, launch a new connection attempt.

The `callback` argument is optional and will be called once the attempt fails/succeeds.

#### manager.connect([callback])

Synonym of [manager.open([callback])](#manageropencallback).

#### manager.socket(nsp, options)

  - `nsp` _(String)_
  - `options` _(Object)_
  - **Returns** `Socket`

Creates a new `Socket` for the given namespace.

#### Event: 'connect_error'

  - `error` _(Object)_ error object

Fired upon a connection error.

#### Event: 'connect_timeout'

Fired upon a connection timeout.

#### Event: 'reconnect'

  - `attempt` _(Number)_ reconnection attempt number

Fired upon a successful reconnection.

#### Event: 'reconnect_attempt'

Fired upon an attempt to reconnect.

#### Event: 'reconnecting'

  - `attempt` _(Number)_ reconnection attempt number

Fired upon a successful reconnection.

#### Event: 'reconnect_error'

  - `error` _(Object)_ error object

Fired upon a reconnection attempt error.

#### Event: 'reconnect_failed'

Fired when couldn't reconnect within `reconnectionAttempts`.

#### Event: 'ping'

Fired when a ping packet is written out to the server.

#### Event: 'pong'

  - `ms` _(Number)_ number of ms elapsed since `ping` packet (i.e.: latency).

Fired when a pong is received from the server.

### Socket

#### socket.id

  - _(String)_

An unique identifier for the socket session. Set after the `connect` event is triggered, and updated after the `reconnect` event.

```js
var socket = io('http://localhost');

console.log(socket.id); // undefined

socket.on('connect', function(){
  console.log(socket.id); // 'G5p5...'
});
```

#### socket.open()

  - **Returns** `Socket`

Opens the socket.

#### socket.connect()

Synonym of [socket.open()](#socketopen).

#### socket.send([...args][, ack])

  - `args`
  - `ack` _(Function)_
  - **Returns** `Socket`

Sends a `message` event. See [socket.emit(eventName[, ...args][, ack])](#socketemiteventname-args-ack).

#### socket.emit(eventName[, ...args][, ack])

  - `eventName` _(String)_
  - `args`
  - `ack` _(Function)_
  - **Returns** `Socket`

Emits an event to the socket identified by the string name. Any other parameters can be included. All serializable datastructures are supported, including `Buffer`.

```js
socket.emit('hello', 'world');
socket.emit('with-binary', 1, '2', { 3: '4', 5: new Buffer(6) });
```

The `ack` argument is optional and will be called with the server answer.

```js
socket.emit('ferret', 'tobi', function (data) {
  console.log(data); // data will be 'woot'
});

// server:
//  io.on('connection', function (socket) {
//    socket.on('ferret', function (name, fn) {
//      fn('woot');
//    });
//  });
```

#### socket.on(eventName, callback)

  - `eventName` _(String)_
  - `callback` _(Function)_
  - **Returns** `Socket`

Register a new handler for the given event.

```js
socket.on('news', function (data) {
  console.log(data);
});
```

The socket actually inherits every method of the [Emitter](https://github.com/component/emitter) class, like `hasListeners`, `once` or `off` (to remove an event listener).

#### socket.compress(value)

  - `value` _(Boolean)_
  - **Returns** `Socket`

Sets a modifier for a subsequent event emission that the event data will only be _compressed_ if the value is `true`. Defaults to `true` when you don't call the method.

```js
socket.compress(false).emit('an event', { some: 'data' });
```

#### socket.close()

  - **Returns** `Socket`

Disconnects the socket manually.

#### socket.disconnect()

Synonym of [socket.close()](#socketclose).

#### Event: 'connect'

Fired upon a connection including a successful reconnection.

#### Event: 'connect_error'

  - `error` _(Object)_ error object

Fired upon a connection error.

#### Event: 'connect_timeout'

Fired upon a connection timeout.

#### Event: 'error'

  - `error` _(Object)_ error object

Fired when an error occurs.

#### Event: 'disconnect'

Fired upon a disconnection.

#### Event: 'reconnect'

  - `attempt` _(Number)_ reconnection attempt number

Fired upon a successful reconnection.

#### Event: 'reconnect_attempt'

  - `attempt` _(Number)_ reconnection attempt number

Fired upon an attempt to reconnect.

#### Event: 'reconnecting'

  - `attempt` _(Number)_ reconnection attempt number

Fired upon an attempt to reconnect.

#### Event: 'reconnect_error'

  - `error` _(Object)_ error object

Fired upon a reconnection attempt error.

#### Event: 'reconnect_failed'

Fired when couldn't reconnect within `reconnectionAttempts`.
