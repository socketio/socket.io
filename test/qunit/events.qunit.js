/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
(function(){
  module('events.js');
  
  test('add listeners', function(){
    var event = new io.EventEmitter
      , calls = 0;
    
    event.on('test', function(a, b){
      ++calls;
      ok(a === 'a');
      ok(b === 'b');
    });
    
    event.emit('test', 'a', 'b');
    ok(calls === 1);
    ok(event.on === event.addListener);
  });
  
  test('remove listener', function(){
    var event = new io.EventEmitter;
    function empty(){}
    
    event.on('test', empty);
    event.on('test:more', empty);
    event.removeAllListeners('test');
    
    deepEqual([], event.listeners('test'));
    deepEqual([empty], event.listeners('test:more'));
  });
  
  test('remove all listeners', function(){
    var event = new io.EventEmitter;
    function empty(){}
    
    event.on('test', empty);
    event.on('test:more', empty);
    event.removeAllListeners();
    
    deepEqual([], event.listeners('test'));
    deepEqual([], event.listeners('test:more'));
  });
  
  test('remove incorrect listeners', function(){
    var event = new io.EventEmitter
      , calls = 0;
    
    function one(){ ++calls }
    function two(){ ++calls }
    function three(){ ++calls }
    
    event.on('one', one);
    event.removeListener('one', one);
    deepEqual([], event.listeners('one'));
    
    event.on('two', two);
    event.removeListener('two', one);
    deepEqual([two], event.listeners('two'));
    
    event.on('three', three);
    event.on('three', two);
    event.removeListener('three', three);
    deepEqual([two], event.listeners('three'));
  });
  
  test('number of arguments', function(){
    var event = new io.EventEmitter
      , number = [];
    
    event.on('test', function(){
      number.push(arguments.length);
    });
    
    event.emit('test');
    event.emit('test', null);
    event.emit('test', null, null);
    event.emit('test', null, null, null);
    event.emit('test', null, null, null, null);
    event.emit('test', null, null, null, null, null);
    
    deepEqual([0, 1, 2, 3, 4, 5], number);
  });
  
  test('once', function(){
    var event = new io.EventEmitter
      , calls = 0;
    
    event.once('test', function(a, b){
      ++calls;
    });
    
    event.emit('test', 'a', 'b');
    event.emit('test', 'a', 'b');
    event.emit('test', 'a', 'b');
    
    function removed(){
      ok(false, 'should not be emitted');
    };
    
    event.once('test:removed', removed);
    event.removeListener('test:removed', removed);
    event.emit('test:removed');
    
    ok(calls === 1);
  })
  
}())