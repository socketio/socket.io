const Adapter = require("..");
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

  it("should return a list of clients", () => {
    const adapter = new Adapter({
      server: { encoder: null },
      connected: new Map([
        ["s1", true],
        ["s2", true],
        ["s3", true]
      ])
    });
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2", "r3"]));
    adapter.addAll("s3", new Set(["r3"]));

    const clients = adapter.clients(new Set());
    expect(clients).to.be.a(Set);
    expect(clients.size).to.be(3);
    expect(adapter.clients(new Set(["r2"])).size).to.be(2);
    expect(adapter.clients(new Set(["r4"])).size).to.be(0);
  });

  it("should return a list of rooms", () => {
    const adapter = new Adapter({ server: { encoder: null } });
    adapter.addAll("s1", new Set(["r1", "r2"]));
    adapter.addAll("s2", new Set(["r2", "r3"]));
    adapter.addAll("s3", new Set(["r3"]));

    const rooms = adapter.clientRooms("s2");
    expect(rooms).to.be.a(Set);
    expect(rooms.size).to.be(2);
    expect(adapter.clientRooms("s4")).to.be(undefined);
  });
});
