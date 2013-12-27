
var env = require('./support/env');

// node only tests
if (env.node) {
  require('./url');
}

// browser only tests
if (env.browser) {
  require('./connection');
}

