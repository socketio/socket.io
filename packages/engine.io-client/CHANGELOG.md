# History

| Version                                                                                                     | Release date   | Bundle size (UMD min+gzip) |
|-------------------------------------------------------------------------------------------------------------|----------------|----------------------------|
| [6.6.2](#662-2024-10-23)                                                                                    | October 2024   | `8.7 KB`                   |
| [6.6.1](#661-2024-09-21)                                                                                    | September 2024 | `8.7 KB`                   |
| [6.6.0](#660-2024-06-21)                                                                                    | June 2024      | `8.6 KB`                   |
| [6.5.4](#654-2024-06-18) (from the [6.5.x](https://github.com/socketio/engine.io-client/tree/6.5.x) branch) | June 2024      | `8.8 KB`                   |
| [3.5.4](#354-2024-06-18) (from the [3.5.x](https://github.com/socketio/engine.io-client/tree/3.5.x) branch) | June 2024      | `-`                        |
| [6.5.3](#653-2023-11-09)                                                                                    | November 2023  | `8.8 KB`                   |
| [6.5.2](#652-2023-08-01)                                                                                    | August 2023    | `8.8 KB`                   |
| [6.5.1](#651-2023-06-28)                                                                                    | June 2023      | `8.4 KB`                   |
| [6.5.0](#650-2023-06-16)                                                                                    | June 2023      | `7.8 KB`                   |
| [6.4.0](#640-2023-02-06)                                                                                    | February 2023  | `7.8 KB`                   |
| [6.3.1](#631-2023-02-04)                                                                                    | February 2023  | `7.8 KB`                   |
| [6.3.0](#630-2023-01-10)                                                                                    | January 2023   | `8.0 KB`                   |
| [6.2.3](#623-2022-10-13)                                                                                    | October 2022   | `7.8 KB`                   |
| [3.5.3](#353-2022-09-07)                                                                                    | September 2022 | `-`                        |
| [6.2.2](#622-2022-05-02)                                                                                    | May 2022       | `7.8 KB`                   |
| [6.2.1](#621-2022-04-17)                                                                                    | April 2022     | `7.8 KB`                   |
| [6.2.0](#620-2022-04-17)                                                                                    | April 2022     | `7.8 KB`                   |
| [6.0.3](#603-2021-11-14) (from the [6.0.x](https://github.com/socketio/engine.io-client/tree/6.0.x) branch) | November 2021  | `7.4 KB`                   |
| [6.1.1](#611-2021-11-14)                                                                                    | November 2021  | `7.4 KB`                   |
| [6.1.0](#610-2021-11-08)                                                                                    | November 2021  | `7.4 KB`                   |
| [6.0.2](#602-2021-10-15)                                                                                    | October 2021   | `7.4 KB`                   |
| [6.0.1](#601-2021-10-14)                                                                                    | October 2021   | `7.4 KB`                   |
| [**6.0.0**](#600-2021-10-08)                                                                                | October 2021   | `7.5 KB`                   |
| [5.2.0](#520-2021-08-29)                                                                                    | August 2021    | `9.4 KB`                   |
| [5.1.2](#512-2021-06-24)                                                                                    | June 2021      | `9.3 KB`                   |
| [5.1.1](#511-2021-05-11)                                                                                    | May 2021       | `9.2 KB`                   |
| [4.1.4](#414-2021-05-05) (from the [4.1.x](https://github.com/socketio/engine.io-client/tree/4.1.x) branch) | May 2021       | `9.1 KB`                   |
| [3.5.2](#352-2021-05-05) (from the [3.5.x](https://github.com/socketio/engine.io-client/tree/3.5.x) branch) | May 2021       | `-`                        |
| [5.1.0](#510-2021-05-04)                                                                                    | May 2021       | `9.2 KB`                   |
| [5.0.1](#501-2021-03-31)                                                                                    | March 2021     | `9.2 KB`                   |
| [**5.0.0**](#500-2021-03-10)                                                                                | March 2021     | `9.3 KB`                   |
| [3.5.1](#351-2021-03-02) (from the [3.5.x](https://github.com/socketio/engine.io-client/tree/3.5.x) branch) | March 2021     | `-`                        |
| [4.1.2](#412-2021-02-25)                                                                                    | February 2021  | `9.2 KB`                   |
| [4.1.1](#411-2021-02-02)                                                                                    | February 2021  | `9.1 KB`                   |
| [4.1.0](#410-2021-01-14)                                                                                    | January 2021   | `9.1 KB`                   |

# Release notes

## [6.6.2](https://github.com/socketio/socket.io/compare/engine.io-client@6.6.1...engine.io-client@6.6.2) (2024-10-23)


### Bug Fixes

* **types:** remove ws type from .d.ts file ([175a2c5](https://github.com/socketio/socket.io/commit/175a2c58c1bc37eb9b87f87df47e1f9388b01d55))
* prevent infinite loop with Node.js built-in WebSocket ([4865f2e](https://github.com/socketio/socket.io/commit/4865f2e62eff9cf59f602e753d9f84159a3139af))


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.6.1](https://github.com/socketio/socket.io/compare/engine.io-client@6.6.0...engine.io-client@6.6.1) (2024-09-21)


### Bug Fixes

* move 'offline' event listener at the top ([8a2f5a3](https://github.com/socketio/socket.io/commit/8a2f5a3da0addb386e7a0f4970e1a9696b82797e))
* only remove the event listener if it exists ([9b3c9ab](https://github.com/socketio/socket.io/commit/9b3c9abecab028822357beb6e2b502f548e312eb)), closes [/github.com/socketio/socket.io/issues/5088#issuecomment-2217202350](https://github.com//github.com/socketio/socket.io/issues/5088/issues/issuecomment-2217202350)
* do not send a packet on an expired connection ([#5134](https://github.com/socketio/socket.io/issues/5134)) ([8adcfbf](https://github.com/socketio/socket.io/commit/8adcfbfde50679095ec2abe376650cf2b6814325))


### Performance Improvements

* do not reset the heartbeat timer on each packet ([7a23dde](https://github.com/socketio/socket.io/commit/7a23dde6efff3079edeeda951fe0ee25516da833))


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.6.0](https://github.com/socketio/engine.io-client/compare/6.5.3...6.6.0) (2024-06-21)


### Features

#### Custom transport implementations

The `transports` option now accepts an array of transport implementations:

```js
import { Socket, XHR, WebSocket } from "engine.io-client";

const socket = new Socket({
  transports: [XHR, WebSocket]
});
```

Here is the list of provided implementations:

| Transport       | Description                                                                                          |
|-----------------|------------------------------------------------------------------------------------------------------|
| `Fetch`         | HTTP long-polling based on the built-in `fetch()` method.                                            |
| `NodeXHR`       | HTTP long-polling based on the `XMLHttpRequest` object provided by the `xmlhttprequest-ssl` package. |
| `XHR`           | HTTP long-polling based on the built-in `XMLHttpRequest` object.                                     |
| `NodeWebSocket` | WebSocket transport based on the `WebSocket` object provided by the `ws` package.                    |
| `WebSocket`     | WebSocket transport based on the built-in `WebSocket` object.                                        |
| `WebTransport`  | WebTransport transport based on the built-in `WebTransport` object.                                  |

Usage:

| Transport       | browser            | Node.js                | Deno               | Bun                |
|-----------------|--------------------|------------------------|--------------------|--------------------|
| `Fetch`         | :white_check_mark: | :white_check_mark: (1) | :white_check_mark: | :white_check_mark: |
| `NodeXHR`       |                    | :white_check_mark:     | :white_check_mark: | :white_check_mark: |
| `XHR`           | :white_check_mark: |                        |                    |                    |
| `NodeWebSocket` |                    | :white_check_mark:     | :white_check_mark: | :white_check_mark: |
| `WebSocket`     | :white_check_mark: | :white_check_mark: (2) | :white_check_mark: | :white_check_mark: |
| `WebTransport`  | :white_check_mark: | :white_check_mark:     |                    |                    |

(1) since [v18.0.0](https://nodejs.org/api/globals.html#fetch)
(2) since [v21.0.0](https://nodejs.org/api/globals.html#websocket)

Added in [f4d898e](https://github.com/socketio/engine.io-client/commit/f4d898ee9652939a4550a41ac0e8143056154c0a) and [b11763b](https://github.com/socketio/engine.io-client/commit/b11763beecfe4622867b4dec9d1db77460733ffb).


#### Transport tree-shaking

The feature above also comes with the ability to exclude the code related to unused transports (a.k.a. "tree-shaking"):

```js
import { SocketWithoutUpgrade, WebSocket } from "engine.io-client";

const socket = new SocketWithoutUpgrade({
  transports: [WebSocket]
});
```

In that case, the code related to HTTP long-polling and WebTransport will be excluded from the final bundle.

Added in [f4d898e](https://github.com/socketio/engine.io-client/commit/f4d898ee9652939a4550a41ac0e8143056154c0a)


#### Test each low-level transports

When setting the `tryAllTransports` option to `true`, if the first transport (usually, HTTP long-polling) fails, then the other transports will be tested too:

```js
import { Socket } from "engine.io-client";

const socket = new Socket({
  tryAllTransports: true
});
```

This feature is useful in two cases:

- when HTTP long-polling is disabled on the server, or if CORS fails
- when WebSocket is tested first (with `transports: ["websocket", "polling"]`)

The only potential downside is that the connection attempt could take more time in case of failure, as there have been reports of WebSocket connection errors taking several seconds before being detected (that's one reason for using HTTP long-polling first). That's why the option defaults to `false` for now.

Added in [579b243](https://github.com/socketio/engine.io-client/commit/579b243e89ac7dc58233f9844ef70817364ecf52).


### Bug Fixes

* add some randomness to the cache busting string generator ([b624c50](https://github.com/socketio/engine.io-client/commit/b624c508325615fe5f0ba82293d14831d8861324))
* fix cookie management with WebSocket (Node.js only) ([e105551](https://github.com/socketio/engine.io-client/commit/e105551ef17ff8a23aa3ebdea9119619ae4208ad))


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) (no change)



## [6.5.4](https://github.com/socketio/engine.io-client/compare/6.5.3...6.5.4) (2024-06-18)

This release contains a bump of the `ws` dependency, which includes an important [security fix](https://github.com/websockets/ws/commit/e55e5106f10fcbaac37cfa89759e4cc0d073a52c).

Advisory: https://github.com/advisories/GHSA-3h5v-q93c-6h6q


### Dependencies

- [`ws@~8.17.1`](https://github.com/websockets/ws/releases/tag/8.17.1) ([diff](https://github.com/websockets/ws/compare/8.11.0...8.17.1))



## [3.5.4](https://github.com/socketio/engine.io-client/compare/3.5.3...3.5.4) (2024-06-18)

This release contains a bump of the `ws` dependency, which includes an important [security fix](https://github.com/websockets/ws/commit/e55e5106f10fcbaac37cfa89759e4cc0d073a52c).

Advisory: https://github.com/advisories/GHSA-3h5v-q93c-6h6q

### Dependencies

- [`ws@~7.5.10`](https://github.com/websockets/ws/releases/tag/7.5.10) ([diff](https://github.com/websockets/ws/compare/7.4.2...7.5.10))



## [6.5.3](https://github.com/socketio/engine.io-client/compare/6.5.2...6.5.3) (2023-11-09)


### Bug Fixes

* add a maximum length for the URL ([707597d](https://github.com/socketio/engine.io-client/commit/707597df26abfa1e6b569b2a62918dfcc8b80b5d))
* improve compatibility with node16 module resolution ([#711](https://github.com/socketio/engine.io-client/issues/711)) ([46ef851](https://github.com/socketio/engine.io-client/commit/46ef8512edac758069ed4d519f7517bafbace4a9))


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.2](https://github.com/socketio/engine.io-client/compare/6.5.1...6.5.2) (2023-08-01)


### Bug Fixes

* **webtransport:** add proper framing ([d55c39e](https://github.com/socketio/engine.io-client/commit/d55c39e0ed5cb7b3a34875a398efc111c91184f6))
* **webtransport:** honor the binaryType attribute ([8270e00](https://github.com/socketio/engine.io-client/commit/8270e00d5b865278d136a4d349b344cbc2b38dc5))


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.1](https://github.com/socketio/engine.io-client/compare/6.5.0...6.5.1) (2023-06-28)


### Bug Fixes

* make closeOnBeforeunload default to false ([a63066b](https://github.com/socketio/engine.io-client/commit/a63066bdc8ae9e6746c3113d06c2ead78f4a4851))
* **webtransport:** properly handle abruptly closed connections ([cf6aa1f](https://github.com/socketio/engine.io-client/commit/cf6aa1f43c27a56c076bf26fddfce74bfeb65040))


### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.5.0](https://github.com/socketio/engine.io-client/compare/6.4.0...6.5.0) (2023-06-16)


### Features

#### Support for WebTransport

The Engine.IO client can now use WebTransport as the underlying transport.

WebTransport is a web API that uses the HTTP/3 protocol as a bidirectional transport. It's intended for two-way communications between a web client and an HTTP/3 server.

References:

- https://w3c.github.io/webtransport/
- https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
- https://developer.chrome.com/articles/webtransport/

**For Node.js clients**: until WebTransport support lands [in Node.js](https://github.com/nodejs/node/issues/38478), you can use the `@fails-components/webtransport` package:

```js
import { WebTransport } from "@fails-components/webtransport";

global.WebTransport = WebTransport;
```

Added in [7195c0f](https://github.com/socketio/engine.io-client/commit/7195c0f305b482f7b1ca2ed812030caaf72c0906).

#### Cookie management for the Node.js client

When setting the `withCredentials` option to `true`, the Node.js client will now include the cookies in the HTTP requests, making it easier to use it with cookie-based sticky sessions.

```js
import { Socket } from "engine.io-client";

const socket = new Socket("https://example.com", {
  withCredentials: true
});
```

Added in [5fc88a6](https://github.com/socketio/engine.io-client/commit/5fc88a62d4017cdc144fa39b9755deadfff2db34).

### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.4.0](https://github.com/socketio/engine.io-client/compare/6.3.1...6.4.0) (2023-02-06)

The minor bump is due to changes on the server side.

### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)



## [6.3.1](https://github.com/socketio/engine.io-client/compare/6.3.0...6.3.1) (2023-02-04)


### Bug Fixes

* **typings:** do not expose browser-specific types ([37d7a0a](https://github.com/socketio/engine.io-client/commit/37d7a0aa791a4666ca405b11d0d8bdb199222e50))

### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) (no change)


## [6.3.0](https://github.com/socketio/engine.io-client/compare/6.2.3...6.3.0) (2023-01-10)


### Bug Fixes

* properly parse relative URL with a "@" character ([12b7d78](https://github.com/socketio/engine.io-client/commit/12b7d7817e9c0016c970f903de15ed8b4255ea90))
* use explicit context for setTimeout function ([#699](https://github.com/socketio/engine.io-client/issues/699)) ([047f420](https://github.com/socketio/engine.io-client/commit/047f420b86a669752536ff425261e7be60a80692))


### Features

* add the "addTrailingSlash" option ([#694](https://github.com/socketio/engine.io-client/issues/694)) ([21a6e12](https://github.com/socketio/engine.io-client/commit/21a6e1219add92157c5442537d24fbe1129a50f5))

The trailing slash which was added by default can now be disabled:

```js
import { Socket } from "engine.io-client";

const socket = new Socket("https://example.com", {
  addTrailingSlash: false
});
```

In the example above, the request URL will be `https://example.com/engine.io` instead of `https://example.com/engine.io/`.

### Dependencies

- [`ws@~8.11.0`](https://github.com/websockets/ws/releases/tag/8.11.0) ([diff](https://github.com/websockets/ws/compare/8.2.3...8.11.0))



## [6.2.3](https://github.com/socketio/engine.io-client/compare/6.2.2...6.2.3) (2022-10-13)


### Bug Fixes

* properly clear "beforeunload" event listener ([99925a4](https://github.com/socketio/engine.io-client/commit/99925a47750f66d2ad36313243545181512579ee))

### Dependencies

- [`ws@~8.2.3`](https://github.com/websockets/ws/releases/tag/8.2.3) (no change)



## [3.5.3](https://github.com/socketio/engine.io-client/compare/3.5.2...3.5.3) (2022-09-07)


### Bug Fixes

* fix usage with vite ([280de36](https://github.com/socketio/engine.io-client/commit/280de368092b17648b59b7467fa49f2425edcd45))

### Dependencies

- [`ws@~7.4.2`](https://github.com/websockets/ws/releases/tag/7.4.2) (no change)



## [6.2.2](https://github.com/socketio/engine.io-client/compare/6.2.1...6.2.2) (2022-05-02)


### Bug Fixes

* simplify the check for WebSocket availability ([f158c8e](https://github.com/socketio/engine.io-client/commit/f158c8e255be9e849313e53201adf1642c60345a))

This check was added for the flashsocket transport, which has been deprecated for a while now ([1]). But it fails with latest webpack versions, as the expression `"__initialize" in WebSocket` gets evaluated to `true`.

* use named export for globalThis shim ([#688](https://github.com/socketio/engine.io-client/issues/688)) ([32878ea](https://github.com/socketio/engine.io-client/commit/32878ea047c38e2b2f0444e828ac71f4d833971f))

Default export of globalThis seems to have a problem in the "browser" field when the library is loaded asynchronously with webpack.



## [6.2.1](https://github.com/socketio/engine.io-client/compare/6.2.0...6.2.1) (2022-04-17)



# [6.2.0](https://github.com/socketio/engine.io-client/compare/6.1.1...6.2.0) (2022-04-17)


### Features

* add details to the "close" event ([b9252e2](https://github.com/socketio/engine.io-client/commit/b9252e207413a850db7e4f0f0ef7dd2ef0ed26da))

The close event will now include additional details to help debugging if anything has gone wrong.

Example when a payload is over the maxHttpBufferSize value in HTTP long-polling mode:

```js
socket.on("close", (reason, details) => {
  console.log(reason); // "transport error"

  // in that case, details is an error object
  console.log(details.message); "xhr post error"
  console.log(details.description); // 413 (the HTTP status of the response)

  // details.context refers to the XMLHttpRequest object
  console.log(details.context.status); // 413
  console.log(details.context.responseText); // ""
});
```

Note: the error object was already included before this commit and is kept for backward compatibility.

* slice write buffer according to the maxPayload value ([46fdc2f](https://github.com/socketio/engine.io-client/commit/46fdc2f0ed352b454614247406689edc9d908927))

The server will now include a "maxPayload" field in the handshake details, allowing the clients to decide how many
packets they have to send to stay under the maxHttpBufferSize value.



## [6.0.3](https://github.com/socketio/engine.io-client/compare/6.0.2...6.0.3) (2021-11-14)

Some bug fixes were backported from master, to be included by the latest `socket.io-client` version.

### Bug Fixes

* add package name in nested package.json ([32511ee](https://github.com/socketio/engine.io-client/commit/32511ee32a0a6122e99db35833ed948aa4e427ac))
* fix vite build for CommonJS users ([9fcaf58](https://github.com/socketio/engine.io-client/commit/9fcaf58d18c013c0b92fdaf27481f0383efb3658))



## [6.1.1](https://github.com/socketio/engine.io-client/compare/6.1.0...6.1.1) (2021-11-14)


### Bug Fixes

* add package name in nested package.json ([6e798fb](https://github.com/socketio/engine.io-client/commit/6e798fbb5b11a1cfec03ece3dfce03213b5f9a12))
* fix vite build for CommonJS users ([c557707](https://github.com/socketio/engine.io-client/commit/c557707fb694bd10397b4cd8b4ec2fbe59128faa))



# [6.1.0](https://github.com/socketio/engine.io-client/compare/6.0.2...6.1.0) (2021-11-08)

The minor bump is due to changes on the server side.

### Bug Fixes

* **typings:** allow any value in the query option ([018e1af](https://github.com/socketio/engine.io-client/commit/018e1afcc5ef5eac81e9e1629db053bda44120ee))
* **typings:** allow port to be a number ([#680](https://github.com/socketio/engine.io-client/issues/680)) ([8f68f77](https://github.com/socketio/engine.io-client/commit/8f68f77825af069fe2c612a3200a025d4130ac0a))



## [6.0.2](https://github.com/socketio/engine.io-client/compare/6.0.1...6.0.2) (2021-10-15)


### Bug Fixes

* **bundle:** fix vite build ([faa9f31](https://github.com/socketio/engine.io-client/commit/faa9f318e70cd037af79bfa20e9d21b284ddf257))



## [6.0.1](https://github.com/socketio/engine.io-client/compare/6.0.0...6.0.1) (2021-10-14)


### Bug Fixes

* fix usage with vite ([4971914](https://github.com/socketio/engine.io-client/commit/49719142f65e23efa65fca4f66765ded5d955972))


# [6.0.0](https://github.com/socketio/engine.io-client/compare/5.2.0...6.0.0) (2021-10-08)

This major release contains three important changes:

- the codebase was migrated to TypeScript ([7245b80](https://github.com/socketio/engine.io-client/commit/7245b803e0c8d57cfc1f1cd8b8c8d598e8397967))
- rollup is now used instead of webpack to create the bundles ([27de300](https://github.com/socketio/engine.io-client/commit/27de300de42420ab59a02ec7a3445e636cbcc78e))
- code that provided support for ancient browsers (think IE8) was removed ([c656192](https://github.com/socketio/engine.io-client/commit/c6561928be628084fd2f5e7a70943c8e5c582873) and [b2c7381](https://github.com/socketio/engine.io-client/commit/b2c73812e978489b5dfbe516a26b6b8fd628856d))

There is now three distinct builds (in the build/ directory):

- CommonJS
- ESM with debug
- ESM without debug (rationale here: [00d7e7d](https://github.com/socketio/engine.io-client/commit/00d7e7d7ee85b4cfa6f9f547203cc692083ac61c))

And three bundles (in the dist/ directory) :

- `engine.io.js`: unminified UMD bundle
- `engine.io.min.js`: minified UMD bundle
- `engine.io.esm.min.js`: ESM bundle

Please note that the communication protocol was not updated, so a v5 client will be able to reach a v6 server (and vice-versa).

Reference: https://github.com/socketio/engine.io-protocol

### Features

* provide an ESM build without debug ([00d7e7d](https://github.com/socketio/engine.io-client/commit/00d7e7d7ee85b4cfa6f9f547203cc692083ac61c))

### BREAKING CHANGES

* the enableXDR option is removed ([c656192](https://github.com/socketio/engine.io-client/commit/c6561928be628084fd2f5e7a70943c8e5c582873))
* the jsonp and forceJSONP options are removed ([b2c7381](https://github.com/socketio/engine.io-client/commit/b2c73812e978489b5dfbe516a26b6b8fd628856d))

`ws` version: `~8.2.3`

# [5.2.0](https://github.com/socketio/engine.io-client/compare/5.1.2...5.2.0) (2021-08-29)


### Features

* add an option to use native timer functions ([#672](https://github.com/socketio/engine.io-client/issues/672)) ([5d1d5be](https://github.com/socketio/engine.io-client/commit/5d1d5bea11ab6854473ddc02a3391929ea4fc8f4))


## [5.1.2](https://github.com/socketio/engine.io-client/compare/5.1.1...5.1.2) (2021-06-24)


### Bug Fixes

* emit ping when receiving a ping from the server ([589d3ad](https://github.com/socketio/engine.io-client/commit/589d3ad63840329b5a61186603a415c534f8d4fc))
* **websocket:** fix timer blocking writes ([#670](https://github.com/socketio/engine.io-client/issues/670)) ([f30a10b](https://github.com/socketio/engine.io-client/commit/f30a10b7f45517fcb3abd02511c58a89e0ef498f))


## [5.1.1](https://github.com/socketio/engine.io-client/compare/5.1.0...5.1.1) (2021-05-11)


### Bug Fixes

* fix JSONP transport on IE9 ([bddd992](https://github.com/socketio/engine.io-client/commit/bddd9928fcdb33c79e0289bcafef337359dee12b))


## [4.1.4](https://github.com/socketio/engine.io-client/compare/4.1.3...4.1.4) (2021-05-05)

This release only contains a bump of `xmlhttprequest-ssl`, in order to fix the following vulnerability: https://www.npmjs.com/advisories/1665.

Please note that `engine.io-client` was not directly impacted by this vulnerability, since we are always using `async: true`.


## [3.5.2](https://github.com/socketio/engine.io-client/compare/3.5.1...3.5.2) (2021-05-05)

This release only contains a bump of `xmlhttprequest-ssl`, in order to fix the following vulnerability: https://www.npmjs.com/advisories/1665.

Please note that `engine.io-client` was not directly impacted by this vulnerability, since we are always using `async: true`.


# [5.1.0](https://github.com/socketio/engine.io-client/compare/5.0.1...5.1.0) (2021-05-04)


### Features

* add the "closeOnBeforeunload" option ([dcb85e9](https://github.com/socketio/engine.io-client/commit/dcb85e902d129b2d1a94943b4f6d471532f70dc9))


## [5.0.1](https://github.com/socketio/engine.io-client/compare/5.0.0...5.0.1) (2021-03-31)


### Bug Fixes

* ignore packets when the transport is silently closed ([d291a4c](https://github.com/socketio/engine.io-client/commit/d291a4c9f6accfc86fcd96683a5d493a87e3644c))


# [5.0.0](https://github.com/socketio/engine.io-client/compare/4.1.2...5.0.0) (2021-03-10)

The major bump is due to a breaking change on the server side.

### Features

* add autoUnref option ([6551683](https://github.com/socketio/engine.io-client/commit/65516836b2b6fe28d80e9a5918f9e10baa7451d8))
* listen to the "offline" event ([c361bc6](https://github.com/socketio/engine.io-client/commit/c361bc691f510b96f8909c5e6c62a4635d50275c))


## [3.5.1](https://github.com/socketio/engine.io-client/compare/3.5.0...3.5.1) (2021-03-02)


### Bug Fixes

* replace default nulls in SSL options with undefineds ([d0c551c](https://github.com/socketio/engine.io-client/commit/d0c551cca1e37301e8b28843c8f6e7ad5cf561d3))


## [4.1.2](https://github.com/socketio/engine.io-client/compare/4.1.1...4.1.2) (2021-02-25)


### Bug Fixes

* silently close the transport in the beforeunload hook ([ed48b5d](https://github.com/socketio/engine.io-client/commit/ed48b5dc3407e5ded45072606b3bb0eafa49c01f))


## [4.1.1](https://github.com/socketio/engine.io-client/compare/4.1.0...4.1.1) (2021-02-02)


### Bug Fixes

* remove polyfill for process in the bundle ([c95fdea](https://github.com/socketio/engine.io-client/commit/c95fdea83329b264964641bb48e3be2a8772f7a1))


# [4.1.0](https://github.com/socketio/engine.io-client/compare/4.0.6...4.1.0) (2021-01-14)


### Features

* add missing ws options ([d134fee](https://github.com/socketio/engine.io-client/commit/d134feeaa615afc4cbe0aa45aa4344c899b65df0))


## [4.0.6](https://github.com/socketio/engine.io-client/compare/4.0.5...4.0.6) (2021-01-04)


# [3.5.0](https://github.com/socketio/engine.io-client/compare/3.4.4...3.5.0) (2020-12-30)


### Bug Fixes

* check the type of the initial packet ([8750356](https://github.com/socketio/engine.io-client/commit/8750356dba5409ba0e1d3a27da6d214118702b3e))



## [4.0.5](https://github.com/socketio/engine.io-client/compare/4.0.4...4.0.5) (2020-12-07)


## [4.0.4](https://github.com/socketio/engine.io-client/compare/4.0.3...4.0.4) (2020-11-17)


### Bug Fixes

* check the type of the initial packet ([1c8cba8](https://github.com/socketio/engine.io-client/commit/1c8cba8818e930205918a70f05c1164865842a48))
* restore the cherry-picking of the WebSocket options ([4873a23](https://github.com/socketio/engine.io-client/commit/4873a237f1ce5fcb18e255dd604d50dcfc624ea8))


## [4.0.3](https://github.com/socketio/engine.io-client/compare/4.0.2...4.0.3) (2020-11-17)


### Bug Fixes

* **react-native:** add a default value for the withCredentials option ([ccb99e3](https://github.com/socketio/engine.io-client/commit/ccb99e3718e8ee2c50960430d2bd6c12a3dcb0dc))
* **react-native:** exclude the localAddress option ([177b95f](https://github.com/socketio/engine.io-client/commit/177b95fe463ad049b35170f042a771380fdaedee))


## [4.0.2](https://github.com/socketio/engine.io-client/compare/4.0.1...4.0.2) (2020-11-09)


## [4.0.1](https://github.com/socketio/engine.io-client/compare/4.0.0...4.0.1) (2020-10-21)



## [3.4.4](https://github.com/socketio/engine.io-client/compare/3.4.3...3.4.4) (2020-09-30)



# [4.0.0](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.1...4.0.0) (2020-09-10)

More details about this release in the blog post: https://socket.io/blog/engine-io-4-release/

### Bug Fixes

* **react-native:** restrict the list of options for the WebSocket object ([2f5c948](https://github.com/socketio/engine.io-client/commit/2f5c948abe8fd1c0fdb010e88f96bd933a3792ea))
* use globalThis polyfill instead of self/global ([#634](https://github.com/socketio/engine.io-client/issues/634)) ([3f3a6f9](https://github.com/socketio/engine.io-client/commit/3f3a6f991404ef601252193382d2d2029cff6c45))


### Features

* strip debug from the browser bundle ([f7ba966](https://github.com/socketio/engine.io-client/commit/f7ba966e53f4609f755880be8fa504f7252b0817))

#### Links

- Diff: [v4.0.0-alpha.1...4.0.0](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.1...4.0.0)
- Full diff: [3.4.0...4.0.0](https://github.com/socketio/engine.io-client/compare/3.4.0...4.0.0)
- Server release: [4.0.0](https://github.com/socketio/engine.io/releases/tag/4.0.0)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)


## [3.4.1](https://github.com/socketio/engine.io-client/compare/3.4.0...3.4.1) (2020-04-17)


### Bug Fixes

* use globalThis polyfill instead of self/global ([357f01d](https://github.com/socketio/engine.io-client/commit/357f01d90448d8565b650377bc7cabb351d991bd))

#### Links

- Diff: [3.4.0...3.4.1](https://github.com/socketio/engine.io-client/compare/3.4.0...3.4.1)
- Server release: [3.4.1](https://github.com/socketio/engine.io/releases/tag/3.4.1)
- ws version: [~6.1.0](https://github.com/websockets/ws/releases/tag/6.1.0)


# [4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-02-12)


### Bug Fixes

* properly assign options when creating the transport ([7c7f1a9](https://github.com/socketio/engine.io-client/commit/7c7f1a9fe24856e3a155db1dc67d12d1586ffa37))

#### Links

- Diff: [v4.0.0-alpha.0...v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1)
- Server release: [v4.0.0-alpha.1](https://github.com/socketio/engine.io/releases/tag/v4.0.0-alpha.1)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)


# [4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0) (2020-02-12)


### chore

* migrate to webpack 4 ([11dc4f3](https://github.com/socketio/engine.io-client/commit/11dc4f3a56d440f24b8a091485fef038d592bd6e))


### Features

* reverse the ping-pong mechanism ([81d7171](https://github.com/socketio/engine.io-client/commit/81d7171c6bb4053c802e3cc4b29a0e42dcf9c065))


### BREAKING CHANGES

* v3.x clients will not be able to connect anymore (they
will send a ping packet and timeout while waiting for a pong packet).

* the output bundle will now be found in the dist/ folder.


#### Links

- Diff: [3.4.0...v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0)
- Server release: [v4.0.0-alpha.0](https://github.com/socketio/engine.io/releases/tag/v4.0.0-alpha.0)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)
