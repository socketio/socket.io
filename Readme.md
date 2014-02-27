
# socket.io-protocol

  This document describes the Socket.IO protocol. For a reference JavaScript
  implementation, take a look at
  [socket.io-parser](https://github.com/learnboost/socket.io-parser),
  [socket.io-client](https://github.com/learnboost/socket.io-client)
  and [socket.io](https://github.com/learnboost/socket.io).

## Protocol version

  **Current protocol revision:** `3`.

## Parser API

### Parser#encode(Object:packet):Array

  Encodes a `Packet` object into an array of engine.io-transportable encodings.
  If the object is all JSON the array will contain a single string. If the object
  contains binary data (ArrayBuffer, Buffer, Blob, or File) the array will contain
  one string with the packet metadata and placeholders in the JSON where the binary
  data was, and the raw binary data for each binary instance in the packet as
  a separate entry.

### Parser#decode(String:packet):Packet

  Returns a `Packet` object for the given string. If a parsing error occurs
  the returned packet is an error object. If the returned packet's type is
  `Packet#BINARY_EVENT`, the next data to arrive will be raw binary, and a
  `Parser#BinaryReconstructor` should be created from it.

### Parser#BinaryReconstructor(Packet:packet):BinaryReconstructor

  Object that handles reconstruction of a `Packet` with binary data. Should
  be constructed whenever a packet of type `Packet#BINARY_EVENT` is returned
  from `Parser#decode`.

#### BinaryReconstructor#takeBinaryData(Binary:binData):null|Packet

  Should be called whenever raw binary data is received from transport after
  the reception of a packet of type `Packet#BINARY_EVENT`. Will return null
  if the reconstructor expects more binary data from the transport, or the fully
  reconstructed packet with binary data if all of the expected binary data has
  been received. Essentially this should be called with all incoming binary data
  until it returns non-null, in which case the packet has been fully reconstructed
  and the BinaryReconstructor can be discarded.

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
  - `Packet#BINARY_EVENT` (`5`)

#### EVENT

  - `data` (`Array`) a list of arguments, the first of which is the event
    name. Arguments can contain any type of field that can result of 
    `JSON` decoding, including objects and arrays of arbitrary size.

  - `id` (`Number`) if the `id` identifier is present, it indicates that the
    server wishes to be acknowledged of the reception of this event.

#### BINARY_EVENT

  - `data` (`Array`) see `EVENT` `data`, but with addition that any of the arguments
    may contain non-JSON arbitrary binary data. On server, all binary data is a Buffer;
    on modern clients binary data is an ArrayBuffer. On older browsers that don't
    support binary, every binary data item is replaced with an object like so:
    `{base64: true, data: <the_binary_data_encoded_as_base64>}. When a BINARY_EVENT
    packet is initially decoded, all of the binary data items will be placeholders,
    and should be filled by a `Parser#BinaryReconstructor` as binary data arrives
    via transport.

  - `id` (`Number`) see `EVENT` `id`.

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
