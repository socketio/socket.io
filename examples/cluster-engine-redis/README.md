# Example with `@socket.io/cluster-engine` and Redis

## How to use

```bash
# start the redis server
$ docker compose up -d

# run the server
$ node server.js

# run the client
$ node client.js
```

## Explanation

The `server.js` script will create 3 Socket.IO servers, each listening on a distinct port (`3001`, `3002` and `3003`), and a proxy server listening on port `3000` which randomly redirects to one of those servers.

With the default engine (provided by the `engine.io` package), sticky sessions would be required, so that each HTTP request of the same Engine.IO session reaches the same server.

The `RedisEngine` is a custom engine which takes care of the synchronization between the servers by using [Redis pub/sub](https://redis.io/docs/latest/develop/interact/pubsub/) and removes the need for sticky sessions when scaling horizontally.
