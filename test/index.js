var env = require('./support/env');
var parser = env.browser ? require('../lib/browser.js') : require('../lib');

// General parsing tests and encoding/decoding strings
require('./parser.js')(parser);

if (env.browser) {
  require('./browser');
} else {
  require('./node');
}
