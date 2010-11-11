var encode = require('socket.io/utils').encode
  , decode = require('socket.io/utils').decode
  , messageEncode = require('socket.io/utils').messageEncode
  , messageDecode = require('socket.io/utils').messageDecode;

module.exports = {
  
  'test data decoding': function(assert){
    var disconnection = decode('0:0:,')
      , message = decode('1:18:r:chat:Hello world,')
      , incomplete = decode('5:100')
      , incomplete2 = decode('6:3:')
      , incomplete3 = decode('7:10:abcdefghi')
      , unparseable = decode(':')
      , unparseable2 = decode('1::');

    assert.ok(Array.isArray(disconnection));
    assert.ok(disconnection[0] === '0');
    assert.ok(disconnection[1] === '');
    assert.ok(Array.isArray(message);
    assert.ok(message[0] === '1');
    assert.ok(message[1] === 'Hello world');
    assert.ok(-1 === incomplete === incomplete2 === incomplete3);
    assert.ok(false === unparseable === unparseable2);
  },
  
  'test decoding of bad framed messages': function(assert){
    var decoded = decode('~m~5~m~abcde' + '~m\uffsdaasdfd9~m~1aaa23456789');
    assert.equal(decoded.length, 1);
    assert.equal(decoded[0], 'abcde');
    assert.equal(decoded[1], undefined);
  },
  
  'test encoding': function(assert){
    assert.equal(encode(['abcde', '123456789']), '~m~5~m~abcde' + '~m~9~m~123456789');
    assert.equal(encode('asdasdsad'), '~m~9~m~asdasdsad');
    assert.equal(encode(''), '~m~0~m~');
    assert.equal(encode(null), '~m~0~m~');
  }
};
