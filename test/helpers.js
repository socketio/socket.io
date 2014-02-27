var parser = require('../index.js');
var expect = require('expect.js');
var encode = parser.encode;
var decode = parser.decode;

// tests encoding and decoding a single packet
module.exports.test = function(obj){
  encode(obj, function(encodedPackets) {
    expect(decode(encodedPackets[0])).to.eql(obj);
  });
}

// tests encoding of binary packets
module.exports.test_bin = function test_bin(obj) {
  var originalData = obj.data;
  encode(obj, function(encodedPackets) {
    var reconPack = decode(encodedPackets[0]);
    var reconstructor = new parser.BinaryReconstructor(reconPack);
    var packet;
    for (var i = 1; i < encodedPackets.length; i++) {
      packet = reconstructor.takeBinaryData(encodedPackets[i]);
    }

    obj.data = originalData;
    obj.attachments = undefined;
    expect(obj).to.eql(packet);
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
