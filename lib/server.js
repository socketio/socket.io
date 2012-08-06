
/**
 * Module dependencies.
 */

var qs = require('querystring')
  , parse = require('url').parse
  , readFileSync = require('fs').readFileSync
  , crypto = require('crypto')
  , transports = require('./transports')
  , EventEmitter = require('events').EventEmitter
  , Socket = require('./socket')
  , WebSocketServer = require('ws').Server
  , debug = require('debug')('engine')

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
  this.pingTimeout = opts.pingTimeout || 60000;
  this.pingInterval = opts.pingInterval || 25000;
  this.upgradeTimeout = opts.upgradeTimeout || 10000;
  this.transports = opts.transports || Object.keys(transports);
  this.allowUpgrades = false !== opts.allowUpgrades;
  this.cookie = false !== opts.cookie ? (opts.cookie || 'io') : false;

  // initialize websocket server
  if (~this.transports.indexOf('websocket')) {
    this.ws = new WebSocketServer({ noServer: true, clientTracking: false });
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
  } else {
    // handshake is GET only
    return 'GET' == req.method;
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
  var rand = new Buffer(15);
  this.sequenceNumber = (this.sequenceNumber + 1) | 0;
  rand.writeInt32BE(this.sequenceNumber, 11);
  crypto.randomBytes(12).copy(rand);
  var id = rand.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
  if (this.clients[id]) return this.id();
  return id;
};

/**
 * Closes all clients.
 *
 * @api public
 */

Server.prototype.close = function () {
  debug('closing all open clients');
  for (var i in this.clients) {
    this.clients[i].close();
  }
  return this;
};

/**
 * Handles an Engine.IO HTTP request.
 *
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse|http.OutgoingMessage} response
 * @api public
 */

Server.prototype.handleRequest = function (req, res) {
  debug('handling "%s" http request "%s"', req.method, req.url);
  this.prepare(req);
  req.res = res;

  if (!this.verify(req)) {
    res.writeHead(500);
    res.end();
    return this;
  }

  if (req.query.sid) {
    debug('setting new request for existing client');
    this.clients[req.query.sid].transport.onRequest(req);
  } else {
    this.handshake(req.query.transport, req);
  }

  return this;
};

/**
 * Handshakes a new client.
 *
 * @param {String} transport name
 * @param {Object} request object
 * @api private
 */

Server.prototype.handshake = function (transport, req) {
  var id = this.id();

  debug('handshaking client "%d"', id);

  var transport = new transports[transport](req)
    , socket = new Socket(id, this, transport)
    , self = this

  if (false !== this.cookie) {
    transport.on('headers', function (headers) {
      headers['Set-Cookie'] = self.cookie + '=' + id;
    });
  }

  transport.onRequest(req);

  this.clients[id] = socket;
  this.clientsCount++;
  this.emit('connection', socket);

  socket.once('close', function () {
    delete self.clients[id];
    self.clientsCount--;
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

  // delegate to ws
  var self = this;
  this.ws.handleUpgrade(req, socket, head, function(conn){
    self.onWebSocket(req, conn);
  });
};

/**
 * Called upon a ws.io connection.
 *
 * @param {wsio.Socket} websocket
 * @api private
 */

Server.prototype.onWebSocket = function (req, socket) {
  var id = req.query.sid;

  if (id) {
    if (!this.clients[id]) {
      debug('upgrade attempt for closed client');
      socket.close();
    } else if (this.clients[id].upgraded) {
      debug('transport had already been upgraded');
      socket.close();
    } else {
      debug('upgrading existing transport');
      var transport = new transports[req.query.transport](socket);
      this.clients[id].maybeUpgrade(transport);
    }
  } else {
    this.handshake(req.query.transport, socket);
  }

};

/**
 * Handles a regular connection to watch for flash policy requests.
 *
 * @param {net.Stream} socket
 * @api private
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
