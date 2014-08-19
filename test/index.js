var env = require('./support/env');

// whitelist some globals to avoid warnings
global.__eio = null;
global.___eio = null;
global.WEB_SOCKET_LOGGER = null;
global.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = null;
global.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = null;
global.WEB_SOCKET_SWF_LOCATION = null;

var Blob = require('blob');

require('./engine.io-client');
require('./socket');
require('./transport');

// browser only tests
if (env.browser) {
  require('./connection');
  require('./transports');
  require('./xmlhttprequest');
  if (global.ArrayBuffer) {
    require('./arraybuffer');
  } else {
    require('./binary-fallback');
  }

  if (Blob) {
    require('./blob');
  }
}
