var listener = require('socket.io/listener'),
		Client = require('socket.io/client');

module.exports = {
	'test decoding': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('~m~5~m~abcde' + '~m~9~m~123456789');
		assert.equal(decoded.length, 2);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], '123456789');
	},
	
	'test decoding of bad framed messages': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('~m~5~m~abcde' + '~m\uffsdaasdfd9~m~1aaa23456789');
		assert.equal(decoded.length, 1);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], undefined);
	},
	
	'test encoding': function(assert){
		var client = new Client(listener, {}, {});
		assert.equal(client._encode(['abcde', '123456789']), '~m~5~m~abcde' + '~m~9~m~123456789');
		assert.equal(client._encode('asdasdsad'), '~m~9~m~asdasdsad');
		assert.equal(client._encode(''), '~m~0~m~');
		assert.equal(client._encode(null), '~m~0~m~');
	}
};