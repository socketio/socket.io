const { PacketType, Decoder, Encoder } = require("../");
const helpers = require("./helpers.js");
const expect = require("expect.js");

describe("Buffer", () => {
  it("encodes a Buffer", () => {
    return helpers.test_bin({
      type: PacketType.EVENT,
      data: ["a", Buffer.from("abc", "utf8")],
      id: 23,
      nsp: "/cool",
    });
  });

  it("encodes a nested Buffer", () => {
    return helpers.test_bin({
      type: PacketType.EVENT,
      data: ["a", { b: ["c", Buffer.from("abc", "utf8")] }],
      id: 23,
      nsp: "/cool",
    });
  });

  it("encodes a binary ack with Buffer", () => {
    return helpers.test_bin({
      type: PacketType.ACK,
      data: ["a", Buffer.from("xxx", "utf8"), {}],
      id: 127,
      nsp: "/back",
    });
  });

  it("encodes a Buffer nested in an object with a toJSON() method", () => {
    class Message {
      constructor(file) {
        this.internal = file;
      }
      toJSON() {
        return { file: this.internal };
      }
    }

    return new Promise((resolve) => {
      const encoder = new Encoder();
      const encodedPackets = encoder.encode({
        type: PacketType.EVENT,
        data: ["a", new Message(Buffer.from("abc", "utf8"))],
        nsp: "/",
      });

      const decoder = new Decoder();
      decoder.on("decoded", (packet) => {
        expect(packet.data).to.eql(["a", { file: Buffer.from("abc", "utf8") }]);
        resolve();
      });

      for (let i = 0; i < encodedPackets.length; i++) {
        decoder.add(encodedPackets[i]);
      }
    });
  });

  it("throws an error when adding an attachment with an invalid 'num' attribute (string)", () => {
    const decoder = new Decoder();

    expect(() => {
      decoder.add('51-["hello",{"_placeholder":true,"num":"splice"}]');
      decoder.add(Buffer.from("world"));
    }).to.throwException(/^illegal attachments$/);
  });

  it("throws an error when adding an attachment with an invalid 'num' attribute (out-of-bound)", () => {
    const decoder = new Decoder();

    expect(() => {
      decoder.add('51-["hello",{"_placeholder":true,"num":1}]');
      decoder.add(Buffer.from("world"));
    }).to.throwException(/^illegal attachments$/);
  });

  it("throws an error when adding an attachment without header", () => {
    const decoder = new Decoder();

    expect(() => {
      decoder.add(Buffer.from("world"));
    }).to.throwException(/^got binary data when not reconstructing a packet$/);
  });

  it("throws an error when decoding a binary event without attachments", () => {
    const decoder = new Decoder();

    expect(() => {
      decoder.add('51-["hello",{"_placeholder":true,"num":0}]');
      decoder.add('2["hello"]');
    }).to.throwException(/^got plaintext data when reconstructing a packet$/);
  });
});
