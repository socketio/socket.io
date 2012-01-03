
/**
 * Module dependencies.
 */

var ws = require('websocket.io')
  , qs = require('querystring')
  , parse = require('url').parse
  , readFileSync = require('fs').readFileSync
  , transports = require('./transports')
  , debug = require('debug')('engine')
  , EventEmitter = require('events').EventEmitter
  , Socket = require('./socket')

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Server constructor.
 *
 * @param {Object} options
 * @api public
 */

function Server (opts) {
  this.clients = {};
  this.clientsCount = 0;

  opts = opts || {};
  this.pingTimeout = opts.pingTimeout || 10000;
  this.pingInterval = opts.pingInterval || 30000;
  this.transports = opts.transports || Object.keys(transports);
  this.allowUpgrades = false !== opts.allowUpgrades;

  // initialize websocket server
  if (~this.transports.indexOf('websocket')) {
    this.ws = new ws.Server;
    this.ws.on('connection', this.onWebSocket.bind(this));
  }
};

/**
 * Inherits from EventEmitter.
 */

Server.prototype.__proto__ = EventEmitter.prototype;

/**
 * Hash of open clients.
 *
 * @api public
 */

Server.prototype.clients;

/**
 * Returns a list of available transports for upgrade given a certain transport.
 *
 * @return {Array}
 * @api public
 */

Server.prototype.upgrades = function (transport) {
  if (!this.allowUpgrades) return [];
  return transports[transport].upgradesTo || [];
};

/**
 * Verifies a request.
 *
 * @param {http.ServerRequest}
 * @return {Boolean} whether the request is valid
 * @api private
 */

Server.prototype.verify = function (req) {
  // transport check
  var transport = req.query.transport;
  if (!~this.transports.indexOf(transport)) {
    debug('unknown transport "%s"', transport);
    return false;
  }

  // sid check
  if (req.query.sid) {
    return this.clients.hasOwnProperty(req.query.sid);
  }

  return true;
};

/**
 * Prepares a request by processing the query string.
 * 
 * @api private
 */

Server.prototype.prepare = function (req) {
  // try to leverage pre-existing `req.query` (e.g: from connect)
  if (!req.query) {
    req.query = ~req.url.indexOf('?')
      ? qs.parse(parse(req.url).query)
      : {};
  }
};

/**
 * Generates an id.
 *
 * @api private
 */

Server.prototype.id = function () {
  return Math.random() * Math.random();
};

/**
 * Handles an Engine.IO HTTP request.
 *
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse|http.OutgoingMessage} response
 * @api public
 */

Server.prototype.handleRequest = function (req, res) {
  this.prepare(req);
  req.res = res;

  if (!this.verify(req)) {
    res.writeHead(500);
    res.end();
    return;
  }

  if (req.query.sid) {
    this.clients[req.query.sid].transport().onRequest(req);
  } else {
    this.handshake(req);
  }
};

/**
 * Handshakes a new client.
 *
 * @api private
 */

Server.prototype.handshake = function (req) {
  // generate sid
  var id = this.id()
    , socket = new Socket(id, this, new transports[req.query.transport](req))
    , self = this

  socket.once('open', function () {
    // debug: handshake completed for client %d, id
    self.clients[id] = socket;
    self.emit('connection', socket);
  });
};

/**
 * Handles an Engine.IO HTTP Upgrade.
 *
 * @api public
 */

Server.prototype.handleUpgrade = function (req, socket, head) {
  this.prepare(req);

  if (!this.verify(req)) {
    socket.end();
    return;
  }

  // delegate to websocket.io
  this.ws.handleUpgrade(req, socket, head);
};

/**
 * Called upon a ws.io connection.
 *
 * @param {wsio.Socket} websocket
 * @api private
 */

Server.prototype.onWebSocket = function (socket) {
  var req = socket.req
    , id = req.query.sid

  // debug: upgrading existing client to websocket
  if (this.clients[id].upgraded) {
    // debug: transport had already been upgraded
    socket.close();
  } else {
    this.clients[id].upgrade(new transports[req.query.transport](socket));
  }
};

/**
 * Handles a regular connection. Required that we parse the first few bytes
 * of each stream for flashsocket policy requests.
 */

var policy = readFileSync(__dirname + '/transports/flashsocket.xml');

Server.prototype.handleSocket = function (socket) {
  var chunks = ''
    , buffer = false

  socket.on('data', function onData (data) {
    if (!buffer && 60 == data[0]) {
      buffer = true;
    } else {
      socket.removeListener('data', onData);
      return;
    }

    if (chunks.length < 23) {
      chunks += data.toString('ascii');
    }

    if (chunks.length >= 23) {
      if ('<policy-file-request/>\0' == chunks.substr(0, 23)) {
        socket.end(policy);
      } else {
        chunks = null;
        socket.removeListener('data', onData);
      }
    }
  });
};
