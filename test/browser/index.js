var Blob = require('blob');

if (global.ArrayBuffer) {
  require('./arraybuffer.js');
}

if (Blob) {
  require('./blob.js');
}

require('./base64_object.js');

// General browser only tests
var parser = require('../../');
var encode = parser.encodePacket;
var decode = parser.decodePacket;
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;

describe('basic functionality', function () {
  it('should encode string payloads as strings even if binary supported', function (done) {
    encPayload([{ type: 'ping' }, { type: 'post' }], true, function(data) {
      expect(data).to.be.a('string');
      done();
    });
  });
});


