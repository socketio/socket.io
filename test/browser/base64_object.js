
/**
 * Test dependencies.
 */

var parser = require('../../lib/browser.js');
var expect = require('expect.js');

/**
 * Shortcuts
 */
var encPayload = parser.encodePayload;
var decPayload = parser.decodePayload;

/**
 * Tests.
 */
describe('parser', function() {
  it('should encode/decode mixed base64 object and string', function(done) {
    var data = Buffer.allocUnsafe(5);
    for (var i = 0; i < data.length; i++) data[i] = i;
    var msg = { base64: true, data: data.toString('base64') };
    encPayload([{ type: 'message', data: msg }, { type: 'message', data: 'hello 亜' }], function(encoded) {
      decPayload(encoded,
        function(packet, index, total) {
          var isLast = index + 1 == total;
          expect(packet.type).to.eql('message');
          if (!isLast) { 
            if (!global.ArrayBuffer) {
              expect(packet.data).to.eql(msg);
            } else {
              expect(new Int8Array(packet.data)).to.eql(new Int8Array(data));
            }
          } else {
            expect(packet.data).to.eql('hello 亜');
            done();
          }
        });
    });
  });
});
