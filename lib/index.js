
/**
 * Module dependencies.
 */

var http = require('http');
var read = require('fs').readFileSync;
var parse = require('url').parse;
var engine = require('engine.io');
var client = require('socket.io-client');
var clientVersion = require('socket.io-client/package').version;
var Client = require('./client');
var Namespace = require('./namespace');
var Adapter = require('socket.io-adapter');
var debug = require('debug')('socket.io:server');
var url = require('url');

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Socket.IO client source.
 */

var clientSource = read(require.resolve('socket.io-client/socket.io.js'), 'utf-8');

/**
 * Server constructor.
 *
 * @param {http.Server|Number|Object} http server, port or options
 * @param {Object} options
 * @api public
 */

function Server(srv, opts){
  if (!(this instanceof Server)) return new Server(srv, opts);
  if ('object' == typeof srv && !srv.listen) {
    opts = srv;
    srv = null;
  }
  opts = opts || {};
  this.nsps = {};
  this.path(opts.path || '/socket.io');
  this.serveClient(false !== opts.serveClient);
  this.adapter(opts.adapter || Adapter);
  this.origins(opts.origins || '*:*');
  this.sockets = this.of('/');
  if (srv) this.attach(srv, opts);
}

/**
 * Server request verification function, that checks for allowed origins
 *
 * @param {http.IncomingMessage} request
 * @param {Function} callback to be called with the result: `fn(err, success)`
 */

Server.prototype.checkRequest = function(req, fn) {
  var origin = req.headers.origin || req.headers.referer;

  // file:// URLs produce a null Origin which can't be authorized via echo-back
  if ('null' == origin) origin = '*';

  if (this._origins.indexOf('*:*') !== -1) return fn(null, true);
  if (origin) {
    try {
      var parts = url.parse(origin);
      parts.port = parts.port || 80;
      var ok =
        ~this._origins.indexOf(parts.hostname + ':' + parts.port) ||
        ~this._origins.indexOf(parts.hostname + ':*') ||
        ~this._origins.indexOf('*:' + parts.port);
      return fn(null, !!ok);
    } catch (ex) {
    }
  }
  fn(null, false);
};

/**
 * Sets/gets whether client code is being served.
 *
 * @param {Boolean} whether to serve client code
 * @return {Server|Boolean} self when setting or value when getting
 * @api public
 */

Server.prototype.serveClient = function(v){
  if (!arguments.length) return this._serveClient;
  this._serveClient = v;
  return this;
};

/**
 * Old settings for backwards compatibility
 */

var oldSettings = {
  "transports": "transports",
  "heartbeat timeout": "pingTimeout",
  "heartbeat interval": "pingInterval",
  "destroy buffer size": "maxHttpBufferSize"
};

/**
 * Backwards compatiblity.
 *
 * @api public
 */

Server.prototype.set = function(key, val){
  if ('authorization' == key && val) {
    this.use(function(socket, next) {
      val(socket.request, function(err, authorized) {
        if (err) return next(new Error(err));
        if (!authorized) return next(new Error('Not authorized'));
        next();
      });
    });
  } else if ('origins' == key && val) {
    this.origins(val);
  } else if ('resource' == key) {
    this.path(val);
  } else if (oldSettings[key] && this.eio[oldSettings[key]]) {
    this.eio[oldSettings[key]] = val;
  } else {
    console.error('Option %s is not valid. Please refer to the README.', key);
  }

  return this;
};

/**
 * Sets the client serving path.
 *
 * @param {String} pathname
 * @return {Server|String} self when setting or value when getting
 * @api public
 */

Server.prototype.path = function(v){
  if (!arguments.length) return this._path;
  this._path = v.replace(/\/$/, '');
  return this;
};

/**
 * Sets the adapter for rooms.
 *
 * @param {Adapter} pathname
 * @return {Server|Adapter} self when setting or value when getting
 * @api public
 */

Server.prototype.adapter = function(v){
  if (!arguments.length) return this._adapter;
  this._adapter = v;
  for (var i in this.nsps) {
    if (this.nsps.hasOwnProperty(i)) {
      this.nsps[i].initAdapter();
    }
  }
  return this;
};

