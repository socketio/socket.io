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

  it('returns an error packet on parsing error', function(){
    function isInvalidPayload (str) {
      expect(function () {
        new parser.Decoder().add(str)
      }).to.throwException(/^invalid payload$/);
    }

    isInvalidPayload('442["some","data"');
    isInvalidPayload('0/admin,"invalid"');
    isInvalidPayload("1/admin,{}");
    isInvalidPayload('2/admin,"invalid');
    isInvalidPayload("2/admin,{}");
    isInvalidPayload('2[{"toString":"foo"}]');
    isInvalidPayload('2[true,"foo"]');
    isInvalidPayload('2[null,"bar"]');

    function isInvalidAttachmentCount (str) {
      expect(() => new parser.Decoder().add(str)).to.throwException(
          /^Illegal attachments$/,
      );
    }

    isInvalidAttachmentCount("5");
    isInvalidAttachmentCount("51");
    isInvalidAttachmentCount("5a-");
    isInvalidAttachmentCount("51.23-");
  });

  it("throws an error when receiving too many attachments", () => {
    const decoder = new parser.Decoder({ maxAttachments: 2 });

    expect(() => {
      decoder.add(
          '53-["hello",{"_placeholder":true,"num":0},{"_placeholder":true,"num":1},{"_placeholder":true,"num":2}]',
      );
    }).to.throwException(/^too many attachments$/);
  });
});
