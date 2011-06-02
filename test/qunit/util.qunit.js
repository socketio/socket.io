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
      , query = io.util.parseUri('google.com/foo/bar?foo=bar');
    
    ok(http.protocol === 'http');
    ok(http.host === 'google.com');
    ok(https.protocol === 'https');
    ok(https.port === '80');
    ok(https.host === 'www.google.com');
    ok(query.query === 'foo=bar');
    ok(query.path  === '/foo/bar');
    ok(query.relative === '/foo/bar?foo=bar')
  });
  
  test('unique uri', function(){
    var protocol = io.util.parseUri('http://google.com')
      , noprotocol = io.util.parseUri('google.com')
      , https = io.util.parseUri('https://google.com')
      , path = io.util.parseUri('https://google.com/google.com/com/')
      
    ok(io.util.uniqueUri(protocol) === 'http://google.com:80');
    ok(io.util.uniqueUri(noprotocol) === 'http://google.com:80');
    ok(io.util.uniqueUri(https) === 'https://google.com:443');
    ok(io.util.uniqueUri(path) === 'https://google.com:443')
  });
  
  test('request', function(){
    ok(!!io.util.request());
  });
  
  test('is array', function(){
    ok(io.util.isArray([]));
    ok(!io.util.isArray({}));
    ok(!io.util.isArray('str'));
    ok(!io.util.isArray(new Date()));
    ok(!io.util.isArray(arguments));
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
    equal(start.foo, 'foo');
    equal(start.bar, 'bar');
    
    io.util.merge(start,extra);
    equal(start.ping, 'pong');
    equal(start.foo, 'foo');
    
    io.util.merge(deep, deeper);
    equal(deep.foo, 'bar');
    equal(deep.level1.foo, 'baz');
    equal(deep.level1.level2.foo, 'foo');
    equal(deep.level1.level2.level3.foo, 'pewpew');
  });
  
  test('defer', function(){
    stop(1000);
    var now = +new Date();
    io.util.defer(function(){
      ok(+new Date() - now >= ( io.util.webkit ? 100 : 0 ) );
      start();
    })
  });
  
  test('indexOf', function(){
    var data = ['socket',2,3,4,'socket',5,6,7,'io'];
    equal(io.util.indexOf(data,'socket',1),4);
    equal(io.util.indexOf(data,'socket',0),0);
  });
}())