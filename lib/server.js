
/**
 * Module dependencies.
 */

var qs = require('querystring');
var parse = require('url').parse;
var base64id = require('base64id');
var transports = require('./transports');
var EventEmitter = require('events').EventEmitter;
var Socket = require('./socket');
var util = require('util');
var debug = require('debug')('engine');
var cookieMod = require('cookie');

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
  if (!(this instanceof Server)) {
    return new Server(opts);
  }

  this.clients = {};
  this.clientsCount = 0;

  opts = opts || {};

  this.wsEngine = opts.wsEngine || process.env.EIO_WS_ENGINE;
  this.pingTimeout = opts.pingTimeout || 60000;
  this.pingInterval = opts.pingInterval || 25000;
  this.upgradeTimeout = opts.upgradeTimeout || 10000;
  this.maxHttpBufferSize = opts.maxHttpBufferSize || 10E7;
  this.transports = opts.transports || Object.keys(transports);
  this.allowUpgrades = false !== opts.allowUpgrades;
  this.allowRequest = opts.allowRequest;
  this.cookie = false !== opts.cookie ? (opts.cookie || 'io') : false;
  this.cookiePath = false !== opts.cookiePath ? (opts.cookiePath || '/') : false;
  this.cookieHttpOnly = false !== opts.cookieHttpOnly;
  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || true) : false;
  this.httpCompression = false !== opts.httpCompression ? (opts.httpCompression || {}) : false;

  var self = this;

  // turn off per message deflate for node 0.8
  // due to it not supporting DeflateRaw#close
  // and thus not working with ws 0.8.x
  if (/^v0\.8\./.test(process.version)) {
    debug('perMessageDeflate not supported by node 0.8');
    this.perMessageDeflate = false;
  }

  // initialize compression options
  ['perMessageDeflate', 'httpCompression'].forEach(function (type) {
    var compression = self[type];
    if (true === compression) self[type] = compression = {};
    if (compression && null == compression.threshold) {
      compression.threshold = 1024;
    }
  });

  // initialize websocket server
  if (~this.transports.indexOf('websocket')) {
    // keep require('ws') as separate expression for packers (browserify, etc)
    var WebSocketServer = (this.wsEngine ? require(this.wsEngine) : require('ws')).Server;
    this.ws = new WebSocketServer({
      noServer: true,
      clientTracking: false,
      perMessageDeflate: this.perMessageDeflate,
      maxPayload: this.maxHttpBufferSize
    });
  }
}

/**
 * Protocol errors mappings.
 */

Server.errors = {
  UNKNOWN_TRANSPORT: 0,
  UNKNOWN_SID: 1,
  BAD_HANDSHAKE_METHOD: 2,
  BAD_REQUEST: 3
};

Server.errorMessages = {
  0: 'Transport unknown',
  1: 'Session ID unknown',
  2: 'Bad handshake method',
  3: 'Bad request'
};

/**
 * Inherits from EventEmitter.
 */

util.inherits(Server, EventEmitter);

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

Server.prototype.verify = function (req, upgrade, fn) {
  // transport check
  var transport = req._query.transport;
  if (!~this.transports.indexOf(transport)) {
    debug('unknown transport "%s"', transport);
    return fn(Server.errors.UNKNOWN_TRANSPORT, false);
  }

  // sid check
  var sid = req._query.sid;
  if (sid) {
    if (!this.clients.hasOwnProperty(sid)) {
      return fn(Server.errors.UNKNOWN_SID, false);
    }
    if (!upgrade && this.clients[sid].transport.name !== transport) {
      debug('bad request: unexpected transport without upgrade');
      return fn(Server.errors.BAD_REQUEST, false);
    }
  } else {
    // handshake is GET only
    if ('GET' !== req.method) return fn(Server.errors.BAD_HANDSHAKE_METHOD, false);
    if (!this.allowRequest) return fn(null, true);
    return this.allowRequest(req, fn);
  }

  fn(null, true);
};

/**
 * Prepares a request by processing the query string.
 *
 * @api private
 */

Server.prototype.prepare = function (req) {
  // try to leverage pre-existing `req._query` (e.g: from connect)
  if (!req._query) {
    req._query = ~req.url.indexOf('?') ? qs.parse(parse(req.url).query) : {};
  }
};

/**
 * Closes all clients.
 *
 * @api public
 */

