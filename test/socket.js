
describe('Socket', function () {

  describe('filterUpgrades', function () {
    it('should return only available transports', function () {
      var socket = new eio.Socket({'transports': ['polling']});
      expect(socket.filterUpgrades(['polling','websocket'])).to.eql(['polling']);
    });
  });

  describe('socketClosing', function () {
    it('should not emit close on incorrect connection', function (done) {
      var socket = new eio.Socket('ws://localhost:8080');
      var closed = false;

      socket.on('close', function () {
        closed = true;
      });

      setTimeout(function() {
        expect(closed).to.be(false);
        done();
      }, 200);
    });
  });

});
