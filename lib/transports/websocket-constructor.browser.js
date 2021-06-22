const globalThis = require("../globalThis");
const nextTick = (() => {
  const isPromiseAvailable =
    typeof Promise === "function" && typeof Promise.resolve === "function";
  if (isPromiseAvailable) {
    return cb => Promise.resolve().then(cb);
  } else {
    return cb => setTimeout(cb, 0);
  }
})();

module.exports = {
  WebSocket: globalThis.WebSocket || globalThis.MozWebSocket,
  usingBrowserWebSocket: true,
  defaultBinaryType: "arraybuffer",
  nextTick
};
