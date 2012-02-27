
/**
 * Test dependencies.
 */

var parser = eio.parser

/**
 * Shortcuts
 */

var encode = parser.encodePacket
  , decode = parser.decodePacket
  , encPayload = parser.encodePayload
  , decPayload = parser.decodePayload

/**
 * Tests.
 */

describe('parser', function () {

  describe('packets', function () {
    describe('basic functionality', function () {
      it('should encode packets as strings', function () {
        expect(encode({ type: 'message', data: 'test' })).to.be.a('string');
      });

      it('should decode packets as objects', function () {
        expect(decode(encode({ type: 'message', data: 'test' }))).to.be.an('object');
      });
    });

    describe('encoding and decoding', function () {
      it('should allow no data', function () {
        expect(decode(encode({ type: 'message' })))
          .to.eql({ type: 'message' });
      });

      it('should encode an open packet', function () {
        expect(decode(encode({ type: 'open', data: '{"some":"json"}' })))
          .to.eql({ type: 'open', data: '{"some":"json"}' });
      });

      it('should encode a close packet', function () {
        expect(decode(encode({ type: 'close' })))
          .to.eql({ type: 'close' });
      });

      it('should encode a ping packet', function () {
        expect(decode(encode({ type: 'ping', data: '1' })))
          .to.eql({ type: 'ping', data: '1' });
      });

      it('should encode a pong packet', function () {
        expect(decode(encode({ type: 'pong', data: '1' })))
          .to.eql({ type: 'pong', data: '1' });
      });

      it('should encode a message packet', function () {
        expect(decode(encode({ type: 'message', data: 'aaa' })))
          .to.eql({ type: 'message', data: 'aaa' });
      });

      it('should encode a message packet coercing to string', function () {
        expect(decode(encode({ type: 'message', data: 1 })))
          .to.eql({ type: 'message', data: '1' });
      });

      it('should encode an upgrade packet', function () {
        expect(decode(encode({ type: 'upgrade' })))
          .to.eql({ type: 'upgrade' });
      });

      it('should match the encoding format', function () {
        expect(encode({ type: 'message', data: 'test' })).to.match(/^[0-9]/);
        expect(encode({ type: 'message' })).to.match(/^[0-9]$/);
      });
    });

    describe('decoding error handing', function () {
      var err = { type: 'error', data: 'parser error' };

      it('should disallow bad format', function () {
        expect(decode(':::')).to.eql(err);
      })

      it('should disallow inexistent types', function () {
        expect(decode('94103')).to.eql(err);
      });
    });
  });

  describe('payloads', function () {
    describe('basic functionality', function () {
      it('should encode payloads as strings', function () {
        expect(encPayload([{ type: 'ping' }, { type: 'post' }])).to.be.a('string');
      });

      it('should decode payloads as arrays', function () {
        expect(decPayload(encPayload(['1:a', '2:b']))).to.be.an('array');
      });
    });

    describe('encoding and decoding', function () {
      it('should encode/decode packets', function () {
        expect(decPayload(encPayload([{ type: 'message', data: 'a' }])))
          .to.eql([{ type: 'message', data: 'a' }]);
      });

      it('should encode/decode empty payloads', function () {
        expect(decPayload(encPayload([]))).to.have.length(0);
      });
    });

    describe('decoding error handling', function () {
      var err = [{ type: 'error', data: 'parser error' }];

      it('should err on bad payload format', function () {
        expect(decPayload('1!')).to.eql(err);
        expect(decPayload('')).to.eql(err);
        expect(decPayload('))')).to.eql(err);
      });

      it('should err on bad payload length', function () {
        expect(decPayload('1:aa')).to.eql(err);
        expect(decPayload('1:')).to.eql(err);
        expect(decPayload('1:a2:b')).to.eql(err);
      });

      it('should err on bad packet format', function () {
        expect(decPayload('3:99:')).to.eql(err);
      });
    });
  });

});
