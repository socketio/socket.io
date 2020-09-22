import * as Emitter from "component-emitter";
import * as binary from "./binary";
import isBuf from "./is-buffer";
import debugModule from "debug";

const debug = debugModule("socket.io-parser");

/**
 * Protocol version.
 *
 * @public
 */

export const protocol: number = 4;

/**
 * Packet types.
 *
 * @public
 */

export const types: Array<string> = [
  "CONNECT",
  "DISCONNECT",
  "EVENT",
  "ACK",
  "ERROR",
  "BINARY_EVENT",
  "BINARY_ACK",
];

export enum PacketType {
  CONNECT,
  DISCONNECT,
  EVENT,
  ACK,
  ERROR,
  BINARY_EVENT,
  BINARY_ACK,
}

interface Packet {
  type: PacketType;
  nsp: string;
  data?: any;
  id?: number;
  attachments?: number;
}

/**
 * Packet type `connect`.
 *
 * @public
 */

export const CONNECT: number = 0;

/**
 * Packet type `disconnect`.
 *
 * @public
 */

export const DISCONNECT: number = 1;

/**
 * Packet type `event`.
 *
 * @public
 */

export const EVENT: number = 2;

/**
 * Packet type `ack`.
 *
 * @public
 */

export const ACK: number = 3;

/**
 * Packet type `error`.
 *
 * @public
 */

export const ERROR: number = 4;

/**
 * Packet type 'binary event'
 *
 * @public
 */

export const BINARY_EVENT: number = 5;

/**
 * Packet type `binary ack`. For acks with binary arguments.
 *
 * @api public
 */

export const BINARY_ACK: number = 6;

/**
 * A socket.io Encoder instance
 */

export class Encoder {
  /**
   * Encode a packet as a single string if non-binary, or as a
   * buffer sequence, depending on packet type.
   *
   * @param {Object} obj - packet object
   * @param {Function} callback - function to handle encodings (likely engine.write)
   * @return Calls callback with Array of encodings
   */
  public encode(obj: Packet, callback: Function) {
    debug("encoding packet %j", obj);

    if (
      obj.type === PacketType.BINARY_EVENT ||
      obj.type === PacketType.BINARY_ACK
    ) {
      this.encodeAsBinary(obj, callback);
    } else {
      const encoding = this.encodeAsString(obj);
      callback([encoding]);
    }
  }

  /**
   * Encode packet as string.
   */

  private encodeAsString(obj: Packet) {
    // first is type
    let str = "" + obj.type;

    // attachments if we have them
    if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
      str += obj.attachments + "-";
    }

    // if we have a namespace other than `/`
    // we append it followed by a comma `,`
    if (obj.nsp && "/" !== obj.nsp) {
      str += obj.nsp + ",";
    }

    // immediately followed by the id
    if (null != obj.id) {
      str += obj.id;
    }

    // json data
    if (null != obj.data) {
      const payload = tryStringify(obj.data);
      if (payload !== false) {
        str += payload;
      } else {
        return ERROR_PACKET;
      }
    }

    debug("encoded %j as %s", obj, str);
    return str;
  }

  /**
   * Encode packet as 'buffer sequence' by removing blobs, and
   * deconstructing packet into object with placeholders and
   * a list of buffers.
   */

  private encodeAsBinary(obj: Packet, callback: Function) {
    binary.removeBlobs(obj, (bloblessData) => {
      const deconstruction = binary.deconstructPacket(bloblessData);
      const pack = this.encodeAsString(deconstruction.packet);
      const buffers = deconstruction.buffers;

      buffers.unshift(pack); // add packet info to beginning of data list
      callback(buffers); // write all the buffers
    });
  }
}

const ERROR_PACKET = exports.ERROR + '"encode error"';

function tryStringify(str) {
  try {
    return JSON.stringify(str);
  } catch (e) {
    return false;
  }
}

/**
 * A socket.io Decoder instance
 *
 * @return {Object} decoder
 */
// @ts-ignore
export class Decoder extends Emitter {
  private reconstructor: BinaryReconstructor;

  constructor() {
    super();
  }

  /**
   * Decodes an encoded packet string into packet JSON.
   *
   * @param {String} obj - encoded packet
   */

