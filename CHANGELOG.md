# History

- [2.5.0](#250-2023-01-06) (Jan 2023)
- [2.4.0](#240-2022-03-30) (Mar 2022)
- [2.3.3](#233-2021-11-16) (Nov 2021)
- [2.3.2](#232-2021-08-28) (Aug 2021)
- [2.3.1](#231-2021-05-19) (May 2021)
- [2.3.0](#230-2021-05-10) (May 2021)
- [2.2.0](#220-2021-02-27) (Feb 2021)
- [2.1.0](#210-2021-01-15) (Jan 2021)
- [2.0.3](#203-2020-11-05) (Nov 2020)
- [2.0.2](#202-2020-09-28) (Sep 2020)
- [2.0.1](#201-2020-09-28) (Sep 2020)
- [2.0.0](#200-2020-09-25) (Sep 2020)



# Release notes


## [2.5.0](https://github.com/socketio/socket.io-adapter/compare/2.4.0...2.5.0) (2023-01-06)


### Features

* implement connection state recovery ([f529412](https://github.com/socketio/socket.io-adapter/commit/f5294126a8feec1906bca439443c3864415415fb))


### Performance Improvements

* precompute the WebSocket frames when broadcasting ([5f7b47d](https://github.com/socketio/socket.io-adapter/commit/5f7b47d40f9daabe4e3c321eda620bbadfe5ce96))



## [2.4.0](https://github.com/socketio/socket.io-adapter/compare/2.3.3...2.4.0) (2022-03-30)


### Features

* broadcast and expect multiple acks ([a7f1c90](https://github.com/socketio/socket.io-adapter/commit/a7f1c90a322241ffaca96ddc42f204d79bc514b5))
* notify listeners for each outgoing packet ([38ee887](https://github.com/socketio/socket.io-adapter/commit/38ee887fefa8288f3a3468292c17fe7d5ca57ffc))



## [2.3.3](https://github.com/socketio/socket.io-adapter/compare/2.3.2...2.3.3) (2021-11-16)


### Bug Fixes

* fix broadcasting volatile packets with binary attachments ([88eee59](https://github.com/socketio/socket.io-adapter/commit/88eee5948aba94f999405239025f29c754a002e2))



## [2.3.2](https://github.com/socketio/socket.io-adapter/compare/2.3.1...2.3.2) (2021-08-28)


### Bug Fixes

* fix race condition when leaving rooms ([#74](https://github.com/socketio/socket.io-adapter/issues/74)) ([912e13a](https://github.com/socketio/socket.io-adapter/commit/912e13ad30bd584e2ece747be96a1ba0669dd874))


## [2.3.1](https://github.com/socketio/socket.io-adapter/compare/2.3.0...2.3.1) (2021-05-19)


### Bug Fixes

* restore compatibility with binary parsers ([a33e42b](https://github.com/socketio/socket.io-adapter/commit/a33e42bb7b935ccdd3688b4c305714b791ade0db))


## [2.3.0](https://github.com/socketio/socket.io-adapter/compare/2.2.0...2.3.0) (2021-05-10)


### Features

* add a serverSideEmit empty function ([c4cbd4b](https://github.com/socketio/socket.io-adapter/commit/c4cbd4ba2d8997f9ab8e06cfb631c8f9a43d16f1))
* add support for the "wsPreEncoded" writing option ([5579d40](https://github.com/socketio/socket.io-adapter/commit/5579d40c24d15f69e44246f788fb93beb367f994))


## [2.2.0](https://github.com/socketio/socket.io-adapter/compare/2.1.0...2.2.0) (2021-02-27)


### Features

* add some utility methods ([1c9827e](https://github.com/socketio/socket.io-adapter/commit/1c9827ec1136e24094295907efaf4d4e6c2fef2f))
* allow excluding all sockets in a room ([#66](https://github.com/socketio/socket.io-adapter/issues/66)) ([985bb41](https://github.com/socketio/socket.io-adapter/commit/985bb41fa2c04f17f1cf3a17c14ab9acde8947f7))


## [2.1.0](https://github.com/socketio/socket.io-adapter/compare/2.0.3...2.1.0) (2021-01-15)


### Features

* add room events ([155fa63](https://github.com/socketio/socket.io-adapter/commit/155fa6333a504036e99a33667dc0397f6aede25e))
* make rooms and sids public ([313c5a9](https://github.com/socketio/socket.io-adapter/commit/313c5a9fb60d913cd3a866001d67516399d8ee2f))


## [2.0.3](https://github.com/socketio/socket.io-adapter/compare/1.1.2...2.0.3) (2020-11-05)

### Features

* add init() and close() methods ([2e023bf](https://github.com/socketio/socket.io-adapter/commit/2e023bf2b651e543a34147fab19497fbdb8bdb72))
* use ES6 Sets and Maps ([53ed3f4](https://github.com/socketio/socket.io-adapter/commit/53ed3f4099c073546c66d911a95171adcefc524c))

### Bug Fixes

* Encoder#encode() is now synchronous ([c043650](https://github.com/socketio/socket.io-adapter/commit/c043650f1c6e58b20364383103314ddc733e4615))



## [2.0.3-rc2](https://github.com/socketio/socket.io-adapter/compare/2.0.3-rc1...2.0.3-rc2) (2020-10-20)


### Features

* add init() and close() methods ([2e023bf](https://github.com/socketio/socket.io-adapter/commit/2e023bf2b651e543a34147fab19497fbdb8bdb72))



## [2.0.3-rc1](https://github.com/socketio/socket.io-adapter/compare/2.0.2...2.0.3-rc1) (2020-10-15)



## [2.0.2](https://github.com/socketio/socket.io-adapter/compare/2.0.1...2.0.2) (2020-09-28)

The dist/ directory was not up-to-date when publishing the previous version...



## [2.0.1](https://github.com/socketio/socket.io-adapter/compare/2.0.0...2.0.1) (2020-09-28)


### Bug Fixes

* Encoder#encode() is now synchronous ([c043650](https://github.com/socketio/socket.io-adapter/commit/c043650f1c6e58b20364383103314ddc733e4615))



## [2.0.0](https://github.com/socketio/socket.io-adapter/compare/1.1.2...2.0.0) (2020-09-25)


### Features

* use ES6 Sets and Maps ([53ed3f4](https://github.com/socketio/socket.io-adapter/commit/53ed3f4099c073546c66d911a95171adcefc524c))
