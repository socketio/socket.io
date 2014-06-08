var expect = require('expect.js');
var eio = require('../../');

describe('arraybuffer', function() {
  this.timeout(30000);

  it('should be able to receive binary data when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
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

  it('should be able to receive binary data and a multibyte utf-8 string (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }

    var msg = 0;
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(binaryData);
        socket.send('cash money €€€');
        socket.on('message', function (data) {
          if (data === 'hi') return;

          if (msg == 0) {
            expect(data).to.be.an(ArrayBuffer);
            expect(new Int8Array(data)).to.eql(binaryData);
            msg++;
          } else {
            expect(data).to.be('cash money €€€');
            socket.close();
            done();
          }
        });
      });
    });
  });

  it('should be able to receive binary data when bouncing it back and forcing base64 (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
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
