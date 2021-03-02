# Engine.IO Protocol

This document describes the Engine.IO protocol. For a reference JavaScript
implementation, take a look at
[engine.io-parser](https://github.com/socketio/engine.io-parser),
[engine.io-client](https://github.com/socketio/engine.io-client)
and [engine.io](https://github.com/socketio/engine.io).

Table of Contents:

- [Revision](#revision)
- [Anatomy of an Engine.IO session](#anatomy-of-an-engineio-session)
  - [Sample session](#sample-session)
  - [Sample session with WebSocket only](#sample-session-with-websocket-only)
- [URLs](#urls)
- [Encoding](#encoding)
    - [Packet](#packet)
        - [0 open](#0-open)
        - [1 close](#1-close)
        - [2 ping](#2-ping)
        - [3 pong](#3-pong)
        - [4 message](#4-message)
        - [5 upgrade](#5-upgrade)
        - [6 noop](#6-noop)
    - [Payload](#payload)
- [Transports](#transports)
    - [Polling](#polling)
        - [XHR](#xhr)
        - [JSONP](#jsonp)
    - [Server-sent events](#server-sent-events)
    - [WebSocket](#websocket)
- [Transport upgrading](#transport-upgrading)
- [Timeouts](#timeouts)
- [Difference between v3 and v4](#difference-between-v3-and-v4)
- [Difference between v2 and v3](#difference-between-v2-and-v3)

## Revision

This is revision **4** of the Engine.IO protocol.

The revision 2 can be found here: https://github.com/socketio/engine.io-protocol/tree/v2

The revision 3 can be found here: https://github.com/socketio/engine.io-protocol/tree/v3

## Anatomy of an Engine.IO session

1. Transport establishes a connection to the Engine.IO URL.
2. Server responds with an `open` packet with JSON-encoded handshake data:
  - `sid` session id (`String`)
  - `upgrades` possible transport upgrades (`Array` of `String`)
  - `pingTimeout` server configured ping timeout, used for the client
    to detect that the server is unresponsive (`Number`)
  - `pingInterval` server configured ping interval, used for the client
    to detect that the server is unresponsive (`Number`)
3. Client must respond to periodic `ping` packets sent by the server
with `pong` packets.
4. Client and server can exchange `message` packets at will.
5. Polling transports can send a `close` packet to close the socket, since
they're expected to be "opening" and "closing" all the time.

### Sample session

- Request n°1 (open packet)

```
GET /engine.io/?EIO=4&transport=polling&t=N8hyd6w
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
0{"sid":"lv_VI97HAXpY6yYWAAAC","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":5000}
```

Details:

```
0           => "open" packet type
{"sid":...  => the handshake data
```

Note: the `t` query param is used to ensure that the request is not cached by the browser.

- Request n°2 (message in):

`socket.send('hey')` is executed on the server:

```
GET /engine.io/?EIO=4&transport=polling&t=N8hyd7H&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
4hey
```

Details:

```
4           => "message" packet type
hey         => the actual message
```

Note: the `sid` query param contains the sid sent in the handshake.

- Request n°3 (message out)

`socket.send('hello'); socket.send('world');` is executed on the client:

```
POST /engine.io/?EIO=4&transport=polling&t=N8hzxke&sid=lv_VI97HAXpY6yYWAAAC
> Content-Type: text/plain; charset=UTF-8
4hello\x1e4world
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=UTF-8
ok
```

Details:

```
4           => "message" packet type
hello       => the 1st message
\x1e        => separator
4           => "message" message type
world       => the 2nd message
```

- Request n°4 (WebSocket upgrade)

```
GET /engine.io/?EIO=4&transport=websocket&sid=lv_VI97HAXpY6yYWAAAC
< HTTP/1.1 101 Switching Protocols
```

WebSocket frames:

```
< 2probe    => probe request
> 3probe    => probe response
> 5         => "upgrade" packet type
> 4hello    => message (not concatenated)
> 4world
> 2         => "ping" packet type
< 3         => "pong" packet type
> 1         => "close" packet type
```

### Sample session with WebSocket only

In that case, the client only enables WebSocket (without HTTP polling).

```
GET /engine.io/?EIO=4&transport=websocket
< HTTP/1.1 101 Switching Protocols
```

WebSocket frames:

```
< 0{"sid":"lv_VI97HAXpY6yYWAAAC","pingInterval":25000,"pingTimeout":5000} => handshake
< 4hey
> 4hello    => message (not concatenated)
> 4world
< 2         => "ping" packet type
> 3         => "pong" packet type
> 1         => "close" packet type
```


## URLs

An Engine.IO url is composed as follows:

```
/engine.io/[?<query string>]
```

- The `engine.io` pathname should only be changed by higher-level
  frameworks whose protocol sits on top of engine's.

- The query string is optional and has six reserved keys:

  - `transport`: indicates the transport name. Supported ones by default are
    `polling`, `websocket`.
  - `j`: if the transport is `polling` but a JSONP response is required, `j`
    must be set with the JSONP response index.
  - `sid`: if the client has been given a session id, it must be included
    in the querystring.
  - `EIO`: the version of the protocol
  - `t`: a hashed-timestamp used for cache-busting

*FAQ:* Is the `/engine.io` portion modifiable?

Provided the server is customized to intercept requests under a different
path segment, yes.

*FAQ:* What determines whether an option is going to be part of the path
versus being encoded as part of the query string? In other words, why
is the `transport` not part of the URL?

It's convention that the path segments remain *only* that which allows to
disambiguate whether a request should be handled by a given Engine.IO
server instance or not. As it stands, it's only the Engine.IO prefix
(`/engine.io`) and the resource (`default` by default).

## Encoding

There's two distinct types of encodings

- packet
- payload

### Packet

An encoded packet can be UTF-8 string or binary data. The packet encoding format for a string is as follows

```
<packet type id>[<data>]
```
example:
```
4hello
```

For binary data the packet type is not included, since only "message" packet type can include binary.

#### 0 open

Sent from the server when a new transport is opened (recheck)

#### 1 close

Request the close of this transport but does not shutdown the connection itself.

#### 2 ping

Sent by the server. Client should answer with a pong packet.

example
1. server sends: ```2```
2. client sends: ```3```

#### 3 pong

Sent by the client to respond to ping packets.

#### 4 message

actual message, client and server should call their callbacks with the data.

##### example 1

1. server sends: ```4HelloWorld```
2. client receives and calls callback ```socket.on('message', function (data) { console.log(data); });```

##### example 2

1. client sends: ```4HelloWorld```
2. server receives and calls callback ```socket.on('message', function (data) { console.log(data); });```

#### 5 upgrade

Before engine.io switches a transport, it tests, if server and client can communicate over this transport.
If this test succeed, the client sends an upgrade packets which requests the server to flush its cache on
the old transport and switch to the new transport.

#### 6 noop

A noop packet. Used primarily to force a poll cycle when an incoming websocket connection is received.

##### example
1. client connects through new transport
2. client sends ```2probe```
3. server receives and sends ```3probe```
4. client receives and sends ```5```
5. server flushes and closes old transport and switches to new.

### Payload

A payload is a series of encoded packets tied together. The payload encoding format is as follows when only strings are sent and XHR2 is not supported:

```
<packet1>\x1e<packet2>\x1e<packet3>
```

The packets are separated by the record separator ('\x1e'). More info here: https://en.wikipedia.org/wiki/C0_and_C1_control_codes#Field_separators

When binary data is included in the payload, it is sent as base64 encoded strings. For the purposes of decoding, an
identifier `b` is put before a packet encoding that contains binary data. A combination of any number of strings and
base64 encoded strings can be sent. Here is an example of base 64 encoded messages:

```
<packet1>\x1eb<packet2 data in b64>[...]
```

The payload is used for transports which do not support framing, as the polling protocol for example.

- Example without binary:

```
[
  {
    "type": "message",
    "data": "hello"
  },
  {
    "type": "message",
    "data": "€"
  }
]
```

is encoded to:

```
4hello\x1e4€
```

- Example with binary:

```
[
  {
    "type": "message",
    "data": "€"
  },
  {
    "type": "message",
    "data": buffer <01 02 03 04>
  }
]
```

is encoded to:

```
4€\x1ebAQIDBA==

with

4           => "message" packet type
€
\x1e        => record separator
b           => indicates a base64 packet
AQIDBA==    => buffer content encoded in base64
```

## Transports

An engine.io server must support three transports:

- websocket
- server-sent events (SSE)
- polling
  - jsonp
  - xhr

### Polling

The polling transport consists of recurring GET requests by the client
to the server to get data, and POST requests with payloads from the
client to the server to send data.

#### XHR

The server must support CORS responses.

#### JSONP

The server implementation must respond with valid JavaScript. The URL
contains a query string parameter `j` that must be used in the response.
`j` is an integer.

The format of a JSONP packet.

```
`___eio[` <j> `]("` <encoded payload> `");`
```

To ensure that the payload gets processed correctly, it must be escaped
in such a way that the response is still valid JavaScript. Passing the
encoded payload through a JSON encoder is a good way to escape it.

Example JSONP frame returned by the server:

```
___eio[4]("packet data");
```

##### Posting data

The client posts data through a hidden iframe. The data gets to the server
in the URI encoded format as follows:

```
d=<escaped packet payload>
```

In addition to the regular qs escaping, in order to prevent
inconsistencies with `\n` handling by browsers, `\n` gets escaped as `\\n`
prior to being POSTd.

### Server-sent events

The client uses an EventSource object for receiving data, and an XMLHttpRequest object for sending data.

### WebSocket

Encoding payloads _should not_ be used for WebSocket, as the protocol
already has a lightweight framing mechanism.

In order to send a payload of messages, encode packets individually
and `send()` them in succession.

## Transport upgrading

A connection always starts with polling (either XHR or JSONP). WebSocket
gets tested on the side by sending a probe. If the probe is responded
from the server, an upgrade packet is sent.

To ensure no messages are lost, the upgrade packet will only be sent
once all the buffers of the existing transport are flushed and the
transport is considered _paused_.

When the server receives the upgrade packet, it must assume this is the
new transport channel and send all existing buffers (if any) to it.

The probe sent by the client is a `ping` packet with `probe` sent as data.
The probe sent by the server is a `pong` packet with `probe` sent as data.

Moving forward, upgrades other than just `polling -> x` are being considered.

## Timeouts

The client must use the `pingTimeout` and the `pingInterval` sent as part
of the handshake (with the `open` packet) to determine whether the server
is unresponsive.

The server sends a `ping` packet. If no packet type is received within
`pingTimeout`, the server considers the socket disconnected. If a `pong`
packet is actually received, the server will wait `pingInterval` before
sending a `ping` packet again.

Since the two values are shared between the server and the client, the client
will also be able to detect whether the server becomes unresponsive when it
does not receive any data within `pingTimeout + pingInterval`.

## Difference between v3 and v4

- reverse ping/pong mechanism

The ping packets will now be sent by the server, because the timers set in the browsers are not reliable enough. We
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

The revision 4 of the protocol will be included in Socket.IO v3.

## Difference between v2 and v3

- add support for binary data

v2 is included in Socket.IO v0.9, while v3 is included in Socket.IO v1/v2.
