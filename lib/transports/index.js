
/**
 * Module dependencies
 */

var XHR = require('./polling-xhr')
  , JSONP = require('./polling-jsonp')
  , websocket = require('./websocket')
  , flashsocket = require('./flashsocket')
  , util = require('../util')

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;
exports.flashsocket = flashsocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling (opts) {
  var xd = false;

  if (global.location) {
    xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
  }

  if (util.request(xd) && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    return new JSONP(opts);
  }
};
