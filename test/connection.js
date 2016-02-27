var expect = require('expect.js');
var io = require('../');
var hasCORS = require('has-cors');
var textBlobBuilder = require('text-blob-builder');
var env = require('./support/env');

describe('connection', function () {
  this.timeout(70000);

  it('should connect to localhost', function (done) {
    var socket = io({ forceNew: true });
    socket.emit('hi');
    socket.on('hi', function (data) {
      socket.disconnect();
      done();
    });
  });

  it('should not connect when autoConnect option set to false', function () {
    var socket = io({ forceNew: true, autoConnect: false });
    expect(socket.io.engine).to.not.be.ok();
    socket.disconnect();
  });

  it('should start two connections with same path', function () {
    var s1 = io('/');
    var s2 = io('/');

    expect(s1.io).to.not.be(s2.io);
    s1.disconnect();
    s2.disconnect();
  });

  it('should start two connections with same path and different querystrings', function () {
    var s1 = io('/?woot');
    var s2 = io('/');

    expect(s1.io).to.not.be(s2.io);
    s1.disconnect();
    s2.disconnect();
  });

  it('should work with acks', function (done) {
    var socket = io({ forceNew: true });
    socket.emit('ack');
    socket.on('ack', function (fn) {
      fn(5, { test: true });
    });
    socket.on('got it', function () {
      socket.disconnect();
      done();
    });
  });

  it('should receive date with ack', function (done) {
    var socket = io({ forceNew: true });
    socket.emit('getAckDate', { test: true }, function (data) {
      expect(data).to.be.a('string');
      socket.disconnect();
      done();
    });
  });

  it('should work with false', function (done) {
    var socket = io({ forceNew: true });
    socket.emit('false');
    socket.on('false', function (f) {
      expect(f).to.be(false);
      socket.disconnect();
      done();
    });
  });

  it('should receive utf8 multibyte characters', function (done) {
    var correct = [
      'てすと',
      'Я Б Г Д Ж Й',
      'Ä ä Ü ü ß',
      'utf8 — string',
      'utf8 — string'
    ];

    var socket = io({ forceNew: true });
    var i = 0;
    socket.on('takeUtf8', function (data) {
      expect(data).to.be(correct[i]);
      i++;
      if (i === correct.length) {
        socket.disconnect();
        done();
      }
    });
    socket.emit('getUtf8');
  });

  it('should connect to a namespace after connection established', function (done) {
    var manager = io.Manager();
    var socket = manager.socket('/');
    socket.on('connect', function () {
      var foo = manager.socket('/foo');
      foo.on('connect', function () {
        foo.close();
        socket.close();
        manager.close();
        done();
      });
    });
  });

  it('should open a new namespace after connection gets closed', function (done) {
    var manager = io.Manager();
    var socket = manager.socket('/');
    socket.on('connect', function () {
      socket.disconnect();
    }).on('disconnect', function () {
      var foo = manager.socket('/foo');
      foo.on('connect', function () {
        foo.disconnect();
        manager.close();
        done();
      });
    });
  });

  it('should reconnect by default', function (done) {
    var socket = io({ forceNew: true });
    socket.io.on('reconnect', function () {
      socket.disconnect();
      done();
    });

    setTimeout(function () {
      socket.io.engine.close();
    }, 500);
  });

  it('should reconnect manually', function (done) {
    var socket = io({ forceNew: true });
    socket.once('connect', function () {
      socket.disconnect();
    }).once('disconnect', function () {
      socket.once('connect', function () {
        socket.disconnect();
        done();
      });
      socket.connect();
    });
  });

  it('should reconnect automatically after reconnecting manually', function (done) {
    var socket = io({ forceNew: true });
    socket.once('connect', function () {
      socket.disconnect();
    }).once('disconnect', function () {
      socket.on('reconnect', function () {
        socket.disconnect();
        done();
      });
      socket.connect();
      setTimeout(function () {
        socket.io.engine.close();
      }, 500);
    });
  });

  it('should attempt reconnects after a failed reconnect', function (done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 2, reconnectionDelay: 10 });
    var socket = manager.socket('/timeout');
    socket.once('reconnect_failed', function () {
      var reconnects = 0;
      var reconnectCb = function () {
        reconnects++;
      };

      manager.on('reconnect_attempt', reconnectCb);
      manager.on('reconnect_failed', function failed () {
        expect(reconnects).to.be(2);
        socket.close();
        manager.close();
        done();
      });
      socket.connect();
    });
  });

  it('reconnect delay should increase every time', function (done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 3, reconnectionDelay: 100, randomizationFactor: 0.2 });
    var socket = manager.socket('/timeout');
    var reconnects = 0;
    var increasingDelay = true;
    var startTime;
    var prevDelay = 0;

    socket.on('connect_error', function () {
      startTime = new Date().getTime();
    });
    socket.on('reconnect_attempt', function () {
      reconnects++;
      var currentTime = new Date().getTime();
      var delay = currentTime - startTime;
      if (delay <= prevDelay) {
        increasingDelay = false;
      }
      prevDelay = delay;
    });

    socket.on('reconnect_failed', function failed () {
      expect(reconnects).to.be(3);
      expect(increasingDelay).to.be.ok();
      socket.close();
      manager.close();
      done();
    });
  });

  it('reconnect event should fire in socket', function (done) {
    var socket = io({ forceNew: true });

    socket.on('reconnect', function () {
      socket.disconnect();
      done();
    });

    setTimeout(function () {
      socket.io.engine.close();
    }, 500);
  });

  it('should not reconnect when force closed', function (done) {
    var socket = io('/invalid', { forceNew: true, timeout: 0, reconnectionDelay: 10 });
    socket.on('connect_error', function () {
      socket.on('reconnect_attempt', function () {
        expect().fail();
      });
      socket.disconnect();
      // set a timeout to let reconnection possibly fire
      setTimeout(function () {
        done();
      }, 500);
    });
  });

  it('should stop reconnecting when force closed', function (done) {
    var socket = io('/invalid', { forceNew: true, timeout: 0, reconnectionDelay: 10 });
    socket.once('reconnect_attempt', function () {
      socket.on('reconnect_attempt', function () {
        expect().fail();
      });
      socket.disconnect();
      // set a timeout to let reconnection possibly fire
      setTimeout(function () {
        done();
      }, 500);
    });
  });

  it('should reconnect after stopping reconnection', function (done) {
    var socket = io('/invalid', { forceNew: true, timeout: 0, reconnectionDelay: 10 });
    socket.once('reconnect_attempt', function () {
      socket.on('reconnect_attempt', function () {
        socket.disconnect();
        done();
      });
      socket.disconnect();
      socket.connect();
    });
  });

  it('should stop reconnecting on a socket and keep to reconnect on another', function (done) {
    var manager = io.Manager();
    var socket1 = manager.socket('/');
    var socket2 = manager.socket('/asd');

    manager.on('reconnect_attempt', function () {
      socket1.on('connect', function () {
        expect().fail();
      });
      socket2.on('connect', function () {
        setTimeout(function () {
          socket2.disconnect();
          manager.disconnect();
          done();
        }, 500);
      });
      socket1.disconnect();
    });

    setTimeout(function () {
      manager.engine.close();
    }, 1000);
  });

  it('should try to reconnect twice and fail when requested two attempts with immediate timeout and reconnect enabled', function (done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 2, reconnectionDelay: 10 });
    var socket;

    var reconnects = 0;
    var reconnectCb = function () {
      reconnects++;
    };

    manager.on('reconnect_attempt', reconnectCb);
    manager.on('reconnect_failed', function failed () {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });

    socket = manager.socket('/timeout');
  });

  it('should fire reconnect_* events on socket', function (done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 2, reconnectionDelay: 10 });
    var socket = manager.socket('/timeout_socket');

    var reconnects = 0;
    var reconnectCb = function (attempts) {
      reconnects++;
      expect(attempts).to.be(reconnects);
    };

    socket.on('reconnect_attempt', reconnectCb);
    socket.on('reconnect_failed', function failed () {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });
  });

  it('should fire error on socket', function (done) {
    var manager = io.Manager({ reconnection: true });
    var socket = manager.socket('/timeout_socket');

    socket.on('error', function (data) {
      expect(data.code).to.be('test');
      socket.close();
      manager.close();
      done();
    });

    socket.on('connect', function () {
      manager.engine.onPacket({ type: 'error', data: 'test' });
    });
  });

  it('should fire reconnecting (on socket) with attempts number when reconnecting twice', function (done) {
    var manager = io.Manager({ reconnection: true, timeout: 0, reconnectionAttempts: 2, reconnectionDelay: 10 });
    var socket = manager.socket('/timeout_socket');

    var reconnects = 0;
    var reconnectCb = function (attempts) {
      reconnects++;
      expect(attempts).to.be(reconnects);
    };

    socket.on('reconnecting', reconnectCb);
    socket.on('reconnect_failed', function failed () {
      expect(reconnects).to.be(2);
      socket.close();
      manager.close();
      done();
    });
  });

  it('should not try to reconnect and should form a connection when connecting to correct port with default timeout', function (done) {
    var manager = io.Manager({ reconnection: true, reconnectionDelay: 10 });
    var cb = function () {
      socket.close();
      expect().fail();
    };
    manager.on('reconnect_attempt', cb);

    var socket = manager.socket('/valid');
    socket.on('connect', function () {
      // set a timeout to let reconnection possibly fire
      setTimeout(function () {
        socket.close();
        manager.close();
        done();
      }, 1000);
    });
  });

  it('should connect while disconnecting another socket', function (done) {
    var manager = io.Manager();
    var socket1 = manager.socket('/foo');
    socket1.on('connect', function () {
      var socket2 = manager.socket('/asd');
      socket2.on('connect', done);
      socket1.disconnect();
    });
  });

  // Ignore incorrect connection test for old IE due to no support for
  // `script.onerror` (see: http://requirejs.org/docs/api.html#ieloadfail)
  if (!global.document || hasCORS) {
    it('should try to reconnect twice and fail when requested two attempts with incorrect address and reconnect enabled', function (done) {
      var manager = io.Manager('http://localhost:3940', { reconnection: true, reconnectionAttempts: 2, reconnectionDelay: 10 });
      var socket = manager.socket('/asd');
      var reconnects = 0;
      var cb = function () {
        reconnects++;
      };

      manager.on('reconnect_attempt', cb);

      manager.on('reconnect_failed', function () {
        expect(reconnects).to.be(2);
        socket.disconnect();
        manager.close();
        done();
      });
    });

    it('should not try to reconnect with incorrect port when reconnection disabled', function (done) {
      var manager = io.Manager('http://localhost:9823', { reconnection: false });
      var cb = function () {
        socket.close();
        expect().fail();
      };
      manager.on('reconnect_attempt', cb);

      manager.on('connect_error', function () {
        // set a timeout to let reconnection possibly fire
        setTimeout(function () {
          socket.disconnect();
          manager.close();
          done();
        }, 1000);
      });

      var socket = manager.socket('/invalid');
    });
  }

  it('should emit date as string', function (done) {
    var socket = io({ forceNew: true });
    socket.on('takeDate', function (data) {
      socket.close();
      expect(data).to.be.a('string');
      done();
    });
    socket.emit('getDate');
  });

  it('should emit date in object', function (done) {
    var socket = io({ forceNew: true });
    socket.on('takeDateObj', function (data) {
      socket.close();
      expect(data).to.be.an('object');
      expect(data.date).to.be.a('string');
      done();
    });
    socket.emit('getDateObj');
  });

  if (!global.Blob && !global.ArrayBuffer) {
    it('should get base64 data as a last resort', function (done) {
      var socket = io({ forceNew: true });
      socket.on('takebin', function (a) {
        socket.disconnect();
        expect(a.base64).to.be(true);
        expect(a.data).to.eql('YXNkZmFzZGY=');
        done();
      });
      socket.emit('getbin');
    });
  }

  if (global.ArrayBuffer) {
    var base64 = require('base64-arraybuffer');

    it('should get binary data (as an ArrayBuffer)', function (done) {
      var socket = io({ forceNew: true });
      if (env.node) {
        socket.io.engine.binaryType = 'arraybuffer';
      }
      socket.emit('doge');
      socket.on('doge', function (buffer) {
        expect(buffer instanceof ArrayBuffer).to.be(true);
        socket.disconnect();
        done();
      });
    });

    it('should send binary data (as an ArrayBuffer)', function (done) {
      var socket = io({ forceNew: true });
      socket.on('buffack', function () {
        socket.disconnect();
        done();
      });
      var buf = base64.decode('asdfasdf');
      socket.emit('buffa', buf);
    });

    it('should send binary data (as an ArrayBuffer) mixed with json', function (done) {
      var socket = io({ forceNew: true });
      socket.on('jsonbuff-ack', function () {
        socket.disconnect();
        done();
      });
      var buf = base64.decode('howdy');
      socket.emit('jsonbuff', {hello: 'lol', message: buf, goodbye: 'gotcha'});
    });

    it('should send events with ArrayBuffers in the correct order', function (done) {
      var socket = io({ forceNew: true });
      socket.on('abuff2-ack', function () {
        socket.disconnect();
        done();
      });
      var buf = base64.decode('abuff1');
      socket.emit('abuff1', buf);
      socket.emit('abuff2', 'please arrive second');
    });
  }

  if (global.Blob && null != textBlobBuilder('xxx')) {
    it('should send binary data (as a Blob)', function (done) {
      var socket = io({ forceNew: true });
      socket.on('back', function () {
        socket.disconnect();
        done();
      });
      var blob = textBlobBuilder('hello world');
      socket.emit('blob', blob);
    });

    it('should send binary data (as a Blob) mixed with json', function (done) {
      var socket = io({ forceNew: true });
      socket.on('jsonblob-ack', function () {
        socket.disconnect();
        done();
      });
      var blob = textBlobBuilder('EEEEEEEEE');
      socket.emit('jsonblob', {hello: 'lol', message: blob, goodbye: 'gotcha'});
    });

    it('should send events with Blobs in the correct order', function (done) {
      var socket = io({ forceNew: true });
      socket.on('blob3-ack', function () {
        socket.disconnect();
        done();
      });
      var blob = textBlobBuilder('BLOBBLOB');
      socket.emit('blob1', blob);
      socket.emit('blob2', 'second');
      socket.emit('blob3', blob);
    });
  }
});
