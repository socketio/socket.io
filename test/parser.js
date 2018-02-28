var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');

describe('parser', function(){

  it('exposes types', function(){
    expect(parser.CONNECT).to.be.a('number');
    expect(parser.DISCONNECT).to.be.a('number');
    expect(parser.EVENT).to.be.a('number');
    expect(parser.ACK).to.be.a('number');
    expect(parser.ERROR).to.be.a('number');
    expect(parser.BINARY_EVENT).to.be.a('number');
    expect(parser.BINARY_ACK).to.be.a('number');
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

  it('encodes an error', function(){
    helpers.test({
      type: parser.ERROR,
      data: 'Unauthorized',
      nsp: '/'
    });
  });

  it('properly handles circular objects', function() {
    var a = {};
    a.b = a;

    var data = {
      type: parser.EVENT,
      data: a,
      id: 1,
      nsp: '/'
    }

    var encoder = new parser.Encoder();

    encoder.encode(data, function(encodedPackets) {
      expect(encodedPackets[0]).to.be('4"encode error"');
    });
  });

  it('decodes a bad binary packet', function(){
    try {
      var decoder = new parser.Decoder();
      decoder.add('5');
    } catch(e){
      expect(e.message).to.match(/Illegal/);
    }
  });

  it('returns an error packet on parsing error', function(done){
    var decoder = new parser.Decoder();
    decoder.on('decoded', function(packet) {
      expect(packet).to.eql({ type: 4, data: 'parser error: invalid payload' });
      done();
    });
    decoder.add('442["some","data"');
  });
});
