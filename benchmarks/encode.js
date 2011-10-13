
/**
 * Module dependencies.
 */

var vbench = require('vbench')
  , io = require('../')
  , parser = io.parser;

console.log('\n  encode:');

var suite = vbench.createSuite({
    path: __dirname + '/encode.png'
  , min: 500
});

suite.bench('string', function(next){
  parser.encodePacket({
      type: 'json'
    , endpoint: ''
    , data: '2'
  })
  next();
});

suite.bench('event', function(next){
  parser.encodePacket({
      type: 'event'
    , name: 'woot'
    , endpoint: ''
    , args: []
  });
  next();
});

suite.bench('event+ack', function(next){
  parser.encodePacket({
      type: 'json'
    , id: 1
    , ack: 'data'
    , endpoint: ''
    , data: { a: 'b' }
  });
  next();
});

suite.bench('event+data', function(next){
  parser.encodePacket({
      type: 'event'
    , name: 'edwald'
    , endpoint: ''
    , args: [{a: 'b'}, 2, '3']
  });
  next();
});

suite.bench('payload', function(next){
  parser.encodePayload([
      parser.encodePacket({ type: 'message', data: '5', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: '53d', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: 'foobar', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: 'foobarbaz', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: 'foobarbazfoobarbaz', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: 'foobarbaz', endpoint: '' })
    , parser.encodePacket({ type: 'message', data: 'foobar', endpoint: '' })
  ]);
  next();
});

suite.run();