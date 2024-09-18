const path = require("path");
const { exec } = require("child_process");
const { Socket } = require("../");
const { repeat } = require("./util");
const expect = require("expect.js");
const { parse } = require("../build/cjs/globals.node.js");

describe("node.js", () => {
  describe("autoRef option", () => {
    const fixture = (filename) =>
      process.execPath + " " + path.join(__dirname, "fixtures", filename);

    it("should stop once the timer is triggered", (done) => {
      exec(fixture("unref.js"), done);
    });

    it("should stop once the timer is triggered (polling)", (done) => {
      exec(fixture("unref-polling-only.js"), done);
    });

    it("should stop once the timer is triggered (websocket)", (done) => {
      exec(fixture("unref-websocket-only.js"), done);
    });

    it("should not stop with autoUnref set to false", (done) => {
      let isComplete = false;

      const process = exec(fixture("no-unref.js"), () => {
        if (!isComplete) {
          done(new Error("should not happen"));
        }
      });
      setTimeout(() => {
        isComplete = true;
        process.kill();
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

    expect(parse(cookieStr)).to.eql({
      name: "foo",
      value: "bar",
      expires: new Date("Tue Jul 01 2025 06:01:11 GMT-0400 (EDT)"),
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
