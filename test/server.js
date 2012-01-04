
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
      var engine = eio.listen(4000, function () {
        request.get('http://localhost:4000/engine.io')
          .data({ transport: 'tobi' }) // no tobi transport - outrageous
          .end(function (err, res) {
            expect(res.status).to.be(500);
            engine.httpServer.once('close', done).close();
          });
      });
    });

    it('should disallow `constructor` as transports', function (done) {
      // make sure we check for actual properties - not those present on every {}
      var engine = eio.listen(4000, function () {
        request.get('http://localhost:4000/engine.io')
          .data({ transport: 'constructor' })
          .end(function (err, res) {
            expect(res.status).to.be(500);
            engine.httpServer.once('close', done).close();
          });
      });
    });

    it('should disallow non-existent sids', function (done) {
      var engine = eio.listen(4000, function () {
        request.get('http://localhost:4000/engine.io')
          .data({ transport: 'polling', sid: 'test' })
          .end(function (err, res) {
            expect(res.status).to.be(500);
            engine.httpServer.once('close', done).close();
          });
      });
    });
  });

  describe('handshake', function () {
    it('should register a new client', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        var socket = new eioc.Socket('ws://localhost:4000');
        socket.on('open', function () {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should exchange handshake data', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000');
        socket.on('handshake', function (obj) {
          expect(obj.sid).to.be.a('string');
          expect(obj.pingInterval).to.be.a('number');
          expect(obj.pingTimeout).to.be.a('number');
          expect(obj.upgrades).to.be.an('array');
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should allow custom ping intervals', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false, pingInterval: 123 }, function () {
        var socket = new eioc.Socket('http://localhost:4000');
        socket.on('handshake', function (obj) {
          expect(obj.pingInterval).to.be(123);
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should allow custom ping timeouts', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false, pingTimeout: 123 }, function () {
        var socket = new eioc.Socket('http://localhost:4000');
        socket.on('handshake', function (obj) {
          expect(obj.pingTimeout).to.be(123);
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should trigger a connection event with a Socket', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000');
        engine.on('connection', function (socket) {
          expect(socket).to.be.an(eio.Socket);
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should open with polling by default', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000');
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should be able to open with ws directly', function (done) {
      var engine = eio.listen(4000, { transports: ['websocket'] }, function () {
        var socket = new eioc.Socket('ws://localhost:4000', { transports: ['websocket'] });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('websocket');
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should not suggest any upgrades for websocket', function (done) {
      var engine = eio.listen(4000, { transports: ['websocket'] }, function () {
        var socket = new eioc.Socket('ws://localhost:4000', { transports: ['websocket'] });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          engine.httpServer.once('close', done).close();
        });
      });
    });

    it('should allow arbitrary data through query string', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000', { query: { a: 'b' } });
        engine.on('connection', function (conn) {
          expect(conn.req.query).to.have.keys('transport', 'a');
          expect(conn.req.query.a).to.be('b');
          engine.httpServer.once('close', done).close();
        });
      });
    });
  });

  describe('close', function () {
    it('should trigger on client when server dies', function (done) {
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000');
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
      var engine = eio.listen(4000, opts, function () {
        var socket = new eioc.Socket('http://localhost:4000');
        socket.sendPacket = function (){};
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('ping timeout');
            engine.httpServer.once('close', done).close();
          });
        });
      });
    });

    it('should trigger on client if server does not meet ping freq', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 10 };
      var engine = eio.listen(4000, opts, function () {
        var socket = new eioc.Socket('ws://localhost:4000');
        socket.on('open', function () {
          // override onPacket to simulate an inactive server after handshake
          socket.onPacket = function(){};
          socket.on('close', function (reason, err) {
            expect(reason).to.be('ping timeout');
            engine.httpServer.once('close', done).close();
          });
        });
      });
    });

    it('should trigger on both ends upon ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingTimeout: 10, pingInterval: 10 };
      var engine = eio.listen(4000, opts, function () {
        var socket = new eioc.Socket('ws://localhost:4000')
          , total = 2

        function onClose (reason, err) {
          expect(reason).to.be('ping timeout');
          --total || engine.httpServer.once('close', done).close();
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
      var engine = eio.listen(4000, { allowUpgrades: false }, function () {
        var socket = new eioc.Socket('ws://localhost:4000')
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || engine.httpServer.once('close', done).close();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || engine.httpServer.once('close', done).close();
          });
        });
      });
    });

    it('should trigger when server closes a client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = eio.listen(4000, opts, function () {
        var socket = new eioc.Socket('ws://localhost:4000', { transports: ['websocket'] })
          , total = 2

        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('forced close');
            --total || engine.httpServer.once('close', done).close();
          });
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(reason).to.be('transport close');
            --total || engine.httpServer.once('close', done).close();
          });
        });
      });
    });
  });

});
