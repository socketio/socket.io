var expect = require('expect.js');
var eio = require('../');

describe('Socket', function () {

  this.timeout(10000);

  describe('filterUpgrades', function () {
    it('should return only available transports', function () {
      var socket = new eio.Socket({'transports': ['polling']});
      expect(socket.filterUpgrades(['polling','websocket'])).to.eql(['polling']);
    });
  });

  describe('socketClosing', function(){
    it('should not emit close on incorrect connection', function (done) {
      var socket = new eio.Socket('ws://0.0.0.0:8080');
      var closed = false;

      socket.once('error', function(){
        setTimeout(function(){
          expect(closed).to.be(false);
          done();
        }, 20);
      });

      socket.on('close', function(){
        closed = true;
      });
    });
  });

});
