
var parser = require('..');
var expect = require('expect.js');
var encode = parser.encode;
var decode = parser.decode;

// tests encoding and decoding a packet

function test(obj){
  expect(decode(encode(obj))).to.eql(obj);
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

});
