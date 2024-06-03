// this is a test server to support tests which make requests

const express = require("express");
const app = express();
const join = require("path").join;
const http = require("http").Server(app);
const server = require("engine.io").attach(http, {
  pingInterval: 500,
  maxHttpBufferSize: 100,
});
const { rollup } = require("rollup");

const rollupConfig = require("../../support/rollup.config.umd.js")[1];

rollup(rollupConfig).then(async (bundle) => {
  await bundle.write({
    ...rollupConfig.output,
    file: "./test/support/public/engine.io.min.js",
    sourcemap: false,
  });

  await bundle.close();
});

http.listen(process.env.ZUUL_PORT || 3000);

// serve worker.js and engine.io.js as raw file
app.use("/test/support", express.static(join(__dirname, "public")));

server.on("connection", (socket) => {
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
    }

    socket.send(data);
  });
});
