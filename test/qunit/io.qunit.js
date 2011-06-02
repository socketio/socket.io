/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
(function(){
  module('io.js');
  
  test('client version number', function(){
    ok(!!io.version.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/));
  });
  
  test('socket.io protocol version', function(){
    ok(typeof io.protocol === 'number');
    ok(!!io.protocol.toString().match(/^\d+$/));
  });
  
  test('socket.io available transports', function(){
    ok(io.transports.length > 0);
  });
}())