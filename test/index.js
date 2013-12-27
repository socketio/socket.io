
var env = require('./support/env');

require('./url');

// browser only tests
if (env.browser) {
  require('./connection');
}

