var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

describe('parser', function(){

  it('exposes types', function(){
    expect(parser.CONNECT).to.be.a('number');
    expect(parser.DISCONNECT).to.be.a('number');
    expect(parser.EVENT).to.be.a('number');
    expect(parser.ACK).to.be.a('number');
    expect(parser.ERROR).to.be.a('number');
  });

  it('encodes connection', function(){
    helpers.test({
      type: parser.CONNECT,
      nsp: '/woot'
    });
  });

  it('encodes disconnection', function(){
    helpers.test({
      type: parser.DISCONNECT,
      nsp: '/woot'
    });
  });

  it('encodes an event', function(){
    helpers.test({
      type: parser.EVENT,
      data: ['a', 1, {}],
      nsp: '/'
    });
    helpers.test({
      type: parser.EVENT,
      data: ['a', 1, {}],
      id: 1,
      nsp: '/test'
    });
  });

  it('encodes an ack', function(){
    helpers.test({
      type: parser.ACK,
      data: ['a', 1, {}],
      id: 123,
      nsp: '/'
    });
  });
});