Server.prototype.close = function () {
  debug('closing all open clients');
  for (var i in this.clients) {
    if (this.clients.hasOwnProperty(i)) {
      this.clients[i].close(true);
    }
  }
  if (this.ws) {
    debug('closing webSocketServer');
    this.ws.close();
    // don't delete this.ws because it can be used again if the http server starts listening again
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

  var self = this;
  this.verify(req, false, function (err, success) {
    if (!success) {
      sendErrorMessage(req, res, err);
      return;
    }

    if (req._query.sid) {
      debug('setting new request for existing client');
      self.clients[req._query.sid].transport.onRequest(req);
    } else {
      self.handshake(req._query.transport, req);
    }
  });
};

/**
 * Sends an Engine.IO Error Message
 *
 * @param {http.ServerResponse} response
 * @param {code} error code
 * @api private
 */

function sendErrorMessage (req, res, code) {
  var headers = { 'Content-Type': 'application/json' };

  if (req.headers.origin) {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Origin'] = req.headers.origin;
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  res.writeHead(400, headers);
  res.end(JSON.stringify({
    code: code,
    message: Server.errorMessages[code]
  }));
}

/**
 * generate a socket id.
 * Overwrite this method to generate your custom socket id
 *
 * @param {Object} request object
 * @api public
 */

Server.prototype.generateId = function (req) {
  return base64id.generateId();
};

/**
 * Handshakes a new client.
 *
 * @param {String} transport name
 * @param {Object} request object
 * @api private
 */

Server.prototype.handshake = function (transportName, req) {
  var id = this.generateId(req);

  debug('handshaking client "%s"', id);

  try {
    var transport = new transports[transportName](req);
    if ('polling' === transportName) {
      transport.maxHttpBufferSize = this.maxHttpBufferSize;
      transport.httpCompression = this.httpCompression;
    } else if ('websocket' === transportName) {
      transport.perMessageDeflate = this.perMessageDeflate;
    }

    if (req._query && req._query.b64) {
      transport.supportsBinary = false;
    } else {
      transport.supportsBinary = true;
    }
  } catch (e) {
    sendErrorMessage(req, req.res, Server.errors.BAD_REQUEST);
    return;
  }
  var socket = new Socket(id, this, transport, req);
  var self = this;

  if (false !== this.cookie) {
    transport.on('headers', function (headers) {
      headers['Set-Cookie'] = cookieMod.serialize(self.cookie, id,
        {
          path: self.cookiePath,
          httpOnly: self.cookiePath ? self.cookieHttpOnly : false
        });
    });
  }

  transport.onRequest(req);

  this.clients[id] = socket;
  this.clientsCount++;

  socket.once('close', function () {
    delete self.clients[id];
    self.clientsCount--;
  });

  this.emit('connection', socket);
};

/**
 * Handles an Engine.IO HTTP Upgrade.
 *
 * @api public
 */

Server.prototype.handleUpgrade = function (req, socket, upgradeHead) {
  this.prepare(req);

  var self = this;
  this.verify(req, true, function (err, success) {
    if (err) {
      socket.end();
      return;
    }

    var head = new Buffer(upgradeHead.length);
    upgradeHead.copy(head);
    upgradeHead = null;

    // delegate to ws
    self.ws.handleUpgrade(req, socket, head, function (conn) {
      self.onWebSocket(req, conn);
    });
  });
};

/**
 * Called upon a ws.io connection.
 *
 * @param {ws.Socket} websocket
 * @api private
 */

Server.prototype.onWebSocket = function (req, socket) {
  socket.on('error', onUpgradeError);

  if (!transports[req._query.transport].prototype.handlesUpgrades) {
    debug('transport doesnt handle upgraded requests');
    socket.close();
    return;
  }

  // get client id
  var id = req._query.sid;

  // keep a reference to the ws.Socket
  req.websocket = socket;

  if (id) {
    var client = this.clients[id];
    if (!client) {
      debug('upgrade attempt for closed client');
      socket.close();
    } else if (client.upgrading) {
      debug('transport has already been trying to upgrade');
      socket.close();
    } else if (client.upgraded) {
      debug('transport had already been upgraded');
      socket.close();
    } else {
      debug('upgrading existing transport');

      // transport error handling takes over
      socket.removeListener('error', onUpgradeError);

      var transport = new transports[req._query.transport](req);
      if (req._query && req._query.b64) {
        transport.supportsBinary = false;
      } else {
        transport.supportsBinary = true;
      }
      transport.perMessageDeflate = this.perMessageDeflate;
      client.maybeUpgrade(transport);
    }
  } else {
    // transport error handling takes over
    socket.removeListener('error', onUpgradeError);

    this.handshake(req._query.transport, req);
  }

  function onUpgradeError () {
    debug('websocket error before upgrade');
    // socket.close() not needed
  }
};

/**
 * Captures upgrade requests for a http.Server.
 *
 * @param {http.Server} server
 * @param {Object} options
 * @api public
 */

Server.prototype.attach = function (server, options) {
  var self = this;
  options = options || {};
  var path = (options.path || '/engine.io').replace(/\/$/, '');

  var destroyUpgradeTimeout = options.destroyUpgradeTimeout || 1000;

  // normalize path
  path += '/';

  function check (req) {
    return path === req.url.substr(0, path.length);
  }

  // cache and clean up listeners
  var listeners = server.listeners('request').slice(0);
  server.removeAllListeners('request');
  server.on('close', self.close.bind(self));

  // add request handler
  server.on('request', function (req, res) {
    if (check(req)) {
      debug('intercepting request for path "%s"', path);
      self.handleRequest(req, res);
    } else {
      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].call(server, req, res);
      }
    }
  });

  if (~self.transports.indexOf('websocket')) {
    server.on('upgrade', function (req, socket, head) {
      if (check(req)) {
        self.handleUpgrade(req, socket, head);
      } else if (false !== options.destroyUpgrade) {
        // default node behavior is to disconnect when no handlers
        // but by adding a handler, we prevent that
        // and if no eio thing handles the upgrade
        // then the socket needs to die!
        setTimeout(function () {
          if (socket.writable && socket.bytesWritten <= 0) {
            return socket.end();
          }
        }, destroyUpgradeTimeout);
      }
    });
  }
};
