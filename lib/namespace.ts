import { Socket, RESERVED_EVENTS } from "./socket";
import { Server } from "./index";
import { Client } from "./client";
import { EventEmitter } from "events";
import { PacketType } from "socket.io-parser";
import debugModule from "debug";
import { Adapter, Room, SocketId } from "socket.io-adapter";

const debug = debugModule("socket.io:namespace");

export interface ExtendedError extends Error {
  data?: any;
}

export class Namespace extends EventEmitter {
  public readonly name: string;
  public readonly sockets: Map<SocketId, Socket> = new Map();

  public adapter: Adapter;

  /** @private */
  readonly server: Server;

  /** @private */
  _fns: Array<
    (socket: Socket, next: (err: ExtendedError) => void) => void
  > = [];

  /** @private */
  _rooms: Set<Room> = new Set();

  /** @private */
  _flags: any = {};

  /** @private */
  _ids: number = 0;

  /**
   * Namespace constructor.
   *
   * @param {Server} server instance
   * @param {string} name
   */
  constructor(server: Server, name: string) {
    super();
    this.server = server;
    this.name = name;
    this._initAdapter();
  }

  /**
   * Initializes the `Adapter` for this nsp.
   * Run upon changing adapter by `Server#adapter`
   * in addition to the constructor.
   *
   * @private
   */
  _initAdapter(): void {
    this.adapter = new (this.server.adapter())(this);
  }

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   * @public
   */
  public use(
    fn: (socket: Socket, next: (err?: ExtendedError) => void) => void
  ): Namespace {
    this._fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming client.
   *
   * @param {Socket} socket - the socket that will get added
   * @param {Function} fn - last fn call in the middleware
   * @private
   */
  private run(socket: Socket, fn: (err: ExtendedError) => void) {
    const fns = this._fns.slice(0);
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
   * @public
   */
  public to(name: Room): Namespace {
    this._rooms.add(name);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @param {String} name
   * @return {Namespace} self
   * @public
   */
  public in(name: Room): Namespace {
    this._rooms.add(name);
    return this;
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @private
   */
  _add(client: Client, query, fn?: () => void): Socket {
    debug("adding socket to nsp %s", this.name);
    const socket = new Socket(this, client, query);
    this.run(socket, err => {
      process.nextTick(() => {
        if ("open" == client.conn.readyState) {
          if (err)
            return socket._error({
              message: err.message,
              data: err.data
            });

          // track socket
          this.sockets.set(socket.id, socket);

          // it's paramount that the internal `onconnect` logic
          // fires before user-set events to prevent state order
          // violations (such as a disconnection before the connection
          // logic is complete)
          socket._onconnect();
          if (fn) fn();

          // fire user-set events
          super.emit("connect", socket);
          super.emit("connection", socket);
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
   * @private
   */
  _remove(socket: Socket): void {
    if (this.sockets.has(socket.id)) {
      this.sockets.delete(socket.id);
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return {Boolean} Always true
   * @public
   */
  public emit(ev: string, ...args: any[]): boolean {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${ev}" is a reserved event name`);
    }
    // set up packet object
    args.unshift(ev);
    const packet = {
      type: PacketType.EVENT,
      data: args
    };

    if ("function" == typeof args[args.length - 1]) {
      throw new Error("Callbacks are not supported when broadcasting");
    }

    const rooms = new Set(this._rooms);
    const flags = Object.assign({}, this._flags);

    // reset flags
    this._rooms.clear();
    this._flags = {};

    this.adapter.broadcast(packet, {
      rooms: rooms,
      flags: flags
    });

    return true;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return {Namespace} self
   * @public
   */
  public send(...args): Namespace {
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return {Namespace} self
   * @public
   */
  public write(...args): Namespace {
    args.unshift("message");
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Gets a list of clients.
   *
   * @return {Namespace} self
   * @public
   */
  public allSockets(): Promise<Set<SocketId>> {
    if (!this.adapter) {
      throw new Error(
        "No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?"
      );
    }
    const rooms = new Set(this._rooms);
    this._rooms.clear();
    return this.adapter.sockets(rooms);
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress - if `true`, compresses the sending data
   * @return {Namespace} self
   * @public
   */
  public compress(compress: boolean): Namespace {
    this._flags.compress = compress;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return {Namespace} self
   * @public
   */
  public get volatile(): Namespace {
    this._flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return {Namespace} self
   * @public
   */
  public get local(): Namespace {
    this._flags.local = true;
    return this;
  }
}
