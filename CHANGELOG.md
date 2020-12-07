## [3.0.4](https://github.com/socketio/socket.io-client/compare/3.0.3...3.0.4) (2020-12-07)


### Bug Fixes

* emit an error when reaching a v2.x server ([ec1f8c3](https://github.com/socketio/socket.io-client/commit/ec1f8c3474b54600420487a0554cb195cc78f2bc)), closes [/github.com/socketio/engine.io-protocol#difference-between-v3-and-v4](https://github.com//github.com/socketio/engine.io-protocol/issues/difference-between-v3-and-v4) [/github.com/socketio/socket.io-protocol#difference-between-v5-and-v4](https://github.com//github.com/socketio/socket.io-protocol/issues/difference-between-v5-and-v4)
* keep track of active sockets ([f8f60fc](https://github.com/socketio/socket.io-client/commit/f8f60fc860f51aa6465fc32dd9275a8e1d22f05d))
* **typings:** export extraHeaders option ([#1410](https://github.com/socketio/socket.io-client/issues/1410)) ([b3de861](https://github.com/socketio/socket.io-client/commit/b3de861a928c0eb5f0b2f37956c671e72432715d))


## [3.0.3](https://github.com/socketio/socket.io-client/compare/3.0.2...3.0.3) (2020-11-19)


### Bug Fixes

* properly export io in ES modules wrapper ([bec1524](https://github.com/socketio/socket.io-client/commit/bec15240ea67e9d296ac94093974d7d831239e8d))


## [3.0.2](https://github.com/socketio/socket.io-client/compare/3.0.1...3.0.2) (2020-11-17)


### Bug Fixes

* **typings:** export withCredentials option ([7193078](https://github.com/socketio/socket.io-client/commit/719307801a2170f02d3a16ab52752ac219ca4b6e))
* **typings:** export ManagerOptions ([#1398](https://github.com/socketio/socket.io-client/issues/1398)) ([96cd2c9](https://github.com/socketio/socket.io-client/commit/96cd2c9ae4c48f9d2e6638ab26074277a3a6cf6b))
* add io as named exports ([7b3ec9f](https://github.com/socketio/socket.io-client/commit/7b3ec9fad9df9d2f030f644a26fcd642bf2a91ab))


## [3.0.1](https://github.com/socketio/socket.io-client/compare/3.0.0...3.0.1) (2020-11-09)


### Bug Fixes

* **typings:** export Socket and SocketOptions types ([#1394](https://github.com/socketio/socket.io-client/issues/1394)) ([19ab1e9](https://github.com/socketio/socket.io-client/commit/19ab1e9e4e1373d4ef4dad5381c8ae24167f5d89))


# [3.0.0](https://github.com/socketio/socket.io-client/compare/2.3.1...3.0.0) (2020-11-05)

### Code Refactoring

* rename ERROR to CONNECT_ERROR ([13e1db7](https://github.com/socketio/socket.io-client/commit/13e1db7c94291c583d843beaa9e06ee041ae4f26))

### Features

* emit an Error object upon middleware error ([0939395](https://github.com/socketio/socket.io-client/commit/09393952e3397a0c71f239ea983f8ec1623b7c21))
* add bundle with msgpack parser ([71d6048](https://github.com/socketio/socket.io-client/commit/71d60480af9ea06d22792540dafb18a76e9362e7))
* add support for catch-all listeners ([55f464f](https://github.com/socketio/socket.io-client/commit/55f464f59ed523fa1c1948ec10752bfdf808262d))
* add volatile events ([7ddad2c](https://github.com/socketio/socket.io-client/commit/7ddad2c09dea0391b20378ef03b40040f0230d3e))
* move binary detection back to the parser ([1789094](https://github.com/socketio/socket.io-client/commit/178909471a3dd232e71cba83b729b4cc66f1412f))
* add ES6 module export ([cbabb03](https://github.com/socketio/socket.io-client/commit/cbabb0308ef4f7d302654755e08fe2103b9f22c8))
* do not reuse the Engine.IO id ([bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d))
* remove the implicit connection to the default namespace ([249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8))
* split the events of the Manager and Socket ([132f8ec](https://github.com/socketio/socket.io-client/commit/132f8ec918a596eec872aee0c61d4ce63714c400))
* throw upon reserved event names ([6494f61](https://github.com/socketio/socket.io-client/commit/6494f61be0d38d267d77c30ea4f43941f97b1bc0))

### BREAKING CHANGES

* the Socket instance will now emit a "connect_error" event instead of "error" (which is not a reserved event anymore)

```js
// before
socket.on("error", () => {});

// after
socket.on("connect_error", () => {});
```

* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.

* the Socket instance will no longer forward the events of its Manager

Those events can still be accessed on the Manager instance though:

```js
socket.io.on("reconnect", () => {
  // ...
});
```

# [3.0.0-rc4](https://github.com/socketio/socket.io-client/compare/3.0.0-rc3...3.0.0-rc4) (2020-10-30)


### Features

* emit an Error object upon middleware error ([0939395](https://github.com/socketio/socket.io-client/commit/09393952e3397a0c71f239ea983f8ec1623b7c21))



# [3.0.0-rc3](https://github.com/socketio/socket.io-client/compare/3.0.0-rc2...3.0.0-rc3) (2020-10-26)


### Code Refactoring

* rename ERROR to CONNECT_ERROR ([13e1db7](https://github.com/socketio/socket.io-client/commit/13e1db7c94291c583d843beaa9e06ee041ae4f26))


### Features

* add bundle with msgpack parser ([71d6048](https://github.com/socketio/socket.io-client/commit/71d60480af9ea06d22792540dafb18a76e9362e7))
* add support for catch-all listeners ([55f464f](https://github.com/socketio/socket.io-client/commit/55f464f59ed523fa1c1948ec10752bfdf808262d))
* add volatile events ([7ddad2c](https://github.com/socketio/socket.io-client/commit/7ddad2c09dea0391b20378ef03b40040f0230d3e))


### BREAKING CHANGES

* the Socket instance will now emit a "connect_error" event instead of "error" (which is not a reserved event anymore)

```js
// before
socket.on("error", () => {});

// after
socket.on("connect_error", () => {});
```



# [3.0.0-rc2](https://github.com/socketio/socket.io-client/compare/3.0.0-rc1...3.0.0-rc2) (2020-10-15)


### Features

* move binary detection back to the parser ([1789094](https://github.com/socketio/socket.io-client/commit/178909471a3dd232e71cba83b729b4cc66f1412f))


### BREAKING CHANGES

* the Socket#binary() method is removed, as this use case is now covered by the ability to provide your own parser.



# [3.0.0-rc1](https://github.com/socketio/socket.io-client/compare/2.3.1...3.0.0-rc1) (2020-10-13)


### Features

* add ES6 module export ([cbabb03](https://github.com/socketio/socket.io-client/commit/cbabb0308ef4f7d302654755e08fe2103b9f22c8))
* do not reuse the Engine.IO id ([bbe94ad](https://github.com/socketio/socket.io-client/commit/bbe94adb822a306c6272e977d394e3e203cae25d))
* remove the implicit connection to the default namespace ([249e0be](https://github.com/socketio/socket.io-client/commit/249e0bef9071e7afd785485961c4eef0094254e8))
* split the events of the Manager and Socket ([132f8ec](https://github.com/socketio/socket.io-client/commit/132f8ec918a596eec872aee0c61d4ce63714c400))
* throw upon reserved event names ([6494f61](https://github.com/socketio/socket.io-client/commit/6494f61be0d38d267d77c30ea4f43941f97b1bc0))


### BREAKING CHANGES

* the Socket instance will no longer forward the events of its Manager

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

