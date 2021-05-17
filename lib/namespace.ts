import { Socket } from "./socket";
import type { Server } from "./index";
import {
  EventParams,
  EventNames,
  EventsMap,
  StrictEventEmitter,
  DefaultEventsMap,
} from "./typed-events";
import type { Client } from "./client";
import debugModule from "debug";
import type { Adapter, Room, SocketId } from "socket.io-adapter";
import { BroadcastOperator, RemoteSocket } from "./broadcast-operator";

const debug = debugModule("socket.io:namespace");

export interface ExtendedError extends Error {
  data?: any;
}

export interface NamespaceReservedEventsMap<
  ListenEvents extends EventsMap,
  EmitEvents extends EventsMap,
  ServerSideEvents extends EventsMap
> {
  connect: (socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>) => void;
  connection: (
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>
  ) => void;
}

export interface ServerReservedEventsMap<
  ListenEvents,
  EmitEvents,
  ServerSideEvents
> extends NamespaceReservedEventsMap<
    ListenEvents,
    EmitEvents,
    ServerSideEvents
  > {
  new_namespace: (
    namespace: Namespace<ListenEvents, EmitEvents, ServerSideEvents>
  ) => void;
}

export const RESERVED_EVENTS: ReadonlySet<string | Symbol> = new Set<
  keyof ServerReservedEventsMap<never, never, never>
>(<const>["connect", "connection", "new_namespace"]);

export class Namespace<
  ListenEvents extends EventsMap = DefaultEventsMap,
  EmitEvents extends EventsMap = ListenEvents,
  ServerSideEvents extends EventsMap = DefaultEventsMap
> extends StrictEventEmitter<
  ServerSideEvents,
  EmitEvents,
  NamespaceReservedEventsMap<ListenEvents, EmitEvents, ServerSideEvents>
> {
  public readonly name: string;
  public readonly sockets: Map<
    SocketId,
    Socket<ListenEvents, EmitEvents, ServerSideEvents>
  > = new Map();

  public adapter: Adapter;

  /** @private */
  readonly server: Server<ListenEvents, EmitEvents, ServerSideEvents>;

  /** @private */
  _fns: Array<
    (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>,
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
    server: Server<ListenEvents, EmitEvents, ServerSideEvents>,
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
   * Sets up namespace middleware.
   *
   * @return self
   * @public
   */
  public use(
    fn: (
      socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>,
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
    socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>,
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
   * @param room
   * @return self
   * @public
   */
  public to(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).to(room);
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return self
   * @public
   */
  public in(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).in(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return self
   * @public
   */
  public except(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).except(room);
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @private
   */
  _add(
    client: Client<ListenEvents, EmitEvents, ServerSideEvents>,
    query,
    fn?: () => void
  ): Socket<ListenEvents, EmitEvents, ServerSideEvents> {
    debug("adding socket to nsp %s", this.name);
    const socket = new Socket(this, client, query);
    this.run(socket, (err) => {
      process.nextTick(() => {
        if ("open" == client.conn.readyState) {
          if (err) {
            if (client.conn.protocol === 3) {
              return socket._error(err.data || err.message);
            } else {
              return socket._error({
                message: err.message,
                data: err.data,
              });
            }
          }

          // track socket
          this.sockets.set(socket.id, socket);

          // it's paramount that the internal `onconnect` logic
          // fires before user-set events to prevent state order
          // violations (such as a disconnection before the connection
          // logic is complete)
          socket._onconnect();
          if (fn) fn();

          // fire user-set events
          this.emitReserved("connect", socket);
          this.emitReserved("connection", socket);
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
  _remove(socket: Socket<ListenEvents, EmitEvents, ServerSideEvents>): void {
    if (this.sockets.has(socket.id)) {
      this.sockets.delete(socket.id);
    } else {
      debug("ignoring remove for %s", socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return Always true
   * @public
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): boolean {
    return new BroadcastOperator<EmitEvents>(this.adapter).emit(ev, ...args);
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return self
   * @public
   */
  public send(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return self
   * @public
   */
  public write(...args: EventParams<EmitEvents, "message">): this {
    this.emit("message", ...args);
    return this;
  }

  /**
   * Emit a packet to other Socket.IO servers
   *
   * @param ev - the event name
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   * @public
   */
  public serverSideEmit<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: EventParams<ServerSideEvents, Ev>
  ): boolean {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${ev}" is a reserved event name`);
    }
    args.unshift(ev);
    this.adapter.serverSideEmit(args);
    return true;
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
   * @return self
   * @public
   */
  public allSockets(): Promise<Set<SocketId>> {
    return new BroadcastOperator(this.adapter).allSockets();
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return self
   * @public
   */
  public compress(compress: boolean): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).compress(compress);
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return self
   * @public
   */
  public get volatile(): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).volatile;
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return self
   * @public
   */
  public get local(): BroadcastOperator<EmitEvents> {
    return new BroadcastOperator(this.adapter).local;
  }

  /**
   * Returns the matching socket instances
   *
   * @public
   */
  public fetchSockets(): Promise<RemoteSocket<EmitEvents>[]> {
    return new BroadcastOperator(this.adapter).fetchSockets();
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param room
   * @public
   */
  public socketsJoin(room: Room | Room[]): void {
    return new BroadcastOperator(this.adapter).socketsJoin(room);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param room
   * @public
   */
  public socketsLeave(room: Room | Room[]): void {
    return new BroadcastOperator(this.adapter).socketsLeave(room);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    return new BroadcastOperator(this.adapter).disconnectSockets(close);
  }
}
