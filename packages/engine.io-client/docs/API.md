<h1>API</h1>

**Table of Contents**

<!-- TOC -->
  * [Socket](#socket)
    * [Properties](#properties)
    * [Events](#events)
    * [Methods](#methods)
  * [Transport](#transport)
    * [Events](#events-1)
<!-- TOC -->

## Socket

The client class. Mixes in [Emitter](http://github.com/component/emitter).
Exposed as `eio` in the browser standalone build.

### Properties

- `protocol` _(Number)_: protocol revision number
- `binaryType` _(String)_ : can be set to 'arraybuffer' or 'blob' in browsers,
  and `buffer` or `arraybuffer` in Node. Blob is only used in browser if it's
  supported.

### Events

- `open`
  - Fired upon successful connection.
- `message`
  - Fired when data is received from the server.
  - **Arguments**
    - `String` | `ArrayBuffer`: utf-8 encoded data or ArrayBuffer containing
      binary data
- `close`
  - Fired upon disconnection. In compliance with the WebSocket API spec, this event may be
    fired even if the `open` event does not occur (i.e. due to connection error or `close()`).
- `error`
  - Fired when an error occurs.
- `flush`
  - Fired upon completing a buffer flush
- `drain`
  - Fired after `drain` event of transport if writeBuffer is empty
- `upgradeError`
  - Fired if an error occurs with a transport we're trying to upgrade to.
- `upgrade`
  - Fired upon upgrade success, after the new transport is set
- `ping`
  - Fired upon receiving a ping packet.
- `pong`
  - Fired upon _flushing_ a pong packet (ie: actual packet write out)

### Methods

- **constructor**
  - Initializes the client
  - **Parameters**
    - `String` uri
    - `Object`: optional, options object
  - **Options**
    - `agent` (`http.Agent`): `http.Agent` to use, defaults to `false` (NodeJS only)
    - `upgrade` (`Boolean`): defaults to true, whether the client should try
      to upgrade the transport from long-polling to something better.
    - `forceBase64` (`Boolean`): forces base 64 encoding for polling transport even when XHR2 responseType is available and WebSocket even if the used standard supports binary.
    - `withCredentials` (`Boolean`): defaults to `false`, whether to include credentials (cookies, authorization headers, TLS client certificates, etc.) with cross-origin XHR polling requests.
    - `timestampRequests` (`Boolean`): whether to add the timestamp with each
      transport request. Note: polling requests are always stamped unless this
      option is explicitly set to `false` (`false`)
    - `timestampParam` (`String`): timestamp parameter (`t`)
    - `path` (`String`): path to connect to, default is `/engine.io`
    - `transports` (`Array`): a list of transports to try (in order).
      Defaults to `['polling', 'websocket', 'webtransport']`. `Engine`
      always attempts to connect directly with the first one, provided the
      feature detection test for it passes.
    - `transportOptions` (`Object`): hash of options, indexed by transport name, overriding the common options for the given transport
    - `rememberUpgrade` (`Boolean`): defaults to false.
      If true and if the previous websocket connection to the server succeeded,
      the connection attempt will bypass the normal upgrade process and will initially
      try websocket. A connection attempt following a transport error will use the
      normal upgrade process. It is recommended you turn this on only when using
      SSL/TLS connections, or if you know that your network does not block websockets.
    - `pfx` (`String`|`Buffer`): Certificate, Private key and CA certificates to use for SSL. Can be used in Node.js client environment to manually specify certificate information.
    - `key` (`String`): Private key to use for SSL. Can be used in Node.js client environment to manually specify certificate information.
    - `passphrase` (`String`): A string of passphrase for the private key or pfx. Can be used in Node.js client environment to manually specify certificate information.
    - `cert` (`String`): Public x509 certificate to use. Can be used in Node.js client environment to manually specify certificate information.
    - `ca` (`String`|`Array`): An authority certificate or array of authority certificates to check the remote host against.. Can be used in Node.js client environment to manually specify certificate information.
    - `ciphers` (`String`): A string describing the ciphers to use or exclude. Consult the [cipher format list](http://www.openssl.org/docs/apps/ciphers.html#CIPHER_LIST_FORMAT) for details on the format. Can be used in Node.js client environment to manually specify certificate information.
    - `rejectUnauthorized` (`Boolean`): If true, the server certificate is verified against the list of supplied CAs. An 'error' event is emitted if verification fails. Verification happens at the connection level, before the HTTP request is sent. Can be used in Node.js client environment to manually specify certificate information.
    - `perMessageDeflate` (`Object|Boolean`): parameters of the WebSocket permessage-deflate extension
      (see [ws module](https://github.com/einaros/ws) api docs). Set to `false` to disable. (`true`)
      - `threshold` (`Number`): data is compressed only if the byte size is above this value. This option is ignored on the browser. (`1024`)
    - `extraHeaders` (`Object`): Headers that will be passed for each request to the server (via xhr-polling and via websockets). These values then can be used during handshake or for special proxies. Can only be used in Node.js client environment.
    - `localAddress` (`String`): the local IP address to connect to
    - `autoUnref` (`Boolean`): whether the transport should be `unref`'d upon creation. This calls `unref` on the underlying timers and sockets so that the program is allowed to exit if they are the only timers/sockets in the event system (Node.js only)
    - `useNativeTimers` (`Boolean`): Whether to always use the native timeouts. This allows the client to reconnect when the native timeout functions are overridden, such as when mock clocks are installed with [`@sinonjs/fake-timers`](https://github.com/sinonjs/fake-timers).
  - **Polling-only options**
    - `requestTimeout` (`Number`): Timeout for xhr-polling requests in milliseconds (`0`)
  - **Websocket-only options**
    - `protocols` (`Array`): a list of subprotocols (see [MDN reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#Subprotocols))
    - `closeOnBeforeunload` (`Boolean`): whether to silently close the connection when the [`beforeunload`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) event is emitted in the browser (defaults to `false`)
- `send`
  - Sends a message to the server
  - **Parameters**
    - `String` | `ArrayBuffer` | `ArrayBufferView` | `Blob`: data to send
    - `Object`: optional, options object
    - `Function`: optional, callback upon `drain`
  - **Options**
    - `compress` (`Boolean`): whether to compress sending data. This option is ignored and forced to be `true` on the browser. (`true`)
- `close`
  - Disconnects the client.

## Transport

The transport class. Private. _Inherits from EventEmitter_.

### Events

- `poll`: emitted by polling transports upon starting a new request
- `pollComplete`: emitted by polling transports upon completing a request
- `drain`: emitted by polling transports upon a buffer drain
