const expect = require("expect.js");
const eio = require("../");

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
});
