# History

- [0.2.2](#022-2023-03-24) (Mar 2023)
- [0.2.1](#021-2022-10-13) (Oct 2022)
- [0.2.0](#020-2022-04-28) (Apr 2022)
- [0.1.0](#010-2021-06-22) (Jun 2021)



# Release notes

## [0.2.2](https://github.com/socketio/socket.io-cluster-adapter/compare/0.2.1...0.2.2) (2023-03-24)

The `socket.io-adapter` package was added to the list of `peerDependencies`, in order to fix sync issues with the version imported by the socket.io package (see [15fd56e](https://github.com/socketio/socket.io-cluster-adapter/commit/15fd56e78d52aa65c5fbf412dec57ab4bdaee7cc)).

Support for connection state recovery (see [here](https://github.com/socketio/socket.io/releases/4.6.0)) will be added in the next release.



## [0.2.1](https://github.com/socketio/socket.io-cluster-adapter/compare/0.2.0...0.2.1) (2022-10-13)


### Bug Fixes

* properly handle ERR_IPC_CHANNEL_CLOSED errors ([#6](https://github.com/socketio/socket.io-cluster-adapter/issues/6)) ([be0a0e3](https://github.com/socketio/socket.io-cluster-adapter/commit/be0a0e3217bd7100d569e5624194612bcc8b96ff))



## [0.2.0](https://github.com/socketio/socket.io-cluster-adapter/compare/0.1.0...0.2.0) (2022-04-28)


### Features

* broadcast and expect multiple acks ([055b784](https://github.com/socketio/socket.io-cluster-adapter/commit/055b7840d8cf88173d8299041ef3fafa9791c97a))

This feature was added in `socket.io@4.5.0`:

```js
io.timeout(1000).emit("some-event", (err, responses) => {
  // ...
});
```

Thanks to this change, it will now work within a Node.js cluster.



## 0.1.0 (2021-06-22)

Initial commit

