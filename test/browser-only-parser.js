 
/**
 * Test dependencies.
 */

var expect = require('expect.js');
var eio = require('../');

var parser = eio.parser

/**
 * Shortcuts
 */

var encode = parser.encodePacket
  , decode = parser.decodePacket
  , encPayload = parser.encodePayload
  , decPayload = parser.decodePayload
  , encPayloadB = parser.encodePayloadAsBinary
  , decPayloadB = parser.decodePayloadAsBinary

/**
 * Tests.
 */

describe('browser-only-parser', function () {
  it('should encode a binary message', function() {
    var data = new Int8Array(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    expect(decode(encode({ type: 'message', data: data })))
    .to.eql({ type: 'message', data: data.buffer });
  });

  it('should encode/decode mixed binary and string contents as b64', function() {
    var data = new Int8Array(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    decPayload(encPayload([{ type: 'message', data: data }, { type: 'message', data: 'hello' }]),
      function(packet, index, total) {
        var isLast = index + 1 == total;
        expect(packet.type).to.eql('message');
        if (!isLast) {
          expect(new Int8Array(packet.data)).to.eql(data);
        } else {
          expect(packet.data).to.eql('hello');
        }
    });
  });

  it('should encode binary contents as binary', function() {
    var first = new Int8Array(5);
    for (var i = 0; i < first.length; i++) first[i] = i;
    var second = new Int8Array(4);
    for (var i = 0; i < second.length; i++) second[i] = first.length + i;

    decPayloadB(encPayloadB([{ type: 'message', data: first }, { type: 'message', data: second }]),
      function(packet, index, total) {
        var isLast = index + 1 == total;
        expect(packet.type).to.eql('message');
        if (!isLast) {
          expect(new Int8Array(packet.data)).to.eql(first);
        } else {
          expect(new Int8Array(packet.data)).to.eql(second);
        }
    });
  });

  it('should encode mixed binary and string contents as binary', function() {
    var first = new Int8Array(15);
    for (var i = 0; i < first.length; i++) first[i] = i;

    decPayloadB(encPayloadB([ { type: 'message', data: first }, { type: 'message', data: 'hello' }, { type: 'close' } ]),
      function(packet, index, total) {
        if (index == 0) {
          expect(packet.type).to.eql('message');
          expect(new Int8Array(packet.data)).to.eql(first);
        } else if (index == 1) {
          expect(packet.type).to.eql('message');
          expect(packet.data).to.eql('hello');
        } else {
          expect(packet.type).to.eql('close');
        }
    });
  });
});
