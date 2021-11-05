const expect = require("expect.js");
const eio = require("../");
const { isIE11, isAndroid, isEdge, isIPad } = require("./support/env");
const FakeTimers = require("@sinonjs/fake-timers");

describe("Socket", function() {
  this.timeout(10000);

  describe("filterUpgrades", () => {
    it("should return only available transports", () => {
      const socket = new eio.Socket({ transports: ["polling"] });
      expect(socket.filterUpgrades(["polling", "websocket"])).to.eql([
        "polling"
      ]);
      socket.close();
    });
  });

  it("throws an error when no transports are available", done => {
    const socket = new eio.Socket({ transports: [] });
    let errorMessage = "";
    socket.on("error", error => {
      errorMessage = error;
    });
    socket.open();
    setTimeout(() => {
      expect(errorMessage).to.be("No transports available");
      socket.close();
      done();
    });
  });

  describe("fake timers", function() {
    before(function() {
      if (isIE11 || isAndroid || isEdge || isIPad) {
        this.skip();
      }
    });

    it("uses window timeout by default", done => {
      const clock = FakeTimers.install();
      const socket = new eio.Socket({ transports: [] });
      let errorMessage = "";
      socket.on("error", error => {
        errorMessage = error;
      });
      socket.open();
      clock.tick(1); // Should trigger error emit.
      expect(errorMessage).to.be("No transports available");
      clock.uninstall();
      socket.close();
      done();
    });

    it.skip("uses custom timeout when provided", done => {
      const clock = FakeTimers.install();
      const socket = new eio.Socket({
        transports: [],
        useNativeTimers: true
      });

      let errorMessage = "";
      socket.on("error", error => {
        errorMessage = error;
      });
      socket.open();
      // Socket should not use the mocked clock, so this should have no side
      // effects.
      clock.tick(1);
      expect(errorMessage).to.be("");
      clock.uninstall();

      setTimeout(() => {
        try {
          expect(errorMessage).to.be("No transports available");
          socket.close();
          done();
        } finally {
        }
      }, 1);
    });
  });
});
