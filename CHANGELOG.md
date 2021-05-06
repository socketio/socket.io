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


## [3.0.5](https://github.com/socketio/socket.io/compare/3.0.4...3.0.5) (2021-01-05)


### Bug Fixes

* properly clear timeout on connection failure ([170b739](https://github.com/socketio/socket.io/commit/170b739f147cb6c92b423729b877e242e376927d))


### Reverts

* restore the socket middleware functionality ([bf54327](https://github.com/socketio/socket.io/commit/bf5432742158e4d5ba2722cff4a614967dffa5b9))


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

