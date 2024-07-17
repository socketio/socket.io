# Socket.IO cluster engine

A cluster-friendly engine to share load between multiple Node.js processes (without sticky sessions).

**Table of contents**

<!-- TOC -->
  * [Installation](#installation)
  * [Usage](#usage)
    * [Node.js cluster](#nodejs-cluster)
    * [Redis](#redis)
    * [Node.js cluster & Redis](#nodejs-cluster--redis)
  * [Options](#options)
  * [How it works](#how-it-works)
  * [License](#license)
<!-- TOC -->

## Installation

```
npm i @socket.io/cluster-engine
```

NPM: https://npmjs.com/package/@socket.io/cluster-engine

## Usage

### Node.js cluster

```js
import cluster from "node:cluster";
import process from "node:process";
import { availableParallelism } from "node:os";
import { setupPrimary, NodeClusterEngine } from "@socket.io/cluster-engine";
import { createServer } from "node:http";
import { Server } from "socket.io";

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  const numCPUs = availableParallelism();

  // fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // setup connection within the cluster
  setupPrimary();

  // needed for packets containing Buffer objects (you can ignore it if you only send plaintext objects)
  cluster.setupPrimary({
    serialization: "advanced",
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const httpServer = createServer((req, res) => {
    res.writeHead(404).end();
  });

  const engine = new NodeClusterEngine();

  engine.attach(httpServer, {
    path: "/socket.io/"
  });

  const io = new Server();

  io.bind(engine);

  // workers will share the same port
  httpServer.listen(3000);

  console.log(`Worker ${process.pid} started`);
}
```

### Redis

```js
import { createServer } from "node:http";
import { createClient } from "redis";
import { RedisEngine } from "@socket.io/cluster-engine";
import { Server } from "socket.io";

const httpServer = createServer((req, res) => {
  res.writeHead(404).end();
});

const pubClient = createClient();
const subClient = pubClient.duplicate();

await Promise.all([
  pubClient.connect(),
  subClient.connect(),
]);

const engine = new RedisEngine(pubClient, subClient);

engine.attach(httpServer, {
  path: "/socket.io/"
});

const io = new Server();

io.bind(engine);

httpServer.listen(3000);
```

### Node.js cluster & Redis

```js
import cluster from "node:cluster";
import process from "node:process";
import { availableParallelism } from "node:os";
import { createClient } from "redis";
import { setupPrimaryWithRedis, NodeClusterEngine } from "@socket.io/cluster-engine";
import { createServer } from "node:http";
import { Server } from "socket.io";

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  const numCPUs = availableParallelism();

  // fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  const pubClient = createClient();
  const subClient = pubClient.duplicate();

  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  // setup connection between and within the clusters
  setupPrimaryWithRedis(pubClient, subClient);

  // needed for packets containing Buffer objects (you can ignore it if you only send plaintext objects)
  cluster.setupPrimary({
    serialization: "advanced",
  });

  cluster.on("exit", (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const httpServer = createServer((req, res) => {
    res.writeHead(404).end();
  });

  const engine = new NodeClusterEngine();

  engine.attach(httpServer, {
    path: "/socket.io/"
  });

  const io = new Server();

  io.bind(engine);

  // workers will share the same port
  httpServer.listen(3000);

  console.log(`Worker ${process.pid} started`);
}
```

## Options

| Name                       | Description                                                           | Default value |
|----------------------------|-----------------------------------------------------------------------|---------------|
| `responseTimeout`          | The maximum waiting time for responses from other nodes, in ms.       | `1000 ms`     |
| `noopUpgradeInterval`      | The delay between two "noop" packets when the client upgrades, in ms. | `200 ms`      |
| `delayedConnectionTimeout` | The maximum waiting time for a successful upgrade, in ms.             | `300 ms`      |

## How it works

This engine extends the one provided by the `engine.io` package, so that sticky sessions are not required when scaling horizontally.

The Node.js workers communicate via the IPC channel (or via Redis pub/sub) to check whether the Engine.IO session exists on another worker. In that case, the packets are forwarded to the worker which owns the session.

Additionally, when a client starts with HTTP long-polling, the connection is delayed to allow the client to upgrade, so that the WebSocket connection ends up on the worker which owns the session.

## License

[MIT](LICENSE)
