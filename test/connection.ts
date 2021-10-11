import expect from "expect.js";
import { io, Manager, ManagerOptions } from "..";
import hasCORS from "has-cors";
import FakeTimers from "@sinonjs/fake-timers";
import textBlobBuilder from "text-blob-builder";
import env from "./support/env";

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

  it("should start two connections with different paths", () => {
    const s1 = io("/", { path: "/foo" });
    const s2 = io("/", { path: "/bar" });

    expect(s1.io).to.not.be(s2.io);
    s1.disconnect();
    s2.disconnect();
  });

  it("should start a single connection with different namespaces", () => {
    const opts = {};
    const s1 = io("/foo", opts);
    const s2 = io("/bar", opts);

    expect(s1.io).to.be(s2.io);
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
    const manager = new Manager();
    const socket = manager.socket("/");
    socket.on("connect", () => {
      const foo = manager.socket("/foo");
      foo.on("connect", () => {
        foo.close();
        socket.close();
        manager._close();
        done();
      });
    });
  });

  it("should open a new namespace after connection gets closed", (done) => {
    const manager = new Manager();
    const socket = manager.socket("/");
    socket
      .on("connect", () => {
        socket.disconnect();
      })
      .on("disconnect", () => {
        const foo = manager.socket("/foo");
        foo.on("connect", () => {
          foo.disconnect();
          manager._close();
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
        socket.io.on("reconnect", () => {
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
    const manager = new Manager({
      reconnection: true,
      timeout: 0,
      reconnectionAttempts: 2,
      reconnectionDelay: 10,
    });
    const socket = manager.socket("/timeout");
    manager.once("reconnect_failed", () => {
      let reconnects = 0;
      const reconnectCb = () => {
        reconnects++;
      };

      manager.on("reconnect_attempt", reconnectCb);
      manager.on("reconnect_failed", () => {
        expect(reconnects).to.be(2);
        socket.close();
        manager._close();
        done();
      });
      socket.connect();
    });
  });

  it("reconnect delay should increase every time", (done) => {
    const manager = new Manager({
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

    manager.on("error", () => {
      startTime = new Date().getTime();
    });
    manager.on("reconnect_attempt", () => {
      reconnects++;
      const currentTime = new Date().getTime();
      const delay = currentTime - startTime;
      if (delay <= prevDelay) {
        increasingDelay = false;
      }
      prevDelay = delay;
    });

    manager.on("reconnect_failed", () => {
      expect(reconnects).to.be(3);
      expect(increasingDelay).to.be.ok();
      socket.close();
      manager._close();
      done();
    });
  });

  it("should not reconnect when force closed", (done) => {
    const socket = io("/invalid", {
      forceNew: true,
      timeout: 0,
      reconnectionDelay: 10,
    });
    socket.io.once("error", () => {
      socket.io.on("reconnect_attempt", () => {
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
    socket.io.once("reconnect_attempt", () => {
      socket.io.on("reconnect_attempt", () => {
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
    socket.io.once("reconnect_attempt", () => {
      socket.io.on("reconnect_attempt", () => {
        socket.disconnect();
        done();
      });
      socket.disconnect();
      socket.connect();
    });
  });

  it("should stop reconnecting on a socket and keep to reconnect on another", (done) => {
    const manager = new Manager();
    const socket1 = manager.socket("/");
    const socket2 = manager.socket("/asd");

    manager.on("reconnect_attempt", () => {
      socket1.on("connect", () => {
        expect().fail();
      });
      socket2.on("connect", () => {
        setTimeout(() => {
          socket2.disconnect();
          manager._close();
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
    const manager = new Manager({
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
      manager._close();
      done();
    });

    socket = manager.socket("/timeout");
  });

  it("should fire reconnect_* events on manager", (done) => {
    const manager = new Manager({
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

    manager.on("reconnect_attempt", reconnectCb);
    manager.on("reconnect_failed", () => {
      expect(reconnects).to.be(2);
      socket.close();
      manager._close();
      done();
    });
  });

  it("should fire reconnecting (on manager) with attempts number when reconnecting twice", (done) => {
    const manager = new Manager({
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

    manager.on("reconnect_attempt", reconnectCb);
    manager.on("reconnect_failed", () => {
      expect(reconnects).to.be(2);
      socket.close();
      manager._close();
      done();
    });
  });

  it("should not try to reconnect and should form a connection when connecting to correct port with default timeout", (done) => {
    const manager = new Manager({
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
        manager._close();
        done();
      }, 1000);
    });
  });

  it("should connect while disconnecting another socket", (done) => {
    const manager = new Manager();
    const socket1 = manager.socket("/foo");
    socket1.on("connect", () => {
      const socket2 = manager.socket("/asd");
      socket2.on("connect", done);
      socket1.disconnect();
    });
  });

  it("should emit a connect_error event when reaching a Socket.IO server in v2.x", (done) => {
    const socket = io({
      autoConnect: false,
    });

    socket.on("connect_error", () => {
      done();
    });

    // @ts-ignore
    socket.onpacket({
      nsp: "/",
      type: 0,
    });
  });

  it("should not close the connection when disconnecting a single socket", (done) => {
    const manager = new Manager({
      autoConnect: false,
    });
    const socket1 = manager.socket("/foo");
    const socket2 = manager.socket("/asd");

    socket1.connect();
    socket1.on("connect", () => {
      socket2.connect();
    });

    socket2.on("connect", () => {
      socket2.on("disconnect", () => {
        done(new Error("should not happen for now"));
      });
      socket1.disconnect();
      setTimeout(() => {
        socket2.off("disconnect");
        manager.on("close", () => {
          done();
        });
        socket2.disconnect();
      }, 200);
    });
  });

  // Ignore incorrect connection test for old IE due to no support for
  // `script.onerror` (see: http://requirejs.org/docs/api.html#ieloadfail)
  if (!global.document || hasCORS) {
    it("should try to reconnect twice and fail when requested two attempts with incorrect address and reconnect enabled", (done) => {
      const manager = new Manager("http://localhost:3940", {
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
        manager._close();
        done();
      });
    });

    it("should not try to reconnect with incorrect port when reconnection disabled", (done) => {
      const manager = new Manager("http://localhost:9823", {
        reconnection: false,
      });
      const cb = () => {
        socket.close();
        expect().fail();
      };
      manager.on("reconnect_attempt", cb);

      manager.on("error", () => {
        // set a timeout to let reconnection possibly fire
        setTimeout(() => {
          socket.disconnect();
          manager._close();
          done();
        }, 1000);
      });

      var socket = manager.socket("/invalid");
    });

    it("should still try to reconnect twice after opening another socket asynchronously", (done) => {
      const manager = new Manager("http://localhost:9823", {
        reconnection: true,
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
        manager._close();
        done();
      });

      var socket = manager.socket("/room1");

      setTimeout(() => {
        manager.socket("/room2");
      }, delay);
    });
  }

  describe("reconnect timeout", () => {
    const setupManagerCallbacks = (manager: Manager) => {
      const socket = manager.socket("/foo");
      manager.on("reconnect_attempt", () => {
        reconnected = true;
        socket.disconnect();
      });
    };
    let options!: Partial<ManagerOptions>;
    let reconnected!: boolean;
    const realTimeout = setTimeout;
    const wait = (delay: number) =>
      new Promise((resolve) => {
        realTimeout(resolve, delay);
      });

    beforeEach(() => {
      options = {
        timeout: 500,
        reconnectionDelayMax: 100,
        randomizationFactor: 0,
      };
      reconnected = false;
    });

    it("should use overridden setTimeout by default", async () => {
      const clock = FakeTimers.install();
      const manager = new Manager(options);
      setupManagerCallbacks(manager);

      // Wait real clock time for the socket to connect before disconnecting it.
      await clock.tickAsync(options.timeout);
      await wait(options.timeout);
      manager.engine.close();

      // Let the clock approach the reconnect delay.
      await clock.tickAsync(options.reconnectionDelayMax - 1);
      expect(reconnected).to.be(false);

      await clock.tickAsync(1); // reconnect.
      expect(reconnected).to.be(true);

      clock.uninstall();
    });

    it("should use native setTimeout with useNativeSetTimers", async () => {
      options.useNativeTimers = true;
      const clock = FakeTimers.install();
      const manager = new Manager(options);
      setupManagerCallbacks(manager);

      // Wait real clock time for the socket to connect before disconnecting it.
      await clock.tickAsync(options.timeout);
      await wait(options.timeout);
      manager.engine.close();

      // Since the client will not use the overridden timeout function,
      // advancing the fake clock should not reconnect.
      await clock.tickAsync(options.reconnectionDelayMax);
      expect(reconnected).to.be(false);
      clock.uninstall();

      // Wait reconnectionDelayMax to trigger reconnect.
      await wait(options.reconnectionDelayMax);
      expect(reconnected).to.be(true);
    });
  });

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
