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

