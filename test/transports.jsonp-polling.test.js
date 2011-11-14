
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
  , qs = require('querystring')
  , HTTPClient = should.HTTPClient
  , parser = sio.parser
  , ports = 15500;

/**
 * HTTPClient for jsonp-polling transport.
 */

function JSONPPolling (port) {
  HTTPClient.call(this, port);
};

/**
 * Inhertis from HTTPClient.
 */

JSONPPolling.prototype.__proto__ = HTTPClient.prototype;

/**
 * Performs a json-p (cross domain) handshake
 *
 * @api public
 */

JSONPPolling.prototype.handshake = function (opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  var self = this;

  return this.get(
      '/socket.io/{protocol}?jsonp=0'
    , opts
    , function (res, data) {
        var head = 'io.j[0]('
          , foot = ');';

        data.substr(0, head.length).should.eql(head);
        data.substr(-foot.length).should.eql(foot);
        data = data.slice(head.length, data.length - foot.length);

        var parts = JSON.parse(data).split(':');

        if (opts.ignoreConnect) {
          return fn && fn.apply(null, parts);
        }

        // expect connect packet right after handshake
        self.get(
            '/socket.io/{protocol}/jsonp-polling/' + parts[0]
          , function (res, msgs) {
              res.statusCode.should.eql(200);

              msgs.should.have.length(1);
              msgs[0].should.eql({ type: 'connect', endpoint: '', qs: '' });

              fn && fn.apply(null, parts);
            }
        );
      }
  );
};

/**
 * Override GET requests.
 *
 * @api public
 */

JSONPPolling.prototype.get = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};

  opts.parse = function (data) {
    var head = 'io.j[0]('
      , foot = ');';

    if (~path.indexOf('?i=1')) {
      head = 'io.j[1](';
    }

    data.substr(0, head.length).should.eql(head);
    data.substr(-foot.length).should.eql(foot);

    data = data.substr(head.length, data.length - head.length - foot.length);

    return JSON.parse(data);
  };

  return HTTPClient.prototype.get.call(this, path, opts, fn);
};

/**
 * Issue an encoded POST request
 *
 * @api private
 */

JSONPPolling.prototype.post = function (path, data, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'POST';
  opts.data = qs.stringify({ d: data });

  return this.request(path, opts, fn);
};

/**
 * Create client for this transport.
 *
 * @api public
 */

function client (port) {
  return new JSONPPolling(port);
};

/**
 * Test.
 */

