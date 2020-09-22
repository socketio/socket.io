const { PacketType, Decoder, Encoder } = require('..');
const expect = require('expect.js');
const helpers = require('./helpers.js');

describe('parser', () => {

  it('exposes types', () => {
    expect(PacketType.CONNECT).to.be.a('number');
    expect(PacketType.DISCONNECT).to.be.a('number');
    expect(PacketType.EVENT).to.be.a('number');
    expect(PacketType.ACK).to.be.a('number');
    expect(PacketType.ERROR).to.be.a('number');
    expect(PacketType.BINARY_EVENT).to.be.a('number');
    expect(PacketType.BINARY_ACK).to.be.a('number');
  });

  it('encodes connection', () => {
    helpers.test({
      type: PacketType.CONNECT,
      nsp: '/woot'
    });
  });

  it('encodes disconnection', () => {
    helpers.test({
      type: PacketType.DISCONNECT,
      nsp: '/woot'
    });
  });

  it('encodes an event', () => {
    helpers.test({
      type: PacketType.EVENT,
      data: ['a', 1, {}],
      nsp: '/'
    });
    helpers.test({
      type: PacketType.EVENT,
      data: ['a', 1, {}],
      id: 1,
      nsp: '/test'
    });
  });

  it('encodes an ack', () => {
    helpers.test({
      type: PacketType.ACK,
      data: ['a', 1, {}],
      id: 123,
      nsp: '/'
    });
  });

  it('encodes an error', () => {
    helpers.test({
      type: PacketType.ERROR,
      data: 'Unauthorized',
      nsp: '/'
    });
  });

  it('throws an error when encoding circular objects', () => {
    var a = {};
    a.b = a;

    var data = {
      type: PacketType.EVENT,
      data: a,
      id: 1,
      nsp: '/'
    }

    const encoder = new Encoder();

    expect(() => encoder.encode(data)).to.throwException();
  });

  it('decodes a bad binary packet', () => {
    try {
      const decoder = new Decoder();
      decoder.add('5');
    } catch(e){
      expect(e.message).to.match(/Illegal/);
    }
  });

  it('throw an error upon parsing error', () => {
    expect(() => new Decoder().add('442["some","data"')).to.throwException(/^invalid payload$/);
    expect(() => new Decoder().add('999')).to.throwException(/^unknown packet type 9$/);
  });
});
