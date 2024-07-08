const expect = require("expect.js");
const { Socket } = require("../../");
const { repeat } = require("../util");

describe("arraybuffer", function () {
  this.timeout(30000);

  it("should be able to receive binary data when bouncing it back (polling)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new Socket({ transports: ["polling"] });
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.send(binaryData);
      socket.on("message", (data) => {
        if (data === "hi") return;

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it("should be able to receive binary data and a multibyte utf-8 string (polling)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }

    let msg = 0;
    const socket = new Socket({ transports: ["polling"] });
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.send(binaryData);
      socket.send("cash money €€€");
      socket.on("message", (data) => {
        if (data === "hi") return;

        if (msg === 0) {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          msg++;
        } else {
          expect(data).to.be("cash money €€€");
          socket.close();
          done();
        }
      });
    });
  });

  it("should be able to receive binary data when forcing base64 (polling)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new Socket({ forceBase64: true });
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.send(binaryData);
      socket.on("message", (data) => {
        if (typeof data === "string") return;

        expect(data).to.be.an(ArrayBuffer);
        const ia = new Int8Array(data);
        expect(ia).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it("should merge binary packets according to maxPayload value", (done) => {
    const socket = new Socket({ transports: ["polling"] });
    socket.on("open", () => {
      socket.send(new Uint8Array(72));
      socket.send(new Uint8Array(20));
      socket.send(repeat("a", 20));
      socket.send(new Uint8Array(20).buffer);
      socket.send(new Uint8Array(72));

      let count = 0;
      socket.on("message", () => {
        count++;
        if (count === 5) {
          socket.close();
          done();
        }
      });
    });
  });
});
