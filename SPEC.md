# Engine.IO SPEC

## Revision

This is revision **1** of the Engine.IO protocol.

## Anatomy of an Engine.IO session

1. Transport establishes a connection to the Engine.IO URL .
2. Server responds with an `open` packet with JSON-encoded handshake data:
  - `sid` session id (`String`)
  - `upgrades` possible transport upgrades (`Array` of `String`)
  - `pingTimeout` server configured ping timeout, used for the client
    to detect that the server is unresponsive (`Number`)
3. Client must respond to periodic `ping` packets sent by the server
with `pong` packets.
4. Client and server can exchange `message` packets at will.
5. Polling transports can send a `close` packet to close the socket, since
they're expected to be "opening" and "closing" all the time.

## URLs

An Engine.IO url is composed as follows:

`/engine.io/` [ ? <query string> ]

- The `engine.io` pathname should only be changed by higher-level
  frameworks whose protocol sits on top of engine's.

- The query string is optional and has three reserved keys:

  - `transport`: indicates the transport name. Supported ones by default are
    `polling`, `flashsocket`, `websocket`.
  - `j`: if the transport is `polling` but a JSONP response is required, `j`
    must be set with the JSONP response index.
  - `sid`: if the client has been given a session id, it must be included
    in the querystring.

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

An encoded packet is a UTF-8 string. The packet encoding format is as follows

```
<packet type id>[<data>]
```
example:
```
2probe
```
The packet type id is an integer. The following are the accepted packet
types.

#### 0 open

Sent from the server when a new transport is opened (recheck)

#### 1 close

Request the close of this transport but does not shutdown the connection itself.

#### 2 ping

send by the server. Client should answer with a pong packets, containing the same data

example
1. server sends: ```2probe```
2. client sends: ```3probe```

#### 3 pong

send by the client to respond to ping packets.

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

A payload is a series of encoded packets tied together. The payload encoding format is as follows:

```
<length1>:<packet1>[<length2>:<packet2>[...]]
```
* length: length of the packet in __characters__
* packet: actual packets as descriped above

The payload is used for transports which do not support framing, as the polling protocol for example.

## Transports

An engine.io server must support three transports:

- websocket
- flashsocket
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

The client must use the `pingTimeout` sent as part of the handshake (with
the `open` packet) to determine whether the server is unresponsive.

If no packet type is received withing `pingTimeout`, the client considers
the socket disconnected.
