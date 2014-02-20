var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;

describe('parser', function() {
  it('encodes a Blob', function() {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }
    var packet = {
      type: parser.BINARY_EVENT,
      data: data,
      id: 0,
      nsp: '/'
    };
    parser.encode(packet, function(encodedData) {
      var decodedPacket = parser.decode(encodedData);
      helpers.testPacketMetadata(packet, decodedPacket);
      helpers.testArrayBuffers(packet.data, decodedPacket.data);
    });
  });

  it('encodes an Blob deep in JSON', function() {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: parser.BINARY_EVENT,
      data: {a: 'hi', b: { why: data }, c:'bye'},
      id: 999,
      nsp: '/deep'
    };
    parser.encode(packet, function(encodedData) {
      var decodedPacket = parser.decode(encodedData);
      helpers.testPacketMetadata(packet, decodedPacket);
      expect(packet.data.a).to.eql(decodedPacket.data.a);
      expect(packet.data.c).to.eql(decodedPacket.data.c);
      helpers.testArrayBuffers(packet.data.b.why, decodedPacket.data.b.why);
    });
  });

});
