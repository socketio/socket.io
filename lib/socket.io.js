
/**
 * Module dependencies.
 */

var engine = require('engine.io')
  , Server = require('http').Server

/**
 * Module exports.
 */

module.exports = exports = create;

/**
 * Creates a Socket.IO server.
 *
 * @api public
 */

function create (arg, options, fn) {
  if ('number' == typeof arg) {
    return exports.listen(arg, options, fn);
  } else {
    return exports.attach(arg, options, fn);
  }
};

/**
 * Version
 *
 * @api public
 */

exports.version = '1.0.0-alpha1';

/**
 * Server constructor.
 *
 * @api private
 */

exports.Server = Server;

/**
 * Listen shortcut.
 *
 * @api public
 */

exports.create = create;

/**
 * Makes socket.io listen on a port.
 *
 * @param {Number} port
 * @param {Object|Function} (optional) options or callback
 * @param {Function} (optional) callback
 * @return {Server} io
 * @api public
 */

exports.listen = function (port, fn, options) {
  // legacy
  if (port instanceof Server) return attach(port, fn, opts);

  if ('object' == typeof fn) {
    options = fn;
    fn = null;
  }

  var server = http.createServer(function (req, res) {
    res.writeHead(501);
    res.end('Not Implemented');
  });

  server.listen(port, fn);

  // create socket.io server
  var io = exports.attach(server, options);

  // keep ref to http server
  io.httpServer = server;

  return io;
};

/**
 * Attaches socket.io to a http server.
 *
 * @param {http.Server} server
 * @param {Object} (optional) options
 * @return {Server} io server
 * @api public
 */

exports.attach = function (server, options) {
  var opts = options || {}
    , engineOpts = opts.engine || {}

  // use default socket.io base path
  engineOpts.path = engineOpts.path || '/socket.io';

  // spawn engine server
  var server = engine.attach(server, engineOpts);

  // spawn socket.io
  var io = new exports.Server(options);

  // capture connections
  server.on('connection', function (conn) {
    io.onConnection(conn);
  });

  return io;
};
