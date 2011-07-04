
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
  , ports = 15700;

/**
 * Test.
 */

module.exports = {
  'namespace pass no authentication': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.of('/a')
      .on('connection', function (socket) {
        cl.end();
        ws.finishClose();
        io.server.close()
        done();
      });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('open', function () {
        ws.packet({
            type: 'connect'
          , endpoint: '/a'
        });
      })
    });
  },

  'namespace pass authentication': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.of('/a')
      .authorization(function (data, fn) {
        fn(null, true);
      })
      .on('connection', function (socket) {
        cl.end();
        ws.finishClose();
        io.server.close()
        done();
      });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('open', function () {
        ws.packet({
            type: 'connect'
          , endpoint: '/a'
        });
      })
    });
  },

  'namespace authentication handshake data': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , ws;

    io.of('/a')
      .authorization(function (data, fn) {
        data.foo = 'bar';
        fn(null, true);
      })
      .on('connection', function (socket) {
        (!!socket.handshake.address.address).should.be.true;
        (!!socket.handshake.address.port).should.be.true;
        socket.handshake.headers.host.should.equal('localhost');
        socket.handshake.headers.connection.should.equal('keep-alive');
        socket.handshake.time.should.match(/GMT/);
        socket.handshake.foo.should.equal('bar');

        cl.end();
        ws.finishClose();
        io.server.close()
        done();
      });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('open', function () {
        ws.packet({
            type: 'connect'
          , endpoint: '/a'
        });
      })
    });
  },

  'namespace fail authentication': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , calls = 0
      , ws;

    io.of('/a')
      .authorization(function (data, fn) {
        fn(null, false);
      })
      .on('connection', function (socket) {
        throw new Error('Should not be called');
      });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);
      ws.on('open', function () {
        ws.packet({
            type: 'connect'
          , endpoint: '/a'
        });
      });

      ws.on('message', function (data) {
        if (data.endpoint == '/a') {
          data.type.should.eql('error');
          data.reason.should.eql('unauthorized')
          
          cl.end();
          ws.finishClose();
          io.server.close()
          done();
        }
      })
    });
  },

  'broadcasting sends and emits on a namespace': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , calls = 0
      , connect = 0
      , message = 0
      , events = 0
      , expected = 5
      , ws1
      , ws2;

    io.of('a')
      .on('connection', function (socket){
        socket.broadcast.emit('b', 'test');
        socket.broadcast.json.emit('json', {foo:'bar'});
        socket.broadcast.send('foo');
      });

    function finish () {
      connect.should.equal(2);
      message.should.equal(1);
      events.should.equal(2);

      cl.end();
      ws1.finishClose();
      ws2.finishClose();
      io.server.close();
      done();
    }

    cl.handshake(function (sid) {
     ws1 = websocket(cl, sid);

      ws1.on('open', function() {
        ws1.packet({
            type: 'connect'
          , endpoint: 'a'
        });
      });

      ws1.on('message', function (data) {
        if (data.type === 'connect') {
          ++connect;
          if (++calls === expected) finish();
        }

        if (data.type === 'message') {
          ++message;
          if (++calls === expected) finish();
        }

        if (data.type === 'event') {
          if (data.name === 'b' || data.name === 'json') ++events;
          if (++calls === expected) finish();
        }
      });

      cl.handshake(function (sid) {
        ws2 = websocket(cl, sid);

        ws2.on('open', function () {
          ws2.packet({
              type: 'connect'
            , endpoint: 'a'
          });
        });
      })
    })
  },

  'joining rooms inside a namespace': function (done) {
    var cl = client(++ports)
      , io = create(cl)
      , calls = 0
      , ws;

    io.of('/foo').on('connection', function (socket) {
      socket.join('foo.bar');
      this.in('foo.bar').emit('baz', 'pewpew');
    });

    cl.handshake(function (sid) {
      ws = websocket(cl, sid);

      ws.on('open', function (){
         ws.packet({
            type: 'connect'
          , endpoint: '/foo'
        });
      });

      ws.on('message', function (data) {
        if (data.type === 'event') {
          data.name.should.equal('baz');

          cl.end();
          ws.finishClose();
          io.server.close();
          done();
        }
      });
    })
  }
};
