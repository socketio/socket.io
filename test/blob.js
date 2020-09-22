const { PacketType } = require('..');
const helpers = require('./helpers.js');

const BlobBuilder = typeof BlobBuilder !== 'undefined' ? BlobBuilder :
                  typeof WebKitBlobBuilder !== 'undefined' ? WebKitBlobBuilder :
                  typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder :
                  typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : false;

describe('parser', () => {
  it('encodes a Blob', () => {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: PacketType.BINARY_EVENT,
      data: data,
      id: 0,
      nsp: '/'
    };
    helpers.test_bin(packet);
  });

  it('encodes an Blob deep in JSON', () => {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: PacketType.BINARY_EVENT,
      data: {a: 'hi', b: { why: data }, c: 'bye'},
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  });

  it('encodes a binary ack with a blob', () => {
    var data;
    if (BlobBuilder) {
      var bb = new BlobBuilder();
      bb.append(new ArrayBuffer(2));
      data = bb.getBlob();
    } else {
      data = new Blob([new ArrayBuffer(2)]);
    }

    var packet = {
      type: PacketType.BINARY_ACK,
      data: {a: 'hi ack', b: { why: data }, c: 'bye ack'},
      id: 999,
      nsp: '/deep'
    };
    helpers.test_bin(packet);
  })

});
