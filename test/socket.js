var expect = require('expect.js');
var eio = require('../');
var hasCORS = require('has-cors');

describe('Socket', function () {

  this.timeout(10000);

  describe('filterUpgrades', function () {
    it('should return only available transports', function () {
      var socket = new eio.Socket({'transports': ['polling']});
      expect(socket.filterUpgrades(['polling','websocket'])).to.eql(['polling']);
    });
  });

  // Ignore incorrect connection test for old IE due to no support for
  // `script.onerror` (see: http://requirejs.org/docs/api.html#ieloadfail)
  if (!global.document || hasCORS) {
    describe('socketClosing', function(){
      it('should emit close on incorrect connection', function(done){
        var socket = new eio.Socket('ws://0.0.0.0:8080');
        var closed = false;

        socket.once('error', function(){
          setTimeout(function(){
            expect(closed).to.be(true);
            done();
          }, 20);
        });

        socket.on('close', function(){
          closed = true;
        });
      });
    });
  }
});
