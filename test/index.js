
require('./support/env');

// whitelist some globals to avoid warnings
if (global.mocha) {
  global.mocha.globals(['___eio', 'eio_iframe_*']);
}

require('./url');

// browser only tests
require('./connection');
require('./socket');

