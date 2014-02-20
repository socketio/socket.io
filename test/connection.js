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
