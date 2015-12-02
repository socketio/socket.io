
var loc = {};
var url = require('../lib/url');
var expect = require('expect.js');

describe('url', function(){

  it('works with undefined', function(){
    loc.hostname = 'woot.com';
    loc.protocol = 'https:';
    loc.port = 4005;
    loc.host = loc.hostname + ':' + loc.port;
    var parsed = url(undefined, loc);
    expect(parsed.host).to.be('woot.com');
    expect(parsed.protocol).to.be('https');
    expect(parsed.port).to.be('4005');
  });

  it('works with relative paths', function(){
    loc.hostname = 'woot.com';
    loc.protocol = 'https:';
    loc.port = 3000;
    loc.host = loc.hostname + ':' + loc.port;
    var parsed = url('/test', loc);
    expect(parsed.host).to.be('woot.com');
    expect(parsed.protocol).to.be('https');
    expect(parsed.port).to.be('3000');
  });

  it('works with no protocol', function(){
    loc.protocol = 'http:';
    var parsed = url('localhost:3000', loc);
    expect(parsed.host).to.be('localhost');
    expect(parsed.port).to.be('3000');
    expect(parsed.protocol).to.be('http');
  });

  it('works with no schema', function(){
    loc.protocol = 'http:';
    var parsed = url('//localhost:3000', loc);
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

    expect(url('/woot', loc).path).to.be('/woot');
    expect(url('http://google.com').path).to.be('/');
    expect(url('http://google.com/').path).to.be('/');
  });

  it('works with ipv6', function(){
    var parsed = url('http://[::1]');
    expect(parsed.protocol).to.be('http');
    expect(parsed.host).to.be('::1');
    expect(parsed.port).to.be('80');
    expect(parsed.id).to.be('http://[::1]:80');
  });

  it('works with ipv6 location', function(){
    loc.protocol = 'http:';
    loc.hostname = '[::1]';
    loc.port = '';
    loc.host = loc.hostname + ':' + loc.port;

    var parsed = url(undefined, loc);
    expect(parsed.protocol).to.be('http');
    expect(parsed.host).to.be('::1');
    expect(parsed.port).to.be('80');
    expect(parsed.id).to.be('http://[::1]:80');
  });
});
