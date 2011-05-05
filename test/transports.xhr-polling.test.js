
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

    var req = get({
        port: port
      , path: '/socket.io/{protocol}/'
    }, function (res, data) {
      var sessid = data.split(':')[0]
        , total = 2;
      
      get({
          port: port
        , path: '/socket.io/{protocol}/xhr-polling/jiasdasjid'
      }, function (res, data) {
        res.statusCode.should.eql(200);

        data.should.eql(parser.encodePacket({
            type: 'error'
          , reason: 'client not handshaken'
        }));

        --total || finish();
      });

      get({
          port: port
        , path: '/socket.io/{protocol}/xhr-polling/' + sessid
      }, function (res, data) {
        res.statusCode.should.eql(200);
        data.should.eql('');
        --total || finish();
      });
    });
  },

  'test the connection event': function (done) {
    var port = ++ports
      , io = sio.listen(port)
      , sessid, req;

    io.configure(function () {
      io.set('polling duration', .2);
      io.set('close timeout', .2);
    });

    io.sockets.on('connection', function (socket) {
      socket.id.should.eql(sessid);
      io.server.close();
      done();
    });

    handshake(port, function (sid) {
      sessid = sid;
      req = get({
          port: port
        , path: '/socket.io/{protocol}/xhr-polling/' + sid
      }, function() {});
    });
  },

  'test sending back data': function (data) {
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
      get({
          port: port
        , path: '/socket.io/{protocol}/xhr-polling/' + sid
      }, function (res, data) {
        var packet = parser.decodePacket(data);
        packet.type.should.eql('message');
        packet.data.should.eql('woot');
      });
    });
  }

};
