
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
  , HTTPClient = should.HTTPClient
  , parser = sio.parser
  , ports = 15200;

/**
 * HTTPClient for xhr-polling transport.
 */

function XHRPolling (port) {
  HTTPClient.call(this, port);
};

/**
 * Inhertis from HTTPClient.
 */

XHRPolling.prototype.__proto__ = HTTPClient.prototype;

/**
 * Performs the handshake and expects the connect echo packet.
 *
 * @api public
 */

XHRPolling.prototype.handshake = function (opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  var self = this;

  return this.get('/socket.io/{protocol}', opts, function (res, data) {
    var parts = data.split(':');

    if (opts.ignoreConnect) {
      return fn && fn.apply(null, parts);
    }

    // expect connect packet right after handshake
    self.get(
        '/socket.io/{protocol}/xhr-polling/' + parts[0]
      , function (res, msgs) {
          res.statusCode.should.eql(200);

          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'connect', endpoint: '', qs: '' });

          fn && fn.apply(null, parts);
        }
    );
  });
};

/**
 * Create client for this transport.
 *
 * @api public
 */

function client (port) {
  return new XHRPolling(port);
};

/**
 * Test.
 */

module.exports = {

  'test handshake': function (done) {
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

      cl.get('/socket.io/{protocol}/xhr-polling/tobi', function (res, msgs) {
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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
      io.set('close timeout', .05);
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');

        setTimeout(function () {
          cl.end();
        }, 10);
      });
    });
  },

  'test the disconnection event when the client sends ?disconnect req':
  function (done) {
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].type.should.eql('connect');

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'disconnect', endpoint: '' });
          disconnected.should.be.true;
          cl.end();
          io.server.close();
          done();
        });

        // with the new http bits in node 0.5, there's no guarantee that
        // the previous request is actually dispatched (and received) before the following
        // reset call is sent. to not waste more time on a workaround, a timeout is added.
        setTimeout(function() {
          cl.get('/socket.io/{protocol}/xhr-polling/' + sid + '/?disconnect');
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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
          '/socket.io/{protocol}/xhr-polling/' + sid
        , parser.encodePacket({ type: 'disconnect' })
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, packs) {
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
          '/socket.io/{protocol}/xhr-polling/' + sid
        , parser.encodePayload([
              parser.encodePacket({ type: 'message', data: 'a' })
            , parser.encodePacket({ type: 'message', data: 'b' })
            , parser.encodePacket({ type: 'disconnect' })
          ])
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

      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        tobi();

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.get('/socket.io/{protocol}/xhr-polling/' + sid);

        connectMessage = true;

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/woot' })
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid);
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function () {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/woot' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'disconnect', endpoint: '/woot' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');

                    cl.post(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , parser.encodePacket({ type: 'message', data: 'ferret' })
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/b' })
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
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'message', data: '' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'message', endpoint: '/a', data: 'a' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/b' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'message', endpoint: '/b', data: 'b' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );
      });
    });
  },

  'test sending json from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.json.send(['a', 'b', 'c']);
        s.json.send({
            a: 'b'
          , c: 'd'
        });

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.eql(200);

          msgs.should.have.length(2);
          msgs[0].should.eql({
              type: 'json'
            , data: ['a', 'b', 'c']
            , endpoint: ''
          });
          msgs[1].should.eql({
              type: 'json'
            , data: {
                  a: 'b'
                , c: 'd'
              }
            , endpoint: ''
          });
        });
      })
    });
  },

  'test sending json to the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messages = 0;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .1);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        messages++;

        if (messages == 1) {
          msg.should.eql({ tobi: 'rocks' });
        } else if (messages == 2) {
          msg.should.eql(5000);
        }
      });

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'json'
              , data: { tobi: 'rocks' }
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.equal('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'json'
                    , data: 5000
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.equal('1');
                  }
              );
            }
        );
      });
    });
  },

  'test emitting an event from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.emit('tobi is playing');

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.eql(200);

          msgs.should.have.length(1);
          msgs[0].should.eql({
              type: 'event'
            , name: 'tobi is playing'
            , endpoint: ''
            , args: []
          });
        });
      });
    });
  },

  'test emitting an event with data from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.emit('edwald', { woot: 'woot' }, [1, 2, 3]);

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.eql(200);

          msgs.should.have.length(1);
          msgs[0].should.eql({
              type: 'event'
            , name: 'edwald'
            , endpoint: ''
            , args: [{ woot: 'woot' }, [1, 2, 3]]
          });
        });
      });
    });
  },

  'test emitting an event to the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('jane', function (a, b, c) {
        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'event'
              , name: 'jane'
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.equal('1');
            }
        );
      });
    });
  },

  'test that emitting an error event doesnt throw': function (done) {
    var cl = client(++ports)
      , io = create(cl)

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'event'
              , name: 'error'
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.equal('1');
            }
        );
      });
    });
  },

  'test emitting an event to the server with data': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('woot', function (a, b, c) {
        a.should.eql('a');
        b.should.eql(2);
        c.should.eql([1, 2]);

        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'event'
              , name: 'woot'
              , args: ['a', 2, [1, 2]]
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.equal('1');
            }
        );
      });
    });
  },

  'test sending undeliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.volatile.send('woooot');

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.equal(200);
          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'noop', endpoint: '' });
        });
      });
    });
  },

  'test sending undeliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.volatile.json.send('woooot');

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.equal(200);
          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'noop', endpoint: '' });
        });
      });
    });
  },

  'test sending undeliverable volatile events': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        s.volatile.emit('woooot');

        cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          res.statusCode.should.equal(200);
          msgs.should.have.length(1);
          msgs[0].should.eql({ type: 'noop', endpoint: '' });
        });
      });
    });
  },

  'test sending deliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);

        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'message'
          , data: 'woooot'
          , endpoint: ''
        });
      });

      setTimeout(function () {
        s.volatile.send('woooot');
      }, 10);
    });
  },

  'test sending deliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);

        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'json'
          , data: 5
          , endpoint: ''
        });
      });

      setTimeout(function () {
        s.volatile.json.send(5);
      }, 10);
    });
  },

  'test sending deliverable volatile events': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);

        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'event'
          , name: 'tobi'
          , args: []
          , endpoint: ''
        });
      });

      setTimeout(function () {
        s.volatile.json.emit('tobi');
      }, 10);
    });
  },

  'test automatic acknowledgements sent from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('woot');
        received = true;
      });

      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'message'
              , data: 'woot'
              , id: 1
              , endpoint: ''
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(1);
                    msgs[0].should.eql({
                        type: 'ack'
                      , ackId: 1
                      , endpoint: ''
                      , args: []
                    });
                  }
              );
            }
        );
      });

    });
  },

  'test manual data acknowledgement sent from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acknowledged = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (data, fn) {
        data.should.eql('tobi');
        fn('woot');
        acknowledged = true;
      });

      socket.on('disconnect', function () {
        acknowledged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'ack'
          , args: ['woot']
          , endpoint: ''
          , ackId: '3'
        });
      });

      cl.post(
          '/socket.io/{protocol}/xhr-polling/' + sid
        , parser.encodePacket({
              type: 'message'
            , data: 'tobi'
            , ack: 'data'
            , id: '3'
          })
        , function (res, data) {
            res.statusCode.should.eql(200);
            data.should.eql('1');
          }
      );
    });
  },

  'test automatic acknowledgements sent from the client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acknowledged = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.send('aaaa', function () {
        acknowledged = true;
      });

      socket.on('disconnect', function () {
        acknowledged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'message'
          , id: '1'
          , data: 'aaaa'
          , ack: true
          , endpoint: ''
        });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'ack'
              , ackId: '1'
            })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');
            }
        );
      });
    });
  },

  'test automatic ack with event sent from the client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acked = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.emit('woot', 1, 2, '3', function () {
        acked = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'event'
          , name: 'woot'
          , args: [1, 2, '3']
          , id: '1'
          , ack: true
          , endpoint: ''
        });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'ack'
              , ackId: '1'
              , args: []
              , endpoint: ''
            })
        );
      });
    });
  },

  'test manual data ack with event sent from the client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acked = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.emit('woot', 1, 2, '3', function (a) {
        a.should.eql('1');
        acked = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({
            type: 'event'
          , name: 'woot'
          , args: [1, 2, '3']
          , id: '1'
          , ack: 'data'
          , endpoint: ''
        });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({
                type: 'ack'
              , ackId: '1'
              , args: ['1']
              , endpoint: ''
            })
        );
      });
    });
  },

  'test endpoint sending json from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false;;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/chrislee').on('connection', function (socket) {
      socket.json.send([1, 2, { 3: 4 }]);
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(2);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    msgs[1].should.eql({
                        type: 'json'
                      , data: [1, 2, { 3: 4 }]
                      , endpoint: '/chrislee'
                    });

                    received = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending json to the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , subMessaged = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.false;
        subMessaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/a').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql(['a', 'b', { c: 'd' }]);
        subMessaged = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'json'
                    , endpoint: '/a'
                    , data: ['a', 'b', { c: 'd' }]
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint emitting an event from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false;;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/chrislee').on('connection', function (socket) {
      socket.emit('tj');
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(2);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    msgs[1].should.eql({
                        type: 'event'
                      , name: 'tj'
                      , args: []
                      , endpoint: '/chrislee'
                    });

                    received = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint emitting an event with data from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false;;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/chrislee').on('connection', function (socket) {
      socket.emit('tj', 1, 2, 3, 4);
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(2);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    msgs[1].should.eql({
                        type: 'event'
                      , name: 'tj'
                      , args: [1, 2, 3, 4]
                      , endpoint: '/chrislee'
                    });

                    received = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint emitting an event to the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , subMessaged = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.false;
        subMessaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/a').on('connection', function (socket) {
      socket.on('tj', function () {
        subMessaged = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'event'
                    , name: 'tj'
                    , endpoint: '/a'
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint emitting an event to the server with data': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , subMessaged = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('message', function (msg) {
        messaged = true;
      });

      socket.on('disconnect', function () {
        messaged.should.be.false;
        subMessaged.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    io.of('/a').on('connection', function (socket) {
      socket.on('tj', function (ferret, age) {
        ferret.should.eql('tobi');
        age.should.eql(23);
        subMessaged = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'event'
                    , name: 'tj'
                    , endpoint: '/a'
                    , args: ['tobi', 23]
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending undeliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , empty = false
      , s;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        empty.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              s.volatile.send('woot');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.length.should.eql(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    empty = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending undeliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , empty = false
      , s;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        empty.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              s.volatile.json.send(15);

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.length.should.eql(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    empty = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending undeliverable volatile events': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , empty = false
      , s;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        empty.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              s.volatile.json.emit('woot');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.length.should.eql(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });
                    empty = true;
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending deliverable volatile messages': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          msgs.should.have.length(1);
                          msgs[0].should.eql({
                              type: 'message'
                            , data: 'edwald'
                            , endpoint: '/chrislee'
                          });

                          received = true;
                        }
                    );

                    setTimeout(function () {
                      s.volatile.send('edwald');
                    }, 20);
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending deliverable volatile json': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          msgs.should.have.length(1);
                          msgs[0].should.eql({
                              type: 'json'
                            , data: 152
                            , endpoint: '/chrislee'
                          });

                          received = true;
                        }
                    );

                    setTimeout(function () {
                      s.volatile.json.send(152);
                    }, 20);
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint sending deliverable volatile events': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , received = false
      , s;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.of('/chrislee').on('connection', function (socket) {
      s = socket;

      socket.on('disconnect', function () {
        received.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/chrislee' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(1);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/chrislee'
                      , qs: ''
                    });

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          msgs.should.have.length(1);
                          msgs[0].should.eql({
                              type: 'event'
                            , name: 'woooo'
                            , args: [[1, 2]]
                            , endpoint: '/chrislee'
                          });

                          received = true;
                        }
                    );

                    setTimeout(function () {
                      s.volatile.emit('woooo', [1, 2]);
                    }, 20);
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint automatic acks sent from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , acked = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/tobi').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('woot');
        messaged = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/tobi' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'message'
                    , id: '3'
                    , data: 'woot'
                    , endpoint: '/tobi'
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          res.statusCode.should.eql(200);
                          msgs.should.have.length(2);
                          msgs[0].should.eql({
                              type: 'connect'
                            , endpoint: '/tobi'
                            , qs: ''
                          });
                          msgs[1].should.eql({
                              type: 'ack'
                            , ackId: '3'
                            , endpoint: '/tobi'
                            , args: []
                          });

                          acked = true;
                        }
                    );
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint manual data ack sent from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , acked = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/tobi').on('connection', function (socket) {
      socket.on('message', function (msg, fn) {
        msg.should.eql('woot');
        fn();
        messaged = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/tobi' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'message'
                    , id: '3'
                    , data: 'woot'
                    , ack: 'data'
                    , endpoint: '/tobi'
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          res.statusCode.should.eql(200);
                          msgs.should.have.length(2);
                          msgs[0].should.eql({
                              type: 'connect'
                            , endpoint: '/tobi'
                            , qs: ''
                          });
                          msgs[1].should.eql({
                              type: 'ack'
                            , ackId: '3'
                            , args: []
                            , endpoint: '/tobi'
                          });

                          acked = true;
                        }
                    );
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint manual data event ack sent from the server': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false
      , acked = false;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.of('/tobi').on('connection', function (socket) {
      socket.on('woot', function (msg, fn) {
        msg.should.eql(1);
        fn('aaaa');
        messaged = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/tobi' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({
                      type: 'event'
                    , id: '3'
                    , name: 'woot'
                    , ack: 'data'
                    , args: [1]
                    , endpoint: '/tobi'
                  })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('1');

                    cl.get(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , function (res, msgs) {
                          res.statusCode.should.eql(200);
                          msgs.should.have.length(2);
                          msgs[0].should.eql({
                              type: 'connect'
                            , endpoint: '/tobi'
                            , qs: ''
                          });
                          msgs[1].should.eql({
                              type: 'ack'
                            , ackId: '3'
                            , args: ['aaaa']
                            , endpoint: '/tobi'
                          });

                          acked = true;
                        }
                    );
                  }
              );
            }
        );
      });
    });
  },

  'test endpoint acknowledgements sent from the client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acked = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.of('/woot').on('connection', function (socket) {
      socket.send('aaa', function () {
        acked = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.eql(200);

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/woot' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    msgs.should.have.length(2);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/woot'
                      , qs: ''
                    });
                    msgs[1].should.eql({
                        type: 'message'
                      , data: 'aaa'
                      , endpoint: '/woot'
                      , id: '1'
                      , ack: true
                    });

                    cl.post(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , parser.encodePacket({
                            type: 'ack'
                          , ackId: '1'
                          , endpoint: '/woot'
                        })
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

  'test endpoint manual data event acks sent from the client': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , acked = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.of('/rapture').on('connection', function (socket) {
      socket.emit('woot', 'a', function (a, b, c) {
        a.should.eql(5);
        b.should.eql('hello');
        c.should.eql([1, 2, 3]);

        acked = true;
      });

      socket.on('disconnect', function () {
        acked.should.be.true;
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        res.statusCode.should.equal(200);
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'noop', endpoint: '' });

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/rapture' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('1');

              cl.get(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , function (res, msgs) {
                    res.statusCode.should.eql(200);
                    msgs.should.have.length(2);
                    msgs[0].should.eql({
                        type: 'connect'
                      , endpoint: '/rapture'
                      , qs: ''
                    });
                    msgs[1].should.eql({
                        type: 'event'
                      , id: '1'
                      , name: 'woot'
                      , args: ['a']
                      , ack: 'data'
                      , endpoint: '/rapture'
                    });

                    cl.post(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , parser.encodePacket({
                            type: 'ack'
                          , ackId: '1'
                          , args: [5, 'hello', [1, 2, 3]]
                          , endpoint: '/rapture'
                        })
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

  'test CORS': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , messaged = false;

    io.configure(function () {
      io.set('polling duration', .05);
      io.set('close timeout', .05);
    });

    io.sockets.on('connection', function (socket) {
      socket.send('woot');

      socket.on('message', function (msg) {
        msg.should.equal('woot');
        messaged = true;
      });

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, {
        headers: {
          Origin: 'http://localhost:3500'
        }
      }, function (res, packs) {
        var headers = res.headers;

        headers['access-control-allow-origin'].should.equal('*');
        should.strictEqual(headers['access-control-allow-credentials'], undefined);

        packs.should.have.length(1);
        packs[0].type.should.eql('message');
        packs[0].data.should.eql('woot');

        cl.post('/socket.io/{protocol}/xhr-polling/' + sid, parser.encodePacket({
            type: 'message'
          , data: 'woot'
        }), {
          headers: {
              Origin: 'http://localhost:3500'
            , Cookie: 'woot=woot'
          }
        }, function (res, data) {
          var headers = res.headers;
          headers['access-control-allow-origin'].should.equal('*');
          headers['access-control-allow-credentials'].should.equal('true');

          data.should.equal('1');
        });
      });
    });
  },

  'test emitting to closed clients': function (done) {
    var cl = client(++ports)
      , cl2 = client(ports)
      , io = create(cl)
      , connections = 0;

    io.configure(function () {
      io.set('close timeout', .1);
    });

    io.sockets.on('connection', function (socket) {
      socket.send('a');
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, packs) {
        res.statusCode.should.equal(200);
        packs.should.have.length(1);
        packs[0].should.eql({ type: 'message', endpoint: '', data: 'a' });

        cl2.handshake(function (sid2) {
          cl2.get(
              '/socket.io/{protocol}/xhr-polling/' + sid2
            , function (res, packs) {
                res.statusCode.should.equal(200);
                packs.should.have.length(1);
                packs[0].should.eql({ type: 'message', endpoint: '', data: 'a' });

                io.sockets.emit('woot', 'b');

                var total = 2;

                cl.get(
                    '/socket.io/{protocol}/xhr-polling/' + sid
                  , function (res, packs) {
                      res.statusCode.should.equal(200);
                      packs.should.have.length(1);
                      packs[0].should.eql({
                          type: 'event'
                        , endpoint: ''
                        , name: 'woot'
                        , args: ['b']
                      });

                      --total || finish();
                    }
                );

                cl2.get(
                    '/socket.io/{protocol}/xhr-polling/' + sid2
                  , function (res, packs) {
                      res.statusCode.should.equal(200);
                      packs.should.have.length(1);
                      packs[0].should.eql({
                          type: 'event'
                        , endpoint: ''
                        , name: 'woot'
                        , args: ['b']
                      });

                      --total || finish();
                    }
                );

                function finish () {
                  cl.end();
                  cl2.end();
                  io.server.close();
                  done();
                };
              }
          );
        });

      });
    });
  }

};
