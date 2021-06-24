## [5.1.2](https://github.com/socketio/engine.io-client/compare/5.1.1...5.1.2) (2021-06-24)


### Bug Fixes

* emit ping when receiving a ping from the server ([589d3ad](https://github.com/socketio/engine.io-client/commit/589d3ad63840329b5a61186603a415c534f8d4fc))
* **websocket:** fix timer blocking writes ([#670](https://github.com/socketio/engine.io-client/issues/670)) ([f30a10b](https://github.com/socketio/engine.io-client/commit/f30a10b7f45517fcb3abd02511c58a89e0ef498f))


## [5.1.1](https://github.com/socketio/engine.io-client/compare/5.1.0...5.1.1) (2021-05-11)


### Bug Fixes

* fix JSONP transport on IE9 ([bddd992](https://github.com/socketio/engine.io-client/commit/bddd9928fcdb33c79e0289bcafef337359dee12b))


## [4.1.4](https://github.com/socketio/engine.io-client/compare/4.1.3...4.1.4) (2021-05-05)

This release only contains a bump of `xmlhttprequest-ssl`, in order to fix the following vulnerability: https://www.npmjs.com/advisories/1665.

Please note that `engine.io-client` was not directly impacted by this vulnerability, since we are always using `async: true`.


## [3.5.2](https://github.com/socketio/engine.io-client/compare/3.5.1...3.5.2) (2021-05-05)

This release only contains a bump of `xmlhttprequest-ssl`, in order to fix the following vulnerability: https://www.npmjs.com/advisories/1665.

Please note that `engine.io-client` was not directly impacted by this vulnerability, since we are always using `async: true`.


# [5.1.0](https://github.com/socketio/engine.io-client/compare/5.0.1...5.1.0) (2021-05-04)


### Features

* add the "closeOnBeforeunload" option ([dcb85e9](https://github.com/socketio/engine.io-client/commit/dcb85e902d129b2d1a94943b4f6d471532f70dc9))


## [5.0.1](https://github.com/socketio/engine.io-client/compare/5.0.0...5.0.1) (2021-03-31)


### Bug Fixes

* ignore packets when the transport is silently closed ([d291a4c](https://github.com/socketio/engine.io-client/commit/d291a4c9f6accfc86fcd96683a5d493a87e3644c))


# [5.0.0](https://github.com/socketio/engine.io-client/compare/4.1.2...5.0.0) (2021-03-10)

The major bump is due to a breaking change on the server side.

### Features

* add autoUnref option ([6551683](https://github.com/socketio/engine.io-client/commit/65516836b2b6fe28d80e9a5918f9e10baa7451d8))
* listen to the "offline" event ([c361bc6](https://github.com/socketio/engine.io-client/commit/c361bc691f510b96f8909c5e6c62a4635d50275c))


## [3.5.1](https://github.com/socketio/engine.io-client/compare/3.5.0...3.5.1) (2021-03-02)


### Bug Fixes

* replace default nulls in SSL options with undefineds ([d0c551c](https://github.com/socketio/engine.io-client/commit/d0c551cca1e37301e8b28843c8f6e7ad5cf561d3))


## [4.1.2](https://github.com/socketio/engine.io-client/compare/4.1.1...4.1.2) (2021-02-25)


### Bug Fixes

* silently close the transport in the beforeunload hook ([ed48b5d](https://github.com/socketio/engine.io-client/commit/ed48b5dc3407e5ded45072606b3bb0eafa49c01f))


## [4.1.1](https://github.com/socketio/engine.io-client/compare/4.1.0...4.1.1) (2021-02-02)


### Bug Fixes

* remove polyfill for process in the bundle ([c95fdea](https://github.com/socketio/engine.io-client/commit/c95fdea83329b264964641bb48e3be2a8772f7a1))


# [4.1.0](https://github.com/socketio/engine.io-client/compare/4.0.6...4.1.0) (2021-01-14)


### Features

* add missing ws options ([d134fee](https://github.com/socketio/engine.io-client/commit/d134feeaa615afc4cbe0aa45aa4344c899b65df0))


## [4.0.6](https://github.com/socketio/engine.io-client/compare/4.0.5...4.0.6) (2021-01-04)


# [3.5.0](https://github.com/socketio/engine.io-client/compare/3.4.4...3.5.0) (2020-12-30)


### Bug Fixes

* check the type of the initial packet ([8750356](https://github.com/socketio/engine.io-client/commit/8750356dba5409ba0e1d3a27da6d214118702b3e))



## [4.0.5](https://github.com/socketio/engine.io-client/compare/4.0.4...4.0.5) (2020-12-07)


## [4.0.4](https://github.com/socketio/engine.io-client/compare/4.0.3...4.0.4) (2020-11-17)


### Bug Fixes

* check the type of the initial packet ([1c8cba8](https://github.com/socketio/engine.io-client/commit/1c8cba8818e930205918a70f05c1164865842a48))
* restore the cherry-picking of the WebSocket options ([4873a23](https://github.com/socketio/engine.io-client/commit/4873a237f1ce5fcb18e255dd604d50dcfc624ea8))


## [4.0.3](https://github.com/socketio/engine.io-client/compare/4.0.2...4.0.3) (2020-11-17)


### Bug Fixes

* **react-native:** add a default value for the withCredentials option ([ccb99e3](https://github.com/socketio/engine.io-client/commit/ccb99e3718e8ee2c50960430d2bd6c12a3dcb0dc))
* **react-native:** exclude the localAddress option ([177b95f](https://github.com/socketio/engine.io-client/commit/177b95fe463ad049b35170f042a771380fdaedee))


## [4.0.2](https://github.com/socketio/engine.io-client/compare/4.0.1...4.0.2) (2020-11-09)


## [4.0.1](https://github.com/socketio/engine.io-client/compare/4.0.0...4.0.1) (2020-10-21)



## [3.4.4](https://github.com/socketio/engine.io-client/compare/3.4.3...3.4.4) (2020-09-30)



# [4.0.0](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.1...4.0.0) (2020-09-10)

More details about this release in the blog post: https://socket.io/blog/engine-io-4-release/

### Bug Fixes

* **react-native:** restrict the list of options for the WebSocket object ([2f5c948](https://github.com/socketio/engine.io-client/commit/2f5c948abe8fd1c0fdb010e88f96bd933a3792ea))
* use globalThis polyfill instead of self/global ([#634](https://github.com/socketio/engine.io-client/issues/634)) ([3f3a6f9](https://github.com/socketio/engine.io-client/commit/3f3a6f991404ef601252193382d2d2029cff6c45))


### Features

* strip debug from the browser bundle ([f7ba966](https://github.com/socketio/engine.io-client/commit/f7ba966e53f4609f755880be8fa504f7252b0817))

#### Links

- Diff: [v4.0.0-alpha.1...4.0.0](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.1...4.0.0)
- Full diff: [3.4.0...4.0.0](https://github.com/socketio/engine.io-client/compare/3.4.0...4.0.0)
- Server release: [4.0.0](https://github.com/socketio/engine.io/releases/tag/4.0.0)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)


## [3.4.1](https://github.com/socketio/engine.io-client/compare/3.4.0...3.4.1) (2020-04-17)


### Bug Fixes

* use globalThis polyfill instead of self/global ([357f01d](https://github.com/socketio/engine.io-client/commit/357f01d90448d8565b650377bc7cabb351d991bd))

#### Links

- Diff: [3.4.0...3.4.1](https://github.com/socketio/engine.io-client/compare/3.4.0...3.4.1)
- Server release: [3.4.1](https://github.com/socketio/engine.io/releases/tag/3.4.1)
- ws version: [~6.1.0](https://github.com/websockets/ws/releases/tag/6.1.0)


# [4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-02-12)


### Bug Fixes

* properly assign options when creating the transport ([7c7f1a9](https://github.com/socketio/engine.io-client/commit/7c7f1a9fe24856e3a155db1dc67d12d1586ffa37))

#### Links

- Diff: [v4.0.0-alpha.0...v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1)
- Server release: [v4.0.0-alpha.1](https://github.com/socketio/engine.io/releases/tag/v4.0.0-alpha.1)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)


# [4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0) (2020-02-12)


### chore

* migrate to webpack 4 ([11dc4f3](https://github.com/socketio/engine.io-client/commit/11dc4f3a56d440f24b8a091485fef038d592bd6e))


### Features

* reverse the ping-pong mechanism ([81d7171](https://github.com/socketio/engine.io-client/commit/81d7171c6bb4053c802e3cc4b29a0e42dcf9c065))


### BREAKING CHANGES

* v3.x clients will not be able to connect anymore (they
will send a ping packet and timeout while waiting for a pong packet).

* the output bundle will now be found in the dist/ folder.


#### Links

- Diff: [3.4.0...v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0)
- Server release: [v4.0.0-alpha.0](https://github.com/socketio/engine.io/releases/tag/v4.0.0-alpha.0)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)
