
/**
 * Module dependencies.
 */

var http = require('http')
  , send = require('send')
  , parse = require('url').parse
  , engine = require('engine.io')
  , Client = require('./client')
  , Namespace = require('./namespace')
  , Adapter = require('./adapter')
  , debug = require('debug')('socket.io:server');

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Read client
 */

var client = {
  source: require('socket.io-client').source,
  version: require('socket.io-client/package').version
};

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
  this.static(false !== opts.static);
  this.adapter(opts.adapter || Adapter);
  this.sockets = this.of('/');
  if (srv) this.attach(srv, opts);
}

/**
 * Sets/gets whether client code is being served.
 *
 * @param {Boolean} whether to serve client code
 * @return {Server|Boolean} self when setting or value when getting
 * @api public
 */

Server.prototype.static = function(v){
  if (!arguments.length) return this._static;
  this._static = v;
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
 * Sets the edaptor for rooms.
 *
 * @param {Adapter} pathname
 * @return {Server|Adapter} self when setting or value when getting
 * @api public
 */

Server.prototype.adapter = function(v){
  if (!arguments.length) return this._adapter;
  this._adapter = v;
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

Server.prototype.attach = function(srv, opts){
  if ('function' == typeof srv) {
    var msg = 'You are trying to attach socket.io to an express' +
    'request handler function. Please pass a http.Server instance.';
    throw new Error(msg);
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

  // initialize engine
  debug('creating engine.io instance with opts %j', opts);
  var eio = engine.attach(srv, opts);

  // attach static file serving
  if (this._static) this.serve(srv);

  // bind to engine events
  this.bind(eio);

  return this;
};

/**
 * Attaches the static file serving.
 *
 * @param {Function|http.Server} http server
 * @api private
 */

Server.prototype.serve = function(srv){
  debug('attaching client serving req handler');
  var url = this._path + '/socket.io.js';
  var evs = srv.listeners('request').slice(0);
  srv.removeAllListeners('request');
  srv.on('request', function(req, res) {
    if (0 == req.url.indexOf(url)) {
      var path = parse(req.url).pathname.split('/').slice(-1);
      send(req, path)
      .root(__dirname + '/../client')
      .index(false)
      .pipe(res);
    } else {
      for (var i = 0; i < evs.length; i++) {
        evs[i].call(srv, req, res);
      }
    }
  });
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
