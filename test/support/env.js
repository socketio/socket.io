// WARNING this is bad practice
// we only do this in our tests because we need to test engine.io-client
// support in browsers and in node.js
// some tests do not yet work in both
exports.browser = typeof window !== "undefined";
exports.node = !exports.browser;

if (exports.node) {
  global.location = {
    protocol: "http:",
    host: "localhost:3210",
    hostname: "localhost",
    port: "3210",
  };
}
