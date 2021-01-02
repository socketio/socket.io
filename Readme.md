
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
    - [CONNECT_ERROR](#4---connect_error)
    - [BINARY_EVENT](#5---binary_event)
    - [BINARY_ACK](#6---binary_ack)
- [Packet encoding](#packet-encoding)
  - [Encoding format](#encoding-format)
  - [Examples](#examples)
- [Exchange protocol](#exchange-protocol)
  - [Connection to a namespace](#connection-to-a-namespace)
  - [Disconnection from a namespace](#disconnection-from-a-namespace)
  - [Acknowledgement](#acknowledgement)
- [Sample session](#sample-session)
- [History](#history)
  - [Difference between v5 and v4](#difference-between-v5-and-v4)
  - [Difference between v4 and v3](#difference-between-v4-and-v3)
  - [Difference between v3 and v2](#difference-between-v3-and-v2)
  - [Difference between v2 and v1](#difference-between-v2-and-v1)
  - [Initial revision](#initial-revision)

## Protocol version

This is the revision **5** of the Socket.IO protocol, included in `socket.io@3.0.0...latest`.

The 4th revision (included in `socket.io@1.0.3...2.x.x`) can be found here: https://github.com/socketio/socket.io-protocol/tree/v4

The 3rd revision (included in `socket.io@1.0.0...1.0.2`) can be found here: https://github.com/socketio/socket.io-protocol/tree/v3

Both the 1st and the 2nd revisions were part of the work towards Socket.IO 1.0 but were never included in a Socket.IO
release.

It is built on top of the [4th](https://github.com/socketio/engine.io-protocol) revision of the Engine.IO protocol.

While the Engine.IO protocol describes the low-level plumbing with WebSocket and HTTP long-polling, the Socket.IO
protocol adds another layer above in order to provide the following features:

- multiplexing (what we call [Namespace](https://socket.io/docs/namespaces/))

Example of the Javascript API:

```js
// server-side
const nsp = io.of("/admin");
nsp.on("connect", socket => {});

// client-side
const socket1 = io(); // main namespace
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
- optionally, a payload (Object | Array)
- optionally, an acknowledgment id (integer)

## Packet types

### 0 - CONNECT

This event is sent:

- by the client when requesting access to a namespace

The client can send a payload for authentication/authorization purposes. Example:

```json
{
  "type": 0,
  "nsp": "/admin",
  "data": {
    "token": "123"
  }
}
```

- by the server when accepting the connection to a namespace

In case of success, the server responds with a payload contain the ID of the Socket. Example:

```json
{
  "type": 0,
  "nsp": "/admin",
  "data": {
    "sid": "CjdVH4TQvovi1VvgAC5Z"
  }
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

#### 4 - CONNECT_ERROR

This event is sent by the server when the connection to a namespace is refused.

It contains a payload with a "message" and an optional "data" fields.

Example:

```json
{
  "type": 4,
  "nsp": "/admin",
  "data": {
    "message": "Not authorized",
    "data": {
      "code": "E001",
      "label": "Invalid credentials"
    }
  }
}
```

#### 5 - BINARY_EVENT

Note: Both `BINARY_EVENT` and `BINARY_ACK` are used by the built-in parser, in order to make a distinction between packets that contain binary content and those which don't. They may not be used by other custom parsers.

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

- the namespace is only included if it is different from the main namespace (`/`)

### Examples

- `CONNECT` packet for the main namespace

```json
{
  "type": 0,
  "nsp": "/",
  "data": {
    "token": "123"
  }
}
```

is encoded to `0{"token":"123"}`

- `CONNECT` packet for the `/admin` namespace

```json
{
  "type": 0,
  "nsp": "/admin",
  "data": {
    "token": "123"
  }
}
```

is encoded to `0/admin,{"token":"123"}`

- `DISCONNECT` packet for the `/admin` namespace

```json
{
  "type": 1,
  "nsp": "/admin"
}
```

is encoded to `1/admin,`

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

- `CONNECT_ERROR` packet

```json
{
  "type": 4,
  "nsp": "/admin",
  "data": {
    "message": "Not authorized"
  }
}
```

is encoded to `4/admin,{"message":"Not authorized"}`

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

### Connection to a namespace

For each namespace (including the main namespace), the client first sends a CONNECT packet, and the server responds with a CONNECT packet containing the id of the Socket.

```
Client > { type: CONNECT, nsp: "/admin" }
Server > { type: CONNECT, nsp: "/admin", data: { sid: "wZX3oN0bSVIhsaknAAAI" } } (if the connection is successful)
or
Server > { type: CONNECT_ERROR, nsp: "/admin", data: { message: "Not authorized" } }
```

### Disconnection from a namespace

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

## Sample session

Here is an example of what is sent over the wire when combining both the Engine.IO and the Socket.IO protocols.

- Request n°1 (open packet)

```
GET /socket.io/?EIO=4&transport=polling&t=N8hyd6w
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
0{"sid":"lv_VI97HAXpY6yYWAAAC","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000}
```

Details:

```
0           => Engine.IO "open" packet type
{"sid":...  => the Engine.IO handshake data
```

Note: the `t` query param is used to ensure that the request is not cached by the browser.

- Request n°2 (namespace connection request):

```
POST /socket.io/?EIO=4&transport=polling&t=N8hyd7H&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
40
```

Details:

```
4           => Engine.IO "message" packet type
0           => Socket.IO "CONNECT" packet type
```

- Request n°3 (namespace connection approval)

```
GET /socket.io/?EIO=4&transport=polling&t=N8hyd7H&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
40{"sid":"wZX3oN0bSVIhsaknAAAI"}
```

- Request n°4

`socket.emit('hey', 'Jude')` is executed on the server:

```
GET /socket.io/?EIO=4&transport=polling&t=N8hyd7H&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
42["hey","Jude"]
```

Details:

```
4           => Engine.IO "message" packet type
2           => Socket.IO "EVENT" packet type
[...]       => content
```

- Request n°5 (message out)

`socket.emit('hello'); socket.emit('world');` is executed on the client:

```
POST /socket.io/?EIO=4&transport=polling&t=N8hzxke&sid=lv_VI97HAXpY6yYWAAAC
> Content-Type: text/plain; charset=UTF-8
42["hello"]\x1e42["world"]
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
ok
```

Details:

```
4           => Engine.IO "message" packet type
2           => Socket.IO "EVENT" packet type
["hello"]   => the 1st content
\x1e        => separator
4           => Engine.IO "message" packet type
2           => Socket.IO "EVENT" packet type
["world"]   => the 2nd content
```

- Request n°6 (WebSocket upgrade)

```
GET /socket.io/?EIO=4&transport=websocket&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 101 Switching Protocols
```

WebSocket frames:

```
< 2probe                                        => Engine.IO probe request
> 3probe                                        => Engine.IO probe response
> 5                                             => Engine.IO "upgrade" packet type
> 42["hello"]
> 42["world"]
> 40/admin,                                     => request access to the admin namespace (Socket.IO "CONNECT" packet)
< 40/admin,{"sid":"-G5j-67EZFp-q59rADQM"}       => grant access to the admin namespace
> 42/admin,1["tellme"]                          => Socket.IO "EVENT" packet with acknowledgement
< 461-/admin,1[{"_placeholder":true,"num":0}]   => Socket.IO "BINARY_ACK" packet with a placeholder
< <binary>                                      => the binary attachment (sent in the following frame)
... after a while without message
> 2                                             => Engine.IO "ping" packet type
< 3                                             => Engine.IO "pong" packet type
> 1                                             => Engine.IO "close" packet type
```

## History

### Difference between v5 and v4

- remove the implicit connection to the default namespace

In previous versions, a client was always connected to the default namespace, even if it requested access to another namespace.

This is not the case anymore, the client must send a `CONNECT` packet in any case.

Commits: [09b6f23](https://github.com/socketio/socket.io/commit/09b6f2333950b8afc8c1400b504b01ad757876bd) (server) and [249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8) (client)


- rename `ERROR` to `CONNECT_ERROR`

The meaning and the code number (4) are not modified: this packet type is still used by the server when the connection to a namespace is refused. But we feel the name is more self-descriptive.

Commits: [d16c035](https://github.com/socketio/socket.io/commit/d16c035d258b8deb138f71801cb5aeedcdb3f002) (server) and [13e1db7c](https://github.com/socketio/socket.io-client/commit/13e1db7c94291c583d843beaa9e06ee041ae4f26) (client).


- the `CONNECT` packet now can contain a payload

The client can send a payload for authentication/authorization purposes. Example:

```json
{
  "type": 0,
  "nsp": "/admin",
  "data": {
    "token": "123"
  }
}
```

In case of success, the server responds with a payload contain the ID of the Socket. Example:

```json
{
  "type": 0,
  "nsp": "/admin",
  "data": {
    "sid": "CjdVH4TQvovi1VvgAC5Z"
  }
}
```

This change means that the ID of the Socket.IO connection will now be different from the ID of the underlying Engine.IO connection (the one that is found in the query parameters of the HTTP requests).

Commits: [2875d2c](https://github.com/socketio/socket.io/commit/2875d2cfdfa463e64cb520099749f543bbc4eb15) (server) and [bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d) (client)


- the payload `CONNECT_ERROR` packet is now an object instead of a plain string

Commits: [54bf4a4](https://github.com/socketio/socket.io/commit/54bf4a44e9e896dfb64764ee7bd4e8823eb7dc7b) (server) and [0939395](https://github.com/socketio/socket.io-client/commit/09393952e3397a0c71f239ea983f8ec1623b7c21) (client)


### Difference between v4 and v3

- add a `BINARY_ACK` packet type

Previously, an `ACK` packet was always treated as if it may contain binary objects, with recursive search for such
objects, which could hurt performance.

### Difference between v3 and v2

- remove the usage of msgpack to encode packets containing binary objects (see also [299849b](https://github.com/socketio/socket.io-parser/commit/299849b00294c3bc95817572441f3aca8ffb1f65))

### Difference between v2 and v1

- add a `BINARY_EVENT` packet type

This was added during the work towards Socket.IO 1.0, in order to add support for binary objects. The `BINARY_EVENT`
packets were encoded with [msgpack](https://msgpack.org/).

### Initial revision

This first revision was the result of the split between the Engine.IO protocol (low-level plumbing with WebSocket / HTTP
long-polling, heartbeat) and the Socket.IO protocol. It was never included in a Socket.IO release, but paved the way for
the next iterations.

## License

MIT
