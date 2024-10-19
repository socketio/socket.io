const env = require("./support/env");

// whitelist some globals to avoid warnings
if (env.browser) {
  window.___eio = null;
} else {
  require("./node");
}

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
if (typeof Blob === "function" && env.browser) {
  require("./blob");
}
