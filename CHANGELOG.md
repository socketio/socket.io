# [4.0.0-alpha.1](https://github.com/socketio/engine.io-parser/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-05-19)


### Features

* implement the version 4 of the protocol ([cab7db0](https://github.com/socketio/engine.io-parser/commit/cab7db0404e0a69f86a05ececd62c8c31f4d97d5))



# [4.0.0-alpha.0](https://github.com/socketio/engine.io-parser/compare/2.2.0...v4.0.0-alpha.0) (2020-02-04)


### Bug Fixes

* properly decode binary packets ([5085373](https://github.com/socketio/engine.io-parser/commit/50853738e0c6c16f9cee0d7887651155f4b78240))


### Features

* remove packet type when encoding binary packets ([a947ae5](https://github.com/socketio/engine.io-parser/commit/a947ae59a2844e4041db58ff36b270d1528b3bee))


### BREAKING CHANGES

* the packet containing binary data will now be sent without any transformation

Protocol v3: { type: 'message', data: <Buffer 01 02 03> } => <Buffer 04 01 02 03>
Protocol v4: { type: 'message', data: <Buffer 01 02 03> } => <Buffer 01 02 03>



# [2.2.0](https://github.com/socketio/engine.io-parser/compare/2.1.3...2.2.0) (2019-09-13)


* [refactor] Use `Buffer.allocUnsafe` instead of `new Buffer` (#104) ([aedf8eb](https://github.com/socketio/engine.io-parser/commit/aedf8eb29e8bf6aeb5c6cc68965d986c4c958ae2)), closes [#104](https://github.com/socketio/engine.io-parser/issues/104)


### BREAKING CHANGES

* drop support for Node.js 4 (since Buffer.allocUnsafe was added in v5.10.0)

Reference: https://nodejs.org/docs/latest/api/buffer.html#buffer_class_method_buffer_allocunsafe_size
