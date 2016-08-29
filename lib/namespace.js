'use strict';

/**
 * Module dependencies.
 */

var Socket = require('./socket');
var Emitter = require('events').EventEmitter;
var parser = require('socket.io-parser');
var debug = require('debug')('socket.io:namespace');
var hasBin = require('has-binary');

/**
 * Blacklisted events.
 */

var exportsEvents = [
  'connect',    // for symmetry with client
  'connection',
  'newListener'
];

/**
 * Flags.
 */

var exportsFlags = [
  'json', 
  'volatile'
];

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

class Namespace extends Emitter {
  constructor(server, name){
    super();  
    this.name = name;
    this.server = server;
    this.sockets = {};
    this.connected = {};
    this.fns = [];
    this.ids = 0;
    this.initAdapter();
  }	
  
  static flags() {
    return exportsFlags;
  }  

  /**
   * Initializes the `Adapter` for this nsp.
   * Run upon changing adapter by `Server#adapter`
   * in addition to the constructor.
   *
   * @api private
   */

  initAdapter(){
    this.adapter = new (this.server.adapter())(this);
  };

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   * @api public
   */

  use(fn){
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming client.
   *
   * @param {Socket} socket that will get added
   * @param {Function} fn last fn call in the middleware
   * @api private
   */

  run(socket, fn){
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
  }

  /**
   * Targets a room when emitting.
   *
   * @param {String} name
   * @return {Namespace} self
   * @api public
   */

  in(name){
    this.rooms = this.rooms || [];
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
    return this;
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @api private
   */

  add(client, query, fn){
    debug('adding socket to nsp %s', this.name);
    var socket = new Socket(this, client, query);
    var self = this;
    this.run(socket, function(err){
      process.nextTick(function(){
        if ('open' == client.conn.readyState) {
          if (err) return socket.error(err.data || err.message);

          // track socket
          self.sockets[socket.id] = socket;

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
  }

  /**
   * Removes a client. Called by each `Socket`.
   *
   * @api private
   */

  remove(socket){
    if (this.sockets.hasOwnProperty(socket.id)) {
      delete this.sockets[socket.id];
    } else {
      debug('ignoring remove for %s', socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return {Namespace} self
   * @api public
   */

  emit(ev){
    if (~exportsEvents.indexOf(ev)) {
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
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return {Namespace} self
   * @api public
   */

  write(){
    var args = Array.prototype.slice.call(arguments);
    args.unshift('message');
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Gets a list of clients.
   *
   * @return {Namespace} self
   * @api public
   */

  clients(fn){
    this.adapter.clients(this.rooms, fn);
    // delete rooms flag for scenario:
    // .in('room').clients() (GH-1978)
    delete this.rooms;
    return this;
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress if `true`, compresses the sending data
   * @return {Socket} self
   * @api public
   */

  compress(compress){
    this.flags = this.flags || {};
    this.flags.compress = compress;
    return this;
  }

}

/**
 * Apply flags from `Socket`.
 */

exportsFlags.forEach(function(flag){
  Namespace.prototype.__defineGetter__(flag, function(){
    this.flags = this.flags || {};
    this.flags[flag] = true;
    return this;
  });
});

/**
 * Methods sharing functions
 */

Namespace.prototype.to = Namespace.prototype.in;
Namespace.prototype.send = Namespace.prototype.write;

/**
 * Module exports.
 */

module.exports = Namespace;
