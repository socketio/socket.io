import { Server } from "..";
import expect from "expect.js";
import {
  createClient,
  createPartialDone,
  success,
  successFn,
  waitFor,
} from "./support/util";

describe("messaging many", () => {
  it("emits to a namespace", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/test");

    const partialDone = createPartialDone(
      2,
      successFn(done, io, socket1, socket2, socket3)
    );

    socket1.on("a", (a) => {
      expect(a).to.be("b");
      partialDone();
    });
    socket2.on("a", (a) => {
      expect(a).to.be("b");
      partialDone();
    });
    socket3.on("a", () => {
      done(new Error("not"));
    });

    let sockets = 3;
    io.on("connection", () => {
      --sockets || emit();
    });
    io.of("/test", () => {
      --sockets || emit();
    });

    function emit() {
      io.emit("a", "b");
    }
  });

  it("emits binary data to a namespace", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/test");

    const partialDone = createPartialDone(
      2,
      successFn(done, io, socket1, socket2, socket3)
    );

    socket1.on("bin", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      partialDone();
    });
    socket2.on("bin", (a) => {
      expect(Buffer.isBuffer(a)).to.be(true);
      partialDone();
    });
    socket3.on("bin", () => {
      done(new Error("not"));
    });

    let sockets = 3;
    io.on("connection", () => {
      --sockets || emit();
    });
    io.of("/test", () => {
      --sockets || emit();
    });

    function emit() {
      io.emit("bin", Buffer.alloc(10));
    }
  });

  it("emits to the rest", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/test");

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

    io.on("connection", (socket) => {
      socket.on("broadcast", () => {
        socket.broadcast.emit("a", "b");
      });
      socket.on("finish", () => {
        success(done, io, socket1, socket2, socket3);
      });
    });
  });

  it("emits to rooms", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });

    socket2.on("a", () => {
      done(new Error("not"));
    });
    socket1.on("a", () => {
      success(done, io, socket1, socket2);
    });
    socket1.emit("join", "woot");
    socket1.emit("emit", "woot");

    io.on("connection", (socket) => {
      socket.on("join", (room, fn) => {
        socket.join(room);
        fn && fn();
      });

      socket.on("emit", (room) => {
        io.in(room).emit("a");
      });
    });
  });

  it("emits to rooms avoiding dupes", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });

    const partialDone = createPartialDone(
      2,
      successFn(done, io, socket1, socket2)
    );

    socket2.on("a", () => {
      done(new Error("not"));
    });
    socket1.on("a", partialDone);
    socket2.on("b", partialDone);

    socket1.emit("join", "woot");
    socket1.emit("join", "test");
    socket2.emit("join", "third", () => {
      socket2.emit("emit");
    });

    io.on("connection", (socket) => {
      socket.on("join", (room, fn) => {
        socket.join(room);
        fn && fn();
      });

      socket.on("emit", () => {
        io.in("woot").in("test").emit("a");
        io.in("third").emit("b");
      });
    });
  });

  it("broadcasts to rooms", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    const partialDone = createPartialDone(
      2,
      successFn(done, io, socket1, socket2, socket3)
    );

    socket1.emit("join", "woot");
    socket2.emit("join", "test");
    socket3.emit("join", "test", () => {
      socket3.emit("broadcast");
    });

    socket1.on("a", () => {
      done(new Error("not"));
    });
    socket2.on("a", () => {
      partialDone();
    });
    socket3.on("a", () => {
      done(new Error("not"));
    });
    socket3.on("b", () => {
      partialDone();
    });

    io.on("connection", (socket) => {
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

  it("broadcasts binary data to rooms", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    const partialDone = createPartialDone(
      2,
      successFn(done, io, socket1, socket2, socket3)
    );

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
      partialDone();
    });
    socket2.on("bin2", (data) => {
      throw new Error("socket2 got bin2");
    });
    socket3.on("bin", (data) => {
      throw new Error("socket3 got bin");
    });
    socket3.on("bin2", (data) => {
      expect(Buffer.isBuffer(data)).to.be(true);
      partialDone();
    });

    io.on("connection", (socket) => {
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

  it("keeps track of rooms", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.join("a");
      expect(s.rooms).to.contain(s.id, "a");
      s.join("b");
      expect(s.rooms).to.contain(s.id, "a", "b");
      s.join("c");
      expect(s.rooms).to.contain(s.id, "a", "b", "c");
      s.leave("b");
      expect(s.rooms).to.contain(s.id, "a", "c");
      (s as any).leaveAll();
      expect(s.rooms.size).to.eql(0);

      success(done, io, socket);
    });
  });

  it("deletes empty rooms", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.join("a");
      expect(s.nsp.adapter.rooms).to.contain("a");
      s.leave("a");
      expect(s.nsp.adapter.rooms).to.not.contain("a");

      success(done, io, socket);
    });
  });

  it("should properly cleanup left rooms", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.join("a");
      expect(s.rooms).to.contain(s.id, "a");
      s.join("b");
      expect(s.rooms).to.contain(s.id, "a", "b");
      s.leave("unknown");
      expect(s.rooms).to.contain(s.id, "a", "b");
      (s as any).leaveAll();
      expect(s.rooms.size).to.eql(0);

      success(done, io, socket);
    });
  });

  it("allows to join several rooms at once", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
      s.join(["a", "b", "c"]);
      expect(s.rooms).to.contain(s.id, "a", "b", "c");
      success(done, io, socket);
    });
  });

  it("should exclude specific sockets when broadcasting", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket2.on("a", () => {
      done(new Error("not"));
    });
    socket3.on("a", () => {
      done(new Error("not"));
    });
    socket1.on("a", successFn(done, io, socket1, socket2, socket3));

    io.on("connection", (socket) => {
      socket.on("exclude", (id) => {
        socket.broadcast.except(id).emit("a");
      });
    });

    socket2.on("connect", () => {
      socket3.emit("exclude", socket2.id);
    });
  });

  it("should exclude a specific room when broadcasting", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket2.on("a", () => {
      done(new Error("not"));
    });
    socket3.on("a", () => {
      done(new Error("not"));
    });
    socket1.on("a", successFn(done, io, socket1, socket2, socket3));

    io.on("connection", (socket) => {
      socket.on("join", (room, cb) => {
        socket.join(room);
        cb();
      });
      socket.on("broadcast", () => {
        socket.broadcast.except("room1").emit("a");
      });
    });

    socket2.emit("join", "room1", () => {
      socket3.emit("broadcast");
    });
  });

  it("should return an immutable broadcast operator", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io);

    io.on("connection", (socket) => {
      const operator = socket.local
        .compress(false)
        .to(["room1", "room2"])
        .except("room3");
      operator.compress(true).emit("hello");
      operator.volatile.emit("hello");
      operator.to("room4").emit("hello");
      operator.except("room5").emit("hello");
      socket.emit("hello");
      socket.to("room6").emit("hello");
      // @ts-ignore
      expect(operator.rooms).to.contain("room1", "room2");
      // @ts-ignore
      expect(operator.rooms).to.not.contain("room4", "room5", "room6");
      // @ts-ignore
      expect(operator.exceptRooms).to.contain("room3");
      // @ts-ignore
      expect(operator.flags).to.eql({ local: true, compress: false });

      success(done, io, clientSocket);
    });
  });

  it("should broadcast and expect multiple acknowledgements", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket1.on("some event", (cb) => {
      cb(1);
    });

    socket2.on("some event", (cb) => {
      cb(2);
    });

    socket3.on("some event", (cb) => {
      cb(3);
    });

    Promise.all([
      waitFor(socket1, "connect"),
      waitFor(socket2, "connect"),
      waitFor(socket3, "connect"),
    ]).then(() => {
      io.timeout(2000).emit("some event", (err, responses) => {
        expect(err).to.be(null);
        expect(responses).to.have.length(3);
        expect(responses).to.contain(1, 2, 3);

        success(done, io, socket1, socket2, socket3);
      });
    });
  });

  it("should fail when a client does not acknowledge the event in the given delay", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket1.on("some event", (cb) => {
      cb(1);
    });

    socket2.on("some event", (cb) => {
      cb(2);
    });

    socket3.on("some event", () => {
      // timeout
    });

    Promise.all([
      waitFor(socket1, "connect"),
      waitFor(socket2, "connect"),
      waitFor(socket3, "connect"),
    ]).then(() => {
      io.timeout(200).emit("some event", (err, responses) => {
        expect(err).to.be.an(Error);
        expect(responses).to.have.length(2);
        expect(responses).to.contain(1, 2);

        success(done, io, socket1, socket2, socket3);
      });
    });
  });

  it("should broadcast and expect multiple acknowledgements (promise)", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket1.on("some event", (cb) => {
      cb(1);
    });

    socket2.on("some event", (cb) => {
      cb(2);
    });

    socket3.on("some event", (cb) => {
      cb(3);
    });

    Promise.all([
      waitFor(socket1, "connect"),
      waitFor(socket2, "connect"),
      waitFor(socket3, "connect"),
    ]).then(async () => {
      const responses = await io.timeout(2000).emitWithAck("some event");
      expect(responses).to.contain(1, 2, 3);

      success(done, io, socket1, socket2, socket3);
    });
  });

  it("should fail when a client does not acknowledge the event in the given delay (promise)", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket1.on("some event", (cb) => {
      cb(1);
    });

    socket2.on("some event", (cb) => {
      cb(2);
    });

    socket3.on("some event", () => {
      // timeout
    });

    Promise.all([
      waitFor(socket1, "connect"),
      waitFor(socket2, "connect"),
      waitFor(socket3, "connect"),
    ]).then(async () => {
      try {
        await io.timeout(200).emitWithAck("some event");
        expect.fail();
      } catch (err) {
        expect(err).to.be.an(Error);
        // @ts-ignore
        expect(err.responses).to.have.length(2);
        // @ts-ignore
        expect(err.responses).to.contain(1, 2);

        success(done, io, socket1, socket2, socket3);
      }
    });
  });

  it("should broadcast and return if the packet is sent to 0 client", (done) => {
    const io = new Server(0);
    const socket1 = createClient(io, "/", { multiplex: false });
    const socket2 = createClient(io, "/", { multiplex: false });
    const socket3 = createClient(io, "/", { multiplex: false });

    socket1.on("some event", () => {
      done(new Error("should not happen"));
    });

    socket2.on("some event", () => {
      done(new Error("should not happen"));
    });

    socket3.on("some event", () => {
      done(new Error("should not happen"));
    });

    io.to("room123")
      .timeout(200)
      .emit("some event", (err, responses) => {
        expect(err).to.be(null);
        expect(responses).to.have.length(0);

        success(done, io, socket1, socket2, socket3);
      });
  });

  it("should precompute the WebSocket frame when broadcasting", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/chat", {
      transports: ["websocket"],
    });
    const partialDone = createPartialDone(2, successFn(done, io, socket));

    io.of("/chat").on("connection", (s) => {
      s.conn.once("packetCreate", (packet) => {
        expect(packet.options.wsPreEncodedFrame).to.be.an(Array);
        partialDone();
      });
      io.of("/chat").compress(false).emit("woot", "hi");
    });

    socket.on("woot", partialDone);
  });
});
