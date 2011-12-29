
/**
 * Test dependencies.
 */

var net = require('net')
  , http = require('http')

/**
 * Tests.
 */

describe('engine', function () {

  it('should expose version number', function () {
    expect(eio.version).to.match(/[0-9]+\.[0-9]+\.[0-9]+/);
  });

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  describe('listen', function () {
    it('should open a http server that returns 501', function (done) {
      var server = eio.listen(4000, function () {
        request.get('http://localhost:4000/', function (err, res) {
          expect(res.status).to.be(501);
          server.httpServer.once('close', done);
          server.httpServer.close();
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

      server.listen(4000, function () {
        request.get('http://localhost:4000/engine.io', function (err, res) {
          expect(res.status).to.be(500);
          server.once('close', done);
          server.close();
        });
      });
    });

    it('should respond to flash policy requests', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.write('<policy-file-request/>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          expect(data).to.contain('<allow-access-from');
          client.end();
          server.once('close', done);
          server.close();
        });
      });
    });

    it('should respond to flash policy requests in parts', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.write('<policy-file-request/>', function () {
          client.write('\0');
          client.setEncoding('ascii');
          client.on('data', function (data) {
            expect(data).to.contain('<allow-access-from');
            client.end();
            server.once('close', done);
            server.close();
          });
        });
      });
    });

    it('should not respond to borked flash policy requests', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          throw new Error('Should not respond');
        });
        setTimeout(function () {
          server.once('close', done);
          server.close();
        }, 20);
      });
    });

    it('should not respond to flash policy requests when policyFile:false', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { policyFile: false });

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          throw new Error('Should not fire');
        });
        setTimeout(function () {
          server.once('close', done);
          server.close();
        }, 20);
      });
    });

    it('should not respond to flash policy requests when no flashsocket', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { transports: ['xhr-polling', 'websocket'] });

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.write('<policy-file-req>\0');
        client.setEncoding('ascii');
        client.on('data', function (data) {
          throw new Error('Should not fire');
        });
        setTimeout(function () {
          server.once('close', done);
          server.close();
        }, 20);
      });
    });

    it('should destroy upgrades not handled by engine', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server);

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.setEncoding('ascii');
        client.write([
            'GET / HTTP/1.1'
          , 'Upgrade: IRC/6.9'
          , '', ''
        ].join('\r\n'));

        var check = setTimeout(function () {
          throw new Error('Client should have ended');
        }, 20);

        client.on('end', function () {
          server.once('close', done);
          server.close();
          clearTimeout(check);
        });
      });
    });

    it('should not destroy unhandled upgrades with destroyUpgrade:false', function (done) {
      var server = http.createServer()
        , engine = eio.attach(server, { destroyUpgrade: false });

      server.listen(4000, function () {
        var client = net.createConnection(4000);
        client.setEncoding('ascii');
        client.write([
            'GET / HTTP/1.1'
          , 'Upgrade: IRC/6.9'
          , '', ''
        ].join('\r\n'));

        var check = setTimeout(function () {
          server.once('close', done);
          server.close();
        }, 20);

        client.on('end', function () {
          throw new Error('Client should not end');
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

      server.listen(4000, function () {
        request.get('http://localhost:4000/engine.io', function (err, res) {
          expect(res.status).to.be(500);
          request.get('http://localhost:4000/test', function (err, res) {
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
