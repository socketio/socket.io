
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
    var cl = client(++ports)
      , io = create(cl);

    io.configure(function () {
      io.set('close timeout', 0);
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
          , advice: ''
        });

        --total || finish();
      });

      // we rely on a small poll duration to close this request quickly
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        res.statusCode.should.eql(200);
        data.should.eql('');
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
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sid);

      socket.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid);
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

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid);

      // here we close the request instead of relying on a small poll timeout
      setTimeout(function () {
        cl.end();
      }, 10);
    });
  },

  'test the disconnection event when the client sends ?disconnect req':
  function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , disconnected = false
      , sid;

    io.configure(function () {
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid + '/?disconnect');

      socket.on('disconnect', function () {
        disconnected = true;
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
        msgs.should.have.length(1);
        msgs[0].should.eql({ type: 'disconnect', endpoint: '' });
        disconnected.should.be.true;
        cl.end();
        io.server.close();
        done();
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
            data.should.eql('');
          }
      );

      client.on('disconnect', function () {
        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid);
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
            data.should.eql('');
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

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid);
    });
  },

  'test message buffering between a response and a request': function (done) {
    var cl = client(++ports)
      , io = create(cl)
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

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sessid) {
      sid = sessid;
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        data.should.eql('');

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

  //'test message buffering between a conn close and a request': function (done) {
    //var cl = client(++ports)
      //, io = create(cl)
      //, messages = false
      //, sid, res;

    //io.configure(function () {
      //io.set('close timeout', .1);
    //});

    //io.sockets.on('connection', function (socket) {
      //cl.end();

      //setTimeout(function () {
        //socket.send('a');
        //socket.send('b');
        //socket.send('c');

        //cl = client(cl.port);
        //cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, msgs) {
          //msgs.should.have.length(3);
          //msgs[0].should.eql({ type: 'message', endpoint: '', data: 'a' });
          //msgs[1].should.eql({ type: 'message', endpoint: '', data: 'b' });
          //msgs[2].should.eql({ type: 'message', endpoint: '', data: 'c' });
          //messages = true;
        //});
      //}, 50);

      //socket.on('disconnect', function () {
        //messages.should.be.true;
        //cl.end();
        //io.server.close();
        //done();
      //});
    //});

    //cl.handshake(function (sessid) {
      //sid = sessid;
      //cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (resp) {
        //res = resp;
      //});
    //});
  //},

  'test connecting to a specific endpoint': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , connectMessage = false
      , sid;

    io.configure(function () {
      io.set('polling duration', 0);
      io.set('close timeout', .05);
    });

    io.for('/woot').on('connection', function (socket) {
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
              data.should.eql('');
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

    io.for('/tobi').on('connection', function () {
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

    io.for('/woot').on('connection', function (socket) {
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
              data.should.eql('');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'disconnect', endpoint: '/woot' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('');

                    cl.post(
                        '/socket.io/{protocol}/xhr-polling/' + sid
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

    io.for('/a').on('connection', function (socket) {
      socket.on('disconnect', function (msg) {
        aDisconnected = true;
      });
    });

    io.for('/b').on('connection', function (socket) {
      socket.on('disconnect', function (msg) {
        bDisconnected = true;
      });
    });

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        res.statusCode.should.eql(200);
        data.should.eql('');

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
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

    cl.handshake(function (sid) {
      cl.get('/socket.io/{protocol}/xhr-polling/' + sid, function (res, data) {
        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'message', data: '' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/a' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'message', endpoint: '/a', data: 'a' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('');
                  }
              );
            }
        );

        cl.post(
            '/socket.io/{protocol}/xhr-polling/' + sid
          , parser.encodePacket({ type: 'connect', endpoint: '/b' })
          , function (res, data) {
              res.statusCode.should.eql(200);
              data.should.eql('');

              cl.post(
                  '/socket.io/{protocol}/xhr-polling/' + sid
                , parser.encodePacket({ type: 'message', endpoint: '/b', data: 'b' })
                , function (res, data) {
                    res.statusCode.should.eql(200);
                    data.should.eql('');
                  }
              );
            }
        );
      });
    });
  }

};
