
var expect = require('expect.js');
var eio = require('../');

describe('engine.io-client', function () {
  var open;

  before(function() {
    open = eio.prototype.open;
    // override Socket#open to not connect
    eio.prototype.open = function() {};
  });

  after(function() {
    eio.prototype.open = open;
  });

  it('should expose protocol number', function () {
    expect(eio.protocol).to.be.a('number');
  });

  it('should properly parse http uri without port', function() {
    var client = eio('http://localhost');
    expect(client.port).to.be('80');
  });

  it('should properly parse https uri without port', function() {
    var client = eio('https://localhost');
    expect(client.hostname).to.be('localhost');
    expect(client.port).to.be('443');
  });

  it('should properly parse wss uri without port', function() {
    var client = eio('wss://localhost');
    expect(client.hostname).to.be('localhost');
    expect(client.port).to.be('443');
  });

  it('should properly parse wss uri with port', function() {
    var client = eio('wss://localhost:2020');
    expect(client.hostname).to.be('localhost');
    expect(client.port).to.be('2020');
  });

  it('should properly parse a host without port', function() {
    var client = eio({ host: 'localhost' });
    expect(client.hostname).to.be('localhost');
    expect(client.port).to.be('80');
  });

  it('should properly parse a host with port', function() {
    var client = eio({ host: 'localhost', port: '8080' });
    expect(client.hostname).to.be('localhost');
    expect(client.port).to.be('8080');
  });

  it('should properly parse an IPv6 uri without port', function() {
    var client = eio('http://[::1]');
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('80');
  });

  it('should properly parse an IPv6 uri with port', function() {
    var client = eio('http://[::1]:8080');
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('8080');
  });

  it('should properly parse an IPv6 host without port (1/2)', function() {
    var client = eio({ host: '[::1]' });
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('80');
  });

  it('should properly parse an IPv6 host without port (2/2)', function() {
    var client = eio({ secure: true, host: '[::1]' });
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('443');
  });

  it('should properly parse an IPv6 host with port', function() {
    var client = eio({ host: '[::1]', port: '8080' });
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('8080');
  });

  it('should properly parse an IPv6 host without brace', function() {
    var client = eio({ host: '::1' });
    expect(client.hostname).to.be('::1');
    expect(client.port).to.be('80');
  });
});
