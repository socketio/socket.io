import { Server } from "..";
import { createServer } from "http";
import request from "supertest";
import expect from "expect.js";
import { getPort, successFn } from "./support/util";

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
          expect(res.headers["content-type"]).to.be(
            "application/javascript; charset=utf-8"
          );
          expect(res.headers.etag).to.be('"' + clientVersion + '"');
          expect(res.headers["x-sourcemap"]).to.be(undefined);
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
          expect(res.headers["content-type"]).to.be(
            "application/json; charset=utf-8"
          );
          expect(res.headers.etag).to.be('"' + clientVersion + '"');
          expect(res.text).to.match(/engine\.io/);
          expect(res.status).to.be(200);
          done();
        });
    };

    it("should serve client", testSource("socket.io.js"));
    it(
      "should serve client with query string",
      testSource("socket.io.js?buster=" + Date.now())
    );
    it("should serve source map", testSourceMap("socket.io.js.map"));
    it("should serve client (min)", testSource("socket.io.min.js"));

    it("should serve source map (min)", testSourceMap("socket.io.min.js.map"));

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

    it("should serve the ESM bundle", testSource("socket.io.esm.min.js"));

    it(
      "should serve the source map for the ESM bundle",
      testSourceMap("socket.io.esm.min.js.map")
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
      const io = new Server(0);

      request(`http://localhost:${getPort(io)}`)
        .get("/socket.io/socket.io.js")
        .expect(200, successFn(done, io));
    });

    it("with listen", (done) => {
      const io = new Server().listen(0);

      request(`http://localhost:${getPort(io)}`)
        .get("/socket.io/socket.io.js")
        .expect(200, successFn(done, io));
    });
  });
});
