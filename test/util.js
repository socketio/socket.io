
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

});
