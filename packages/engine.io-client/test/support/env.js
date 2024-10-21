/* global location:true */

// WARNING this is bad practice
// we only do this in our tests because we need to test engine.io-client
// support in browsers and in node.js
// some tests do not yet work in both
exports.browser = typeof window !== "undefined";
exports.wsSupport = !!(
  typeof window === "undefined" ||
  window.WebSocket ||
  window.MozWebSocket
);

const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
exports.isOldSimulator =
  ~userAgent.indexOf("iPhone OS 4") || ~userAgent.indexOf("iPhone OS 5");
exports.isIE9 = /MSIE 9/.test(userAgent);
exports.isIE10 = /MSIE 10/.test(userAgent);
exports.isIE11 = !!userAgent.match(/Trident.*rv[ :]*11\./); // ws doesn't work at all in sauce labs
exports.isAndroid = userAgent.match(/Android/i);
exports.isEdge = /Edg/.test(userAgent);
exports.isIPad = /iPad/.test(userAgent);

if (typeof location === "undefined") {
  location = {
    hostname: "localhost",
    port: 3000,
  };
}

exports.useFetch = !exports.browser && process.env.USE_FETCH !== undefined;

if (exports.useFetch) {
  console.warn("testing with fetch() instead of XMLHttpRequest");
  const { transports, Fetch } = require("../..");
  transports.polling = Fetch;
}

exports.useBuiltinWs = process.env.USE_BUILTIN_WS !== undefined;

if (exports.useBuiltinWs) {
  console.warn("testing with built-in WebSocket object");
  const { transports, WebSocket } = require("../..");
  transports.websocket = WebSocket;
}
