var Blob = require('blob');

if (global.ArrayBuffer) {
  require('./arraybuffer.js');
}

if (Blob) {
  require('./blob.js');
}
