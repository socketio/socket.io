
var http = require('http').Server;
var io = require('..');
var ioc = require('socket.io-client');
var request = require('supertest');
var expect = require('expect.js');

// creates a socket.io client for the given server
function client(srv, nsp){
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  return ioc('ws://' + addr.address + ':' + addr.port + (nsp || ''));
}

describe('socket.io', function(){
  describe('server attachment', function(){
    describe('http.Server', function(){
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
          expect(res.text).to.match(/engine\.io/);
          expect(res.status).to.be(200);
          done();
        });
      });

      it('should not serve static files', function(done){
        var srv = http();
        io(srv, { static: false });
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
        expect(sio.in).to.be.a('function');
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
  });
});
