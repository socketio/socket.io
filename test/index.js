var env = require('./support/env');

// whitelist some globals to avoid warnings
global.__eio = null;
global.WEB_SOCKET_LOGGER = null;
global.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = null;
global.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = null;
global.WEB_SOCKET_SWF_LOCATION = null;

var blobSupported = (function() {
  try {
    new Blob([]);
    return true;
  } catch(e) {}
  return false;
})();

/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;
var blobBuilderSupported = !!BlobBuilder && !!BlobBuilder.prototype.append && !!BlobBuilder.prototype.getBlob;

require('./engine.io-client');
require('./util');
require('./parser');
require('./socket');
require('./transport');

// browser only tests
if (env.browser) {
  require('./connection');
  if (global.ArrayBuffer) {
    require('./browser-only-parser');
    require('./arraybuffer');
  }
  if (blobSupported) {
    require('./blob');
  }
}
