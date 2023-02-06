import { Packet, PacketType } from "socket.io-parser";
import debugModule from "debug";
import type { Server } from "./index";
import {
  AllButLast,
  DecorateAcknowledgements,
  DecorateAcknowledgementsWithMultipleResponses,
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  FirstArg,
  Last,
  StrictEventEmitter,
} from "./typed-events";
import type { Client } from "./client";
import type { Namespace, NamespaceReservedEventsMap } from "./namespace";
import type { IncomingHttpHeaders, IncomingMessage } from "http";
import type {
  Adapter,
  BroadcastFlags,
  PrivateSessionId,
  Room,
  Session,
  SocketId,
} from "socket.io-adapter";
import base64id from "base64id";
import type { ParsedUrlQuery } from "querystring";
import { BroadcastOperator } from "./broadcast-operator";

const debug = debugModule("socket.io:socket");

type ClientReservedEvents = "connect_error";

// TODO for next major release: cleanup disconnect reasons
export type DisconnectReason =
  // Engine.IO close reasons
  | "transport error"
  | "transport close"
  | "forced close"
  | "ping timeout"
  | "parse error"
  // Socket.IO disconnect reasons
  | "server shutting down"
  | "forced server close"
  | "client namespace disconnect"
  | "server namespace disconnect";

const RECOVERABLE_DISCONNECT_REASONS: ReadonlySet<DisconnectReason> = new Set([
  "transport error",
  "transport close",
  "forced close",
  "ping timeout",
  "server shutting down",
  "forced server close",
]);

export interface SocketReservedEventsMap {
  disconnect: (reason: DisconnectReason, description?: any) => void;
  disconnecting: (reason: DisconnectReason, description?: any) => void;
  error: (err: Error) => void;
}

// EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
export interface EventEmitterReservedEventsMap {
  newListener: (
    eventName: string | Symbol,
    listener: (...args: any[]) => void
  ) => void;
  removeListener: (
    eventName: string | Symbol,
    listener: (...args: any[]) => void
  ) => void;
}

export const RESERVED_EVENTS: ReadonlySet<string | Symbol> = new Set<
  | ClientReservedEvents
  | keyof NamespaceReservedEventsMap<never, never, never, never>
  | keyof SocketReservedEventsMap
  | keyof EventEmitterReservedEventsMap
>(<const>[
  "connect",
  "connect_error",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener",
]);

/**
 * The handshake details
 */
export interface Handshake {
  /**
   * The headers sent as part of the handshake
   */
  headers: IncomingHttpHeaders;

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
  query: ParsedUrlQuery;

  /**
   * The auth object
   */
  auth: { [key: string]: any };
}

/**
 * `[eventName, ...args]`
 */
export type Event = [string, ...any[]];

function noop() {}

/**
 * This is the main object for interacting with a client.
 *
 * A Socket belongs to a given {@link Namespace} and uses an underlying {@link Client} to communicate.
 *
 * Within each {@link Namespace}, you can also define arbitrary channels (called "rooms") that the {@link Socket} can
 * join and leave. That provides a convenient way to broadcast to a group of socket instances.
 *
 * @example
 * io.on("connection", (socket) => {
 *   console.log(`socket ${socket.id} connected`);
 *
 *   // send an event to the client
 *   socket.emit("foo", "bar");
 *
 *   socket.on("foobar", () => {
 *     // an event was received from the client
 *   });
 *
 *   // join the room named "room1"
 *   socket.join("room1");
 *
 *   // broadcast to everyone in the room named "room1"
 *   io.to("room1").emit("hello");
 *
 *   // upon disconnection
 *   socket.on("disconnect", (reason) => {
 *     console.log(`socket ${socket.id} disconnected due to ${reason}`);
 *   });
 * });
 */
export class Socket<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
  SocketData = any
> extends StrictEventEmitter<
  ListenEvents,
  EmitEvents,
  SocketReservedEventsMap
