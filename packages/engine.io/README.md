<h1>Engine.IO</h1>

[![Build Status](https://github.com/socketio/socket.io/actions/workflows/ci-engine.io.yml/badge.svg)](https://github.com/socketio/socket.io/actions/workflows/ci-engine.io.yml)
[![NPM version](https://badge.fury.io/js/engine.io.svg)](https://www.npmjs.com/package/engine.io)

Engine.IO is the low-level realtime engine behind [Socket.IO](https://socket.io/).

It provides a reliable, bidirectional communication layer between a Node.js server and a client, using HTTP long-polling first and upgrading to better transports when possible, such as WebSocket or WebTransport.

**Table of Contents**

<!-- TOC -->
  * [Features](#features)
  * [Installation](#installation)
  * [Usage](#usage)
    * [Basic](#basic)
    * [With an existing HTTP server](#with-an-existing-http-server)
    * [Manual request handling](#manual-request-handling)
  * [Client](#client)
  * [API](#api)
  * [License](#license)
<!-- TOC -->

## Features

- Reliable realtime communication across browsers, networks, proxies, and load balancers
- Automatic transport upgrade from HTTP long-polling to WebSocket or WebTransport
- Binary data support
- Optional HTTP compression and WebSocket per-message deflate
- Custom request authorization
- Sticky-session-friendly cookie support
- Node.js `http.Server` integration
- TypeScript definitions included

## Installation

```bash
npm install engine.io
```

## Usage

### Basic

```js
import { listen } from "engine.io";

const server = listen(8080, () => {
  console.log("listening on port 8080");
});

server.on("connection", (socket) => {
  socket.send("hello");

  socket.on("message", (data) => {
    console.log("received:", data);
  });

  socket.on("close", () => {
    console.log("connection closed");
  });
});
```

### With an existing HTTP server

```js
import { createServer } from "node:http";
import { Server } from "engine.io";

const httpServer = createServer();
const server = new Server(httpServer);

server.on("connection", (socket) => {
  // ...
});

httpServer.listen(8080, () => {
  console.log("listening on port 8080");
});
```

### Manual request handling

Use this approach when you want full control over how Engine.IO requests are routed.

```js
import { createServer } from "node:http";
import { Server } from "engine.io";

const httpServer = createServer();
const server = new Server();

httpServer.on("request", (req, res) => {
  server.handleRequest(req, res);
});

httpServer.on("upgrade", (req, socket, head) => {
  server.handleUpgrade(req, socket, head);
});

server.on("connection", (socket) => {
  // ...
});

httpServer.listen(8080, () => {
  console.log("listening on port 8080");
});
```

## Client

Engine.IO clients are provided by the [`engine.io-client`](https://www.npmjs.com/package/engine.io-client) package.

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

See the [API documentation](./docs/API.md) for the full list of available options, methods, events, and properties.

## License

MIT
