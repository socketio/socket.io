
var s = require('./s')
  , expect = require('expect.js')

describe('s.js', function () {

  it('should work', function () {
    expect(s('http://%s:%d', 'localhost', 40)).to.be('http://localhost:40');
  });

  it('should not extend prototype by default', function () {
    expect(String.prototype.s).to.be(undefined);
  });

  it('should work with numbers', function () {
    expect(s('http://%s:%d', 'localhost', {})).to.be('http://localhost:NaN');
  });

  it('should allow escaping', function () {
    expect(s('http://%%s:%d', 30)).to.be('http://%%s:30');
  });

  it('should extend String.prototype', function () {
    s.extend();
    expect('http://%s:%d'.s('localhost', 40)).to.be('http://localhost:40');
  });

  it('should jsonify', function () {
    expect('hello %j'.s({ hello: 'world' })).to.be('hello {"hello":"world"}');
  });

});
