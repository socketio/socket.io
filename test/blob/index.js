var wsSupport = require('has-cors');

require('./polling.js');
var uagent = navigator.userAgent;
var isOldSimulator = ~uagent.indexOf('iPhone OS 4') || ~uagent.indexOf('iPhone OS 5');
if (wsSupport && !isOldSimulator) {
  require('./ws.js');
}
