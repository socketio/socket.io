import type { SocketId } from "socket.io-adapter";
import { Server, Namespace, Socket } from "..";
import expect from "expect.js";
import {
  success,
  createClient,
  successFn,
  createPartialDone,
} from "./support/util";

describe("namespaces", () => {
  it("should be accessible through .sockets", () => {
    const io = new Server();
    expect(io.sockets).to.be.a(Namespace);
  });

  it("should be aliased", () => {
    const io = new Server();
    expect(io.use).to.be.a("function");
    expect(io.to).to.be.a("function");
    expect(io["in"]).to.be.a("function");
    expect(io.emit).to.be.a("function");
    expect(io.send).to.be.a("function");
    expect(io.write).to.be.a("function");
    expect(io.allSockets).to.be.a("function");
    expect(io.compress).to.be.a("function");
  });

  it("should return an immutable broadcast operator", () => {
    const io = new Server();
    const operator = io.local.to(["room1", "room2"]).except("room3");
    operator.compress(true).emit("hello");
    operator.volatile.emit("hello");
    operator.to("room4").emit("hello");
    operator.except("room5").emit("hello");
    io.to("room6").emit("hello");
    // @ts-ignore
    expect(operator.rooms).to.contain("room1", "room2");
    // @ts-ignore
    expect(operator.exceptRooms).to.contain("room3");
    // @ts-ignore
    expect(operator.flags).to.eql({ local: true });
  });

  it("should automatically connect", (done) => {
    const io = new Server(0);
    const socket = createClient(io);
    socket.on("connect", successFn(done, io, socket));
  });

  it("should fire a `connection` event", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io);

    io.on("connection", (socket) => {
      expect(socket).to.be.a(Socket);
      success(done, io, clientSocket);
    });
  });

  it("should fire a `connect` event", (done) => {
    const io = new Server(0);
    const clientSocket = createClient(io);

    io.on("connect", (socket) => {
      expect(socket).to.be.a(Socket);
      success(done, io, clientSocket);
    });
  });

  it("should work with many sockets", (done) => {
    const io = new Server(0);
    io.of("/chat");
    io.of("/news");
    const chat = createClient(io, "/chat");
    const news = createClient(io, "/news");

    let total = 2;
    chat.on("connect", () => {
      --total || success(done, io, chat, news);
    });
    news.on("connect", () => {
      --total || success(done, io, chat, news);
    });
  });

  it('should be able to equivalently start with "" or "/" on server', (done) => {
    const io = new Server(0);
    const c1 = createClient(io, "/");
    const c2 = createClient(io, "/abc");

    let total = 2;
    io.of("").on("connection", () => {
      --total || success(done, io, c1, c2);
    });
    io.of("abc").on("connection", () => {
      --total || success(done, io, c1, c2);
    });
  });

  it('should be equivalent for "" and "/" on client', (done) => {
    const io = new Server(0);
    const c1 = createClient(io, "");

    io.of("/").on("connection", successFn(done, io, c1));
  });

  it("should work with `of` and many sockets", (done) => {
    const io = new Server(0);
    const chat = createClient(io, "/chat");
    const news = createClient(io, "/news");

    let total = 2;
    io.of("/news").on("connection", (socket) => {
      expect(socket).to.be.a(Socket);
      --total || success(done, io, chat, news);
    });
    io.of("/news").on("connection", (socket) => {
      expect(socket).to.be.a(Socket);
      --total || success(done, io, chat, news);
    });
  });

  it("should work with `of` second param", (done) => {
    const io = new Server(0);
    const chat = createClient(io, "/chat");
    const news = createClient(io, "/news");

    let total = 2;
    io.of("/news", (socket) => {
      expect(socket).to.be.a(Socket);
      --total || success(done, io, chat, news);
    });
    io.of("/news", (socket) => {
      expect(socket).to.be.a(Socket);
      --total || success(done, io, chat, news);
    });
  });

  it("should disconnect upon transport disconnection", (done) => {
    const io = new Server(0);
    const chat = createClient(io, "/chat");
    const news = createClient(io, "/news");

    let total = 2;
    let totald = 2;
    let s;
    io.of("/news", (socket) => {
      socket.on("disconnect", (reason) => {
        --totald || success(done, io, chat, news);
      });
      --total || close();
    });
    io.of("/chat", (socket) => {
      s = socket;
      socket.on("disconnect", (reason) => {
        --totald || success(done, io, chat, news);
      });
      --total || close();
    });
    function close() {
      s.disconnect(true);
    }
  });

  it("should fire a `disconnecting` event just before leaving all rooms", (done) => {
    const io = new Server(0);
    const socket = createClient(io);

    io.on("connection", (s) => {
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
        --total || success(done, io, socket);
      });
    });
  });

  it("should return error connecting to non-existent namespace", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/doesnotexist");

    socket.on("connect_error", (err) => {
      expect(err.message).to.be("Invalid namespace");
      success(done, io);
    });
  });

  it("should not reuse same-namespace connections", (done) => {
    const io = new Server(0);
    const clientSocket1 = createClient(io);
    const clientSocket2 = createClient(io);

    let connections = 0;
    io.on("connection", () => {
      connections++;
      if (connections === 2) {
        success(done, io, clientSocket1, clientSocket2);
      }
    });
  });

  it("should find all clients in a namespace", (done) => {
    const io = new Server(0);
    const chatSids: string[] = [];
    let otherSid: SocketId | null = null;

    const c1 = createClient(io, "/chat");
    const c2 = createClient(io, "/chat", { forceNew: true });
    const c3 = createClient(io, "/other", { forceNew: true });

    let total = 3;
    io.of("/chat").on("connection", (socket) => {
      chatSids.push(socket.id);
      --total || getSockets();
    });
    io.of("/other").on("connection", (socket) => {
      otherSid = socket.id;
      --total || getSockets();
    });

    async function getSockets() {
      const sids = await io.of("/chat").allSockets();

      expect(sids).to.contain(chatSids[0], chatSids[1]);
      expect(sids).to.not.contain(otherSid);
      success(done, io, c1, c2, c3);
    }
  });

  it("should find all clients in a namespace room", (done) => {
    const io = new Server(0);
    let chatFooSid: SocketId | null = null;
    let chatBarSid: SocketId | null = null;
    let otherSid: SocketId | null = null;

    const c1 = createClient(io, "/chat");
    const c2 = createClient(io, "/chat", { forceNew: true });
    const c3 = createClient(io, "/other", { forceNew: true });

    let chatIndex = 0;
    let total = 3;
    io.of("/chat").on("connection", (socket) => {
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
    io.of("/other").on("connection", (socket) => {
      socket.join("foo");
      otherSid = socket.id;
      --total || getSockets();
    });

    async function getSockets() {
      const sids = await io.of("/chat").in("foo").allSockets();

      expect(sids).to.contain(chatFooSid);
      expect(sids).to.not.contain(chatBarSid);
      expect(sids).to.not.contain(otherSid);
      success(done, io, c1, c2, c3);
    }
  });

  it("should find all clients across namespace rooms", (done) => {
    const io = new Server(0);
    let chatFooSid: SocketId | null = null;
    let chatBarSid: SocketId | null = null;
    let otherSid: SocketId | null = null;

    const c1 = createClient(io, "/chat");
    const c2 = createClient(io, "/chat", { forceNew: true });
    const c3 = createClient(io, "/other", { forceNew: true });

    let chatIndex = 0;
    let total = 3;
    io.of("/chat").on("connection", (socket) => {
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
    io.of("/other").on("connection", (socket) => {
      socket.join("foo");
      otherSid = socket.id;
      --total || getSockets();
    });

    async function getSockets() {
      const sids = await io.of("/chat").allSockets();
      expect(sids).to.contain(chatFooSid, chatBarSid);
      expect(sids).to.not.contain(otherSid);
      success(done, io, c1, c2, c3);
    }
  });

  it("should not emit volatile event after regular event", (done) => {
    const io = new Server(0);

    let counter = 0;
    io.of("/chat").on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        io.of("/chat").emit("ev", "data");
        io.of("/chat").volatile.emit("ev", "data");
      }, 50);
    });

    const socket = createClient(io, "/chat");
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 500);
  });

  it("should emit volatile event", (done) => {
    const io = new Server(0);

    let counter = 0;
    io.of("/chat").on("connection", (s) => {
      // Wait to make sure there are no packets being sent for opening the connection
      setTimeout(() => {
        io.of("/chat").volatile.emit("ev", "data");
      }, 100);
    });

    const socket = createClient(io, "/chat");
    socket.on("ev", () => {
      counter++;
    });

    setTimeout(() => {
      expect(counter).to.be(1);
      success(done, io, socket);
    }, 500);
  });

  it("should enable compression by default", (done) => {
    const io = new Server(0);
    const socket = createClient(io, "/chat");

    io.of("/chat").on("connection", (s) => {
      s.conn.once("packetCreate", (packet) => {
        expect(packet.options.compress).to.be(true);
        success(done, io, socket);
      });
      io.of("/chat").emit("woot", "hi");
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
      io.of("/chat").compress(false).emit("woot", "hi");
    });
  });

  it("should throw on reserved event", () => {
    const io = new Server();

    expect(() => io.emit("connect")).to.throwException(
      /"connect" is a reserved event name/
    );
  });

  it("should close a client without namespace", (done) => {
    const io = new Server(0, {
      connectTimeout: 10,
    });

    const socket = createClient(io);

    // @ts-ignore
    socket.io.engine.write = () => {}; // prevent the client from sending a CONNECT packet

    socket.on("disconnect", successFn(done, io, socket));
  });

  it("should exclude a specific socket when emitting", (done) => {
    const io = new Server(0);

    const socket1 = createClient(io, "/");
    const socket2 = createClient(io, "/");

    socket2.on("a", () => {
      done(new Error("should not happen"));
    });
    socket1.on("a", successFn(done, io, socket1, socket2));

    socket2.on("connect", () => {
      io.except(socket2.id).emit("a");
    });
  });

  it("should exclude a specific socket when emitting (in a namespace)", (done) => {
    const io = new Server(0);

    const nsp = io.of("/nsp");

    const socket1 = createClient(io, "/nsp");
    const socket2 = createClient(io, "/nsp");

    socket2.on("a", () => {
      done(new Error("not"));
    });
    socket1.on("a", successFn(done, io, socket1, socket2));

    socket2.on("connect", () => {
      nsp.except(socket2.id).emit("a");
    });
  });

  it("should exclude a specific room when emitting", (done) => {
    const io = new Server(0);

    const nsp = io.of("/nsp");

    const socket1 = createClient(io, "/nsp");
    const socket2 = createClient(io, "/nsp");

    socket1.on("a", successFn(done, io, socket1, socket2));
    socket2.on("a", () => {
      done(new Error("not"));
    });

    nsp.on("connection", (socket) => {
      socket.on("broadcast", () => {
        socket.join("room1");
        nsp.except("room1").emit("a");
      });
    });

    socket2.emit("broadcast");
  });

  it("should emit an 'new_namespace' event", (done) => {
    const io = new Server();

    io.on("new_namespace", (namespace) => {
      expect(namespace.name).to.eql("/nsp");
      done();
    });

    io.of("/nsp");
  });

  it("should not clean up a non-dynamic namespace", (done) => {
    const io = new Server(0, { cleanupEmptyChildNamespaces: true });
    const c1 = createClient(io, "/chat");

    c1.on("connect", () => {
      c1.disconnect();

      // Give it some time to disconnect the client
      setTimeout(() => {
        expect(io._nsps.has("/chat")).to.be(true);
        expect(io._nsps.get("/chat")!.sockets.size).to.be(0);
        success(done, io);
      }, 100);
    });

    io.of("/chat");
  });

  describe("dynamic namespaces", () => {
    it("should allow connections to dynamic namespaces with a regex", (done) => {
      const io = new Server(0);
      const socket = createClient(io, "/dynamic-101");
      const partialDone = createPartialDone(4, successFn(done, io, socket));

      let dynamicNsp = io
        .of(/^\/dynamic-\d+$/)
        .on("connect", (socket) => {
          expect(socket.nsp.name).to.be("/dynamic-101");
          dynamicNsp.emit("hello", 1, "2", { 3: "4" });
          partialDone();
        })
        .use((socket, next) => {
          next();
          partialDone();
        });
      socket.on("connect_error", (err) => {
        expect().fail();
      });
      socket.on("connect", () => {
        partialDone();
      });
      socket.on("hello", (a, b, c) => {
        expect(a).to.eql(1);
        expect(b).to.eql("2");
        expect(c).to.eql({ 3: "4" });
        partialDone();
      });
    });

    it("should allow connections to dynamic namespaces with a function", (done) => {
      const io = new Server(0);
      const socket = createClient(io, "/dynamic-101");

      io.of((name, query, next) => next(null, "/dynamic-101" === name));
      socket.on("connect", successFn(done, io, socket));
    });

    it("should disallow connections when no dynamic namespace matches", (done) => {
      const io = new Server(0);
      const socket = createClient(io, "/abc");
      io.of(/^\/dynamic-\d+$/);
      io.of((name, query, next) => next(null, "/dynamic-101" === name));

      socket.on("connect_error", (err) => {
        expect(err.message).to.be("Invalid namespace");
        success(done, io, socket);
      });
    });

    it("should emit an 'new_namespace' event for a dynamic namespace", (done) => {
      const io = new Server(0);
      io.of(/^\/dynamic-\d+$/);
      const socket = createClient(io, "/dynamic-101");

      io.on("new_namespace", (namespace) => {
        expect(namespace.name).to.be("/dynamic-101");

        success(done, io, socket);
      });
    });

    it("should handle race conditions with dynamic namespaces (#4136)", (done) => {
      const io = new Server(0);
      const counters = {
        connected: 0,
        created: 0,
        events: 0,
      };
      const buffer: Function[] = [];
      io.on("new_namespace", (namespace) => {
        counters.created++;
      });

      const handler = () => {
        if (++counters.events === 2) {
          expect(counters.created).to.equal(1);
          success(done, io, one, two);
        }
      };

      io.of((name, query, next) => {
        buffer.push(next);
        if (buffer.length === 2) {
          buffer.forEach((next) => next(null, true));
        }
      }).on("connection", (socket) => {
        if (++counters.connected === 2) {
          io.of("/dynamic-101").emit("message");
        }
      });

      let one = createClient(io, "/dynamic-101");
      let two = createClient(io, "/dynamic-101");
      one.on("message", handler);
      two.on("message", handler);
    });

    it("should clean up namespace when cleanupEmptyChildNamespaces is on and there are no more sockets in a namespace", (done) => {
      const io = new Server(0, { cleanupEmptyChildNamespaces: true });
      const c1 = createClient(io, "/dynamic-101");

      c1.on("connect", () => {
        c1.disconnect();

        // Give it some time to disconnect and clean up the namespace
        setTimeout(() => {
          expect(io._nsps.has("/dynamic-101")).to.be(false);
          success(done, io);
        }, 100);
      });

      io.of(/^\/dynamic-\d+$/);
    });

    it("should allow a client to connect to a cleaned up namespace", (done) => {
      const io = new Server(0, { cleanupEmptyChildNamespaces: true });
      const c1 = createClient(io, "/dynamic-101");

      c1.on("connect", () => {
        c1.disconnect();

        // Give it some time to disconnect and clean up the namespace
        setTimeout(() => {
          expect(io._nsps.has("/dynamic-101")).to.be(false);

          const c2 = createClient(io, "/dynamic-101");

          c2.on("connect", () => {
            success(done, io, c2);
          });

          c2.on("connect_error", () => {
            done(
              new Error("Client got error when connecting to dynamic namespace")
            );
          });
        }, 100);
      });

      io.of(/^\/dynamic-\d+$/);
    });

    it("should not clean up namespace when cleanupEmptyChildNamespaces is off and there are no more sockets in a namespace", (done) => {
      const io = new Server(0);
      const c1 = createClient(io, "/dynamic-101");

      c1.on("connect", () => {
        c1.disconnect();

        // Give it some time to disconnect and clean up the namespace
        setTimeout(() => {
          expect(io._nsps.has("/dynamic-101")).to.be(true);
          expect(io._nsps.get("/dynamic-101")!.sockets.size).to.be(0);
          success(done, io);
        }, 100);
      });

      io.of(/^\/dynamic-\d+$/);
    });

    it("should attach a child namespace to its parent upon manual creation", () => {
      const io = new Server(0);
      const parentNamespace = io.of(/^\/dynamic-\d+$/);
      const childNamespace = io.of("/dynamic-101");

      // @ts-ignore
      expect(parentNamespace.children.has(childNamespace)).to.be(true);

      io.close();
    });
  });
});
