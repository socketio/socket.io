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
        expect().fail();
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

  it("should cleanup pending acks on broadcast timeout (memory leak fix)", (done) => {
    const io = new Server(0);
    const client = createClient(io, "/");

    // Client does not acknowledge the event (simulates timeout scenario)
    client.on("test-event", () => {
      // intentionally not calling the callback
    });

    io.on("connection", async (socket) => {
      socket.join("test-room");

      // Get initial acks count (cast to any to access private property in test)
      const initialAcksSize = (socket as any).acks.size;

      try {
        await io.timeout(50).to("test-room").emitWithAck("test-event", "data");
        expect().fail("should have timed out");
      } catch (err) {
        expect(err).to.be.an(Error);

        // After timeout, acks should be cleaned up (no memory leak)
        // Wait a bit for cleanup to complete
        setTimeout(() => {
          expect((socket as any).acks.size).to.be(initialAcksSize);
          success(done, io, client);
        }, 10);
      }
    });
  });

  it("should cleanup pending acks on broadcast timeout with multiple clients", (done) => {
    const io = new Server(0);
    const client1 = createClient(io, "/");
    const client2 = createClient(io, "/");

    let connectedSockets: any[] = [];

    // Clients do not acknowledge
    client1.on("test-event", () => {});
    client2.on("test-event", () => {});

    io.on("connection", (socket) => {
      socket.join("test-room");
      connectedSockets.push(socket);

      if (connectedSockets.length === 2) {
        runTest();
      }
    });

    async function runTest() {
      const initialAcksSizes = connectedSockets.map((s) => s.acks.size);

      try {
        await io.timeout(50).to("test-room").emitWithAck("test-event", "data");
        expect().fail("should have timed out");
      } catch (err) {
        expect(err).to.be.an(Error);

        setTimeout(() => {
          // All sockets should have their acks cleaned up
          connectedSockets.forEach((socket, i) => {
            expect(socket.acks.size).to.be(initialAcksSizes[i]);
          });
          success(done, io, client1, client2);
        }, 10);
      }
    }
  });
});
