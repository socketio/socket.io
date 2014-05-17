/**
 * Module dependencies.
 */

var http = require('http')
  , debug = require('debug')('engine:core');

/**
 * Protocol revision number.
 *
 * @api public
 */

exports.protocol = 1;

/**
 * Expose Server constructor.
 *
 * @api public
 */

exports.Server = require('./server');

/**
 * Expose Server constructor.
 *
 * @api public
 */

exports.Socket = require('./socket');

/**
 * Expose Transport constructor.
 *
 * @api public
 */

exports.Transport = require('./transport');

/**
 * Expose mutable list of available transports.
 *
 * @api public
 */

exports.transports = require('./transports');

/**
 * Exports parser.
 *
 * @api public
 */

exports.parser = require('engine.io-parser');

/**
 * Creates an http.Server exclusively used for WS upgrades.
 *
 * @param {Number} port
 * @param {Function} callback
 * @param {Object} options
 * @return {Server} websocket.io server
 * @api public
 */

exports.listen = function (port, options, fn) {
  if ('function' == typeof options) {
    fn = options;
    options = {};
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
  var engine = new exports.Server(options);
  var options = options || {};
  var path = (options.path || '/engine.io').replace(/\/$/, '');

  var destroyUpgrade = (options.destroyUpgrade !== undefined) ? options.destroyUpgrade : true;
  var destroyUpgradeTimeout = options.destroyUpgradeTimeout || 1000;

  // normalize path
  path += '/';

  function check (req) {
    return path == req.url.substr(0, path.length);
  }

  // cache and clean up listeners
  var listeners = server.listeners('request').slice(0);
  server.removeAllListeners('request');
  server.on('close', engine.close.bind(engine));

  // add request handler
  server.on('request', function(req, res){
    if (check(req)) {
      debug('intercepting request for path "%s"', path);
      engine.handleRequest(req, res);
    } else {
      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].call(server, req, res);
      }
    }
  });

  if(~engine.transports.indexOf('websocket')) {
    server.on('upgrade', function (req, socket, head) {
      if (check(req)) {
        engine.handleUpgrade(req, socket, head);
      } else if (false !== options.destroyUpgrade) {
        // default node behavior is to disconnect when no handlers
        // but by adding a handler, we prevent that
        // and if no eio thing handles the upgrade
        // then the socket needs to die!
        setTimeout(function() {
           if (socket.writable && socket.bytesWritten <= 0) {
             return socket.end();
           }
        }, options.destroyUpgradeTimeout);
      }
    });
  }

  return engine;
};
