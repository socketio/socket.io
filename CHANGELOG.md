# History

## 2023

- [4.6.0](#460-2023-02-07) (Feb 2023)

## 2022

- [4.5.4](#454-2022-11-22) (Nov 2022)
- [4.5.3](#453-2022-10-15) (Oct 2022)
- [4.5.2](#452-2022-09-02) (Sep 2022)
- [2.5.0](#250-2022-06-26) (Jun 2022) (from the [2.x](https://github.com/socketio/socket.io-client/tree/2.x) branch)
- [4.5.1](#451-2022-05-17) (May 2022)
- [4.5.0](#450-2022-04-23) (Apr 2022)
- [4.4.1](#441-2022-01-06) (Jan 2022)

## 2021

- [4.4.0](#440-2021-11-18) (Nov 2021)
- [4.3.2](#432-2021-10-16) (Oct 2021)
- [4.3.1](#431-2021-10-15) (Oct 2021)
- [4.3.0](#430-2021-10-14) (Oct 2021)
- [4.2.0](#420-2021-08-30) (Aug 2021)
- [4.1.3](#413-2021-07-10) (Jul 2021)
- [4.1.2](#412-2021-05-17) (May 2021)
- [4.1.1](#411-2021-05-11) (May 2021)
- [4.1.0](#410-2021-05-11) (May 2021)
- [4.0.2](#402-2021-05-06) (May 2021)
- [4.0.1](#401-2021-03-31) (Mar 2021)
- [3.1.3](#313-2021-03-12) (Mar 2021) (from the [3.1.x](https://github.com/socketio/socket.io-client/tree/3.1.x) branch)
- [**4.0.0**](#400-2021-03-10) (Mar 2021)
- [3.1.2](#312-2021-02-26) (Feb 2021)
- [3.1.1](#311-2021-02-03) (Feb 2021)
- [3.1.0](#310-2021-01-15) (Jan 2021)
- [3.0.5](#305-2021-01-05) (Jan 2021)
- [2.4.0](#240-2021-01-04) (Jan 2021) (from the [2.x](https://github.com/socketio/socket.io-client/tree/2.x) branch)

## 2020

- [3.0.4](#304-2020-12-07) (Dec 2020)
- [3.0.3](#303-2020-11-19) (Nov 2020)
- [3.0.2](#302-2020-11-17) (Nov 2020)
- [3.0.1](#301-2020-11-09) (Nov 2020)
- [**3.0.0**](#300-2020-11-05) (Nov 2020)
- [2.3.1](#231-2020-09-30) (Sep 2020)

## 2019

- [2.3.0](#230-2019-09-20) (Sep 2019)

## 2018

- [2.2.0](#220-2018-11-29) (Nov 2018)
- [2.1.1](#211-2018-05-17) (May 2018)
- [2.1.0](#210-2018-03-29) (Mar 2018)


# Release notes

# [4.6.0](https://github.com/socketio/socket.io-client/compare/4.5.4...4.6.0) (2023-02-07)


### Bug Fixes

* **typings:** do not expose browser-specific types ([4d6d95e](https://github.com/socketio/socket.io-client/commit/4d6d95e0792efd43b78c760b055764fef02ebc9e))
* ensure manager.socket() returns an active socket ([b7dd891](https://github.com/socketio/socket.io-client/commit/b7dd891e890461d33a104ca9187d5cd30d6f76af))
* **typings:** properly type emits with timeout ([#1570](https://github.com/socketio/socket.io-client/issues/1570)) ([33e4172](https://github.com/socketio/socket.io-client/commit/33e417258c9a5697e001163971ae87821e9c097f))


### Features

#### A new "addTrailingSlash" option

The trailing slash which was added by default can now be disabled:

```js
import { io } from "socket.io-client";

const socket = io("https://example.com", {
  addTrailingSlash: false
});
```

In the example above, the request URL will be `https://example.com/socket.io` instead of `https://example.com/socket.io/`.

Added in [21a6e12](https://github.com/socketio/engine.io-client/commit/21a6e1219add92157c5442537d24fbe1129a50f5).

#### Promise-based acknowledgements

This commit adds some syntactic sugar around acknowledgements:

```js
// without timeout
const response = await socket.emitWithAck("hello", "world");

// with a specific timeout
try {
  const response = await socket.timeout(1000).emitWithAck("hello", "world");
} catch (err) {
  // the server did not acknowledge the event in the given delay
}
```

Note: environments that [do not support Promises](https://caniuse.com/promises) will need to add a polyfill in order to use this feature.

Added in [47b979d](https://github.com/socketio/socket.io-client/commit/47b979d57388e9b5e9a332f3f4a9873211f0d844).

#### Connection state recovery

This feature allows a client to reconnect after a temporary disconnection and restore its ID and receive any packets that was missed during the disconnection gap. It must be enabled on the server side.

A new boolean attribute named `recovered` is added on the `socket` object:

```js
socket.on("connect", () => {
  console.log(socket.recovered); // whether the recovery was successful
});
```

Added in [54d5ee0](https://github.com/socketio/socket.io/commit/54d5ee05a684371191e207b8089f09fc24eb5107) (server) and [b4e20c5](https://github.com/socketio/socket.io-client/commit/b4e20c5c709b5e9cc03ee9b6bd1d576f4810a817) (client).

#### Retry mechanism

Two new options are available:

- `retries`: the maximum number of retries. Above the limit, the packet will be discarded.
- `ackTimeout`: the default timeout in milliseconds used when waiting for an acknowledgement (not to be mixed up with the already existing `timeout` option, which is used by the Manager during the connection)

```js
const socket = io({
  retries: 3,
  ackTimeout: 10000
});

// implicit ack
socket.emit("my-event");

// explicit ack
socket.emit("my-event", (err, val) => { /* ... */ });

// custom timeout (in that case the ackTimeout is optional)
socket.timeout(5000).emit("my-event", (err, val) => { /* ... */ });
```

In all examples above, "my-event" will be sent up to 4 times (1 + 3), until the server sends an acknowledgement.

Assigning a unique ID to each packet is the duty of the user, in order to allow deduplication on the server side.

Added in [655dce9](https://github.com/socketio/socket.io-client/commit/655dce97556a1ea44a60db6b694d0cfd85b5f70f).


### Dependencies

- [`engine.io-client@~6.4.0`](https://github.com/socketio/engine.io-client/releases/tag/6.4.0) ([diff](https://github.com/socketio/engine.io-client/compare/6.2.3...6.4.0))
- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) ([diff](https://github.com/websockets/ws/compare/8.2.3...8.11.0))



## [4.5.4](https://github.com/socketio/socket.io-client/compare/4.5.3...4.5.4) (2022-11-22)

This release contains a bump of the `socket.io-parser` dependency, in order to fix [CVE-2022-2421](https://github.com/advisories/GHSA-qm95-pgcg-qqfq).

### Dependencies

- [`engine.io-client@~6.2.3`](https://github.com/socketio/engine.io-client/tree/6.2.3)
- [`ws@~8.2.3`](https://github.com/websockets/ws/releases/tag/8.2.3) (no change)



## [4.5.3](https://github.com/socketio/socket.io-client/compare/4.5.2...4.5.3) (2022-10-15)


### Bug Fixes

* do not swallow user exceptions ([2403b88](https://github.com/socketio/socket.io-client/commit/2403b88057bf3fd32eb2047c82be26c455c13a2f))



## [4.5.2](https://github.com/socketio/socket.io-client/compare/4.5.1...4.5.2) (2022-09-02)


### Bug Fixes

* handle ill-formatted packet from server ([c597023](https://github.com/socketio/socket.io-client/commit/c5970231699aa47b00c4a617af4239d0fa90fa53))



# [2.5.0](https://github.com/socketio/socket.io-client/compare/2.4.0...2.5.0) (2022-06-26)


### Bug Fixes

* ensure buffered events are sent in order ([991eb0b](https://github.com/Automattic/socket.io-client/commit/991eb0b0289bbbf680099e6d42b302beee7568b8))



## [4.5.1](https://github.com/socketio/socket.io-client/compare/4.5.0...4.5.1) (2022-05-17)

There were some minor bug fixes on the server side, which mandate a client bump.



# [4.5.0](https://github.com/socketio/socket.io-client/compare/4.4.1...4.5.0) (2022-04-23)


### Features

* add details to the disconnect event ([b862924](https://github.com/socketio/socket.io-client/commit/b862924b7f1720979e5db2f0154906b305d420e3))

The "disconnect" event will now include additional details to help debugging if anything has gone wrong.

Example when a payload is over the maxHttpBufferSize value in HTTP long-polling mode:

```js
socket.on("disconnect", (reason, details) => {
  console.log(reason); // "transport error"

  // in that case, details is an error object
  console.log(details.message); "xhr post error"
  console.log(details.description); // 413 (the HTTP status of the response)

  // details.context refers to the XMLHttpRequest object
  console.log(details.context.status); // 413
  console.log(details.context.responseText); // ""
});
```

* add support for catch-all listeners for outgoing packets ([74e3e60](https://github.com/socketio/socket.io-client/commit/74e3e601a43133b2c0ea43c3de2764cc55b57b5a))

This is similar to `onAny()`, but for outgoing packets.

Syntax:

```js
socket.onAnyOutgoing((event, ...args) => {
  console.log(event);
});
```

* slice write buffer according to the maxPayload value ([46fdc2f](https://github.com/socketio/engine.io-client/commit/46fdc2f0ed352b454614247406689edc9d908927))

The server will now include a "maxPayload" field in the handshake details, allowing the clients to decide how many packets they have to send to stay under the maxHttpBufferSize value.



## [4.4.1](https://github.com/socketio/socket.io-client/compare/4.4.0...4.4.1) (2022-01-06)



# [4.4.0](https://github.com/socketio/socket.io-client/compare/4.3.2...4.4.0) (2021-11-18)


### Bug Fixes

* add package name in nested package.json ([53d8fca](https://github.com/socketio/socket.io-client/commit/53d8fcafabbfddb5834012c9c98743bfe6e13347)), closes [socketio/socket.io-client#1513](https://github.com/socketio/socket.io-client/issues/1513)
* fix `socket.disconnect().connect()` usage ([99c2cb8](https://github.com/socketio/socket.io-client/commit/99c2cb8421361487ed7c876edd8670bb69a5c5b5))
* prevent socket from reconnecting after middleware failure ([d54d12c](https://github.com/socketio/socket.io-client/commit/d54d12ce634193d14b71894496ed57d35d922378))


### Features

* add timeout feature ([ccf7998](https://github.com/socketio/socket.io-client/commit/ccf7998cc5049d02022567aedfb263de875a06a5))

```js
socket.timeout(5000).emit("my-event", (err) => {
  if (err) {
    // the server did not acknowledge the event in the given delay
  }
});
```



## [4.3.2](https://github.com/socketio/socket.io-client/compare/4.3.1...4.3.2) (2021-10-16)


### Bug Fixes

* restore the default export (bis) ([6780f29](https://github.com/socketio/socket.io-client/commit/6780f29624372a76aafb0bbd6975864280239f26))



## [4.3.1](https://github.com/socketio/socket.io-client/compare/4.3.0...4.3.1) (2021-10-15)


### Bug Fixes

* restore the default export ([f0aae84](https://github.com/socketio/socket.io-client/commit/f0aae8457a8bdf7e2f2286b4b7d34d2798419456))
* restore the namespace export ([8737d0a](https://github.com/socketio/socket.io-client/commit/8737d0ae6fb362455015e6dd435010c36d023663))



# [4.3.0](https://github.com/socketio/socket.io-client/compare/4.2.0...4.3.0) (2021-10-14)

An ESM bundle is now provided:

```html
<script type="module">
  import { io } from "https://cdn.socket.io/4.3.0/socket.io.esm.min.js";

  const socket = io();

  socket.emit("hello", "world");
</script>
```

### Features

* **typings:** add missing types for some emitter methods ([#1502](https://github.com/socketio/socket.io-client/issues/1502)) ([a9e5b85](https://github.com/socketio/socket.io-client/commit/a9e5b85580e8edca0b0fd2850c3741d3d86a96e2))
* provide an ESM build with and without debug ([16b6569](https://github.com/socketio/socket.io-client/commit/16b65698aed766e1e645c78847f2e91bfc5b6f56))
* migrate to rollup ([0661564](https://github.com/socketio/socket.io-client/commit/0661564dc2005b95843ddb65621b7e89af702bc0))



# [4.2.0](https://github.com/socketio/socket.io-client/compare/4.1.3...4.2.0) (2021-08-30)


### Bug Fixes

* **typings:** allow async listener in typed events ([66e00b7](https://github.com/socketio/socket.io-client/commit/66e00b7dd7c4a09072cfd84c78e6e15ec52039f5))
* allow to set randomizationFactor to 0 ([#1447](https://github.com/socketio/socket.io-client/issues/1447)) ([dfb46b5](https://github.com/socketio/socket.io-client/commit/dfb46b55a55d9c5b0397f4bc0fab9cec99ff430e))


### Features

* add an option to use native timer functions ([#1479](https://github.com/socketio/socket.io-client/issues/1479)) ([4e1b656](https://github.com/socketio/socket.io-client/commit/4e1b65699d9967a7bb409bdc89c894c62562771b))


## [4.1.3](https://github.com/socketio/socket.io-client/compare/4.1.2...4.1.3) (2021-07-10)


## [4.1.2](https://github.com/socketio/socket.io-client/compare/4.1.1...4.1.2) (2021-05-17)


### Bug Fixes

* **typings:** add missing closeOnBeforeunload option ([#1469](https://github.com/socketio/socket.io-client/issues/1469)) ([35d27df](https://github.com/socketio/socket.io-client/commit/35d27df2ae48046bfe3ae2e11f82004200095aae))
* **typings:** add missing requestTimeout option ([#1467](https://github.com/socketio/socket.io-client/issues/1467)) ([c8dfbb1](https://github.com/socketio/socket.io-client/commit/c8dfbb1c1d10aff16bc19cc1f1bab6b3a9240d81))


## [4.1.1](https://github.com/socketio/socket.io-client/compare/4.1.0...4.1.1) (2021-05-11)

There were some minor bug fixes on the server side, which mandate a client bump.


# [4.1.0](https://github.com/socketio/socket.io-client/compare/4.0.2...4.1.0) (2021-05-11)

### Features

* add the "closeOnBeforeunload" option ([dcb85e9](https://github.com/socketio/engine.io-client/commit/dcb85e902d129b2d1a94943b4f6d471532f70dc9), from `engine.io-client`)


## [4.0.2](https://github.com/socketio/socket.io-client/compare/4.0.1...4.0.2) (2021-05-06)


### Bug Fixes

* **typings:** add fallback to untyped event listener ([5394669](https://github.com/socketio/socket.io-client/commit/53946694882114957ef2187c532eb798fa811b60))
* ensure buffered events are sent in order ([34f822f](https://github.com/socketio/socket.io-client/commit/34f822f783c6985039c0733a96d1fab8f01b1edf))
* ensure connections are properly multiplexed ([dd2a8fc](https://github.com/socketio/socket.io-client/commit/dd2a8fce000a9b5b5d741489fc44eafd4ff6c75b))
* properly export the Socket class ([e20d487](https://github.com/socketio/socket.io-client/commit/e20d487ac080910c90e7b766f8509f5e40c9ecfe))


## [4.0.1](https://github.com/socketio/socket.io-client/compare/4.0.0...4.0.1) (2021-03-31)


### Bug Fixes

* **typings:** make `auth` property public ([#1455](https://github.com/socketio/socket.io-client/issues/1455)) ([c150223](https://github.com/socketio/socket.io-client/commit/c15022347c662dc31ee0a3d89cde23641f029783))
* **typings:** update definition to match wrapper.mjs ([#1456](https://github.com/socketio/socket.io-client/issues/1456)) ([48f573f](https://github.com/socketio/socket.io-client/commit/48f573f6f6c4d542e6a098e7f4ae472b888b5664))



## [3.1.3](https://github.com/socketio/socket.io-client/compare/3.1.2...3.1.3) (2021-03-12)


### Bug Fixes

* **bundle:** restore support for JS modules ([afa7953](https://github.com/socketio/socket.io-client/commit/afa79532f8a422cc9246175abdbe30299a0b0281))



# [4.0.0](https://github.com/socketio/socket.io-client/compare/3.1.2...4.0.0) (2021-03-10)

The major bump is due to some breaking changes on the server side.

### Bug Fixes

* **bundle:** restore support for JS modules ([43613d1](https://github.com/socketio/socket.io-client/commit/43613d1b2c3c04e89d572750656012f54d44467c))


### Features

* add autoUnref option ([6abfa1f](https://github.com/socketio/socket.io-client/commit/6abfa1fa4c7fea0d69c69b254d2e1ca18f19c4bc))
* add support for typed events ([5902365](https://github.com/socketio/socket.io-client/commit/59023657a02cf78f90522e0d7797749707ed5ed2))


## [3.1.2](https://github.com/socketio/socket.io-client/compare/3.1.1...3.1.2) (2021-02-26)


### Bug Fixes

* restore support for web workers ([13b32b3](https://github.com/socketio/socket.io-client/commit/13b32b39a4c1cf4829144fb0a95c4d0506000fb3))
* silently close the transport in the beforeunload hook ([ed48b5d](https://github.com/socketio/engine.io-client/commit/ed48b5dc3407e5ded45072606b3bb0eafa49c01f), from `engine.io-client`)


## [3.1.1](https://github.com/socketio/socket.io-client/compare/3.1.0...3.1.1) (2021-02-03)


### Bug Fixes

* include the path in the manager ID ([7a0c2b5](https://github.com/socketio/socket.io-client/commit/7a0c2b504f5f3bac64d423684fb1bb44229c7a70))
* remove polyfill for process in the bundle ([61afc5d](https://github.com/socketio/socket.io-client/commit/61afc5d8cb9f10985930b2f01758089c49f84686))
* **typings:** add return types and general-case overload signatures ([#1440](https://github.com/socketio/socket.io-client/issues/1440)) ([47f917a](https://github.com/socketio/socket.io-client/commit/47f917afdd1821079723542f081c726596f2aaf3))
* **typings:** fix the type of the "query" option ([#1439](https://github.com/socketio/socket.io-client/issues/1439)) ([f02ab3b](https://github.com/socketio/socket.io-client/commit/f02ab3bc9626133dd35aad0916325f0c7fc4da5d))


# [3.1.0](https://github.com/socketio/socket.io-client/compare/3.0.5...3.1.0) (2021-01-15)


### Bug Fixes

* **typings:** make Manager#opts public ([#1437](https://github.com/socketio/socket.io-client/issues/1437)) ([fe97243](https://github.com/socketio/socket.io-client/commit/fe97243fab02cd80fc1116e8f4aeca02951dac75))
* allow integers as event names ([1c220dd](https://github.com/socketio/socket.io-parser/commit/1c220ddbf45ea4b44bc8dbf6f9ae245f672ba1b9))


## [3.0.5](https://github.com/socketio/socket.io-client/compare/3.0.4...3.0.5) (2021-01-05)


### Bug Fixes

* emit a connect_error event upon connection failure ([53c7374](https://github.com/socketio/socket.io-client/commit/53c73749a829b2c98d9a5e45c48f0ae5a22c056c))
* **typings:** make sendBuffer and receiveBuffer public ([b83f89c](https://github.com/socketio/socket.io-client/commit/b83f89c901e82e06f66cbda4124cf739d2bb01c3))



# [2.4.0](https://github.com/socketio/socket.io-client/compare/2.3.1...2.4.0) (2021-01-04)

The minor bump is matching the bump of the server, but there is no new feature in this release.



## [3.0.4](https://github.com/socketio/socket.io-client/compare/3.0.3...3.0.4) (2020-12-07)


### Bug Fixes

* emit an error when reaching a v2.x server ([ec1f8c3](https://github.com/socketio/socket.io-client/commit/ec1f8c3474b54600420487a0554cb195cc78f2bc)), closes [/github.com/socketio/engine.io-protocol#difference-between-v3-and-v4](https://github.com//github.com/socketio/engine.io-protocol/issues/difference-between-v3-and-v4) [/github.com/socketio/socket.io-protocol#difference-between-v5-and-v4](https://github.com//github.com/socketio/socket.io-protocol/issues/difference-between-v5-and-v4)
* keep track of active sockets ([f8f60fc](https://github.com/socketio/socket.io-client/commit/f8f60fc860f51aa6465fc32dd9275a8e1d22f05d))
* **typings:** export extraHeaders option ([#1410](https://github.com/socketio/socket.io-client/issues/1410)) ([b3de861](https://github.com/socketio/socket.io-client/commit/b3de861a928c0eb5f0b2f37956c671e72432715d))


## [3.0.3](https://github.com/socketio/socket.io-client/compare/3.0.2...3.0.3) (2020-11-19)


### Bug Fixes

* properly export io in ES modules wrapper ([bec1524](https://github.com/socketio/socket.io-client/commit/bec15240ea67e9d296ac94093974d7d831239e8d))


## [3.0.2](https://github.com/socketio/socket.io-client/compare/3.0.1...3.0.2) (2020-11-17)


### Bug Fixes

* **typings:** export withCredentials option ([7193078](https://github.com/socketio/socket.io-client/commit/719307801a2170f02d3a16ab52752ac219ca4b6e))
* **typings:** export ManagerOptions ([#1398](https://github.com/socketio/socket.io-client/issues/1398)) ([96cd2c9](https://github.com/socketio/socket.io-client/commit/96cd2c9ae4c48f9d2e6638ab26074277a3a6cf6b))
* add io as named exports ([7b3ec9f](https://github.com/socketio/socket.io-client/commit/7b3ec9fad9df9d2f030f644a26fcd642bf2a91ab))


## [3.0.1](https://github.com/socketio/socket.io-client/compare/3.0.0...3.0.1) (2020-11-09)


### Bug Fixes

* **typings:** export Socket and SocketOptions types ([#1394](https://github.com/socketio/socket.io-client/issues/1394)) ([19ab1e9](https://github.com/socketio/socket.io-client/commit/19ab1e9e4e1373d4ef4dad5381c8ae24167f5d89))


# [3.0.0](https://github.com/socketio/socket.io-client/compare/2.3.1...3.0.0) (2020-11-05)

### Code Refactoring

* rename ERROR to CONNECT_ERROR ([13e1db7](https://github.com/socketio/socket.io-client/commit/13e1db7c94291c583d843beaa9e06ee041ae4f26))

### Features

* emit an Error object upon middleware error ([0939395](https://github.com/socketio/socket.io-client/commit/09393952e3397a0c71f239ea983f8ec1623b7c21))
* add bundle with msgpack parser ([71d6048](https://github.com/socketio/socket.io-client/commit/71d60480af9ea06d22792540dafb18a76e9362e7))
* add support for catch-all listeners ([55f464f](https://github.com/socketio/socket.io-client/commit/55f464f59ed523fa1c1948ec10752bfdf808262d))
* add volatile events ([7ddad2c](https://github.com/socketio/socket.io-client/commit/7ddad2c09dea0391b20378ef03b40040f0230d3e))
* move binary detection back to the parser ([1789094](https://github.com/socketio/socket.io-client/commit/178909471a3dd232e71cba83b729b4cc66f1412f))
* add ES6 module export ([cbabb03](https://github.com/socketio/socket.io-client/commit/cbabb0308ef4f7d302654755e08fe2103b9f22c8))
* do not reuse the Engine.IO id ([bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d))
* remove the implicit connection to the default namespace ([249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8))
* split the events of the Manager and Socket ([132f8ec](https://github.com/socketio/socket.io-client/commit/132f8ec918a596eec872aee0c61d4ce63714c400))
* throw upon reserved event names ([6494f61](https://github.com/socketio/socket.io-client/commit/6494f61be0d38d267d77c30ea4f43941f97b1bc0))

### BREAKING CHANGES

* the Socket instance will now emit a "connect_error" event instead of "error" (which is not a reserved event anymore)

```js
// before
socket.on("error", () => {});

// after
socket.on("connect_error", () => {});
```

* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.

* the Socket instance will no longer forward the events of its Manager

Those events can still be accessed on the Manager instance though:

```js
socket.io.on("reconnect", () => {
  // ...
});
```

# [3.0.0-rc4](https://github.com/socketio/socket.io-client/compare/3.0.0-rc3...3.0.0-rc4) (2020-10-30)


### Features

* emit an Error object upon middleware error ([0939395](https://github.com/socketio/socket.io-client/commit/09393952e3397a0c71f239ea983f8ec1623b7c21))



# [3.0.0-rc3](https://github.com/socketio/socket.io-client/compare/3.0.0-rc2...3.0.0-rc3) (2020-10-26)


### Code Refactoring

* rename ERROR to CONNECT_ERROR ([13e1db7](https://github.com/socketio/socket.io-client/commit/13e1db7c94291c583d843beaa9e06ee041ae4f26))


### Features

* add bundle with msgpack parser ([71d6048](https://github.com/socketio/socket.io-client/commit/71d60480af9ea06d22792540dafb18a76e9362e7))
* add support for catch-all listeners ([55f464f](https://github.com/socketio/socket.io-client/commit/55f464f59ed523fa1c1948ec10752bfdf808262d))
* add volatile events ([7ddad2c](https://github.com/socketio/socket.io-client/commit/7ddad2c09dea0391b20378ef03b40040f0230d3e))


### BREAKING CHANGES

* the Socket instance will now emit a "connect_error" event instead of "error" (which is not a reserved event anymore)

```js
// before
socket.on("error", () => {});

// after
socket.on("connect_error", () => {});
```



# [3.0.0-rc2](https://github.com/socketio/socket.io-client/compare/3.0.0-rc1...3.0.0-rc2) (2020-10-15)


### Features

* move binary detection back to the parser ([1789094](https://github.com/socketio/socket.io-client/commit/178909471a3dd232e71cba83b729b4cc66f1412f))


### BREAKING CHANGES

* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.



# [3.0.0-rc1](https://github.com/socketio/socket.io-client/compare/2.3.1...3.0.0-rc1) (2020-10-13)


### Features

* add ES6 module export ([cbabb03](https://github.com/socketio/socket.io-client/commit/cbabb0308ef4f7d302654755e08fe2103b9f22c8))
* do not reuse the Engine.IO id ([bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d))
* remove the implicit connection to the default namespace ([249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8))
* split the events of the Manager and Socket ([132f8ec](https://github.com/socketio/socket.io-client/commit/132f8ec918a596eec872aee0c61d4ce63714c400))
* throw upon reserved event names ([6494f61](https://github.com/socketio/socket.io-client/commit/6494f61be0d38d267d77c30ea4f43941f97b1bc0))


### BREAKING CHANGES

* the Socket instance will no longer forward the events of its Manager

Those events can still be accessed on the Manager instance though:

```js
socket.io.on("reconnect", () => {
  // ...
});
```


## [2.3.1](https://github.com/socketio/socket.io-client/compare/2.3.0...2.3.1) (2020-09-30)

The `debug` dependency has been reverted to `~3.1.0`, as the newer versions contains ES6 syntax which breaks in IE
browsers.

Please note that this only applied to users that bundle the Socket.IO client in their application, with webpack for
example, as the "official" bundles (in the dist/ folder) were already transpiled with babel.

For webpack users, you can also take a look at the [webpack-remove-debug](https://github.com/johngodley/webpack-remove-debug)
plugin.

### Bug Fixes

* fix reconnection after opening socket asynchronously ([#1253](https://github.com/socketio/socket.io-client/issues/1253)) ([050108b](https://github.com/socketio/socket.io-client/commit/050108b2281effda086b197cf174ee2e8e1aad79))



# [2.3.0](https://github.com/socketio/socket.io-client/compare/2.2.0...2.3.0) (2019-09-20)

The minor bump is matching the bump of the server, but there is no new feature in this release.



# [2.2.0](https://github.com/socketio/socket.io-client/compare/2.1.1...2.2.0) (2018-11-29)

### Bug fixes

- remove any reference to the `global` variable (related: https://github.com/socketio/socket.io-client/issues/1166)



## [2.1.1](https://github.com/socketio/socket.io-client/compare/2.1.0...2.1.1) (2018-05-17)

### Bug fixes

- fire an error event on middleware failure for non-root namespace ([#1202](https://github.com/socketio/socket.io-client/issues/1202)) ([0fe9439](https://github.com/socketio/socket.io-client/commit/0fe9439ff6d97fb6e7fa7bd145ee9367de055b29))



# [2.1.0](https://github.com/socketio/socket.io-client/compare/2.0.4...2.1.0) (2018-03-29)

### Features

- add a 'binary' flag ([#1194](https://github.com/socketio/socket.io-client/pull/1194)) ([74893d5](https://github.com/socketio/socket.io-client/commit/74893d53ca22335cbdbdd1468a5f9a810143a231))

```js
// by default, the object is recursively scanned to check whether it contains some binary data
// in the following example, the check is skipped in order to improve performance
socket.binary(false).emit('plain-object', object);
```
