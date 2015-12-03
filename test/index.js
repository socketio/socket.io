
require('./support/env');

// whitelist some globals to avoid warnings
global.___eio = null;

require('./url');

// browser only tests
require('./connection');
require('./socket');

