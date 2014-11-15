
/**
 * Module dependencies.
 */

var Socket = require('./socket');
var Emitter = require('events').EventEmitter;
var parser = require('socket.io-parser');
var debug = require('debug')('socket.io:namespace');
var hasBin = require('has-binary-data');

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

function Namespace(server, name, host){
  this.name = name;
  this.host = host;
  this.server = server;
  this.sockets = [];
  this.connected = {};
  this.fns = [];
  this.ids = Math.floor(Math.random() * 1e9);
  this.acks = {};
  this.initAdapter();
  this.setupDone = 0;
  this.retirement = Infinity;
  this._expirationTime = Infinity;
  this._expirationCallbacks = null;
}

/**
 * Inherits from `EventEmitter`.
 */

Namespace.prototype.__proto__ = Emitter.prototype;

/**
 * Apply flags from `Socket`.
 */

exports.flags.forEach(function(flag){
  Namespace.prototype.__defineGetter__(flag, function(){
    this.flags = this.flags || {};
    this.flags[flag] = true;
    return this;
  });
});

/**
 * Initializes the `Adapter` for this nsp.
 * Run upon changing adapter by `Server#adapter`
 * in addition to the constructor.
 *
 * @api private
 */

Namespace.prototype.initAdapter = function(){
  this.adapter = new (this.server.adapter())(this);
};

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
 * Targets a room when emitting.
 *
 * @param {String} name
 * @return {Namespace} self
 * @api public
 */

Namespace.prototype.to =
Namespace.prototype['in'] = function(name){
  this.rooms = this.rooms || [];
  if (!~this.rooms.indexOf(name)) this.rooms.push(name);
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
  this._expirationTime = Infinity;
  var socket = new Socket(this, client);
  var self = this;
  this.run(socket, function(err){
    process.nextTick(function(){
      if ('open' == client.conn.readyState) {
        if (err) return socket.error(err.data || err.message);

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
      } else {
        debug('next called after client was closed - ignoring socket');
      }
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
    if (!this.sockets.length && isFinite(this.retirement)) {
      this._expirationTime = +(new Date) + this.retirement;
      this.server.requestCleanupAfter(this.retirement);
    }
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
    // set up packet object
    var args = Array.prototype.slice.call(arguments);
    var parserType = parser.EVENT; // default
    if (hasBin(args)) { parserType = parser.BINARY_EVENT; } // binary

    var packet = { type: parserType, data: args };

    if ('function' == typeof args[args.length - 1]) {
      throw new Error('Callbacks are not supported when broadcasting');
    }

    this.adapter.broadcast(packet, {
      rooms: this.rooms,
      flags: this.flags
    });

    delete this.rooms;
    delete this.flags;
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

/**
 * Registers an expire callback.
 *
 * @api public
 */

Namespace.prototype.expire = function(callback){
  if (callback !== true) {
    if (!this._expirationCallbacks) {
      this._expirationCallbacks = [];
    }
    this._expirationCallbacks.push(callback);
  } else {
    // expire(true) is for internal use to trigger and clear expire callbacks.
    var callbacks = this._expirationCallbacks;
    if (callbacks) {
      this._expirationCallbacks = null;
      while (callbacks.length > 0) {
        callbacks.pop().apply(null, [this]);
      }
    }
  }
}

/**
 * Forms a full namespace name out of a local namespace name and a host.
 *
 * @api private
 */

Namespace.qualify = function(name, host) {
  return host == null ? name : '//' + host + name;
}

/**
 * Returns the fully qualified //host/name for this namespace.
 *
 * @api public
 */

Namespace.prototype.fullname = function() {
  return Namespace.qualify(this.name, this.host);
};

/**
 * Returns the time after which this namespace can be expired.
 *
 * @api private
 */

Namespace.prototype._expiration = function() {
  if (this.sockets.length) return Infinity;
  return this._expirationTime;
};
