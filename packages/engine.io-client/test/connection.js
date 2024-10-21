const expect = require("expect.js");
const Socket = require("../").Socket;
const env = require("./support/env");
const { repeat } = require("./util");

describe("connection", function () {
  this.timeout(20000);

  it("should connect to localhost", (done) => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.on("message", (data) => {
        expect(data).to.equal("hi");
        socket.close();
        done();
      });
    });
  });

  it("should connect to localhost (ws)", (done) => {
    const socket = new Socket({
      transports: ["websocket"],
    });
    socket.on("open", () => {
      socket.on("message", (data) => {
        expect(data).to.equal("hi");
        socket.close();
        done();
      });
    });
  });

  it("should receive multibyte utf-8 strings with polling", (done) => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.send("cash money €€€");
      socket.on("message", (data) => {
        if ("hi" === data) return;
        expect(data).to.be("cash money €€€");
        socket.close();
        done();
      });
    });
  });

  it("should receive emoji", (done) => {
    const socket = new Socket();
    socket.on("open", () => {
      socket.send(
        "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF",
      );
      socket.on("message", (data) => {
        if ("hi" === data) return;
        expect(data).to.be(
          "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF",
        );
        socket.close();
        done();
      });
    });
  });

  it("should not send packets if socket closes", (done) => {
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
      }, 200);
    });
  });

  it("should merge packets according to maxPayload value", (done) => {
    const socket = new Socket({ transports: ["polling"] });
    socket.on("open", () => {
      socket.send(repeat("a", 99));
      socket.send(repeat("b", 30));
      socket.send(repeat("c", 30));
      socket.send(repeat("d", 35)); // 3 * 1 (packet type) + 2 * 1 (separator) + 30 + 30 + 35 = 100
      socket.send(repeat("€", 33));
      socket.send(repeat("f", 99));

      let count = 0;
      socket.on("message", () => {
        count++;
        if (count === 6) {
          socket.close();
          done();
        }
      });
    });
  });

  it("should send a packet whose length is above the maxPayload value anyway", (done) => {
    const socket = new Socket({ transports: ["polling"] });
    socket.on("open", () => {
      socket.send(repeat("a", 101));
      socket.send("b");

      socket.on("close", () => {
        done();
      });
    });
  });

  // no `Worker` on old IE
  if (typeof Worker !== "undefined") {
    it("should work in a worker", (done) => {
      const worker = new Worker("/test/support/worker.js");
      let msg = 0;
      const utf8yay = "пойду спать всем спокойной ночи";
      worker.onmessage = (e) => {
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

  if (env.wsSupport && !env.isOldSimulator && !env.isAndroid && !env.isIE11) {
    it("should defer close when upgrading", (done) => {
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

    it("should close on upgradeError if closing is deferred", (done) => {
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

    it("should not send packets if closing is deferred", (done) => {
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
        }, 200);
      });
    });

    it("should send all buffered packets if closing is deferred", (done) => {
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

  if (env.browser && typeof addEventListener === "function") {
    it("should close the socket when receiving a beforeunload event", (done) => {
      const socket = new Socket({
        closeOnBeforeunload: true,
      });

      const createEvent = (name) => {
        if (typeof Event === "function") {
          return new Event(name);
        } else {
          // polyfill for IE
          const event = document.createEvent("Event");
          event.initEvent(name, true, true);
          return event;
        }
      };

      socket.on("open", () => {
        const handler = () => {
          expect(socket.transport.readyState).to.eql("closed");
          expect(() => socket.write("ignored")).to.not.throwException();

          removeEventListener("beforeunload", handler, false);
          done();
        };

        addEventListener("beforeunload", handler, false);
        dispatchEvent(createEvent("beforeunload"));
      });
    });
  }
});
