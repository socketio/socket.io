import { createServer } from "node:http";
import { io as ioc } from "../src/index.js";
import { WebSocket } from "ws";
import { Server } from "socket.io";
import { expect } from "chai";

// @ts-ignore for Node.js
globalThis.WebSocket = WebSocket;

function waitFor(emitter, eventName) {
  return new Promise((resolve) => {
    emitter.on(eventName, resolve);
  });
}

function sleep(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

describe("basic client", () => {
  let io, port, socket;

  beforeEach(() => {
    const httpServer = createServer();
    io = new Server(httpServer);

    httpServer.listen(0);
    port = httpServer.address().port;
  });

  afterEach(() => {
    io.close();
    socket.disconnect();
  });

  it("should connect", async () => {
    socket = ioc(`ws://localhost:${port}`);

    await waitFor(socket, "connect");

    expect(socket.connected).to.eql(true);
    expect(socket.id).to.be.a("string");
  });

  it("should connect with 'http://' scheme", async () => {
    socket = ioc(`http://localhost:${port}`);

    await waitFor(socket, "connect");
  });

  it("should connect with URL inferred from 'window.location'", async () => {
    globalThis.location = {
      origin: `http://localhost:${port}`,
    };
    socket = ioc();

    await waitFor(socket, "connect");
  });

  it("should fail to connect to an invalid URL", async () => {
    socket = ioc(`http://localhost:4321`);

    await waitFor(socket, "connect_error");
  });

  it("should receive an event", async () => {
    io.on("connection", (socket) => {
      socket.emit("foo", 123);
    });

    socket = ioc(`ws://localhost:${port}`);

    const value = await waitFor(socket, "foo");

    expect(value).to.eql(123);
  });

  it("should send an event (not buffered)", async () => {
    socket = ioc(`ws://localhost:${port}`);

    const [serverSocket] = await Promise.all([
      waitFor(io, "connection"),
      waitFor(socket, "connect"),
    ]);

    socket.emit("foo", 456);

    const value = await waitFor(serverSocket, "foo");

    expect(value).to.eql(456);
  });

  it("should send an event (buffered)", async () => {
    socket = ioc(`ws://localhost:${port}`);

    socket.emit("foo", 789);

    const [serverSocket] = await Promise.all([
      waitFor(io, "connection"),
      waitFor(socket, "connect"),
    ]);

    const value = await waitFor(serverSocket, "foo");

    expect(value).to.eql(789);
  });

  it("should reconnect", async () => {
    socket = ioc(`ws://localhost:${port}`, {
      reconnectionDelay: 50,
    });

    await waitFor(socket, "connect");

    io.close();

    await waitFor(socket, "disconnect");

    io.listen(port);

    await waitFor(socket, "connect");
  });

  it("should respond to PING packets", async () => {
    io.engine.opts.pingInterval = 50;
    io.engine.opts.pingTimeout = 20;

    socket = ioc(`ws://localhost:${port}`);

    await waitFor(socket, "connect");

    await sleep(500);

    expect(socket.connected).to.eql(true);
  });

  it("should disconnect (client side)", async () => {
    socket = ioc(`ws://localhost:${port}`);

    await waitFor(socket, "connect");

    socket.disconnect();

    expect(socket.connected).to.eql(false);
    expect(socket.id).to.eql(undefined);
  });

  it("should disconnect (server side)", async () => {
    socket = ioc(`ws://localhost:${port}`);

    const [serverSocket] = await Promise.all([
      waitFor(io, "connection"),
      waitFor(socket, "connect"),
    ]);

    serverSocket.disconnect();

    await waitFor(socket, "disconnect");
  });
});
