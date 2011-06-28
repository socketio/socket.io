
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
  }
};
