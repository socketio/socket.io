const net = require("net");
const { Server, protocol, attach } = require("..");
const listen = require("./common").listen;
const expect = require("expect.js");
const request = require("superagent");
const http = require("http");

/**
 * Tests.
 */

describe("engine", () => {
  it("should expose protocol number", () => {
    expect(protocol).to.be.a("number");
  });

  it.skip("should be the same version as client", () => {
    const version = require("../package.json").version;
    expect(version).to.be(require("engine.io-client/package.json").version);
  });

  describe("engine()", () => {
    it("should create a Server when require called with no arguments", () => {
      const engine = new Server();
      expect(engine).to.be.an(Server);
      expect(engine.ws).to.be.ok();
    });

    it("should pass options correctly to the Server", () => {
      const engine = new Server({ cors: true });
      expect(engine.opts).to.have.property("cors", true);
    });
  });

  describe("listen", () => {
    it("should open a http server that returns 501", function (done) {
      if (process.env.EIO_WS_ENGINE === "uws") {
        return this.skip();
      }
      listen((port) => {
        request.get(`http://localhost:${port}`, (err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.be(501);
          done();
        });
      });
    });
  });

  describe("attach()", () => {
    it("should work from require()", () => {
      const server = http.createServer();
      const engine = new Server(server);

      expect(engine).to.be.an(Server);
    });

    it("should return an engine.Server", () => {
      const server = http.createServer();
      const engine = attach(server);

      expect(engine).to.be.an(Server);
    });

    it("should attach engine to an http server", (done) => {
      const server = http.createServer();
      attach(server);

      server.listen(() => {
        const uri = `http://localhost:${server.address().port}/engine.io/`;
        request.get(uri, (err, res) => {
          expect(err).to.be.an(Error);
          expect(res.status).to.be(400);
          expect(res.body.code).to.be(0);
          expect(res.body.message).to.be("Transport unknown");
          server.once("close", done);
          server.close();
        });
      });
    });

    it("should destroy upgrades not handled by engine", (done) => {
      const server = http.createServer();
      attach(server, { destroyUpgradeTimeout: 50 });

      server.listen(() => {
        const client = net.createConnection(server.address().port);
        client.setEncoding("ascii");
        client.write(
          [
            "GET / HTTP/1.1",
            "Connection: Upgrade",
            "Upgrade: IRC/6.9",
            "",
            "",
          ].join("\r\n"),
        );

        const check = setTimeout(() => {
          done(new Error("Client should have ended"));
        }, 100);

        client.on("end", () => {
          clearTimeout(check);
          done();
        });
      });
    });

    it("should not destroy unhandled upgrades with destroyUpgrade:false", (done) => {
      const server = http.createServer();
      attach(server, { destroyUpgrade: false, destroyUpgradeTimeout: 50 });

      server.listen(() => {
        const client = net.createConnection(server.address().port);
        client.on("connect", () => {
          client.setEncoding("ascii");
          client.write(
            [
              "GET / HTTP/1.1",
              "Connection: Upgrade",
              "Upgrade: IRC/6.9",
              "",
              "",
            ].join("\r\n"),
          );

          setTimeout(() => {
            client.removeListener("end", onEnd);
            done();
          }, 100);

          function onEnd() {
            done(new Error("Client should not end"));
          }

          client.on("end", onEnd);
        });
      });
    });

    it("should destroy unhandled upgrades with after a timeout", (done) => {
      const server = http.createServer();
      attach(server, { destroyUpgradeTimeout: 200 });

      server.listen(() => {
        const client = net.createConnection(server.address().port);
        client.on("connect", () => {
          client.setEncoding("ascii");
          client.write(
            [
              "GET / HTTP/1.1",
              "Connection: Upgrade",
              "Upgrade: IRC/6.9",
              "",
              "",
            ].join("\r\n"),
          );

          // send from client to server
          // tests that socket is still alive
          // this will not keep the socket open as the server does not handle it
          setTimeout(() => {
            client.write("foo");
          }, 100);

          function onEnd() {
            done();
          }

          client.on("end", onEnd);
        });
      });
    });

    it("should not destroy handled upgrades with after a timeout", (done) => {
      const server = http.createServer();
      attach(server, { destroyUpgradeTimeout: 100 });

      // write to the socket to keep engine.io from closing it by writing before the timeout
      server.on("upgrade", (req, socket) => {
        socket.write("foo");
        socket.on("data", (chunk) => {
          expect(chunk.toString()).to.be("foo");
          socket.end();
        });
      });

      server.listen(() => {
        const client = net.createConnection(server.address().port);

        client.on("connect", () => {
          client.setEncoding("ascii");
          client.write(
            [
              "GET / HTTP/1.1",
              "Connection: Upgrade",
              "Upgrade: IRC/6.9",
              "",
              "",
            ].join("\r\n"),
          );

          // test that socket is still open by writing after the timeout period
          setTimeout(() => {
            client.write("foo");
          }, 200);

          client.on("data", (data) => {});

          client.on("end", done);
        });
      });
    });

    it("should preserve original request listeners", (done) => {
      let listeners = 0;
      const server = http.createServer((req, res) => {
        expect(req && res).to.be.ok();
        listeners++;
      });

      server.on("request", (req, res) => {
        expect(req && res).to.be.ok();
        res.writeHead(200);
        res.end("");
        listeners++;
      });

      attach(server);

      server.listen(() => {
        const port = server.address().port;
        request.get(
          `http://localhost:${port}/engine.io/default/`,
          (err, res) => {
            expect(err).to.be.an(Error);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be("Transport unknown");
            request.get(`http://localhost:${port}/test`, (err, res) => {
              expect(err).to.be(null);
              expect(res.status).to.be(200);
              expect(listeners).to.eql(2);
              server.once("close", done);
              server.close();
            });
          },
        );
      });
    });
  });
});
