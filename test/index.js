var env = require('./support/env');

require('./engine.io-client');
require('./util');
require('./parser');
require('./socket');
require('./transport');

// browser only tests
if (env.browser) {
  require('./connection');
}
