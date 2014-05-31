
# socket.io-protocol

  This document describes the Socket.IO protocol. For a reference JavaScript
  implementation, take a look at
  [socket.io-parser](https://github.com/learnboost/socket.io-parser),
  [socket.io-client](https://github.com/learnboost/socket.io-client)
  and [socket.io](https://github.com/learnboost/socket.io).

## Protocol version

  **Current protocol revision:** `4`.

## Parser API

### Parser#Encoder

  An object that encodes socket.io packets to engine.io-transportable form.
  Its only public method is Encoder#encode.

#### Encoder#encode(Object:packet, Function:callback)

  Encodes a `Packet` object into an array of engine.io-compatible encodings.
  If the object is pure JSON the array will contain a single item, a socket.io
  encoded string. If the object contains binary data (ArrayBuffer, Buffer,
  Blob, or File) the array's first item will be a string with packet-relevant
  metadata and JSON with placeholders where the binary data was held in the
  initial packet. The remaining items will be the raw binary data to fill in
  the placeholders post-decoding.

  The callback function is called with the encoded array as its only argument.
  In the socket.io-parser implementation, the callback writes each item in the
  array to engine.io for transport. The expectation for any implementation is
  that each item in the array is transported sequentially.

### Parser#Decoder

  An object that decodes data from engine.io into complete socket.io packets.

  The expected workflow for using the Decoder is to call the `Decoder#add`
  method upon receiving any encoding from engine.io (in the sequential order in
  which the encodings are received) and to listen to the Decoder's 'decoded'
  events to handle fully decoded packets.

#### Decoder#add(Object:encoding)

  Decodes a single encoded object from engine.io transport. In the case of a
  non-binary packet, the one encoding argument is used to reconstruct the full
  packet. If the packet is of type `BINARY_EVENT` or `ACK`, then additional calls
  to add are expected, one for each piece of binary data in the original packet.
  Once the final binary data encoding is passed to add, the full socket.io
  packet is reconstructed.

  After a packet is fully decoded, the Decoder emits a 'decoded' event (via
  Emitter) with the decoded packet as the sole argument. Listeners to this event
  should treat the packet as ready-to-go.

#### Decoder#destroy()

  Deallocates the Decoder instance's resources. Should be called in the event
  of a disconnect mid-decoding, etc. to prevent memory leaks.

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
  - `Packet#BINARY_ACK` (`6`)

#### EVENT

  - `data` (`Array`) a list of arguments, the first of which is the event
    name. Arguments can contain any type of field that can result of
    `JSON` decoding, including objects and arrays of arbitrary size.

  - `id` (`Number`) if the `id` identifier is present, it indicates that the
    server wishes to be acknowledged of the reception of this event.

#### BINARY_EVENT

  - `data` (`Array`) see `EVENT` `data`, but with addition that any of the arguments
    may contain non-JSON arbitrary binary data. For encoding, binary data is
    considered either a Buffer, ArrayBuffer, Blob, or File. When decoding, all
    binary data server-side is a Buffer; on modern clients binary data is an
    ArrayBuffer. On older browsers that don't support binary, every binary data
    item is replaced with an object like so:
`{base64: true, data: <base64_bin_encoding>}`. When a `BINARY_EVENT` or `ACK`
    packet is initially decoded, all of the binary data items will be placeholders,
    and will be filled by additional calls to `Decoder#add`.

  - `id` (`Number`) see `EVENT` `id`.

#### ACK

  - `data` (`Array`) see `EVENT` `data`. Encoded as string like the `EVENT` type above.
    Should be used when an ACK function is not called with binary data.
  - `id` (`Number`) see `EVENT` `id`.

#### BINARY_ACK

  - `data` (`Array`) see `ACK` `data`. Used when the arguments for an ACK
    function contain binary data; encodes packet in the `BINARY_EVENT` style
    documented above.
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
