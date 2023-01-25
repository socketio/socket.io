import { Server } from "socket.io";
import expect from "expect.js";

export function createServer() {
  const server = new Server(3210, {
    pingInterval: 2000,
    connectionStateRecovery: {},
  });

  server.of("/foo").on("connection", (socket) => {
    socket.on("getId", (cb) => {
      cb(socket.id);
    });
  });

  server.of("/timeout_socket").on("connection", () => {
    // register namespace
  });

  server.of("/valid").on("connection", () => {
    // register namespace
  });

  server.of("/asd").on("connection", () => {
    // register namespace
  });

  server.of("/abc").on("connection", (socket) => {
    socket.emit("handshake", socket.handshake);
  });

  server.use((socket, next) => {
    // @ts-ignore
    if (socket.request._query.fail)
      return next(new Error("Auth failed (main namespace)"));
    next();
  });

  server.of("/no").use((socket, next) => {
    next(new Error("Auth failed (custom namespace)"));
  });

  server.on("connection", (socket) => {
    // simple test
    socket.on("hi", () => {
      socket.emit("hi");
    });

    socket.on("echo", (arg, cb) => {
      cb(arg);
    });

    // ack tests
    socket.on("ack", () => {
      socket.emit("ack", (a, b) => {
        if (a === 5 && b.test) {
          socket.emit("got it");
        }
      });
    });

    socket.on("getAckDate", (data, cb) => {
      cb(new Date());
    });

    socket.on("getDate", () => {
      socket.emit("takeDate", new Date());
    });

    socket.on("getDateObj", () => {
      socket.emit("takeDateObj", { date: new Date() });
    });

    socket.on("getUtf8", () => {
      socket.emit("takeUtf8", "てすと");
      socket.emit("takeUtf8", "Я Б Г Д Ж Й");
      socket.emit("takeUtf8", "Ä ä Ü ü ß");
      socket.emit("takeUtf8", "utf8 — string");
      socket.emit("takeUtf8", "utf8 — string");
    });

    // false test
    socket.on("false", () => {
      socket.emit("false", false);
    });

    // binary test
    socket.on("doge", () => {
      const buf = Buffer.from("asdfasdf", "utf8");
      socket.emit("doge", buf);
    });

    // expect receiving binary to be buffer
    socket.on("buffa", (a) => {
      if (Buffer.isBuffer(a)) socket.emit("buffack");
    });

    // expect receiving binary with mixed JSON
    socket.on("jsonbuff", (a) => {
      expect(a.hello).to.eql("lol");
      expect(Buffer.isBuffer(a.message)).to.be(true);
      expect(a.goodbye).to.eql("gotcha");
      socket.emit("jsonbuff-ack");
    });

    // expect receiving buffers in order
    let receivedAbuff1 = false;
    socket.on("abuff1", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      receivedAbuff1 = true;
    });
    socket.on("abuff2", (a) => {
      expect(receivedAbuff1).to.be(true);
      socket.emit("abuff2-ack");
    });

    // expect sent blob to be buffer
    socket.on("blob", (a) => {
      if (Buffer.isBuffer(a)) socket.emit("back");
    });

    // expect sent blob mixed with json to be buffer
    socket.on("jsonblob", (a) => {
      expect(a.hello).to.eql("lol");
      expect(Buffer.isBuffer(a.message)).to.be(true);
      expect(a.goodbye).to.eql("gotcha");
      socket.emit("jsonblob-ack");
    });

    // expect blobs sent in order to arrive in correct order
    let receivedblob1 = false;
    let receivedblob2 = false;
    socket.on("blob1", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      receivedblob1 = true;
    });
    socket.on("blob2", (a) => {
      expect(receivedblob1).to.be(true);
      expect(a).to.eql("second");
      receivedblob2 = true;
    });
    socket.on("blob3", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      expect(receivedblob1).to.be(true);
      expect(receivedblob2).to.be(true);
      socket.emit("blob3-ack");
    });

    // emit buffer to base64 receiving browsers
    socket.on("getbin", () => {
      const buf = Buffer.from("asdfasdf", "utf8");
      socket.emit("takebin", buf);
    });

    socket.on("getHandshake", (cb) => {
      cb(socket.handshake);
    });

    socket.on("getId", (cb) => {
      cb(socket.id);
    });
  });

  return server;
}
