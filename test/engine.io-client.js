
var expect = require('expect.js');
var eio = require('../');

describe('engine.io-client', function () {

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should properly parse http uri without port', function(done) {
    var client = eio('http://localhost');
    client.on('close', function() {
      done();
    });
    expect(client.port).to.be('80');
    client.close();
  });

  it('should properly parse https uri without port', function(done) {
    var client = eio('https://localhost');
    client.on('close', function() {
      done();
    });
    expect(client.port).to.be('443');
    client.close();
  });

  it('should properly parse wss uri without port', function(done) {
    var client = eio('wss://localhost');
    client.on('close', function() {
      done();
    });
    expect(client.port).to.be('443');
    client.close();
  });

  it('should properly parse wss uri with port', function(done) {
    var client = eio('wss://localhost:2020');
    client.on('close', function() {
      done();
    });
    expect(client.port).to.be('2020');
    client.close();
  });

});
