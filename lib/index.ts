import { EventEmitter } from "events";

export type SocketId = string;
export type Room = string;

export interface BroadcastFlags {
  volatile?: boolean;
  compress?: boolean;
  local?: boolean;
  broadcast?: boolean;
  binary?: boolean;
}

export interface BroadcastOptions {
  rooms: Set<Room>;
  except?: Set<SocketId>;
  flags?: BroadcastFlags;
}

export class Adapter extends EventEmitter {
  protected rooms: Map<Room, Set<SocketId>> = new Map();
  protected sids: Map<SocketId, Set<Room>> = new Map();
  private readonly encoder;

  /**
   * In-memory adapter constructor.
   *
   * @param {Namespace} nsp
   */
  constructor(readonly nsp: any) {
    super();
    this.encoder = nsp.server.encoder;
  }

  /**
   * To be overridden
   */
  public init(): Promise<void> | void {}

  /**
   * To be overridden
   */
  public close(): Promise<void> | void {}

  /**
   * Adds a socket to a list of room.
   *
   * @param {SocketId}  id      the socket id
   * @param {Set<Room>} rooms   a set of rooms
   * @public
   */
  public addAll(id: SocketId, rooms: Set<Room>): Promise<void> | void {
    if (!this.sids.has(id)) {
      this.sids.set(id, new Set());
    }

    for (const room of rooms) {
      this.sids.get(id).add(room);

      if (!this.rooms.has(room)) {
        this.rooms.set(room, new Set());
      }
      this.rooms.get(room).add(id);
    }
  }

  /**
   * Removes a socket from a room.
   *
   * @param {SocketId} id     the socket id
   * @param {Room}     room   the room name
   */
  public del(id: SocketId, room: Room): Promise<void> | void {
    if (this.sids.has(id)) {
      this.sids.get(id).delete(room);
    }

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(id);
      if (this.rooms.get(room).size === 0) this.rooms.delete(room);
    }
  }

  /**
   * Removes a socket from all rooms it's joined.
   *
   * @param {SocketId} id   the socket id
   */
  public delAll(id: SocketId): void {
    if (!this.sids.has(id)) {
      return;
    }

    for (const room of this.sids.get(id)) {
      if (this.rooms.has(room)) {
        this.rooms.get(room).delete(id);
        if (this.rooms.get(room).size === 0) this.rooms.delete(room);
      }
    }

    this.sids.delete(id);
  }

  /**
   * Broadcasts a packet.
   *
   * Options:
   *  - `flags` {Object} flags for this packet
   *  - `except` {Array} sids that should be excluded
   *  - `rooms` {Array} list of rooms to broadcast to
   *
   * @param {Object} packet   the packet object
   * @param {Object} opts     the options
   * @public
   */
  public broadcast(packet: any, opts: BroadcastOptions): void {
    const rooms = opts.rooms;
    const except = opts.except || new Set();
    const flags = opts.flags || {};
    const packetOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress
    };
    const ids = new Set();

    packet.nsp = this.nsp.name;
    const encodedPackets = this.encoder.encode(packet);

    if (rooms.size) {
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (ids.has(id) || except.has(id)) continue;
          const socket = this.nsp.sockets.get(id);
          if (socket) {
            socket.packet(encodedPackets, packetOpts);
            ids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (except.has(id)) continue;
        const socket = this.nsp.sockets.get(id);
        if (socket) socket.packet(encodedPackets, packetOpts);
      }
    }
  }

  /**
   * Gets a list of sockets by sid.
   *
   * @param {Set<Room>} rooms   the explicit set of rooms to check.
   */
  public sockets(rooms: Set<Room>): Promise<Set<SocketId>> {
    const sids = new Set<SocketId>();

    if (rooms.size) {
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (this.nsp.sockets.has(id)) {
            sids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (this.nsp.sockets.has(id)) sids.add(id);
      }
    }

    return Promise.resolve(sids);
  }

  /**
   * Gets the list of rooms a given socket has joined.
   *
   * @param {SocketId} id   the socket id
   */
  public socketRooms(id: SocketId): Set<Room> | undefined {
    return this.sids.get(id);
  }
}
