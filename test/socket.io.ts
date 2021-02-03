"use strict";

import { Server, Socket } from "..";
import { createServer } from "http";
import fs = require("fs");
import { join } from "path";
import { exec } from "child_process";
import request from "supertest";
import expect from "expect.js";
import type { AddressInfo } from "net";
import * as io_v2 from "socket.io-client-v2";

const ioc = require("socket.io-client");

import "./support/util";

// Creates a socket.io client for the given server
function client(srv, nsp?: string | object, opts?: object) {
  if ("object" == typeof nsp) {
    opts = nsp;
    nsp = undefined;
  }
  let addr = srv.address();
  if (!addr) addr = srv.listen().address();
  const url = "ws://localhost:" + addr.port + (nsp || "");
  return ioc(url, opts);
}

const success = (sio, clientSocket, done) => {
  sio.close();
  clientSocket.close();
  done();
};

const waitFor = (emitter, event) => {
  return new Promise((resolve) => {
    emitter.once(event, resolve);
  });
};

describe("socket.io", () => {
  it("should be the same version as client", () => {
    const version = require("../package").version;
    expect(version).to.be(require("socket.io-client/package.json").version);
  });

  describe("server attachment", () => {
    describe("http.Server", () => {
      const clientVersion = require("socket.io-client/package.json").version;

      const testSource = (filename) => (done) => {
        const srv = createServer();
        new Server(srv);
        request(srv)
          .get("/socket.io/" + filename)
          .buffer(true)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.headers["content-type"]).to.be("application/javascript");
            expect(res.headers.etag).to.be('"' + clientVersion + '"');
            expect(res.headers["x-sourcemap"]).to.be(filename + ".map");
            expect(res.text).to.match(/engine\.io/);
            expect(res.status).to.be(200);
            done();
          });
      };

      const testSourceMap = (filename) => (done) => {
        const srv = createServer();
        new Server(srv);
        request(srv)
          .get("/socket.io/" + filename)
          .buffer(true)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.headers["content-type"]).to.be("application/json");
            expect(res.headers.etag).to.be('"' + clientVersion + '"');
            expect(res.text).to.match(/engine\.io/);
            expect(res.status).to.be(200);
            done();
          });
      };

      it("should serve client", testSource("socket.io.js"));
      it("should serve source map", testSourceMap("socket.io.js.map"));
      it("should serve client (min)", testSource("socket.io.min.js"));

      it(
        "should serve source map (min)",
        testSourceMap("socket.io.min.js.map")
      );

      it("should serve client (gzip)", (done) => {
        const srv = createServer();
        new Server(srv);
        request(srv)
          .get("/socket.io/socket.io.js")
          .set("accept-encoding", "gzip,br,deflate")
          .buffer(true)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.headers["content-encoding"]).to.be("gzip");
            expect(res.status).to.be(200);
            done();
          });
      });

      it(
        "should serve bundle with msgpack parser",
        testSource("socket.io.msgpack.min.js")
      );

      it(
        "should serve source map for bundle with msgpack parser",
        testSourceMap("socket.io.msgpack.min.js.map")
      );

      it("should handle 304", (done) => {
        const srv = createServer();
        new Server(srv);
        request(srv)
          .get("/socket.io/socket.io.js")
          .set("If-None-Match", '"' + clientVersion + '"')
          .end((err, res) => {
            if (err) return done(err);
            expect(res.statusCode).to.be(304);
            done();
          });
      });

      it("should handle 304", (done) => {
        const srv = createServer();
        new Server(srv);
        request(srv)
          .get("/socket.io/socket.io.js")
          .set("If-None-Match", 'W/"' + clientVersion + '"')
          .end((err, res) => {
            if (err) return done(err);
            expect(res.statusCode).to.be(304);
            done();
          });
      });

      it("should not serve static files", (done) => {
        const srv = createServer();
        new Server(srv, { serveClient: false });
        request(srv).get("/socket.io/socket.io.js").expect(400, done);
      });

      it("should work with #attach", (done) => {
        const srv = createServer((req, res) => {
          res.writeHead(404);
          res.end();
        });
        const sockets = new Server();
        sockets.attach(srv);
        request(srv)
          .get("/socket.io/socket.io.js")
          .end((err, res) => {
            if (err) return done(err);
            expect(res.status).to.be(200);
            done();
          });
      });

      it("should work with #attach (and merge options)", () => {
        const srv = createServer((req, res) => {
          res.writeHead(404);
          res.end();
        });
        const server = new Server({
          pingTimeout: 6000,
        });
        server.attach(srv, {
          pingInterval: 24000,
        });
        // @ts-ignore
        expect(server.eio.opts.pingTimeout).to.eql(6000);
        // @ts-ignore
        expect(server.eio.opts.pingInterval).to.eql(24000);
        server.close();
      });
    });

    describe("port", () => {
      it("should be bound", (done) => {
        const sockets = new Server(54010);
        request("http://localhost:54010")
          .get("/socket.io/socket.io.js")
          .expect(200, done);
      });

      it("should be bound as a string", (done) => {
        const sockets = new Server(54020);
        request("http://localhost:54020")
          .get("/socket.io/socket.io.js")
          .expect(200, done);
      });

      it("with listen", (done) => {
        const sockets = new Server().listen(54011);
        request("http://localhost:54011")
          .get("/socket.io/socket.io.js")
          .expect(200, done);
      });

      it("as a string", (done) => {
        const sockets = new Server().listen(54012);
        request("http://localhost:54012")
          .get("/socket.io/socket.io.js")
          .expect(200, done);
      });
    });
  });

  describe("handshake", () => {
    const request = require("superagent");

    it("should send the Access-Control-Allow-xxx headers on OPTIONS request", (done) => {
      const sockets = new Server(54013, {
        cors: {
          origin: "http://localhost:54023",
          methods: ["GET", "POST"],
          allowedHeaders: ["content-type"],
          credentials: true,
        },
      });
      request
        .options("http://localhost:54013/socket.io/default/")
        .query({ transport: "polling" })
        .set("Origin", "http://localhost:54023")
        .end((err, res) => {
          expect(res.status).to.be(204);

          expect(res.headers["access-control-allow-origin"]).to.be(
            "http://localhost:54023"
          );
          expect(res.headers["access-control-allow-methods"]).to.be("GET,POST");
          expect(res.headers["access-control-allow-headers"]).to.be(
            "content-type"
          );
          expect(res.headers["access-control-allow-credentials"]).to.be("true");
          done();
        });
    });

    it("should send the Access-Control-Allow-xxx headers on GET request", (done) => {
      const sockets = new Server(54014, {
        cors: {
          origin: "http://localhost:54024",
          methods: ["GET", "POST"],
          allowedHeaders: ["content-type"],
          credentials: true,
        },
      });
      request
        .get("http://localhost:54014/socket.io/default/")
        .query({ transport: "polling" })
        .set("Origin", "http://localhost:54024")
        .end((err, res) => {
          expect(res.status).to.be(200);

          expect(res.headers["access-control-allow-origin"]).to.be(
            "http://localhost:54024"
          );
          expect(res.headers["access-control-allow-credentials"]).to.be("true");
          done();
        });
    });

    it("should allow request if custom function in opts.allowRequest returns true", (done) => {
      const sockets = new Server(createServer().listen(54022), {
        allowRequest: (req, callback) => callback(null, true),
      });

      request
        .get("http://localhost:54022/socket.io/default/")
        .query({ transport: "polling" })
        .end((err, res) => {
          expect(res.status).to.be(200);
          done();
        });
    });

    it("should disallow request if custom function in opts.allowRequest returns false", (done) => {
      const sockets = new Server(createServer().listen(54023), {
        allowRequest: (req, callback) => callback(null, false),
      });
      request
        .get("http://localhost:54023/socket.io/default/")
        .set("origin", "http://foo.example")
        .query({ transport: "polling" })
        .end((err, res) => {
          expect(res.status).to.be(403);
          done();
        });
    });
  });

  describe("close", () => {
    it("should be able to close sio sending a srv", (done) => {
      const PORT = 54018;
      const srv = createServer().listen(PORT);
      const sio = new Server(srv);
      const net = require("net");
      const server = net.createServer();

      const clientSocket = client(srv, { reconnection: false });

      clientSocket.on("disconnect", () => {
        expect(sio.sockets.sockets.size).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on("connect", () => {
        expect(sio.sockets.sockets.size).to.equal(1);
        sio.close();
      });

      server.once("listening", () => {
        // PORT should be free
        server.close((error) => {
          expect(error).to.be(undefined);
          done();
        });
      });
    });

    it("should be able to close sio sending a port", () => {
      const PORT = 54019;
      const sio = new Server(PORT);
      const net = require("net");
      const server = net.createServer();

      const clientSocket = ioc("ws://0.0.0.0:" + PORT, { reconnection: false });

      clientSocket.on("disconnect", () => {
        expect(Object.keys(sio._nsps["/"].sockets).length).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on("connect", () => {
        expect(Object.keys(sio._nsps["/"].sockets).length).to.equal(1);
        sio.close();
      });

      server.once("listening", () => {
        // PORT should be free
        server.close((error) => {
          expect(error).to.be(undefined);
        });
      });
    });

    describe("graceful close", () => {
      function fixture(filename) {
        return (
          '"' +
          process.execPath +
          '" "' +
          join(__dirname, "fixtures", filename) +
          '"'
        );
      }

      it("should stop socket and timers", (done) => {
        exec(fixture("server-close.ts"), done);
      });
    });
  });

  describe("namespaces", () => {
    const { Socket } = require("../dist/socket");
    const { Namespace } = require("../dist/namespace");

    it("should be accessible through .sockets", () => {
      const sio = new Server();
      expect(sio.sockets).to.be.a(Namespace);
    });

    it("should be aliased", () => {
      const sio = new Server();
      expect(sio.use).to.be.a("function");
      expect(sio.to).to.be.a("function");
      expect(sio["in"]).to.be.a("function");
      expect(sio.emit).to.be.a("function");
      expect(sio.send).to.be.a("function");
      expect(sio.write).to.be.a("function");
      expect(sio.allSockets).to.be.a("function");
      expect(sio.compress).to.be.a("function");
      expect(sio.volatile).to.be(sio);
      expect(sio.local).to.be(sio);
      expect(sio.sockets._flags).to.eql({ volatile: true, local: true });
      delete sio.sockets._flags;
    });

    it("should automatically connect", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        socket.on("connect", () => {
          done();
        });
      });
    });

    it("should fire a `connection` event", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (socket: Socket) => {
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it("should fire a `connect` event", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connect", (socket) => {
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it("should work with many sockets", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        sio.of("/chat");
        sio.of("/news");
        const chat = client(srv, "/chat");
        const news = client(srv, "/news");
        let total = 2;
        chat.on("connect", () => {
          --total || done();
        });
        news.on("connect", () => {
          --total || done();
        });
      });
    });

    it('should be able to equivalently start with "" or "/" on server', (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;
      sio.of("").on("connection", () => {
        --total || done();
      });
      sio.of("abc").on("connection", () => {
        --total || done();
      });
      const c1 = client(srv, "/");
      const c2 = client(srv, "/abc");
    });

    it('should be equivalent for "" and "/" on client', (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      sio.of("/").on("connection", () => {
        done();
      });
      const c1 = client(srv, "");
    });

    it("should work with `of` and many sockets", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const chat = client(srv, "/chat");
        const news = client(srv, "/news");
        let total = 2;
        sio.of("/news").on("connection", (socket) => {
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of("/news").on("connection", (socket) => {
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it("should work with `of` second param", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const chat = client(srv, "/chat");
        const news = client(srv, "/news");
        let total = 2;
        sio.of("/news", (socket) => {
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of("/news", (socket) => {
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it("should disconnect upon transport disconnection", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const chat = client(srv, "/chat");
        const news = client(srv, "/news");
        let total = 2;
        let totald = 2;
        let s;
        sio.of("/news", (socket) => {
          socket.on("disconnect", (reason) => {
            --totald || done();
          });
          --total || close();
        });
        sio.of("/chat", (socket) => {
          s = socket;
          socket.on("disconnect", (reason) => {
            --totald || done();
          });
          --total || close();
        });
        function close() {
          s.disconnect(true);
        }
      });
    });

    it("should fire a `disconnecting` event just before leaving all rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);

        sio.on("connection", (s) => {
          s.join("a");
          // FIXME not sure why process.nextTick() is needed here
          process.nextTick(() => s.disconnect());

          let total = 2;
          s.on("disconnecting", (reason) => {
            expect(s.rooms).to.contain(s.id, "a");
            total--;
          });

          s.on("disconnect", (reason) => {
            expect(s.rooms.size).to.eql(0);
            --total || done();
          });
        });
      });
    });

    it("should return error connecting to non-existent namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, "/doesnotexist");
        socket.on("connect_error", (err) => {
          expect(err.message).to.be("Invalid namespace");
          done();
        });
      });
    });

    it("should not reuse same-namespace connections", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let connections = 0;

      srv.listen(() => {
        const clientSocket1 = client(srv);
        const clientSocket2 = client(srv);
        sio.on("connection", () => {
          connections++;
          if (connections === 2) {
            done();
          }
        });
      });
    });

    it("should find all clients in a namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const chatSids: string[] = [];
      let otherSid = null;
      srv.listen(() => {
        const c1 = client(srv, "/chat");
        const c2 = client(srv, "/chat", { forceNew: true });
        const c3 = client(srv, "/other", { forceNew: true });
        let total = 3;
        sio.of("/chat").on("connection", (socket) => {
          chatSids.push(socket.id);
          --total || getSockets();
        });
        sio.of("/other").on("connection", (socket) => {
          otherSid = socket.id;
          --total || getSockets();
        });
      });
      async function getSockets() {
        const sids = await sio.of("/chat").allSockets();

        expect(sids).to.contain(chatSids[0], chatSids[1]);
        expect(sids).to.not.contain(otherSid);
        done();
      }
    });

    it("should find all clients in a namespace room", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let chatFooSid = null;
      let chatBarSid = null;
      let otherSid = null;
      srv.listen(() => {
        const c1 = client(srv, "/chat");
        const c2 = client(srv, "/chat", { forceNew: true });
        const c3 = client(srv, "/other", { forceNew: true });
        let chatIndex = 0;
        let total = 3;
        sio.of("/chat").on("connection", (socket) => {
          if (chatIndex++) {
            socket.join("foo");
            chatFooSid = socket.id;
            --total || getSockets();
          } else {
            socket.join("bar");
            chatBarSid = socket.id;
            --total || getSockets();
          }
        });
        sio.of("/other").on("connection", (socket) => {
          socket.join("foo");
          otherSid = socket.id;
          --total || getSockets();
        });
      });
      async function getSockets() {
        const sids = await sio.of("/chat").in("foo").allSockets();

        expect(sids).to.contain(chatFooSid);
        expect(sids).to.not.contain(chatBarSid);
        expect(sids).to.not.contain(otherSid);
        done();
      }
    });

    it("should find all clients across namespace rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let chatFooSid = null;
      let chatBarSid = null;
      let otherSid = null;
      srv.listen(() => {
        const c1 = client(srv, "/chat");
        const c2 = client(srv, "/chat", { forceNew: true });
        const c3 = client(srv, "/other", { forceNew: true });
        let chatIndex = 0;
        let total = 3;
        sio.of("/chat").on("connection", (socket) => {
          if (chatIndex++) {
            socket.join("foo");
            chatFooSid = socket.id;
            --total || getSockets();
          } else {
            socket.join("bar");
            chatBarSid = socket.id;
            --total || getSockets();
          }
        });
        sio.of("/other").on("connection", (socket) => {
          socket.join("foo");
          otherSid = socket.id;
          --total || getSockets();
        });
      });
      async function getSockets() {
        const sids = await sio.of("/chat").allSockets();
        expect(sids).to.contain(chatFooSid, chatBarSid);
        expect(sids).to.not.contain(otherSid);
        done();
      }
    });

    it("should not emit volatile event after regular event", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      let counter = 0;
      srv.listen(() => {
        sio.of("/chat").on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            sio.of("/chat").emit("ev", "data");
            sio.of("/chat").volatile.emit("ev", "data");
          }, 50);
        });

        const socket = client(srv, "/chat");
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it("should emit volatile event", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      let counter = 0;
      srv.listen(() => {
        sio.of("/chat").on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            sio.of("/chat").volatile.emit("ev", "data");
          }, 100);
        });

        const socket = client(srv, "/chat");
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it("should enable compression by default", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, "/chat");
        sio.of("/chat").on("connection", (s) => {
          s.conn.once("packetCreate", (packet) => {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of("/chat").emit("woot", "hi");
        });
      });
    });

    it("should disable compression", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, "/chat");
        sio.of("/chat").on("connection", (s) => {
          s.conn.once("packetCreate", (packet) => {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of("/chat").compress(false).emit("woot", "hi");
        });
      });
    });

    it("should throw on reserved event", () => {
      const sio = new Server();

      expect(() => sio.emit("connect")).to.throwException(
        /"connect" is a reserved event name/
      );
    });

    it("should close a client without namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv, {
        connectTimeout: 10,
      });

      srv.listen(() => {
        const socket = client(srv);

        socket.io.engine.write = () => {}; // prevent the client from sending a CONNECT packet

        socket.on("disconnect", () => {
          socket.close();
          sio.close();
          done();
        });
      });
    });

    it("should close a client without namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv, {
        connectTimeout: 100,
      });

      sio.use((_, next) => {
        next(new Error("nope"));
      });

      srv.listen(() => {
        const socket = client(srv);

        const success = () => {
          socket.close();
          sio.close();
          done();
        };

        socket.on("disconnect", success);
      });
    });

    describe("dynamic namespaces", () => {
      it("should allow connections to dynamic namespaces with a regex", (done) => {
        const srv = createServer();
        const sio = new Server(srv);
        let count = 0;
        srv.listen(() => {
          const socket = client(srv, "/dynamic-101");
          let dynamicNsp = sio
            .of(/^\/dynamic-\d+$/)
            .on("connect", (socket) => {
              expect(socket.nsp.name).to.be("/dynamic-101");
              dynamicNsp.emit("hello", 1, "2", { 3: "4" });
              if (++count === 4) done();
            })
            .use((socket, next) => {
              next();
              if (++count === 4) done();
            });
          socket.on("connect_error", (err) => {
            expect().fail();
          });
          socket.on("connect", () => {
            if (++count === 4) done();
          });
          socket.on("hello", (a, b, c) => {
            expect(a).to.eql(1);
            expect(b).to.eql("2");
            expect(c).to.eql({ 3: "4" });
            if (++count === 4) done();
          });
        });
      });

      it("should allow connections to dynamic namespaces with a function", (done) => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          const socket = client(srv, "/dynamic-101");
          sio.of((name, query, next) => next(null, "/dynamic-101" === name));
          socket.on("connect", done);
        });
      });

      it("should disallow connections when no dynamic namespace matches", (done) => {
        const srv = createServer();
        const sio = new Server(srv);
        srv.listen(() => {
          const socket = client(srv, "/abc");
          sio.of(/^\/dynamic-\d+$/);
          sio.of((name, query, next) => next(null, "/dynamic-101" === name));
          socket.on("connect_error", (err) => {
            expect(err.message).to.be("Invalid namespace");
            done();
          });
        });
      });
    });
  });

  describe("socket", () => {
    it("should not fire events more than once after manually reconnecting", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const clientSocket = client(srv, { reconnection: false });
        clientSocket.on("connect", function init() {
          clientSocket.removeListener("connect", init);
          clientSocket.io.engine.close();

          clientSocket.connect();
          clientSocket.on("connect", () => {
            done();
          });
        });
      });
    });

    it("should not fire reconnect_failed event more than once when server closed", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const clientSocket = client(srv, {
          reconnectionAttempts: 3,
          reconnectionDelay: 100,
        });
        clientSocket.on("connect", () => {
          srv.close();
        });

        clientSocket.io.on("reconnect_failed", () => {
          done();
        });
      });
    });

    it("should receive events", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("random", (a, b, c) => {
            expect(a).to.be(1);
            expect(b).to.be("2");
            expect(c).to.eql([3]);
            done();
          });
          socket.emit("random", 1, "2", [3]);
        });
      });
    });

    it("should receive message events through `send`", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("message", (a) => {
            expect(a).to.be(1337);
            done();
          });
          socket.send(1337);
        });
      });
    });

    it("should error with null messages", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("message", (a) => {
            expect(a).to.be(null);
            done();
          });
          socket.send(null);
        });
      });
    });

    it("should handle transport null messages", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { reconnection: false });
        sio.on("connection", (s) => {
          s.on("error", (err) => {
            expect(err).to.be.an(Error);
            s.on("disconnect", (reason) => {
              expect(reason).to.be("forced close");
              done();
            });
          });
          s.client.ondata(null);
        });
      });
    });

    it("should emit events", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        socket.on("woot", (a) => {
          expect(a).to.be("tobi");
          done();
        });
        sio.on("connection", (s) => {
          s.emit("woot", "tobi");
        });
      });
    });

    it("should emit events with utf8 multibyte character", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        let i = 0;
        socket.on("hoot", (a) => {
          expect(a).to.be("utf8 — string");
          i++;

          if (3 == i) {
            done();
          }
        });
        sio.on("connection", (s) => {
          s.emit("hoot", "utf8 — string");
          s.emit("hoot", "utf8 — string");
          s.emit("hoot", "utf8 — string");
        });
      });
    });

    it("should emit events with binary data", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        let imageData;
        socket.on("doge", (a) => {
          expect(Buffer.isBuffer(a)).to.be(true);
          expect(imageData.length).to.equal(a.length);
          expect(imageData[0]).to.equal(a[0]);
          expect(imageData[imageData.length - 1]).to.equal(a[a.length - 1]);
          done();
        });
        sio.on("connection", (s) => {
          fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
            if (err) return done(err);
            imageData = data;
            s.emit("doge", data);
          });
        });
      });
    });

    it("should emit events with several types of data (including binary)", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        socket.on("multiple", (a, b, c, d, e, f) => {
          expect(a).to.be(1);
          expect(Buffer.isBuffer(b)).to.be(true);
          expect(c).to.be("3");
          expect(d).to.eql([4]);
          expect(Buffer.isBuffer(e)).to.be(true);
          expect(Buffer.isBuffer(f[0])).to.be(true);
          expect(f[1]).to.be("swag");
          expect(Buffer.isBuffer(f[2])).to.be(true);
          done();
        });
        sio.on("connection", (s) => {
          fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
            if (err) return done(err);
            const buf = Buffer.from("asdfasdf", "utf8");
            s.emit("multiple", 1, data, "3", [4], buf, [data, "swag", buf]);
          });
        });
      });
    });

    it("should receive events with binary data", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("buff", (a) => {
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
          const buf = Buffer.from("abcdefg", "utf8");
          socket.emit("buff", buf);
        });
      });
    });

    it("should receive events with several types of data (including binary)", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("multiple", (a, b, c, d, e, f) => {
            expect(a).to.be(1);
            expect(Buffer.isBuffer(b)).to.be(true);
            expect(c).to.be("3");
            expect(d).to.eql([4]);
            expect(Buffer.isBuffer(e)).to.be(true);
            expect(Buffer.isBuffer(f[0])).to.be(true);
            expect(f[1]).to.be("swag");
            expect(Buffer.isBuffer(f[2])).to.be(true);
            done();
          });
          fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
            if (err) return done(err);
            const buf = Buffer.from("asdfasdf", "utf8");
            socket.emit("multiple", 1, data, "3", [4], buf, [
              data,
              "swag",
              buf,
            ]);
          });
        });
      });
    });

    it("should not emit volatile event after regular event (polling)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["polling"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          s.emit("ev", "data");
          s.volatile.emit("ev", "data");
        });

        const socket = client(srv, { transports: ["polling"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it("should not emit volatile event after regular event (ws)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["websocket"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          s.emit("ev", "data");
          s.volatile.emit("ev", "data");
        });

        const socket = client(srv, { transports: ["websocket"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it("should emit volatile event (polling)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["polling"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.volatile.emit("ev", "data");
          }, 100);
        });

        const socket = client(srv, { transports: ["polling"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it("should emit volatile event (ws)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["websocket"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.volatile.emit("ev", "data");
          }, 20);
        });

        const socket = client(srv, { transports: ["websocket"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it("should emit only one consecutive volatile event (polling)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["polling"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.volatile.emit("ev", "data");
            s.volatile.emit("ev", "data");
          }, 100);
        });

        const socket = client(srv, { transports: ["polling"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it("should emit only one consecutive volatile event (ws)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["websocket"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.volatile.emit("ev", "data");
            s.volatile.emit("ev", "data");
          }, 20);
        });

        const socket = client(srv, { transports: ["websocket"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it("should emit regular events after trying a failed volatile event (polling)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["polling"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.emit("ev", "data");
            s.volatile.emit("ev", "data");
            s.emit("ev", "data");
          }, 20);
        });

        const socket = client(srv, { transports: ["polling"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it("should emit regular events after trying a failed volatile event (ws)", (done) => {
      const srv = createServer();
      const sio = new Server(srv, { transports: ["websocket"] });

      let counter = 0;
      srv.listen(() => {
        sio.on("connection", (s) => {
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(() => {
            s.emit("ev", "data");
            s.volatile.emit("ev", "data");
            s.emit("ev", "data");
          }, 20);
        });

        const socket = client(srv, { transports: ["websocket"] });
        socket.on("ev", () => {
          counter++;
        });
      });

      setTimeout(() => {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it("should emit message events through `send`", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        socket.on("message", (a) => {
          expect(a).to.be("a");
          done();
        });
        sio.on("connection", (s) => {
          s.send("a");
        });
      });
    });

    it("should receive event with callbacks", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("woot", (fn) => {
            fn(1, 2);
          });
          socket.emit("woot", (a, b) => {
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it("should receive all events emitted from namespaced client immediately and in order", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 0;
      srv.listen(() => {
        sio.of("/chat", (s) => {
          s.on("hi", (letter) => {
            total++;
            if (total == 2 && letter == "b") {
              done();
            } else if (total == 1 && letter != "a") {
              throw new Error("events out of order");
            }
          });
        });

        const chat = client(srv, "/chat");
        chat.emit("hi", "a");
        setTimeout(() => {
          chat.emit("hi", "b");
        }, 50);
      });
    });

    it("should emit events with callbacks", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          socket.on("hi", (fn) => {
            fn();
          });
          s.emit("hi", () => {
            done();
          });
        });
      });
    });

    it("should receive events with args and callback", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("woot", (a, b, fn) => {
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          socket.emit("woot", 1, 2, () => {
            done();
          });
        });
      });
    });

    it("should emit events with args and callback", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          socket.on("hi", (a, b, fn) => {
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          s.emit("hi", 1, 2, () => {
            done();
          });
        });
      });
    });

    it("should receive events with binary args and callbacks", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("woot", (buf, fn) => {
            expect(Buffer.isBuffer(buf)).to.be(true);
            fn(1, 2);
          });
          socket.emit("woot", Buffer.alloc(3), (a, b) => {
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it("should emit events with binary args and callback", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          socket.on("hi", (a, fn) => {
            expect(Buffer.isBuffer(a)).to.be(true);
            fn();
          });
          s.emit("hi", Buffer.alloc(4), () => {
            done();
          });
        });
      });
    });

    it("should emit events and receive binary data in a callback", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          socket.on("hi", (fn) => {
            fn(Buffer.alloc(1));
          });
          s.emit("hi", (a) => {
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it("should receive events and pass binary data in a callback", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.on("woot", (fn) => {
            fn(Buffer.alloc(2));
          });
          socket.emit("woot", (a) => {
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it("should have access to the client", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          expect(s.client).to.be.an("object");
          done();
        });
      });
    });

    it("should have access to the connection", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          expect(s.client.conn).to.be.an("object");
          expect(s.conn).to.be.an("object");
          done();
        });
      });
    });

    it("should have access to the request", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          expect(s.client.request.headers).to.be.an("object");
          expect(s.request.headers).to.be.an("object");
          done();
        });
      });
    });

    it("should see query parameters in the request", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { query: { key1: 1, key2: 2 } });
        sio.on("connection", (s) => {
          const parsed = require("url").parse(s.request.url);
          const query = require("querystring").parse(parsed.query);
          expect(query.key1).to.be("1");
          expect(query.key2).to.be("2");
          done();
        });
      });
    });

    it("should see query parameters sent from secondary namespace connections in handshake object", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const client1 = client(srv);
      const client2 = client(srv, "/connection2", {
        auth: { key1: "aa", key2: "&=bb" },
      });
      sio.on("connection", (s) => {});
      sio.of("/connection2").on("connection", (s) => {
        expect(s.handshake.query.key1).to.be(undefined);
        expect(s.handshake.query.EIO).to.be("4");
        expect(s.handshake.auth.key1).to.be("aa");
        expect(s.handshake.auth.key2).to.be("&=bb");
        done();
      });
    });

    it("should handle very large json", function (done) {
      this.timeout(30000);
      const srv = createServer();
      const sio = new Server(srv, { perMessageDeflate: false });
      let received = 0;
      srv.listen(() => {
        const socket = client(srv);
        socket.on("big", (a) => {
          expect(Buffer.isBuffer(a.json)).to.be(false);
          if (++received == 3) done();
          else socket.emit("big", a);
        });
        sio.on("connection", (s) => {
          fs.readFile(
            join(__dirname, "fixtures", "big.json"),
            (err, data: any) => {
              if (err) return done(err);
              data = JSON.parse(data);
              s.emit("big", { hello: "friend", json: data });
            }
          );
          s.on("big", (a) => {
            s.emit("big", a);
          });
        });
      });
    });

    it("should handle very large binary data", function (done) {
      this.timeout(30000);
      const srv = createServer();
      const sio = new Server(srv, { perMessageDeflate: false });
      let received = 0;
      srv.listen(() => {
        const socket = client(srv);
        socket.on("big", (a) => {
          expect(Buffer.isBuffer(a.image)).to.be(true);
          if (++received == 3) done();
          else socket.emit("big", a);
        });
        sio.on("connection", (s) => {
          fs.readFile(join(__dirname, "fixtures", "big.jpg"), (err, data) => {
            if (err) return done(err);
            s.emit("big", { hello: "friend", image: data });
          });
          s.on("big", (a) => {
            expect(Buffer.isBuffer(a.image)).to.be(true);
            s.emit("big", a);
          });
        });
      });
    });

    it("should be able to emit after server close and restart", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      sio.on("connection", (socket) => {
        socket.on("ev", (data) => {
          expect(data).to.be("payload");
          done();
        });
      });

      srv.listen(() => {
        const { port } = srv.address() as AddressInfo;
        const clientSocket = client(srv, {
          reconnectionAttempts: 10,
          reconnectionDelay: 100,
        });
        clientSocket.once("connect", () => {
          srv.close(() => {
            clientSocket.io.on("reconnect", () => {
              clientSocket.emit("ev", "payload");
            });
            sio.listen(port);
          });
        });
      });
    });

    it("should enable compression by default", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, "/chat");
        sio.of("/chat").on("connection", (s) => {
          s.conn.once("packetCreate", (packet) => {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of("/chat").emit("woot", "hi");
        });
      });
    });

    it("should disable compression", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, "/chat");
        sio.of("/chat").on("connection", (s) => {
          s.conn.once("packetCreate", (packet) => {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of("/chat").compress(false).emit("woot", "hi");
        });
      });
    });

    it("should error with raw binary and warn", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { reconnection: false });
        sio.on("connection", (s) => {
          s.conn.on("upgrade", () => {
            console.log(
              "\u001b[96mNote: warning expected and normal in test.\u001b[39m"
            );
            socket.io.engine.write("5woooot");
            setTimeout(() => {
              done();
            }, 100);
          });
        });
      });
    });

    it("should not crash when receiving an error packet without handler", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { reconnection: false });
        sio.on("connection", (s) => {
          s.conn.on("upgrade", () => {
            console.log(
              "\u001b[96mNote: warning expected and normal in test.\u001b[39m"
            );
            socket.io.engine.write('44["handle me please"]');
            setTimeout(() => {
              done();
            }, 100);
          });
        });
      });
    });

    it("should not crash with raw binary", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { reconnection: false });
        sio.on("connection", (s) => {
          s.once("error", (err) => {
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on("upgrade", () => {
            socket.io.engine.write("5woooot");
          });
        });
      });
    });

    it("should handle empty binary packet", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv, { reconnection: false });
        sio.on("connection", (s) => {
          s.once("error", (err) => {
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on("upgrade", () => {
            socket.io.engine.write("5");
          });
        });
      });
    });

    it("should not crash when messing with Object prototype (and other globals)", (done) => {
      // @ts-ignore
      Object.prototype.foo = "bar";
      // @ts-ignore
      global.File = "";
      // @ts-ignore
      global.Blob = [];
      const srv = createServer();
      const sio = new Server(srv);
      srv.listen(() => {
        const socket = client(srv);

        sio.on("connection", (s) => {
          s.disconnect(true);
          sio.close();
          setTimeout(() => {
            done();
          }, 100);
        });
      });
    });

    it("should throw on reserved event", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          expect(() => s.emit("connect_error")).to.throwException(
            /"connect_error" is a reserved event name/
          );
          socket.close();
          done();
        });
      });
    });

    describe("onAny", () => {
      it("should call listener", (done) => {
        const srv = createServer();
        const sio = new Server(srv);

        srv.listen(() => {
          const socket = client(srv, { multiplex: false });

          socket.emit("my-event", "123");

          sio.on("connection", (socket: Socket) => {
            socket.onAny((event, arg1) => {
              expect(event).to.be("my-event");
              expect(arg1).to.be("123");
              done();
            });
          });
        });
      });

      it("should prepend listener", (done) => {
        const srv = createServer();
        const sio = new Server(srv);

        srv.listen(() => {
          const socket = client(srv, { multiplex: false });

          socket.emit("my-event", "123");

          sio.on("connection", (socket: Socket) => {
            let count = 0;

            socket.onAny((event, arg1) => {
              expect(count).to.be(2);
              done();
            });

            socket.prependAny(() => {
              expect(count++).to.be(1);
            });

            socket.prependAny(() => {
              expect(count++).to.be(0);
            });
          });
        });
      });

      it("should remove listener", (done) => {
        const srv = createServer();
        const sio = new Server(srv);

        srv.listen(() => {
          const socket = client(srv, { multiplex: false });

          socket.emit("my-event", "123");

          sio.on("connection", (socket: Socket) => {
            const fail = () => done(new Error("fail"));

            socket.onAny(fail);
            socket.offAny(fail);
            expect(socket.listenersAny.length).to.be(0);

            socket.onAny(() => {
              done();
            });
          });
        });
      });
    });
  });

  describe("messaging many", () => {
    it("emits to a namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });
        const socket3 = client(srv, "/test");
        socket1.on("a", (a) => {
          expect(a).to.be("b");
          --total || done();
        });
        socket2.on("a", (a) => {
          expect(a).to.be("b");
          --total || done();
        });
        socket3.on("a", () => {
          done(new Error("not"));
        });

        let sockets = 3;
        sio.on("connection", (socket) => {
          --sockets || emit();
        });
        sio.of("/test", (socket) => {
          --sockets || emit();
        });

        function emit() {
          sio.emit("a", "b");
        }
      });
    });

    it("emits binary data to a namespace", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });
        const socket3 = client(srv, "/test");
        socket1.on("bin", (a) => {
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket2.on("bin", (a) => {
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket3.on("bin", () => {
          done(new Error("not"));
        });

        let sockets = 3;
        sio.on("connection", (socket) => {
          --sockets || emit();
        });
        sio.of("/test", (socket) => {
          --sockets || emit();
        });

        function emit() {
          sio.emit("bin", Buffer.alloc(10));
        }
      });
    });

    it("emits to the rest", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });
        const socket3 = client(srv, "/test");
        socket1.on("a", (a) => {
          expect(a).to.be("b");
          socket1.emit("finish");
        });
        socket2.emit("broadcast");
        socket2.on("a", () => {
          done(new Error("done"));
        });
        socket3.on("a", () => {
          done(new Error("not"));
        });

        const sockets = 2;
        sio.on("connection", (socket) => {
          socket.on("broadcast", () => {
            socket.broadcast.emit("a", "b");
          });
          socket.on("finish", () => {
            done();
          });
        });
      });
    });

    it("emits to rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });

        socket2.on("a", () => {
          done(new Error("not"));
        });
        socket1.on("a", () => {
          done();
        });
        socket1.emit("join", "woot");
        socket1.emit("emit", "woot");

        sio.on("connection", (socket) => {
          socket.on("join", (room, fn) => {
            socket.join(room);
            fn && fn();
          });

          socket.on("emit", (room) => {
            sio.in(room).emit("a");
          });
        });
      });
    });

    it("emits to rooms avoiding dupes", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });

        socket2.on("a", () => {
          done(new Error("not"));
        });
        socket1.on("a", () => {
          --total || done();
        });
        socket2.on("b", () => {
          --total || done();
        });

        socket1.emit("join", "woot");
        socket1.emit("join", "test");
        socket2.emit("join", "third", () => {
          socket2.emit("emit");
        });

        sio.on("connection", (socket) => {
          socket.on("join", (room, fn) => {
            socket.join(room);
            fn && fn();
          });

          socket.on("emit", (room) => {
            sio.in("woot").in("test").emit("a");
            sio.in("third").emit("b");
          });
        });
      });
    });

    it("broadcasts to rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });
        const socket3 = client(srv, { multiplex: false });

        socket1.emit("join", "woot");
        socket2.emit("join", "test");
        socket3.emit("join", "test", () => {
          socket3.emit("broadcast");
        });

        socket1.on("a", () => {
          done(new Error("not"));
        });
        socket2.on("a", () => {
          --total || done();
        });
        socket3.on("a", () => {
          done(new Error("not"));
        });
        socket3.on("b", () => {
          --total || done();
        });

        sio.on("connection", (socket) => {
          socket.on("join", (room, fn) => {
            socket.join(room);
            fn && fn();
          });

          socket.on("broadcast", () => {
            socket.broadcast.to("test").emit("a");
            socket.emit("b");
          });
        });
      });
    });

    it("broadcasts binary data to rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let total = 2;

      srv.listen(() => {
        const socket1 = client(srv, { multiplex: false });
        const socket2 = client(srv, { multiplex: false });
        const socket3 = client(srv, { multiplex: false });

        socket1.emit("join", "woot");
        socket2.emit("join", "test");
        socket3.emit("join", "test", () => {
          socket3.emit("broadcast");
        });

        socket1.on("bin", (data) => {
          throw new Error("got bin in socket1");
        });
        socket2.on("bin", (data) => {
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });
        socket2.on("bin2", (data) => {
          throw new Error("socket2 got bin2");
        });
        socket3.on("bin", (data) => {
          throw new Error("socket3 got bin");
        });
        socket3.on("bin2", (data) => {
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });

        sio.on("connection", (socket) => {
          socket.on("join", (room, fn) => {
            socket.join(room);
            fn && fn();
          });
          socket.on("broadcast", () => {
            socket.broadcast.to("test").emit("bin", Buffer.alloc(5));
            socket.emit("bin2", Buffer.alloc(5));
          });
        });
      });
    });

    it("keeps track of rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.join("a");
          expect(s.rooms).to.contain(s.id, "a");
          s.join("b");
          expect(s.rooms).to.contain(s.id, "a", "b");
          s.join("c");
          expect(s.rooms).to.contain(s.id, "a", "b", "c");
          s.leave("b");
          expect(s.rooms).to.contain(s.id, "a", "c");
          s.leaveAll();
          expect(s.rooms.size).to.eql(0);
          done();
        });
      });
    });

    it("deletes empty rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.join("a");
          expect(s.nsp.adapter.rooms).to.contain("a");
          s.leave("a");
          expect(s.nsp.adapter.rooms).to.not.contain("a");
          done();
        });
      });
    });

    it("should properly cleanup left rooms", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.join("a");
          expect(s.rooms).to.contain(s.id, "a");
          s.join("b");
          expect(s.rooms).to.contain(s.id, "a", "b");
          s.leave("unknown");
          expect(s.rooms).to.contain(s.id, "a", "b");
          s.leaveAll();
          expect(s.rooms.size).to.eql(0);
          done();
        });
      });
    });

    it("allows to join several rooms at once", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (s) => {
          s.join(["a", "b", "c"]);
          expect(s.rooms).to.contain(s.id, "a", "b", "c");
          done();
        });
      });
    });
  });

  describe("middleware", () => {
    const { Socket } = require("../dist/socket");

    it("should call functions", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let run = 0;
      sio.use((socket, next) => {
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      sio.use((socket, next) => {
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      srv.listen(() => {
        const socket = client(srv);
        socket.on("connect", () => {
          expect(run).to.be(2);
          done();
        });
      });
    });

    it("should pass errors", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const run = 0;
      sio.use((socket, next) => {
        next(new Error("Authentication error"));
      });
      sio.use((socket, next) => {
        done(new Error("nope"));
      });
      srv.listen(() => {
        const socket = client(srv);
        socket.on("connect", () => {
          done(new Error("nope"));
        });
        socket.on("connect_error", (err) => {
          expect(err.message).to.be("Authentication error");
          done();
        });
      });
    });

    it("should pass an object", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      sio.use((socket, next) => {
        const err = new Error("Authentication error");
        // @ts-ignore
        err.data = { a: "b", c: 3 };
        next(err);
      });
      srv.listen(() => {
        const socket = client(srv);
        socket.on("connect", () => {
          done(new Error("nope"));
        });
        socket.on("connect_error", (err) => {
          expect(err).to.be.an(Error);
          expect(err.message).to.eql("Authentication error");
          expect(err.data).to.eql({ a: "b", c: 3 });
          done();
        });
      });
    });

    it("should only call connection after fns", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      sio.use((socket: any, next) => {
        socket.name = "guillermo";
        next();
      });
      srv.listen(() => {
        const socket = client(srv);
        sio.on("connection", (socket) => {
          expect(socket.name).to.be("guillermo");
          done();
        });
      });
    });

    it("should only call connection after (lengthy) fns", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let authenticated = false;

      sio.use((socket, next) => {
        setTimeout(() => {
          authenticated = true;
          next();
        }, 300);
      });
      srv.listen(() => {
        const socket = client(srv);
        socket.on("connect", () => {
          expect(authenticated).to.be(true);
          done();
        });
      });
    });

    it("should be ignored if socket gets closed", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let socket;
      sio.use((s, next) => {
        socket.io.engine.close();
        s.client.conn.on("close", () => {
          process.nextTick(next);
          setTimeout(() => {
            done();
          }, 50);
        });
      });
      srv.listen(() => {
        socket = client(srv);
        sio.on("connection", (socket) => {
          done(new Error("should not fire"));
        });
      });
    });

    it("should call functions in expected order", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      const result: number[] = [];

      sio.use(() => {
        done(new Error("should not fire"));
      });
      sio.of("/chat").use((socket, next) => {
        result.push(1);
        setTimeout(next, 50);
      });
      sio.of("/chat").use((socket, next) => {
        result.push(2);
        setTimeout(next, 50);
      });
      sio.of("/chat").use((socket, next) => {
        result.push(3);
        setTimeout(next, 50);
      });

      srv.listen(() => {
        const chat = client(srv, "/chat");
        chat.on("connect", () => {
          expect(result).to.eql([1, 2, 3]);
          done();
        });
      });
    });

    it("should disable the merge of handshake packets", (done) => {
      const srv = createServer();
      const sio = new Server();
      sio.use((socket, next) => {
        next();
      });
      sio.listen(srv);
      const socket = client(srv);
      socket.on("connect", () => {
        done();
      });
    });

    it("should work with a custom namespace", (done) => {
      const srv = createServer();
      const sio = new Server();
      sio.listen(srv);
      sio.of("/chat").use((socket, next) => {
        next();
      });

      let count = 0;
      client(srv, "/").on("connect", () => {
        if (++count === 2) done();
      });
      client(srv, "/chat").on("connect", () => {
        if (++count === 2) done();
      });
    });
  });

  describe("socket middleware", () => {
    const { Socket } = require("../dist/socket");

    it("should call functions", (done) => {
      const srv = createServer();
      const sio = new Server(srv);
      let run = 0;

      srv.listen(() => {
        const socket = client(srv, { multiplex: false });

        socket.emit("join", "woot");

        sio.on("connection", (socket) => {
          socket.use((event, next) => {
            expect(event).to.eql(["join", "woot"]);
            event.unshift("wrap");
            run++;
            next();
          });
          socket.use((event, next) => {
            expect(event).to.eql(["wrap", "join", "woot"]);
            run++;
            next();
          });
          socket.on("wrap", (data1, data2) => {
            expect(data1).to.be("join");
            expect(data2).to.be("woot");
            expect(run).to.be(2);
            done();
          });
        });
      });
    });

    it("should pass errors", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const socket = client(srv, { multiplex: false });

        socket.emit("join", "woot");

        const success = () => {
          socket.close();
          sio.close();
          done();
        };

        sio.on("connection", (socket) => {
          socket.use((event, next) => {
            next(new Error("Authentication error"));
          });
          socket.use((event, next) => {
            done(new Error("should not happen"));
          });
          socket.on("join", () => {
            done(new Error("should not happen"));
          });
          socket.on("error", (err) => {
            expect(err).to.be.an(Error);
            expect(err.message).to.eql("Authentication error");
            success();
          });
        });
      });
    });
  });

  describe("v2 compatibility", () => {
    it("should connect if `allowEIO3` is true", (done) => {
      const srv = createServer();
      const sio = new Server(srv, {
        allowEIO3: true,
      });

      srv.listen(async () => {
        const port = (srv.address() as AddressInfo).port;
        const clientSocket = io_v2.connect(`http://localhost:${port}`, {
          multiplex: false,
        });

        const [socket]: Array<any> = await Promise.all([
          waitFor(sio, "connection"),
          waitFor(clientSocket, "connect"),
        ]);

        expect(socket.id).to.eql(clientSocket.id);
        success(sio, clientSocket, done);
      });
    });

    it("should be able to connect to a namespace with a query", (done) => {
      const srv = createServer();
      const sio = new Server(srv, {
        allowEIO3: true,
      });

      srv.listen(async () => {
        const port = (srv.address() as AddressInfo).port;
        const clientSocket = io_v2.connect(
          `http://localhost:${port}/the-namespace`,
          {
            multiplex: false,
          }
        );
        clientSocket.query = { test: "123" };

        const [socket]: Array<any> = await Promise.all([
          waitFor(sio.of("/the-namespace"), "connection"),
          waitFor(clientSocket, "connect"),
        ]);

        expect(socket.handshake.auth).to.eql({ test: "123" });
        success(sio, clientSocket, done);
      });
    });

    it("should not connect if `allowEIO3` is false (default)", (done) => {
      const srv = createServer();
      const sio = new Server(srv);

      srv.listen(() => {
        const port = (srv.address() as AddressInfo).port;
        const clientSocket = io_v2.connect(`http://localhost:${port}`, {
          multiplex: false,
        });

        clientSocket.on("connect", () => {
          done(new Error("should not happen"));
        });

        clientSocket.on("connect_error", () => {
          success(sio, clientSocket, done);
        });
      });
    });
  });
});
