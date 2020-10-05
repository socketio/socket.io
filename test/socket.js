const expect = require("expect.js");
const io = require("../");

describe("socket", function () {
  this.timeout(70000);

  it("should have an accessible socket id equal to the server-side socket id (default namespace)", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      expect(socket.id).to.be.ok();
      expect(socket.id).to.eql(socket.io.engine.id);
      socket.disconnect();
      done();
    });
  });

  it("should have an accessible socket id equal to the server-side socket id (custom namespace)", (done) => {
    const socket = io("/foo", { forceNew: true });
    socket.on("connect", () => {
      expect(socket.id).to.be.ok();
      expect(socket.id).to.eql("/foo#" + socket.io.engine.id);
      socket.disconnect();
      done();
    });
  });

  it("clears socket.id upon disconnection", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      socket.on("disconnect", () => {
        expect(socket.id).to.not.be.ok();
        done();
      });

      socket.disconnect();
    });
  });

  it("doesn't fire a connect_error if we force disconnect in opening state", (done) => {
    const socket = io({ forceNew: true, timeout: 100 });
    socket.disconnect();
    socket.on("connect_error", () => {
      throw new Error("Unexpected");
    });
    setTimeout(() => {
      done();
    }, 300);
  });

  it("should ping and pong with latency", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      let pinged;
      socket.once("ping", () => {
        pinged = true;
      });
      socket.once("pong", (ms) => {
        expect(pinged).to.be(true);
        expect(ms).to.be.a("number");
        socket.disconnect();
        done();
      });
    });
  });

  it("should change socket.id upon reconnection", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      const id = socket.id;

      socket.on("reconnect_attempt", () => {
        expect(socket.id).to.not.be.ok();
      });

      socket.on("reconnect", () => {
        expect(socket.id).to.not.eql(id);
        socket.disconnect();
        done();
      });

      socket.io.engine.close();
    });
  });

  it("should enable compression by default", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      socket.io.engine.once("packetCreate", (packet) => {
        expect(packet.options.compress).to.be(true);
        socket.disconnect();
        done();
      });
      socket.emit("hi");
    });
  });

  it("should disable compression", (done) => {
    const socket = io({ forceNew: true });
    socket.on("connect", () => {
      socket.io.engine.once("packetCreate", (packet) => {
        expect(packet.options.compress).to.be(false);
        socket.disconnect();
        done();
      });
      socket.compress(false).emit("hi");
    });
  });

  describe("query option", () => {
    it("should accept an object (default namespace)", (done) => {
      const socket = io("/", { forceNew: true, query: { e: "f" } });

      socket.emit("getHandshake", (handshake) => {
        expect(handshake.query.e).to.be("f");
        socket.disconnect();
        done();
      });
    });

    it("should accept a query string (default namespace)", (done) => {
      const socket = io("/?c=d", { forceNew: true });

      socket.emit("getHandshake", (handshake) => {
        expect(handshake.query.c).to.be("d");
        socket.disconnect();
        done();
      });
    });

    it("should accept an object", (done) => {
      const socket = io("/abc", { query: { a: "b" } });

      socket.on("handshake", (handshake) => {
        expect(handshake.query.a).to.be("b");
        socket.disconnect();
        done();
      });
    });

    it("should accept a query string", (done) => {
      const socket = io("/abc?b=c&d=e");

      socket.on("handshake", (handshake) => {
        expect(handshake.query.b).to.be("c");
        expect(handshake.query.d).to.be("e");
        socket.disconnect();
        done();
      });
    });

    it("should properly encode the parameters", (done) => {
      const socket = io("/abc", { query: { "&a": "&=?a" } });

      socket.on("handshake", (handshake) => {
        expect(handshake.query["&a"]).to.be("&=?a");
        socket.disconnect();
        done();
      });
    });
  });

  it("should fire an error event on middleware failure from main namespace", (done) => {
    const socket = io("/foo", { forceNew: true, query: { fail: true } });
    socket.on("error", (err) => {
      expect(err).to.eql("Auth failed (main namespace)");
      socket.disconnect();
      done();
    });
  });

  it("should fire an error event on middleware failure from custom namespace", (done) => {
    const socket = io("/no", { forceNew: true });
    socket.on("error", (err) => {
      expect(err).to.eql("Auth failed (custom namespace)");
      socket.disconnect();
      done();
    });
  });
});
