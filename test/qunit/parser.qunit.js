/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */
(function(nativeJSON){
  module('parser.js');
  
  // use the correct JSON decoder
  var JSON = nativeJSON ? nativeJSON : io.JSON;
  
  test('decoding error packet', function(){
    deepEqual(
      io.parser.decodePacket('7:::')
    , {
        type: 'error'
      , reason: ''
      , advice: ''
      , endpoint: ''
      }
    , 'decoding error packet'
    );
  });
  
  test('decoding error packet with reason', function(){
    deepEqual(
      io.parser.decodePacket('7:::0')
    , {
        type: 'error'
      , reason: 'transport not supported'
      , advice: ''
      , endpoint: ''
      }
    , 'decoding error packet with reason'
    );
  });
  
  test('decoding error packet with reason and advice', function(){
    deepEqual(
      io.parser.decodePacket('7:::2+0')
    , {
        type: 'error'
      , reason: 'unauthorized'
      , advice: 'reconnect'
      , endpoint: ''
      }
    , 'decoding error packet with reason and advice'
    );
  });
  
  test('decoding error packet with endpoint', function(){
    deepEqual(
      io.parser.decodePacket('7::/woot')
    , {
        type: 'error'
      , reason: ''
      , advice: ''
      , endpoint: '/woot'
      }
    , 'decoding error packet with endpoint'
    );
  });
  
  test('decoding ack packet', function(){
    deepEqual(
      io.parser.decodePacket('6:::140')
    , {
        type: 'ack'
      , ackId: '140'
      , endpoint: ''
      , args: []
      }
    , 'decoding ack packet'
    );
  });
  
  test('decoding ack packet with args', function(){
    deepEqual(
      io.parser.decodePacket('6:::12+' + JSON.stringify(['woot', 'wa']))
    , {
        type: 'ack'
      , ackId: '12'
      , endpoint: ''
      , args: ['woot', 'wa']
      }
    , 'decoding ack packet with args'
    );
  });
  
  
  test('decoding ack packet with bad json', function(){
    deepEqual(
      io.parser.decodePacket('6:::1+{"++]')
    , {
          type: 'ack'
        , ackId: '1'
        , endpoint: ''
        , args: []
      }
    , 'decoding ack packet with bad json'
    );
  });
  
  test('decoding json packet', function(){
    deepEqual(
      io.parser.decodePacket('4:::"2"')
    , {
        type: 'json'
      , endpoint: ''
      , data: '2'
      }
    , 'decoding json packet'
    );
  });
    
  test('decoding json packet with message id and ack data', function(){
    deepEqual(
      io.parser.decodePacket('4:::"2"')
    , {
        type: 'json'
      , endpoint: ''
      , data: '2'
      }
    , 'decoding json packet with message id and ack data'
    );
  });
  
  test('decoding an event packet', function(){
    deepEqual(
      io.parser.decodePacket('5:::woot')
    , {
        type: 'event'
      , name: 'woot'
      , endpoint: ''
      , args: []
      }
    , 'decoding an event packet'
    );
  });
  
  test('decoding an event packet with message id and ack', function(){
    deepEqual(
      io.parser.decodePacket('5:1+::tobi')
    , {
        type: 'event'
      , id: "1"
      , ack: 'data'
      , endpoint: ''
      , name: 'tobi'
      , args: []
      }
    , 'decoding an event packet with message id and ack'
    );
  });
  
  test('decoding an event packet with data', function(){
    deepEqual(
      io.parser.decodePacket('5:::edwald\ufffd[{"a": "b"},2,"3"]')
    , {
        type: 'event'
      , name: 'edwald'
      , endpoint: ''
      , args: [{a: 'b'}, 2, '3']
      }
    , 'decoding an event packet with data'
    );
  });
  
  test('decoding a message packet', function(){
    deepEqual(
      io.parser.decodePacket('3:::woot')
    , {
        type: 'message'
      , endpoint: ''
      , data: 'woot'
      }
    , 'decoding a message packet'
    );
  });
  
  test('decoding a message packet with unicode characters', function(){
    deepEqual(
      io.parser.decodePacket('3:::разъем')
    , {
        type: 'message'
      , endpoint: ''
      , data: 'разъем'
      }
    , 'decoding a message packet with unicode characters'
    );
  });
  
  test('decoding a message packet with whitespace character', function(){
    var whitespace = String.fromCharCode(56361)
      , packet = io.parser.decodePacket('3:::' + whitespace);
    
    equal(packet.data[0].charCodeAt(0), 56361, 'correct white space unicode number');
    deepEqual(
      packet
    , {
        type: 'message'
      , endpoint: ''
      , data: whitespace
      }
    , 'decoding a message packet with whitespace character'
    );
  });
  
  test('decoding a message packet with id and endpoint', function(){
    deepEqual(
      io.parser.decodePacket('3:5:/tobi')
    , {
        type: 'message'
      , id: "5"
      , ack: true
      , endpoint: '/tobi'
      , data: ''
      }
    , 'decoding a message packet with id and endpoint'
    );
  });
  
  test('decoding a heartbeat packet', function(){
    deepEqual(
      io.parser.decodePacket('2:::')
    , {
        type: 'heartbeat'
      , endpoint: ''
      }
    , 'decoding a heartbeat packet'
    );
  });
  
  test('decoding a connection packet', function(){
    deepEqual(
      io.parser.decodePacket('1::/tobi')
    , {
        type: 'connect'
      , endpoint: '/tobi'
      , qs: ''
      }
    , 'decoding a connection packet'
    );
  });
  
  test('decoding a connection packet with query string', function(){
    deepEqual(
      io.parser.decodePacket('1::/test:?test=1')
    , {
        type: 'connect'
      , endpoint: '/test'
      , qs: '?test=1'
      }
    , 'decoding a connection packet with query string'
    );
  });
  
  test('decoding a disconnection packet', function(){
    deepEqual(
      io.parser.decodePacket('0::/woot')
    , {
        type: 'disconnect'
      , endpoint: '/woot'
      }
    , 'decoding a disconnection packet'
    );
  });
  
  test('encoding error packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'error'
      , reason: ''
      , advice: ''
      , endpoint: ''
      })
    , '7::'
    , 'encoding error packet'
    );
  });
  
  test('encoding error packet with reason', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'error'
      , reason: 'transport not supported'
      , advice: ''
      , endpoint: ''
      })
    , '7:::0'
    , 'encoding error packet with reason'
    );
  });
  
  test('encoding error packet with reason and advice', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'error'
      , reason: 'unauthorized'
      , advice: 'reconnect'
      , endpoint: ''
      })
    , '7:::2+0'
    , 'encoding error packet with reason and advice'
    );
  });
  
  test('encoding error packet with endpoint', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'error'
      , reason: ''
      , advice: ''
      , endpoint: '/woot'
      })
    , '7::/woot'
    , 'encoding error packet with endpoint'
    );
  });
  
  test('encoding ack packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'ack'
      , ackId: '140'
      , endpoint: ''
      , args: []
      })
    , '6:::140'
    , 'encoding ack packet'
    );
  });
  
  test('encoding ack packet with args', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'ack'
      , ackId: '12'
      , endpoint: ''
      , args: ['woot', 'wa']
      })
    , '6:::12+' + JSON.stringify(['woot', 'wa'])
    , 'encoding ack packet with args'
    );
  });
  
  test('encoding json packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'json'
      , endpoint: ''
      , data: '2'
      })
    , '4:::"2"'
    , 'encoding json packet'
    );
  });
  
  test('encoding json packet with message id and ack data', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'json'
      , id: 1
      , ack: 'data'
      , endpoint: ''
      , data: { a: 'b' }
      })
    , '4:1+::{"a":"b"}'
    , 'encoding json packet with message id and ack data'
    );
  });
  
  test('encoding an event packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'event'
      , name: 'woot'
      , endpoint: ''
      , args: []
      })
    , '5:::woot'
    , 'encoding an event packet'
    );
  });
  
  test('encoding an event packet with message id and ack', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'event'
      , id: 1
      , ack: 'data'
      , endpoint: ''
      , name: 'tobi'
      , args: []
      })
    , '5:1+::tobi'
    , 'encoding an event packet with message id and ack'
    );
  });
  
  test('encoding an event packet with data', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'event'
      , name: 'edwald'
      , endpoint: ''
      , args: [{a: 'b'}, 2, '3']
      })
    , '5:::edwald\ufffd[{"a":"b"},2,"3"]'
    , 'encoding an event packet with data'
    );
  });
  
  test('encoding a message packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'message'
      , endpoint: ''
      , data: 'woot'
      })
    , '3:::woot'
    , 'encoding a message packet'
    );
  });
  
  test('encoding a message packet with unicode characters', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'message'
      , endpoint: ''
      , data: 'разъем'
      })
    , '3:::разъем'
    , 'encoding a message packet with unicode characters'
    );
  });
  
  test('encoding a message packet with whitespace character', function(){
    var whitespace = String.fromCharCode(56361)
      , packet = io.parser.encodePacket({
          type: 'message'
        , endpoint: ''
        , data: whitespace
      });
    equal(packet[4].charCodeAt(0), 56361, 'correct white space unicode number');
    deepEqual(
      packet
    , '3:::' + whitespace
    , 'encoding a message packet with whitespace character'
    );
  });
  
  test('encoding a message packet with id and endpoint', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'message'
      , id: 5
      , ack: true
      , endpoint: '/tobi'
      , data: ''
      })
    , '3:5:/tobi'
    , 'encoding a message packet with id and endpoint'
    );
  });
  
  test('encoding a heartbeat packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'heartbeat'
      , endpoint: ''
      })
    , '2::'
    , 'encoding a heartbeat packet'
    );
  });
  
  test('encoding a connection packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'connect'
      , endpoint: '/tobi'
      , qs: ''
      })
    , '1::/tobi'
    , 'encoding a connection packet'
    );
  });
  
  test('encoding a connection packet with query string', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'connect'
      , endpoint: '/test'
      , qs: '?test=1'
      })
    , '1::/test:?test=1'
    , 'encoding a connection packet with query string'
    );
  });
  
  test('encoding a disconnection packet', function(){
    deepEqual(
      io.parser.encodePacket({
        type: 'disconnect'
      , endpoint: '/woot'
      })
    , '0::/woot'
    , 'encoding a disconnection packet'
    );
  });
  
  test('test decoding a payload', function(){
    deepEqual(
      io.parser.decodePayload('\ufffd5\ufffd3:::5\ufffd7\ufffd3:::53d'
      + '\ufffd3\ufffd0::')
    , [
        { type: 'message', data: '5', endpoint: '' }
      , { type: 'message', data: '53d', endpoint: '' }
      , { type: 'disconnect', endpoint: '' }
      ]
    , 'test decoding a payload'
    );
  });
  
  test('test encoding a payload', function(){
    deepEqual(
      io.parser.encodePayload([
        io.parser.encodePacket({ type: 'message', data: '5', endpoint: '' })
      , io.parser.encodePacket({ type: 'message', data: '53d', endpoint: '' })
      ])
    , '\ufffd5\ufffd3:::5\ufffd7\ufffd3:::53d'
    , 'test decoding a payload'
    );
  });
  
}(window.JSON))