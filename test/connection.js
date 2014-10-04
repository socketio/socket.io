var expect = require('expect.js');
var eio = require('../');

var wsSupport = require('has-cors');
var uagent = navigator.userAgent;
var isOldSimulator = ~uagent.indexOf('iPhone OS 4') || ~uagent.indexOf('iPhone OS 5');
var isIE11 = !!navigator.userAgent.match(/Trident.*rv[ :]*11\./); // ws doesn't work at all in sauce labs
var isAndroid = navigator.userAgent.match(/Android/i);

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
      socket.send('hi');
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

  it('should not connect at all when JSONP forced and disabled', function(done) {
    var socket = eio.Socket({ transports: ['polling'], forceJSONP: true, jsonp: false });
    socket.on('error', function(msg) {
      expect(msg).to.be('No transports available');
      done();
    });
  });

  if (wsSupport && !isOldSimulator && !isAndroid && !isIE11) {
    it('should connect with ws when JSONP forced and disabled', function(done) {
      var socket = eio.Socket({ transports: ['polling', 'websocket'], forceJSONP: true, jsonp: false });

      socket.on('open', function() {
        expect(socket.transport.name).to.be('websocket');
        socket.close();
        done();
      });
    });

    it('should defer close when upgrading', function(done) {
      var socket = new eio.Socket();
      socket.on('open', function() {
        var upgraded = false;
        socket.on('upgrade', function() {
          upgraded = true;
        }).on('upgrading', function() {
          socket.on('close', function() {
            expect(upgraded).to.be(true);
            done();
          });
          socket.close();
        });
      });
    });

    it('should close on upgradeError if closing is deferred', function(done) {
      var socket = new eio.Socket();
      socket.on('open', function() {
        var upgradeError = false;
        socket.on('upgradeError', function() {
          upgradeError = true;
        }).on('upgrading', function() {
          socket.on('close', function() {
            expect(upgradeError).to.be(true);
            done();
          });
          socket.close();
          socket.transport.onError('upgrade error');
        });
      });
    });

    it('should not send packets if closing is deferred', function(done) {
      var socket = new eio.Socket();
      socket.on('open', function() {
        var noPacket = true;
        socket.on('upgrading', function() {
          socket.on('packetCreate', function() {
            noPacket = false;
          });
          socket.close();
          socket.send('hi');
        });
        setTimeout(function() {
          expect(noPacket).to.be(true);
          done();
        }, 1200);
      });
    });

    it('should send all buffered packets if closing is deferred', function(done) {
      var socket = new eio.Socket();
      socket.on('open', function() {
        socket.on('upgrading', function() {
          socket.send('hi');
          socket.close();
        }).on('close', function() {
          expect(socket.writeBuffer).to.have.length(0);
          done();
        });
      });
    });
  }
});
