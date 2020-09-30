## [2.3.1](https://github.com/socketio/socket.io-client/compare/2.3.0...2.3.1) (2020-09-30)

The `debug` dependency has been reverted to `~3.1.0`, as the newer versions contains ES6 syntax which breaks in IE
browsers.

Please note that this only applied to users that bundle the Socket.IO client in their application, with webpack for
example, as the "official" bundles (in the dist/ folder) were already transpiled with babel.

For webpack users, you can also take a look at the [webpack-remove-debug](https://github.com/johngodley/webpack-remove-debug)
plugin.

### Bug Fixes

* fix reconnection after opening socket asynchronously ([#1253](https://github.com/socketio/socket.io-client/issues/1253)) ([050108b](https://github.com/Automattic/socket.io-client/commit/050108b2281effda086b197cf174ee2e8e1aad79))

