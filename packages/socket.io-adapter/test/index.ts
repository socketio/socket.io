import { Adapter, SessionAwareAdapter } from "../lib";
import expect = require("expect.js");

describe("socket.io-adapter", () => {
  it("should add/remove sockets", () => {
    const adapter = new Adapter({ server: { encoder: null } });
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2", "r3"]));

    expect(adapter.rooms.has("r1")).to.be(true);
    expect(adapter.rooms.has("r2")).to.be(true);
    expect(adapter.rooms.has("r3")).to.be(true);
    expect(adapter.rooms.has("r4")).to.be(false);

    expect(adapter.sids.has("s1")).to.be(true);
    expect(adapter.sids.has("s2")).to.be(true);
    expect(adapter.sids.has("s3")).to.be(false);

    adapter.del("s1", "r1");
    expect(adapter.rooms.has("r1")).to.be(false);

    adapter.delAll("s2");
    expect(adapter.rooms.has("r2")).to.be(true);
    expect(adapter.rooms.has("r3")).to.be(false);

    expect(adapter.sids.has("s2")).to.be(false);
  });

  it("should return a list of sockets", async () => {
    const adapter = new Adapter({
      server: { encoder: null },
      sockets: new Map([
        ["s1", { id: "s1" }],
        ["s2", { id: "s2" }],
        ["s3", { id: "s3" }],
      ]),
    });
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2", "r3"]));
    adapter.addAll("s3", new Set(["r3"]));

    const sockets = await adapter.sockets(new Set());
    expect(sockets).to.be.a(Set);
    expect(sockets.size).to.be(3);
    expect((await adapter.sockets(new Set(["r2"]))).size).to.be(2);
    expect((await adapter.sockets(new Set(["r4"]))).size).to.be(0);
  });

  it("should return a list of rooms", () => {
    const adapter = new Adapter({ server: { encoder: null } });
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2", "r3"]));
    adapter.addAll("s3", new Set(["r3"]));

    const rooms = adapter.socketRooms("s2");
    expect(rooms).to.be.a(Set);
    expect(rooms.size).to.be(2);
    expect(adapter.socketRooms("s4")).to.be(undefined);
  });

  it("should exclude sockets in specific rooms when broadcasting", () => {
    let ids = [];
    function socket(id) {
      return [
        id,
        {
          id,
          client: {
            writeToEngine(payload, opts) {
              expect(payload).to.eql(["123"]);
              expect(opts.preEncoded).to.eql(true);
              ids.push(id);
            },
          },
        },
      ];
    }
    const nsp = {
      server: {
        encoder: {
          encode() {
            return ["123"];
          },
        },
      },
      // @ts-ignore
      sockets: new Map([socket("s1"), socket("s2"), socket("s3")]),
    };
    const adapter = new Adapter(nsp);
    adapter.addAll("s1", new Set(["r1"]));
    adapter.addAll("s2", new Set());
    adapter.addAll("s3", new Set(["r1"]));

    adapter.broadcast([], {
      rooms: new Set(),
      except: new Set(["r1"]),
    });
    expect(ids).to.eql(["s2"]);
  });

  it("should exclude sockets in specific rooms when broadcasting to rooms", () => {
    let ids = [];
    function socket(id) {
      return [
        id,
        {
          id,
          client: {
            writeToEngine(payload, opts) {
              expect(payload).to.be.a(Array);
              expect(payload[0]).to.be.a(Buffer);
              expect(opts.preEncoded).to.eql(true);
              expect(opts.wsPreEncoded).to.be(undefined);
              ids.push(id);
            },
          },
        },
      ];
    }
    const nsp = {
      server: {
        encoder: {
          encode() {
            return [Buffer.from([1, 2, 3])];
          },
        },
      },
      // @ts-ignore
      sockets: new Map([socket("s1"), socket("s2"), socket("s3")]),
    };
    const adapter = new Adapter(nsp);
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2"]));
    adapter.addAll("s3", new Set(["r1"]));

    adapter.broadcast([], {
      rooms: new Set(["r1"]),
      except: new Set(["r2"]),
    });
    expect(ids).to.eql(["s3"]);
  });

  it("should precompute the WebSocket frames when broadcasting", () => {
    function socket(id) {
      return [
        id,
        {
          id,
          client: {
            writeToEngine(payload, opts) {
              expect(payload).to.eql(["123"]);
              expect(opts.preEncoded).to.eql(true);
              expect(opts.wsPreEncodedFrame.length).to.eql(2);
              expect(opts.wsPreEncodedFrame[0]).to.eql(Buffer.from([129, 4]));
              expect(opts.wsPreEncodedFrame[1]).to.eql(
                Buffer.from([52, 49, 50, 51]),
              );
            },
          },
        },
      ];
    }
    const nsp = {
      server: {
        encoder: {
          encode() {
            return ["123"];
          },
        },
      },
      // @ts-ignore
      sockets: new Map([socket("s1"), socket("s2"), socket("s3")]),
    };
    const adapter = new Adapter(nsp);
    adapter.addAll("s1", new Set());
    adapter.addAll("s2", new Set());
    adapter.addAll("s3", new Set());

    adapter.broadcast([], {
      rooms: new Set(),
      except: new Set(),
    });
  });

  describe("utility methods", () => {
    let adapter;

    before(() => {
      adapter = new Adapter({
        server: { encoder: null },
        sockets: new Map([
          ["s1", { id: "s1" }],
          ["s2", { id: "s2" }],
          ["s3", { id: "s3" }],
        ]),
      });
    });

    describe("fetchSockets", () => {
      it("returns the matching socket instances", async () => {
        adapter.addAll("s1", new Set(["s1"]));
        adapter.addAll("s2", new Set(["s2"]));
        adapter.addAll("s3", new Set(["s3"]));
        const matchingSockets = await adapter.fetchSockets({
          rooms: new Set(),
        });
        expect(matchingSockets).to.be.an(Array);
        expect(matchingSockets.length).to.be(3);
      });

      it("returns the matching socket instances within room", async () => {
        adapter.addAll("s1", new Set(["r1", "r2"]));
        adapter.addAll("s2", new Set(["r1"]));
        adapter.addAll("s3", new Set(["r2"]));
        const matchingSockets = await adapter.fetchSockets({
          rooms: new Set(["r1"]),
          except: new Set(["r2"]),
        });
        expect(matchingSockets).to.be.an(Array);
        expect(matchingSockets.length).to.be(1);
        expect(matchingSockets[0].id).to.be("s2");
      });
    });
  });

  describe("events", () => {
    it("should emit a 'create-room' event", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("create-room", (room) => {
        expect(room).to.eql("r1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
    });

    it("should not emit a 'create-room' event if the room already exists", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.on("create-room", (room) => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s2", new Set(["r1"]));
      done();
    });

    it("should emit a 'join-room' event", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("join-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
    });

    it("should not emit a 'join-room' event if the sid is already in the room", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.addAll("s1", new Set(["r1", "r2"]));
      adapter.on("join-room", () => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s1", new Set(["r1"]));
      done();
    });

    it("should emit a 'leave-room' event with del method", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("leave-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.del("s1", "r1");
    });

    it("should not throw when calling del twice", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("leave-room", (room, sid) => {
        adapter.del("s1", "r1");
        process.nextTick(done);
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.del("s1", "r1");
    });

    it("should emit a 'leave-room' event with delAll method", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("leave-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.delAll("s1");
    });

    it("should emit a 'delete-room' event", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("delete-room", (room) => {
        expect(room).to.eql("r1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.delAll("s1");
    });

    it("should not emit a 'delete-room' event if there is another sid in the room", (done) => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("delete-room", (room) => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.addAll("s2", new Set(["r1", "r2"]));
      adapter.delAll("s1");
      done();
    });
  });

  describe("connection state recovery", () => {
    it("should persist and restore session", async () => {
      const adapter = new SessionAwareAdapter({
        server: {
          encoder: {
            encode(packet) {
              return packet;
            },
          },
          opts: {
            connectionStateRecovery: {
              maxDisconnectionDuration: 5000,
            },
          },
        },
      });

      adapter.persistSession({
        sid: "abc",
        pid: "def",
        data: "ghi",
        rooms: ["r1", "r2"],
      });

      const packetData = ["hello"];

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: packetData,
        },
        {
          rooms: new Set(),
          except: new Set(),
        },
      );

      const offset = packetData[1];
      const session = await adapter.restoreSession("def", offset);

      expect(session).to.not.be(null);
      expect(session.sid).to.eql("abc");
      expect(session.pid).to.eql("def");
      expect(session.missedPackets).to.eql([]);
    });

    it("should restore missed packets", async () => {
      const adapter = new SessionAwareAdapter({
        server: {
          encoder: {
            encode(packet) {
              return packet;
            },
          },
          opts: {
            connectionStateRecovery: {
              maxDisconnectionDuration: 5000,
            },
          },
        },
      });

      adapter.persistSession({
        sid: "abc",
        pid: "def",
        data: "ghi",
        rooms: ["r1", "r2"],
      });

      const packetData = ["hello"];

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: packetData,
        },
        {
          rooms: new Set(),
          except: new Set(),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["all"],
        },
        {
          rooms: new Set(),
          except: new Set(),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["room"],
        },
        {
          rooms: new Set(["r1"]),
          except: new Set(),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["except"],
        },
        {
          rooms: new Set(),
          except: new Set(["r2"]),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["no except"],
        },
        {
          rooms: new Set(),
          except: new Set(["r3"]),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["with ack"],
          id: 0,
        },
        {
          rooms: new Set(),
          except: new Set(),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 3,
          data: ["ack type"],
        },
        {
          rooms: new Set(),
          except: new Set(),
        },
      );

      adapter.broadcast(
        {
          nsp: "/",
          type: 2,
          data: ["volatile"],
        },
        {
          rooms: new Set(),
          except: new Set(),
          flags: {
            volatile: true,
          },
        },
      );

      const offset = packetData[1];
      const session = await adapter.restoreSession("def", offset);

      expect(session).to.not.be(null);
      expect(session.sid).to.eql("abc");
      expect(session.pid).to.eql("def");

      expect(session.missedPackets.length).to.eql(3);
      expect(session.missedPackets[0].length).to.eql(2);
      expect(session.missedPackets[0][0]).to.eql("all");
      expect(session.missedPackets[1][0]).to.eql("room");
      expect(session.missedPackets[2][0]).to.eql("no except");
    });

    it("should fail to restore an unknown session", async () => {
      const adapter = new SessionAwareAdapter({
        server: {
          encoder: {
            encode(packet) {
              return packet;
            },
          },
          opts: {
            connectionStateRecovery: {
              maxDisconnectionDuration: 5000,
            },
          },
        },
      });

      const session = await adapter.restoreSession("abc", "def");

      expect(session).to.be(null);
    });

    it("should fail to restore a known session with an unknown offset", async () => {
      const adapter = new SessionAwareAdapter({
        server: {
          encoder: {
            encode(packet) {
              return packet;
            },
          },
          opts: {
            connectionStateRecovery: {
              maxDisconnectionDuration: 5000,
            },
          },
        },
      });

      adapter.persistSession({
        sid: "abc",
        pid: "def",
        data: "ghi",
        rooms: ["r1", "r2"],
      });

      const session = await adapter.restoreSession("abc", "def");

      expect(session).to.be(null);
    });
  });
});
