import type { BroadcastFlags, Room, SocketId } from "socket.io-adapter";
import { RESERVED_EVENTS } from "./socket";
import { PacketType } from "socket.io-parser";
import type { Adapter } from "socket.io-adapter";

export class BroadcastOperator {
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
  public to(room: Room): BroadcastOperator {
    return new BroadcastOperator(
      this.adapter,
      new Set([...this.rooms, room]),
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
  public in(room: Room): BroadcastOperator {
    return this.to(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public except(room: Room): BroadcastOperator {
    return new BroadcastOperator(
      this.adapter,
      this.rooms,
      new Set([...this.exceptRooms, room]),
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
  public compress(compress: boolean): BroadcastOperator {
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
  public get volatile(): BroadcastOperator {
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
  public get local(): BroadcastOperator {
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
  public emit(ev: string | Symbol, ...args: any[]): true {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${ev}" is a reserved event name`);
    }
    // set up packet object
    args.unshift(ev);
    const packet = {
      type: PacketType.EVENT,
      data: args,
    };

    if ("function" == typeof args[args.length - 1]) {
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
}
