
/**
 * Module dependencies.
 */

var vbench = require('vbench')
  , io = require('../')
  , parser = io.parser;

console.log('  decode:');

var suite = vbench.createSuite({
    path: __dirname + '/decode.png'
  , min: 500
});

suite.bench('string', function(next){
  parser.decodePacket('4:::"2"');
  next();
});

suite.bench('event', function(next){
  parser.decodePacket('5:::{"name":"woot"}');
  next()
});

suite.bench('event+ack', function(next){
  parser.decodePacket('5:1+::{"name":"tobi"}');
  next();
});

suite.bench('event+data', function(next){
  parser.decodePacket('5:::{"name":"edwald","args":[{"a": "b"},2,"3"]}');
  next();
});

var payload = parser.encodePayload([
    parser.encodePacket({ type: 'message', data: '5', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: '53d', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: 'foobar', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: 'foobarbaz', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: 'foobarbazfoobarbaz', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: 'foobarbaz', endpoint: '' })
  , parser.encodePacket({ type: 'message', data: 'foobar', endpoint: '' })
]);

suite.bench('payload', function(next){
  parser.decodePayload(payload);
  next();
});

suite.run();