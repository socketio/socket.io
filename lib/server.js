
/**
 * Module dependencies.
 */

var qs = require('querystring')
  , parse = require('url').parse
  , readFileSync = require('fs').readFileSync
  , crypto = require('crypto')
  , base64id = require('base64id')
  , transports = require('./transports')
  , EventEmitter = require('events').EventEmitter
  , Socket = require('./socket')
  , WebSocketServer = require('ws').Server
  , debug = require('debug')('engine');

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

function Server(opts){
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

Server.prototype.upgrades = function(transport){
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

Server.prototype.verify = function(req){
  // transport check
  var transport = req.query.transport;
  if (!~this.transports.indexOf(transport)) {
    debug('unknown transport "%s"', transport);
    return Server.errors.UNKNOWN_TRANSPORT;
  }

  // sid check
  if (req.query.sid) {
    return this.clients.hasOwnProperty(req.query.sid) ||
           Server.errors.UNKNOWN_SID;
  } else {
    // handshake is GET only
    return 'GET' == req.method ||
           Server.errors.BAD_HANDSHAKE_METHOD;
  }

  return true;
};

/**
 * Prepares a request by processing the query string.
 *
 * @api private
 */

Server.prototype.prepare = function(req){
  // try to leverage pre-existing `req.query` (e.g: from connect)
  if (!req.query) {
    req.query = ~req.url.indexOf('?') ? qs.parse(parse(req.url).query) : {};
  }
};

/**
 * Closes all clients.
 *
 * @api public
 */

Server.prototype.close = function(){
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

Server.prototype.handleRequest = function(req, res){
  debug('handling "%s" http request "%s"', req.method, req.url);
  this.prepare(req);
  req.res = res;

  var code = this.verify(req);
  if (code !== true) {
    sendErrorMessage(res, code);
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
 * Sends an Engine.IO Error Message
 *
 * @param {http.ServerResponse} response
 * @param {code} error code
 * @api private
 */

 function sendErrorMessage(res, code) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: code,
      message: Server.errorMessages[code]
    }));
 }

/**
 * Handshakes a new client.
 *
 * @param {String} transport name
 * @param {Object} request object
 * @api private
 */

Server.prototype.handshake = function(transport, req){
  var id = base64id.generateId();

  debug('handshaking client "%s"', id);

  try {
    var transport = new transports[transport](req);
  }
  catch (e) {
    sendErrorMessage(req.res, Server.errors.BAD_REQUEST);
    return;
  }
  var socket = new Socket(id, this, transport);
  var self = this;

  if (false !== this.cookie) {
    transport.on('headers', function(headers){
      headers['Set-Cookie'] = self.cookie + '=' + id;
    });
  }

  transport.onRequest(req);

  this.clients[id] = socket;
  this.clientsCount++;
  this.emit('connection', socket);

  socket.once('close', function(){
    delete self.clients[id];
    self.clientsCount--;
  });
};

/**
 * Handles an Engine.IO HTTP Upgrade.
 *
 * @api public
 */

Server.prototype.handleUpgrade = function(req, socket, head){
  this.prepare(req);

  if (this.verify(req) !== true) {
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
 * @param {ws.Socket} websocket
 * @api private
 */

Server.prototype.onWebSocket = function(req, socket){
  if (!transports[req.query.transport].prototype.handlesUpgrades) {
    debug('transport doesnt handle upgraded requests');
    socket.close();
    return;
  }

  // get client id
  var id = req.query.sid;

  // keep a reference to the ws.Socket
  req.websocket = socket;

  if (id) {
    if (!this.clients[id]) {
      debug('upgrade attempt for closed client');
      socket.close();
    } else if (this.clients[id].upgraded) {
      debug('transport had already been upgraded');
      socket.close();
    } else {
      debug('upgrading existing transport');
      var transport = new transports[req.query.transport](req);
      this.clients[id].maybeUpgrade(transport);
    }
  } else {
    this.handshake(req.query.transport, req);
  }
};

/**
 * Handles a regular connection to watch for flash policy requests.
 *
 * @param {net.Stream} socket
 * @api private
 */

var policy = readFileSync(__dirname + '/transports/flashsocket.xml');

Server.prototype.handleSocket = function(socket){
  socket.on('data', function onData(data){
    // no need for buffering as node will discard subsequent packets
    // since they constitute a malformed HTTP request
    if (60 == data[0] && 23 == data.length) {
      var str = data.slice(0, 23).toString();
      if ('<policy-file-request/>\0' == str) {
        socket.end(policy);
      }
    }
    socket.removeListener('data', onData);
  });
};
