
/**
 * Test dependencies.
 */

var expect = require('expect.js');
var eio = require('../');

var parser = eio.parser

/**
 * Shortcuts
 */

var encode = parser.encodePacket;
var decode = parser.decodePacket;
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;
var encPayloadB = parser.encodePayloadAsArrayBuffer;
var encPayloadBB = parser.encodePayloadAsBlob;
var decPayloadB = parser.decodePayloadAsBinary;

/**
 * Tests.
 */

describe('browser-only-parser', function () {
  it('should encode a binary message', function(done) {
    var data = new Int8Array(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    encode({ type: 'message', data: data }, function (encoded) {
      expect(decode(encoded)).to.eql({ type: 'message', data: data.buffer });
      done();
    });
  });

  it('should encode/decode mixed binary and string contents as b64', function(done) {
    var data = new Int8Array(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    encPayload([{ type: 'message', data: data }, { type: 'message', data: 'hello' }], function(encoded) {
      decPayload(encoded, function(packet, index, total) {
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

  it('should encode binary contents as binary (ArrayBuffer)', function(done) {
    var first = new Int8Array(5);
    for (var i = 0; i < first.length; i++) first[i] = i;
    var second = new Int8Array(4);
    for (var i = 0; i < second.length; i++) second[i] = first.length + i;

    encPayloadB([{ type: 'message', data: first }, { type: 'message', data: second }], function(data) {
      decPayloadB(data, function(packet, index, total) {
        var isLast = index + 1 == total;
        expect(packet.type).to.eql('message');
        if (!isLast) {
          expect(new Int8Array(packet.data)).to.eql(first);
        } else {
          expect(new Int8Array(packet.data)).to.eql(second);
          done();
        }
      });
    });
  });

  it('should encode mixed binary and string contents as binary (ArrayBuffer)', function(done) {
    var first = new Int8Array(15);
    for (var i = 0; i < first.length; i++) first[i] = i;

    encPayloadB([ { type: 'message', data: first }, { type: 'message', data: 'hello' }, { type: 'close' } ], function(data) {
      decPayloadB(data, function(packet, index, total) {
        if (index == 0) {
          expect(packet.type).to.eql('message');
          expect(new Int8Array(packet.data)).to.eql(first);
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

  it('should encode binary contents as binary (Blob)', function(done) {
    var first = new Int8Array(5);
    for (var i = 0; i < first.length; i++) first[i] = i;
    var second = new Int8Array(4);
    for (var i = 0; i < second.length; i++) second[i] = first.length + i;

    encPayloadBB([{ type: 'message', data: first }, { type: 'message', data: second }], function(data) {
      var fr = new FileReader();
      fr.onload = function() {
        decPayloadB(this.result, function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) {
            expect(new Int8Array(packet.data)).to.eql(first);
          } else {
            expect(new Int8Array(packet.data)).to.eql(second);
            done();
          }
        });
      };
      fr.readAsArrayBuffer(data);
    });
  });

  it('should encode mixed binary and string contents as binary (Blob)', function(done) {
    var first = new Int8Array(5);
    for (var i = 0; i < first.length; i++) first[i] = i;

    encPayloadBB([ { type: 'message', data: first }, { type: 'message', data: 'hello' }, { type: 'close' } ], function(data) {
      var fr = new FileReader();
      fr.onload = function() {
        decPayloadB(this.result, function(packet, index, total) {
          console.log(packet);
          if (index == 0) {
            expect(packet.type).to.eql('message');
            expect(new Int8Array(packet.data)).to.eql(first);
          } else if (index == 1) {
            expect(packet.type).to.eql('message');
            expect(packet.data).to.eql('hello');
          } else {
            expect(packet.type).to.eql('close');
            done();
          }
        });
      };
      fr.readAsArrayBuffer(data);
    });
  });

});
