
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
      res.headers['content-length'].should.be.match(/([0-9]+)/);
      res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

      data.should.match(/XMLHttpRequest/);

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
      io.set('browser client', 'custom_client');
      io.set('browser client etag', '1.0');
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
