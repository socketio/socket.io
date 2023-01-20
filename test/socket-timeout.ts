import { Server } from "..";
import { createClient, success } from "./support/util";
import expect from "expect.js";

describe("timeout", () => {
  it("should timeout if the client does not acknowledge the event", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    io.on("connection", (socket) => {
      socket.timeout(50).emit("unknown", (err) => {
        expect(err).to.be.an(Error);
        success(done, io, client);
      });
    });
  });

  it("should timeout if the client does not acknowledge the event in time", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    client.on("echo", (arg, cb) => {
      cb(arg);
    });

    let count = 0;

    io.on("connection", (socket) => {
      socket.timeout(0).emit("echo", 42, (err) => {
        expect(err).to.be.an(Error);
        count++;
      });
    });

    setTimeout(() => {
      expect(count).to.eql(1);
      success(done, io, client);
    }, 200);
  });

  it("should not timeout if the client does acknowledge the event", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    client.on("echo", (arg, cb) => {
      cb(arg);
    });

    io.on("connection", (socket) => {
      socket.timeout(50).emit("echo", 42, (err, value) => {
        expect(err).to.be(null);
        expect(value).to.be(42);
        success(done, io, client);
      });
    });
  });

  it("should timeout if the client does not acknowledge the event (promise)", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    io.on("connection", async (socket) => {
      try {
        await socket.timeout(50).emitWithAck("unknown");
        expect.fail();
      } catch (err) {
        expect(err).to.be.an(Error);
        success(done, io, client);
      }
    });
  });

  it("should not timeout if the client does acknowledge the event (promise)", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    client.on("echo", (arg, cb) => {
      cb(arg);
    });

    io.on("connection", async (socket) => {
      const value = await socket.timeout(50).emitWithAck("echo", 42);
      expect(value).to.be(42);
      success(done, io, client);
    });
  });
});
