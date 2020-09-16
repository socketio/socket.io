const EventEmitter = require("events");

class Adapter extends EventEmitter {
  /**
   * In-memory adapter constructor.
   *
   * @param {Namespace} nsp
   * @public
   */
  constructor(nsp) {
    super();
    this.nsp = nsp;
    this.rooms = new Map(); // Map<Room, Set<SocketId>>
    this.sids = new Map(); // Map<SocketId, Set<Room>>
    this.encoder = nsp.server.encoder;
  }

  /**
   * Adds a socket to a list of room.
   *
   * @param {string}      id      the socket id
   * @param {Set<string>} rooms   a set of rooms
   * @public
   */
  addAll(id, rooms) {
    for (const room of rooms) {
      if (!this.sids.has(id)) {
        this.sids.set(id, new Set());
      }
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
   * @param {string} id     the socket id
   * @param {string} room   the room name
   * @public
   */
  del(id, room) {
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
   * @param {string} id   the socket id
   * @public
   */
  delAll(id) {
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
  broadcast(packet, opts) {
    const rooms = opts.rooms;
    const except = opts.except || [];
    const flags = opts.flags || {};
    const packetOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress
    };
    const ids = new Set();

    packet.nsp = this.nsp.name;
    this.encoder.encode(packet, encodedPackets => {
      if (rooms.size) {
        for (const room of rooms) {
          if (!this.rooms.has(room)) continue;

          for (const id of this.rooms.get(room)) {
            if (ids.has(id) || ~except.indexOf(id)) continue;
            const socket = this.nsp.connected.get(id);
            if (socket) {
              socket.packet(encodedPackets, packetOpts);
              ids.add(id);
            }
          }
        }
      } else {
        for (const [id] of this.sids) {
          if (~except.indexOf(id)) continue;
          const socket = this.nsp.connected.get(id);
          if (socket) socket.packet(encodedPackets, packetOpts);
        }
      }
    });
  }

  /**
   * Gets a list of sockets by sid.
   *
   * @param {Set<string>} rooms   the explicit set of rooms to check.
   * @public
   */
  sockets(rooms) {
    const sids = new Set();

    if (rooms.size) {
      for (const room of rooms) {
        if (!this.rooms.has(room)) continue;

        for (const id of this.rooms.get(room)) {
          if (this.nsp.connected.has(id)) {
            sids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids) {
        if (this.nsp.connected.has(id)) sids.add(id);
      }
    }

    return sids;
  }

  /**
   * Gets the list of rooms a given socket has joined.
   *
   * @param {String} id   the socket id
   * @public
   */
  socketRooms(id) {
    return this.sids.get(id);
  }
}

module.exports = Adapter;
