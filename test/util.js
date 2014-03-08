
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

  it('should construct a query string from an object', function () {
    expect(util.qs({ a: 'b' })).to.be('a=b');
    expect(util.qs({ a: 'b', c: 'd' })).to.be('a=b&c=d');
    expect(util.qs({ a: 'b', c: 'tobi rocks' })).to.be('a=b&c=tobi%20rocks');
  });

});
