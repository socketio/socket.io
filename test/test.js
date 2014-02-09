
var parser = require('..');
var expect = require('expect.js');
var encode = parser.encode;
var decode = parser.decode;

// tests encoding and decoding a packet

function test(obj){
  encode(obj, function(encodedPacket) {
    expect(decode(encodedPacket)).to.eql(obj);
  });
}

// array buffer's slice is native code that is not transported across
// socket.io via msgpack, so regular .eql fails
function testArrayBuffers(buf1, buf2) {
   buf1.slice = undefined;
   buf2.slice = undefined;
   expect(buf1).to.eql(buf2);
}

function testPacketMetadata(p1, p2) {
      expect(p1.type).to.eql(p2.type);
      expect(p1.id).to.eql(p2.id);
      expect(p1.nsp).to.eql(p2.nsp);
}

describe('parser', function(){

  it('exposes types', function(){
    expect(parser.CONNECT).to.be.a('number');
    expect(parser.DISCONNECT).to.be.a('number');
    expect(parser.EVENT).to.be.a('number');
    expect(parser.ACK).to.be.a('number');
    expect(parser.ERROR).to.be.a('number');
  });

  it('encodes connection', function(){
    test({
      type: parser.CONNECT,
      nsp: '/woot'
    });
  });

  it('encodes disconnection', function(){
    test({
      type: parser.DISCONNECT,
      nsp: '/woot'
    });
  });

  it('encodes an event', function(){
    test({
      type: parser.EVENT,
      data: ['a', 1, {}],
      nsp: '/'
    });
    test({
      type: parser.EVENT,
      data: ['a', 1, {}],
      id: 1,
      nsp: '/test'
    });
  });

  it('encodes an ack', function(){
    test({
      type: parser.ACK,
      data: ['a', 1, {}],
      id: 123,
      nsp: '/'
    });
  });

  it('encodes a Buffer', function() {
    test({
      type: parser.BINARY_EVENT,
      data: new Buffer('abc', 'utf8'),
      id: 23,
      nsp: '/cool'
    });
  });

  it('encodes an ArrayBuffer', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: new ArrayBuffer(2),
      id: 0,
      nsp: '/'
    };
    parser.encode(packet, function(encodedData) {
      var decodedPacket = parser.decode(encodedData);
      testPacketMetadata(packet, decodedPacket);
      testArrayBuffers(packet.data, decodedPacket.data);
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
      testPacketMetadata(packet, decodedPacket);
      expect(packet.data.a).to.eql(decodedPacket.data.a);
      expect(packet.data.c).to.eql(decodedPacket.data.c);
      testArrayBuffers(packet.data.b.why, decodedPacket.data.b.why);
    });
  });

});
