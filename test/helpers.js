var parser = require('../index.js');
var expect = require('expect.js');
var encoder = new parser.Encoder();

// tests encoding and decoding a single packet
module.exports.test = function(obj){
  encoder.encode(obj, function(encodedPackets) {
    var decoder = new parser.Decoder();
    decoder.on('decoded', function(packet) {
      expect(packet).to.eql(obj);
    });

    decoder.add(encodedPackets[0]);
  });
}

// tests encoding of binary packets
module.exports.test_bin = function test_bin(obj) {
  var originalData = obj.data;
  encoder.encode(obj, function(encodedPackets) {
    var decoder = new parser.Decoder();
    decoder.on('decoded', function(packet) {
      obj.data = originalData;
      obj.attachments = undefined;
      expect(obj).to.eql(packet);
    });

    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i]);
    }
  });
}

// array buffer's slice is native code that is not transported across
// socket.io via msgpack, so regular .eql fails
module.exports.testArrayBuffers = function(buf1, buf2) {
   buf1.slice = undefined;
   buf2.slice = undefined;
   expect(buf1).to.eql(buf2);
}

module.exports.testPacketMetadata = function(p1, p2) {
  expect(p1.type).to.eql(p2.type);
  expect(p1.id).to.eql(p2.id);
  expect(p1.nsp).to.eql(p2.nsp);
}
