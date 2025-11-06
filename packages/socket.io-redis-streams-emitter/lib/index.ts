import debugModule from "debug";
import type {
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";
import { encode } from "@msgpack/msgpack";
import { hasBinary, XADD } from "./util";
import { ClusterMessage, MessageType, BroadcastFlags } from "socket.io-adapter";

const debug = debugModule("socket.io-redis-streams-emitter");
const EMITTER_UID = "emitter";

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

// TODO move to the socket.io-adapter package
abstract class BaseEmitter<
  EmitEvents extends EventsMap = DefaultEventsMap,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
> {
  protected abstract publish(
    message: DistributiveOmit<ClusterMessage, "uid" | "nsp">,
  ): void;

  /**
   * Emits to all clients.
   *
   * @return Always true
   * @public
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): true {
    return this.newBroadcastOperator().emit(ev, ...args);
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public to(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.newBroadcastOperator().to(room);
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public in(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.newBroadcastOperator().in(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public except(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.newBroadcastOperator().except(room);
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return BroadcastOperator
   * @public
   */
  public get volatile(): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.newBroadcastOperator().volatile;
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return BroadcastOperator
   * @public
   */
  public compress(
    compress: boolean,
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.newBroadcastOperator().compress(compress);
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    return this.newBroadcastOperator().socketsJoin(rooms);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    return this.newBroadcastOperator().socketsLeave(rooms);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    return this.newBroadcastOperator().disconnectSockets(close);
  }

  /**
   * Send a packet to the Socket.IO servers in the cluster
   *
   * @param ev - the event name
   * @param args - any number of serializable arguments
   */
  public serverSideEmit<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: EventParams<ServerSideEvents, Ev>
  ): void {
    return this.newBroadcastOperator().serverSideEmit(ev, ...args);
  }

  private newBroadcastOperator() {
    return new BroadcastOperator<EmitEvents, ServerSideEvents>((msg) =>
      this.publish(msg),
    );
  }
}

export const RESERVED_EVENTS: ReadonlySet<string | Symbol> = new Set(<const>[
  "connect",
  "connect_error",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener",
]);

export class BroadcastOperator<
  EmitEvents extends EventsMap,
  ServerSideEvents extends EventsMap,
> implements TypedEventBroadcaster<EmitEvents>
{
  constructor(
    private readonly publish: (
      message: DistributiveOmit<ClusterMessage, "uid" | "nsp">,
    ) => void,
    private readonly rooms: Set<string> = new Set<string>(),
    private readonly exceptRooms: Set<string> = new Set<string>(),
    private readonly flags: BroadcastFlags = {},
  ) {}

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public to(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    const rooms = new Set(this.rooms);
    if (Array.isArray(room)) {
      room.forEach((r) => rooms.add(r));
    } else {
      rooms.add(room);
    }
    return new BroadcastOperator(
      this.publish,
      rooms,
      this.exceptRooms,
      this.flags,
    );
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public in(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    return this.to(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public except(
    room: string | string[],
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    const exceptRooms = new Set(this.exceptRooms);
    if (Array.isArray(room)) {
      room.forEach((r) => exceptRooms.add(r));
    } else {
      exceptRooms.add(room);
    }
    return new BroadcastOperator(
      this.publish,
      this.rooms,
      exceptRooms,
      this.flags,
    );
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return a new BroadcastOperator instance
   * @public
   */
  public compress(
    compress: boolean,
  ): BroadcastOperator<EmitEvents, ServerSideEvents> {
    const flags = Object.assign({}, this.flags, { compress });
    return new BroadcastOperator(
      this.publish,
      this.rooms,
      this.exceptRooms,
      flags,
    );
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return a new BroadcastOperator instance
   * @public
   */
  public get volatile(): BroadcastOperator<EmitEvents, ServerSideEvents> {
    const flags = Object.assign({}, this.flags, { volatile: true });
    return new BroadcastOperator(
      this.publish,
      this.rooms,
      this.exceptRooms,
      flags,
    );
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
  ): true {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }

    // set up packet object
    const data = [ev, ...args];
    const packet = {
      type: 2, // EVENT
      data: data,
    };

    const opts = {
      rooms: [...this.rooms],
      flags: this.flags,
      except: [...this.exceptRooms],
    };

    this.publish({
      type: MessageType.BROADCAST,
      data: {
        packet,
        opts,
      },
    });

    return true;
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    this.publish({
      type: MessageType.SOCKETS_JOIN,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
          flags: {},
        },
        rooms: Array.isArray(rooms) ? rooms : [rooms],
      },
    });
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    this.publish({
      type: MessageType.SOCKETS_LEAVE,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
          flags: {},
        },
        rooms: Array.isArray(rooms) ? rooms : [rooms],
      },
    });
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    this.publish({
      type: MessageType.DISCONNECT_SOCKETS,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
          flags: {},
        },
        close,
      },
    });
  }

  /**
   * Send a packet to the Socket.IO servers in the cluster
   *
   * @param ev - the event name
   * @param args - any number of serializable arguments
   */
  public serverSideEmit<Ev extends EventNames<ServerSideEvents>>(
    ev: Ev,
    ...args: EventParams<ServerSideEvents, Ev>
  ): void {
    const withAck = args.length && typeof args[args.length - 1] === "function";

    if (withAck) {
      throw new Error("Acknowledgements are not supported");
    }

    this.publish({
      type: MessageType.SERVER_SIDE_EMIT,
      data: {
        packet: [ev, ...args],
      },
    });
  }
}

