# [4.2.0](https://github.com/socketio/socket.io-client/compare/4.1.3...4.2.0) (2021-08-30)


### Bug Fixes

* **typings:** allow async listener in typed events ([66e00b7](https://github.com/socketio/socket.io-client/commit/66e00b7dd7c4a09072cfd84c78e6e15ec52039f5))
* allow to set randomizationFactor to 0 ([#1447](https://github.com/socketio/socket.io-client/issues/1447)) ([dfb46b5](https://github.com/socketio/socket.io-client/commit/dfb46b55a55d9c5b0397f4bc0fab9cec99ff430e))


### Features

* add an option to use native timer functions ([#1479](https://github.com/socketio/socket.io-client/issues/1479)) ([4e1b656](https://github.com/socketio/socket.io-client/commit/4e1b65699d9967a7bb409bdc89c894c62562771b))


## [4.1.3](https://github.com/socketio/socket.io-client/compare/4.1.2...4.1.3) (2021-07-10)


## [4.1.2](https://github.com/socketio/socket.io-client/compare/4.1.1...4.1.2) (2021-05-17)


### Bug Fixes

* **typings:** add missing closeOnBeforeunload option ([#1469](https://github.com/socketio/socket.io-client/issues/1469)) ([35d27df](https://github.com/socketio/socket.io-client/commit/35d27df2ae48046bfe3ae2e11f82004200095aae))
* **typings:** add missing requestTimeout option ([#1467](https://github.com/socketio/socket.io-client/issues/1467)) ([c8dfbb1](https://github.com/socketio/socket.io-client/commit/c8dfbb1c1d10aff16bc19cc1f1bab6b3a9240d81))


## [4.1.1](https://github.com/socketio/socket.io-client/compare/4.1.0...4.1.1) (2021-05-11)

There were some minor bug fixes on the server side, which mandate a client bump.


# [4.1.0](https://github.com/socketio/socket.io-client/compare/4.0.2...4.1.0) (2021-05-11)

### Features

* add the "closeOnBeforeunload" option ([dcb85e9](https://github.com/socketio/engine.io-client/commit/dcb85e902d129b2d1a94943b4f6d471532f70dc9), from `engine.io-client`)


## [4.0.2](https://github.com/socketio/socket.io-client/compare/4.0.1...4.0.2) (2021-05-06)


### Bug Fixes

* **typings:** add fallback to untyped event listener ([5394669](https://github.com/socketio/socket.io-client/commit/53946694882114957ef2187c532eb798fa811b60))
* ensure buffered events are sent in order ([34f822f](https://github.com/socketio/socket.io-client/commit/34f822f783c6985039c0733a96d1fab8f01b1edf))
* ensure connections are properly multiplexed ([dd2a8fc](https://github.com/socketio/socket.io-client/commit/dd2a8fce000a9b5b5d741489fc44eafd4ff6c75b))
* properly export the Socket class ([e20d487](https://github.com/socketio/socket.io-client/commit/e20d487ac080910c90e7b766f8509f5e40c9ecfe))


## [4.0.1](https://github.com/socketio/socket.io-client/compare/4.0.0...4.0.1) (2021-03-31)


### Bug Fixes

* **typings:** make `auth` property public ([#1455](https://github.com/socketio/socket.io-client/issues/1455)) ([c150223](https://github.com/socketio/socket.io-client/commit/c15022347c662dc31ee0a3d89cde23641f029783))
* **typings:** update definition to match wrapper.mjs ([#1456](https://github.com/socketio/socket.io-client/issues/1456)) ([48f573f](https://github.com/socketio/socket.io-client/commit/48f573f6f6c4d542e6a098e7f4ae472b888b5664))


# [4.0.0](https://github.com/socketio/socket.io-client/compare/3.1.2...4.0.0) (2021-03-10)

The major bump is due to some breaking changes on the server side.

### Bug Fixes

* **bundle:** restore support for JS modules ([43613d1](https://github.com/socketio/socket.io-client/commit/43613d1b2c3c04e89d572750656012f54d44467c))


### Features

* add autoUnref option ([6abfa1f](https://github.com/socketio/socket.io-client/commit/6abfa1fa4c7fea0d69c69b254d2e1ca18f19c4bc))
* add support for typed events ([5902365](https://github.com/socketio/socket.io-client/commit/59023657a02cf78f90522e0d7797749707ed5ed2))


## [3.1.2](https://github.com/socketio/socket.io-client/compare/3.1.1...3.1.2) (2021-02-26)


### Bug Fixes

* restore support for web workers ([13b32b3](https://github.com/socketio/socket.io-client/commit/13b32b39a4c1cf4829144fb0a95c4d0506000fb3))
* silently close the transport in the beforeunload hook ([ed48b5d](https://github.com/socketio/engine.io-client/commit/ed48b5dc3407e5ded45072606b3bb0eafa49c01f), from `engine.io-client`)


## [3.1.1](https://github.com/socketio/socket.io-client/compare/3.1.0...3.1.1) (2021-02-03)


### Bug Fixes

* include the path in the manager ID ([7a0c2b5](https://github.com/socketio/socket.io-client/commit/7a0c2b504f5f3bac64d423684fb1bb44229c7a70))
* remove polyfill for process in the bundle ([61afc5d](https://github.com/socketio/socket.io-client/commit/61afc5d8cb9f10985930b2f01758089c49f84686))
* **typings:** add return types and general-case overload signatures ([#1440](https://github.com/socketio/socket.io-client/issues/1440)) ([47f917a](https://github.com/socketio/socket.io-client/commit/47f917afdd1821079723542f081c726596f2aaf3))
* **typings:** fix the type of the "query" option ([#1439](https://github.com/socketio/socket.io-client/issues/1439)) ([f02ab3b](https://github.com/socketio/socket.io-client/commit/f02ab3bc9626133dd35aad0916325f0c7fc4da5d))


# [3.1.0](https://github.com/socketio/socket.io-client/compare/3.0.5...3.1.0) (2021-01-15)


### Bug Fixes

* **typings:** make Manager#opts public ([#1437](https://github.com/socketio/socket.io-client/issues/1437)) ([fe97243](https://github.com/socketio/socket.io-client/commit/fe97243fab02cd80fc1116e8f4aeca02951dac75))
* allow integers as event names ([1c220dd](https://github.com/socketio/socket.io-parser/commit/1c220ddbf45ea4b44bc8dbf6f9ae245f672ba1b9))


## [3.0.5](https://github.com/socketio/socket.io-client/compare/3.0.4...3.0.5) (2021-01-05)


### Bug Fixes

* emit a connect_error event upon connection failure ([53c7374](https://github.com/socketio/socket.io-client/commit/53c73749a829b2c98d9a5e45c48f0ae5a22c056c))
* **typings:** make sendBuffer and receiveBuffer public ([b83f89c](https://github.com/socketio/socket.io-client/commit/b83f89c901e82e06f66cbda4124cf739d2bb01c3))


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

