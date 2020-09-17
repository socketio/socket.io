const EventEmitter = require("events");
const parser = require("socket.io-parser");
const hasBin = require("has-binary2");
const url = require("url");
const debug = require("debug")("socket.io:socket");

/**
 * Blacklisted events.
 *
 * @api public
 */

exports.events = [
  "error",
  "connect",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener"
];

/**
 * Flags.
 *
 * @api private
 */

const flags = ["json", "volatile", "broadcast", "local"];

class Socket extends EventEmitter {
  /**
   * Interface to a `Client` for a given `Namespace`.
   *
   * @param {Namespace} nsp
   * @param {Client} client
   * @api public
   */
  constructor(nsp, client, query) {
    super();
    this.nsp = nsp;
    this.server = nsp.server;
    this.adapter = this.nsp.adapter;
    this.id = nsp.name !== "/" ? nsp.name + "#" + client.id : client.id;
    this.client = client;
    this.conn = client.conn;
    this.rooms = {};
    this.acks = {};
    this.connected = true;
    this.disconnected = false;
    this.handshake = this.buildHandshake(query);
    this.fns = [];
    this.flags = {};
    this._rooms = [];
  }

  /**
   * Builds the `handshake` BC object
   *
   * @api private
   */
  buildHandshake(query) {
    const self = this;
    function buildQuery() {
      const requestQuery = url.parse(self.request.url, true).query;
      //if socket-specific query exist, replace query strings in requestQuery
      return Object.assign({}, query, requestQuery);
    }
    return {
      headers: this.request.headers,
      time: new Date() + "",
      address: this.conn.remoteAddress,
      xdomain: !!this.request.headers.origin,
      secure: !!this.request.connection.encrypted,
      issued: +new Date(),
      url: this.request.url,
      query: buildQuery()
    };
  }

  /**
   * Emits to this client.
   *
   * @return {Socket} self
   * @api public
   */
  emit(ev) {
    if (~exports.events.indexOf(ev)) {
      super.emit.apply(this, arguments);
      return this;
    }

    const args = Array.prototype.slice.call(arguments);
    const packet = {
      type: (this.flags.binary !== undefined
      ? this.flags.binary
      : hasBin(args))
        ? parser.BINARY_EVENT
        : parser.EVENT,
      data: args
    };

    // access last argument to see if it's an ACK callback
    if (typeof args[args.length - 1] === "function") {
      if (this._rooms.length || this.flags.broadcast) {
        throw new Error("Callbacks are not supported when broadcasting");
      }

      debug("emitting packet with ack id %d", this.nsp.ids);
      this.acks[this.nsp.ids] = args.pop();
      packet.id = this.nsp.ids++;
    }

    const rooms = this._rooms.slice(0);
    const flags = Object.assign({}, this.flags);

    // reset flags
    this._rooms = [];
    this.flags = {};

    if (rooms.length || flags.broadcast) {
      this.adapter.broadcast(packet, {
        except: [this.id],
        rooms: rooms,
        flags: flags
      });
    } else {
      // dispatch packet
      this.packet(packet, flags);
    }
    return this;
  }

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {Socket} self
   * @api public
   */
  to(name) {
    if (!~this._rooms.indexOf(name)) this._rooms.push(name);
    return this;
  }

  in(name) {
    if (!~this._rooms.indexOf(name)) this._rooms.push(name);
    return this;
  }

  /**
   * Sends a `message` event.
   *
   * @return {Socket} self
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
   * Writes a packet.
   *
   * @param {Object} packet object
   * @param {Object} opts options
   * @api private
   */
  packet(packet, opts) {
    packet.nsp = this.nsp.name;
    opts = opts || {};
    opts.compress = false !== opts.compress;
    this.client.packet(packet, opts);
  }

