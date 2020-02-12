# [4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-02-12)


### Bug Fixes

* properly assign options when creating the transport ([7c7f1a9](https://github.com/socketio/engine.io-client/commit/7c7f1a9fe24856e3a155db1dc67d12d1586ffa37))

#### Links

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

- Server release: [v4.0.0-alpha.0](https://github.com/socketio/engine.io/releases/tag/v4.0.0-alpha.0)
- ws version: [~7.2.1](https://github.com/websockets/ws/releases/tag/7.2.1)
