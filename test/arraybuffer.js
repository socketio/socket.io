var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encoder = new parser.Encoder();

describe('parser', function() {
  it('encodes an ArrayBuffer', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: ['a', new ArrayBuffer(2)],
      id: 0,
      nsp: '/'
    };
    helpers.test_bin(packet);
  });

  it('encodes a TypedArray', function() {
    var array = new Uint8Array(5);
    for (var i = 0; i < array.length; i++) array[i] = i;

    var packet = {
      type: parser.BINARY_EVENT,
      data: ['a', array],
      id: 0,
      nsp: '/'
    };
    helpers.test_bin(packet);
  });

  it('encodes ArrayBuffers deep in JSON', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: ['a', {a: 'hi', b: {why: new ArrayBuffer(3)}, c: {a: 'bye', b: { a: new ArrayBuffer(6)}}}],
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  });

  it('encodes deep binary JSON with null values', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: ['a', {a: 'b', c: 4, e: {g: null}, h: new ArrayBuffer(9)}],
      nsp: '/',
      id: 600
    };
    helpers.test_bin(packet);
  });

  it('cleans itself up on close', function() {
    var packet = {
      type: parser.BINARY_EVENT,
      data: [new ArrayBuffer(2), new ArrayBuffer(3)],
      id: 0,
      nsp: '/'
    };

    encoder.encode(packet, function(encodedPackets) {
      var decoder = new parser.Decoder();
      decoder.on('decoded', function(packet) {
        throw new Error("received a packet when not all binary data was sent.");
      });

      decoder.add(encodedPackets[0]); // add metadata
      decoder.add(encodedPackets[1]); // add first attachment
      decoder.destroy(); // destroy before all data added
      expect(decoder.reconstructor.buffers.length).to.be(0); // expect that buffer is clean
    });
  });
});
