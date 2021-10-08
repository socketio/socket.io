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

if (typeof ArrayBuffer !== "undefined") {
  require("./arraybuffer");
} else {
  require("./binary-fallback");
}

if (Blob) {
  require("./blob");
}
