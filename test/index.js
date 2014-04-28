
var env = require('./support/env');

// whitelist some globals to avoid warnings
global.__eio = null;
global.___eio = null;
global.WEB_SOCKET_LOGGER = null;
global.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = null;
global.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = null;
global.WEB_SOCKET_SWF_LOCATION = null;

// node only tests
if (env.node) {
  require('./url');
}

// browser only tests
if (env.browser) {
  require('./connection');
}

