var expect = require('expect.js');
var eio = require('../');

describe('arraybuffer', function() {
  it('should be able to receive binary data when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket({ transports: ['polling'] });
    socket.on('open', function() {
      socket.send(binaryData);
      socket.on('message', function (data) {
        if (data === 'hi') return;

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it('should be able to receive binary data when forcing base64 (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.send(binaryData);
      socket.on('message', function (data) {
        if (typeof data === 'string') return;

        expect(data).to.be.an(ArrayBuffer);
        var ia = new Int8Array(data);
        expect(ia).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it('should be able to receive binary data when forcing base64 and not decode it when overriding ArrayBuffer (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.send(binaryData);
      var ab = global.ArrayBuffer;
      global.ArrayBuffer = undefined;
      var firstPacket = true;
      socket.on('message', function (data) {
        if (firstPacket) {
          firstPacket = false;
          return;
        }

        expect(data.base64).to.be(true);
        expect(data.data).to.equal('AAECAwQ=');

        global.ArrayBuffer = ab;
        socket.close();
        done();
      });
    });
  });

  it('should be able to receive binary data when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(binaryData);
        socket.on('message', function (data) {
          if (typeof data === 'string') return;

          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);

          socket.close();
          done();
        });
      });
    });
  });

  it('should be able to receive binary data when bouncing it back and forcing base64 (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(binaryData);
        socket.on('message', function (data) {
          if (typeof data === 'string') return;

          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);

          socket.close();
          done();
        });
      });
    });
  });
});
