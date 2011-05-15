
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
  , parser = sio.parser
  , ports = 15200;

/**
 * Test.
 */

module.exports = {

  'test handshake': function (done) {
    var port = ++ports
      , io = sio.listen(port);

    io.configure(function () {
      io.set('close timeout', .2);
      io.set('polling duration', .2);
    });

    function finish () {
      req.res.socket.end();
      io.server.close();
      done();
    };

    var req = get('/socket.io/{protocol}/', port, function (res, data) {
      var sid = data.split(':')[0]
        , total = 2;

      get('/socket.io/{protocol}/xhr-polling/tobi', port, function (res, packets) {
        res.statusCode.should.eql(200);

        packets.should.have.length(1);
        packets[0].should.eql({
            type: 'error'
          , reason: 'client not handshaken'
          , endpoint: ''
          , advice: ''
        });

        --total || finish();
      });

      // we rely on a small poll duration to close this request quickly
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, data) {
        res.statusCode.should.eql(200);
        data.should.eql('');
        --total || finish();
      });
    });
  },

  'test the connection event': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , sid, req;

    io.configure(function () {
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sid);
      io.server.close();
      done();
    });

    handshake(port, function (sessid) {
      sid = sessid;
      req = get('/socket.io/{protocol}/xhr-polling/' + sid, port);
    });
  },

  'test the disconnection event after a close timeout': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , sid;

    io.configure(function () {
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sid);

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      var req = get('/socket.io/{protocol}/xhr-polling/' + sid, port);

      // here we close the request instead of relying on a small poll timeout
      setTimeout(function () {
        req.abort();
      }, 50);
    });
  },

  'test the disconnection event when the client sends ?disconnect req':
  function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , disconnected = false
      , sid;

    io.configure(function () {
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      get('/socket.io/{protocol}/xhr-polling/' + sid + '/?disconnect', port);

      socket.on('disconnect', function () {
        disconnected = true;
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, msgs) {
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'disconnect', endpoint: '' });
        disconnected.should.be.true;
        io.server.close();
        done();
      });
    });
  },

  'test the disconnection event booting a client': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , forced = false;

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function () {
        io.server.close();
        done();
      });

      socket.disconnect();
      forced = true;
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, msgs) {
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'disconnect', endpoint: '' });

        forced.should.be.true;
      });
    });
  },

  'test the disconnection event with client disconnect packet': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , sid;

    io.sockets.on('connection', function (client) {
      post(
          '/socket.io/{protocol}/xhr-polling/' + sid
        , port
        , parser.encodePacket({ type: 'disconnect' })
        , function (res, data) {
            res.statusCode.should.eql(200);
            data.should.eql('');
          }
      );

      client.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      get('/socket.io/{protocol}/xhr-polling/' + sid, port);
    });
  },

  'test sending back data': function (done) {
    var port = ++ports
      , io = sio.listen(port);

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      socket.send('woot');

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, packs) {
        packs.should.have.length(1);
        packs[0].type.should.eql('message');
        packs[0].data.should.eql('woot');
      });
    });
  },

  'test sending a batch of messages': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , sid;

    io.configure(function () {
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      var messages = 0;

      post(
          '/socket.io/{protocol}/xhr-polling/' + sid
        , port
        , parser.encodePayload([
              parser.encodePayload({ type: 'message', data: 'a' })
            , parser.encodePayload({ type: 'message', data: 'b' })
            , parser.encodePayload({ type: 'disconnect' })
          ])
        , function (res, data) {
            res.statusCode.should.eql(200);
            data.should.eql(200);
          }
      );

      socket.on('message', function (data) {
        messsages++;

        if (messages == 1)
          data.should.eql('a');

        if (messages == 2)
          data.should.eql('b');
      });

      socket.on('disconnect', function () {
        messages.should.eql(2);
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      get('/socket.io/{protocol}/xhr-polling/' + sid, port);
    });
  },

  'test message buffering between a response and a request': function () {
    var port = ++ports
      , io = sio.listen(port)
      , messages = false
      , sid, tobi;

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
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, data) {
        data.should.be('');

        tobi();

        get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, msgs) {
          msgs.should.have.length(3);
          msgs[0].should.eql('a');
          msgs[0].should.eql('b');
          msgs[0].should.eql('c');
          messages = true;
        });
      })
    });
  },

  'test message buffering between a conn close and a request': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , messages = false
      , sid, res;

    io.configure(function () {
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      res.connection.end();

      setTimeout(function () {
        socket.send('a');
        socket.send('b');
        socket.send('c');

        get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, msgs) {
          msgs.should.have.length(3);
          msgs[0].should.eql('a');
          msgs[0].should.eql('b');
          msgs[0].should.eql('c');
          messages = true;
        });
      }, 100);

      socket.on('disconnect', function () {
        messages.should.be.true;
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      sid = sessid;
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (resp) {
        res = resp;
      });
    });
  },

  'test connecting to a specific endpoint': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , connectMessage = false
      , sid;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
    });

    io.for('/woot').on('connection', function (socket) {
      connectMessage.should.be.true;

      socket.on('disconnect', function () {
        io.server.close();
        done();
      });
    });

    handshake(port, function (sessid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, data) {
        get('/socket.io/{protocol}/xhr-polling/' + sid, port);

        connectMessage = true;

        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/woot' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );
      });
    });
  },

  'test that connecting doesnt connect to defined endpoints': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , tobiConnected = false
      , mainConnected = false
      , sid;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      mainConnected = true;

      socket.on('disconnect', function () {
        tobiConnected.should.be.false;
        io.server.close();
        done();
      });
    });

    io.for('/tobi').on('connection', function () {
      tobiConnected = true;
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port);
    });
  },

  'test disconnecting a specific endpoint': function (done) {
    var port = ++ports
      , io = io.listen(port)
      , wootDisconnected = false
      , mainDisconnected = false
      , checked = false;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
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
        io.server.close();
        done();
      });
    });

    io.for('/woot').on('connection', function (socket) {
      socket.on('disconnect', function () {
        wootDisconnected = true;
      });
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function () {
        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/woot' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');

              post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , port
                , parser.encodePacket({ type: 'disconnect', endpoint: '/woot' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('');

                    post(
                        '/socket.io/{protocol}/xhr-polling/' + sid
                      , port
                      , parser.encodePacket({ type: 'message', data: 'ferret' })
                      , function (res, data) {
                          res.statusCode.should.eql(200);
                          data.should.eql('');
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
    var port = ++ports
      , io = sio.listen(port)
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
          io.server.close();
          done();
        }, 50);
      });
    });

    io.for('/a').on('connection', function (socket) {
      socket.on('disconnect', function (msg) {
        aDisconnected = true;
      });
    });

    io.for('/b').on('connection', function (socket) {
      socket.on('message', function (msg) {
        bDisconnected = true;
      });
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, data) {
        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );

        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/b' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );
      });
    });
  },

  'test messaging a specific endpoint': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , messaged = true
      , aMessaged = false
      , bMessaged = false;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
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
        io.server.close();
        done();
      });
    });

    io.for('/a').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('a');
        aMessaged = true;
      });
    });

    io.for('/b').on('connection', function (socket) {
      socket.on('message', function (msg) {
        msg.should.eql('b');
        bMessaged = true;
      });
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, data) {
        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'message', data: '' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );

        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');

              post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , port
                , parser.encodepacket({ type: 'message', endpoint: '/a', data: 'a' })
                , function (res, data) {
                    res.statuscode.should.eql(200);
                    data.should.eql('');
                  }
              );
            }
        );

        post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , port
          , parser.encodePacket({ type: 'connect', endpoint: '/b' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');

              post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , port
                , parser.encodepacket({ type: 'message', endpoint: '/b', data: 'b' })
                , function (res, data) {
                    res.statuscode.should.eql(200);
                    data.should.eql('');
                  }
              );
            }
        );
      });
    });
  }

};
