# [2.5.0](https://github.com/socketio/socket.io/compare/2.4.1...2.5.0) (2022-06-26)


### Bug Fixes

* fix race condition in dynamic namespaces ([05e1278](https://github.com/socketio/socket.io/commit/05e1278cfa99f3ecf3f8f0531ffe57d850e9a05b))
* ignore packet received after disconnection ([22d4bdf](https://github.com/socketio/socket.io/commit/22d4bdf00d1a03885dc0171125faddfaef730066))
* only set 'connected' to true after middleware execution ([226cc16](https://github.com/socketio/socket.io/commit/226cc16165f9fe60f16ff4d295fb91c8971cde35))
* prevent the socket from joining a room after disconnection ([f223178](https://github.com/socketio/socket.io/commit/f223178eb655a7713303b21a78f9ef9e161d6458))



## [2.4.1](https://github.com/socketio/socket.io/compare/2.4.0...2.4.1) (2021-01-07)


### Reverts

* fix(security): do not allow all origins by default ([a169050](https://github.com/socketio/socket.io/commit/a1690509470e9dd5559cec4e60908ca6c23e9ba0))


# [2.4.0](https://github.com/socketio/socket.io/compare/2.3.0...2.4.0) (2021-01-04)


### Bug Fixes

* **security:** do not allow all origins by default ([f78a575](https://github.com/socketio/socket.io/commit/f78a575f66ab693c3ea96ea88429ddb1a44c86c7))
* properly overwrite the query sent in the handshake ([d33a619](https://github.com/socketio/socket.io/commit/d33a619905a4905c153d4fec337c74da5b533a9e))
