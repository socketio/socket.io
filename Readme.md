
# socket.io-protocol

  [![Build Status](https://secure.travis-ci.org/LearnBoost/socket.io-protocol.png)](http://travis-ci.org/LearnBoost/socket.io-protocol)

  This repository contains the protocol specification and JavaScript
  parser for the Socket.IO protocol.

## Protocol version

  **Current protocol revision:** `1`.

## Parser API

### Parser#encode(Object:packet):String

  Encodes a `Packet` object as a string.

### Parser#decode(String:packet):Packet

  Returns a `Packet` object for the given string. If a parsing error
  occurs the returned packet is an error object.

### Parser#types

  Array of packet type keys.

### Packet

  Each packet is represented as a vanilla `Object` with a `nsp` key that
  indicates what namespace it belongs to (see "Multiplexing") and a 
  `type` key that can be one of the following:

  - `Packet#CONNECT` (`0`)
  - `Packet#DISCONNECT` (`1`)
  - `Packet#EVENT` (`2`)
  - `Packet#ACK` (`3`)
  - `Packet#ERROR` (`4`)

#### EVENT

  - `data` (`Array`) a list of arguments, the first of which is the event
    name. Arguments can contain any type of field that can result of 
    `JSON` decoding, including objects and arrays of arbitrary size.

  - `id` (`Number`) if the `id` identifier is present, it indicates that the
    server wishes to be acknowledged of the reception of this event.

#### ACK

  - `data` (`Array`) see `EVENT` `data`.
  - `id` (`Number`) see `EVENT` `id`.

#### ERROR

  - `data` (`Mixed`) error data

## Transport

  The socket.io protocol can be delivered over a variety of transports.
  [socket.io-client](http://github.com/learnboost/socket.io-client)
  is the implementation of the protocol for the browser and Node.JS over
  [engine.io-client](http://github.com/learnboost/engine.io-client).

  [socket.io](http://github.com/learnboost/socket.io) is the server
  implementation of the protocol over
  [engine.io](http://github.com/learnboost/engine.io).

## Multiplexing

  Socket.IO has built-in multiplexing support, which means that each packet
  always belongs to a given `namespace`, identified by a path string (like
  `/this`). The corresponding key in the `Packet` object is `nsp`.

  When the socket.io transport connection is established, a connection
  attempt to the `/` namespace is assumed (ie: the server behaves as if
  the client had sent a `CONNECT` packet to the `/` namespace).

  In order to support multiplexing of multiple sockets under
  the same transport, additional `CONNECT` packets can be sent by the
  client to arbitrary namespace URIs (eg: `/another`).

  When the server responds with a `CONNECT` packet to the corresponding
  namespace, the multiplexed socket is considered connected.

  Alternatively, the server can respond with an `ERROR` packet to indicate
  a multiplexed socket connection error, such as authentication errors.
  The associated error payload varies according to each error, and can
  be user-defined.

  After a `CONNECT` packet is received by the server for a given `nsp`,
  the client can then send and receive `EVENT` packets. If any of the 
  parties receives an `EVENT` packet with an `id` field, an `ACK` packet is
  expected to confirm the reception of said packet.

## License

MIT
