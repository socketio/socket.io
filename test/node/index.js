
/**
 * Test dependencies.
 */

var parser = require('../../lib/');
var expect = require('expect.js');

/**
 * Shortcuts
 */
var encode = parser.encodePacket;
var decode = parser.decodePacket;
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;
var encPayloadB = parser.encodePayloadAsBinary;
var decPayloadB = parser.decodePayloadAsBinary;

/**
 * Tests.
 */

describe('parser', function() {
  it('should encode a binary message', function(done) {
    var data = new Buffer(5);
    for (var i = 0; i < data.length; i++) { data[i] = i; }
    encode({ type: 'message', data: data }, function(encoded) {
      expect(decode(encoded)).to.eql({ type: 'message', data: data }); 
      done();
    });
  });

  it('should encode/decode mixed binary and string contents as b64', function(done) {
    var data = new Buffer(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    encPayload([{ type: 'message', data: data }, { type: 'message', data: 'hello' }], function(encoded) {
      decPayload(encoded,
        function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) {
            expect(packet.data).to.eql(data);
          } else {
            expect(packet.data).to.eql('hello');
            done();
          }
        });
    });
  });

  it('should encode binary contents as binary', function(done) {
    var firstBuffer = new Buffer(5);
      for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
      var secondBuffer = new Buffer(4);
      for (var i = 0; i < secondBuffer.length; i++) secondBuffer[i] = firstBuffer.length + i;

      encPayloadB([{ type: 'message', data: firstBuffer }, { type: 'message', data: secondBuffer }], function(data) {
        decPayloadB(data,
          function(packet, index, total) {
            var isLast = index + 1 == total;
            expect(packet.type).to.eql('message');
            if (!isLast) {
              expect(packet.data).to.eql(firstBuffer);
            } else {
              expect(packet.data).to.eql(secondBuffer);
              done();
            }
          });
      });
  });

  it('should encode mixed binary and string contents as binary', function(done) {
    var firstBuffer = new Buffer(123);
    for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;

    encPayloadB([{ type: 'message', data: firstBuffer }, { type: 'message', data: 'hello' }, { type: 'close' } ], function(data) {
      decPayloadB(data,
        function(packet, index, total) {
          if (index == 0) {
            expect(packet.type).to.eql('message');
            expect(packet.data).to.eql(firstBuffer);
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
