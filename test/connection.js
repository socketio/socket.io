var expect = require('expect.js');
var eio = require('../');

describe('connection', function() {
  this.timeout(10000);

  it('should connect to localhost', function(done){
    var socket = new eio.Socket();
    socket.on('open', function () {
      socket.on('message', function (data) {
        expect(data).to.equal('hi');
        socket.close();
        done();
      });
    });
  });

  it('should work in a worker', function(done){
    var worker = new Worker('/test/support/worker.js');
    worker.onmessage = function(e){
      expect(e.data);
      done();
    };
  });
});
