// this is a test server to support tests which make requests

const express = require("express");
const { join } = require("path");
const { createServer } = require("http");
const { attach } = require("engine.io");
const { rollup } = require("rollup");

const rollupConfig = require("../../support/rollup.config.umd.js")[1];
const { serialize } = require("cookie");

let httpServer, engine;

exports.mochaHooks = {
  beforeAll() {
    const app = express();
    httpServer = createServer(app);

    engine = attach(httpServer, {
      pingInterval: 500,
      maxHttpBufferSize: 100,
      allowRequest: (req, fn) => {
        const denyRequest = new URL(`http://${req.url}`).searchParams.has(
          "deny",
        );
        fn(null, !denyRequest);
      },
    });

    rollup(rollupConfig).then(async (bundle) => {
      await bundle.write({
        ...rollupConfig.output,
        file: "./test/support/public/engine.io.min.js",
        sourcemap: false,
      });

      await bundle.close();
    });

    httpServer.listen(process.env.ZUUL_PORT || 3000);

    // serve worker.js and engine.io.js as raw file
    app.use("/test/support", express.static(join(__dirname, "public")));

    engine.on("connection", (socket) => {
      socket.send("hi");

      // Bounce any received messages back
      socket.on("message", (data) => {
        if (data === "give binary") {
          const abv = new Int8Array(5);
          for (let i = 0; i < 5; i++) {
            abv[i] = i;
          }
          socket.send(abv);
          return;
        } else if (data === "give utf8") {
          socket.send("пойду спать всем спокойной ночи");
          return;
        } else if (data === "sendHeaders") {
          const headers = socket.transport?.dataReq?.headers;
          return socket.send(JSON.stringify(headers));
        }

        socket.send(data);
      });
    });

    engine.on("initial_headers", (headers) => {
      headers["set-cookie"] = [
        serialize("1", "1", { maxAge: 86400 }),
        serialize("2", "2", {
          sameSite: true,
          path: "/",
          httpOnly: true,
          secure: true,
        }),
        serialize("3", "3", { maxAge: 0 }),
        serialize("4", "4", { expires: new Date() }),
      ];
    });
  },

  afterAll() {
    httpServer.close();
    engine.close();
  },
};
