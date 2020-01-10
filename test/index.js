require("./support/env");

// whitelist some globals to avoid warnings
if (typeof window !== "undefined") {
  window.___eio = null;
}

var Blob = require("blob");

require("./engine.io-client");
require("./socket");
require("./transport");
require("./connection");
require("./transports");
require("./xmlhttprequest");

if (typeof ArrayBuffer !== "undefined") {
  require("./arraybuffer");
} else {
  require("./binary-fallback");
}

if (Blob) {
  require("./blob");
}
