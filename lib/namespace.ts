import { Socket } from "./socket";
import type { Server } from "./index";
import {
  EventParams,
  EventNames,
  EventsMap,
  StrictEventEmitter,
  DefaultEventsMap,
  DecorateAcknowledgementsWithTimeoutAndMultipleResponses,
  AllButLast,
  Last,
  FirstArg,
  SecondArg,
} from "./typed-events";
import type { Client } from "./client";
import debugModule from "debug";
import type { Adapter, Room, SocketId } from "socket.io-adapter";
import { BroadcastOperator } from "./broadcast-operator";

const debug = debugModule("socket.io:namespace");

export interface ExtendedError extends Error {
  data?: any;
}

export interface NamespaceReservedEventsMap<
  ListenEvents extends EventsMap,
  EmitEvents extends EventsMap,
  ServerSideEvents extends EventsMap,
  SocketData
> {
  connect: (
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  ) => void;
  connection: (
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  ) => void;
}

export interface ServerReservedEventsMap<
  ListenEvents extends EventsMap,
  EmitEvents extends EventsMap,
  ServerSideEvents extends EventsMap,
  SocketData
> extends NamespaceReservedEventsMap<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  > {
  new_namespace: (
    namespace: Namespace<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  ) => void;
}

export const RESERVED_EVENTS: ReadonlySet<string | Symbol> = new Set<
  keyof ServerReservedEventsMap<never, never, never, never>
>(<const>["connect", "connection", "new_namespace"]);

/**
 * A Namespace is a communication channel that allows you to split the logic of your application over a single shared
 * connection.
 *
 * Each namespace has its own:
 *
 * - event handlers
 *
 * ```
 * io.of("/orders").on("connection", (socket) => {
 *   socket.on("order:list", () => {});
 *   socket.on("order:create", () => {});
 * });
 *
 * io.of("/users").on("connection", (socket) => {
 *   socket.on("user:list", () => {});
 * });
 * ```
 *
 * - rooms
 *
 * ```
 * const orderNamespace = io.of("/orders");
 *
 * orderNamespace.on("connection", (socket) => {
 *   socket.join("room1");
 *   orderNamespace.to("room1").emit("hello");
 * });
 *
 * const userNamespace = io.of("/users");
 *
 * userNamespace.on("connection", (socket) => {
 *   socket.join("room1"); // distinct from the room in the "orders" namespace
 *   userNamespace.to("room1").emit("holà");
 * });
 * ```
 *
 * - middlewares
 *
 * ```
 * const orderNamespace = io.of("/orders");
 *
 * orderNamespace.use((socket, next) => {
 *   // ensure the socket has access to the "orders" namespace
 * });
 *
 * const userNamespace = io.of("/users");
 *
 * userNamespace.use((socket, next) => {
 *   // ensure the socket has access to the "users" namespace
 * });
 * ```
 */
export class Namespace<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
  SocketData = any
> extends StrictEventEmitter<
  ServerSideEvents,
  EmitEvents,
  NamespaceReservedEventsMap<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >
