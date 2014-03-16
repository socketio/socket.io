var wsSupport = require('has-cors');

require('./polling.js');
var uagent = navigator.userAgent;
var isOldSimulator = ~uagent.indexOf('iPhone OS 4') || ~uagent.indexOf('iPhone OS 5');
var isAndroid = navigator.userAgent.match(/Android/i);
if (wsSupport && !isOldSimulator && !isAndroid) {
  require('./ws.js');
}
