var expect = require('expect.js');
var io = require('../');
var hasCORS = require('has-cors');
var b64 = require('base64-js');
var textBlobBuilder = require('text-blob-builder');

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

  it('should connect to a namespace after connection established', function(done) {
    var manager = io.Manager();
    var socket = manager.socket('/');
    socket.on('connect', function(){
      var foo = manager.socket('/foo');
      foo.on('connect', function(){
        foo.close();
        socket.close();
        done();
      });
    });
  });

  it('should reconnect by default', function(done){
    socket.io.engine.close();
    socket.io.on('reconnect', function() {
      done();
    });
  });


  it('should try to reconnect with incorrect address and reconnect enabled', function(done) {
    var manager = io.Manager('http://localhost:3939', { reconnection: true });
    var socket = manager.socket('/');
    var cb = function() {
      manager.removeListener('reconnect_attempt', cb);
      socket.close();
      done();
    };

    manager.on('reconnect_attempt', cb);
  });

  it('should try to reconnect twice and fail when requested two attempts with incorrect address and reconnect enabled', function(done) {
    var manager = io.Manager('http://localhost:3940', { reconnection: true, reconnectionAttempts: 2 });
    var socket = manager.socket('/asd');
    var reconnects = 0;
    var cb = function() {
      reconnects++;
    };

    manager.on('reconnect_attempt', cb);

    manager.on('reconnect_failed', function failed() {
      expect(reconnects).to.be(2);
      manager.removeListener('reconnect_attempt', cb);
      manager.removeListener('reconnect_failed', failed);
      socket.close();
      done();
    });
  });

  it('should try to reconnect twice and fail when requested two attempts with immediate timeout and reconnect enabled', function(done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 2 });
    var socket;

    var reconnects = 0;
    var reconnectCb = function() {
      reconnects++;
    };

    manager.on('reconnect_attempt', reconnectCb);
    manager.on('reconnect_failed', function failed() {
      expect(reconnects).to.be(2);
      manager.removeListener('reconnect_attempt', reconnectCb);
      manager.removeListener('reconnect_failed', failed);
      socket.close();
      done();
    });

    socket = manager.socket('/timeout-two');
  });

  it('should try to reconnect when the connection times out before opening', function(done) {
    var manager = io.Manager({ reconnection: true, timeout: 0 });
    var socket;

    var reconnectCb = function() {
      manager.removeListener('reconnect_attempt', reconnectCb);
      socket.close();
      done();
    };

    manager.on('reconnect_attempt', reconnectCb);
    socket = manager.socket('/timeout');
  });


  it('should not try to reconnect and should form a connection when connecting to correct port with default timeout', function(done) {
    var manager = io.Manager({ reconnection: true });
    var cb = function() {
      manager.removeListener('reconnect_attempt', cb);
      socket.close();
      expect().fail();
    };
    manager.on('reconnect_attempt', cb);

    var socket = manager.socket('/valid');
    socket.on('connect', function(){
      // set a timeout to let reconnection possibly fire
      setTimeout(function() {
        manager.removeListener('reconnect_attempt', cb);
        socket.close();
        done();
      }, 1000);
    });
  });


if (!global.Blob && !global.ArrayBuffer) {
  it('should get base64 data as a last resort', function(done) {
    socket.on('takebin', function(a) {
      expect(a.base64).to.be(true);
      var bytes = b64.toByteArray(a.data);
      var dataString = String.fromCharCode.apply(String, bytes);
      expect(dataString).to.eql('asdfasdf');
      done();
    });
    socket.emit('getbin');
  });
}

if (global.ArrayBuffer) {
  var base64 = require('base64-arraybuffer');

  it('should get binary data (as an ArrayBuffer)', function(done){
    socket.emit('doge');
    socket.on('doge', function(buffer){
      expect(buffer instanceof ArrayBuffer).to.be(true);
      done();
    });
  });

  it('should send binary data (as an ArrayBuffer)', function(done){
    socket.on('buffack', function(){
      done();
    });
    var buf = base64.decode("asdfasdf");
    socket.emit('buffa', buf);
  });

  it('should send binary data (as an ArrayBuffer) mixed with json', function(done) {
    socket.on('jsonbuff-ack', function() {
      done();
    });
    var buf = base64.decode("howdy");
    socket.emit('jsonbuff', {hello: 'lol', message: buf, goodbye: 'gotcha'});
  });

  it('should send events with ArrayBuffers in the correct order', function(done) {
    socket.on('abuff2-ack', function() {
      done();
    });
    var buf = base64.decode("abuff1");
    socket.emit('abuff1', buf);
    socket.emit('abuff2', 'please arrive second');
  });
}

if (global.Blob && null != textBlobBuilder('xxx')) {
  it('should send binary data (as a Blob)', function(done){
    socket.on('back', function(){
      done();
    });
    var blob = textBlobBuilder('hello world');
    socket.emit('blob', blob);
  });

  it('should send binary data (as a Blob) mixed with json', function(done) {
    socket.on('jsonblob-ack', function() {
      done();
    });
    var blob = textBlobBuilder('EEEEEEEEE');
    socket.emit('jsonblob', {hello: 'lol', message: blob, goodbye: 'gotcha'});
  });

  it('should send events with Blobs in the correct order', function(done) {
    socket.on('blob3-ack', function() {
      done();
    });
    var blob = textBlobBuilder('BLOBBLOB');
    socket.emit('blob1', blob);
    socket.emit('blob2', 'second');
    socket.emit('blob3', blob);
  });

  it('should clear its packet buffer in case of disconnect', function(done) {
    var blob = textBlobBuilder('BLOBBLOB');
    for (var i=0; i < 10; i++) { // fill the buffer
      socket.emit('asdf', blob);
    }
    expect(socket.io.packetBuffer.length).to.not.be(0);
    expect(socket.io.encoding).to.be(true);
    socket.io.disconnect();
    expect(socket.io.packetBuffer.length).to.be(0);
    expect(socket.io.encoding).to.be(false);
    done();
  });
}
});
