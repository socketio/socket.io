
/**
 * Module dependencies.
 */

var XHR = require('./polling-xhr')
  , JSONP = require('./polling-jsonp')

/**
 * Export transports.
 */

module.exports = exports = {
    polling: polling
  , websocket: require('./websocket')
  , flashsocket: require('./flashsocket')
};

/**
 * Export upgrades map.
 */

exports.polling.upgradesTo = ['websocket', 'flashsocket'];

/**
 * Polling polimorphic constructor.
 *
 * @api private
 */

function polling (req) {
  if ('string' == typeof req.query.j) {
    return new JSONP(req);
  } else {
    return new XHR(req);
  }
}
