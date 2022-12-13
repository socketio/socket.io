const expect = require("expect.js");
const eio = require("../../");

describe("arraybuffer", function () {
  this.timeout(30000);

  it("should be able to receive binary data when bouncing it back (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket();
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.on("upgrade", () => {
        socket.send(binaryData);
        socket.on("message", (data) => {
          if (typeof data === "string") return;

          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);

          socket.close();
          done();
        });
      });
    });
  });

  it("should be able to receive binary data and a multibyte utf-8 string (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }

    let msg = 0;
    const socket = new eio.Socket();
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.on("upgrade", () => {
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
  });

  it("should be able to receive binary data when bouncing it back and forcing base64 (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket({ forceBase64: true });
    socket.binaryType = "arraybuffer";
    socket.on("open", () => {
      socket.on("upgrade", () => {
        socket.send(binaryData);
        socket.on("message", (data) => {
          if (typeof data === "string") return;

          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);

          socket.close();
          done();
        });
      });
    });
  });
});
