const expect = require("expect.js");
const Socket = require("../").Socket;
const env = require("./support/env");

describe("connection", function() {
  this.timeout(20000);

  it("should connect to localhost", function(done) {
    const socket = new Socket();
    socket.on("open", function() {
      socket.on("message", function(data) {
        expect(data).to.equal("hi");
        socket.close();
        done();
      });
    });
  });

  it("should receive multibyte utf-8 strings with polling", function(done) {
    const socket = new Socket();
    socket.on("open", function() {
      socket.send("cash money €€€");
      socket.on("message", function(data) {
        if ("hi" === data) return;
        expect(data).to.be("cash money €€€");
        socket.close();
        done();
      });
    });
  });

  it("should receive emoji", function(done) {
    const socket = new Socket();
    socket.on("open", function() {
      socket.send(
        "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF"
      );
      socket.on("message", function(data) {
        if ("hi" === data) return;
        expect(data).to.be(
          "\uD800\uDC00-\uDB7F\uDFFF\uDB80\uDC00-\uDBFF\uDFFF\uE000-\uF8FF"
        );
        socket.close();
        done();
      });
    });
  });

  it("should not send packets if socket closes", function(done) {
    const socket = new Socket();
    socket.on("open", function() {
      var noPacket = true;
      socket.on("packetCreate", function() {
        noPacket = false;
      });
      socket.close();
      socket.send("hi");
      setTimeout(function() {
        expect(noPacket).to.be(true);
        done();
      }, 1200);
    });
  });

  // no `Worker` on old IE
  if (typeof Worker !== "undefined") {
    it("should work in a worker", function(done) {
      var worker = new Worker("/test/support/worker.js");
      var msg = 0;
      var utf8yay = "пойду сать всем мпокойной ночи";
      worker.onmessage = function(e) {
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
        var byteArray = new Uint8Array(data);
        for (var i = 0; i < byteArray.byteLength; i++) {
          expect(byteArray[i]).to.be(i);
        }
      }
    });
  }

  it("should not connect at all when JSONP forced and disabled", function(done) {
    const socket = new Socket({
      transports: ["polling"],
      forceJSONP: true,
      jsonp: false
    });
    socket.on("error", function(msg) {
      expect(msg).to.be("No transports available");
      done();
    });
  });

  if (env.wsSupport && !env.isOldSimulator && !env.isAndroid && !env.isIE11) {
    it("should connect with ws when JSONP forced and disabled", function(done) {
      const socket = new Socket({
        transports: ["polling", "websocket"],
        forceJSONP: true,
        jsonp: false
      });

      socket.on("open", function() {
        expect(socket.transport.name).to.be("websocket");
        socket.close();
        done();
      });
    });

    it("should defer close when upgrading", function(done) {
      const socket = new Socket();
      socket.on("open", function() {
        var upgraded = false;
        socket
          .on("upgrade", function() {
            upgraded = true;
          })
          .on("upgrading", function() {
            socket.on("close", function() {
              expect(upgraded).to.be(true);
              done();
            });
            socket.close();
          });
      });
    });

    it("should close on upgradeError if closing is deferred", function(done) {
      const socket = new Socket();
      socket.on("open", function() {
        var upgradeError = false;
        socket
          .on("upgradeError", function() {
            upgradeError = true;
          })
          .on("upgrading", function() {
            socket.on("close", function() {
              expect(upgradeError).to.be(true);
              done();
            });
            socket.close();
            socket.transport.onError("upgrade error");
          });
      });
    });

    it("should not send packets if closing is deferred", function(done) {
      const socket = new Socket();
      socket.on("open", function() {
        var noPacket = true;
        socket.on("upgrading", function() {
          socket.on("packetCreate", function() {
            noPacket = false;
          });
          socket.close();
          socket.send("hi");
        });
        setTimeout(function() {
          expect(noPacket).to.be(true);
          done();
        }, 1200);
      });
    });

    it("should send all buffered packets if closing is deferred", function(done) {
      const socket = new Socket();
      socket.on("open", function() {
        socket
          .on("upgrading", function() {
            socket.send("hi");
            socket.close();
          })
          .on("close", function() {
            expect(socket.writeBuffer).to.have.length(0);
            done();
          });
      });
    });
  }
});
