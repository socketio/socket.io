import { EventEmitter } from "events";
import parser from "socket.io-parser";
import hasBin from "has-binary2";
import url from "url";
import debugModule from "debug";
import { Client, Namespace, Server } from "./index";
import { IncomingMessage } from "http";
import { Adapter, BroadcastFlags, Room, SocketId } from "socket.io-adapter";

const debug = debugModule("socket.io:socket");

/**
 * Blacklisted events.
 */

const events = [
  "error",
  "connect",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener"
];

/**
 * The handshake details
 */
export interface Handshake {
  /**
   * The headers sent as part of the handshake
   */
  headers: object;

  /**
   * The date of creation (as string)
   */
  time: string;

  /**
   * The ip of the client
   */
  address: string;

  /**
   * Whether the connection is cross-domain
   */
  xdomain: boolean;

  /**
   * Whether the connection is secure
   */
  secure: boolean;

  /**
   * The date of creation (as unix timestamp)
   */
  issued: number;

  /**
   * The request URL string
   */
  url: string;

  /**
   * The query object
   */
  query: object;
}

export class Socket extends EventEmitter {
  public readonly id: SocketId;
  public readonly handshake: Handshake;

  public connected: boolean;
  public disconnected: boolean;

  private readonly server: Server;
  private readonly adapter: Adapter;
  private acks: Map<number, () => void> = new Map();
  private fns: Array<
    (event: Array<any>, next: (err: Error) => void) => void
  > = [];
  private flags: BroadcastFlags = {};
  private _rooms: Set<Room> = new Set();

  /**
   * Interface to a `Client` for a given `Namespace`.
   *
   * @param {Namespace} nsp
   * @param {Client} client
   * @param {Object} query
   * @package
   */
  constructor(readonly nsp: Namespace, readonly client: Client, query) {
    super();
    this.server = nsp.server;
    this.adapter = this.nsp.adapter;
    this.id = nsp.name !== "/" ? nsp.name + "#" + client.id : client.id;
    this.connected = true;
    this.disconnected = false;
    this.handshake = this.buildHandshake(query);
  }

