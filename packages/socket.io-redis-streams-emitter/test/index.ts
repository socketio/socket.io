import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import { type Server, type Socket as ServerSocket } from "socket.io";
import { type Socket as ClientSocket } from "socket.io-client";
import { times, sleep, setup, initRedisClient } from "./util";
import { Emitter } from "../lib";

const PROPAGATION_DELAY_IN_MS = 100;

describe("@socket.io/redis-streams-emitter", () => {
  let servers: [Server, Server, Server],
    serverSockets: [ServerSocket, ServerSocket, ServerSocket],
    clientSockets: [ClientSocket, ClientSocket, ClientSocket],
    cleanup: () => void,
    emitter: Emitter;

  beforeEach(async () => {
    const testContext = await setup();
    servers = testContext.servers;
    serverSockets = testContext.serverSockets;
    clientSockets = testContext.clientSockets;
    const redisClient = await initRedisClient();
    emitter = new Emitter(redisClient);

    cleanup = () => {
      testContext.cleanup();
      redisClient.quit();
    };
  });

  afterEach(() => cleanup());

  describe("broadcast", function () {
    it("broadcasts to all clients", () => {
      return new Promise<void>((resolve) => {
        const partialResolve = times(3, resolve);

        clientSockets.forEach((clientSocket) => {
          clientSocket.on("test", (arg1, arg2, arg3) => {
            assert.equal(arg1, 1);
            assert.equal(arg2, "2");
            assert.ok(Buffer.isBuffer(arg3));
            partialResolve();
          });
        });

        emitter.emit("test", 1, "2", Buffer.from([3, 4]));
      });
    });

    it("broadcasts to all clients in a namespace", () => {
      return new Promise<void>((resolve) => {
        const partialResolve = times(3, () => {
          servers.forEach((server) => server.of("/custom").adapter.close());
          resolve();
        });

        servers.forEach((server) => server.of("/custom"));

        const onConnect = times(3, async () => {
          await sleep(PROPAGATION_DELAY_IN_MS);

          emitter.of("/custom").emit("test");
        });

        clientSockets.forEach((clientSocket) => {
          const socket = clientSocket.io.socket("/custom");
          socket.on("connect", onConnect);
          socket.on("test", () => {
            socket.disconnect();
            partialResolve();
          });
        });
      });
    });

    it("broadcasts to all clients in a room", () => {
      return new Promise<void>((resolve, reject) => {
        serverSockets[1].join("room1");

        clientSockets[0].on("test", () => {
          reject("should not happen");
        });

        clientSockets[1].on("test", () => {
          resolve();
        });

        clientSockets[2].on("test", () => {
          reject("should not happen");
        });

        emitter.to("room1").emit("test");
      });
    });

    it("broadcasts to all clients except in room", () => {
      return new Promise<void>((resolve, reject) => {
        const partialResolve = times(2, resolve);
        serverSockets[1].join("room1");

        clientSockets[0].on("test", () => {
          partialResolve();
        });

        clientSockets[1].on("test", () => {
          reject("should not happen");
        });

        clientSockets[2].on("test", () => {
          partialResolve();
        });

        emitter.of("/").except("room1").emit("test");
      });
    });
  });

  describe("socketsJoin", () => {
    it("makes all socket instances join the specified room", async () => {
      emitter.socketsJoin("room1");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room1"));
      assert.ok(serverSockets[1].rooms.has("room1"));
      assert.ok(serverSockets[2].rooms.has("room1"));
    });

    it("makes the matching socket instances join the specified room", async () => {
      serverSockets[0].join("room1");
      serverSockets[2].join("room1");

      emitter.in("room1").socketsJoin("room2");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room2"));
      assert.ok(serverSockets[1].rooms.has("room2") === false);
      assert.ok(serverSockets[2].rooms.has("room2"));
    });

    it("makes the given socket instance join the specified room", async () => {
      emitter.in(serverSockets[1].id).socketsJoin("room3");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room3") === false);
      assert.ok(serverSockets[1].rooms.has("room3"));
      assert.ok(serverSockets[2].rooms.has("room3") === false);
    });
  });

  describe("socketsLeave", () => {
    it("makes all socket instances leave the specified room", async () => {
      serverSockets[0].join("room1");
      serverSockets[2].join("room1");

      emitter.socketsLeave("room1");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room1") === false);
      assert.ok(serverSockets[1].rooms.has("room1") === false);
      assert.ok(serverSockets[2].rooms.has("room1") === false);
    });

    it("makes the matching socket instances leave the specified room", async () => {
      serverSockets[0].join(["room1", "room2"]);
      serverSockets[1].join(["room1", "room2"]);
      serverSockets[2].join(["room2"]);

      emitter.in("room1").socketsLeave("room2");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room2") === false);
      assert.ok(serverSockets[1].rooms.has("room2") === false);
      assert.ok(serverSockets[2].rooms.has("room2"));
    });

    it("makes the given socket instance leave the specified room", async () => {
      serverSockets[0].join("room3");
      serverSockets[1].join("room3");
      serverSockets[2].join("room3");

      emitter.in(serverSockets[1].id).socketsLeave("room3");

      await sleep(PROPAGATION_DELAY_IN_MS);

      assert.ok(serverSockets[0].rooms.has("room3"));
      assert.ok(serverSockets[1].rooms.has("room1") === false);
      assert.ok(serverSockets[2].rooms.has("room3"));
    });
  });

  describe("disconnectSockets", () => {
    it("makes all socket instances disconnect", () => {
      return new Promise<void>((resolve) => {
        const partialResolve = times(3, resolve);

        clientSockets.forEach((clientSocket) => {
          clientSocket.on("disconnect", (reason) => {
            assert.equal(reason, "io server disconnect");
            partialResolve();
          });
        });

        emitter.disconnectSockets();
      });
    });
  });

  describe("serverSideEmit", () => {
    it("sends an event to other server instances", () => {
      return new Promise<void>((resolve) => {
        const partialResolve = times(3, resolve);

        emitter.serverSideEmit("hello", "world", 1, "2");

        servers[0].on("hello", (arg1, arg2, arg3) => {
          assert.equal(arg1, "world");
          assert.equal(arg2, 1);
          assert.equal(arg3, "2");
          partialResolve();
        });

        servers[1].on("hello", (arg1, arg2, arg3) => {
          partialResolve();
        });

        servers[2].of("/").on("hello", () => {
          partialResolve();
        });
      });
    });
  });
});
