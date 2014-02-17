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

  it('should give sockets different ids or mandate timestamps', function(done) {
    var sockets = [];
    var remaining, total;
    // Create this many sockets during this event loop
    remaining = total = 4;
    for (var i = 0; i < total; i++)
    {
      sockets[i] = new eio.Socket();
      sockets[i].on('open', function() {
        remaining--;
        if (remaining == 0) {
          // Ensure sockets don't have same ids, if they are not using time stamps
          for (var j = 0; j < sockets.length; j++) {
            for (var k = j + 1; k < sockets.length; k++) {
              if (!sockets[j].timestampRequests && !sockets[k].timestampRequests) {
                expect(sockets[j].id).not.to.equal(sockets[k].id);
              }
            }
            sockets[j].close();
          }
          done();
        }
      });
    }
  });

});
