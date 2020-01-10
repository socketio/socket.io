var expect = require("expect.js");
var eio = require("../");

describe("Socket", function() {
  this.timeout(10000);

  describe("filterUpgrades", function() {
    it("should return only available transports", function() {
      var socket = new eio.Socket({ transports: ["polling"] });
      expect(socket.filterUpgrades(["polling", "websocket"])).to.eql([
        "polling"
      ]);
      socket.close();
    });
  });
});
