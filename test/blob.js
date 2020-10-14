const { PacketType } = require("..");
const helpers = require("./helpers.js");

const BlobBuilderImpl =
  typeof BlobBuilder !== "undefined"
    ? BlobBuilder
    : typeof WebKitBlobBuilder !== "undefined"
    ? WebKitBlobBuilder
    : typeof MSBlobBuilder !== "undefined"
    ? MSBlobBuilder
    : typeof MozBlobBuilder !== "undefined"
    ? MozBlobBuilder
    : false;

describe("parser", () => {
  it("encodes a Blob", (done) => {
    let data;
    if (BlobBuilderImpl) {
      const bb = new BlobBuilderImpl();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    const packet = {
      type: PacketType.EVENT,
      data: ["a", data],
      id: 0,
      nsp: "/",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes an Blob deep in JSON", (done) => {
    let data;
    if (BlobBuilderImpl) {
      const bb = new BlobBuilderImpl();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    const packet = {
      type: PacketType.EVENT,
      data: ["a", { a: "hi", b: { why: data }, c: "bye" }],
      id: 999,
      nsp: "/deep",
    };
    helpers.test_bin(packet, done);
  });

  it("encodes a binary ack with a blob", (done) => {
    let data;
    if (BlobBuilderImpl) {
      const bb = new BlobBuilderImpl();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    const packet = {
      type: PacketType.ACK,
      data: [{ a: "hi ack", b: { why: data }, c: "bye ack" }],
      id: 999,
      nsp: "/deep",
    };
    helpers.test_bin(packet, done);
  });
});
