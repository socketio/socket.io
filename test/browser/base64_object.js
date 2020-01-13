/**
 * Test dependencies.
 */
const parser = require("../../lib/browser.js");
const expect = require("expect.js");

/**
 * Shortcuts
 */
const encPayload = parser.encodePayload;
const decPayload = parser.decodePayload;

/**
 * Tests.
 */
describe("parser", function() {
  it("should encode/decode mixed base64 object and string", function(done) {
    const data = Buffer.allocUnsafe(5);
    for (let i = 0; i < data.length; i++) data[i] = i;
    const msg = { base64: true, data: data.toString("base64") };
    encPayload(
      [
        { type: "message", data: msg },
        { type: "message", data: "hello 亜" }
      ],
      function(encoded) {
        decPayload(encoded, function(packet, index, total) {
          const isLast = index + 1 == total;
          expect(packet.type).to.eql("message");
          if (!isLast) {
            if (!global.ArrayBuffer) {
              expect(packet.data).to.eql(msg);
            } else {
              expect(new Int8Array(packet.data)).to.eql(new Int8Array(data));
            }
          } else {
            expect(packet.data).to.eql("hello 亜");
            done();
          }
        });
      }
    );
  });
});
