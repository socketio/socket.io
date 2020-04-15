module.exports = function(parser) {
  /**
   * Test dependencies.
   */
  const expect = require("expect.js");

  /**
   * Shortcuts
   */
  const encode = parser.encodePacket;
  const decode = parser.decodePacket;
  const encPayload = parser.encodePayload;
  const decPayload = parser.decodePayload;

  /**
   * Tests.
   */

  describe("parser", function() {
    describe("packets", function() {
      describe("basic functionality", function() {
        it("should encode packets as strings", function(done) {
          encode({ type: "message", data: "test" }, function(data) {
            expect(data).to.be.a("string");
            done();
          });
        });

        it("should decode packets as objects", function(done) {
          encode({ type: "message", data: "test" }, function(data) {
            expect(decode(data)).to.be.an("object");
            done();
          });
        });
      });

      describe("encoding and decoding", function() {
        it("should allow no data", function(done) {
          encode({ type: "message" }, function(data) {
            expect(decode(data)).to.eql({ type: "message" });
            done();
          });
        });

        it("should encode an open packet", function(done) {
          encode({ type: "open", data: '{"some":"json"}' }, function(data) {
            expect(decode(data)).to.eql({
              type: "open",
              data: '{"some":"json"}'
            });
            done();
          });
        });

        it("should encode a close packet", function(done) {
          encode({ type: "close" }, function(data) {
            expect(decode(data)).to.eql({ type: "close" });
            done();
          });
        });

        it("should encode a ping packet", function(done) {
          encode({ type: "ping", data: "1" }, function(data) {
            expect(decode(data)).to.eql({ type: "ping", data: "1" });
            done();
          });
        });

        it("should encode a pong packet", function(done) {
          encode({ type: "pong", data: "1" }, function(data) {
            expect(decode(data)).to.eql({ type: "pong", data: "1" });
            done();
          });
        });

        it("should encode a message packet", function(done) {
          encode({ type: "message", data: "aaa" }, function(data) {
            expect(decode(data)).to.eql({ type: "message", data: "aaa" });
            done();
          });
        });

        it("should encode a utf8 special chars message packet", function(done) {
          encode({ type: "message", data: "utf8 — string" }, function(data) {
            expect(decode(data)).to.eql({
              type: "message",
              data: "utf8 — string"
            });
            done();
          });
        });

        it("should not utf8 encode by default", function(done) {
          encode({ type: "message", data: "€€€" }, function(data) {
            expect(data).to.be("4€€€");
            done();
          });
        });

        it("should not utf8 encode by default", function(done) {
          encode({ type: "message", data: "€€€" }, true, true, function(data) {
            expect(data).to.be("4â¬â¬â¬");
            done();
          });
        });

        it("should encode a message packet coercing to string", function(done) {
          encode({ type: "message", data: 1 }, function(data) {
            expect(decode(data)).to.eql({ type: "message", data: "1" });
            done();
          });
        });

        it("should encode an upgrade packet", function(done) {
          encode({ type: "upgrade" }, function(data) {
            expect(decode(data)).to.eql({ type: "upgrade" });
            done();
          });
        });

        it("should match the encoding format", function() {
          encode({ type: "message", data: "test" }, function(data) {
            expect(data).to.match(/^[0-9]/);
          });
          encode({ type: "message" }, function(data) {
            expect(data).to.match(/^[0-9]$/);
          });
        });

        it("should encode a string message with lone surrogates replaced by U+FFFD", function(done) {
          const data = "\uDC00\uD834\uDF06\uDC00 \uD800\uD835\uDF07\uD800";
          encode({ type: "message", data: data }, null, true, function(
            encoded
          ) {
            expect(decode(encoded, null, true)).to.eql({
              type: "message",
              data: "\uFFFD\uD834\uDF06\uFFFD \uFFFD\uD835\uDF07\uFFFD"
            });
            done();
          });
        });
      });

      describe("decoding error handing", function() {
        const err = { type: "error", data: "parser error" };

        it("should disallow empty payload", function() {
          expect(decode(undefined)).to.eql(err);
        });

        it("should disallow bad format", function() {
          expect(decode(":::")).to.eql(err);
        });

        it("should disallow inexistent types", function() {
          expect(decode("94103")).to.eql(err);
        });

        it("should disallow invalid utf8", function() {
          expect(decode("4\uffff", false, true)).to.eql(err);
        });
      });
    });

    describe("payloads", function() {
      describe("basic functionality", function() {
        it("should encode payloads as strings", function(done) {
          encPayload([{ type: "ping" }, { type: "pong" }], function(data) {
            expect(data).to.be.a("string");
            done();
          });
        });
      });

      describe("basic functionality", function() {
        it("should encode string payloads as strings even if binary supported", function(done) {
          encPayload([{ type: "ping" }, { type: "pong" }], true, function(
            data
          ) {
            expect(data).to.be.a("string");
            done();
          });
        });
      });

      describe("encoding and decoding", function() {
        let seen = 0;
        it("should encode/decode packets", function(done) {
          encPayload([{ type: "message", data: "a" }], function(data) {
            decPayload(data, function(packet, index, total) {
              const isLast = index + 1 == total;
              expect(isLast).to.eql(true);
              seen++;
            });
          });
          encPayload(
            [{ type: "message", data: "a" }, { type: "ping" }],
            function(data) {
              decPayload(data, function(packet, index, total) {
                const isLast = index + 1 == total;
                if (!isLast) {
                  expect(packet.type).to.eql("message");
                } else {
                  expect(packet.type).to.eql("ping");
                  if (seen == 2) {
                    done();
                  }
                }
                seen++;
              });
            }
          );
        });

        it("should encode/decode empty payloads", done => {
          encPayload([], data => {
            expect(data).to.eql("0:");
            decPayload(data, () => {
              done(new Error("callback should not be called"));
            });
            done();
          });
        });

        it("should not utf8 encode when dealing with strings only", function() {
          encPayload(
            [
              { type: "message", data: "€€€" },
              { type: "message", data: "α" }
            ],
            function(data) {
              expect(data).to.eql("4:4€€€2:4α");
            }
          );
        });
      });

      describe("decoding error handling", function() {
        const err = { type: "error", data: "parser error" };

        it("should err on bad payload format", function() {
          decPayload("1!", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
          decPayload("", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
          decPayload("))", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });

          if ("undefined" == typeof window || window.Int8Array) {
            const data =
              "undefined" !== typeof window
                ? new Int8Array([64]).buffer
                : Buffer.from([64]);
            decPayload(data, function(packet, index, total) {
              const isLast = index + 1 == total;
              expect(packet).to.eql(err);
              expect(isLast).to.eql(true);
            });
          }
        });

        it("should err on bad payload length", function() {
          // line 137
          decPayload("1:", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
        });

        it("should err on bad packet format", function() {
          // line 137
          decPayload("3:99:", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
          // line 146
          decPayload("1:aa", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
          // line 137
          decPayload("1:a2:b", function(packet, index, total) {
            const isLast = index + 1 == total;
            expect(packet).to.eql(err);
            expect(isLast).to.eql(true);
          });
        });
      });
    });
  });
};
