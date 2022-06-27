const { PacketType, Decoder } = require("../");
const helpers = require("./helpers.js");
const expect = require("expect.js");

describe("parser", () => {
  it("encodes a Buffer", (done) => {
    helpers.test_bin(
      {
        type: PacketType.EVENT,
        data: ["a", Buffer.from("abc", "utf8")],
        id: 23,
        nsp: "/cool",
      },
      done
    );
  });

  it("encodes a nested Buffer", (done) => {
    helpers.test_bin(
      {
        type: PacketType.EVENT,
        data: ["a", { b: ["c", Buffer.from("abc", "utf8")] }],
        id: 23,
        nsp: "/cool",
      },
      done
    );
  });

  it("encodes a binary ack with Buffer", (done) => {
    helpers.test_bin(
      {
        type: PacketType.ACK,
        data: ["a", Buffer.from("xxx", "utf8"), {}],
        id: 127,
        nsp: "/back",
      },
      done
    );
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
