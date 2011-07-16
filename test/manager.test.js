
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
      io.set('a', 'b');
      io.enable('tobi');
    });

    io.get('a').should.eql('b');
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
  }

};
