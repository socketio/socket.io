
var loc = global.location = {};
var url = require('../lib/url');
var expect = require('expect.js');

describe('url', function(){

  it('works with relative paths', function(){
    loc.hostname = 'woot.com';
    loc.protocol = 'https:';
    var parsed = url('/test');
    expect(parsed.hostname).to.be('woot.com');
    expect(parsed.protocol).to.be('https:');
  });

  it('works with no protocol', function(){
    loc.protocol = 'http:';
    var parsed = url('localhost:3000');
    expect(parsed.protocol).to.be('http:');
    expect(parsed.hostname).to.be('localhost');
    expect(parsed.host).to.be('localhost:3000');
    expect(parsed.port).to.be('3000');
  });

  it('ignores default ports for unique url ids', function(){
    var id1 = url('http://google.com:80/');
    var id2 = url('http://google.com/');
    var id3 = url('https://google.com/');
    expect(id1.id).to.be(id2.id);
    expect(id1.id).to.not.be(id3.id);
  });

  it('identifies the namespace', function(){
    loc.protocol = 'http:';
    loc.hostname = 'woot.com';

    expect(url('/woot').nsp).to.be('/woot');
    expect(url('/woot').path).to.be(undefined);
    expect(url('http://google.com').nsp).to.be('/');
    expect(url('http://google.com/').nsp).to.be('/');
    expect(url('http://google.com/').path).to.be(undefined);

    var parsed = url({
      host: 'google.com',
      port: 3000,
      path: '/engine.io',
      nsp: '/'
    });
    expect(parsed.hostname).to.be('google.com');
    expect(parsed.protocol).to.be('http:');
  });

});
