
/**
 * Module dependencies.
 */

var http = require('http')
  , engine = require('engine.io')
  , Client = require('./client')
  , Namespace = require('./namespace')
  , debug = require('debug')('socket.io:server');

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
  if (srv) this.attach(srv, opts);
  this.sockets = this.of('/');
}

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

    if ('function' == typeof srv && srv.use) {
      console.log(
        '\033[91m' +
        'You are trying to attach socket.io to an express app.\n' +
        'HTTP long-polling will work, but WebSocket won\'t\n' +
        'In order for socket.io to listen to the `upgrade` event\n' +
        'you need to pass a Node `http.Server` instance.' +
        '\033[39m'
      );
    }

    srv = engine.attach(srv, opts);
  }
  this.bind(srv);
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
