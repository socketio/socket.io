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

var userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
exports.isOldSimulator =
  ~userAgent.indexOf("iPhone OS 4") || ~userAgent.indexOf("iPhone OS 5");
exports.isIE8 = /MSIE 8/.test(userAgent);
exports.isIE9 = /MSIE 9/.test(userAgent);
exports.isIE10 = /MSIE 10/.test(userAgent);
exports.isIE11 = !!userAgent.match(/Trident.*rv[ :]*11\./); // ws doesn't work at all in sauce labs
exports.isAndroid = userAgent.match(/Android/i);

if (typeof location === "undefined") {
  location = {
    hostname: "localhost",
    port: 3000
  };
}
