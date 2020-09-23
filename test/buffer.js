const { PacketType } = require('..');
const helpers = require('./helpers.js');

describe('parser', () => {
  it('encodes a Buffer', done => {
      helpers.test_bin({
        type: PacketType.BINARY_EVENT,
        data: ['a', Buffer.from('abc', 'utf8')],
        id: 23,
        nsp: '/cool'
      }, done);
  });

  it('encodes a binary ack with Buffer', done => {
    helpers.test_bin({
      type: PacketType.BINARY_ACK,
      data: ['a', Buffer.from('xxx', 'utf8'), {}],
      id: 127,
      nsp: '/back'
    }, done)
  });
});
