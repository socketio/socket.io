const { PacketType, Decoder, Encoder } = require("..");
const expect = require("expect.js");
const helpers = require("./helpers.js");
const encoder = new Encoder();

describe("ArrayBuffer", () => {
  it("encodes an ArrayBuffer", () => {
    const packet = {
      type: PacketType.EVENT,
      data: ["a", new ArrayBuffer(2)],
      id: 0,
      nsp: "/",
    };
    return helpers.test_bin(packet);
  });

  it("encodes an ArrayBuffer into an object with a null prototype", () => {
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
    return helpers.test_bin(packet);
  });

  it("encodes a TypedArray", () => {
    const array = new Uint8Array(5);
    for (let i = 0; i < array.length; i++) array[i] = i;

    const packet = {
      type: PacketType.EVENT,
      data: ["a", array],
      id: 0,
      nsp: "/",
    };
    return helpers.test_bin(packet);
  });

  it("encodes ArrayBuffers deep in JSON", () => {
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
    return helpers.test_bin(packet);
  });

  it("encodes deep binary JSON with null values", () => {
    const packet = {
      type: PacketType.EVENT,
      data: ["a", { a: "b", c: 4, e: { g: null }, h: new ArrayBuffer(9) }],
      nsp: "/",
      id: 600,
    };
    return helpers.test_bin(packet);
  });

  it("should not modify the input packet", () => {
    const packet = {
      type: PacketType.EVENT,
      nsp: "/",
      data: ["a", Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5, 6)],
    };

    encoder.encode(packet);

    expect(packet).to.eql({
      type: PacketType.EVENT,
      nsp: "/",
      data: ["a", Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5, 6)],
    });
  });
});
