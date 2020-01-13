const Blob = require("blob");

if (global.ArrayBuffer) {
  require("./arraybuffer.js");
}

if (Blob) {
  require("./blob.js");
}

require("./base64_object.js");
