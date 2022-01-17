import {
  decodePacket,
  decodePayload,
  encodePacket,
  encodePayload,
  Packet
} from "..";
import * as expect from "expect.js";
import "./node";

describe("engine.io-parser", () => {
  describe("single packet", () => {
    it("should encode/decode a string", done => {
      const packet: Packet = { type: "message", data: "test" };
      encodePacket(packet, true, encodedPacket => {
        expect(encodedPacket).to.eql("4test");
        expect(decodePacket(encodedPacket)).to.eql(packet);
        done();
      });
    });

    it("should fail to decode a malformed packet", () => {
      expect(decodePacket("")).to.eql({
        type: "error",
        data: "parser error"
      });
      expect(decodePacket("a123")).to.eql({
        type: "error",
        data: "parser error"
      });
    });
  });

  describe("payload", () => {
    it("should encode/decode all packet types", done => {
      const packets: Packet[] = [
        { type: "open" },
        { type: "close" },
        { type: "ping", data: "probe" },
        { type: "pong", data: "probe" },
        { type: "message", data: "test" }
      ];
      encodePayload(packets, payload => {
        expect(payload).to.eql("0\x1e1\x1e2probe\x1e3probe\x1e4test");
        expect(decodePayload(payload)).to.eql(packets);
        done();
      });
    });

    it("should fail to decode a malformed payload", () => {
      expect(decodePayload("{")).to.eql([
        { type: "error", data: "parser error" }
      ]);
      expect(decodePayload("{}")).to.eql([
        { type: "error", data: "parser error" }
      ]);
      expect(decodePayload('["a123", "a456"]')).to.eql([
        { type: "error", data: "parser error" }
      ]);
    });
  });
});
