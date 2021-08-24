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
  public rooms: Map<Room, Set<SocketId>> = new Map();
  public sids: Map<SocketId, Set<Room>> = new Map();
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
        this.emit("create-room", room);
      }
      if (!this.rooms.get(room).has(id)) {
        this.rooms.get(room).add(id);
        this.emit("join-room", room, id);
      }
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

    this._del(room, id);
  }

  private _del(room: Room, id: SocketId) {
    const _room = this.rooms.get(room);
    if (_room != null) {
      const deleted = _room.delete(id);
      if (deleted) {
        this.emit("leave-room", room, id);
      }
      if (_room.size === 0 && this.rooms.delete(room)) {
        this.emit("delete-room", room);
      }
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
      this._del(room, id);
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
    const flags = opts.flags || {};
    const basePacketOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress
    };

    packet.nsp = this.nsp.name;
    const encodedPackets = this.encoder.encode(packet);

    const packetOpts = encodedPackets.map(encodedPacket => {
      if (typeof encodedPacket === "string") {
        return {
          ...basePacketOpts,
          wsPreEncoded: "4" + encodedPacket // "4" being the "message" packet type in Engine.IO
        };
      } else {
        return basePacketOpts;
      }
    });

    this.apply(opts, socket => {
      for (let i = 0; i < encodedPackets.length; i++) {
        socket.client.writeToEngine(encodedPackets[i], packetOpts[i]);
      }
    });
  }

  /**
   * Gets a list of sockets by sid.
   *
   * @param {Set<Room>} rooms   the explicit set of rooms to check.
   */
  public sockets(rooms: Set<Room>): Promise<Set<SocketId>> {
    const sids = new Set<SocketId>();

    this.apply({ rooms }, socket => {
      sids.add(socket.id);
    });

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

  /**
   * Returns the matching socket instances
   *
   * @param opts - the filters to apply
   */
  public fetchSockets(opts: BroadcastOptions): Promise<any[]> {
    const sockets = [];

    this.apply(opts, socket => {
      sockets.push(socket);
    });

    return Promise.resolve(sockets);
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param opts - the filters to apply
   * @param rooms - the rooms to join
   */
  public addSockets(opts: BroadcastOptions, rooms: Room[]): void {
    this.apply(opts, socket => {
      socket.join(rooms);
    });
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param opts - the filters to apply
   * @param rooms - the rooms to leave
   */
  public delSockets(opts: BroadcastOptions, rooms: Room[]): void {
    this.apply(opts, socket => {
      rooms.forEach(room => socket.leave(room));
    });
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param opts - the filters to apply
   * @param close - whether to close the underlying connection
   */
  public disconnectSockets(opts: BroadcastOptions, close: boolean): void {
    this.apply(opts, socket => {
      socket.disconnect(close);
    });
  }

  private apply(opts: BroadcastOptions, callback: (socket) => void): void {
    const rooms = opts.rooms;
    const except = this.computeExceptSids(opts.except);

    if (rooms.size) {
      const ids = new Set();
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (ids.has(id) || except.has(id)) continue;
          const socket = this.nsp.sockets.get(id);
          if (socket) {
            callback(socket);
            ids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (except.has(id)) continue;
        const socket = this.nsp.sockets.get(id);
        if (socket) callback(socket);
      }
    }
  }

  private computeExceptSids(exceptRooms?: Set<Room>) {
    const exceptSids = new Set();
    if (exceptRooms && exceptRooms.size > 0) {
      for (const room of exceptRooms) {
        if (this.rooms.has(room)) {
          this.rooms.get(room).forEach(sid => exceptSids.add(sid));
        }
      }
    }
    return exceptSids;
  }

  /**
   * Send a packet to the other Socket.IO servers in the cluster
   * @param packet - an array of arguments, which may include an acknowledgement callback at the end
   */
  public serverSideEmit(packet: any[]): void {
    throw new Error(
      "this adapter does not support the serverSideEmit() functionality"
    );
  }
}
