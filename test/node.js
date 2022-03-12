const path = require("path");
const { exec } = require("child_process");
const { Socket } = require("../");
const { repeat } = require("./util");

describe("node.js", () => {
  describe("autoRef option", () => {
    const fixture = filename =>
      process.execPath + " " + path.join(__dirname, "fixtures", filename);

    it("should stop once the timer is triggered", done => {
      exec(fixture("unref.js"), done);
    });

    it("should stop once the timer is triggered (polling)", done => {
      exec(fixture("unref-polling-only.js"), done);
    });

    it("should stop once the timer is triggered (websocket)", done => {
      exec(fixture("unref-websocket-only.js"), done);
    });

    it("should not stop with autoUnref set to false", done => {
      const process = exec(fixture("no-unref.js"), () => {
        done(new Error("should not happen"));
      });
      setTimeout(() => {
        process.kill();
        done();
      }, 1000);
    });
  });

  it("should merge binary packets according to maxPayload value", done => {
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
});
