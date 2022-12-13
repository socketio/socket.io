const expect = require("expect.js");
const { Socket } = require("../../");

const Blob = require("blob");
const { repeat } = require("../util");

describe("blob", function () {
  this.timeout(30000);

  it("should be able to receive binary data as blob when bouncing it back (polling)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new Socket();
    socket.binaryType = "blob";
    socket.on("open", () => {
      socket.send(binaryData);
      socket.on("message", (data) => {
        if (typeof data === "string") return;

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

  it("should be able to send data as a blob when bouncing it back (polling)", (done) => {
    const binaryData = new Int8Array(5);
    for (let i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    const socket = new Socket();
    socket.on("open", () => {
      socket.send(new Blob([binaryData.buffer]));
      socket.on("message", (data) => {
        if (typeof data === "string") return;

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it("should merge binary packets according to maxPayload value", (done) => {
    const socket = new Socket({ transports: ["polling"] });
    socket.on("open", () => {
      socket.send(new Blob([new Uint8Array(72)]));
      socket.send(new Blob([new Uint8Array(20)]));
      socket.send(repeat("a", 20));
      socket.send(new Blob([new Uint8Array(20).buffer]));
      socket.send(new Blob([new Uint8Array(72)]));

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
