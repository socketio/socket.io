var listener = require('socket.io/listener'),
		Client = require('socket.io/client');

module.exports = {
	'test decoding': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('\ufffdm\ufffd5\ufffdm\ufffdabcde' + '\ufffdm\ufffd9\ufffdm\ufffd123456789');
		assert.equal(decoded.length, 2);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], '123456789');
	},
	
	'test decoding of bad framed messages': function(assert){
		var client = new Client(listener, {}, {}),
				decoded = client._decode('\ufffdm\ufffd5\ufffdm\ufffdabcde' + '\ufffdm\uffsdaasdfd9\ufffdm\ufffd1aaa23456789');
		assert.equal(decoded.length, 1);
		assert.equal(decoded[0], 'abcde');
		assert.equal(decoded[1], undefined);
	},
	
	'test encoding': function(assert){
		var client = new Client(listener, {}, {});
		assert.equal(client._encode(['abcde', '123456789']), '\ufffdm\ufffd5\ufffdm\ufffdabcde' + '\ufffdm\ufffd9\ufffdm\ufffd123456789');
		assert.equal(client._encode('asdasdsad'), '\ufffdm\ufffd9\ufffdm\ufffdasdasdsad');
		assert.equal(client._encode(''), '\ufffdm\ufffd0\ufffdm\ufffd');
		assert.equal(client._encode(null), '\ufffdm\ufffd0\ufffdm\ufffd');
	}
};