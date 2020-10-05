const expect = require("expect.js");
const io = require("../");
const hasCORS = require("has-cors");
const textBlobBuilder = require("text-blob-builder");
const env = require("./support/env");

describe("connection", function () {
  this.timeout(70000);

  it("should connect to localhost", (done) => {
    const socket = io({ forceNew: true });
    socket.emit("hi");
    socket.on("hi", (data) => {
      socket.disconnect();
      done();
    });
  });

  it("should not connect when autoConnect option set to false", () => {
    const socket = io({ forceNew: true, autoConnect: false });
    expect(socket.io.engine).to.not.be.ok();
    socket.disconnect();
  });

  it("should start two connections with same path", () => {
    const s1 = io("/");
    const s2 = io("/");

    expect(s1.io).to.not.be(s2.io);
    s1.disconnect();
    s2.disconnect();
  });

  it("should start two connections with same path and different querystrings", () => {
    const s1 = io("/?woot");
    const s2 = io("/");

    expect(s1.io).to.not.be(s2.io);
    s1.disconnect();
    s2.disconnect();
  });

  it("should work with acks", (done) => {
    const socket = io({ forceNew: true });
    socket.emit("ack");
    socket.on("ack", (fn) => {
      fn(5, { test: true });
    });
    socket.on("got it", () => {
      socket.disconnect();
      done();
    });
  });

  it("should receive date with ack", (done) => {
    const socket = io({ forceNew: true });
    socket.emit("getAckDate", { test: true }, (data) => {
      expect(data).to.be.a("string");
      socket.disconnect();
      done();
    });
  });

  it("should work with false", (done) => {
    const socket = io({ forceNew: true });
    socket.emit("false");
    socket.on("false", (f) => {
      expect(f).to.be(false);
      socket.disconnect();
      done();
    });
  });

  it("should receive utf8 multibyte characters", (done) => {
    const correct = [
      "てすと",
      "Я Б Г Д Ж Й",
      "Ä ä Ü ü ß",
      "utf8 — string",
      "utf8 — string",
    ];

    const socket = io({ forceNew: true });
    let i = 0;
    socket.on("takeUtf8", (data) => {
      expect(data).to.be(correct[i]);
      i++;
      if (i === correct.length) {
        socket.disconnect();
        done();
      }
    });
    socket.emit("getUtf8");
  });

  it("should connect to a namespace after connection established", (done) => {
    const manager = new io.Manager();
    const socket = manager.socket("/");
    socket.on("connect", () => {
      const foo = manager.socket("/foo");
      foo.on("connect", () => {
        foo.close();
        socket.close();
        manager.close();
        done();
      });
    });
  });

  it("should open a new namespace after connection gets closed", (done) => {
    const manager = new io.Manager();
    const socket = manager.socket("/");
    socket
      .on("connect", () => {
        socket.disconnect();
      })
      .on("disconnect", () => {
        const foo = manager.socket("/foo");
        foo.on("connect", () => {
          foo.disconnect();
          manager.close();
          done();
        });
      });
  });

  it("should reconnect by default", (done) => {
    const socket = io({ forceNew: true });
    socket.io.on("reconnect", () => {
      socket.disconnect();
      done();
    });

    setTimeout(() => {
      socket.io.engine.close();
    }, 500);
  });

  it("should reconnect manually", (done) => {
    const socket = io({ forceNew: true });
    socket
      .once("connect", () => {
        socket.disconnect();
      })
      .once("disconnect", () => {
        socket.once("connect", () => {
          socket.disconnect();
          done();
        });
        socket.connect();
      });
  });

  it("should reconnect automatically after reconnecting manually", (done) => {
    const socket = io({ forceNew: true });
    socket
      .once("connect", () => {
        socket.disconnect();
      })
      .once("disconnect", () => {
        socket.on("reconnect", () => {
          socket.disconnect();
          done();
        });
        socket.connect();
        setTimeout(() => {
          socket.io.engine.close();
        }, 500);
      });
  });

  it("should attempt reconnects after a failed reconnect", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
    });
    const socket = manager.socket("/timeout");
    socket.once("reconnect_failed", () => {
      let reconnects = 0;
      const reconnectCb = () => {
        reconnects++;
      };

      manager.on("reconnect_attempt", reconnectCb);
      manager.on("reconnect_failed", () => {
        expect(reconnects).to.be(2);
        socket.close();
        manager.close();
        done();
      });
      socket.connect();
    });
  });

  it("reconnect delay should increase every time", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 3,
      reconnectionDelay: 100,
      randomizationFactor: 0.2,
    });
    const socket = manager.socket("/timeout");
    let reconnects = 0;
    let increasingDelay = true;
    let startTime;
    let prevDelay = 0;

    socket.on("connect_error", () => {
      startTime = new Date().getTime();
    });
    socket.on("reconnect_attempt", () => {
      reconnects++;
      const currentTime = new Date().getTime();
      const delay = currentTime - startTime;
      if (delay <= prevDelay) {
        increasingDelay = false;
      }
      prevDelay = delay;
    });

    socket.on("reconnect_failed", () => {
      expect(reconnects).to.be(3);
      expect(increasingDelay).to.be.ok();
      socket.close();
      manager.close();
      done();
    });
  });

  it("reconnect event should fire in socket", (done) => {
    const socket = io({ forceNew: true });

    socket.on("reconnect", () => {
      socket.disconnect();
      done();
    });

    setTimeout(() => {
      socket.io.engine.close();
    }, 500);
  });

  it("should not reconnect when force closed", (done) => {
    const socket = io("/invalid", {
      forceNew: true,
      timeout: 0,
      reconnectionDelay: 10,
    });
    socket.on("connect_error", () => {
      socket.on("reconnect_attempt", () => {
        expect().fail();
      });
      socket.disconnect();
      // set a timeout to let reconnection possibly fire
      setTimeout(() => {
        done();
      }, 500);
    });
  });

  it("should stop reconnecting when force closed", (done) => {
    const socket = io("/invalid", {
      forceNew: true,
      timeout: 0,
      reconnectionDelay: 10,
    });
    socket.once("reconnect_attempt", () => {
      socket.on("reconnect_attempt", () => {
        expect().fail();
      });
      socket.disconnect();
      // set a timeout to let reconnection possibly fire
      setTimeout(() => {
        done();
      }, 500);
    });
  });

  it("should reconnect after stopping reconnection", (done) => {
    const socket = io("/invalid", {
      forceNew: true,
      timeout: 0,
      reconnectionDelay: 10,
    });
    socket.once("reconnect_attempt", () => {
      socket.on("reconnect_attempt", () => {
        socket.disconnect();
        done();
      });
      socket.disconnect();
      socket.connect();
    });
  });

  it("should stop reconnecting on a socket and keep to reconnect on another", (done) => {
    const manager = new io.Manager();
    const socket1 = manager.socket("/");
    const socket2 = manager.socket("/asd");

    manager.on("reconnect_attempt", () => {
      socket1.on("connect", () => {
        expect().fail();
      });
      socket2.on("connect", () => {
        setTimeout(() => {
          socket2.disconnect();
          manager.disconnect();
          done();
        }, 500);
      });
      socket1.disconnect();
    });

    setTimeout(() => {
      manager.engine.close();
    }, 1000);
  });

  it("should try to reconnect twice and fail when requested two attempts with immediate timeout and reconnect enabled", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
    });
    let socket;

    let reconnects = 0;
    const reconnectCb = () => {
      reconnects++;
    };

    manager.on("reconnect_attempt", reconnectCb);
    manager.on("reconnect_failed", () => {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });

    socket = manager.socket("/timeout");
  });

  it("should fire reconnect_* events on socket", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
    });
    const socket = manager.socket("/timeout_socket");

    let reconnects = 0;
    const reconnectCb = (attempts) => {
      reconnects++;
      expect(attempts).to.be(reconnects);
    };

    socket.on("reconnect_attempt", reconnectCb);
    socket.on("reconnect_failed", () => {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });
  });

  it("should fire error on socket", (done) => {
    const manager = new io.Manager({ reconnection: true });
    const socket = manager.socket("/timeout_socket");

    socket.on("error", (data) => {
      expect(data.code).to.be("test");
      socket.close();
      manager.close();
      done();
    });

    socket.on("connect", () => {
      manager.engine.onPacket({ type: "error", data: "test" });
    });
  });

  it("should fire reconnecting (on socket) with attempts number when reconnecting twice", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
    });
    const socket = manager.socket("/timeout_socket");

    let reconnects = 0;
    const reconnectCb = (attempts) => {
      reconnects++;
      expect(attempts).to.be(reconnects);
    };

    socket.on("reconnecting", reconnectCb);
    socket.on("reconnect_failed", () => {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });
  });

  it("should not try to reconnect and should form a connection when connecting to correct port with default timeout", (done) => {
    const manager = new io.Manager({
      reconnection: true,
      reconnectionDelay: 10,
    });
    const cb = () => {
      socket.close();
      expect().fail();
    };
    manager.on("reconnect_attempt", cb);

    var socket = manager.socket("/valid");
    socket.on("connect", () => {
      // set a timeout to let reconnection possibly fire
      setTimeout(() => {
        socket.close();
        manager.close();
        done();
      }, 1000);
    });
  });

  it("should connect while disconnecting another socket", (done) => {
    const manager = new io.Manager();
    const socket1 = manager.socket("/foo");
    socket1.on("connect", () => {
      const socket2 = manager.socket("/asd");
      socket2.on("connect", done);
      socket1.disconnect();
    });
  });

  // Ignore incorrect connection test for old IE due to no support for
  // `script.onerror` (see: http://requirejs.org/docs/api.html#ieloadfail)
  if (!global.document || hasCORS) {
    it("should try to reconnect twice and fail when requested two attempts with incorrect address and reconnect enabled", (done) => {
      const manager = new io.Manager("http://localhost:3940", {
        reconnection: true,
        reconnectionAttempts: 2,
        reconnectionDelay: 10,
      });
      const socket = manager.socket("/asd");
      let reconnects = 0;
      const cb = () => {
        reconnects++;
      };

      manager.on("reconnect_attempt", cb);

      manager.on("reconnect_failed", () => {
        expect(reconnects).to.be(2);
        socket.disconnect();
        manager.close();
        done();
      });
    });

    it("should not try to reconnect with incorrect port when reconnection disabled", (done) => {
      const manager = new io.Manager("http://localhost:9823", {
        reconnection: false,
      });
      const cb = () => {
        socket.close();
        expect().fail();
      };
      manager.on("reconnect_attempt", cb);

      manager.on("connect_error", () => {
        // set a timeout to let reconnection possibly fire
        setTimeout(() => {
          socket.disconnect();
          manager.close();
          done();
        }, 1000);
      });

      var socket = manager.socket("/invalid");
    });

    it("should still try to reconnect twice after opening another socket asynchronously", (done) => {
      const manager = new io.Manager("http://localhost:9823", {
        reconnect: true,
        reconnectionAttempts: 2,
      });
      let delay = Math.floor(
        manager.reconnectionDelay() * manager.randomizationFactor() * 0.5
      );
      delay = Math.max(delay, 10);

      let reconnects = 0;
      const cb = () => {
        reconnects++;
      };

      manager.on("reconnect_attempt", cb);

      manager.on("reconnect_failed", () => {
        expect(reconnects).to.be(2);
        socket.disconnect();
        manager.close();
        done();
      });

      var socket = manager.socket("/room1");

      setTimeout(() => {
        manager.socket("/room2");
      }, delay);
    });
  }

  it("should emit date as string", (done) => {
    const socket = io({ forceNew: true });
    socket.on("takeDate", (data) => {
      socket.close();
      expect(data).to.be.a("string");
      done();
    });
    socket.emit("getDate");
  });

  it("should emit date in object", (done) => {
    const socket = io({ forceNew: true });
    socket.on("takeDateObj", (data) => {
      socket.close();
      expect(data).to.be.an("object");
      expect(data.date).to.be.a("string");
      done();
    });
    socket.emit("getDateObj");
  });

  if (!global.Blob && !global.ArrayBuffer) {
    it("should get base64 data as a last resort", (done) => {
      const socket = io({ forceNew: true });
      socket.on("takebin", (a) => {
        socket.disconnect();
        expect(a.base64).to.be(true);
        expect(a.data).to.eql("YXNkZmFzZGY=");
        done();
      });
      socket.emit("getbin");
    });
  }

  if (global.ArrayBuffer) {
    const base64 = require("base64-arraybuffer");

    it("should get binary data (as an ArrayBuffer)", (done) => {
      const socket = io({ forceNew: true });
      if (env.node) {
        socket.io.engine.binaryType = "arraybuffer";
      }
      socket.emit("doge");
      socket.on("doge", (buffer) => {
        expect(buffer instanceof ArrayBuffer).to.be(true);
        socket.disconnect();
        done();
      });
    });

    it("should send binary data (as an ArrayBuffer)", (done) => {
      const socket = io({ forceNew: true });
      socket.on("buffack", () => {
        socket.disconnect();
        done();
      });
      const buf = base64.decode("asdfasdf");
      socket.emit("buffa", buf);
    });

    it("should send binary data (as an ArrayBuffer) mixed with json", (done) => {
      const socket = io({ forceNew: true });
      socket.on("jsonbuff-ack", () => {
        socket.disconnect();
        done();
      });
      const buf = base64.decode("howdy");
      socket.emit("jsonbuff", {
        hello: "lol",
        message: buf,
        goodbye: "gotcha",
      });
    });

    it("should send events with ArrayBuffers in the correct order", (done) => {
      const socket = io({ forceNew: true });
      socket.on("abuff2-ack", () => {
        socket.disconnect();
        done();
      });
      const buf = base64.decode("abuff1");
      socket.emit("abuff1", buf);
      socket.emit("abuff2", "please arrive second");
    });
  }

  if (global.Blob && null != textBlobBuilder("xxx")) {
    it("should send binary data (as a Blob)", (done) => {
      const socket = io({ forceNew: true });
      socket.on("back", () => {
        socket.disconnect();
        done();
      });
      const blob = textBlobBuilder("hello world");
      socket.emit("blob", blob);
    });

    it("should send binary data (as a Blob) mixed with json", (done) => {
      const socket = io({ forceNew: true });
      socket.on("jsonblob-ack", () => {
        socket.disconnect();
        done();
      });
      const blob = textBlobBuilder("EEEEEEEEE");
      socket.emit("jsonblob", {
        hello: "lol",
        message: blob,
        goodbye: "gotcha",
      });
    });

    it("should send events with Blobs in the correct order", (done) => {
      const socket = io({ forceNew: true });
      socket.on("blob3-ack", () => {
        socket.disconnect();
        done();
      });
      const blob = textBlobBuilder("BLOBBLOB");
      socket.emit("blob1", blob);
      socket.emit("blob2", "second");
      socket.emit("blob3", blob);
    });
  }
});
