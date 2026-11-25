const http = require("node:http");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { attach } = require("engine.io");
const { Socket } = require("../");
const { repeat } = require("./util");
const expect = require("expect.js");
const { parse } = require("../build/cjs/globals.node.js");
const { CookieJar } = require("../build/cjs/globals.node.js");

describe("node.js", () => {
  describe("autoRef option", () => {
    const runFixture = (filename, done) =>
      execFile(
        process.execPath,
        [path.join(__dirname, "fixtures", filename)],
        done,
      );

    it("should stop once the timer is triggered", (done) => {
      runFixture("unref.js", done);
    });

    it("should stop once the timer is triggered (polling)", (done) => {
      runFixture("unref-polling-only.js", done);
    });

    it("should stop once the timer is triggered (websocket)", (done) => {
      runFixture("unref-websocket-only.js", done);
    });

    it("should not stop with autoUnref set to false", (done) => {
      let isComplete = false;

      const child = runFixture("no-unref.js", () => {
        if (!isComplete) {
          done(new Error("should not happen"));
        }
      });
      setTimeout(() => {
        isComplete = true;
        child.kill();
        done();
      }, 100);
    });
  });

  it("should merge binary packets according to maxPayload value", (done) => {
    const socket = new Socket({ transports: ["polling"] });
    socket.on("open", () => {
      socket.send(Buffer.allocUnsafe(72));
      socket.send(Buffer.allocUnsafe(20));
      socket.send(repeat("a", 20));
      socket.send(Buffer.allocUnsafe(20));
      socket.send(Buffer.allocUnsafe(72));

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

  it("should send cookies with withCredentials: true", (done) => {
    const socket = new Socket("http://localhost:3000", {
      transports: ["polling"],
      withCredentials: true,
    });

    socket.on("open", () => {
      setTimeout(() => {
        socket.send("sendHeaders");
      }, 10);
    });

    socket.on("message", (data) => {
      if (data === "hi") {
        return;
      }
      const headers = JSON.parse(data);
      expect(headers.cookie).to.eql("1=1; 2=2");

      socket.close();
      done();
    });
  });

  it("should not send cookies with withCredentials: false", (done) => {
    const socket = new Socket("http://localhost:3000", {
      transports: ["polling"],
      withCredentials: false,
    });

    socket.on("open", () => {
      socket.send("sendHeaders");
    });

    socket.on("message", (data) => {
      if (data === "hi") {
        return;
      }
      const headers = JSON.parse(data);
      expect(headers.cookie).to.eql(undefined);

      socket.close();
      done();
    });
  });

  it("should not modify the extraHeaders option with withCredentials: true", (done) => {
    const extraHeaders = { foo: "bar" };
    const socket = new Socket("http://localhost:3000", {
      withCredentials: true,
      extraHeaders,
    });

    socket.on("upgrade", () => {
      expect(extraHeaders).to.eql({ foo: "bar" });

      socket.close();
      done();
    });
  });
});

describe("cookie parsing", () => {
  it("should parse a simple set-cookie header", () => {
    const cookieStr = "foo=bar";

    expect(parse(cookieStr)).to.eql({
      name: "foo",
      value: "bar",
    });
  });

  it("should parse a complex set-cookie header", () => {
    const cookieStr =
      "foo=bar; Max-Age=1000; Domain=.example.com; Path=/; Expires=Tue, 01 Jul 2025 10:01:11 GMT; HttpOnly; Secure; SameSite=strict";

    const cookie = parse(cookieStr);
    const expected = Date.now() + 1000 * 1000;
    expect(cookie.name).to.eql("foo");
    expect(cookie.value).to.eql("bar");
    // Max-Age takes precedence over Expires (RFC 6265, section 5.3)
    expect(cookie.expires.getTime()).to.be.within(
      expected - 1000,
      expected + 1000,
    );
  });

  it("should give Max-Age precedence when it appears before Expires", () => {
    const cookie = parse(
      "foo=bar; Max-Age=1000; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    const expected = Date.now() + 1000 * 1000;
    expect(cookie.name).to.eql("foo");
    expect(cookie.value).to.eql("bar");
    expect(cookie.expires.getTime()).to.be.within(
      expected - 1000,
      expected + 1000,
    );
  });

  it("should give Max-Age precedence when it appears after Expires", () => {
    const cookie = parse(
      "foo=bar; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=1000",
    );
    const expected = Date.now() + 1000 * 1000;
    expect(cookie.name).to.eql("foo");
    expect(cookie.value).to.eql("bar");
    expect(cookie.expires.getTime()).to.be.within(
      expected - 1000,
      expected + 1000,
    );
  });

  it("should honor Expires when Max-Age is absent", () => {
    const expires = "Fri, 01 Jan 2100 00:00:00 GMT";
    expect(parse(`foo=bar; Expires=${expires}`)).to.eql({
      name: "foo",
      value: "bar",
      expires: new Date(expires),
    });
  });

  it("should parse a weird but valid cookie", () => {
    const cookieStr =
      "foo=bar=bar&foo=foo&John=Doe&Doe=John; Domain=.example.com; Path=/; HttpOnly; Secure";

    expect(parse(cookieStr)).to.eql({
      name: "foo",
      value: "bar=bar&foo=foo&John=Doe&Doe=John",
    });
  });
});

describe("cookie expiry", () => {
  // RFC 6265, section 5.2.2: "If delta-seconds is less than or equal to zero (0), let expiry-time
  // be the earliest representable date and time."
  it("should treat Max-Age=0 as an expired cookie", () => {
    const jar = new CookieJar();
    jar.parseCookies(["foo=bar; Max-Age=0"]);

    expect([...jar.cookies]).to.eql([]);
  });

  it("should treat a negative Max-Age as an expired cookie", () => {
    const jar = new CookieJar();
    jar.parseCookies(["foo=bar; Max-Age=-1"]);

    expect([...jar.cookies]).to.eql([]);
  });

  it("should not keep a cookie whose Max-Age cannot be parsed", () => {
    // a malformed attribute must not turn a deletion request into a session cookie
    const jar = new CookieJar();
    jar.parseCookies(["foo=bar; Max-Age=abc"]);

    expect([...jar.cookies]).to.eql([]);
  });

  it("should not keep a cookie whose Expires date cannot be parsed", () => {
    const jar = new CookieJar();
    jar.parseCookies(["foo=bar; Expires=not-a-date"]);

    expect([...jar.cookies]).to.eql([]);
  });

  // RFC 6265, section 5.2: attribute names are matched case-insensitively
  it("should match the Expires and Max-Age attributes case-insensitively", () => {
    const jar = new CookieJar();
    jar.parseCookies([
      "foo=bar; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/",
      "bar=baz; max-age=0",
      "baz=qux; MAX-AGE=0",
    ]);

    expect([...jar.cookies]).to.eql([]);
  });

  it("should keep a cookie with a Max-Age in the future", () => {
    const jar = new CookieJar();
    jar.parseCookies(["foo=bar; Max-Age=1000"]);

    expect([...jar.cookies].map(([name]) => name)).to.eql(["foo"]);
  });

  it("should delete a cookie when Max-Age=0 even if Expires is in the future", () => {
    const jar = new CookieJar();
    jar.parseCookies([
      "foo=bar; Max-Age=0; Expires=Fri, 01 Jan 2100 00:00:00 GMT",
    ]);

    expect([...jar.cookies]).to.eql([]);
  });
});

describe("close packet handling", () => {
  let httpServer, engine;

  const startServer = (opts = {}) =>
    new Promise((resolve) => {
      httpServer = http.createServer();
      engine = attach(httpServer, opts);
      httpServer.listen(0, () => {
        resolve(httpServer.address().port);
      });
    });

  const sendClosePacket = (serverSocket) => {
    if (serverSocket.transport.writable) {
      serverSocket.transport.send([{ type: "close" }]);
    } else {
      serverSocket.transport.once("ready", () => {
        serverSocket.transport.send([{ type: "close" }]);
      });
    }
  };

  const spyOnClose = (transport) => {
    const spy = { calls: 0 };
    const originalOnClose = transport.onClose;
    transport.onClose = function (...args) {
      spy.calls++;
      return originalOnClose.apply(this, args);
    };
    return spy;
  };

  const assertClosedByServer = (socket, reason, details) => {
    expect(reason).to.eql("transport close");
    expect(details).to.eql({
      description: "transport closed by the server",
    });
    expect(socket.readyState).to.eql("closed");
    expect(socket.transport.readyState).to.eql("closed");
  };

  afterEach((done) => {
    if (engine) {
      engine.close();
      engine = null;
    }
    if (httpServer) {
      const server = httpServer;
      httpServer = null;
      server.close(done);
    } else {
      done();
    }
  });

  it("should close the connection when receiving a close packet over websocket", async () => {
    const port = await startServer({ transports: ["websocket"] });

    await new Promise((resolve, reject) => {
      let serverSocket;
      let clientOpened = false;
      let serverClosed = false;
      let clientClosed = false;
      let onCloseSpy;

      const maybeSendClose = () => {
        if (serverSocket && clientOpened) {
          sendClosePacket(serverSocket);
        }
      };

      const finishIfDone = () => {
        if (serverClosed && clientClosed) {
          // wait briefly to ensure the underlying WebSocket close event does not invoke onClose() a second time
          setTimeout(() => {
            try {
              expect(onCloseSpy.calls).to.eql(1);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, 50);
        }
      };

      engine.on("connection", (s) => {
        serverSocket = s;
        s.on("close", () => {
          serverClosed = true;
          finishIfDone();
        });
        maybeSendClose();
      });

      const socket = new Socket(`http://localhost:${port}`, {
        transports: ["websocket"],
      });

      socket.on("packet", (packet) => {
        if (packet.type === "close") {
          socket.close();
          reject(new Error("should not emit a close packet event"));
        }
      });

      socket.on("open", () => {
        onCloseSpy = spyOnClose(socket.transport);
        clientOpened = true;
        maybeSendClose();
      });

      socket.on("close", (reason, details) => {
        try {
          assertClosedByServer(socket, reason, details);
          clientClosed = true;
          finishIfDone();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it("should close the connection when receiving a close packet over polling", async () => {
    const port = await startServer({ transports: ["polling"] });

    await new Promise((resolve, reject) => {
      let serverSocket;
      let clientOpened = false;
      let onCloseSpy;

      const maybeSendClose = () => {
        if (serverSocket && clientOpened) {
          sendClosePacket(serverSocket);
        }
      };

      engine.on("connection", (s) => {
        serverSocket = s;
        maybeSendClose();
      });

      const socket = new Socket(`http://localhost:${port}`, {
        transports: ["polling"],
      });

      socket.on("packet", (packet) => {
        if (packet.type === "close") {
          socket.close();
          reject(new Error("should not emit a close packet event"));
        }
      });

      socket.on("open", () => {
        onCloseSpy = spyOnClose(socket.transport);
        clientOpened = true;
        maybeSendClose();
      });

      socket.on("close", (reason, details) => {
        try {
          assertClosedByServer(socket, reason, details);
          expect(onCloseSpy.calls).to.eql(1);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it("should close the connection when receiving a close packet after upgrading to websocket", async () => {
    const port = await startServer({ transports: ["polling", "websocket"] });

    await new Promise((resolve, reject) => {
      let serverSocket;
      let serverUpgraded = false;
      let clientUpgraded = false;
      let serverClosed = false;
      let clientClosed = false;
      let onCloseSpy;

      const maybeSendClose = () => {
        if (serverUpgraded && clientUpgraded) {
          sendClosePacket(serverSocket);
        }
      };

      const finishIfDone = () => {
        if (serverClosed && clientClosed) {
          setTimeout(() => {
            try {
              expect(onCloseSpy.calls).to.eql(1);
              resolve();
            } catch (err) {
              reject(err);
            }
          }, 50);
        }
      };

      engine.on("connection", (s) => {
        serverSocket = s;
        s.on("upgrade", () => {
          serverUpgraded = true;
          maybeSendClose();
        });
        s.on("close", () => {
          serverClosed = true;
          finishIfDone();
        });
      });

      const socket = new Socket(`http://localhost:${port}`, {
        transports: ["polling", "websocket"],
      });

      socket.on("packet", (packet) => {
        if (packet.type === "close") {
          socket.close();
          reject(new Error("should not emit a close packet event"));
        }
      });

      socket.on("upgrade", (transport) => {
        onCloseSpy = spyOnClose(transport);
        clientUpgraded = true;
        maybeSendClose();
      });

      socket.on("close", (reason, details) => {
        try {
          assertClosedByServer(socket, reason, details);
          clientClosed = true;
          finishIfDone();
        } catch (err) {
          reject(err);
        }
      });
    });
  });
});
