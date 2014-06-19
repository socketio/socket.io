var wsSupport = require('has-cors');

require('./polling.js');
var uagent = navigator.userAgent;
var isOldSimulator = ~uagent.indexOf('iPhone OS 4') || ~uagent.indexOf('iPhone OS 5');
var isIE11 = !!navigator.userAgent.match(/Trident.*rv[ :]*11\./); // ws doesn't work at all in sauce labs
var isAndroid = navigator.userAgent.match(/Android/i);
if (wsSupport && !isOldSimulator && !isAndroid && !isIE11) {
  require('./ws.js');
}
