
/*!
* socket.io-node
* Copyright(c) 2011 LearnBoost <dev@learnboost.com>
* MIT Licensed
*/

/**
 * Test dependencies.
 */

var sio = require('socket.io')
  , should = require('./common')
  , ports = 15400;

/**
 * Test.
 */

module.exports = {

  'test that the default static files are available': function (done) {
    var port = ++ports
      , io = sio.listen(port);

    (!!io.static.has('/socket.io.js')).should.be.true;
    (!!io.static.has('/socket.io+')).should.be.true;
    (!!io.static.has('/static/flashsocket/WebSocketMain.swf')).should.be.true;
    (!!io.static.has('/static/flashsocket/WebSocketMainInsecure.swf')).should.be.true;

    io.server.close();
    done();
  },

  'test that static files are correctly looked up': function (done) {
    var port = ++ports
      , io = sio.listen(port);

    (!!io.static.has('/socket.io.js')).should.be.true;
    (!!io.static.has('/invalidfilehereplease.js')).should.be.false;

    io.server.close();
    done();
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

  'test that the custom build client is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.enable('browser client etag');

    cl.get('/socket.io/socket.io+websocket.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

      data.should.match(/XMLHttpRequest/);
      data.should.match(/WS\.prototype\.name/);
      data.should.not.match(/Flashsocket\.prototype\.name/);
      data.should.not.match(/HTMLFile\.prototype\.name/);
      data.should.not.match(/JSONPPolling\.prototype\.name/);
      data.should.not.match(/XHRPolling\.prototype\.name/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that the client is build with the enabled transports': function (done) {
    var port = ++ports
      , io = sio.listen(port) 
      , cl = client(port);

    io.set('transports', ['websocket']);

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);

      data.should.match(/XMLHttpRequest/);
      data.should.match(/WS\.prototype\.name/);
      data.should.not.match(/Flashsocket\.prototype\.name/);
      data.should.not.match(/HTMLFile\.prototype\.name/);
      data.should.not.match(/JSONPPolling\.prototype\.name/);
      data.should.not.match(/XHRPolling\.prototype\.name/);

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that the client cache is cleared when transports change': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.set('transports', ['websocket']);

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);

      data.should.match(/XMLHttpRequest/);
      data.should.match(/WS\.prototype\.name/);
      data.should.not.match(/Flashsocket\.prototype\.name/);
      data.should.not.match(/HTMLFile\.prototype\.name/);
      data.should.not.match(/JSONPPolling\.prototype\.name/);
      data.should.not.match(/XHRPolling\.prototype\.name/);

      io.set('transports', ['xhr-polling']);
      should.strictEqual(io.static.cache['/socket.io.js'], undefined);

      cl.get('/socket.io/socket.io.js', function (res, data) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-length'].should.match(/([0-9]+)/);

        data.should.match(/XMLHttpRequest/);
        data.should.match(/XHRPolling\.prototype\.name/);
        data.should.not.match(/Flashsocket\.prototype\.name/);
        data.should.not.match(/HTMLFile\.prototype\.name/);
        data.should.not.match(/JSONPPolling\.prototype\.name/);
        data.should.not.match(/WS\.prototype\.name/);

        cl.end();
        io.server.close();
        done();
      });
    });
  },

  'test that the client etag is served': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.enable('browser client etag');

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

  'test that the client etag is changed for new transports': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.set('transports', ['websocket']);
    io.enable('browser client etag');

    cl.get('/socket.io/socket.io.js', function (res, data) {
      var wsEtag = res.headers.etag;

      io.set('transports', ['xhr-polling']);
      cl.get('/socket.io/socket.io.js', function (res, data) {
        res.headers.etag.should.not.equal(wsEtag);

        cl.end();
        io.server.close();
        done();
      });
    });
  },

  'test that the client is served with gzip': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.enable('browser client gzip');

    cl.get('/socket.io/socket.io.js', {
          headers: {
              'accept-encoding': 'deflate, gzip'
          }
        }
      , function (res, data) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-encoding'].should.eql('gzip');
        res.headers['content-length'].should.match(/([0-9]+)/);

        cl.end();
        io.server.close();
        done();
      }
    );
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
      var static = io.static;
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

  'test that the client is not cached': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.static.add('/random.js', function (path, callback) {
      var random = Math.floor(Date.now() * Math.random()).toString();
      callback(null, new Buffer(random));
    });

    io.disable('browser client cache');

    cl.get('/socket.io/random.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      should.strictEqual(res.headers.etag, undefined);

      cl.get('/socket.io/random.js', function (res, random) {
        res.headers['content-type'].should.eql('application/javascript');
        res.headers['content-length'].should.match(/([0-9]+)/);
        should.strictEqual(res.headers.etag, undefined);

        data.should.not.equal(random);

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

    io.enable('browser client etag');

    cl.get('/socket.io/socket.io.js', function (res, data) {
      res.headers['content-type'].should.eql('application/javascript');
      res.headers['content-length'].should.match(/([0-9]+)/);
      res.headers.etag.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);

      data.should.match(/XMLHttpRequest/);
      var static = io.static
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

    io.enable('browser client etag');

    cl.get('/socket.io/socket.io.js', function (res, data) {
      cl.get('/socket.io/socket.io.js', {
          headers: {
              'if-none-match': res.headers.etag
          }
        }, function (res, data) {
            res.statusCode.should.eql(304);

            cl.end();
            io.server.close();
            done();
          }
      );
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

    io.enable('browser client minification');

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

      var static = io.static
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

      var static = io.static
        , cache = static.cache['/static/flashsocket/WebSocketMainInsecure.swf'];

      Buffer.isBuffer(cache.content).should.be.true;

      cl.end();
      io.server.close();
      done();
    });
  },

  'test that swf files are not served with gzip': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.enable('browser client gzip');

    cl.get('/socket.io/static/flashsocket/WebSocketMain.swf', {
          headers: {
              'accept-encoding': 'deflate, gzip'
          }
        }
      , function (res, data) {
          res.headers['content-type'].should.eql('application/x-shockwave-flash');
          res.headers['content-length'].should.match(/([0-9]+)/);
          should.strictEqual(res.headers['content-encoding'], undefined);

          cl.end();
          io.server.close();
          done();
        }
    );
  },

  'test that you can serve custom clients': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , cl = client(port);

    io.set('browser client handler', function (req, res) {
      res.writeHead(200, {
          'Content-Type': 'application/javascript'
        , 'Content-Length': 13
        , 'ETag': '1.0'
      });
      res.end('custom_client');
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
  }

};
