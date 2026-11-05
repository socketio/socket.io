import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import expect = require("expect.js");
import { setupPrimary } from "..";
import { times, sleep } from "./util";
import cluster, { Worker } from "node:cluster";

const NODES_COUNT = 3;

cluster.setupMaster({
  exec: "./test/worker.js",
  // @ts-ignore
  serialization: "advanced", // needed for packets containing buffers
});

setupPrimary();

const getRooms = (worker): Promise<Set<string>> => {
  worker.send("get rooms");
  return new Promise((resolve) => {
    worker.once("message", (content) => {
      resolve(content);
    });
  });
};

describe("@socket.io/cluster-adapter", () => {
  let clientSockets: ClientSocket[], workers: Worker[];

  beforeEach((done) => {
    clientSockets = [];
    workers = [];

    for (let i = 1; i <= NODES_COUNT; i++) {
      const PORT = 40000 + i;
      const worker = cluster.fork({
        PORT,
      });

      worker.on("listening", () => {
        const clientSocket = ioc(`http://localhost:${PORT}`);

        clientSocket.on("connect", async () => {
          workers.push(worker);
          clientSockets.push(clientSocket);
          if (clientSockets.length === NODES_COUNT) {
            done();
          }
        });
      });
    }
  });

  afterEach(() => {
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    clientSockets.forEach((socket) => {
      socket.disconnect();
    });
  });

  describe("broadcast", function () {
    it("broadcasts to all clients", (done) => {
      const partialDone = times(3, done);

      clientSockets.forEach((clientSocket) => {
        clientSocket.on("test", (arg1, arg2, arg3) => {
          expect(arg1).to.eql(1);
          expect(arg2).to.eql("2");
          expect(Buffer.isBuffer(arg3)).to.be(true);
          partialDone();
        });
      });

      workers[0].send("broadcasts to all clients");
    });

    it("broadcasts to all clients in a namespace", (done) => {
      const partialDone = times(3, done);

      const onConnect = times(3, async () => {
        workers[0].send("broadcasts to all clients in a namespace");
      });

      clientSockets.forEach((clientSocket) => {
        const socket = clientSocket.io.socket("/custom");
        socket.on("connect", onConnect);
        socket.on("test", () => {
          socket.disconnect();
          partialDone();
        });
      });
    });

    it("broadcasts to all clients in a room", (done) => {
      workers[1].send("join room1");

      clientSockets[0].on("test", () => {
        done(new Error("should not happen"));
      });

      clientSockets[1].on("test", () => {
        done();
      });

      clientSockets[2].on("test", () => {
        done(new Error("should not happen"));
      });

      workers[0].send("broadcasts to all clients in a room");
    });

    it("broadcasts to all clients except in room", (done) => {
      const partialDone = times(2, done);
      workers[1].send("join room1");

      clientSockets[0].on("test", () => {
        partialDone();
      });

      clientSockets[1].on("test", () => {
        done(new Error("should not happen"));
      });

      clientSockets[2].on("test", () => {
        partialDone();
      });

      workers[0].send("broadcasts to all clients except in room");
    });

    it("broadcasts to local clients only", (done) => {
      clientSockets[0].on("test", () => {
        done();
      });

      clientSockets[1].on("test", () => {
        done(new Error("should not happen"));
      });

      clientSockets[2].on("test", () => {
        done(new Error("should not happen"));
      });

      workers[0].send("broadcasts to local clients only");
    });

    it("broadcasts with multiple acknowledgements", (done) => {
      clientSockets[0].on("test", (cb) => {
        cb(1);
      });

      clientSockets[1].on("test", (cb) => {
        cb(2);
      });

      clientSockets[2].on("test", (cb) => {
        cb(3);
      });

      workers[0].send("broadcasts with multiple acknowledgements");

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });

    it("broadcasts with multiple acknowledgements (binary content)", (done) => {
      clientSockets[0].on("test", (cb) => {
        cb(Buffer.from([1]));
      });

      clientSockets[1].on("test", (cb) => {
        cb(Buffer.from([2]));
      });

      clientSockets[2].on("test", (cb) => {
        cb(Buffer.from([3]));
      });

      workers[0].send(
        "broadcasts with multiple acknowledgements (binary content)",
      );

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });

    it("broadcasts with multiple acknowledgements (no client)", (done) => {
      workers[0].send("broadcasts with multiple acknowledgements (no client)");

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });

    it("broadcasts with multiple acknowledgements (timeout)", (done) => {
      clientSockets[0].on("test", (cb) => {
        cb(1);
      });

      clientSockets[1].on("test", (cb) => {
        cb(2);
      });

      clientSockets[2].on("test", (cb) => {
        // do nothing
      });

      workers[0].send("broadcasts with multiple acknowledgements (timeout)");

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });
  });

  describe("socketsJoin", () => {
    it("makes all socket instances join the specified room", async () => {
      workers[0].send("makes all socket instances join the specified room");

      await sleep(100);

      expect((await getRooms(workers[0])).has("room1")).to.be(true);
      expect((await getRooms(workers[1])).has("room1")).to.be(true);
      expect((await getRooms(workers[2])).has("room1")).to.be(true);
    });

    it("makes the matching socket instances join the specified room", async () => {
      workers[0].send("join room1");
      workers[2].send("join room1");

      workers[0].send(
        "makes the matching socket instances join the specified room",
      );

      await sleep(100);

      expect((await getRooms(workers[0])).has("room2")).to.be(true);
      expect((await getRooms(workers[1])).has("room2")).to.be(false);
      expect((await getRooms(workers[2])).has("room2")).to.be(true);
    });

    it("avoids race condition when followed by emit (with await)", (done) => {
      const partialDone = times(3, done);

      clientSockets.forEach((clientSocket) => {
        clientSocket.on("test-event", (payload) => {
          expect(payload).to.eql("test-payload");
          partialDone();
        });
      });

      // This test verifies that awaiting socketsJoin ensures all sockets
      // receive the subsequent broadcast
      workers[0].send("test socketsJoin race condition with await");
    });
  });

  describe("socketsLeave", () => {
    it("makes all socket instances leave the specified room", async () => {
      workers[0].send("join room1");
      workers[2].send("join room1");

      workers[0].send("makes all socket instances leave the specified room");

      await sleep(100);

      expect((await getRooms(workers[0])).has("room1")).to.be(false);
      expect((await getRooms(workers[1])).has("room1")).to.be(false);
      expect((await getRooms(workers[2])).has("room1")).to.be(false);
    });

    it("makes the matching socket instances leave the specified room", async () => {
      workers[0].send("join room1 & room2");
      workers[2].send("join room2");

      workers[0].send(
        "makes the matching socket instances leave the specified room",
      );

      await sleep(100);

      expect((await getRooms(workers[0])).has("room2")).to.be(false);
      expect((await getRooms(workers[1])).has("room2")).to.be(false);
      expect((await getRooms(workers[2])).has("room2")).to.be(true);
    });
  });

  describe("disconnectSockets", () => {
    it("makes all socket instances disconnect", (done) => {
      const partialDone = times(3, done);

      clientSockets.forEach((clientSocket) => {
        clientSocket.on("disconnect", (reason) => {
          expect(reason).to.eql("io server disconnect");
          partialDone();
        });
      });

      workers[0].send("makes all socket instances disconnect");
    });
  });

  describe("fetchSockets", () => {
    it("returns all socket instances", (done) => {
      workers[0].send("returns all socket instances");

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });
  });

  describe("serverSideEmit", () => {
    it("sends an event to other server instances", (done) => {
      const partialDone = times(2, done);

      workers[0].send("sends an event to other server instances");

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done(new Error("should not happen"));
        }
      });

      workers[1].on("message", (result) => {
        expect(result).to.eql("ok");
        partialDone();
      });

      workers[2].on("message", (result) => {
        expect(result).to.eql("ok");
        partialDone();
      });
    });

    it("sends an event and receives a response from the other server instances", (done) => {
      workers[0].send(
        "sends an event and receives a response from the other server instances (1)",
      );
      workers[1].send(
        "sends an event and receives a response from the other server instances (2)",
      );
      workers[2].send(
        "sends an event and receives a response from the other server instances (3)",
      );

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });

    it("sends an event but timeout if one server does not respond", function (done) {
      this.timeout(6000); // currently not possible to configure the timeout delay

      workers[0].send(
        "sends an event but timeout if one server does not respond (1)",
      );
      workers[1].send(
        "sends an event but timeout if one server does not respond (2)",
      );
      workers[2].send(
        "sends an event but timeout if one server does not respond (3)",
      );

      workers[0].on("message", (result) => {
        if (result === "ok") {
          done();
        }
      });
    });
  });
});
