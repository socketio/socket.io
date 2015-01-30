var expect = require('expect.js');
var io = require('../');

describe('socket', function(){
  it('should have an accessible socket id equal to the engine.io socket id', function(done) {
    var socket = io({ forceNew: true });
    socket.on('connect', function(){
      expect(socket.id).to.be.ok();
      expect(socket.id).to.eql(socket.io.engine.id);
      socket.disconnect();
      done();
    });
  });

  it('clears socket.id upon disconnection', function(done){
    var socket = io({ forceNew: true });
    socket.on('connect', function(){
      socket.on('disconnect', function(){
        expect(socket.id).to.not.be.ok();
        done();
      });

      socket.disconnect();
    });
  });

  it('should change socket.id upon reconnection', function(done){
    var socket = io({ forceNew: true });
    socket.on('connect', function(){
      var id = socket.id;

      socket.on('reconnect_attempt', function(){
        expect(socket.id).to.not.be.ok();
      });

      socket.on('reconnect', function() {
        expect(socket.id).to.not.eql(id);
        socket.disconnect();
        done();
      });

      socket.io.engine.close();
    });
  });

  it('should enable compression by default', function(done){
    var socket = io({ forceNew: true });
    socket.on('connect', function(){
      socket.io.engine.once('packetCreate', function(packet){
        expect(packet.options.compress).to.be(true);
        socket.disconnect();
        done();
      });
      socket.emit('hi');
    });
  });

  it('should disable compression', function(done){
    var socket = io({ forceNew: true });
    socket.on('connect', function(){
      socket.io.engine.once('packetCreate', function(packet){
        expect(packet.options.compress).to.be(false);
        socket.disconnect();
        done();
      });
      socket.compress(false).emit('hi');
    });
  });
});
