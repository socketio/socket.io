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
import { areArraysEqual, createArrayBuffer } from "./util";

const withNativeArrayBuffer = typeof ArrayBuffer === "function";

describe("engine.io-parser (browser only)", () => {
  describe("single packet", () => {
    if (withNativeArrayBuffer) {
      it("should encode/decode an ArrayBuffer", done => {
        const packet: Packet = {
          type: "message",
          data: createArrayBuffer([1, 2, 3, 4])
        };
        encodePacket(packet, true, encodedPacket => {
          expect(encodedPacket).to.be.an(ArrayBuffer);
          expect(areArraysEqual(encodedPacket, packet.data)).to.be(true);
          const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
          expect(decodedPacket.type).to.eql("message");
          expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
          done();
        });
      });

      it("should encode/decode an ArrayBuffer as base64", done => {
        const packet: Packet = {
          type: "message",
          data: createArrayBuffer([1, 2, 3, 4])
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
        const buffer = createArrayBuffer([1, 2, 3, 4]);
        const data = new Int8Array(buffer, 1, 2);
        encodePacket({ type: "message", data }, true, encodedPacket => {
          expect(encodedPacket).to.eql(data); // unmodified typed array
          done();
        });
      });
    }

    if (typeof Blob === "function") {
      it("should encode/decode a Blob", done => {
        const packet: Packet = {
          type: "message",
          data: new Blob(["1234", createArrayBuffer([1, 2, 3, 4])])
        };
        encodePacket(packet, true, encodedPacket => {
          expect(encodedPacket).to.be.a(Blob);
          const decodedPacket = decodePacket(encodedPacket, "blob");
          expect(decodedPacket.type).to.eql("message");
          expect(decodedPacket.data).to.be.a(Blob);
          done();
        });
      });

      it("should encode/decode a Blob as base64", done => {
        const packet: Packet = {
          type: "message",
          data: new Blob(["1234", createArrayBuffer([1, 2, 3, 4])])
        };
        encodePacket(packet, false, encodedPacket => {
          expect(encodedPacket).to.eql("bMTIzNAECAwQ=");
          const decodedPacket = decodePacket(encodedPacket, "blob");
          expect(decodedPacket.type).to.eql("message");
          expect(decodedPacket.data).to.be.a(Blob);
          done();
        });
      });
    }
  });

  describe("payload", () => {
    if (withNativeArrayBuffer) {
      it("should encode/decode a string + ArrayBuffer payload", done => {
        const packets: Packet[] = [
          { type: "message", data: "test" },
          { type: "message", data: createArrayBuffer([1, 2, 3, 4]) }
        ];
        encodePayload(packets, payload => {
          expect(payload).to.eql("4test\x1ebAQIDBA==");
          expect(decodePayload(payload, "arraybuffer")).to.eql(packets);
          done();
        });
      });

      it("should encode/decode a string + a 0-length ArrayBuffer payload", done => {
        const packets: Packet[] = [
          { type: "message", data: "test" },
          { type: "message", data: createArrayBuffer([]) }
        ];
        encodePayload(packets, payload => {
          expect(payload).to.eql("4test\x1eb");
          expect(decodePayload(payload, "arraybuffer")).to.eql(packets);
          done();
        });
      });
    }
  });

  describe("single packet (to/from Uint8Array)", function() {
    if (!withNativeArrayBuffer) {
      // @ts-ignore
      return this.skip();
    }

    it("should encode a plaintext packet", done => {
      const packet: Packet = {
        type: "message",
        data: "1€"
      };
      encodePacketToBinary(packet, encodedPacket => {
        expect(encodedPacket).to.be.an(Uint8Array);
        expect(encodedPacket).to.eql(Uint8Array.from([52, 49, 226, 130, 172]));

        const decoded = decodePacketFromBinary(
          encodedPacket,
          false,
          "arraybuffer"
        );
        expect(decoded).to.eql(packet);
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

    it("should encode a binary packet (Blob)", done => {
      const packet: Packet = {
        type: "message",
        data: new Blob([Uint8Array.from([1, 2, 3])])
      };
      encodePacketToBinary(packet, encodedPacket => {
        expect(encodedPacket).to.be.an(Uint8Array);
        expect(encodedPacket).to.eql(Uint8Array.from([1, 2, 3]));
        done();
      });
    });

    it("should encode a binary packet (ArrayBuffer)", done => {
      const packet: Packet = {
        type: "message",
        data: Uint8Array.from([1, 2, 3]).buffer
      };
      encodePacketToBinary(packet, encodedPacket => {
        expect(encodedPacket).to.be.an(Uint8Array);
        expect(encodedPacket).to.eql(Uint8Array.from([1, 2, 3]));
        done();
      });
    });

    it("should encode a binary packet (Uint16Array)", done => {
      const packet: Packet = {
        type: "message",
        data: Uint16Array.from([1, 2, 257])
      };
      encodePacketToBinary(packet, encodedPacket => {
        expect(encodedPacket).to.be.an(Uint8Array);
        expect(encodedPacket).to.eql(Uint8Array.from([1, 0, 2, 0, 1, 1]));
        done();
      });
    });

    it("should decode a binary packet (Blob)", () => {
      const decoded = decodePacketFromBinary(
        Uint8Array.from([1, 2, 3]),
        false,
        "blob"
      );

      expect(decoded.type).to.eql("message");
      expect(decoded.data).to.be.a(Blob);
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
        "arraybuffer"
      );

      expect(decoded.type).to.eql("message");
      expect(decoded.data).to.be.an(ArrayBuffer);
      expect(areArraysEqual(decoded.data, Uint8Array.from([52])));
    });
  });
});
