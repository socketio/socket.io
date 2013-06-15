/*global eio,eioc,listen,request,expect*/

/**
 * Tests dependencies.
 */

var http = require('http');
var WebSocket = require('ws');

/**
 * Tests.
 */

describe('server', function () {

  describe('verification', function () {
    it('should disallow non-existent transports', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'tobi' }) // no tobi transport - outrageous
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be('Transport unknown');
            done();
          });
      });
    });

    it('should disallow `constructor` as transports', function (done) {
      // make sure we check for actual properties - not those present on every {}
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'constructor' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(0);
            expect(res.body.message).to.be('Transport unknown');
            done();
          });
      });
    });

    it('should disallow non-existent sids', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling', sid: 'test' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(1);
            expect(res.body.message).to.be('Session ID unknown');
            done();
          });
      });
    });
  });

  describe('handshake', function () {
    it('should send the io cookie', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling' })
          .end(function (res) {
            // hack-obtain sid
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('io=' + sid);
            done();
          });
      });
    });

    it('should send the io cookie custom name', function (done) {
      var engine = listen({ cookie: 'woot' }, function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'polling' })
          .end(function (res) {
            var sid = res.text.match(/"sid":"([^"]+)"/)[1];
            expect(res.headers['set-cookie'][0]).to.be('woot=' + sid);
            done();
          });
      });
    });

    it('should not send the io cookie', function (done) {
      var engine = listen({ cookie: false }, function (port) {
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

    it('should exchange handshake data', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
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

    it('should not suggest upgrades when none are availble', function (done) {
      var engine = listen({ transports: ['polling'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(0);
          done();
        });
      });
    });

    it('should only suggest available upgrades', function (done) {
      var engine = listen({ transports: ['polling', 'flashsocket'] }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(1);
          expect(obj.upgrades).to.have.contain('flashsocket');
          done();
        });
      });
    });

    it('should suggest all upgrades when no transports are disabled', function (done) {
      var engine = listen({}, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { });
        socket.on('handshake', function (obj) {
          expect(obj.upgrades).to.have.length(2);
          expect(obj.upgrades).to.have.contain('flashsocket');
          expect(obj.upgrades).to.have.contain('websocket');
          done();
        });
      });
    });

    it('should allow arbitrary data through query string', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { query: { a: 'b' } });
        engine.on('connection', function (conn) {
          expect(conn.request.query).to.have.keys('transport', 'a');
          expect(conn.request.query.a).to.be('b');
          done();
        });
      });
    });

    it('should allow data through query string in uri', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d?a=b&c=d'.s(port));
        engine.on('connection', function (conn) {
          expect(conn.request.query.EIO).to.be.a('string');
          expect(conn.request.query.a).to.be('b');
          expect(conn.request.query.c).to.be('d');
          done();
        });
      });
    });



    it('should disallow bad requests', function (done) {
      var engine = listen(function (port) {
        request.get('http://localhost:%d/engine.io/default/'.s(port))
          .query({ transport: 'websocket' })
          .end(function (res) {
            expect(res.status).to.be(400);
            expect(res.body.code).to.be(3);
            expect(res.body.message).to.be('Bad request');
            done();
          });
      });
    });
  });

  describe('close', function () {
    it('should be able to access non-empty writeBuffer at closing (server)', function(done) {
      var opts = {allowUpgrades: false};
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('close', function (reason) {
            expect(conn.writeBuffer.length).to.be(1);
            setTimeout(function () {
              expect(conn.writeBuffer.length).to.be(0); // writeBuffer has been cleared
            }, 10);
            done();
          });
          conn.writeBuffer.push({ type: 'message', data: 'foo'});
          conn.onError('');
        });
      });
    });

    it('should be able to access non-empty writeBuffer at closing (client)', function(done) {
      var opts = {allowUpgrades: false};
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('http://localhost:%d'.s(port));
        socket.on('open', function() {
          socket.on('close', function (reason) {
            expect(socket.writeBuffer.length).to.be(1);
            expect(socket.callbackBuffer.length).to.be(1);
            setTimeout(function() {
              expect(socket.writeBuffer.length).to.be(0);
              expect(socket.callbackBuffer.length).to.be(0);
            }, 10);
            done();
          });
          socket.writeBuffer.push({ type: 'message', data: 'foo'});
          socket.callbackBuffer.push(function() {});
          socket.onError('');
        });
      });
    });

    it('should trigger on server if the client does not pong', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 5, pingTimeout: 5 };
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

    it('should trigger on client if server does not meet ping timeout', function (done) {
      var opts = { allowUpgrades: false, pingInterval: 50, pingTimeout: 30 };
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
          , total = 2;

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
          , total = 2;

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
          , total = 2;

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
          , total = 2;

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
          , total = 2;

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
          conn.send(null, function () {socket.close();});
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
      var engine = listen({ allowUpgrades: true }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function () {
          socket.close();
          // we wait until complete to see if we get an uncaught EPIPE
          setTimeout(function(){
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
        http.request = function(opts){
          var req = request.apply(null, arguments);
          req.on('socket', function(socket){
            sockets.push(socket);
          });
          return req;
        };

        function done(){
          http.request = request;
          $done();
        }

        var socket = new eioc.Socket('ws://localhost:%d'.s(port))
          , serverSocket;

        engine.on('connection', function(s){
          serverSocket = s;
        });

        socket.transport.on('poll', function(){
          // we set a timer to wait for the request to actually reach
          setTimeout(function(){
            // at this time server's `connection` should have been fired
            expect(serverSocket).to.be.an('object');

            // OPENED readyState is expected - we qre actually polling
            expect(socket.transport.pollXhr.xhr.readyState).to.be(1);

            // 2 requests sent to the server over an unique port means
            // we should have been assigned 2 sockets
            expect(sockets.length).to.be(2);

            // expect the socket to be open at this point
            expect(serverSocket.readyState).to.be('open');

            // kill the underlying connection
            sockets[1].end();
            serverSocket.on('close', function(reason, err){
              expect(reason).to.be('transport error');
              expect(err.message).to.be('poll connection closed prematurely');
              done();
            });
          }, 50);
        });
      });
    });

    it('should not trigger with connection: close header', function($done){
      var engine = listen({ allowUpgrades: false }, function(port){
        // intercept requests to add connection: close
        var request = http.request;
        http.request = function(){
          var opts = arguments[0];
          opts.headers = opts.headers || {};
          opts.headers.Connection = 'close';
          return request.apply(this, arguments);
        };

        function done(){
          http.request = request;
          $done();
        }

        engine.on('connection', function(socket){
          socket.on('message', function(msg){
            expect(msg).to.equal('test');
            socket.send('woot');
          });
        });

        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.on('open', function(){
          socket.send('test');
        });
        socket.on('message', function(msg){
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
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        var clientCloseReason = null;

        socket.on('handshake', function() {
          socket.onPacket = function(){};
        });
        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        setTimeout(function() {
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

        engine.on('connection', function(conn){
          conn.on('heartbeat', function() {
            conn.onPacket = function(){};
          });
        });

        socket.on('open', function () {
          socket.on('close', function (reason) {
            clientCloseReason = reason;
          });
        });

        setTimeout(function() {
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

        engine.on('connection', function(conn){
          conn.on('heartbeat', function() {
            setTimeout(function() {
              conn.close();
            }, 20);
            setTimeout(function() {
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

        engine.on('connection', function(conn){
          conn.once('heartbeat', function() {
            setTimeout(function() {
              socket.onPacket = function(){};
              expect(clientCloseReason).to.be(null);
            }, 150);
            setTimeout(function() {
              expect(clientCloseReason).to.be(null);
            }, 350);
            setTimeout(function() {
              expect(clientCloseReason).to.be("ping timeout");
              done();
            }, 500);
          });
        });
      });
    });

    // tests https://github.com/LearnBoost/engine.io-client/issues/164
    it('should not trigger close without open', function(done){
      var opts = { allowUpgrades: false };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        socket.close();
        socket.on('open', function(){
          throw new Error('Nope');
        });
        socket.on('close', function(){
          throw new Error('Nope');
        });
        setTimeout(done, 100);
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
          , i = 0;

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

    it('should arrive from server to client with ws api', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        engine.on('connection', function (conn) {
          conn.send('a');
          conn.close();
        });
        socket.onopen = function () {
          socket.onmessage = function (msg) {
            expect(msg.data).to.be('a');
            expect('' + msg == 'a').to.be(true);
          };
          socket.onclose = function () {
            done();
          };
        };
      });
    });

    it('should arrive from server to client (ws)', function (done) {
      var opts = { allowUpgrades: false, transports: ['websocket'] };
      var engine = listen(opts, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] })
          , expected = ['a', 'b', 'c']
          , i = 0;

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

    it('should trigger a flush/drain event', function(done){
      var engine = listen({ allowUpgrades: false }, function(port){
        engine.on('connection', function(socket){
          var totalEvents = 4;

          engine.on('flush', function(sock, buf){
            expect(sock).to.be(socket);
            expect(buf).to.be.an('array');
            --totalEvents || done();
          });
          socket.on('flush', function(buf){
            expect(buf).to.be.an('array');
            --totalEvents || done();
          });

          engine.on('drain', function(sock){
            expect(sock).to.be(socket);
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });
          socket.on('drain', function(){
            expect(socket.writeBuffer.length).to.be(0);
            --totalEvents || done();
          });

          socket.send('aaaa');
        });

        new eioc.Socket('ws://localhost:%d'.s(port));
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
        var messagePayload = new Array(1024 * 1024 * 1).join('a');
        var connection = null;
        engine.on('connection', function (conn) {
          connection = conn;
        });
        var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
        socket.on('open', function () {
          for (var i=0;i<messageCount;i++) {
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
  });

  describe('send', function() {
    describe('writeBuffer', function() {
      it('should not empty until `drain` event (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var totalEvents = 2;
          socket.on('open', function() {
            socket.send('a');
            socket.send('b');
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on('drain', function() {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });

      it('should not empty until `drain` event (websocket)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var totalEvents = 2;
          socket.on('open', function() {
            socket.send('a');
            socket.send('b');
            // writeBuffer should be nonempty, with 'a' still in it
            expect(socket.writeBuffer.length).to.eql(2);
          });
          socket.transport.on('drain', function() {
            expect(socket.writeBuffer.length).to.eql(--totalEvents);
            totalEvents || done();
          });
        });
      });
    });

    describe('callback', function() {
      it('should execute in order when message sent (client) (polling)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['polling'] });
          var i = 0;
          var j = 0;

          engine.on('connection', function(conn) {
            conn.on('message', function(msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function(msg) {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn() {
              socket.send(j, (function(value) {
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

          engine.on('connection', function(conn) {
            conn.on('message', function(msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function(msg) {
              // send another packet until we've sent 3 total
              if (++i < 3) {
                expect(i).to.eql(j);
                sendFn();
              } else {
                done();
              }
            });

            function sendFn() {
              socket.send(j, (function(value) {
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

          engine.on('connection', function(conn) {
            conn.on('message', function(msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function(msg) {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb(value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value == 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once('flush', function() {
              socket.send(2, function() { cb(2); });
              socket.send(3, function() { cb(3); });
            });

            socket.send(1, function() { cb(1); });
          });
        });
      });

      it('should execute in order with payloads (client) (websocket)', function (done) {
        var engine = listen({ allowUpgrades: false }, function (port) {
          var socket = new eioc.Socket('ws://localhost:%d'.s(port), { transports: ['websocket'] });
          var i = 0;
          var lastCbFired = 0;

          engine.on('connection', function(conn) {
            conn.on('message', function(msg) {
              conn.send(msg);
            });
          });

          socket.on('open', function () {
            socket.on('message', function(msg) {
              expect(msg).to.eql(i + 1);
              i++;
            });

            function cb(value) {
              expect(value).to.eql(lastCbFired + 1);
              lastCbFired = value;
              if (value == 3) {
                done();
              }
            }

            // 2 and 3 will be in the same payload
            socket.once('flush', function() {
              socket.send(2, function() { cb(2); });
              socket.send(3, function() { cb(3); });
            });

            socket.send(1, function() { cb(1); });
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

          setTimeout(function() {
            expect(i).to.be(j);
            done();
          }, 10);
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
          }, 10);
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
              if (msg === 'a') a ++;
              if (msg === 'b') b ++;
              if (msg === 'c') c ++;

              if(++all === 3) {
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

          socket.transport.on('pollComplete', function(msg) {
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

  describe('packet', function() {
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
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
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

  describe('packetCreate', function() {
    it('should emit before socket send message', function (done) {
      var engine = listen({ allowUpgrades: false }, function (port) {
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
        engine.on('connection', function (conn) {
          conn.on('packetCreate', function(packet) {
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
        var socket = new eioc.Socket('ws://localhost:%d'.s(port));
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
        var ready = 2, closed = 2;
        function finish () {
          setTimeout(function () {
            socket.close();
          }, 10);
        }

        // server
        engine.on('connection', function (conn) {
          var lastSent = 0, lastReceived = 0, upgraded = false;
          var interval = setInterval(function () {
            lastSent++;
            conn.send(lastSent);
            if (50 == lastSent) {
              clearInterval(interval);
              --ready || finish();
            }
          }, 2);

          conn.on('message', function (msg) {
            lastReceived++;
            expect(msg).to.eql(lastReceived);
          });

          conn.on('upgrade', function (to) {
            upgraded = true;
            expect(to.name).to.be('websocket');
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
          var lastSent = 0, lastReceived = 0, upgrades = 0;
          var interval = setInterval(function () {
            lastSent++;
            socket.send(lastSent);
            if (50 == lastSent) {
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
            expect(lastReceived).to.be(50);
            expect(upgrades).to.be(2);
            --closed || done();
          });
        });
      });

      // attach another engine to make sure it doesn't break upgrades
      var e2 = eio.attach(engine.httpServer, { path: '/foo' });
    });
  });

});
