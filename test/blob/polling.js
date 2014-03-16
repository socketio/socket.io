var expect = require('expect.js');
var eio = require('../../');

var Blob = require('blob');

describe('blob', function() {
  this.timeout(30000);

  it('should be able to receive binary data as blob when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    var socket = new eio.Socket();
    socket.binaryType = 'blob';
    socket.on('open', function() {
      socket.send(binaryData);
      socket.on('message', function (data) {
        if (typeof data === 'string') return;

        expect(data).to.be.a(global.Blob);
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

  it('should be able to send data as a blob when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) {
      binaryData[i] = i;
    }
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.send(new Blob([binaryData.buffer]));
      socket.on('message', function (data) {
        if (typeof data == 'string') return;

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });
});
