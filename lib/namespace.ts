import { Socket } from "./socket";
import { Server } from "./index";
import { Client } from "./client";
import { EventEmitter } from "events";
import parser from "socket.io-parser";
import hasBin from "has-binary2";
import debugModule from "debug";

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
  public readonly connected: object = {};

  public adapter;

  /** @package */
  public readonly server;
  /** @package */
  public fns: Array<(socket: Socket, next: (err: Error) => void) => void> = [];
  /** @package */
  public rooms: Array<string> = [];
  /** @package */
  public flags: any = {};
  /** @package */
  public ids: number = 0;

  private readonly sockets: object = {};

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
   */
  private initAdapter(): void {
    this.adapter = new (this.server.adapter())(this);
  }

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   */
  public use(
    fn: (socket: Socket, next: (err: Error) => void) => void
  ): Namespace {
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
  public to(name: string): Namespace {
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
    return this;
  }

  /**
   * Targets a room when emitting.
   *
   * @param {String} name
   * @return {Namespace} self
   */
  public in(name: string): Namespace {
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
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
    const self = this;
    this.run(socket, err => {
      process.nextTick(() => {
        if ("open" == client.conn.readyState) {
          if (err) return socket.error(err.message);

          // track socket
          self.sockets[socket.id] = socket;

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
   */
  // @ts-ignore
  public emit(ev): Namespace {
    if (~events.indexOf(ev)) {
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
  public clients(fn: (clients: Array<string>) => void): Namespace {
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
