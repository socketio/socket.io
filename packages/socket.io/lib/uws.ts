import { Adapter, Room } from "socket.io-adapter";
import type { WebSocket } from "uWebSockets.js";
import type { Socket } from "./socket.js";
import { createReadStream, statSync } from "fs";
import debugModule from "debug";

const debug = debugModule("socket.io:adapter-uws");

const SEPARATOR = "\x1f"; // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text

const { addAll, del, broadcast } = Adapter.prototype;

export function patchAdapter(app /* : TemplatedApp */) {
  Adapter.prototype.addAll = function (id, rooms) {
    const isNew = !this.sids.has(id);
    addAll.call(this, id, rooms);
    const socket: Socket = this.nsp.sockets.get(id);
    if (!socket) {
      return;
    }
    if (socket.conn.transport.name === "websocket") {
      subscribe(this.nsp.name, socket, isNew, rooms);
      return;
    }
    if (isNew) {
      socket.conn.on("upgrade", () => {
        const rooms = this.sids.get(id);
        if (rooms) {
          subscribe(this.nsp.name, socket, isNew, rooms);
        }
      });
    }
  };

  Adapter.prototype.del = function (id, room) {
    del.call(this, id, room);
    const socket: Socket = this.nsp.sockets.get(id);
    if (socket && socket.conn.transport.name === "websocket") {
      // @ts-ignore
      const sessionId = socket.conn.id;
      // @ts-ignore
      const websocket: WebSocket = socket.conn.transport.socket;
      const topic = `${this.nsp.name}${SEPARATOR}${room}`;
      debug("unsubscribe connection %s from topic %s", sessionId, topic);
      websocket.unsubscribe(topic);
    }
  };

  Adapter.prototype.broadcast = function (packet, opts) {
    const useFastPublish = opts.rooms.size <= 1 && opts.except!.size === 0;
    if (!useFastPublish) {
      broadcast.call(this, packet, opts);
      return;
    }

    const flags = opts.flags || {};
    const basePacketOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress,
    };

    packet.nsp = this.nsp.name;
    const encodedPackets = this.encoder.encode(packet);

    const topic =
      opts.rooms.size === 0
        ? this.nsp.name
        : `${this.nsp.name}${SEPARATOR}${opts.rooms.keys().next().value}`;
    debug("fast publish to %s", topic);

    // fast publish for clients connected with WebSocket
    encodedPackets.forEach((encodedPacket) => {
      const isBinary = typeof encodedPacket !== "string";
      // "4" being the message type in the Engine.IO protocol, see https://github.com/socketio/engine.io-protocol
      app.publish(
        topic,
        isBinary ? encodedPacket : "4" + encodedPacket,
        isBinary
      );
    });

    this.apply(opts, (socket) => {
      if (socket.conn.transport.name !== "websocket") {
        // classic publish for clients connected with HTTP long-polling
        socket.client.writeToEngine(encodedPackets, basePacketOpts);
      }
    });
  };
}

function subscribe(
  namespaceName: string,
  socket: Socket,
  isNew: boolean,
  rooms: Set<Room>
) {
  // @ts-ignore
  const sessionId = socket.conn.id;
  // @ts-ignore
  const websocket: WebSocket = socket.conn.transport.socket;
  if (isNew) {
    debug("subscribe connection %s to topic %s", sessionId, namespaceName);
    websocket.subscribe(namespaceName);
  }
  rooms.forEach((room) => {
    const topic = `${namespaceName}${SEPARATOR}${room}`; // '#' can be used as wildcard
    debug("subscribe connection %s to topic %s", sessionId, topic);
    websocket.subscribe(topic);
  });
}

export function restoreAdapter() {
  Adapter.prototype.addAll = addAll;
  Adapter.prototype.del = del;
  Adapter.prototype.broadcast = broadcast;
}

const toArrayBuffer = (buffer: Buffer) => {
  const { buffer: arrayBuffer, byteOffset, byteLength } = buffer;
  return arrayBuffer.slice(byteOffset, byteOffset + byteLength);
};

// imported from https://github.com/kolodziejczak-sz/uwebsocket-serve
export function serveFile(res /* : HttpResponse */, filepath: string) {
  const { size } = statSync(filepath);
  const readStream = createReadStream(filepath);
  const destroyReadStream = () => !readStream.destroyed && readStream.destroy();

  const onError = (error: Error) => {
    destroyReadStream();
    throw error;
  };

  const onDataChunk = (chunk: Buffer) => {
    const arrayBufferChunk = toArrayBuffer(chunk);

    const lastOffset = res.getWriteOffset();
    const [ok, done] = res.tryEnd(arrayBufferChunk, size);

    if (!done && !ok) {
      readStream.pause();

      res.onWritable((offset) => {
        const [ok, done] = res.tryEnd(
          arrayBufferChunk.slice(offset - lastOffset),
          size
        );

        if (!done && ok) {
          readStream.resume();
        }

        return ok;
      });
    }
  };

  res.onAborted(destroyReadStream);
  readStream
    .on("data", onDataChunk)
    .on("error", onError)
    .on("end", destroyReadStream);
}
