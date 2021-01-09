/* eslint-disable standard/no-callback-literal */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;
const zlib = require("zlib");
const eio = require("..");
const eioc = require("./common").eioc;
const listen = require("./common").listen;
const expect = require("expect.js");
const request = require("superagent");
const cookieMod = require("cookie");

/**
 * Tests.
 */

describe("server", () => {
  describe("verification", () => {
    it("should disallow non-existent transports", done => {
      listen(port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "tobi" }) // no tobi transport - outrageous
          .end((err, res) => {
            expect(err).to.be.an(Error);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be("Transport unknown");
            done();
          });
      });
    });

    it("should disallow `constructor` as transports", done => {
      // make sure we check for actual properties - not those present on every {}
      listen(port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .set("Origin", "http://engine.io")
          .query({ transport: "constructor" })
          .end((err, res) => {
            expect(err).to.be.an(Error);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be("Transport unknown");
            done();
          });
      });
    });

    it("should disallow non-existent sids", done => {
      listen(port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .set("Origin", "http://engine.io")
          .query({ transport: "polling", sid: "test" })
          .end((err, res) => {
            expect(err).to.be.an(Error);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(1);
            expect(res.body.message).to.be("Session ID unknown");
            done();
          });
      });
    });

    it("should disallow requests that are rejected by `allowRequest`", done => {
      listen(
        {
          allowRequest: (req, fn) => {
            fn("Thou shall not pass", false);
          }
        },
        port => {
          request
            .get("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://engine.io")
            .query({ transport: "polling" })
            .end((err, res) => {
              expect(err).to.be.an(Error);
              expect(res.status).to.be(403);
              expect(res.body.code).to.be(4);
              expect(res.body.message).to.be("Thou shall not pass");
              done();
            });
        }
      );
    });

    it("should disallow connection that are rejected by `allowRequest`", done => {
      listen(
        {
          allowRequest: (req, fn) => {
            fn(null, false);
          }
        },
        port => {
          const client = eioc("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          client.on("error", () => {
            done();
          });
        }
      );
    });
  });

  describe("handshake", () => {
    it("should send the io cookie", done => {
      listen({ cookie: true }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            // hack-obtain sid
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/; HttpOnly; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the io cookie custom name", done => {
      listen({ cookie: { name: "woot" } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `woot=${sid}; Path=/; HttpOnly; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the cookie with custom path", done => {
      listen({ cookie: { path: "/custom" } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/custom; HttpOnly; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the cookie with path=false", done => {
      listen({ cookie: { path: false } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the io cookie with httpOnly=true", done => {
      listen({ cookie: { httpOnly: true } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/; HttpOnly; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the io cookie with sameSite=strict", done => {
      listen({ cookie: { sameSite: "strict" } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/; HttpOnly; SameSite=Strict`
            );
            done();
          });
      });
    });

    it("should send the io cookie with httpOnly=false", done => {
      listen({ cookie: { httpOnly: false } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should send the io cookie with httpOnly not boolean", done => {
      listen({ cookie: { httpOnly: "no" } }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling", b64: 1 })
          .end((err, res) => {
            expect(err).to.be(null);
            const sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers["set-cookie"][0]).to.be(
              `io=${sid}; Path=/; HttpOnly; SameSite=Lax`
            );
            done();
          });
      });
    });

    it("should not send the io cookie", done => {
      listen({ cookie: false }, port => {
        request
          .get("http://localhost:%d/engine.io/default/".s(port))
          .query({ transport: "polling" })
          .end((err, res) => {
            expect(err).to.be(null);
            expect(res.headers["set-cookie"]).to.be(undefined);
            done();
          });
      });
    });

    it("should register a new client", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          done();
        });
      });
    });

    it("should register a new client with custom id", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        const customId = "CustomId" + Date.now();

        engine.generateId = req => customId;

        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.once("open", () => {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          expect(socket.id).to.be(customId);
          expect(engine.clients[customId].id).to.be(customId);
          done();
        });
      });
    });

    it("should register a new client with custom id (with a Promise)", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const customId = "CustomId" + Date.now();

        engine.generateId = () => Promise.resolve(customId);

        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.once("open", () => {
          expect(socket.id).to.be(customId);
          expect(engine.clients[customId].id).to.be(customId);
          done();
        });
      });
    });

    it("should disallow connection that are rejected by `generateId`", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        engine.generateId = () => {
          return Promise.reject(new Error("nope"));
        };

        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("error", () => {
          done();
        });
      });
    });

    it("should exchange handshake data", done => {
      listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("handshake", obj => {
          expect(obj.sid).to.be.a("string");
          expect(obj.pingTimeout).to.be.a("number");
          expect(obj.upgrades).to.be.an("array");
          done();
        });
      });
    });

    it("should allow custom ping timeouts", done => {
      listen({ allowUpgrades: false, pingTimeout: 123 }, port => {
        const socket = new eioc.Socket("http://localhost:%d".s(port));
        socket.on("handshake", obj => {
          expect(obj.pingTimeout).to.be(123);
          done();
        });
      });
    });

    it("should trigger a connection event with a Socket", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        eioc("ws://localhost:%d".s(port));
        engine.on("connection", socket => {
          expect(socket).to.be.an(eio.Socket);
          done();
        });
      });
    });

    it("should open with polling by default", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        eioc("ws://localhost:%d".s(port));
        engine.on("connection", socket => {
          expect(socket.transport.name).to.be("polling");
          done();
        });
      });
    });

    it("should be able to open with ws directly", done => {
      const engine = listen({ transports: ["websocket"] }, port => {
        eioc("ws://localhost:%d".s(port), { transports: ["websocket"] });
        engine.on("connection", socket => {
          expect(socket.transport.name).to.be("websocket");
          done();
        });
      });
    });

    it("should not suggest any upgrades for websocket", done => {
      listen({ transports: ["websocket"] }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        socket.on("handshake", obj => {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it("should not suggest upgrades when none are availble", done => {
      listen({ transports: ["polling"] }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {});
        socket.on("handshake", obj => {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it("should only suggest available upgrades", done => {
      listen({ transports: ["polling"] }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {});
        socket.on("handshake", obj => {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it("should suggest all upgrades when no transports are disabled", done => {
      listen({}, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {});
        socket.on("handshake", obj => {
          expect(obj.upgrades).to.have.length(1);
          expect(obj.upgrades).to.have.contain("websocket");
          done();
        });
      });
    });

    it("default to polling when proxy doesn't support websocket", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        engine.on("connection", socket => {
          socket.on("message", msg => {
            if ("echo" === msg) socket.send(msg);
          });
        });

        var socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          request
            .get("http://localhost:%d/engine.io/".s(port))
            .set({ connection: "close" })
            .query({ transport: "websocket", sid: socket.id })
            .end((err, res) => {
              expect(err).to.be.an(Error);
              expect(res.status).to.be(400);
              expect(res.body.code).to.be(3);
              socket.send("echo");
              socket.on("message", msg => {
                expect(msg).to.be("echo");
                done();
              });
            });
        });
      });
    });

    it("should allow arbitrary data through query string", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        eioc("ws://localhost:%d".s(port), { query: { a: "b" } });
        engine.on("connection", conn => {
          expect(conn.request._query).to.have.keys("transport", "a");
          expect(conn.request._query.a).to.be("b");
          done();
        });
      });
    });

    it("should allow data through query string in uri", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        eioc("ws://localhost:%d?a=b&c=d".s(port));
        engine.on("connection", conn => {
          expect(conn.request._query.EIO).to.be.a("string");
          expect(conn.request._query.a).to.be("b");
          expect(conn.request._query.c).to.be("d");
          done();
        });
      });
    });

    it("should disallow bad requests", done => {
      listen(
        {
          cors: { credentials: true, origin: "http://engine.io" }
        },
        port => {
          request
            .get("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://engine.io")
            .query({ transport: "websocket" })
            .end((err, res) => {
              expect(err).to.be.an(Error);
              expect(res.status).to.be(400);
              expect(res.body.code).to.be(3);
              expect(res.body.message).to.be("Bad request");
              expect(res.header["access-control-allow-credentials"]).to.be(
                "true"
              );
              expect(res.header["access-control-allow-origin"]).to.be(
                "http://engine.io"
              );
              done();
            });
        }
      );
    });

    it("should disallow unsupported protocol versions", done => {
      const httpServer = http.createServer();
      const engine = eio({ allowEIO3: false });
      engine.attach(httpServer);
      httpServer.listen(() => {
        const port = httpServer.address().port;
        request
          .get("http://localhost:%d/engine.io/".s(port))
          .query({ transport: "polling", EIO: 3 })
          .end((err, res) => {
            expect(err).to.be.an(Error);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(5);
            expect(res.body.message).to.be("Unsupported protocol version");
            engine.close();
            done();
          });
      });
    });

    it("should send a packet along with the handshake", done => {
      listen({ initialPacket: "faster!" }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be("faster!");
            done();
          });
        });
      });
    });
  });

  describe("close", () => {
    it("should be able to access non-empty writeBuffer at closing (server)", done => {
      const opts = { allowUpgrades: false };
      const engine = listen(opts, port => {
        eioc("http://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(conn.writeBuffer.length).to.be(1);
            setTimeout(() => {
              expect(conn.writeBuffer.length).to.be(0); // writeBuffer has been cleared
            }, 10);
            done();
          });
          conn.writeBuffer.push({ type: "message", data: "foo" });
          conn.onError("");
        });
      });
    });

    it("should be able to access non-empty writeBuffer at closing (client)", done => {
      const opts = { allowUpgrades: false };
      listen(opts, port => {
        const socket = new eioc.Socket("http://localhost:%d".s(port));
        socket.on("open", () => {
          socket.on("close", reason => {
            expect(socket.writeBuffer.length).to.be(1);
            setTimeout(() => {
              expect(socket.writeBuffer.length).to.be(0);
            }, 10);
            done();
          });
          socket.writeBuffer.push({ type: "message", data: "foo" });
          socket.onError("");
        });
      });
    });

    it("should trigger on server if the client does not pong", done => {
      const opts = { allowUpgrades: false, pingInterval: 5, pingTimeout: 5 };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("http://localhost:%d".s(port));
        socket.sendPacket = () => {};
        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("ping timeout");
            done();
          });
        });
      });
    });

    it("should trigger on server even when there is no outstanding polling request (GH-198)", done => {
      const opts = {
        allowUpgrades: false,
        pingInterval: 500,
        pingTimeout: 500
      };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("http://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("ping timeout");
            done();
          });
          // client abruptly disconnects, no polling request on this tick since we've just connected
          socket.sendPacket = socket.onPacket = () => {};
          socket.close();
          // then server app tries to close the socket, since client disappeared
          conn.close();
        });
      });
    });

    it("should trigger on client if server does not meet ping timeout", done => {
      const opts = { allowUpgrades: false, pingInterval: 50, pingTimeout: 30 };
      listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          // override onPacket and Transport#onClose to simulate an inactive server after handshake
          socket.onPacket = () => {};
          socket.transport.onClose = () => {};
          socket.on("close", (reason, err) => {
            expect(reason).to.be("ping timeout");
            done();
          });
        });
      });
    });

    it("should trigger on both ends upon ping timeout", done => {
      const opts = { allowUpgrades: false, pingTimeout: 50, pingInterval: 50 };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        let total = 2;

        function onClose(reason, err) {
          expect(reason).to.be("ping timeout");
          --total || done();
        }

        engine.on("connection", conn => {
          conn.on("close", onClose);
        });

        socket.on("open", () => {
          // override onPacket and Transport#onClose to simulate an inactive server after handshake
          socket.onPacket = socket.sendPacket = () => {};
          socket.transport.onClose = () => {};
          socket.on("close", onClose);
        });
      });
    });

    it("should trigger when server closes a client", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        let total = 2;

        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("forced close");
            --total || done();
          });
          setTimeout(() => {
            conn.close();
          }, 10);
        });

        socket.on("open", () => {
          socket.on("close", reason => {
            expect(reason).to.be("transport close");
            --total || done();
          });
        });
      });
    });

    it("should trigger when server closes a client (ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        let total = 2;

        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("forced close");
            --total || done();
          });
          setTimeout(() => {
            conn.close();
          }, 10);
        });

        socket.on("open", () => {
          socket.on("close", reason => {
            expect(reason).to.be("transport close");
            --total || done();
          });
        });
      });
    });

    it("should allow client reconnect after restarting (ws)", done => {
      const opts = { transports: ["websocket"] };
      const engine = listen(opts, port => {
        engine.httpServer.close();
        engine.httpServer.listen(port);

        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });

        engine.once("connection", conn => {
          setTimeout(() => {
            conn.close();
          }, 10);
        });

        socket.once("close", reason => {
          expect(reason).to.be("transport close");
          done();
        });
      });
    });

    it("should trigger when client closes", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        let total = 2;

        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("transport close");
            --total || done();
          });
        });

        socket.on("open", () => {
          socket.on("close", reason => {
            expect(reason).to.be("forced close");
            --total || done();
          });

          setTimeout(() => {
            socket.close();
          }, 10);
        });
      });
    });

    it("should trigger when client closes (ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        let total = 2;

        engine.on("connection", conn => {
          conn.on("close", reason => {
            expect(reason).to.be("transport close");
            --total || done();
          });
        });

        socket.on("open", () => {
          socket.on("close", reason => {
            expect(reason).to.be("forced close");
            --total || done();
          });

          setTimeout(() => {
            socket.close();
          }, 10);
        });
      });
    });

    it("should trigger when calling socket.close() in payload", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));

        engine.on("connection", conn => {
          conn.send(null, () => {
            socket.close();
          });
          conn.send("this should not be handled");

          conn.on("close", reason => {
            expect(reason).to.be("transport close");
            done();
          });
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.not.be("this should not be handled");
          });

          socket.on("close", reason => {
            expect(reason).to.be("forced close");
          });
        });
      });
    });

    it("should abort upgrade if socket is closed (GH-35)", done => {
      listen({ allowUpgrades: true }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          socket.close();
          // we wait until complete to see if we get an uncaught EPIPE
          setTimeout(() => {
            done();
          }, 100);
        });
      });
    });

    it("should abort connection when upgrade fails", done => {
      listen({ allowUpgrades: true }, port => {
        const req = http.request(
          {
            port,
            path: "/engine.io/",
            headers: {
              connection: "Upgrade",
              upgrade: "websocket"
            }
          },
          res => {
            expect(res.statusCode).to.eql(400);
            res.resume();
            res.on("end", done);
          }
        );
        req.end();
      });
    });

    it(
      "should trigger if a poll request is ongoing and the underlying " +
        "socket closes, as in a browser tab close",
      $done => {
        const engine = listen({ allowUpgrades: false }, port => {
          // hack to access the sockets created by node-xmlhttprequest
          // see: https://github.com/driverdan/node-XMLHttpRequest/issues/44
          const request = require("http").request;
          const sockets = [];
          http.request = function(opts) {
            const req = request.apply(null, arguments);
            req.on("socket", socket => {
              sockets.push(socket);
            });
            return req;
          };

          function done() {
            http.request = request;
            $done();
          }

          var socket = new eioc.Socket("ws://localhost:%d".s(port));
          let serverSocket;

          engine.on("connection", s => {
            serverSocket = s;
          });

          socket.transport.on("poll", () => {
            // we set a timer to wait for the request to actually reach
            setTimeout(() => {
              // at this time server's `connection` should have been fired
              expect(serverSocket).to.be.an("object");

              // OPENED readyState is expected - we are actually polling
              expect(socket.transport.pollXhr.xhr.readyState).to.be(1);

              // 2 requests sent to the server over an unique port means
              // we should have been assigned 2 sockets
              expect(sockets.length).to.be(2);

              // expect the socket to be open at this point
              expect(serverSocket.readyState).to.be("open");

              // kill the underlying connection
              sockets[1].end();
              serverSocket.on("close", (reason, err) => {
                expect(reason).to.be("transport error");
                expect(err.message).to.be("poll connection closed prematurely");
                done();
              });
            }, 50);
          });
        });
      }
    );

    it("should not trigger with connection: close header", $done => {
      const engine = listen({ allowUpgrades: false }, port => {
        // intercept requests to add connection: close
        const request = http.request;
        http.request = function() {
          const opts = arguments[0];
          opts.headers = opts.headers || {};
          opts.headers.Connection = "close";
          return request.apply(this, arguments);
        };

        function done() {
          http.request = request;
          $done();
        }

        engine.on("connection", socket => {
          socket.on("message", msg => {
            expect(msg).to.equal("test");
            socket.send("woot");
          });
        });

        var socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          socket.send("test");
        });
        socket.on("message", msg => {
          expect(msg).to.be("woot");
          done();
        });
      });
    });

    it(
      "should not trigger early with connection `ping timeout`" +
        "after post handshake timeout",
      done => {
        // first timeout should trigger after `pingInterval + pingTimeout`,
        // not just `pingTimeout`.
        const opts = {
          allowUpgrades: false,
          pingInterval: 300,
          pingTimeout: 100
        };
        listen(opts, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          let clientCloseReason = null;

          socket.on("handshake", () => {
            socket.onPacket = () => {};
          });
          socket.on("open", () => {
            socket.on("close", reason => {
              clientCloseReason = reason;
            });
          });

          setTimeout(() => {
            expect(clientCloseReason).to.be(null);
            done();
          }, 200);
        });
      }
    );

    it(
      "should not trigger early with connection `ping timeout` " +
        "after post ping timeout",
      done => {
        // ping timeout should trigger after `pingInterval + pingTimeout`,
        // not just `pingTimeout`.
        const opts = {
          allowUpgrades: false,
          pingInterval: 80,
          pingTimeout: 50
        };
        const engine = listen(opts, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          let clientCloseReason = null;

          engine.on("connection", conn => {
            conn.on("heartbeat", () => {
              conn.onPacket = () => {};
            });
          });

          socket.on("open", () => {
            socket.on("close", reason => {
              clientCloseReason = reason;
            });
          });

          setTimeout(() => {
            expect(clientCloseReason).to.be(null);
            done();
          }, 100);
        });
      }
    );

    it(
      "should trigger early with connection `transport close` " +
        "after missing pong",
      done => {
        // ping timeout should trigger after `pingInterval + pingTimeout`,
        // not just `pingTimeout`.
        const opts = {
          allowUpgrades: false,
          pingInterval: 80,
          pingTimeout: 50
        };
        const engine = listen(opts, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          let clientCloseReason = null;

          socket.on("open", () => {
            socket.on("close", reason => {
              clientCloseReason = reason;
            });
          });

          engine.on("connection", conn => {
            conn.on("heartbeat", () => {
              setTimeout(() => {
                conn.close();
              }, 20);
              setTimeout(() => {
                expect(clientCloseReason).to.be("transport close");
                done();
              }, 100);
            });
          });
        });
      }
    );

    if (process.env.EIO_CLIENT === "3") {
      it(
        "should trigger with connection `ping timeout` " +
          "after `pingInterval + pingTimeout`",
        done => {
          const opts = {
            allowUpgrades: false,
            pingInterval: 300,
            pingTimeout: 100
          };
          const engine = listen(opts, port => {
            const socket = new eioc.Socket("ws://localhost:%d".s(port));
            let clientCloseReason = null;

            socket.on("open", () => {
              socket.on("close", reason => {
                clientCloseReason = reason;
              });
            });

            engine.on("connection", conn => {
              conn.once("heartbeat", () => {
                setTimeout(() => {
                  socket.onPacket = () => {};
                  expect(clientCloseReason).to.be(null);
                }, 150);
                setTimeout(() => {
                  expect(clientCloseReason).to.be(null);
                }, 350);
                setTimeout(() => {
                  expect(clientCloseReason).to.be("ping timeout");
                  done();
                }, 500);
              });
            });
          });
        }
      );
    } else {
      it(
        "should trigger with connection `ping timeout` " +
          "after `pingInterval + pingTimeout`",
        done => {
          const opts = {
            allowUpgrades: false,
            pingInterval: 300,
            pingTimeout: 100
          };
          const engine = listen(opts, port => {
            const socket = new eioc.Socket("ws://localhost:%d".s(port));
            let clientCloseReason = null;

            socket.on("open", () => {
              socket.on("close", reason => {
                clientCloseReason = reason;
              });
            });

            engine.on("connection", conn => {
              conn.once("heartbeat", () => {
                socket.onPacket = () => {};
                setTimeout(() => {
                  expect(clientCloseReason).to.be(null);
                }, 150);
                setTimeout(() => {
                  expect(clientCloseReason).to.be(null);
                }, 350);
                setTimeout(() => {
                  expect(clientCloseReason).to.be("ping timeout");
                  done();
                }, 500);
              });
            });
          });
        }
      );
    }

    it(
      "should abort the polling data request if it is " + "in progress",
      done => {
        const engine = listen({ transports: ["polling"] }, port => {
          const socket = new eioc.Socket("http://localhost:%d".s(port));

          engine.on("connection", conn => {
            const onDataRequest = conn.transport.onDataRequest;
            conn.transport.onDataRequest = (req, res) => {
              engine.httpServer.close(done);
              onDataRequest.call(conn.transport, req, res);
              req.removeAllListeners();
              conn.close();
            };
          });

          socket.on("open", () => {
            socket.send("test");
          });
        });
      }
    );

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // websocket test, transport error
    it("should trigger transport close before open for ws", done => {
      const opts = { transports: ["websocket"] };
      listen(opts, port => {
        const url = "ws://%s:%d".s("0.0.0.0", port);
        const socket = new eioc.Socket(url);
        socket.on("open", () => {
          done(new Error("Test invalidation"));
        });
        socket.on("close", reason => {
          expect(reason).to.be("transport error");
          done();
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // polling test, transport error
    it("should trigger transport close before open for xhr", done => {
      const opts = { transports: ["polling"] };
      listen(opts, port => {
        const socket = new eioc.Socket("http://invalidserver:%d".s(port));
        socket.on("open", () => {
          done(new Error("Test invalidation"));
        });
        socket.on("close", reason => {
          expect(reason).to.be("transport error");
          done();
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // websocket test, force close
    it("should trigger force close before open for ws", done => {
      const opts = { transports: ["websocket"] };
      listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          done(new Error("Test invalidation"));
        });
        socket.on("close", reason => {
          expect(reason).to.be("forced close");
          done();
        });
        socket.close();
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // polling test, force close
    it("should trigger force close before open for xhr", done => {
      const opts = { transports: ["polling"] };
      listen(opts, port => {
        const socket = new eioc.Socket("http://localhost:%d".s(port));
        socket.on("open", () => {
          done(new Error("Test invalidation"));
        });
        socket.on("close", reason => {
          expect(reason).to.be("forced close");
          done();
        });
        socket.close();
      });
    });

    it("should close transport upon ping timeout (ws)", done => {
      const opts = {
        allowUpgrades: false,
        transports: ["websocket"],
        pingInterval: 50,
        pingTimeout: 30
      };
      const engine = listen(opts, port => {
        engine.on("connection", conn => {
          conn.transport.on("close", done);
        });
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        // override to simulate an inactive client
        socket.sendPacket = socket.onHeartbeat = () => {};
      });
    });

    it("should close transport upon ping timeout (polling)", done => {
      const opts = {
        allowUpgrades: false,
        transports: ["polling"],
        pingInterval: 50,
        pingTimeout: 30
      };
      const engine = listen(opts, port => {
        engine.on("connection", conn => {
          conn.transport.on("close", done);
        });
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["polling"]
        });
        // override to simulate an inactive client
        socket.sendPacket = socket.onHeartbeat = () => {};
      });
    });

    it("should close transport upon parse error (ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        engine.on("connection", conn => {
          conn.transport.on("close", done);
        });
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        socket.on("open", () => {
          socket.transport.ws.send("invalid");
        });
      });
    });

    it("should close transport upon parse error (polling)", done => {
      const opts = { allowUpgrades: false, transports: ["polling"] };
      const engine = listen(opts, port => {
        engine.on("connection", conn => {
          conn.transport.closeTimeout = 100;
          conn.transport.on("close", done);
        });
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["polling"]
        });
        socket.on("open", () => {
          socket.transport.doWrite("invalid", () => {});
        });
      });
    });

    it("should close upgrading transport upon socket close", done => {
      const engine = listen(port => {
        engine.on("connection", conn => {
          conn.on("upgrading", transport => {
            transport.on("close", done);
            conn.close();
          });
        });
        eioc("ws://localhost:%d".s(port));
      });
    });

    it("should close upgrading transport upon upgrade timeout", done => {
      const opts = { upgradeTimeout: 100 };
      const engine = listen(opts, port => {
        engine.on("connection", conn => {
          conn.on("upgrading", transport => {
            transport.on("close", done);
          });
        });
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("upgrading", transport => {
          // override not to complete upgrading
          transport.send = () => {};
        });
      });
    });

    it("should not crash when messing with Object prototype", done => {
      Object.prototype.foo = "bar"; // eslint-disable-line no-extend-native
      const engine = listen({ allowUpgrades: true }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          engine.close();
          setTimeout(() => {
            done();
          }, 100);
        });
      });
    });

    describe("graceful close", () => {
      function fixture(filename) {
        return (
          process.execPath + " " + path.join(__dirname, "fixtures", filename)
        );
      }

      it("should stop socket and timers", done => {
        exec(fixture("server-close.js"), done);
      });

      it("should stop upgraded socket and timers", done => {
        exec(fixture("server-close-upgraded.js"), done);
      });

      it("should stop upgrading socket and timers", done => {
        exec(fixture("server-close-upgrading.js"), done);
      });
    });
  });

  describe("messages", function() {
    this.timeout(5000);

    it("should arrive from server to client", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.send("a");
        });
        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be("a");
            done();
          });
        });
      });
    });

    it("should arrive from server to client (multiple)", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        const expected = ["a", "b", "c"];
        let i = 0;

        engine.on("connection", conn => {
          conn.send("a");
          // we use set timeouts to ensure the messages are delivered as part
          // of different.
          setTimeout(() => {
            conn.send("b");

            setTimeout(() => {
              // here we make sure we buffer both the close packet and
              // a regular packet
              conn.send("c");
              conn.close();
            }, 50);
          }, 50);

          conn.on("close", () => {
            // since close fires right after the buffer is drained
            setTimeout(() => {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });
        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it("should not be receiving data when getting a message longer than maxHttpBufferSize when polling", done => {
      const opts = {
        allowUpgrades: false,
        transports: ["polling"],
        maxHttpBufferSize: 5
      };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("message", msg => {
            done(
              new Error("Test invalidation (message is longer than allowed)")
            );
          });
        });
        socket.on("open", () => {
          socket.send("aasdasdakjhasdkjhasdkjhasdkjhasdkjhasdkjhasdkjha");
        });
        socket.on("close", () => {
          done();
        });
      });
    });

    it("should not be receiving data when getting a message longer than maxHttpBufferSize (websocket)", done => {
      const opts = { maxHttpBufferSize: 5 };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        engine.on("connection", conn => {
          conn.on("message", msg => {
            done(
              new Error("Test invalidation (message is longer than allowed)")
            );
          });
        });
        socket.on("open", () => {
          socket.send("aasdasdakjhasdkjhasdkjhasdkjhasdkjhasdkjhasdkjha");
        });
        socket.on("close", () => {
          done();
        });
      });
    });

    it("should receive data when getting a message shorter than maxHttpBufferSize when polling", done => {
      const opts = {
        allowUpgrades: false,
        transports: ["polling"],
        maxHttpBufferSize: 5
      };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("a");
            done();
          });
        });
        socket.on("open", () => {
          socket.send("a");
        });
      });
    });

    it("should arrive from server to client (ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        engine.on("connection", conn => {
          conn.send("a");
        });
        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be("a");
            done();
          });
        });
      });
    });

    it("should arrive from server to client (multiple, ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        const expected = ["a", "b", "c"];
        let i = 0;

        engine.on("connection", conn => {
          conn.send("a");
          setTimeout(() => {
            conn.send("b");
            setTimeout(() => {
              conn.send("c");
              conn.close();
            }, 50);
          }, 50);
          conn.on("close", () => {
            setTimeout(() => {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it("should arrive from server to client (multiple, no delay, ws)", done => {
      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        const expected = ["a", "b", "c"];
        let i = 0;

        engine.on("connection", conn => {
          conn.on("close", () => {
            setTimeout(() => {
              expect(i).to.be(3);
              done();
            }, 50);
          });
          conn.send("a");
          conn.send("b");
          conn.send("c");
          conn.close();
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it("should arrive when binary data is sent as Int8Array (ws)", done => {
      const binaryData = new Int8Array(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = i;
      }

      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            for (let i = 0; i < binaryData.length; i++) {
              const num = msg.readInt8(i);
              expect(num).to.be(i);
            }
            done();
          });
        });
      });
    });

    it("should arrive when binary data is sent as Int32Array (ws)", done => {
      const binaryData = new Int32Array(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = (i + 100) * 9823;
      }

      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            let i = 0,
              ii = 0;
            for (; ii < binaryData.length; i += 4, ii++) {
              const num = msg.readInt32LE(i);
              expect(num).to.be((ii + 100) * 9823);
            }
            done();
          });
        });
      });
    });

    it("should arrive when binary data is sent as Int32Array, given as ArrayBuffer(ws)", done => {
      const binaryData = new Int32Array(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = (i + 100) * 9823;
      }

      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });

        engine.on("connection", conn => {
          conn.send(binaryData.buffer);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            let i = 0,
              ii = 0;
            for (; ii < binaryData.length; i += 4, ii++) {
              const num = msg.readInt32LE(i);
              expect(num).to.be((ii + 100) * 9823);
            }
            done();
          });
        });
      });
    });

    it("should arrive when binary data is sent as Buffer (ws)", done => {
      const binaryData = Buffer.allocUnsafe(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            for (let i = 0; i < binaryData.length; i++) {
              const num = msg.readInt8(i);
              expect(num).to.be(i);
            }
            done();
          });
        });
      });
    });

    it("should arrive when binary data sent as Buffer (polling)", done => {
      const binaryData = Buffer.allocUnsafe(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      const opts = { allowUpgrades: false, transports: ["polling"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["polling"]
        });

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            for (let i = 0; i < binaryData.length; i++) {
              const num = msg.readInt8(i);
              expect(num).to.be(i);
            }

            done();
          });
        });
      });
    });

    it("should arrive as ArrayBuffer if requested when binary data sent as Buffer (ws)", done => {
      const binaryData = Buffer.allocUnsafe(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      const opts = { allowUpgrades: false, transports: ["websocket"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["websocket"]
        });
        socket.binaryType = "arraybuffer";

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg instanceof ArrayBuffer).to.be(true);
            const intArray = new Int8Array(msg);
            for (let i = 0; i < binaryData.length; i++) {
              expect(intArray[i]).to.be(i);
            }

            done();
          });
        });
      });
    });

    it("should arrive as ArrayBuffer if requested when binary data sent as Buffer (polling)", done => {
      const binaryData = Buffer.allocUnsafe(5);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      const opts = { allowUpgrades: false, transports: ["polling"] };
      const engine = listen(opts, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          transports: ["polling"]
        });
        socket.binaryType = "arraybuffer";

        engine.on("connection", conn => {
          conn.send(binaryData);
        });

        socket.on("open", () => {
          socket.on("message", msg => {
            expect(msg instanceof ArrayBuffer).to.be(true);
            const intArray = new Int8Array(msg);
            for (let i = 0; i < binaryData.length; i++) {
              expect(intArray[i]).to.be(i);
            }

            done();
          });
        });
      });
    });

    it("should trigger a flush/drain event", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        engine.on("connection", socket => {
          let totalEvents = 4;

          engine.on("flush", (sock, buf) => {
            expect(sock).to.be(socket);
            expect(buf).to.be.an("array");
            --totalEvents || done();
          });
          socket.on("flush", buf => {
            expect(buf).to.be.an("array");
            --totalEvents || done();
          });

          engine.on("drain", sock => {
            expect(sock).to.be(socket);
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });
          socket.on("drain", () => {
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });

          socket.send("aaaa");
        });

        eioc("ws://localhost:%d".s(port));
      });
    });

    it(
      "should interleave with pongs if many messages buffered " +
        "after connection open",
      function(done) {
        this.slow(4000);
        this.timeout(8000);

        const opts = {
          transports: ["websocket"],
          pingInterval: 200,
          pingTimeout: 100
        };

        const engine = listen(opts, port => {
          const messageCount = 100;
          const messagePayload = new Array(256 * 256).join("a");
          let connection = null;
          engine.on("connection", conn => {
            connection = conn;
          });
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          socket.on("open", () => {
            for (let i = 0; i < messageCount; i++) {
              //            connection.send('message: ' + i);   // works
              connection.send(messagePayload + "|message: " + i); // does not work
            }
            let receivedCount = 0;
            socket.on("message", msg => {
              receivedCount += 1;
              if (receivedCount === messageCount) {
                done();
              }
            });
          });
        });
      }
    );

    it("should support chinese", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        const shi = "石室詩士施氏，嗜獅，誓食十獅。";
        const shi2 = "氏時時適市視獅。";
        engine.on("connection", conn => {
          conn.send(".");
          conn.send(shi);
          conn.send(shi2);
          conn.once("message", msg0 => {
            expect(msg0).to.be(".");
            conn.once("message", msg => {
              expect(msg).to.be(shi);
              conn.once("message", msg2 => {
                expect(msg2).to.be(shi2);
                done();
              });
            });
          });
        });
        socket.on("open", () => {
          socket.once("message", msg0 => {
            expect(msg0).to.be(".");
            socket.once("message", msg => {
              expect(msg).to.be(shi);
              socket.once("message", msg2 => {
                expect(msg2).to.be(shi2);
                socket.send(".");
                socket.send(shi);
                socket.send(shi2);
              });
            });
          });
        });
      });
    });

    it("should send and receive data with key and cert (polling)", done => {
      const srvOpts = {
        key: fs.readFileSync("test/fixtures/server.key"),
        cert: fs.readFileSync("test/fixtures/server.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        requestCert: true,
        rejectUnauthorized: true
      };

      const opts = {
        key: fs.readFileSync("test/fixtures/client.key"),
        cert: fs.readFileSync("test/fixtures/client.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        transports: ["polling"]
      };

      const srv = https.createServer(srvOpts, (req, res) => {
        res.writeHead(200);
        res.end("hello world\n");
      });

      const engine = eio({
        transports: ["polling"],
        allowUpgrades: false,
        allowEIO3: true
      });
      engine.attach(srv);
      srv.listen(() => {
        const port = srv.address().port;
        const socket = new eioc.Socket("https://localhost:%d".s(port), opts);

        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("hello");
            done();
          });
        });

        socket.on("open", () => {
          socket.send("hello");
        });
      });
    });

    it("should send and receive data with ca when not requiring auth (polling)", done => {
      const srvOpts = {
        key: fs.readFileSync("test/fixtures/server.key"),
        cert: fs.readFileSync("test/fixtures/server.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        requestCert: true,
        rejectUnauthorized: false
      };

      const opts = {
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        transports: ["polling"]
      };

      const srv = https.createServer(srvOpts, (req, res) => {
        res.writeHead(200);
        res.end("hello world\n");
      });

      const engine = eio({
        transports: ["polling"],
        allowUpgrades: false,
        allowEIO3: true
      });
      engine.attach(srv);
      srv.listen(() => {
        const port = srv.address().port;
        const socket = new eioc.Socket("https://localhost:%d".s(port), opts);

        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("hello");
            done();
          });
        });

        socket.on("open", () => {
          socket.send("hello");
        });
      });
    });

    it("should send and receive data with key and cert (ws)", done => {
      const srvOpts = {
        key: fs.readFileSync("test/fixtures/server.key"),
        cert: fs.readFileSync("test/fixtures/server.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        requestCert: true,
        rejectUnauthorized: true
      };

      const opts = {
        key: fs.readFileSync("test/fixtures/client.key"),
        cert: fs.readFileSync("test/fixtures/client.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        transports: ["websocket"]
      };

      const srv = https.createServer(srvOpts, (req, res) => {
        res.writeHead(200);
        res.end("hello world\n");
      });

      const engine = eio({
        transports: ["websocket"],
        allowUpgrades: false,
        allowEIO3: true
      });
      engine.attach(srv);
      srv.listen(() => {
        const port = srv.address().port;
        const socket = new eioc.Socket("https://localhost:%d".s(port), opts);

        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("hello");
            done();
          });
        });

        socket.on("open", () => {
          socket.send("hello");
        });
      });
    });

    it("should send and receive data with pfx (polling)", done => {
      const srvOpts = {
        key: fs.readFileSync("test/fixtures/server.key"),
        cert: fs.readFileSync("test/fixtures/server.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        requestCert: true,
        rejectUnauthorized: true
      };

      const opts = {
        pfx: fs.readFileSync("test/fixtures/client.pfx"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        transports: ["polling"]
      };

      const srv = https.createServer(srvOpts, (req, res) => {
        res.writeHead(200);
        res.end("hello world\n");
      });

      const engine = eio({
        transports: ["polling"],
        allowUpgrades: false,
        allowEIO3: true
      });
      engine.attach(srv);
      srv.listen(() => {
        const port = srv.address().port;
        const socket = new eioc.Socket("https://localhost:%d".s(port), opts);

        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("hello");
            done();
          });
        });

        socket.on("open", () => {
          socket.send("hello");
        });
      });
    });

    it("should send and receive data with pfx (ws)", done => {
      const srvOpts = {
        key: fs.readFileSync("test/fixtures/server.key"),
        cert: fs.readFileSync("test/fixtures/server.crt"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        requestCert: true,
        rejectUnauthorized: true
      };

      const opts = {
        pfx: fs.readFileSync("test/fixtures/client.pfx"),
        ca: fs.readFileSync("test/fixtures/ca.crt"),
        transports: ["websocket"]
      };

      const srv = https.createServer(srvOpts, (req, res) => {
        res.writeHead(200);
        res.end("hello world\n");
      });

      const engine = eio({
        transports: ["websocket"],
        allowUpgrades: false,
        allowEIO3: true
      });
      engine.attach(srv);
      srv.listen(() => {
        const port = srv.address().port;
        const socket = new eioc.Socket("https://localhost:%d".s(port), opts);

        engine.on("connection", conn => {
          conn.on("message", msg => {
            expect(msg).to.be("hello");
            done();
          });
        });

        socket.on("open", () => {
          socket.send("hello");
        });
      });
    });
  });

  describe("send", () => {
    describe("writeBuffer", () => {
      it("should not empty until `drain` event (polling)", done => {
        listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });
          let totalEvents = 2;
          socket.on("open", () => {
            socket.send("a");
            socket.send("b");
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on("drain", () => {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });

      it("should not empty until `drain` event (websocket)", done => {
        listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          let totalEvents = 2;
          socket.on("open", () => {
            socket.send("a");
            socket.send("b");
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on("drain", () => {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });
    });

    describe("callback", () => {
      it("should execute in order when message sent (client) (polling)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.on("message", msg => {
              conn.send(msg);
            });
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn() {
              socket.send(
                j,
                (value => {
                  j++;
                })(j)
              );
            }

            sendFn();
          });
        });
      });

      it("should execute in order when message sent (client) (websocket)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.on("message", msg => {
              conn.send(msg);
            });
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn() {
              socket.send(
                j,
                (value => {
                  j++;
                })(j)
              );
            }

            sendFn();
          });
        });
      });

      it("should execute in order with payloads (client) (polling)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });
          let i = 0;
          let lastCbFired = 0;

          engine.on("connection", conn => {
            conn.on("message", msg => {
              conn.send(msg);
            });
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb(value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value === 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once("flush", () => {
              socket.send(2, () => {
                cb(2);
              });
              socket.send(3, () => {
                cb(3);
              });
            });

            socket.send(1, () => {
              cb(1);
            });
          });
        });
      });

      it("should execute in order with payloads (client) (websocket)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          let i = 0;
          let lastCbFired = 0;

          engine.on("connection", conn => {
            conn.on("message", msg => {
              conn.send(msg);
            });
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb(value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value === 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once("flush", () => {
              socket.send(2, () => {
                cb(2);
              });
              socket.send(3, () => {
                cb(3);
              });
            });

            socket.send(1, () => {
              cb(1);
            });
          });
        });
      });

      it("should execute when message sent (polling)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.send("a", transport => {
              i++;
            });
          });
          socket.on("open", () => {
            socket.on("message", msg => {
              j++;
            });
          });

          setTimeout(() => {
            expect(i).to.be(j);
            done();
          }, 100);
        });
      });

      it("should execute when message sent (websocket)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["websocket"]
          });
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.send("a", transport => {
              i++;
            });
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              j++;
            });
          });

          setTimeout(() => {
            expect(i).to.be(j);
            done();
          }, 100);
        });
      });

      it("should execute once for each send", done => {
        const engine = listen(port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          let a = 0;
          let b = 0;
          let c = 0;
          let all = 0;

          engine.on("connection", conn => {
            conn.send("a");
            conn.send("b");
            conn.send("c");
          });

          socket.on("open", () => {
            socket.on("message", msg => {
              if (msg === "a") a++;
              if (msg === "b") b++;
              if (msg === "c") c++;

              if (++all === 3) {
                expect(a).to.be(1);
                expect(b).to.be(1);
                expect(c).to.be(1);
                done();
              }
            });
          });
        });
      });

      it("should execute in multipart packet", done => {
        const engine = listen(port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.send("b", transport => {
              i++;
            });

            conn.send("a", transport => {
              i++;
            });
          });
          socket.on("open", () => {
            socket.on("message", msg => {
              j++;
            });
          });

          setTimeout(() => {
            expect(i).to.be(j);
            done();
          }, 200);
        });
      });

      it("should execute in multipart packet (polling)", done => {
        const engine = listen(port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });
          let i = 0;
          let j = 0;

          engine.on("connection", conn => {
            conn.send("d", transport => {
              i++;
            });

            conn.send("c", transport => {
              i++;
            });

            conn.send("b", transport => {
              i++;
            });

            conn.send("a", transport => {
              i++;
            });
          });
          socket.on("open", () => {
            socket.on("message", msg => {
              j++;
            });
          });

          setTimeout(() => {
            expect(i).to.be(j);
            done();
          }, 200);
        });
      });

      it("should clean callback references when socket gets closed with pending callbacks", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });

          engine.on("connection", conn => {
            socket.transport.on("pollComplete", () => {
              conn.send("a", transport => {
                done(new Error("Test invalidation"));
              });

              if (!conn.writeBuffer.length) {
                done(new Error("Test invalidation"));
              }

              // force to close the socket when we have one or more packet(s) in buffer
              socket.close();
            });

            conn.on("close", reason => {
              expect(conn.packetsFn).to.be.empty();
              expect(conn.sentCallbackFn).to.be.empty();
              done();
            });
          });
        });
      });

      it("should not execute when it is not actually sent (polling)", done => {
        const engine = listen({ allowUpgrades: false }, port => {
          const socket = new eioc.Socket("ws://localhost:%d".s(port), {
            transports: ["polling"]
          });

          socket.transport.on("pollComplete", msg => {
            socket.close();
          });

          engine.on("connection", conn => {
            let err;
            conn.send("a");
            conn.send("b", transport => {
              err = new Error("Test invalidation");
            });
            conn.on("close", reason => {
              done(err);
            });
          });
        });
      });
    });
  });

  describe("packet", () => {
    it("should emit when socket receives packet", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("packet", packet => {
            expect(packet.type).to.be("message");
            expect(packet.data).to.be("a");
            done();
          });
        });
        socket.on("open", () => {
          socket.send("a");
        });
      });
    });

    it("should emit when receives pong", done => {
      const engine = listen({ allowUpgrades: false, pingInterval: 4 }, port => {
        eioc("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("packet", packet => {
            conn.close();
            if (process.env.EIO_CLIENT === "3") {
              expect(packet.type).to.be("ping");
            } else {
              expect(packet.type).to.be("pong");
            }
            done();
          });
        });
      });
    });
  });

  describe("packetCreate", () => {
    it("should emit before socket send message", done => {
      const engine = listen({ allowUpgrades: false }, port => {
        eioc("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("packetCreate", packet => {
            expect(packet.type).to.be("message");
            expect(packet.data).to.be("a");
            done();
          });
          conn.send("a");
        });
      });
    });

    it("should emit before send pong", done => {
      const engine = listen({ allowUpgrades: false, pingInterval: 4 }, port => {
        eioc("ws://localhost:%d".s(port));
        engine.on("connection", conn => {
          conn.on("packetCreate", packet => {
            conn.close();
            if (process.env.EIO_CLIENT === "3") {
              expect(packet.type).to.be("pong");
            } else {
              expect(packet.type).to.be("ping");
            }
            done();
          });
        });
      });
    });
  });

  describe("upgrade", () => {
    it("should upgrade", done => {
      const engine = listen(port => {
        // it takes both to send 50 to verify
        let ready = 2;
        let closed = 2;

        function finish() {
          setTimeout(() => {
            socket.close();
          }, 10);
        }

        // server
        engine.on("connection", conn => {
          let lastSent = 0;
          let lastReceived = 0;
          let upgraded = false;
          const interval = setInterval(() => {
            lastSent++;
            conn.send(lastSent);
            if (50 === lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);

          expect(conn.request._query.transport).to.be("polling");

          conn.on("message", msg => {
            expect(conn.request._query).to.be.an("object");
            lastReceived++;
            expect(msg).to.eql(lastReceived);
          });

          conn.on("upgrade", to => {
            expect(conn.request._query.transport).to.be("polling");
            upgraded = true;
            expect(to.name).to.be("websocket");
            expect(conn.transport.name).to.be("websocket");
          });

          conn.on("close", reason => {
            expect(reason).to.be("transport close");
            expect(lastSent).to.be(50);
            expect(lastReceived).to.be(50);
            expect(upgraded).to.be(true);
            --closed || done();
          });
        });

        // client
        var socket = new eioc.Socket("ws://localhost:%d".s(port));
        socket.on("open", () => {
          let lastSent = 0;
          let lastReceived = 0;
          let upgrades = 0;
          const interval = setInterval(() => {
            lastSent++;
            socket.send(lastSent);
            if (50 === lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);
          socket.on("upgrading", to => {
            // we want to make sure for the sake of this test that we have a buffer
            expect(to.name).to.equal("websocket");
            upgrades++;

            // force send a few packets to ensure we test buffer transfer
            lastSent++;
            socket.send(lastSent);
            lastSent++;
            socket.send(lastSent);

            expect(socket.writeBuffer).to.not.be.empty();
          });
          socket.on("upgrade", to => {
            expect(to.name).to.equal("websocket");
            upgrades++;
          });
          socket.on("message", msg => {
            lastReceived++;
            expect(lastReceived).to.eql(msg);
          });
          socket.on("close", reason => {
            expect(reason).to.be("forced close");
            expect(lastSent).to.be(50);
            expect(upgrades).to.be(2);
            --closed || done();
          });
        });
      });

      // attach another engine to make sure it doesn't break upgrades
      eio.attach(engine.httpServer, { path: "/foo" });
    });
  });

  describe("http compression", () => {
    function getSidFromResponse(res) {
      const c = cookieMod.parse(res.headers["set-cookie"][0]);
      return c[Object.keys(c)[0]];
    }

    it("should compress by default", done => {
      const engine = listen({ cookie: true, transports: ["polling"] }, port => {
        engine.on("connection", conn => {
          const buf = Buffer.allocUnsafe(1024);
          for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get(
          {
            port: port,
            path: "/engine.io/default/?transport=polling"
          },
          res => {
            const sid = getSidFromResponse(res);
            http.get(
              {
                port: port,
                path: "/engine.io/default/?transport=polling&sid=" + sid,
                headers: { "Accept-Encoding": "gzip, deflate" }
              },
              res => {
                expect(res.headers["content-encoding"]).to.equal("gzip");
                res
                  .pipe(zlib.createGunzip())
                  .on("error", done)
                  .on("end", done)
                  .resume();
              }
            );
          }
        );
      });
    });

    it("should compress using deflate", done => {
      const engine = listen({ cookie: true, transports: ["polling"] }, port => {
        engine.on("connection", conn => {
          const buf = Buffer.allocUnsafe(1024);
          for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get(
          {
            port: port,
            path: "/engine.io/default/?transport=polling"
          },
          res => {
            const sid = getSidFromResponse(res);
            http.get(
              {
                port: port,
                path: "/engine.io/default/?transport=polling&sid=" + sid,
                headers: { "Accept-Encoding": "deflate" }
              },
              res => {
                expect(res.headers["content-encoding"]).to.equal("deflate");
                res
                  .pipe(zlib.createDeflate())
                  .on("error", done)
                  .on("end", done)
                  .resume();
              }
            );
          }
        );
      });
    });

    it("should set threshold", done => {
      const engine = listen(
        {
          cookie: true,
          transports: ["polling"],
          httpCompression: { threshold: 0 }
        },
        port => {
          engine.on("connection", conn => {
            const buf = Buffer.allocUnsafe(10);
            for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
            conn.send(buf);
          });

          http.get(
            {
              port: port,
              path: "/engine.io/default/?transport=polling"
            },
            res => {
              const sid = getSidFromResponse(res);
              http.get(
                {
                  port: port,
                  path: "/engine.io/default/?transport=polling&sid=" + sid,
                  headers: { "Accept-Encoding": "gzip, deflate" }
                },
                res => {
                  expect(res.headers["content-encoding"]).to.equal("gzip");
                  done();
                }
              );
            }
          );
        }
      );
    });

    it("should disable compression", done => {
      const engine = listen(
        { cookie: true, transports: ["polling"], httpCompression: false },
        port => {
          engine.on("connection", conn => {
            const buf = Buffer.allocUnsafe(1024);
            for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
            conn.send(buf);
          });

          http.get(
            {
              port: port,
              path: "/engine.io/default/?transport=polling"
            },
            res => {
              const sid = getSidFromResponse(res);
              http.get(
                {
                  port: port,
                  path: "/engine.io/default/?transport=polling&sid=" + sid,
                  headers: { "Accept-Encoding": "gzip, deflate" }
                },
                res => {
                  expect(res.headers["content-encoding"]).to.be(undefined);
                  done();
                }
              );
            }
          );
        }
      );
    });

    it("should disable compression per message", done => {
      const engine = listen({ cookie: true, transports: ["polling"] }, port => {
        engine.on("connection", conn => {
          const buf = Buffer.allocUnsafe(1024);
          for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf, { compress: false });
        });

        http.get(
          {
            port: port,
            path: "/engine.io/default/?transport=polling"
          },
          res => {
            const sid = getSidFromResponse(res);
            http.get(
              {
                port: port,
                path: "/engine.io/default/?transport=polling&sid=" + sid,
                headers: { "Accept-Encoding": "gzip, deflate" }
              },
              res => {
                expect(res.headers["content-encoding"]).to.be(undefined);
                done();
              }
            );
          }
        );
      });
    });

    it("should not compress when the byte size is below threshold", done => {
      const engine = listen({ cookie: true, transports: ["polling"] }, port => {
        engine.on("connection", conn => {
          const buf = Buffer.allocUnsafe(100);
          for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get(
          {
            port: port,
            path: "/engine.io/default/?transport=polling"
          },
          res => {
            const sid = getSidFromResponse(res);
            http.get(
              {
                port: port,
                path: "/engine.io/default/?transport=polling&sid=" + sid,
                headers: { "Accept-Encoding": "gzip, deflate" }
              },
              res => {
                expect(res.headers["content-encoding"]).to.be(undefined);
                done();
              }
            );
          }
        );
      });
    });
  });

  describe("permessage-deflate", () => {
    it("should set threshold", done => {
      const engine = listen(
        { transports: ["websocket"], perMessageDeflate: { threshold: 0 } },
        port => {
          engine.on("connection", conn => {
            const socket = conn.transport.socket;
            const send = socket.send;
            socket.send = (data, opts, callback) => {
              socket.send = send;
              socket.send(data, opts, callback);

              expect(opts.compress).to.be(true);
              conn.close();
              done();
            };

            const buf = Buffer.allocUnsafe(100);
            for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
            conn.send(buf, { compress: true });
          });
          eioc("http://localhost:%d".s(port), { transports: ["websocket"] });
        }
      );
    });

    it("should not compress when the byte size is below threshold", done => {
      const engine = listen(
        { transports: ["websocket"], perMessageDeflate: true },
        port => {
          engine.on("connection", conn => {
            const socket = conn.transport.socket;
            const send = socket.send;
            socket.send = (data, opts, callback) => {
              socket.send = send;
              socket.send(data, opts, callback);

              expect(opts.compress).to.be(false);
              conn.close();
              done();
            };

            const buf = Buffer.allocUnsafe(100);
            for (let i = 0; i < buf.length; i++) buf[i] = i % 0xff;
            conn.send(buf, { compress: true });
          });
          eioc("http://localhost:%d".s(port), { transports: ["websocket"] });
        }
      );
    });
  });

  describe("extraHeaders", function() {
    this.timeout(5000);

    const headers = {
      "x-custom-header-for-my-project": "my-secret-access-token",
      cookie:
        "user_session=NI2JlCKF90aE0sJZD9ZzujtdsUqNYSBYxzlTsvdSUe35ZzdtVRGqYFr0kdGxbfc5gUOkR9RGp20GVKza; path=/; expires=Tue, 07-Apr-2015 18:18:08 GMT; secure; HttpOnly"
    };

    function testForTransport(transport, done) {
      const engine = listen(port => {
        const socket = new eioc.Socket("ws://localhost:%d".s(port), {
          extraHeaders: headers,
          transports: [transport]
        });
        engine.on("connection", conn => {
          for (let h in headers) {
            expect(conn.request.headers[h]).to.equal(headers[h]);
          }
          done();
        });
        socket.on("open", () => {});
      });
    }

    it("should arrive from client to server via WebSockets", done => {
      testForTransport("websocket", done);
    });

    it("should arrive from client to server via XMLHttpRequest", done => {
      testForTransport("polling", done);
    });
  });

  describe("response headers", () => {
    function testForHeaders(headers, done) {
      const engine = listen(port => {
        engine.on("connection", conn => {
          conn.transport.once("headers", headers => {
            expect(headers["X-XSS-Protection"]).to.be("0");
            conn.close();
            done();
          });
          conn.send("hi");
        });
        eioc("ws://localhost:%d".s(port), {
          extraHeaders: headers,
          transports: ["polling"]
        });
      });
    }

    it("should contain X-XSS-Protection: 0 for IE8", done => {
      const headers = {
        "user-agent":
          "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; Tablet PC 2.0)"
      };
      testForHeaders(headers, done);
    });

    it("should contain X-XSS-Protection: 0 for IE11", done => {
      const headers = {
        "user-agent":
          "Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko"
      };
      testForHeaders(headers, done);
    });
  });

  describe("cors", () => {
    it("should allow CORS from the current origin (preflight request)", done => {
      listen(
        { cors: { origin: true, headers: ["my-header"], credentials: true } },
        port => {
          request
            .options("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://engine.io")
            .query({ transport: "polling" })
            .end((err, res) => {
              expect(err).to.be(null);
              expect(res.status).to.be(204);
              expect(res.body).to.be.empty();
              expect(res.header["access-control-allow-origin"]).to.be(
                "http://engine.io"
              );
              expect(res.header["access-control-allow-methods"]).to.be(
                "GET,HEAD,PUT,PATCH,POST,DELETE"
              );
              expect(res.header["access-control-allow-headers"]).to.be(
                "my-header"
              );
              expect(res.header["access-control-allow-credentials"]).to.be(
                "true"
              );
              done();
            });
        }
      );
    });

    it("should allow CORS from the current origin (actual request)", done => {
      listen(
        { cors: { origin: true, headers: ["my-header"], credentials: true } },
        port => {
          request
            .get("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://engine.io")
            .query({ transport: "polling" })
            .end((err, res) => {
              expect(err).to.be(null);
              expect(res.status).to.be(200);
              expect(res.body).to.be.empty();
              expect(res.header["access-control-allow-origin"]).to.be(
                "http://engine.io"
              );
              expect(res.header["access-control-allow-methods"]).to.be(
                undefined
              );
              expect(res.header["access-control-allow-headers"]).to.be(
                undefined
              );
              expect(res.header["access-control-allow-credentials"]).to.be(
                "true"
              );
              done();
            });
        }
      );
    });

    it("should disallow CORS from a bad origin", done => {
      listen(
        {
          cors: {
            origin: ["http://good-domain.com"]
          }
        },
        port => {
          request
            .options("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://bad-domain.com")
            .query({ transport: "polling" })
            .end((err, res) => {
              expect(err).to.be(null);
              expect(res.status).to.be(204);
              expect(res.body).to.be.empty();
              expect(res.header["access-control-allow-origin"]).to.be(
                undefined
              );
              expect(res.header["access-control-allow-credentials"]).to.be(
                undefined
              );
              done();
            });
        }
      );
    });

    it("should forward the configuration to the cors module", done => {
      listen(
        {
          cors: {
            origin: "http://good-domain.com",
            methods: ["GET", "PUT", "POST"],
            allowedHeaders: ["my-header"],
            exposedHeaders: ["my-exposed-header"],
            credentials: true,
            maxAge: 123,
            optionsSuccessStatus: 200
          }
        },
        port => {
          request
            .options("http://localhost:%d/engine.io/default/".s(port))
            .set("Origin", "http://good-domain.com")
            .query({ transport: "polling" })
            .end((err, res) => {
              expect(err).to.be(null);
              expect(res.status).to.be(200);
              expect(res.body).to.be.empty();
              expect(res.header["access-control-allow-origin"]).to.be(
                "http://good-domain.com"
              );
              expect(res.header["access-control-allow-methods"]).to.be(
                "GET,PUT,POST"
              );
              expect(res.header["access-control-allow-headers"]).to.be(
                "my-header"
              );
              expect(res.header["access-control-expose-headers"]).to.be(
                "my-exposed-header"
              );
              expect(res.header["access-control-allow-credentials"]).to.be(
                "true"
              );
              expect(res.header["access-control-max-age"]).to.be("123");
              done();
            });
        }
      );
    });
  });

  describe("wsEngine option", () => {
    it("should allow loading of other websocket server implementation like eiows", done => {
      const engine = listen(
        { allowUpgrades: false, wsEngine: "eiows" },
        port => {
          expect(engine.ws instanceof require("eiows").Server).to.be.ok();
          const socket = new eioc.Socket("ws://localhost:%d".s(port));
          engine.on("connection", conn => {
            conn.send("a");
          });
          socket.on("open", () => {
            socket.on("message", msg => {
              expect(msg).to.be("a");
              done();
            });
          });
        }
      );
    });
  });

  describe("remoteAddress", () => {
    it("should be defined (polling)", done => {
      const engine = listen({ transports: ["polling"] }, port => {
        eioc("ws://localhost:%d".s(port), { transports: ["polling"] });
        engine.on("connection", socket => {
          expect(socket.remoteAddress).to.be("::ffff:127.0.0.1");
          done();
        });
      });
    });

    it("should be defined (ws)", done => {
      const engine = listen({ transports: ["websocket"] }, port => {
        eioc("ws://localhost:%d".s(port), { transports: ["websocket"] });
        engine.on("connection", socket => {
          expect(socket.remoteAddress).to.be("::ffff:127.0.0.1");
          done();
        });
      });
    });
  });
});
