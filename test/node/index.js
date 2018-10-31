
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
    var data = Buffer.allocUnsafe(5);
    for (var i = 0; i < data.length; i++) { data[i] = i; }
    encode({ type: 'message', data: data }, function(encoded) {
      expect(decode(encoded)).to.eql({ type: 'message', data: data }); 
      done();
    });
  });

  it('should encode/decode mixed binary and string contents as b64', function(done) {
    var data = Buffer.allocUnsafe(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    encPayload([{ type: 'message', data: data }, { type: 'message', data: 'hello 亜' }], function(encoded) {
      decPayload(encoded,
        function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) {
            expect(packet.data).to.eql(data);
          } else {
            expect(packet.data).to.eql('hello 亜');
            done();
          }
        });
    });
  });

  it('should encode binary contents as binary', function(done) {
    var firstBuffer = Buffer.allocUnsafe(5);
    for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
    var secondBuffer = Buffer.allocUnsafe(4);
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
    var firstBuffer = Buffer.allocUnsafe(123);
    for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;

    encPayloadB([{ type: 'message', data: firstBuffer }, { type: 'message', data: 'hello 亜' }, { type: 'close' } ], function(data) {
      decPayloadB(data,
        function(packet, index, total) {
          if (index == 0) {
            expect(packet.type).to.eql('message');
            expect(packet.data).to.eql(firstBuffer);
          } else if (index == 1) {
            expect(packet.type).to.eql('message');
            expect(packet.data).to.eql('hello 亜');
          } else {
            expect(packet.type).to.eql('close');
            done();
          }
        });
    });
  });

  it('should encode/decode an ArrayBuffer as b64', function(done) {
    var buffer = new ArrayBuffer(4);
    var dataview = new DataView(buffer);
    for (var i = 0; i < buffer.byteLength ; i++) dataview.setInt8(i, i);

    encode({ type: 'message', data: buffer }, function(encoded) {
      var decoded = decode(encoded, 'arraybuffer');
      expect(decoded).to.eql({ type: 'message', data: buffer });
      expect(new Uint8Array(decoded.data)).to.eql(new Uint8Array(buffer));
      done();
    });
  });

  it('should encode/decode an ArrayBuffer as binary', function(done) {
    var buffer = new ArrayBuffer(4);
    var dataview = new DataView(buffer);
    for (var i = 0; i < buffer.byteLength ; i++) dataview.setInt8(i, i);

    encode({ type: 'message', data: buffer }, true, function(encoded) {
      var decoded = decode(encoded, 'arraybuffer');
      expect(decoded).to.eql({ type: 'message', data: buffer });
      expect(new Uint8Array(decoded.data)).to.eql(new Uint8Array(buffer));
      done();
    });
  });

  it('should encode/decode a typed array as binary', function(done) {
    var buffer = new ArrayBuffer(32);
    var typedArray = new Int32Array(buffer, 4, 2);
    typedArray[0] = 1;
    typedArray[1] = 2;

    encode({ type: 'message', data: typedArray }, true, function(encoded) {
      var decoded = decode(encoded, 'arraybuffer');
      expect(decoded.type).to.eql('message');
      expect(areArraysEqual(new Int32Array(decoded.data), typedArray)).to.eql(true);
      done();
    });
  });

  it('should decode an ArrayBuffer as binary', function() {
    var arrayBuffer = new ArrayBuffer(4);
    var dataview = new DataView(arrayBuffer);
    for (var i = 0; i < arrayBuffer.byteLength ; i++) dataview.setInt8(i, 4 - i);

    var decoded = decode(arrayBuffer, 'arraybuffer');
    var expectedOutput = arrayBuffer.slice(1);
    expect(decoded).to.eql({ type: 'message', data: expectedOutput });
    expect(new Uint8Array(decoded.data)).to.eql(new Uint8Array(expectedOutput));
  });

  it('should decode an ArrayBuffer without specifying binaryType', function() {
    var buffer = new ArrayBuffer(4);
    var dataview = new DataView(buffer);
    for (var i = 0; i < buffer.byteLength ; i++) dataview.setInt8(i, 4 - i);

    var decoded = decode(buffer);
    var expectedOutput = Buffer.from([3,2,1]);
    expect(decoded).to.eql({ type: 'message', data: expectedOutput });
    expect(new Uint8Array(decoded.data)).to.eql(new Uint8Array(expectedOutput));
  });

});

function areArraysEqual(x, y) {
  if (x.length != y.length) return false;
  for (var i = 0, l = x.length; i < l; i++) {
    if (x[i] !== y[i]) return false;
  }
  return true;
}
