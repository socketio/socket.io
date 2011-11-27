
/**
 * Test dependencies.
 */

var util = require('../lib/util')

/**
 * Tests.
 */

describe('util', function () {

  describe('parse uri', function () {
    var http = util.parseUri('http://google.com')
      , https = util.parseUri('https://www.google.com:80')
      , query = util.parseUri('google.com:8080/foo/bar?foo=bar');

    http.protocol.should().eql('http');
    http.port.should().eql('');
    http.host.should().eql('google.com');
    https.protocol.should().eql('https');
    https.port.should().eql('80');
    https.host.should().eql('www.google.com');
    query.port.should().eql('8080');
    query.query.should().eql('foo=bar');
    query.path.should().eql('/foo/bar');
    query.relative.should().eql('/foo/bar?foo=bar');
  });

});
