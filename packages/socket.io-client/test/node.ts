const path = require("node:path");
const { execFile } = require("node:child_process");

describe("autoUnref option", function () {
  before(function () {
    if (process.env.WDIO_WORKER_ID !== undefined) {
      return this.skip();
    }
  });

  const runFixture = (filename, done) =>
    execFile(
      process.execPath,
      [path.join(__dirname, "fixtures", filename)],
      done,
    );

  it("should stop once the timer is triggered", (done) => {
    runFixture("unref.ts", done);
  });

  it("should stop once the timer is triggered (even when trying to reconnect)", (done) => {
    runFixture("unref-during-reconnection.ts", done);
  });

  it("should stop once the timer is triggered (polling)", (done) => {
    runFixture("unref-polling-only.ts", done);
  });

  it("should stop once the timer is triggered (websocket)", (done) => {
    runFixture("unref-websocket-only.ts", done);
  });

  it("should not stop with autoUnref set to false", (done) => {
    let killed = false;
    let timer: NodeJS.Timeout;

    const child = runFixture("no-unref.ts", () => {
      if (killed) {
        return;
      }

      clearTimeout(timer);
      done(new Error("should not happen"));
    });

    timer = setTimeout(() => {
      killed = true;
      child.kill();
      done();
    }, 100);
  });
});
