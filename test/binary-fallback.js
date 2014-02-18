var expect = require('expect.js');
var eio = require('../');

describe('binary fallback', function() {
  this.timeout(10000);

  it('should be able to receive binary data when ArrayBuffer not available (polling)', function(done) {
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.send('give binary');
      var firstPacket = true;
      socket.on('message', function (data) {
        if (firstPacket) {
          firstPacket = false;
          return;
        }

        expect(data.base64).to.be(true);
        expect(data.data).to.equal('AAECAwQ=');

        socket.close();
        done();
      });
    });
  });
});
