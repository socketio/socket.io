var expect = require('expect.js');
var eio = require('../../');

var Blob = require('blob');

describe('blob', function() {
  this.timeout(30000);

  it('should be able to receive binary data as blob when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    var socket = new eio.Socket();
    socket.binaryType = 'blob';
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(binaryData);
        socket.on('message', function (data) {
          expect(data).to.be.a(Blob);
          var fr = new FileReader();
          fr.onload = function() {
            var ab = this.result;
            var ia = new Int8Array(ab);
            expect(ia).to.eql(binaryData);
            socket.close();
            done();
          };
          fr.readAsArrayBuffer(data);
        });
      });
    });
  });

  it('should be able to send data as a blob when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(new Blob([binaryData.buffer]));
        socket.on('message', function (data) {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          socket.close();
          done();
        });
      });
    });
  });

  it('should be able to send data as a blob encoded into base64 when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(new Blob([binaryData.buffer]));
        socket.on('message', function (data) {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          socket.close();
          done();
        });
      });
    });
  });
});
