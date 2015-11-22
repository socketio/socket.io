var env = require('../support/env');

require('./polling.js');
if (env.wsSupport && !env.isOldSimulator && !env.isAndroid && !env.isIE11) {
  require ('./ws.js');
}
