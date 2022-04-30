import encodePacket from "./encodePacket.js";
import decodePacket from "./decodePacket.js";
import { Packet, PacketType, RawData, BinaryType } from "./commons.js";

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
