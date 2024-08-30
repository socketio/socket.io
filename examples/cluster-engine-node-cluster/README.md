# Example with `@socket.io/cluster-engine` and Node.js cluster

## How to use

```bash
# run the server
$ node server.js

# run the client
$ node client.js
```

## Explanation

The `server.js` script will create one Socket.IO server per core, each listening on the same port (`3000`).

With the default engine (provided by the `engine.io` package), sticky sessions would be required, so that each HTTP request of the same Engine.IO session reaches the same worker.

The `NodeClusterEngine` is a custom engine which takes care of the synchronization between the servers by using [the IPC channel](https://nodejs.org/api/cluster.html#workersendmessage-sendhandle-options-callback) and removes the need for sticky sessions when scaling horizontally.