function flattenPayload(message: ClusterMessage) {
  const rawMessage = {
    uid: message.uid,
    nsp: message.nsp,
    type: message.type.toString(),
    data: undefined as string | undefined,
  };

  // @ts-expect-error
  const data = message.data;

  if (data) {
    const mayContainBinary = [
      MessageType.BROADCAST,
      MessageType.FETCH_SOCKETS_RESPONSE,
      MessageType.SERVER_SIDE_EMIT,
      MessageType.SERVER_SIDE_EMIT_RESPONSE,
      MessageType.BROADCAST_ACK,
    ].includes(message.type);

    if (mayContainBinary && hasBinary(data)) {
      rawMessage.data = Buffer.from(encode(data)).toString("base64");
    } else {
      rawMessage.data = JSON.stringify(data);
    }
  }

  return rawMessage;
}

export interface RedisStreamsEmitterOptions {
  /**
   * The name of the Redis stream.
   * @default "socket.io"
   */
  streamName?: string;
  /**
   * The maximum size of the stream. Almost exact trimming (~) is used.
   * @default 10_000
   */
  maxLen?: number;
}

export class Emitter<
  EmitEvents extends EventsMap = DefaultEventsMap,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
> extends BaseEmitter<EmitEvents, ServerSideEvents> {
  readonly #redisClient: any;
  readonly #opts: Required<RedisStreamsEmitterOptions>;
  readonly #nsp: string;

  constructor(
    redisClient: any,
    opts: RedisStreamsEmitterOptions = {},
    nsp = "/",
  ) {
    super();
    this.#redisClient = redisClient;
    this.#opts = Object.assign(
      {
        streamName: "socket.io",
        maxLen: 10_000,
      },
      opts,
    );
    this.#nsp = nsp;
  }

  public of(nsp: string) {
    return new Emitter(this.#redisClient, this.#opts, nsp);
  }

  protected override publish(
    message: DistributiveOmit<ClusterMessage, "uid" | "nsp">,
  ) {
    (message as ClusterMessage).uid = EMITTER_UID;
    (message as ClusterMessage).nsp = this.#nsp;

    debug(
      "publishing message %s to stream %s",
      message.type,
      this.#opts.streamName,
    );

    if (message.type === MessageType.BROADCAST) {
      // @ts-expect-error FIXME untyped packet object
      message.data.packet.nsp = this.#nsp;
    }

    return XADD(
      this.#redisClient,
      this.#opts.streamName,
      flattenPayload(message as ClusterMessage),
      this.#opts.maxLen,
    );
  }
}
