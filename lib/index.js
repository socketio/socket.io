
/**
 * Module dependencies.
 */

var http = require('http')
  , send = require('send')
  , parse = require('url').parse
  , engine = require('engine.io')
  , Client = require('./client')
  , Namespace = require('./namespace')
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
  this.sockets = this.of('/');
  this.path(opts.path || '/socket.io');
  this.static(false !== opts.static);
  if (srv) this.attach(srv, opts);
}

/**
 * Serve client code.
 *
 * @param {Boolean} whether to serve client code
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
 * @api public
 */

Server.prototype.path = function(v){
  if (!arguments.length) return this._path;
  this._path = v.replace(/\/$/, '');
  return this;
};

/**
 * Attaches socket.io to a server or port.
 *
 * @param {http.Server|Number} server or port
 * @param {Object} options
 * @api public
 */

Server.prototype.attach = function(srv, opts){
  if ('number' == typeof srv) {
    debug('creating engine.io on port %d', srv);
    srv = engine.listen(srv, opts);
  } else {
    debug('creating engine.io instance', opts);
    if (this._static) this.serve(srv);
    srv = engine.attach(srv, opts);
  }
  this.bind(srv);
};

/**
 * Attaches the static file serving.
 *
 * @param {Function|http.Server} http server
 * @api private
 */

Server.prototype.serve = function(srv){
  var url = this._path + '/';
  var self = this;

  function handle(req, res){
    send(req, parse(req.url).pathname.substr(url.length - 1))
    .root(__dirname + '/../client')
    .index(false)
    .pipe(res);
  }

  if (srv.use) {
    debug('attaching client serving middleware');
    srv.use(function(req, res, next){
      if (0 == req.url.indexOf(url)) {
        handle(req, res);
      } else {
        next();
      }
    });
  } else {
    debug('attaching client serving req handler');
    var evs = srv.listeners('request').slice(0);
    srv.removeAllListeners('request');
    srv.on('request', function(req, res) {
      if (0 == req.url.indexOf(url)) {
        handle(req, res);
      } else {
        for (var i = 0; i < evs.length; i++) {
          evs[i].call(srv, req.res);
        }
      }
    });
  }
};

/**
 * Binds socket.io to an engine.io instance.
 *
 * @param {engine.Server} engine.io (or compatible) server
 * @api public
 */

Server.prototype.bind = function(engine){
  this.engine = engine;
  this.engine.on('connection', this.onconnection.bind(this));
};

/**
 * Called with each incoming transport connection.
 *
 * @api public
 */

Server.prototype.onconnection = function(conn){
  debug('incoming connection with id %s', conn.id);
  var client = new Client(this, conn);
  client.connect('/');
  this.emit('client', client);
};

/**
 * Looks up a namespace.
 *
 * @param {String} nsp name
 * @api public
 */

Server.prototype.of = function(name){
  if (!this.nsps[name]) {
    debug('initializing namespace %s', name);
    var nsp = new Namespace(this, name);
    this.nsps[name] = nsp;
  }
  return this.nsps[name];
};

/**
 * Expose main namespace (/).
 */

['use', 'to', 'in', 'emit', 'send', 'write'].forEach(function(name){
  Server.prototype[name] = function(){
    var nsp = this.sockets[name];
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
