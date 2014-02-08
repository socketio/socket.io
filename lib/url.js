
/**
 * Module dependencies.
 */

var url = require('url');
var debug = require('debug')('socket.io-client:url');

/**
 * Module exports.
 */

module.exports = parse;

/**
 * URL parser.
 *
 * @param {String} url
 * @param {Object} An object meant to mimic window.location.
 *                 Defaults to window.location.
 * @api public
 */

function parse(uri, loc){
  var obj = uri;
  // default to window.location
  var loc = loc || location;

  if (null == uri) uri = loc.protocol + '//' + loc.host;

  // parse string
  if ('string' == typeof uri) {
    if ('/' == uri.charAt(0)) {
      if ('undefined' != typeof loc) {
        uri = loc.hostname + uri;
      }
    }

    // allow for `localhost:3000`
    if (!/^(https?|wss?):\/\//.test(uri)) {
      debug('protocol-less url %s', uri);
      if ('undefined' != typeof loc) {
        uri = loc.protocol + '//' + uri;
      } else {
        uri = 'https://' + uri;
      }
    }

    // parse
    debug('parse %s', uri);
    obj = url.parse(uri);
  }

  // make sure we treat `localhost:80` and `localhost` equally
  if ((/(http|ws):/.test(obj.protocol) && 80 == obj.port) ||
     (/(http|ws)s:/.test(obj.protocol) && 443 == obj.port)) {
    delete obj.port;
  }

  // define unique id
  obj.id = obj.protocol + obj.hostname + (obj.port ? (':' + obj.port) : '');

  return obj;
}
