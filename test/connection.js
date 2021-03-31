const expect = require("expect.js");
const Socket = require("../").Socket;
const env = require("./support/env");

describe("connection", function() {
  this.timeout(20000);

  it("should connect to localhost", done => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.on("message", data => {
        expect(data).to.equal("hi");
        socket.close();
        done();
      });
    });
  });

  it("should receive multibyte utf-8 strings with polling", done => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.send("cash money €€€");
      socket.on("message", data => {
        if ("hi" === data) return;
        expect(data).to.be("cash money €€€");
        socket.close();
        done();
      });
    });
  });

  it("should receive emoji", done => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.send(
        "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF"
      );
      socket.on("message", data => {
        if ("hi" === data) return;
        expect(data).to.be(
          "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF"
        );
        socket.close();
        done();
      });
    });
  });

  it("should not send packets if socket closes", done => {
    const socket = new Socket();
    socket.on("open", () => {
      let noPacket = true;
      socket.on("packetCreate", () => {
        noPacket = false;
      });
      socket.close();
      socket.send("hi");
      setTimeout(() => {
        expect(noPacket).to.be(true);
        done();
      }, 1200);
    });
  });

  // no `Worker` on old IE
  if (typeof Worker !== "undefined") {
    it("should work in a worker", done => {
      const worker = new Worker("/test/support/worker.js");
      let msg = 0;
      const utf8yay = "пойду спать всем спокойной ночи";
      worker.onmessage = e => {
        msg++;
        if (msg === 1) {
          expect(e.data).to.be("hi");
        } else if (msg < 11) {
          expect(e.data).to.be(utf8yay);
        } else if (msg < 20) {
          testBinary(e.data);
        } else {
          testBinary(e.data);
          done();
        }
      };

      function testBinary(data) {
        const byteArray = new Uint8Array(data);
        for (let i = 0; i < byteArray.byteLength; i++) {
          expect(byteArray[i]).to.be(i);
        }
      }
    });
  }

  it("should not connect at all when JSONP forced and disabled", done => {
    const socket = new Socket({
      transports: ["polling"],
      forceJSONP: true,
      jsonp: false
    });
    socket.on("error", msg => {
      expect(msg).to.be("No transports available");
      done();
    });
  });

  if (env.wsSupport && !env.isOldSimulator && !env.isAndroid && !env.isIE11) {
    it("should connect with ws when JSONP forced and disabled", done => {
      const socket = new Socket({
        transports: ["polling", "websocket"],
        forceJSONP: true,
        jsonp: false
      });

      socket.on("open", () => {
        expect(socket.transport.name).to.be("websocket");
        socket.close();
        done();
      });
    });

    it("should defer close when upgrading", done => {
      const socket = new Socket();
      socket.on("open", () => {
        let upgraded = false;
        socket
          .on("upgrade", () => {
            upgraded = true;
          })
          .on("upgrading", () => {
            socket.on("close", () => {
              expect(upgraded).to.be(true);
              done();
            });
            socket.close();
          });
      });
    });

    it("should close on upgradeError if closing is deferred", done => {
      const socket = new Socket();
      socket.on("open", () => {
        let upgradeError = false;
        socket
          .on("upgradeError", () => {
            upgradeError = true;
          })
          .on("upgrading", () => {
            socket.on("close", () => {
              expect(upgradeError).to.be(true);
              done();
            });
            socket.close();
            socket.transport.onError("upgrade error");
          });
      });
    });

    it("should not send packets if closing is deferred", done => {
      const socket = new Socket();
      socket.on("open", () => {
        let noPacket = true;
        socket.on("upgrading", () => {
          socket.on("packetCreate", () => {
            noPacket = false;
          });
          socket.close();
          socket.send("hi");
        });
        setTimeout(() => {
          expect(noPacket).to.be(true);
          done();
        }, 1200);
      });
    });

    it("should send all buffered packets if closing is deferred", done => {
      const socket = new Socket();
      socket.on("open", () => {
        socket
          .on("upgrading", () => {
            socket.send("hi");
            socket.close();
          })
          .on("close", () => {
            expect(socket.writeBuffer).to.have.length(0);
            done();
          });
      });
    });
  }
});
