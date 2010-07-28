var listener = require('socket.io/listener'),
		Client = require('socket.io/client');

module.exports = {
	'test decoding': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('\uffffm\uffff5\uffffm\uffffabcde' + '\uffffm\uffff9\uffffm\uffff123456789');
		assert.equal(decoded.length, 2);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], '123456789');
	},
	
	'test decoding of bad framed messages': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('\uffffm\uffff5\uffffm\uffffabcde' + '\uffffm\uffsdaasdfd9\uffffm\uffff1aaa23456789');
		assert.equal(decoded.length, 1);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], undefined);
	},
	
	'test encoding': function(assert){
		var client = new Client(listener, {}, {});
		assert.equal(client._encode(['abcde', '123456789']), '\uffffm\uffff5\uffffm\uffffabcde' + '\uffffm\uffff9\uffffm\uffff123456789');
		assert.equal(client._encode('asdasdsad'), '\uffffm\uffff9\uffffm\uffffasdasdsad');
		assert.equal(client._encode(''), '\uffffm\uffff0\uffffm\uffff');
		assert.equal(client._encode(null), '\uffffm\uffff0\uffffm\uffff');
	}
};