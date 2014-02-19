
/**
 * Test dependencies.
 */

var parser = require('../../lib/browser.js');
var expect = require('expect.js');

/**
 * Shortcuts
 */

var encode = parser.encodePacket;
var decode = parser.decodePacket;
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;
var encPayloadAB = parser.encodePayloadAsArrayBuffer;
var decPayloadB = parser.decodePayloadAsBinary;

/**
 * Tests.
 */

describe('parser', function() {
  it('should encode/decode mixed binary and string contents as b64', function(done) {
    var data = new Int8Array(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    encPayload([{ type: 'message', data: data.buffer }, { type: 'message', data: 'hello' }], function(encoded) {
      decPayload(encoded,
        function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) {
            expect(new Int8Array(packet.data)).to.eql(data);
          } else {
            expect(packet.data).to.eql('hello');
            done();
          }
        });
    });
  });
  
  it('should encode binary contents as arraybuffer', function(done) {
    var firstBuffer = new Int8Array(5);
    for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
    var secondBuffer = new Int8Array(4);
    for (var i = 0; i < secondBuffer.length; i++) secondBuffer[i] = firstBuffer.length + i;
  
    encPayloadAB([{ type: 'message', data: firstBuffer.buffer }, { type: 'message', data: secondBuffer.buffer }], function(data) {
      decPayloadB(data,
        function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) {
            expect(new Int8Array(packet.data)).to.eql(firstBuffer);
          } else {
            expect(new Int8Array(packet.data)).to.eql(secondBuffer);
            done();
          }
        });
    });
  });
  
  it('should encode mixed binary and string contents as arraybuffer', function(done) {
    var firstBuffer = new Int8Array(123);
    for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
  
    encPayloadAB([{ type: 'message', data: firstBuffer.buffer }, { type: 'message', data: 'hello' }, { type: 'close' } ], function(data) {
      decPayloadB(data,
        function(packet, index, total) {
          if (index == 0) {
            expect(packet.type).to.eql('message');
            expect(new Int8Array(packet.data)).to.eql(firstBuffer);
          } else if (index == 1) {
            expect(packet.type).to.eql('message');
            expect(packet.data).to.eql('hello');
          } else {
            expect(packet.type).to.eql('close');
            done();
          }
        });
    });
  });
});
