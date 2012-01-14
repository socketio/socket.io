
/**
 * Tests dependencies.
 */

var parser = require('../lib/parser')
  , WebSocket = require('ws')

/**
 * Tests.
 */

describe('server', function () {

  describe('verification', function () {
    it('should disallow non-existent transports', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io'.s(port))
          .data({ transport: 'tobi' }) // no tobi transport - outrageous
          .end(function (err, res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });

    it('should disallow `constructor` as transports', function (done) {
      // make sure we check for actual properties - not those present on every {}
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io'.s(port))
          .data({ transport: 'constructor' })
          .end(function (err, res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });

    it('should disallow non-existent sids', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io'.s(port))
          .data({ transport: 'polling', sid: 'test' })
          .end(function (err, res) {
            expect(res.status).to.be(500);
            done();
          });
      });
    });
  });

  describe('handshake', function () {
    it('should register a new client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          done();
        });
      });
    });

    it('should exchange handshake data', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.sid).to.be.a('string');
          expect(obj.pingInterval).to.be.a('number');
          expect(obj.pingTimeout).to.be.a('number');
          expect(obj.upgrades).to.be.an('array');
          done();
        });
      });
    });

    it('should allow custom ping intervals', function (done) {
      var engine = listen({ allowUpgrades: false, pingInterval: 123 }, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.pingInterval).to.be(123);
          done();
        });
      });
    });

    it('should allow custom ping timeouts', function (done) {
      var engine = listen({ allowUpgrades: false, pingTimeout: 123 }, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.pingTimeout).to.be(123);
          done();
        });
      });
    });

    it('should trigger a connection event with a Socket', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket).to.be.an(eio.Socket);
          done();
        });
      });
    });

    it('should open with polling by default', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          done();
        });
      });
    });

    it('should be able to open with ws directly', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('websocket');
          done();
        });
      });
    });

    it('should not suggest any upgrades for websocket', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should allow arbitrary data through query string', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { query: { a: 'b' } });
        engine.on('connection', function (conn) {
          expect(conn.req.query).to.have.keys('transport', 'a');
          expect(conn.req.query.a).to.be('b');
          done();
        });
      });
    });
  });

  describe('close', function () {
    it('should trigger on client when server dies', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          engine.httpServer.close();
        });
        socket.on('close', function (reason, err) {
          expect(reason).to.be('transport error');
          expect(err.message).to.be('xhr poll error');
          expect(err.type).to.be('TransportError');
          expect(err.description.type).to.be('StatusError');
          expect(err.description.code).to.be(503);
          done();
        });
      });
    });

    it('should trigger on server if the client does not pong', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 5, pingTimeout: 5 }
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.sendPacket = function (){};
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on client if server does not meet ping freq', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 10 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          // override onPacket to simulate an inactive server after handshake
          socket.onPacket = function(){};
          socket.on('close', function (reason, err) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on both ends upon ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingTimeout: 10, pingInterval: 10 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        function onClose (reason, err) {
          expect(reason).to.be('ping timeout');
          --total || done();
        }

        engine.on('connection', function (conn) {
          conn.on('close', onClose);
        });

        socket.on('open', function () {
          // override onPacket to simulate an inactive server after handshake
          socket.onPacket = socket.sendPacket = function(){};
          socket.on('close', onClose);
        });
      });
    });

    it('should trigger when server closes a client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });
      });
    });

    it('should trigger when server closes a client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });
      });
    });

    it('should trigger when client closes', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });

          setTimeout(function () {
            socket.close();
          }, 10);
        });
      });
    });

    it('should trigger when client closes (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || done();
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || done();
          });

          setTimeout(function () {
            socket.close();
          }, 10);
        });
      });
    });
  });

  describe('messages', function () {
    it('should arrive from server to client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.send('a');
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be('a');
            done();
          });
        });
      });
    });

    it('should arrive from server to client (multiple)', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , expected = ['a', 'b', 'c']
          , i = 0

        engine.on('connection', function (conn) {
          conn.send('a');
          // we use set timeouts to ensure the messages are delivered as part
          // of different.
          setTimeout(function () {
            conn.send('b');

            setTimeout(function () {
              // here we make sure we buffer both the close packet and
              // a regular packet
              conn.send('c');
              conn.close();
            }, 50);
          }, 50);

          conn.on('close', function () {
            // since close fires right after the buffer is drained
            setTimeout(function () {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it('should arrive from server to client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (conn) {
          conn.send('a');
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be('a');
            done();
          });
        });
      });
    });

    it('should arrive from server to client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , expected = ['a', 'b', 'c']
          , i = 0
        engine.on('connection', function (conn) {
          conn.send('a');
          setTimeout(function () {
            conn.send('b');
            setTimeout(function () {
              conn.send('c');
              conn.close();
            }, 50);
          }, 50);
          conn.on('close', function () {
            setTimeout(function () {
              expect(i).to.be(3);
              done();
            }, 50);
          });
        });
        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });
  });

  describe('upgrade', function () {

    it('should upgrade', function () {
      var i = 0, upgraded = false, didUpgrading = false;
      var engine = listen(function (port) {
        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(i++).to.eql(msg);
          });
          conn.on('upgrade', function () {
            upgraded = true;
          });
          conn.on('close', function () {
            expect(i).to.be(100);
            expect(didUpgrading).to.be(true);
            expect(upgraded).to.be(true);
          });
        });

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var count = 0;
        socket.on('upgrading', function () {
          // we want to make sure for the sake of this test that we have a buffer
          didUpgrading = true;
          expect(socket.writeBuffer.length).to.be.above(0);
        });
        socket.on('open', function () {
          setInterval(function () {
            socket.send(count++);
            if (count == 100) return socket.close();
          }, 2);
        });
      });
    });

  });

});
