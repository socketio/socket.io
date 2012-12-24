
/**
 * Module dependencies.
 */

var Socket = require('./socket')
  , Emitter = require('events').EventEmitter
  , parser = require('socket.io-parser')
  , debug = require('debug')('socket.io:namespace');

/**
 * Module exports.
 */

module.exports = exports = Namespace;

/**
 * Blacklisted events.
 */

exports.events = [
  'connect',    // for symmetry with client
  'connection',
  'newListener'
];

/**
 * Flags.
 */

exports.flags = ['json'];

/**
 * `EventEmitter#emit` reference.
 */

var emit = Emitter.prototype.emit;

/**
 * Namespace constructor.
 *
 * @param {Server} server instance
 * @param {Socket} name
 * @api private
 */

function Namespace(server, name){
  this.name = name;
  this.server = server;
  this.adapter = new (server.adapter())(this);
  this.sockets = [];
  this.connected = {};
  this.fns = [];
  this.ids = 0;
  this.acks = {};
}

/**
 * Inherits from `EventEmitter`.
 */

Namespace.prototype.__proto__ = Emitter.prototype;

/**
 * Apply flags from `Socket`.
 */

exports.flags.forEach(function(flag){
  Namespace.prototype.__defineGetter__(flag, function(name){
    this.flags.push(name);
    return this;
  });
});

/**
 * Sets up namespace middleware.
 *
 * @return {Namespace} self
 * @api public
 */

Namespace.prototype.use = function(fn){
  this.fns.push(fn);
  return this;
};

/**
 * Executes the middleware for an incoming client.
 *
 * @param {Socket} socket that will get added
 * @param {Function} last fn call in the middleware
 * @api private
 */

Namespace.prototype.run = function(socket, fn){
  var fns = this.fns.slice(0);
  if (!fns.length) return fn(null);

  function run(i){
    fns[i](socket, function(err){
      // upon error, short-circuit
      if (err) return fn(err);

      // if no middleware left, summon callback
      if (!fns[i + 1]) return fn(null);

      // go on to next
      run(i + 1);
    });
  }

  run(0);
};

/**
 * Targets a room.
 *
 * @api private
 */

Namespace.prototype.to =
Namespace.prototype.in = function(fn){
  this.rooms.push(fn);
  return this;
};

/**
 * Adds a new client.
 *
 * @return {Socket}
 * @api private
 */

Namespace.prototype.add = function(client, fn){
  debug('adding socket to nsp %s', this.name);
  var socket = new Socket(this, client);
  var self = this;
  this.run(socket, function(err){
    process.nextTick(function(){
      if (err) return socket.err(err.data || err.message);

      // track socket
      self.sockets.push(socket);

      // it's paramount that the internal `onconnect` logic
      // fires before user-set events to prevent state order
      // violations (such as a disconnection before the connection
      // logic is complete)
      socket.onconnect();
      if (fn) fn();

      // fire user-set events
      self.emit('connect', socket);
      self.emit('connection', socket);
    });
  });
  return socket;
};

/**
 * Removes a client. Called by each `Socket`.
 *
 * @api private
 */

Namespace.prototype.remove = function(socket){
  var i = this.sockets.indexOf(socket);
  if (~i) {
    this.sockets.splice(i, 1);
  } else {
    debug('ignoring remove for %s', socket.id);
  }
};

/**
 * Emits to all clients.
 *
 * @return {Namespace} self
 * @api public
 */

Namespace.prototype.emit = function(ev){
  if (~exports.events.indexOf(ev)) {
    emit.apply(this, arguments);
  } else {
    for (var i = 0; i < this.sockets.length; i++) {
      var socket = this.sockets[i];
      this.rooms.forEach(function(room){
        socket.to(room);
      });
      this.flags.forEach(function(flag){
        socket = socket[flag];
      });
      socket.emit.apply(socket, arguments);
    }
    if (this.flags.length) this.flags = [];
    if (this.rooms.lenth) this.rooms = [];
  }
  return this;
};

/**
 * Sends a `message` event to all clients.
 *
 * @return {Namespace} self
 * @api public
 */

Namespace.prototype.send =
Namespace.prototype.write = function(){
  var args = Array.prototype.slice.call(arguments);
  args.unshift('message');
  this.emit.apply(this, args);
  return this;
};
