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

export class BroadcastOperator<EmitEvents extends EventsMap, SocketData>
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
  public to(room: Room | Room[]): BroadcastOperator<EmitEvents, SocketData> {
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
  public in(room: Room | Room[]): BroadcastOperator<EmitEvents, SocketData> {
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
    room: Room | Room[]
  ): BroadcastOperator<EmitEvents, SocketData> {
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
  public compress(
    compress: boolean
  ): BroadcastOperator<EmitEvents, SocketData> {
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
  public get volatile(): BroadcastOperator<EmitEvents, SocketData> {
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
  public get local(): BroadcastOperator<EmitEvents, SocketData> {
    const flags = Object.assign({}, this.flags, { local: true });
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      this.exceptRooms,
      flags
    );
  }

  /**
   * Adds a timeout in milliseconds for the next operation
   *
   * <pre><code>
   *
   * io.timeout(1000).emit("some-event", (err, responses) => {
   *   // ...
   * });
   *
   * </pre></code>
   *
   * @param timeout
   */
  public timeout(timeout: number) {
    const flags = Object.assign({}, this.flags, { timeout });
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
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    // set up packet object
    const data = [ev, ...args];
    const packet = {
      type: PacketType.EVENT,
      data: data,
    };

    const withAck = typeof data[data.length - 1] === "function";

    if (!withAck) {
      this.adapter.broadcast(packet, {
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags,
      });

      return true;
    }

    const ack = data.pop() as (...args: any[]) => void;
    let timedOut = false;
    let responses: any[] = [];

    const timer = setTimeout(() => {
      timedOut = true;
      ack.apply(this, [new Error("operation has timed out"), responses]);
    }, this.flags.timeout);

    let expectedServerCount = -1;
    let actualServerCount = 0;
    let expectedClientCount = 0;

    const checkCompleteness = () => {
      if (
        !timedOut &&
        expectedServerCount === actualServerCount &&
        responses.length === expectedClientCount
      ) {
        clearTimeout(timer);
        ack.apply(this, [null, responses]);
      }
    };

    this.adapter.broadcastWithAck(
      packet,
      {
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags,
      },
      (clientCount) => {
        // each Socket.IO server in the cluster sends the number of clients that were notified
        expectedClientCount += clientCount;
        actualServerCount++;
        checkCompleteness();
      },
      (clientResponse) => {
        // each client sends an acknowledgement
        responses.push(clientResponse);
        checkCompleteness();
      }
    );

    this.adapter.serverCount().then((serverCount) => {
      expectedServerCount = serverCount;
      checkCompleteness();
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
  public fetchSockets<SocketData = any>(): Promise<
    RemoteSocket<EmitEvents, SocketData>[]
  > {
    return this.adapter
      .fetchSockets({
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags,
      })
      .then((sockets) => {
        return sockets.map((socket) => {
          if (socket instanceof Socket) {
            // FIXME the TypeScript compiler complains about missing private properties
            return socket as unknown as RemoteSocket<EmitEvents, SocketData>;
          } else {
            return new RemoteSocket(
              this.adapter,
              socket as SocketDetails<SocketData>
            );
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
        flags: this.flags,
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
        flags: this.flags,
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
        flags: this.flags,
      },
      close
    );
  }
}

/**
 * Format of the data when the Socket instance exists on another Socket.IO server
 */
interface SocketDetails<SocketData> {
  id: SocketId;
  handshake: Handshake;
  rooms: Room[];
  data: SocketData;
}

/**
 * Expose of subset of the attributes and methods of the Socket class
 */
export class RemoteSocket<EmitEvents extends EventsMap, SocketData>
  implements TypedEventBroadcaster<EmitEvents>
{
  public readonly id: SocketId;
  public readonly handshake: Handshake;
  public readonly rooms: Set<Room>;
  public readonly data: SocketData;

  private readonly operator: BroadcastOperator<EmitEvents, SocketData>;

  constructor(adapter: Adapter, details: SocketDetails<SocketData>) {
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
