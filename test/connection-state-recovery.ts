import { Server, Socket } from "..";
import expect from "expect.js";
import { waitFor, eioHandshake, eioPush, eioPoll } from "./support/util";
import { createServer, Server as HttpServer } from "http";
import { Adapter } from "socket.io-adapter";

async function init(httpServer: HttpServer, io: Server) {
  // Engine.IO handshake
  const sid = await eioHandshake(httpServer);

  // Socket.IO handshake
  await eioPush(httpServer, sid, "40");
  const handshakeBody = await eioPoll(httpServer, sid);

  expect(handshakeBody.startsWith("40")).to.be(true);

  const handshake = JSON.parse(handshakeBody.substring(2));

  expect(handshake.sid).to.not.be(undefined);
  // in that case, the handshake also contains a private session ID
  expect(handshake.pid).to.not.be(undefined);

  io.emit("hello");

  const message = await eioPoll(httpServer, sid);

  expect(message.startsWith('42["hello"')).to.be(true);

  const offset = JSON.parse(message.substring(2))[1];
  // in that case, each packet also includes an offset in the data array
  expect(offset).to.not.be(undefined);

  await eioPush(httpServer, sid, "1");

  return [handshake.sid, handshake.pid, offset];
}

describe("connection state recovery", () => {
  it("should restore session and missed packets", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer, {
      connectionStateRecovery: {},
    });

    let serverSocket;

    io.once("connection", (socket) => {
      socket.join("room1");
      serverSocket = socket;
    });

    const [sid, pid, offset] = await init(httpServer, io);

    io.emit("hello1"); // broadcast
    io.to("room1").emit("hello2"); // broadcast to room
    serverSocket.emit("hello3"); // direct message

    const newSid = await eioHandshake(httpServer);
    await eioPush(
      httpServer,
      newSid,
      `40{"pid":"${pid}","offset":"${offset}"}`
    );

    const payload = await eioPoll(httpServer, newSid);
    const packets = payload.split("\x1e");

    expect(packets.length).to.eql(4);

    // note: EVENT packets are received before the CONNECT packet, which is a bit weird
    // see also: https://github.com/socketio/socket.io-deno/commit/518f534e1c205b746b1cb21fe76b187dabc96f34
    expect(packets[0].startsWith('42["hello1"')).to.be(true);
    expect(packets[1].startsWith('42["hello2"')).to.be(true);
    expect(packets[2].startsWith('42["hello3"')).to.be(true);
    expect(packets[3]).to.eql(`40{"sid":"${sid}","pid":"${pid}"}`);

    io.close();
  });

  it("should restore rooms and data attributes", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer, {
      connectionStateRecovery: {},
    });

    io.once("connection", (socket) => {
      expect(socket.recovered).to.eql(false);

      socket.join("room1");
      socket.join("room2");
      socket.data.foo = "bar";
    });

    const [sid, pid, offset] = await init(httpServer, io);

    const newSid = await eioHandshake(httpServer);

    const [socket] = await Promise.all([
      waitFor<Socket>(io, "connection"),
      eioPush(httpServer, newSid, `40{"pid":"${pid}","offset":"${offset}"}`),
    ]);

    expect(socket.id).to.eql(sid);
    expect(socket.recovered).to.eql(true);

    expect(socket.rooms.has(socket.id)).to.eql(true);
    expect(socket.rooms.has("room1")).to.eql(true);
    expect(socket.rooms.has("room2")).to.eql(true);

    expect(socket.data.foo).to.eql("bar");

    await eioPoll(httpServer, newSid); // drain buffer
    io.close();
  });

  it("should not run middlewares upon recovery by default", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer, {
      connectionStateRecovery: {},
    });

    const [_, pid, offset] = await init(httpServer, io);

    io.use((socket, next) => {
      socket.data.middlewareWasCalled = true;

      next();
    });

    const newSid = await eioHandshake(httpServer);

    const [socket] = await Promise.all([
      waitFor<Socket>(io, "connection"),
      eioPush(httpServer, newSid, `40{"pid":"${pid}","offset":"${offset}"}`),
    ]);

    expect(socket.recovered).to.be(true);
    expect(socket.data.middlewareWasCalled).to.be(undefined);

    await eioPoll(httpServer, newSid); // drain buffer
    io.close();
  });

  it("should run middlewares even upon recovery", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer, {
      connectionStateRecovery: {
        skipMiddlewares: false,
      },
    });

    const [_, pid, offset] = await init(httpServer, io);

    io.use((socket, next) => {
      socket.data.middlewareWasCalled = true;

      next();
    });

    const newSid = await eioHandshake(httpServer);

    const [socket] = await Promise.all([
      waitFor<Socket>(io, "connection"),
      eioPush(httpServer, newSid, `40{"pid":"${pid}","offset":"${offset}"}`),
    ]);

    expect(socket.recovered).to.be(true);
    expect(socket.data.middlewareWasCalled).to.be(true);

    await eioPoll(httpServer, newSid); // drain buffer
    io.close();
  });

  it("should fail to restore an unknown session", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer, {
      connectionStateRecovery: {},
    });

    // Engine.IO handshake
    const sid = await eioHandshake(httpServer);

    // Socket.IO handshake
    await eioPush(httpServer, sid, '40{"pid":"foo","offset":"bar"}');

    const handshakeBody = await eioPoll(httpServer, sid);

    expect(handshakeBody.startsWith("40")).to.be(true);

    const handshake = JSON.parse(handshakeBody.substring(2));

    expect(handshake.sid).to.not.eql("foo");
    expect(handshake.pid).to.not.eql("bar");

    io.close();
  });

  it("should be disabled by default", async () => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer);

    // Engine.IO handshake
    const sid = await eioHandshake(httpServer);

    // Socket.IO handshake
    await eioPush(httpServer, sid, "40");

    const handshakeBody = await eioPoll(httpServer, sid);

    expect(handshakeBody.startsWith("40")).to.be(true);

    const handshake = JSON.parse(handshakeBody.substring(2));

    expect(handshake.sid).to.not.be(undefined);
    expect(handshake.pid).to.be(undefined);

    io.close();
  });

  it("should not call adapter#persistSession or adapter#restoreSession if disabled", async () => {
    const httpServer = createServer().listen(0);

    class DummyAdapter extends Adapter {
      override persistSession(session) {
        expect.fail();
      }

      override restoreSession(pid, offset) {
        expect.fail();
        return Promise.reject("should not happen");
      }
    }

    const io = new Server(httpServer, {
      adapter: DummyAdapter,
    });

    // Engine.IO handshake
    const sid = await eioHandshake(httpServer);

    await eioPush(httpServer, sid, '40{"pid":"foo","offset":"bar"}');
    await eioPoll(httpServer, sid);
    await eioPush(httpServer, sid, "1");

    io.close();
  });
});
