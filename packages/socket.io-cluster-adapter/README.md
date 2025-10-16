# Socket.IO cluster adapter

The `@socket.io/cluster-adapter` package allows broadcasting packets between multiple Socket.IO servers.

![Adapter diagram](./assets/adapter.png)

It can be used in conjunction with [`@socket.io/sticky`](https://github.com/socketio/socket.io-sticky) to broadcast packets between the workers of the same Node.js [cluster](https://nodejs.org/api/cluster.html).

Supported features:

- [broadcasting](https://socket.io/docs/v4/broadcasting-events/)
- [utility methods](https://socket.io/docs/v4/server-instance/#Utility-methods)
  - [`socketsJoin`](https://socket.io/docs/v4/server-instance/#socketsJoin)
  - [`socketsLeave`](https://socket.io/docs/v4/server-instance/#socketsLeave)
  - [`disconnectSockets`](https://socket.io/docs/v4/server-instance/#disconnectSockets)
  - [`fetchSockets`](https://socket.io/docs/v4/server-instance/#fetchSockets)
  - [`serverSideEmit`](https://socket.io/docs/v4/server-instance/#serverSideEmit)

Related packages:

- Postgres adapter: https://github.com/socketio/socket.io-postgres-adapter/
- Redis adapter: https://github.com/socketio/socket.io-redis-adapter/
- MongoDB adapter: https://github.com/socketio/socket.io-mongo-adapter/

**Table of contents**

- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Installation

```
npm install @socket.io/cluster-adapter
```

## Usage

```js
const cluster = require("cluster");
const http = require("http");
const { Server } = require("socket.io");
const numCPUs = require("os").cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  const httpServer = http.createServer();

  // setup sticky sessions
  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  // setup connections between the workers
  setupPrimary();

  // needed for packets containing buffers (you can ignore it if you only send plaintext objects)
  // Node.js < 16.0.0
  cluster.setupMaster({
    serialization: "advanced",
  });
  // Node.js > 16.0.0
  // cluster.setupPrimary({
  //   serialization: "advanced",
  // });

  httpServer.listen(3000);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  console.log(`Worker ${process.pid} started`);

  const httpServer = http.createServer();
  const io = new Server(httpServer);

  // use the cluster adapter
  io.adapter(createAdapter());

  // setup connection with the primary process
  setupWorker(io);

  io.on("connection", (socket) => {
    /* ... */
  });
}
```

## License

[MIT](LICENSE)
