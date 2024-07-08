const PACKET_TYPES = Object.create(null); // no Map = no polyfill
PACKET_TYPES["open"] = "0";
PACKET_TYPES["close"] = "1";
PACKET_TYPES["ping"] = "2";
PACKET_TYPES["pong"] = "3";
PACKET_TYPES["message"] = "4";
PACKET_TYPES["upgrade"] = "5";
PACKET_TYPES["noop"] = "6";

const PACKET_TYPES_REVERSE = Object.create(null);
Object.keys(PACKET_TYPES).forEach((key) => {
  PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
});

const ERROR_PACKET: Packet = { type: "error", data: "parser error" };

export { PACKET_TYPES, PACKET_TYPES_REVERSE, ERROR_PACKET };

export type PacketType =
  | "open"
  | "close"
  | "ping"
  | "pong"
  | "message"
  | "upgrade"
  | "noop"
  | "error";

// RawData should be "string | Buffer | ArrayBuffer | ArrayBufferView | Blob", but Blob does not exist in Node.js and
// requires to add the dom lib in tsconfig.json
export type RawData = any;

export interface Packet {
  type: PacketType;
  options?: { compress: boolean };
  data?: RawData;
}

export type BinaryType = "nodebuffer" | "arraybuffer" | "blob";
