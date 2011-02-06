var assert = require('assert')
    encode = require('socket.io/utils').encode,
    decode = require('socket.io/utils').decode;

module.exports = {
  'test decoding': function(){
    var decoded = decode('~m~5~m~abcde' + '~m~9~m~123456789');
    assert.equal(decoded.length, 2);
    assert.equal(decoded[0], 'abcde');
    assert.equal(decoded[1], '123456789');
  },
  
  'test decoding of bad framed messages': function(){
    var decoded = decode('~m~5~m~abcde' + '~m\uffsdaasdfd9~m~1aaa23456789');
    assert.equal(decoded.length, 1);
    assert.equal(decoded[0], 'abcde');
    assert.equal(decoded[1], undefined);
  },
  
  'test encoding': function(){
    assert.equal(encode(['abcde', '123456789']), '~m~5~m~abcde' + '~m~9~m~123456789');
    assert.equal(encode('asdasdsad'), '~m~9~m~asdasdsad');
    assert.equal(encode(''), '~m~0~m~');
    assert.equal(encode(null), '~m~0~m~');
  }
};
