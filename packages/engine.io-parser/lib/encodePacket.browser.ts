import { PACKET_TYPES, Packet, RawData } from "./commons.js";

const withNativeBlob =
  typeof Blob === "function" ||
  (typeof Blob !== "undefined" &&
    Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
const withNativeArrayBuffer = typeof ArrayBuffer === "function";

// ArrayBuffer.isView method is not defined in IE10
const isView = (obj) => {
  return typeof ArrayBuffer.isView === "function"
    ? ArrayBuffer.isView(obj)
    : obj && obj.buffer instanceof ArrayBuffer;
};

const encodePacket = (
  { type, data }: Packet,
  supportsBinary: boolean,
  callback: (encodedPacket: RawData) => void,
) => {
  if (withNativeBlob && data instanceof Blob) {
    if (supportsBinary) {
      return callback(data);
    } else {
      return encodeBlobAsBase64(data, callback);
    }
  } else if (
    withNativeArrayBuffer &&
    (data instanceof ArrayBuffer || isView(data))
  ) {
    if (supportsBinary) {
      return callback(data);
    } else {
      return encodeBlobAsBase64(new Blob([data]), callback);
    }
  }
  // plain string
  return callback(PACKET_TYPES[type] + (data || ""));
};

const encodeBlobAsBase64 = (
  data: Blob,
  callback: (encodedPacket: RawData) => void,
) => {
  const fileReader = new FileReader();
  fileReader.onload = function () {
    const content = (fileReader.result as string).split(",")[1];
    callback("b" + (content || ""));
  };
  return fileReader.readAsDataURL(data);
};

function toArray(data: BufferSource) {
  if (data instanceof Uint8Array) {
    return data;
  } else if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  } else {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
}

let TEXT_ENCODER: TextEncoder | undefined;

export function encodePacketToBinary(
  packet: Packet,
  callback: (encodedPacket: RawData) => void,
) {
  if (withNativeBlob && packet.data instanceof Blob) {
    return packet.data.arrayBuffer().then(toArray).then(callback);
  } else if (
    withNativeArrayBuffer &&
    (packet.data instanceof ArrayBuffer || isView(packet.data))
  ) {
    return callback(toArray(packet.data));
  }
  encodePacket(packet, false, (encoded) => {
    if (!TEXT_ENCODER) {
      TEXT_ENCODER = new TextEncoder();
    }
    callback(TEXT_ENCODER.encode(encoded));
  });
}

export { encodePacket };
