const expect = require("expect.js");
const eio = require("../../");

const Blob = require("blob");

describe("blob", function() {
  this.timeout(30000);

  it("should be able to receive binary data as blob when bouncing it back (polling)", done => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket();
    socket.binaryType = "blob";
    socket.on("open", () => {
      socket.send(binaryData);
      socket.on("message", data => {
        if (typeof data === "string") return;

        expect(data).to.be.a(Blob);
        const fr = new FileReader();
        fr.onload = function() {
          const ab = this.result;
          const ia = new Int8Array(ab);
          expect(ia).to.eql(binaryData);
          socket.close();
          done();
        };
        fr.readAsArrayBuffer(data);
      });
    });
  });

  it("should be able to send data as a blob when bouncing it back (polling)", done => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket();
    socket.on("open", () => {
      socket.send(new Blob([binaryData.buffer]));
      socket.on("message", data => {
        if (typeof data === "string") return;

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });
});
