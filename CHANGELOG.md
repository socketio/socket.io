## [4.0.2](https://github.com/socketio/socket.io-parser/compare/4.0.1...4.0.2) (2020-11-25)


### Bug Fixes

* move @types/component-emitter to dependencies ([#99](https://github.com/socketio/socket.io-parser/issues/99)) ([4efa005](https://github.com/socketio/socket.io-parser/commit/4efa005846ae15ecc7fb0a7f27141439113b1179))


## [4.0.1](https://github.com/socketio/socket.io-parser/compare/3.4.1...4.0.1) (2020-11-05)

### Features

* move binary detection back to the parser ([285e7cd](https://github.com/socketio/socket.io-parser/commit/285e7cd0d837adfc911c999e7294788681226ae1))
* add support for a payload in a CONNECT packet ([78f9fc2](https://github.com/socketio/socket.io-parser/commit/78f9fc2999b15804b02f2c22a2b4007734a26af9))

### Bug Fixes

* do not catch encoding errors ([aeae87c](https://github.com/socketio/socket.io-parser/commit/aeae87c220287197cb78370dbd86b950a7dd29eb))
* throw upon invalid payload format ([c327acb](https://github.com/socketio/socket.io-parser/commit/c327acbc3c3c2d0b2b439136cbcb56c81db173d6))

### BREAKING CHANGES

* the encode method is now synchronous ([28d4f03](https://github.com/socketio/socket.io-parser/commit/28d4f0309bdd9e306b78d1946d3e1760941d6544))



## [4.0.1-rc3](https://github.com/socketio/socket.io-parser/compare/4.0.1-rc2...4.0.1-rc3) (2020-10-25)



## [4.0.1-rc2](https://github.com/socketio/socket.io-parser/compare/4.0.1-rc1...4.0.1-rc2) (2020-10-15)


### Features

* move binary detection back to the parser ([285e7cd](https://github.com/socketio/socket.io-parser/commit/285e7cd0d837adfc911c999e7294788681226ae1))



## [4.0.1-rc1](https://github.com/socketio/socket.io-parser/compare/4.0.0...4.0.1-rc1) (2020-10-12)


### Features

* add support for a payload in a CONNECT packet ([78f9fc2](https://github.com/socketio/socket.io-parser/commit/78f9fc2999b15804b02f2c22a2b4007734a26af9))



## [3.3.1](https://github.com/socketio/socket.io-parser/compare/3.3.0...3.3.1) (2020-09-30)


# [4.0.0](https://github.com/socketio/socket.io-parser/compare/3.4.1...4.0.0) (2020-09-28)

This release will be included in Socket.IO v3.

There is a breaking API change (see below), but the exchange [protocol](https://github.com/socketio/socket.io-protocol) is left untouched and thus stays in version 4.

### Bug Fixes

* do not catch encoding errors ([aeae87c](https://github.com/socketio/socket.io-parser/commit/aeae87c220287197cb78370dbd86b950a7dd29eb))
* throw upon invalid payload format ([c327acb](https://github.com/socketio/socket.io-parser/commit/c327acbc3c3c2d0b2b439136cbcb56c81db173d6))


### BREAKING CHANGES

* the encode method is now synchronous ([28d4f03](https://github.com/socketio/socket.io-parser/commit/28d4f0309bdd9e306b78d1946d3e1760941d6544))



## [3.4.1](https://github.com/socketio/socket.io-parser/compare/3.4.0...3.4.1) (2020-05-13)


### Bug Fixes

* prevent DoS (OOM) via massive packets ([#95](https://github.com/socketio/socket.io-parser/issues/95)) ([dcb942d](https://github.com/socketio/socket.io-parser/commit/dcb942d24db97162ad16a67c2a0cf30875342d55))
