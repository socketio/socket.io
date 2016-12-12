
/**
 * Tests dependencies.
 */

var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var zlib = require('zlib');
var eio = require('..');
var eioc = require('engine.io-client');
var listen = require('./common').listen;
var expect = require('expect.js');
var request = require('superagent');
var cookieMod = require('cookie');

// are we running on node < 4.4.3 ?
var NODE_LT_443 = (function () {
  var parts = process.versions.node.split('.');
  return (parts[0] < 4 || parts[1] < 4 || parts[2] < 3);
})();
// are we running uws wsEngine ?
var UWS_ENGINE = process.env.EIO_WS_ENGINE === 'uws';

/**
 * Tests.
 */

describe('server', function () {
  describe('verification', function () {
    it('should disallow non-existent transports', function (done) {
      listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'tobi' }) // no tobi transport - outrageous
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be('Transport unknown');
            expect(res.header['access-control-allow-origin']).to.be('*');
            done();
          });
      });
    });

    it('should disallow `constructor` as transports', function (done) {
      // make sure we check for actual properties - not those present on every {}
      listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .set('Origin', 'http://engine.io')
          .query({ transport: 'constructor' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be('Transport unknown');
            expect(res.header['access-control-allow-credentials']).to.be('true');
            expect(res.header['access-control-allow-origin']).to.be('http://engine.io');
            done();
          });
      });
    });

    it('should disallow non-existent sids', function (done) {
      listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .set('Origin', 'http://engine.io')
          .query({ transport: 'polling', sid: 'test' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(1);
            expect(res.body.message).to.be('Session ID unknown');
            expect(res.header['access-control-allow-credentials']).to.be('true');
            expect(res.header['access-control-allow-origin']).to.be('http://engine.io');
            done();
          });
      });
    });
  });

  describe('handshake', function () {
    it('should send the io cookie', function (done) {
      listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            // hack-obtain sid
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid + '; Path=/; HttpOnly');
            done();
          });
      });
    });

    it('should send the io cookie custom name', function (done) {
      listen({ cookie: 'woot' }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('woot=' + sid + '; Path=/; HttpOnly');
            done();
          });
      });
    });

    it('should send the cookie with custom path', function (done) {
      listen({ cookiePath: '/custom' }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid + '; Path=/custom; HttpOnly');
            done();
          });
      });
    });

    it('should send the cookie with path=false', function (done) {
      listen({ cookiePath: false }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid);
            done();
          });
      });
    });

    it('should send the io cookie with httpOnly=true', function (done) {
      listen({ cookieHttpOnly: true }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid + '; Path=/; HttpOnly');
            done();
          });
      });
    });

    it('should send the io cookie with httpOnly=true and path=false', function (done) {
      listen({ cookieHttpOnly: true, cookiePath: false }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid);
            done();
          });
      });
    });

    it('should send the io cookie with httpOnly=false', function (done) {
      listen({ cookieHttpOnly: false }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid + '; Path=/');
            done();
          });
      });
    });

    it('should send the io cookie with httpOnly not boolean', function (done) {
      listen({ cookieHttpOnly: 'no' }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', b64: 1 })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid + '; Path=/; HttpOnly');
            done();
          });
      });
    });

    it('should not send the io cookie', function (done) {
      listen({ cookie: false }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling' })
          .end(function (res) {
            expect(res.headers['set-cookie']).to.be(undefined);
            done();
          });
      });
    });

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

    it('should register a new client with custom id', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        expect(Object.keys(engine.clients)).to.have.length(0);
        expect(engine.clientsCount).to.be(0);

        var customId = 'CustomId' + Date.now();

        engine.generateId = function (req) {
          return customId;
        };

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.once('open', function () {
          expect(Object.keys(engine.clients)).to.have.length(1);
          expect(engine.clientsCount).to.be(1);
          expect(socket.id).to.be(customId);
          expect(engine.clients[customId].id).to.be(customId);
          done();
        });
      });
    });

    it('should exchange handshake data', function (done) {
      listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.sid).to.be.a('string');
          expect(obj.pingTimeout).to.be.a('number');
          expect(obj.upgrades).to.be.an('array');
          done();
        });
      });
    });

    it('should allow custom ping timeouts', function (done) {
      listen({ allowUpgrades: false, pingTimeout: 123 }, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('handshake', function (obj) {
          expect(obj.pingTimeout).to.be(123);
          done();
        });
      });
    });

    it('should trigger a connection event with a Socket', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        eioc('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket).to.be.an(eio.Socket);
          done();
        });
      });
    });

    it('should open with polling by default', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        eioc('ws://localhost:%d'.s(port));
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('polling');
          done();
        });
      });
    });

    it('should be able to open with ws directly', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        eioc('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (socket) {
          expect(socket.transport.name).to.be('websocket');
          done();
        });
      });
    });

    it('should not suggest any upgrades for websocket', function (done) {
      listen({ transports: ['websocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should not suggest upgrades when none are availble', function (done) {
      listen({ transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should only suggest available upgrades', function (done) {
      listen({ transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should suggest all upgrades when no transports are disabled', function (done) {
      listen({}, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(1);
          expect(obj.upgrades).to.have.contain('websocket');
          done();
        });
      });
    });

    it('default to polling when proxy doesn\'t support websocket', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        engine.on('connection', function (socket) {
          socket.on('message', function (msg) {
            if ('echo' === msg) socket.send(msg);
          });
        });

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          request.get('http://localhost:%d/engine.io/'.s(port))
          .set({ connection: 'close' })
          .query({ transport: 'websocket', sid: socket.id })
          .end(function (err, res) {
            expect(err).to.be(null);
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(3);
            socket.send('echo');
            socket.on('message', function (msg) {
              expect(msg).to.be('echo');
              done();
            });
          });
        });
      });
    });

    it('should allow arbitrary data through query string', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        eioc('ws://localhost:%d'.s(port), { query: { a: 'b' } });
        engine.on('connection', function (conn) {
          expect(conn.request._query).to.have.keys('transport', 'a');
          expect(conn.request._query.a).to.be('b');
          done();
        });
      });
    });

    it('should allow data through query string in uri', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        eioc('ws://localhost:%d?a=b&c=d'.s(port));
        engine.on('connection', function (conn) {
          expect(conn.request._query.EIO).to.be.a('string');
          expect(conn.request._query.a).to.be('b');
          expect(conn.request._query.c).to.be('d');
          done();
        });
      });
    });

    it('should disallow bad requests', function (done) {
      listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .set('Origin', 'http://engine.io')
          .query({ transport: 'websocket' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(3);
            expect(res.body.message).to.be('Bad request');
            expect(res.header['access-control-allow-credentials']).to.be('true');
            expect(res.header['access-control-allow-origin']).to.be('http://engine.io');
            done();
          });
      });
    });
  });

  describe('close', function () {
    it('should be able to access non-empty writeBuffer at closing (server)', function (done) {
      var opts = {allowUpgrades: false};
      var engine = listen(opts, function (port) {
        eioc('http://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(conn.writeBuffer.length).to.be(1);
            setTimeout(function () {
              expect(conn.writeBuffer.length).to.be(0); // writeBuffer has been cleared
            }, 10);
            done();
          });
          conn.writeBuffer.push({ type: 'message', data: 'foo' });
          conn.onError('');
        });
      });
    });

    it('should be able to access non-empty writeBuffer at closing (client)', function (done) {
      var opts = {allowUpgrades: false};
      listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('open', function () {
          socket.on('close', function (reason) {
            expect(socket.writeBuffer.length).to.be(1);
            setTimeout(function () {
              expect(socket.writeBuffer.length).to.be(0);
            }, 10);
            done();
          });
          socket.writeBuffer.push({ type: 'message', data: 'foo' });
          socket.onError('');
        });
      });
    });

    it('should trigger on server if the client does not pong', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 5, pingTimeout: 5 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.sendPacket = function () {};
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on server even when there is no outstanding polling request (GH-198)', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 500, pingTimeout: 500 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(reason).to.be('ping timeout');
            done();
          });
          // client abruptly disconnects, no polling request on this tick since we've just connected
          socket.sendPacket = socket.onPacket = function () {};
          socket.close();
          // then server app tries to close the socket, since client disappeared
          conn.close();
        });
      });
    });

    it('should trigger on client if server does not meet ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 50, pingTimeout: 30 };
      listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          // override onPacket and Transport#onClose to simulate an inactive server after handshake
          socket.onPacket = function () {};
          socket.transport.onClose = function () {};
          socket.on('close', function (reason, err) {
            expect(reason).to.be('ping timeout');
            done();
          });
        });
      });
    });

    it('should trigger on both ends upon ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingTimeout: 500, pingInterval: 10 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var total = 2;

        function onClose (reason, err) {
          expect(reason).to.be('ping timeout');
          --total || done();
        }

        engine.on('connection', function (conn) {
          conn.on('close', onClose);
        });

        socket.on('open', function () {
          // override onPacket and Transport#onClose to simulate an inactive server after handshake
          socket.onPacket = socket.sendPacket = function () {};
          socket.transport.onClose = function () {};
          socket.on('close', onClose);
        });
      });
    });

    it('should trigger when server closes a client', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var total = 2;

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
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        var total = 2;

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

    it('should allow client reconnect after restarting (ws)', function (done) {
      var opts = { transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        engine.httpServer.close();
        engine.httpServer.listen(port);

        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });

        engine.once('connection', function (conn) {
          setTimeout(function () {
            conn.close();
          }, 10);
        });

        socket.once('close', function (reason) {
          expect(reason).to.be('transport close');
          done();
        });
      });
    });

    it('should trigger when client closes', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var total = 2;

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
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        var total = 2;

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

    it('should trigger when calling socket.close() in payload', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));

        engine.on('connection', function (conn) {
          conn.send(null, function () { socket.close(); });
          conn.send('this should not be handled');

          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            done();
          });
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.not.be('this should not be handled');
          });

          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
          });
        });
      });
    });

    it('should abort upgrade if socket is closed (GH-35)', function (done) {
      listen({ allowUpgrades: true }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          socket.close();
          // we wait until complete to see if we get an uncaught EPIPE
          setTimeout(function () {
            done();
          }, 100);
        });
      });
    });

    it('should trigger if a poll request is ongoing and the underlying ' +
       'socket closes, as in a browser tab close', function ($done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        // hack to access the sockets created by node-xmlhttprequest
        // see: https://github.com/driverdan/node-XMLHttpRequest/issues/44
        var request = require('http').request;
        var sockets = [];
        http.request = function (opts) {
          var req = request.apply(null, arguments);
          req.on('socket', function (socket) {
            sockets.push(socket);
          });
          return req;
        };

        function done () {
          http.request = request;
          $done();
        }

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var serverSocket;

        engine.on('connection', function (s) {
          serverSocket = s;
        });

        socket.transport.on('poll', function () {
          // we set a timer to wait for the request to actually reach
          setTimeout(function () {
            // at this time server's `connection` should have been fired
            expect(serverSocket).to.be.an('object');

            // OPENED readyState is expected - we are actually polling
            expect(socket.transport.pollXhr.xhr.readyState).to.be(1);

            // 2 requests sent to the server over an unique port means
            // we should have been assigned 2 sockets
            expect(sockets.length).to.be(2);

            // expect the socket to be open at this point
            expect(serverSocket.readyState).to.be('open');

            // kill the underlying connection
            sockets[1].end();
            serverSocket.on('close', function (reason, err) {
              expect(reason).to.be('transport error');
              expect(err.message).to.be('poll connection closed prematurely');
              done();
            });
          }, 50);
        });
      });
    });

    it('should not trigger with connection: close header', function ($done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        // intercept requests to add connection: close
        var request = http.request;
        http.request = function () {
          var opts = arguments[0];
          opts.headers = opts.headers || {};
          opts.headers.Connection = 'close';
          return request.apply(this, arguments);
        };

        function done () {
          http.request = request;
          $done();
        }

        engine.on('connection', function (socket) {
          socket.on('message', function (msg) {
            expect(msg).to.equal('test');
            socket.send('woot');
          });
        });

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          socket.send('test');
        });
        socket.on('message', function (msg) {
          expect(msg).to.be('woot');
          done();
        });
      });
    });

    it('should not trigger early with connection `ping timeout`' +
       'after post handshake timeout', function (done) {
      // first timeout should trigger after `pingInterval + pingTimeout`,
      // not just `pingTimeout`.
      var opts = { allowUpgrades: false, pingInterval: 300, pingTimeout: 100 };
      listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var clientCloseReason = null;

        socket.on('handshake', function () {
          socket.onPacket = function () {};
        });
        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        setTimeout(function () {
          expect(clientCloseReason).to.be(null);
          done();
        }, 200);
      });
    });

    it('should not trigger early with connection `ping timeout` ' +
       'after post ping timeout', function (done) {
      // ping timeout should trigger after `pingInterval + pingTimeout`,
      // not just `pingTimeout`.
      var opts = { allowUpgrades: false, pingInterval: 80, pingTimeout: 50 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var clientCloseReason = null;

        engine.on('connection', function (conn) {
          conn.on('heartbeat', function () {
            conn.onPacket = function () {};
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        setTimeout(function () {
          expect(clientCloseReason).to.be(null);
          done();
        }, 100);
      });
    });

    it('should trigger early with connection `transport close` ' +
       'after missing pong', function (done) {
      // ping timeout should trigger after `pingInterval + pingTimeout`,
      // not just `pingTimeout`.
      var opts = { allowUpgrades: false, pingInterval: 80, pingTimeout: 50 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var clientCloseReason = null;

        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        engine.on('connection', function (conn) {
          conn.on('heartbeat', function () {
            setTimeout(function () {
              conn.close();
            }, 20);
            setTimeout(function () {
              expect(clientCloseReason).to.be('transport close');
              done();
            }, 100);
          });
        });
      });
    });

    it('should trigger with connection `ping timeout` ' +
       'after `pingInterval + pingTimeout`', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 300, pingTimeout: 100 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var clientCloseReason = null;

        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        engine.on('connection', function (conn) {
          conn.once('heartbeat', function () {
            setTimeout(function () {
              socket.onPacket = function () {};
              expect(clientCloseReason).to.be(null);
            }, 150);
            setTimeout(function () {
              expect(clientCloseReason).to.be(null);
            }, 350);
            setTimeout(function () {
              expect(clientCloseReason).to.be('ping timeout');
              done();
            }, 500);
          });
        });
      });
    });

    it('should abort the polling data request if it is ' +
       'in progress', function (done) {
      var engine = listen({ transports: [ 'polling' ] }, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));

        engine.on('connection', function (conn) {
          var onDataRequest = conn.transport.onDataRequest;
          conn.transport.onDataRequest = function (req, res) {
            engine.httpServer.close(done);
            onDataRequest.call(conn.transport, req, res);
            req.removeAllListeners();
            conn.close();
          };
        });

        socket.on('open', function () {
          socket.send('test');
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // websocket test, transport error
    it('should trigger transport close before open for ws', function (done) {
      var opts = { transports: ['websocket'] };
      listen(opts, function (port) {
        var url = 'ws://%s:%d'.s('0.0.0.50', port);
        var socket = new eioc.Socket(url);
        socket.on('open', function () {
          done(new Error('Test invalidation'));
        });
        socket.on('close', function (reason) {
          expect(reason).to.be('transport error');
          done();
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // polling test, transport error
    it('should trigger transport close before open for xhr', function (done) {
      var opts = { transports: ['polling'] };
      listen(opts, function (port) {
        var socket = new eioc.Socket('http://invalidserver:%d'.s(port));
        socket.on('open', function () {
          done(new Error('Test invalidation'));
        });
        socket.on('close', function (reason) {
          expect(reason).to.be('transport error');
          done();
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // websocket test, force close
    it('should trigger force close before open for ws', function (done) {
      var opts = { transports: ['websocket'] };
      listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          done(new Error('Test invalidation'));
        });
        socket.on('close', function (reason) {
          expect(reason).to.be('forced close');
          done();
        });
        socket.close();
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/207
    // polling test, force close
    it('should trigger force close before open for xhr', function (done) {
      var opts = { transports: ['polling'] };
      listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('open', function () {
          done(new Error('Test invalidation'));
        });
        socket.on('close', function (reason) {
          expect(reason).to.be('forced close');
          done();
        });
        socket.close();
      });
    });

    it('should close transport upon ping timeout (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'], pingInterval: 50, pingTimeout: 30 };
      var engine = listen(opts, function (port) {
        engine.on('connection', function (conn) {
          conn.transport.on('close', done);
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        // override to simulate an inactive client
        socket.sendPacket = socket.onHeartbeat = function () {};
      });
    });

    it('should close transport upon ping timeout (polling)', function (done) {
      var opts = { allowUpgrades: false, transports: ['polling'], pingInterval: 50, pingTimeout: 30 };
      var engine = listen(opts, function (port) {
        engine.on('connection', function (conn) {
          conn.transport.on('close', done);
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
        // override to simulate an inactive client
        socket.sendPacket = socket.onHeartbeat = function () {};
      });
    });

    it('should close transport upon parse error (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        engine.on('connection', function (conn) {
          conn.transport.on('close', done);
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('open', function () {
          socket.transport.ws.send('invalid');
        });
      });
    });

    it('should close transport upon parse error (polling)', function (done) {
      var opts = { allowUpgrades: false, transports: ['polling'] };
      var engine = listen(opts, function (port) {
        engine.on('connection', function (conn) {
          conn.transport.closeTimeout = 100;
          conn.transport.on('close', done);
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
        socket.on('open', function () {
          socket.transport.doWrite('invalid', function () {});
        });
      });
    });

    it('should close upgrading transport upon socket close', function (done) {
      var engine = listen(function (port) {
        engine.on('connection', function (conn) {
          conn.on('upgrading', function (transport) {
            transport.on('close', done);
            conn.close();
          });
        });
        eioc('ws://localhost:%d'.s(port));
      });
    });

    it('should close upgrading transport upon upgrade timeout', function (done) {
      var opts = { upgradeTimeout: 100 };
      var engine = listen(opts, function (port) {
        engine.on('connection', function (conn) {
          conn.on('upgrading', function (transport) {
            transport.on('close', done);
          });
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('upgrading', function (transport) {
          // override not to complete upgrading
          transport.send = function () {};
        });
      });
    });

    it('should not crash when messing with Object prototype', function (done) {
      Object.prototype.foo = 'bar'; // eslint-disable-line no-extend-native
      var engine = listen({ allowUpgrades: true }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          engine.close();
          setTimeout(function () {
            done();
          }, 100);
        });
      });
    });

    describe('graceful close', function () {
      function fixture (filename) {
        return process.execPath + ' ' +
          path.join(__dirname, 'fixtures', filename);
      }

      it('should stop socket and timers', function (done) {
        exec(fixture('server-close.js'), done);
      });

      it('should stop upgraded socket and timers', function (done) {
        exec(fixture('server-close-upgraded.js'), done);
      });

      it('should stop upgrading socket and timers', function (done) {
        exec(fixture('server-close-upgrading.js'), done);
      });
    });
  });

  describe('messages', function () {
    this.timeout(5000);

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
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var expected = ['a', 'b', 'c'];
        var i = 0;

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

    it('should not be receiving data when getting a message longer than maxHttpBufferSize when polling', function (done) {
      var opts = { allowUpgrades: false, transports: ['polling'], maxHttpBufferSize: 5 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            console.log(msg);
          });
        });
        socket.on('open', function () {
          socket.send('aasdasdakjhasdkjhasdkjhasdkjhasdkjhasdkjhasdkjha');
        });
      });
      setTimeout(done, 1000);
    });

    it('should receive data when getting a message shorter than maxHttpBufferSize when polling', function (done) {
      var opts = { allowUpgrades: false, transports: ['polling'], maxHttpBufferSize: 5 };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('a');
            done();
          });
        });
        socket.on('open', function () {
          socket.send('a');
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

    it('should arrive from server to client (multiple, ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        var expected = ['a', 'b', 'c'];
        var i = 0;

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

    it('should arrive from server to client (multiple, no delay, ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        var expected = ['a', 'b', 'c'];
        var i = 0;

        engine.on('connection', function (conn) {
          conn.on('close', function () {
            setTimeout(function () {
              expect(i).to.be(3);
              done();
            }, 50);
          });
          conn.send('a');
          conn.send('b');
          conn.send('c');
          conn.close();
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg).to.be(expected[i++]);
          });
        });
      });
    });

    it('should arrive when binary data is sent as Int8Array (ws)', function (done) {
      var binaryData = new Int8Array(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData[i] = i;
      }

      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            for (var i = 0; i < binaryData.length; i++) {
              var num = msg.readInt8(i);
              expect(num).to.be(i);
            }
            done();
          });
        });
      });
    });

    it('should arrive when binary data is sent as Int32Array (ws)', function (done) {
      var binaryData = new Int32Array(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData[i] = (i + 100) * 9823;
      }

      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            for (var i = 0, ii = 0; ii < binaryData.length; i += 4, ii++) {
              var num = msg.readInt32LE(i);
              expect(num).to.be((ii + 100) * 9823);
            }
            done();
          });
        });
      });
    });

    it('should arrive when binary data is sent as Int32Array, given as ArrayBuffer(ws)', function (done) {
      var binaryData = new Int32Array(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData[i] = (i + 100) * 9823;
      }

      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });

        engine.on('connection', function (conn) {
          conn.send(binaryData.buffer);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            for (var i = 0, ii = 0; ii < binaryData.length; i += 4, ii++) {
              var num = msg.readInt32LE(i);
              expect(num).to.be((ii + 100) * 9823);
            }
            done();
          });
        });
      });
    });

    it('should arrive when binary data is sent as Buffer (ws)', function (done) {
      var binaryData = new Buffer(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            for (var i = 0; i < binaryData.length; i++) {
              var num = msg.readInt8(i);
              expect(num).to.be(i);
            }
            done();
          });
        });
      });
    });

    it('should arrive when binary data sent as Buffer (polling)', function (done) {
      var binaryData = new Buffer(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      var opts = { allowUpgrades: false, transports: ['polling'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            for (var i = 0; i < binaryData.length; i++) {
              var num = msg.readInt8(i);
              expect(num).to.be(i);
            }

            done();
          });
        });
      });
    });

    it('should arrive as ArrayBuffer if requested when binary data sent as Buffer (ws)', function (done) {
      var binaryData = new Buffer(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.binaryType = 'arraybuffer';

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg instanceof ArrayBuffer).to.be(true);
            var intArray = new Int8Array(msg);
            for (var i = 0; i < binaryData.length; i++) {
              expect(intArray[i]).to.be(i);
            }

            done();
          });
        });
      });
    });

    it('should arrive as ArrayBuffer if requested when binary data sent as Buffer (polling)', function (done) {
      var binaryData = new Buffer(5);
      for (var i = 0; i < binaryData.length; i++) {
        binaryData.writeInt8(i, i);
      }

      var opts = { allowUpgrades: false, transports: ['polling'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
        socket.binaryType = 'arraybuffer';

        engine.on('connection', function (conn) {
          conn.send(binaryData);
        });

        socket.on('open', function () {
          socket.on('message', function (msg) {
            expect(msg instanceof ArrayBuffer).to.be(true);
            var intArray = new Int8Array(msg);
            for (var i = 0; i < binaryData.length; i++) {
              expect(intArray[i]).to.be(i);
            }

            done();
          });
        });
      });
    });

    it('should trigger a flush/drain event', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        engine.on('connection', function (socket) {
          var totalEvents = 4;

          engine.on('flush', function (sock, buf) {
            expect(sock).to.be(socket);
            expect(buf).to.be.an('array');
            --totalEvents || done();
          });
          socket.on('flush', function (buf) {
            expect(buf).to.be.an('array');
            --totalEvents || done();
          });

          engine.on('drain', function (sock) {
            expect(sock).to.be(socket);
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });
          socket.on('drain', function () {
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });

          socket.send('aaaa');
        });

        eioc('ws://localhost:%d'.s(port));
      });
    });

    it('should interleave with pongs if many messages buffered ' +
       'after connection open', function (done) {
      this.slow(4000);
      this.timeout(8000);

      var opts = {
        transports: ['websocket'],
        pingInterval: 200,
        pingTimeout: 100
      };

      var engine = listen(opts, function (port) {
        var messageCount = 100;
        var messagePayload = new Array(256 * 256).join('a');
        var connection = null;
        engine.on('connection', function (conn) {
          connection = conn;
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('open', function () {
          for (var i = 0; i < messageCount; i++) {
//            connection.send('message: ' + i);   // works
            connection.send(messagePayload + '|message: ' + i);   // does not work
          }
          var receivedCount = 0;
          socket.on('message', function (msg) {
            receivedCount += 1;
            if (receivedCount === messageCount) {
              done();
            }
          });
        });
      });
    });

    it('should support chinese', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var shi = '石室詩士施氏，嗜獅，誓食十獅。';
        var shi2 = '氏時時適市視獅。';
        engine.on('connection', function (conn) {
          conn.send('.');
          conn.send(shi);
          conn.send(shi2);
          conn.once('message', function (msg0) {
            expect(msg0).to.be('.');
            conn.once('message', function (msg) {
              expect(msg).to.be(shi);
              conn.once('message', function (msg2) {
                expect(msg2).to.be(shi2);
                done();
              });
            });
          });
        });
        socket.on('open', function () {
          socket.once('message', function (msg0) {
            expect(msg0).to.be('.');
            socket.once('message', function (msg) {
              expect(msg).to.be(shi);
              socket.once('message', function (msg2) {
                expect(msg2).to.be(shi2);
                socket.send('.');
                socket.send(shi);
                socket.send(shi2);
              });
            });
          });
        });
      });
    });

    it('should send and receive data with key and cert (polling)', function (done) {
      if (UWS_ENGINE && NODE_LT_443) return done();
      var srvOpts = {
        key: fs.readFileSync('test/fixtures/server.key'),
        cert: fs.readFileSync('test/fixtures/server.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      };

      var opts = {
        key: fs.readFileSync('test/fixtures/client.key'),
        cert: fs.readFileSync('test/fixtures/client.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        transports: ['polling']
      };

      var srv = https.createServer(srvOpts, function (req, res) {
        res.writeHead(200);
        res.end('hello world\n');
      });

      var engine = eio({ transports: ['polling'], allowUpgrades: false });
      engine.attach(srv);
      srv.listen(function () {
        var port = srv.address().port;
        var socket = new eioc.Socket('https://localhost:%d'.s(port), opts);

        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('hello');
            done();
          });
        });

        socket.on('open', function () {
          socket.send('hello');
        });
      });
    });

    it('should send and receive data with ca when not requiring auth (polling)', function (done) {
      if (UWS_ENGINE && NODE_LT_443) return done();
      var srvOpts = {
        key: fs.readFileSync('test/fixtures/server.key'),
        cert: fs.readFileSync('test/fixtures/server.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        requestCert: true
      };

      var opts = {
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        transports: ['polling']
      };

      var srv = https.createServer(srvOpts, function (req, res) {
        res.writeHead(200);
        res.end('hello world\n');
      });

      var engine = eio({ transports: ['polling'], allowUpgrades: false });
      engine.attach(srv);
      srv.listen(function () {
        var port = srv.address().port;
        var socket = new eioc.Socket('https://localhost:%d'.s(port), opts);

        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('hello');
            done();
          });
        });

        socket.on('open', function () {
          socket.send('hello');
        });
      });
    });

    it('should send and receive data with key and cert (ws)', function (done) {
      var srvOpts = {
        key: fs.readFileSync('test/fixtures/server.key'),
        cert: fs.readFileSync('test/fixtures/server.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      };

      var opts = {
        key: fs.readFileSync('test/fixtures/client.key'),
        cert: fs.readFileSync('test/fixtures/client.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        transports: ['websocket']
      };

      var srv = https.createServer(srvOpts, function (req, res) {
        res.writeHead(200);
        res.end('hello world\n');
      });

      var engine = eio({ transports: ['websocket'], allowUpgrades: false });
      engine.attach(srv);
      srv.listen(function () {
        var port = srv.address().port;
        var socket = new eioc.Socket('https://localhost:%d'.s(port), opts);

        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('hello');
            done();
          });
        });

        socket.on('open', function () {
          socket.send('hello');
        });
      });
    });

    it('should send and receive data with pfx (polling)', function (done) {
      if (UWS_ENGINE && NODE_LT_443) return done();
      var srvOpts = {
        key: fs.readFileSync('test/fixtures/server.key'),
        cert: fs.readFileSync('test/fixtures/server.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      };

      var opts = {
        pfx: fs.readFileSync('test/fixtures/client.pfx'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        transports: ['polling']
      };

      var srv = https.createServer(srvOpts, function (req, res) {
        res.writeHead(200);
        res.end('hello world\n');
      });

      var engine = eio({ transports: ['polling'], allowUpgrades: false });
      engine.attach(srv);
      srv.listen(function () {
        var port = srv.address().port;
        var socket = new eioc.Socket('https://localhost:%d'.s(port), opts);

        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('hello');
            done();
          });
        });

        socket.on('open', function () {
          socket.send('hello');
        });
      });
    });

    it('should send and receive data with pfx (ws)', function (done) {
      if (UWS_ENGINE && NODE_LT_443) return done();
      var srvOpts = {
        key: fs.readFileSync('test/fixtures/server.key'),
        cert: fs.readFileSync('test/fixtures/server.crt'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      };

      var opts = {
        pfx: fs.readFileSync('test/fixtures/client.pfx'),
        ca: fs.readFileSync('test/fixtures/ca.crt'),
        transports: ['websocket']
      };

      var srv = https.createServer(srvOpts, function (req, res) {
        res.writeHead(200);
        res.end('hello world\n');
      });

      var engine = eio({ transports: ['websocket'], allowUpgrades: false });
      engine.attach(srv);
      srv.listen(function () {
        var port = srv.address().port;
        var socket = new eioc.Socket('https://localhost:%d'.s(port), opts);

        engine.on('connection', function (conn) {
          conn.on('message', function (msg) {
            expect(msg).to.be('hello');
            done();
          });
        });

        socket.on('open', function () {
          socket.send('hello');
        });
      });
    });
  });

  describe('send', function () {
    describe('writeBuffer', function () {
      it('should not empty until `drain` event (polling)', function (done) {
        listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var totalEvents = 2;
          socket.on('open', function () {
            socket.send('a');
            socket.send('b');
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on('drain', function () {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });

      it('should not empty until `drain` event (websocket)', function (done) {
        listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var totalEvents = 2;
          socket.on('open', function () {
            socket.send('a');
            socket.send('b');
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on('drain', function () {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });
    });

    describe('callback', function () {
      it('should execute in order when message sent (client) (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.on('message', function (msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn () {
              socket.send(j, (function (value) {
                j++;
              })(j));
            }

            sendFn();
          });
        });
      });

      it('should execute in order when message sent (client) (websocket)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.on('message', function (msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn () {
              socket.send(j, (function (value) {
                j++;
              })(j));
            }

            sendFn();
          });
        });
      });

      it('should execute in order with payloads (client) (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var i = 0;
          var lastCbFired = 0;

          engine.on('connection', function (conn) {
            conn.on('message', function (msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb (value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value === 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once('flush', function () {
              socket.send(2, function () { cb(2); });
              socket.send(3, function () { cb(3); });
            });

            socket.send(1, function () { cb(1); });
          });
        });
      });

      it('should execute in order with payloads (client) (websocket)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var i = 0;
          var lastCbFired = 0;

          engine.on('connection', function (conn) {
            conn.on('message', function (msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb (value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value === 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once('flush', function () {
              socket.send(2, function () { cb(2); });
              socket.send(3, function () { cb(3); });
            });

            socket.send(1, function () { cb(1); });
          });
        });
      });

      it('should execute when message sent (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.send('a', function (transport) {
              i++;
            });
          });
          socket.on('open', function () {
            socket.on('message', function (msg) {
              j++;
            });
          });

          setTimeout(function () {
            expect(i).to.be(j);
            done();
          }, 100);
        });
      });

      it('should execute when message sent (websocket)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.send('a', function (transport) {
              i++;
            });
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              j++;
            });
          });

          setTimeout(function () {
            expect(i).to.be(j);
            done();
          }, 100);
        });
      });

      it('should execute once for each send', function (done) {
        var engine = listen(function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port));
          var a = 0;
          var b = 0;
          var c = 0;
          var all = 0;

          engine.on('connection', function (conn) {
            conn.send('a');
            conn.send('b');
            conn.send('c');
          });

          socket.on('open', function () {
            socket.on('message', function (msg) {
              if (msg === 'a') a++;
              if (msg === 'b') b++;
              if (msg === 'c') c++;

              if (++all === 3) {
                expect(a).to.be(1);
                expect(b).to.be(1);
                expect(c).to.be(1);
                done();
              }
            });
          });
        });
      });

      it('should execute in multipart packet', function (done) {
        var engine = listen(function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port));
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.send('b', function (transport) {
              i++;
            });

            conn.send('a', function (transport) {
              i++;
            });
          });
          socket.on('open', function () {
            socket.on('message', function (msg) {
              j++;
            });
          });

          setTimeout(function () {
            expect(i).to.be(j);
            done();
          }, 200);
        });
      });

      it('should execute in multipart packet (polling)', function (done) {
        var engine = listen(function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function (conn) {
            conn.send('d', function (transport) {
              i++;
            });

            conn.send('c', function (transport) {
              i++;
            });

            conn.send('b', function (transport) {
              i++;
            });

            conn.send('a', function (transport) {
              i++;
            });
          });
          socket.on('open', function () {
            socket.on('message', function (msg) {
              j++;
            });
          });

          setTimeout(function () {
            expect(i).to.be(j);
            done();
          }, 200);
        });
      });

      it('should clean callback references when socket gets closed with pending callbacks', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });

          engine.on('connection', function (conn) {
            socket.transport.on('pollComplete', function () {
              conn.send('a', function (transport) {
                done(new Error('Test invalidation'));
              });

              if (!conn.writeBuffer.length) {
                done(new Error('Test invalidation'));
              }

              // force to close the socket when we have one or more packet(s) in buffer
              socket.close();
            });

            conn.on('close', function (reason) {
              expect(conn.packetsFn).to.be.empty();
              expect(conn.sentCallbackFn).to.be.empty();
              done();
            });
          });
        });
      });

      it('should not execute when it is not actually sent (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });

          socket.transport.on('pollComplete', function (msg) {
            socket.close();
          });

          engine.on('connection', function (conn) {
            var err;
            conn.send('a');
            conn.send('b', function (transport) {
              err = new Error('Test invalidation');
            });
            conn.on('close', function (reason) {
              done(err);
            });
          });
        });
      });
    });
  });

  describe('packet', function () {
    it('should emit when socket receives packet', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('packet', function (packet) {
            expect(packet.type).to.be('message');
            expect(packet.data).to.be('a');
            done();
          });
        });
        socket.on('open', function () {
          socket.send('a');
        });
      });
    });

    it('should emit when receives ping', function (done) {
      var engine = listen({ allowUpgrades: false, pingInterval: 4 }, function (port) {
        eioc('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('packet', function (packet) {
            conn.close();
            expect(packet.type).to.be('ping');
            done();
          });
        });
      });
    });
  });

  describe('packetCreate', function () {
    it('should emit before socket send message', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        eioc('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('packetCreate', function (packet) {
            expect(packet.type).to.be('message');
            expect(packet.data).to.be('a');
            done();
          });
          conn.send('a');
        });
      });
    });

    it('should emit before send pong', function (done) {
      var engine = listen({ allowUpgrades: false, pingInterval: 4 }, function (port) {
        eioc('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('packetCreate', function (packet) {
            conn.close();
            expect(packet.type).to.be('pong');
            done();
          });
        });
      });
    });
  });

  describe('upgrade', function () {
    it('should upgrade', function (done) {
      var engine = listen(function (port) {
        // it takes both to send 50 to verify
        var ready = 2;
        var closed = 2;
        function finish () {
          setTimeout(function () {
            socket.close();
          }, 10);
        }

        // server
        engine.on('connection', function (conn) {
          var lastSent = 0;
          var lastReceived = 0;
          var upgraded = false;
          var interval = setInterval(function () {
            lastSent++;
            conn.send(lastSent);
            if (50 === lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);

          expect(conn.request._query.transport).to.be('polling');

          conn.on('message', function (msg) {
            expect(conn.request._query).to.be.an('object');
            lastReceived++;
            expect(msg).to.eql(lastReceived);
          });

          conn.on('upgrade', function (to) {
            expect(conn.request._query.transport).to.be('polling');
            upgraded = true;
            expect(to.name).to.be('websocket');
            expect(conn.transport.name).to.be('websocket');
          });

          conn.on('close', function (reason) {
            expect(reason).to.be('transport close');
            expect(lastSent).to.be(50);
            expect(lastReceived).to.be(50);
            expect(upgraded).to.be(true);
            --closed || done();
          });
        });

        // client
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          var lastSent = 0;
          var lastReceived = 0;
          var upgrades = 0;
          var interval = setInterval(function () {
            lastSent++;
            socket.send(lastSent);
            if (50 === lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);
          socket.on('upgrading', function (to) {
            // we want to make sure for the sake of this test that we have a buffer
            expect(to.name).to.equal('websocket');
            upgrades++;

            // force send a few packets to ensure we test buffer transfer
            lastSent++;
            socket.send(lastSent);
            lastSent++;
            socket.send(lastSent);

            expect(socket.writeBuffer).to.not.be.empty();
          });
          socket.on('upgrade', function (to) {
            expect(to.name).to.equal('websocket');
            upgrades++;
          });
          socket.on('message', function (msg) {
            lastReceived++;
            expect(lastReceived).to.eql(msg);
          });
          socket.on('close', function (reason) {
            expect(reason).to.be('forced close');
            expect(lastSent).to.be(50);
            expect(upgrades).to.be(2);
            --closed || done();
          });
        });
      });

      // attach another engine to make sure it doesn't break upgrades
      eio.attach(engine.httpServer, { path: '/foo' });
    });
  });

  describe('http compression', function () {
    function getSidFromResponse (res) {
      var c = cookieMod.parse(res.headers['set-cookie'][0]);
      return c[Object.keys(c)[0]];
    }

    it('should compress by default', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(1024);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.equal('gzip');
            res.pipe(zlib.createGunzip())
              .on('error', done)
              .on('end', done)
              .resume();
          });
        });
      });
    });

    it('should compress using deflate', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(1024);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.equal('deflate');
            res.pipe(zlib.createDeflate())
              .on('error', done)
              .on('end', done)
              .resume();
          });
        });
      });
    });

    it('should set threshold', function (done) {
      var engine = listen({ transports: ['polling'], httpCompression: { threshold: 0 } }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(10);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.equal('gzip');
            done();
          });
        });
      });
    });

    it('should disable compression', function (done) {
      var engine = listen({ transports: ['polling'], httpCompression: false }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(1024);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.be(undefined);
            done();
          });
        });
      });
    });

    it('should disable compression per message', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(1024);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf, { compress: false });
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.be(undefined);
            done();
          });
        });
      });
    });

    it('should not compress when the byte size is below threshold', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        engine.on('connection', function (conn) {
          var buf = new Buffer(100);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf);
        });

        http.get({
          port: port,
          path: '/engine.io/default/?transport=polling'
        }, function (res) {
          var sid = getSidFromResponse(res);
          http.get({
            port: port,
            path: '/engine.io/default/?transport=polling&sid=' + sid,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          }, function (res) {
            expect(res.headers['content-encoding']).to.be(undefined);
            done();
          });
        });
      });
    });
  });

  describe('permessage-deflate', function () {
    it('should set threshold', function (done) {
      var engine = listen({ transports: ['websocket'], perMessageDeflate: { threshold: 0 } }, function (port) {
        engine.on('connection', function (conn) {
          var socket = conn.transport.socket;
          var send = socket.send;
          socket.send = function (data, opts, callback) {
            socket.send = send;
            socket.send(data, opts, callback);

            expect(opts.compress).to.be(true);
            conn.close();
            done();
          };

          var buf = new Buffer(100);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf, { compress: true });
        });
        eioc('http://localhost:%d'.s(port), { transports: ['websocket'] });
      });
    });

    it('should not compress when the byte size is below threshold', function (done) {
      var engine = listen({ transports: ['websocket'] }, function (port) {
        engine.on('connection', function (conn) {
          var socket = conn.transport.socket;
          var send = socket.send;
          socket.send = function (data, opts, callback) {
            socket.send = send;
            socket.send(data, opts, callback);

            expect(opts.compress).to.be(false);
            conn.close();
            done();
          };

          var buf = new Buffer(100);
          for (var i = 0; i < buf.length; i++) buf[i] = i % 0xff;
          conn.send(buf, { compress: true });
        });
        eioc('http://localhost:%d'.s(port), { transports: ['websocket'] });
      });
    });
  });

  describe('extraHeaders', function () {
    this.timeout(5000);

    var headers = {
      'x-custom-header-for-my-project': 'my-secret-access-token',
      'cookie': 'user_session=NI2JlCKF90aE0sJZD9ZzujtdsUqNYSBYxzlTsvdSUe35ZzdtVRGqYFr0kdGxbfc5gUOkR9RGp20GVKza; path=/; expires=Tue, 07-Apr-2015 18:18:08 GMT; secure; HttpOnly'
    };

    function testForTransport (transport, done) {
      var engine = listen(function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), {
          extraHeaders: headers,
          transports: [transport]
        });
        engine.on('connection', function (conn) {
          for (var h in headers) {
            expect(conn.request.headers[h]).to.equal(headers[h]);
          }
          done();
        });
        socket.on('open', function () {});
      });
    }

    it('should arrive from client to server via WebSockets', function (done) {
      testForTransport('websocket', done);
    });

    it('should arrive from client to server via XMLHttpRequest', function (done) {
      testForTransport('polling', done);
    });
  });

  describe('response headers', function () {
    function testForHeaders (headers, done) {
      var engine = listen(function (port) {
        engine.on('connection', function (conn) {
          conn.transport.once('headers', function (headers) {
            expect(headers['X-XSS-Protection']).to.be('0');
            conn.close();
            done();
          });
          conn.send('hi');
        });
        eioc('ws://localhost:%d'.s(port), {
          extraHeaders: headers,
          transports: ['polling']
        });
      });
    }

    it('should contain X-XSS-Protection: 0 for IE8', function (done) {
      var headers = { 'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; .NET4.0E; Tablet PC 2.0)' };
      testForHeaders(headers, done);
    });

    it('should contain X-XSS-Protection: 0 for IE11', function (done) {
      var headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko' };
      testForHeaders(headers, done);
    });
  });

  if (!UWS_ENGINE && parseInt(process.versions.node, 10) >= 4) {
    describe('wsEngine option', function () {
      it('should allow loading of other websocket server implementation like uws', function (done) {
        var engine = listen({ allowUpgrades: false, wsEngine: 'uws' }, function (port) {
          expect(engine.ws instanceof require('uws').Server).to.be.ok();
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
    });
  }
});
