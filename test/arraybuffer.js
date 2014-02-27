var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

describe('parser', function() {
  it('encodes an ArrayBuffer', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: new ArrayBuffer(2),
      id: 0,
      nsp: '/'
    };
    helpers.test_bin(packet);
  });

  it('encodes ArrayBuffers deep in JSON', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: {a: 'hi', b: {why: new ArrayBuffer(3)}, c: {a: 'bye', b: { a: new ArrayBuffer(6)}}},
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  });
});
