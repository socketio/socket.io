const { listen } = require("./common");
const expect = require("expect.js");
const request = require("superagent");
const { WebSocket } = require("ws");
const helmet = require("helmet");
const session = require("express-session");
const { ClientSocket, createPartialDone } = require("./common");
const success = require("./utils/success");

describe("middlewares", () => {
  it("should apply middleware (polling)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        res.setHeader("foo", "bar");
        next();
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(res.headers["foo"]).to.eql("bar");

          success(done, engine);
        });
    });
  });

  it("should apply middleware (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        res.setHeader("foo", "bar");
        next();
      });

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["foo"]).to.eql("bar");

        success(done, engine);
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should expose EventEmitter methods on the response object during upgrade (regression for pino-http)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        expect(res.on).to.be.a("function");
        res.on("close", () => {
          success(done, engine);
        });
        next();
      });

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should apply an asynchronous middleware (polling)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        res.setHeader("foo", "bar");
        setTimeout(next, 10);
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(res.headers["foo"]).to.eql("bar");

          success(done, engine);
        });
    });
  });

  it("should apply an asynchronous middleware (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        res.setHeader("foo", "bar");
        setTimeout(next, 10);
      });

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["foo"]).to.eql("bar");

        success(done, engine);
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should apply all middlewares in order", (done) => {
    const engine = listen((port) => {
      let count = 0;

      engine.use((req, res, next) => {
        expect(++count).to.eql(1);
        next();
      });

      engine.use((req, res, next) => {
        expect(++count).to.eql(2);
        next();
      });

      engine.use((req, res, next) => {
        expect(++count).to.eql(3);
        next();
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);

          success(done, engine);
        });
    });
  });

  it("should end the request (polling)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, _next) => {
        res.writeHead(503);
        res.end();
      });

      engine.on("connection", () => {
        done(new Error("should not happen"));
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(503);

          success(done, engine);
        });
    });
  });

  it("should end the request (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, _next) => {
        res.writeHead(503);
        res.end();
      });

      engine.on("connection", () => {
        done(new Error("should not happen"));
      });

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.addEventListener("error", () => {
        success(done, engine);
      });
    });
  });

  it("should work with helmet (polling)", (done) => {
    const engine = listen((port) => {
      engine.use(helmet());

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(res.headers["x-download-options"]).to.eql("noopen");
          expect(res.headers["x-content-type-options"]).to.eql("nosniff");

          success(done, engine);
        });
    });
  });

  it("should work with helmet (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use(helmet());

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["x-download-options"]).to.eql("noopen");
        expect(res.headers["x-content-type-options"]).to.eql("nosniff");

        success(done, engine);
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should work with express-session (polling)", (done) => {
    const engine = listen((port) => {
      engine.use(
        session({
          secret: "keyboard cat",
          resave: false,
          saveUninitialized: true,
          cookie: {},
        }),
      );

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          // expect(res.status).to.eql(200);
          expect(res.headers["set-cookie"][0].startsWith("connect.sid=")).to.be(
            true,
          );

          success(done, engine);
        });
    });
  });

  it("should work with express-session (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use(
        session({
          secret: "keyboard cat",
          resave: false,
          saveUninitialized: true,
          cookie: {},
        }),
      );

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["set-cookie"][0].startsWith("connect.sid=")).to.be(
          true,
        );

        success(done, engine);
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });

  it("should fail on synchronous middleware errors (polling)", (done) => {
    const partialDone = createPartialDone(() => success(done, engine), 2);
    const engine = listen((port) => {
      engine.use(() => {
        throw new Error("will always fail");
      });

      engine.on("connection_error", (err) => {
        expect(err.req).to.be.ok();
        expect(err.code).to.eql(3);
        expect(err.message).to.eql("Bad request");
        expect(err.context.name).to.eql("MIDDLEWARE_FAILURE");
        partialDone();
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(400);

          partialDone();
        });
    });
  });

  it("should fail on rejected middleware promises (polling)", (done) => {
    const partialDone = createPartialDone(() => success(done, engine), 2);

    const engine = listen((port) => {
      engine.use(() => {
        return Promise.reject(new Error("will always fail"));
      });

      engine.on("connection", () => {
        done(new Error("should not connect"));
      });

      engine.on("connection_error", (err) => {
        expect(err.req).to.be.ok();
        expect(err.code).to.eql(3);
        expect(err.message).to.eql("Bad request");
        expect(err.context.name).to.eql("MIDDLEWARE_FAILURE");
        partialDone();
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(400);

          partialDone();
        });
    });
  });

  it("should ignore a throw after next() and continue (polling)", (done) => {
    let connectionErrors = 0;
    let connections = 0;
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        next();
        throw new Error("after next");
      });

      engine.use((req, res, next) => {
        res.setHeader("foo", "bar");
        next();
      });

      engine.on("connection_error", () => {
        connectionErrors++;
      });

      engine.on("connection", () => {
        connections++;
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(res.headers["foo"]).to.eql("bar");
          expect(connectionErrors).to.eql(0);
          expect(connections).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should ignore a throw after next(err) and fail once (polling)", (done) => {
    let connectionErrors = 0;
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        next(new Error("will always fail"));
        throw new Error("after next(err)");
      });

      engine.use(() => {
        done(new Error("next middleware should not run"));
      });

      engine.on("connection", () => {
        done(new Error("should not connect"));
      });

      engine.on("connection_error", (err) => {
        connectionErrors++;
        expect(err.req).to.be.ok();
        expect(err.code).to.eql(3);
        expect(err.message).to.eql("Bad request");
        expect(err.context.name).to.eql("MIDDLEWARE_FAILURE");
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(400);
          expect(connectionErrors).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should ignore a rejection after next() and continue (polling)", (done) => {
    let connectionErrors = 0;
    let connections = 0;
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        next();
        return Promise.reject(new Error("after next"));
      });

      engine.on("connection_error", () => {
        connectionErrors++;
      });

      engine.on("connection", () => {
        connections++;
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(connectionErrors).to.eql(0);
          expect(connections).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should keep the middleware response when it throws after sending (polling)", (done) => {
    let connectionErrors = 0;
    const engine = listen((port) => {
      engine.use((_req, res) => {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("nope");
        throw new Error("after end");
      });

      engine.on("connection", () => {
        done(new Error("should not connect"));
      });

      engine.on("connection_error", (err) => {
        connectionErrors++;
        expect(err.context.name).to.eql("MIDDLEWARE_FAILURE");
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(503);
          expect(res.text).to.eql("nope");
          expect(connectionErrors).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should keep the middleware response when it rejects after sending (polling)", (done) => {
    let connectionErrors = 0;
    const engine = listen((port) => {
      engine.use((_req, res) => {
        res.writeHead(503, { "Content-Type": "text/plain" });
        res.end("nope");
        return Promise.reject(new Error("after end"));
      });

      engine.on("connection", () => {
        done(new Error("should not connect"));
      });

      engine.on("connection_error", (err) => {
        connectionErrors++;
        expect(err.context.name).to.eql("MIDDLEWARE_FAILURE");
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(503);
          expect(res.text).to.eql("nope");
          expect(connectionErrors).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should invoke the callback once when next() is called twice (polling)", (done) => {
    let runs = 0;
    let connections = 0;
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        next();
        next();
      });

      engine.use((req, res, next) => {
        runs++;
        next();
      });

      engine.on("connection", () => {
        connections++;
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          expect(res.status).to.eql(200);
          expect(runs).to.eql(1);
          expect(connections).to.eql(1);

          success(done, engine);
        });
    });
  });

  it("should fail on errors (polling)", (done) => {
    const engine = listen((port) => {
      engine.use((req, res, next) => {
        next(new Error("will always fail"));
      });

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.eql(400);

          success(done, engine);
        });
    });

    it("should fail on errors (websocket)", (done) => {
      const engine = listen((port) => {
        engine.use((req, res, next) => {
          next(new Error("will always fail"));
        });

        engine.on("connection", () => {
          done(new Error("should not connect"));
        });

        const socket = new WebSocket(
          `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`,
        );

        socket.addEventListener("error", () => {
          success(done, engine);
        });
      });
    });
  });

  it("should not be receiving data when getting a message longer than maxHttpBufferSize when polling (with a middleware)", (done) => {
    const opts = {
      allowUpgrades: false,
      transports: ["polling"],
      maxHttpBufferSize: 5,
    };
    const engine = listen(opts, (port) => {
      engine.use((req, res, next) => {
        next();
      });

      const socket = new ClientSocket(`ws://localhost:${port}`);
      engine.on("connection", (conn) => {
        conn.on("message", () => {
          done(new Error("Test invalidation (message is longer than allowed)"));
        });
      });
      socket.on("open", () => {
        socket.send("aasdasdakjhasdkjhasdkjhasdkjhasdkjhasdkjhasdkjha");
      });
      socket.on("close", () => {
        success(done, engine);
      });
    });
  });
});
