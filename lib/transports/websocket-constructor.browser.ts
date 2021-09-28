import globalThis from "../globalThis.js";

export const nextTick = (() => {
  const isPromiseAvailable =
    typeof Promise === "function" && typeof Promise.resolve === "function";
  if (isPromiseAvailable) {
    return cb => Promise.resolve().then(cb);
  } else {
    return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
  }
})();

export const WebSocket = globalThis.WebSocket || globalThis.MozWebSocket;
export const usingBrowserWebSocket = true;
export const defaultBinaryType = "arraybuffer";
