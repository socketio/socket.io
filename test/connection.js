var expect = require('expect.js');
var io = require('../');

describe('connection', function() {
  this.timeout(10000);
  var socket = io();

  it('should connect to localhost', function(done) {
    socket.emit('hi');
    socket.on('hi', function(data){
      done();
    });
  });

  it('should work with acks', function(done){
    socket.emit('ack');
    socket.on('ack', function(fn){
      fn(5, { test: true });
    });
    socket.on('got it', done);
  });

  it('should work with false', function(done){
    socket.emit('false');
    socket.on('false', function(f){
      expect(f).to.be(false);
      done();
    });
  });
});
