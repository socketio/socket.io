
var expect = require('expect.js');
var eio = require('../');

describe('engine.io-client', function () {

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should properly parse http uri without port', function(done) {
    var server = eio('http://localhost');
    server.on('close', function() {
      done();
    });
    expect(server.port).to.be('80');
    server.close();
  });

  it('should properly parse https uri without port', function(done) {
    var server = eio('https://localhost');
    server.on('close', function() {
      done();
    });
    expect(server.port).to.be('443');
    server.close();
  });

  it('should properly parse wss uri without port', function(done) {
    var server = eio('wss://localhost');
    server.on('close', function() {
      done();
    });
    expect(server.port).to.be('443');
    server.close();
  });

  it('should properly parse wss uri with port', function(done) {
    var server = eio('wss://localhost:2020');
    server.on('close', function() {
      done();
    });
    expect(server.port).to.be('2020');
    server.close();
  });

});
