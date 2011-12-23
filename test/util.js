
/**
 * Test dependencies.
 */

var util = eio.util

/**
 * Tests.
 */

describe('util', function () {

  it('should parse an uri', function () {
    var http = util.parseUri('http://google.com')
      , https = util.parseUri('https://www.google.com:80')
      , query = util.parseUri('google.com:8080/foo/bar?foo=bar')

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
  });

  it('should construct a query string from an object', function () {
    expect(util.qs({ a: 'b' })).to.be('a=b');
    expect(util.qs({ a: 'b', c: 'd' })).to.be('a=b&c=d');
    expect(util.qs({ a: 'b', c: 'tobi rocks' })).to.be('a=b&c=tobi%20rocks');
  });

});
