var env = require('./support/env.js');

require('./parser.js');

if (!env.browser) {
  require('./buffer.js');
}

if (global.ArrayBuffer) {
  require('./arraybuffer.js');
}
