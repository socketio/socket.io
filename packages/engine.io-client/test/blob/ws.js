const expect = require("expect.js");
const eio = require("../../");

const Blob = require("blob");

describe("blob", function () {
  this.timeout(30000);

  it("should be able to receive binary data as blob when bouncing it back (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket();
    socket.binaryType = "blob";
    socket.on("open", () => {
      socket.on("upgrade", () => {
        socket.send(binaryData);
        socket.on("message", (data) => {
          expect(data).to.be.a(Blob);
          const fr = new FileReader();
          fr.onload = function () {
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
  });

  it("should be able to send data as a blob when bouncing it back (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket();
    socket.on("open", () => {
      socket.on("upgrade", () => {
        socket.send(new Blob([binaryData.buffer]));
        socket.on("message", (data) => {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          socket.close();
          done();
        });
      });
    });
  });

  it("should be able to send data as a blob encoded into base64 when bouncing it back (ws)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new eio.Socket({ forceBase64: true });
    socket.on("open", () => {
      socket.on("upgrade", () => {
        socket.send(new Blob([binaryData.buffer]));
        socket.on("message", (data) => {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          socket.close();
          done();
        });
      });
    });
  });
});