  /**
   * Joins a room.
   *
   * @param {String|Array} room or array of rooms
   * @param {Function} fn optional, callback
   * @return {Socket} self
   * @api private
   */
  join(rooms, fn) {
    debug("joining room %s", rooms);
    const self = this;
    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }
    rooms = rooms.filter(function(room) {
      return !self.rooms.hasOwnProperty(room);
    });
    if (!rooms.length) {
      fn && fn(null);
      return this;
    }
    this.adapter.addAll(this.id, rooms, function(err) {
      if (err) return fn && fn(err);
      debug("joined room %s", rooms);
      rooms.forEach(function(room) {
        self.rooms[room] = room;
      });
      fn && fn(null);
    });
    return this;
  }

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} fn optional, callback
   * @return {Socket} self
   * @api private
   */
  leave(room, fn) {
    debug("leave room %s", room);
    const self = this;
    this.adapter.del(this.id, room, function(err) {
      if (err) return fn && fn(err);
      debug("left room %s", room);
      delete self.rooms[room];
      fn && fn(null);
    });
    return this;
  }

  /**
   * Leave all rooms.
   *
   * @api private
   */
  leaveAll() {
    this.adapter.delAll(this.id);
    this.rooms = {};
  }

  /**
   * Called by `Namespace` upon successful
   * middleware execution (ie: authorization).
   * Socket is added to namespace array before
   * call to join, so adapters can access it.
   *
   * @api private
   */
  onconnect() {
    debug("socket connected - writing packet");
    this.nsp.connected[this.id] = this;
    this.join(this.id);
    const skip = this.nsp.name === "/" && this.nsp.fns.length === 0;
    if (skip) {
      debug("packet already sent in initial handshake");
    } else {
      this.packet({ type: parser.CONNECT });
    }
  }

  /**
   * Called with each packet. Called by `Client`.
   *
   * @param {Object} packet
   * @api private
   */
  onpacket(packet) {
    debug("got packet %j", packet);
    switch (packet.type) {
      case parser.EVENT:
        this.onevent(packet);
        break;

      case parser.BINARY_EVENT:
        this.onevent(packet);
        break;

      case parser.ACK:
        this.onack(packet);
        break;

      case parser.BINARY_ACK:
        this.onack(packet);
        break;

      case parser.DISCONNECT:
        this.ondisconnect();
        break;

      case parser.ERROR:
        this.onerror(new Error(packet.data));
    }
  }

  /**
   * Called upon event packet.
   *
   * @param {Object} packet object
   * @api private
   */
  onevent(packet) {
    const args = packet.data || [];
    debug("emitting event %j", args);

    if (null != packet.id) {
      debug("attaching ack callback to event");
      args.push(this.ack(packet.id));
    }

    this.dispatch(args);
  }

  /**
   * Produces an ack callback to emit with an event.
   *
   * @param {Number} id packet id
   * @api private
   */
  ack(id) {
    const self = this;
    let sent = false;
    return function() {
      // prevent double callbacks
      if (sent) return;
      const args = Array.prototype.slice.call(arguments);
      debug("sending ack %j", args);

      self.packet({
        id: id,
        type: hasBin(args) ? parser.BINARY_ACK : parser.ACK,
        data: args
      });

      sent = true;
    };
  }

  /**
   * Called upon ack packet.
   *
   * @api private
   */
  onack(packet) {
    const ack = this.acks[packet.id];
    if ("function" == typeof ack) {
      debug("calling ack %s with %j", packet.id, packet.data);
      ack.apply(this, packet.data);
      delete this.acks[packet.id];
    } else {
      debug("bad ack %s", packet.id);
    }
  }

  /**
   * Called upon client disconnect packet.
   *
   * @api private
   */
  ondisconnect() {
    debug("got disconnect packet");
    this.onclose("client namespace disconnect");
  }

  /**
   * Handles a client error.
   *
   * @api private
   */
  onerror(err) {
    if (this.listeners("error").length) {
      this.emit("error", err);
    } else {
      console.error("Missing error handler on `socket`.");
      console.error(err.stack);
    }
  }

  /**
   * Called upon closing. Called by `Client`.
   *
   * @param {String} reason
   * @throw {Error} optional error object
   * @api private
   */
  onclose(reason) {
    if (!this.connected) return this;
    debug("closing socket - reason %s", reason);
    this.emit("disconnecting", reason);
    this.leaveAll();
    this.nsp.remove(this);
    this.client.remove(this);
    this.connected = false;
    this.disconnected = true;
    delete this.nsp.connected[this.id];
    this.emit("disconnect", reason);
  }

  /**
   * Produces an `error` packet.
   *
   * @param {Object} err error object
   * @api private
   */
  error(err) {
    this.packet({ type: parser.ERROR, data: err });
  }

  /**
   * Disconnects this client.
   *
   * @param {Boolean} close if `true`, closes the underlying connection
   * @return {Socket} self
   * @api public
   */
  disconnect(close) {
    if (!this.connected) return this;
    if (close) {
      this.client.disconnect();
    } else {
      this.packet({ type: parser.DISCONNECT });
      this.onclose("server namespace disconnect");
    }
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

  /**
   * Dispatch incoming event to socket listeners.
   *
   * @param {Array} event that will get emitted
   * @api private
   */
  dispatch(event) {
    debug("dispatching an event %j", event);
    this.run(event, err => {
      process.nextTick(() => {
        if (err) {
          return this.error(err.data || err.message);
        }
        super.emit.apply(this, event);
      });
    });
  }

  /**
   * Sets up socket middleware.
   *
   * @param {Function} middleware function (event, next)
   * @return {Socket} self
   * @api public
   */
  use(fn) {
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming event.
   *
   * @param {Array} event that will get emitted
   * @param {Function} last fn call in the middleware
   * @api private
   */
  run(event, fn) {
    const fns = this.fns.slice(0);
    if (!fns.length) return fn(null);

    function run(i) {
      fns[i](event, function(err) {
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

  get request() {
    return this.conn.request;
  }
}

/**
 * Apply flags from `Socket`.
 */

flags.forEach(function(flag) {
  Object.defineProperty(Socket.prototype, flag, {
    get: function() {
      this.flags[flag] = true;
      return this;
    }
  });
});

module.exports = Socket;
