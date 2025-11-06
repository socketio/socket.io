# Socket.IO Redis Streams emitter

The `@socket.io/redis-streams-emitter` package allows you to easily communicate with a group of Socket.IO servers from another Node.js process (server-side).

It must be used in conjunction with [`@socket.io/redis-streams-adapter`](https://github.com/socketio/socket.io-redis-streams-adapter).

**Table of contents**

<!-- TOC -->
  * [Installation](#installation)
  * [Usage](#usage)
    * [With the `redis` package](#with-the-redis-package)
    * [With the `redis` package and a Redis cluster](#with-the-redis-package-and-a-redis-cluster)
    * [With the `ioredis` package](#with-the-ioredis-package)
    * [With the `ioredis` package and a Redis cluster](#with-the-ioredis-package-and-a-redis-cluster)
  * [Options](#options)
  * [API](#api)
    * [`Emitter(redisClient[, nsp][, opts])`](#emitterredisclient-nsp-opts)
    * [`Emitter#to(room:string):BroadcastOperator`](#emittertoroomstringbroadcastoperator)
    * [`Emitter#in(room:string):BroadcastOperator`](#emitterinroomstringbroadcastoperator)
    * [`Emitter#except(room:string):BroadcastOperator`](#emitterexceptroomstringbroadcastoperator)
    * [`Emitter#of(namespace:string):Emitter`](#emitterofnamespacestringemitter)
    * [`Emitter#socketsJoin(rooms:string|string[])`](#emittersocketsjoinroomsstringstring)
    * [`Emitter#socketsLeave(rooms:string|string[])`](#emittersocketsleaveroomsstringstring)
    * [`Emitter#disconnectSockets(close:boolean)`](#emitterdisconnectsocketscloseboolean)
    * [`Emitter#serverSideEmit(ev:string[,...args:any[]])`](#emitterserversideemitevstringargsany)
  * [License](#license)
<!-- TOC -->

## Installation

```
npm install @socket.io/redis-streams-emitter redis
```

## Usage

### With the `redis` package

```js
import { createClient } from "redis";
import { Emitter } from "@socket.io/redis-streams-emitter";

const redisClient = createClient({
  url: "redis://localhost:6379"
});

await redisClient.connect();

const io = new Emitter(redisClient);

setInterval(() => {
  io.emit("ping", new Date());
}, 1000);
```

### With the `redis` package and a Redis cluster

```js
import { createCluster } from "redis";
import { Emitter } from "@socket.io/redis-streams-emitter";

const redisClient = createCluster({
  rootNodes: [
    {
      url: "redis://localhost:7000",
    },
    {
      url: "redis://localhost:7001",
    },
    {
      url: "redis://localhost:7002",
    },
  ],
});

await redisClient.connect();

const io = new Emitter(redisClient);

setInterval(() => {
  io.emit("ping", new Date());
}, 1000);
```

### With the `ioredis` package

```js
import { Redis } from "ioredis";
import { Emitter } from "@socket.io/redis-streams-emitter";

const redisClient = new Redis();

const io = new Emitter(redisClient);

setInterval(() => {
  io.emit("ping", new Date());
}, 1000);
```

### With the `ioredis` package and a Redis cluster

```js
import { Cluster } from "ioredis";
import { Emitter } from "@socket.io/redis-streams-emitter";

const redisClient = new Cluster([
  {
    host: "localhost",
    port: 7000,
  },
  {
    host: "localhost",
    port: 7001,
  },
  {
    host: "localhost",
    port: 7002,
  },
]);

const io = new Emitter(redisClient);

setInterval(() => {
  io.emit("ping", new Date());
}, 1000);
```

## Options

| Name         | Description                                                        | Default value |
|--------------|--------------------------------------------------------------------|---------------|
| `streamName` | The name of the Redis stream.                                      | `socket.io`   |
| `maxLen`     | The maximum size of the stream. Almost exact trimming (~) is used. | `10_000`      |

## API

### `Emitter(redisClient[, nsp][, opts])`

```js
const io = new Emitter(redisClient);
```

### `Emitter#to(room:string):BroadcastOperator`
### `Emitter#in(room:string):BroadcastOperator`

Specifies a specific `room` that you want to emit to.

```js
io.to("room1").emit("hello");
```

### `Emitter#except(room:string):BroadcastOperator`

Specifies a specific `room` that you want to exclude from broadcasting.

```js
io.except("room2").emit("hello");
```

### `Emitter#of(namespace:string):Emitter`

Specifies a specific namespace that you want to emit to.

```js
const customNamespace = io.of("/custom");

customNamespace.emit("hello");
```

### `Emitter#socketsJoin(rooms:string|string[])`

Makes the matching socket instances join the specified rooms:

```js
// make all Socket instances join the "room1" room
io.socketsJoin("room1");

// make all Socket instances of the "admin" namespace in the "room1" room join the "room2" room
io.of("/admin").in("room1").socketsJoin("room2");
```

### `Emitter#socketsLeave(rooms:string|string[])`

Makes the matching socket instances leave the specified rooms:

```js
// make all Socket instances leave the "room1" room
io.socketsLeave("room1");

// make all Socket instances of the "admin" namespace in the "room1" room leave the "room2" room
io.of("/admin").in("room1").socketsLeave("room2");
```

### `Emitter#disconnectSockets(close:boolean)`

Makes the matching socket instances disconnect:

```js
// make all Socket instances disconnect
io.disconnectSockets();

// make all Socket instances of the "admin" namespace in the "room1" room disconnect
io.of("/admin").in("room1").disconnectSockets();

// this also works with a single socket ID
io.of("/admin").in(theSocketId).disconnectSockets();
```

### `Emitter#serverSideEmit(ev:string[,...args:any[]])`

Emits an event that will be received by each Socket.IO server of the cluster.

```js
io.serverSideEmit("ping");
```

## License

[MIT](./LICENSE)
