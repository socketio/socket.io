/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
(function(){
  module('io.js');
  
  test('client version number', function(){
    ok(!!io.version.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/), 'semver version number');
  });
  
  test('socket.io protocol version', function(){
    ok(typeof io.protocol === 'number', 'protocol is a number');
    ok(!!io.protocol.toString().match(/^\d+$/), 'integer not a float');
  });
  
  test('socket.io available transports', function(){
    ok(io.transports.length > 0, 'multiple transports available');
  });
}())