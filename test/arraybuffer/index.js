var wsSupport = require('has-cors');

require('./polling.js');
if (wsSupport) {
  require ('./ws.js');
}
