
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
  var xhr
    , xd = false
    , isXProtocol = false;

  if (global.location) {
    xd = opts.host != global.location.hostname
      || global.location.port != opts.port;
    isXProtocol = (opts.secure !== (global.location.protocol === 'https:'));
  }

  xhr = util.request(xd);
  /* See #7 at http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx */
  if (isXProtocol && global.XDomainRequest && xhr instanceof global.XDomainRequest) {
    return new JSONP(opts);
  }

  if (xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    return new JSONP(opts);
  }
};
