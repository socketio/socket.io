import debugModule from "debug";
import type {
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";
import { encode } from "@msgpack/msgpack";

const debug = debugModule("socket.io-postgres-emitter");
const EMITTER_UID = "emitter";

const hasBinary = (obj: any, toJSON?: boolean): boolean => {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
    return true;
  }

  if (Array.isArray(obj)) {
    for (let i = 0, l = obj.length; i < l; i++) {
      if (hasBinary(obj[i])) {
        return true;
      }
    }
    return false;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
      return true;
    }
  }

  if (obj.toJSON && typeof obj.toJSON === "function" && !toJSON) {
    return hasBinary(obj.toJSON(), true);
  }

  return false;
};

/**
 * Event types, for messages between nodes
 */

enum EventType {
  INITIAL_HEARTBEAT = 1,
  HEARTBEAT,
  BROADCAST,
  SOCKETS_JOIN,
  SOCKETS_LEAVE,
  DISCONNECT_SOCKETS,
  FETCH_SOCKETS,
  FETCH_SOCKETS_RESPONSE,
  SERVER_SIDE_EMIT,
  SERVER_SIDE_EMIT_RESPONSE,
}

interface BroadcastFlags {
  volatile?: boolean;
  compress?: boolean;
}

export interface PostgresEmitterOptions {
  /**
   * The prefix of the notification channel
   * @default "socket.io"
   */
  channelPrefix: string;
  /**
   * The name of the table for payloads over the 8000 bytes limit or containing binary data
   */
  tableName: string;
  /**
   * The threshold for the payload size in bytes (see https://www.postgresql.org/docs/current/sql-notify.html)
   * @default 8000
   */
  payloadThreshold: number;
}

export class Emitter<
  EmitEvents extends EventsMap = DefaultEventsMap,
  ServerSideEvents extends EventsMap = DefaultEventsMap,
> {
  public readonly channel: string;
  public readonly tableName: string;
  public payloadThreshold: number;

  constructor(
    readonly pool: any,
    readonly nsp: string = "/",
    opts: Partial<PostgresEmitterOptions> = {},
  ) {
    const channelPrefix = opts.channelPrefix || "socket.io";
    this.channel = `${channelPrefix}#${nsp}`;
    this.tableName = opts.tableName || "socket_io_attachments";
    this.payloadThreshold = opts.payloadThreshold || 8000;
  }

  /**
   * Return a new emitter for the given namespace.
   *
   * @param nsp - namespace
   * @public
   */
  public of(nsp: string): Emitter {
    return new Emitter(this.pool, (nsp[0] !== "/" ? "/" : "") + nsp);
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
    return new BroadcastOperator<EmitEvents, ServerSideEvents>(this).emit(
      ev,
      ...args,
    );
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
    return new BroadcastOperator(this).to(room);
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
    return new BroadcastOperator(this).in(room);
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
    return new BroadcastOperator(this).except(room);
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
    return new BroadcastOperator(this).volatile;
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
    return new BroadcastOperator(this).compress(compress);
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    return new BroadcastOperator(this).socketsJoin(rooms);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    return new BroadcastOperator(this).socketsLeave(rooms);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    return new BroadcastOperator(this).disconnectSockets(close);
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
    return new BroadcastOperator<EmitEvents, ServerSideEvents>(
      this,
    ).serverSideEmit(ev, ...args);
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
    private readonly emitter: Emitter,
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
      this.emitter,
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
      this.emitter,
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
      this.emitter,
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
      this.emitter,
      this.rooms,
      this.exceptRooms,
      flags,
    );
  }

  private async publish(document: any) {
    document.uid = EMITTER_UID;

    try {
      if (
        [
          EventType.BROADCAST,
          EventType.SERVER_SIDE_EMIT,
          EventType.SERVER_SIDE_EMIT_RESPONSE,
        ].includes(document.type) &&
        hasBinary(document)
      ) {
        return await this.publishWithAttachment(document);
      }

      const payload = JSON.stringify(document);
      if (Buffer.byteLength(payload) > this.emitter.payloadThreshold) {
        return await this.publishWithAttachment(document);
      }

      debug(
        "sending event of type %s to channel %s",
        document.type,
        this.emitter.channel,
      );
      await this.emitter.pool.query("SELECT pg_notify($1, $2)", [
        this.emitter.channel,
        payload,
      ]);
    } catch (err) {
      // @ts-ignore
      this.emit("error", err);
    }
  }

  private async publishWithAttachment(document: any) {
    const payload = encode(document);

    debug(
      "sending event of type %s with attachment to channel %s",
      document.type,
      this.emitter.channel,
    );
    const result = await this.emitter.pool.query(
      `INSERT INTO ${this.emitter.tableName} (payload) VALUES ($1) RETURNING id;`,
      [payload],
    );
    const attachmentId = result.rows[0].id;
    const headerPayload = JSON.stringify({
      uid: document.uid,
      type: document.type,
      attachmentId,
    });
    await this.emitter.pool.query("SELECT pg_notify($1, $2)", [
      this.emitter.channel,
      headerPayload,
    ]);
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
      nsp: this.emitter.nsp,
    };

    const opts = {
      rooms: [...this.rooms],
      flags: this.flags,
      except: [...this.exceptRooms],
    };

    this.publish({
      type: EventType.BROADCAST,
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
      type: EventType.SOCKETS_JOIN,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
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
      type: EventType.SOCKETS_LEAVE,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
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
      type: EventType.DISCONNECT_SOCKETS,
      data: {
        opts: {
          rooms: [...this.rooms],
          except: [...this.exceptRooms],
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
      type: EventType.SERVER_SIDE_EMIT,
      data: {
        packet: [ev, ...args],
      },
    });
  }
}
