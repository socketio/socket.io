/* global importScripts,eio,postMessage */

importScripts("/test/support/engine.io.min.js");

var socket = new eio.Socket();

var count = 0;
socket.on("message", function(msg) {
  count++;
  if (count < 10) {
    socket.send("give utf8");
  } else if (count < 20) {
    socket.send("give binary");
  }
  postMessage(msg);
});
