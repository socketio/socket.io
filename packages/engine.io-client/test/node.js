const path = require("node:path");
const { execFile } = require("node:child_process");
const { createServer } = require("node:http");
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

  it("should not close when pingInterval + pingTimeout is above the maximum timer delay", (done) => {
    const httpServer = createServer();
    const engine = attach(httpServer, {
      pingInterval: 25000,
      pingTimeout: 2147483647, // the maximum delay of setTimeout()
    });

    httpServer.listen(0, () => {
      const socket = new Socket(
        `http://localhost:${httpServer.address().port}`,
        { transports: ["websocket"] },
      );

      socket.on("open", () => {
        setTimeout(() => {
          expect(socket.readyState).to.eql("open");
          socket.close();
          engine.close();
          httpServer.close();
          done();
        }, 100);
      });
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
