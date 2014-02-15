var wsSupport = require('has-cors');

require('./polling.js');
if (wsSupport && !~navigator.userAgent.indexOf('iPhone')) {
  require ('./ws.js');
}
