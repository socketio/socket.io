
var http = require('http').Server;
var io = require('..');
var fs = require('fs');
var join = require('path').join;
var ioc = require('socket.io-client');
var request = require('supertest');
var expect = require('expect.js');

// Creates a socket.io client for the given server
function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'ws://localhost:' + addr.port + (nsp || '');
  return ioc(url, opts);
}

describe('socket.io', function(){

  it('should be the same version as client', function(){
    var version = require('../package').version;
    expect(version).to.be(require('socket.io-client/package').version);
  });

  describe('set', function() {
    it('should be able to set ping timeout to engine.io', function() {
      var srv = io(http());
      srv.set('heartbeat timeout', 10);
      expect(srv.eio.pingTimeout).to.be(10);
    });

    it('should be able to set ping interval to engine.io', function() {
      var srv = io(http());
      srv.set('heartbeat interval', 10);
      expect(srv.eio.pingInterval).to.be(10);
    });

    it('should be able to set transports to engine.io', function() {
      var srv = io(http());
      srv.set('transports', ['polling']);
      expect(srv.eio.transports).to.eql(['polling']);
    });

    it('should be able to set maxHttpBufferSize to engine.io', function() {
      var srv = io(http());
      srv.set('destroy buffer size', 10);
      expect(srv.eio.maxHttpBufferSize).to.eql(10);
    });

    it('should be able to set path with setting resource', function(done) {
      var eio = io();
      var srv = http();

      eio.set('resource', '/random');
      eio.attach(srv);

      // Check that the server is accessible through the specified path
      request(srv)
      .get('/random/socket.io.js')
      .buffer(true)
      .end(function(err, res){
        if (err) return done(err);
        done();
      });
    });

    it('should be able to set origins to engine.io', function() {
      var srv = io(http());
      srv.set('origins', 'http://hostname.com:*');
      expect(srv.origins()).to.be('http://hostname.com:*');
    });

    it('should be able to set authorization and send error packet', function(done) {
      var httpSrv = http();
      var srv = io(httpSrv);
      srv.set('authorization', function(o, f) { f(null, false); });

      var socket = client(httpSrv);
      socket.on('connect', function(){
        expect().fail();
      });
      socket.on('error', function(err) {
        expect(err).to.be('Not authorized');
        done();
      });
    });

    it('should be able to set authorization and succeed', function(done) {
      var httpSrv = http();
      var srv = io(httpSrv);
      srv.set('authorization', function(o, f) { f(null, true); });

      srv.on('connection', function(s) {
        s.on('yoyo', function(data) {
          expect(data).to.be('data');
          done();
        });
      });

      var socket = client(httpSrv);
      socket.on('connect', function(){
        socket.emit('yoyo', 'data');
      });

      socket.on('error', function(err) {
        expect().fail();
      });
    });

    it('should set the handshake BC object', function(done){
      var httpSrv = http();
      var srv = io(httpSrv);

      srv.on('connection', function(s) {
        expect(s.handshake).to.not.be(undefined);

        // Headers set and has some valid properties
        expect(s.handshake.headers).to.be.an('object');
        expect(s.handshake.headers['user-agent']).to.be('node-XMLHttpRequest');

        // Time set and is valid looking string
        expect(s.handshake.time).to.be.a('string');
        expect(s.handshake.time.split(' ').length > 0); // Is "multipart" string representation

        // Address, xdomain, secure, issued and url set
        expect(s.handshake.address).to.contain('127.0.0.1');
        expect(s.handshake.xdomain).to.be.a('boolean');
        expect(s.handshake.secure).to.be.a('boolean');
        expect(s.handshake.issued).to.be.a('number');
        expect(s.handshake.url).to.be.a('string');

        // Query set and has some right properties
        expect(s.handshake.query).to.be.an('object');
        expect(s.handshake.query.EIO).to.not.be(undefined);
        expect(s.handshake.query.transport).to.not.be(undefined);
        expect(s.handshake.query.t).to.not.be(undefined);

        done();
      });

      var socket = client(httpSrv);
    });
  });

  describe('server attachment', function(){
    describe('http.Server', function(){
      var clientVersion = require('socket.io-client/package').version;

      it('should serve static files', function(done){
        var srv = http();
        io(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .buffer(true)
        .end(function(err, res){
          if (err) return done(err);
          var ctype = res.headers['content-type'];
          expect(ctype).to.be('application/javascript');
          expect(res.headers.etag).to.be(clientVersion);
          expect(res.text).to.match(/engine\.io/);
          expect(res.status).to.be(200);
          done();
        });
      });

      it('should handle 304', function(done){
        var srv = http();
        io(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .set('If-None-Match', clientVersion)
        .end(function(err, res){
          if (err) return done(err);
          expect(res.statusCode).to.be(304);
          done();
        });
      });

      it('should not serve static files', function(done){
        var srv = http();
        io(srv, { serveClient: false });
        request(srv)
        .get('/socket.io/socket.io.js')
        .expect(400, done);
      });

      it('should work with #attach', function(done){
        var srv = http(function(req, res){
          res.writeHead(404);
          res.end();
        });
        var sockets = io();
        sockets.attach(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .end(function(err, res){
          if (err) return done(err);
          expect(res.status).to.be(200);
          done();
        });
      });
    });

    describe('port', function(done){
      it('should be bound', function(done){
        var sockets = io(54010);
        request('http://localhost:54010')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('should be bound as a string', function(done) {
        var sockets = io('54020');
        request('http://localhost:54020')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('with listen', function(done){
        var sockets = io().listen(54011);
        request('http://localhost:54011')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('as a string', function(done){
        var sockets = io().listen('54012');
        request('http://localhost:54012')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });
    });
  });

  describe('handshake', function(){
    var request = require('superagent');

    it('should disallow request when origin defined and none specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54013');
      request.get('http://localhost:54013/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });

    it('should disallow request when origin defined and a different one specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54014');
      request.get('http://localhost:54014/socket.io/default/')
       .query({ transport: 'polling' })
       .set('origin', 'http://herp.derp')
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
       });
    });

    it('should allow request when origin defined an the same is specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54015');
      request.get('http://localhost:54015/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request when origin defined as function and same is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == 'http://foo.example') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54016');
      request.get('http://localhost:54016/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request when origin defined as function and different is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == 'http://foo.example') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54017');
      request.get('http://localhost:54017/socket.io/default/')
       .set('origin', 'http://herp.derp')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });

    it('should allow request when origin defined as function and no origin is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == '*') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54021');
      request.get('http://localhost:54021/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should default to port 443 when protocol is https', function(done) {
      var sockets = io({ origins: 'https://foo.example:443' }).listen('54036');
      request.get('http://localhost:54036/socket.io/default/')
        .set('origin', 'https://foo.example')
        .query({ transport: 'polling' })
        .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request if custom function in opts.allowRequest returns true', function(done){
      var sockets = io(http().listen(54022), { allowRequest: function (req, callback) {
        return callback(null, true);
      }, origins: 'http://foo.example:*' });

      request.get('http://localhost:54022/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should disallow request if custom function in opts.allowRequest returns false', function(done){
      var sockets = io(http().listen(54023), { allowRequest: function (req, callback) {
        return callback(null, false);
      } });
      request.get('http://localhost:54023/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });
  });

  describe('close', function(){

    it('should be able to close sio sending a srv', function(){
      var PORT   = 54018;
      var srv    = http().listen(PORT);
      var sio    = io(srv);
      var net    = require('net');
      var server = net.createServer();

      var clientSocket = client(srv, { reconnection: false });

      clientSocket.on('disconnect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on('connect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(1);
        sio.close();
      });

      server.once('listening', function() {
        // PORT should be free
        server.close(function(error){
          expect(error).to.be(undefined);
        });
      });

    });

    it('should be able to close sio sending a port', function(){
      var PORT   = 54019;
      var sio    = io(PORT);
      var net    = require('net');
      var server = net.createServer();

      var clientSocket = ioc('ws://0.0.0.0:' + PORT);

      clientSocket.on('disconnect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on('connect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(1);
        sio.close();
      });

      server.once('listening', function() {
        // PORT should be free
        server.close(function(error){
          expect(error).to.be(undefined);
        });
      });
    });

  });

  describe('namespaces', function(){
    var Socket = require('../lib/socket');
    var Namespace = require('../lib/namespace');

    it('should be accessible through .sockets', function(){
      var sio = io();
      expect(sio.sockets).to.be.a(Namespace);
    });

    it('should be aliased', function(){
      var sio = io();
      expect(sio.use).to.be.a('function');
      expect(sio.to).to.be.a('function');
      expect(sio['in']).to.be.a('function');
      expect(sio.emit).to.be.a('function');
      expect(sio.send).to.be.a('function');
      expect(sio.write).to.be.a('function');
      expect(sio.clients).to.be.a('function');
      expect(sio.compress).to.be.a('function');
      expect(sio.json).to.be(sio);
      expect(sio.volatile).to.be(sio);
      expect(sio.sockets.flags).to.eql({ json: true, volatile: true });
      delete sio.sockets.flags;
    });

    it('should automatically connect', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done();
        });
      });
    });

    it('should fire a `connection` event', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it('should fire a `connect` event', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connect', function(socket){
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it('should work with many sockets', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        sio.of('/chat');
        sio.of('/news');
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        chat.on('connect', function(){
          --total || done();
        });
        news.on('connect', function(){
          --total || done();
        });
      });
    });

    it('should be able to equivalently start with "" or "/" on server', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;
      sio.of('').on('connection', function(){
        --total || done();
      });
      sio.of('abc').on('connection', function(){
        --total || done();
      });
      var c1 = client(srv, '/');
      var c2 = client(srv, '/abc');
    });

    it('should be equivalent for "" and "/" on client', function(done){
      var srv = http();
      var sio = io(srv);
      sio.of('/').on('connection', function(){
          done();
      });
      var c1 = client(srv, '');
    });

    it('should work with `of` and many sockets', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        sio.of('/news').on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of('/news').on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it('should work with `of` second param', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        sio.of('/news', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of('/news', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it('should disconnect upon transport disconnection', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        var totald = 2;
        var s;
        sio.of('/news', function(socket){
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        sio.of('/chat', function(socket){
          s = socket;
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        function close(){
          s.disconnect(true);
        }
      });
    });

    it('should disconnect both default and custom namespace upon disconnect', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var lolcats = client(srv, '/lolcats');
        var total = 2;
        var totald = 2;
        var s;
        sio.of('/', function(socket){
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        sio.of('/lolcats', function(socket){
          s = socket;
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        function close(){
          s.disconnect(true);
        }
      });
    });

    it('should not crash while disconnecting socket', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv,'/ns');
        sio.on('connection', function(socket){
          socket.disconnect();
          done();
        });
      });
    });

    it('should return error connecting to non-existent namespace', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv,'/doesnotexist');
        socket.on('error', function(err) {
          expect(err).to.be('Invalid namespace');
          done();
        });
      });
    });
    
    it('should not reuse same-namespace connections', function(done){
      var srv = http();
      var sio = io(srv);
      var connections = 0;

      srv.listen(function() {
        var clientSocket1 = client(srv);
        var clientSocket2 = client(srv);
        sio.on('connection', function() {
          connections++;
          if(connections === 2) {
            done();
          }
        });
      });
    });

    it('should find all clients in a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var chatSids = [];
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          chatSids.push(socket.id);
          --total || getClients();
        });
        sio.of('/other').on('connection', function(socket){
          otherSid = socket.id;
          --total || getClients();
        });
      });
      function getClients() {
        sio.of('/chat').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatSids[0]);
          expect(sids).to.contain(chatSids[1]);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should find all clients in a namespace room', function(done){
      var srv = http();
      var sio = io(srv);
      var chatFooSid = null;
      var chatBarSid = null;
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var chatIndex = 0;
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          if (chatIndex++) {
            socket.join('foo', function() {
              chatFooSid = socket.id;
              --total || getClients();
            });
          } else {
            socket.join('bar', function() {
              chatBarSid = socket.id;
              --total || getClients();
            });
          }
        });
        sio.of('/other').on('connection', function(socket){
          socket.join('foo', function() {
            otherSid = socket.id;
            --total || getClients();
          });
        });
      });
      function getClients() {
        sio.of('/chat').in('foo').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatFooSid);
          expect(sids).to.not.contain(chatBarSid);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should find all clients across namespace rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var chatFooSid = null;
      var chatBarSid = null;
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var chatIndex = 0;
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          if (chatIndex++) {
            socket.join('foo', function() {
              chatFooSid = socket.id;
              --total || getClients();
            });
          } else {
            socket.join('bar', function() {
              chatBarSid = socket.id;
              --total || getClients();
            });
          }
        });
        sio.of('/other').on('connection', function(socket){
          socket.join('foo', function() {
            otherSid = socket.id;
            --total || getClients();
          });
        });
      });
      function getClients() {
        sio.of('/chat').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatFooSid);
          expect(sids).to.contain(chatBarSid);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should not emit volatile event after regular event', function(done) {
      var srv = http();
      var sio = io(srv);

      var counter = 0;
      srv.listen(function(){
        sio.of('/chat').on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            sio.of('/chat').emit('ev', 'data');
            sio.of('/chat').volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, '/chat');
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit volatile event', function(done) {
      var srv = http();
      var sio = io(srv);

      var counter = 0;
      srv.listen(function(){
        sio.of('/chat').on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            sio.of('/chat').volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, '/chat');
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should enable compression by default', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of('/chat').emit('woot', 'hi');
        });
      });
    });

    it('should disable compression', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of('/chat').compress(false).emit('woot', 'hi');
        });
      });
    });
  });

  describe('socket', function(){

    it('should not fire events more than once after manually reconnecting', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var clientSocket = client(srv, { reconnection: false });
        clientSocket.on('connect', function init() {
          clientSocket.removeListener('connect', init);
          clientSocket.io.engine.close();

          clientSocket.connect();
          clientSocket.on('connect', function() {
            done();
          });
        });
      });
    });

    it('should not fire reconnect_failed event more than once when server closed', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var clientSocket = client(srv, { reconnectionAttempts: 3, reconnectionDelay: 10 });
        clientSocket.on('connect', function() {
          srv.close();
        });

        clientSocket.on('reconnect_failed', function() {
          done();
        });
      });
    });

    it('should receive events', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('random', function(a, b, c){
            expect(a).to.be(1);
            expect(b).to.be('2');
            expect(c).to.eql([3]);
            done();
          });
          socket.emit('random', 1, '2', [3]);
        });
      });
    });

    it('should receive message events through `send`', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('message', function(a){
            expect(a).to.be(1337);
            done();
          });
          socket.send(1337);
        });
      });
    });

    it('should error with null messages', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('message', function(a){
            expect(a).to.be(null);
            done();
          });
          socket.send(null);
        });
      });
    });

    it('should handle transport null messages', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('error', function(err){
            expect(err).to.be.an(Error);
            s.on('disconnect', function(reason){
              expect(reason).to.be('client error');
              done();
            });
          });
          s.client.ondata(null);
        });
      });
    });

    it('should emit events', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('woot', function(a){
          expect(a).to.be('tobi');
          done();
        });
        sio.on('connection', function(s){
          s.emit('woot', 'tobi');
        });
      });
    });

    it('should emit events with utf8 multibyte character', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        var i = 0;
        socket.on('hoot', function(a){
          expect(a).to.be('utf8 — string');
          i++;

          if (3 == i) {
            done();
          }
        });
        sio.on('connection', function(s){
          s.emit('hoot', 'utf8 — string');
          s.emit('hoot', 'utf8 — string');
          s.emit('hoot', 'utf8 — string');
        });
      });
    });

    it('should emit events with binary data', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        var imageData;
        socket.on('doge', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          expect(imageData.length).to.equal(a.length);
          expect(imageData[0]).to.equal(a[0]);
          expect(imageData[imageData.length - 1]).to.equal(a[a.length - 1]);
          done();
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            imageData = data;
            s.emit('doge', data);
          });
        });
      });
    });

    it('should emit events with several types of data (including binary)', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('multiple', function(a, b, c, d, e, f){
          expect(a).to.be(1);
          expect(Buffer.isBuffer(b)).to.be(true);
          expect(c).to.be('3');
          expect(d).to.eql([4]);
          expect(Buffer.isBuffer(e)).to.be(true);
          expect(Buffer.isBuffer(f[0])).to.be(true);
          expect(f[1]).to.be('swag');
          expect(Buffer.isBuffer(f[2])).to.be(true);
          done();
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            var buf = new Buffer('asdfasdf', 'utf8');
            s.emit('multiple', 1, data, '3', [4], buf, [data, 'swag', buf]);
          });
        });
      });
    });

    it('should receive events with binary data', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('buff', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
          var buf = new Buffer('abcdefg', 'utf8');
          socket.emit('buff', buf);
        });
      });
    });

    it('should receive events with several types of data (including binary)', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('multiple', function(a, b, c, d, e, f){
          expect(a).to.be(1);
          expect(Buffer.isBuffer(b)).to.be(true);
          expect(c).to.be('3');
          expect(d).to.eql([4]);
          expect(Buffer.isBuffer(e)).to.be(true);
          expect(Buffer.isBuffer(f[0])).to.be(true);
          expect(f[1]).to.be('swag');
          expect(Buffer.isBuffer(f[2])).to.be(true);
          done();
          });
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            var buf = new Buffer('asdfasdf', 'utf8');
            socket.emit('multiple', 1, data, '3', [4], buf, [data, 'swag', buf]);
          });
        });
      });
    });

    it('should not emit volatile event after regular event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          s.emit('ev', 'data');
          s.volatile.emit('ev', 'data');
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should not emit volatile event after regular event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          s.emit('ev', 'data');
          s.volatile.emit('ev', 'data');
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit only one consecutive volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit only one consecutive volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit regular events after trying a failed volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
            s.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it('should emit regular events after trying a failed volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
            s.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it('should emit message events through `send`', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('message', function(a){
          expect(a).to.be('a');
          done();
        });
        sio.on('connection', function(s){
          s.send('a');
        });
      });
    });

    it('should receive event with callbacks', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(fn){
            fn(1, 2);
          });
          socket.emit('woot', function(a, b){
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it('should receive all events emitted from namespaced client immediately and in order', function(done) {
      var srv = http();
      var sio = io(srv);
      var total = 0;
      srv.listen(function(){
        sio.of('/chat', function(s){
          s.on('hi', function(letter){
            total++;
            if (total == 2 && letter == 'b') {
              done();
            } else if (total == 1 && letter != 'a') {
              throw new Error('events out of order');
            }
          });
        });

        var chat = client(srv, '/chat');
        chat.emit('hi', 'a');
        setTimeout(function() {
          chat.emit('hi', 'b');
        }, 50);
      });
    });

    it('should emit events with callbacks', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(fn){
            fn();
          });
          s.emit('hi', function(){
            done();
          });
        });
      });
    });

    it('should receive events with args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(a, b, fn){
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          socket.emit('woot', 1, 2, function(){
            done();
          });
        });
      });
    });

    it('should emit events with args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(a, b, fn){
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          s.emit('hi', 1, 2, function(){
            done();
          });
        });
      });
    });

    it('should receive events with binary args and callbacks', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(buf, fn){
            expect(Buffer.isBuffer(buf)).to.be(true);
            fn(1, 2);
          });
          socket.emit('woot', new Buffer(3), function(a, b){
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it('should emit events with binary args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(a, fn){
            expect(Buffer.isBuffer(a)).to.be(true);
            fn();
          });
          s.emit('hi', new Buffer(4), function(){
            done();
          });
        });
      });
    });

    it('should emit events and receive binary data in a callback', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(fn){
            fn(new Buffer(1));
          });
          s.emit('hi', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it('should receive events and pass binary data in a callback', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(fn){
            fn(new Buffer(2));
          });
          socket.emit('woot', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it('should have access to the client', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client).to.be.an('object');
          done();
        });
      });
    });

    it('should have access to the connection', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client.conn).to.be.an('object');
          expect(s.conn).to.be.an('object');
          done();
        });
      });
    });

    it('should have access to the request', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client.request.headers).to.be.an('object');
          expect(s.request.headers).to.be.an('object');
          done();
        });
      });
    });

    it('should see query parameters in the request', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function() {
        var addr = srv.listen().address();
        var url = 'ws://localhost:' + addr.port + '?key1=1&key2=2';
        var socket = ioc(url);
        sio.on('connection', function(s) {
          var parsed = require('url').parse(s.request.url);
          var query = require('querystring').parse(parsed.query);
          expect(query.key1).to.be('1');
          expect(query.key2).to.be('2');
          done();
        });
      });
    });

    it('should handle very large json', function(done){
      this.timeout(30000);
      var srv = http();
      var sio = io(srv, { perMessageDeflate: false });
      var received = 0;
      srv.listen(function(){
        var socket = client(srv);
        socket.on('big', function(a){
          expect(Buffer.isBuffer(a.json)).to.be(false);
          if (++received == 3)
            done();
          else
            socket.emit('big', a);
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'fixtures', 'big.json'), function(err, data){
            if (err) return done(err);
            data = JSON.parse(data);
            s.emit('big', {hello: 'friend', json: data});
          });
          s.on('big', function(a){
            s.emit('big', a);
          });
        });
      });
    });

    it('should handle very large binary data', function(done){
      this.timeout(30000);
      var srv = http();
      var sio = io(srv, { perMessageDeflate: false });
      var received = 0;
      srv.listen(function(){
        var socket = client(srv);
        socket.on('big', function(a){
          expect(Buffer.isBuffer(a.image)).to.be(true);
          if (++received == 3)
            done();
          else
            socket.emit('big', a);
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'fixtures', 'big.jpg'), function(err, data){
            if (err) return done(err);
            s.emit('big', {hello: 'friend', image: data});
          });
          s.on('big', function(a){
            expect(Buffer.isBuffer(a.image)).to.be(true);
            s.emit('big', a);
          });
        });
      });
    });

    it('should be able to emit after server close and restart', function(done){
      var srv = http();
      var sio = io(srv);

      sio.on('connection', function(socket){
        socket.on('ev', function(data){
          expect(data).to.be('payload');
          done();
        });
      });

      srv.listen(function(){
        var port = srv.address().port;
        var clientSocket = client(srv, { reconnectionAttempts: 10, reconnectionDelay: 100 });
        clientSocket.once('connect', function(){
          srv.close(function(){
            srv.listen(port, function(){
              clientSocket.on('reconnect', function(){
                clientSocket.emit('ev', 'payload');
              });
            });
          });
        });
      });
    });

    it('should enable compression by default', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of('/chat').emit('woot', 'hi');
        });
      });
    });

    it('should disable compression', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of('/chat').compress(false).emit('woot', 'hi');
        });
      });
    });

    it('should error with raw binary and warn', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.conn.on('upgrade', function(){
            console.log('\033[96mNote: warning expected and normal in test.\033[39m');
            socket.io.engine.write('5woooot');
            setTimeout(function(){
              done();
            }, 100);
          });
        });
      });
    });

    it('should not crash with raw binary', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.once('error', function(err){
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on('upgrade', function(){
            socket.io.engine.write('5woooot');
          });
        });
      });
    });

    it('should handle empty binary packet', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.once('error', function(err){
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on('upgrade', function(){
            socket.io.engine.write('5');
          });
        });
      });
    });

    it('should not crash when messing with Object prototype', function(done){
      Object.prototype.foo = 'bar';
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);

        sio.on('connection', function(s){
          s.disconnect(true);
          sio.close();
          setTimeout(function(){
            done();
          }, 100);
        });
      });
    });

    it('should always trigger the callback (if provided) when joining a room', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            s.join('a', done);
          });
        });
      });
    });

  });

  describe('messaging many', function(){
    it('emits to a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('a', function(a){
          expect(a).to.be('b');
          --total || done();
        });
        socket2.on('a', function(a){
          expect(a).to.be('b');
          --total || done();
        });
        socket3.on('a', function(){ done(new Error('not')); });

        var sockets = 3;
        sio.on('connection', function(socket){
          --sockets || emit();
        });
        sio.of('/test', function(socket){
          --sockets || emit();
        });

        function emit(){
          sio.emit('a', 'b');
        }
      });
    });

    it('emits binary data to a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('bin', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket2.on('bin', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket3.on('bin', function(){ done(new Error('not')); });

        var sockets = 3;
        sio.on('connection', function(socket){
          --sockets || emit();
        });
        sio.of('/test', function(socket){
          --sockets || emit();
        });

        function emit(){
          sio.emit('bin', new Buffer(10));
        }
      });
    });

    it('emits to the rest', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('a', function(a){
          expect(a).to.be('b');
          socket1.emit('finish');
        });
        socket2.emit('broadcast');
        socket2.on('a', function(){ done(new Error('done')); });
        socket3.on('a', function(){ done(new Error('not')); });

        var sockets = 2;
        sio.on('connection', function(socket){
          socket.on('broadcast', function(){
            socket.broadcast.emit('a', 'b');
          });
          socket.on('finish', function(){
            done();
          });
        });
      });
    });

    it('emits to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });

        socket2.on('a', function(){
          done(new Error('not'));
        });
        socket1.on('a', function(){
          done();
        });
        socket1.emit('join', 'woot', function(){
          socket1.emit('emit', 'woot');
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('emit', function(room){
            sio.in(room).emit('a');
          });
        });
      });
    });

    it('emits to rooms avoiding dupes', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });

        socket2.on('a', function(){
          done(new Error('not'));
        });
        socket1.on('a', function(){
          --total || done();
        });
        socket2.on('b', function(){
          --total || done();
        });

        socket1.emit('join', 'woot');
        socket1.emit('join', 'test');
        socket2.emit('join', 'third', function(){
          socket2.emit('emit');
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('emit', function(room){
            sio.in('woot').in('test').emit('a');
            sio.in('third').emit('b');
          });
        });
      });
    });

    it('broadcasts to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, { multiplex: false });

        socket1.emit('join', 'woot');
        socket2.emit('join', 'test');
        socket3.emit('join', 'test', function(){
          socket3.emit('broadcast');
        });

        socket1.on('a', function(){
          done(new Error('not'));
        });
        socket2.on('a', function(){
          --total || done();
        });
        socket3.on('a', function(){
          done(new Error('not'));
        });
        socket3.on('b', function(){
          --total || done();
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('broadcast', function(){
            socket.broadcast.to('test').emit('a');
            socket.emit('b');
          });
        });
      });
    });

    it('broadcasts binary data to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, { multiplex: false });

        socket1.emit('join', 'woot');
        socket2.emit('join', 'test');
        socket3.emit('join', 'test', function(){
          socket3.emit('broadcast');
        });

        socket1.on('bin', function(data){
          throw new Error('got bin in socket1');
        });
        socket2.on('bin', function(data){
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });
        socket2.on('bin2', function(data) {
          throw new Error('socket2 got bin2');
        });
        socket3.on('bin', function(data) {
          throw new Error('socket3 got bin');
        });
        socket3.on('bin2', function(data) {
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });
          socket.on('broadcast', function(){
            socket.broadcast.to('test').emit('bin', new Buffer(5));
            socket.emit('bin2', new Buffer(5));
          });
        });
      });
    });


    it('keeps track of rooms', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(Object.keys(s.rooms)).to.eql([s.id, 'a']);
            s.join('b', function(){
              expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
              s.join( 'c', function(){
                expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b', 'c']);
                s.leave('b', function(){
                  expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'c']);
                  s.leaveAll();
                  expect(Object.keys(s.rooms)).to.eql([]);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('deletes empty rooms', function(done) {
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(s.nsp.adapter.rooms).to.have.key('a');
            s.leave('a', function(){
              expect(s.nsp.adapter.rooms).to.not.have.key('a');
              done();
            });
          });
        });
      });
    });

    it('should properly cleanup left rooms', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(Object.keys(s.rooms)).to.eql([s.id, 'a']);
            s.join('b', function(){
              expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
              s.leave('unknown', function(){
                expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
                s.leaveAll();
                expect(Object.keys(s.rooms)).to.eql([]);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('middleware', function(done){
    var Socket = require('../lib/socket');

    it('should call functions', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      sio.use(function(socket, next){
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          expect(run).to.be(2);
          done();
        });
      });
    });

    it('should pass errors', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        next(new Error('Authentication error'));
      });
      sio.use(function(socket, next){
        done(new Error('nope'));
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done(new Error('nope'));
        });
        socket.on('error', function(err){
          expect(err).to.be('Authentication error');
          done();
        });
      });
    });

    it('should pass `data` of error object', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        var err = new Error('Authentication error');
        err.data = { a: 'b', c: 3 };
        next(err);
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done(new Error('nope'));
        });
        socket.on('error', function(err){
          expect(err).to.eql({ a: 'b', c: 3 });
          done();
        });
      });
    });

    it('should only call connection after fns', function(done){
      var srv = http();
      var sio = io(srv);
      sio.use(function(socket, next){
        socket.name = 'guillermo';
        next();
      });
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(socket){
          expect(socket.name).to.be('guillermo');
          done();
        });
      });
    });

    it('should be ignored if socket gets closed', function(done){
      var srv = http();
      var sio = io(srv);
      var socket;
      sio.use(function(s, next){
        socket.io.engine.on('open', function(){
          socket.io.engine.close();
          s.client.conn.on('close', function(){
            process.nextTick(next);
            setTimeout(function(){
              done();
            }, 50);
          });
        });
      });
      srv.listen(function(){
        socket = client(srv);
        sio.on('connection', function(socket){
          done(new Error('should not fire'));
        });
      });
    });

    it('should call functions in expected order', function(done){
      var srv = http();
      var sio = io(srv);
      var result = [];

      sio.use(function(socket, next) {
        result.push(1);
        setTimeout(next, 50);
      });
      sio.use(function(socket, next) {
        result.push(2);
        setTimeout(next, 50);
      });
      sio.of('/chat').use(function(socket, next) {
        result.push(3);
        setTimeout(next, 50);
      });
      sio.of('/chat').use(function(socket, next) {
        result.push(4);
        setTimeout(next, 50);
      });

      srv.listen(function() {
        var chat = client(srv, '/chat');
        chat.on('connect', function() {
          expect(result).to.eql([1, 2, 3, 4]);
          done();
        });
      });
    });
  });
});
