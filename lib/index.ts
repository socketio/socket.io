import { encodePacket, encodePacketToBinary } from "./encodePacket.js";
import { decodePacket } from "./decodePacket.js";
import {
  Packet,
  PacketType,
  RawData,
  BinaryType,
  ERROR_PACKET
} from "./commons.js";

const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text

const encodePayload = (
  packets: Packet[],
  callback: (encodedPayload: string) => void
) => {
  // some packets may be added to the array while encoding, so the initial length must be saved
  const length = packets.length;
  const encodedPackets = new Array(length);
  let count = 0;

  packets.forEach((packet, i) => {
    // force base64 encoding for binary packets
    encodePacket(packet, false, encodedPacket => {
      encodedPackets[i] = encodedPacket;
      if (++count === length) {
        callback(encodedPackets.join(SEPARATOR));
      }
    });
  });
};

const decodePayload = (
  encodedPayload: string,
  binaryType?: BinaryType
): Packet[] => {
  const encodedPackets = encodedPayload.split(SEPARATOR);
  const packets = [];
  for (let i = 0; i < encodedPackets.length; i++) {
    const decodedPacket = decodePacket(encodedPackets[i], binaryType);
    packets.push(decodedPacket);
    if (decodedPacket.type === "error") {
      break;
    }
  }
  return packets;
};

const HEADER_LENGTH = 4;

export function createPacketEncoderStream() {
  return new TransformStream({
    transform(packet: Packet, controller) {
      encodePacketToBinary(packet, encodedPacket => {
        const header = new Uint8Array(HEADER_LENGTH);
        // last 31 bits indicate the length of the payload
        new DataView(header.buffer).setUint32(0, encodedPacket.length);
        // first bit indicates whether the payload is plain text (0) or binary (1)
        if (packet.data && typeof packet.data !== "string") {
          header[0] |= 0x80;
        }
        controller.enqueue(header);
        controller.enqueue(encodedPacket);
      });
    }
  });
}

let TEXT_DECODER;

function totalLength(chunks: Uint8Array[]) {
  return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
}

function concatChunks(chunks: Uint8Array[], size: number) {
  if (chunks[0].length === size) {
    return chunks.shift();
  }
  const buffer = new Uint8Array(size);
  let j = 0;
  for (let i = 0; i < size; i++) {
    buffer[i] = chunks[0][j++];
    if (j === chunks[0].length) {
      chunks.shift();
      j = 0;
    }
  }
  if (chunks.length && j < chunks[0].length) {
    chunks[0] = chunks[0].slice(j);
  }
  return buffer;
}

export function createPacketDecoderStream(
  maxPayload: number,
  binaryType: BinaryType
) {
  if (!TEXT_DECODER) {
    TEXT_DECODER = new TextDecoder();
  }
  const chunks: Uint8Array[] = [];
  let expectedSize = -1;
  let isBinary = false;

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      chunks.push(chunk);
      while (true) {
        const expectHeader = expectedSize === -1;
        if (expectHeader) {
          if (totalLength(chunks) < HEADER_LENGTH) {
            break;
          }
          const headerArray = concatChunks(chunks, HEADER_LENGTH);
          const header = new DataView(
            headerArray.buffer,
            headerArray.byteOffset,
            headerArray.length
          ).getUint32(0);

          isBinary = header >> 31 === -1;
          expectedSize = header & 0x7fffffff;

          if (expectedSize === 0 || expectedSize > maxPayload) {
            controller.enqueue(ERROR_PACKET);
            break;
          }
        } else {
          if (totalLength(chunks) < expectedSize) {
            break;
          }
          const data = concatChunks(chunks, expectedSize);
          controller.enqueue(
            decodePacket(
              isBinary ? data : TEXT_DECODER.decode(data),
              binaryType
            )
          );
          expectedSize = -1;
        }
      }
    }
  });
}

export const protocol = 4;
export {
  encodePacket,
  encodePayload,
  decodePacket,
  decodePayload,
  Packet,
  PacketType,
  RawData,
  BinaryType
};
