
var old = global.location;
var loc = {};
var url = require('../lib/url');
var expect = require('expect.js');

describe('url', function(){

  it('works with relative paths', function(){
    loc.hostname = 'woot.com';
    loc.protocol = 'https:';
    var parsed = url('/test', loc);
    expect(parsed.host).to.be('woot.com');
    expect(parsed.protocol).to.be('https');
  });

  it('works with no protocol', function(){
    loc.protocol = 'http:';
    var parsed = url('localhost:3000', loc);
    expect(parsed.host).to.be('localhost');
    expect(parsed.port).to.be('3000');
    expect(parsed.protocol).to.be('http');
  });

  it('forces ports for unique url ids', function(){
    var id1 = url('http://google.com:80/');
    var id2 = url('http://google.com/');
    var id3 = url('https://google.com/');
    expect(id1.id).to.be(id2.id);
    expect(id1.id).to.not.be(id3.id);
    expect(id2.id).to.not.be(id3.id);
  });

  it('identifies the namespace', function(){
    loc.protocol = 'http:';
    loc.hostname = 'woot.com';

    expect(url('/woot').path).to.be('/woot');
    expect(url('http://google.com').path).to.be('/');
    expect(url('http://google.com/').path).to.be('/');
  });

});
