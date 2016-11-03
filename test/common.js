
/**
 * Module dependencies.
 */

var eio = require('..');

/**
 * Listen shortcut that fires a callback on an ephemeral port.
 */

exports.listen = function (opts, fn) {
  if ('function' === typeof opts) {
    fn = opts;
    opts = {};
  }

  var e = eio.listen(undefined, opts, function () {
    fn(e.httpServer.address().port);
  });

  return e;
};

/**
 * Sprintf util.
 */

require('s').extend();
