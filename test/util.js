
/**
 * Test dependencies.
 */

var expect = require('expect.js');
var eio = require('../');

var util = eio.util

/**
 * Tests.
 */

describe('util', function () {

  it('should parse an uri', function () {
    var http = util.parseUri('http://google.com')
      , https = util.parseUri('https://www.google.com:80')
      , query = util.parseUri('google.com:8080/foo/bar?foo=bar')
      , localhost = util.parseUri('localhost:8080')
      , ipv6 = util.parseUri('2001:0db8:85a3:0042:1000:8a2e:0370:7334')
      , ipv6short = util.parseUri('2001:db8:85a3:42:1000:8a2e:370:7334')
      , ipv6port = util.parseUri('2001:db8:85a3:42:1000:8a2e:370:7334:80')
      , ipv6abbrev = util.parseUri('2001::7334:a:80')

    expect(http.protocol).to.be('http');
    expect(http.port).to.be('');
    expect(http.host).to.be('google.com');
    expect(https.protocol).to.be('https');
    expect(https.port).to.be('80');
    expect(https.host).to.be('www.google.com');
    expect(query.port).to.be('8080');
    expect(query.query).to.be('foo=bar');
    expect(query.path).to.be('/foo/bar');
    expect(query.relative).to.be('/foo/bar?foo=bar');
    expect(localhost.protocol).to.be('');
    expect(localhost.host).to.be('localhost');
    expect(localhost.port).to.be('8080');
    expect(ipv6.protocol).to.be('');
    expect(ipv6.host).to.be('2001:0db8:85a3:0042:1000:8a2e:0370:7334');
    expect(ipv6.port).to.be('');
    expect(ipv6short.protocol).to.be('');
    expect(ipv6short.host).to.be('2001:db8:85a3:42:1000:8a2e:370:7334');
    expect(ipv6short.port).to.be('');
    expect(ipv6port.protocol).to.be('');
    expect(ipv6port.host).to.be('2001:db8:85a3:42:1000:8a2e:370:7334');
    expect(ipv6port.port).to.be('80');
    expect(ipv6abbrev.protocol).to.be('');
    expect(ipv6abbrev.host).to.be('2001::7334:a:80');
    expect(ipv6abbrev.port).to.be('');
  });

  it('should construct a query string from an object', function () {
    expect(util.qs({ a: 'b' })).to.be('a=b');
    expect(util.qs({ a: 'b', c: 'd' })).to.be('a=b&c=d');
    expect(util.qs({ a: 'b', c: 'tobi rocks' })).to.be('a=b&c=tobi%20rocks');
  });

});
