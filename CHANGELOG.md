# History

## 2023

- [4.6.1](#461-2023-02-20) (Feb 2023)
- [4.6.0](#460-2023-02-07) (Feb 2023)

## 2022

- [4.5.4](#454-2022-11-22) (Nov 2022)
- [4.5.3](#453-2022-10-15) (Oct 2022)
- [4.5.2](#452-2022-09-02) (Sep 2022)
- [2.5.0](#250-2022-06-26) (Jun 2022) (from the [2.x](https://github.com/socketio/socket.io/tree/2.x) branch)
- [4.5.1](#451-2022-05-17) (May 2022)
- [4.5.0](#450-2022-04-23) (Apr 2022)
- [4.4.1](#441-2022-01-06) (Jan 2022)

## 2021

- [4.4.0](#440-2021-11-18) (Nov 2021)
- [4.3.2](#432-2021-11-08) (Nov 2021)
- [4.3.1](#431-2021-10-16) (Oct 2021)
- [4.3.0](#430-2021-10-14) (Oct 2021)
- [4.2.0](#420-2021-08-30) (Aug 2021)
- [4.1.3](#413-2021-07-10) (Jul 2021)
- [4.1.2](#412-2021-05-17) (May 2021)
- [4.1.1](#411-2021-05-11) (May 2021)
- [4.1.0](#410-2021-05-11) (May 2021)
- [4.0.2](#402-2021-05-06) (May 2021)
- [4.0.1](#401-2021-03-31) (Mar 2021)
- [**4.0.0**](#400-2021-03-10) (Mar 2021)
- [3.1.2](#312-2021-02-26) (Feb 2021)
- [3.1.1](#311-2021-02-03) (Feb 2021)
- [3.1.0](#310-2021-01-15) (Jan 2021)
- [2.4.1](#241-2021-01-07) (Jan 2021) (from the [2.x](https://github.com/socketio/socket.io/tree/2.x) branch)
- [3.0.5](#305-2021-01-05) (Jan 2021)
- [2.4.0](#240-2021-01-04) (Jan 2021) (from the [2.x](https://github.com/socketio/socket.io/tree/2.x) branch)

## 2020

- [3.0.4](#304-2020-12-07) (Dec 2020)
- [3.0.3](#303-2020-11-19) (Nov 2020)
- [3.0.2](#302-2020-11-17) (Nov 2020)
- [3.0.1](#301-2020-11-09) (Nov 2020)
- [**3.0.0**](#300-2020-11-05) (Nov 2020)

## 2019

- [2.3.0](#230-2019-09-20) (Sep 2019)

## 2018

- [2.2.0](#220-2018-11-29) (Nov 2018)
- [2.1.1](#211-2018-05-17) (May 2018)
- [2.1.0](#210-2018-03-29) (Mar 2018)


# Release notes

## [4.6.1](https://github.com/socketio/socket.io/compare/4.6.0...4.6.1) (2023-02-20)


### Bug Fixes

* properly handle manually created dynamic namespaces ([0d0a7a2](https://github.com/socketio/socket.io/commit/0d0a7a22b5ff95f864216c529114b7dd41738d1e))
* **types:** fix nodenext module resolution compatibility ([#4625](https://github.com/socketio/socket.io/issues/4625)) ([d0b22c6](https://github.com/socketio/socket.io/commit/d0b22c630208669aceb7ae013180c99ef90279b0))


### Dependencies

- [`engine.io@~6.4.0`](https://github.com/socketio/engine.io/releases/tag/6.4.0) (no change)
- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [4.6.0](https://github.com/socketio/socket.io/compare/4.5.4...4.6.0) (2023-02-07)


### Bug Fixes

* add timeout method to remote socket ([#4558](https://github.com/socketio/socket.io/issues/4558)) ([0c0eb00](https://github.com/socketio/socket.io/commit/0c0eb0016317218c2be3641e706cfaa9bea39a2d))
* **typings:** properly type emits with timeout ([f3ada7d](https://github.com/socketio/socket.io/commit/f3ada7d8ccc02eeced2b9b9ac8e4bc921eb630d2))


### Features

#### Promise-based acknowledgements

This commit adds some syntactic sugar around acknowledgements:

- `emitWithAck()`

```js
try {
  const responses = await io.timeout(1000).emitWithAck("some-event");
  console.log(responses); // one response per client
} catch (e) {
  // some clients did not acknowledge the event in the given delay
}

io.on("connection", async (socket) => {
    // without timeout
  const response = await socket.emitWithAck("hello", "world");

  // with a specific timeout
  try {
    const response = await socket.timeout(1000).emitWithAck("hello", "world");
  } catch (err) {
    // the client did not acknowledge the event in the given delay
  }
});
```

- `serverSideEmitWithAck()`

```js
try {
  const responses = await io.timeout(1000).serverSideEmitWithAck("some-event");
  console.log(responses); // one response per server (except itself)
} catch (e) {
  // some servers did not acknowledge the event in the given delay
}
```

Added in [184f3cf](https://github.com/socketio/socket.io/commit/184f3cf7af57acc4b0948eee307f25f8536eb6c8).

#### Connection state recovery

This feature allows a client to reconnect after a temporary disconnection and restore its state:

- id
- rooms
- data
- missed packets

Usage:

```js
import { Server } from "socket.io";

const io = new Server({
  connectionStateRecovery: {
    // default values
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

io.on("connection", (socket) => {
  console.log(socket.recovered); // whether the state was recovered or not
});
```

Here's how it works:

- the server sends a session ID during the handshake (which is different from the current `id` attribute, which is public and can be freely shared)
- the server also includes an offset in each packet (added at the end of the data array, for backward compatibility)
- upon temporary disconnection, the server stores the client state for a given delay (implemented at the adapter level)
- upon reconnection, the client sends both the session ID and the last offset it has processed, and the server tries to restore the state

The in-memory adapter already supports this feature, and we will soon update the Postgres and MongoDB adapters. We will also create a new adapter based on [Redis Streams](https://redis.io/docs/data-types/streams/), which will support this feature.

Added in [54d5ee0](https://github.com/socketio/socket.io/commit/54d5ee05a684371191e207b8089f09fc24eb5107).

#### Compatibility (for real) with Express middlewares

This feature implements middlewares at the Engine.IO level, because Socket.IO middlewares are meant for namespace authorization and are not executed during a classic HTTP request/response cycle.

Syntax:

```js
io.engine.use((req, res, next) => {
  // do something

  next();
});

// with express-session
import session from "express-session";

io.engine.use(session({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

// with helmet
import helmet from "helmet";

io.engine.use(helmet());
```

A workaround was possible by using the allowRequest option and the "headers" event, but this feels way cleaner and works with upgrade requests too.

Added in [24786e7](https://github.com/socketio/engine.io/commit/24786e77c5403b1c4b5a2bc84e2af06f9187f74a).

#### Error details in the disconnecting and disconnect events

The `disconnect` event will now contain additional details about the disconnection reason.

```js
io.on("connection", (socket) => {
  socket.on("disconnect", (reason, description) => {
    console.log(description);
  });
});
```

Added in [8aa9499](https://github.com/socketio/socket.io/commit/8aa94991cee5518567d6254eec04b23f81510257).

#### Automatic removal of empty child namespaces

This commit adds a new option, "cleanupEmptyChildNamespaces". With this option enabled (disabled by default), when a socket disconnects from a dynamic namespace and if there are no other sockets connected to it then the namespace will be cleaned up and its adapter will be closed. 

```js
import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cleanupEmptyChildNamespaces: true
});
```

Added in [5d9220b](https://github.com/socketio/socket.io/commit/5d9220b69adf73e086c27bbb63a4976b348f7c4c).

#### A new "addTrailingSlash" option

The trailing slash which was added by default can now be disabled:

```js
import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  addTrailingSlash: false
});
```

In the example above, the clients can omit the trailing slash and use `/socket.io` instead of `/socket.io/`.

Added in [d0fd474](https://github.com/socketio/engine.io/commit/d0fd4746afa396297f07bb62e539b0c1c4018d7c).

### Performance Improvements

* precompute the WebSocket frames when broadcasting ([da2b542](https://github.com/socketio/socket.io/commit/da2b54279749adc5279c9ac4742b01b36c01cff0))


### Dependencies

- [`engine.io@~6.4.0`](https://github.com/socketio/engine.io/releases/tag/6.4.0) ([diff](https://github.com/socketio/engine.io/compare/6.2.0...6.2.1))
- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) ([diff](https://github.com/websockets/ws/compare/8.2.3...8.11.0))


## [4.5.4](https://github.com/socketio/socket.io/compare/4.5.3...4.5.4) (2022-11-22)

This release contains a bump of:

- `engine.io` in order to fix [CVE-2022-41940](https://github.com/socketio/engine.io/security/advisories/GHSA-r7qp-cfhv-p84w)
- `socket.io-parser` in order to fix [CVE-2022-2421](https://github.com/advisories/GHSA-qm95-pgcg-qqfq).

### Dependencies

- [`engine.io@~6.2.1`](https://github.com/socketio/engine.io/releases/tag/6.2.1) ([diff](https://github.com/socketio/engine.io/compare/6.2.0...6.2.1))
- [`ws@~8.2.3`](https://github.com/websockets/ws/releases/tag/8.2.3) (no change)



## [4.5.3](https://github.com/socketio/socket.io/compare/4.5.2...4.5.3) (2022-10-15)


### Bug Fixes

* **typings:** accept an HTTP2 server in the constructor ([d3d0a2d](https://github.com/socketio/socket.io/commit/d3d0a2d5beaff51fd145f810bcaf6914213f8a06))
* **typings:** apply types to "io.timeout(...).emit()" calls ([e357daf](https://github.com/socketio/socket.io/commit/e357daf5858560bc84e7e50cd36f0278d6721ea1))



## [4.5.2](https://github.com/socketio/socket.io/compare/4.5.1...4.5.2) (2022-09-02)


### Bug Fixes

* prevent the socket from joining a room after disconnection ([18f3fda](https://github.com/socketio/socket.io/commit/18f3fdab12947a9fee3e9c37cfc1da97027d1473))
* **uws:** prevent the server from crashing after upgrade ([ba497ee](https://github.com/socketio/socket.io/commit/ba497ee3eb52c4abf1464380d015d8c788714364))



# [2.5.0](https://github.com/socketio/socket.io/compare/2.4.1...2.5.0) (2022-06-26)

⚠️ WARNING ⚠️

The default value of the maxHttpBufferSize option has been decreased from 100 MB to 1 MB, in order to prevent attacks by denial of service.

Security advisory: [GHSA-j4f2-536g-r55m](https://github.com/advisories/GHSA-j4f2-536g-r55m)


### Bug Fixes

* fix race condition in dynamic namespaces ([05e1278](https://github.com/socketio/socket.io/commit/05e1278cfa99f3ecf3f8f0531ffe57d850e9a05b))
* ignore packet received after disconnection ([22d4bdf](https://github.com/socketio/socket.io/commit/22d4bdf00d1a03885dc0171125faddfaef730066))
* only set 'connected' to true after middleware execution ([226cc16](https://github.com/socketio/socket.io/commit/226cc16165f9fe60f16ff4d295fb91c8971cde35))
* prevent the socket from joining a room after disconnection ([f223178](https://github.com/socketio/socket.io/commit/f223178eb655a7713303b21a78f9ef9e161d6458))



## [4.5.1](https://github.com/socketio/socket.io/compare/4.5.0...4.5.1) (2022-05-17)


### Bug Fixes

* forward the local flag to the adapter when using fetchSockets() ([30430f0](https://github.com/socketio/socket.io/commit/30430f0985f8e7c49394543d4c84913b6a15df60))
* **typings:** add HTTPS server to accepted types ([#4351](https://github.com/socketio/socket.io/issues/4351)) ([9b43c91](https://github.com/socketio/socket.io/commit/9b43c9167cff817c60fa29dbda2ef7cd938aff51))



# [4.5.0](https://github.com/socketio/socket.io/compare/4.4.1...4.5.0) (2022-04-23)


### Bug Fixes

* **typings:** ensure compatibility with TypeScript 3.x ([#4259](https://github.com/socketio/socket.io/issues/4259)) ([02c87a8](https://github.com/socketio/socket.io/commit/02c87a85614e217b8e7b93753f315790ae9d99f6))


### Features

* add support for catch-all listeners for outgoing packets ([531104d](https://github.com/socketio/socket.io/commit/531104d332690138b7aab84d5583d6204132c8b4))

This is similar to `onAny()`, but for outgoing packets.

Syntax:

```js
socket.onAnyOutgoing((event, ...args) => {
  console.log(event);
});
```

* broadcast and expect multiple acks ([8b20457](https://github.com/socketio/socket.io/commit/8b204570a94979bbec307f23ca078f30f5cf07b0))

Syntax:

```js
io.timeout(1000).emit("some-event", (err, responses) => {
  // ...
});
```

* add the "maxPayload" field in the handshake details ([088dcb4](https://github.com/socketio/engine.io/commit/088dcb4dff60df39785df13d0a33d3ceaa1dff38))

So that clients in HTTP long-polling can decide how many packets they have to send to stay under the maxHttpBufferSize
value.

This is a backward compatible change which should not mandate a new major revision of the protocol (we stay in v4), as
we only add a field in the JSON-encoded handshake data:

```
0{"sid":"lv_VI97HAXpY6yYWAAAC","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000,"maxPayload":1000000}
```



## [4.4.1](https://github.com/socketio/socket.io/compare/4.4.0...4.4.1) (2022-01-06)


### Bug Fixes

* **types:** make `RemoteSocket.data` type safe ([#4234](https://github.com/socketio/socket.io/issues/4234)) ([770ee59](https://github.com/socketio/socket.io/commit/770ee5949fb47c2556876c622f06c862573657d6))
* **types:** pass `SocketData` type to custom namespaces ([#4233](https://github.com/socketio/socket.io/issues/4233)) ([f2b8de7](https://github.com/socketio/socket.io/commit/f2b8de71919e1b4d3e57f15a459972c1d1064787))



# [4.4.0](https://github.com/socketio/socket.io/compare/4.3.2...4.4.0) (2021-11-18)


### Bug Fixes

* only set 'connected' to true after middleware execution ([02b0f73](https://github.com/socketio/socket.io/commit/02b0f73e2c64b09c72c5fbf7dc5f059557bdbe50))


### Features

* add an implementation based on uWebSockets.js ([c0d8c5a](https://github.com/socketio/socket.io/commit/c0d8c5ab234d0d2bef0d0dec472973cc9662f647))
* add timeout feature ([f0ed42f](https://github.com/socketio/socket.io/commit/f0ed42f18cabef20ad976aeec37077b6bf3837a5))
* add type information to `socket.data` ([#4159](https://github.com/socketio/socket.io/issues/4159)) ([fe8730c](https://github.com/socketio/socket.io/commit/fe8730ca0f15bc92d5de81cf934c89c76d6af329))



## [4.3.2](https://github.com/socketio/socket.io/compare/4.3.1...4.3.2) (2021-11-08)


### Bug Fixes

* fix race condition in dynamic namespaces ([#4137](https://github.com/socketio/socket.io/issues/4137)) ([9d86397](https://github.com/socketio/socket.io/commit/9d86397243bcbb5775a29d96e5ef03e17148a8e7))


## [4.3.1](https://github.com/socketio/socket.io/compare/4.3.0...4.3.1) (2021-10-16)


### Bug Fixes

* fix server attachment ([#4127](https://github.com/socketio/socket.io/issues/4127)) ([0ef2a4d](https://github.com/socketio/socket.io/commit/0ef2a4d02c9350aff163df9cb61aece89c4dac0f))


# [4.3.0](https://github.com/socketio/socket.io/compare/4.2.0...4.3.0) (2021-10-14)


### Bug Fixes

* **typings:** add name field to cookie option ([#4099](https://github.com/socketio/socket.io/issues/4099)) ([033c5d3](https://github.com/socketio/socket.io/commit/033c5d399a2b985afad32c1e4b0c16d764e248cd))
* send volatile packets with binary attachments ([dc81fcf](https://github.com/socketio/socket.io/commit/dc81fcf461cfdbb5b34b1a5a96b84373754047d5))


### Features

* serve ESM bundle ([60edecb](https://github.com/socketio/socket.io/commit/60edecb3bd33801803cdcba0aefbafa381a2abb3))


# [4.2.0](https://github.com/socketio/socket.io/compare/4.1.3...4.2.0) (2021-08-30)


### Bug Fixes

* **typings:** allow async listener in typed events ([ccfd8ca](https://github.com/socketio/socket.io/commit/ccfd8caba6d38b7ba6c5114bd8179346ed07671c))


### Features

* ignore the query string when serving client JavaScript ([#4024](https://github.com/socketio/socket.io/issues/4024)) ([24fee27](https://github.com/socketio/socket.io/commit/24fee27ba36485308f8e995879c10931532c814e))


## [4.1.3](https://github.com/socketio/socket.io/compare/4.1.2...4.1.3) (2021-07-10)


### Bug Fixes

* fix io.except() method ([94e27cd](https://github.com/socketio/socket.io/commit/94e27cd072c8a4eeb9636f6ffbb7a21d382f36b0))
* remove x-sourcemap header ([a4dffc6](https://github.com/socketio/socket.io/commit/a4dffc6527f412d51a786ae5bf2e9080fe1ca63c))


## [4.1.2](https://github.com/socketio/socket.io/compare/4.1.1...4.1.2) (2021-05-17)


### Bug Fixes

* **typings:** ensure compatibility with TypeScript 3.x ([0cb6ac9](https://github.com/socketio/socket.io/commit/0cb6ac95b49a27483b6f1b6402fa54b35f82e36f))
* ensure compatibility with previous versions of the adapter ([a2cf248](https://github.com/socketio/socket.io/commit/a2cf2486c366cb62293101c10520c57f6984a3fc))


## [4.1.1](https://github.com/socketio/socket.io/compare/4.1.0...4.1.1) (2021-05-11)


### Bug Fixes

* **typings:** properly type server-side events ([b84ed1e](https://github.com/socketio/socket.io/commit/b84ed1e41c9053792caf58974c5de9395bfd509f))
* **typings:** properly type the adapter attribute ([891b187](https://github.com/socketio/socket.io/commit/891b1870e92d1ec38910f03bb839817e2d6be65a))


# [4.1.0](https://github.com/socketio/socket.io/compare/4.0.2...4.1.0) (2021-05-11)


### Features

* add support for inter-server communication ([93cce05](https://github.com/socketio/socket.io/commit/93cce05fb3faf91f21fa71212275c776aa161107))
* notify upon namespace creation ([499c892](https://github.com/socketio/socket.io/commit/499c89250d2db1ab7725ab2b74840e188c267c46))
* add a "connection_error" event ([7096e98](https://github.com/socketio/engine.io/commit/7096e98a02295a62c8ea2aa56461d4875887092d), from `engine.io`)
* add the "initial_headers" and "headers" events ([2527543](https://github.com/socketio/engine.io/commit/252754353a0e88eb036ebb3082e9d6a9a5f497db), from `engine.io`)


### Performance Improvements

* add support for the "wsPreEncoded" writing option ([dc381b7](https://github.com/socketio/socket.io/commit/dc381b72c6b2f8172001dedd84116122e4cc95b3))


## [4.0.2](https://github.com/socketio/socket.io/compare/4.0.1...4.0.2) (2021-05-06)


### Bug Fixes

* **typings:** make "engine" attribute public ([b81ce4c](https://github.com/socketio/socket.io/commit/b81ce4c9d0b00666361498e2ba5e0d007d5860b8))
* properly export the Socket class ([d65b6ee](https://github.com/socketio/socket.io/commit/d65b6ee84c8e91deb61c3c1385eb19afa196a909))


## [4.0.1](https://github.com/socketio/socket.io/compare/4.0.0...4.0.1) (2021-03-31)


### Bug Fixes

* **typings:** add fallback to untyped event listener ([#3834](https://github.com/socketio/socket.io/issues/3834)) ([a11152f](https://github.com/socketio/socket.io/commit/a11152f42b281df83409313962f60f230239c79e))
* **typings:** update return type from emit ([#3843](https://github.com/socketio/socket.io/issues/3843)) ([1a72ae4](https://github.com/socketio/socket.io/commit/1a72ae4fe27a14cf60916f991a2c94da91d9e54a))


# [4.0.0](https://github.com/socketio/socket.io/compare/3.1.2...4.0.0) (2021-03-10)


### Bug Fixes

* make io.to(...) immutable ([ac9e8ca](https://github.com/socketio/socket.io/commit/ac9e8ca6c71e00d4af45ee03f590fe56f3951186))


### Features

* add some utility methods ([b25495c](https://github.com/socketio/socket.io/commit/b25495c069031674da08e19aed68922c7c7a0e28))
* add support for typed events ([#3822](https://github.com/socketio/socket.io/issues/3822)) ([0107510](https://github.com/socketio/socket.io/commit/0107510ba8a0f148c78029d8be8919b350feb633))
* allow to exclude specific rooms when broadcasting ([#3789](https://github.com/socketio/socket.io/issues/3789)) ([7de2e87](https://github.com/socketio/socket.io/commit/7de2e87e888d849eb2dfc5e362af4c9e86044701))
* allow to pass an array to io.to(...) ([085d1de](https://github.com/socketio/socket.io/commit/085d1de9df909651de8b313cc6f9f253374b702e))


## [3.1.2](https://github.com/socketio/socket.io/compare/3.1.1...3.1.2) (2021-02-26)


### Bug Fixes

* ignore packets received after disconnection ([494c64e](https://github.com/socketio/socket.io/commit/494c64e44f645cbd24c645f1186d203789e84af0))


## [3.1.1](https://github.com/socketio/socket.io/compare/3.1.0...3.1.1) (2021-02-03)


### Bug Fixes

* properly parse the CONNECT packet in v2 compatibility mode ([6f4bd7f](https://github.com/socketio/socket.io/commit/6f4bd7f8e7c41a075a8014565330a77c38b03a8d))
* **typings:** add return types and general-case overload signatures ([#3776](https://github.com/socketio/socket.io/issues/3776)) ([9e8f288](https://github.com/socketio/socket.io/commit/9e8f288ca9f14f91064b8d3cce5946f7d23d407c))
* **typings:** update the types of "query", "auth" and "headers" ([4f2e9a7](https://github.com/socketio/socket.io/commit/4f2e9a716d9835b550c8fd9a9b429ebf069c2895))


# [3.1.0](https://github.com/socketio/socket.io/compare/3.0.5...3.1.0) (2021-01-15)


### Features

* confirm a weak but matching ETag ([#3485](https://github.com/socketio/socket.io/issues/3485)) ([161091d](https://github.com/socketio/socket.io/commit/161091dd4c9e1b1610ac3d45d964195e63d92b94))
* **esm:** export the Namespace and Socket class ([#3699](https://github.com/socketio/socket.io/issues/3699)) ([233650c](https://github.com/socketio/socket.io/commit/233650c22209708b5fccc4349c38d2fa1b465d8f))
* add support for Socket.IO v2 clients ([9925746](https://github.com/socketio/socket.io/commit/9925746c8ee3a6522bd640b5d586c83f04f2f1ba))
* add room events ([155fa63](https://github.com/socketio/socket.io-adapter/commit/155fa6333a504036e99a33667dc0397f6aede25e))


### Bug Fixes

* allow integers as event names ([1c220dd](https://github.com/socketio/socket.io-parser/commit/1c220ddbf45ea4b44bc8dbf6f9ae245f672ba1b9))



## [2.4.1](https://github.com/socketio/socket.io/compare/2.4.0...2.4.1) (2021-01-07)


### Reverts

* fix(security): do not allow all origins by default ([a169050](https://github.com/socketio/socket.io/commit/a1690509470e9dd5559cec4e60908ca6c23e9ba0))



## [3.0.5](https://github.com/socketio/socket.io/compare/3.0.4...3.0.5) (2021-01-05)


### Bug Fixes

* properly clear timeout on connection failure ([170b739](https://github.com/socketio/socket.io/commit/170b739f147cb6c92b423729b877e242e376927d))


### Reverts

* restore the socket middleware functionality ([bf54327](https://github.com/socketio/socket.io/commit/bf5432742158e4d5ba2722cff4a614967dffa5b9))



# [2.4.0](https://github.com/socketio/socket.io/compare/2.3.0...2.4.0) (2021-01-04)


### Bug Fixes

* **security:** do not allow all origins by default ([f78a575](https://github.com/socketio/socket.io/commit/f78a575f66ab693c3ea96ea88429ddb1a44c86c7))
* properly overwrite the query sent in the handshake ([d33a619](https://github.com/socketio/socket.io/commit/d33a619905a4905c153d4fec337c74da5b533a9e))



## [3.0.4](https://github.com/socketio/socket.io/compare/3.0.3...3.0.4) (2020-12-07)


## [3.0.3](https://github.com/socketio/socket.io/compare/3.0.2...3.0.3) (2020-11-19)


## [3.0.2](https://github.com/socketio/socket.io/compare/3.0.1...3.0.2) (2020-11-17)


### Bug Fixes

* merge Engine.IO options ([43705d7](https://github.com/socketio/socket.io/commit/43705d7a9149833afc69edc937ea7f8c9aabfeef))


## [3.0.1](https://github.com/socketio/socket.io/compare/3.0.0...3.0.1) (2020-11-09)


### Bug Fixes

* export ServerOptions and Namespace types ([#3684](https://github.com/socketio/socket.io/issues/3684)) ([f62f180](https://github.com/socketio/socket.io/commit/f62f180edafdd56d8a8a277e092bc66df0c5f07f))
* **typings:** update the signature of the emit method ([50671d9](https://github.com/socketio/socket.io/commit/50671d984a81535a6a15c704546ca7465e2ea295))


# [3.0.0](https://github.com/socketio/socket.io/compare/2.3.0...3.0.0) (2020-11-05)

### Bug Fixes

* close clients with no namespace ([91cd255](https://github.com/socketio/socket.io/commit/91cd255ba76ff6a780c62740f9f5cd3a76f5d7c7))

### Features

* emit an Error object upon middleware error ([54bf4a4](https://github.com/socketio/socket.io/commit/54bf4a44e9e896dfb64764ee7bd4e8823eb7dc7b))
* serve msgpack bundle ([aa7574f](https://github.com/socketio/socket.io/commit/aa7574f88471aa30ae472a5cddf1000a8baa70fd))
* add support for catch-all listeners ([5c73733](https://github.com/socketio/socket.io/commit/5c737339858d59eab4b5ee2dd6feff0e82c4fe5a))
* make Socket#join() and Socket#leave() synchronous ([129c641](https://github.com/socketio/socket.io/commit/129c6417bd818bc8b4e1b831644323876e627c13))
* remove prod dependency to socket.io-client ([7603da7](https://github.com/socketio/socket.io/commit/7603da71a535481e3fc60e38b013abf78516d322))
* move binary detection back to the parser ([669592d](https://github.com/socketio/socket.io/commit/669592d120409a5cf00f128070dee6d22259ba4f))
* add ES6 module export ([8b6b100](https://github.com/socketio/socket.io/commit/8b6b100c284ccce7d85e55659e3397f533916847))
* do not reuse the Engine.IO id ([2875d2c](https://github.com/socketio/socket.io/commit/2875d2cfdfa463e64cb520099749f543bbc4eb15))
* remove Server#set() method ([029f478](https://github.com/socketio/socket.io/commit/029f478992f59b1eb5226453db46363a570eea46))
* remove Socket#rooms object ([1507b41](https://github.com/socketio/socket.io/commit/1507b416d584381554d1ed23c9aaf3b650540071))
* remove the 'origins' option ([a8c0600](https://github.com/socketio/socket.io/commit/a8c06006098b512ba1b8b8df82777349db486f41))
* remove the implicit connection to the default namespace ([3289f7e](https://github.com/socketio/socket.io/commit/3289f7ec376e9ec88c2f90e2735c8ca8d01c0e97))
* throw upon reserved event names ([4bd5b23](https://github.com/socketio/socket.io/commit/4bd5b2339a66a5a675e20f689fff2e70ff12d236))

### BREAKING CHANGES

* the Socket#use() method is removed (see [5c73733](https://github.com/socketio/socket.io/commit/5c737339858d59eab4b5ee2dd6feff0e82c4fe5a))

* Socket#join() and Socket#leave() do not accept a callback argument anymore.

Before:

```js
socket.join("room1", () => {
 io.to("room1").emit("hello");
});
```

After:

```js
socket.join("room1");
io.to("room1").emit("hello");
// or await socket.join("room1"); for custom adapters
```

* the "connected" map is renamed to "sockets"
* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.
* the 'origins' option is removed

Before:

```js
new Server(3000, {
  origins: ["https://example.com"]
});
```

The 'origins' option was used in the allowRequest method, in order to
determine whether the request should pass or not. And the Engine.IO
server would implicitly add the necessary Access-Control-Allow-xxx
headers.

After:

```js
new Server(3000, {
  cors: {
    origin: "https://example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["content-type"]
  }
});
```

The already existing 'allowRequest' option can be used for validation:

```js
new Server(3000, {
  allowRequest: (req, callback) => {
    callback(null, req.headers.referer.startsWith("https://example.com"));
  }
});
```

* Socket#rooms is now a Set instead of an object

* Namespace#connected is now a Map instead of an object

* there is no more implicit connection to the default namespace:

```js
// client-side
const socket = io("/admin");

// server-side
io.on("connect", socket => {
  // not triggered anymore
})

io.use((socket, next) => {
  // not triggered anymore
});

io.of("/admin").use((socket, next) => {
  // triggered
});
```

* the Server#set() method was removed

This method was kept for backward-compatibility with pre-1.0 versions.


# [3.0.0-rc4](https://github.com/socketio/socket.io/compare/3.0.0-rc3...3.0.0-rc4) (2020-10-30)


### Features

* emit an Error object upon middleware error ([54bf4a4](https://github.com/socketio/socket.io/commit/54bf4a44e9e896dfb64764ee7bd4e8823eb7dc7b))
* serve msgpack bundle ([aa7574f](https://github.com/socketio/socket.io/commit/aa7574f88471aa30ae472a5cddf1000a8baa70fd))



# [3.0.0-rc3](https://github.com/socketio/socket.io/compare/3.0.0-rc2...3.0.0-rc3) (2020-10-26)


### Features

* add support for catch-all listeners ([5c73733](https://github.com/socketio/socket.io/commit/5c737339858d59eab4b5ee2dd6feff0e82c4fe5a))
* make Socket#join() and Socket#leave() synchronous ([129c641](https://github.com/socketio/socket.io/commit/129c6417bd818bc8b4e1b831644323876e627c13))
* remove prod dependency to socket.io-client ([7603da7](https://github.com/socketio/socket.io/commit/7603da71a535481e3fc60e38b013abf78516d322))


### BREAKING CHANGES

* the Socket#use() method is removed (see [5c73733](https://github.com/socketio/socket.io/commit/5c737339858d59eab4b5ee2dd6feff0e82c4fe5a))

* Socket#join() and Socket#leave() do not accept a callback argument anymore.

Before:

```js
socket.join("room1", () => {
 io.to("room1").emit("hello");
});
```

After:

```js
socket.join("room1");
io.to("room1").emit("hello");
// or await socket.join("room1"); for custom adapters
```



# [3.0.0-rc2](https://github.com/socketio/socket.io/compare/3.0.0-rc1...3.0.0-rc2) (2020-10-15)


### Bug Fixes

* close clients with no namespace ([91cd255](https://github.com/socketio/socket.io/commit/91cd255ba76ff6a780c62740f9f5cd3a76f5d7c7))


### Code Refactoring

* remove duplicate _sockets map ([8a5db7f](https://github.com/socketio/socket.io/commit/8a5db7fa36a075da75cde43cd4fb6382b7659953))


### Features

* move binary detection back to the parser ([669592d](https://github.com/socketio/socket.io/commit/669592d120409a5cf00f128070dee6d22259ba4f))


### BREAKING CHANGES

* the "connected" map is renamed to "sockets"
* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.



# [3.0.0-rc1](https://github.com/socketio/socket.io/compare/2.3.0...3.0.0-rc1) (2020-10-13)


### Features

* add ES6 module export ([8b6b100](https://github.com/socketio/socket.io/commit/8b6b100c284ccce7d85e55659e3397f533916847))
* do not reuse the Engine.IO id ([2875d2c](https://github.com/socketio/socket.io/commit/2875d2cfdfa463e64cb520099749f543bbc4eb15))
* remove Server#set() method ([029f478](https://github.com/socketio/socket.io/commit/029f478992f59b1eb5226453db46363a570eea46))
* remove Socket#rooms object ([1507b41](https://github.com/socketio/socket.io/commit/1507b416d584381554d1ed23c9aaf3b650540071))
* remove the 'origins' option ([a8c0600](https://github.com/socketio/socket.io/commit/a8c06006098b512ba1b8b8df82777349db486f41))
* remove the implicit connection to the default namespace ([3289f7e](https://github.com/socketio/socket.io/commit/3289f7ec376e9ec88c2f90e2735c8ca8d01c0e97))
* throw upon reserved event names ([4bd5b23](https://github.com/socketio/socket.io/commit/4bd5b2339a66a5a675e20f689fff2e70ff12d236))


### BREAKING CHANGES

* the 'origins' option is removed

Before:

```js
new Server(3000, {
  origins: ["https://example.com"]
});
```

The 'origins' option was used in the allowRequest method, in order to
determine whether the request should pass or not. And the Engine.IO
server would implicitly add the necessary Access-Control-Allow-xxx
headers.

After:

```js
new Server(3000, {
  cors: {
    origin: "https://example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["content-type"]
  }
});
```

The already existing 'allowRequest' option can be used for validation:

```js
new Server(3000, {
  allowRequest: (req, callback) => {
    callback(null, req.headers.referer.startsWith("https://example.com"));
  }
});
```

* Socket#rooms is now a Set instead of an object

* Namespace#connected is now a Map instead of an object

* there is no more implicit connection to the default namespace:

```js
// client-side
const socket = io("/admin");

// server-side
io.on("connect", socket => {
  // not triggered anymore
})

io.use((socket, next) => {
  // not triggered anymore
});

io.of("/admin").use((socket, next) => {
  // triggered
});
```

* the Server#set() method was removed

This method was kept for backward-compatibility with pre-1.0 versions.



# [2.3.0](https://github.com/socketio/socket.io/compare/2.2.0...2.3.0) (2019-09-20)

This release mainly contains a bump of the `engine.io` and `ws` packages, but no additional features.



# [2.2.0](https://github.com/socketio/socket.io/compare/2.1.1...2.2.0) (2018-11-29)

### Features

- add cache-control header when serving the client source ([#2907](https://github.com/socketio/socket.io/pull/2907)) ([b00ae50](https://github.com/socketio/socket.io/commit/b00ae50be65d1bc88fa95145f1c486a6886a6b76))

### Bug fixes

- throw an error when trying to access the clients of a dynamic namespace ([#3355](https://github.com/socketio/socket.io/pull/3355)) ([a7fbd1a](https://github.com/socketio/socket.io/commit/a7fbd1ac4a47cafd832fc62e371754df924c5903))



# [2.1.1](https://github.com/socketio/socket.io/compare/2.1.0...2.1.1) (2018-05-17)

### Features

- add local flag to the socket object ([#3129](https://github.com/socketio/socket.io/pull/3219)) ([1decae3](https://github.com/socketio/socket.io/commit/1decae341c80c0417b32d3124ca30c005240b48a))

```js
socket.local.to('room101').emit(/* */);
```


# [2.1.0](https://github.com/socketio/socket.io/compare/2.1.1...2.2.0) (2018-03-29)

### Features

- add a 'binary' flag ([#3185](https://github.com/socketio/socket.io/pull/3185)) ([f48a06c](https://github.com/socketio/socket.io/commit/f48a06c040280b44f90fd225c888910544fd63b5))

```js
// by default, the object is recursively scanned to check whether it contains some binary data
// in the following example, the check is skipped in order to improve performance
socket.binary(false).emit('plain-object', object);

// it also works at the namespace level
io.binary(false).emit('plain-object', object);
```

- add support for dynamic namespaces ([#3195](https://github.com/socketio/socket.io/pull/3195)) ([c0c79f0](https://github.com/socketio/socket.io/commit/c0c79f019e7138194e438339f8192705957c8ec3))

```js
io.of(/^\/dynamic-\d+$/).on('connect', (socket) => {
  // socket.nsp.name = '/dynamic-101'
});

// client-side
const client = require('socket.io-client')('/dynamic-101');
```

### Bug fixes

- properly emit 'connect' when using a custom namespace ([#3197](https://github.com/socketio/socket.io/pull/3197)) ([f4fc517](https://github.com/socketio/socket.io/commit/f4fc517e0fe25866c95b584291487b8cbdff889d))
- include the protocol in the origins check ([#3198](https://github.com/socketio/socket.io/pull/3198)) ([1f1d64b](https://github.com/socketio/socket.io/commit/1f1d64bab61a273712a199591a3f76210d8c0959))

### Important note :warning: from Engine.IO [3.2.0 release](https://github.com/socketio/engine.io/releases/tag/3.2.0)

There are two non-breaking changes that are somehow quite important:

- `ws` was reverted as the default wsEngine (https://github.com/socketio/engine.io/pull/550), as there was several blocking issues with `uws`. You can still use `uws` by running `npm install uws --save` in your project and using the `wsEngine` option:
```js
var engine = require('engine.io');
var server = engine.listen(3000, {
  wsEngine: 'uws'
});
```

- `pingTimeout` now defaults to 5 seconds (instead of 60 seconds): https://github.com/socketio/engine.io/pull/551
