const expect = require("expect.js");
const parser = require("../build/parser-v3/index.js");

describe("parser", () => {
  it("properly encodes a mixed payload", (done) => {
    parser.encodePayload(
      [
        { type: "message", data: "€€€€" },
        { type: "message", data: Buffer.from([1, 2, 3]) },
      ],
      true,
      (encoded) => {
        expect(encoded).to.be.a(Buffer);

        parser.decodePayload(encoded, (decoded) => {
          expect(decoded.data).to.eql("€€€€");
          done();
        });
      },
    );
  });
});
