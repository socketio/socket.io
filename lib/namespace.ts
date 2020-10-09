import { Socket } from "./socket";
import { Server } from "./index";
import { Client } from "./client";
import { EventEmitter } from "events";
import { PacketType } from "socket.io-parser";
import hasBin from "has-binary2";
import debugModule from "debug";
import { Adapter, Room, SocketId } from "socket.io-adapter";

const debug = debugModule("socket.io:namespace");

/**
 * Blacklisted events.
 */

const events = [
  "connect", // for symmetry with client
  "connection",
  "newListener"
];

export class Namespace extends EventEmitter {
  public readonly name: string;
  public readonly connected: Map<SocketId, Socket> = new Map();

  public adapter: Adapter;

  /** @package */
  public readonly server;
  /** @package */
  public fns: Array<(socket: Socket, next: (err: Error) => void) => void> = [];
  /** @package */
  public rooms: Set<Room> = new Set();
  /** @package */
  public flags: any = {};
  /** @package */
  public ids: number = 0;
  /** @package */
  public sockets: Map<SocketId, Socket> = new Map();

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
    this.initAdapter();
  }

  /**
   * Initializes the `Adapter` for this nsp.
   * Run upon changing adapter by `Server#adapter`
   * in addition to the constructor.
   *
   * @package
   */
  public initAdapter(): void {
    this.adapter = new (this.server.adapter())(this);
  }

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   */
  public use(
    fn: (socket: Socket, next: (err?: Error) => void) => void
  ): Namespace {
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming client.
   *
   * @param {Socket} socket - the socket that will get added
   * @param {Function} fn - last fn call in the middleware
   */
  private run(socket: Socket, fn: (err: Error) => void) {
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
   */
  public to(name: Room): Namespace {
    this.rooms.add(name);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @param {String} name
   * @return {Namespace} self
   */
  public in(name: Room): Namespace {
    this.rooms.add(name);
    return this;
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   */
  private add(client: Client, query, fn?: () => void): Socket {
    debug("adding socket to nsp %s", this.name);
    const socket = new Socket(this, client, query);
    this.run(socket, err => {
      process.nextTick(() => {
        if ("open" == client.conn.readyState) {
          if (err) return socket.error(err.message);

          // track socket
          this.sockets.set(socket.id, socket);

          // it's paramount that the internal `onconnect` logic
          // fires before user-set events to prevent state order
          // violations (such as a disconnection before the connection
          // logic is complete)
          socket.onconnect();
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
   * @package
   */
  public remove(socket: Socket): void {
    if (this.sockets.has(socket.id)) {
      this.sockets.delete(socket.id);
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return {Namespace} self
   */
  // @ts-ignore
  public emit(ev: string, ...args: any[]): Namespace {
    if (~events.indexOf(ev)) {
      super.emit.apply(this, arguments);
      return this;
    }
    // set up packet object
    args.unshift(ev);
    const packet = {
      type: (this.flags.binary !== undefined
      ? this.flags.binary
      : hasBin(args))
        ? PacketType.BINARY_EVENT
        : PacketType.EVENT,
      data: args
    };

    if ("function" == typeof args[args.length - 1]) {
      throw new Error("Callbacks are not supported when broadcasting");
    }

    const rooms = new Set(this.rooms);
    const flags = Object.assign({}, this.flags);

    // reset flags
    this.rooms.clear();
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
   */
  public allSockets(): Promise<Set<SocketId>> {
    if (!this.adapter) {
      throw new Error(
        "No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?"
      );
    }
    const rooms = new Set(this.rooms);
    this.rooms.clear();
    return this.adapter.sockets(rooms);
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress - if `true`, compresses the sending data
   * @return {Namespace} self
   */
  public compress(compress: boolean): Namespace {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets the binary flag
   *
   * @param {Boolean} binary - encode as if it has binary data if `true`, Encode as if it doesnt have binary data if `false`
   * @return {Namespace} self
   */
  public binary(binary: boolean): Namespace {
    this.flags.binary = binary;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return {Namespace} self
   */
  public get volatile(): Namespace {
    this.flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return {Namespace} self
   */
  public get local(): Namespace {
    this.flags.local = true;
    return this;
  }
}
