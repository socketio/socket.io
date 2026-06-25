import {
  App,
  us_socket_local_port,
  us_listen_socket_close,
} from "uWebSockets.js";
import { Server } from "..";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import expect from "expect.js";
import { assert } from "./support/util";

const createPartialDone = (done: (err?: Error) => void, count: number) => {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    } else if (i > count) {
      done(new Error(`partialDone() called too many times: ${i} > ${count}`));
    }
  };
};

const shouldNotHappen = (done) => () => done(new Error("should not happen"));

describe("socket.io with uWebSocket.js-based engine", () => {
  let io: Server,
    uwsSocket: any,
    port: number,
    client: ClientSocket,
    clientWSOnly: ClientSocket,
    clientPollingOnly: ClientSocket,
    clientCustomNamespace: ClientSocket;

  beforeEach((done) => {
    const app = App();
    io = new Server();
    io.attachApp(app);

    io.of("/custom");

    app.listen(0, (listenSocket) => {
      uwsSocket = listenSocket;
      port = us_socket_local_port(listenSocket);

      client = ioc(`http://localhost:${port}`);
      clientWSOnly = ioc(`http://localhost:${port}`, {
        transports: ["websocket"],
      });
      clientPollingOnly = ioc(`http://localhost:${port}`, {
        transports: ["polling"],
      });
      clientCustomNamespace = ioc(`http://localhost:${port}/custom`);
    });

    const partialDone = createPartialDone(done, 4);
    client.once("connect", partialDone);
    clientWSOnly.once("connect", partialDone);
    clientPollingOnly.once("connect", partialDone);
    clientCustomNamespace.once("connect", partialDone);
  });

  afterEach(() => {
    io.close();
    us_listen_socket_close(uwsSocket);

    client.disconnect();
    clientWSOnly.disconnect();
    clientPollingOnly.disconnect();
    clientCustomNamespace.disconnect();
  });

  it("should broadcast", (done) => {
    const partialDone = createPartialDone(done, 3);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    io.emit("hello");
  });

  it("should broadcast in a namespace", (done) => {
    client.on("hello", shouldNotHappen(done));
    clientWSOnly.on("hello", shouldNotHappen(done));
    clientPollingOnly.on("hello", shouldNotHappen(done));
    clientCustomNamespace.on("hello", done);

    io.of("/custom").emit("hello");
  });

  it("should broadcast in a dynamic namespace", (done) => {
    const dynamicNamespace = io.of(/\/dynamic-\d+/);
    const dynamicClient = clientWSOnly.io.socket("/dynamic-101");

    dynamicClient.on("connect", () => {
      dynamicNamespace.emit("hello");
    });

    dynamicClient.on("hello", () => {
      dynamicClient.disconnect();
      done();
    });
  });

  it("should broadcast binary content", (done) => {
    const partialDone = createPartialDone(done, 3);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    io.emit("hello", Buffer.from([1, 2, 3]));
  });

  it("should broadcast volatile packet with binary content", (done) => {
    const partialDone = createPartialDone(done, 3);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    // wait to make sure there are no packets being sent for opening the connection
    setTimeout(() => {
      io.volatile.emit("hello", Buffer.from([1, 2, 3]));
    }, 20);
  });

  it("should broadcast in a room", (done) => {
    const partialDone = createPartialDone(done, 2);

    client.on("hello", shouldNotHappen(done));
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));
    assert(clientWSOnly.id);
    assert(clientPollingOnly.id);

    io.of("/").sockets.get(clientWSOnly.id)!.join("room1");
    io.of("/").sockets.get(clientPollingOnly.id)!.join("room1");

    io.to("room1").emit("hello");
  });

  it("should broadcast in multiple rooms", (done) => {
    const partialDone = createPartialDone(done, 2);

    client.on("hello", shouldNotHappen(done));
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));
    assert(clientWSOnly.id);
    assert(clientPollingOnly.id);

    io.of("/").sockets.get(clientWSOnly.id)!.join("room1");
    io.of("/").sockets.get(clientPollingOnly.id)!.join("room2");

    io.to(["room1", "room2"]).emit("hello");
  });

  it("should broadcast in all but a given room", (done) => {
    const partialDone = createPartialDone(done, 2);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", shouldNotHappen(done));
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    assert(clientWSOnly.id);
    assert(clientPollingOnly.id);
    io.of("/").sockets.get(clientWSOnly.id)!.join("room1");
    io.of("/").sockets.get(clientPollingOnly.id)!.join("room2");

    io.except("room2").emit("hello");
  });

  it("should work when joining a room in a middleware", (done) => {
    io.use((socket, next) => {
      socket.join("test");
      next();
    });

    client.disconnect().connect();
    clientPollingOnly.disconnect().connect();
    clientWSOnly.disconnect().connect();
    clientCustomNamespace.disconnect().connect();

    const partialDone = createPartialDone(done, 3);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", partialDone);
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    io.on("connection", () => {
      if (io.of("/").sockets.size === 3) {
        io.to("test").emit("hello");
      }
    });
  });

  it("should work even after leaving room", (done) => {
    const partialDone = createPartialDone(done, 2);

    client.on("hello", partialDone);
    clientWSOnly.on("hello", shouldNotHappen(done));
    clientPollingOnly.on("hello", partialDone);
    clientCustomNamespace.on("hello", shouldNotHappen(done));

    assert(client.id);
    assert(clientWSOnly.id);
    assert(clientPollingOnly.id);
    io.of("/").sockets.get(client.id)!.join("room1");
    io.of("/").sockets.get(clientPollingOnly.id)!.join("room1");

    io.of("/").sockets.get(clientWSOnly.id)!.join("room1");
    io.of("/").sockets.get(clientWSOnly.id)!.leave("room1");

    io.to("room1").emit("hello");
  });

  it("should not crash when socket is disconnected before the upgrade", (done) => {
    client.on("disconnect", () => done());

    assert(client.id);
    io.of("/").sockets.get(client.id)!.disconnect();
  });

  describe("static files", () => {
    const clientVersion = require("../package.json").version;

    it("should serve socket.io.js", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.js`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/javascript; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.js (with query params)", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.js?foo=bar`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/javascript; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.js.map", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.js.map`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/json; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.min.js", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.min.js`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/javascript; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.min.js.map", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.min.js.map`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/json; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.msgpack.min.js", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.msgpack.min.js`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/javascript; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should serve socket.io.msgpack.min.js.map", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.msgpack.min.js.map`,
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("content-type")).to.be(
        "application/json; charset=utf-8",
      );
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });

    it("should not serve unknown files from the Socket.IO path", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.esm.js`,
      );

      expect(res.status).to.be(404);
    });

    it("should return 404 for mismatching path", async () => {
      const res = await fetch(
        `http://localhost:${port}/abcdefghij/socket.io.js`,
      );

      expect(res.status).to.be(404);
    });

    it("should return 304 when If-None-Match matches ETag", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.js`,
        {
          headers: {
            "If-None-Match": '"' + clientVersion + '"',
          },
        },
      );

      expect(res.status).to.be(304);
    });

    it("should return 200 when If-None-Match does not match ETag", async () => {
      const res = await fetch(
        `http://localhost:${port}/socket.io/socket.io.js`,
        {
          headers: {
            "If-None-Match": '"wrong-version"',
          },
        },
      );

      expect(res.status).to.be(200);
      expect(res.headers.get("etag")).to.be('"' + clientVersion + '"');
    });
  });
});
