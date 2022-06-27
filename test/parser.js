const { PacketType, Decoder, Encoder } = require("..");
const expect = require("expect.js");
const helpers = require("./helpers.js");

describe("parser", () => {
  it("exposes types", () => {
    expect(PacketType.CONNECT).to.be.a("number");
    expect(PacketType.DISCONNECT).to.be.a("number");
    expect(PacketType.EVENT).to.be.a("number");
    expect(PacketType.ACK).to.be.a("number");
    expect(PacketType.CONNECT_ERROR).to.be.a("number");
    expect(PacketType.BINARY_EVENT).to.be.a("number");
    expect(PacketType.BINARY_ACK).to.be.a("number");
  });

  it("encodes connection", (done) => {
    helpers.test(
      {
        type: PacketType.CONNECT,
        nsp: "/woot",
        data: {
          token: "123",
        },
      },
      done
    );
  });

  it("encodes disconnection", (done) => {
    helpers.test(
      {
        type: PacketType.DISCONNECT,
        nsp: "/woot",
      },
      done
    );
  });

  it("encodes an event", (done) => {
    helpers.test(
      {
        type: PacketType.EVENT,
        data: ["a", 1, {}],
        nsp: "/",
      },
      done
    );
  });

  it("encodes an event (with an integer as event name)", (done) => {
    helpers.test(
      {
        type: PacketType.EVENT,
        data: [1, "a", {}],
        nsp: "/",
      },
      done
    );
  });

  it("encodes an event (with ack)", (done) => {
    helpers.test(
      {
        type: PacketType.EVENT,
        data: ["a", 1, {}],
        id: 1,
        nsp: "/test",
      },
      done
    );
  });

  it("encodes an ack", (done) => {
    helpers.test(
      {
        type: PacketType.ACK,
        data: ["a", 1, {}],
        id: 123,
        nsp: "/",
      },
      done
    );
  });

  it("encodes an connect error", (done) => {
    helpers.test(
      {
        type: PacketType.CONNECT_ERROR,
        data: "Unauthorized",
        nsp: "/",
      },
      done
    );
  });

  it("encodes an connect error (with object)", (done) => {
    helpers.test(
      {
        type: PacketType.CONNECT_ERROR,
        data: {
          message: "Unauthorized",
        },
        nsp: "/",
      },
      done
    );
  });

  it("throws an error when encoding circular objects", () => {
    const a = {};
    a.b = a;

    const data = {
      type: PacketType.EVENT,
      data: a,
      id: 1,
      nsp: "/",
    };

    const encoder = new Encoder();

    expect(() => encoder.encode(data)).to.throwException();
  });

  it("decodes a bad binary packet", () => {
    try {
      const decoder = new Decoder();
      decoder.add("5");
    } catch (e) {
      expect(e.message).to.match(/Illegal/);
    }
  });

  it("throw an error upon parsing error", () => {
    const isInvalidPayload = (str) =>
      expect(() => new Decoder().add(str)).to.throwException(
        /^invalid payload$/
      );

    isInvalidPayload('442["some","data"');
    isInvalidPayload('0/admin,"invalid"');
    isInvalidPayload("1/admin,{}");
    isInvalidPayload('2/admin,"invalid');
    isInvalidPayload("2/admin,{}");

    expect(() => new Decoder().add("999")).to.throwException(
      /^unknown packet type 9$/
    );

    expect(() => new Decoder().add(999)).to.throwException(
      /^Unknown type: 999$/
    );
  });
});
