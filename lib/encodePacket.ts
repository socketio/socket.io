import { PACKET_TYPES, Packet, RawData } from "./commons.js";

const encodePacket = (
  { type, data }: Packet,
  supportsBinary: boolean,
  callback: (encodedPacket: RawData) => void
) => {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const buffer = toBuffer(data);
    return callback(encodeBuffer(buffer, supportsBinary));
  }
  // plain string
  return callback(PACKET_TYPES[type] + (data || ""));
};

const toBuffer = data => {
  if (Buffer.isBuffer(data)) {
    return data;
  } else if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  } else {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
};

// only 'message' packets can contain binary, so the type prefix is not needed
const encodeBuffer = (data: Buffer, supportsBinary: boolean): RawData => {
  return supportsBinary ? data : "b" + data.toString("base64");
};

export default encodePacket;
