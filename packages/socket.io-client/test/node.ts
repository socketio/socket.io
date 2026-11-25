const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");
import expect = require("expect.js");
import { Server } from "socket.io";
import { io } from "..";
import { wrap } from "./support/util";

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

describe("buffered timed-out events", function () {
  before(function () {
    if (process.env.WDIO_WORKER_ID !== undefined) {
      return this.skip();
    }
  });

  it("should not send a timed-out event queued behind an in-flight polling request", () => {
    return wrap((done) => {
      const httpServer = http.createServer();
      const ioServer = new Server(httpServer);
      const received: string[] = [];
      let delayNextPost = false;

      const existingListeners = httpServer.listeners("request").slice();
      httpServer.removeAllListeners("request");
      httpServer.on("request", (req, res) => {
        if (delayNextPost && req.method === "POST") {
          delayNextPost = false;
          setTimeout(() => {
            for (const listener of existingListeners) {
              listener.call(httpServer, req, res);
            }
          }, 150);
          return;
        }
        for (const listener of existingListeners) {
          listener.call(httpServer, req, res);
        }
      });

      ioServer.on("connection", (serverSocket) => {
        serverSocket.on("test", (msg, cb) => {
          received.push(msg);
          cb("done");
        });
      });

      httpServer.listen(0, () => {
        const address = httpServer.address();
        const port = typeof address === "object" && address ? address.port : 0;

        const client = io(`http://localhost:${port}`, {
          forceNew: true,
          transports: ["polling"],
          upgrade: false,
        });

        let timedOutErr: Error | null = null;
        let oneAck: string | null = null;

        const finish = (err?: Error) => {
          client.disconnect();
          ioServer.close(() => done(err));
        };

        client.on("connect", () => {
          // wait one tick so the initial polling handshake POST finishes
          setTimeout(() => {
            delayNextPost = true;

            client.emit("test", "one", (res) => {
              oneAck = res;
            });

            client.timeout(50).emit("test", "two", (err) => {
              timedOutErr = err;
            });

            client.timeout(5000).emit("test", "three", (err, res) => {
              try {
                expect(err).to.be(null);
                expect(res).to.be("done");
                expect(oneAck).to.be("done");
                expect(timedOutErr).to.be.an(Error);
                expect(received).to.eql(["one", "three"]);
                finish();
              } catch (e) {
                finish(e as Error);
              }
            });
          }, 20);
        });
      });
    });
  });
});