  public add(obj: any) {
    let packet;
    if (typeof obj === "string") {
      packet = this.decodeString(obj);
      if (
        exports.BINARY_EVENT === packet.type ||
        exports.BINARY_ACK === packet.type
      ) {
        // binary packet's json
        this.reconstructor = new BinaryReconstructor(packet);

        // no attachments, labeled binary but no binary data to follow
        if (packet.attachments === 0) {
          super.emit("decoded", packet);
        }
      } else {
        // non-binary full packet
        super.emit("decoded", packet);
      }
    } else if (isBuf(obj) || obj.base64) {
      // raw binary data
      if (!this.reconstructor) {
        throw new Error("got binary data when not reconstructing a packet");
      } else {
        packet = this.reconstructor.takeBinaryData(obj);
        if (packet) {
          // received final buffer
          this.reconstructor = null;
          super.emit("decoded", packet);
        }
      }
    } else {
      throw new Error("Unknown type: " + obj);
    }
  }

  /**
   * Decode a packet String (JSON data)
   *
   * @param {String} str
   * @return {Object} packet
   */
  private decodeString(str): Packet {
    let i = 0;
    // look up type
    const p: any = {
      type: Number(str.charAt(0)),
    };

    if (null == exports.types[p.type]) {
      throw new Error("unknown packet type " + p.type);
    }

    // look up attachments if type binary
    if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
      const start = i + 1;
      while (str.charAt(++i) !== "-" && i != str.length) {}
      const buf = str.substring(start, i);
      if (buf != Number(buf) || str.charAt(i) !== "-") {
        throw new Error("Illegal attachments");
      }
      p.attachments = Number(buf);
    }

    // look up namespace (if any)
    if ("/" === str.charAt(i + 1)) {
      const start = i + 1;
      while (++i) {
        const c = str.charAt(i);
        if ("," === c) break;
        if (i === str.length) break;
      }
      p.nsp = str.substring(start, i);
    } else {
      p.nsp = "/";
    }

    // look up id
    const next = str.charAt(i + 1);
    if ("" !== next && Number(next) == next) {
      const start = i + 1;
      while (++i) {
        const c = str.charAt(i);
        if (null == c || Number(c) != c) {
          --i;
          break;
        }
        if (i === str.length) break;
      }
      p.id = Number(str.substring(start, i + 1));
    }

    // look up json data
    if (str.charAt(++i)) {
      const payload = tryParse(str.substr(i));
      const isPayloadValid =
        payload !== false &&
        (p.type === exports.ERROR || Array.isArray(payload));
      if (isPayloadValid) {
        p.data = payload;
      } else {
        throw new Error("invalid payload");
      }
    }

    debug("decoded %s as %j", str, p);
    return p;
  }

  /**
   * Deallocates a parser's resources
   */
  public destroy() {
    if (this.reconstructor) {
      this.reconstructor.finishedReconstruction();
    }
  }
}

function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}

/**
 * A manager of a binary event's 'buffer sequence'. Should
 * be constructed whenever a packet of type BINARY_EVENT is
 * decoded.
 *
 * @param {Object} packet
 * @return {BinaryReconstructor} initialized reconstructor
 */

class BinaryReconstructor {
  private reconPack;
  private buffers: Array<Buffer | ArrayBuffer> = [];

  constructor(readonly packet: Packet) {
    this.reconPack = packet;
  }

  /**
   * Method to be called when binary data received from connection
   * after a BINARY_EVENT packet.
   *
   * @param {Buffer | ArrayBuffer} binData - the raw binary data received
   * @return {null | Object} returns null if more binary data is expected or
   *   a reconstructed packet object if all buffers have been received.
   */
  public takeBinaryData(binData) {
    this.buffers.push(binData);
    if (this.buffers.length === this.reconPack.attachments) {
      // done with buffer list
      const packet = binary.reconstructPacket(this.reconPack, this.buffers);
      this.finishedReconstruction();
      return packet;
    }
    return null;
  }

  /**
   * Cleans up binary packet reconstruction variables.
   */
  public finishedReconstruction() {
    this.reconPack = null;
    this.buffers = [];
  }
}
