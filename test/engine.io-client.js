
var expect = require('expect.js');
var eio = require('../');

describe('engine.io-client', function () {

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should properly parse http uri without port', function() {
    var server = eio('http://localhost');
    expect(server.port).to.be('80');
  });

  it('should properly parse https uri without port', function() {
    var server = eio('https://localhost');
    expect(server.port).to.be('443');
  });

  it('should properly parse wss uri without port', function() {
    var server = eio('wss://localhost');
    expect(server.port).to.be('443');
  });

  it('should properly parse wss uri with port', function() {
    var server = eio('wss://localhost:2020');
    expect(server.port).to.be('2020');
  });

});
