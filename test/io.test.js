
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('socket.io')
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
    var port = ++ports
      , io = sio.listen(port);

    io.server.should.be.an.instanceof(http.Server);

    get('/', port, function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');
      io.server.close();
      done();
    });
  },

  'test listening with a server': function (done) {
    var server = http.createServer()
      , io = sio.listen(server)
      , port = ++ports;

    server.listen(port);

    get('/socket.io', port, function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');
      
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

    get('/socket.io', port, { secure: true }, function (res, data) {
      res.statusCode.should.eql(200);
      data.should.eql('Welcome to socket.io.');
      
      server.close();
      done();
    });
  },

  'test listening with no arguments listens on 80': function (done) {
    try {
      var io = sio.listen();
      get('/socket.io', 80, function (res) {
        res.statusCode.should.eql(200);
        io.server.close();
        done();
      });
    } catch (e) {
      e.should.match(/EACCES/);
      done();
    }
  }

};
