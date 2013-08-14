/*global eio,listen,request,expect*/

/**
 * Test dependencies.
 */

var net = require('net')
  , http = require('http');

/**
 * Tests.
 */

describe('engine', function () {

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should be the same version as client', function(){
    expect(eio.protocol).to.be.a('number');
    var version = require('../package').version;
    expect(version).to.be(require('engine.io-client/package').version);
  });

  describe('listen', function () {
    it('should open a http server that returns 501', function (done) {
      var server = listen(function (port) {
        request.get('http://localhost:%d/'.s(port), function (res) {
          expect(res.status).to.be(501);
          done();
        });
      });
    });
  });

  describe('attach()', function () {
    it('should return an engine.Server', function () {
      var server = http.createServer()
        , engine = eio.attach(server);

      expect(engine).to.be.an(eio.Server);
    });

    it('should attach engine to an http server', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

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

    it('should respond to flash policy requests', function (done) {
      var server = net.createServer({allowHalfOpen: true})
        , engine = eio.attach(server);

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.write('<policy-file-request/>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          expect(data).to.contain('<allow-access-from');
          client.end();
          done();
        });
      });
    });

    it('should not respond to borked flash policy requests', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function () {
          done(new Error('Should not respond'));
        });
        setTimeout(done, 20);
      });
    });

    it('should not respond to flash policy requests when policyFile:false', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { policyFile: false });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          done(new Error('Should not fire'));
        });
        setTimeout(done, 20);
      });
    });

    it('should not respond to flash policy requests when no flashsocket', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { transports: ['xhr-polling', 'websocket'] });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          done(new Error('Should not fire'));
        });
        setTimeout(done, 20);
      });
    });

    it('should destroy upgrades not handled by engine', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.setEncoding('ascii');
        client.write([
            'GET / HTTP/1.1'
          , 'Upgrade: IRC/6.9'
          , '', ''
        ].join('\r\n'));

        var check = setTimeout(function () {
          done(new Error('Client should have ended'));
        }, 20);

        client.on('end', function () {
          clearTimeout(check);
          done();
        });
      });
    });

    it('should not destroy unhandled upgrades with destroyUpgrade:false', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { destroyUpgrade: false, destroyUpgradeTimeout: 50 });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
              'GET / HTTP/1.1'
            , 'Upgrade: IRC/6.9'
            , '', ''
          ].join('\r\n'));

          var check = setTimeout(function () {
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
      var server = http.createServer()
        , engine = eio.attach(server, { destroyUpgradeTimeout: 200 });

      server.listen(function () {
        var client = net.createConnection(server.address().port);
        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
              'GET / HTTP/1.1'
            , 'Upgrade: IRC/6.9'
            , '', ''
          ].join('\r\n'));

          // send from client to server
          // tests that socket is still alive
          // this will not keep the socket open as the server does not handle it
          setTimeout(function() {
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
      var server = http.createServer()
        , engine = eio.attach(server, { destroyUpgradeTimeout: 100 });

      // write to the socket to keep engine.io from closing it by writing before the timeout
      server.on('upgrade', function(req, socket) {
        socket.write('foo');
        socket.on('data', function(chunk) {
          expect(chunk.toString()).to.be('foo');
          socket.end();
        });
      });

      server.listen(function () {
        var client = net.createConnection(server.address().port);

        client.on('connect', function () {
          client.setEncoding('ascii');
          client.write([
              'GET / HTTP/1.1'
            , 'Upgrade: IRC/6.9'
            , '', ''
          ].join('\r\n'));

          // test that socket is still open by writing after the timeout period
          setTimeout(function() {
            client.write('foo');
          }, 200);

          client.on('data', function (data) {
          });

          client.on('end', done);
        });
      });
    });

    it('should preserve original request listeners', function (done) {
      var listeners = 0
        , server = http.createServer(function (req, res) {
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
