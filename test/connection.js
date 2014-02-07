var expect = require('expect.js');
var eio = require('../');

describe('connection', function() {
  this.timeout(10000);

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

  it('should be able to receive binary data when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket('ws://localhost', { transports: ['polling'] });
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

  it('should be able to receive binary data as blob when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
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
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(new Blob([binaryData]));
        socket.on('message', function (data) {
          expect(data).to.be.an(ArrayBuffer);
          expect(new Int8Array(data)).to.eql(binaryData);
          socket.close();
          done();
        });
      });
    });
  });

  it('should be able to send data as a blob when bouncing it back (polling)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket();
    socket.on('open', function() {
      socket.send(new Blob([binaryData]));
      socket.on('message', function (data) {
        if (typeof data == 'string') { return; }

        expect(data).to.be.an(ArrayBuffer);
        expect(new Int8Array(data)).to.eql(binaryData);
        socket.close();
        done();
      });
    });
  });

  it('should be able to send data as a blob encoded into base64 when bouncing it back (ws)', function(done) {
    var binaryData = new Int8Array(5);
    for (var i = 0; i < 5; i++) binaryData[i] = i;
    var socket = new eio.Socket({ forceBase64: true });
    socket.on('open', function() {
      socket.on('upgrade', function() {
        socket.send(new Blob([binaryData]));
        socket.on('message', function (data) {
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
});
