var expect = require('expect.js');
var eio = require('../');

describe('connection', function() {
  this.timeout(20000);

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

  it('should receive multibyte utf-8 strings with polling', function(done) {
    var socket = new eio.Socket();
    socket.on('open', function () {
      socket.send('cash money €€€');
      socket.on('message', function (data) {
        if ('hi' == data) return;
        expect(data).to.be('cash money €€€');
        socket.close();
        done();
      });
    });
  });

  it('should receive emoji', function(done) {
    var socket = new eio.Socket();
    socket.on('open', function () {
      socket.send('\uD800-\uDB7F\uDB80-\uDBFF\uDC00-\uDFFF\uE000-\uF8FF');
      socket.on('message', function (data) {
        if ('hi' == data) return;
        expect(data).to.be('\uD800-\uDB7F\uDB80-\uDBFF\uDC00-\uDFFF\uE000-\uF8FF');
        socket.close();
        done();
      });
    });
  });

  it('should not send packets if socket closes', function(done) {
    var socket = new eio.Socket();
    socket.on('open', function() {
      var noPacket = true;
      socket.on('packetCreate', function() {
        noPacket = false;
      });
      socket.close();
      setTimeout(function() {
        expect(noPacket).to.be(true);
        done();
      }, 1200);
    });
  });
    
  // no `Worker` on old IE
  if (global.Worker) {
    it('should work in a worker', function(done){
      var worker = new Worker('/test/support/worker.js');
      worker.onmessage = function(e){
        expect(e.data);
        done();
      };
    });
  }
});
