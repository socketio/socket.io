const expect = require("expect.js");
const eio = require("../");

describe("binary fallback", function () {
  this.timeout(10000);

  it("should be able to receive binary data when ArrayBuffer not available (polling)", (done) => {
    const socket = new eio.Socket({ forceBase64: true });
    socket.on("open", () => {
      socket.send("give binary");
      let firstPacket = true;
      socket.on("message", (data) => {
        if (firstPacket) {
          firstPacket = false;
          return;
        }

        expect(data.base64).to.be(true);
        expect(data.data).to.equal("AAECAwQ=");

        socket.close();
        done();
      });
    });
  });
});
