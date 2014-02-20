var parser = require('../index.js');
var expect = require('expect.js');
var encode = parser.encode;
var decode = parser.decode;

// tests encoding and decoding a packet
module.exports.test = function(obj){
  encode(obj, function(encodedPacket) {
    expect(decode(encodedPacket)).to.eql(obj);
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
