import {
  decodePacket,
  decodePacketFromBinary,
  decodePayload,
  encodePacket,
  encodePacketToBinary,
  encodePayload,
  Packet
} from "..";
import * as expect from "expect.js";
import { areArraysEqual } from "./util";

describe("engine.io-parser (node.js only)", () => {
  describe("single packet", () => {
    it("should encode/decode a Buffer", done => {
      const packet: Packet = {
        type: "message",
        data: Buffer.from([1, 2, 3, 4])
      };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket).to.eql(packet.data); // noop
        expect(decodePacket(encodedPacket)).to.eql(packet);
        done();
      });
    });

    it("should encode/decode a Buffer as base64", done => {
      const packet: Packet = {
        type: "message",
        data: Buffer.from([1, 2, 3, 4])
      };
      encodePacket(packet, false, encodedPacket => {
        expect(encodedPacket).to.eql("bAQIDBA==");
        expect(decodePacket(encodedPacket, "nodebuffer")).to.eql(packet);
        done();
      });
    });

    it("should encode/decode an ArrayBuffer", done => {
      const packet: Packet = {
        type: "message",
        data: Int8Array.from([1, 2, 3, 4]).buffer
      };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket === packet.data).to.be(true);
        const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
        expect(decodedPacket.type).to.eql(packet.type);
        expect(decodedPacket.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
        done();
      });
    });

    it("should encode/decode an ArrayBuffer as base64", done => {
      const packet: Packet = {
        type: "message",
        data: Int8Array.from([1, 2, 3, 4]).buffer
      };
      encodePacket(packet, false, encodedPacket => {
        expect(encodedPacket).to.eql("bAQIDBA==");
        const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
        expect(decodedPacket.type).to.eql(packet.type);
        expect(decodedPacket.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
        done();
      });
    });

    it("should encode a typed array", done => {
      const packet: Packet = {
        type: "message",
        data: Int16Array.from([257, 258, 259, 260])
      };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket === packet.data).to.be(true);
        done();
      });
    });

    it("should encode a typed array (with offset and length)", done => {
      const buffer = Int8Array.from([1, 2, 3, 4]).buffer;
      const data = new Int8Array(buffer, 1, 2);
      encodePacket({ type: "message", data }, true, encodedPacket => {
        expect(encodedPacket).to.eql(Buffer.from([2, 3]));
        done();
      });
    });

    it("should decode an ArrayBuffer as ArrayBuffer", () => {
      const encodedPacket = Int8Array.from([1, 2, 3, 4]).buffer;
      const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
      expect(decodedPacket.type).to.eql("message");
      expect(decodedPacket.data).to.be.an(ArrayBuffer);
      expect(areArraysEqual(decodedPacket.data, encodedPacket)).to.be(true);
    });
  });

  describe("payload", () => {
    it("should encode/decode a string + Buffer payload", done => {
      const packets: Packet[] = [
        { type: "message", data: "test" },
        { type: "message", data: Buffer.from([1, 2, 3, 4]) }
      ];
      encodePayload(packets, payload => {
        expect(payload).to.eql("4test\x1ebAQIDBA==");
        expect(decodePayload(payload, "nodebuffer")).to.eql(packets);
        done();
      });
    });
  });

  if (typeof TextEncoder === "function") {
    describe("single packet (to/from Uint8Array)", () => {
      it("should encode/decode a plaintext packet", done => {
        const packet: Packet = {
          type: "message",
          data: "1€"
        };
        encodePacketToBinary(packet, encodedPacket => {
          expect(encodedPacket).to.be.an(Uint8Array);
          expect(encodedPacket).to.eql(
            Uint8Array.from([52, 49, 226, 130, 172])
          );

          const decoded = decodePacketFromBinary(
            encodedPacket,
            false,
            "nodebuffer"
          );
          expect(decoded).to.eql(packet);
          done();
        });
      });

      it("should encode a binary packet (Buffer)", done => {
        const packet: Packet = {
          type: "message",
          data: Buffer.from([1, 2, 3])
        };
        encodePacketToBinary(packet, encodedPacket => {
          expect(encodedPacket === packet.data).to.be(true);
          done();
        });
      });

      it("should encode a binary packet (Uint8Array)", done => {
        const packet: Packet = {
          type: "message",
          data: Uint8Array.from([1, 2, 3])
        };
        encodePacketToBinary(packet, encodedPacket => {
          expect(encodedPacket === packet.data).to.be(true);
          done();
        });
      });

      it("should encode a binary packet (ArrayBuffer)", done => {
        const packet: Packet = {
          type: "message",
          data: Uint8Array.from([1, 2, 3]).buffer
        };
        encodePacketToBinary(packet, encodedPacket => {
          expect(Buffer.isBuffer(encodedPacket)).to.be(true);
          expect(encodedPacket).to.eql(Buffer.from([1, 2, 3]));
          done();
        });
      });

      it("should encode a binary packet (Uint16Array)", done => {
        const packet: Packet = {
          type: "message",
          data: Uint16Array.from([1, 2, 257])
        };
        encodePacketToBinary(packet, encodedPacket => {
          expect(Buffer.isBuffer(encodedPacket)).to.be(true);
          expect(encodedPacket).to.eql(Buffer.from([1, 0, 2, 0, 1, 1]));
          done();
        });
      });

      it("should decode a binary packet (Buffer)", () => {
        const decoded = decodePacketFromBinary(
          Uint8Array.from([1, 2, 3]),
          false,
          "nodebuffer"
        );

        expect(decoded.type).to.eql("message");
        expect(Buffer.isBuffer(decoded.data)).to.be(true);
        expect(decoded.data).to.eql(Buffer.from([1, 2, 3]));
      });

      it("should decode a binary packet (ArrayBuffer)", () => {
        const decoded = decodePacketFromBinary(
          Uint8Array.from([1, 2, 3]),
          false,
          "arraybuffer"
        );

        expect(decoded.type).to.eql("message");
        expect(decoded.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(decoded.data, Uint8Array.from([1, 2, 3])));
      });

      it("should decode a binary packet (with binary header)", () => {
        // 52 === "4".charCodeAt(0)
        const decoded = decodePacketFromBinary(
          Uint8Array.from([52]),
          true,
          "nodebuffer"
        );

        expect(decoded.type).to.eql("message");
        expect(Buffer.isBuffer(decoded.data)).to.be(true);
        expect(decoded.data).to.eql(Buffer.from([52]));
      });
    });
  }
});
