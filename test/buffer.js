var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

describe('parser', function() {
  it('encodes a Buffer', function() {
      helpers.test_bin({
        type: parser.BINARY_EVENT,
        data: new Buffer('abc', 'utf8'),
        id: 23,
        nsp: '/cool'
      });
  });

  it('encodes a binary ack with Buffer', function() {
    helpers.test_bin({
      type: parser.BINARY_ACK,
      data: ['a', new Buffer('xxx', 'utf8'), {}],
      id: 127,
      nsp: '/back'
    })
  });
});
