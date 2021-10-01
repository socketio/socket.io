import { decodePacket, decodePayload, encodePacket, encodePayload } from "..";
import * as expect from "expect.js";
import { areArraysEqual } from "./util";

describe("engine.io-parser (node.js only)", () => {
  describe("single packet", () => {
    it("should encode/decode a Buffer", done => {
      const packet = { type: "message", data: Buffer.from([1, 2, 3, 4]) };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket).to.eql(packet.data); // noop
        expect(decodePacket(encodedPacket, {})).to.eql(packet);
        done();
      });
    });

    it("should encode/decode a Buffer as base64", done => {
      const packet = { type: "message", data: Buffer.from([1, 2, 3, 4]) };
      encodePacket(packet, false, encodedPacket => {
        expect(encodedPacket).to.eql("bAQIDBA==");
        expect(decodePacket(encodedPacket, "buffer")).to.eql(packet);
        done();
      });
    });

    it("should encode/decode an ArrayBuffer", done => {
      const packet = {
        type: "message",
        data: Int8Array.from([1, 2, 3, 4]).buffer
      };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket).to.eql(Buffer.from([1, 2, 3, 4]));
        const decodedPacket = decodePacket(encodedPacket, "arraybuffer");
        expect(decodedPacket.type).to.eql(packet.type);
        expect(decodedPacket.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(decodedPacket.data, packet.data)).to.be(true);
        done();
      });
    });

    it("should encode/decode an ArrayBuffer as base64", done => {
      const packet = {
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
      encodePacket(
        { type: "message", data: Int16Array.from([257, 258, 259, 260]) },
        true,
        encodedPacket => {
          expect(encodedPacket).to.eql(Buffer.from([1, 1, 2, 1, 3, 1, 4, 1]));
          done();
        }
      );
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
      const packets = [
        { type: "message", data: "test" },
        { type: "message", data: Buffer.from([1, 2, 3, 4]) }
      ];
      encodePayload(packets, payload => {
        expect(payload).to.eql("4test\x1ebAQIDBA==");
        expect(decodePayload(payload, "buffer")).to.eql(packets);
        done();
      });
    });
  });
});
