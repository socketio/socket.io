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
const encPayloadAB = parser.encodePayloadAsArrayBuffer;
const decPayloadB = parser.decodePayloadAsBinary;

/**
 * Tests.
 */

describe("parser", function() {
  it("should encode/decode mixed binary and string contents as b64", function(done) {
    const data = new Int8Array(5);
    for (let i = 0; i < data.length; i++) data[i] = i;
    encPayload(
      [
        { type: "message", data: data.buffer },
        { type: "message", data: "hello 亜" }
      ],
      function(encoded) {
        decPayload(encoded, function(packet, index, total) {
          const isLast = index + 1 == total;
          expect(packet.type).to.eql("message");
          if (!isLast) {
            expect(new Int8Array(packet.data)).to.eql(data);
          } else {
            expect(packet.data).to.eql("hello 亜");
            done();
          }
        });
      }
    );
  });

  it("should encode binary contents as arraybuffer", function(done) {
    const firstBuffer = new Int8Array(5);
    for (let i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
    const secondBuffer = new Int8Array(4);
    for (let i = 0; i < secondBuffer.length; i++)
      secondBuffer[i] = firstBuffer.length + i;

    encPayloadAB(
      [
        { type: "message", data: firstBuffer.buffer },
        { type: "message", data: secondBuffer.buffer }
      ],
      function(data) {
        decPayloadB(data, function(packet, index, total) {
          const isLast = index + 1 == total;
          expect(packet.type).to.eql("message");
          if (!isLast) {
            expect(new Int8Array(packet.data)).to.eql(firstBuffer);
          } else {
            expect(new Int8Array(packet.data)).to.eql(secondBuffer);
            done();
          }
        });
      }
    );
  });

  it("should encode mixed binary and string contents as arraybuffer", function(done) {
    const firstBuffer = new Int8Array(123);
    for (let i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;

    encPayloadAB(
      [
        { type: "message", data: firstBuffer.buffer },
        { type: "message", data: "hello 亜" },
        { type: "close" }
      ],
      function(data) {
        decPayloadB(data, function(packet, index, total) {
          if (index == 0) {
            expect(packet.type).to.eql("message");
            expect(new Int8Array(packet.data)).to.eql(firstBuffer);
          } else if (index == 1) {
            expect(packet.type).to.eql("message");
            expect(packet.data).to.eql("hello 亜");
          } else {
            expect(packet.type).to.eql("close");
            done();
          }
        });
      }
    );
  });
});
