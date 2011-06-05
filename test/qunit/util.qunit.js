/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
(function(){
  module('util.js');
  
  test('parse uri', function(){
    var http = io.util.parseUri('http://google.com')
      , https = io.util.parseUri('https://www.google.com:80')
      , query = io.util.parseUri('google.com:8080/foo/bar?foo=bar');
    
    equal(http.protocol, 'http', 'protocol is http');
    equal(http.port, '', 'default to empty string if the property doesn\'t exist')
    equal(http.host, 'google.com', 'host is google');
    equal(https.protocol, 'https', 'protocol is https');
    equal(https.port, '80', 'port should be 80 even if we are using a http protocol');
    equal(https.host, 'www.google.com', 'host includes subdomain');
    equal(query.port, '8080', 'protocol should work fine with 4 numbers')
    equal(query.query, 'foo=bar', 'query string without question mark');
    equal(query.path, '/foo/bar', 'path should only include the path, not query string');
    equal(query.relative, '/foo/bar?foo=bar', 'relative includes path and query string')
  });
  
  test('unique uri', function(){
    var protocol = io.util.parseUri('http://google.com')
      , noprotocol = io.util.parseUri('google.com')
      , https = io.util.parseUri('https://google.com')
      , path = io.util.parseUri('https://google.com/google.com/com/?foo=bar')
      
    equal(io.util.uniqueUri(protocol),'http://google.com:80', 'add default port number');
    equal(io.util.uniqueUri(noprotocol),'http://google.com:80', 'add default protocol');
    equal(io.util.uniqueUri(https), 'https://google.com:443', 'https protocols should get a different port number');
    equal(io.util.uniqueUri(path), 'https://google.com:443', 'paths and query strings should not create other uniques');
  });
  
  test('request', function(){
    ok(!!io.util.request(), 'should return a valid request object');
  });
  
  test('is array', function(){
    ok(io.util.isArray([]), 'arrays are arrays');
    ok(!io.util.isArray({}), 'objects are not arrays');
    ok(!io.util.isArray('str'), 'strings are not arrays');
    ok(!io.util.isArray(new Date()), 'dates are not arrays');
    ok(!io.util.isArray(arguments), 'arguments are not arrays');
  });
  
  test('merge, deep merge', function(){
    var start = {
          foo: 'bar'
        , bar: 'baz'
        }
      , duplicate = {
          foo: 'foo'
        , bar: 'bar'
        }
      , extra = {
          ping: 'pong'
        }
      , deep = {
          level1:{
            foo: 'bar'
          , level2: {
              foo: 'bar'
            ,  level3:{
                foo: 'bar'
              , rescursive: deep
              }
            }
          }
        }
        // same structure, but changed names
      , deeper = {
          foo: 'bar'
        , level1:{
            foo: 'baz'
          , level2: {
              foo: 'foo'
            ,  level3:{
                foo: 'pewpew'
              , rescursive: deep
              }
            }
          }
        };
    
    io.util.merge(start,duplicate);
    equal(start.foo, 'foo', 'bar is overwritten with foo');
    equal(start.bar, 'bar', 'baz is overwritten with bar');
    
    io.util.merge(start,extra);
    equal(start.ping, 'pong', 'ping property is added');
    equal(start.foo, 'foo', 'no changes to foo');
    
    io.util.merge(deep, deeper);
    equal(deep.foo, 'bar', 'deep merge can still add new properties');
    equal(deep.level1.foo, 'baz', 'bar is overwritten with baz');
    equal(deep.level1.level2.foo, 'foo', 'bar is overwritten with foo');
    equal(deep.level1.level2.level3.foo, 'pewpew', 'bar is overwritten with pewpew');
  });
  
  test('defer', function(){
    stop(1000);
    var now = +new Date();
    io.util.defer(function(){
      ok(+new Date() - now >= ( io.util.webkit ? 100 : 0 ) , 'webkit browser should wait 100ms after onload to fire');
      start();
    })
  });
  
  test('indexOf', function(){
    var data = ['socket',2,3,4,'socket',5,6,7,'io'];
    equal(io.util.indexOf(data,'socket',1), 4, 'find the second `socket` string by changing the initial index');
    equal(io.util.indexOf(data,'socket'), 0, 'find the first `socket` string');
    equal(io.util.indexOf(data,'waffles'), -1, 'waffles is not in our data array');
  });
}())