
/**
 * Engine version.
 *
 * @api public
 */

exports.version = '0.1.0';

/**
 * Expose Server constructor.
 */

exports.Server = require('./server');

/**
 * Expose Server constructor.
 */

exports.Socket = require('./socket');

/**
 * Logger constructor.
 *
 * @api public
 */

exports.Logger = require('./logger');

/**
 * Crates an http.Server exclusively used for WS upgrades.
 *
 * @param {Number} port
 * @param {Function} callback
 * @param {Object} options
 * @return {Server} websocket.io server
 * @api public
 */

exports.listen = function (port, fn, options) {
  if ('object' == typeof fn) {
    options = fn;
    fn = null;
  }

  var server = http.createServer(function (req, res) {
    res.writeHead(501);
    res.end('Not Implemented');
  });

  server.listen(port, fn);

  // create engine server
  var engine = exports.attach(server, options);
  engine.httpServer = server;

  return engine;
};

/**
 * Captures upgrade requests for a http.Server.
 *
 * @param {http.Server} server
 * @param {Object} options
 * @return {Server} engine server
 * @api public
 */

exports.attach = function (server, options) {
  var engine = new exports.Server(options)
    , path = options.path || '/engine.io'
    , destroyUpgrade = false !== options.destroyUpgrade

  function check (req) {
    return req.url.substr(0, path.length) == path);
  }

  // cache and clean up listeners
  var oldListeners = server.listeners('request');
  server.removeAllListeners('request');

  // add request handler
  server.on('request', function (req, socket, head) {
    if (check(req)) {
      engine.handleRequest(req, socket, head);
    } else {
      for (var i = 0, l = this.oldListeners.length; i < l; i++) {
        this.oldListeners[i].call(this.server, req, res);
      }
    }
  });

  // add upgrade handler
  server.on('upgrade', function (req, socket, head) {
    if (check(req)) {
      engine.handleUpgrade(req, socket, head);
    } else if (destroyUpgrade) {
      socket.end();
    }
  });

  return engine;
};
