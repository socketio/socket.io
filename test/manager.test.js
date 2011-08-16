/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('socket.io')
  , http = require('http')
  , should = require('./common')
  , ports = 15100;

/**
 * Test.
 */

module.exports = {

  'test setting and getting a configuration flag': function (done) {
    var port = ++ports
      , io = sio.listen(http.createServer());

    io.set('a', 'b');
    io.get('a').should.eql('b');

    var port = ++ports
      , io = sio.listen(http.createServer());

    io.configure(function () {
      io.set('a', 'b');
      io.enable('tobi');
    });

    io.get('a').should.eql('b');

    done();
  },

  'test enabling and disabling a configuration flag': function (done) {
    var port = ++ports
      , io = sio.listen(http.createServer());

    io.enable('flag');
    io.enabled('flag').should.be.true;
    io.disabled('flag').should.be.false;

    io.disable('flag');
    var port = ++ports
      , io = sio.listen(http.createServer());

    io.configure(function () {
      io.enable('tobi');
    });

    io.enabled('tobi').should.be.true;

    done();
  },

  'test configuration callbacks with envs': function (done) {
    var port = ++ports
      , io = sio.listen(http.createServer());

    process.env.NODE_ENV = 'development';

    io.configure('production', function () {
      io.set('ferret', 'tobi');
    });

    io.configure('development', function () {
      io.set('ferret', 'jane');
    });

    io.get('ferret').should.eql('jane');
    done();
  },

  'test configuration callbacks conserve scope': function (done) {
    var port = ++ports
      , io = sio.listen(http.createServer())
      , calls = 0;

    process.env.NODE_ENV = 'development';

    io.configure(function () {
      this.should.eql(io);
      calls++;
    });

    io.configure('development', function () {
      this.should.eql(io);
      calls++;
    });

    calls.should.eql(2);
    done();
  },

  'test configuration update notifications': function (done) {
    var port = ++ports
      , io = sio.listen(http.createServer())
      , calls = 0;

    io.on('set:foo', function () {
      calls++;
    });

    io.set('foo', 'bar');
    io.set('baz', 'bar');

    calls.should.eql(1);

    io.enable('foo');
    io.disable('foo');

    calls.should.eql(3);
    done();
  },

  'test that normal requests are still served': function (done) {
    var server = http.createServer(function (req, res) {
      res.writeHead(200);
      res.end('woot');
    });

    var io = sio.listen(server)
      , port = ++ports
      , cl = client(port);

    server.listen(ports);

    cl.get('/socket.io', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');

      cl.get('/woot', function (res, data) {
        res.statusCode.should.eql(200);
        data.should.eql('woot');

        cl.end();
        server.close();
        done();
      });
    });
  },

  'test that the client is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      should.strictEqual(res.headers.etag, undefined);

      data.should.match(/XMLHttpRequest/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that the client etag is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.enable('browser client etag');
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

      data.should.match(/XMLHttpRequest/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that the cached client is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      should.strictEqual(res.headers.etag, undefined);

      data.should.match(/XMLHttpRequest/);
      var static = sio.Manager.static;
      static.cache['/socket.io.js'].content.should.match(/XMLHttpRequest/);

      cl.get('/socket.io/socket.io.js', function (res, data) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-length'].should.match(/([0-9]+)/);
        should.strictEqual(res.headers.etag, undefined);

        data.should.match(/XMLHttpRequest/);

        cl.end();
        io.server.close();
        done();
      });
    });
  },

  'test that the cached client etag is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.enable('browser client etag');
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

      data.should.match(/XMLHttpRequest/);
      var static = sio.Manager.static
        , cache = static.cache['/socket.io.js'];

      cache.content.toString().should.match(/XMLHttpRequest/);
      Buffer.isBuffer(cache.content).should.be.true;

      cl.get('/socket.io/socket.io.js', function (res, data) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-length'].should.match(/([0-9]+)/);
        res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

        data.should.match(/XMLHttpRequest/);

        cl.end();
        io.server.close();
        done();
      });
    });
  },

  'test that the cached client sends a 304 header': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

     io.configure(function () {
      io.enable('browser client etag');
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      cl.get('/socket.io/socket.io.js', {headers:{'if-none-match':res.headers.etag}}, function (res, data) {
        res.statusCode.should.eql(304);

        cl.end();
        io.server.close();
        done();
      });
    });
  },

  'test that client minification works': function (done) {
    // server 1
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    // server 2
    var port = ++ports
      , io2 = sio.listen(port)
      , cl2 = client(port);

    io.configure(function () {
      io.enable('browser client minification');
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      var length = data.length;

      cl.end();
      io.server.close();

      cl2.get('/socket.io/socket.io.js', function (res, data) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-length'].should.match(/([0-9]+)/);
        should.strictEqual(res.headers.etag, undefined);

        data.should.match(/XMLHttpRequest/);
        data.length.should.be.greaterThan(length);

        cl2.end();
        io2.server.close();
        done();
      });
    });
  },

  'test that the WebSocketMain.swf is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/static/flashsocket/WebSocketMain.swf', function (res, data) {
      res.headers['content-type'].should.eql('application/x-shockwave-flash');
      res.headers['content-length'].should.match(/([0-9]+)/);
      should.strictEqual(res.headers.etag, undefined);

      var static = sio.Manager.static
        , cache = static.cache['/static/flashsocket/WebSocketMain.swf'];

      Buffer.isBuffer(cache.content).should.be.true;

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that the WebSocketMainInsecure.swf is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/static/flashsocket/WebSocketMainInsecure.swf', function (res, data) {
      res.headers['content-type'].should.eql('application/x-shockwave-flash');
      res.headers['content-length'].should.match(/([0-9]+)/);
      should.strictEqual(res.headers.etag, undefined);

      var static = sio.Manager.static
        , cache = static.cache['/static/flashsocket/WebSocketMain.swf'];

      Buffer.isBuffer(cache.content).should.be.true;

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that you can serve custom clients': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('browser client handler', function (req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/javascript'
          , 'Content-Length': 13
          , 'ETag': '1.0'
        });
        res.end('custom_client');
      });
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.eql(13);
      res.headers.etag.should.eql('1.0');

      data.should.eql('custom_client');

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that you can disable clients': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.disable('browser client');
    });

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');

      cl.end();
      io.server.close();
      done();
    });
  },

  'test handshake': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+):([0-9]+)?:([0-9]+)?:(.+)/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test handshake with unsupported protocol version': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    cl.get('/socket.io/-1/', function (res, data) {
      res.statusCode.should.eql(500);
      data.should.match(/Protocol version not supported/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test authorization failure in handshake': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      function auth (data, fn) {
        fn(null, false);
      };

      io.set('authorization', auth);
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(403);
      data.should.match(/handshake unauthorized/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test a handshake error': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      function auth (data, fn) {
        fn(new Error);
      };

      io.set('authorization', auth);
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(500);
      data.should.match(/handshake error/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that a referer is accepted for *:* origin': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('origins', '*:*');
    });

    cl.get('/socket.io/{protocol}', { headers: { referer: 'http://foo.bar.com:82/something' } }, function (res, data) {
      res.statusCode.should.eql(200);
      cl.end();
      io.server.close();
      done();
    });
  },

  'test that valid referer is accepted for addr:* origin': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('origins', 'foo.bar.com:*');
    });

    cl.get('/socket.io/{protocol}', { headers: { referer: 'http://foo.bar.com/something' } }, function (res, data) {
      res.statusCode.should.eql(200);
      cl.end();
      io.server.close();
      done();
    });
  },

  'test that erroneous referer is denied for addr:* origin': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('origins', 'foo.bar.com:*');
    });

    cl.get('/socket.io/{protocol}', { headers: { referer: 'http://baz.bar.com/something' } }, function (res, data) {
      res.statusCode.should.eql(403);
      cl.end();
      io.server.close();
      done();
    });
  },

  'test that valid referer port is accepted for addr:port origin': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('origins', 'foo.bar.com:81');
    });

    cl.get('/socket.io/{protocol}', { headers: { referer: 'http://foo.bar.com:81/something' } }, function (res, data) {
      res.statusCode.should.eql(200);
      cl.end();
      io.server.close();
      done();
    });
  },

  'test that erroneous referer port is denied for addr:port origin': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('origins', 'foo.bar.com:81');
    });

    cl.get('/socket.io/{protocol}', { headers: { referer: 'http://foo.bar.com/something' } }, function (res, data) {
      res.statusCode.should.eql(403);
      cl.end();
      io.server.close();
      done();
    });
  },

  'test limiting the supported transports for a manager': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('transports', ['tobi', 'jane']);
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+):([0-9]+)?:([0-9]+)?:tobi,jane/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test setting a custom close timeout': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('close timeout', 66);
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+):([0-9]+)?:66?:(.*)/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test setting a custom heartbeat timeout': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('heartbeat timeout', 33);
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+):33:([0-9]+)?:(.*)/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test disabling timeouts': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.configure(function () {
      io.set('heartbeat timeout', null);
      io.set('close timeout', '');
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+)::?:(.*)/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test disabling heartbeats': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port)
      , messages = 0
      , beat = false
      , ws;

    io.configure(function () {
      io.disable('heartbeats');
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      setTimeout(function () {
        socket.disconnect();
      }, io.get('heartbeat timeout') * 1000 + 100);

      socket.on('disconnect', function (reason) {
        beat.should.be.false;

        cl.end();
        ws.finishClose();
        io.server.close();
        done();
      });
    });

    cl.get('/socket.io/{protocol}/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.match(/([^:]+)::[\.0-9]+:(.*)/);

      cl.handshake(function (sid) {
        ws = websocket(cl, sid);
        ws.on('message', function (packet) {
          if (++messages == 1) {
            packet.type.should.eql('connect');
          } else if (packet.type == 'heartbeat'){
            beat = true;
          }
        });
      });
    });
  },

  'no duplicate room members': function (done) {
    var port = ++ports
      , io = sio.listen(port);

    Object.keys(io.rooms).length.should.equal(0);

    io.onJoin(123, 'foo');
    io.rooms.foo.length.should.equal(1);

    io.onJoin(123, 'foo');
    io.rooms.foo.length.should.equal(1);

    io.onJoin(124, 'foo');
    io.rooms.foo.length.should.equal(2);

    io.onJoin(124, 'foo');
    io.rooms.foo.length.should.equal(2);

    io.onJoin(123, 'bar');
    io.rooms.foo.length.should.equal(2);
    io.rooms.bar.length.should.equal(1);

    io.onJoin(123, 'bar');
    io.rooms.foo.length.should.equal(2);
    io.rooms.bar.length.should.equal(1);

    io.onJoin(124, 'bar');
    io.rooms.foo.length.should.equal(2);
    io.rooms.bar.length.should.equal(2);

    io.onJoin(124, 'bar');
    io.rooms.foo.length.should.equal(2);
    io.rooms.bar.length.should.equal(2);

    io.server.close();
    done();
  },

  'test passing options directly to the Manager through listen': function (done) {
    var port = ++ports
      , io = sio.listen(port, { resource: '/my resource', custom: 'opt' });

    io.get('resource').should.equal('/my resource');
    io.get('custom').should.equal('opt');
    io.server.close();
    done();
  }
};
