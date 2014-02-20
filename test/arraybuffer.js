var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

describe('parser', function() {
  it('encodes an ArrayBuffer', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: new ArrayBuffer(2),
      id: 0,
      nsp: '/'
    };
    parser.encode(packet, function(encodedData) {
      var decodedPacket = parser.decode(encodedData);
      helpers.testPacketMetadata(packet, decodedPacket);
      helpers.testArrayBuffers(packet.data, decodedPacket.data);
    });
  });

  it('encodes an ArrayBuffer deep in JSON', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: {a: 'hi', b: {why: new ArrayBuffer(3)}, c:'bye'},
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
