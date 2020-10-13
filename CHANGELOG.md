# [3.0.0-rc1](https://github.com/socketio/socket.io-client/compare/2.3.1...3.0.0-rc1) (2020-10-13)


### Features

* add ES6 module export ([cbabb03](https://github.com/socketio/socket.io-client/commit/cbabb0308ef4f7d302654755e08fe2103b9f22c8))
* do not reuse the Engine.IO id ([bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d))
* remove the implicit connection to the default namespace ([249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8))
* split the events of the Manager and Socket ([132f8ec](https://github.com/socketio/socket.io-client/commit/132f8ec918a596eec872aee0c61d4ce63714c400))
* throw upon reserved event names ([6494f61](https://github.com/socketio/socket.io-client/commit/6494f61be0d38d267d77c30ea4f43941f97b1bc0))


### BREAKING CHANGES

* the Socket instance will no longer forward the events
of its Manager

Those events can still be accessed on the Manager instance though:

```js
socket.io.on("reconnect", () => {
  // ...
});
```


## [2.3.1](https://github.com/socketio/socket.io-client/compare/2.3.0...2.3.1) (2020-09-30)

The `debug` dependency has been reverted to `~3.1.0`, as the newer versions contains ES6 syntax which breaks in IE
browsers.

Please note that this only applied to users that bundle the Socket.IO client in their application, with webpack for
example, as the "official" bundles (in the dist/ folder) were already transpiled with babel.

For webpack users, you can also take a look at the [webpack-remove-debug](https://github.com/johngodley/webpack-remove-debug)
plugin.

### Bug Fixes

* fix reconnection after opening socket asynchronously ([#1253](https://github.com/socketio/socket.io-client/issues/1253)) ([050108b](https://github.com/socketio/socket.io-client/commit/050108b2281effda086b197cf174ee2e8e1aad79))

