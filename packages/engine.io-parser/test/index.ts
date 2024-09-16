import {
  createPacketDecoderStream,
  createPacketEncoderStream,
  decodePacket,
  decodePayload,
  encodePacket,
  encodePayload,
  Packet,
} from "..";
import expect = require("expect.js");
import { areArraysEqual } from "./util";

import "./node"; // replaced by "./browser" for the tests in the browser (see "browser" field in the package.json file)

describe("engine.io-parser", () => {
  describe("single packet", () => {
    it("should encode/decode a string", (done) => {
      const packet: Packet = { type: "message", data: "test" };
      encodePacket(packet, true, (encodedPacket) => {
        expect(encodedPacket).to.eql("4test");
        expect(decodePacket(encodedPacket)).to.eql(packet);
        done();
      });
    });

    it("should fail to decode a malformed packet", () => {
      expect(decodePacket("")).to.eql({
        type: "error",
        data: "parser error",
      });
      expect(decodePacket("a123")).to.eql({
        type: "error",
        data: "parser error",
      });
    });
  });

  describe("payload", () => {
    it("should encode/decode all packet types", (done) => {
      const packets: Packet[] = [
        { type: "open" },
        { type: "close" },
        { type: "ping", data: "probe" },
        { type: "pong", data: "probe" },
        { type: "message", data: "test" },
      ];
      encodePayload(packets, (payload) => {
        expect(payload).to.eql("0\x1e1\x1e2probe\x1e3probe\x1e4test");
        expect(decodePayload(payload)).to.eql(packets);
        done();
      });
    });

    it("should fail to decode a malformed payload", () => {
      expect(decodePayload("{")).to.eql([
        { type: "error", data: "parser error" },
      ]);
      expect(decodePayload("{}")).to.eql([
        { type: "error", data: "parser error" },
      ]);
      expect(decodePayload('["a123", "a456"]')).to.eql([
        { type: "error", data: "parser error" },
      ]);
    });
  });

  // note: `describe("", function() { this.skip() } );` was added in mocha@10, which has dropped support for Node.js 10
  if (typeof TransformStream === "function") {
    describe("createPacketEncoderStream", () => {
      it("should encode a plaintext packet", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write({
          type: "message",
          data: "1€",
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(5));

        const payload = await reader.read();
        expect(payload.value).to.eql(Uint8Array.of(52, 49, 226, 130, 172));
      });

      it("should encode a binary packet (Uint8Array)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const data = Uint8Array.of(1, 2, 3);

        writer.write({
          type: "message",
          data,
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(131));

        const payload = await reader.read();
        expect(payload.value === data).to.be(true);
      });

      it("should encode a binary packet (ArrayBuffer)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write({
          type: "message",
          data: Uint8Array.of(1, 2, 3).buffer,
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(131));

        const payload = await reader.read();
        expect(payload.value).to.eql(Uint8Array.of(1, 2, 3));
      });

      it("should encode a binary packet (Uint16Array)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write({
          type: "message",
          data: Uint16Array.from([1, 2, 257]),
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(134));

        const payload = await reader.read();
        expect(payload.value).to.eql(Uint8Array.of(1, 0, 2, 0, 1, 1));
      });

      it("should encode a binary packet (Uint8Array - medium)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const data = new Uint8Array(12345);

        writer.write({
          type: "message",
          data,
        });

        const header = await reader.read();
        expect(header.value).to.eql(Uint8Array.of(254, 48, 57));

        const payload = await reader.read();
        expect(payload.value === data).to.be(true);
      });

      it("should encode a binary packet (Uint8Array - big)", async () => {
        const stream = createPacketEncoderStream();

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const data = new Uint8Array(123456789);

        writer.write({
          type: "message",
          data,
        });

        const header = await reader.read();
        expect(header.value).to.eql(
          Uint8Array.of(255, 0, 0, 0, 0, 7, 91, 205, 21),
        );

        const payload = await reader.read();
        expect(payload.value === data).to.be(true);
      });
    });

    describe("createPacketDecoderStream", () => {
      it("should decode a plaintext packet", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(5));
        writer.write(Uint8Array.of(52, 49, 226, 130, 172));

        const packet = await reader.read();
        expect(packet.value).to.eql({
          type: "message",
          data: "1€",
        });
      });

      it("should decode a plaintext packet (bytes by bytes)", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(5));
        writer.write(Uint8Array.of(52));
        writer.write(Uint8Array.of(49));
        writer.write(Uint8Array.of(226));
        writer.write(Uint8Array.of(130));
        writer.write(Uint8Array.of(172));

        writer.write(Uint8Array.of(1));
        writer.write(Uint8Array.of(50));

        writer.write(Uint8Array.of(1));
        writer.write(Uint8Array.of(51));

        const { value } = await reader.read();
        expect(value).to.eql({ type: "message", data: "1€" });

        const pingPacket = await reader.read();
        expect(pingPacket.value).to.eql({ type: "ping" });

        const pongPacket = await reader.read();
        expect(pongPacket.value).to.eql({ type: "pong" });
      });

      it("should decode a plaintext packet (all bytes at once)", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(5, 52, 49, 226, 130, 172, 1, 50, 1, 51));

        const { value } = await reader.read();
        expect(value).to.eql({ type: "message", data: "1€" });

        const pingPacket = await reader.read();
        expect(pingPacket.value).to.eql({ type: "ping" });

        const pongPacket = await reader.read();
        expect(pongPacket.value).to.eql({ type: "pong" });
      });

      it("should decode a binary packet (ArrayBuffer)", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(131, 1, 2, 3));

        const { value } = await reader.read();

        expect(value.type).to.eql("message");
        expect(value.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(value.data, Uint8Array.of(1, 2, 3)));
      });

      it("should decode a binary packet (ArrayBuffer) (medium)", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");
        const payload = new Uint8Array(12345);

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(254));
        writer.write(Uint8Array.of(48, 57));
        writer.write(payload);

        const { value } = await reader.read();

        expect(value.type).to.eql("message");
        expect(value.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(value.data, payload));
      });

      it("should decode a binary packet (ArrayBuffer) (big)", async () => {
        const stream = createPacketDecoderStream(1e10, "arraybuffer");
        const payload = new Uint8Array(123456789);

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(255));
        writer.write(Uint8Array.of(0, 0, 0, 0, 7, 91, 205, 21));
        writer.write(payload);

        const { value } = await reader.read();

        expect(value.type).to.eql("message");
        expect(value.data).to.be.an(ArrayBuffer);
        expect(areArraysEqual(value.data, payload));
      });

      it("should return an error packet if the length of the payload is too big", async () => {
        const stream = createPacketDecoderStream(10, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(11));

        const packet = await reader.read();
        expect(packet.value).to.eql({ type: "error", data: "parser error" });
      });

      it("should return an error packet if the length of the payload is invalid", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(0));

        const packet = await reader.read();
        expect(packet.value).to.eql({ type: "error", data: "parser error" });
      });

      it("should return an error packet if the length of the payload is bigger than Number.MAX_SAFE_INTEGER", async () => {
        const stream = createPacketDecoderStream(1e6, "arraybuffer");

        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(Uint8Array.of(255, 1, 0, 0, 0, 0, 0, 0, 0, 0));

        const packet = await reader.read();
        expect(packet.value).to.eql({ type: "error", data: "parser error" });
      });
    });
  }
});
