const listen = require("./common").listen;
const expect = require("expect.js");
const request = require("superagent");
const { WebSocket } = require("ws");
const helmet = require("helmet");
const session = require("express-session");

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

          if (engine.httpServer) {
            engine.httpServer.close();
          }
          done();
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
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["foo"]).to.eql("bar");

        if (engine.httpServer) {
          engine.httpServer.close();
        }
        done();
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

          if (engine.httpServer) {
            engine.httpServer.close();
          }
          done();
        });
    });
  });

  it("should end the request (polling)", function (done) {
    if (process.env.EIO_WS_ENGINE === "uws") {
      return this.skip();
    }
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

          if (engine.httpServer) {
            engine.httpServer.close();
          }
          done();
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
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`
      );

      socket.addEventListener("error", () => {
        if (engine.httpServer) {
          engine.httpServer.close();
        }
        done();
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

          if (engine.httpServer) {
            engine.httpServer.close();
          }
          done();
        });
    });
  });

  it("should work with helmet (websocket)", (done) => {
    const engine = listen((port) => {
      engine.use(helmet());

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["x-download-options"]).to.eql("noopen");
        expect(res.headers["x-content-type-options"]).to.eql("nosniff");

        if (engine.httpServer) {
          engine.httpServer.close();
        }
        done();
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
        })
      );

      request
        .get(`http://localhost:${port}/engine.io/`)
        .query({ EIO: 4, transport: "polling" })
        .end((err, res) => {
          expect(err).to.be(null);
          // expect(res.status).to.eql(200);
          expect(res.headers["set-cookie"][0].startsWith("connect.sid=")).to.be(
            true
          );

          if (engine.httpServer) {
            engine.httpServer.close();
          }
          done();
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
        })
      );

      const socket = new WebSocket(
        `ws://localhost:${port}/engine.io/?EIO=4&transport=websocket`
      );

      socket.on("upgrade", (res) => {
        expect(res.headers["set-cookie"][0].startsWith("connect.sid=")).to.be(
          true
        );

        if (engine.httpServer) {
          engine.httpServer.close();
        }
        done();
      });

      socket.on("open", () => {
        socket.close();
      });
    });
  });
});
