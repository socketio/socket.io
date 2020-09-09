// this is a test server to support tests which make requests

var express = require("express");
var app = express();
var join = require("path").join;
var http = require("http").Server(app);
var server = require("engine.io").attach(http, { pingInterval: 500 });
var webpack = require("webpack");
const path = require("path");

var webpackConfig = require("../../support/prod.config.js");

webpackConfig.output.path = path.resolve(__dirname, "public");

webpack(webpackConfig, function(err, stats) {
  if (err) console.log(err);
});

http.listen(process.env.ZUUL_PORT || 3000);

// serve worker.js and engine.io.js as raw file
app.use("/test/support", express.static(join(__dirname, "public")));

server.on("connection", function(socket) {
  socket.send("hi");

  // Bounce any received messages back
  socket.on("message", function(data) {
    if (data === "give binary") {
      var abv = new Int8Array(5);
      for (var i = 0; i < 5; i++) {
        abv[i] = i;
      }
      socket.send(abv);
      return;
    } else if (data === "give utf8") {
      socket.send("пойду сать всем мпокойной ночи");
      return;
    }

    socket.send(data);
  });
});
