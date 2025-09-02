const PACKET_TYPES = {
  open: "0",
  close: "1",
  ping: "2",
  pong: "3",
  message: "4",
  upgrade: "5",
  noop: "6",
} as const;

type ReverseMap<T extends Record<keyof T, keyof any>> = {
  [K in keyof T as T[K]]: K;
};

const PACKET_TYPES_REVERSE = {
  "0": "open",
  "1": "close",
  "2": "ping",
  "3": "pong",
  "4": "message",
  "5": "upgrade",
  "6": "noop",
} as const satisfies ReverseMap<typeof PACKET_TYPES>;

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

export type RawData = string | Buffer | ArrayBuffer | ArrayBufferView | Blob;

export interface Packet {
  type: PacketType;
  options?: {
    compress: boolean;
    wsPreEncoded?: string; // deprecated in favor of `wsPreEncodedFrame`
    wsPreEncodedFrame?: any; // computed in the socket.io-adapter package (should be typed as Buffer)
  };
  data?: RawData;
}

export type BinaryType = "nodebuffer" | "arraybuffer" | "blob";
