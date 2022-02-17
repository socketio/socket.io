const { PacketType, Decoder, Encoder } = require("..");
const expect = require("expect.js");
const helpers = require("./helpers.js");
const encoder = new Encoder();

describe("parser", () => {
  it("encodes an ArrayBuffer", (done) => {
    const packet = {
      type: PacketType.EVENT,
      data: ["a", new ArrayBuffer(2)],
      id: 0,
      nsp: "/",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes an ArrayBuffer into an object with a null prototype", (done) => {
    const packet = {
      type: PacketType.EVENT,
      data: [
        "a",
        Object.create(null, {
          array: { value: new ArrayBuffer(2), enumerable: true },
        }),
      ],
      id: 0,
      nsp: "/",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes a TypedArray", (done) => {
    const array = new Uint8Array(5);
    for (let i = 0; i < array.length; i++) array[i] = i;

    const packet = {
      type: PacketType.EVENT,
      data: ["a", array],
      id: 0,
      nsp: "/",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes ArrayBuffers deep in JSON", (done) => {
    const packet = {
      type: PacketType.EVENT,
      data: [
        "a",
        {
          a: "hi",
          b: { why: new ArrayBuffer(3) },
          c: { a: "bye", b: { a: new ArrayBuffer(6) } },
        },
      ],
      id: 999,
      nsp: "/deep",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes deep binary JSON with null values", (done) => {
    const packet = {
      type: PacketType.EVENT,
      data: ["a", { a: "b", c: 4, e: { g: null }, h: new ArrayBuffer(9) }],
      nsp: "/",
      id: 600,
    };
    helpers.test_bin(packet, done);
  });

  it("cleans itself up on close", () => {
    const packet = {
      type: PacketType.EVENT,
      data: ["a", new ArrayBuffer(2), new ArrayBuffer(3)],
      id: 0,
      nsp: "/",
    };

    const encodedPackets = encoder.encode(packet);

    const decoder = new Decoder();
    decoder.on("decoded", (packet) => {
      throw new Error("received a packet when not all binary data was sent.");
    });

    decoder.add(encodedPackets[0]); // add metadata
    decoder.add(encodedPackets[1]); // add first attachment
    decoder.destroy(); // destroy before all data added
    expect(decoder.reconstructor.buffers.length).to.be(0); // expect that buffer is clean
  });
});
