
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
      io.set('polling duration', .2);
      io.set('close timeout', .2);
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
      io.set('polling duration', .2);
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
    
  },

  'test the disconnection event when the client sends ?disconnect req':
  function () {
    
  },

  'test the disconnection event': function () {

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
    });

    handshake(port, function (sid) {
      get('/socket.io/{protocol}/xhr-polling/' + sid, port, function (res, packs) {
        packs.should.have.length(1);
        packs[0].type.should.eql('message');
        packs[0].data.should.eql('woot');
        done();
      });
    });
  },

  'test message buffering between a response and a request': function () {
  },

  'test message buffering between a connection close and a request': function () {
    
  },

};
