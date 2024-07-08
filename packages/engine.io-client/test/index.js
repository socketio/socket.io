const env = require("./support/env");

// whitelist some globals to avoid warnings
if (env.browser) {
  window.___eio = null;
} else {
  require("./node");
}

const Blob = require("blob");

require("./engine.io-client");
require("./socket");
require("./transport");
require("./connection");
require("./xmlhttprequest");
require("./parseuri");

if (typeof ArrayBuffer !== "undefined") {
  require("./arraybuffer");
} else {
  require("./binary-fallback");
}

// Blob is available in Node.js since v18, but not yet supported by the `engine.io-parser` package
if (Blob && env.browser) {
  require("./blob");
}
