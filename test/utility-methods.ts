import { createServer } from "http";
import { Server, Socket } from "..";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { Adapter, BroadcastOptions } from "socket.io-adapter";
import expect from "expect.js";
import type { AddressInfo } from "net";

import "./support/util";

const SOCKETS_COUNT = 3;

const createPartialDone = (
  count: number,
  done: () => void,
  callback?: () => void
) => {
  let i = 0;
  return () => {
    i++;
    if (i === count) {
      done();
      if (callback) {
        callback();
      }
    }
  };
};

class DummyAdapter extends Adapter {
  fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    return Promise.resolve([
      {
        id: "42",
        handshake: {
          headers: {
            accept: "*/*",
          },
          query: {
            transport: "polling",
            EIO: "4",
          },
        },
        rooms: ["42", "room1"],
        data: {
          username: "john",
        },
      },
    ]);
  }
}

describe("socket.io", () => {
  let io: Server, clientSockets: ClientSocket[], serverSockets: Socket[];
  beforeEach((done) => {
    const srv = createServer();
    io = new Server(srv);
    srv.listen(() => {
      const port = (srv.address() as AddressInfo).port;

      clientSockets = [];
      for (let i = 0; i < SOCKETS_COUNT; i++) {
        clientSockets.push(ioc(`http://localhost:${port}`));
      }

      serverSockets = [];
      io.on("connection", (socket: Socket) => {
        serverSockets.push(socket);
        if (serverSockets.length === SOCKETS_COUNT) {
          done();
        }
      });
    });
  });

  afterEach(() => {
    io.close();
    clientSockets.forEach((socket) => socket.disconnect());
  });

  describe("utility methods", () => {
    describe("fetchSockets", () => {
      it("returns all socket instances", async () => {
        const sockets = await io.fetchSockets();
        expect(sockets.length).to.eql(3);
      });

      it("returns all socket instances in the given room", async () => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        const sockets = await io.in("room1").fetchSockets();
        expect(sockets.length).to.eql(2);
      });

      it("works with a custom adapter", async () => {
        io.adapter(DummyAdapter);
        const sockets = await io.fetchSockets();
        expect(sockets.length).to.eql(1);
        const remoteSocket = sockets[0];
        expect(remoteSocket.id).to.eql("42");
        expect(remoteSocket.rooms).to.contain("42", "room1");
        expect(remoteSocket.data).to.eql({ username: "john" });
      });
    });

    describe("socketsJoin", () => {
      it("makes all socket instances join the given room", () => {
        io.socketsJoin("room1");
        serverSockets.forEach((socket) => {
          expect(socket.rooms).to.contain("room1");
        });
      });

      it("makes all socket instances in a room join the given room", () => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        io.in("room1").socketsJoin("room3");
        expect(serverSockets[0].rooms).to.contain("room3");
        expect(serverSockets[1].rooms).to.contain("room3");
        expect(serverSockets[2].rooms).to.not.contain("room3");
      });
    });

    describe("socketsLeave", () => {
      it("makes all socket instances leave the given room", () => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        io.socketsLeave("room1");
        expect(serverSockets[0].rooms).to.contain("room2");
        expect(serverSockets[0].rooms).to.not.contain("room1");
        expect(serverSockets[1].rooms).to.not.contain("room1");
      });

      it("makes all socket instances in a room leave the given room", () => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        io.in("room2").socketsLeave("room1");
        expect(serverSockets[0].rooms).to.contain("room2");
        expect(serverSockets[0].rooms).to.not.contain("room1");
        expect(serverSockets[1].rooms).to.contain("room1");
      });
    });

    describe("disconnectSockets", () => {
      it("makes all socket instances disconnect", (done) => {
        io.disconnectSockets(true);

        const partialDone = createPartialDone(3, done);

        clientSockets[0].on("disconnect", partialDone);
        clientSockets[1].on("disconnect", partialDone);
        clientSockets[2].on("disconnect", partialDone);
      });

      it("makes all socket instances in a room disconnect", (done) => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        io.in("room2").disconnectSockets(true);

        const partialDone = createPartialDone(2, done, () => {
          clientSockets[1].off("disconnect");
        });

        clientSockets[0].on("disconnect", partialDone);
        clientSockets[1].on("disconnect", () => {
          done(new Error("should not happen"));
        });
        clientSockets[2].on("disconnect", partialDone);
      });
    });
  });
});