module.exports = {

  'test jsonp handshake': function (done) {
    var cl = client(++ports)
      , io = create(cl);

    io.configure(function () {
      io.set('close timeout', .05);
      io.set('polling duration', 0);
    });

    function finish () {
      cl.end();
      io.server.close();
      done();
    };

    cl.handshake(function (sid) {
      var total = 2;

      cl.get('/socket.io/{protocol}/jsonp-polling/tobi', function (res, msgs) {
        res.statusCode.should.eql(200);

        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'error'
          , reason: 'client not handshaken'
          , endpoint: ''
          , advice: 'reconnect'
        });

        --total || finish();
      });

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });
        --total || finish();
      });
    });
  },

  'test the connection event': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , sid;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sid);

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake({ ignoreConnect: true }, function (sessid) {
      sid = sessid;

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');
      });
    });
  },

  'test the disconnection event after a close timeout': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , sid;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sid);

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    cl.handshake({ ignoreConnect: true }, function (sessid) {
      sid = sessid;

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');

        setTimeout(function () {
          cl.end();
        }, 10);
      });
    });
  },

  'test the disconnection event when the client sends ?disconnect req': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , disconnected = false
      , sid;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        disconnected = true;
      });
    });

    cl.handshake({ ignoreConnect: true }, function (sessid) {
      sid = sessid;

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');

        cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'disconnect', endpoint: '' });
          disconnected.should.be.true;
          io.server.close();
          cl.end();
          done();
        });

        // with the new http bits in node 0.5, there's no guarantee that
        // the previous request is actually dispatched (and received) before the following
        // reset call is sent. to not waste more time on a workaround, a timeout is added.
        setTimeout(function() {
          cl.get('/socket.io/{protocol}/jsonp-polling/' + sid + '/?disconnect');
        }, 500);
      });
    });
  },

  'test the disconnection event booting a client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , forced = false;

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        io.server.close();
        done();
      });

      cl.end();
      socket.disconnect();
      forced = true;
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'disconnect', endpoint: '' });

        forced.should.be.true;
      });
    });
  },

  'test the disconnection event with client disconnect packet': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , sid;

    io.sockets.on('connection', function (client) {
      cl.post(
          '/socket.io/{protocol}/jsonp-polling/' + sid
        , JSON.stringify(parser.encodePacket({ type: 'disconnect' }))
        , function (res, data) {
            res.statusCode.should.eql(200);
            data.should.eql('1');
          }
      );

      client.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake({ ignoreConnect: true }, function (sessid) {
      sid = sessid;

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');
      });
    });
  },

  'test sending back data': function (done) {
    var cl = client(++ports)
      , io = create(cl);

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.send('woot');

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, packs) {
        packs.should.have.length(1);
        packs[0].type.should.eql('message');
        packs[0].data.should.eql('woot');
      });
    });
  },

  'test sending a batch of messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , sid;

    io.configure(function () {
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      var messages = 0;

      cl.post(
          '/socket.io/{protocol}/jsonp-polling/' + sid
        , JSON.stringify(parser.encodePayload([
              parser.encodePacket({ type: 'message', data: 'a' })
            , parser.encodePacket({ type: 'message', data: 'b' })
            , parser.encodePacket({ type: 'disconnect' })
          ]))
        , function (res, data) {
            res.statusCode.should.eql(200);
            data.should.eql('1');
          }
      );

      socket.on('message', function (data) {
        messages++;

        if (messages == 1)
          data.should.eql('a');

        if (messages == 2)
          data.should.eql('b');
      });

      socket.on('disconnect', function () {
        messages.should.eql(2);
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake({ ignoreConnect: true }, function (sessid) {
      sid = sessid;

      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');
      });
    });
  },

  'test message buffering between a response and a request': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = false
      , tobi;

    io.configure(function () {
      io.set('polling duration', .1);
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      tobi = function () {
        socket.send('a');
        socket.send('b');
        socket.send('c');
      };

      socket.on('disconnect', function () {
        messages.should.be.true;

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        tobi();

        cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
          msgs.should.have.length(3);
          msgs[0].should.eql({ type: 'message', endpoint: '', data: 'a' });
          msgs[1].should.eql({ type: 'message', endpoint: '', data: 'b' });
          msgs[2].should.eql({ type: 'message', endpoint: '', data: 'c' });
          messages = true;
        });
      })
    });
  },

  'test connecting to a specific endpoint': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , connectMessage = false
      , sid;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/woot').on('connection', function (socket) {
      connectMessage.should.be.true;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, data) {
        cl.get('/socket.io/{protocol}/jsonp-polling/' + sid);

        connectMessage = true;

        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/woot' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );
      });
    });
  },

  'test that connecting doesnt connect to defined endpoints': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , tobiConnected = false
      , mainConnected = false
      , sid;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      mainConnected = true;

      socket.on('disconnect', function () {
        tobiConnected.should.be.false;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/tobi').on('connection', function () {
      tobiConnected = true;
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid);
    });
  },

  'test disconnecting a specific endpoint': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , wootDisconnected = false
      , mainDisconnected = false
      , checked = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (data) {
        data.should.eql('ferret');
        mainDisconnected.should.be.false;
        wootDisconnected.should.be.true;
        checked = true;
      });

      socket.on('disconnect', function () {
        mainDisconnected = true;
        checked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/woot').on('connection', function (socket) {
      socket.on('disconnect', function () {
        wootDisconnected = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function () {
        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/woot' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/jsonp-polling/' + sid
                , JSON.stringify(parser.encodePacket({ type: 'disconnect', endpoint: '/woot' }))
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');

                    cl.post(
                        '/socket.io/{protocol}/jsonp-polling/' + sid
                      , JSON.stringify(parser.encodePacket({ type: 'message', data: 'ferret' }))
                      , function (res, data) {
                          res.statusCode.should.eql(200);
                          data.should.eql('1');
                        }
                    );
                  }
              );
            }
        );
      });
    });
  },

  'test that disconnecting disconnects all endpoints': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , aDisconnected = false
      , bDisconnected = false;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        setTimeout(function () {
          aDisconnected.should.be.true;
          bDisconnected.should.be.true;
          cl.end();
          io.server.close();
          done();
        }, 50);
      });
    });

    io.of('/a').on('connection', function (socket) {
      socket.on('disconnect', function (msg) {
        aDisconnected = true;
      });
    });

    io.of('/b').on('connection', function (socket) {
      socket.on('disconnect', function (msg) {
        bDisconnected = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/a' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );

        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/b' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );
      });
    });
  },

  'test messaging a specific endpoint': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = true
      , aMessaged = false
      , bMessaged = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('');
        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.true;
        aMessaged.should.be.true;
        bMessaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/a').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('a');
        aMessaged = true;
      });
    });

    io.of('/b').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('b');
        bMessaged = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/jsonp-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'message', data: '' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );

        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/a' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/jsonp-polling/' + sid
                , JSON.stringify(parser.encodePacket({ type: 'message', endpoint: '/a', data: 'a' }))
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );

        cl.post(
            '/socket.io/{protocol}/jsonp-polling/' + sid
          , JSON.stringify(parser.encodePacket({ type: 'connect', endpoint: '/b' }))
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/jsonp-polling/' + sid
                , JSON.stringify(parser.encodePacket({ type: 'message', endpoint: '/b', data: 'b' }))
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );
      });
    });
  }

};
