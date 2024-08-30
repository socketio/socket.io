import { createServer } from "http";
import { io as ioc } from "socket.io-client";
import { join } from "path";
import { exec } from "child_process";
import { Server } from "..";
import expect from "expect.js";
import {
  createClient,
  eioHandshake,
  eioPoll,
  eioPush,
  getPort,
} from "./support/util";

describe("close", () => {
  it("should be able to close sio sending a srv", (done) => {
    const httpServer = createServer().listen(0);
    const io = new Server(httpServer);
    const port = getPort(io);
    const net = require("net");
    const server = net.createServer();

    const clientSocket = createClient(io, "/", { reconnection: false });

    clientSocket.on("disconnect", () => {
      expect(io.sockets.sockets.size).to.equal(0);
      server.listen(port);
    });

    clientSocket.on("connect", () => {
      expect(io.sockets.sockets.size).to.equal(1);
      io.close();
    });

    server.once("listening", () => {
      // PORT should be free
      server.close((error) => {
        expect(error).to.be(undefined);
        done();
      });
    });
  });

  it("should be able to close sio sending a srv", (done) => {
    const io = new Server(0);
    const port = getPort(io);
    const net = require("net");
    const server = net.createServer();

    const clientSocket = ioc("ws://0.0.0.0:" + port, {
      reconnection: false,
    });

    clientSocket.on("disconnect", () => {
      expect(io.sockets.sockets.size).to.equal(0);
      server.listen(port);
    });

    clientSocket.on("connect", () => {
      expect(io.sockets.sockets.size).to.equal(1);
      io.close();
    });

    server.once("listening", () => {
      // PORT should be free
      server.close((error) => {
        expect(error).to.be(undefined);
        done();
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

  describe("protocol violations", () => {
    it("should close the connection when receiving several CONNECT packets", async () => {
      const httpServer = createServer();
      const io = new Server(httpServer);

      httpServer.listen(0);

      const sid = await eioHandshake(httpServer);
      // send a first CONNECT packet
      await eioPush(httpServer, sid, "40");
      // send another CONNECT packet
      await eioPush(httpServer, sid, "40");
      // session is cleanly closed (not discarded, see 'client.close()')
      // first, we receive the Socket.IO handshake response
      await eioPoll(httpServer, sid);
      // then a close packet
      const body = await eioPoll(httpServer, sid);
      expect(body).to.be("6\u001e1");

      io.close();
    });

    it("should close the connection when receiving an EVENT packet while not connected", async () => {
      const httpServer = createServer();
      const io = new Server(httpServer);

      httpServer.listen(0);

      const sid = await eioHandshake(httpServer);
      // send an EVENT packet
      await eioPush(httpServer, sid, '42["some event"]');
      // session is cleanly closed, we receive a close packet
      const body = await eioPoll(httpServer, sid);
      expect(body).to.be("6\u001e1");

      io.close();
    });

    it("should close the connection when receiving an invalid packet", async () => {
      const httpServer = createServer();
      const io = new Server(httpServer);

      httpServer.listen(0);

      const sid = await eioHandshake(httpServer);
      // send a CONNECT packet
      await eioPush(httpServer, sid, "40");
      // send an invalid packet
      await eioPush(httpServer, sid, "4abc");
      // session is cleanly closed (not discarded, see 'client.close()')
      // first, we receive the Socket.IO handshake response
      await eioPoll(httpServer, sid);
      // then a close packet
      const body = await eioPoll(httpServer, sid);
      expect(body).to.be("6\u001e1");

      io.close();
    });
  });
});
