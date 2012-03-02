
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('../')
  , fs = require('fs')
  , http = require('http')
  , https = require('https')
  , should = require('./common')
  , ports = 15000;

/**
 * Test.
 */

module.exports = {

  'test that protocol version is present': function (done) {
    sio.protocol.should.be.a('number');
    done();
  },

  'test that default transports are present': function (done) {
    sio.Manager.defaultTransports.should.be.an.instanceof(Array);
    done();
  },

  'test that version is present': function (done) {
    sio.version.should.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);
    done();
  },

  'test listening with a port': function (done) {
    var cl = client(++ports)
      , io = create(cl);

    io.server.should.be.an.instanceof(http.Server);

    cl.get('/', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');

      cl.end();
      io.server.close();
      done();
    });
  },

  'test listening with a server': function (done) {
    var server = http.createServer()
      , io = sio.listen(server)
      , port = ++ports
      , cl = client(port);

    server.listen(port);

    cl.get('/socket.io', function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');

      cl.end();
      server.close();
      done();
    });
  },

  'test listening with a https server': function (done) {
    var server = https.createServer({
            key: fs.readFileSync(__dirname + '/fixtures/key.key')
          , cert: fs.readFileSync(__dirname + '/fixtures/cert.crt')
        }, function () { })
      , io = sio.listen(server)
      , port = ++ports;

    server.listen(port);

    var req = require('https').get({
        host: 'localhost'
      , port: port
      , path: '/socket.io'
    }, function (res) {
      res.statusCode.should.eql(200);

      var buf = '';

      res.on('data', function (data) {
        buf += data;
      });

      res.on('end', function () {
        buf.should.eql('Welcome to socket.io.');

        res.socket.end();
        server.close();
        done();
      });
    });
  },

  'test listening with no arguments listens on 80': function (done) {
    try {
      var io = sio.listen()
        , cl = client(80);

      cl.get('/socket.io', function (res) {
        res.statusCode.should.eql(200);

        cl.end();
        io.server.close();
        done();
      });
      done();
    } catch (e) {
      e.should.match(/EACCES/);
      done();
    }
  }
};
