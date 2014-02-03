
/**
 * Test dependencies.
 */

var parser = require('../lib/');
var expect = require('expect.js');

/**
 * Shortcuts
 */

var encode = parser.encodePacket;
var decode = parser.decodePacket;
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;
var encPayloadB = parser.encodePayloadAsBinary;
var decPayloadB = parser.decodePayloadAsBinary;

/**
 * Tests.
 */

describe('parser', function () {

  describe('packets', function () {
    describe('basic functionality', function () {
      it('should encode packets as strings', function (done) {
        encode({ type: 'message', data: 'test' }, function(data) {
          expect(data).to.be.a('string');
          done();
        });
      });

      it('should decode packets as objects', function (done) {
        encode({ type: 'message', data: 'test' }, function(data) {
          expect(decode(data)).to.be.an('object');
          done();
        });
      });
    });

    describe('encoding and decoding', function () {
      it('should allow no data', function (done) {
        encode({ type: 'message' }, function(data) {
          expect(decode(data)).to.eql({ type: 'message' });
          done();
        });
      });

      it('should encode an open packet', function (done) {
        encode({ type: 'open', data: '{"some":"json"}' }, function(data) {
          expect(decode(data)).to.eql({ type: 'open', data: '{"some":"json"}' });
          done();
        });
      });

      it('should encode a close packet', function (done) {
        encode({ type: 'close' }, function(data) {
          expect(decode(data)).to.eql({ type: 'close' });
          done();
        });
      });

      it('should encode a ping packet', function (done) {
        encode({ type: 'ping', data: '1' }, function(data) {
          expect(decode(data)).to.eql({ type: 'ping', data: '1' });
          done();
        });
      });

      it('should encode a pong packet', function (done) {
        encode({ type: 'pong', data: '1' }, function(data) {
          expect(decode(data)).to.eql({ type: 'pong', data: '1' });
          done();
        });
      });

      it('should encode a message packet', function (done) {
        encode({ type: 'message', data: 'aaa' }, function(data) {
          expect(decode(data)).to.eql({ type: 'message', data: 'aaa' });
          done();
        });
      });

      it('should encode a message packet coercing to string', function (done) {
        encode({ type: 'message', data: 1 }, function(data) {
          expect(decode(data)).to.eql({ type: 'message', data: 1 });
          done();
        });
      });

      it('should encode a binary message', function(done) {
        var data = new Buffer(5);
        for (var i = 0; i < data.length; i++) { data[i] = i; }
        encode({ type: 'message', data: data }, function(encoded) {
          expect(decode(encoded)).to.eql({ type: 'message', data: data }); 
          done();
        });
      });

      it('should encode an upgrade packet', function (done) {
        encode({ type: 'upgrade' }, function(data) {
          expect(decode(data)).to.eql({ type: 'upgrade' });
          done();
        });
      });

      it('should match the encoding format', function () {
        encode({ type: 'message', data: 'test' }, function(data) {
          expect(data).to.match(/^[0-9]/);
        });
        encode({ type: 'message' }, function(data) {
          expect(data).to.match(/^[0-9]$/);
       });
      });
    });

    describe('decoding error handing', function () {
      var err = { type: 'error', data: 'parser error' };

      it('should disallow bad format', function () {
        expect(decode(':::')).to.eql(err);
      });

      it('should disallow inexistent types', function () {
        expect(decode('94103')).to.eql(err);
      });
    });
  });

  describe('payloads', function () {
    describe('basic functionality', function () {
      it('should encode payloads as strings', function (done) {
        encPayload([{ type: 'ping' }, { type: 'post' }], function(data) {
          expect(data).to.be.a('string');
          done();
        });
      });
    });

    describe('encoding and decoding', function () {
      var seen = 0;
      it('should encode/decode packets', function (done) {
        encPayload([{ type: 'message', data: 'a' }], function(data) {
          decPayload(data,
            function(packet, index, total) {
              var isLast = index + 1 == total;
              expect(isLast).to.eql(true);
              seen++;
            });
        });
        encPayload([{type: 'message', data: 'a'}, {type: 'ping'}], function(data) { 
          decPayload(data,
            function(packet, index, total) {
              var isLast = index + 1 == total;
              if (!isLast) {
                expect(packet.type).to.eql('message');
              } else {
                expect(packet.type).to.eql('ping');
                if (seen == 2) { done(); }
              }
              seen++;
            });
        });
      });

      it('should encode/decode empty payloads', function () {
        encPayload([], function(data) {
          decPayload(data,
            function (packet, index, total) {
              expect(packet.type).to.eql('open');
              var isLast = index + 1 == total;
              expect(isLast).to.eql(true);
            });
        });
      });
    });

    it('should encode/decode mixed binary and string contents as b64', function(done) {
      var data = new Buffer(5);
      for (var i = 0; i < data.length; i++) data[i] = i;
      encPayload([{ type: 'message', data: data }, { type: 'message', data: 'hello' }], function(encoded) {
        decPayload(encoded,
          function(packet, index, total) {
            var isLast = index + 1 == total;
            expect(packet.type).to.eql('message');
            if (!isLast) {
              expect(packet.data).to.eql(data);
            } else {
              expect(packet.data).to.eql('hello');
              done();
            }
          });
      });
    });

    it('should encode binary contents as binary', function(done) {
      var firstBuffer = new Buffer(5);
      for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;
      var secondBuffer = new Buffer(4);
      for (var i = 0; i < secondBuffer.length; i++) secondBuffer[i] = firstBuffer.length + i;

      encPayloadB([{ type: 'message', data: firstBuffer }, { type: 'message', data: secondBuffer }], function(data) {
        decPayloadB(data,
          function(packet, index, total) {
            var isLast = index + 1 == total;
            expect(packet.type).to.eql('message');
            if (!isLast) {
              expect(packet.data).to.eql(firstBuffer);
            } else {
              expect(packet.data).to.eql(secondBuffer);
              done();
            }
          });
      });
    });

    it('should encode mixed binary and string contents as binary', function(done) {
      var firstBuffer = new Buffer(123);
      for (var i = 0; i < firstBuffer.length; i++) firstBuffer[i] = i;

      encPayloadB([{ type: 'message', data: firstBuffer }, { type: 'message', data: 'hello' }, { type: 'close' } ], function(data) {
        decPayloadB(data,
          function(packet, index, total) {
            if (index == 0) {
              expect(packet.type).to.eql('message');
              expect(packet.data).to.eql(firstBuffer);
            } else if (index == 1) {
              expect(packet.type).to.eql('message');
              expect(packet.data).to.eql('hello');
            } else {
              expect(packet.type).to.eql('close');
              done();
            }
          });
      });
    });

    describe('decoding error handling', function () {
      var err = { type: 'error', data: 'parser error' };

      it('should err on bad payload format', function () {
        decPayload('1!', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
        decPayload('', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
        decPayload('))', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
      });

      it('should err on bad payload length', function () {
        // line 137
        decPayload('1:', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
      });

      it('should err on bad packet format', function () {
        // line 137
        decPayload('3:99:', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
        // line 146
        decPayload('1:aa', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
        // line 137
        decPayload('1:a2:b', function (packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet).to.eql(err);
          expect(isLast).to.eql(true);
        });
      });
    });
  });
});
