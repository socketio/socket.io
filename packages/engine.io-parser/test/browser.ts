import {
  decodePacket,
  decodePayload,
  encodePacket,
  encodePayload,
  createPacketEncoderStream,
  createPacketDecoderStream,
  Packet,
} from "..";
import expect = require("expect.js");
import { areArraysEqual, createArrayBuffer } from "./util";

const withNativeArrayBuffer = typeof ArrayBuffer === "function";

describe("engine.io-parser (browser only)", () => {
  describe("single packet", () => {
    if (withNativeArrayBuffer) {
      it("should encode/decode an ArrayBuffer", (done) => {
        const packet: Packet = {
          type: "message",
          data: createArrayBuffer([1, 2, 3, 4]),
        };
        encodePacket(packet, true, (encodedPacket) => {
          expect(encodedPacket).to.be.an(ArrayBuffer);
          expect(areArraysEqual(encodedPacket, packet.data)).to.be(true);
          const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
          expect(decodedPacket.type).to.eql("message");
          expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
          done();
        });
      });

      it("should encode/decode an ArrayBuffer as base64", (done) => {
        const packet: Packet = {
          type: "message",
          data: createArrayBuffer([1, 2, 3, 4]),
        };
        encodePacket(packet, false, (encodedPacket) => {
          expect(encodedPacket).to.eql("bAQIDBA==");
          const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
          expect(decodedPacket.type).to.eql(packet.type);
          expect(decodedPacket.data).to.be.an(ArrayBuffer);
          expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
          done();
        });
      });

      it("should encode a typed array", (done) => {
        const buffer = createArrayBuffer([1, 2, 3, 4]);
        const data = new Int8Array(buffer, 1, 2);
        encodePacket({ type: "message", data }, true, (encodedPacket) => {
          expect(encodedPacket).to.eql(data); // unmodified typed array
          done();
        });
      });
    }

    if (typeof Blob === "function") {
      it("should encode/decode a Blob", (done) => {
        const packet: Packet = {
          type: "message",
          data: new Blob(["1234", createArrayBuffer([1, 2, 3, 4])]),
        };
        encodePacket(packet, true, (encodedPacket) => {
          expect(encodedPacket).to.be.a(Blob);
          const decodedPacket = decodePacket(encodedPacket, "blob");
          expect(decodedPacket.type).to.eql("message");
          expect(decodedPacket.data).to.be.a(Blob);
          done();
        });
      });

      it("should encode/decode a Blob as base64", (done) => {
        const packet: Packet = {
          type: "message",
          data: new Blob(["1234", createArrayBuffer([1, 2, 3, 4])]),
        };
        encodePacket(packet, false, (encodedPacket) => {
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
      it("should encode/decode a string + ArrayBuffer payload", (done) => {
        const packets: Packet[] = [
          { type: "message", data: "test" },
          { type: "message", data: createArrayBuffer([1, 2, 3, 4]) },
        ];
        encodePayload(packets, (payload) => {
          expect(payload).to.eql("4test\x1ebAQIDBA==");
          expect(decodePayload(payload, "arraybuffer")).to.eql(packets);
          done();
        });
      });

      it("should encode/decode a string + a 0-length ArrayBuffer payload", (done) => {
        const packets: Packet[] = [
          { type: "message", data: "test" },
          { type: "message", data: createArrayBuffer([]) },
        ];
        encodePayload(packets, (payload) => {
          expect(payload).to.eql("4test\x1eb");
          expect(decodePayload(payload, "arraybuffer")).to.eql(packets);
          done();
        });
      });
    }
  });

  if (typeof TextEncoder === "function") {
    describe("createPacketEncoderStream", () => {
      it("should encode a binary packet (Blob)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write({
          type: "message",
          data: new Blob([Uint8Array.from([1, 2, 3])]),
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(131));

        const payload = await reader.read();
        expect(payload.value).to.eql(Uint8Array.of(1, 2, 3));
      });
    });

    describe("createPacketDecoderStream", () => {
      it("should decode a binary packet (Blob)", async () => {
        const stream = createPacketDecoderStream(1e6, "blob");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(131, 1, 2, 3));

        const { value } = await reader.read();

        expect(value.type).to.eql("message");
        expect(value.data).to.be.a(Blob);
      });
    });
  }
});