  /**
   * Builds the `handshake` BC object
   */
  private buildHandshake(query): Handshake {
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
      // @ts-ignore
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
   */
  // @ts-ignore
  public emit(ev) {
    if (~events.indexOf(ev)) {
      super.emit.apply(this, arguments);
      return this;
    }

    const args = Array.prototype.slice.call(arguments);
    const packet: any = {
      type: (this.flags.binary !== undefined
      ? this.flags.binary
      : hasBin(args))
        ? parser.BINARY_EVENT
        : parser.EVENT,
      data: args
    };

    // access last argument to see if it's an ACK callback
    if (typeof args[args.length - 1] === "function") {
      if (this._rooms.size || this.flags.broadcast) {
        throw new Error("Callbacks are not supported when broadcasting");
      }

      debug("emitting packet with ack id %d", this.nsp.ids);
      this.acks.set(this.nsp.ids, args.pop());
      packet.id = this.nsp.ids++;
    }

    const rooms = new Set(this._rooms);
    const flags = Object.assign({}, this.flags);

    // reset flags
    this._rooms.clear();
    this.flags = {};

    if (rooms.size || flags.broadcast) {
      this.adapter.broadcast(packet, {
        except: new Set([this.id]),
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
   */
  public to(name: Room) {
    this._rooms.add(name);
    return this;
  }

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {Socket} self
   */
  public in(name: Room): Socket {
    this._rooms.add(name);
    return this;
  }

  /**
   * Sends a `message` event.
   *
   * @return {Socket} self
   */
  public send(...args): Socket {
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Sends a `message` event.
   *
   * @return {Socket} self
   */
  public write(...args): Socket {
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Writes a packet.
   *
   * @param {Object} packet - packet object
   * @param {Object} opts - options
   */
  private packet(packet, opts: any = {}) {
    packet.nsp = this.nsp.name;
    opts.compress = false !== opts.compress;
    this.client.packet(packet, opts);
  }

  /**
   * Joins a room.
   *
   * @param {String|Array} rooms - room or array of rooms
   * @param {Function} fn - optional, callback
   * @return {Socket} self
   */
  public join(rooms: Room | Array<Room>, fn?: (err: Error) => void): Socket {
    debug("joining room %s", rooms);

    this.adapter.addAll(
      this.id,
      new Set(Array.isArray(rooms) ? rooms : [rooms])
    );
    debug("joined room %s", rooms);
    fn && fn(null);
    return this;
  }

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} fn - optional, callback
   * @return {Socket} self
   */
  public leave(room: string, fn?: (err: Error) => void): Socket {
    debug("leave room %s", room);
    this.adapter.del(this.id, room);

    debug("left room %s", room);
    fn && fn(null);

    return this;
  }

  /**
   * Leave all rooms.
   */
  private leaveAll(): void {
    this.adapter.delAll(this.id);
  }

  /**
   * Called by `Namespace` upon successful
   * middleware execution (ie: authorization).
   * Socket is added to namespace array before
   * call to join, so adapters can access it.
   *
   * @package
   */
  public onconnect(): void {
    debug("socket connected - writing packet");
    this.nsp.connected.set(this.id, this);
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
   * @package
   */
  public onpacket(packet) {
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
   * @param {Object} packet - packet object
   */
  private onevent(packet): void {
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
   * @param {Number} id - packet id
   */
  private ack(id: number) {
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
   */
  private onack(packet): void {
    const ack = this.acks.get(packet.id);
    if ("function" == typeof ack) {
      debug("calling ack %s with %j", packet.id, packet.data);
      ack.apply(this, packet.data);
      this.acks.delete(packet.id);
    } else {
      debug("bad ack %s", packet.id);
    }
  }

  /**
   * Called upon client disconnect packet.
   */
  private ondisconnect(): void {
    debug("got disconnect packet");
    this.onclose("client namespace disconnect");
  }

  /**
   * Handles a client error.
   *
   * @package
   */
  public onerror(err): void {
    if (this.listeners("error").length) {
      super.emit("error", err);
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
   *
   * @package
   */
  public onclose(reason: string) {
    if (!this.connected) return this;
    debug("closing socket - reason %s", reason);
    super.emit("disconnecting", reason);
    this.leaveAll();
    this.nsp.remove(this);
    this.client.remove(this);
    this.connected = false;
    this.disconnected = true;
    this.nsp.connected.delete(this.id);
    super.emit("disconnect", reason);
  }

  /**
   * Produces an `error` packet.
   *
   * @param {Object} err - error object
   *
   * @package
   */
  public error(err) {
    this.packet({ type: parser.ERROR, data: err });
  }

  /**
   * Disconnects this client.
   *
   * @param {Boolean} close - if `true`, closes the underlying connection
   * @return {Socket} self
   */
  public disconnect(close = false): Socket {
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
   * @param {Boolean} compress - if `true`, compresses the sending data
   * @return {Socket} self
   */
  public compress(compress: boolean): Socket {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets the binary flag
   *
   * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
   * @return {Socket} self
   */
  public binary(binary: boolean): Socket {
    this.flags.binary = binary;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return {Socket} self
   */
  public get volatile(): Socket {
    this.flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to every sockets but the
   * sender.
   *
   * @return {Socket} self
   */
  public get broadcast(): Socket {
    this.flags.broadcast = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return {Socket} self
   */
  public get local(): Socket {
    this.flags.local = true;
    return this;
  }

  /**
   * Dispatch incoming event to socket listeners.
   *
   * @param {Array} event - event that will get emitted
   */
  private dispatch(event: Array<string>): void {
    debug("dispatching an event %j", event);
    this.run(event, err => {
      process.nextTick(() => {
        if (err) {
          return this.error(err.message);
        }
        super.emit.apply(this, event);
      });
    });
  }

  /**
   * Sets up socket middleware.
   *
   * @param {Function} fn - middleware function (event, next)
   * @return {Socket} self
   */
  public use(
    fn: (event: Array<any>, next: (err: Error) => void) => void
  ): Socket {
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming event.
   *
   * @param {Array} event - event that will get emitted
   * @param {Function} fn - last fn call in the middleware
   */
  private run(event: Array<any>, fn: (err: Error) => void) {
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

  public get request(): IncomingMessage {
    return this.client.request;
  }

  public get conn() {
    return this.client.conn;
  }

  public get rooms(): Set<Room> {
    return this.adapter.socketRooms(this.id) || new Set();
  }
}
