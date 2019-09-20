
# Socket.IO custom parsers

Since Socket.IO version 2.0.0, you can provide your custom parser, according to the needs of your application.

Several parsers are showcased here:

- the default one: [socket.io-parser](https://github.com/socketio/socket.io-parser)
- one based on msgpack: [socket.io-msgpack-parser](https://github.com/darrachequesne/socket.io-msgpack-parser)
- one based on native JSON: [socket.io-json-parser](https://github.com/darrachequesne/socket.io-json-parser)
- a custom one based on [schemapack](https://github.com/phretaddin/schemapack)

They are tested with various payloads:

- string: `['1', '2', ... '1000']`
- numeric: `[1, 2, ... 1000]`
- binary: `Buffer.allocUnsafe(1000), where buf[i] = i`

## How to use

```
$ npm i && npm start
```

## Results

| bytes / packet | CONNECT packet | string | numeric | binary    |
|----------------|----------------|--------|---------|-----------|
| default        | 1              | 5903   | 3904    | 43 + 1000 |
| msgpack        | 20             | 3919   | 2646    | 1029      |
| JSON           | 20             | 5930   | 3931    | 3625      |
| schemapack     | 20             | 3895   | 2005    | 1005      |

## Comparison

`default parser`
- supports any serializable datastructure, including Blob and File
- **but** binary payload is encoded as 2 packets

`msgpack`
- the size of payloads containing mostly numeric values will be greatly reduced
- **but** rely on [ArrayBuffer](https://caniuse.com/#feat=typedarrays) in the browser (IE > 9)

`JSON`
- optimized
- **but** does not support binary payloads

`schemapack`
- the most efficient in both speed and size
- **but** you have to provide a schema for each packet
