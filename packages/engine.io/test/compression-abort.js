/* eslint-disable standard/no-callback-literal */

const http = require("http");
const crypto = require("crypto");
const cookieMod = require("cookie");
const { listen } = require("./common");
const expect = require("expect.js");

function getSidFromResponse(res) {
  const c = cookieMod.parse(res.headers["set-cookie"][0]);
  return c[Object.keys(c)[0]];
}

describe("polling compression", () => {
  let engine;

  afterEach(() => {
    if (engine && engine.httpServer) {
      engine.httpServer.close();
    }
  });

  it("should not lose the write callback when the client aborts a compressed response mid-stream", (done) => {
    engine = listen(
      {
        cookie: true,
        transports: ["polling"],
        httpCompression: { threshold: 0 },
        pingInterval: 60000,
        pingTimeout: 60000,
      },
      (port) => {
        // incompressible content so real bytes keep flowing to the socket
        const chunk = crypto.randomBytes(1024 * 1024).toString("base64");
        let sendCallbackCalled = false;

        engine.on("connection", (c) => {
          const spam = setInterval(() => {
            if (c.readyState !== "open") {
              clearInterval(spam);
              return;
            }
            c.send(chunk, () => {
              sendCallbackCalled = true;
            });
          }, 5);
          setTimeout(() => clearInterval(spam), 2000);
        });

        http.get({ port, path: "/engine.io/?transport=polling" }, (res) => {
          const sid = getSidFromResponse(res);
          const pollReq = http.get(
            {
              port,
              path: "/engine.io/?transport=polling&sid=" + sid,
              headers: { "Accept-Encoding": "gzip, deflate" },
            },
            (pollRes) => {
              // abort on headers, before any body byte is written
              pollReq.destroy();
              setTimeout(() => {
                try {
                  expect(sendCallbackCalled).to.be(true);
                  done();
                } catch (e) {
                  done(e);
                }
              }, 1500);
            },
          );
          pollReq.on("error", () => {}); // expected: socket hang up
        });
      },
    );
  });
});
