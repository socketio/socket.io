# History

| Version                                                                                              | Release date   |
|------------------------------------------------------------------------------------------------------|----------------|
| [6.6.2](#662-2024-10-09)                                                                             | October 2024   |
| [6.6.1](#661-2024-09-21)                                                                             | September 2024 |
| [6.6.0](#660-2024-06-21)                                                                             | June 2024      |
| [6.5.5](#655-2024-06-18) (from the [6.5.x](https://github.com/socketio/engine.io/tree/6.5.x) branch) | June 2024      |
| [3.6.2](#362-2024-06-18) (from the [3.x](https://github.com/socketio/engine.io/tree/3.x) branch)     | June 2024      |
| [6.5.4](#654-2023-11-09)                                                                             | November 2023  |
| [6.5.3](#653-2023-10-06)                                                                             | October 2023   |
| [6.5.2](#652-2023-08-01)                                                                             | August 2023    |
| [6.5.1](#651-2023-06-27)                                                                             | June 2023      |
| [6.5.0](#650-2023-06-16)                                                                             | June 2023      |
| [6.4.2](#642-2023-05-02)                                                                             | May 2023       |
| [6.4.1](#641-2023-02-20)                                                                             | February 2023  |
| [6.4.0](#640-2023-02-06)                                                                             | February 2023  |
| [6.3.1](#631-2023-01-12)                                                                             | January 2023   |
| [6.3.0](#630-2023-01-10)                                                                             | January 2023   |
| [3.6.1](#361-2022-11-20) (from the [3.x](https://github.com/socketio/engine.io/tree/3.x) branch)     | November 2022  |
| [6.2.1](#621-2022-11-20)                                                                             | November 2022  |
| [3.6.0](#360-2022-06-06) (from the [3.x](https://github.com/socketio/engine.io/tree/3.x) branch)     | June 2022      |
| [6.2.0](#620-2022-04-17)                                                                             | April 2022     |
| [6.1.3](#613-2022-02-23)                                                                             | February 2022  |
| [6.1.2](#612-2022-01-18)                                                                             | January 2022   |
| [6.1.1](#611-2022-01-11)                                                                             | January 2021   |
| [6.1.0](#610-2021-11-08)                                                                             | November 2022  |
| [6.0.1](#601-2021-11-06)                                                                             | November 2021  |
| [**6.0.0**](#600-2021-10-08)                                                                         | October 2021   |
| [5.2.0](#520-2021-08-29)                                                                             | August 2021    |
| [5.1.1](#511-2021-05-16)                                                                             | May 2021       |
| [5.1.0](#510-2021-05-04)                                                                             | May 2021       |
| [**5.0.0**](#500-2021-03-10)                                                                         | March 2021     |
| [4.1.1](#411-2021-02-02)                                                                             | February 2021  |
| [4.1.0](#410-2021-01-14)                                                                             | January 2021   |
| [4.0.6](#406-2021-01-04)                                                                             | January 2021   |
| [3.5.0](#350-2020-12-30) (from the [3.x](https://github.com/socketio/engine.io/tree/3.x) branch)     | December 2020  |
| [4.0.5](#405-2020-12-07)                                                                             | December 2020  |
| [4.0.4](#404-2020-11-17)                                                                             | November 2020  |
| [4.0.3](#403-2020-11-17)                                                                             | November 2020  |
| [4.0.2](#402-2020-11-09)                                                                             | November 2020  |
| [4.0.1](#401-2020-10-21)                                                                             | October 2020   |
| [**4.0.0**](#400-2020-09-10)                                                                         | September 2020 |
| [3.4.2](#342-2020-06-04)                                                                             | June 2020      |
| [3.4.1](#341-2020-04-17)                                                                             | April 2020     |


# Release notes

## [6.6.2](https://github.com/socketio/socket.io/compare/engine.io@6.6.1...engine.io@6.6.2) (2024-10-09)

This release contains a bump of the `cookie` dependency.

See also: https://github.com/advisories/GHSA-pxg6-pf52-xh8x


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.6.1](https://github.com/socketio/socket.io/compare/engine.io@6.6.0...engine.io@6.6.1) (2024-09-21)


### Bug Fixes

* discard all pending packets when the server is closed ([923a12e](https://github.com/socketio/socket.io/commit/923a12e2de83ecaa75746a575e71a4739815d5c5))
* **uws:** prevent the client from upgrading twice ([d5095fe](https://github.com/socketio/socket.io/commit/d5095fe98c3976673c19f433c0114d06dbd8de1b))


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.6.0](https://github.com/socketio/engine.io/compare/6.5.4...6.6.0) (2024-06-21)


### Bug Fixes

* fix `websocket` and `webtransport` send callbacks ([#699](https://github.com/socketio/engine.io/issues/699)) ([fc21c4a](https://github.com/socketio/engine.io/commit/fc21c4a05f9d50d7efd62aa7a937fadce385e919))
* properly call the send callback during upgrade ([362bc78](https://github.com/socketio/engine.io/commit/362bc78191c607e6b7c7f2b2e7e7ddb2fe53101c))
* **types:** make socket.request writable ([#697](https://github.com/socketio/engine.io/issues/697)) ([0efa04b](https://github.com/socketio/engine.io/commit/0efa04b5841816d18b0c6ebf7c5f592f8382978a))


### Performance Improvements

* do not reset the hearbeat timer on each packet ([5359bae](https://github.com/socketio/engine.io/commit/5359bae683e2a25742bd4989d0355a8fc10d294e))
* **websocket:** use bound callbacks ([9a68c8c](https://github.com/socketio/engine.io/commit/9a68c8ce93cc1bc0bc1a30548558da49860f4acd))


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.5.5](https://github.com/socketio/engine.io/compare/6.5.4...6.5.5) (2024-06-18)

This release contains a bump of the `ws` dependency, which includes an important [security fix](https://github.com/websockets/ws/commit/e55e5106f10fcbaac37cfa89759e4cc0d073a52c).

Advisory: https://github.com/advisories/GHSA-3h5v-q93c-6h6q

### Bug Fixes

* **types:** make socket.request writable ([#697](https://github.com/socketio/engine.io/issues/697)) ([0efa04b](https://github.com/socketio/engine.io/commit/0efa04b5841816d18b0c6ebf7c5f592f8382978a))

### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) ([diff](https://github.com/websockets/ws/compare/8.11.0...8.17.1))



## [3.6.2](https://github.com/socketio/engine.io/compare/3.6.1...3.6.2) (2024-06-18)

This release contains a bump of the `ws` dependency, which includes an important [security fix](https://github.com/websockets/ws/commit/e55e5106f10fcbaac37cfa89759e4cc0d073a52c).

Advisory: https://github.com/advisories/GHSA-3h5v-q93c-6h6q

### Dependencies

- [`ws@~7.5.10`](https://github.com/websockets/ws/releases/tag/7.5.10) ([diff](https://github.com/websockets/ws/compare/7.4.2...7.5.10))



## [6.5.4](https://github.com/socketio/engine.io/compare/6.5.3...6.5.4) (2023-11-09)

This release contains some minor changes which should improve the memory usage of the server, notably [this](https://github.com/socketio/engine.io/commit/f27a6c35017e4eb37546949f754e09933102837a).


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.3](https://github.com/socketio/engine.io/compare/6.5.2...6.5.3) (2023-10-06)


### Bug Fixes

* improve compatibility with node16 module resolution ([#689](https://github.com/socketio/engine.io/issues/689)) ([c6bf8c0](https://github.com/socketio/engine.io/commit/c6bf8c0f571aad7a5917f43860c8c3d74a9b429b))
* **webtransport:** properly handle abruptly closed connections ([ff1c861](https://github.com/socketio/engine.io/commit/ff1c8615483bab25acc9cf04fb40339b0bd78812))


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.2](https://github.com/socketio/engine.io/compare/6.5.1...6.5.2) (2023-08-01)


### Bug Fixes

* **webtransport:** add proper framing ([a306db0](https://github.com/socketio/engine.io/commit/a306db09e8ddb367c7d62f45fec920f979580b7c))


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.1](https://github.com/socketio/engine.io/compare/6.5.0...6.5.1) (2023-06-27)


### Bug Fixes

* prevent crash when accessing TextDecoder ([#684](https://github.com/socketio/engine.io/issues/684)) ([6dd2bc4](https://github.com/socketio/engine.io/commit/6dd2bc4f68edd7575c3844ae8ceadde649be95b2))


### Credits

Huge thanks to [@iowaguy](https://github.com/iowaguy) for helping!


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.0](https://github.com/socketio/engine.io/compare/6.4.2...6.5.0) (2023-06-16)


### Bug Fixes

* **uws:** discard any write to an aborted uWS response ([#682](https://github.com/socketio/engine.io/issues/682)) ([3144d27](https://github.com/socketio/engine.io/commit/3144d274584ae3b96cca4e609c66c56d534f1715))


### Features

#### Support for WebTransport

The Engine.IO server can now use WebTransport as the underlying transport.

WebTransport is a web API that uses the HTTP/3 protocol as a bidirectional transport. It's intended for two-way communications between a web client and an HTTP/3 server.

References:

- https://w3c.github.io/webtransport/
- https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
- https://developer.chrome.com/articles/webtransport/

Until WebTransport support lands [in Node.js](https://github.com/nodejs/node/issues/38478), you can use the `@fails-components/webtransport` package:

```js
import { readFileSync } from "fs";
import { createServer } from "https";
import { Server } from "engine.io";
import { Http3Server } from "@fails-components/webtransport";

// WARNING: the total length of the validity period MUST NOT exceed two weeks (https://w3c.github.io/webtransport/#custom-certificate-requirements)
const cert = readFileSync("/path/to/my/cert.pem");
const key = readFileSync("/path/to/my/key.pem");

const httpsServer = createServer({
  key,
  cert
});

httpsServer.listen(3000);

const engine = new Server({
  transports: ["polling", "websocket", "webtransport"] // WebTransport is not enabled by default
});

engine.attach(httpsServer);

const h3Server = new Http3Server({
  port: 3000,
  host: "0.0.0.0",
  secret: "changeit",
  cert,
  privKey: key,
});

(async () => {
  const stream = await h3Server.sessionStream("/engine.io/");
  const sessionReader = stream.getReader();

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) {
      break;
    }
    engine.onWebTransportSession(value);
  }
})();

h3Server.startServer();
```

Added in [123b68c](https://github.com/socketio/engine.io/commit/123b68c04f9e971f59b526e0f967a488ee6b0116).


### Credits

Huge thanks to [@OxleyS](https://github.com/OxleyS) for helping!


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.4.2](https://github.com/socketio/engine.io/compare/6.4.1...6.4.2) (2023-05-02)

:warning: This release contains an important security fix :warning:

A malicious client could send a specially crafted HTTP request, triggering an uncaught exception and killing the Node.js process:

```
TypeError: Cannot read properties of undefined (reading 'handlesUpgrades')
  at Server.onWebSocket (build/server.js:515:67)
```

Please upgrade as soon as possible.


### Bug Fixes

* include error handling for Express middlewares ([#674](https://github.com/socketio/engine.io/issues/674)) ([9395782](https://github.com/socketio/engine.io/commit/93957828be1252c83275b56f0c7c0bd145a0ceb9))
* prevent crash when provided with an invalid query param ([fc480b4](https://github.com/socketio/engine.io/commit/fc480b4f305e16fe5972cf337d055e598372dc44))
* **typings:** make clientsCount public ([#675](https://github.com/socketio/engine.io/issues/675)) ([bd6d471](https://github.com/socketio/engine.io/commit/bd6d4713b02ff646c581872cd9ffe753acff0d73))
* **uws:** prevent crash when using with middlewares ([8b22162](https://github.com/socketio/engine.io/commit/8b2216290330b174c9e67be32765bec0c74769f9))


### Credits

Huge thanks to [@tyilo](https://github.com/tyilo) and [@cieldeville](https://github.com/cieldeville) for helping!


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.4.1](https://github.com/socketio/engine.io/compare/6.4.0...6.4.1) (2023-02-20)

This release contains [6e78489](https://github.com/socketio/engine.io/commit/6e78489486f0d7570861fd6002a364d1ab87da4a), which exports the `BaseServer` class in order to restore the compatibility with the `nodenext` module resolution strategy of TypeScript.

Reference: https://www.typescriptlang.org/tsconfig/#moduleResolution

Related: https://github.com/socketio/socket.io/issues/4621


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)


## [6.4.0](https://github.com/socketio/engine.io/compare/6.3.1...6.4.0) (2023-02-06)


### Features

* add support for Express middlewares ([24786e7](https://github.com/socketio/engine.io/commit/24786e77c5403b1c4b5a2bc84e2af06f9187f74a))

This commit implements middlewares at the Engine.IO level, because Socket.IO middlewares are meant for namespace authorization and are not executed during a classic HTTP request/response cycle.

A workaround was possible by using the allowRequest option and the "headers" event, but this feels way cleaner and works with upgrade requests too.

Syntax:

```js
engine.use((req, res, next) => {
  // do something

  next();
});

// with express-session
import session from "express-session";

engine.use(session({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

// with helmet
import helmet from "helmet";

engine.use(helmet());
```


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.3.1](https://github.com/socketio/engine.io/compare/6.3.0...6.3.1) (2023-01-12)


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.3.0](https://github.com/socketio/engine.io/compare/6.2.1...6.3.0) (2023-01-10)


### Bug Fixes

* fix the ES module wrapper ([ed87609](https://github.com/socketio/engine.io/commit/ed87609bafca0e844e6b29ea1a895d95df6a544c))
* wait for all packets to be sent before closing the WebSocket connection ([a65a047](https://github.com/socketio/engine.io/commit/a65a047526401bebaa113a8c70d03f5d963eaa54))


### Features

* add the "addTrailingSlash" option ([#655](https://github.com/socketio/engine.io/issues/655)) ([d0fd474](https://github.com/socketio/engine.io/commit/d0fd4746afa396297f07bb62e539b0c1c4018d7c))

The trailing slash which was added by default can now be disabled:

```js
import { Server } from "engine.io";

const server = new Server();

server.attach(httpServer, {
  addTrailingSlash: false
});
```

In the example above, the clients can omit the trailing slash and use `/engine.io` instead of `/engine.io/`.


### Performance Improvements

* add the wsPreEncodedFrame option ([5e34722](https://github.com/socketio/engine.io/commit/5e34722b0b6564d6207a56d69bc3b0a831e4dc46))

This will be used when broadcasting packets at the Socket.IO level.

See also: https://github.com/socketio/socket.io-adapter/commit/5f7b47d40f9daabe4e3c321eda620bbadfe5ce96

### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) ([diff](https://github.com/websockets/ws/compare/8.2.3...8.11.0))



## [3.6.1](https://github.com/socketio/engine.io/compare/3.6.0...3.6.1) (2022-11-20)

:warning: This release contains an important security fix :warning:

A malicious client could send a specially crafted HTTP request, triggering an uncaught exception and killing the Node.js process:

```
Error: read ECONNRESET
    at TCP.onStreamRead (internal/stream_base_commons.js:209:20)
Emitted 'error' event on Socket instance at:
    at emitErrorNT (internal/streams/destroy.js:106:8)
    at emitErrorCloseNT (internal/streams/destroy.js:74:3)
    at processTicksAndRejections (internal/process/task_queues.js:80:21) {
  errno: -104,
  code: 'ECONNRESET',
  syscall: 'read'
}
```

Please upgrade as soon as possible.

### Bug Fixes

* catch errors when destroying invalid upgrades ([83c4071](https://github.com/socketio/engine.io/commit/83c4071af871fc188298d7d591e95670bf9f9085))

### Dependencies

- [`ws@~7.4.2`](https://github.com/websockets/ws/releases/tag/7.4.2) (no change)


## [6.2.1](https://github.com/socketio/engine.io/compare/6.2.0...6.2.1) (2022-11-20)

:warning: This release contains an important security fix :warning:

A malicious client could send a specially crafted HTTP request, triggering an uncaught exception and killing the Node.js process:

```
Error: read ECONNRESET
    at TCP.onStreamRead (internal/stream_base_commons.js:209:20)
Emitted 'error' event on Socket instance at:
    at emitErrorNT (internal/streams/destroy.js:106:8)
    at emitErrorCloseNT (internal/streams/destroy.js:74:3)
    at processTicksAndRejections (internal/process/task_queues.js:80:21) {
  errno: -104,
  code: 'ECONNRESET',
  syscall: 'read'
}
```

Please upgrade as soon as possible.

### Bug Fixes

* catch errors when destroying invalid upgrades ([#658](https://github.com/socketio/engine.io/issues/658)) ([425e833](https://github.com/socketio/engine.io/commit/425e833ab13373edf1dd5a0706f07100db14e3c6))

### Dependencies

- [`ws@~8.2.3`](https://github.com/websockets/ws/releases/tag/8.2.3) (no change)



## [3.6.0](https://github.com/socketio/engine.io/compare/3.5.0...3.6.0) (2022-06-06)


### Bug Fixes

* add extension in the package.json main entry ([#608](https://github.com/socketio/engine.io/issues/608)) ([3ad0567](https://github.com/socketio/engine.io/commit/3ad0567dbd57cfb7c2ff4e8b7488d80f37022b4a))
* do not reset the ping timer after upgrade ([1f5d469](https://github.com/socketio/engine.io/commit/1f5d4699862afee1e410fcb0e1f5e751ebcd2f9f)), closes [/github.com/socketio/socket.io-client-swift/pull/1309#issuecomment-768475704](https://github.com//github.com/socketio/socket.io-client-swift/pull/1309/issues/issuecomment-768475704)


### Features

* decrease the default value of maxHttpBufferSize ([58e274c](https://github.com/socketio/engine.io/commit/58e274c437e9cbcf69fd913c813aad8fbd253703))

This change reduces the default value from 100 mb to a more sane 1 mb.

This helps protect the server against denial of service attacks by malicious clients sending huge amounts of data.

See also: https://github.com/advisories/GHSA-j4f2-536g-r55m

* increase the default value of pingTimeout ([f55a79a](https://github.com/socketio/engine.io/commit/f55a79a28a5fbc6c9edae876dd11308b89cc979e))



## [6.2.0](https://github.com/socketio/engine.io/compare/6.1.3...6.2.0) (2022-04-17)


### Features

* add the "maxPayload" field in the handshake details ([088dcb4](https://github.com/socketio/engine.io/commit/088dcb4dff60df39785df13d0a33d3ceaa1dff38))

So that clients in HTTP long-polling can decide how many packets they have to send to stay under the maxHttpBufferSize
value.

This is a backward compatible change which should not mandate a new major revision of the protocol (we stay in v4), as
we only add a field in the JSON-encoded handshake data:

```
0{"sid":"lv_VI97HAXpY6yYWAAAC","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000,"maxPayload":1000000}
```



## [6.1.3](https://github.com/socketio/engine.io/compare/6.1.2...6.1.3) (2022-02-23)


### Bug Fixes

* **typings:** allow CorsOptionsDelegate as cors options ([#641](https://github.com/socketio/engine.io/issues/641)) ([a463d26](https://github.com/socketio/engine.io/commit/a463d268ed90064e7863679bda423951de108c36))
* **uws:** properly handle chunked content ([#642](https://github.com/socketio/engine.io/issues/642)) ([3367440](https://github.com/socketio/engine.io/commit/33674403084c329dc6ad026c4122333a6f8a9992))



## [6.1.2](https://github.com/socketio/engine.io/compare/6.1.1...6.1.2) (2022-01-18)


### Bug Fixes

* **uws:** expose additional uWebSockets.js options ([#634](https://github.com/socketio/engine.io/issues/634)) ([49bb7cf](https://github.com/socketio/engine.io/commit/49bb7cf66518d4b49baf883a16ee1fe1ed8aed28))
* **uws:** fix HTTP long-polling with CORS ([45112a3](https://github.com/socketio/engine.io/commit/45112a30d1af4cc25b21a5d658a748583cb64ed4))
* **uws:** handle invalid websocket upgrades ([8b4d6a8](https://github.com/socketio/engine.io/commit/8b4d6a8176db72f5c2420c5a45f0d97d33af049b))



## [6.1.1](https://github.com/socketio/engine.io/compare/6.1.0...6.1.1) (2022-01-11)

:warning: This release contains an important security fix :warning:

A malicious client could send a specially crafted HTTP request, triggering an uncaught exception and killing the Node.js process:

> RangeError: Invalid WebSocket frame: RSV2 and RSV3 must be clear
>   at Receiver.getInfo (/.../node_modules/ws/lib/receiver.js:176:14)
>   at Receiver.startLoop (/.../node_modules/ws/lib/receiver.js:136:22)
>   at Receiver._write (/.../node_modules/ws/lib/receiver.js:83:10)
>   at writeOrBuffer (internal/streams/writable.js:358:12)

This bug was introduced by [this commit](https://github.com/socketio/engine.io/commit/f3c291fa613a9d50c924d74293035737fdace4f2), included in `engine.io@4.0.0`, so previous releases are not impacted.

Thanks to Marcus Wejderot from Mevisio for the responsible disclosure.

### Bug Fixes

* properly handle invalid data sent by a malicious websocket client ([c0e194d](https://github.com/socketio/engine.io/commit/c0e194d44933bd83bf9a4b126fca68ba7bf5098c))



## [6.1.0](https://github.com/socketio/engine.io/compare/6.0.0...6.1.0) (2021-11-08)


### Bug Fixes

* fix payload encoding for v3 clients ([ed50fc3](https://github.com/socketio/engine.io/commit/ed50fc346b9c58459bf4e6fe5c45e8d34faac8da))


### Features

* add an implementation based on uWebSockets.js ([271e2df](https://github.com/socketio/engine.io/commit/271e2df94d39bbd13c33cab98cdd5915f9d28536))


### Performance Improvements

* refresh ping timer ([#628](https://github.com/socketio/engine.io/issues/628)) ([37474c7](https://github.com/socketio/engine.io/commit/37474c7e67be7c5f25f9ca2d4ea99f3a256bd2de))



## [6.0.1](https://github.com/socketio/engine.io/compare/6.0.0...6.0.1) (2021-11-06)


### Bug Fixes

* fix payload encoding for v3 clients ([3f42262](https://github.com/socketio/engine.io/commit/3f42262fd27a77a7383cdbb44ede7c6211a9782b))



## [6.0.0](https://github.com/socketio/engine.io/compare/5.2.0...6.0.0) (2021-10-08)

The codebase was migrated to TypeScript ([c0d6eaa](https://github.com/socketio/engine.io/commit/c0d6eaa1ba1291946dc8425d5f533d5f721862dd))

An ES module wrapper was also added ([401f4b6](https://github.com/socketio/engine.io/commit/401f4b60693fb6702c942692ce42e5bb701d81d7)).

Please note that the communication protocol was not updated, so a v5 client will be able to reach a v6 server (and vice-versa).

Reference: https://github.com/socketio/engine.io-protocol

### BREAKING CHANGES

- the default export was removed, so the following code won't work anymore:

```js
const eioServer = require("engine.io")(httpServer);
```

Please use this instead:

```js
const { Server } = require("engine.io");
const eioServer = new Server(httpServer);
```

### Dependencies

`ws` version: `~8.2.3` (bumped from `~7.4.2`)

## [5.2.0](https://github.com/socketio/engine.io/compare/5.1.1...5.2.0) (2021-08-29)

No change on the server-side, this matches the client release.


## [5.1.1](https://github.com/socketio/engine.io/compare/5.1.0...5.1.1) (2021-05-16)


### Bug Fixes

* properly close the websocket connection upon handshake error ([4360686](https://github.com/socketio/engine.io/commit/43606865e5299747cbb31f3ed9baf4567502a879))


## [5.1.0](https://github.com/socketio/engine.io/compare/5.0.0...5.1.0) (2021-05-04)


### Features

* add a "connection_error" event ([7096e98](https://github.com/socketio/engine.io/commit/7096e98a02295a62c8ea2aa56461d4875887092d))
* add the "initial_headers" and "headers" events ([2527543](https://github.com/socketio/engine.io/commit/252754353a0e88eb036ebb3082e9d6a9a5f497db))


### Performance Improvements

* **websocket:** add a "wsPreEncoded" writing option ([7706b12](https://github.com/socketio/engine.io/commit/7706b123df914777d19c8179b45ab6932f82916c))
* **websocket:** fix write back-pressure ([#618](https://github.com/socketio/engine.io/issues/618)) ([ad5306a](https://github.com/socketio/engine.io/commit/ad5306aeaedf06ac7a49f791e1b76e55c35a564e))


## [5.0.0](https://github.com/socketio/engine.io/compare/4.1.1...5.0.0) (2021-03-10)


### Bug Fixes

* set default protocol version to 3 ([#616](https://github.com/socketio/engine.io/issues/616)) ([868d891](https://github.com/socketio/engine.io/commit/868d89111de0ab5bd0e147ecaff7983afbf5d087))


### Features

* increase the default value of pingTimeout ([5a7fa13](https://github.com/socketio/engine.io/commit/5a7fa132c442bc1e7eefa1cf38168ee951575ded))
* remove dynamic require() with wsEngine ([edb7343](https://github.com/socketio/engine.io/commit/edb734316f143bf0f1bbc344e966d18e2676b934))


### BREAKING CHANGES

* the syntax of the "wsEngine" option is updated

Before:

```js
const eioServer = require("engine.io")(httpServer, {
  wsEngine: "eiows"
});
```

After:

```js
const eioServer = require("engine.io")(httpServer, {
  wsEngine: require("eiows").Server
});
```


## [4.1.1](https://github.com/socketio/engine.io/compare/4.1.0...4.1.1) (2021-02-02)


### Bug Fixes

* do not reset the ping timer after upgrade ([ff2b8ab](https://github.com/socketio/engine.io/commit/ff2b8aba48ebcb0de5626d3b76fddc94c398395f)), closes [/github.com/socketio/socket.io-client-swift/pull/1309#issuecomment-768475704](https://github.com//github.com/socketio/socket.io-client-swift/pull/1309/issues/issuecomment-768475704)


## [4.1.0](https://github.com/socketio/engine.io/compare/4.0.6...4.1.0) (2021-01-14)


### Features

* add support for v3.x clients ([663d326](https://github.com/socketio/engine.io/commit/663d326d18de598318bd2120b2b70cd51adf8955))


## [4.0.6](https://github.com/socketio/engine.io/compare/4.0.5...4.0.6) (2021-01-04)


### Bug Fixes

* correctly pass the options when using the Server constructor ([#610](https://github.com/socketio/engine.io/issues/610)) ([cec2750](https://github.com/socketio/engine.io/commit/cec27502f5b55c8a2ff289db34019629bf6a97ca))



## [3.5.0](https://github.com/socketio/engine.io/compare/3.4.2...3.5.0) (2020-12-30)


### Features

* add support for all cookie options ([19cc582](https://github.com/socketio/engine.io/commit/19cc58264a06dca47ed401fbaca32dcdb80a903b)), closes [/github.com/jshttp/cookie#options-1](https://github.com//github.com/jshttp/cookie/issues/options-1)
* disable perMessageDeflate by default ([5ad2736](https://github.com/socketio/engine.io/commit/5ad273601eb66c7b318542f87026837bf9dddd21))



## [4.0.5](https://github.com/socketio/engine.io/compare/4.0.4...4.0.5) (2020-12-07)

No change on the server-side, this matches the client release.

## [4.0.4](https://github.com/socketio/engine.io/compare/4.0.3...4.0.4) (2020-11-17)

No change on the server-side, this matches the client release.

## [4.0.3](https://github.com/socketio/engine.io/compare/4.0.2...4.0.3) (2020-11-17)

No change on the server-side, this matches the client release.

## [4.0.2](https://github.com/socketio/engine.io/compare/4.0.1...4.0.2) (2020-11-09)


### Bug Fixes

* add extension in the package.json main entry ([#608](https://github.com/socketio/engine.io/issues/608)) ([17b8c2f](https://github.com/socketio/engine.io/commit/17b8c2f199e7a307b6d6294b8599abacb3ec56e7))


## [4.0.1](https://github.com/socketio/engine.io/compare/4.0.0...4.0.1) (2020-10-21)


### Bug Fixes

* do not overwrite CORS headers upon error ([fe093ba](https://github.com/socketio/engine.io/commit/fe093bae1adce99e01dfdd3ce7542957785098b5))



## [4.0.0](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.1...4.0.0) (2020-09-10)

More details about this release in the blog post: https://socket.io/blog/engine-io-4-release/

### Bug Fixes

* ignore errors when forcefully closing the socket ([#601](https://github.com/socketio/engine.io/issues/601)) ([dcdbccb](https://github.com/socketio/engine.io/commit/dcdbccb3dd8a7b7db057d23925356034fcd35d48))
* remove implicit require of uws ([82cdca2](https://github.com/socketio/engine.io/commit/82cdca23bab0ed69b61b60961900d456a3065e6a))


### Features

* disable perMessageDeflate by default ([078527a](https://github.com/socketio/engine.io/commit/078527a384b70dc46d99083fa218be5d45213e51))

#### Links

- Diff: [v4.0.0-alpha.1...4.0.0](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.1...4.0.0)
- Full diff: [3.4.0...4.0.0](https://github.com/socketio/engine.io/compare/3.4.0...4.0.0)
- Client release: [4.0.0](https://github.com/socketio/engine.io-client/releases/tag/4.0.0)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)


## [3.4.2](https://github.com/socketio/engine.io/compare/3.4.1...3.4.2) (2020-06-04)


### Bug Fixes

* remove explicit require of uws ([85e544a](https://github.com/socketio/engine.io/commit/85e544afd95a5890761a613263a5eba0c9a18a93))

#### Links

- Diff: [3.4.1...3.4.2](https://github.com/socketio/engine.io/compare/3.4.1...3.4.2)
- Client release: -
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



## [3.4.1](https://github.com/socketio/engine.io/compare/3.4.0...3.4.1) (2020-04-17)


### Bug Fixes

* ignore errors when forcefully closing the socket ([da851ec](https://github.com/socketio/engine.io/commit/da851ec4ec89d96df2ee5c711f328b5d795423e9))
* use SameSite=Strict by default ([001ca62](https://github.com/socketio/engine.io/commit/001ca62cc4a8f511f3b2fbd9e4493ad274a6a0e5))

#### Links

- Diff: [3.4.0...3.4.1](https://github.com/socketio/engine.io/compare/3.4.0...3.4.1)
- Client release: [3.4.1](https://github.com/socketio/engine.io-client/releases/tag/3.4.1)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



## [4.0.0-alpha.1](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-02-12)

#### Links

- Diff: [v4.0.0-alpha.0...v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1)
- Client release: [v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/releases/tag/v4.0.0-alpha.1)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



## [4.0.0-alpha.0](https://github.com/socketio/engine.io/compare/3.4.0...v4.0.0-alpha.0) (2020-02-12)


### Features

* decrease the default value of maxHttpBufferSize ([734f9d1](https://github.com/socketio/engine.io/commit/734f9d1268840722c41219e69eb58318e0b2ac6b))
* disable cookie by default and add sameSite attribute ([a374471](https://github.com/socketio/engine.io/commit/a374471d06e3681a769766a1d068898182f9305f)), closes [/github.com/jshttp/cookie#options-1](https://github.com//github.com/jshttp/cookie/issues/options-1)
* generateId method can now return a Promise ([f3c291f](https://github.com/socketio/engine.io/commit/f3c291fa613a9d50c924d74293035737fdace4f2))
* reverse the ping-pong mechanism ([31ff875](https://github.com/socketio/engine.io/commit/31ff87593f231b86dc47ec5761936439ebd53c20))
* use the cors module to handle cross-origin requests ([61b9492](https://github.com/socketio/engine.io/commit/61b949259ed966ef6fc8bfd61f14d1a2ef06d319))


### BREAKING CHANGES

* the handlePreflightRequest option is removed by the change.

Before:

```
new Server({
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": 'https://example.com',
      "Access-Control-Allow-Methods": 'GET',
      "Access-Control-Allow-Headers": 'Authorization',
      "Access-Control-Allow-Credentials": true
    });
    res.end();
  }
})
```

After:

```
new Server({
  cors: {
    origin: "https://example.com",
    methods: ["GET"],
    allowedHeaders: ["Authorization"],
    credentials: true
  }
})
```
* the syntax has changed from

```
new Server({
  cookieName: "test",
  cookieHttpOnly: false,
  cookiePath: "/custom"
})
```

to

```
new Server({
  cookie: {
    name: "test",
    httpOnly: false,
    path: "/custom"
  }
})
```

All other options (domain, maxAge, sameSite, ...) are now supported.

* v3.x clients will not be able to connect anymore (they will send a ping packet and timeout while waiting for a pong packet).

#### Links

- Diff: [3.4.0...v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0)
- Client release: [v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/releases/tag/v4.0.0-alpha.0)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)

