
/**
 * Module dependencies.
 */

var url = require('./url')
  , parser = require('socket.io-parser')
  , Manager = require('./manager');

/**
 * Module exports.
 */

module.exports = exports = lookup;

/**
 * Managers cache.
 */

var cache = exports.managers = {};

/**
 * Looks up an existing `Manager` for multiplexing.
 * If the user summons:
 *
 *   `io('http://localhost/a');`
 *   `io('http://localhost/b');`
 *
 * We reuse the existing instance based on same scheme/port/host,
 * and we initialize sockets for each namespace.
 *
 * @api public
 */

function lookup(uri, opts){
  opts = opts || {};

  var parsed = url(uri);
  var href = parsed.href;
  var io;

  if (opts.forceNew || false === opts.multiplex) {
    io = Manager(href, opts);
  } else {
    var id = parsed.id;
    if (!cache[id]) cache[id] = Manager(href, opts);
    io = cache[id];
  }

  return io.socket(parsed.pathname || '/');
}

/**
 * Expose standalone client source.
 *
 * @api public
 */

if ('undefined' != typeof process) {
  var read = require('fs').readFileSync;
  exports.source = read(__dirname + '/../socket.io-client.js');
}

/**
 * Protocol version.
 *
 * @api public
 */

exports.protocol = parser.protocol;

/**
 * `connect`.
 *
 * @param {String} uri
 * @api public
 */

exports.connect = lookup;

/**
 * Expose constructors for standalone build.
 *
 * @api public
 */

exports.Manager = require('./manager');
exports.Socket = require('./socket');
exports.Emitter = require('./emitter');
