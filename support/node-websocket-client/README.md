A prototype [Web Socket](http://www.whatwg.org/specs/web-socket-protocol/)
client implementation for [node.js](http://nodejs.org).

Tested with
[miksago/node-websocket-server](http://github.com/miksago/node-websocket-server)
v1.2.00.

Requires [nodejs](http://nodejs.org) 0.1.98 or later.

## Installation

Install this using `npm` as follows

    npm install websocket-client

... or just dump `lib/websocket.js` in your `$NODE_PATH`.

## Usage

    var sys = require('sys');
    var WebSocket = require('websocket').WebSocket;

    var ws = new WebSocket('ws://localhost:8000/biff', 'borf');
    ws.addListener('data', function(buf) {
        sys.debug('Got data: ' + sys.inspect(buf));
    });
    ws.onmessage = function(m) {
        sys.debug('Got message: ' + m);
    }

## API

This supports the `send()` and `onmessage()` APIs. The `WebSocket` object will
also emit `data` events that are node `Buffer` objects, in case you want to
work with something lower-level than strings.

## Transports

Multiple transports are supported, indicated by the scheme provided to the
`WebSocket` constructor. `ws://` is a standard TCP-based Web Socket;
`ws+unix://` allows connection to a UNIX socket at the given path.
