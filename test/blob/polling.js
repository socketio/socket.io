var expect = require('expect.js');
var eio = require('../../');

var blobSupported = (function() {
  try {
    var b = new Blob(['hi']);
    return b.size == 2;
  } catch(e) {
    return false;
  }
})();

describe('blob', function() {
  this.timeout = 20000;
  it('should be able to receive binary data as blob when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket();
    socket.binaryType = 'blob';
    socket.on('open', function() {
      socket.send(binaryData);
      socket.on('message', function (data) {
        if (typeof data === 'string') return;

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
  
  it('should be able to send data as a blob when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket();
    socket.on('open', function() {
      if (blobSupported) {
        socket.send(new Blob([binaryData.buffer]));
      } else {
        var bb = new BlobBuilder();
        bb.append(binaryData.buffer);
        socket.send(bb.getBlob());
      }
      socket.on('message', function (data) {
        if (typeof data == 'string') { return; }

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });


});
