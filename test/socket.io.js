
var http = require('http').Server;
var io = require('..');
var fs = require('fs');
var join = require('path').join;
var ioc = require('socket.io-client');
var request = require('supertest');
var expect = require('expect.js');

// creates a socket.io client for the given server
function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'ws://' + addr.address + ':' + addr.port + (nsp || '');
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

    it('should be able to set path with setting resource', function() {
      var srv = io(http());
      srv.set('resource', '/random');
      expect(srv.path()).to.be('/random');
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
        .set('ETag', clientVersion)
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
  });

  describe('namespaces', function(){
    var Socket = require('../lib/socket');
    var Namespace = require('../lib/namespace');

    describe('default', function(){
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
    });
  });

  describe('socket', function(){
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
        var url = 'ws://' + addr.address + ':' + addr.port + '?key1=1&key2=2';
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
            expect(s.rooms).to.eql([s.id, 'a']);
            s.join('b', function(){
              expect(s.rooms).to.eql([s.id, 'a', 'b']);
              s.leave('b', function(){
                expect(s.rooms).to.eql([s.id, 'a']);
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
