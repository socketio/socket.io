var parser = require('../index.js');
var expect = require('expect.js');
var helpers = require('./helpers.js');
var encode = parser.encode;
var decode = parser.decode;

var BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder || global.MSBlobBuilder || global.MozBlobBuilder;

describe('parser', function() {
  it('encodes a Blob', function() {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: parser.BINARY_EVENT,
      data: data,
      id: 0,
      nsp: '/'
    };
    helpers.test_bin(packet);
  });

  it('encodes an Blob deep in JSON', function() {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: parser.BINARY_EVENT,
      data: {a: 'hi', b: { why: data }, c: 'bye'},
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  });

  it('encodes a binary ack with a blob', function() {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: parser.BINARY_ACK,
      data: {a: 'hi ack', b: { why: data }, c: 'bye ack'},
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  })

});
