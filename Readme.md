
# socket.io-protocol

  This document describes the Socket.IO protocol. For a reference JavaScript
  implementation, take a look at
  [socket.io-parser](https://github.com/socketio/socket.io-parser),
  [socket.io-client](https://github.com/socketio/socket.io-client)
  and [socket.io](https://github.com/socketio/socket.io).

## Table of Contents

- [Protocol version](#protocol-version)
- [Packet format](#packet-format)
  - [Packet types](#packet-types)
    - [CONNECT](#0---connect)
    - [DISCONNECT](#1---disconnect)
    - [EVENT](#2---event)
    - [ACK](#3---ack)
    - [ERROR](#4---error)
    - [BINARY_EVENT](#5---binary_event)
    - [BINARY_ACK](#6---binary_ack)
- [Packet encoding](#packet-encoding)
  - [Encoding format](#encoding-format)
  - [Examples](#examples)
- [Exchange protocol](#exchange-protocol)
  - [Connection to the default namespace](#connection-to-the-default-namespace)
  - [Connection to a non-default namespace](#connection-to-a-non-default-namespace)
  - [Disconnection from a non-default namespace](#disconnection-from-a-non-default-namespace)
  - [Acknowledgement](#acknowledgement)

## Protocol version

This is the revision **4** of the Socket.IO protocol.

It is built on top of the [3rd](https://github.com/socketio/engine.io-protocol/tree/v3) revision of the Engine.IO
protocol.

While the Engine.IO protocol describes the low-level plumbing with WebSocket and HTTP long-polling, the Socket.IO
protocol adds another layer above in order to provide the following features:

- multiplexing (what we call [Namespace](https://socket.io/docs/namespaces/))

Example of the Javascript API:

```js
// server-side
const nsp = io.of("/admin");
nsp.on("connect", socket => {});

// client-side
const socket1 = io(); // default namespace
const socket2 = io("/admin");
socket2.on("connect", () => {});
```

- acknowledgement of packets

Example of the Javascript API:

```js
// on one side
socket.emit("hello", 1, () => { console.log("received"); });
// on the other side
socket.on("hello", (a, cb) => { cb(); });
```

## Packet format

A packet contains the following fields:

- a type (integer, see [below](#packet-types))
- a namespace (string)
- optionally, a payload (string | Array)
- optionally, an acknowledgment id (integer)

## Packet types

### 0 - CONNECT

This event is sent:

- by the client when requesting access to a namespace
- by the server when accepting the connection to a namespace

It does not contain any payload nor acknowledgement id.

Example:

```json
{
  "type": 0,
  "nsp": "/admin"
}
```

The client may include additional information (i.e. for authentication purpose) in the namespace field. Example:

```json
{
  "type": 0,
  "nsp": "/admin?token=1234&uid=abcd"
}
```

#### 1 - DISCONNECT

This event is used when one side wants to disconnect from a namespace.

It does not contain any payload nor acknowledgement id.

Example:

```json
{
  "type": 1,
  "nsp": "/admin"
}
```

#### 2 - EVENT

This event is used when one side wants to transmit some data (without binary) to the other side.

It does contain a payload, and an optional acknowledgement id.

Example:

```json
{
  "type": 2,
  "nsp": "/",
  "data": ["hello", 1]
}
```

With an acknowledgment id:

```json
{
  "type": 2,
  "nsp": "/admin",
  "data": ["project:delete", 123],
  "id": 456
}
```

#### 3 - ACK

This event is used when one side has received an EVENT or a BINARY_EVENT with an acknowledgement id.

It contains the acknowledgement id received in the previous packet, and may contain a payload (without binary).

```json
{
  "type": 3,
  "nsp": "/admin",
  "data": [],
  "id": 456
}
```

#### 4 - ERROR

This event is sent by the server when the connection to a namespace is refused.

It may contain a payload indicating the reason of the refusal.

Example:

```json
{
  "type": 4,
  "nsp": "/admin",
  "data": "Not authorized"
}
```

#### 5 - BINARY_EVENT

This event is used when one side wants to transmit some data (including binary) to the other side.

It does contain a payload, and an optional acknowledgement id.

Example:

```
{
  "type": 5,
  "nsp": "/",
  "data": ["hello", <Buffer 01 02 03>]
}
```

With an acknowledgment id:

```
{
  "type": 5,
  "nsp": "/admin",
  "data": ["project:delete", <Buffer 01 02 03>],
  "id": 456
}
```

#### 6 - BINARY_ACK

This event is used when one side has received an EVENT or a BINARY_EVENT with an acknowledgement id.

It contains the acknowledgement id received in the previous packet, and contain a payload including binary.

Example:

```
{
  "type": 6,
  "nsp": "/admin",
  "data": [<Buffer 03 02 01>],
  "id": 456
}
```

## Packet encoding

This section details the encoding used by the default parser which is included in Socket.IO server and client, and
whose source can be found [here](https://github.com/socketio/socket.io-parser).

The JS server and client implementations also supports custom parsers, which have different tradeoffs and may benefit to
certain kind of applications. Please see [socket.io-json-parser](https://github.com/darrachequesne/socket.io-json-parser)
or [socket.io-msgpack-parser](https://github.com/darrachequesne/socket.io-msgpack-parser) for example.

Please also note that each Socket.IO packet is sent as a Engine.IO `message` packet (more information [here](https://github.com/socketio/engine.io-protocol)),
so the encoded result will be prefixed by `4` when sent over the wire (in the request/response body with HTTP
long-polling, or in the WebSocket frame).

### Encoding format

```
<packet type>[<# of binary attachments>-][<namespace>,][<acknowledgment id>][JSON-stringified payload without binary]

+ binary attachments extracted
```

Note:

- the namespace is only included if it is different from the default namespace (`/`)

### Examples

- `CONNECT` packet for the default namespace

```json
{
  "type": 0,
  "nsp": "/"
}
```

is encoded to `0`

- `CONNECT` packet for the `/admin` namespace

```json
{
  "type": 0,
  "nsp": "/admin"
}
```

is encoded to `0/admin`

- `DISCONNECT` packet for the `/admin` namespace

```json
{
  "type": 1,
  "nsp": "/admin"
}
```

is encoded to `1/admin`

- `EVENT` packet

```json
{
  "type": 2,
  "nsp": "/",
  "data": ["hello", 1]
}
```

is encoded to `2["hello",1]`

- `EVENT` packet with an acknowledgement id

```json
{
  "type": 2,
  "nsp": "/admin",
  "data": ["project:delete", 123],
  "id": 456
}
```

is encoded to `2/admin,456["project:delete",123]`

- `ACK` packet

```json
{
  "type": 3,
  "nsp": "/admin",
  "data": [],
  "id": 456
}
```

is encoded to `3/admin,456[]`

- `ERROR` packet

```json
{
  "type": 4,
  "nsp": "/admin",
  "data": "Not authorized"
}
```

is encoded to `4/admin,"Not authorized"`

- `BINARY_EVENT` packet

```
{
  "type": 5,
  "nsp": "/",
  "data": ["hello", <Buffer 01 02 03>]
}
```

is encoded to `51-["hello",{"_placeholder":true,"num":0}]` + `<Buffer 01 02 03>`

- `BINARY_EVENT` packet with an acknowledgement id

```
{
  "type": 5,
  "nsp": "/admin",
  "data": ["project:delete", <Buffer 01 02 03>],
  "id": 456
}
```

is encoded to `51-/admin,456["project:delete",{"_placeholder":true,"num":0}]` + `<Buffer 01 02 03>`

- `BINARY_ACK` packet

```
{
  "type": 6,
  "nsp": "/admin",
  "data": [<Buffer 03 02 01>],
  "id": 456
}
```

is encoded to `61-/admin,456[{"_placeholder":true,"num":0}]` + `<Buffer 03 02 01>`


## Exchange protocol

### Connection to the default namespace

The server always send a `CONNECT` packet for the default namespace (`/`) when the connection is established.

That is, even if the client requests access to a non-default namespace, it will receive a `CONNECT` packet for the
default namespace first.

```
Server > { type: CONNECT, nsp: "/" }
```

No response is expected from the client.

### Connection to a non-default namespace

```
Client > { type: CONNECT, nsp: "/admin" }
Server > { type: CONNECT, nsp: "/admin" } (if the connection is successful)
or
Server > { type: ERROR, nsp: "/admin", data: "Not authorized" }
```

### Disconnection from a non-default namespace

```
Client > { type: DISCONNECT, nsp: "/admin" }
```

And vice versa. No response is expected from the other-side.

### Acknowledgement

```
Client > { type: EVENT, nsp: "/admin", data: ["hello"], id: 456 }
Server > { type: ACK, nsp: "/admin", data: [], id: 456 }
or
Server > { type: BINARY_ACK, nsp: "/admin", data: [ <Buffer 01 02 03> ], id: 456 }
```

And vice versa.

## License

MIT
