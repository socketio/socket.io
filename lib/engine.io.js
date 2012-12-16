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
 * Expose mutable list of available trnasports.
 *
 * @api public
 */

exports.transports = require('./transports');

/**
 * Exports parser.
 *
 * @api public
 */

exports.parser = require('./parser');

/**
 * Crates an http.Server exclusively used for WS upgrades.
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
  var resource = options.resource || 'default';

  // normalize path
  path += '/' + resource + '/';

  function check (req) {
    return path == req.url.substr(0, path.length);
  }

  // cache and clean up listeners
  var listeners = server.listeners('request');
  var oldListeners = [];

  // copy the references onto a new array for node >=0.7
  for (var i = 0, l = listeners.length; i < l; i++) {
    oldListeners[i] = listeners[i];
  }

  server.removeAllListeners('request');

  server.on('close', function () {
    engine.close();
  });

  // add request handler
  server.on('request', function (req, res) {
    if (check(req)) {
      debug('intercepting request for path "%s"', path);
      engine.handleRequest(req, res);
    } else {
      for (var i = 0, l = oldListeners.length; i < l; i++) {
        oldListeners[i].call(server, req, res);
      }
    }
  });

  if(~engine.transports.indexOf('websocket')) {
    server.on('upgrade', function (req, socket, head) {
      if (check(req)) {
        engine.handleUpgrade(req, socket, head);
      } else if (false !== options.destroyUpgrade) {
        socket.end();
      }
    });
  }

  // flash policy file
  var trns = engine.transports;
  var policy = options.policyFile;
  if (~trns.indexOf('flashsocket') && false !== policy) {
    server.on('connection', function (socket) {
      engine.handleSocket(socket);
    });
  }

  return engine;
};

/**
 * Invoking the library as a function delegates to attach
 *
 * @param {http.Server} server
 * @param {Object} options
 * @return {Server} engine server
 * @api public
 */

module.exports = function() {
  return exports.attach.apply(this, arguments);
};

module.exports.__proto__ = exports;
