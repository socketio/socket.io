const Socket = require("./socket");
const EventEmitter = require("events").EventEmitter;
const parser = require("socket.io-parser");
const hasBin = require("has-binary2");
const debug = require("debug")("socket.io:namespace");

/**
 * Blacklisted events.
 */

exports.events = [
  "connect", // for symmetry with client
  "connection",
  "newListener"
];

/**
 * Flags.
 */

exports.flags = ["json", "volatile", "local"];

class Namespace extends EventEmitter {
  /**
   * Namespace constructor.
   *
   * @param {Server} server instance
   * @param {Socket} name
   * @api private
   */
  constructor(server, name) {
    super();
    this.name = name;
    this.server = server;
    this.sockets = {};
    this.connected = {};
    this.fns = [];
    this.ids = 0;
    this.rooms = [];
    this.flags = {};
    this.initAdapter();
  }

  /**
   * Initializes the `Adapter` for this nsp.
   * Run upon changing adapter by `Server#adapter`
   * in addition to the constructor.
   *
   * @api private
   */
  initAdapter() {
    this.adapter = new (this.server.adapter())(this);
  }

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   * @api public
   */
  use(fn) {
    if (this.server.eio && this.name === "/") {
      debug("removing initial packet");
      delete this.server.eio.initialPacket;
    }
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
  run(socket, fn) {
    const fns = this.fns.slice(0);
    if (!fns.length) return fn(null);

    function run(i) {
      fns[i](socket, function(err) {
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
  to(name) {
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
    return this;
  }

  in(name) {
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
    return this;
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @api private
   */
  add(client, query, fn) {
    debug("adding socket to nsp %s", this.name);
    const socket = new Socket(this, client, query);
    const self = this;
    this.run(socket, function(err) {
      process.nextTick(function() {
        if ("open" == client.conn.readyState) {
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
          self.emit("connect", socket);
          self.emit("connection", socket);
        } else {
          debug("next called after client was closed - ignoring socket");
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
  remove(socket) {
    if (this.sockets.hasOwnProperty(socket.id)) {
      delete this.sockets[socket.id];
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return {Namespace} self
   * @api public
   */
  emit(ev) {
    if (~exports.events.indexOf(ev)) {
      super.emit.apply(this, arguments);
      return this;
    }
    // set up packet object
    const args = Array.prototype.slice.call(arguments);
    const packet = {
      type: (this.flags.binary !== undefined
      ? this.flags.binary
      : hasBin(args))
        ? parser.BINARY_EVENT
        : parser.EVENT,
      data: args
    };

    if ("function" == typeof args[args.length - 1]) {
      throw new Error("Callbacks are not supported when broadcasting");
    }

    const rooms = this.rooms.slice(0);
    const flags = Object.assign({}, this.flags);

    // reset flags
    this.rooms = [];
    this.flags = {};

    this.adapter.broadcast(packet, {
      rooms: rooms,
      flags: flags
    });

    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return {Namespace} self
   * @api public
   */
  send() {
    const args = Array.prototype.slice.call(arguments);
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  write() {
    const args = Array.prototype.slice.call(arguments);
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Gets a list of clients.
   *
   * @return {Namespace} self
   * @api public
   */
  clients(fn) {
    if (!this.adapter) {
      throw new Error(
        "No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?"
      );
    }
    this.adapter.clients(this.rooms, fn);
    // reset rooms for scenario:
    // .in('room').clients() (GH-1978)
    this.rooms = [];
    return this;
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress if `true`, compresses the sending data
   * @return {Socket} self
   * @api public
   */
  compress(compress) {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets the binary flag
   *
   * @param {Boolean} Encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
   * @return {Socket} self
   * @api public
   */
  binary(binary) {
    this.flags.binary = binary;
    return this;
  }
}

/**
 * Apply flags from `Socket`.
 */

exports.flags.forEach(function(flag) {
  Object.defineProperty(Namespace.prototype, flag, {
    get: function() {
      this.flags[flag] = true;
      return this;
    }
  });
});

module.exports = Namespace;
