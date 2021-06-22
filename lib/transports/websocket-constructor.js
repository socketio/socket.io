module.exports = {
  WebSocket: require("ws"),
  usingBrowserWebSocket: false,
  defaultBinaryType: "nodebuffer",
  nextTick: process.nextTick
};