> {
  public readonly name: string;
  public readonly sockets: Map<
    SocketId,
    Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  > = new Map();

  public adapter: Adapter;

  /** @private */
  readonly server: Server<
    ListenEvents,
    EmitEvents,
    ServerSideEvents,
    SocketData
  >;

  /** @private */
  _fns: Array<
    (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
      next: (err?: ExtendedError) => void
    ) => void
  > = [];

  /** @private */
  _ids: number = 0;

  /**
   * Namespace constructor.
   *
   * @param server instance
   * @param name
   */
  constructor(
    server: Server<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
    name: string
  ) {
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
    // @ts-ignore
    this.adapter = new (this.server.adapter()!)(this);
  }

  /**
   * Registers a middleware, which is a function that gets executed for every incoming {@link Socket}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.use((socket, next) => {
   *   // ...
   *   next();
   * });
   *
   * @param fn - the middleware function
   */
  public use(
    fn: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
      next: (err?: ExtendedError) => void
    ) => void
  ): this {
    this._fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming client.
   *
   * @param socket - the socket that will get added
   * @param fn - last fn call in the middleware
   * @private
   */
  private run(
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
    fn: (err: ExtendedError | null) => void
  ) {
    const fns = this._fns.slice(0);
    if (!fns.length) return fn(null);

    function run(i: number) {
      fns[i](socket, function (err) {
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
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the “foo” event will be broadcast to all connected clients in the “room-101” room
   * myNamespace.to("room-101").emit("foo", "bar");
   *
   * // with an array of rooms (a client will be notified at most once)
   * myNamespace.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * myNamespace.to("room-101").to("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public to(room: Room | Room[]) {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).to(room);
  }

  /**
   * Targets a room when emitting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // disconnect all clients in the "room-101" room
   * myNamespace.in("room-101").disconnectSockets();
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public in(room: Room | Room[]) {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).in(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   * myNamespace.except("room-101").emit("foo", "bar");
   *
   * // with an array of rooms
   * myNamespace.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * myNamespace.except("room-101").except("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public except(room: Room | Room[]) {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).except(
      room
    );
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @private
   */
  async _add(
    client: Client<ListenEvents, EmitEvents, ServerSideEvents>,
    auth: Record<string, unknown>,
    fn: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
    ) => void
  ) {
    debug("adding socket to nsp %s", this.name);
    const socket = await this._createSocket(client, auth);

    if (
      // @ts-ignore
      this.server.opts.connectionStateRecovery?.skipMiddlewares &&
      socket.recovered &&
      client.conn.readyState === "open"
    ) {
      return this._doConnect(socket, fn);
    }

    this.run(socket, (err) => {
      process.nextTick(() => {
        if ("open" !== client.conn.readyState) {
          debug("next called after client was closed - ignoring socket");
          socket._cleanup();
          return;
        }

        if (err) {
          debug("middleware error, sending CONNECT_ERROR packet to the client");
          socket._cleanup();
          if (client.conn.protocol === 3) {
            return socket._error(err.data || err.message);
          } else {
            return socket._error({
              message: err.message,
              data: err.data,
            });
          }
        }

        this._doConnect(socket, fn);
      });
    });
  }

  private async _createSocket(
    client: Client<ListenEvents, EmitEvents, ServerSideEvents>,
    auth: Record<string, unknown>
  ) {
    const sessionId = auth.pid;
    const offset = auth.offset;
    if (
      // @ts-ignore
      this.server.opts.connectionStateRecovery &&
      typeof sessionId === "string" &&
      typeof offset === "string"
    ) {
      let session;
      try {
        session = await this.adapter.restoreSession(sessionId, offset);
      } catch (e) {
        debug("error while restoring session: %s", e);
      }
      if (session) {
        debug("connection state recovered for sid %s", session.sid);
        return new Socket(this, client, auth, session);
      }
    }
    return new Socket(this, client, auth);
  }

  private _doConnect(
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>,
    fn: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
    ) => void
  ) {
    // track socket
    this.sockets.set(socket.id, socket);

    // it's paramount that the internal `onconnect` logic
    // fires before user-set events to prevent state order
    // violations (such as a disconnection before the connection
    // logic is complete)
    socket._onconnect();
    if (fn) fn(socket);

    // fire user-set events
    this.emitReserved("connect", socket);
    this.emitReserved("connection", socket);
  }

  /**
   * Removes a client. Called by each `Socket`.
   *
   * @private
   */
  _remove(
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents, SocketData>
  ): void {
    if (this.sockets.has(socket.id)) {
      this.sockets.delete(socket.id);
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Emits to all connected clients.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.emit("hello", "world");
   *
   * // all serializable datastructures are supported (no need to call JSON.stringify)
   * myNamespace.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
   *
   * // with an acknowledgement from the clients
   * myNamespace.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @return Always true
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): boolean {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).emit(
      ev,
      ...args
    );
  }

  /**
   * Emits an event and waits for an acknowledgement from all clients.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * try {
   *   const responses = await myNamespace.timeout(1000).emitWithAck("some-event");
   *   console.log(responses); // one response per client
   * } catch (e) {
   *   // some clients did not acknowledge the event in the given delay
   * }
   *
   * @return a Promise that will be fulfilled when all clients have acknowledged the event
   */
  public emitWithAck<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<EmitEvents, Ev>>
  ): Promise<SecondArg<Last<EventParams<EmitEvents, Ev>>>> {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).emitWithAck(ev, ...args);
  }

  /**
   * Sends a `message` event to all clients.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.send("hello");
   *
   * // this is equivalent to
   * myNamespace.emit("message", "hello");
   *
   * @return self
   */
  public send(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Sends a `message` event to all clients. Sends a `message` event. Alias of {@link send}.
   *
   * @return self
   */
  public write(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Sends a message to the other Socket.IO servers of the cluster.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.serverSideEmit("hello", "world");
   *
   * myNamespace.on("hello", (arg1) => {
   *   console.log(arg1); // prints "world"
   * });
   *
   * // acknowledgements (without binary content) are supported too:
   * myNamespace.serverSideEmit("ping", (err, responses) => {
   *  if (err) {
   *     // some servers did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per server (except the current one)
   *   }
   * });
   *
   * myNamespace.on("ping", (cb) => {
   *   cb("pong");
   * });
   *
   * @param ev - the event name
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   */
  public serverSideEmit<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: EventParams<
      DecorateAcknowledgementsWithTimeoutAndMultipleResponses<ServerSideEvents>,
      Ev
    >
  ): boolean {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    args.unshift(ev);
    this.adapter.serverSideEmit(args);
    return true;
  }

  /**
   * Sends a message and expect an acknowledgement from the other Socket.IO servers of the cluster.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * try {
   *   const responses = await myNamespace.serverSideEmitWithAck("ping");
   *   console.log(responses); // one response per server (except the current one)
   * } catch (e) {
   *   // some servers did not acknowledge the event in the given delay
   * }
   *
   * @param ev - the event name
   * @param args - an array of arguments
   *
   * @return a Promise that will be fulfilled when all servers have acknowledged the event
   */
  public serverSideEmitWithAck<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: AllButLast<EventParams<ServerSideEvents, Ev>>
  ): Promise<FirstArg<Last<EventParams<ServerSideEvents, Ev>>>[]> {
    return new Promise((resolve, reject) => {
      args.push((err, responses) => {
        if (err) {
          err.responses = responses;
          return reject(err);
        } else {
          return resolve(responses);
        }
      });
      this.serverSideEmit(
        ev,
        ...(args as any[] as EventParams<ServerSideEvents, Ev>)
      );
    });
  }

  /**
   * Called when a packet is received from another Socket.IO server
   *
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   *
   * @private
   */
  _onServerSideEmit(args: [string, ...any[]]) {
    super.emitUntyped.apply(this, args);
  }

  /**
   * Gets a list of clients.
   *
   * @deprecated this method will be removed in the next major release, please use {@link Namespace#serverSideEmit} or
   * {@link Namespace#fetchSockets} instead.
   */
  public allSockets(): Promise<Set<SocketId>> {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).allSockets();
  }

  /**
   * Sets the compress flag.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.compress(false).emit("hello");
   *
   * @param compress - if `true`, compresses the sending data
   * @return self
   */
  public compress(compress: boolean) {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).compress(
      compress
    );
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.volatile.emit("hello"); // the clients may or may not receive it
   *
   * @return self
   */
  public get volatile() {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).volatile;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the “foo” event will be broadcast to all connected clients on this node
   * myNamespace.local.emit("foo", "bar");
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */
  public get local() {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).local;
  }

  /**
   * Adds a timeout in milliseconds for the next operation.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @param timeout
   */
  public timeout(timeout: number) {
    return new BroadcastOperator<EmitEvents, SocketData>(this.adapter).timeout(
      timeout
    );
  }

  /**
   * Returns the matching socket instances.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // return all Socket instances
   * const sockets = await myNamespace.fetchSockets();
   *
   * // return all Socket instances in the "room1" room
   * const sockets = await myNamespace.in("room1").fetchSockets();
   *
   * for (const socket of sockets) {
   *   console.log(socket.id);
   *   console.log(socket.handshake);
   *   console.log(socket.rooms);
   *   console.log(socket.data);
   *
   *   socket.emit("hello");
   *   socket.join("room1");
   *   socket.leave("room2");
   *   socket.disconnect();
   * }
   */
  public fetchSockets() {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).fetchSockets();
  }

  /**
   * Makes the matching socket instances join the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances join the "room1" room
   * myNamespace.socketsJoin("room1");
   *
   * // make all socket instances in the "room1" room join the "room2" and "room3" rooms
   * myNamespace.in("room1").socketsJoin(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */
  public socketsJoin(room: Room | Room[]) {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).socketsJoin(room);
  }

  /**
   * Makes the matching socket instances leave the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances leave the "room1" room
   * myNamespace.socketsLeave("room1");
   *
   * // make all socket instances in the "room1" room leave the "room2" and "room3" rooms
   * myNamespace.in("room1").socketsLeave(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */
  public socketsLeave(room: Room | Room[]) {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).socketsLeave(room);
  }

  /**
   * Makes the matching socket instances disconnect.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances disconnect (the connections might be kept alive for other namespaces)
   * myNamespace.disconnectSockets();
   *
   * // make all socket instances in the "room1" room disconnect and close the underlying connections
   * myNamespace.in("room1").disconnectSockets(true);
   *
   * @param close - whether to close the underlying connection
   */
  public disconnectSockets(close: boolean = false) {
    return new BroadcastOperator<EmitEvents, SocketData>(
      this.adapter
    ).disconnectSockets(close);
  }
}
