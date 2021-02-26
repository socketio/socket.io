const { Adapter } = require("..");
const expect = require("expect.js");

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
        ["s1", true],
        ["s2", true],
        ["s3", true]
      ])
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
          packet() {
            ids.push(id);
          }
        }
      ];
    }
    const nsp = {
      server: {
        encoder: {
          encode() {}
        }
      },
      sockets: new Map([socket("s1"), socket("s2"), socket("s3")])
    };
    const adapter = new Adapter(nsp);
    adapter.addAll("s1", new Set(["r1"]));
    adapter.addAll("s2", new Set());
    adapter.addAll("s3", new Set(["r1"]));

    adapter.broadcast([], {
      rooms: new Set(),
      except: new Set(["r1"])
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
          packet() {
            ids.push(id);
          }
        }
      ];
    }
    const nsp = {
      server: {
        encoder: {
          encode() {}
        }
      },
      sockets: new Map([socket("s1"), socket("s2"), socket("s3")])
    };
    const adapter = new Adapter(nsp);
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2"]));
    adapter.addAll("s3", new Set(["r1"]));

    adapter.broadcast([], {
      rooms: new Set(["r1"]),
      except: new Set(["r2"])
    });
    expect(ids).to.eql(["s3"]);
  });

  describe("events", () => {
    it("should emit a 'create-room' event", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("create-room", room => {
        expect(room).to.eql("r1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
    });

    it("should not emit a 'create-room' event if the room already exists", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.on("create-room", room => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s2", new Set(["r1"]));
      done();
    });

    it("should emit a 'join-room' event", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("join-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
    });

    it("should not emit a 'join-room' event if the sid is already in the room", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.addAll("s1", new Set(["r1", "r2"]));
      adapter.on("join-room", () => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s1", new Set(["r1"]));
      done();
    });

    it("should emit a 'leave-room' event with del method", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("leave-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.del("s1", "r1");
    });

    it("should emit a 'leave-room' event with delAll method", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("leave-room", (room, sid) => {
        expect(room).to.eql("r1");
        expect(sid).to.eql("s1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.delAll("s1");
    });

    it("should emit a 'delete-room' event", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("delete-room", room => {
        expect(room).to.eql("r1");
        done();
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.delAll("s1");
    });

    it("should not emit a 'delete-room' event if there is another sid in the room", done => {
      const adapter = new Adapter({ server: { encoder: null } });
      adapter.on("delete-room", room => {
        done(new Error("should not happen"));
      });
      adapter.addAll("s1", new Set(["r1"]));
      adapter.addAll("s2", new Set(["r1", "r2"]));
      adapter.delAll("s1");
      done();
    });
  });
});
