import fs = require("fs");
import { join } from "path";
import {
  createClient,
  createPartialDone,
  getPort,
  success,
  successFn,
} from "./support/util";
import { Server } from "..";
import expect from "expect.js";

describe("socket", () => {
  it("should not fire events more than once after manually reconnecting", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io, "/", { reconnection: false });

    clientSocket.on("connect", function init() {
      clientSocket.off("connect", init);
      clientSocket.io.engine.close();

      process.nextTick(() => {
        clientSocket.connect();
      });
      clientSocket.on("connect", successFn(done, io, clientSocket));
    });
  });

  it("should not fire reconnect_failed event more than once when server closed", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io, "/", {
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
    });

    clientSocket.on("connect", () => {
      io.close();
    });

    clientSocket.io.on("reconnect_failed", () => {
      success(done, io, clientSocket);
    });
  });

  it("should receive events", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("random", (a, b, c) => {
        expect(a).to.be(1);
        expect(b).to.be("2");
        expect(c).to.eql([3]);

        success(done, io, socket);
      });
      socket.emit("random", 1, "2", [3]);
    });
  });

  it("should receive message events through `send`", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("message", (a) => {
        expect(a).to.be(1337);

        success(done, io, socket);
      });
      socket.send(1337);
    });
  });

  it("should error with null messages", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("message", (a) => {
        expect(a).to.be(null);
        success(done, io, socket);
      });
      socket.send(null);
    });
  });

  it("should handle transport null messages", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { reconnection: false });

    io.on("connection", (s) => {
      s.on("error", (err) => {
        expect(err).to.be.an(Error);
        s.on("disconnect", (reason) => {
          expect(reason).to.be("forced close");

          success(done, io, socket);
        });
      });
      (s as any).client.ondata(null);
    });
  });

  it("should emit events", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    socket.on("woot", (a) => {
      expect(a).to.be("tobi");
      success(done, io, socket);
    });
    io.on("connection", (s) => {
      s.emit("woot", "tobi");
    });
  });

  it("should emit events with utf8 multibyte character", (done) => {
    const io = new Server(0);
    const socket = createClient(io);
    let i = 0;

    socket.on("hoot", (a) => {
      expect(a).to.be("utf8 — string");
      i++;

      if (3 == i) {
        success(done, io, socket);
      }
    });
    io.on("connection", (s) => {
      s.emit("hoot", "utf8 — string");
      s.emit("hoot", "utf8 — string");
      s.emit("hoot", "utf8 — string");
    });
  });

  it("should emit events with binary data", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    let imageData;
    socket.on("doge", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      expect(imageData.length).to.equal(a.length);
      expect(imageData[0]).to.equal(a[0]);
      expect(imageData[imageData.length - 1]).to.equal(a[a.length - 1]);

      success(done, io, socket);
    });
    io.on("connection", (s) => {
      fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
        if (err) return done(err);
        imageData = data;
        s.emit("doge", data);
      });
    });
  });

  it("should emit events with several types of data (including binary)", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    socket.on("multiple", (a, b, c, d, e, f) => {
      expect(a).to.be(1);
      expect(Buffer.isBuffer(b)).to.be(true);
      expect(c).to.be("3");
      expect(d).to.eql([4]);
      expect(Buffer.isBuffer(e)).to.be(true);
      expect(Buffer.isBuffer(f[0])).to.be(true);
      expect(f[1]).to.be("swag");
      expect(Buffer.isBuffer(f[2])).to.be(true);

      success(done, io, socket);
    });
    io.on("connection", (s) => {
      fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
        if (err) return done(err);
        const buf = Buffer.from("asdfasdf", "utf8");
        s.emit("multiple", 1, data, "3", [4], buf, [data, "swag", buf]);
      });
    });
  });

  it("should receive events with binary data", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("buff", (a) => {
        expect(Buffer.isBuffer(a)).to.be(true);

        success(done, io, socket);
      });
      const buf = Buffer.from("abcdefg", "utf8");
      socket.emit("buff", buf);
    });
  });

  it("should receive events with several types of data (including binary)", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("multiple", (a, b, c, d, e, f) => {
        expect(a).to.be(1);
        expect(Buffer.isBuffer(b)).to.be(true);
        expect(c).to.be("3");
        expect(d).to.eql([4]);
        expect(Buffer.isBuffer(e)).to.be(true);
        expect(Buffer.isBuffer(f[0])).to.be(true);
        expect(f[1]).to.be("swag");
        expect(Buffer.isBuffer(f[2])).to.be(true);

        success(done, io, socket);
      });
      fs.readFile(join(__dirname, "support", "doge.jpg"), (err, data) => {
        if (err) return done(err);
        const buf = Buffer.from("asdfasdf", "utf8");
        socket.emit("multiple", 1, data, "3", [4], buf, [data, "swag", buf]);
      });
    });
  });

  it("should not emit volatile event after regular event (polling)", (done) => {
    const io = new Server(0, { transports: ["polling"] });

    let counter = 0;
    io.on("connection", (s) => {
      s.emit("ev", "data");
      s.volatile.emit("ev", "data");
    });

    const socket = createClient(io, "/", { transports: ["polling"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should not emit volatile event after regular event (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      s.emit("ev", "data");
      s.volatile.emit("ev", "data");
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should emit volatile event (polling)", (done) => {
    const io = new Server(0, { transports: ["polling"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.volatile.emit("ev", "data");
      }, 100);
    });

    const socket = createClient(io, "/", { transports: ["polling"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 500);
  });

  it("should emit volatile event (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.volatile.emit("ev", "data");
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should emit only one consecutive volatile event (polling)", (done) => {
    const io = new Server(0, { transports: ["polling"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.volatile.emit("ev", "data");
        s.volatile.emit("ev", "data");
      }, 100);
    });

    const socket = createClient(io, "/", { transports: ["polling"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 500);
  });

  it("should emit only one consecutive volatile event (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.volatile.emit("ev", "data");
        s.volatile.emit("ev", "data");
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should emit only one consecutive volatile event with binary (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.volatile.emit("ev", Buffer.from([1, 2, 3]));
        s.volatile.emit("ev", Buffer.from([4, 5, 6]));
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should broadcast only one consecutive volatile event with binary (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        io.volatile.emit("ev", Buffer.from([1, 2, 3]));
        io.volatile.emit("ev", Buffer.from([4, 5, 6]));
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 200);
  });

  it("should emit regular events after trying a failed volatile event (polling)", (done) => {
    const io = new Server(0, { transports: ["polling"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.emit("ev", "data");
        s.volatile.emit("ev", "data");
        s.emit("ev", "data");
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["polling"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(2);
      success(done, io, socket);
    }, 200);
  });

  it("should emit regular events after trying a failed volatile event (ws)", (done) => {
    const io = new Server(0, { transports: ["websocket"] });

    let counter = 0;
    io.on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        s.emit("ev", "data");
        s.volatile.emit("ev", "data");
        s.emit("ev", "data");
      }, 20);
    });

    const socket = createClient(io, "/", { transports: ["websocket"] });
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(2);
      success(done, io, socket);
    }, 200);
  });

  it("should emit message events through `send`", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    socket.on("message", (a) => {
      expect(a).to.be("a");
      success(done, io, socket);
    });
    io.on("connection", (s) => {
      s.send("a");
    });
  });

  it("should receive event with callbacks", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("woot", (fn) => {
        fn(1, 2);
      });
      socket.emit("woot", (a, b) => {
        expect(a).to.be(1);
        expect(b).to.be(2);
        success(done, io, socket);
      });
    });
  });

  it("should receive all events emitted from namespaced client immediately and in order", (done) => {
    const io = new Server(0);
    let total = 0;

    io.of("/chat", (s) => {
      s.on("hi", (letter) => {
        total++;
        if (total == 2 && letter == "b") {
          success(done, io, chat);
        } else if (total == 1 && letter != "a") {
          throw new Error("events out of order");
        }
      });
    });

    const chat = createClient(io, "/chat");
    chat.emit("hi", "a");
    setTimeout(() => {
      chat.emit("hi", "b");
    }, 50);
  });

  it("should emit events with callbacks", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      socket.on("hi", (fn) => {
        fn();
      });
      s.emit("hi", () => {
        success(done, io, socket);
      });
    });
  });

  it("should receive events with args and callback", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("woot", (a, b, fn) => {
        expect(a).to.be(1);
        expect(b).to.be(2);
        fn();
      });
      socket.emit("woot", 1, 2, () => {
        success(done, io, socket);
      });
    });
  });

  it("should emit events with args and callback", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      socket.on("hi", (a, b, fn) => {
        expect(a).to.be(1);
        expect(b).to.be(2);
        fn();
      });
      s.emit("hi", 1, 2, () => {
        success(done, io, socket);
      });
    });
  });

  it("should receive events with binary args and callbacks", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("woot", (buf, fn) => {
        expect(Buffer.isBuffer(buf)).to.be(true);
        fn(1, 2);
      });
      socket.emit("woot", Buffer.alloc(3), (a, b) => {
        expect(a).to.be(1);
        expect(b).to.be(2);
        success(done, io, socket);
      });
    });
  });

  it("should emit events with binary args and callback", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      socket.on("hi", (a, fn) => {
        expect(Buffer.isBuffer(a)).to.be(true);
        fn();
      });
      s.emit("hi", Buffer.alloc(4), () => {
        success(done, io, socket);
      });
    });
  });

  it("should emit events and receive binary data in a callback", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      socket.on("hi", (fn) => {
        fn(Buffer.alloc(1));
      });
      s.emit("hi", (a) => {
        expect(Buffer.isBuffer(a)).to.be(true);
        success(done, io, socket);
      });
    });
  });

  it("should receive events and pass binary data in a callback", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.on("woot", (fn) => {
        fn(Buffer.alloc(2));
      });
      socket.emit("woot", (a) => {
        expect(Buffer.isBuffer(a)).to.be(true);
        success(done, io, socket);
      });
    });
  });

  it("should emit an event and wait for the acknowledgement", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", async (s) => {
      socket.on("hi", (a, b, fn) => {
        expect(a).to.be(1);
        expect(b).to.be(2);
        fn(3);
      });

      const val = await s.emitWithAck("hi", 1, 2);
      expect(val).to.be(3);

      success(done, io, socket);
    });
  });

  it("should have access to the client", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      expect(s.client).to.be.an("object");
      success(done, io, socket);
    });
  });

  it("should have access to the connection", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      expect(s.client.conn).to.be.an("object");
      expect(s.conn).to.be.an("object");
      success(done, io, socket);
    });
  });

  it("should have access to the request", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      expect(s.client.request.headers).to.be.an("object");
      expect(s.request.headers).to.be.an("object");
      success(done, io, socket);
    });
  });

  it("should see query parameters in the request", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { query: { key1: 1, key2: 2 } });

    io.on("connection", (s) => {
      const parsed = require("url").parse(s.request.url);
      const query = require("querystring").parse(parsed.query);
      expect(query.key1).to.be("1");
      expect(query.key2).to.be("2");
      success(done, io, socket);
    });
  });

  it("should see query parameters sent from secondary namespace connections in handshake object", (done) => {
    const io = new Server(0);
    const client1 = createClient(io);
    const client2 = createClient(io, "/connection2", {
      auth: { key1: "aa", key2: "&=bb" },
    });
    io.on("connection", (s) => {});
    io.of("/connection2").on("connection", (s) => {
      expect(s.handshake.query.key1).to.be(undefined);
      expect(s.handshake.query.EIO).to.be("4");
      expect(s.handshake.auth.key1).to.be("aa");
      expect(s.handshake.auth.key2).to.be("&=bb");
      success(done, io, client1, client2);
    });
  });

  it("should handle very large json", function (done) {
    this.timeout(30000);
    const io = new Server(0, { perMessageDeflate: false });
    let received = 0;

    const socket = createClient(io);
    socket.on("big", (a) => {
      expect(Buffer.isBuffer(a.json)).to.be(false);
      if (++received == 3) success(done, io, socket);
      else socket.emit("big", a);
    });
    io.on("connection", (s) => {
      fs.readFile(join(__dirname, "fixtures", "big.json"), (err, data: any) => {
        if (err) return done(err);
        data = JSON.parse(data);
        s.emit("big", { hello: "friend", json: data });
      });
      s.on("big", (a) => {
        s.emit("big", a);
      });
    });
  });

  it("should handle very large binary data", function (done) {
    this.timeout(30000);
    const io = new Server(0, { perMessageDeflate: false });
    let received = 0;

    const socket = createClient(io);
    socket.on("big", (a) => {
      expect(Buffer.isBuffer(a.image)).to.be(true);
      if (++received == 3) success(done, io, socket);
      else socket.emit("big", a);
    });
    io.on("connection", (s) => {
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

  it("should be able to emit after server close and restart", (done) => {
    const io = new Server(0);

    io.on("connection", (socket) => {
      socket.on("ev", (data) => {
        expect(data).to.be("payload");
        success(done, io, clientSocket);
      });
    });

    const port = getPort(io);
    const clientSocket = createClient(io, "/", {
      reconnectionAttempts: 10,
      reconnectionDelay: 100,
    });
    clientSocket.once("connect", () => {
      io.close(() => {
        clientSocket.io.on("reconnect", () => {
          clientSocket.emit("ev", "payload");
        });
        io.listen(port);
      });
    });
  });

  it("should enable compression by default", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/chat");

    io.of("/chat").on("connection", (s) => {
      s.conn.once("packetCreate", (packet) => {
        expect(packet.options.compress).to.be(true);
        success(done, io, socket);
      });
      s.emit("woot", "hi");
    });
  });

  it("should disable compression", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/chat");

    io.of("/chat").on("connection", (s) => {
      s.conn.once("packetCreate", (packet) => {
        expect(packet.options.compress).to.be(false);
        success(done, io, socket);
      });
      s.compress(false).emit("woot", "hi");
    });
  });

  it("should error with raw binary and warn", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { reconnection: false });

    io.on("connection", (s) => {
      s.conn.on("upgrade", () => {
        console.log(
          "\u001b[96mNote: warning expected and normal in test.\u001b[39m"
        );
        // @ts-ignore
        socket.io.engine.write("5woooot");
        setTimeout(() => {
          success(done, io, socket);
        }, 100);
      });
    });
  });

  it("should not crash when receiving an error packet without handler", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { reconnection: false });

    io.on("connection", (s) => {
      s.conn.on("upgrade", () => {
        console.log(
          "\u001b[96mNote: warning expected and normal in test.\u001b[39m"
        );
        // @ts-ignore
        socket.io.engine.write('44["handle me please"]');
        setTimeout(() => {
          success(done, io, socket);
        }, 100);
      });
    });
  });

  it("should not crash with raw binary", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { reconnection: false });

    io.on("connection", (s) => {
      s.once("error", (err) => {
        expect(err.message).to.match(/Illegal attachments/);
        success(done, io, socket);
      });
      s.conn.on("upgrade", () => {
        // @ts-ignore
        socket.io.engine.write("5woooot");
      });
    });
  });

  it("should handle empty binary packet", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/", { reconnection: false });

    io.on("connection", (s) => {
      s.once("error", (err) => {
        expect(err.message).to.match(/Illegal attachments/);
        success(done, io, socket);
      });
      s.conn.on("upgrade", () => {
        // @ts-ignore
        socket.io.engine.write("5");
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
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", successFn(done, io, socket));
  });

  it("should throw on reserved event", (done) => {
    const io = new Server(0);

    const socket = createClient(io);
    io.on("connection", (s) => {
      expect(() => s.emit("connect_error")).to.throwException(
        /"connect_error" is a reserved event name/
      );
      socket.close();
      success(done, io, socket);
    });
  });

  it("should ignore a packet received after disconnection", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io);

    io.on("connection", (socket) => {
      socket.on("test", () => {
        done(new Error("should not happen"));
      });
      socket.on("disconnect", successFn(done, io, clientSocket));
    });

    clientSocket.on("connect", () => {
      clientSocket.emit("test", Buffer.alloc(10));
      clientSocket.disconnect();
    });
  });

  it("should leave all rooms joined after a middleware failure", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    io.use((socket, next) => {
      socket.join("room1");
      next(new Error("nope"));
    });

    client.on("connect_error", () => {
      expect(io.of("/").adapter.rooms.size).to.eql(0);

      io.close();
      success(done, io, client);
    });
  });

  it("should not join rooms after disconnection", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    io.on("connection", (socket) => {
      socket.disconnect();
      socket.join("room1");
    });

    client.on("disconnect", () => {
      expect(io.of("/").adapter.rooms.size).to.eql(0);

      io.close();
      success(done, io, client);
    });
  });

  describe("onAny", () => {
    it("should call listener", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      clientSocket.emit("my-event", "123");

      io.on("connection", (socket) => {
        socket.onAny((event, arg1) => {
          expect(event).to.be("my-event");
          expect(arg1).to.be("123");
          success(done, io, clientSocket);
        });
      });
    });

    it("should prepend listener", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      clientSocket.emit("my-event", "123");

      io.on("connection", (socket) => {
        let count = 0;

        socket.onAny((event, arg1) => {
          expect(count).to.be(2);
          success(done, io, clientSocket);
        });

        socket.prependAny(() => {
          expect(count++).to.be(1);
        });

        socket.prependAny(() => {
          expect(count++).to.be(0);
        });
      });
    });

    it("should remove listener", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      clientSocket.emit("my-event", "123");

      io.on("connection", (socket) => {
        const fail = () => done(new Error("fail"));

        socket.onAny(fail);
        socket.offAny(fail);
        expect(socket.listenersAny.length).to.be(0);

        socket.onAny(() => {
          success(done, io, clientSocket);
        });
      });
    });
  });

  describe("onAnyOutgoing", () => {
    it("should call listener", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      io.on("connection", (socket) => {
        socket.onAnyOutgoing((event, arg1) => {
          expect(event).to.be("my-event");
          expect(arg1).to.be("123");

          success(done, io, clientSocket);
        });

        socket.emit("my-event", "123");
      });
    });

    it("should call listener when broadcasting", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      io.on("connection", (socket) => {
        socket.onAnyOutgoing((event, arg1) => {
          expect(event).to.be("my-event");
          expect(arg1).to.be("123");

          success(done, io, clientSocket);
        });

        io.emit("my-event", "123");
      });
    });

    it("should call listener when broadcasting binary data", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      io.on("connection", (socket) => {
        socket.onAnyOutgoing((event, arg1) => {
          expect(event).to.be("my-event");
          expect(arg1).to.be.an(Uint8Array);

          success(done, io, clientSocket);
        });

        io.emit("my-event", Uint8Array.of(1, 2, 3));
      });
    });

    it("should prepend listener", (done) => {
      const io = new Server(0);
      const clientSocket = createClient(io, "/", { multiplex: false });

      io.on("connection", (socket) => {
        let count = 0;

        socket.onAnyOutgoing((event, arg1) => {
          expect(count).to.be(2);

          success(done, io, clientSocket);
        });

        socket.prependAnyOutgoing(() => {
          expect(count++).to.be(1);
        });

        socket.prependAnyOutgoing(() => {
          expect(count++).to.be(0);
        });

        socket.emit("my-event", "123");
      });
    });

    it("should remove listener", (done) => {
      const io = new Server(0);

      const clientSocket = createClient(io, "/", { multiplex: false });

      io.on("connection", (socket) => {
        const fail = () => done(new Error("fail"));

        socket.onAnyOutgoing(fail);
        socket.offAnyOutgoing(fail);
        expect(socket.listenersAnyOutgoing.length).to.be(0);

        socket.onAnyOutgoing(() => {
          success(done, io, clientSocket);
        });

        socket.emit("my-event", "123");
      });
    });

    it("should disconnect all namespaces when calling disconnect(true)", (done) => {
      const io = new Server(0);
      io.of("/foo");
      io.of("/bar");

      const socket1 = createClient(io, "/", {
        transports: ["websocket"],
      });
      const socket2 = createClient(io, "/foo");
      const socket3 = createClient(io, "/bar");

      io.of("/bar").on("connection", (socket) => {
        socket.disconnect(true);
      });

      const partialDone = createPartialDone(
        3,
        successFn(done, io, socket1, socket2, socket3)
      );

      socket1.on("disconnect", partialDone);
      socket2.on("disconnect", partialDone);
      socket3.on("disconnect", partialDone);
    });
  });
});
