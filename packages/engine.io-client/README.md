<h1>Engine.IO client</h1>

[![Build Status](https://github.com/socketio/socket.io/actions/workflows/ci-engine.io-client.yml/badge.svg)](https://github.com/socketio/socket.io/actions/workflows/ci-engine.io-client.yml)
[![NPM version](https://badge.fury.io/js/engine.io-client.svg)](https://www.npmjs.com/package/engine.io-client)

Engine.IO is the low-level realtime engine behind [Socket.IO](https://socket.io/).

It provides a reliable, bidirectional communication layer between a Node.js server and a client, using HTTP long-polling first and upgrading to better transports when possible, such as WebSocket or WebTransport.

**Table of Contents**

<!-- TOC -->
  * [Features](#features)
  * [Installation](#installation)
  * [Usage](#usage)
  * [API](#api)
  * [License](#license)
<!-- TOC -->

## Features

- Reliable realtime communication across browsers, networks, proxies, and load balancers
- Automatic transport upgrade from HTTP long-polling to WebSocket or WebTransport
- Binary data support (ArrayBuffer, Blob, etc.)
- Optional HTTP compression and WebSocket per-message deflate
- Custom request authorization (e.g., query parameters, headers)
- Cookie support for sticky sessions
- Works in Node.js and browser environments
- TypeScript definitions included

## Installation

```bash
npm install engine.io-client
```

## Usage

```js
import { Socket } from "engine.io-client";

const socket = new Socket("ws://localhost:8080");

socket.on("open", () => {
  socket.send("hello");
});

socket.on("message", (data) => {
  console.log("received:", data);
});
```

## API

See the [API documentation](https://github.com/socketio/socket.io/blob/main/packages/engine.io-client/docs/API.md) for the full list of available options, methods, events, and properties.

## License

[MIT](https://github.com/socketio/socket.io/blob/main/packages/engine.io-client/LICENSE)
