
/**
 * Test dependencies.
 */

var net = require('net');
var eio = require('..');
var listen = require('./common').listen;
var expect = require('expect.js');
var request = require('superagent');
var http = require('http');

/**
 * Tests.
 */

describe('engine', function () {
  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should be the same version as client', function () {
    expect(eio.protocol).to.be.a('number');
    var version = require('../package').version;
    expect(version).to.be(require('engine.io-client/package').version);
  });

  describe('engine()', function () {
    it('should create a Server when require called with no arguments', function () {
      var engine = eio();
      expect(engine).to.be.an(eio.Server);
    });
  });

  describe('listen', function () {
    it('should open a http server that returns 501', function (done) {
      listen(function (port) {
        request.get('http://localhost:%d/'.s(port), function (res) {
          expect(res.status).to.be(501);
          done();
        });
      });
    });
  });

  describe('attach()', function () {
    it('should work from require()', function () {
      var server = http.createServer();
      var engine = eio(server);

      expect(engine).to.be.an(eio.Server);
    });

    it('should return an engine.Server', function () {
      var server = http.createServer();
      var engine = eio.attach(server);

      expect(engine).to.be.an(eio.Server);
    });

    it('should attach engine to an http server', function (done) {
      var server = http.createServer();
      eio.attach(server);

      server.listen(function () {
        var uri = 'http://localhost:%d/engine.io/default/'.s(server.address().port);
        request.get(uri, function (res) {
          expect(res.status).to.be(400);
          expect(res.body.code).to.be(0);
          expect(res.body.message).to.be('Transport unknown');
          server.once('close', done);
          server.close();
        });
      });
    });

    it('should destroy upgrades not handled by engine', function (done) {
      var server = http.createServer();
      eio.attach(server, { destroyUpgradeTimeout: 50 });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.setEncoding('ascii');
        client.write([
          'GET / HTTP/1.1',
          'Connection: Upgrade',
          'Upgrade: IRC/6.9',
          '', ''
        ].join('\r\n'));

        var check = setTimeout(function () {
          done(new Error('Client should have ended'));
        }, 100);

        client.on('end', function () {
          clearTimeout(check);
          done();
        });
      });
    });

    it('should not destroy unhandled upgrades with destroyUpgrade:false', function (done) {
      var server = http.createServer();
      eio.attach(server, { destroyUpgrade: false, destroyUpgradeTimeout: 50 });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
            'GET / HTTP/1.1',
            'Connection: Upgrade',
            'Upgrade: IRC/6.9',
            '', ''
          ].join('\r\n'));

          setTimeout(function () {
            client.removeListener('end', onEnd);
            done();
          }, 100);

          function onEnd () {
            done(new Error('Client should not end'));
          }

          client.on('end', onEnd);
        });
      });
    });

    it('should destroy unhandled upgrades with after a timeout', function (done) {
      var server = http.createServer();
      eio.attach(server, { destroyUpgradeTimeout: 200 });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
            'GET / HTTP/1.1',
            'Connection: Upgrade',
            'Upgrade: IRC/6.9',
            '', ''
          ].join('\r\n'));

          // send from client to server
          // tests that socket is still alive
          // this will not keep the socket open as the server does not handle it
          setTimeout(function () {
            client.write('foo');
          }, 100);

          function onEnd () {
            done();
          }

          client.on('end', onEnd);
        });
      });
    });

    it('should not destroy handled upgrades with after a timeout', function (done) {
      var server = http.createServer();
      eio.attach(server, { destroyUpgradeTimeout: 100 });

      // write to the socket to keep engine.io from closing it by writing before the timeout
      server.on('upgrade', function (req, socket) {
        socket.write('foo');
        socket.on('data', function (chunk) {
          expect(chunk.toString()).to.be('foo');
          socket.end();
        });
      });

      server.listen(function () {
        var client = net.createConnection(server.address().port);

        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
            'GET / HTTP/1.1',
            'Connection: Upgrade',
            'Upgrade: IRC/6.9',
            '', ''
          ].join('\r\n'));

          // test that socket is still open by writing after the timeout period
          setTimeout(function () {
            client.write('foo');
          }, 200);

          client.on('data', function (data) {
          });

          client.on('end', done);
        });
      });
    });

    it('should preserve original request listeners', function (done) {
      var listeners = 0;
      var server = http.createServer(function (req, res) {
        expect(req && res).to.be.ok();
        listeners++;
      });

      server.on('request', function (req, res) {
        expect(req && res).to.be.ok();
        res.writeHead(200);
        res.end('');
        listeners++;
      });

      eio.attach(server);

      server.listen(function () {
        var port = server.address().port;
        request.get('http://localhost:%d/engine.io/default/'.s(port), function (res) {
          expect(res.status).to.be(400);
          expect(res.body.code).to.be(0);
          expect(res.body.message).to.be('Transport unknown');
          request.get('http://localhost:%d/test'.s(port), function (res) {
            expect(res.status).to.be(200);
            expect(listeners).to.eql(2);
            server.once('close', done);
            server.close();
          });
        });
      });
    });
  });
});