> {
  /**
   * An unique identifier for the session.
   */
  public readonly id: SocketId;
  /**
   * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
   * be transmitted to the client, the data attribute and the rooms will be restored.
   */
  public readonly recovered: boolean = false;
  /**
   * The handshake details.
   */
  public readonly handshake: Handshake;
  /**
   * Additional information that can be attached to the Socket instance and which will be used in the
   * {@link Server.fetchSockets()} method.
   */
  public data: Partial<SocketData> = {};
  /**
   * Whether the socket is currently connected or not.
   *
   * @example
   * io.use((socket, next) => {
   *   console.log(socket.connected); // false
   *   next();
   * });
   *
   * io.on("connection", (socket) => {
   *   console.log(socket.connected); // true
   * });
   */
  public connected: boolean = false;

  /**
   * The session ID, which must not be shared (unlike {@link id}).
   *
   * @private
   */
  private readonly pid: PrivateSessionId;

  // TODO: remove this unused reference
  private readonly server: Server<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >;
  private readonly adapter: Adapter;
  private acks: Map<number, () => void> = new Map();
  private fns: Array<(event: Event, next: (err?: Error) => void) => void> = [];
  private flags: BroadcastFlags = {};
  private _anyListeners?: Array<(...args: any[]) => void>;
  private _anyOutgoingListeners?: Array<(...args: any[]) => void>;

  /**
   * Interface to a `Client` for a given `Namespace`.
   *
   * @param {Namespace} nsp
   * @param {Client} client
   * @param {Object} auth
   * @package
   */
  constructor(
    readonly nsp: Namespace<ListenEvents, EmitEvents, ServerSideEvents>,
    readonly client: Client<ListenEvents, EmitEvents, ServerSideEvents>,
    auth: Record<string, unknown>,
    previousSession?: Session
  ) {
    super();
    this.server = nsp.server;
    this.adapter = this.nsp.adapter;
    if (previousSession) {
      this.id = previousSession.sid;
      this.pid = previousSession.pid;
      previousSession.rooms.forEach((room) => this.join(room));
      this.data = previousSession.data as Partial<SocketData>;
      previousSession.missedPackets.forEach((packet) => {
        this.packet({
          type: PacketType.EVENT,
          data: packet,
        });
      });
      this.recovered = true;
    } else {
      if (client.conn.protocol === 3) {
        // @ts-ignore
        this.id = nsp.name !== "/" ? nsp.name + "#" + client.id : client.id;
      } else {
        this.id = base64id.generateId(); // don't reuse the Engine.IO id because it's sensitive information
      }
      if (this.server._opts.connectionStateRecovery) {
        this.pid = base64id.generateId();
      }
    }
    this.handshake = this.buildHandshake(auth);
  }

  /**
   * Builds the `handshake` BC object
   *
   * @private
   */
  private buildHandshake(auth: object): Handshake {
    return {
      headers: this.request.headers,
      time: new Date() + "",
      address: this.conn.remoteAddress,
      xdomain: !!this.request.headers.origin,
      // @ts-ignore
      secure: !!this.request.connection.encrypted,
      issued: +new Date(),
      url: this.request.url!,
      // @ts-ignore
      query: this.request._query,
      auth,
    };
  }

  /**
   * Emits to this client.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.emit("hello", "world");
   *
   *   // all serializable datastructures are supported (no need to call JSON.stringify)
   *   socket.emit("hello", 1, "2", { 3: ["4"], 5: Buffer.from([6]) });
   *
   *   // with an acknowledgement from the client
   *   socket.emit("hello", "world", (val) => {
   *     // ...
   *   });
   * });
   *
   * @return Always returns `true`.
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): boolean {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    const data: any[] = [ev, ...args];
    const packet: any = {
      type: PacketType.EVENT,
      data: data,
    };

    // access last argument to see if it's an ACK callback
    if (typeof data[data.length - 1] === "function") {
      const id = this.nsp._ids++;
      debug("emitting packet with ack id %d", id);

      this.registerAckCallback(id, data.pop());
      packet.id = id;
    }

    const flags = Object.assign({}, this.flags);
    this.flags = {};

    // @ts-ignore
    if (this.nsp.server.opts.connectionStateRecovery) {
      // this ensures the packet is stored and can be transmitted upon reconnection
      this.adapter.broadcast(packet, {
        rooms: new Set([this.id]),
        except: new Set(),
        flags,
      });
    } else {
      this.notifyOutgoingListeners(packet);
      this.packet(packet, flags);
    }

    return true;
  }

  /**
   * Emits an event and waits for an acknowledgement
   *
   * @example
   * io.on("connection", async (socket) => {
   *   // without timeout
   *   const response = await socket.emitWithAck("hello", "world");
   *
   *   // with a specific timeout
   *   try {
   *     const response = await socket.timeout(1000).emitWithAck("hello", "world");
   *   } catch (err) {
   *     // the client did not acknowledge the event in the given delay
   *   }
   * });
   *
   * @return a Promise that will be fulfilled when the client acknowledges the event
   */
  public emitWithAck<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<EmitEvents, Ev>>
  ): Promise<FirstArg<Last<EventParams<EmitEvents, Ev>>>> {
    // the timeout flag is optional
    const withErr = this.flags.timeout !== undefined;
    return new Promise((resolve, reject) => {
      args.push((arg1, arg2) => {
        if (withErr) {
          return arg1 ? reject(arg1) : resolve(arg2);
        } else {
          return resolve(arg1);
        }
      });
      this.emit(ev, ...(args as any[] as EventParams<EmitEvents, Ev>));
    });
  }

  /**
   * @private
   */
  private registerAckCallback(id: number, ack: (...args: any[]) => void): void {
    const timeout = this.flags.timeout;
    if (timeout === undefined) {
      this.acks.set(id, ack);
      return;
    }

    const timer = setTimeout(() => {
      debug("event with ack id %d has timed out after %d ms", id, timeout);
      this.acks.delete(id);
      ack.call(this, new Error("operation has timed out"));
    }, timeout);

    this.acks.set(id, (...args) => {
      clearTimeout(timer);
      ack.apply(this, [null, ...args]);
    });
  }

  /**
   * Targets a room when broadcasting.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients in the “room-101” room, except this socket
   *   socket.to("room-101").emit("foo", "bar");
   *
   *   // the code above is equivalent to:
   *   io.to("room-101").except(socket.id).emit("foo", "bar");
   *
   *   // with an array of rooms (a client will be notified at most once)
   *   socket.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   *   // with multiple chained calls
   *   socket.to("room-101").to("room-102").emit("foo", "bar");
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public to(room: Room | Room[]) {
    return this.newBroadcastOperator().to(room);
  }

  /**
   * Targets a room when broadcasting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * io.on("connection", (socket) => {
   *   // disconnect all clients in the "room-101" room, except this socket
   *   socket.in("room-101").disconnectSockets();
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public in(room: Room | Room[]) {
    return this.newBroadcastOperator().in(room);
  }

  /**
   * Excludes a room when broadcasting.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   *   // and this socket
   *   socket.except("room-101").emit("foo", "bar");
   *
   *   // with an array of rooms
   *   socket.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   *   // with multiple chained calls
   *   socket.except("room-101").except("room-102").emit("foo", "bar");
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public except(room: Room | Room[]) {
    return this.newBroadcastOperator().except(room);
  }

  /**
   * Sends a `message` event.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.send("hello");
   *
   *   // this is equivalent to
   *   socket.emit("message", "hello");
   * });
   *
   * @return self
   */
  public send(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Sends a `message` event. Alias of {@link send}.
   *
   * @return self
   */
  public write(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Writes a packet.
   *
   * @param {Object} packet - packet object
   * @param {Object} opts - options
   * @private
   */
  private packet(
    packet: Omit<Packet, "nsp"> & Partial<Pick<Packet, "nsp">>,
    opts: any = {}
  ): void {
    packet.nsp = this.nsp.name;
    opts.compress = false !== opts.compress;
    this.client._packet(packet as Packet, opts);
  }

  /**
   * Joins a room.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // join a single room
   *   socket.join("room1");
   *
   *   // join multiple rooms
   *   socket.join(["room1", "room2"]);
   * });
   *
   * @param {String|Array} rooms - room or array of rooms
   * @return a Promise or nothing, depending on the adapter
   */
  public join(rooms: Room | Array<Room>): Promise<void> | void {
    debug("join room %s", rooms);

    return this.adapter.addAll(
      this.id,
      new Set(Array.isArray(rooms) ? rooms : [rooms])
    );
  }

  /**
   * Leaves a room.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // leave a single room
   *   socket.leave("room1");
   *
   *   // leave multiple rooms
   *   socket.leave("room1").leave("room2");
   * });
   *
   * @param {String} room
   * @return a Promise or nothing, depending on the adapter
   */
  public leave(room: string): Promise<void> | void {
    debug("leave room %s", room);

    return this.adapter.del(this.id, room);
  }

  /**
   * Leave all rooms.
   *
   * @private
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
   * @private
   */
  _onconnect(): void {
    debug("socket connected - writing packet");
    this.connected = true;
    this.join(this.id);
    if (this.conn.protocol === 3) {
      this.packet({ type: PacketType.CONNECT });
    } else {
      this.packet({
        type: PacketType.CONNECT,
        data: { sid: this.id, pid: this.pid },
      });
    }
  }

  /**
   * Called with each packet. Called by `Client`.
   *
   * @param {Object} packet
   * @private
   */
  _onpacket(packet: Packet): void {
    debug("got packet %j", packet);
    switch (packet.type) {
      case PacketType.EVENT:
        this.onevent(packet);
        break;

      case PacketType.BINARY_EVENT:
        this.onevent(packet);
        break;

      case PacketType.ACK:
        this.onack(packet);
        break;

      case PacketType.BINARY_ACK:
        this.onack(packet);
        break;

      case PacketType.DISCONNECT:
        this.ondisconnect();
        break;
    }
  }

  /**
   * Called upon event packet.
   *
   * @param {Packet} packet - packet object
   * @private
   */
  private onevent(packet: Packet): void {
    const args = packet.data || [];
    debug("emitting event %j", args);

    if (null != packet.id) {
      debug("attaching ack callback to event");
      args.push(this.ack(packet.id));
    }

    if (this._anyListeners && this._anyListeners.length) {
      const listeners = this._anyListeners.slice();
      for (const listener of listeners) {
        listener.apply(this, args);
      }
    }
    this.dispatch(args);
  }

  /**
   * Produces an ack callback to emit with an event.
   *
   * @param {Number} id - packet id
   * @private
   */
  private ack(id: number): () => void {
    const self = this;
    let sent = false;
    return function () {
      // prevent double callbacks
      if (sent) return;
      const args = Array.prototype.slice.call(arguments);
      debug("sending ack %j", args);

      self.packet({
        id: id,
        type: PacketType.ACK,
        data: args,
      });

      sent = true;
    };
  }

  /**
   * Called upon ack packet.
   *
   * @private
   */
  private onack(packet: Packet): void {
    const ack = this.acks.get(packet.id!);
    if ("function" == typeof ack) {
      debug("calling ack %s with %j", packet.id, packet.data);
      ack.apply(this, packet.data);
      this.acks.delete(packet.id!);
    } else {
      debug("bad ack %s", packet.id);
    }
  }

  /**
   * Called upon client disconnect packet.
   *
   * @private
   */
  private ondisconnect(): void {
    debug("got disconnect packet");
    this._onclose("client namespace disconnect");
  }

  /**
   * Handles a client error.
   *
   * @private
   */
  _onerror(err: Error): void {
    if (this.listeners("error").length) {
      this.emitReserved("error", err);
    } else {
      console.error("Missing error handler on `socket`.");
      console.error(err.stack);
    }
  }

  /**
   * Called upon closing. Called by `Client`.
   *
   * @param {String} reason
   * @param description
   * @throw {Error} optional error object
   *
   * @private
   */
  _onclose(reason: DisconnectReason, description?: any): this | undefined {
    if (!this.connected) return this;
    debug("closing socket - reason %s", reason);
    this.emitReserved("disconnecting", reason, description);

    if (
      this.server._opts.connectionStateRecovery &&
      RECOVERABLE_DISCONNECT_REASONS.has(reason)
    ) {
      debug("connection state recovery is enabled for sid %s", this.id);
      this.adapter.persistSession({
        sid: this.id,
        pid: this.pid,
        rooms: [...this.rooms],
        data: this.data,
      });
    }

    this._cleanup();
    this.nsp._remove(this);
    this.client._remove(this);
    this.connected = false;
    this.emitReserved("disconnect", reason, description);
    return;
  }

  /**
   * Makes the socket leave all the rooms it was part of and prevents it from joining any other room
   *
   * @private
   */
  _cleanup() {
    this.leaveAll();
    this.join = noop;
  }

  /**
   * Produces an `error` packet.
   *
   * @param {Object} err - error object
   *
   * @private
   */
  _error(err): void {
    this.packet({ type: PacketType.CONNECT_ERROR, data: err });
  }

  /**
   * Disconnects this client.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // disconnect this socket (the connection might be kept alive for other namespaces)
   *   socket.disconnect();
   *
   *   // disconnect this socket and close the underlying connection
   *   socket.disconnect(true);
   * })
   *
   * @param {Boolean} close - if `true`, closes the underlying connection
   * @return self
   */
  public disconnect(close = false): this {
    if (!this.connected) return this;
    if (close) {
      this.client._disconnect();
    } else {
      this.packet({ type: PacketType.DISCONNECT });
      this._onclose("server namespace disconnect");
    }
    return this;
  }

  /**
   * Sets the compress flag.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.compress(false).emit("hello");
   * });
   *
   * @param {Boolean} compress - if `true`, compresses the sending data
   * @return {Socket} self
   */
  public compress(compress: boolean): this {
    this.flags.compress = compress;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.volatile.emit("hello"); // the client may or may not receive it
   * });
   *
   * @return {Socket} self
   */
  public get volatile(): this {
    this.flags.volatile = true;
    return this;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to every sockets but the
   * sender.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients, except this socket
   *   socket.broadcast.emit("foo", "bar");
   * });
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public get broadcast() {
    return this.newBroadcastOperator();
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients on this node, except this socket
   *   socket.local.emit("foo", "bar");
   * });
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public get local() {
    return this.newBroadcastOperator().local;
  }

  /**
   * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
   * given number of milliseconds have elapsed without an acknowledgement from the client:
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.timeout(5000).emit("my-event", (err) => {
   *     if (err) {
   *       // the client did not acknowledge the event in the given delay
   *     }
   *   });
   * });
   *
   * @returns self
   */
  public timeout(
    timeout: number
  ): Socket<
    ListenEvents,
    DecorateAcknowledgements<EmitEvents>,
    ServerSideEvents,
    SocketData
  > {
    this.flags.timeout = timeout;
    return this;
  }

  /**
   * Dispatch incoming event to socket listeners.
   *
   * @param {Array} event - event that will get emitted
   * @private
   */
  private dispatch(event: Event): void {
    debug("dispatching an event %j", event);
    this.run(event, (err) => {
      process.nextTick(() => {
        if (err) {
          return this._onerror(err);
        }
        if (this.connected) {
          super.emitUntyped.apply(this, event);
        } else {
          debug("ignore packet received after disconnection");
        }
      });
    });
  }

  /**
   * Sets up socket middleware.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.use(([event, ...args], next) => {
   *     if (isUnauthorized(event)) {
   *       return next(new Error("unauthorized event"));
   *     }
   *     // do not forget to call next
   *     next();
   *   });
   *
   *   socket.on("error", (err) => {
   *     if (err && err.message === "unauthorized event") {
   *       socket.disconnect();
   *     }
   *   });
   * });
   *
   * @param {Function} fn - middleware function (event, next)
   * @return {Socket} self
   */
  public use(fn: (event: Event, next: (err?: Error) => void) => void): this {
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming event.
   *
   * @param {Array} event - event that will get emitted
   * @param {Function} fn - last fn call in the middleware
   * @private
   */
  private run(event: Event, fn: (err: Error | null) => void): void {
    const fns = this.fns.slice(0);
    if (!fns.length) return fn(null);

    function run(i: number) {
      fns[i](event, function (err) {
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
   * Whether the socket is currently disconnected
   */
  public get disconnected() {
    return !this.connected;
  }

  /**
   * A reference to the request that originated the underlying Engine.IO Socket.
   */
  public get request(): IncomingMessage {
    return this.client.request;
  }

  /**
   * A reference to the underlying Client transport connection (Engine.IO Socket object).
   *
   * @example
   * io.on("connection", (socket) => {
   *   console.log(socket.conn.transport.name); // prints "polling" or "websocket"
   *
   *   socket.conn.once("upgrade", () => {
   *     console.log(socket.conn.transport.name); // prints "websocket"
   *   });
   * });
   */
  public get conn() {
    return this.client.conn;
  }

  /**
   * Returns the rooms the socket is currently in.
   *
   * @example
   * io.on("connection", (socket) => {
   *   console.log(socket.rooms); // Set { <socket.id> }
   *
   *   socket.join("room1");
   *
   *   console.log(socket.rooms); // Set { <socket.id>, "room1" }
   * });
   */
  public get rooms(): Set<Room> {
    return this.adapter.socketRooms(this.id) || new Set();
  }

  /**
   * Adds a listener that will be fired when any event is received. The event name is passed as the first argument to
   * the callback.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.onAny((event, ...args) => {
   *     console.log(`got event ${event}`);
   *   });
   * });
   *
   * @param listener
   */
  public onAny(listener: (...args: any[]) => void): this {
    this._anyListeners = this._anyListeners || [];
    this._anyListeners.push(listener);
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is received. The event name is passed as the first argument to
   * the callback. The listener is added to the beginning of the listeners array.
   *
   * @param listener
   */
  public prependAny(listener: (...args: any[]) => void): this {
    this._anyListeners = this._anyListeners || [];
    this._anyListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is received.
   *
   * @example
   * io.on("connection", (socket) => {
   *   const catchAllListener = (event, ...args) => {
   *     console.log(`got event ${event}`);
   *   }
   *
   *   socket.onAny(catchAllListener);
   *
   *   // remove a specific listener
   *   socket.offAny(catchAllListener);
   *
   *   // or remove all listeners
   *   socket.offAny();
   * });
   *
   * @param listener
   */
  public offAny(listener?: (...args: any[]) => void): this {
    if (!this._anyListeners) {
      return this;
    }
    if (listener) {
      const listeners = this._anyListeners;
      for (let i = 0; i < listeners.length; i++) {
        if (listener === listeners[i]) {
          listeners.splice(i, 1);
          return this;
        }
      }
    } else {
      this._anyListeners = [];
    }
    return this;
  }

  /**
   * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
   * e.g. to remove listeners.
   */
  public listenersAny() {
    return this._anyListeners || [];
  }

  /**
   * Adds a listener that will be fired when any event is sent. The event name is passed as the first argument to
   * the callback.
   *
   * Note: acknowledgements sent to the client are not included.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.onAnyOutgoing((event, ...args) => {
   *     console.log(`sent event ${event}`);
   *   });
   * });
   *
   * @param listener
   */
  public onAnyOutgoing(listener: (...args: any[]) => void): this {
    this._anyOutgoingListeners = this._anyOutgoingListeners || [];
    this._anyOutgoingListeners.push(listener);
    return this;
  }

  /**
   * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
   * callback. The listener is added to the beginning of the listeners array.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.prependAnyOutgoing((event, ...args) => {
   *     console.log(`sent event ${event}`);
   *   });
   * });
   *
   * @param listener
   */
  public prependAnyOutgoing(listener: (...args: any[]) => void): this {
    this._anyOutgoingListeners = this._anyOutgoingListeners || [];
    this._anyOutgoingListeners.unshift(listener);
    return this;
  }

  /**
   * Removes the listener that will be fired when any event is sent.
   *
   * @example
   * io.on("connection", (socket) => {
   *   const catchAllListener = (event, ...args) => {
   *     console.log(`sent event ${event}`);
   *   }
   *
   *   socket.onAnyOutgoing(catchAllListener);
   *
   *   // remove a specific listener
   *   socket.offAnyOutgoing(catchAllListener);
   *
   *   // or remove all listeners
   *   socket.offAnyOutgoing();
   * });
   *
   * @param listener - the catch-all listener
   */
  public offAnyOutgoing(listener?: (...args: any[]) => void): this {
    if (!this._anyOutgoingListeners) {
      return this;
    }
    if (listener) {
      const listeners = this._anyOutgoingListeners;
      for (let i = 0; i < listeners.length; i++) {
        if (listener === listeners[i]) {
          listeners.splice(i, 1);
          return this;
        }
      }
    } else {
      this._anyOutgoingListeners = [];
    }
    return this;
  }

  /**
   * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
   * e.g. to remove listeners.
   */
  public listenersAnyOutgoing() {
    return this._anyOutgoingListeners || [];
  }

  /**
   * Notify the listeners for each packet sent (emit or broadcast)
   *
   * @param packet
   *
   * @private
   */
  private notifyOutgoingListeners(packet: Packet) {
    if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
      const listeners = this._anyOutgoingListeners.slice();
      for (const listener of listeners) {
        listener.apply(this, packet.data);
      }
    }
  }

  private newBroadcastOperator() {
    const flags = Object.assign({}, this.flags);
    this.flags = {};
    return new BroadcastOperator<
      DecorateAcknowledgementsWithMultipleResponses<EmitEvents>,
      SocketData
    >(this.adapter, new Set<Room>(), new Set<Room>([this.id]), flags);
  }
}