/**
 * Sets the allowed origins for requests.
 *
 * @param {String} origins
 * @return {Server|Adapter} self when setting or value when getting
 * @api public
 */

Server.prototype.origins = function(v){
  if (!arguments.length) return this._origins;

  this._origins = v;
  return this;
};

/**
 * Attaches socket.io to a server or port.
 *
 * @param {http.Server|Number} server or port
 * @param {Object} options passed to engine.io
 * @return {Server} self
 * @api public
 */

Server.prototype.listen =
Server.prototype.attach = function(srv, opts){
  if ('function' == typeof srv) {
    var msg = 'You are trying to attach socket.io to an express' +
    'request handler function. Please pass a http.Server instance.';
    throw new Error(msg);
  }

  // handle a port as a string
  if (Number(srv) == srv) {
    srv = Number(srv);
  }

  if ('number' == typeof srv) {
    debug('creating http server and binding to %d', srv);
    var port = srv;
    srv = http.Server(function(req, res){
      res.writeHead(404);
      res.end();
    });
    srv.listen(port);
  }

  // set engine.io path to `/socket.io`
  opts = opts || {};
  opts.path = opts.path || '/socket.io';
  // set origins verification
  opts.allowRequest = this.checkRequest.bind(this);

  // initialize engine
  debug('creating engine.io instance with opts %j', opts);
  this.eio = engine.attach(srv, opts);

  // attach static file serving
  if (this._serveClient) this.attachServe(srv);

  // bind to engine events
  this.bind(this.eio);

  return this;
};

/**
 * Attaches the static file serving.
 *
 * @param {Function|http.Server} http server
 * @api private
 */

Server.prototype.attachServe = function(srv){
  debug('attaching client serving req handler');
  var url = this._path + '/socket.io.js';
  var evs = srv.listeners('request').slice(0);
  var self = this;
  srv.removeAllListeners('request');
  srv.on('request', function(req, res) {
    if (0 == req.url.indexOf(url)) {
      self.serve(req, res);
    } else {
      for (var i = 0; i < evs.length; i++) {
        evs[i].call(srv, req, res);
      }
    }
  });
};

/**
 * Handles a request serving `/socket.io.js`
 *
 * @param {http.Request} req
 * @param {http.Response} res
 * @api private
 */

Server.prototype.serve = function(req, res){
  if (req.headers.etag) {
    if (clientVersion == req.headers.etag) {
      debug('serve client 304');
      res.writeHead(304);
      res.end();
      return;
    }
  }

  debug('serve client source');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('ETag', clientVersion);
  res.writeHead(200);
  res.end(clientSource);
};

/**
 * Binds socket.io to an engine.io instance.
 *
 * @param {engine.Server} engine.io (or compatible) server
 * @return {Server} self
 * @api public
 */

Server.prototype.bind = function(engine){
  this.engine = engine;
  this.engine.on('connection', this.onconnection.bind(this));
  return this;
};

/**
 * Called with each incoming transport connection.
 *
 * @param {engine.Socket} socket
 * @return {Server} self
 * @api public
 */

Server.prototype.onconnection = function(conn){
  debug('incoming connection with id %s', conn.id);
  var client = new Client(this, conn);
  client.connect('/');
  return this;
};

/**
 * Looks up a namespace.
 *
 * @param {String} nsp name
 * @param {Function} optional, nsp `connection` ev handler
 * @api public
 */

Server.prototype.of = function(name, fn){
  if (!this.nsps[name]) {
    debug('initializing namespace %s', name);
    var nsp = new Namespace(this, name);
    this.nsps[name] = nsp;
  }
  if (fn) this.nsps[name].on('connect', fn);
  return this.nsps[name];
};

/**
 * Expose main namespace (/).
 */

['on', 'to', 'in', 'use', 'emit', 'send', 'write'].forEach(function(fn){
  Server.prototype[fn] = function(){
    var nsp = this.sockets[fn];
    return nsp.apply(this.sockets, arguments);
  };
});

Namespace.flags.forEach(function(flag){
  Server.prototype.__defineGetter__(flag, function(name){
    this.flags.push(name);
    return this;
  });
});

/**
 * BC with `io.listen`
 */

Server.listen = Server;
