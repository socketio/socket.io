# [6.0.0](https://github.com/socketio/engine.io/compare/5.2.0...6.0.0) (2021-10-08)

The codebase was migrated to TypeScript ([c0d6eaa](https://github.com/socketio/engine.io/commit/c0d6eaa1ba1291946dc8425d5f533d5f721862dd))

An ES module wrapper was also added ([401f4b6](https://github.com/socketio/engine.io/commit/401f4b60693fb6702c942692ce42e5bb701d81d7)).

Please note that the communication protocol was not updated, so a v5 client will be able to reach a v6 server (and vice-versa).

Reference: https://github.com/socketio/engine.io-protocol

### BREAKING CHANGES

- the default export was removed, so the following code won't work anymore:

```js
const eioServer = require("engine.io")(httpServer);
```

Please use this instead:

```js
const { Server } = require("engine.io");
const eioServer = new Server(httpServer);
```

### Dependencies

`ws` version: `~8.2.3` (bumped from `~7.4.2`)

# [5.2.0](https://github.com/socketio/engine.io/compare/5.1.1...5.2.0) (2021-08-29)

No change on the server-side, this matches the client release.


## [5.1.1](https://github.com/socketio/engine.io/compare/5.1.0...5.1.1) (2021-05-16)


### Bug Fixes

* properly close the websocket connection upon handshake error ([4360686](https://github.com/socketio/engine.io/commit/43606865e5299747cbb31f3ed9baf4567502a879))


# [5.1.0](https://github.com/socketio/engine.io/compare/5.0.0...5.1.0) (2021-05-04)


### Features

* add a "connection_error" event ([7096e98](https://github.com/socketio/engine.io/commit/7096e98a02295a62c8ea2aa56461d4875887092d))
* add the "initial_headers" and "headers" events ([2527543](https://github.com/socketio/engine.io/commit/252754353a0e88eb036ebb3082e9d6a9a5f497db))


### Performance Improvements

* **websocket:** add a "wsPreEncoded" writing option ([7706b12](https://github.com/socketio/engine.io/commit/7706b123df914777d19c8179b45ab6932f82916c))
* **websocket:** fix write back-pressure ([#618](https://github.com/socketio/engine.io/issues/618)) ([ad5306a](https://github.com/socketio/engine.io/commit/ad5306aeaedf06ac7a49f791e1b76e55c35a564e))


# [5.0.0](https://github.com/socketio/engine.io/compare/4.1.1...5.0.0) (2021-03-10)


### Bug Fixes

* set default protocol version to 3 ([#616](https://github.com/socketio/engine.io/issues/616)) ([868d891](https://github.com/socketio/engine.io/commit/868d89111de0ab5bd0e147ecaff7983afbf5d087))


### Features

* increase the default value of pingTimeout ([5a7fa13](https://github.com/socketio/engine.io/commit/5a7fa132c442bc1e7eefa1cf38168ee951575ded))
* remove dynamic require() with wsEngine ([edb7343](https://github.com/socketio/engine.io/commit/edb734316f143bf0f1bbc344e966d18e2676b934))


### BREAKING CHANGES

* the syntax of the "wsEngine" option is updated

Before:

```js
const eioServer = require("engine.io")(httpServer, {
  wsEngine: "eiows"
});
```

After:

```js
const eioServer = require("engine.io")(httpServer, {
  wsEngine: require("eiows").Server
});
```


## [4.1.1](https://github.com/socketio/engine.io/compare/4.1.0...4.1.1) (2021-02-02)


### Bug Fixes

* do not reset the ping timer after upgrade ([ff2b8ab](https://github.com/socketio/engine.io/commit/ff2b8aba48ebcb0de5626d3b76fddc94c398395f)), closes [/github.com/socketio/socket.io-client-swift/pull/1309#issuecomment-768475704](https://github.com//github.com/socketio/socket.io-client-swift/pull/1309/issues/issuecomment-768475704)


# [4.1.0](https://github.com/socketio/engine.io/compare/4.0.6...4.1.0) (2021-01-14)


### Features

* add support for v3.x clients ([663d326](https://github.com/socketio/engine.io/commit/663d326d18de598318bd2120b2b70cd51adf8955))


## [4.0.6](https://github.com/socketio/engine.io/compare/4.0.5...4.0.6) (2021-01-04)


### Bug Fixes

* correctly pass the options when using the Server constructor ([#610](https://github.com/socketio/engine.io/issues/610)) ([cec2750](https://github.com/socketio/engine.io/commit/cec27502f5b55c8a2ff289db34019629bf6a97ca))



# [3.5.0](https://github.com/socketio/engine.io/compare/3.4.2...3.5.0) (2020-12-30)


### Features

* add support for all cookie options ([19cc582](https://github.com/socketio/engine.io/commit/19cc58264a06dca47ed401fbaca32dcdb80a903b)), closes [/github.com/jshttp/cookie#options-1](https://github.com//github.com/jshttp/cookie/issues/options-1)
* disable perMessageDeflate by default ([5ad2736](https://github.com/socketio/engine.io/commit/5ad273601eb66c7b318542f87026837bf9dddd21))



## [4.0.5](https://github.com/socketio/engine.io/compare/4.0.4...4.0.5) (2020-12-07)

No change on the server-side, this matches the client release.

## [4.0.4](https://github.com/socketio/engine.io/compare/4.0.3...4.0.4) (2020-11-17)

No change on the server-side, this matches the client release.

## [4.0.3](https://github.com/socketio/engine.io/compare/4.0.2...4.0.3) (2020-11-17)

No change on the server-side, this matches the client release.

## [4.0.2](https://github.com/socketio/engine.io/compare/4.0.1...4.0.2) (2020-11-09)


### Bug Fixes

* add extension in the package.json main entry ([#608](https://github.com/socketio/engine.io/issues/608)) ([17b8c2f](https://github.com/socketio/engine.io/commit/17b8c2f199e7a307b6d6294b8599abacb3ec56e7))


## [4.0.1](https://github.com/socketio/engine.io/compare/4.0.0...4.0.1) (2020-10-21)


### Bug Fixes

* do not overwrite CORS headers upon error ([fe093ba](https://github.com/socketio/engine.io/commit/fe093bae1adce99e01dfdd3ce7542957785098b5))



# [4.0.0](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.1...4.0.0) (2020-09-10)

More details about this release in the blog post: https://socket.io/blog/engine-io-4-release/

### Bug Fixes

* ignore errors when forcefully closing the socket ([#601](https://github.com/socketio/engine.io/issues/601)) ([dcdbccb](https://github.com/socketio/engine.io/commit/dcdbccb3dd8a7b7db057d23925356034fcd35d48))
* remove implicit require of uws ([82cdca2](https://github.com/socketio/engine.io/commit/82cdca23bab0ed69b61b60961900d456a3065e6a))


### Features

* disable perMessageDeflate by default ([078527a](https://github.com/socketio/engine.io/commit/078527a384b70dc46d99083fa218be5d45213e51))

#### Links

- Diff: [v4.0.0-alpha.1...4.0.0](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.1...4.0.0)
- Full diff: [3.4.0...4.0.0](https://github.com/socketio/engine.io/compare/3.4.0...4.0.0)
- Client release: [4.0.0](https://github.com/socketio/engine.io-client/releases/tag/4.0.0)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)


## [3.4.2](https://github.com/socketio/engine.io/compare/3.4.1...3.4.2) (2020-06-04)


### Bug Fixes

* remove explicit require of uws ([85e544a](https://github.com/socketio/engine.io/commit/85e544afd95a5890761a613263a5eba0c9a18a93))

#### Links

- Diff: [3.4.1...3.4.2](https://github.com/socketio/engine.io/compare/3.4.1...3.4.2)
- Client release: -
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



## [3.4.1](https://github.com/socketio/engine.io/compare/3.4.0...3.4.1) (2020-04-17)


### Bug Fixes

* ignore errors when forcefully closing the socket ([da851ec](https://github.com/socketio/engine.io/commit/da851ec4ec89d96df2ee5c711f328b5d795423e9))
* use SameSite=Strict by default ([001ca62](https://github.com/socketio/engine.io/commit/001ca62cc4a8f511f3b2fbd9e4493ad274a6a0e5))

#### Links

- Diff: [3.4.0...3.4.1](https://github.com/socketio/engine.io/compare/3.4.0...3.4.1)
- Client release: [3.4.1](https://github.com/socketio/engine.io-client/releases/tag/3.4.1)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



# [4.0.0-alpha.1](https://github.com/socketio/engine.io/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2020-02-12)

#### Links

- Diff: [v4.0.0-alpha.0...v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/compare/v4.0.0-alpha.0...v4.0.0-alpha.1)
- Client release: [v4.0.0-alpha.1](https://github.com/socketio/engine.io-client/releases/tag/v4.0.0-alpha.1)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)



# [4.0.0-alpha.0](https://github.com/socketio/engine.io/compare/3.4.0...v4.0.0-alpha.0) (2020-02-12)


### Features

* decrease the default value of maxHttpBufferSize ([734f9d1](https://github.com/socketio/engine.io/commit/734f9d1268840722c41219e69eb58318e0b2ac6b))
* disable cookie by default and add sameSite attribute ([a374471](https://github.com/socketio/engine.io/commit/a374471d06e3681a769766a1d068898182f9305f)), closes [/github.com/jshttp/cookie#options-1](https://github.com//github.com/jshttp/cookie/issues/options-1)
* generateId method can now return a Promise ([f3c291f](https://github.com/socketio/engine.io/commit/f3c291fa613a9d50c924d74293035737fdace4f2))
* reverse the ping-pong mechanism ([31ff875](https://github.com/socketio/engine.io/commit/31ff87593f231b86dc47ec5761936439ebd53c20))
* use the cors module to handle cross-origin requests ([61b9492](https://github.com/socketio/engine.io/commit/61b949259ed966ef6fc8bfd61f14d1a2ef06d319))


### BREAKING CHANGES

* the handlePreflightRequest option is removed by the change.

Before:

```
new Server({
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": 'https://example.com',
      "Access-Control-Allow-Methods": 'GET',
      "Access-Control-Allow-Headers": 'Authorization',
      "Access-Control-Allow-Credentials": true
    });
    res.end();
  }
})
```

After:

```
new Server({
  cors: {
    origin: "https://example.com",
    methods: ["GET"],
    allowedHeaders: ["Authorization"],
    credentials: true
  }
})
```
* the syntax has changed from

```
new Server({
  cookieName: "test",
  cookieHttpOnly: false,
  cookiePath: "/custom"
})
```

to

```
new Server({
  cookie: {
    name: "test",
    httpOnly: false,
    path: "/custom"
  }
})
```

All other options (domain, maxAge, sameSite, ...) are now supported.

* v3.x clients will not be able to connect anymore (they will send a ping packet and timeout while waiting for a pong packet).

#### Links

- Diff: [3.4.0...v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/compare/3.4.0...v4.0.0-alpha.0)
- Client release: [v4.0.0-alpha.0](https://github.com/socketio/engine.io-client/releases/tag/v4.0.0-alpha.0)
- ws version: [^7.1.2](https://github.com/websockets/ws/releases/tag/7.1.2)

