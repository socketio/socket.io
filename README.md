# Engine.IO Protocol

This document describes the 4th version of the Engine.IO protocol.

**Table of content**

- [Introduction](#introduction)
- [Transports](#transports)
  - [HTTP long-polling](#http-long-polling)
    - [Request path](#request-path)
    - [Query parameters](#query-parameters)
    - [Headers](#headers)
    - [Sending and receiving data](#sending-and-receiving-data)
      - [Sending data](#sending-data)
      - [Receiving data](#receiving-data)
  - [WebSocket](#websocket)
- [Protocol](#protocol)
  - [Handshake](#handshake)
  - [Heartbeat](#heartbeat)
  - [Upgrade](#upgrade)
  - [Message](#message)
- [Packet encoding](#packet-encoding)
  - [HTTP long-polling](#http-long-polling-1)
  - [WebSocket](#websocket-1)
- [History](#history)
  - [From v2 to v3](#from-v2-to-v3)
  - [From v3 to v4](#from-v3-to-v4)
- [Test suite](#test-suite)



## Introduction

The Engine.IO protocol enables [full-duplex](https://en.wikipedia.org/wiki/Duplex_(telecommunications)#FULL-DUPLEX) and low-overhead communication between a client and a server.

It is based on the [WebSocket protocol](https://en.wikipedia.org/wiki/WebSocket) and uses [HTTP long-polling](https://en.wikipedia.org/wiki/Push_technology#Long_polling) as fallback if the WebSocket connection can't be established.

The reference implementation is written in [TypeScript](https://www.typescriptlang.org/):

- server: https://github.com/socketio/engine.io
- client: https://github.com/socketio/engine.io-client

The [Socket.IO protocol](https://github.com/socketio/socket.io-protocol) is built on top of these foundations, bringing additional features over the communication channel provided by the Engine.IO protocol.

## Transports

The connection between an Engine.IO client and an Engine.IO server can be established with:

- [HTTP long-polling](#http-long-polling)
- [WebSocket](#websocket)

### HTTP long-polling

The HTTP long-polling transport (also simply referred as "polling") consists of successive HTTP requests:

- long-running `GET` requests, for receiving data from the server
- short-running `POST` requests, for sending data to the server

#### Request path

The path of the HTTP requests is `/engine.io/` by default.

It might be updated by libraries built on top of the protocol (for example, the Socket.IO protocol uses `/socket.io/`).

#### Query parameters

The following query parameters are used:

| Name        | Value     | Description                                                        |
|-------------|-----------|--------------------------------------------------------------------|
| `EIO`       | `4`       | Mandatory, the version of the protocol.                            | 
| `transport` | `polling` | Mandatory, the name of the transport.                              |
| `sid`       | `<sid>`   | Mandatory once the session is established, the session identifier. |

If a mandatory query parameter is missing, then the server MUST respond with an HTTP 400 error status.

#### Headers

When sending binary data, the sender (client or server) MUST include a `Content-Type: application/octet-stream` header.

Without an explicit `Content-Type` header, the receiver SHOULD infer that the data is plaintext.

Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type

#### Sending and receiving data

##### Sending data

To send some packets, a client MUST create an HTTP `POST` request with the packets encoded in the request body:

```
CLIENT                                                 SERVER

  │                                                      │
  │   POST /engine.io/?EIO=4&transport=polling&sid=...   │
  │ ───────────────────────────────────────────────────► │
  │ ◄──────────────────────────────────────────────────┘ │
  │                        HTTP 200                      │
  │                                                      │
```

The server MUST return an HTTP 400 response if the session ID (from the `sid` query parameter) is not known.

To indicate success, the server MUST return an HTTP 200 response, with the string `ok` in the response body.

To ensure packet ordering, a client MUST NOT have more than one active `POST` request. Should it happen, the server MUST return an HTTP 400 error status and close the session.

##### Receiving data

To receive some packets, a client MUST create an HTTP `GET` request:

```
CLIENT                                                SERVER

  │   GET /engine.io/?EIO=4&transport=polling&sid=...   │
  │ ──────────────────────────────────────────────────► │
  │                                                   . │
  │                                                   . │
  │                                                   . │
  │                                                   . │
  │ ◄─────────────────────────────────────────────────┘ │
  │                       HTTP 200                      │
```

The server MUST return an HTTP 400 response if the session ID (from the `sid` query parameter) is not known.

The server MAY not respond right away if there are no packets buffered for the given session. Once there are some packets to be sent, the server SHOULD encode them (see [Packet encoding](#packet-encoding)) and send them in the response body of the HTTP request.

To ensure packet ordering, a client MUST NOT have more than one active `GET` request. Should it happen, the server MUST return an HTTP 400 error status and close the session.

### WebSocket

The WebSocket transport consists of a [WebSocket connection](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API), which provides a bidirectional and low-latency communication channel between the server and the client.

The following query parameters are used:

| Name        | Value       | Description                                                                   |
|-------------|-------------|-------------------------------------------------------------------------------|
| `EIO`       | `4`         | Mandatory, the version of the protocol.                                       | 
| `transport` | `websocket` | Mandatory, the name of the transport.                                         |
| `sid`       | `<sid>`     | Optional, depending on whether it's an upgrade from HTTP long-polling or not. |

If a mandatory query parameter is missing, then the server MUST close the WebSocket connection.

Each packet (read or write) is sent its own [WebSocket frame](https://datatracker.ietf.org/doc/html/rfc6455#section-5).

A client MUST NOT open more than one WebSocket connection per session. Should it happen, the server MUST close the WebSocket connection.

## Protocol

An Engine.IO packet consists of:

- a packet type
- an optional packet payload

Here is the list of available packet types:

| Type    | ID  | Usage                                            |
|---------|-----|--------------------------------------------------|
| open    | 0   | Used during the [handshake](#handshake).         | 
| close   | 1   | Used to indicate that a transport can be closed. |
| ping    | 2   | Used in the [heartbeat mechanism](#heartbeat).   |
| pong    | 3   | Used in the [heartbeat mechanism](#heartbeat).   |
| message | 4   | Used to send a payload to the other side.        |
| upgrade | 5   | Used during the [upgrade process](#upgrade).     |
| noop    | 6   | Used during the [upgrade process](#upgrade).     |

### Handshake

To establish a connection, the client MUST send an HTTP `GET` request to the server:

- HTTP long-polling first (by default)

```
CLIENT                                                    SERVER

  │                                                          │
  │        GET /engine.io/?EIO=4&transport=polling           │
  │ ───────────────────────────────────────────────────────► │
  │ ◄──────────────────────────────────────────────────────┘ │
  │                        HTTP 200                          │
  │                                                          │
```

- WebSocket-only session

```
CLIENT                                                    SERVER

  │                                                          │
  │        GET /engine.io/?EIO=4&transport=websocket         │
  │ ───────────────────────────────────────────────────────► │
  │ ◄──────────────────────────────────────────────────────┘ │
  │                        HTTP 101                          │
  │                                                          │
```

If the server accepts the connection, then it MUST respond with an `open` packet with the following JSON-encoded payload:

| Key            | Type       | Description                                                                                                       |
|----------------|------------|-------------------------------------------------------------------------------------------------------------------|
| `sid`          | `string`   | The session ID.                                                                                                   |
| `upgrades`     | `string[]` | The list of available [transport upgrades](#upgrade).                                                             |
| `pingInterval` | `number`   | The ping interval, used in the [heartbeat mechanism](#heartbeat) (in milliseconds).                               |
| `pingTimeout`  | `number`   | The ping timeout, used in the [heartbeat mechanism](#heartbeat) (in milliseconds).                                |
| `maxPayload`   | `number`   | The maximum number of bytes per chunk, used by the client to aggregate packets into [payloads](#packet-encoding). |

Example:

```json
{
  "sid": "lv_VI97HAXpY6yYWAAAC",
  "upgrades": ["websocket"],
  "pingInterval": 25000,
  "pingTimeout": 20000,
  "maxPayload": 1000000
}
```

The client MUST send the `sid` value in the query parameters of all subsequent requests.

### Heartbeat

Once the [handshake](#handshake) is completed, a heartbeat mechanism is started to check the liveness of the connection:

```
CLIENT                                                 SERVER

  │                   *** Handshake ***                  │
  │                                                      │
  │  ◄─────────────────────────────────────────────────  │
  │                           2                          │  (ping packet)
  │  ─────────────────────────────────────────────────►  │
  │                           3                          │  (pong packet)
```

At a given interval (the `pingInterval` value sent in the handshake) the server sends a `ping` packet and the client has a few seconds (the `pingTimeout` value) to send a `pong` packet back.

If the server does not receive a `pong` packet back, then it SHOULD consider that the connection is closed.

Conversely, if the client does not receive a `ping` packet within `pingInterval + pingTimeout`, then it SHOULD consider that the connection is closed.

### Upgrade

By default, the client SHOULD create an HTTP long-polling connection, and then upgrade to better transports if available.

To upgrade to WebSocket, the client MUST:

- pause the HTTP long-polling transport (no more HTTP request gets sent), to ensure that no packet gets lost
- open a WebSocket connection with the same session ID
- send a `ping` packet with the string `probe` in the payload

The server MUST:

- send a `noop` packet to any pending `GET` request (if applicable) to cleanly close HTTP long-polling transport
- respond with a `pong` packet with the string `probe` in the payload

Finally, the client MUST send a `upgrade` packet to complete the upgrade:

```
CLIENT                                                 SERVER

  │                                                      │
  │   GET /engine.io/?EIO=4&transport=websocket&sid=...  │
  │ ───────────────────────────────────────────────────► │
  │  ◄─────────────────────────────────────────────────┘ │
  │            HTTP 101 (WebSocket handshake)            │
  │                                                      │
  │            -----  WebSocket frames -----             │
  │  ─────────────────────────────────────────────────►  │
  │                         2probe                       │ (ping packet)
  │  ◄─────────────────────────────────────────────────  │
  │                         3probe                       │ (pong packet)
  │  ─────────────────────────────────────────────────►  │
  │                         5                            │ (upgrade packet)
  │                                                      │
```

### Message

Once the [handshake](#handshake) is completed, the client and the server can exchange data by including it in a `message` packet.


## Packet encoding

The serialization of an Engine.IO packet depends on the type of the payload (plaintext or binary) and on the transport.

The character encoding is UTF-8 for plain text and for base64-encoded binary payloads.

### HTTP long-polling

Due to the nature of the HTTP long-polling transport, multiple packets might be concatenated in a single payload in order to increase throughput.

Format:

```
<packet type>[<data>]<separator><packet type>[<data>]<separator><packet type>[<data>][...]
```

Example:

```
4hello\x1e2\x1e4world

with:

4      => message packet type
hello  => message payload
\x1e   => separator
2      => ping packet type
\x1e   => separator
4      => message packet type
world  => message payload
```

The packets are separated by the [record separator character](https://en.wikipedia.org/wiki/C0_and_C1_control_codes#Field_separators): `\x1e`

Binary payloads MUST be base64-encoded and prefixed with a `b` character:

Example:

```
4hello\x1ebAQIDBA==

with:

4         => message packet type
hello     => message payload
\x1e      => separator
b         => binary prefix
AQIDBA==  => buffer <01 02 03 04> encoded as base64
```

The client SHOULD use the `maxPayload` value sent during the [handshake](#handshake) to decide how many packets should be concatenated.

### WebSocket

Each Engine.IO packet is sent in its own [WebSocket frame](https://datatracker.ietf.org/doc/html/rfc6455#section-5).

Format:

```
<packet type>[<data>]
```

Example:

```
4hello

with:

4      => message packet type
hello  => message payload (UTF-8 encoded)
```

Binary payloads are sent as is, without modification.

## History

### From v2 to v3

- add support for binary data

The [2nd version](https://github.com/socketio/engine.io-protocol/tree/v2) of the protocol is used in Socket.IO `v0.9` and below.

The [3rd version](https://github.com/socketio/engine.io-protocol/tree/v3) of the protocol is used in Socket.IO `v1` and `v2`.

### From v3 to v4

- reverse ping/pong mechanism

The ping packets are now sent by the server, because the timers set in the browsers are not reliable enough. We
suspect that a lot of timeout problems came from timers being delayed on the client-side.

- always use base64 when encoding a payload with binary data

This change allows to treat all payloads (with or without binary) the same way, without having to take in account
whether the client or the current transport supports binary data or not.

Please note that this only applies to HTTP long-polling. Binary data is sent in WebSocket frames with no additional transformation.

- use a record separator (`\x1e`) instead of counting of characters

Counting characters prevented (or at least makes harder) to implement the protocol in other languages, which may not use
the UTF-16 encoding.

For example, `€` was encoded to `2:4€`, though `Buffer.byteLength('€') === 3`.

Note: this assumes the record separator is not used in the data.

The 4th version (current) is included in Socket.IO `v3` and above.

## Test suite

The test suite in the `test-suite/` directory lets you check the compliance of a server implementation.

Usage:

- in Node.js: `npm ci && npm test`
- in a browser: simply open the `index.html` file in your browser

For reference, here is expected configuration for the JavaScript server to pass all tests:

```js
import { listen } from "engine.io";

const server = listen(3000, {
  pingInterval: 300,
  pingTimeout: 200,
  maxPayload: 1e6,
  cors: {
    origin: "*"
  }
});

server.on("connection", socket => {
  socket.on("data", (...args) => {
    socket.send(...args);
  });
});
```
