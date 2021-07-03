import type { BroadcastFlags, Room, SocketId } from "socket.io-adapter";
import { Handshake, RESERVED_EVENTS, Socket } from "./socket";
import { PacketType } from "socket.io-parser";
import type { Adapter } from "socket.io-adapter";
import type {
  EventParams,
  EventNames,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";

export class BroadcastOperator<EmitEvents extends EventsMap>
  implements TypedEventBroadcaster<EmitEvents>
{
  constructor(
    private readonly adapter: Adapter,
    private readonly rooms: Set<Room> = new Set<Room>(),
    private readonly exceptRooms: Set<Room> = new Set<Room>(),
    private readonly flags: BroadcastFlags = {}
  ) {}

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public to(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    const rooms = new Set(this.rooms);
    if (Array.isArray(room)) {
      room.forEach((r) => rooms.add(r));
    } else {
      rooms.add(room);
    }
    return new BroadcastOperator(
      this.adapter,
      rooms,
      this.exceptRooms,
      this.flags
    );
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public in(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    return this.to(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public except(room: Room | Room[]): BroadcastOperator<EmitEvents> {
    const exceptRooms = new Set(this.exceptRooms);
    if (Array.isArray(room)) {
      room.forEach((r) => exceptRooms.add(r));
    } else {
      exceptRooms.add(room);
    }
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      exceptRooms,
      this.flags
    );
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return a new BroadcastOperator instance
   * @public
   */
  public compress(compress: boolean): BroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { compress });
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      this.exceptRooms,
      flags
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
  public get volatile(): BroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { volatile: true });
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      this.exceptRooms,
      flags
    );
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @return a new BroadcastOperator instance
   * @public
   */
  public get local(): BroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { local: true });
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      this.exceptRooms,
      flags
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
  ): boolean {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${ev}" is a reserved event name`);
    }
    // set up packet object
    const data = [ev, ...args];
    const packet = {
      type: PacketType.EVENT,
      data: data,
    };

    if ("function" == typeof data[data.length - 1]) {
      throw new Error("Callbacks are not supported when broadcasting");
    }

    this.adapter.broadcast(packet, {
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags,
    });

    return true;
  }

  /**
   * Gets a list of clients.
   *
   * @public
   */
  public allSockets(): Promise<Set<SocketId>> {
    if (!this.adapter) {
      throw new Error(
        "No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?"
      );
    }
    return this.adapter.sockets(this.rooms);
  }

  /**
   * Returns the matching socket instances
   *
   * @public
   */
  public fetchSockets(): Promise<RemoteSocket<EmitEvents>[]> {
    return this.adapter
      .fetchSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
      })
      .then((sockets) => {
        return sockets.map((socket) => {
          if (socket instanceof Socket) {
            // FIXME the TypeScript compiler complains about missing private properties
            return socket as unknown as RemoteSocket<EmitEvents>;
          } else {
            return new RemoteSocket(this.adapter, socket as SocketDetails);
          }
        });
      });
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param room
   * @public
   */
  public socketsJoin(room: Room | Room[]): void {
    this.adapter.addSockets(
      {
        rooms: this.rooms,
        except: this.exceptRooms,
      },
      Array.isArray(room) ? room : [room]
    );
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param room
   * @public
   */
  public socketsLeave(room: Room | Room[]): void {
    this.adapter.delSockets(
      {
        rooms: this.rooms,
        except: this.exceptRooms,
      },
      Array.isArray(room) ? room : [room]
    );
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    this.adapter.disconnectSockets(
      {
        rooms: this.rooms,
        except: this.exceptRooms,
      },
      close
    );
  }
}

/**
 * Format of the data when the Socket instance exists on another Socket.IO server
 */
interface SocketDetails {
  id: SocketId;
  handshake: Handshake;
  rooms: Room[];
  data: any;
}

/**
 * Expose of subset of the attributes and methods of the Socket class
 */
export class RemoteSocket<EmitEvents extends EventsMap>
  implements TypedEventBroadcaster<EmitEvents>
{
  public readonly id: SocketId;
  public readonly handshake: Handshake;
  public readonly rooms: Set<Room>;
  public readonly data: any;

  private readonly operator: BroadcastOperator<EmitEvents>;

  constructor(adapter: Adapter, details: SocketDetails) {
    this.id = details.id;
    this.handshake = details.handshake;
    this.rooms = new Set(details.rooms);
    this.data = details.data;
    this.operator = new BroadcastOperator(adapter, new Set([this.id]));
  }

  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): boolean {
    return this.operator.emit(ev, ...args);
  }

  /**
   * Joins a room.
   *
   * @param {String|Array} room - room or array of rooms
   * @public
   */
  public join(room: Room | Room[]): void {
    return this.operator.socketsJoin(room);
  }

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @public
   */
  public leave(room: Room): void {
    return this.operator.socketsLeave(room);
  }

  /**
   * Disconnects this client.
   *
   * @param {Boolean} close - if `true`, closes the underlying connection
   * @return {Socket} self
   *
   * @public
   */
  public disconnect(close = false): this {
    this.operator.disconnectSockets(close);
    return this;
  }
}
