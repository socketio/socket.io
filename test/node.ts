const path = require("path");
const { exec } = require("child_process");

describe("autoRef option", () => {
  const fixture = (filename) =>
    process.execPath + " " + path.join(__dirname, "fixtures", filename);

  it("should stop once the timer is triggered", (done) => {
    exec(fixture("unref.ts"), done);
  });

  it("should stop once the timer is triggered (even when trying to reconnect)", (done) => {
    exec(fixture("unref-during-reconnection.ts"), done);
  });

  it("should stop once the timer is triggered (polling)", (done) => {
    exec(fixture("unref-polling-only.ts"), done);
  });

  it("should stop once the timer is triggered (websocket)", (done) => {
    exec(fixture("unref-websocket-only.ts"), done);
  });

  it("should not stop with autoUnref set to false", (done) => {
    const process = exec(fixture("no-unref.ts"), () => {
      done(new Error("should not happen"));
    });
    setTimeout(() => {
      process.kill();
      done();
    }, 1000);
  });
});
